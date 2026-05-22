const CACHE_VERSION = "watchfinder-cache-v4";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const STATIC_ASSETS = [
  "/manifest.json",
  "/favicon-v3.ico",
  "/icon-192-v3.png",
  "/icon-512-v3.png",
  "/apple-touch-icon-v3.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function (cache) {
      return cache.addAll(STATIC_ASSETS);
    }).finally(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (cacheName) {
          if (!cacheName.startsWith(CACHE_VERSION)) {
            return caches.delete(cacheName);
          }
          return null;
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data && event.data.type === "CLEAR_WATCHFINDER_CACHE") {
    event.waitUntil(
      caches.keys().then(function (cacheNames) {
        return Promise.all(cacheNames.map(function (cacheName) {
          return caches.delete(cacheName);
        }));
      })
    );
  }
});

function isNetworkFirstRequest(request, url) {
  if (request.mode === "navigate") return true;
  if (request.destination === "document") return true;
  if (request.destination === "script" || request.destination === "style") return true;
  if (url.pathname.startsWith("/_next/")) return true;
  if (url.pathname.startsWith("/api/")) return true;
  if (url.pathname.endsWith(".json")) return true;
  return false;
}

function isStaticAsset(request, url) {
  if (request.method !== "GET") return false;
  if (url.origin !== self.location.origin) return false;
  return ["image", "font"].includes(request.destination) ||
    /\.(png|jpg|jpeg|webp|gif|svg|ico|woff2?)$/i.test(url.pathname);
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const update = fetch(request).then(function (response) {
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(function () {
    return cached;
  });
  return cached || update;
}

self.addEventListener("fetch", function (event) {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isNetworkFirstRequest(request, url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isStaticAsset(request, url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
