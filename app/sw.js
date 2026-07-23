/* Ophanark PWA service worker */
var CACHE = 'ophanark-v4';
var CORE = [
  './','./index.html','./manifest.webmanifest','./opening.jpg',
  './app-icon-192.png','./app-icon-512.png','./app-apple-touch.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(CORE); }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){ if(k!==CACHE) return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET'){ return; }
  var url = new URL(req.url);
  // navigation requests: network first, fall back to cached app shell (offline)
  if(req.mode === 'navigate'){
    e.respondWith(
      fetch(req).catch(function(){ return caches.match('./index.html'); })
    );
    return;
  }
  // same-origin static assets: cache first, then network (and cache it)
  if(url.origin === self.location.origin){
    e.respondWith(
      caches.match(req).then(function(hit){
        return hit || fetch(req).then(function(res){
          if(res && res.status === 200){
            var copy = res.clone();
            caches.open(CACHE).then(function(c){ c.put(req, copy); });
          }
          return res;
        }).catch(function(){ return hit; });
      })
    );
    return;
  }
  // cross-origin (fonts, CDNs): network first, fall back to cache
  e.respondWith(
    fetch(req).catch(function(){ return caches.match(req); })
  );
});
