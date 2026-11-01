// Service Worker (Vorlage). Beim Build ersetzt vite.config.js die Platzhalter durch die
// Build-Version (Hash) und die Liste aller Spiel-Dateien.
/* eslint-disable no-restricted-globals */
const VERSION = __VERSION__;
const DATEIEN = __DATEIEN__;
const CACHE = 'driftkoenig-' + VERSION;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(DATEIEN.map((d) => new Request(d, { cache: 'reload' })))).catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((schluessel) => Promise.all(schluessel.filter((k) => k.startsWith('driftkoenig-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.typ === 'aktivieren') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Online-Funktionen und Health-Check nie aus dem Cache
  if (url.pathname.endsWith('/ws') || url.pathname.endsWith('/healthz') || url.pathname.endsWith('/version.json')) return;

  // Seitenaufrufe: Cache zuerst (schneller Start, auch wenn der Server schläft oder offline ist).
  // Updates kommen über den neuen Service Worker („Neue Version verfügbar – neu laden“).
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.open(CACHE)
        .then((c) => c.match('./index.html', { ignoreSearch: true }).then((r) => r || c.match('./', { ignoreSearch: true })))
        .then((r) => r || fetch(req))
    );
    return;
  }
  // Statische Dateien: Cache zuerst
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((treffer) => treffer || fetch(req).then((antwort) => {
      if (antwort.ok && antwort.type === 'basic') {
        const kopie = antwort.clone();
        caches.open(CACHE).then((c) => c.put(req, kopie)).catch(() => {});
      }
      return antwort;
    }))
  );
});
