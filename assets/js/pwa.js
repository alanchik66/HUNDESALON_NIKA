(function () {
  // The same early entry works in source previews and versioned production pages.
  if (!window.NikaSiteLoader && !document.querySelector('script[src*="/site-loader.js"]')) {
    const entry = document.currentScript;
    const entryUrl = entry?.src ? new URL(entry.src, document.baseURI) : new URL('/assets/js/pwa.js', location.href);
    const version = entryUrl.searchParams.get('v');
    const styleUrl = new URL('../css/site-loader.css', entryUrl);
    if (version) {
      styleUrl.searchParams.set('v', version);
    }
    const styles = document.createElement('link');
    styles.rel = 'stylesheet';
    styles.href = styleUrl.href;
    document.head.appendChild(styles);
    for (const file of ['paw-loader-scene.js', 'site-loader.js']) {
      if (file === 'paw-loader-scene.js' && (window.NikaPawScene || document.querySelector('script[src*="/paw-loader-scene.js"]'))) continue;
      const scriptUrl = new URL(file, entryUrl);
      if (version) scriptUrl.searchParams.set('v', version);
      const loader = document.createElement('script');
      loader.src = scriptUrl.href;
      // Dynamically inserted classic dependencies execute in insertion order.
      loader.async = false;
      document.head.appendChild(loader);
    }
  }

  if (!('serviceWorker' in navigator)) {
    return;
  }

  const isLocalDev =
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname === '[::1]';

  if (isLocalDev) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => registration.unregister());
    });
    if ('caches' in window) {
      window.caches.keys().then(keys => Promise.all(keys.map(key => window.caches.delete(key))));
    }
    return;
  }

  window.addEventListener(
    'load',
    () => {
      navigator.serviceWorker.register('/sp-push-worker-fb.js', { updateViaCache: 'none' }).catch(error => {
        console.warn('[pwa] Service worker registration failed:', error?.message || error);
      });
    },
    { once: true }
  );
})();
