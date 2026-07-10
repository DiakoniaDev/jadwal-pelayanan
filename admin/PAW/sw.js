const CACHE_PREFIX = 'paw-admin-cache-';
const CACHE_NAME = CACHE_PREFIX + 'v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Drop our own stale caches. Scoped by prefix: the volunteer PWA shares this
// origin, and the Cache API is per-origin, so an unfiltered sweep would
// delete the volunteer app's cache too.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      ))
      .then(() => clients.claim())
  );
});

// Network-first: always try the live server (so the admin shell and data stay
// fresh), fall back to cache only if offline.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith('http')) return;

  event.respondWith(
    fetch(req)
      .then((response) => {
        // Only cache real, readable successes. Opaque responses (type
        // 'opaque') throw on cache.put, and error responses would poison
        // the offline fallback.
        if (response.ok && response.type !== 'opaque') {
          const copy = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(req, copy))
            .catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(req).then((hit) => hit || Response.error()))
  );
});
