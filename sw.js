// Complication Setting Guide - Service Worker
// Bump CACHE_VERSION on every deploy to force clients to fetch fresh assets.
const CACHE_VERSION = 'v6';
const CACHE_NAME = 'csg-cache-' + CACHE_VERSION;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Allow the page to tell a waiting worker to activate immediately
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Install: pre-cache the app shell and activate immediately
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

// Activate: delete any old versioned caches, then take control of open pages
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// Fetch strategy:
// - Images (/images/ folder): network-first, fall back to cache, then nothing
// - Everything else (app shell, HTML, JS, CSS): cache-first, fall back to network,
//   and update the cache in the background with the latest network response
self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Network-first for watch images
  if (url.pathname.indexOf('/images/') !== -1) {
    event.respondWith(
      fetch(req).then(function (networkResponse) {
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(req, clone);
        });
        return networkResponse;
      }).catch(function () {
        return caches.match(req);
      })
    );
    return;
  }

  // Cache-first for everything else (app shell)
  event.respondWith(
    caches.match(req).then(function (cachedResponse) {
      const networkFetch = fetch(req).then(function (networkResponse) {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(req, clone);
          });
        }
        return networkResponse;
      }).catch(function () {
        return cachedResponse;
      });

      return cachedResponse || networkFetch;
    })
  );
});
