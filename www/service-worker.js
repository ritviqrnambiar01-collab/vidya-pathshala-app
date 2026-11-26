
const CACHE_NAME = "vidya-pathshala-v2";
const CACHE_PREFIX = "vidya-pathshala-";

const CORE_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icon.svg",
  "./study_data.json",
  "./chapters.json",
  "./formulas.json"
];

// Install and cache the essential app files
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_FILES))
      .then(() => self.skipWaiting())
  );
});

// Activate and clean up only Vidya Pathshala's old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key =>
            key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Network first, then use cached files when offline
self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);

        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }

        return response;
      } catch (error) {
        const cached = await caches.match(request);

        if (cached) return cached;

        if (request.mode === "navigate") {
          return await caches.match("./index.html");
        }

        return new Response(
          "You are offline and this resource is not cached.",
          {
            status: 503,
            headers: {
              "Content-Type": "text/plain"
            }
          }
        );
      }
    })()
  );
});
