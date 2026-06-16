// ============================================================================
// main.js — app orchestrator: tabs, theme, time/location-aware Today,
// itinerary, routes, weather, souvenirs, settings, Gemini control API.
// ============================================================================
import { TRIP, DAYS, CITIES, cityByKey, dayByDate, ROUTES, PASS, SOUVENIRS, TYPE_META, TIDE, allPois, BUDGET, admissionTotal, PACKING, EMERGENCY, setTrip, currentModel, kyushuModel, blankModel } from './data.js';
import {
  el, clear, icon, $, $$, toast, pad2, ymd, parseHM, nowMinutes,
  haversineKm, fmtDistance, gmapPlace, gmapDir, gmapHotels, bookingHotels, DOW_TC, favs, store, downloadText,
} from './util.js';
import { renderWeatherCity, getCurrentSummary, clothingAdvice } from './weather.js';
import { initMap, refreshMap, refreshMapSize, focusPlace, jrSchematicHTML, renderDayMiniMap } from './map.js';
import { initGemini, getCfg, generateTripPlan } from './gemini.js';
import { initToolkit, closeToolkit } from './toolkit.js';
import { initFirebase, fb, signInGoogle, signOutUser, pullUserData, pushUserData, shareSave, shareGet } from './firebase.js';
import * as Notify from './notify.js';

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
  moveTabIndicator(tab);
  animateIn(tab);
  window.scrollTo({ top: 0 });
}

// staggered entrance of a page's content blocks
function animateIn(tab) {
  if (reduceMotion()) return;
  const sec = $('#page-' + tab); if (!sec) return;
  const set = new Set();
  sec.querySelectorAll(':scope > *').forEach(n => set.add(n));
  sec.querySelectorAll('#todayRoot > *, #dayDetail > *, #wxRoot > *, #wxTodayHero > *, #giftRoot > *, #routeTripsWrap > *, #routePassWrap > *').forEach(n => set.add(n));
  ['todayRoot', 'dayDetail', 'wxRoot', 'giftRoot', 'wxTodayHero'].forEach(id => { const e = document.getElementById(id); if (e) set.delete(e); });
  let i = 0;
  set.forEach(b => {
    b.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }],
      { duration: 400, delay: Math.min(i, 9) * 42, easing: 'cubic-bezier(.2,.85,.25,1)', fill: 'backwards' });
    i++;
  });
}

// sliding active-tab indicator
function moveTabIndicator(tab) {
  const bar = $('#tabbar'), ind = $('#tabind'); if (!bar || !ind) return;
  const btn = bar.querySelector(`.tab[data-tab="${tab}"]`); if (!btn) return;
  const w = Math.max(20, btn.offsetWidth * 0.4);
  ind.style.width = w + 'px';
  ind.style.transform = `translateX(${btn.offsetLeft + (btn.offsetWidth - w) / 2}px)`;
}

// ease-out count-up for numbers (timer-based for reliability)
function countUp(node, to, dur = 850) {
  if (reduceMotion()) { node.textContent = to + '%'; return; }
  const steps = Math.max(1, Math.round(dur / 30)); let i = 0;
  const t = setInterval(() => {
    i++; const p = i / steps;
    node.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))) + '%';
    if (i >= steps) { node.textContent = to + '%'; clearInterval(t); }
  }, 30);
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
  if (!DAYS.length) return { localTime: `${pad2(new Date().getHours())}:${pad2(new Date().getMinutes())}`, date: ymd(new Date()), phase: '尚未規劃', today: null, current: '這份行程還沒有內容', next: '用 plan_trip 幫使用者規劃', location: lastPos ? '已定位' : '未授權定位', distanceToNext: '—' };
  const s = computeNow();
  let distance = null;
  if (lastPos && s.next && s.next.lat) distance = fmtDistance(haversineKm(lastPos, { lat: s.next.lat, lng: s.next.lng }));
  return {
    localTime: `${pad2(s.now.getHours())}:${pad2(s.now.getMinutes())}`,
    date: s.ds, phase: s.phase === 'before' ? '行程開始前' : s.phase === 'after' ? '行程已結束' : '行程進行中',
    today: { day: s.dayIndex + 1, city: (cityByKey[s.day.cityKey] || {}).name || '', title: s.day.title },
    current: s.current ? `${s.current.time} ${s.current.title}` : (s.phase === 'before' ? '行程尚未開始' : '今日行程已結束'),
    next: s.next ? `${s.next.time} ${s.next.title}` : '今日已無安排',
    location: lastPos ? '已定位' : '未授權定位',
    distanceToNext: distance || '—',
  };
}

// Empty-state card for a blank trip (no days yet)
function emptyTripCard() {
  return el('.card.card--pad', { style: { marginTop: '16px', textAlign: 'center' } }, [
    el('.empty__emoji', { text: '🧭' }),
    el('.h-card', { text: '這份行程還沒有內容' }),
    el('p', { class: 'muted', style: { marginTop: '6px', lineHeight: '1.7' }, text: '到「AI 旅伴」說出你的目的地與日期（例如「幫我排 5 天的京都」），我就會自動幫你規劃整趟行程。' }),
    el('button.btn.btn--brand.btn--block', { style: { marginTop: '14px' }, onclick: () => goTab('ai') }, [icon('i-ai'), '用 AI 規劃這趟行程']),
  ]);
}
// ---------- Today page ----------
function renderToday() {
  const root = $('#todayRoot'); if (!root) return; clear(root);
  if (!DAYS.length) {
    root.appendChild(el('.hero', {}, [
      el('.hero__eyebrow', { text: 'PLAN AI' }),
      el('.hero__title', { text: TRIP.title || '新行程' }),
      el('.hero__meta', {}, [el('span', {}, [icon('i-ai'), ' 等你來規劃'])]),
    ]));
    root.appendChild(emptyTripCard());
    return;
  }
  const s = computeNow();
  const city = cityByKey[s.day.weatherKey] || cityByKey[s.day.cityKey] || CITIES[0];

  // Hero
  root.appendChild(el('.hero', {}, [
    el('.hero__eyebrow', { text: (TRIP.country || 'PLAN AI').toString().toUpperCase().slice(0, 24) }),
    el('.hero__title', { text: TRIP.title }),
    el('.hero__meta', {}, [
      el('span', {}, [icon('i-plan'), ` ${TRIP.start.slice(5)} – ${TRIP.end.slice(5)}`]),
      TRIP.base ? el('span', {}, [icon('i-train'), ' ' + TRIP.base]) : null,
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
        el('.nowcard__next', {}, [el('span', { html: `首日：<b>${DAYS[0].title}</b>${DAYS[0].items[0] ? ` — ${DAYS[0].items[0].time} ${DAYS[0].items[0].title}` : ''}` })]),
      ]),
    ]));
  } else if (s.phase === 'after') {
    root.appendChild(el('.card.card--pad', { style: { marginTop: '16px', textAlign: 'center' } }, [
      el('.empty__emoji', { text: '🎉' }),
      el('.h-card', { text: '旅程圓滿結束！' }),
      el('p', { class: 'muted', style: { marginTop: '6px' }, text: '這趟旅程辛苦了，期待下次再出發。' }),
    ]));
  } else {
    const cur = s.current, nxt = s.next;
    const body = [
      el('.nowcard__label', {}, [el('span', { class: 'livedot' }), `現在 · Day ${s.dayIndex + 1} · ${(cityByKey[s.day.cityKey] || {}).name || ''}`]),
      el('.nowcard__title', { text: cur ? cur.title : '準備出發' }),
      el('.nowcard__time', {}, [icon('i-today'), ` ${status().localTime}${cur ? ' · ' + cur.time + ' 開始' : ''}`]),
    ];
    if (nxt) {
      const distTxt = lastPos && nxt.lat ? ` · ${fmtDistance(haversineKm(lastPos, { lat: nxt.lat, lng: nxt.lng }))}` : '';
      body.push(el('.nowcard__next', {}, [
        el('div', { html: `接下來 <b>${nxt.time}</b>：<b>${nxt.title}</b>${distTxt}` }),
        nxt.lat ? el('a.btn.btn--brand.btn--sm', {
          href: lastPos ? gmapDir(`${lastPos.lat},${lastPos.lng}`, `${nxt.lat},${nxt.lng}`, 'transit') : gmapPlace(nxt.title, nxt.lat, nxt.lng),
          target: '_blank', rel: 'noopener', style: { marginTop: '12px' },
        }, [icon('i-pin'), '導航前往']) : null,
      ]));
    } else {
      body.push(el('.nowcard__next', {}, [el('div', { text: '今日行程已完成，好好休息 🛏️' })]));
    }
    root.appendChild(el('.nowcard', { style: { marginTop: '16px' } }, [el('.nowcard__bg'), el('.nowcard__body', {}, body)]));
    if (s.day.items.filter(x => x.type !== 'stay').length) root.appendChild(renderCommandCard(s));
  }

  // Weather snapshot
  if (city) {
    const wxCard = el('.card.card--pad.card--tap', { style: { marginTop: '14px' }, onclick: () => goWeather(city.key) }, [
      el('.row-between', {}, [
        el('.row', {}, [el('div', { style: { fontSize: '15px', fontWeight: '650' }, text: `${city.flag || '📍'} ${city.name} 天氣` })]),
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
  }

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
  const ringFill = el('.ring__fill');
  const pctNode = el('.ring__pct', { text: '0%' });
  const progFill = el('.dayprog__fill', { style: { width: '0%' } });
  setTimeout(() => {
    ringFill.style.setProperty('--pct', String(pct * 3.6));
    progFill.style.width = pct + '%';
    countUp(pctNode, pct, 900);
  }, 40);
  return el('.card.card--pad', { style: { marginTop: '14px' } }, [
    el('.cmd', {}, [
      el('.ring', {}, [ringFill, el('.ring__hole', {}, [pctNode, el('.ring__lbl', { text: '今日進度' })])]),
      el('div', { style: { minWidth: '0' } }, [
        el('.cmd__next-lbl', { text: nxt ? '下一步' : '狀態' }),
        el('.cmd__next-title', { text: nxt ? `${nxt.time} ${nxt.title}` : '今日完成 🛏️' }),
        nxt ? el('.cmd__count', {}, [icon('i-today'), countTxt]) : el('.tiny.muted', { style: { marginTop: '4px' }, text: '好好休息，明天見！' }),
        nxt && nxt.lat ? el('a.btn.btn--brand.btn--sm', { href: lastPos ? gmapDir(`${lastPos.lat},${lastPos.lng}`, `${nxt.lat},${nxt.lng}`, 'transit') : gmapPlace(nxt.title, nxt.lat, nxt.lng), target: '_blank', rel: 'noopener', style: { marginTop: '10px' } }, [icon('i-pin'), '導航前往']) : null,
      ]),
    ]),
    el('.dayprog', {}, [progFill]),
  ]);
}

// ---------- Editable plan (per-plan FULL trip model; AI- & hand-editable) ------
// Each plan persists its OWN trip model (kp_state:{id}.model = trip+cities+days+
// routes+pass+budget…), so any country works. Personal extras (favs/checklist/
// bookings/expenses) ride alongside in .extras. The Kyushu data is just a template.
let planCustomized = false;
let editMode = false;
let currentBase = null;       // original model of the current plan (for reset)
const EXTRA_KEYS = ['kp_favs', 'kp_packing', 'kp_bookings', 'kp_expenses', 'kp_budgetcfg', 'kp_rate'];
const cloneModel = m => (typeof structuredClone === 'function' ? structuredClone(m) : JSON.parse(JSON.stringify(m)));

function savePlan() { planCustomized = true; }   // persistence happens via snapshotCurrent() (full model)
function readExtras() { const e = {}; EXTRA_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v != null) e[k] = v; }); return e; }
function applyExtras(extras) { EXTRA_KEYS.forEach(k => { try { if (extras && extras[k] != null) localStorage.setItem(k, extras[k]); else localStorage.removeItem(k); } catch {} }); }

// migrate a legacy v2 plan blob (Kyushu items-only) into a full model
function legacyToModel(st) {
  const m = kyushuModel();
  const raw = st && st.data && st.data.kp_plan;
  if (raw) { try { const p = JSON.parse(raw); if (p && Array.isArray(p.days)) m.days.forEach((d, i) => { if (p.days[i]) d.items = (p.days[i].items || p.days[i]); }); } catch {} }
  return m;
}
function exportAll() { return { v: 3, ts: Date.now(), title: TRIP.title, model: cloneModel(currentModel()), extras: readExtras() }; }
// Resolve a plan's stored model WITHOUT disturbing the live trip (for export/share).
function planModelFor(id) {
  if (id === currentPlanId) snapshotCurrent();
  const st = store.get('kp_state:' + id, null);
  if (st && st.v === 3 && st.model) return st.model;
  if (st && st.v === 2) return legacyToModel(st);
  return cloneModel(currentModel());
}
function clampDay(day) { const i = (parseInt(day, 10) || 0) - 1; return (i >= 0 && i < DAYS.length) ? i : -1; }
function findItem(i, title) {
  const items = DAYS[i].items, t = (title || '').trim();
  let idx = items.findIndex(x => x.title === t);
  if (idx < 0) idx = items.findIndex(x => x.title.includes(t) || (t && t.includes(x.title)));
  return idx;
}
function sortDay(i) { DAYS[i].items.sort((a, b) => parseHM(a.time) - parseHM(b.time)); }
function finishEdit(i) { sortDay(i); savePlan(); selectDay(i); if (currentTab !== 'plan') goTab('plan'); if (currentTab === 'today') renderToday(); snapshotCurrent(); scheduleCloudPush(); }

function planAdd({ day, time, title, type = 'see', desc = '', lat, lng }) {
  const i = clampDay(day); if (i < 0) return { ok: false, msg: `天數需為 1–${DAYS.length}` };
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return { ok: false, msg: '時間格式需為 HH:MM' };
  if (!title) return { ok: false, msg: '缺少活動名稱' };
  DAYS[i].items.push({ time, type, title, desc, ...(lat != null && lng != null ? { lat: +lat, lng: +lng } : {}), _user: true });
  finishEdit(i); return { ok: true, msg: `已新增「${title}」到第 ${i + 1} 天 ${time}` };
}
function planRemove({ day, title }) {
  const i = clampDay(day); if (i < 0) return { ok: false, msg: `天數需為 1–${DAYS.length}` };
  const idx = findItem(i, title); if (idx < 0) return { ok: false, msg: `第 ${i + 1} 天找不到「${title}」` };
  const removed = DAYS[i].items.splice(idx, 1)[0];
  finishEdit(i); return { ok: true, msg: `已刪除「${removed.title}」` };
}
function planUpdate({ day, title, newTime, newTitle, desc }) {
  const i = clampDay(day); if (i < 0) return { ok: false, msg: `天數需為 1–${DAYS.length}` };
  const idx = findItem(i, title); if (idx < 0) return { ok: false, msg: `找不到「${title}」` };
  const it = DAYS[i].items[idx];
  if (newTime && /^\d{1,2}:\d{2}$/.test(newTime)) it.time = newTime;
  if (newTitle) it.title = newTitle;
  if (desc != null) it.desc = desc;
  it._user = true; finishEdit(i); return { ok: true, msg: `已更新「${it.title}」` };
}
function planMove({ day, title, toDay, time }) {
  const i = clampDay(day), j = clampDay(toDay); if (i < 0 || j < 0) return { ok: false, msg: `天數需為 1–${DAYS.length}` };
  const idx = findItem(i, title); if (idx < 0) return { ok: false, msg: `找不到「${title}」` };
  const it = DAYS[i].items.splice(idx, 1)[0];
  if (time && /^\d{1,2}:\d{2}$/.test(time)) it.time = time;
  it._user = true; DAYS[j].items.push(it); sortDay(i);
  finishEdit(j); return { ok: true, msg: `已將「${it.title}」移到第 ${j + 1} 天${time ? ' ' + time : ''}` };
}
function planReset() {
  if (!currentBase) return { ok: false, msg: '無原始行程可還原' };
  setTrip(cloneModel(currentBase));
  planCustomized = false;
  renderActivePlan();
  snapshotCurrent(); scheduleCloudPush();
  return { ok: true, msg: '已還原為原始行程' };
}

// add/edit a single activity via a form sheet
function openPlanForm(dayIdx, item) {
  const isEdit = !!item;
  $('#sheetTitle').textContent = isEdit ? '編輯活動' : '新增活動';
  const body = clear($('#sheetBody'));
  const mk = (label, node) => body.appendChild(el('.bk-field', {}, [el('label', { text: label }), node]));
  const inputStyle = { width: '100%', padding: '11px 13px', borderRadius: '12px', border: '1px solid var(--line-strong)', background: 'var(--surface)', fontSize: '15px' };
  const timeIn = el('input', { type: 'time', value: item ? item.time : '12:00', style: inputStyle });
  const titleIn = el('input', { type: 'text', value: item ? item.title : '', placeholder: '例：金閣寺', style: inputStyle });
  const typeSel = el('select', { style: inputStyle });
  [['see', '景點'], ['eat', '美食'], ['shop', '購物'], ['move', '交通'], ['stay', '住宿']].forEach(([v, l]) => typeSel.appendChild(el('option', { value: v, ...(item && item.type === v ? { selected: 'selected' } : {}) }, l)));
  const descIn = el('textarea', { rows: 3, placeholder: '備註（選填）', style: inputStyle }); descIn.value = item ? (item.desc || '') : '';
  mk('時間', timeIn); mk('活動名稱', titleIn); mk('類型', typeSel); mk('備註', descIn);
  body.appendChild(el('button.btn.btn--brand.btn--block', { style: { marginTop: '6px' }, onclick: () => {
    const time = timeIn.value, title = titleIn.value.trim();
    if (!title) { toast('請輸入活動名稱'); return; }
    const r = isEdit
      ? planUpdate({ day: dayIdx + 1, title: item.title, newTime: time, newTitle: title, desc: descIn.value.trim() })
      : planAdd({ day: dayIdx + 1, time, title, type: typeSel.value, desc: descIn.value.trim() });
    if (item && isEdit && item.type !== typeSel.value) { const k = findItem(dayIdx, title); if (k >= 0) { DAYS[dayIdx].items[k].type = typeSel.value; savePlan(); selectDay(dayIdx); } }
    closeSheets(); toast(r.msg);
  } }, [isEdit ? '儲存' : '新增活動']));
  if (isEdit) body.appendChild(el('button.btn.btn--block', { style: { marginTop: '8px', color: 'var(--sakura)' }, onclick: () => { const r = planRemove({ day: dayIdx + 1, title: item.title }); closeSheets(); toast(r.msg); } }, ['刪除此活動']));
  openSheet('sheet');
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
      el('.daypill__city', { text: ((cityByKey[d.cityKey] || {}).name || '').split(' ')[0] }),
    ]));
  });
}
function selectDay(i) { selectedDay = i; renderDayPicker(); renderDayDetail(i); }
function openDay(n) { goTab('plan'); selectDay(Math.max(0, Math.min(DAYS.length - 1, n - 1))); }

function renderDayDetail(i) {
  const root = $('#dayDetail'); clear(root);
  if (!DAYS.length || !DAYS[i]) { root.appendChild(emptyTripCard()); return; }
  const d = DAYS[i], c = cityByKey[d.cityKey] || { name: '', color: '#2563eb', flag: '📍' };
  const s = computeNow();
  const isToday = s.phase === 'during' && s.dayIndex === i;

  root.appendChild(el('.card.card--pad', {}, [
    el('.row-between', {}, [
      el('div', {}, [el('.h-card', { text: d.title }), el('.tiny.muted', { style: { marginTop: '2px' }, text: `${d.date}（週${d.dow}）· ${c.name}` })]),
      el('span.chip', { style: { background: c.color || '#2563eb', color: '#fff', borderColor: 'transparent' }, text: (c.flag || '📍') + ' ' + (c.name || '').split(' ')[0] }),
    ]),
    el('p', { class: 'muted tiny', style: { marginTop: '10px' }, text: d.summary }),
    el('.row.wrap', { style: { marginTop: '10px', gap: '8px' } }, [
      el('button.gmap-btn', { onclick: () => goWeather(d.weatherKey) }, [icon('i-weather'), '當地天氣']),
      el('button.gmap-btn', { onclick: () => { showOnMap(d.items.find(x => x.lat)?.title || c.name); } }, [icon('i-pin'), '地圖']),
      el('button.gmap-btn', { style: editMode ? { borderColor: 'var(--brand-2)', color: 'var(--brand-2)' } : {}, onclick: () => { editMode = !editMode; renderDayDetail(i); } }, [icon('i-plan'), editMode ? '完成編輯' : '編輯行程']),
    ]),
  ]));

  // Miyajima tide card (on the day that visits 宮島) — Kyushu template only
  if (TIDE && TIDE.days && TIDE.days[d.date] && d.items.some(it => /宮島|嚴島|大鳥居/.test(it.title))) root.appendChild(renderTideCard(d.date));

  // Per-day mini map
  curDayPts = d.items.filter(it => it.lat && it.type !== 'move' && it.type !== 'stay').map(it => ({ name: it.title, lat: it.lat, lng: it.lng }));
  if (curDayPts.length) {
    root.appendChild(el('.h-section', { style: { margin: '18px 2px 8px' }, text: '當日地圖 · 依序' }));
    root.appendChild(el('div', { id: 'dayMiniMap' }));
    renderDayMiniMap('dayMiniMap', curDayPts);
  }

  const tl = el('.timeline', { style: { marginTop: '14px' } });
  tl.appendChild(el('.tl-rail'));
  d.items.forEach(it => tl.appendChild(renderItem(it, isToday && s.current === it, i)));
  root.appendChild(tl);

  if (editMode) root.appendChild(el('button.btn.btn--brand.btn--block', { style: { marginTop: '4px' }, onclick: () => openPlanForm(i, null) }, ['＋ 新增活動到本日']));

  root.appendChild(el('p', { class: 'tiny muted-3', style: { margin: '14px 4px 0' }, text: editMode ? '✏️ 編輯模式：可新增/編輯/刪除活動；改時間會自動重新排序。也可在「AI」分頁直接叫旅伴幫你調整。' : '※ 車次與時刻為參考值，實際請以各路線的 Google 班次/JR 官方即時資訊為準。' }));
}

function renderItem(it, isNow, dayIdx) {
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
  if (editMode && dayIdx != null) {
    foot.appendChild(el('button.gmap-btn', { style: { padding: '4px 10px', fontSize: '11px' }, onclick: e => { e.stopPropagation(); openPlanForm(dayIdx, it); } }, ['✎ 編輯']));
    foot.appendChild(el('button.gmap-btn', { style: { padding: '4px 10px', fontSize: '11px', borderColor: 'var(--sakura)', color: 'var(--sakura)' }, onclick: e => { e.stopPropagation(); const r = planRemove({ day: dayIdx + 1, title: it.title }); toast(r.msg); } }, ['✕ 刪除']));
  }
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
function ensureMap() { if (mapReady) return; mapReady = true; initMap(goWeather); try { refreshMap({ rail: isKyushuPlan() }); } catch {} }
function setRouteSeg(seg) {
  $$('#routeSeg .chip').forEach(c => c.classList.toggle('is-on', c.dataset.seg === seg));
  const map = { map: 'routeMapWrap', lines: 'routeLinesWrap', trips: 'routeTripsWrap', pass: 'routePassWrap' };
  Object.entries(map).forEach(([s, id]) => { const w = $('#' + id); if (w) w.hidden = s !== seg; });
  if (seg === 'map') { ensureMap(); refreshMapSize(); }
}
function closuresCard() {
  return el('.card.card--pad', { style: { marginTop: '14px' } }, [
    el('.row-between', {}, [
      el('.h-section', { text: '⚠️ 即時封閉・維修・警示' }),
      el('span.chip', { style: { background: 'var(--surface-2)', color: 'var(--text-3)' }, text: 'COMING SOON' }),
    ]),
    el('p', { class: 'tiny muted-3', style: { marginTop: '8px', lineHeight: '1.7' }, text: '即將推出：自動標示因整修、天災或意外而暫停開放的景點與路段，規劃時主動提醒你避開、改道。' }),
    el('p', { class: 'tiny muted-3', style: { marginTop: '6px', lineHeight: '1.7' }, text: '💡 現在就可在「AI 旅伴」直接問，例如「○○ 最近有沒有整修或暫停開放？」，AI 會用網路即時查詢。' }),
  ]);
}
function buildRoutePages() {
  // legend for map
  const legend = $('#mapLegend'); clear(legend);
  CITIES.forEach(c => legend.appendChild(el('span', {}, [el('span', { class: 'legend-dot', style: { background: c.color || '#2563eb' } }), c.name])));

  // lines (schematic) — Kyushu template only; other trips get an overview + closures
  const lw = $('#routeLinesWrap'); clear(lw);
  if (isKyushuPlan()) {
    lw.appendChild(el('.h-section', { style: { margin: '0 2px 10px' }, text: 'JR 路線示意圖' }));
    lw.appendChild(el('.card.card--pad', { style: { overflowX: 'auto' } }, [el('div', { html: jrSchematicHTML() })]));
    lw.appendChild(el('p', { class: 'tiny muted-3', style: { marginTop: '10px' }, text: '本圖為示意；確切月台與班次請見「所有班次」分頁的 Google 即時連結。' }));
  } else {
    lw.appendChild(el('.h-section', { style: { margin: '0 2px 10px' }, text: '路線概覽' }));
    lw.appendChild(el('.card.card--pad', {}, [el('p', { class: 'muted', style: { fontSize: '14px', lineHeight: '1.7' }, text: '在「全圖」可看到這趟所有城市與順序；各段交通請見「所有班次」，或讓 AI 旅伴幫你規劃。' })]));
  }
  lw.appendChild(closuresCard());

  // trips
  const tw = $('#routeTripsWrap'); clear(tw);
  tw.appendChild(el('.h-section', { style: { margin: '0 2px 10px' }, text: '所有跨城班次 · 可直接 Google 導航' }));
  if (ROUTES.length) tw.appendChild(el('.stack', { style: { gap: '12px' } }, ROUTES.map(r => el('.card.card--pad', {}, [routeBlock(r)]))));
  else tw.appendChild(el('.card.card--pad', {}, [el('p', { class: 'muted', style: { fontSize: '14px', lineHeight: '1.7' }, text: '尚未設定跨城交通。開啟下方「AI 旅伴」說出你的起訖點與日期，我可以幫你規劃班次與導航。' })]));

  // pass
  const pw = $('#routePassWrap'); clear(pw);
  if (PASS && PASS.best) {
    pw.appendChild(el('.card', {}, [
      el('.hero', { style: { borderRadius: '0' } }, [
        el('.hero__eyebrow', { text: 'RECOMMENDED PASS' }),
        el('.hero__title', { style: { fontSize: '20px' }, text: PASS.best }),
        el('.hero__meta', {}, [el('span', {}, [icon('i-ticket'), ' ' + (PASS.price || '')]), el('span', {}, [icon('i-today'), ' ' + (PASS.days || '')])]),
      ]),
      el('.card--pad', {}, [
        PASS.why ? el('p', { class: 'muted', style: { fontSize: '14px' }, text: PASS.why }) : null,
        el('.stack', { style: { gap: '6px', marginTop: '12px' } }, (PASS.highlights || []).map(h => el('div', { style: { fontSize: '13.5px' }, text: h }))),
        PASS.compare ? el('.divider') : null,
        PASS.compare ? el('.h-section', { text: '票券比較' }) : null,
        PASS.compare ? el('.card', { style: { overflowX: 'auto', marginTop: '8px' } }, [passTable()]) : null,
        PASS.buy ? el('.divider') : null,
        PASS.buy ? el('.h-section', { text: '如何購買與劃位' }) : null,
        PASS.buy ? el('p', { class: 'muted tiny', style: { marginTop: '6px', lineHeight: '1.6' }, text: PASS.buy }) : null,
      ]),
    ]));
  } else {
    pw.appendChild(el('.card.card--pad', {}, [
      el('.h-section', { text: '交通票券' }),
      el('p', { class: 'muted', style: { fontSize: '14px', marginTop: '6px', lineHeight: '1.7' }, text: '此行程尚未建議票券。問 AI 旅伴「這趟有沒有適合的交通票券或鐵路 pass？」即可取得建議。' }),
    ]));
  }
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
  if (!DAYS.length || !CITIES.length) { clear(host); host.appendChild(el('.card.card--pad', {}, [el('.muted', { style: { fontSize: '14px', lineHeight: '1.7' }, text: '尚未規劃行程，沒有可顯示的城市天氣。先到「AI 旅伴」建立行程吧。' })])); return; }
  const s = computeNow();
  const city = cityByKey[s.day.weatherKey] || cityByKey[s.day.cityKey] || CITIES[0];
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
function buildGiftPicker() {
  const p = $('#giftCityPick'); clear(p);
  const keys = Object.keys(SOUVENIRS);
  if (!keys.length) return;
  if (!keys.includes(giftCity)) giftCity = keys[0];
  keys.forEach(k => { const c = cityByKey[k] || { flag: '🎁', name: k }; p.appendChild(el('.chip.chip--tap' + (k === giftCity ? '.is-on' : ''), { onclick: () => goSouvenirs(k) }, [(c.flag || '🎁') + ' ' + (c.name || k).split(' ')[0]])); });
}
function renderGifts() {
  const root = $('#giftRoot'); clear(root);
  const keys = Object.keys(SOUVENIRS);
  if (!keys.length) {
    root.appendChild(el('.card.card--pad', { style: { textAlign: 'center' } }, [
      el('.empty__emoji', { text: '🎁' }),
      el('.h-card', { text: '尚無伴手禮建議' }),
      el('p', { class: 'muted', style: { marginTop: '6px', lineHeight: '1.7' }, text: '問 AI 旅伴「這趟有什麼必買伴手禮？」即可取得各地推薦。' }),
      el('button.btn.btn--brand.btn--block', { style: { marginTop: '12px' }, onclick: () => goTab('ai') }, [icon('i-ai'), '問 AI 推薦伴手禮']),
    ]));
    return;
  }
  if (!keys.includes(giftCity)) giftCity = keys[0];
  const c = cityByKey[giftCity] || { flag: '🎁', name: giftCity, color: '#2563eb', blurb: '' };
  const list = SOUVENIRS[giftCity] || [];
  root.appendChild(el('.card.card--pad', { style: { marginBottom: '12px', background: 'linear-gradient(135deg,' + (c.color || '#2563eb') + '22, transparent)' } }, [
    el('.h-card', { text: `${c.flag || '🎁'} ${c.name} 必買` }),
    el('.tiny.muted', { style: { marginTop: '2px' }, text: c.blurb || '' }),
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

  // Itinerary edit + cloud sync
  body.appendChild(el('.divider'));
  body.appendChild(el('.h-section', { text: '行程 · 編輯與同步' }));
  body.appendChild(el('p', { class: 'tiny muted', style: { margin: '8px 0 10px', lineHeight: '1.6' }, text: (planCustomized ? '你已自訂行程（自動存在本機）。' : '行程可手動或由 AI 調整，變更自動存在本機。') + ' 在「行程」分頁點「編輯行程」可增刪改；或到「AI」分頁叫旅伴幫你改。' }));
  body.appendChild(el('button.btn.btn--block', { onclick: () => { const r = planReset(); toast(r.msg); closeSheets(); } }, ['↩︎ 還原原始行程']));
  body.appendChild(el('p', { class: 'tiny muted-3', style: { marginTop: '10px', lineHeight: '1.6' }, text: fb.user ? '已登入，行程會自動同步到你的帳號。' : '登入（在「計劃」頁）後行程會自動雲端同步；未登入則存在本機，並可用每個計劃的「分享」按鈕分享。' }));

  // Install
  if (!pwaState().standalone) {
    body.appendChild(el('.divider'));
    body.appendChild(el('.h-section', { text: '安裝' }));
    body.appendChild(el('p', { class: 'tiny muted', style: { margin: '8px 0 10px', lineHeight: '1.6' }, text: '加到主畫面即可像 App 一樣全螢幕開啟、離線使用、收提醒。' }));
    body.appendChild(el('button.btn.btn--block', { onclick: openInstallGuide }, [icon('i-install'), '加入主畫面教學']));
  }

  // Notifications
  body.appendChild(el('.divider'));
  body.appendChild(el('.h-section', { text: '通知' }));
  renderNotifySettings(body);

  // About
  body.appendChild(el('.divider'));
  body.appendChild(el('.h-section', { text: '關於' }));
  body.appendChild(el('p', { class: 'tiny muted-3', style: { marginTop: '8px', lineHeight: '1.7' }, html: '九州・本州・四國 JR 自由行規劃 · 2026/06/17–06/24。<br>天氣：Open-Meteo（免金鑰）。地圖：Leaflet + OpenStreetMap/CARTO。導航：Google Maps 深連結。<br>⚠️ 班次與票價為參考值（依官方資料整理），請以即時 Google Maps / JR 官方為準。' }));
  openSheet('settingsSheet');
}
function inputStyle() { return { width: '100%', padding: '11px 13px', borderRadius: '12px', border: '1px solid var(--line-strong)', background: 'var(--surface)', fontSize: '14px', marginTop: '4px' }; }

function toggleSwitch(on, handler) {
  const s = el('button.switch' + (on ? '.is-on' : ''), { role: 'switch', 'aria-checked': on });
  s.addEventListener('click', () => { const now = !s.classList.contains('is-on'); s.classList.toggle('is-on', now); s.setAttribute('aria-checked', now); handler(now); });
  return s;
}
function renderNotifySettings(body) {
  if (!Notify.supported()) { body.appendChild(el('p', { class: 'tiny muted-3', style: { marginTop: '8px' }, text: '此瀏覽器不支援通知。' })); return; }
  const perm = Notify.permission(), c = Notify.cfg(), on = c.enabled && perm === 'granted';
  body.appendChild(el('p', { class: 'tiny muted', style: { margin: '8px 0 8px', lineHeight: '1.6' }, text: '行程進行中可收到「準備出發 / 下一個行程 / 車次」本地提醒（App 開著時）。共享聊天與 AI 完成的遠端推播需登入後生效。' }));
  body.appendChild(el('.row-between', { style: { padding: '6px 0' } }, [
    el('div', {}, [el('b', { text: '啟用通知' }), el('.tiny.muted-3', { text: perm === 'denied' ? '已被瀏覽器封鎖，請到網站設定解除' : (on ? '已開啟' : '關閉') })]),
    toggleSwitch(on, async v => { if (v) await Notify.requestEnable(); else Notify.disable(); scheduleCloudPush(); openSettings(); }),
  ]));
  Notify.TYPES.forEach(([k, emoji, label, desc]) => {
    body.appendChild(el('.row-between', { style: { padding: '8px 0', opacity: on ? '1' : '.45' } }, [
      el('div', { style: { minWidth: '0' } }, [el('div', { style: { fontWeight: '600', fontSize: '14px' }, text: `${emoji} ${label}` }), el('.tiny.muted-3', { text: desc })]),
      toggleSwitch(!!c.types[k], v => { Notify.setType(k, v); scheduleCloudPush(); }),
    ]));
  });
  // Status panel — distinguishes local reminders (work offline) from server push (needs cloud setup)
  const ps = Notify.pushStatus();
  const pushTxt = !fb.configured ? '需雲端設定（Firebase）' : !fb.user ? '需登入後才會啟用' : (ps === 'ok' ? '已啟用 ✓' : ps === 'unavailable' ? '⚠ 需在 Google Cloud 啟用 FCM 與 Installations API' : ps === 'pending' ? '設定中…' : '尚未啟用');
  body.appendChild(el('.notify-status', { style: { marginTop: '12px', padding: '12px 14px', borderRadius: '12px', background: 'var(--surface-2)', fontSize: '13px', lineHeight: '1.7' } }, [
    el('div', {}, [el('b', { text: '本機提醒（App 開著時）：' }), el('span', { text: on ? '已啟用 ✓' : '關閉' })]),
    el('div', {}, [el('b', { text: '伺服器推播（App 關閉時）：' }), el('span', { text: pushTxt })]),
    el('.tiny.muted-3', { style: { marginTop: '4px' }, text: '行程提醒在 App／PWA 開著時即可運作，不需登入。App 完全關閉時的推播需登入並完成雲端設定。' }),
  ]));
  body.appendChild(el('button.btn.btn--block', { style: { marginTop: '10px' }, onclick: () => { if (!on) { toast('請先啟用通知'); return; } Notify.notify('reminder', '🔔 測試通知', '通知運作正常！'); } }, ['發送測試通知']));
}
function maybeNotifyIntro() {
  if (Notify.asked() || !Notify.supported()) return;
  setTimeout(() => {
    if (Notify.asked()) return;
    $('#sheetTitle').textContent = '開啟旅程通知？';
    const b = clear($('#sheetBody'));
    b.appendChild(el('p', { style: { fontSize: '14.5px', lineHeight: '1.7' }, text: '這個 App 可在旅途中提醒你：準備出發、下一個行程、搭車時間，以及（登入後）共享聊天與 AI 完成行程的通知。' }));
    b.appendChild(el('p', { class: 'tiny muted-3', style: { marginTop: '8px' }, text: '可隨時在「設定 → 通知」開關各項；不開也完全能用。' }));
    b.appendChild(el('.grid2', { style: { marginTop: '16px' } }, [
      el('button.btn.btn--brand', { onclick: async () => { await Notify.requestEnable(); scheduleCloudPush(); closeSheets(); } }, ['🔔 開啟通知']),
      el('button.btn', { onclick: () => { Notify.markAsked(); closeSheets(); } }, ['稍後再說']),
    ]));
    openSheet('sheet');
  }, 1200);
}

// ---------- Install (Add to Home Screen) guide ----------
function pwaState() {
  const ua = navigator.userAgent;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  return { standalone, ios, android };
}
function igStep(n, iconId, mockText, caption) {
  return el('.ig-step', {}, [
    el('.ig-num', { text: String(n) }),
    el('div', { style: { flex: '1', minWidth: '0' } }, [
      el('.ig-mock', {}, [el('.ig-mock__ic', {}, [icon(iconId)]), el('span', { text: mockText })]),
      el('.ig-cap', { text: caption }),
    ]),
  ]);
}
function openInstallGuide() {
  const s = pwaState();
  $('#sheetTitle').textContent = '加入主畫面';
  const b = clear($('#sheetBody'));
  if (s.standalone) {
    b.appendChild(el('.empty', {}, [el('.empty__emoji', { text: '✅' }), el('div', { text: '已安裝！' }), el('.tiny.muted', { style: { marginTop: '6px' }, text: '你已從主畫面開啟，享受全螢幕、離線與通知。' })]));
    openSheet('sheet'); return;
  }
  b.appendChild(el('p', { class: 'tiny muted', style: { lineHeight: '1.6', marginBottom: '4px' }, text: '把行程加到手機主畫面，就能像 App 一樣全螢幕開啟、可離線看、收得到提醒。依你的裝置照做：' }));
  if (window.__bip) {
    b.appendChild(el('button.btn.btn--brand.btn--block', { style: { margin: '12px 0 4px' }, onclick: async () => {
      try { window.__bip.prompt(); const r = await window.__bip.userChoice; if (r && r.outcome === 'accepted') { toast('已加入主畫面！'); window.__bip = null; closeSheets(); } else toast('已取消'); }
      catch { toast('請改用下方手動步驟'); }
    } }, [icon('i-install'), '一鍵加入主畫面']));
  }
  const PLAT = {
    ios: ['📱 iPhone / iPad（Safari、Chrome）', [
      [1, 'i-share-ios', '分享', '點「分享」鈕（方框 + 向上箭頭 ⬆）。iPhone 在底部工具列中央；iPad 在右上角。'],
      [2, 'i-add-square', '加入主畫面', '在分享選單往下滑，點「加入主畫面 / Add to Home Screen」。'],
      [3, 'i-add-square', '新增', '右上角點「新增 / Add」即完成。（iOS 26 若出現「以網頁 App 打開」開關，請保持開啟。）'],
    ]],
    android: ['🤖 Android（Chrome）', [
      [1, 'i-dots-v', '⋮ 選單', '點右上角的「⋮」三點選單（或網址列右側的安裝圖示）。'],
      [2, 'i-install', '安裝應用程式', '選「安裝應用程式 / 加入主畫面」。'],
      [3, 'i-install', '安裝', '點「安裝 / 新增」即完成。'],
    ]],
    desktop: ['💻 電腦（Chrome / Edge）', [
      [1, 'i-install', '安裝', '點網址列右側的「安裝」圖示，或「⋮」選單 →「安裝」。'],
      [2, 'i-add-square', '安裝', '確認「安裝」即固定為應用程式。'],
    ]],
  };
  const seg = el('.chiprow', { style: { margin: '12px 0' } });
  const wrap = el('div', {});
  function show(k) {
    clear(wrap);
    wrap.appendChild(el('.h-section', { style: { margin: '2px 2px 8px' }, text: PLAT[k][0] }));
    PLAT[k][1].forEach(a => wrap.appendChild(igStep(a[0], a[1], a[2], a[3])));
    [...seg.children].forEach(c => c.classList.toggle('is-on', c.dataset.k === k));
  }
  const order = s.ios ? ['ios', 'android', 'desktop'] : s.android ? ['android', 'ios', 'desktop'] : ['desktop', 'ios', 'android'];
  const labels = { ios: 'iPhone', android: 'Android', desktop: '電腦' };
  order.forEach(k => seg.appendChild(el('button.chip.chip--tap', { dataset: { k }, onclick: () => show(k) }, labels[k])));
  b.appendChild(seg); b.appendChild(wrap);
  show(order[0]);
  b.appendChild(el('p', { class: 'tiny muted-3', style: { marginTop: '14px' }, text: '加入後，從主畫面圖示開啟即為全螢幕 App，可離線使用並收得到行程提醒。' }));
  openSheet('sheet');
}

// ---------- Geolocation ----------
function requestLocation(auto) {
  if (!navigator.geolocation) { if (!auto) toast('此裝置不支援定位'); return; }
  navigator.geolocation.getCurrentPosition(p => {
    lastPos = { lat: p.coords.latitude, lng: p.coords.longitude };
    const lb = $('#locBtn'); if (lb) lb.classList.add('iconbtn--live');
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

// ============================================================================
// Multi-plan platform: Home → Plans → App. Kyushu is an immutable TEMPLATE;
// each plan is a saved snapshot (reuses exportAll/importAll). Firestore mirror.
// ============================================================================
let currentPlanId = null;
let cloudTimer = null;

const uid = () => Math.random().toString(36).slice(2, 9);
const plansMeta = () => store.get('kp_plans', []);
const setPlansMeta = a => store.set('kp_plans', a);
function fmtAgo(ts) {
  if (!ts) return '剛剛'; const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return '剛剛'; if (m < 60) return m + ' 分鐘前'; const h = Math.floor(m / 60);
  if (h < 24) return h + ' 小時前'; return Math.floor(h / 24) + ' 天前';
}

function showScreen(name) {
  ['home', 'plans'].forEach(s => { const e = $('#screen-' + s); if (e) e.hidden = name !== s; });
  const app = $('#app'); if (app) app.hidden = name !== 'app';
  if (name !== 'app') closeSheets();
  if (name === 'home') renderHome();
  if (name === 'plans') renderPlans();
  if (name === 'app') maybeNotifyIntro();
  window.scrollTo({ top: 0 });
}

function templateSnapshot() { return { v: 3, ts: Date.now(), model: kyushuModel(), extras: {} }; }
function planBaseOf(id) { const m = plansMeta().find(p => p.id === id); return m ? (m.base || 'custom') : 'custom'; }
function isKyushuPlan() { return planBaseOf(currentPlanId) === 'kyushu'; }

// Load a plan's stored model into the LIVE trip + restore its personal extras.
function loadPlanState(id) {
  const st = store.get('kp_state:' + id, null);
  let model;
  if (st && st.v === 3 && st.model) { model = st.model; applyExtras(st.extras || {}); }
  else if (st && st.v === 2) { model = legacyToModel(st); applyExtras(st.data || {}); }
  else { model = planBaseOf(id) === 'kyushu' ? kyushuModel() : kyushuModel(); applyExtras({}); }
  setTrip(model);
  const baseSt = store.get('kp_base:' + id, null);
  currentBase = (baseSt && baseSt.model) ? baseSt.model : (planBaseOf(id) === 'kyushu' ? kyushuModel() : cloneModel(model));
  planCustomized = false;
}
function snapshotCurrent() {
  if (!currentPlanId) return;
  store.set('kp_state:' + currentPlanId, exportAll());
  const arr = plansMeta(); const m = arr.find(p => p.id === currentPlanId); if (m) { m.updatedAt = Date.now(); setPlansMeta(arr); }
}

function createPlan({ title, model = null, fromState = null, base = null, emoji = null } = {}) {
  const id = uid();
  let st;
  if (fromState) {
    if (fromState.v === 3 && fromState.model) st = { v: 3, ts: Date.now(), model: cloneModel(fromState.model), extras: fromState.extras || {} };
    else if (fromState.v === 2) st = { v: 3, ts: Date.now(), model: legacyToModel(fromState), extras: fromState.data || {} };
    else st = { v: 3, ts: Date.now(), model: kyushuModel(), extras: {} };
  } else {
    st = { v: 3, ts: Date.now(), model: cloneModel(model || kyushuModel()), extras: {} };
  }
  const m = st.model;
  const arr = plansMeta();
  arr.unshift({
    id, title: title || (m.trip && m.trip.title) || '新行程',
    emoji: emoji || (m.trip && m.trip.emoji) || '🗺️',
    base: base || (model || fromState ? 'custom' : 'kyushu'),
    createdAt: Date.now(), updatedAt: Date.now(),
  });
  setPlansMeta(arr);
  store.set('kp_state:' + id, st);
  store.set('kp_base:' + id, { v: 3, model: cloneModel(m) });
  scheduleCloudPush();
  return id;
}
// Re-render every trip-dependent surface for the active plan (any country).
function renderActivePlan() {
  const todayEntry = dayByDate[ymd(new Date())]; selectedDay = todayEntry ? todayEntry.index : 0;
  if (CITIES[0] && CITIES[0].key) wxCity = CITIES[0].key;
  renderToday(); renderDayPicker(); renderDayDetail(selectedDay);
  buildRoutePages(); try { refreshMap({ rail: isKyushuPlan() }); } catch {}
  buildWeatherPicker(); renderWeatherHero(); renderWeatherCity(wxCity, $('#wxRoot'));
  buildGiftPicker(); renderGifts();
  updateAppbarTitle(); updatePlanCount();
}
function openPlan(id) {
  if (!plansMeta().some(p => p.id === id)) return;
  snapshotCurrent();
  currentPlanId = id; store.set('kp_current', id);
  loadPlanState(id);
  renderActivePlan();
  goTab('today'); showScreen('app');
  try { Notify.scheduleReminders(); } catch {}
}
function fmtMD(d) { const p = String(d).split('-'); return p.length === 3 ? `${+p[1]}/${+p[2]}` : d; }
function fmtRange(a, b) { return `${fmtMD(a)}–${fmtMD(b)}`; }
function updateAppbarTitle() {
  const m = plansMeta().find(p => p.id === currentPlanId);
  const t = $('#appbarTitle'); if (t && m) t.textContent = m.title;
  const s = $('#appbarSub');
  if (s) s.textContent = DAYS.length
    ? `${fmtRange(DAYS[0].date, DAYS[DAYS.length - 1].date)} · ${DAYS.length} 天`
    : (TRIP.start && TRIP.end ? fmtRange(TRIP.start, TRIP.end) : '尚未規劃 · 問 AI 幫你排');
}
function updatePlanCount() { const c = $('#planCountChip'); if (c) c.textContent = `${DAYS.length} 天`; }
function deletePlan(id) {
  let arr = plansMeta().filter(p => p.id !== id); setPlansMeta(arr);
  try { localStorage.removeItem('kp_state:' + id); localStorage.removeItem('kp_base:' + id); } catch {}
  if (currentPlanId === id) { currentPlanId = arr[0] ? arr[0].id : null; store.set('kp_current', currentPlanId); if (currentPlanId) { loadPlanState(currentPlanId); renderActivePlan(); } }
  scheduleCloudPush(); renderPlans();
}
function renamePlan(id, title) { const arr = plansMeta(); const m = arr.find(p => p.id === id); if (m && title) { m.title = title; setPlansMeta(arr); updateAppbarTitle(); scheduleCloudPush(); renderPlans(); } }

// AI creates a new plan then jumps to chat to arrange it
function aiNewPlan(title) { const id = createPlan({ title: title || '新行程', model: blankModel({ title: title || '新行程' }), base: 'custom' }); openPlan(id); goTab('ai'); toast('已建立空白行程，跟 AI 說你想去哪'); return { ok: true, msg: '已建立空白行程「' + (title || '新行程') + '」並開啟' }; }

// ---- AI: build a whole trip (any country) from a description --------------------
const PALETTE = ['#2563eb', '#0d9488', '#e11d48', '#d97706', '#7c3aed', '#db2777', '#16a34a', '#b91c1c', '#4f46e5', '#65a30d'];
const DOW_CH = ['日', '一', '二', '三', '四', '五', '六'];
function dowOf(date) { try { return DOW_CH[new Date(date + 'T00:00:00').getDay()]; } catch { return ''; } }
// Map an AI trip JSON into our internal trip model (defensive).
function normalizeModel(res) {
  const cities = (res.cities || []).map((c, i) => ({
    key: c.key || ('c' + i), name: c.name || c.en || ('城市' + (i + 1)), jp: c.en || '', flag: c.emoji || '📍',
    lat: +c.lat, lng: +c.lng, color: c.color || PALETTE[i % PALETTE.length], station: c.station || '',
    blurb: c.blurb || '', pois: (c.pois || []).map(p => ({ name: p.name, jp: p.en || '', lat: +p.lat, lng: +p.lng, emoji: p.emoji || '📍', tag: p.tag || 'see', desc: p.desc || '', hours: p.hours || '', fee: p.fee || '' })),
  })).filter(c => c.name);
  const keys = new Set(cities.map(c => c.key));
  const fallbackKey = (cities[0] && cities[0].key) || '';
  const days = (res.days || []).map((d, i) => {
    const ck = keys.has(d.cityKey) ? d.cityKey : fallbackKey;
    return {
      date: d.date || '', dow: d.dow || dowOf(d.date), cityKey: ck, weatherKey: ck,
      title: d.title || ('Day ' + (i + 1)), summary: d.summary || '',
      items: (d.items || []).map(it => ({ time: it.time || '', type: it.type || 'see', title: it.title || '', desc: it.desc || '', ...(it.cost ? { cost: it.cost } : {}), ...(it.lat != null && it.lng != null ? { lat: +it.lat, lng: +it.lng } : {}) })).filter(it => it.title),
    };
  }).filter(d => d.date);
  const trip = res.trip || {};
  return {
    trip: {
      title: trip.title || '我的行程', subtitle: trip.subtitle || '', emoji: trip.emoji || (cities[0] && cities[0].flag) || '🗺️',
      start: trip.start || (days[0] && days[0].date) || '', end: trip.end || (days[days.length - 1] && days[days.length - 1].date) || '',
      days: days.length, base: trip.base || '', country: trip.country || '',
    },
    cities, days,
    routes: (res.routes || []).map(r => ({ from: r.from, to: r.to, summary: r.summary || '', fare: r.fare || '', icon: 'i-route' })),
    pass: (res.pass && res.pass.best) ? res.pass : null,
    souvenirs: {}, tide: null,
    budget: (res.budget && res.budget.fixed) ? res.budget : { fixed: [], mealsPerDay: (res.budget && res.budget.mealsPerDay) || 1500, hotelPerNight: (res.budget && res.budget.hotelPerNight) || 4000, nights: Math.max(0, days.length - 1) },
    currency: (trip.currency && trip.currency.symbol) ? trip.currency : { symbol: '', rate: 1, note: '' },
    emergency: (res.emergency && res.emergency.numbers) ? res.emergency : { numbers: [], offices: [] },
    packing: res.packing || [],
  };
}
// Apply an AI trip JSON to the CURRENT plan (used by the chat plan_trip tool).
function applyModel(res) {
  if (!res || !res.days || !res.days.length) return { ok: false, msg: '沒有可套用的行程' };
  const model = normalizeModel(res);
  if (!model.days.length) return { ok: false, msg: '行程內容不足' };
  setTrip(model);
  currentBase = cloneModel(model);
  const arr = plansMeta(); const m = arr.find(p => p.id === currentPlanId);
  if (m) { m.title = model.trip.title || m.title; m.emoji = model.trip.emoji || m.emoji; m.base = 'custom'; setPlansMeta(arr); }
  renderActivePlan();
  snapshotCurrent(); scheduleCloudPush();
  try { Notify.scheduleReminders(); } catch {}
  return { ok: true, msg: `已規劃「${model.trip.title}」，共 ${model.days.length} 天、${model.cities.length} 個城市` };
}

// Progress overlay during generation
let genTimer = null, genIdx = 0;
const GEN_STEPS = ['理解你的需求', '研究目的地與城市', '安排每日行程與路線', '查詢各地天氣', '完成最後整理'];
function showGenProgress(msg) {
  let o = document.getElementById('genOverlay');
  if (!o) {
    o = el('#genOverlay.gen-overlay', {}, [el('.gen-card', {}, [
      el('.gen-spark', {}, [icon('i-ai')]),
      el('.gen-title', { id: 'genTitle' }),
      el('.gen-steps', { id: 'genSteps' }),
      el('.tiny.muted-3', { style: { marginTop: '14px', textAlign: 'center' }, text: 'AI 正在從零幫你規劃整趟旅程，約需 10–30 秒…' }),
    ])]);
    document.body.appendChild(o);
  }
  $('#genTitle').textContent = msg || '建立中…';
  const steps = $('#genSteps'); clear(steps);
  GEN_STEPS.forEach((s, i) => steps.appendChild(el('.gen-step', {}, [el('span.gen-dot'), el('span', { text: s })])));
  genIdx = 0; markGenStep(0);
  o.classList.add('is-on');
  clearInterval(genTimer);
  genTimer = setInterval(() => { if (genIdx < GEN_STEPS.length - 1) markGenStep(genIdx + 1); }, 3800);
}
function markGenStep(i) { genIdx = i; $$('#genSteps .gen-step').forEach((e, idx) => { e.classList.toggle('is-done', idx < i); e.classList.toggle('is-now', idx === i); }); }
function hideGenProgress() { clearInterval(genTimer); const o = document.getElementById('genOverlay'); if (o) { markGenStep(GEN_STEPS.length - 1); setTimeout(() => o.classList.remove('is-on'), 280); } }

// Ask the user for missing essentials before generating
let pendingAnswers = null;
function askTripInfo(text, needInfo, prev) {
  $('#sheetTitle').textContent = '幾個問題，幫你排得更準';
  const b = clear($('#sheetBody'));
  b.appendChild(el('p', { class: 'muted', style: { fontSize: '14px' }, text: '提供以下資訊後，我就能完成你的行程：' }));
  const inputs = [];
  (needInfo || []).slice(0, 4).forEach(q => {
    b.appendChild(el('label', { class: 'tiny muted-3', style: { marginTop: '10px', display: 'block' }, text: q.question || '請補充' }));
    const inp = el('input', { type: 'text', placeholder: q.hint || '', style: inputStyle() });
    inputs.push([q.key || q.question, inp]); b.appendChild(inp);
  });
  b.appendChild(el('button.btn.btn--brand.btn--block', { style: { marginTop: '14px' }, onclick: () => {
    const answers = { ...(prev || {}) };
    inputs.forEach(([k, inp]) => { if (inp.value.trim()) answers[k] = inp.value.trim(); });
    pendingAnswers = answers; closeSheets(); aiCreatePlan(text);
  } }, ['開始建立行程']));
  b.appendChild(el('button.btn.btn--block', { style: { marginTop: '8px' }, onclick: () => { pendingAnswers = { ...(prev || {}), _skip: true }; closeSheets(); aiCreatePlan(text); } }, ['略過，直接幫我安排']));
  openSheet('sheet');
}

// From the Plans page (or template AI button): describe a trip → AI builds the whole thing
async function aiCreatePlan(text) {
  const t = (text || '').trim();
  const answers = pendingAnswers; pendingAnswers = null;
  showGenProgress('正在了解你的需求…');
  try {
    const res = await generateTripPlan({ prompt: t, answers });
    if (res && res.needInfo && res.needInfo.length && !(answers && answers._skip)) { hideGenProgress(); askTripInfo(t, res.needInfo, answers || {}); return; }
    const model = normalizeModel(res);
    if (!model.days.length) throw new Error('AI 沒有產生完整的每日行程，請補充目的地與天數再試');
    $('#genTitle') && ($('#genTitle').textContent = '建立行程中…');
    const id = createPlan({ title: model.trip.title || (t ? ('AI · ' + t.slice(0, 14)) : 'AI 行程'), model, base: 'custom', emoji: model.trip.emoji });
    hideGenProgress();
    openPlan(id);
    toast(`已建立「${model.trip.title}」🎉 可在 AI 旅伴繼續調整`);
  } catch (e) {
    hideGenProgress();
    if (e.message === 'NO_KEY') {
      toast('需先設定 Gemini 金鑰才能用 AI 建立行程');
      const id = createPlan({ title: t ? ('AI · ' + t.slice(0, 14)) : 'AI 行程', model: blankModel({ title: t || 'AI 行程' }), base: 'custom' });
      openPlan(id); goTab('ai');
    } else { toast('建立失敗：' + e.message); }
  }
}

// ---- Sharing (Firebase if signed in, else Cloudflare KV) ----
// Uploads the plan snapshot under a stable, revocable code stored on the plan meta,
// so the same invite link keeps working and can be turned off later.
async function uploadShare(code, payload) {
  if (fb.configured && fb.user) { await shareSave(code, payload); return; }
  const res = await fetch('/api/plan?code=' + encodeURIComponent(code), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (res.status === 501) throw new Error('分享需先設定雲端（Firebase 登入，或 Cloudflare KV）');
  if (!res.ok) throw new Error('伺服器錯誤（' + res.status + '）');
}
async function generateShare(id) {
  if (id === currentPlanId) snapshotCurrent();
  const data = store.get('kp_state:' + id, templateSnapshot());
  const arr = plansMeta(); const m = arr.find(p => p.id === id);
  const code = (m && m.share) || uid();
  await uploadShare(code, { meta: { title: m ? m.title : '行程', emoji: m ? m.emoji : '🗾' }, state: data });
  if (m && m.share !== code) { m.share = code; setPlansMeta(arr); }
  return { code, link: location.origin + location.pathname + '?plan=' + code };
}
async function revokeShare(id) {
  const arr = plansMeta(); const m = arr.find(p => p.id === id);
  if (!m || !m.share) return;
  try { await uploadShare(m.share, { revoked: true }); } catch { /* best effort */ }
  delete m.share; setPlansMeta(arr);
}
function shareLinkFor(id) { const m = plansMeta().find(p => p.id === id); return m && m.share ? location.origin + location.pathname + '?plan=' + m.share : null; }

async function importSharedCode(code) {
  if (!code) return;
  try {
    let payload = null;
    if (fb.configured && fb.user) payload = await shareGet(code);
    if (!payload) { const res = await fetch('/api/plan?code=' + encodeURIComponent(code)); if (res.ok) payload = await res.json(); }
    if (!payload) return toast('找不到此分享碼');
    if (payload.revoked) return toast('這個分享連結已被對方關閉');
    const state = payload.state || payload;           // tolerate raw state
    const title = (payload.meta && payload.meta.title) || '共享的行程';
    const newId = createPlan({ title: title + '（共享）', fromState: state, base: 'custom' });
    openPlan(newId); toast('已載入共享行程');
  } catch (e) { toast('載入失敗：' + e.message); }
}

// ---- Invite / manage-access sheet ----
async function openShareSheet(id) {
  const m = plansMeta().find(p => p.id === id);
  $('#sheetTitle').textContent = '邀請朋友';
  const b = clear($('#sheetBody'));
  b.appendChild(el('p', { class: 'muted', style: { fontSize: '14px', marginBottom: '4px' }, text: '把「' + (m ? m.title : '行程') + '」分享給同行的人。' }));
  const status = el('.tiny.muted-3', { style: { margin: '12px 0' }, text: '正在建立邀請連結…' });
  b.appendChild(status);
  openSheet('sheet');
  let link, code;
  try { const r = await generateShare(id); link = r.link; code = r.code; }
  catch (e) { status.textContent = '建立失敗：' + e.message; return; }
  if ($('#sheetTitle').textContent !== '邀請朋友') return;   // sheet changed while awaiting
  status.remove();

  b.appendChild(el('label', { class: 'tiny muted-3', text: '邀請連結' }));
  const linkIn = el('input', { value: link, readonly: 'readonly', onclick: e => e.target.select(), style: { ...inputStyle(), fontSize: '13px' } });
  b.appendChild(linkIn);

  b.appendChild(el('.grid2', { style: { marginTop: '12px' } }, [
    el('button.btn.btn--brand', { onclick: async () => { try { await navigator.clipboard.writeText(link); toast('已複製邀請連結'); } catch { linkIn.select(); toast('請長按選取後複製'); } } }, [icon('i-copy'), '複製連結']),
    navigator.share
      ? el('button.btn', { onclick: () => navigator.share({ title: m ? m.title : '我的行程', text: '一起看我的旅行行程吧！', url: link }).catch(() => {}) }, [icon('i-share'), '系統分享…'])
      : el('button.btn', { onclick: async () => { try { await navigator.clipboard.writeText(code); toast('已複製分享碼 ' + code); } catch {} } }, [icon('i-copy'), '複製分享碼']),
  ]));

  // QR — friend can scan to open instantly (needs internet to render the QR image)
  b.appendChild(el('.tiny.muted-3', { style: { margin: '16px 0 8px' }, text: '或讓朋友掃這個 QR 碼：' }));
  const qr = el('img', { alt: 'QR', loading: 'lazy', src: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=' + encodeURIComponent(link), style: { width: '184px', height: '184px', display: 'block', margin: '0 auto', borderRadius: '14px', background: '#fff', padding: '8px', boxShadow: 'var(--shadow-1)' } });
  qr.onerror = () => { qr.style.display = 'none'; };
  b.appendChild(qr);

  // Manage access
  b.appendChild(el('.tiny.muted-3', { style: { margin: '18px 0 6px', fontWeight: '700' }, text: '可存取的人' }));
  b.appendChild(el('p', { class: 'tiny muted-3', style: { lineHeight: '1.7', margin: '0 0 10px' }, text: '任何拿到上面連結／分享碼的人，都能載入一份「自己的可編輯副本」。對方的修改不會影響你的版本。' }));
  b.appendChild(el('button.btn.btn--block', { style: { color: 'var(--sakura)' }, onclick: async () => {
    if (!confirm('關閉這個邀請連結？已加入的人手上的副本會保留，但這條連結／分享碼將失效，需要時可重新產生新的。')) return;
    await revokeShare(id); closeSheets(); toast('已關閉邀請連結');
  } }, [icon('i-trash'), '關閉此邀請連結']));
}

function openLoadSharedSheet() {
  $('#sheetTitle').textContent = '載入共享行程';
  const b = clear($('#sheetBody'));
  b.appendChild(el('p', { class: 'muted', style: { fontSize: '14px' }, text: '輸入同行者給你的分享碼，或貼上邀請連結，即可加入一份可自己編輯的副本。' }));
  b.appendChild(el('label', { class: 'tiny muted-3', style: { marginTop: '10px', display: 'block' }, text: '分享碼或連結' }));
  const inp = el('input', { type: 'text', placeholder: '例：a1b2c3 或 https://…?plan=a1b2c3', style: inputStyle() });
  b.appendChild(inp);
  const go = () => { let c = inp.value.trim(); if (!c) return; if (c.includes('plan=')) c = c.split('plan=')[1].split('&')[0]; closeSheets(); importSharedCode(c.trim()); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  b.appendChild(el('button.btn.btn--brand.btn--block', { style: { marginTop: '14px' }, onclick: go }, ['載入行程']));
  openSheet('sheet');
  setTimeout(() => inp.focus(), 120);
}
function importSharedFromURL() {
  const c = new URLSearchParams(location.search).get('plan');
  if (c) { history.replaceState(null, '', location.pathname); importSharedCode(c); return true; }
  return false;
}

// ---- Export: high-quality PDF + calendar (.ics) + JSON backup -----------------
// Model-based so it exports the CORRECT plan (any country) without touching the live trip.
function sanitizeFile(s) { return (String(s || 'plan').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').slice(0, 48)) || 'plan'; }
function icsEsc(s) { return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
function cityNameIn(model, key) { const c = (model.cities || []).find(x => x.key === key); return c ? c.name : ''; }

function openExportSheet(id) {
  const m = plansMeta().find(p => p.id === id);
  const title = m ? m.title : TRIP.title;
  $('#sheetTitle').textContent = '匯出計畫';
  const b = clear($('#sheetBody'));
  b.appendChild(el('p', { class: 'muted', style: { fontSize: '14px' }, text: `匯出「${title}」的行程與各種資料。` }));
  b.appendChild(exportRow('📄', '高品質 PDF 計畫表', '逐日時間表＋路線＋票券＋預算＋打包＋緊急聯絡；列印或「另存為 PDF」', () => { closeSheets(); setTimeout(() => exportPlanPDF(id, title), 120); }));
  b.appendChild(exportRow('🗓️', '行事曆 .ics', '把每日行程匯入 Google／Apple 行事曆', () => exportPlanICS(id, title)));
  b.appendChild(exportRow('🧾', 'JSON 完整備份', '保存或日後重新匯入、轉移裝置', () => exportPlanJSON(id, title)));
  b.appendChild(el('p', { class: 'tiny muted-3', style: { marginTop: '14px', lineHeight: '1.6' }, text: '提示：PDF 會開啟列印視窗，於「目的地」選「另存為 PDF」即可獲得高品質、可選取文字的計畫表。' }));
  openSheet('sheet');
}
function exportRow(emoji, t, d, onclick) {
  return el('button.exp-row', { onclick }, [
    el('.exp-row__ic', { text: emoji }),
    el('.exp-row__tx', {}, [el('b', { text: t }), el('.tiny.muted-3', { text: d })]),
    el('span.exp-row__go', {}, [icon('i-chevron')]),
  ]);
}
function exportPlanJSON(id, title) {
  if (id === currentPlanId) snapshotCurrent();
  const st = store.get('kp_state:' + id, templateSnapshot());
  const payload = { app: 'Plan AI', kind: 'plan-backup', v: 3, exportedAt: new Date().toISOString(), meta: { title }, state: st };
  downloadText(sanitizeFile(title) + '.json', JSON.stringify(payload, null, 2), 'application/json');
  toast('已匯出 JSON 備份');
}
function exportPlanICS(id, title) {
  const model = planModelFor(id);
  const days = model.days || [];
  const pad = n => String(n).padStart(2, '0');
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Plan AI//TW//ZH', 'CALSCALE:GREGORIAN'];
  days.forEach((d, i) => {
    if (!d.date) return;
    const dt = d.date.replace(/-/g, '');
    const dd = new Date(d.date + 'T00:00:00'); dd.setDate(dd.getDate() + 1);
    const end = `${dd.getFullYear()}${pad(dd.getMonth() + 1)}${pad(dd.getDate())}`;
    const its = (d.items || []).filter(x => x && x.type !== 'stay');
    const sched = its.map(x => `${x.time} ${x.title}`).join('\n');
    const city = cityNameIn(model, d.cityKey);
    L.push('BEGIN:VEVENT', `UID:planai-${id}-d${i + 1}-${dt}@planai`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${dt}`, `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${icsEsc(`Day ${i + 1} ${city} — ${d.title || ''}`)}`, `DESCRIPTION:${icsEsc(sched)}`, 'END:VEVENT');
  });
  L.push('END:VCALENDAR');
  downloadText(sanitizeFile(title) + '.ics', L.join('\r\n'), 'text/calendar');
  toast('已匯出行事曆 .ics');
}
function ensurePrintRoot() { let r = document.getElementById('printRoot'); if (!r) { r = document.createElement('div'); r.id = 'printRoot'; document.body.appendChild(r); } return r; }
function exportPlanPDF(id, title) {
  ensurePrintRoot().innerHTML = buildPrintHTML(planModelFor(id), title);
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { try { window.print(); } catch { done(); toast('此裝置無法開啟列印'); } }, 80);
}
function buildPrintHTML(model, title) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const cur = (model.currency && model.currency.symbol) || '¥';
  const money = n => cur + Number(n || 0).toLocaleString('en-US');
  const days = model.days || [];
  const range = days.length ? `${fmtMD(days[0].date)}–${fmtMD(days[days.length - 1].date)}`
    : ((model.trip && model.trip.start) ? `${fmtMD(model.trip.start)}–${fmtMD(model.trip.end)}` : '');
  const daysHTML = days.map((d, i) => {
    const rows = (d.items || []).filter(Boolean).map(x => {
      const tm = TYPE_META[x.type] || { label: '' };
      return `<tr><td class="pd-t">${esc(x.time || '')}</td><td class="pd-ty">${esc(tm.label)}</td><td class="pd-ti"><b>${esc(x.title)}</b>${x.desc ? `<div class="pd-d">${esc(x.desc)}</div>` : ''}</td><td class="pd-c">${esc(x.cost || '')}</td></tr>`;
    }).join('');
    return `<section class="pd-day"><div class="pd-dh"><span class="pd-dn">Day ${i + 1}</span><span class="pd-dd">${esc(fmtMD(d.date))}${d.dow ? `（${esc(d.dow)}）` : ''} · ${esc(cityNameIn(model, d.cityKey))}</span><span class="pd-dt">${esc(d.title || '')}</span></div>${d.summary ? `<p class="pd-sum">${esc(d.summary)}</p>` : ''}<table class="pd-tab"><tbody>${rows}</tbody></table></section>`;
  }).join('');
  const routes = model.routes || [];
  const routesHTML = routes.map(r => `<li><b>${esc(r.from)} → ${esc(r.to)}</b> — ${esc(r.summary || '')}${r.fare ? ` <span class="pd-muted">（${esc(r.fare)}）</span>` : ''}</li>`).join('');
  const bud = model.budget || { fixed: [], mealsPerDay: 0, hotelPerNight: 0, nights: 0 };
  let adm = 0; days.forEach(d => (d.items || []).forEach(it => { const s = String(it.cost || ''); const mm = s.replace(/,/g, '').match(/(\d{2,})/); if (mm && /[¥$€£₩฿]/.test(s)) adm += parseInt(mm[1], 10); }));
  const fixed = (bud.fixed || []).reduce((s, f) => s + (f.amount || 0), 0);
  const meals = (bud.mealsPerDay || 0) * days.length, hotel = (bud.hotelPerNight || 0) * (bud.nights || 0), total = fixed + adm + meals + hotel;
  const budgetHTML = (bud.fixed || []).map(f => `<tr><td>${esc(f.label)}</td><td class="pd-c">${money(f.amount)}</td></tr>`).join('')
    + `<tr><td>門票（行程內合計）</td><td class="pd-c">${money(adm)}</td></tr>`
    + (bud.mealsPerDay ? `<tr><td>餐食（${days.length} 天 × ${money(bud.mealsPerDay)}）</td><td class="pd-c">${money(meals)}</td></tr>` : '')
    + (bud.hotelPerNight ? `<tr><td>住宿（${bud.nights} 晚 × ${money(bud.hotelPerNight)}）</td><td class="pd-c">${money(hotel)}</td></tr>` : '')
    + `<tr class="pd-tot"><td><b>預估總計／每人</b></td><td class="pd-c"><b>${money(total)}</b></td></tr>`;
  const P = model.pass;
  const passHTML = P && P.best ? `<b>${esc(P.best)}${P.bestEn ? `（${esc(P.bestEn)}）` : ''}</b>${P.price ? ` · ${esc(P.price)}` : ''}${P.days ? ` / ${esc(P.days)}` : ''}<ul class="pd-ul">${(P.highlights || []).map(h => `<li>${esc(h)}</li>`).join('')}</ul>` : '';
  const packHTML = (model.packing || []).map(p => `<li>☐ ${esc(p)}</li>`).join('');
  const em = model.emergency || { numbers: [], offices: [] };
  const emHTML = (em.numbers || []).map(n => `<li>${esc(n.emoji || '📞')} ${esc(n.label)}：<b>${esc(n.num)}</b></li>`).join('')
    + (em.offices || []).map(o => `<li>🏛️ ${esc(o.name)}：${esc(o.tel)}${o.emg ? `（急難 ${esc(o.emg)}）` : ''}</li>`).join('');
  const base = (model.trip && model.trip.base) || '';
  const block = (h, inner) => inner ? `<section class="pd-block"><h2>${h}</h2>${inner}</section>` : '';
  return `<div class="pdoc">
    <header class="pd-cover"><div class="pd-brand">PLAN AI</div><h1 class="pd-title">${esc(title)}</h1><div class="pd-meta">${esc(range)}${days.length ? ` · ${days.length} 天` : ''}${base ? ` · ${esc(base)}` : ''}</div></header>
    ${block('每日行程', daysHTML)}
    ${block('交通路線', routesHTML ? `<ul class="pd-ul">${routesHTML}</ul>` : '')}
    ${block('票券', passHTML ? `<div class="pd-card">${passHTML}</div>` : '')}
    ${block('預算估算（每人・參考）', `<table class="pd-tab pd-budget"><tbody>${budgetHTML}</tbody></table>`)}
    ${block('打包清單', packHTML ? `<ul class="pd-cols">${packHTML}</ul>` : '')}
    ${block('緊急聯絡', emHTML ? `<ul class="pd-ul">${emHTML}</ul>` : '')}
    <footer class="pd-foot">由 Plan AI 產生 · ${esc(range)}</footer>
  </div>`;
}

// ---- Home / Plans rendering ----
function renderHome() {
  const f = $('#homeFeatures');
  if (f && !f.children.length) {
    [['🗺️', '完整行程規劃', '逐日時間軸、JR 路線與 Google 導航'],
     ['🤖', 'AI 旅伴', '用講的就能調整行程、查天氣、找飯店'],
     ['☁️', '自動雲端儲存', '登入後跨裝置同步，並可與同行者共享']]
      .forEach(([e, t, d]) => f.appendChild(el('.home-feat', {}, [el('.home-feat__ic', { text: e }), el('div', {}, [el('.home-feat__t', { text: t }), el('.home-feat__d', { text: d })])])));
  }
  const gBtn = $('#googleSignIn'), note = $('#homeNote');
  if (gBtn) gBtn.style.display = fb.configured ? '' : 'none';
  if (note) note.textContent = fb.configured ? '' : '（尚未連接 Firebase；可先「試用」，資料存在本機。設定後即可 Google 登入與雲端同步）';
}
function renderPlans() {
  const list = $('#plansList'); if (!list) return; clear(list);
  const metas = plansMeta();
  if (!metas.length) list.appendChild(el('.empty', {}, [el('.empty__emoji', { text: '🧳' }), el('div', { text: '還沒有任何行程' }), el('.tiny.muted', { style: { marginTop: '6px' }, text: '從下方範本建立你的第一份行程！' })]));
  metas.forEach(m => list.appendChild(planCard(m)));
  const tl = $('#templateList'); if (tl) { clear(tl); tl.appendChild(templateCard()); }
  const lbl = $('#plansUserLabel'); if (lbl) lbl.textContent = fb.user ? ((fb.user.displayName || fb.user.email) + ' · 已同步') : (fb.configured ? '點右上登入以雲端同步' : '本機儲存');
  const authBtn = $('#plansAuthBtn');
  if (authBtn) {
    authBtn.title = fb.user ? '帳號（已登入）' : '登入';
    if (fb.user && fb.user.photoURL) authBtn.innerHTML = `<img src="${fb.user.photoURL}" alt="" referrerpolicy="no-referrer" style="width:28px;height:28px;border-radius:50%;object-fit:cover">`;
    else authBtn.innerHTML = '<svg class="ic"><use href="#i-user"/></svg>';
  }
}
function planCard(m) {
  return el('.plan-card', { onclick: () => openPlan(m.id) }, [
    el('.plan-card__ico', { text: m.emoji || '🗺️' }),
    el('.plan-card__body', {}, [
      el('.plan-card__title', { text: m.title }),
      el('.plan-card__meta', {}, [m.id === currentPlanId ? el('span.plan-badge', { text: '目前' }) : null, el('span', { text: '更新 ' + fmtAgo(m.updatedAt) })]),
    ]),
    el('.plan-card__actions', {}, [
      el('button.iconbtn', { title: '匯出（PDF／行事曆／備份）', onclick: e => { e.stopPropagation(); openExportSheet(m.id); } }, [icon('i-install')]),
      el('button.iconbtn', { title: '邀請朋友', onclick: e => { e.stopPropagation(); openShareSheet(m.id); } }, [icon('i-share')]),
      el('button.iconbtn', { title: '重新命名', onclick: e => { e.stopPropagation(); const t = prompt('行程名稱', m.title); if (t) renamePlan(m.id, t.trim()); } }, [icon('i-plan')]),
      el('button.iconbtn', { title: '刪除', onclick: e => { e.stopPropagation(); if (confirm('刪除「' + m.title + '」？此動作無法復原。')) deletePlan(m.id); } }, [icon('i-trash')]),
    ]),
  ]);
}
function templateCard() {
  const card = el('.plan-card.plan-card--tpl', { onclick: () => { const id = createPlan({ title: '九州・瀨戶內・關西', model: kyushuModel(), base: 'kyushu', emoji: '🗾' }); openPlan(id); toast('已從範本建立新行程'); } }, [
    el('.plan-card__ico', { text: '🗾' }),
    el('.plan-card__body', {}, [el('.plan-card__title', { text: '九州・瀨戶內・關西 8 日' }), el('.plan-card__meta', {}, [el('span.plan-badge.plan-badge--tpl', { text: '範本' }), el('span', { text: '點此複製一份來編輯' })])]),
  ]);
  // AI from blank — any country
  const aiCard = el('.plan-card.plan-card--tpl', { style: { marginTop: '12px' }, onclick: () => aiCreatePlan('') }, [
    el('.plan-card__ico', { text: '✨' }),
    el('.plan-card__body', {}, [el('.plan-card__title', { text: '用 AI 從零建立（任何國家）' }), el('.plan-card__meta', {}, [el('span.plan-badge', { style: { background: 'var(--brand-2)', color: '#fff' }, text: 'AI' }), el('span', { text: '說出目的地與日期，自動排好整趟' })])]),
    el('.plan-card__actions', {}, [el('button.iconbtn', { title: '用 AI 建立', onclick: e => { e.stopPropagation(); aiCreatePlan(''); } }, [icon('i-ai')])]),
  ]);
  // blank manual start
  const blankCard = el('.plan-card.plan-card--tpl', { style: { marginTop: '12px' }, onclick: () => { aiNewPlan('我的行程'); } }, [
    el('.plan-card__ico', { text: '✏️' }),
    el('.plan-card__body', {}, [el('.plan-card__title', { text: '從空白開始（自己編）' }), el('.plan-card__meta', {}, [el('span', { text: '建立空白行程，手動或請 AI 填寫' })])]),
  ]);
  // load shared
  const loadShared = el('.plan-card.plan-card--tpl', { style: { marginTop: '12px' }, onclick: () => openLoadSharedSheet() }, [
    el('.plan-card__ico', { text: '🔗' }),
    el('.plan-card__body', {}, [el('.plan-card__title', { text: '載入共享行程' }), el('.plan-card__meta', {}, [el('span', { text: '用同行者給的分享碼／連結' })])]),
  ]);
  return el('div', {}, [card, aiCard, blankCard, loadShared]);
}

// ---- Account / Firebase ----
function ensurePlans() {
  let metas = plansMeta();
  if (!metas.length) {
    const id = uid();
    const m = kyushuModel();
    const legacy = store.get('kp_plan', null);    // migrate any legacy single-plan edits
    if (legacy && Array.isArray(legacy.days)) m.days.forEach((d, i) => { if (legacy.days[i]) d.items = (legacy.days[i].items || legacy.days[i]); });
    setPlansMeta([{ id, title: '九州・瀨戶內・關西', emoji: '🗾', base: 'kyushu', createdAt: Date.now(), updatedAt: Date.now() }]);
    store.set('kp_state:' + id, { v: 3, ts: Date.now(), model: m, extras: readExtras() });
    store.set('kp_base:' + id, { v: 3, model: kyushuModel() });
    currentPlanId = id; store.set('kp_current', id);
  } else {
    currentPlanId = store.get('kp_current', metas[0].id);
    if (!metas.some(p => p.id === currentPlanId)) currentPlanId = metas[0].id;
  }
  loadPlanState(currentPlanId);
  updateAppbarTitle();
}
function allCloudData() {
  const o = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('kp_') && k !== 'kp_gemini_key' && k !== 'kp_theme' && k !== 'kp_synccode') o[k] = localStorage.getItem(k); }
  return o;
}
// Flattened current-plan schedule the Cron Worker reads to send reminders
function currentSchedule() {
  const out = [];
  DAYS.forEach(d => d.items.filter(it => it.type !== 'stay').forEach(it => out.push({ d: d.date, t: it.time, title: it.title, type: it.type })));
  return out;
}
function cloudPayload() {
  return { keysJson: JSON.stringify(allCloudData()), scheduleJson: JSON.stringify(currentSchedule()), notifyJson: JSON.stringify(Notify.cfg()) };
}
function scheduleCloudPush() {
  if (!fb.user) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => { snapshotCurrent(); pushUserData(cloudPayload()).catch(() => {}); }, 1500);
}
async function onAuthChange(user) {
  const homeNote = $('#homeNote');
  if ($('#screen-plans') && !$('#screen-plans').hidden) renderPlans();
  if (!user) return;
  // signed in → pull cloud; cloud wins if it has data, else push local up
  try {
    const cloud = await pullUserData();
    let keys = null; if (cloud && cloud.keysJson) { try { keys = JSON.parse(cloud.keysJson); } catch {} }
    if (keys && keys.kp_plans) {
      Object.entries(keys).forEach(([k, v]) => { try { localStorage.setItem(k, v); } catch {} });
      ensurePlans();
      if (!$('#app').hidden) openPlan(currentPlanId); else renderPlans();
      toast('已從你的帳號載入行程');
    } else {
      await pushUserData(cloudPayload());
    }
  } catch (e) { console.warn('cloud sync', e); }
  try { Notify.registerPush(); } catch {}
  renderPlans();
}

// ---------- Init ----------
function init() {
  initTheme();
  ensurePlans();

  // tabs
  $$('.tab').forEach(t => t.addEventListener('click', () => goTab(t.dataset.tab)));
  // app bar buttons
  $('#themeBtn').addEventListener('click', () => { setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); });
  $('#settingsBtn').addEventListener('click', openSettings);
  $('#locBtn').addEventListener('click', () => requestLocation(false));
  $('#searchBtn').addEventListener('click', openSearch);
  $('#searchClose').addEventListener('click', closeSheets);
  $('#searchInput').addEventListener('input', e => renderSearch(e.target.value));
  // plans / account
  $('#plansBtn').addEventListener('click', () => { snapshotCurrent(); showScreen('plans'); });
  $('#guestEnter').addEventListener('click', () => { store.set('kp_entered', true); showScreen('plans'); });
  $('#googleSignIn').addEventListener('click', async () => { store.set('kp_entered', true); try { await signInGoogle(); showScreen('plans'); } catch (e) { toast('登入失敗：' + e.message); } });
  $('#plansAuthBtn').addEventListener('click', async () => {
    if (fb.user) { if (confirm('登出帳號？（本機資料會保留）')) { await signOutUser(); renderPlans(); } }
    else if (fb.configured) { try { await signInGoogle(); } catch (e) { toast('登入失敗：' + e.message); } }
    else { openSettings(); }
  });
  $('#plansSettingsBtn').addEventListener('click', openSettings);
  // install / add to home screen
  const installBtn = $('#homeInstallBtn');
  if (installBtn) { if (pwaState().standalone) installBtn.style.display = 'none'; else installBtn.addEventListener('click', openInstallGuide); }
  // AI create-trip on plans page
  const aci = $('#aiCreateInput');
  $('#aiCreateBtn').addEventListener('click', () => { const v = aci.value; aci.value = ''; aci.style.height = 'auto'; aiCreatePlan(v); });
  aci.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#aiCreateBtn').click(); } });
  aci.addEventListener('input', () => { aci.style.height = 'auto'; aci.style.height = Math.min(100, aci.scrollHeight) + 'px'; });
  const aChips = $('#aiCreateChips');
  if (aChips) ['美食為主', '輕鬆慢步調', '親子友善', '行程排滿一點', '多拍照打卡點'].forEach(c => aChips.appendChild(el('button', { onclick: () => aiCreatePlan(c) }, c)));
  // sheets
  $('#scrim').addEventListener('click', closeSheets);
  $('#sheetClose').addEventListener('click', closeSheets);
  $('#settingsClose').addEventListener('click', closeSheets);
  // route segments
  $$('#routeSeg .chip').forEach(c => c.addEventListener('click', () => setRouteSeg(c.dataset.seg)));

  // initial day = today (if in range) else day 1
  const todayEntry = dayByDate[ymd(new Date())];
  selectedDay = todayEntry ? todayEntry.index : 0;
  if (CITIES[0] && CITIES[0].key) wxCity = CITIES[0].key;

  // build static-ish pages
  renderToday();
  renderDayPicker(); renderDayDetail(selectedDay);
  buildRoutePages();
  buildWeatherPicker();
  buildGiftPicker(); renderGifts();
  renderWeatherHero();
  renderWeatherCity(wxCity, $('#wxRoot'));
  try { Notify.scheduleReminders(); } catch {}

  // gemini with control API
  geminiCtl = initGemini({
    status, goTab, openDay, showOnMap, goWeather, goSouvenirs,
    openMaps: url => window.open(url, '_blank', 'noopener'),
    planAdd, planRemove, planUpdate, planMove, planReset, newPlan: aiNewPlan, applyModel,
    notifyAI: (t, b) => Notify.notifyAI(t, b),
  });

  // toolkit (錦囊) + motion
  initToolkit({ showOnMap });
  initRipples();
  hideSplash();
  const placeInd = () => moveTabIndicator(currentTab);
  requestAnimationFrame(placeInd);
  window.addEventListener('load', placeInd);
  setTimeout(placeInd, 600);
  window.addEventListener('resize', placeInd);

  // clock — refresh Today every minute
  setInterval(() => { if (currentTab === 'today') renderToday(); if (currentTab === 'weather') renderWeatherHero(); }, 60000);

  // service worker (offline / installable)
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  // firebase (guarded) + persist on exit
  initFirebase().then(() => fb.onAuth(onAuthChange));
  window.addEventListener('beforeunload', () => { try { snapshotCurrent(); } catch {} });

  // initial screen: shared link → plans (loads into app); else app if returning, home if first time
  const hadShare = importSharedFromURL();
  if (hadShare) store.set('kp_entered', true);
  showScreen(hadShare ? 'plans' : (store.get('kp_entered', false) ? 'app' : 'home'));
}

document.addEventListener('DOMContentLoaded', init);
