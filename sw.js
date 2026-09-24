const CACHE_NAME = 'kuitech-dairy-v3';

// 1. Skip waiting to activate the updated worker instantly
self.addEventListener('install', event => {
  self.skipWaiting();
});

// 2. Claim clients right away so the app session locks into the service worker scope
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// 3. Dynamic Cache Engine (Network-First Fallback to Cache)
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // If the network response is perfectly valid, clone it and cache it dynamically!
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        //  OFFLINE RESCUE SHIELD: If internet/network is down, instantly serve from cache memory!
        return caches.match(event.request);
      })
  );
});
