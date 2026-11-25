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
}
