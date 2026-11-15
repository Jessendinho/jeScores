
const CACHE_PREFIX = 'jescores-static-';
const CACHE_NAME = CACHE_PREFIX + 'v3';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json'
];

const APP_ASSETS = new Set([
  '',
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png'
]);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key =>
            key === 'jescore-v2' ||
            (
              key.startsWith(CACHE_PREFIX) &&
              key !== CACHE_NAME
            )
          )
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Only handle requests belonging to this app's own origin.
  if (url.origin !== self.location.origin) return;

  const scopePath = new URL(self.registration.scope).pathname;

  if (!url.pathname.startsWith(scopePath)) return;

  const relativePath = url.pathname.slice(scopePath.length);

  const isNavigation = request.mode === 'navigate';
  const isAppAsset = APP_ASSETS.has(relativePath);

  // Do not cache live API or other unrelated requests.
  if (!isNavigation && !isAppAsset) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Network-first for page navigation.
    if (isNavigation) {
      try {
        const response = await fetch(request);

        if (response.ok) {
          await cache.put('./index.html', response.clone());
        }

        return response;
      } catch (error) {
        return (
          await cache.match('./index.html')
        ) || new Response(
          'jeScores is unavailable offline. Please reconnect and try again.',
          {
            status: 503,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8'
            }
          }
        );
      }
    }

    // Cache-first for essential static app files.
    const cached = await cache.match(request);

    if (cached) return cached;

    const response = await fetch(request);

    if (response.ok) {
      await cache.put(request, response.clone());
    }

    return response;
  })());
});
