// ============================================================================
// map.js — Leaflet region map (本州/四國/九州) + JR line schematic
// ============================================================================
import { CITIES, allPois } from './data.js';
import { gmapPlace } from './util.js';

let map, markerIndex = {}, inited = false;

// Rail corridors (approx waypoints) for polylines
const RAIL = [
  { name: '山陽新幹線', color: '#2563eb', pts: [[34.3978, 132.4753], [34.0089, 130.9569], [33.8868, 130.8826], [33.5902, 130.4017]] },
  { name: '九州新幹線', color: '#16a34a', pts: [[33.5902, 130.4017], [32.7894, 130.6880]] },
  { name: '豐肥本線', color: '#ea580c', pts: [[32.7894, 130.6880], [32.9522, 131.1213]] },
  { name: '宮島（山陽本線+渡輪）', color: '#0d9488', pts: [[34.3978, 132.4753], [34.3110, 132.3036], [34.2960, 132.3199]] },
  { name: '下關（在來線）', color: '#e11d48', pts: [[33.8868, 130.8826], [33.9499, 130.9242]] },
];

export function initMap(onWeather) {
  if (inited || typeof L === 'undefined') return;
  const elMap = document.getElementById('leafmap');
  if (!elMap) return;
  inited = true;

  map = L.map(elMap, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([33.7, 131.6], 7);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 18, subdomains: 'abcd',
  }).addTo(map);

  // Rail polylines
  RAIL.forEach(r => {
    L.polyline(r.pts, { color: r.color, weight: 4, opacity: .75, dashArray: r.name.includes('在來') || r.name.includes('豐肥') ? '6 6' : null, lineCap: 'round' }).addTo(map);
  });

  // Shikoku note marker
  L.marker([33.84, 132.77], { icon: L.divIcon({ className: '', html: chipMarker('🏝️ 四國', '#0d9488'), iconSize: [80, 28], iconAnchor: [40, 14] }) })
    .addTo(map).bindPopup('<b>四國</b><br>本行程地圖涵蓋四國；若想加跑四國，需另購 All Shikoku Pass 與本四連絡線（與 SSNK 周遊券不互通）。');

  // City + POI markers
  CITIES.forEach(c => {
    // big city marker
    const cm = L.marker([c.lat, c.lng], { icon: L.divIcon({ className: '', html: cityMarker(c), iconSize: [34, 34], iconAnchor: [17, 17] }), zIndexOffset: 1000 })
      .addTo(map).bindPopup(popupHtml({ name: c.name, jp: c.jp, desc: c.blurb, lat: c.lat, lng: c.lng, cityKey: c.key }, onWeather));
    markerIndex[c.name] = { marker: cm, latlng: [c.lat, c.lng] };
    // POIs
    c.pois.forEach(p => {
      if (p.name === c.station && p.lat === c.lat) return;
      const pm = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html: poiMarker(p, c.color), iconSize: [22, 22], iconAnchor: [11, 11] }) })
        .addTo(map).bindPopup(popupHtml({ ...p, cityKey: c.key }, onWeather));
      markerIndex[p.name] = { marker: pm, latlng: [p.lat, p.lng] };
    });
  });

  // Wire popup weather buttons (event delegation)
  map.on('popupopen', e => {
    const node = e.popup.getElement();
    const btn = node && node.querySelector('[data-wx]');
    if (btn) btn.addEventListener('click', () => onWeather && onWeather(btn.getAttribute('data-wx')));
  });

  setTimeout(() => map.invalidateSize(), 200);
}

export function refreshMapSize() { if (map) setTimeout(() => map.invalidateSize(), 60); }

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
  return `<div style="width:34px;height:34px;border-radius:50%;background:${c.color};display:grid;place-items:center;
    box-shadow:0 3px 10px rgba(0,0,0,.35),0 0 0 3px #fff;font-size:17px;border:0;">${c.flag}</div>`;
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
  </div>`;
}

// ---- JR line schematic (SVG) ----
export function jrSchematicHTML() {
  const S = (x, y, label, sub, color, r = 7) => `
    <circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${color}" stroke-width="3"/>
    <text x="${x}" y="${y - 14}" text-anchor="middle" font-size="13" font-weight="700" fill="var(--text)">${label}</text>
    ${sub ? `<text x="${x}" y="${y + 22}" text-anchor="middle" font-size="10" fill="var(--text-3)">${sub}</text>` : ''}`;
  return `
  <svg viewBox="0 0 700 470" width="700" style="max-width:none">
    <!-- 山陽新幹線 -->
    <line x1="150" y1="70" x2="640" y2="70" stroke="#2563eb" stroke-width="6" stroke-linecap="round"/>
    <!-- 九州新幹線 -->
    <line x1="150" y1="70" x2="150" y2="250" stroke="#16a34a" stroke-width="6" stroke-linecap="round"/>
    <!-- 豐肥本線 -->
    <line x1="150" y1="250" x2="320" y2="340" stroke="#ea580c" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 10"/>
    <!-- 宮島支線 -->
    <line x1="640" y1="70" x2="640" y2="240" stroke="#0d9488" stroke-width="5" stroke-linecap="round"/>
    <line x1="640" y1="240" x2="640" y2="300" stroke="#0d9488" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 9"/>
    <!-- 下關在來線 -->
    <line x1="270" y1="70" x2="270" y2="180" stroke="#e11d48" stroke-width="5" stroke-linecap="round" stroke-dasharray="2 9"/>

    ${S(640, 70, '廣島', '山陽新幹線', '#2563eb')}
    ${S(500, 70, '新山口', '', '#2563eb', 5)}
    ${S(380, 70, '新下関', '', '#2563eb', 5)}
    ${S(270, 70, '小倉', '', '#2563eb')}
    ${S(150, 70, '博多', '進出據點', '#4f46e5', 8)}
    ${S(150, 250, '熊本', '九州新幹線', '#16a34a')}
    ${S(320, 340, '阿蘇', '豐肥本線 特急', '#ea580c')}
    ${S(640, 240, '宮島口', '', '#0d9488', 6)}
    ${S(640, 300, '宮島 ⛴', '嚴島神社', '#0d9488')}
    ${S(270, 180, '下関', '馬關 · 唐戸（巴士）', '#e11d48')}

    <!-- legend -->
    <g font-size="11" font-weight="600">
      <rect x="20" y="400" width="660" height="56" rx="10" fill="var(--surface-2)"/>
      <line x1="36" y1="418" x2="64" y2="418" stroke="#2563eb" stroke-width="5"/><text x="72" y="422" fill="var(--text-2)">山陽新幹線</text>
      <line x1="170" y1="418" x2="198" y2="418" stroke="#16a34a" stroke-width="5"/><text x="206" y="422" fill="var(--text-2)">九州新幹線</text>
      <line x1="304" y1="418" x2="332" y2="418" stroke="#0d9488" stroke-width="5"/><text x="340" y="422" fill="var(--text-2)">宮島支線</text>
      <line x1="430" y1="418" x2="458" y2="418" stroke="#ea580c" stroke-width="5" stroke-dasharray="2 6"/><text x="466" y="422" fill="var(--text-2)">豐肥本線</text>
      <line x1="560" y1="418" x2="588" y2="418" stroke="#e11d48" stroke-width="5" stroke-dasharray="2 6"/><text x="596" y="422" fill="var(--text-2)">在來線</text>
      <text x="36" y="446" fill="var(--text-3)" font-weight="500">實線＝新幹線／渡輪　虛線＝在來線・特急　｜　持 SSNK 周遊券可搭新幹線（含のぞみ・みずほ）與 JR 宮島渡輪</text>
    </g>
  </svg>`;
}
