const CACHE_NAME = "goalie-tracker-cache-v11";
const STATIC_ASSETS = ["./", "./index.html", "./styles.css?v=11", "./app.js?v=11", "./manifest.webmanifest?v=11"];

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

function normalizePath(url) {
  return `${url.pathname}${url.search}`;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) return;

  const path = normalizePath(url);

  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(async () => {
          const cachedDoc = await caches.match(request);
          if (cachedDoc) return cachedDoc;
          return caches.match("./index.html");
        }),
    );
    return;
  }

  const isVersionedStatic = STATIC_ASSETS.some((asset) => {
    const normalized = asset.startsWith("./") ? asset.slice(1) : asset;
    return normalized === path;
  });

  if (isVersionedStatic || ["script", "style", "manifest", "image", "font"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
            }
            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      }),
    );
    return;
  }

  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
