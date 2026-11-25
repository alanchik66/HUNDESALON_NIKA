/* A short, fail-open entrance while the current page prepares its critical content. */
(function initSiteLoader() {
  'use strict';

  if (window.NikaSiteLoader) return;

  const root = document.documentElement;
  // This records a handled entrance, never a claim that the browser retained its cache.
  // One origin-wide key also works when source pages carry different legacy ?v values.
  let showEntrance = true;
  try {
    const storageKey = 'nika:site-entrance:v1';
    showEntrance = window.sessionStorage.getItem(storageKey) !== 'shown';
    if (showEntrance) window.sessionStorage.setItem(storageKey, 'shown');
  } catch { /* Storage is optional in private/restricted browser contexts. */ }
  const loadingLabel = {
    ru: 'Загружаем сайт',
    uk: 'Завантажуємо сайт',
    de: 'Website wird geladen',
    en: 'Loading the website',
  }[(root.lang || 'de').slice(0, 2)] || 'Loading the website';
  let overlay = null;
  let bodyObserver = null;
  let finished = false;
  let deadline = null;
  let scene = null;
  let sceneReady = Promise.resolve();
  let sceneDisposed = false;
  let resolveReady;
  const failedResources = new Set();
  const pendingCleanups = new Set();
  let priceResourceFailed = false;
  let failPriceContent = null;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  const settle = (promise, resource) => Promise.resolve(promise).catch(() => { failedResources.add(resource); });
  const onResourceError = event => {
    const source = event.target?.src || event.filename || '';
    // price-page requires PricePageCatalog (data) and PriceBookingCatalog (booking)
    // before its first render. Other catalog enrichment scripts are optional here.
    if (!/\/assets\/js\/(?:price-page|price-page-data|price-booking)\.js(?:[?#]|$)/.test(source)) return;
    priceResourceFailed = true;
    failPriceContent?.();
  };
  // Capture failures even when a deferred page script fails before DOMContentLoaded.
  document.addEventListener('error', onResourceError, true);
  window.addEventListener('error', onResourceError);
  const removeLegacyPreloaders = () => {
    document.querySelectorAll('#preloader').forEach(element => {
      if (element !== overlay) element.remove();
    });
  };
  const removeOverlay = () => {
    if (!sceneDisposed) {
      sceneDisposed = true;
      try { scene?.dispose?.(); } catch {}
    }
    overlay?.remove();
  };

  const finish = (reason = 'skip') => {
    removeLegacyPreloaders();
    if (finished) return;
    finished = true;
    window.clearTimeout(deadline);
    bodyObserver?.disconnect();
    document.removeEventListener('error', onResourceError, true);
    window.removeEventListener('error', onResourceError);
    for (const cleanup of pendingCleanups) cleanup();
    pendingCleanups.clear();
    // Dispose the complete entrance before revealing the page or resuming its renderers.
    try { scene?.stop?.(); } catch {}
    if (overlay) {
      try {
        const focused = document.activeElement;
        if (focused && overlay.contains(focused)) focused.blur?.();
      } catch {}
      overlay.setAttribute('inert', '');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.pointerEvents = 'none';
    }
    removeOverlay();
    root.classList.remove('site-loading');
    root.classList.remove('site-loading-hidden');
    root.dataset.siteReady = 'true';
    root.dataset.siteReadyReason = reason;
    document.body?.classList.add('site-loaded');
    resolveReady(Object.freeze({ reason, failedResources: [...failedResources] }));
  };

  window.NikaSiteLoader = Object.freeze({ ready, finish, get active() { return showEntrance && !finished; } });
  if (showEntrance) {
    root.classList.add('site-loading');
    root.classList.toggle('site-loading-hidden', document.hidden);
  }
  // This is an emergency release, never an assertion that pending resources are ready.
  deadline = window.setTimeout(() => finish('timeout'), 15000);

  const mount = () => {
    if (!showEntrance || !document.body || finished || overlay) return;
    removeLegacyPreloaders();
    bodyObserver?.disconnect();
    overlay = document.createElement('div');
    overlay.id = 'preloader';
    overlay.className = 'site-loader';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-label', loadingLabel);

    const stage = document.createElement('div');
    stage.className = 'site-loader__scene';
    stage.setAttribute('aria-hidden', 'true');
    overlay.append(stage);
    document.body.prepend(overlay);
    try {
      if (!window.NikaPawScene?.mount) throw new Error('Entrance scene unavailable.');
      scene = window.NikaPawScene.mount(stage);
      // The small local atlas is part of the first entrance, not an all-site prefetch.
      sceneReady = settle(scene?.ready, 'entrance-atlas').then(loaded => {
        // The scene retains its CSS footprints when atlas decoding fails.
        // false is a settled fallback, never evidence that the atlas is cached.
        if (loaded === false && !finished) failedResources.add('entrance-atlas');
      });
    } catch { failedResources.add('entrance-scene'); }
  };

  if (document.body) {
    mount();
  } else if (showEntrance && typeof MutationObserver !== 'undefined') {
    bodyObserver = new MutationObserver(mount);
    bodyObserver.observe(root, { childList: true });
  }

  const prepareImage = image => new Promise(resolve => {
    let settled = false;
    const done = (hasFailed = false) => {
      if (settled) return;
      settled = true;
      if (hasFailed) failedResources.add('critical-image');
      pendingCleanups.delete(cancel);
      image.removeEventListener('load', loaded);
      image.removeEventListener('error', failed);
      resolve();
    };
    const cancel = () => done();
    const failed = () => done(true);
    const loaded = () => {
      if (!image.naturalWidth) { failed(); return; }
      try {
        if (typeof image.decode === 'function') image.decode().then(() => done(), failed);
        else done();
      } catch { failed(); }
    };
    pendingCleanups.add(cancel);
    if (image.complete) {
      loaded();
    } else {
      image.addEventListener('load', loaded, { once: true });
      image.addEventListener('error', failed, { once: true });
    }
  });

  const pageContentReady = () => {
    if (!document.querySelector('script[src*="/price-page.js"]') || root.dataset.priceReady === 'true') {
      return Promise.resolve();
    }
    if (priceResourceFailed) {
      failedResources.add('price-page');
      return Promise.resolve();
    }
    return new Promise(resolve => {
      const done = () => {
        window.removeEventListener('site:page-ready', done);
        pendingCleanups.delete(done);
        failPriceContent = null;
        resolve();
      };
      failPriceContent = () => { failedResources.add('price-page'); done(); };
      pendingCleanups.add(done);
      window.addEventListener('site:page-ready', done, { once: true });
    });
  };

  const preparePage = () => {
    removeLegacyPreloaders();
    mount();
    if (finished) {
      document.body?.classList.add('site-loaded');
      return;
    }
    // Only images needed for the opening viewport are decoded; galleries stay lazy.
    const imagePriority = image =>
      image.classList.contains('hero-photo-img') || image.getAttribute('fetchpriority')?.toLowerCase() === 'high'
        ? 0 : image.loading === 'lazy' ? 2 : 1;
    const criticalImages = Array.from(document.images).filter(image => {
      const box = image.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.bottom > 0 && box.right > 0 &&
        box.top < window.innerHeight && box.left < window.innerWidth;
    }).sort((first, second) => imagePriority(first) - imagePriority(second)).slice(0, 6);
    Promise.all([
      pageContentReady(),
      settle(document.fonts?.ready, 'fonts'),
      sceneReady,
      // Load the shared weather module graph without mounting another Canvas or API call.
      // Visual weather readiness remains local: its render loop is paused by this entrance.
      settle(Promise.resolve().then(() => window.SiteShell?.prepareCriticalAssets?.()), 'weather-modules'),
      ...criticalImages.map(prepareImage),
    ]).then(() => {
      if (finished) return;
      const complete = () => finish(failedResources.size ? 'resource-error' : 'ready');
      if (document.hidden) {
        complete();
      } else {
        window.requestAnimationFrame(() => window.requestAnimationFrame(complete));
      }
    }).catch(() => finish('resource-error'));
  };

  document.addEventListener('visibilitychange', () => {
    if (!finished && showEntrance) root.classList.toggle('site-loading-hidden', document.hidden);
  });
  window.addEventListener('pagehide', () => finish('skip'), { once: true });
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      finish('skip');
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Shared shell/page handlers must finish before measuring the opening viewport.
      // A hidden document has no paint scheduler; keep its entrance bounded by the deadline.
      if (document.hidden) {
        window.setTimeout(preparePage, 0);
      } else {
        window.requestAnimationFrame(preparePage);
      }
    }, { once: true });
  } else {
    preparePage();
  }
})();
