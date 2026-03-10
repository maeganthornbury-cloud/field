const CACHE_NAME = "goalie-tracker-cache-v6";
const STATIC_ASSETS = ["./", "./index.html", "./styles.css?v=6", "./app.js?v=6", "./manifest.webmanifest?v=6"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (!isSameOrigin(url)) return;

  // Network-first for documents so UI updates show immediately.
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html"))),
    );
    return;
  }

  // Stale-while-revalidate for local static assets.
  if (["script", "style", "manifest"].includes(request.destination) || STATIC_ASSETS.includes(url.pathname.replace(/^\//, "") ? `./${url.pathname.replace(/^\//, "")}` : "./")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      }),
    );
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request)),
  );
});
