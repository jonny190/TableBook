// TableBook service worker — minimal offline shell
const CACHE = "tablebook-v1";
const ASSETS = ["/", "/manifest.webmanifest", "/offline"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try { await cache.addAll(ASSETS); } catch { /* ignore */ }
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache auth / API
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/_next/data")) return;

  // Network-first for HTML, cache-first for static assets
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put(request, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(request);
        return cached || caches.match("/offline") || new Response("Offline", { status: 503 });
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const fresh = await fetch(request);
      const cache = await caches.open(CACHE);
      if (fresh.ok) cache.put(request, fresh.clone());
      return fresh;
    } catch {
      return cached || new Response("Offline", { status: 503 });
    }
  })());
});
