// Service worker — offline shell + installable PWA
const CACHE = 'planai-v25';
const ASSETS = [
  './', 'index.html',
  'assets/css/styles.css',
  'assets/js/main.js', 'assets/js/data.js', 'assets/js/util.js',
  'assets/js/weather.js', 'assets/js/map.js', 'assets/js/ai.js', 'assets/js/toolkit.js',
  'assets/js/firebase.js', 'assets/js/firebase-config.js', 'assets/js/notify.js',
  'assets/icons/favicon.svg', 'manifest.webmanifest',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()).catch(() => {}));
});

const EXT = 'planai-ext-v8';    // CDN libs/fonts/tiles (Leaflet, Firebase, Google Fonts, map tiles)
const DATA = 'planai-data-v8';  // API responses (Open-Meteo) for offline-last-known
const KEEP = [CACHE, EXT, DATA];

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => !KEEP.includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

function swr(req, cacheName) {
  return caches.open(cacheName).then(async cache => {
    const cached = await cache.match(req);
    const net = fetch(req).then(resp => {
      if (resp && (resp.ok || resp.type === 'opaque')) cache.put(req, resp.clone()).catch(() => {});
      return resp;
    }).catch(() => cached || (cacheName === CACHE ? cache.match('index.html') : undefined));
    return cached || net;
  });
}
function netFirst(req) {
  return caches.open(DATA).then(async cache => {
    try { const resp = await fetch(req); if (resp && resp.ok) cache.put(req, resp.clone()).catch(() => {}); return resp; }
    catch { return (await cache.match(req)) || new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }); }
  });
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;                 // never cache POSTs
  if (url.pathname.startsWith('/api/')) return;            // our Functions → network
  if (url.pathname.endsWith('firebase-messaging-sw.js')) return;

  if (url.hostname.endsWith('open-meteo.com')) { e.respondWith(netFirst(e.request)); return; }  // weather: net-first

  const sameOrigin = url.origin === location.origin;
  const isCDN = /(^|\.)(unpkg\.com|gstatic\.com|googleapis\.com|cartocdn\.com|jsdelivr\.net)$/.test(url.hostname);
  if (sameOrigin) { e.respondWith(swr(e.request, CACHE)); return; }                // app shell offline
  if (isCDN) { e.respondWith(swr(e.request, EXT)); return; }                       // Leaflet/Firebase/fonts/tiles offline
  // other cross-origin (e.g. Google auth) → network as usual
});
