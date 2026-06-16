// ============================================================================
// main.js — app orchestrator: tabs, theme, time/location-aware Today,
// itinerary, routes, weather, souvenirs, settings, Gemini control API.
// ============================================================================
import { TRIP, DAYS, CITIES, cityByKey, dayByDate, ROUTES, PASS, SOUVENIRS, TYPE_META, TIDE, allPois } from './data.js';
import {
  el, clear, icon, $, $$, toast, pad2, ymd, parseHM, nowMinutes,
  haversineKm, fmtDistance, gmapPlace, gmapDir, gmapHotels, bookingHotels, DOW_TC, favs,
} from './util.js';
import { renderWeatherCity, getCurrentSummary, clothingAdvice } from './weather.js';
import { initMap, refreshMapSize, focusPlace, jrSchematicHTML, renderDayMiniMap } from './map.js';
import { initGemini, getCfg } from './gemini.js';
import { initToolkit, closeToolkit } from './toolkit.js';

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const PAGES = ['today', 'plan', 'route', 'weather', 'gift', 'ai'];
let currentTab = 'today';
let selectedDay = 0;
let lastPos = null;
let mapReady = false;
let geminiCtl = null;

// ---------- Theme ----------
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem('kp_theme', t);
  const use = $('#themeBtn use'); if (use) use.setAttribute('href', t === 'dark' ? '#i-sun' : '#i-moon');
  const meta = $('meta[name="theme-color"]'); // not strictly needed
}
function initTheme() {
  const saved = localStorage.getItem('kp_theme');
  setTheme(saved || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
}

// ---------- Tabs ----------
function goTab(tab) {
  if (!PAGES.includes(tab)) return;
  currentTab = tab;
  PAGES.forEach(p => { const s = $('#page-' + p); if (s) s.hidden = p !== tab; });
  $$('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.tab === tab));
  if (tab === 'route') { ensureMap(); refreshMapSize(); }
  if (tab === 'today') renderToday();
  if (tab === 'weather') renderWeatherHero();
  if (tab === 'plan' && curDayPts.length) renderDayMiniMap('dayMiniMap', curDayPts);
  const sec = $('#page-' + tab);
  if (sec && !reduceMotion()) sec.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' });
  window.scrollTo({ top: 0 });
}

// ---------- Now / status ----------
function computeNow() {
  const now = new Date(), ds = ymd(now), nm = nowMinutes(now);
  let phase = 'during', dayIndex, day;
  const entry = dayByDate[ds];
  if (entry) { dayIndex = entry.index; day = DAYS[dayIndex]; }
  else if (ds < TRIP.start) { phase = 'before'; dayIndex = 0; day = DAYS[0]; }
  else { phase = 'after'; dayIndex = DAYS.length - 1; day = DAYS[dayIndex]; }
  let current = null, next = null;
  if (phase === 'during') for (const it of day.items) { if (parseHM(it.time) <= nm) current = it; else { next = it; break; } }
  return { now, ds, nm, phase, dayIndex, day, current, next };
}
function status() {
  const s = computeNow();
  let distance = null;
  if (lastPos && s.next && s.next.lat) distance = fmtDistance(haversineKm(lastPos, { lat: s.next.lat, lng: s.next.lng }));
  return {
    localTime: `${pad2(s.now.getHours())}:${pad2(s.now.getMinutes())}`,
    date: s.ds, phase: s.phase === 'before' ? '行程開始前' : s.phase === 'after' ? '行程已結束' : '行程進行中',
    today: { day: s.dayIndex + 1, city: cityByKey[s.day.cityKey].name, title: s.day.title },
    current: s.current ? `${s.current.time} ${s.current.title}` : (s.phase === 'before' ? '行程尚未開始' : '今日行程已結束'),
    next: s.next ? `${s.next.time} ${s.next.title}` : '今日已無安排',
    location: lastPos ? '已定位' : '未授權定位',
    distanceToNext: distance || '—',
  };
}

// ---------- Today page ----------
function renderToday() {
  const root = $('#todayRoot'); if (!root) return; clear(root);
  const s = computeNow();
  const city = cityByKey[s.day.weatherKey] || cityByKey[s.day.cityKey];

  // Hero
  root.appendChild(el('.hero', {}, [
    el('.hero__eyebrow', { text: 'KYUSHU · HONSHU · SHIKOKU' }),
    el('.hero__title', { text: TRIP.title }),
    el('.hero__meta', {}, [
      el('span', {}, [icon('i-plan'), ` ${TRIP.start.slice(5)} – ${TRIP.end.slice(5)}`]),
      el('span', {}, [icon('i-train'), ' ' + TRIP.base]),
      el('span', {}, [icon('i-pin'), ` ${DAYS.length} 天 · ${CITIES.length} 區`]),
    ]),
  ]));

  // Now / countdown card
  if (s.phase === 'before') {
    const days = Math.max(0, Math.ceil((new Date(TRIP.start + 'T00:00:00') - s.now) / 864e5));
    root.appendChild(el('.nowcard', { style: { marginTop: '16px' } }, [
      el('.nowcard__bg'),
      el('.nowcard__body', {}, [
        el('.nowcard__label', {}, [el('span', { class: 'livedot' }), '即將出發']),
        el('.nowcard__title', { text: days === 0 ? '明天就出發！' : `距離出發還有 ${days} 天` }),
        el('.nowcard__time', {}, [icon('i-today'), ` 現在 ${status().localTime} · ${s.ds}`]),
        el('.nowcard__next', {}, [el('span', { html: `首日：<b>${DAYS[0].title}</b> — ${DAYS[0].items[0].time} ${DAYS[0].items[0].title}` })]),
      ]),
    ]));
  } else if (s.phase === 'after') {
    root.appendChild(el('.card.card--pad', { style: { marginTop: '16px', textAlign: 'center' } }, [
      el('.empty__emoji', { text: '🎉' }),
      el('.h-card', { text: '旅程圓滿結束！' }),
      el('p', { class: 'muted', style: { marginTop: '6px' }, text: '八日九州・本州之旅辛苦了，期待下次再訪。' }),
    ]));
  } else {
    const cur = s.current, nxt = s.next;
    const body = [
      el('.nowcard__label', {}, [el('span', { class: 'livedot' }), `現在 · Day ${s.dayIndex + 1} · ${cityByKey[s.day.cityKey].name}`]),
      el('.nowcard__title', { text: cur ? cur.title : '準備出發' }),
      el('.nowcard__time', {}, [icon('i-today'), ` ${status().localTime}${cur ? ' · ' + cur.time + ' 開始' : ''}`]),
    ];
    if (nxt) {
      const distTxt = lastPos && nxt.lat ? ` · ${fmtDistance(haversineKm(lastPos, { lat: nxt.lat, lng: nxt.lng }))}` : '';
      body.push(el('.nowcard__next', {}, [
        el('div', { html: `接下來 <b>${nxt.time}</b>：<b>${nxt.title}</b>${distTxt}` }),
        nxt.lat ? el('a.btn.btn--sm', {
          href: lastPos ? gmapDir(`${lastPos.lat},${lastPos.lng}`, `${nxt.lat},${nxt.lng}`, 'transit') : gmapPlace(nxt.title, nxt.lat, nxt.lng),
          target: '_blank', rel: 'noopener', style: { marginTop: '10px', background: 'rgba(255,255,255,.2)', color: '#fff', border: 'none' },
        }, [icon('i-pin'), '導航前往']) : null,
      ]));
    } else {
      body.push(el('.nowcard__next', {}, [el('div', { text: '今日行程已完成，好好休息 🛏️' })]));
    }
    root.appendChild(el('.nowcard', { style: { marginTop: '16px' } }, [el('.nowcard__bg'), el('.nowcard__body', {}, body)]));
    root.appendChild(renderCommandCard(s));
  }

  // Weather snapshot
  const wxCard = el('.card.card--pad.card--tap', { style: { marginTop: '14px' }, onclick: () => goWeather(city.key) }, [
    el('.row-between', {}, [
      el('.row', {}, [el('div', { style: { fontSize: '15px', fontWeight: '650' }, text: `${city.flag} ${city.name} 天氣` })]),
      el('.chip', {}, [icon('i-chevron'), '詳細']),
    ]),
    el('.row', { id: 'todayWxLine', style: { marginTop: '8px', gap: '12px' } }, [el('.skeleton', { style: { height: '24px', width: '160px' } })]),
  ]);
  root.appendChild(wxCard);
  getCurrentSummary(city.key).then(w => {
    const line = $('#todayWxLine'); if (!line || !w) return; clear(line);
    line.appendChild(el('div', { style: { fontSize: '26px' }, text: w.emoji }));
    line.appendChild(el('div', {}, [
      el('div', { style: { fontWeight: '700', fontSize: '18px' }, text: `${w.temp}° ${w.label}` }),
      el('.tiny.muted', { text: `${w.lo}° / ${w.hi}° · 降雨 ${w.rainProb}% · 濕度 ${w.humidity}%` }),
    ]));
  });

  // Today timeline (compact)
  const tl = el('.card.card--pad', { style: { marginTop: '14px' } }, [
    el('.row-between', {}, [el('.h-card', { text: `Day ${s.dayIndex + 1} · ${s.day.title}` }), el('button.chip.chip--brand.chip--tap', { onclick: () => openDay(s.dayIndex + 1) }, '完整行程')]),
    el('.muted.tiny', { style: { marginTop: '2px' }, text: s.day.summary }),
    el('.stack', { style: { marginTop: '12px', gap: '2px' } }, s.day.items.filter(x => x.type !== 'stay').map(it => {
      const isCur = s.phase === 'during' && s.current === it;
      const isNext = s.phase === 'during' && s.next === it;
      return el('.row', { style: { gap: '10px', padding: '7px 0', opacity: (s.phase === 'during' && parseHM(it.time) < s.nm && !isCur) ? '.5' : '1' } }, [
        el('b', { style: { width: '46px', color: isCur ? 'var(--sakura)' : 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }, text: it.time }),
        el('span', { style: { width: '8px', height: '8px', borderRadius: '50%', flex: 'none', background: isCur ? 'var(--sakura)' : isNext ? 'var(--brand-2)' : 'var(--line-strong)' } }),
        el('span', { style: { fontWeight: isCur || isNext ? '650' : '500' }, text: it.title }),
      ]);
    })),
  ]);
  root.appendChild(tl);

  // Quick actions
  root.appendChild(el('.grid2', { style: { marginTop: '14px' } }, [
    el('button.btn.btn--brand', { onclick: () => { goTab('route'); } }, [icon('i-route'), '路線・地圖']),
    el('button.btn.btn--sakura', { onclick: () => { goTab('ai'); } }, [icon('i-ai'), '問 AI 旅伴']),
  ]));
}

// In-trip command center: day-progress ring + next-step countdown
function renderCommandCard(s) {
  const items = s.day.items.filter(x => x.type !== 'stay');
  const startM = parseHM(items[0].time), endM = parseHM(items[items.length - 1].time);
  const pct = Math.max(0, Math.min(100, Math.round((s.nm - startM) / Math.max(1, endM - startM) * 100)));
  const nxt = s.next;
  let countTxt = '今日行程已完成';
  if (nxt) { const m = parseHM(nxt.time) - s.nm; countTxt = m > 60 ? `還有 ${Math.floor(m / 60)} 小時 ${m % 60} 分` : `還有 ${Math.max(0, m)} 分鐘`; }
  return el('.card.card--pad', { style: { marginTop: '14px' } }, [
    el('.cmd', {}, [
      el('.ring', {}, [
        el('.ring__fill', { style: { background: `conic-gradient(var(--brand-2) ${pct * 3.6}deg, var(--surface-3) 0)` } }),
        el('.ring__hole', {}, [el('.ring__pct', { style: { animation: 'popIn .4s var(--ease)' }, text: pct + '%' }), el('.ring__lbl', { text: '今日進度' })]),
      ]),
      el('div', { style: { minWidth: '0' } }, [
        el('.cmd__next-lbl', { text: nxt ? '下一步' : '狀態' }),
        el('.cmd__next-title', { text: nxt ? `${nxt.time} ${nxt.title}` : '今日完成 🛏️' }),
        nxt ? el('.cmd__count', {}, [icon('i-today'), countTxt]) : el('.tiny.muted', { style: { marginTop: '4px' }, text: '好好休息，明天見！' }),
        nxt && nxt.lat ? el('a.btn.btn--brand.btn--sm', { href: lastPos ? gmapDir(`${lastPos.lat},${lastPos.lng}`, `${nxt.lat},${nxt.lng}`, 'transit') : gmapPlace(nxt.title, nxt.lat, nxt.lng), target: '_blank', rel: 'noopener', style: { marginTop: '10px' } }, [icon('i-pin'), '導航前往']) : null,
      ]),
    ]),
    el('.dayprog', {}, [el('.dayprog__fill', { style: { width: pct + '%' } })]),
  ]);
}

// ---------- Itinerary page ----------
let curDayPts = [];
function renderTideCard(date) {
  const t = TIDE.days[date];
  const floatT = t.high.filter(h => h[1] >= TIDE.floatCm).map(h => h[0]);
  const walkT = t.low.filter(l => l[1] <= TIDE.walkCm).map(l => l[0]);
  const row = (label, arr, color) => el('.row', { style: { gap: '10px', padding: '4px 0', alignItems: 'baseline' } }, [
    el('span', { style: { width: '40px', fontSize: '12px', fontWeight: '700', color }, text: label }),
    el('span', { style: { fontSize: '13px' }, text: arr.map(a => `${a[0]} (${a[1]}cm)`).join('、') }),
  ]);
  return el('.card.card--pad', { style: { marginTop: '14px', background: 'linear-gradient(135deg, color-mix(in srgb, #0d9488 12%, transparent), transparent)' } }, [
    el('.row-between', {}, [el('.h-card', { text: '🌊 宮島大鳥居 潮汐' }), el('span.chip', { text: date.slice(5) })]),
    el('div', { style: { marginTop: '8px' } }, [row('滿潮', t.high, 'var(--brand-2)'), row('乾潮', t.low, 'var(--sakura)')]),
    el('.divider'),
    el('.tiny', { style: { color: 'var(--text-2)', lineHeight: '1.7' }, html: `🛶 <b>看海上浮鳥居</b>（>250cm）：${floatT.length ? floatT.join('、') : '今日較不明顯'}<br>👣 <b>走到鳥居腳</b>（<100cm）：${walkT.length ? walkT.join('、') : '今日無'}` }),
    el('p', { class: 'tiny muted-3', style: { marginTop: '8px' }, text: TIDE.note }),
  ]);
}

function renderDayPicker() {
  const dp = $('#dayPick'); clear(dp);
  const todayDs = ymd(new Date());
  DAYS.forEach((d, i) => {
    const date = new Date(d.date + 'T00:00:00');
    dp.appendChild(el('.daypill' + (i === selectedDay ? '.is-active' : ''), { onclick: () => selectDay(i) }, [
      el('.daypill__dow', { text: '週' + d.dow + (d.date === todayDs ? ' ·今' : '') }),
      el('.daypill__num', { text: `${date.getMonth() + 1}/${date.getDate()}` }),
      el('.daypill__city', { text: cityByKey[d.cityKey].name.split(' ')[0] }),
    ]));
  });
}
function selectDay(i) { selectedDay = i; renderDayPicker(); renderDayDetail(i); }
function openDay(n) { goTab('plan'); selectDay(Math.max(0, Math.min(DAYS.length - 1, n - 1))); }

function renderDayDetail(i) {
  const root = $('#dayDetail'); clear(root);
  const d = DAYS[i], c = cityByKey[d.cityKey];
  const s = computeNow();
  const isToday = s.phase === 'during' && s.dayIndex === i;

  root.appendChild(el('.card.card--pad', {}, [
    el('.row-between', {}, [
      el('div', {}, [el('.h-card', { text: d.title }), el('.tiny.muted', { style: { marginTop: '2px' }, text: `${d.date}（週${d.dow}）· ${c.name}` })]),
      el('span.chip', { style: { background: c.color, color: '#fff', borderColor: 'transparent' }, text: c.flag + ' ' + c.name.split(' ')[0] }),
    ]),
    el('p', { class: 'muted tiny', style: { marginTop: '10px' }, text: d.summary }),
    el('.row.wrap', { style: { marginTop: '10px', gap: '8px' } }, [
      el('button.gmap-btn', { onclick: () => goWeather(d.weatherKey) }, [icon('i-weather'), '當地天氣']),
      el('button.gmap-btn', { onclick: () => { showOnMap(d.items.find(x => x.lat)?.title || c.name); } }, [icon('i-pin'), '地圖']),
    ]),
  ]));

  // Miyajima tide card (on the day that visits 宮島)
  if (TIDE.days[d.date] && d.items.some(it => /宮島|嚴島|大鳥居/.test(it.title))) root.appendChild(renderTideCard(d.date));

  // Per-day mini map
  curDayPts = d.items.filter(it => it.lat && it.type !== 'move' && it.type !== 'stay').map(it => ({ name: it.title, lat: it.lat, lng: it.lng }));
  if (curDayPts.length) {
    root.appendChild(el('.h-section', { style: { margin: '18px 2px 8px' }, text: '當日地圖 · 依序' }));
    root.appendChild(el('div', { id: 'dayMiniMap' }));
    renderDayMiniMap('dayMiniMap', curDayPts);
  }

  const tl = el('.timeline', { style: { marginTop: '14px' } });
  tl.appendChild(el('.tl-rail'));
  d.items.forEach(it => tl.appendChild(renderItem(it, isToday && s.current === it)));
  root.appendChild(tl);

  root.appendChild(el('p', { class: 'tiny muted-3', style: { margin: '14px 4px 0' }, text: '※ 車次與時刻為參考值，實際請以各路線的 Google 班次/JR 官方即時資訊為準。' }));
}

function renderItem(it, isNow) {
  const meta = TYPE_META[it.type] || TYPE_META.see;
  const mod = it.type === 'move' ? '.tl-item--move' : '';
  const body = [el('.tl-dot')];
  const card = el('.tl-card' + (it.lat ? '.is-tap' : ''), it.lat ? { onclick: () => openPoiSheet(it) } : {});
  card.appendChild(el('.tl-card__title', { text: it.title + (it.jp ? '' : '') }));
  if (it.jp) card.appendChild(el('.tiny.muted-3', { text: it.jp }));
  if (it.desc) card.appendChild(el('.tl-card__desc', { text: it.desc }));
  if (it.route) card.appendChild(el('div', { style: { marginTop: '10px' } }, [routeBlock(it.route)]));
  // foot
  const foot = el('.tl-card__foot', {}, [el('span.tl-badge.' + meta.cls, { text: meta.label })]);
  if (it.cost) foot.appendChild(el('span.chip', { style: { padding: '3px 8px', fontSize: '11px' } }, [icon('i-yen'), it.cost]));
  if (it.dur) foot.appendChild(el('span.tiny.muted-3', { text: '⏱ ' + it.dur }));
  if (it.lat) foot.appendChild(el('a.gmap-btn', { href: gmapPlace(it.title, it.lat, it.lng), target: '_blank', rel: 'noopener', style: { padding: '4px 10px', fontSize: '11px' }, onclick: e => e.stopPropagation() }, [icon('i-ext'), '導航']));
  if (it.lat) foot.appendChild(el('a.gmap-btn', { href: gmapHotels(it.lat, it.lng), target: '_blank', rel: 'noopener', style: { padding: '4px 10px', fontSize: '11px', borderColor: 'var(--sakura)', color: 'var(--sakura)' }, onclick: e => e.stopPropagation() }, ['🏨 附近飯店']));
  card.appendChild(foot);
  body.push(el('.tl-body', {}, [card]));
  return el('.tl-item' + mod + (isNow ? '.tl-item--now' : ''), {}, [
    el('.tl-time', {}, [el('b', { text: it.time })]),
    ...body,
  ]);
}

// ---------- Route block ----------
function routeBlock(route) {
  const fromName = route.from || route.fromStn, toName = route.to || route.toStn;
  const dir = gmapDir(route.fromStn || fromName, route.toStn || toName, 'transit');
  return el('.route', {}, [
    el('.route__head', {}, [icon(route.icon || 'i-train'), ` ${fromName} → ${toName}`, route.line ? el('span', { class: 'leg__sub', style: { marginLeft: '6px', fontWeight: '600' }, text: route.line }) : null]),
    el('.route__legs', {}, (route.legs || []).map(renderLeg)),
    el('.row.wrap', { style: { marginTop: '10px', gap: '8px' } }, [
      el('a.gmap-btn', { href: dir, target: '_blank', rel: 'noopener', onclick: e => e.stopPropagation() }, [icon('i-ext'), 'Google 即時班次']),
      route.fare ? el('span.chip', {}, [icon('i-yen'), route.fare]) : null,
      route.pass ? el('span.chip.chip--gold', {}, [icon('i-ticket'), route.pass]) : null,
    ]),
    route.tip ? el('p', { class: 'tiny muted-3', style: { marginTop: '8px', lineHeight: '1.5' }, text: '💡 ' + route.tip }) : null,
  ]);
}
function renderLeg(l) {
  return el('.leg', {}, [
    el('.leg__time', {}, [l.dep || '', l.arr ? el('div', { class: 'leg__sub', text: l.arr }) : null]),
    el('div', {}, [
      el('.leg__line', {}, [l.line, l.dur ? el('small', { text: ' · ' + l.dur }) : null]),
      l.note ? el('.leg__sub', { style: { marginTop: '2px' }, text: l.note }) : null,
    ]),
  ]);
}

// ---------- Route page (segments) ----------
function ensureMap() { if (mapReady) return; mapReady = true; initMap(goWeather); }
function setRouteSeg(seg) {
  $$('#routeSeg .chip').forEach(c => c.classList.toggle('is-on', c.dataset.seg === seg));
  const map = { map: 'routeMapWrap', lines: 'routeLinesWrap', trips: 'routeTripsWrap', pass: 'routePassWrap' };
  Object.entries(map).forEach(([s, id]) => { const w = $('#' + id); if (w) w.hidden = s !== seg; });
  if (seg === 'map') { ensureMap(); refreshMapSize(); }
}
function buildRoutePages() {
  // legend for map
  const legend = $('#mapLegend'); clear(legend);
  CITIES.forEach(c => legend.appendChild(el('span', {}, [el('span', { class: 'legend-dot', style: { background: c.color } }), c.name])));

  // lines (schematic)
  const lw = $('#routeLinesWrap'); clear(lw);
  lw.appendChild(el('.h-section', { style: { margin: '0 2px 10px' }, text: 'JR 路線示意圖' }));
  lw.appendChild(el('.card.card--pad', { style: { overflowX: 'auto' } }, [el('div', { html: jrSchematicHTML() })]));
  lw.appendChild(el('p', { class: 'tiny muted-3', style: { marginTop: '10px' }, text: '本圖為示意；確切月台與班次請見「所有班次」分頁的 Google 即時連結。' }));

  // trips
  const tw = $('#routeTripsWrap'); clear(tw);
  tw.appendChild(el('.h-section', { style: { margin: '0 2px 10px' }, text: '所有跨城班次 · 可直接 Google 導航' }));
  tw.appendChild(el('.stack', { style: { gap: '12px' } }, ROUTES.map(r => el('.card.card--pad', {}, [routeBlock(r)]))));

  // pass
  const pw = $('#routePassWrap'); clear(pw);
  pw.appendChild(el('.card', {}, [
    el('.hero', { style: { borderRadius: '0' } }, [
      el('.hero__eyebrow', { text: 'RECOMMENDED JR PASS' }),
      el('.hero__title', { style: { fontSize: '20px' }, text: PASS.best }),
      el('.hero__meta', {}, [el('span', {}, [icon('i-ticket'), ' ' + PASS.price]), el('span', {}, [icon('i-today'), ' ' + PASS.days])]),
    ]),
    el('.card--pad', {}, [
      el('p', { class: 'muted', style: { fontSize: '14px' }, text: PASS.why }),
      el('.stack', { style: { gap: '6px', marginTop: '12px' } }, PASS.highlights.map(h => el('div', { style: { fontSize: '13.5px' }, text: h }))),
      el('.divider'),
      el('.h-section', { text: '票券比較' }),
      el('.card', { style: { overflowX: 'auto', marginTop: '8px' } }, [passTable()]),
      el('.divider'),
      el('.h-section', { text: '如何購買與劃位' }),
      el('p', { class: 'muted tiny', style: { marginTop: '6px', lineHeight: '1.6' }, text: PASS.buy }),
    ]),
  ]));
}
function passTable() {
  const head = ['票券', '價格', '天', 'のぞみ', '廣島', '下關', '熊本', '評價'];
  const t = el('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '520px' } });
  const tr = el('tr');
  head.forEach(h => tr.appendChild(el('th', { style: { textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid var(--line)', color: 'var(--text-3)', fontWeight: '700', whiteSpace: 'nowrap' }, text: h })));
  t.appendChild(tr);
  PASS.compare.forEach((r, i) => {
    const row = el('tr', { style: { background: i === 0 ? 'color-mix(in srgb, var(--gold) 10%, transparent)' : 'transparent' } });
    [r.name, r.price, r.days, r.nozomi, r.hiroshima, r.shimonoseki, r.kumamoto, r.verdict].forEach((v, j) =>
      row.appendChild(el('td', { style: { padding: '8px 6px', borderBottom: '1px solid var(--line)', fontWeight: j === 0 || j === 7 ? '650' : '500', whiteSpace: 'nowrap' }, text: v })));
    t.appendChild(row);
  });
  return t;
}

// ---------- Weather page ----------
let wxCity = 'kumamoto';

// Today's planned location + its weather + outfit advice
async function renderWeatherHero() {
  const host = $('#wxTodayHero'); if (!host) return;
  const s = computeNow();
  const city = cityByKey[s.day.weatherKey] || cityByKey[s.day.cityKey];
  clear(host); host.appendChild(el('.skeleton', { style: { height: '210px', borderRadius: '28px' } }));
  const w = await getCurrentSummary(city.key);
  clear(host);
  if (!w) { host.appendChild(el('.card.card--pad', {}, [el('.muted', { text: '今日天氣載入失敗，稍後再試。' })])); return; }
  const adv = clothingAdvice(w);
  const grad = w.rainProb >= 50 ? 'linear-gradient(160deg,#475569,#334155)'
    : w.temp >= 28 ? 'linear-gradient(160deg,#0284c7,#38bdf8 60%,#7dd3fc)'
      : 'linear-gradient(160deg,#3b56d6,#5b8def)';
  const dayLabel = s.phase === 'before' ? '首日預計在' : s.phase === 'after' ? '旅程最後在' : `今天 · Day ${s.dayIndex + 1} 預計在`;
  const overlayBtn = { style: { borderColor: 'rgba(255,255,255,.45)', color: '#fff', background: 'rgba(255,255,255,.16)' } };
  host.appendChild(el('.wx-today', {}, [
    el('.wx-today__bg', { style: { background: grad } }),
    el('.wx-today__body', {}, [
      el('.wx-today__eyebrow', {}, [icon('i-pin'), dayLabel]),
      el('.wx-today__where', { text: `${city.flag} ${city.name}` }),
      el('.wx-today__now', {}, [
        el('.wx-today__emoji', { text: w.emoji }),
        el('div', {}, [
          el('.wx-today__temp', { text: `${w.temp}°` }),
          el('.wx-today__meta', { text: `${w.label} · 體感 ${w.feels}° · ${w.lo}°/${w.hi}° · 降雨 ${w.rainProb}%${w.sunrise ? ` · 🌅${w.sunrise} 🌇${w.sunset}` : ''}` }),
        ]),
      ]),
      adv ? el('.wx-today__wear', {}, [
        el('.wx-today__wear-h', {}, [icon('i-bag'), `建議穿搭 · ${adv.band}`]),
        el('.wear-chips', {}, adv.items.map(it => el('.wear-chip', {}, [el('span', { text: it.e }), it.t]))),
        el('.wx-today__tip', { text: '💡 ' + adv.tip }),
      ]) : null,
      el('.row.wrap', { style: { marginTop: '14px', gap: '8px' } }, [
        el('a.gmap-btn', { href: gmapHotels(city.lat, city.lng), target: '_blank', rel: 'noopener', ...overlayBtn }, ['🏨 今晚住宿']),
        el('button.gmap-btn', { onclick: () => goWeather(city.key), ...overlayBtn }, [icon('i-weather'), '看完整預報']),
      ]),
    ]),
  ]));
}

function buildWeatherPicker() {
  const p = $('#wxCityPick'); clear(p);
  CITIES.forEach(c => p.appendChild(el('.chip.chip--tap' + (c.key === wxCity ? '.is-on' : ''), { onclick: () => goWeather(c.key) }, [c.flag + ' ' + c.name.split(' ')[0]])));
}
function goWeather(cityKey) {
  wxCity = cityKey || wxCity; goTab('weather');
  buildWeatherPicker();
  renderWeatherCity(wxCity, $('#wxRoot'));
}

// ---------- Souvenirs page ----------
let giftCity = 'kumamoto';
const GIFT_CITIES = ['kumamoto', 'fukuoka', 'hiroshima', 'shimonoseki', 'takamatsu', 'okayama', 'osaka', 'kyoto', 'nara'];
function buildGiftPicker() {
  const p = $('#giftCityPick'); clear(p);
  GIFT_CITIES.forEach(k => { const c = cityByKey[k]; p.appendChild(el('.chip.chip--tap' + (k === giftCity ? '.is-on' : ''), { onclick: () => goSouvenirs(k) }, [c.flag + ' ' + c.name.split(' ')[0]])); });
}
function renderGifts() {
  const root = $('#giftRoot'); clear(root);
  const c = cityByKey[giftCity], list = SOUVENIRS[giftCity] || [];
  root.appendChild(el('.card.card--pad', { style: { marginBottom: '12px', background: 'linear-gradient(135deg,' + c.color + '22, transparent)' } }, [
    el('.h-card', { text: `${c.flag} ${c.name} 必買` }),
    el('.tiny.muted', { style: { marginTop: '2px' }, text: c.blurb }),
  ]));
  root.appendChild(el('.card', {}, list.map(g => el('.gift', {}, [
    el('.gift__ico', { text: g.emoji }),
    el('div', {}, [
      el('.gift__name', { text: g.name }),
      el('.gift__desc', { text: g.desc }),
      el('.gift__where', {}, [icon('i-bag'), ` ${g.where} · ${g.price}`]),
    ]),
  ]))));
  root.appendChild(el('p', { class: 'tiny muted-3', style: { margin: '14px 4px 0', lineHeight: '1.6' }, text: '🧊 冷藏類（明太子・馬刺し・河豚刺身）請回程前再買並索取保冷劑；常溫類（通りもん・紅葉饅頭・仙貝・醬料）最適合長途攜帶。' }));
}
function goSouvenirs(cityKey) { giftCity = cityKey || giftCity; goTab('gift'); buildGiftPicker(); renderGifts(); }

// ---------- Map control (for agent) ----------
function showOnMap(place) { goTab('route'); setRouteSeg('map'); ensureMap(); refreshMapSize(); return focusPlace(place); }

// ---------- Sheets ----------
function openSheet(id) { $('#scrim').classList.add('is-open'); $('#' + id).classList.add('is-open'); }
function closeSheets() { $('#scrim').classList.remove('is-open'); ['#sheet', '#settingsSheet', '#toolkitSheet', '#searchSheet'].forEach(s => { const e = $(s); if (e) e.classList.remove('is-open'); }); }

// ---------- Global search ----------
let searchIndex = null;
function buildSearchIndex() {
  const idx = [];
  allPois.forEach(p => idx.push({ kw: (p.name + ' ' + (p.jp || '') + ' ' + p.cityName).toLowerCase(), label: p.name, sub: p.cityName + (p.jp ? ' · ' + p.jp : ''), emoji: p.emoji || '📍', run: () => { closeSheets(); showOnMap(p.name); } }));
  DAYS.forEach((d, i) => idx.push({ kw: (d.title + ' ' + d.date + ' ' + cityByKey[d.cityKey].name).toLowerCase(), label: `Day ${i + 1} · ${d.title}`, sub: `${d.date}（週${d.dow}）`, emoji: '🗓️', run: () => { closeSheets(); openDay(i + 1); } }));
  ROUTES.forEach(r => idx.push({ kw: (r.from + ' ' + r.to + ' ' + (r.line || '')).toLowerCase(), label: `${r.from} → ${r.to}`, sub: r.line || '交通', emoji: '🚆', run: () => { closeSheets(); goTab('route'); setRouteSeg('trips'); } }));
  Object.keys(SOUVENIRS).forEach(k => idx.push({ kw: ('伴手禮 omiyage ' + cityByKey[k].name).toLowerCase(), label: `${cityByKey[k].name} 伴手禮`, sub: '必買清單', emoji: '🎁', run: () => { closeSheets(); goSouvenirs(k); } }));
  return idx;
}
function openSearch() {
  if (!searchIndex) searchIndex = buildSearchIndex();
  $('#scrim').classList.add('is-open'); $('#searchSheet').classList.add('is-open');
  const inp = $('#searchInput'); inp.value = ''; renderSearch(''); setTimeout(() => inp.focus(), 280);
}
function renderSearch(q) {
  const root = $('#searchResults'); clear(root);
  q = (q || '').trim().toLowerCase();
  let items = q ? searchIndex.filter(x => x.kw.includes(q)) : searchIndex.filter(x => x.emoji === '🗓️');
  if (!q) root.appendChild(el('.tiny.muted-3', { style: { padding: '2px 6px 10px' }, text: '試試：熊本城、嚴島神社、廣島、伴手禮、Day 5…' }));
  items = items.slice(0, 30);
  if (!items.length) { root.appendChild(el('.empty', {}, [el('.empty__emoji', { text: '🔍' }), el('div', { text: '找不到結果' })])); return; }
  items.forEach(it => root.appendChild(el('.sr-item', { onclick: it.run }, [
    el('.sr-ico', { text: it.emoji }),
    el('div', { style: { minWidth: '0' } }, [el('.sr-label', { text: it.label }), el('.sr-sub', { text: it.sub })]),
  ])));
}
function openPoiSheet(it) {
  $('#sheetTitle').textContent = it.title;
  const body = $('#sheetBody'); clear(body);
  const star = el('button.fav-btn' + (favs.has(it.title) ? '.is-fav' : ''), { title: '收藏' }, [icon('i-star')]);
  star.addEventListener('click', () => { const on = favs.toggle(it.title); star.classList.toggle('is-fav', on); toast(on ? '已加入收藏 ⭐' : '已移除收藏'); });
  body.appendChild(el('.row-between', { style: { marginTop: '-2px', marginBottom: '8px' } }, [
    it.jp ? el('.muted-3.tiny', { text: it.jp }) : el('span'),
    star,
  ]));
  if (it.desc) body.appendChild(el('p', { style: { fontSize: '14.5px', lineHeight: '1.6' }, text: it.desc }));
  const chips = el('.row.wrap', { style: { gap: '8px', marginTop: '14px' } });
  if (it.cost) chips.appendChild(el('.chip', {}, [icon('i-yen'), it.cost]));
  if (it.dur) chips.appendChild(el('.chip', { text: '⏱ ' + it.dur }));
  if (it.time) chips.appendChild(el('.chip.chip--brand', { text: it.time }));
  body.appendChild(chips);
  if (it.lat) {
    body.appendChild(el('.grid2', { style: { marginTop: '16px' } }, [
      el('a.btn.btn--brand', { href: gmapPlace(it.title, it.lat, it.lng), target: '_blank', rel: 'noopener' }, [icon('i-ext'), 'Google 導航']),
      el('button.btn', { onclick: () => { closeSheets(); showOnMap(it.title); } }, [icon('i-pin'), '在地圖查看']),
    ]));
    body.appendChild(el('.h-section', { style: { marginTop: '18px' }, text: '附近住宿 · 沿途找飯店' }));
    body.appendChild(el('.grid2', { style: { marginTop: '8px' } }, [
      el('a.btn.btn--sakura', { href: gmapHotels(it.lat, it.lng), target: '_blank', rel: 'noopener' }, ['🏨 Google 地圖飯店']),
      el('a.btn', { href: bookingHotels(it.title), target: '_blank', rel: 'noopener' }, ['🛏️ Booking.com']),
    ]));
    body.appendChild(el('p', { class: 'tiny muted-3', style: { marginTop: '8px' }, text: '會以此地點為中心顯示附近飯店與即時房價，方便沿途比價入住。' }));
  }
  openSheet('sheet');
}

// ---------- Settings ----------
function openSettings() {
  const body = $('#settingsBody'); clear(body);
  const cfg = getCfg();

  // Theme
  body.appendChild(el('.h-section', { text: '外觀' }));
  const themeRow = el('.row', { style: { gap: '8px', margin: '10px 0 18px' } });
  [['light', '淺色'], ['dark', '深色'], ['system', '跟隨系統']].forEach(([v, l]) => {
    themeRow.appendChild(el('button.chip.chip--tap' + ((localStorage.getItem('kp_theme') || 'system') === v ? '.is-on' : ''), {
      onclick: () => { if (v === 'system') { localStorage.removeItem('kp_theme'); setTheme(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); } else setTheme(v); openSettings(); },
    }, l));
  });
  body.appendChild(themeRow);

  // Gemini
  body.appendChild(el('.h-section', { text: 'Gemini AI 旅伴' }));
  body.appendChild(el('p', { class: 'tiny muted', style: { margin: '8px 0 12px', lineHeight: '1.6' }, text: '正式部署：在 Cloudflare Pages 後台設定環境變數 GEMINI_API_KEY（金鑰留在伺服器端，不外洩）。或在此貼上你的金鑰，App 會改為瀏覽器直連（適合本機測試）。' }));
  const keyIn = el('input', { type: 'password', value: cfg.key, placeholder: 'AIza...（選填，本機直連用）', style: inputStyle() });
  const modelIn = el('input', { type: 'text', value: cfg.model, placeholder: 'gemini-flash-latest', style: inputStyle() });
  body.appendChild(el('label', { class: 'tiny muted-3', text: 'API 金鑰' }));
  body.appendChild(keyIn);
  body.appendChild(el('label', { class: 'tiny muted-3', style: { marginTop: '8px', display: 'block' }, text: '模型 ID（Gemini Flash 3.0 → gemini-flash-latest 或 gemini-3.5-flash）' }));
  body.appendChild(modelIn);
  body.appendChild(el('button.btn.btn--brand.btn--block', { style: { marginTop: '12px' }, onclick: () => {
    if (keyIn.value.trim()) localStorage.setItem('kp_gemini_key', keyIn.value.trim()); else localStorage.removeItem('kp_gemini_key');
    localStorage.setItem('kp_gemini_model', modelIn.value.trim() || 'gemini-flash-latest');
    geminiCtl && geminiCtl.setModelLabel();
    toast('已儲存 AI 設定'); closeSheets();
  } }, [icon('i-ai'), '儲存']));

  // Location
  body.appendChild(el('.divider'));
  body.appendChild(el('.h-section', { text: '定位' }));
  body.appendChild(el('p', { class: 'tiny muted', style: { margin: '8px 0 12px' }, text: '授權定位後，「今日」分頁會依你目前位置顯示到下一站的距離與導航。' }));
  body.appendChild(el('button.btn.btn--block', { onclick: () => { requestLocation(false); }, }, [icon('i-loc'), lastPos ? '重新定位' : '允許定位']));

  // About
  body.appendChild(el('.divider'));
  body.appendChild(el('.h-section', { text: '關於' }));
  body.appendChild(el('p', { class: 'tiny muted-3', style: { marginTop: '8px', lineHeight: '1.7' }, html: '九州・本州・四國 JR 自由行規劃 · 2026/06/17–06/24。<br>天氣：Open-Meteo（免金鑰）。地圖：Leaflet + OpenStreetMap/CARTO。導航：Google Maps 深連結。<br>⚠️ 班次與票價為參考值（依官方資料整理），請以即時 Google Maps / JR 官方為準。' }));
  openSheet('settingsSheet');
}
function inputStyle() { return { width: '100%', padding: '11px 13px', borderRadius: '12px', border: '1px solid var(--line-strong)', background: 'var(--surface)', fontSize: '14px', marginTop: '4px' }; }

// ---------- Geolocation ----------
function requestLocation(auto) {
  if (!navigator.geolocation) { if (!auto) toast('此裝置不支援定位'); return; }
  navigator.geolocation.getCurrentPosition(p => {
    lastPos = { lat: p.coords.latitude, lng: p.coords.longitude };
    if (!auto) toast('已更新你的位置');
    if (currentTab === 'today') renderToday();
  }, err => { if (!auto) toast('無法取得位置：' + err.message); }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
}

// ---------- Motion ----------
function initRipples() {
  const sel = '.btn,.tab,.chip--tap,.gmap-btn,.tk-tile,.daypill,.send-btn,.mic-btn,.iconbtn,.fav-btn,.ph-speak,.emg-call';
  document.addEventListener('pointerdown', e => {
    if (reduceMotion()) return;
    const host = e.target.closest && e.target.closest(sel);
    if (!host) return;
    host.classList.add('rippling');
    const r = host.getBoundingClientRect();
    const size = Math.max(r.width, r.height);
    const span = document.createElement('span');
    span.className = 'ripple';
    span.style.width = span.style.height = size + 'px';
    span.style.left = (e.clientX - r.left - size / 2) + 'px';
    span.style.top = (e.clientY - r.top - size / 2) + 'px';
    host.appendChild(span);
    setTimeout(() => span.remove(), 600);
  }, { passive: true });
}
function hideSplash() {
  const sp = $('#splash'); if (!sp) return;
  setTimeout(() => { sp.classList.add('hide'); setTimeout(() => sp.remove(), 600); }, 750);
}

// ---------- Init ----------
function init() {
  initTheme();

  // tabs
  $$('.tab').forEach(t => t.addEventListener('click', () => goTab(t.dataset.tab)));
  // app bar buttons
  $('#themeBtn').addEventListener('click', () => { setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); });
  $('#settingsBtn').addEventListener('click', openSettings);
  $('#locBtn').addEventListener('click', () => requestLocation(false));
  $('#searchBtn').addEventListener('click', openSearch);
  $('#searchClose').addEventListener('click', closeSheets);
  $('#searchInput').addEventListener('input', e => renderSearch(e.target.value));
  // sheets
  $('#scrim').addEventListener('click', closeSheets);
  $('#sheetClose').addEventListener('click', closeSheets);
  $('#settingsClose').addEventListener('click', closeSheets);
  // route segments
  $$('#routeSeg .chip').forEach(c => c.addEventListener('click', () => setRouteSeg(c.dataset.seg)));

  // initial day = today (if in range) else day 1
  const todayEntry = dayByDate[ymd(new Date())];
  selectedDay = todayEntry ? todayEntry.index : 0;

  // build static-ish pages
  renderToday();
  renderDayPicker(); renderDayDetail(selectedDay);
  buildRoutePages();
  buildWeatherPicker();
  buildGiftPicker(); renderGifts();
  renderWeatherHero();
  renderWeatherCity(wxCity, $('#wxRoot'));

  // gemini with control API
  geminiCtl = initGemini({
    status, goTab, openDay, showOnMap, goWeather, goSouvenirs,
    openMaps: url => window.open(url, '_blank', 'noopener'),
  });

  // toolkit (錦囊) + motion
  initToolkit({ showOnMap });
  initRipples();
  hideSplash();

  // clock — refresh Today every minute
  setInterval(() => { if (currentTab === 'today') renderToday(); if (currentTab === 'weather') renderWeatherHero(); }, 60000);

  // service worker (offline / installable)
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

document.addEventListener('DOMContentLoaded', init);
