const CACHE_VERSION = "watchfinder-cache-v3";
const OLD_ICON_ASSETS = [
  "/favicon.ico",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png"
];

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (cacheName) {
          if (cacheName !== CACHE_VERSION) {
            return caches.delete(cacheName);
          }
          return caches.open(cacheName).then(function (cache) {
            return Promise.all(
              OLD_ICON_ASSETS.map(function (asset) {
                return cache.delete(asset);
              })
            );
          });
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});
