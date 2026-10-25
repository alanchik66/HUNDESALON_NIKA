const CACHE_NAME = 'hundesalon-nika-static-v10';
const CORE_ASSETS = [
  '/site.webmanifest',
  '/assets/images/brand/hero-dog.webp',
  '/assets/images/brand/hero-dog.jpg',
  '/assets/images/brand/logo.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS).catch(() => Promise.resolve())));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key.startsWith('hundesalon-nika-static-') && key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isNetworkFirstRequest(request, url) {
  if (request.mode === 'navigate' || request.destination === 'document') {
    return true;
  }

  if (url.pathname.endsWith('.html')) {
    return true;
  }

  if ((url.pathname.endsWith('.css') || url.pathname.endsWith('.js')) && url.search.includes('v=')) {
    return true;
  }

  return false;
}

function cacheResponse(event, request, response) {
  if (!response.ok) return;
  const copy = response.clone();
  // Keep cache writes alive after returning a response; quota failures must not break navigation.
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.put(request, copy))
      .catch(() => undefined)
  );
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (isNetworkFirstRequest(request, url)) {
    event.respondWith(
      fetch(request)
        .then(response => {
          cacheResponse(event, request, response);
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  const network = fetch(request)
    .then(response => {
      cacheResponse(event, request, response);
      return response;
    })
    .catch(() => caches.match(request));

  // A cached response can finish immediately while its background refresh still needs the worker.
  event.waitUntil(network.then(() => undefined));
  event.respondWith(caches.match(request).then(cached => cached || network));
});
