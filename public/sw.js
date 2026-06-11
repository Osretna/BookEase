const CACHE_NAME = "porto-sokhna-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ff7530' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m2 22 1-1h3l1-3h4l1 3h3l1 1h5'/%3E%3Cpath d='M12 2v8'/%3E%3Cpath d='m5 12 7-7 7 7'/%3E%3Cpath d='M12 5V2'/%3E%3Cpath d='M17 12v5H7v-5'/%3E%3C/svg%3E"
];

// Install Event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn("Service worker precache assets failed: ", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Interceptor (Network-first with fallback for offline booking view)
self.addEventListener("fetch", (event) => {
  // Only cache GET requests
  if (event.request.method !== "GET" || event.request.url.startsWith("chrome-extension") || event.request.url.includes("/api/")) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache the updated file
        if (response && response.status === 200) {
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseCopy);
          });
        }
        return response;
      })
      .catch(() => {
        // Retrieve from cache if offline
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // fallback
          return caches.match("/");
        });
      })
  );
});
