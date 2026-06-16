// ============================================================================
// util.js — DOM + formatting + maps + geo helpers
// ============================================================================

/** Tiny hyperscript helper. el('div.card#x', {onclick}, [..children|strings])
 *  Tolerates dot- OR space-separated classes: '.a.b', '.a .b', 'span.a.b' all work. */
export function el(spec, props = {}, children = []) {
  spec = String(spec).trim();
  let tag = 'div', id = '';
  const classes = [];
  const tm = spec.match(/^[a-zA-Z][a-zA-Z0-9]*/);   // optional leading tag name
  if (tm) { tag = tm[0]; spec = spec.slice(tm[0].length); }
  let mm; const re = /([#.])([\w-]+)/g;             // all #id / .class tokens
  while ((mm = re.exec(spec))) { if (mm[1] === '#') id = mm[2]; else classes.push(mm[2]); }
  const node = document.createElement(tag);
  if (id) node.id = id;
  if (classes.length) node.className = classes.join(' ');
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className += ' ' + v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return node;
}

/** Use an SVG sprite icon: icon('i-pin') -> <svg><use href="#i-pin"/></svg> */
export function icon(id, cls = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  if (cls) svg.setAttribute('class', cls);
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#' + id);
  svg.appendChild(use);
  return svg;
}

export function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; }
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---- Google Maps deep links (no API key required) ----------------------------
export function gmapPlace(name, lat, lng) {
  // Famous named places resolve best by name; coords guarantee the right pin.
  const q = lat != null && lng != null ? `${name} ${lat},${lng}` : name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
export function gmapCoords(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
/** Transit directions. origin/destination as station names (best for transit) or "lat,lng". */
export function gmapDir(origin, destination, mode = 'transit') {
  const o = origin ? `&origin=${encodeURIComponent(origin)}` : '';
  return `https://www.google.com/maps/dir/?api=1${o}&destination=${encodeURIComponent(destination)}&travelmode=${mode}`;
}
/** Nearby hotels on Google Maps, centred on the given point (great for finding lodging along the way). */
export function gmapHotels(lat, lng) {
  return `https://www.google.com/maps/search/${encodeURIComponent('ホテル 飯店')}/@${lat},${lng},15z`;
}
/** Nearby hotels on Booking.com by area/place name. */
export function bookingHotels(name) {
  return `https://www.booking.com/searchresults.zh-tw.html?ss=${encodeURIComponent(name)}`;
}

// ---- Time helpers ------------------------------------------------------------
export function parseHM(hm) { const [h, m] = (hm || '0:0').split(':').map(Number); return h * 60 + (m || 0); }
export function fmtHM(min) { const h = Math.floor(min / 60) % 24, m = min % 60; return `${h}:${String(m).padStart(2, '0')}`; }
export function nowMinutes(d = new Date()) { return d.getHours() * 60 + d.getMinutes(); }
export function pad2(n) { return String(n).padStart(2, '0'); }
export function ymd(d = new Date()) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
export const DOW_TC = ['日', '一', '二', '三', '四', '五', '六'];

// ---- Geo ---------------------------------------------------------------------
export function haversineKm(a, b) {
  if (!a || !b) return null;
  const R = 6371, toRad = x => x * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
export function fmtDistance(km) {
  if (km == null) return '';
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

// ---- localStorage JSON store + favorites ------------------------------------
export const store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
export const favs = {
  list() { return store.get('kp_favs', []); },
  has(name) { return favs.list().includes(name); },
  toggle(name) { const a = favs.list(); const i = a.indexOf(name); if (i >= 0) a.splice(i, 1); else a.push(name); store.set('kp_favs', a); return i < 0; },
};

// ---- Toast -------------------------------------------------------------------
let toastTimer;
export function toast(msg, ms = 2200) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('is-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-show'), ms);
}

// ---- Lightweight markdown (bold, code, line breaks, bullets) -----------------
export function mdLite(s = '') {
  let h = escapeHtml(s);
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/^\s*[-*]\s+(.*)$/gm, '• $1');
  h = h.replace(/\n/g, '<br>');
  return h;
}
