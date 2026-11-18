const CACHE_NAME = 'kuitech-dairy-v4';
const NETWORK_TIMEOUT_MS = 3000;

// Cache the app shell and the hashed JS/CSS files referenced by the deployed page.
// This gives an installed app a complete offline launch after its first online visit.
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const shellUrl = new URL('./', self.registration.scope);
      const response = await fetch(new Request(shellUrl, { cache: 'reload' }));
      if (!response.ok) return;

      const html = await response.clone().text();
      await cache.put(shellUrl, response);

      const assetPaths = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css)(?:\?[^"']*)?)["']/g)]
        .map((match) => new URL(match[1], shellUrl))
        .filter((url) => url.origin === self.location.origin);
      await Promise.all(assetPaths.map(async (assetUrl) => {
        try {
          const assetResponse = await fetch(assetUrl);
          if (assetResponse.ok) await cache.put(assetUrl, assetResponse);
        } catch {
          // A failed asset fetch should not prevent the worker from installing.
        }
      }));
    } catch {
      // Keep the worker installable when the app is temporarily offline.
    }
  })());
});

// Keep a new app version waiting until the user chooses to update in Settings.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

const offlinePage = () => new Response(`<!doctype html>
  <html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#16a085"><title>Dairy app offline</title>
  <body style="margin:0;background:#f3f8f5;font:16px system-ui,sans-serif;color:#263b31;display:grid;min-height:100vh;place-items:center">
    <main style="max-width:380px;margin:24px;padding:28px;background:white;border-radius:16px;box-shadow:0 8px 30px #1933221a;text-align:center">
      <h1 style="font-size:22px">You’re offline</h1>
      <p>Connect to the internet and reopen the dairy app. Your farm records remain saved on this device.</p>
      <button onclick="location.reload()" style="padding:12px 18px;border:0;border-radius:8px;background:#23834c;color:white;font-weight:700">Try again</button>
    </main>
  </body></html>`, {
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const controller = new AbortController();
    let timeoutId;
    try {
      const networkResponse = await Promise.race([
        fetch(request, { signal: controller.signal }),
        new Promise((resolve) => {
          timeoutId = setTimeout(() => {
            controller.abort();
            resolve(null);
          }, NETWORK_TIMEOUT_MS);
        }),
      ]);

      if (networkResponse?.ok) {
        if (networkResponse.type === 'basic') {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, networkResponse.clone()).catch(() => {});
        }
        return networkResponse;
      }
    } catch {
      // A failed or timed-out network request falls through to the offline cache.
    } finally {
      clearTimeout(timeoutId);
    }

    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    if (request.mode === 'navigate') {
      const shellUrl = new URL('./', self.registration.scope);
      const appShell = await caches.match(shellUrl);
      return appShell || offlinePage();
    }

    return Response.error();
  })());
});
