// RTM en direct — fonctionnement hors ligne de l'habillage (le direct, lui, a toujours besoin d'internet)
const CACHE = "rtm-direct-v1";
const FICHIERS = ["./", "index.html", "style.css", "app.js", "manifest.webmanifest", "icons/logo.png", "icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;       // YouTube : jamais par le cache
  if (/\/(config|programme)\.json$/.test(url.pathname)) {                         // données : réseau d'abord
    e.respondWith(fetch(e.request).then((r) => { const copie = r.clone(); caches.open(CACHE).then((c) => c.put(url.pathname, copie)); return r; })
      .catch(() => caches.match(url.pathname)));
    return;
  }
  e.respondWith(fetch(e.request).then((r) => { const copie = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copie)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
