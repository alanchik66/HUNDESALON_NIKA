/* Retain authored animation phases while their components are outside the viewport. */
const COMPONENT_SELECTOR = '.price-card, .price-section-navigation, .price-page-hero, .newsletter-section, footer, .services-grid .service-card, .header';

export function installMotionVisibility(document, window) {
  if (!document?.documentElement || !window?.IntersectionObserver || !window?.MutationObserver) return null;

  const components = new Set();
  const setPageVisibility = () => {
    document.documentElement.toggleAttribute('data-motion-page-hidden', document.hidden);
  };
  const observer = new window.IntersectionObserver(entries => {
    entries.forEach(entry => {
      entry.target.toggleAttribute('data-motion-offscreen', !entry.isIntersecting);
    });
  }, { rootMargin: '160px 0px', threshold: 0 });
  // The fixed header stops at the viewport edge when hidden. A prewarm margin
  // would keep it intersecting forever even though its pixels are offscreen.
  const headerObserver = new window.IntersectionObserver(entries => {
    entries.forEach(entry => {
      entry.target.toggleAttribute('data-motion-offscreen', !entry.isIntersecting || entry.intersectionRatio <= 0);
    });
  }, { rootMargin: '0px', threshold: [0, 0.01] });

  const scan = root => {
    const added = [];
    if (root.matches?.(COMPONENT_SELECTOR)) added.push(root);
    if (root.querySelectorAll) added.push(...root.querySelectorAll(COMPONENT_SELECTOR));
    added.forEach(component => {
      if (components.has(component)) return;
      components.add(component);
      (component.matches('.header') ? headerObserver : observer).observe(component);
    });
  };
  const mutationObserver = new window.MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(scan));
    // Search and category changes replace content; do not retain detached targets.
    components.forEach(component => {
      if (component.isConnected) return;
      observer.unobserve(component);
      headerObserver.unobserve(component);
      components.delete(component);
      component.removeAttribute('data-motion-offscreen');
    });
  });
  const start = () => {
    scan(document);
    if (document.body) mutationObserver.observe(document.body, { childList: true, subtree: true });
    setPageVisibility();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  document.addEventListener('visibilitychange', setPageVisibility);
  window.addEventListener('pageshow', setPageVisibility);

  return {
    disconnect() {
      observer.disconnect();
      headerObserver.disconnect();
      mutationObserver.disconnect();
      document.removeEventListener('DOMContentLoaded', start);
      document.removeEventListener('visibilitychange', setPageVisibility);
      window.removeEventListener('pageshow', setPageVisibility);
      components.forEach(component => component.removeAttribute('data-motion-offscreen'));
      components.clear();
      document.documentElement.removeAttribute('data-motion-page-hidden');
    },
  };
}

export function installScrollFrameBudget(document, window) {
  const body = document?.body;
  if (!body || !window || typeof window.MutationObserver !== 'function' ||
      typeof window.requestAnimationFrame !== 'function' || typeof window.cancelAnimationFrame !== 'function') return null;
  if (!body.classList.contains('price-page') && !document.querySelector('main[data-price-page]')) return null;
  const root = document.querySelector('.site-scroll-root');
  if (!root) return null;

  const modalClasses = ['nav-open', 'header-weather-expanded', 'price-modal-open', 'booking-modal-open', 'price-breed-menu-open'];
  const loaderReady = window.NikaSiteLoader?.ready;
  let ready = document.documentElement.dataset.siteReady === 'true' ||
    (!loaderReady && document.documentElement.dataset.priceReady === 'true');
  let disposed = false;
  let pageHidden = false;
  let waitForInactive = false;
  let constrained = false;
  let frame = null;
  let previous = null;
  let slowFrames = 0;
  const scrolling = () => root.classList.contains('site-scroll-active');
  const modalOpen = () => modalClasses.some(name => body.classList.contains(name));

  const clear = () => {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    previous = null;
    slowFrames = 0;
    if (root.hasAttribute('data-scroll-budget')) root.removeAttribute('data-scroll-budget');
  };
  const balance = () => {
    if (root.getAttribute('data-scroll-budget') !== 'balanced') root.setAttribute('data-scroll-budget', 'balanced');
  };
  const sync = () => {
    if (disposed) return;
    if (!scrolling()) {
      waitForInactive = false;
      clear();
      return;
    }
    if (document.hidden || pageHidden || !root.isConnected || modalOpen()) {
      waitForInactive = true;
      clear();
      return;
    }
    if (!ready || waitForInactive) {
      clear();
      return;
    }
    if (constrained) balance();
    else if (frame === null) frame = window.requestAnimationFrame(sample);
  };
  const sample = timestamp => {
    frame = null;
    if (disposed) return;
    if (!ready || waitForInactive || !scrolling() || document.hidden || pageHidden || !root.isConnected || modalOpen()) {
      sync();
      return;
    }
    if (previous !== null) slowFrames = timestamp - previous > 34 ? slowFrames + 1 : 0;
    previous = timestamp;
    if (slowFrames >= 3) {
      // This document remembers the result only in memory. Future scroll bursts
      // can skip sampling; idle content always keeps its full authored effects.
      constrained = true;
      balance();
      return;
    }
    frame = window.requestAnimationFrame(sample);
  };
  const suspendBurst = () => {
    waitForInactive = scrolling();
    clear();
  };
  const onVisibility = () => { if (document.hidden) suspendBurst(); };
  const onPageHide = () => { pageHidden = true; suspendBurst(); };
  const onPageShow = () => { pageHidden = false; suspendBurst(); };
  const onPageReady = () => {
    if (!loaderReady) { ready = true; sync(); }
  };
  // The data attribute written above is intentionally outside these filters.
  // Reuse the established scroll activity signal without another scroll handler.
  const rootObserver = new window.MutationObserver(sync);
  const bodyObserver = new window.MutationObserver(sync);
  rootObserver.observe(root, { attributes: true, attributeFilter: ['class'] });
  bodyObserver.observe(body, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('site:page-ready', onPageReady);
  if (loaderReady) {
    Promise.resolve(loaderReady).then(() => {
      if (disposed) return;
      ready = true;
      sync();
    }, () => {});
  }
  sync();

  return {
    disconnect() {
      disposed = true;
      clear();
      rootObserver.disconnect();
      bodyObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('site:page-ready', onPageReady);
    },
  };
}

/* Hold decorative loops at their current frame while native scrolling owns input. */
export function installScrollAnimationBudget(document, window) {
  const body = document?.body;
  const root = document?.querySelector?.('.site-scroll-root');
  if (!body || !root || !window?.MutationObserver || typeof document.getAnimations !== 'function' ||
      typeof window.Animation?.prototype?.updatePlaybackRate !== 'function' ||
      typeof window.setTimeout !== 'function' || typeof window.clearTimeout !== 'function') return null;
  if (!body.classList.contains('price-page') && !document.querySelector('main[data-price-page]')) return null;
  const touchMedia = window.matchMedia?.('(hover: none) and (pointer: coarse)');
  if (!touchMedia?.matches) return null;

  const modalClasses = ['nav-open', 'header-weather-expanded', 'price-modal-open', 'booking-modal-open', 'price-breed-menu-open'];
  const html = document.documentElement;
  const cache = new Map();
  const held = new Map();
  const restoring = new WeakMap();
  const scopes = new Map();
  let disposed = false, pageHidden = false, touchBlocked = false, waitForInactive = false, holding = false;
  let intent = null;
  let primeTask = null, graceTimer = null, refreshNeeded = true;
  const scrolling = () => root.classList.contains('site-scroll-active');
  const modalOpen = () => modalClasses.some(name => body.classList.contains(name));
  const allowed = () => html.dataset.priceReady === 'true' &&
    (!window.NikaSiteLoader || html.dataset.siteReady === 'true') &&
    touchMedia.matches && !disposed && root.isConnected && !pageHidden && !document.hidden && !modalOpen() &&
    !window.NikaSiteLoader?.active && !html.classList.contains('site-loading') && !document.getElementById('preloader');
  const criticalTarget = target => {
    for (let node = target; node; node = node.parentElement || node.getRootNode?.().host) {
      if (node.matches?.('#preloader, [data-weather-loading-scene]')) return true;
    }
    return false;
  };
  const cacheAnimation = animation => {
    const effect = animation.effect;
    const target = effect?.target;
    if (!target?.isConnected || typeof animation.transitionProperty === 'string' ||
        effect.getTiming().iterations !== Infinity || criticalTarget(target)) return;
    cache.set(animation, target);
    if (holding) hold(animation, target);
  };
  const restoreAll = () => {
    holding = false;
    for (const [animation, rate] of held) {
      try {
        // Supersede a pending hold before it reaches the timeline.
        if (animation.playbackRate === 0 || (animation.pending && animation.playbackRate === rate)) {
          animation.updatePlaybackRate(rate);
          if (animation.pending) restoring.set(animation, rate);
          animation.ready?.catch?.(() => {});
        }
      } catch { /* Canceled/replaced effects must not break native scrolling. */ }
    }
    held.clear();
  };
  function hold(animation, target) {
    if (held.has(animation) || !target.isConnected || animation.playState === 'idle') return;
    const rate = animation.playbackRate || (animation.pending && restoring.get(animation));
    if (!Number.isFinite(rate)) return;
    try {
      animation.updatePlaybackRate(0);
      restoring.delete(animation);
      held.set(animation, rate);
      animation.ready?.catch?.(() => {});
    } catch { /* Optional animation APIs can fail for a replaced animation. */ }
  }
  const clearIntent = () => {
    if (graceTimer !== null) window.clearTimeout(graceTimer);
    graceTimer = null;
    intent = null;
  };
  const cancelPrime = () => {
    if (primeTask === null) return;
    if (primeTask.idle) window.cancelIdleCallback(primeTask.id);
    else window.clearTimeout(primeTask.id);
    primeTask = null;
  };
  const busy = () => scrolling() || intent !== null || holding;
  const onAnimationStart = event => {
    if (!holding || !allowed()) { invalidate(); return; }
    // A newly created loop is local to its target; never rescan the document
    // in an input handler. Finite feedback/transitions retain their ownership.
    try {
      for (const animation of event.target?.getAnimations?.() || []) cacheAnimation(animation);
    } catch { /* The animation target may have been replaced. */ }
  };
  const invalidate = () => {
    refreshNeeded = true;
    if (!root.isConnected) suspend();
    else queuePrime();
  };
  const observeScope = scope => {
    if (scopes.has(scope)) return;
    const observer = new window.MutationObserver(invalidate);
    observer.observe(scope === document ? body : scope, { childList: true, subtree: true });
    scope.addEventListener('animationstart', onAnimationStart, { passive: true, capture: true });
    scopes.set(scope, observer);
  };
  const prime = () => {
    primeTask = null;
    if (disposed || document.hidden || pageHidden || busy()) return;
    const roots = [document], seen = new Set();
    for (let index = 0; index < roots.length; index += 1) {
      for (const element of roots[index].querySelectorAll('*')) {
        if (element.shadowRoot && !seen.has(element.shadowRoot)) { seen.add(element.shadowRoot); roots.push(element.shadowRoot); }
      }
    }
    for (const [scope, observer] of scopes) {
      if (scope === document || scope.host?.isConnected !== false) continue;
      observer.disconnect();
      scope.removeEventListener('animationstart', onAnimationStart, true);
      scopes.delete(scope);
    }
    cache.clear();
    for (const scope of roots) {
      observeScope(scope);
      try {
        for (const animation of scope.getAnimations?.() || []) cacheAnimation(animation);
      } catch { /* Optional open shadow roots can disappear. */ }
    }
    refreshNeeded = false;
  };
  const queuePrime = () => {
    if (!refreshNeeded || disposed || document.hidden || pageHidden || busy() || primeTask !== null) return;
    if (typeof window.requestIdleCallback === 'function' && typeof window.cancelIdleCallback === 'function') {
      primeTask = { idle: true, id: window.requestIdleCallback(prime, { timeout: 500 }) };
    } else primeTask = { idle: false, id: window.setTimeout(prime, 0) };
  };
  const suspend = () => {
    clearIntent();
    waitForInactive = scrolling();
    restoreAll();
  };
  function sync() {
    if (disposed) return;
    if (!allowed()) { suspend(); return; }
    const active = scrolling();
    if (active) clearIntent();
    else waitForInactive = false;
    if (waitForInactive || touchBlocked || (!active && intent === null)) {
      if (holding) restoreAll();
      queuePrime();
    } else if (!holding) {
      holding = true;
      cancelPrime();
      for (const [animation, target] of cache) hold(animation, target);
    }
  }
  const startIntent = kind => {
    if (scrolling()) { sync(); return; }
    clearIntent();
    intent = kind;
    // Input can land on a stationary region or become a tap. In both cases the
    // preemptive hold expires unless native scrolling has actually started.
    graceTimer = window.setTimeout(() => { clearIntent(); sync(); }, 240);
    sync();
  };
  const onTouchStart = event => {
    if (!event.isTrusted) return;
    if (event.touches?.length !== 1) { touchBlocked = true; suspend(); return; }
    if (touchBlocked || waitForInactive || !allowed()) return;
    const target = event.target?.nodeType === 3 ? event.target.parentElement : event.target;
    if (target?.closest?.('a, button, input, select, textarea, [role="button"]')) return;
    startIntent('touch');
  };
  const onTouchEnd = event => {
    if (!event.isTrusted || event.touches?.length) return;
    touchBlocked = false;
    if (intent === 'touch') clearIntent();
    sync();
  };
  const onWheel = event => {
    if (!event.isTrusted || event.ctrlKey || touchBlocked || waitForInactive || !allowed()) return;
    startIntent('wheel');
  };
  const releaseInput = () => {
    touchBlocked = false;
    cancelPrime();
    suspend();
  };
  const onVisibility = () => { if (document.hidden) releaseInput(); else { refreshNeeded = true; sync(); } };
  const onPageHide = () => { pageHidden = true; releaseInput(); };
  const onPageShow = () => { pageHidden = false; suspend(); refreshNeeded = true; queuePrime(); };
  const stateObserver = new window.MutationObserver(sync);
  for (const target of [root, body, html]) stateObserver.observe(target, { attributes: true, attributeFilter: ['class'] });
  observeScope(document);
  root.addEventListener('touchstart', onTouchStart, { passive: true });
  root.addEventListener('wheel', onWheel, { passive: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });
  document.addEventListener('touchcancel', onTouchEnd, { passive: true, capture: true });
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('site:page-ready', invalidate);
  window.addEventListener('site-shell:weather-ready', invalidate);
  queuePrime();

  return {
    disconnect() {
      if (disposed) return;
      disposed = true;
      clearIntent();
      cancelPrime();
      restoreAll();
      cache.clear();
      stateObserver.disconnect();
      for (const [scope, observer] of scopes) { observer.disconnect(); scope.removeEventListener('animationstart', onAnimationStart, true); }
      scopes.clear();
      root.removeEventListener('touchstart', onTouchStart); root.removeEventListener('wheel', onWheel);
      document.removeEventListener('touchend', onTouchEnd, true); document.removeEventListener('touchcancel', onTouchEnd, true);
      document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow); window.removeEventListener('site:page-ready', invalidate);
      window.removeEventListener('site-shell:weather-ready', invalidate);
    },
  };
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  const url = new URL('../css/motion-visibility.css', import.meta.url);
  url.search = new URL(import.meta.url).search;
  if (!document.querySelector('link[data-motion-visibility]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = url.href;
    stylesheet.dataset.motionVisibility = 'true';
    document.head.appendChild(stylesheet);
  }
  installMotionVisibility(document, window);
  installScrollFrameBudget(document, window);
  installScrollAnimationBudget(document, window);
}
