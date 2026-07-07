(function () {
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
      navigator.serviceWorker.register('/sw.js').catch(error => {
        console.warn('[pwa] Service worker registration failed:', error?.message || error);
      });
    },
    { once: true }
  );
})();
