// Service worker — offline shell + installable PWA
const CACHE = 'kyushu-plan-v3';
const ASSETS = [
  './', 'index.html',
  'assets/css/styles.css',
  'assets/js/main.js', 'assets/js/data.js', 'assets/js/util.js',
  'assets/js/weather.js', 'assets/js/map.js', 'assets/js/gemini.js', 'assets/js/toolkit.js',
  'assets/icons/favicon.svg', 'manifest.webmanifest',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;            // never cache API POSTs
  if (url.pathname.startsWith('/api/')) return;       // Gemini proxy → network
  if (url.origin !== location.origin) return;         // tiles/fonts/leaflet/open-meteo → network

  // stale-while-revalidate: serve cache instantly (offline-ready), refresh in background
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request);
      const network = fetch(e.request).then(resp => {
        if (resp && resp.ok) cache.put(e.request, resp.clone()).catch(() => {});
        return resp;
      }).catch(() => cached || cache.match('index.html'));
      return cached || network;
    })
  );
});
