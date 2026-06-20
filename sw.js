const CACHE_NAME = 'hundesalon-nika-static-v1';
const CORE_ASSETS = [
  '/',
  '/de/',
  '/en/',
  '/ru/',
  '/uk/',
  '/site.webmanifest',
  '/assets/css/style.css',
  '/assets/css/page-modules.css',
  '/assets/css/cookie-consent.css',
  '/assets/js/site-shell.js',
  '/assets/js/main.js',
  '/assets/js/page-modules.js',
  '/assets/js/cookie-consent.js',
  '/assets/js/pwa.js',
  '/assets/images/hero-dog.jpg',
  '/assets/images/logo.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(CORE_ASSETS).catch(() => {
        return Promise.resolve();
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
