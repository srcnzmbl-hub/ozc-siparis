/* Destiny Map PWA service worker — scoped to /app/ */
const CACHE = 'dm-app-v1';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './app-icon-192.png',
  './app-icon-512.png',
  './app-apple-touch.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* network-first, fall back to cache (keeps content fresh online, works offline) */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy).catch(() => {}));
        return res;
      })
      .catch(() => caches.match(req).then((m) => m || caches.match('./')))
  );
});
