// ============================================================================
// map.js — Leaflet region map (本州/四國/九州) + JR line schematic
// ============================================================================
import { CITIES, allPois, DAYS, cityByKey } from './data.js';
import { gmapPlace, gmapHotels } from './util.js';

let map, markerIndex = {}, inited = false;
const tileUrl = () => document.documentElement.dataset.theme === 'dark'
  ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
  : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

// Rail corridors (approx waypoints) for polylines — 熊本 → 關西 single-trip
const RAIL = [
  { name: '九州新幹線（另購）', color: '#16a34a', dash: true, pts: [[32.7896, 130.6880], [33.5899, 130.4207]] },
  { name: '山陽新幹線', color: '#2563eb', pts: [[33.5899, 130.4207], [33.8866, 130.8825], [34.3975, 132.4757], [34.6664, 133.9180], [34.7335, 135.5003]] },
  { name: '下關（在來線）', color: '#e11d48', dash: true, pts: [[33.8866, 130.8825], [33.9498, 130.9242]] },
  { name: '宮島（山陽本線+渡輪）', color: '#0d9488', pts: [[34.3975, 132.4757], [34.3110, 132.3036], [34.2960, 132.3199]] },
  { name: '瀨戶大橋（四國）', color: '#d97706', pts: [[34.6664, 133.9180], [34.3506, 134.0466]] },
  { name: '關西在來線', color: '#b91c1c', pts: [[34.7335, 135.5003], [34.7025, 135.4959], [34.9858, 135.7588]] },
  { name: '奈良線', color: '#65a30d', dash: true, pts: [[34.7025, 135.4959], [34.6831, 135.8190]] },
  { name: 'KIX（関空快速）', color: '#4f46e5', dash: true, pts: [[34.7025, 135.4959], [34.6463, 135.5142], [34.4339, 135.2440]] },
];

let cityLayers = [];
let onWeatherCb = null;

// The leaflet-gesture-handling UMD exports its handler but (in plain-script mode)
// doesn't auto-register on L.Map — so wire it up ourselves so `gestureHandling:true`
// works: 1 finger scrolls the page, 2 fingers pan/zoom (Ctrl+wheel on desktop).
function ensureGesture() {
  try {
    if (typeof L === 'undefined' || !L.Map) return;
    if ('gestureHandling' in L.Map.prototype.options) return;   // already registered
    const G = window.leafletGestureHandling;
    const Handler = G && (G.GestureHandling || G.default);
    if (Handler) {
      L.Map.mergeOptions({ gestureHandling: false });
      L.Map.addInitHook('addHandler', 'gestureHandling', Handler);
    }
  } catch {}
}

export function initMap(onWeather) {
  if (inited || typeof L === 'undefined') return;
  const elMap = document.getElementById('leafmap');
  if (!elMap) return;
  inited = true;
  onWeatherCb = onWeather;
  ensureGesture();

  // Standard interaction so the LEFT mouse button drags/pans the map, plus
  // pinch-zoom on touch and wheel/trackpad-pinch zoom on desktop.
  map = L.map(elMap, {
    zoomControl: true, attributionControl: true,
    dragging: true, scrollWheelZoom: true, touchZoom: true, doubleClickZoom: true, tap: true,
  }).setView([34.2, 133.0], 6);
  L.tileLayer(tileUrl(), {
    attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 18, subdomains: 'abcd',
  }).addTo(map);

  // Wire popup weather buttons (event delegation)
  map.on('popupopen', e => {
    const node = e.popup.getElement();
    const btn = node && node.querySelector('[data-wx]');
    if (btn) btn.addEventListener('click', () => onWeatherCb && onWeatherCb(btn.getAttribute('data-wx')));
  });
}

// Clear + redraw all markers/polylines for the CURRENT trip (any country).
// Pass { rail:true } to draw the Kyushu JR corridor polylines (template only).
export function refreshMap(opts = {}) {
  if (!map) return;
  cityLayers.forEach(l => { try { map.removeLayer(l); } catch {} });
  cityLayers = []; markerIndex = {};

  if (opts.rail) {
    RAIL.forEach(r => {
      cityLayers.push(L.polyline(r.pts, { color: r.color, weight: 4, opacity: .78, dashArray: r.dash ? '5 7' : null, lineCap: 'round' }).addTo(map));
    });
  } else {
    // Any trip (incl. AI-generated): draw a connecting "journey" line so the route
    // reads as one continuous trip. Through cities in visit order; if a single city,
    // through the visited activities in order.
    let path = []; let last = null;
    DAYS.forEach(d => { const c = cityByKey[d.cityKey]; if (c && c.lat != null && d.cityKey !== last) { path.push([c.lat, c.lng]); last = d.cityKey; } });
    if (path.length < 2) {
      path = [];
      DAYS.forEach(d => (d.items || []).forEach(it => { if (it.lat != null && it.type !== 'stay') path.push([it.lat, it.lng]); }));
    }
    if (path.length >= 2) cityLayers.push(L.polyline(path, { color: '#2563eb', weight: 3, opacity: .6, dashArray: '6 9', lineCap: 'round', lineJoin: 'round' }).addTo(map));
  }

  const pts = [];
  CITIES.forEach(c => {
    if (c.lat == null) return;
    pts.push([c.lat, c.lng]);
    const cm = L.marker([c.lat, c.lng], { icon: L.divIcon({ className: '', html: cityMarker(c), iconSize: [34, 34], iconAnchor: [17, 17] }), zIndexOffset: 1000 })
      .addTo(map).bindPopup(popupHtml({ name: c.name, jp: c.jp, desc: c.blurb, lat: c.lat, lng: c.lng, cityKey: c.key }, onWeatherCb));
    cityLayers.push(cm); markerIndex[c.name] = { marker: cm, latlng: [c.lat, c.lng] };
    (c.pois || []).forEach(p => {
      if (p.lat == null) return;
      if (p.name === c.station && p.lat === c.lat) return;
      const pm = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html: poiMarker(p, c.color), iconSize: [22, 22], iconAnchor: [11, 11] }) })
        .addTo(map).bindPopup(popupHtml({ ...p, cityKey: c.key }, onWeatherCb));
      cityLayers.push(pm); markerIndex[p.name] = { marker: pm, latlng: [p.lat, p.lng] };
    });
  });

  // Fit AFTER invalidateSize so the container's real size is known (fixes the map
  // being stuck zoomed-out when the route tab was just shown). Run twice: once now,
  // once after layout settles, so the final framing is always correct.
  const fit = () => {
    if (!map) return;
    try { map.invalidateSize(); } catch {}
    if (pts.length >= 2) map.fitBounds(pts, { padding: [28, 28], maxZoom: 11 });
    else if (pts.length === 1) map.setView(pts[0], 12);
    else map.setView([20, 0], 2);
  };
  fit();
  setTimeout(fit, 200);
}

export function refreshMapSize() { if (map) setTimeout(() => map.invalidateSize(), 60); }

// ---- Per-day mini map (itinerary) ----
let dayMap;
export function renderDayMiniMap(elId, points) {
  if (typeof L === 'undefined') return;
  ensureGesture();
  const elx = document.getElementById(elId); if (!elx) return;
  if (dayMap) { try { dayMap.remove(); } catch {} dayMap = null; }
  if (!points || !points.length) return;
  dayMap = L.map(elx, {
    zoomControl: false, attributionControl: false, dragging: true, touchZoom: true,
    gestureHandling: true,
    gestureHandlingOptions: { text: { touch: '請用雙指移動地圖', scroll: '請用 Ctrl + 滾輪縮放地圖', scrollMac: '請用 ⌘ + 滾輪縮放地圖' }, duration: 1500 },
  });
  L.tileLayer(tileUrl(), { subdomains: 'abcd', maxZoom: 18 }).addTo(dayMap);
  const latlngs = [];
  points.forEach((p, i) => {
    latlngs.push([p.lat, p.lng]);
    L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html: numMarker(i + 1), iconSize: [26, 26], iconAnchor: [13, 13] }) })
      .addTo(dayMap).bindPopup(`<b>${i + 1}. ${p.name}</b>`);
  });
  if (latlngs.length > 1) L.polyline(latlngs, { color: '#2563eb', weight: 3, opacity: .55, dashArray: '4 7' }).addTo(dayMap);
  if (latlngs.length === 1) dayMap.setView(latlngs[0], 14);
  else dayMap.fitBounds(latlngs, { padding: [26, 26], maxZoom: 14 });
  setTimeout(() => { if (dayMap) dayMap.invalidateSize(); }, 140);
}
function numMarker(n) {
  return `<div style="width:26px;height:26px;border-radius:50%;background:#2563eb;color:#fff;display:grid;place-items:center;font-size:12px;font-weight:800;box-shadow:0 2px 6px rgba(0,0,0,.35),0 0 0 2px #fff">${n}</div>`;
}

export function focusPlace(name) {
  if (!map) return false;
  // fuzzy match
  let key = Object.keys(markerIndex).find(k => k === name)
    || Object.keys(markerIndex).find(k => k.includes(name) || name.includes(k));
  if (!key) {
    const p = allPois.find(p => p.name.includes(name) || (p.jp && p.jp.toLowerCase().includes(name.toLowerCase())));
    if (p) key = Object.keys(markerIndex).find(k => k === p.name);
  }
  const hit = markerIndex[key];
  if (!hit) return false;
  map.flyTo(hit.latlng, 13, { duration: .8 });
  setTimeout(() => hit.marker.openPopup(), 700);
  return true;
}

// ---- marker html ----
function cityMarker(c) {
  return `<div style="width:34px;height:34px;border-radius:50%;background:${c.color || '#2563eb'};display:grid;place-items:center;
    box-shadow:0 3px 10px rgba(0,0,0,.35),0 0 0 3px #fff;font-size:17px;border:0;">${c.flag || '📍'}</div>`;
}
function poiMarker(p, color) {
  return `<div style="width:20px;height:20px;border-radius:50%;background:#fff;display:grid;place-items:center;
    box-shadow:0 2px 6px rgba(0,0,0,.3),0 0 0 2px ${color};font-size:11px;">${p.emoji || '📍'}</div>`;
}
function chipMarker(text, color) {
  return `<div style="padding:3px 9px;border-radius:999px;background:${color};color:#fff;font-size:11px;font-weight:700;
    box-shadow:0 2px 8px rgba(0,0,0,.3);white-space:nowrap;">${text}</div>`;
}
function popupHtml(p, onWeather) {
  const g = gmapPlace(p.name, p.lat, p.lng);
  const meta = [p.hours, p.fee].filter(Boolean).join(' · ');
  return `<div style="min-width:180px">
    <div style="font-weight:700;font-size:14px">${p.name}</div>
    ${p.jp ? `<div style="font-size:11px;color:#888">${p.jp}</div>` : ''}
    ${p.desc ? `<div style="font-size:12.5px;color:#444;margin-top:6px;line-height:1.45">${p.desc}</div>` : ''}
    ${meta ? `<div style="font-size:11px;color:#2563eb;margin-top:6px">${meta}</div>` : ''}
    <div style="display:flex;gap:6px;margin-top:10px">
      <a href="${g}" target="_blank" rel="noopener" style="flex:1;text-align:center;background:#2563eb;color:#fff;
        padding:7px;border-radius:8px;font-size:12px;font-weight:600;text-decoration:none">Google 導航</a>
      ${p.cityKey ? `<button data-wx="${p.cityKey}" style="background:#eef1f7;border:0;border-radius:8px;padding:7px 10px;font-size:12px;font-weight:600;cursor:pointer">天氣</button>` : ''}
    </div>
    ${p.lat != null ? `<a href="${gmapHotels(p.lat, p.lng)}" target="_blank" rel="noopener" style="display:block;text-align:center;margin-top:6px;background:#fff;border:1px solid #e11d48;color:#e11d48;
        padding:7px;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none">🏨 找附近飯店</a>` : ''}
  </div>`;
}

// ---- JR line schematic (SVG) — 熊本 → 關西 single-trip corridor ----
export function jrSchematicHTML() {
  const S = (x, y, label, sub, color, r = 7) => `
    <circle cx="${x}" cy="${y}" r="${r}" fill="var(--surface)" stroke="${color}" stroke-width="3"/>
    <text x="${x}" y="${y - 13}" text-anchor="middle" font-size="12.5" font-weight="700" fill="var(--text)">${label}</text>
    ${sub ? `<text x="${x}" y="${y + 21}" text-anchor="middle" font-size="9.5" fill="var(--text-3)">${sub}</text>` : ''}`;
  return `
  <svg viewBox="0 0 820 470" width="820" style="max-width:none">
    <!-- 九州新幹線 (另購) -->
    <line x1="70" y1="70" x2="180" y2="70" stroke="#16a34a" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 9"/>
    <!-- 山陽新幹線 -->
    <line x1="180" y1="70" x2="650" y2="70" stroke="#2563eb" stroke-width="6" stroke-linecap="round"/>
    <!-- 下關在來線 -->
    <line x1="280" y1="70" x2="280" y2="150" stroke="#e11d48" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 9"/>
    <!-- 宮島支線 + 渡輪 -->
    <line x1="420" y1="70" x2="420" y2="140" stroke="#0d9488" stroke-width="5" stroke-linecap="round"/>
    <line x1="420" y1="140" x2="420" y2="205" stroke="#0d9488" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 9"/>
    <!-- 瀨戶大橋 四國 -->
    <line x1="540" y1="70" x2="540" y2="180" stroke="#d97706" stroke-width="5" stroke-linecap="round"/>
    <!-- 關西在來 -->
    <line x1="650" y1="70" x2="650" y2="140" stroke="#b91c1c" stroke-width="5" stroke-linecap="round"/>
    <line x1="650" y1="140" x2="755" y2="140" stroke="#b91c1c" stroke-width="5" stroke-linecap="round"/>
    <line x1="650" y1="140" x2="755" y2="210" stroke="#65a30d" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 9"/>
    <line x1="650" y1="140" x2="650" y2="255" stroke="#4f46e5" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 9"/>

    ${S(70, 70, '熊本', '九州新幹線·另購', '#16a34a')}
    ${S(180, 70, '博多', '周遊券啟用', '#4f46e5', 8)}
    ${S(280, 70, '小倉', '', '#2563eb')}
    ${S(420, 70, '廣島', '山陽新幹線', '#2563eb')}
    ${S(540, 70, '岡山', '', '#7c3aed')}
    ${S(650, 70, '新大阪', '', '#2563eb')}
    ${S(280, 150, '下関', '馬關·唐戸（巴士）', '#e11d48')}
    ${S(420, 140, '宮島口', '', '#0d9488', 6)}
    ${S(420, 205, '宮島 ⛴', '嚴島神社', '#0d9488')}
    ${S(540, 180, '高松', '瀨戶大橋·四國', '#d97706')}
    ${S(650, 140, '大阪', '', '#db2777')}
    ${S(755, 140, '京都', '新快速', '#b91c1c')}
    ${S(755, 210, '奈良', '大和路', '#65a30d')}
    ${S(650, 255, 'KIX ✈', '關西機場', '#4f46e5')}

    <!-- legend -->
    <g font-size="11" font-weight="600">
      <rect x="20" y="395" width="780" height="60" rx="10" fill="var(--surface-2)"/>
      <line x1="36" y1="416" x2="62" y2="416" stroke="#2563eb" stroke-width="5"/><text x="70" y="420" fill="var(--text-2)">山陽新幹線</text>
      <line x1="170" y1="416" x2="196" y2="416" stroke="#16a34a" stroke-width="5" stroke-dasharray="2 6"/><text x="204" y="420" fill="var(--text-2)">九州新幹線(另購)</text>
      <line x1="340" y1="416" x2="366" y2="416" stroke="#d97706" stroke-width="5"/><text x="374" y="420" fill="var(--text-2)">瀨戶大橋·四國</text>
      <line x1="490" y1="416" x2="516" y2="416" stroke="#b91c1c" stroke-width="5"/><text x="524" y="420" fill="var(--text-2)">關西在來</text>
      <line x1="610" y1="416" x2="636" y2="416" stroke="#0d9488" stroke-width="5"/><text x="644" y="420" fill="var(--text-2)">宮島·渡輪</text>
      <text x="36" y="442" fill="var(--text-3)" font-weight="500">實線＝新幹線/渡輪　虛線＝在來線/另購　｜　Setouchi 周遊券含のぞみ·みずほ·マリンライナー·はるか與 JR 宮島渡輪（熊本→博多另購）</text>
    </g>
  </svg>`;
}
