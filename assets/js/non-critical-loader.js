(function () {
  'use strict';

  const currentScript = document.currentScript;
  const scriptUrl = currentScript ? new URL(currentScript.src, document.baseURI) : null;
  const version = scriptUrl?.searchParams.get('v') || '';
  const assetBase = scriptUrl ? new URL('.', scriptUrl) : new URL('/assets/js/', document.baseURI);

  const loadScript = fileName => {
    const script = document.createElement('script');
    const url = new URL(fileName, assetBase);
    if (version) url.searchParams.set('v', version);
    script.src = url.href;
    script.async = true;
    script.fetchPriority = 'low';
    document.head.appendChild(script);
  };

  const loadNonCritical = () => {
    ['newsletter.js', 'testimonials.js', 'tooltip.js'].forEach(loadScript);
  };

  const runWhenIdle = () => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(loadNonCritical, { timeout: 1800 });
    } else {
      window.setTimeout(loadNonCritical, 200);
    }
  };

  if (document.readyState === 'complete') {
    runWhenIdle();
  } else {
    window.addEventListener('load', runWhenIdle, { once: true, passive: true });
  }
})();
