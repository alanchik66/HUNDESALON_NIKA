(function () {
  if (!('serviceWorker' in navigator)) {
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
