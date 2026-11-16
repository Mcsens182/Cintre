// Service worker : l'app s'ouvre même hors connexion. Les appels Google, météo et IA passent toujours par le réseau.
const VERSION = 'cintre-v1';
const CORE = [
  './', './index.html', './manifest.webmanifest', './config.js', './css/app.css',
  './js/app.js', './js/ai.js', './js/catalog.js', './js/color.js', './js/db.js', './js/demo.js', './js/drive.js',
  './js/engine.js', './js/intent.js', './js/photo.js', './js/store.js', './js/ui.js', './js/util.js', './js/weather.js',
  './js/screens/city.js', './js/screens/item.js', './js/screens/outfits.js', './js/screens/settings.js',
  './js/screens/today.js', './js/screens/wardrobe.js', './js/screens/welcome.js',
  './icons/favicon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Polices Google : cache d'abord
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(VERSION).then(async (c) => (await c.match(e.request)) || fetch(e.request).then((r) => { c.put(e.request, r.clone()); return r; })));
    return;
  }
  if (url.origin !== location.origin) return;
  // Fichiers de l'app : réseau d'abord (mises à jour immédiates), cache si hors ligne
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});
