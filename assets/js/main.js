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
import { initGemini, getCfg, generateTripPlan } from './ai.js';
import { initToolkit, closeToolkit } from './toolkit.js';
import { initFirebase, fb, signInGoogle, signOutUser, authErrorMessage, pullUserData, pushUserData, shareGet, collabReady, collabSave, collabGet, collabJoin, collabSetPlan, collabOnDoc, collabSendMsg, collabOnMsgs, collabSetGeneral, collabSetPersonRole, collabRemovePerson, collabDelete, collabModelGet, feedReady, feedPublish, feedUnpublish, feedList, feedGet, feedLikeToggle, feedLikedSet, feedBumpFork, reviewSave, reviewDelete, reviewList, reviewGetMine, reviewHelpfulToggle, reviewHelpfulSet } from './firebase.js';
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
  if (id === currentPlanId) { snapshotCurrent(); return cloneModel(currentModel()); }
  const st = store.get('kp_state:' + id, null);
  if (st && st.v === 3 && st.model) return st.model;
  if (st && st.v === 2) return legacyToModel(st);
  const base = store.get('kp_base:' + id, null);   // never fall back to the *active* plan's data
  return (base && base.model) ? base.model : kyushuModel();
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
  if (!canEdit()) return READONLY;
  const i = clampDay(day); if (i < 0) return { ok: false, msg: `天數需為 1–${DAYS.length}` };
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) return { ok: false, msg: '時間格式需為 HH:MM' };
  if (!title) return { ok: false, msg: '缺少活動名稱' };
  DAYS[i].items.push({ time, type, title, desc, ...(lat != null && lng != null ? { lat: +lat, lng: +lng } : {}), _user: true });
  finishEdit(i); return { ok: true, msg: `已新增「${title}」到第 ${i + 1} 天 ${time}` };
}
function planRemove({ day, title }) {
  if (!canEdit()) return READONLY;
  const i = clampDay(day); if (i < 0) return { ok: false, msg: `天數需為 1–${DAYS.length}` };
  const idx = findItem(i, title); if (idx < 0) return { ok: false, msg: `第 ${i + 1} 天找不到「${title}」` };
  const removed = DAYS[i].items.splice(idx, 1)[0];
  finishEdit(i); return { ok: true, msg: `已刪除「${removed.title}」` };
}
function planUpdate({ day, title, newTime, newTitle, desc }) {
  if (!canEdit()) return READONLY;
  const i = clampDay(day); if (i < 0) return { ok: false, msg: `天數需為 1–${DAYS.length}` };
  const idx = findItem(i, title); if (idx < 0) return { ok: false, msg: `找不到「${title}」` };
  const it = DAYS[i].items[idx];
  if (newTime && /^\d{1,2}:\d{2}$/.test(newTime)) it.time = newTime;
  if (newTitle) it.title = newTitle;
  if (desc != null) it.desc = desc;
  it._user = true; finishEdit(i); return { ok: true, msg: `已更新「${it.title}」` };
}
function planMove({ day, title, toDay, time }) {
  if (!canEdit()) return READONLY;
  const i = clampDay(day), j = clampDay(toDay); if (i < 0 || j < 0) return { ok: false, msg: `天數需為 1–${DAYS.length}` };
  const idx = findItem(i, title); if (idx < 0) return { ok: false, msg: `找不到「${title}」` };
  const it = DAYS[i].items.splice(idx, 1)[0];
  if (time && /^\d{1,2}:\d{2}$/.test(time)) it.time = time;
  it._user = true; DAYS[j].items.push(it); sortDay(i);
  finishEdit(j); return { ok: true, msg: `已將「${it.title}」移到第 ${j + 1} 天${time ? ' ' + time : ''}` };
}
function planReset() {
  if (!canEdit()) return READONLY;
  if (!currentBase) return { ok: false, msg: '無原始行程可還原' };
  setTrip(cloneModel(currentBase));
  planCustomized = false;
  renderActivePlan();
  snapshotCurrent(); scheduleCloudPush();
  return { ok: true, msg: '已還原為原始行程' };
}
function dateStrAdd(dateStr, n) { try { const d = new Date((dateStr || ymd(new Date())) + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); } catch { return ymd(new Date()); } }
// AI/manual day management — rebuild the model so derived maps recompute.
function planAddDay({ date, city, title } = {}) {
  if (!canEdit()) return READONLY;
  const m = currentModel();
  const last = m.days[m.days.length - 1];
  const dt = (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : (last && last.date ? dateStrAdd(last.date, 1) : ymd(new Date()));
  let ck = '';
  if (city) { const c = (m.cities || []).find(x => x.name && (x.name.includes(city) || city.includes(x.name))); if (c) ck = c.key; }
  if (!ck) ck = (last && last.cityKey) || (m.cities[0] && m.cities[0].key) || '';
  m.days.push({ date: dt, dow: dowOf(dt), cityKey: ck, weatherKey: ck, title: title || ('Day ' + (m.days.length + 1)), summary: '', items: [] });
  if (m.trip) m.trip.days = m.days.length;
  setTrip(m); renderActivePlan(); selectDay(m.days.length - 1); snapshotCurrent(); scheduleCloudPush();
  return { ok: true, msg: `已新增第 ${m.days.length} 天（${dt}）` };
}
function planRemoveDay({ day } = {}) {
  if (!canEdit()) return READONLY;
  const m = currentModel();
  const i = (parseInt(day, 10) || 0) - 1;
  if (i < 0 || i >= m.days.length) return { ok: false, msg: `天數需為 1–${m.days.length}` };
  if (m.days.length <= 1) return { ok: false, msg: '至少要保留一天' };
  const removed = m.days.splice(i, 1)[0];
  if (m.trip) m.trip.days = m.days.length;
  setTrip(m); selectedDay = Math.max(0, Math.min(selectedDay, m.days.length - 1)); renderActivePlan(); snapshotCurrent(); scheduleCloudPush();
  return { ok: true, msg: `已刪除第 ${i + 1} 天（${removed.date || ''}）` };
}

// add/edit a single activity via a form sheet
function openPlanForm(dayIdx, item) {
  if (!canEdit()) { toast(READONLY.msg); return; }
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
  let activeEl = null;
  DAYS.forEach((d, i) => {
    const date = new Date(d.date + 'T00:00:00');
    const pill = el('.daypill' + (i === selectedDay ? '.is-active' : ''), { onclick: () => selectDay(i) }, [
      el('.daypill__dow', { text: '週' + d.dow + (d.date === todayDs ? ' ·今' : '') }),
      el('.daypill__num', { text: `${date.getMonth() + 1}/${date.getDate()}` }),
      el('.daypill__city', { text: ((cityByKey[d.cityKey] || {}).name || '').split(' ')[0] }),
    ]);
    if (i === selectedDay) activeEl = pill;
    dp.appendChild(pill);
  });
  // Keep the selected day visible even on very long (e.g. months-long) trips.
  if (activeEl) try { activeEl.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); } catch {}
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
      canEdit() ? el('button.gmap-btn', { style: editMode ? { borderColor: 'var(--brand-2)', color: 'var(--brand-2)' } : {}, onclick: () => { editMode = !editMode; renderDayDetail(i); } }, [icon('i-plan'), editMode ? '完成編輯' : '編輯行程']) : null,
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

// In-app dialogs (replace native confirm()/prompt() — looks professional, stays in-app).
function appDialog({ title = '', message = '', confirmText = '確定', cancelText = '取消', danger = false, promptValue = null, placeholder = '' } = {}) {
  return new Promise(resolve => {
    let inputEl = null;
    const done = val => { ov.classList.remove('is-on'); setTimeout(() => { try { ov.remove(); } catch {} }, 200); document.removeEventListener('keydown', onKey); resolve(val); };
    const onConfirm = () => done(promptValue !== null ? ((inputEl.value || '').trim() || null) : true);
    const onCancel = () => done(promptValue !== null ? null : false);
    const onKey = e => { if (e.key === 'Escape') onCancel(); else if (e.key === 'Enter' && promptValue !== null) { e.preventDefault(); onConfirm(); } };
    if (promptValue !== null) inputEl = el('input', { value: promptValue, placeholder, style: inputStyle(), onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); onConfirm(); } } });
    const card = el('.app-dialog__card', {}, [
      title ? el('.app-dialog__title', { text: title }) : null,
      message ? el('p', { class: 'app-dialog__msg', text: message }) : null,
      inputEl,
      el('.app-dialog__actions', {}, [
        el('button.btn', { onclick: onCancel }, [cancelText]),
        el('button' + (danger ? '.btn.btn--danger' : '.btn.btn--brand'), { onclick: onConfirm }, [confirmText]),
      ]),
    ]);
    const ov = el('.app-dialog', { onclick: e => { if (e.target === ov) onCancel(); } }, [card]);
    document.body.appendChild(ov);
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => { ov.classList.add('is-on'); if (inputEl) { inputEl.focus(); inputEl.select(); } });
  });
}
const confirmDialog = opts => appDialog(opts);                                            // → true / false
const promptDialog = opts => appDialog({ ...opts, promptValue: opts.value != null ? opts.value : '' }); // → string / null

// ---------- Global search ----------
let searchIndex = null;
function buildSearchIndex() {
  const idx = [];
  allPois.forEach(p => idx.push({ kw: (p.name + ' ' + (p.jp || '') + ' ' + (p.cityName || '')).toLowerCase(), label: p.name, sub: (p.cityName || '') + (p.jp ? ' · ' + p.jp : ''), emoji: p.emoji || '📍', run: () => { closeSheets(); showOnMap(p.name); } }));
  DAYS.forEach((d, i) => idx.push({ kw: (d.title + ' ' + d.date + ' ' + ((cityByKey[d.cityKey] || {}).name || '')).toLowerCase(), label: `Day ${i + 1} · ${d.title}`, sub: `${d.date}（週${d.dow}）`, emoji: '🗓️', run: () => { closeSheets(); openDay(i + 1); } }));
  ROUTES.forEach(r => idx.push({ kw: (r.from + ' ' + r.to + ' ' + (r.line || '')).toLowerCase(), label: `${r.from} → ${r.to}`, sub: r.line || '交通', emoji: '🚆', run: () => { closeSheets(); goTab('route'); setRouteSeg('trips'); } }));
  Object.keys(SOUVENIRS).forEach(k => { const c = cityByKey[k] || { name: k }; idx.push({ kw: ('伴手禮 omiyage ' + c.name).toLowerCase(), label: `${c.name} 伴手禮`, sub: '必買清單', emoji: '🎁', run: () => { closeSheets(); goSouvenirs(k); } }); });
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

  // Language / 語言
  body.appendChild(el('.h-section', { text: '語言 / Language' }));
  const langRow = el('.row', { style: { gap: '8px', margin: '10px 0 18px' } });
  const curLang = (window.PlanAII18n ? window.PlanAII18n.getLang() : 'zh');
  [['zh', '繁體中文'], ['en', 'English']].forEach(([v, l]) => {
    langRow.appendChild(el('button.chip.chip--tap' + (curLang === v ? '.is-on' : ''), {
      onclick: () => { if (window.PlanAII18n) window.PlanAII18n.setLang(v); openSettings(); },
    }, l));
  });
  body.appendChild(langRow);

  // AI engine
  body.appendChild(el('.h-section', { text: 'AI 旅伴' }));
  body.appendChild(el('p', { class: 'tiny muted', style: { margin: '8px 0 12px', lineHeight: '1.6' }, text: '正式部署：在伺服器（Cloudflare Pages）設定 AI 服務金鑰即可，金鑰留在伺服器端、不外洩。本機測試可在此貼上你的金鑰改用瀏覽器直連。' }));
  const keyIn = el('input', { type: 'password', value: localStorage.getItem('kp_gemini_key') || '', placeholder: '貼上 API 金鑰（可多把，用逗號分隔）', style: inputStyle() });
  body.appendChild(el('label', { class: 'tiny muted-3', text: 'AI 服務金鑰' }));
  body.appendChild(keyIn);
  body.appendChild(el('.tiny.muted-3', { style: { marginTop: '4px', lineHeight: '1.6' }, text: '可貼多把金鑰（用逗號分隔）；某一把達到額度上限時會自動換下一把。' }));
  body.appendChild(el('button.btn.btn--brand.btn--block', { style: { marginTop: '12px' }, onclick: () => {
    if (keyIn.value.trim()) localStorage.setItem('kp_gemini_key', keyIn.value.trim()); else localStorage.removeItem('kp_gemini_key');
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
  body.appendChild(el('button.btn.btn--block', { style: { marginTop: '10px' }, onclick: () => Notify.testNotify() }, ['發送測試通知']));
}
// ---------- First-run onboarding (tutorial → add to home screen) ----------
// Uses a fresh flag so EXISTING users also see it once from now.
function maybeOnboard() {
  if (store.get('kp_onboarded_v1', false)) return;
  setTimeout(() => { if (!store.get('kp_onboarded_v1', false)) showOnboarding(); }, 550);
}
function finishOnboard(ov) { store.set('kp_onboarded_v1', true); if (ov) { ov.classList.remove('is-on'); setTimeout(() => { try { ov.remove(); } catch {} }, 260); } }
function installNow() {
  if (window.__bip) { try { window.__bip.prompt(); window.__bip.userChoice.then(r => { if (r && r.outcome === 'accepted') toast('已加入主畫面！'); window.__bip = null; }).catch(() => {}); return; } catch {} }
  openInstallGuide();
}
function showOnboarding() {
  const pw = pwaState();
  const steps = [
    { emoji: '🧭', title: '歡迎使用 Plan AI', body: '用 AI 規劃「任何國家」的旅程 — 說出目的地與日期，幾秒就幫你排好整趟行程。' },
    { emoji: '✨', title: 'AI 幫你排、隨時調整', body: '在主頁或「旅伴」分頁打字，AI 會建立並調整行程；地圖、天氣、預算與 PDF 匯出都內建。' },
    { emoji: '🤝', title: '和朋友一起規劃', body: '用「邀請朋友 → 共同編輯」即時共編同一份行程，還能在「同行聊天」用 @ai 一起規劃。' },
    { emoji: '📲', title: '加入主畫面，像 App 一樣用', body: pw.standalone ? '你已經安裝好了，讚！直接開始規劃吧。' : '把 Plan AI 加到手機／電腦桌面：全螢幕、可離線、開啟更快。', install: !pw.standalone },
  ];
  let i = 0;
  const card = el('.onb__card', {});
  const ov = el('.onb', { onclick: e => { if (e.target === ov) finishOnboard(ov); } }, [card]);
  const render = () => {
    const s = steps[i], last = i === steps.length - 1;
    clear(card);
    card.appendChild(el('.onb__emoji', { text: s.emoji }));
    card.appendChild(el('.onb__title', { text: s.title }));
    card.appendChild(el('p', { class: 'onb__body', text: s.body }));
    card.appendChild(el('.onb__dots', {}, steps.map((_, k) => el('span.onb__dot' + (k === i ? '.is-on' : ''), {}))));
    const acts = el('.onb__actions', {});
    if (!last) {
      acts.appendChild(el('button.btn.btn--brand.btn--block', { onclick: () => { i++; render(); } }, ['下一步']));
      acts.appendChild(el('button.btn.btn--block', { style: { marginTop: '8px' }, onclick: () => finishOnboard(ov) }, ['略過']));
    } else if (s.install) {
      acts.appendChild(el('button.btn.btn--brand.btn--block', { onclick: () => { finishOnboard(ov); installNow(); } }, [icon('i-install'), '加入主畫面']));
      acts.appendChild(el('button.btn.btn--block', { style: { marginTop: '8px' }, onclick: () => finishOnboard(ov) }, ['稍後再說']));
    } else {
      acts.appendChild(el('button.btn.btn--brand.btn--block', { onclick: () => finishOnboard(ov) }, ['開始使用']));
    }
    card.appendChild(acts);
  };
  document.body.appendChild(ov); render();
  requestAnimationFrame(() => ov.classList.add('is-on'));
}

function maybeNotifyIntro() {
  if (!store.get('kp_onboarded_v1', false)) return;   // let onboarding go first
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

// ---- Collaborative ("旅伴") live state ----
let currentCollab = null;        // collab code when the active plan is collaborative
let collabUnsub = null, msgUnsub = null, collabTimer = null;
let collabApplying = false;      // guard: don't echo remote changes back
let collabMsgs = [];             // group-chat messages of the active collab plan
let collabMembers = {};          // uid -> { name, ts }
let currentAccess = null;        // access map of the active collab plan { general, people, owner }
let aiMode = 'ai';               // '旅伴' tab sub-mode: 'ai' (規劃) | 'chat' (同行聊天)
const CLIENT_ID = Math.random().toString(36).slice(2, 10);   // distinguishes my own writes

// ---- Roles (Google-Docs-style): owner > editor > commenter > viewer ----
const ROLE_LABEL = { owner: '擁有者', editor: '編輯者', commenter: '可留言', viewer: '檢視者' };
const emailKey = e => (e || '').trim().toLowerCase();
// My role on the ACTIVE plan. Non-collaborative (local) plans are always fully mine.
function myRole() {
  if (!currentCollab) return 'owner';
  const a = currentAccess || {};
  if (fb.user && a.owner && a.owner === fb.user.uid) return 'owner';
  const mine = fb.user && a.people && a.people[emailKey(fb.user.email)];
  if (mine && mine.role) return mine.role;
  const g = a.general || 'editor';                 // missing access ⇒ legacy all-editors behaviour
  return g === 'restricted' ? null : g;            // null ⇒ no access at all
}
const canEdit = () => ['owner', 'editor'].includes(myRole());
const canComment = () => ['owner', 'editor', 'commenter'].includes(myRole());
const isOwnerRole = () => myRole() === 'owner';
const READONLY = { ok: false, msg: '唯讀：你目前沒有這份行程的編輯權限' };

// ---- Community feed: visibility, ranking, filters ----
// Visibility a plan owner can choose (stored on collab/{code}.visibility):
const VIS_OPTS = [
  ['private', '🔒 私人', '只有你邀請的人能看'],
  ['link', '🔗 知道連結的人', '拿到連結的人都能開'],
  ['public', '🌐 公開', '任何人都能瀏覽（唯讀）'],
  ['community', '🌟 社群', '發佈到社群，大家都看得到、可複製'],
];
// Travel-mode tags = the same chips the AI wizard uses (single source of truth).
const TRAVEL_THEMES = ['美食', '自然風景', '歷史文化', '購物', '親子', '網美打卡', '溫泉放鬆', '夜生活'];
const REGIONS = ['東亞', '東南亞', '南亞', '歐洲', '北美', '中美', '南美', '中東', '非洲', '大洋洲'];
const COUNTRY_TO_REGION = {
  '台灣': '東亞', '臺灣': '東亞', '日本': '東亞', '韓國': '東亞', '南韓': '東亞', '香港': '東亞', '澳門': '東亞', '中國': '東亞', '蒙古': '東亞',
  '泰國': '東南亞', '越南': '東南亞', '柬埔寨': '東南亞', '寮國': '東南亞', '緬甸': '東南亞', '馬來西亞': '東南亞', '新加坡': '東南亞', '印尼': '東南亞', '菲律賓': '東南亞', '汶萊': '東南亞',
  '印度': '南亞', '尼泊爾': '南亞', '斯里蘭卡': '南亞', '孟加拉': '南亞', '巴基斯坦': '南亞', '不丹': '南亞', '馬爾地夫': '南亞',
  '法國': '歐洲', '德國': '歐洲', '義大利': '歐洲', '西班牙': '歐洲', '葡萄牙': '歐洲', '英國': '歐洲', '愛爾蘭': '歐洲', '瑞士': '歐洲', '奧地利': '歐洲', '荷蘭': '歐洲', '比利時': '歐洲', '捷克': '歐洲', '波蘭': '歐洲', '匈牙利': '歐洲', '希臘': '歐洲', '克羅埃西亞': '歐洲', '丹麥': '歐洲', '瑞典': '歐洲', '挪威': '歐洲', '芬蘭': '歐洲', '冰島': '歐洲', '俄羅斯': '歐洲',
  '美國': '北美', '加拿大': '北美',
  '墨西哥': '中美', '古巴': '中美', '哥斯大黎加': '中美', '瓜地馬拉': '中美',
  '巴西': '南美', '阿根廷': '南美', '智利': '南美', '秘魯': '南美', '哥倫比亞': '南美', '玻利維亞': '南美',
  '阿聯酋': '中東', '杜拜': '中東', '沙烏地阿拉伯': '中東', '土耳其': '中東', '以色列': '中東', '約旦': '中東', '卡達': '中東',
  '埃及': '非洲', '南非': '非洲', '摩洛哥': '非洲', '肯亞': '非洲', '坦尚尼亞': '非洲',
  '澳洲': '大洋洲', '紐西蘭': '大洋洲', '斐濟': '大洋洲', '帛琉': '大洋洲', '關島': '大洋洲',
};
const regionOf = country => COUNTRY_TO_REGION[(country || '').trim()] || '';
// Hacker-News-style gravity: recent + liked rises; pure client-side, no cron.
function hotScore(likeCount, createdAtMs) {
  const ageHours = Math.max(0, (Date.now() - (createdAtMs || 0)) / 3.6e6);
  return ((likeCount || 0) + 1) / Math.pow(ageHours + 2, 1.2);
}
// Community-tab UI state (persists across segment toggles within a session).
let communityMode = false;
let communitySort = 'hot';                 // 'hot' | 'recent' | 'top'
let communityFilters = { country: '', region: '', themes: [] };
let communityCache = [];                    // last feedList() result
let communityLiked = new Set();             // codes the user has liked
let communityLoaded = false;
let communityReq = 0;                       // monotonic load token (ignore stale completions)

const uid = () => Math.random().toString(36).slice(2, 9);
const plansMeta = () => store.get('kp_plans', []);
const setPlansMeta = a => store.set('kp_plans', a);
function fmtAgo(ts) {
  if (!ts) return '剛剛'; const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return '剛剛'; if (m < 60) return m + ' 分鐘前'; const h = Math.floor(m / 60);
  if (h < 24) return h + ' 小時前'; return Math.floor(h / 24) + ' 天前';
}

// Run a DOM-swap inside a View Transition for a smooth cross-fade; no-op fallback
// where unsupported or when the user prefers reduced motion.
function withVT(fn) {
  if (!document.startViewTransition || reduceMotion()) { fn(); return; }
  try { document.startViewTransition(fn); } catch { fn(); }
}
function showScreen(name) {
  withVT(() => {
    ['home', 'plans', 'detail'].forEach(s => { const e = $('#screen-' + s); if (e) e.hidden = name !== s; });
    const app = $('#app'); if (app) app.hidden = name !== 'app';
    if (name !== 'app') closeSheets();
    if (name === 'home') renderHome();
    if (name === 'plans') renderPlans();
    if (name === 'app') maybeNotifyIntro();
    if (name === 'plans' || name === 'app') maybeOnboard();   // first-run tutorial → add to home screen
    window.scrollTo({ top: 0 });
  });
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
  pushCollab();   // mirror local edits to the live shared plan (if collaborative)
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
  searchIndex = null;   // drop stale global-search cache so it rebuilds for the new plan
  const todayEntry = dayByDate[ymd(new Date())]; selectedDay = todayEntry ? todayEntry.index : 0;
  if (CITIES[0] && CITIES[0].key) wxCity = CITIES[0].key;
  renderToday(); renderDayPicker(); renderDayDetail(selectedDay);
  buildRoutePages(); try { refreshMap({ rail: isKyushuPlan() }); } catch {}
  buildWeatherPicker(); renderWeatherHero(); renderWeatherCity(wxCity, $('#wxRoot'));
  buildGiftPicker(); renderGifts();
  updateAppbarTitle(); updatePlanCount();
  renderRoleBanner();
}
function openPlan(id) {
  if (!plansMeta().some(p => p.id === id)) return;
  snapshotCurrent();
  currentPlanId = id; store.set('kp_current', id);
  loadPlanState(id);
  aiMode = 'ai'; editMode = false;   // never carry edit mode across plans (esp. into a read-only one)
  const meta = plansMeta().find(p => p.id === id);
  if (meta && meta.collab && collabReady()) startCollab(meta.collab); else stopCollab();
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
// Quick plan switcher (tap the app-bar title) — switch trips without leaving the planner.
function openPlanSwitcher() {
  $('#sheetTitle').textContent = '切換計劃';
  const b = clear($('#sheetBody'));
  const metas = plansMeta();
  if (!metas.length) b.appendChild(el('.tiny.muted-3', { text: '還沒有任何計劃。' }));
  metas.forEach(m => b.appendChild(el('.switch-row' + (m.id === currentPlanId ? '.is-current' : ''), { onclick: () => { closeSheets(); if (m.id !== currentPlanId) openPlan(m.id); } }, [
    el('.switch-row__ico', { text: m.emoji || '🗺️' }),
    el('.switch-row__body', {}, [el('b', { text: m.title }), el('.tiny.muted-3', { text: m.id === currentPlanId ? '目前開啟中' : '更新 ' + fmtAgo(m.updatedAt) })]),
    m.id === currentPlanId ? el('span.chip', { text: '✓' }) : null,
  ])));
  b.appendChild(el('button.btn.btn--block', { style: { marginTop: '14px' }, onclick: () => { closeSheets(); snapshotCurrent(); showScreen('plans'); } }, [icon('i-grid'), '我的計劃（全部・新建）']));
  openSheet('sheet');
}
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
// Coerce an AI-supplied transit leg / route into the shape routeBlock() renders.
function normLeg(l) { return { dep: l.dep || '—', arr: l.arr || '—', line: l.line || '', type: l.type || 'local', dur: l.dur || '', ...(l.note ? { note: l.note } : {}) }; }
function normRoute(r) { if (!r || typeof r !== 'object') return null; return { fromStn: r.fromStn || '', toStn: r.toStn || '', fare: r.fare || '', pass: r.pass || '', legs: Array.isArray(r.legs) ? r.legs.map(normLeg) : [] }; }
function normalizeModel(res) {
  const cities = (res.cities || []).map((c, i) => ({
    key: c.key || ('c' + i), name: c.name || c.en || ('城市' + (i + 1)), jp: c.en || '', flag: c.emoji || '📍',
    lat: +c.lat, lng: +c.lng, color: c.color || PALETTE[i % PALETTE.length], station: c.station || '',
    blurb: c.blurb || '', pois: (c.pois || []).map(p => ({ name: p.name, jp: p.en || '', lat: +p.lat, lng: +p.lng, emoji: p.emoji || '📍', tag: p.tag || 'see', desc: p.desc || '', hours: p.hours || '', fee: p.fee || '' })).filter(p => p.name),
  })).filter(c => c.name);
  // De-dupe city keys — a clash would collapse cityByKey/dayByDate lookups.
  // Use a per-city incrementing counter so the candidate always changes (a fixed
  // suffix could spin forever if the suffixed key is itself already taken).
  const seenK = new Set();
  cities.forEach(c => { let k = c.key, n = 1; while (seenK.has(k)) k = c.key + '-' + (n++); c.key = k; seenK.add(k); });
  const keys = new Set(cities.map(c => c.key));
  const fallbackKey = (cities[0] && cities[0].key) || '';
  const num = v => (v != null && v !== '' && !isNaN(+v));
  const days = (res.days || []).map((d, i) => {
    const ck = keys.has(d.cityKey) ? d.cityKey : fallbackKey;
    const wk = keys.has(d.weatherKey) ? d.weatherKey : ck;   // honor AI weatherKey, fall back to the day's city
    const items = (d.items || []).map(it => ({
      time: it.time || '', type: it.type || 'see', title: it.title || '',
      ...(it.jp || it.en ? { jp: it.jp || it.en } : {}),
      desc: it.desc || '',
      ...(it.cost ? { cost: it.cost } : {}),
      ...(it.dur ? { dur: it.dur } : {}),
      ...(num(it.lat) && num(it.lng) ? { lat: +it.lat, lng: +it.lng } : {}),
      ...(it.type === 'move' && it.route ? { route: normRoute(it.route) } : {}),
    })).filter(it => it.title);
    items.sort((a, b) => parseHM(a.time) - parseHM(b.time));   // keep the day in chronological order
    return {
      date: d.date || '', dow: d.dow || dowOf(d.date), cityKey: ck, weatherKey: wk,
      title: d.title || ('Day ' + (i + 1)), summary: d.summary || '',
      items,
    };
  }).filter(d => d.date);
  days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  // Drop duplicate dates (keep first) — chunked long-trip builds can overlap, and a
  // dup would collapse dayByDate and misalign Day-N numbering / 今日 lookup.
  const seenD = new Set();
  for (let i = 0; i < days.length; i++) { if (seenD.has(days[i].date)) { days.splice(i, 1); i--; } else seenD.add(days[i].date); }
  days.forEach(d => { d.dow = dowOf(d.date) || d.dow; });
  // Souvenirs: schema delivers an ARRAY of {cityKey, items[]} -> convert to the
  // keyed map the 伴手禮 tab reads; keep only entries matching a real city key.
  const souvenirs = {};
  const addSouv = (key, arr) => {
    const k = keys.has(key) ? key : (cities.find(c => c.name === key || c.jp === key) || {}).key;
    if (!k || !Array.isArray(arr)) return;
    const list = arr.map(s => ({ name: s.name || '', emoji: s.emoji || '🎁', desc: s.desc || '', where: s.where || '', price: s.price || '' })).filter(s => s.name);
    if (list.length) souvenirs[k] = (souvenirs[k] || []).concat(list);
  };
  if (Array.isArray(res.souvenirs)) res.souvenirs.forEach(s => s && addSouv(s.cityKey, s.items));
  else if (res.souvenirs && typeof res.souvenirs === 'object') for (const [k, arr] of Object.entries(res.souvenirs)) addSouv(k, arr);
  // Emergency: sanitize offices so renderEmergency never crashes on missing tel/emg.
  const emg = res.emergency || {};
  const emergency = {
    numbers: Array.isArray(emg.numbers) ? emg.numbers.map(n => ({ label: n.label || '緊急', num: String(n.num || ''), emoji: n.emoji || '📞' })).filter(n => n.num) : [],
    offices: Array.isArray(emg.offices) ? emg.offices.map(o => ({ name: o.name || '', area: o.area || '', addr: o.addr || '', tel: String(o.tel || ''), emg: String(o.emg || o.tel || '') })).filter(o => o.name && o.tel) : [],
    ...(emg.taiwanLine ? { taiwanLine: emg.taiwanLine } : {}),
    ...(Array.isArray(emg.steps) ? { steps: emg.steps } : {}),
  };
  const trip = res.trip || {};
  return {
    trip: {
      title: trip.title || '我的行程', subtitle: trip.subtitle || '', emoji: trip.emoji || (cities[0] && cities[0].flag) || '🗺️',
      start: trip.start || (days[0] && days[0].date) || '', end: trip.end || (days[days.length - 1] && days[days.length - 1].date) || '',
      days: days.length, base: trip.base || '', country: trip.country || '', note: trip.note || '',
    },
    cities, days,
    routes: (res.routes || []).filter(r => r.from && r.to).map(r => ({
      from: r.from, to: r.to, fromStn: r.fromStn || '', toStn: r.toStn || '', line: r.line || '',
      summary: r.summary || '', fare: r.fare || '', pass: r.pass || '', tip: r.tip || '',
      legs: Array.isArray(r.legs) ? r.legs.map(normLeg) : [], icon: (r.legs && r.legs.length) ? 'i-train' : 'i-route',
    })),
    pass: (res.pass && res.pass.best) ? res.pass : null,
    souvenirs, tide: null,
    budget: (res.budget && res.budget.fixed) ? res.budget : { fixed: [], mealsPerDay: (res.budget && res.budget.mealsPerDay) || 1500, hotelPerNight: (res.budget && res.budget.hotelPerNight) || 4000, nights: Math.max(0, days.length - 1) },
    currency: (trip.currency && trip.currency.symbol) ? trip.currency : { symbol: '', rate: 1, note: '' },
    emergency,
    packing: Array.isArray(res.packing) ? res.packing : [],
  };
}
// Apply an AI trip JSON to the CURRENT plan (used by the chat plan_trip tool).
function applyModel(res) {
  if (!canEdit()) return READONLY;
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
  // Linkage: jump to the itinerary so the user immediately SEES the built trip
  // (the AI's summary stays in the 旅伴 chat to switch back to).
  setTimeout(() => { try { openDay(1); } catch {} }, 200);
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

// Ask the user for missing essentials before building. Every question is optional
// (a 略過 button always builds anyway), so this nudges without ever blocking. The plan
// already exists by the time this shows, so submit builds INTO it (no duplicate plan).
let pendingAnswers = null;
function askTripInfo(text, needInfo, prev, titleHint) {
  $('#sheetTitle').textContent = '再補幾項，AI 排得更準';
  const b = clear($('#sheetBody'));
  b.appendChild(el('p', { class: 'muted', style: { fontSize: '14px' }, text: '看起來還缺一些資訊。補上以下任一項會讓行程更貼近你，也可以直接略過讓 AI 幫你決定：' }));
  const inputs = [];
  (needInfo || []).slice(0, 4).forEach(q => {
    b.appendChild(el('label', { class: 'tiny muted-3', style: { marginTop: '12px', display: 'block', fontWeight: '600' }, text: q.question || '請補充' }));
    const inp = el('input', { type: q.type || 'text', placeholder: q.hint || '', style: inputStyle() });
    inputs.push([q.key || q.question, inp]); b.appendChild(inp);
  });
  b.appendChild(el('button.btn.btn--brand.btn--block', { style: { marginTop: '16px' }, onclick: () => {
    const answers = { ...(prev || {}) };
    inputs.forEach(([k, inp]) => { if (inp.value.trim()) answers[k] = inp.value.trim(); });
    closeSheets(); buildCurrentTrip(text, answers, titleHint);
  } }, [icon('i-ai'), '開始建立行程']));
  b.appendChild(el('button.btn.btn--block', { style: { marginTop: '8px' }, onclick: () => { closeSheets(); buildCurrentTrip(text, { ...(prev || {}), _skip: true }, titleHint); } }, ['略過，直接幫我安排']));
  openSheet('sheet');
}

// Build a trip with AI. ALWAYS creates the plan first (so it shows in 首頁 even if
// generation fails — never a silent vanish), opens it, then builds it in ONE direct
// generation call (fewer calls than the chat loop → far less quota pressure).
// `preQuestions` (deterministic wizard gaps) are asked first; empty text just opens chat.
function aiCreatePlan(text, titleHint, answers, preQuestions) {
  const t = (text || '').trim();
  store.set('kp_entered', true);
  const title = (titleHint && titleHint.trim()) ? titleHint.trim().slice(0, 20) : (t ? ('AI · ' + t.slice(0, 14)) : 'AI 行程');
  const id = createPlan({ title, model: blankModel({ title }), base: 'custom', emoji: '✨' });
  openPlan(id);
  if (!t) { goTab('ai'); toast('跟 AI 說你想去哪、玩幾天，就幫你排好整趟 ✨'); return; }
  const ans = answers || pendingAnswers; pendingAnswers = null;
  if (preQuestions && preQuestions.length) { askTripInfo(t, preQuestions, ans, titleHint); return; }
  buildCurrentTrip(t, ans, titleHint);
}
// Generate the trip into the CURRENT (already-created) plan, with a visible overlay,
// chunk progress for long trips, programmatic needInfo, and recoverable errors.
async function buildCurrentTrip(text, answers, titleHint) {
  const t = (text || '').trim(); if (!t) return;
  showGenProgress('AI 正在規劃你的行程…');
  let res;
  try {
    res = await generateTripPlan({ prompt: t, answers, onProgress: (built, total) => {
      const gt = document.getElementById('genTitle');
      if (gt && total > 14) gt.textContent = `規劃中… 已完成 ${built}/${total} 天`;
    } });
  } catch (e) {
    hideGenProgress();
    const m = e.message === 'NO_KEY'
      ? '尚未設定 AI 金鑰。請到「設定」貼上你的 API 金鑰，或部署後在伺服器設定金鑰。'
      : e.message === 'RATE_LIMIT'
      ? 'AI 用量已達上限（配額／速率限制）。請稍等一兩分鐘再試，或在「設定」改用自己的 API 金鑰。'
      : e.message === 'BUSY'
      ? 'AI 模型暫時忙線／過載（這跟金鑰無關）。請稍等幾秒再按一次「建立」，通常重試就會成功。'
      : e.message === 'TRUNCATED'
      ? '行程內容過長被截斷了。請把天數先排短一點（例如先 3–6 天）再續排，或稍後在「旅伴」用聊天逐日補上。'
      : e.message === 'BLOCKED'
      ? 'AI 因內容安全限制無法產生這份行程，請換個描述或目的地再試一次。'
      : e.message === 'OFFLINE'
      ? '目前似乎沒有網路連線，請連上網路後再試。'
      : '建立行程時連線發生問題：' + e.message;
    appDialog({ title: 'AI 暫時無法建立行程', message: m + '\n\n已先幫你建立一份空白行程，可稍後在「旅伴」用聊天重試，或手動編輯。', confirmText: '前往旅伴', cancelText: '知道了' }).then(go => { if (go) goTab('ai'); });
    return;
  }
  hideGenProgress();
  if (res && res.needInfo && res.needInfo.length) { askTripInfo(t, res.needInfo, answers, titleHint); return; }
  const r = applyModel(res);
  if (!r || r.ok === false) appDialog({ title: '行程內容不足', message: (r && r.msg) || '請再描述清楚一點（目的地、天數），或到「旅伴」用聊天調整。', confirmText: '前往旅伴', cancelText: '知道了' }).then(go => { if (go) goTab('ai'); });
  else { const built = (res.days || []).length, want = parseInt((titleHint || '').match(/(\d+)\s*日\s*$/)?.[1] || '0', 10); toast(want && built < want ? `✨ 已先排好前 ${built} 天（其餘可稍後續排）` : '✨ 行程建立完成！'); }
}
function homeAiCreate(text) { const t = (text || '').trim(); if (!t) return; aiCreatePlan(t); }

// ✨ AI 一鍵建立 — guided Q&A wizard. Collects structured answers so the AI has
// everything it needs, then builds the whole trip (chat flow).
// Assemble the wizard answers into a single structured request line.
function buildWizPrompt(st) {
  const p = [`目的地：${st.dest.trim()}`, `天數：${st.days} 天`];
  if (st.date) p.push(`出發日期：${st.date}`);
  if (st.origin.trim()) p.push(`出發地：${st.origin.trim()}`);
  if (st.pace) p.push(`節奏：${st.pace}`);
  if (st.themes.length) p.push(`偏好：${st.themes.join('、')}`);
  if (st.budget) p.push(`預算：${st.budget}`);
  if (st.party) p.push(`同行：${st.party}`);
  if (st.extra.trim()) p.push(`其他：${st.extra.trim()}`);
  return p.join('；');
}
// Check whether the wizard has enough to build a GOOD plan. Only nudges when the
// form was left almost empty (basically just a destination); otherwise builds straight.
function assessTrip(st) {
  const need = [];
  const engaged = !!(st.date || st.origin.trim() || st.themes.length || st.extra.trim());
  if (engaged) return need;
  need.push({ key: '出發日期', type: 'date', question: '大約什麼時候出發？', hint: '影響天氣與票價（可留空）' });
  need.push({ key: '出發地', question: '從哪裡出發？', hint: '幫你安排機場與長途交通，例：台北（可留空）' });
  need.push({ key: '偏好', question: '這趟想以什麼為主？', hint: '例：美食、自然風景、歷史文化、親子…（可留空）' });
  return need;
}
function wizChips(opts, { selected = '', multi = false, arr = null, onSel } = {}) {
  const row = el('.chiprow', { style: { marginTop: '6px', flexWrap: 'wrap' } });
  opts.forEach(o => {
    const on = multi ? false : (o === selected);
    const c = el('button.chip.chip--tap' + (on ? '.is-on' : ''), { onclick: () => {
      if (multi) { const i = arr.indexOf(o); if (i >= 0) { arr.splice(i, 1); c.classList.remove('is-on'); } else { arr.push(o); c.classList.add('is-on'); } }
      else { [...row.children].forEach(x => x.classList.remove('is-on')); c.classList.add('is-on'); onSel && onSel(o); }
    } }, o);
    row.appendChild(c);
  });
  return row;
}
function openAiWizard() {
  store.set('kp_entered', true);
  $('#sheetTitle').textContent = '✨ AI 一鍵建立行程';
  const b = clear($('#sheetBody'));
  b.appendChild(el('p', { class: 'muted', style: { fontSize: '14px', marginBottom: '4px' }, text: '回答幾題，AI 就幫你排好整趟行程。只有「目的地」必填，其餘留空 AI 會自行判斷。' }));
  const lbl = t => el('label', { class: 'tiny muted-3', style: { marginTop: '13px', display: 'block', fontWeight: '600' }, text: t });
  const st = { dest: '', days: '5', date: '', origin: '', pace: '適中', themes: [], budget: '', party: '', extra: '' };

  b.appendChild(lbl('想去哪？（必填）'));
  const destIn = el('input', { type: 'text', placeholder: '例：東京、巴黎、北海道、義大利、首爾', style: inputStyle(), oninput: e => st.dest = e.target.value });
  b.appendChild(destIn);

  b.appendChild(lbl('玩幾天？'));
  const daysInput = el('input', { type: 'number', min: '1', max: '365', value: st.days, inputmode: 'numeric',
    style: { ...inputStyle(), maxWidth: '130px', marginTop: '0' },
    oninput: e => { st.days = (e.target.value || '').replace(/[^0-9]/g, ''); [...dayChipRow.children].forEach(x => x.classList.remove('is-on')); } });
  const dayChipRow = wizChips(['3 天', '5 天', '7 天', '10 天', '14 天'], { selected: '5 天', onSel: v => { st.days = v.replace(/[^0-9]/g, ''); daysInput.value = st.days; } });
  b.appendChild(dayChipRow);
  b.appendChild(el('.row', { style: { alignItems: 'center', gap: '8px', marginTop: '8px' } }, [el('span.tiny.muted-3', { text: '或自訂：' }), daysInput, el('span.tiny.muted-3', { text: '天（1–365，玩一年也行）' })]));

  b.appendChild(lbl('出發日期（選填）'));
  b.appendChild(el('input', { type: 'date', style: inputStyle(), oninput: e => st.date = e.target.value }));

  b.appendChild(lbl('從哪出發？（選填，幫你算交通與機場）'));
  b.appendChild(el('input', { type: 'text', placeholder: '例：台北桃園', style: inputStyle(), oninput: e => st.origin = e.target.value }));

  b.appendChild(lbl('旅遊節奏'));
  b.appendChild(wizChips(['輕鬆', '適中', '緊湊'], { selected: '適中', onSel: v => st.pace = v }));

  b.appendChild(lbl('想要的主題（可複選）'));
  b.appendChild(wizChips(['美食', '自然風景', '歷史文化', '購物', '親子', '網美打卡', '溫泉放鬆', '夜生活'], { multi: true, arr: st.themes }));

  b.appendChild(lbl('預算（選填）'));
  b.appendChild(wizChips(['平價', '中等', '高級'], { onSel: v => st.budget = v }));

  b.appendChild(lbl('同行（選填）'));
  b.appendChild(wizChips(['一人', '情侶', '家庭', '朋友'], { onSel: v => st.party = v }));

  b.appendChild(lbl('其他需求（選填）'));
  b.appendChild(el('textarea', { rows: '2', placeholder: '例：想吃拉麵、要去迪士尼、避免太多走路…', style: { ...inputStyle(), resize: 'vertical' }, oninput: e => st.extra = e.target.value }));

  b.appendChild(el('button.btn.btn--brand.btn--block', { style: { marginTop: '18px' }, onclick: () => {
    if (!st.dest.trim()) { toast('請先填想去的目的地'); destIn.focus(); return; }
    st.days = String(Math.max(1, Math.min(365, parseInt(st.days, 10) || 5)));   // clamp custom days
    const prompt = buildWizPrompt(st);
    const titleHint = `${st.dest.trim()} ${st.days} 日`;
    const need = assessTrip(st);                       // 缺資訊就先問，覺得不夠全才追問
    closeSheets();
    aiCreatePlan(prompt, titleHint, null, need);       // create plan → ask gaps (if any) → build
  } }, [icon('i-ai'), '一鍵建立行程']));
  b.appendChild(el('p', { class: 'tiny muted-3', style: { marginTop: '10px', lineHeight: '1.6' }, text: '建立後可在「旅伴」用聊天繼續微調。' }));
  openSheet('sheet');
}

// ---- Importing a legacy "copy" share (old ?plan=<code> links) ----
// New shares are live + permissioned (see openShareSheet); this keeps old
// copy-links working: it loads a one-off editable COPY (Firestore `shared/` or KV).
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

// ---- Share & permissions (Google-Docs-style) -------------------------------
const PERSON_ROLES = [['editor', '編輯者'], ['commenter', '可留言'], ['viewer', '檢視者']];
const GENERAL_OPTS = [['restricted', '限定 · 只有被加入的人'], ['viewer', '知道連結的人 · 檢視'], ['commenter', '知道連結的人 · 可留言'], ['editor', '知道連結的人 · 可編輯']];
function roleForDoc(doc) {
  if (!doc) return null;
  if (fb.user && doc.owner === fb.user.uid) return 'owner';
  const mine = fb.user && doc.access && doc.access.people && doc.access.people[emailKey(fb.user.email)];
  if (mine && mine.role) return mine.role;
  const g = (doc.access && doc.access.general) || 'editor';
  return g === 'restricted' ? null : g;
}
function selectStyle() { return { ...inputStyle(), marginTop: '0', width: 'auto', padding: '7px 9px', fontSize: '13px' }; }
function roleSelect(value, opts, onChange) {
  const sel = el('select', { style: selectStyle() });
  opts.forEach(([v, l]) => sel.appendChild(el('option', { value: v, ...(v === value ? { selected: 'selected' } : {}) }, l)));
  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}
const validEmail = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e || '');
// Build the SAFE public feed metadata from a collab doc (never copies model/members/emails/access).
function buildFeedMeta(doc, visibility, themes, countryOverride) {
  const model = (doc && doc.model) || {}; const trip = model.trip || {};
  const country = ((countryOverride != null ? countryOverride : trip.country) || '').trim();
  let ownerName = (doc.members && doc.owner && doc.members[doc.owner] && doc.members[doc.owner].name)
    || (fb.user && fb.user.displayName) || '旅人';
  if (ownerName.includes('@')) ownerName = ownerName.split('@')[0];   // never leak a full email into the PUBLIC feed
  return {
    title: (doc.meta && doc.meta.title) || trip.title || '行程',
    emoji: (doc.meta && doc.meta.emoji) || trip.emoji || '🗺️',
    country, region: regionOf(country),
    themes: (themes || []).slice(0, 8),
    days: (model.days || []).length || (+trip.days || 0),
    cityCount: (model.cities || []).length || 0,
    summary: ((trip.subtitle || '') + '').slice(0, 60),
    ownerName, visibility,
  };
}

async function openShareSheet(id) {
  $('#sheetTitle').textContent = '分享與權限';
  const b = clear($('#sheetBody'));
  openSheet('sheet');
  const m0 = plansMeta().find(p => p.id === id);

  // Live, permissioned sharing needs an account (this is what makes role control real).
  if (!collabReady()) {
    b.appendChild(el('p', { class: 'muted', style: { fontSize: '14px', lineHeight: '1.7' }, text: '用 Google 登入後即可分享這份行程，並像 Google 文件一樣控制每個人的權限（檢視／可留言／編輯）。' }));
    b.appendChild(el('button.btn.btn--brand.btn--block', { style: { marginTop: '12px' }, onclick: async () => {
      try { const u = await signInGoogle(); if (u || fb.user) openShareSheet(id); } catch (e) { toast(authErrorMessage(e)); }
    } }, [icon('i-user'), '用 Google 登入以分享']));
    b.appendChild(el('.tiny.muted-3', { style: { marginTop: '12px', lineHeight: '1.7' }, text: '（未登入也可用「匯出」做一份 PDF／JSON 備份分享，但無法控管權限。）' }));
    return;
  }

  b.appendChild(el('p', { class: 'muted', style: { fontSize: '14px', marginBottom: '8px' }, text: '管理「' + (m0 ? m0.title : '行程') + '」的存取權與成員。' }));
  const loading = el('.tiny.muted-3', { style: { margin: '10px 2px' }, text: '正在準備共享…' });
  b.appendChild(loading);

  // Ensure a live doc exists (creates with default access on first share).
  let code = m0 && m0.collab;
  try { if (!code) code = await enableCollab(id); } catch (e) { loading.textContent = '建立共享失敗：' + (e && e.message || ''); return; }
  if (!code) { loading.textContent = '無法建立共享連結'; return; }
  const link = location.origin + location.pathname + '?join=' + code;
  let pubThemes = [];          // travel-mode tags for the feed listing (persist across re-paints)
  let pubCountry = '';         // listing country (region auto-derives); editable when publishing
  let pubInit = false;
  let tagPubT = null;          // debounce timer for tag/country re-publish

  // (Re)render the whole body from the latest doc state.
  async function paint() {
    if ($('#sheetTitle').textContent !== '分享與權限') return;   // user navigated away
    let doc = null; try { doc = await collabGet(code); } catch {}
    if (!pubInit) {
      try { const ff = await feedGet(code); if (ff && Array.isArray(ff.themes)) pubThemes = ff.themes.slice(); if (ff && ff.country) pubCountry = ff.country; } catch {}
      if (!pubCountry) pubCountry = (((doc && doc.model) || {}).trip || {}).country || '';
      pubInit = true;
    }
    const role = roleForDoc(doc) || (doc && fb.user && doc.owner === fb.user.uid ? 'owner' : 'editor');
    const owner = role === 'owner';
    const access = (doc && doc.access) || { general: 'editor', people: {} };
    const people = access.people || {};

    const body = clear($('#sheetBody'));
    body.appendChild(el('p', { class: 'muted', style: { fontSize: '14px', marginBottom: '10px' }, text: '管理「' + (m0 ? m0.title : '行程') + '」的存取權與成員。' }));

    if (owner) {
      // --- Add people by email ---
      body.appendChild(el('.tiny.muted-3', { style: { fontWeight: '700', margin: '4px 2px 6px' }, text: '新增使用者' }));
      const emailIn = el('input', { type: 'email', placeholder: '輸入對方的 Google 信箱', style: { ...inputStyle(), marginTop: '0' } });
      const addRoleSel = roleSelect('editor', PERSON_ROLES, () => {});
      const addBtn = el('button.btn.btn--brand', { onclick: async () => {
        const e = emailKey(emailIn.value);
        if (!validEmail(e)) { toast('請輸入有效的 Email'); return; }
        if (fb.user && e === emailKey(fb.user.email)) { toast('那是你自己 🙂'); return; }
        try { await collabSetPersonRole(code, e, { role: addRoleSel.value, name: '', ts: Date.now() }); emailIn.value = ''; toast('已新增 ' + e); paint(); }
        catch (err) { toast('新增失敗：' + (err && err.message || '')); }
      } }, ['新增']);
      body.appendChild(el('.share-add', {}, [emailIn, el('.row', { style: { gap: '8px', marginTop: '8px', justifyContent: 'flex-end' } }, [addRoleSel, addBtn])]));

      // --- People with access ---
      body.appendChild(el('.tiny.muted-3', { style: { fontWeight: '700', margin: '16px 2px 6px' }, text: '可存取的人' }));
      body.appendChild(el('.access-row', {}, [
        el('.access-row__who', {}, [el('b', { text: (fb.user && (fb.user.displayName || fb.user.email)) || '你' }), el('.tiny.muted-3', { text: (doc && doc.ownerEmail) || (fb.user && fb.user.email) || '' })]),
        el('span.chip', { text: '擁有者' }),
      ]));
      Object.entries(people).forEach(([em, info]) => {
        body.appendChild(el('.access-row', {}, [
          el('.access-row__who', {}, [el('b', { text: info.name || em }), info.name ? el('.tiny.muted-3', { text: em }) : null]),
          roleSelect(info.role || 'viewer', PERSON_ROLES, async v => { try { await collabSetPersonRole(code, em, { ...info, role: v, ts: Date.now() }); paint(); } catch (e) { toast('更新失敗：' + (e && e.message || '')); } }),
          el('button.iconbtn', { title: '移除存取', onclick: async () => { if (!await confirmDialog({ title: '移除存取', message: `移除 ${em} 的存取權？`, confirmText: '移除', danger: true })) return; try { await collabRemovePerson(code, em); toast('已移除'); paint(); } catch (e) { toast('移除失敗：' + (e && e.message || '')); } } }, [icon('i-trash')]),
        ]));
      });

      // --- General (link) access ---
      body.appendChild(el('.tiny.muted-3', { style: { fontWeight: '700', margin: '16px 2px 6px' }, text: '一般存取權' }));
      body.appendChild(el('.access-row', {}, [
        el('.access-row__who', {}, [el('b', { text: access.general === 'restricted' ? '🔒 限定' : '🔗 知道連結的人' }), el('.tiny.muted-3', { text: access.general === 'restricted' ? '只有上方被加入的人能開啟' : '任何拿到連結的人都能開啟' })]),
        roleSelect(access.general || 'editor', GENERAL_OPTS, async v => { try { await collabSetGeneral(code, v); paint(); } catch (e) { toast('更新失敗：' + (e && e.message || '')); } }),
      ]));

      // --- Visibility / publish to community ---
      const visibility = (doc && doc.visibility) || 'link';
      const applyVisibility = async v => {
        try {
          if (v === 'private') { await collabSetGeneral(code, 'restricted'); await collabSave(code, { visibility: 'private' }); await feedUnpublish(code); }
          else if (v === 'link') { if (((doc.access && doc.access.general) || 'editor') === 'restricted') await collabSetGeneral(code, 'editor'); await collabSave(code, { visibility: 'link' }); await feedUnpublish(code); }
          else {
            // Publishing to the public feed must make the live doc READ-ONLY to link-holders:
            // force editor/commenter → viewer so the public join code can never grant live edits.
            // (Keep 'viewer', not 'restricted', so forkers can still read collab.model.)
            const g = (doc.access && doc.access.general) || 'editor';
            if (g === 'editor' || g === 'commenter') await collabSetGeneral(code, 'viewer');
            await collabSave(code, { visibility: v });
            await feedPublish(code, buildFeedMeta(doc, v, pubThemes, pubCountry));
          }
          communityLoaded = false;   // feed changed → refresh on next 社群 open
          toast(v === 'private' ? '已設為私人' : v === 'link' ? '已設為知道連結的人' : v === 'public' ? '已設為公開' : '已發佈到社群 🌟');
          paint();
        } catch (e) { toast('變更失敗：' + (e && e.message || '')); }
      };
      body.appendChild(el('.tiny.muted-3', { style: { fontWeight: '700', margin: '18px 2px 6px' }, text: '發佈與可見範圍' }));
      const visRow = el('.chiprow', { style: { flexWrap: 'wrap' } });
      VIS_OPTS.forEach(([v, label]) => visRow.appendChild(el('button.chip.chip--tap' + (visibility === v ? '.is-on' : ''), { onclick: () => applyVisibility(v) }, label)));
      body.appendChild(visRow);
      body.appendChild(el('.tiny.muted-3', { style: { margin: '4px 2px 0', lineHeight: '1.6' }, text: (VIS_OPTS.find(o => o[0] === visibility) || [])[2] || '' }));
      if (visibility === 'public' || visibility === 'community') {
        // Coalesce a burst of tag/country edits into ONE re-publish (avoids write amplification).
        const schedulePublish = () => { clearTimeout(tagPubT); tagPubT = setTimeout(async () => {
          try { await feedPublish(code, buildFeedMeta(doc, visibility, pubThemes, pubCountry)); communityLoaded = false; } catch (err) { toast('更新失敗：' + (err && err.message || '')); }
        }, 450); };
        // Country (so 國家/區域 filters work even for plans without a country); region auto-derives.
        body.appendChild(el('.tiny.muted-3', { style: { margin: '10px 2px 4px' }, text: '國家（讓別人能用國家／區域篩選到你）' }));
        const regionHint = el('.tiny.muted-3', { style: { margin: '4px 2px 0' }, text: pubCountry ? (regionOf(pubCountry) ? '區域：' + regionOf(pubCountry) : '（此國家尚未對應到區域，仍可用國家篩選）') : '建議填寫，否則不會出現在國家／區域篩選結果' });
        const dl = el('datalist', { id: 'countryList' }, Object.keys(COUNTRY_TO_REGION).map(c => el('option', { value: c })));
        const cIn = el('input', { type: 'text', list: 'countryList', value: pubCountry, placeholder: '例：日本、法國、泰國…', style: { ...inputStyle(), marginTop: '0' } });
        cIn.addEventListener('input', () => { pubCountry = cIn.value.trim(); regionHint.textContent = pubCountry ? (regionOf(pubCountry) ? '區域：' + regionOf(pubCountry) : '（此國家尚未對應到區域，仍可用國家篩選）') : '建議填寫，否則不會出現在國家／區域篩選結果'; schedulePublish(); });
        body.appendChild(cIn); body.appendChild(dl); body.appendChild(regionHint);
        // Travel-mode tags.
        body.appendChild(el('.tiny.muted-3', { style: { margin: '12px 2px 4px' }, text: '旅行模式標籤（幫助別人找到你的行程）' }));
        const tRow = el('.chiprow', { style: { flexWrap: 'wrap' } });
        TRAVEL_THEMES.forEach(t => tRow.appendChild(el('button.chip.chip--tap' + (pubThemes.includes(t) ? '.is-on' : ''), { onclick: e => {
          const i = pubThemes.indexOf(t); if (i >= 0) { pubThemes.splice(i, 1); e.currentTarget.classList.remove('is-on'); } else { pubThemes.push(t); e.currentTarget.classList.add('is-on'); }
          schedulePublish();
        } }, t)));
        body.appendChild(tRow);
      }
    } else {
      // Non-owner: show own role only.
      body.appendChild(el('.access-row', {}, [
        el('.access-row__who', {}, [el('b', { text: '你的角色' }), el('.tiny.muted-3', { text: '由擁有者設定' })]),
        el('span.chip', { text: ROLE_LABEL[role] || '檢視者' }),
      ]));
    }

    // --- Invite link (everyone) ---
    body.appendChild(el('label', { class: 'tiny muted-3', style: { display: 'block', margin: '16px 2px 2px' }, text: '邀請連結' }));
    const linkIn = el('input', { value: link, readonly: 'readonly', onclick: e => e.target.select(), style: { ...inputStyle(), fontSize: '13px' } });
    body.appendChild(linkIn);
    body.appendChild(el('.grid2', { style: { marginTop: '10px' } }, [
      el('button.btn.btn--brand', { onclick: async () => { try { await navigator.clipboard.writeText(link); toast('已複製邀請連結'); } catch { linkIn.select(); toast('請長按選取後複製'); } } }, [icon('i-copy'), '複製連結']),
      navigator.share
        ? el('button.btn', { onclick: () => navigator.share({ title: m0 ? m0.title : '我的行程', text: '一起看我的旅行行程吧！', url: link }).catch(() => {}) }, [icon('i-share'), '系統分享…'])
        : el('button.btn', { onclick: async () => { try { await navigator.clipboard.writeText(code); toast('已複製分享碼 ' + code); } catch {} } }, [icon('i-copy'), '複製分享碼']),
    ]));
    body.appendChild(el('button.btn.btn--block', { style: { marginTop: '10px' }, onclick: async () => {
      const msg = `一起來規劃「${m0 ? m0.title : '這趟旅行'}」吧！用 Plan AI 打開就能一起看／編輯每日行程、地圖與天氣：\n${link}`;
      try { await navigator.clipboard.writeText(msg); toast('已複製邀請訊息，貼到 LINE／訊息即可'); } catch { linkIn.select(); toast('請長按複製連結'); }
    } }, [icon('i-share'), '複製邀請訊息（含連結）']));
    const qr = el('img', { alt: 'QR', loading: 'lazy', src: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=' + encodeURIComponent(link), style: { width: '168px', height: '168px', display: 'block', margin: '14px auto 0', borderRadius: '14px', background: '#fff', padding: '8px', boxShadow: 'var(--shadow-1)' } });
    qr.onerror = () => { qr.style.display = 'none'; };
    body.appendChild(qr);

    if (owner) {
      body.appendChild(el('.tiny.muted-3', { style: { margin: '14px 2px 8px', lineHeight: '1.7' }, text: 'ℹ️ 用 Email 新增的人需用「該 Google 帳號」開啟連結登入（系統不會自動寄信）。' }));
      body.appendChild(el('button.btn.btn--block', { style: { color: 'var(--sakura)' }, onclick: async () => {
        if (!await confirmDialog({ title: '停止共享', message: '所有成員將失去存取權，連結也會失效，也會從社群下架。你的行程會保留為本機私人副本。', confirmText: '停止共享', danger: true })) return;
        try { await feedUnpublish(code); } catch {}   // delist BEFORE deleting collab (rules verify owner via collab)
        try { await collabDelete(code); } catch {}
        const arr = plansMeta(); const mm = arr.find(p => p.id === id); if (mm) { delete mm.collab; delete mm.share; setPlansMeta(arr); }
        if (id === currentPlanId) stopCollab();
        communityLoaded = false;
        closeSheets(); toast('已停止共享，改為本機私人行程'); renderPlans();
      } }, [icon('i-trash'), '停止共享（設為私人）']));
    } else {
      body.appendChild(el('button.btn.btn--block', { style: { marginTop: '14px', color: 'var(--sakura)' }, onclick: async () => {
        if (!await confirmDialog({ title: '離開此共享', message: '將不再同步這份行程；你目前的內容會留存為本機副本。', confirmText: '離開', danger: true })) return;
        const arr = plansMeta(); const mm = arr.find(p => p.id === id); if (mm) { delete mm.collab; delete mm.share; setPlansMeta(arr); }
        if (id === currentPlanId) { stopCollab(); renderActivePlan(); }
        closeSheets(); toast('已離開共享'); renderPlans();
      } }, [icon('i-back'), '離開此共享']));
    }
  }
  await paint();
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
  const sp = new URLSearchParams(location.search);
  const join = sp.get('join');
  if (join) { history.replaceState(null, '', location.pathname); joinCollab(join); return true; }
  const view = sp.get('view');
  if (view) { history.replaceState(null, '', location.pathname); store.set('kp_entered', true); pendingView = view; return true; }   // opened after Firebase is ready
  const c = sp.get('plan');
  if (c) { history.replaceState(null, '', location.pathname); importSharedCode(c); return true; }
  return false;
}

// ============================================================================
// Collaborative "旅伴": a live shared plan + group chat (needs login + Firestore).
// Everyone on a collab plan edits the SAME itinerary and shares one chat; in
// 同行聊天 you can type "@ai …" to hand the message to the AI to plan.
// ============================================================================
function stopCollab() {
  if (collabUnsub) { try { collabUnsub(); } catch {} }
  if (msgUnsub) { try { msgUnsub(); } catch {} }
  collabUnsub = msgUnsub = null; currentCollab = null; collabMsgs = []; collabMembers = {}; currentAccess = null;
}
// Normalise a collab doc's permissions into currentAccess (tolerates legacy docs w/o `access`).
function accessFromDoc(data) {
  return { owner: data.owner, general: (data.access && data.access.general) || 'editor', people: (data.access && data.access.people) || {} };
}
function startCollab(code) {
  if (!collabReady()) return;          // needs login + Firestore
  stopCollab(); currentCollab = code;
  collabUnsub = collabOnDoc(code, data => {
    if (!data) return;
    collabMembers = data.members || {};
    currentAccess = accessFromDoc(data);
    if (myRole() === null) { handleAccessRevoked(code); return; }   // I was removed / link set to restricted
    if (data.model && data.writer !== CLIENT_ID) {   // apply remote edits (skip my own echo)
      collabApplying = true;
      try { setTrip(data.model); currentBase = currentBase || cloneModel(data.model); renderActivePlan(); } finally { collabApplying = false; }
    } else {
      renderRoleBanner();              // model unchanged, but my role may have just changed
    }
    renderCollabHeader(); updateChatComposerState();
  });
  msgUnsub = collabOnMsgs(code, msgs => { collabMsgs = msgs; if (aiMode === 'chat') renderCollabChat(); renderCollabHeader(); });
}
// My access on the active shared plan was revoked → detach and keep what I have as a private copy.
function handleAccessRevoked(code) {
  stopCollab();
  const arr = plansMeta(); const m = arr.find(p => p.collab === code);
  if (m) { delete m.collab; delete m.share; setPlansMeta(arr); }
  renderActivePlan();
  toast('你對這份行程的存取權已變更，已改為你的本機副本');
}
// Push the live trip to the shared doc after a local edit (debounced; skips remote echoes & read-only roles).
function pushCollab() {
  if (!currentCollab || collabApplying || !collabReady() || !canEdit()) return;
  const code = currentCollab;
  clearTimeout(collabTimer);
  collabTimer = setTimeout(() => { if (currentCollab === code) collabSetPlan(code, cloneModel(currentModel()), CLIENT_ID); }, 700);
}
// ---- Read-only banner shown inside the app when my role can't edit ----
function renderRoleBanner() {
  const bar = $('#roBanner'); if (!bar) return;
  const ro = !!currentCollab && !canEdit();
  bar.hidden = !ro;
  if (!ro) return;
  const r = myRole();
  clear(bar);
  bar.appendChild(el('span.ro-banner__txt', { text: (r === 'commenter' ? '👁 可留言模式 · 行程唯讀' : '👁 檢視模式 · 唯讀') + '（你是' + (ROLE_LABEL[r] || '訪客') + '）' }));
  bar.appendChild(el('button.ro-banner__btn', { onclick: saveEditableCopy }, ['另存可編輯副本']));
}
function saveEditableCopy() {
  if (!currentPlanId) return;
  const st = store.get('kp_state:' + currentPlanId, null) || exportAll();
  const m = plansMeta().find(p => p.id === currentPlanId);
  const base = (m ? m.title : '行程').replace(/（協作）$/, '');
  const newId = createPlan({ title: base + '（我的副本）', fromState: st, base: 'custom' });
  openPlan(newId); toast('已另存為你的可編輯副本');
}
function updateChatComposerState() {
  const inp = $('#collabInput'), btn = $('#collabSendBtn');
  const allow = !currentCollab || canComment();
  if (inp) { inp.disabled = !allow; inp.placeholder = allow ? '和同行者聊天… 輸入「@ai …」可請 AI 幫忙規劃' : '檢視者無法留言（可請對方把你改為「可留言」）'; }
  if (btn) btn.disabled = !allow;
}
const myName = () => (fb.user && (fb.user.displayName || fb.user.email)) || '我';

// Turn the current/given plan into a live, permissioned shared plan ("分享即協作").
async function enableCollab(id) {
  if (!collabReady()) { toast('請先用 Google 登入才能開啟共享'); return null; }
  if (id === currentPlanId) snapshotCurrent();
  const arr = plansMeta(); const m = arr.find(p => p.id === id);
  const code = (m && m.collab) || uid();
  const model = (planModelFor(id));
  // Only seed `access` on first creation so re-opening Share never clobbers the owner's settings.
  let existing = null; try { existing = await collabGet(code); } catch {}
  const payload = { model, meta: { title: m ? m.title : '行程', emoji: m ? m.emoji : '🗺️' }, owner: fb.user.uid, ownerEmail: emailKey(fb.user.email), members: { [fb.user.uid]: { name: myName(), ts: Date.now() } }, writer: CLIENT_ID };
  if (!existing || !existing.access) payload.access = { general: 'editor', people: {} };   // 預設：知道連結的人可編輯
  await collabSave(code, payload);
  if (m) { m.collab = code; m.share = code; setPlansMeta(arr); }
  if (id === currentPlanId) startCollab(code);
  return code;
}
// Open a collab invite link as a LIVE member (not a copy).
async function joinCollab(code) {
  showScreen('plans');
  if (!collabReady()) {
    // Remember the intent so we can join automatically right after sign-in.
    try { sessionStorage.setItem('kp_pending_join', code); } catch {}
    toast('請用 Google 登入即可加入這份共享行程；先為你載入一份副本。');
    return importSharedCode(code);
  }
  try {
    const data = await collabGet(code);
    if (!data || !data.model) return toast('找不到此共享行程（可能已關閉或你沒有存取權）');
    let arr = plansMeta(); let m = arr.find(p => p.collab === code);
    let id;
    if (m) { id = m.id; }
    else {
      id = uid();
      arr.unshift({ id, title: (data.meta && data.meta.title || '共享行程') + '（協作）', emoji: (data.meta && data.meta.emoji) || '🤝', base: 'custom', collab: code, createdAt: Date.now(), updatedAt: Date.now() });
      setPlansMeta(arr);
      store.set('kp_state:' + id, { v: 3, ts: Date.now(), model: cloneModel(data.model), extras: {} });
      store.set('kp_base:' + id, { v: 3, model: cloneModel(data.model) });
    }
    try { await collabJoin(code, { name: myName(), ts: Date.now() }); } catch {}   // presence is best-effort
    openPlan(id);
    const r = myRole();
    toast(r === 'viewer' ? '已加入（檢視模式）👁' : r === 'commenter' ? '已加入，可在同行聊天討論 💬' : '已加入共享行程，可一起編輯與聊天 🤝');
  } catch (e) {
    const denied = /permission|insufficient/i.test(e && e.message || '');
    toast(denied ? '你沒有這份行程的存取權，請向擁有者索取邀請' : '加入失敗：' + (e && e.message || ''));
  }
}

// ---- 旅伴 tab: AI 規劃 / 同行聊天 modes ----
function setAiMode(mode) {
  aiMode = mode;
  $$('#aiModeSeg .chip').forEach(c => c.classList.toggle('is-on', c.dataset.aimode === mode));
  const plan = $('#aiPlanWrap'), chat = $('#collabWrap');
  if (plan) plan.hidden = mode !== 'ai';
  if (chat) chat.hidden = mode !== 'chat';
  if (mode === 'chat') { renderCollabChat(); updateChatComposerState(); }
}
function renderCollabHeader() {
  const e = $('#collabMembers'); if (!e) return;
  const n = Object.keys(collabMembers || {}).length;
  e.textContent = currentCollab ? (n ? `${n} 人共同編輯` : '共同編輯中') : '';
}
function renderCollabChat() {
  const root = $('#collabScroll'); if (!root) return; clear(root);
  if (!currentCollab) {
    root.appendChild(el('.empty', { style: { paddingTop: '28px' } }, [
      el('.empty__emoji', { text: '🤝' }),
      el('div', { text: '尚未開啟共同編輯' }),
      el('.tiny.muted-3', { style: { marginTop: '8px', lineHeight: '1.7', maxWidth: '280px', margin: '8px auto 0' }, text: '到「邀請朋友」開啟「共同編輯」，朋友加入後就能在這裡一起聊天、即時看到彼此調整行程；輸入「@ai …」還能請 AI 直接幫忙規劃。' }),
      fb.user ? null : el('.tiny.muted-3', { style: { marginTop: '6px' }, text: '（需先用 Google 登入）' }),
    ]));
    return;
  }
  const myUid = fb.user ? fb.user.uid : '';
  if (!collabMsgs.length) root.appendChild(el('.tiny.muted-3', { style: { textAlign: 'center', padding: '20px' }, text: '開始和同行者聊天吧！輸入「@ai …」可請 AI 幫忙規劃。' }));
  collabMsgs.forEach(msg => {
    if (msg.sender === 'ai') { root.appendChild(el('.msg.msg--ai', { text: '🤖 ' + (msg.text || '') })); return; }
    const mine = msg.uid === myUid;
    root.appendChild(el('.collab-msg' + (mine ? '.is-me' : ''), {}, [
      mine ? null : el('.collab-msg__who', { text: msg.name || '同行者' }),
      el('.msg' + (mine ? '.msg--user' : '.msg--ai'), { text: msg.text || '' }),
    ]));
  });
  root.scrollTop = root.scrollHeight;
}
async function sendCollabMsg() {
  const inp = $('#collabInput'); if (!inp) return;
  const text = inp.value.trim(); if (!text) return;
  if (!currentCollab) { toast('請先在「分享」開啟共享，或加入共享行程'); return; }
  if (!canComment()) { toast('檢視者無法留言（可請擁有者把你改為「可留言」）'); return; }
  inp.value = ''; inp.style.height = 'auto';
  const aiMatch = /^[@＠]ai\b/i.test(text);
  collabSendMsg(currentCollab, { uid: fb.user ? fb.user.uid : '', name: myName(), text });
  if (aiMatch) {
    const ask = text.replace(/^[@＠]ai\b[:：]?\s*/i, '').trim();
    setAiMode('ai');
    if (ask && geminiCtl && geminiCtl.ask) geminiCtl.ask(ask, { agent: true });
    else toast('已切到 AI 規劃');
  }
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
      return `<tr><td class="pd-t">${esc(x.time || '')}</td><td class="pd-ty">${esc(tm.label)}</td><td class="pd-ti"><b>${esc(x.title)}</b>${x.jp ? `<span class="pd-muted"> ${esc(x.jp)}</span>` : ''}${x.desc ? `<div class="pd-d">${esc(x.desc)}</div>` : ''}${x.dur ? `<div class="pd-d">⏱ ${esc(x.dur)}</div>` : ''}</td><td class="pd-c">${esc(x.cost || '')}</td></tr>`;
    }).join('');
    return `<section class="pd-day"><div class="pd-dh"><span class="pd-dn">Day ${i + 1}</span><span class="pd-dd">${esc(fmtMD(d.date))}${d.dow ? `（${esc(d.dow)}）` : ''} · ${esc(cityNameIn(model, d.cityKey))}</span><span class="pd-dt">${esc(d.title || '')}</span></div>${d.summary ? `<p class="pd-sum">${esc(d.summary)}</p>` : ''}<table class="pd-tab"><tbody>${rows}</tbody></table></section>`;
  }).join('');
  const routes = model.routes || [];
  const routesHTML = routes.map(r => {
    const legs = (r.legs || []).map(l => `${esc(l.line || '')}${l.dur ? ` ${esc(l.dur)}` : ''}`).filter(Boolean).join(' → ');
    return `<li><b>${esc(r.from)} → ${esc(r.to)}</b> — ${esc(r.summary || '') || legs}${r.fare ? ` <span class="pd-muted">（${esc(r.fare)}）</span>` : ''}${r.pass ? `<div class="pd-d">${esc(r.pass)}</div>` : ''}</li>`;
  }).join('');
  // Souvenirs (per city) — AI trips now carry this; the old PDF silently dropped it.
  const sv = model.souvenirs || {};
  const svHTML = Object.keys(sv).map(k => {
    const list = (sv[k] || []).map(g => `<li>${esc(g.emoji || '🎁')} <b>${esc(g.name)}</b>${g.where ? ` <span class="pd-muted">（${esc(g.where)}${g.price ? ` · ${esc(g.price)}` : ''}）</span>` : ''}${g.desc ? `<div class="pd-d">${esc(g.desc)}</div>` : ''}</li>`).join('');
    return list ? `<div class="pd-card"><b>${esc(cityNameIn(model, k))}</b><ul class="pd-ul">${list}</ul></div>` : '';
  }).join('');
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
    ${block('各地伴手禮', svHTML)}
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
  // keep the 我的計劃 / 社群 segment consistent (e.g. after login re-renders plans)
  const mineR = $('#mineRoot'), comR = $('#communityRoot');
  if (mineR) mineR.hidden = communityMode;
  if (comR) comR.hidden = !communityMode;
  $$('#plansSeg .plans-seg__btn').forEach(b => { const sel = (b.dataset.seg === 'community') === communityMode; b.classList.toggle('is-on', sel); b.setAttribute('aria-pressed', sel ? 'true' : 'false'); });
  if (communityMode) renderCommunity();
}
function planCard(m) {
  return el('.plan-card', { onclick: () => openPlan(m.id) }, [
    el('.plan-card__ico', { text: m.emoji || '🗺️' }),
    el('.plan-card__body', {}, [
      el('.plan-card__title', { text: m.title }),
      el('.plan-card__meta', {}, [
        m.id === currentPlanId ? el('span.plan-badge', { text: '目前' }) : null,
        m.forkedFrom ? el('span.plan-badge.plan-badge--tpl', { text: '🌟 複製自社群' }) : null,
        el('span', { text: '更新 ' + fmtAgo(m.updatedAt) }),
      ]),
    ]),
    el('.plan-card__actions', {}, [
      el('button.iconbtn', { title: '匯出（PDF／行事曆／備份）', onclick: e => { e.stopPropagation(); openExportSheet(m.id); } }, [icon('i-install')]),
      el('button.iconbtn', { title: '邀請朋友', onclick: e => { e.stopPropagation(); openShareSheet(m.id); } }, [icon('i-share')]),
      el('button.iconbtn', { title: '重新命名', onclick: async e => { e.stopPropagation(); const t = await promptDialog({ title: '重新命名行程', value: m.title, placeholder: '行程名稱', confirmText: '儲存' }); if (t) renamePlan(m.id, t.trim()); } }, [icon('i-plan')]),
      el('button.iconbtn', { title: '刪除', onclick: async e => { e.stopPropagation(); if (await confirmDialog({ title: '刪除行程', message: '刪除「' + m.title + '」？此動作無法復原。', confirmText: '刪除', danger: true })) deletePlan(m.id); } }, [icon('i-trash')]),
    ]),
  ]);
}
function templateCard() {
  const card = el('.plan-card.plan-card--tpl', { onclick: () => { const id = createPlan({ title: '九州・瀨戶內・關西', model: kyushuModel(), base: 'kyushu', emoji: '🗾' }); openPlan(id); toast('已從範本建立新行程'); } }, [
    el('.plan-card__ico', { text: '🗾' }),
    el('.plan-card__body', {}, [el('.plan-card__title', { text: '九州・瀨戶內・關西 8 日' }), el('.plan-card__meta', {}, [el('span.plan-badge.plan-badge--tpl', { text: '範本' }), el('span', { text: '點此複製一份來編輯' })])]),
  ]);
  // ✨ AI 一鍵建立 — the primary, guided way to make an any-country trip (prominent)
  const aiWizard = el('.plan-card.plan-card--ai', { style: { marginTop: '12px' }, onclick: () => openAiWizard() }, [
    el('.plan-card__ico', { text: '✨' }),
    el('.plan-card__body', {}, [el('.plan-card__title', { text: 'AI 一鍵建立行程' }), el('.plan-card__meta', {}, [el('span.plan-badge', { style: { background: 'rgba(255,255,255,.22)', color: '#fff' }, text: 'AI' }), el('span', { text: '回答幾題，任何國家都幫你排好' })])]),
    el('.plan-card__actions', {}, [el('button.iconbtn', { title: 'AI 一鍵建立', onclick: e => { e.stopPropagation(); openAiWizard(); } }, [icon('i-ai')])]),
  ]);
  // Build with AI — free chat (any country); always opens the AI chat so you see it work
  const aiCard = el('.plan-card.plan-card--tpl', { style: { marginTop: '12px' }, onclick: () => aiCreatePlan('') }, [
    el('.plan-card__ico', { text: '💬' }),
    el('.plan-card__body', {}, [el('.plan-card__title', { text: '和 AI 聊天建立' }), el('.plan-card__meta', {}, [el('span.plan-badge', { style: { background: 'var(--brand-2)', color: '#fff' }, text: 'AI' }), el('span', { text: '直接用聊天說需求，AI 即時幫你排' })])]),
    el('.plan-card__actions', {}, [el('button.iconbtn', { title: '用 AI 建立', onclick: e => { e.stopPropagation(); aiCreatePlan(''); } }, [icon('i-ai')])]),
  ]);
  // load shared
  const loadShared = el('.plan-card.plan-card--tpl', { style: { marginTop: '12px' }, onclick: () => openLoadSharedSheet() }, [
    el('.plan-card__ico', { text: '🔗' }),
    el('.plan-card__body', {}, [el('.plan-card__title', { text: '載入共享行程' }), el('.plan-card__meta', {}, [el('span', { text: '用同行者給的分享碼／連結' })])]),
  ]);
  return el('div', {}, [aiWizard, card, aiCard, loadShared]);
}

// ============================================================================
// Community feed — browse / like / fork everyone's public trips (read-only).
// Backed by feed/{code}; ranking + filtering are 100% client-side.
// ============================================================================
function communityTab(on) {
  communityMode = on;
  $$('#plansSeg .plans-seg__btn').forEach(b => { const sel = (b.dataset.seg === 'community') === on; b.classList.toggle('is-on', sel); b.setAttribute('aria-pressed', sel ? 'true' : 'false'); });
  const mine = $('#mineRoot'), com = $('#communityRoot');
  if (mine) mine.hidden = on;
  if (com) com.hidden = !on;
  if (on) renderCommunity();
}
async function renderCommunity(forceReload = false) {
  const root = $('#communityRoot'); if (!root) return;
  clear(root);
  if (!feedReady()) {
    root.appendChild(el('.empty', { style: { paddingTop: '34px' } }, [
      el('.empty__emoji', { text: '☁️' }), el('div', { text: '社群需要連接雲端' }),
      el('.tiny.muted-3', { style: { marginTop: '6px' }, text: '稍後再試，或先用「我的計劃」。' }),
    ]));
    return;
  }
  // intro + refresh
  root.appendChild(el('.row-between', { style: { alignItems: 'center', margin: '2px 2px 8px' } }, [
    el('p', { class: 'tiny muted', style: { lineHeight: '1.6', flex: '1 1 auto', paddingRight: '10px' }, text: '看看大家公開的行程，按讚收藏靈感；喜歡就一鍵「複製到我的」自由編輯。' }),
    el('button.iconbtn', { title: '重新整理', onclick: () => renderCommunity(true) }, [icon('i-route')]),
  ]));
  // sort segmented
  const sortRow = el('.community-sort');
  [['hot', '🔥 熱門'], ['recent', '🆕 最新'], ['top', '♥ 最多讚']].forEach(([v, l]) => {
    const b = el('button.chip.chip--tap' + (communitySort === v ? '.is-on' : ''), { onclick: () => { communitySort = v; [...sortRow.children].forEach(x => x.classList.remove('is-on')); b.classList.add('is-on'); paintCommunityList(); } }, l);
    sortRow.appendChild(b);
  });
  root.appendChild(sortRow);
  const filtersHost = el('.community-filters', { id: 'communityFilters' }); root.appendChild(filtersHost);
  const listWrap = el('div', { id: 'communityList' }); root.appendChild(listWrap);

  if (!communityLoaded || forceReload) {
    const myReq = ++communityReq;   // claim this load; a newer load supersedes us
    // Stale-while-revalidate: paint what we already have first; else show skeletons (feels instant).
    if (communityCache.length) { buildCommunityFilters(filtersHost); paintCommunityList(); }
    else { for (let i = 0; i < 4; i++) listWrap.appendChild(skeletonCard()); }
    try {
      const list = await feedList(60);
      if (myReq !== communityReq || communityMode === false) return;   // superseded / toggled away
      const liked = fb.user ? await feedLikedSet(list.map(f => f.code).filter(Boolean)) : new Set();
      if (myReq !== communityReq || communityMode === false) return;
      communityCache = list; communityLiked = liked; communityLoaded = true;
    } catch (e) { console.warn('community load', e); if (myReq !== communityReq) return; }
  }
  buildCommunityFilters(filtersHost);
  paintCommunityList();
}
function skeletonCard() {
  return el('.skel-card', {}, [
    el('.skeleton.skel-ico'),
    el('.skel-lines', {}, [el('.skeleton.skel-line.w70'), el('.skeleton.skel-line.w45'), el('.skeleton.skel-line.w90')]),
  ]);
}
function buildCommunityFilters(host) {
  if (!host) return; clear(host);
  const countries = [...new Set(communityCache.map(f => (f.country || '').trim()).filter(Boolean))].sort();
  const presentRegions = new Set(communityCache.map(f => f.region || regionOf(f.country)).filter(Boolean));
  const refresh = () => { buildCommunityFilters(host); paintCommunityList(); };
  const mkRow = (label, opts, current, onPick) => {
    if (!opts.length) return;
    const chips = el('.chiprow', { style: { flexWrap: 'wrap' } });
    chips.appendChild(el('button.chip.chip--tap' + (!current ? '.is-on' : ''), { onclick: () => onPick('') }, '全部'));
    opts.forEach(o => chips.appendChild(el('button.chip.chip--tap' + (current === o ? '.is-on' : ''), { onclick: () => onPick(o) }, o)));
    host.appendChild(el('.community-filter', {}, [el('.tiny.muted-3.community-filter__lbl', { text: label }), chips]));
  };
  mkRow('區域', REGIONS.filter(r => presentRegions.has(r)), communityFilters.region, v => { communityFilters.region = v; communityFilters.country = ''; refresh(); });
  mkRow('國家', countries, communityFilters.country, v => { communityFilters.country = v; communityFilters.region = ''; refresh(); });
  // travel-mode tags (multi)
  const tChips = el('.chiprow', { style: { flexWrap: 'wrap' } });
  TRAVEL_THEMES.forEach(t => tChips.appendChild(el('button.chip.chip--tap' + (communityFilters.themes.includes(t) ? '.is-on' : ''), { onclick: e => {
    const i = communityFilters.themes.indexOf(t);
    if (i >= 0) { communityFilters.themes.splice(i, 1); e.currentTarget.classList.remove('is-on'); } else { communityFilters.themes.push(t); e.currentTarget.classList.add('is-on'); }
    paintCommunityList();
  } }, t)));
  host.appendChild(el('.community-filter', {}, [el('.tiny.muted-3.community-filter__lbl', { text: '旅行模式' }), tChips]));
}
function paintCommunityList() {
  const wrap = $('#communityList'); if (!wrap) return; clear(wrap);
  const f = communityFilters;
  let items = communityCache.slice();
  if (f.country) items = items.filter(x => (x.country || '').trim() === f.country);
  if (f.region) items = items.filter(x => (x.region || regionOf(x.country)) === f.region);
  if (f.themes.length) items = items.filter(x => (x.themes || []).some(t => f.themes.includes(t)));
  if (communitySort === 'recent') items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  else if (communitySort === 'top') items.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0) || (b.createdAt || 0) - (a.createdAt || 0));
  else items.sort((a, b) => hotScore(b.likeCount, b.createdAt) - hotScore(a.likeCount, a.createdAt) || (b.likeCount || 0) - (a.likeCount || 0));
  if (!items.length) {
    wrap.appendChild(el('.empty', { style: { paddingTop: '24px' } }, [
      el('.empty__emoji', { text: '📍' }),
      el('div', { text: communityCache.length ? '沒有符合條件的行程' : '社群還沒有行程' }),
      el('.tiny.muted-3', { style: { marginTop: '6px', lineHeight: '1.7' }, text: communityCache.length ? '試試其他篩選條件。' : '把你的行程設為「社群」，成為第一個分享的人！' }),
    ]));
    return;
  }
  const grid = el('.stagger'); items.forEach(it => grid.appendChild(communityCard(it))); wrap.appendChild(grid);
}
function communityCard(f) {
  const bits = [];
  if (f.country) bits.push(f.country);
  const rg = f.region || regionOf(f.country); if (rg && rg !== f.country) bits.push(rg);
  if (f.days) bits.push(f.days + ' 天');
  if (f.cityCount) bits.push(f.cityCount + ' 城');
  const a = avg5(f);
  const social = [];
  if (a) social.push('★ ' + a.toFixed(1));
  if (f.forkCount) social.push('🔁 ' + f.forkCount);
  if (f.reviewCount) social.push('💬 ' + f.reviewCount);
  return el('.plan-card.plan-card--community', { onclick: () => openPlanDetail(f) }, [
    el('.plan-card__ico', { text: f.emoji || '🗺️' }),
    el('.plan-card__body', {}, [
      el('.plan-card__title', { text: f.title || '行程' }),
      el('.plan-card__meta', {}, [bits.length ? el('span', { text: bits.join(' · ') }) : null]),
      (f.themes && f.themes.length) ? el('.community-tags', {}, f.themes.slice(0, 3).map(t => el('span.chip.chip--mini', { text: t }))) : null,
      el('.community-card__foot', {}, [
        avatarEl(f.ownerName, f.ownerPhoto, '.avatar--xs'),
        el('span.tiny.muted-3', { text: f.ownerName || '旅人' }),
        social.length ? el('span.tiny.muted-3.community-card__social', { text: social.join(' · ') }) : null,
      ]),
    ]),
    el('.plan-card__actions', {}, [
      likeButton(f),
      el('button.iconbtn', { title: '複製到我的計劃', onclick: e => { e.stopPropagation(); forkFromFeed(f); } }, [icon('i-copy')]),
    ]),
  ]);
}
function likeButton(f) {
  const liked = communityLiked.has(f.code);
  const b = el('button.like-badge' + (liked ? '.is-on' : ''), { title: '按讚', 'aria-label': '按讚', 'aria-pressed': liked ? 'true' : 'false', onclick: e => { e.stopPropagation(); togglePlanLike(f, b); } }, [
    el('span.like-badge__heart', { 'aria-hidden': 'true', text: '♥' }),
    el('span.like-badge__n', { text: String(f.likeCount || 0) }),
  ]);
  return b;
}
function setLikeUI(btn, liked, n) {
  btn.classList.toggle('is-on', !!liked);
  btn.setAttribute('aria-pressed', liked ? 'true' : 'false');
  const c = btn.querySelector('.like-badge__n'); if (c) c.textContent = String(Math.max(0, n || 0));
}
async function togglePlanLike(f, btn) {
  if (!fb.user) { toast('請先登入才能按讚'); return; }
  if (btn.dataset.busy) return; btn.dataset.busy = '1';
  const wasLiked = communityLiked.has(f.code);
  const want = !wasLiked;
  setLikeUI(btn, want, (f.likeCount || 0) + (want ? 1 : -1));   // optimistic
  try {
    const nowLiked = await feedLikeToggle(f.code, want);
    if (nowLiked) communityLiked.add(f.code); else communityLiked.delete(f.code);
    // Reconcile from the server so the displayed count can't drift across tabs/sessions.
    try { const fresh = await feedGet(f.code); if (fresh && typeof fresh.likeCount === 'number') f.likeCount = fresh.likeCount; }
    catch { f.likeCount = Math.max(0, (f.likeCount || 0) + (nowLiked === wasLiked ? 0 : (nowLiked ? 1 : -1))); }
    setLikeUI(btn, nowLiked, f.likeCount);
  } catch (e) {
    setLikeUI(btn, wasLiked, f.likeCount || 0);   // revert
    toast('操作失敗，請再試一次');
  } finally { delete btn.dataset.busy; }
}
async function forkFromFeed(f) {
  if (!fb.user) { toast('請先登入再複製到你的計劃'); return; }
  toast('正在複製…');
  let model = null; try { model = await collabModelGet(f.code); } catch {}
  if (!model || !(model.days || []).length) { toast('此行程目前無法複製（可能已不公開）'); return; }
  const id = createPlan({ title: (f.title || '社群行程') + '（社群副本）', model, base: 'fork', emoji: f.emoji || '🗺️' });
  const arr = plansMeta(); const m = arr.find(p => p.id === id); if (m) { m.forkedFrom = f.code; setPlansMeta(arr); }
  try { feedBumpFork(f.code); } catch {}            // social proof: "X 人複製"
  communityLoaded = false;
  communityTab(false);
  openPlan(id);
  toast('已複製到你的計劃，可自由編輯 ✏️');
}

// ============================================================================
// Community plan DETAIL page — hero + author + stats + 行程/心得 tabs + reviews.
// Deep-linkable via ?view=<code>. Replaces the old transient preview sheet.
// ============================================================================
let detailState = null;
let pendingView = null;   // ?view=<code> deep-link, opened once Firebase is ready
const avg5 = f => (f && f.reviewCount ? (f.ratingSum || 0) / f.reviewCount : 0);
function avatarEl(name, photo, cls = '') {
  if (photo) return el('img.avatar' + cls, { src: photo, alt: '', referrerpolicy: 'no-referrer' });
  return el('.avatar.avatar--init' + cls, { text: (name || '旅')[0] });
}
function starsRow(rating) { const o = []; for (let i = 1; i <= 5; i++) o.push(el('span' + (i <= rating ? '' : '.is-off'), { text: '★' })); return el('.stars', {}, o); }

async function openPlanDetail(arg) {
  const code = typeof arg === 'string' ? arg : (arg && arg.code);
  if (!code) return;
  if (!feedReady()) { toast('社群需要連接雲端'); return; }
  detailState = { code, feed: (typeof arg === 'object' ? arg : null), model: null, reviews: [], helpfulSet: new Set(), tab: 'itin', loaded: false };
  showScreen('detail');
  renderDetail();
  try {
    const [feed, model, reviews] = await Promise.all([
      detailState.feed ? Promise.resolve(detailState.feed) : feedGet(code),
      collabModelGet(code),
      reviewList(code),
    ]);
    if (!detailState || detailState.code !== code) return;   // navigated away mid-load
    detailState.feed = feed || detailState.feed; detailState.model = model; detailState.reviews = reviews || []; detailState.loaded = true;
    if (fb.user && detailState.reviews.length) { try { detailState.helpfulSet = await reviewHelpfulSet(code, detailState.reviews.map(r => r.uid)); } catch {} }
    renderDetail();
  } catch (e) { console.warn('detail load', e); if (detailState) { detailState.loaded = true; renderDetail(); } }
}
function renderDetail() {
  const root = $('#detailRoot'); if (!root || !detailState) return;
  const f = detailState.feed || { code: detailState.code };
  clear(root);
  const bits = []; if (f.country) bits.push(f.country); const rg = f.region || regionOf(f.country); if (rg && rg !== f.country) bits.push(rg); if (f.days) bits.push(f.days + ' 天'); if (f.cityCount) bits.push(f.cityCount + ' 城');
  const a = avg5(f);
  // hero
  root.appendChild(el('.detail-hero', {}, [
    el('.detail-hero__emoji', { text: f.emoji || '🗺️' }),
    el('h1.detail-hero__title', { text: f.title || '社群行程' }),
    bits.length ? el('.detail-hero__meta', { text: bits.join(' · ') }) : null,
    (f.themes && f.themes.length) ? el('.community-tags', { style: { justifyContent: 'center', marginTop: '8px' } }, f.themes.slice(0, 4).map(t => el('span.chip.chip--mini', { text: t }))) : null,
  ]));
  // author
  root.appendChild(el('.detail-author', {}, [avatarEl(f.ownerName, f.ownerPhoto, '.avatar--sm'), el('.detail-author__name', { text: '由 ' + (f.ownerName || '旅人') + ' 分享' })]));
  // stats
  root.appendChild(el('.detail-stats', {}, [
    el('.detail-stat', {}, [el('.detail-stat__n', { text: '♥ ' + (f.likeCount || 0) }), el('.detail-stat__l', { text: '讚' })]),
    el('.detail-stat', {}, [el('.detail-stat__n', { text: '🔁 ' + (f.forkCount || 0) }), el('.detail-stat__l', { text: '複製' })]),
    el('.detail-stat', {}, [el('.detail-stat__n', { text: '★ ' + (a ? a.toFixed(1) : '—') }), el('.detail-stat__l', { text: '評分' })]),
    el('.detail-stat', {}, [el('.detail-stat__n', { text: '💬 ' + (f.reviewCount || 0) }), el('.detail-stat__l', { text: '心得' })]),
  ]));
  // tabs
  const seg = el('.plans-seg', { style: { margin: '6px 0 14px' } }, [
    el('button.plans-seg__btn' + (detailState.tab === 'itin' ? '.is-on' : ''), { onclick: () => { detailState.tab = 'itin'; renderDetail(); } }, '行程'),
    el('button.plans-seg__btn' + (detailState.tab === 'reviews' ? '.is-on' : ''), { onclick: () => { detailState.tab = 'reviews'; renderDetail(); } }, '心得' + (f.reviewCount ? ' · ' + f.reviewCount : '')),
  ]);
  root.appendChild(seg);
  const body = el('div', { id: 'detailBody' }); root.appendChild(body);
  if (detailState.tab === 'itin') renderDetailItinerary(body); else renderDetailReviews(body);
  // sticky action bar
  const bar = $('#detailActions'); if (bar) {
    clear(bar);
    bar.appendChild(el('button.btn.btn--brand', { style: { flex: '1 1 auto' }, onclick: () => forkFromFeed(f) }, [icon('i-copy'), '複製到我的計劃']));
    bar.appendChild(el('button.btn', { onclick: () => shareDetailLink(f) }, [icon('i-share'), '分享']));
  }
}
function renderDetailItinerary(body) {
  clear(body);
  if (!detailState.loaded && !detailState.model) { for (let i = 0; i < 5; i++) body.appendChild(el('.skeleton.skeleton--line', { style: { margin: '10px 0' } })); return; }
  const days = (detailState.model && detailState.model.days) || [];
  if (!days.length) { body.appendChild(el('.tiny.muted-3', { style: { padding: '20px', textAlign: 'center' }, text: '此行程目前無法瀏覽（可能已設為私人）。' })); return; }
  days.forEach((d, i) => {
    body.appendChild(el('.h-section', { style: { margin: '14px 2px 6px' }, text: 'Day ' + (i + 1) + (d.title ? ' · ' + d.title : '') + (d.date ? '（' + d.date + '）' : '') }));
    (d.items || []).forEach(it => body.appendChild(el('.preview-item', {}, [el('span.preview-item__t', { text: it.time || '' }), el('span.preview-item__x', { text: it.title || '' })])));
  });
}
function renderDetailReviews(body) {
  clear(body);
  const code = detailState.code;
  if (fb.user) body.appendChild(reviewComposer(code));
  else body.appendChild(el('.tiny.muted-3', { style: { margin: '4px 2px 14px', lineHeight: '1.7' }, text: '登入後即可為這份行程寫下你的評分與心得。' }));
  const reviews = (detailState.reviews || []).slice().sort((x, y) => (y.helpful || 0) - (x.helpful || 0) || (y.createdAt || 0) - (x.createdAt || 0));
  if (!reviews.length) { body.appendChild(el('.tiny.muted-3', { style: { textAlign: 'center', padding: '22px' }, text: '還沒有人寫心得，當第一個分享心得的人吧！' })); return; }
  reviews.forEach(r => body.appendChild(reviewCard(code, r)));
}
function reviewComposer(code) {
  const mine = (detailState.reviews || []).find(r => fb.user && r.uid === fb.user.uid);
  let rating = mine ? mine.rating : 0;
  const card = el('.review-compose', {});
  card.appendChild(el('.tiny.muted-3', { style: { fontWeight: '700', marginBottom: '6px' }, text: mine ? '編輯你的心得' : '寫下你的心得' }));
  const starRow = el('.stars-input', {});
  const draw = () => { clear(starRow); for (let i = 1; i <= 5; i++) { const s = i; starRow.appendChild(el('button.star-btn' + (s <= rating ? '.is-on' : ''), { type: 'button', 'aria-label': s + ' 星', onclick: () => { rating = s; draw(); } }, '★')); } };
  draw(); card.appendChild(starRow);
  const ta = el('textarea.review-ta', { rows: 3, maxlength: '600', placeholder: '這趟行程的亮點、踩雷、給後人的建議…（最多 600 字）' }); ta.value = mine ? (mine.text || '') : '';
  card.appendChild(ta);
  card.appendChild(el('button.btn.btn--brand.btn--block', { style: { marginTop: '8px' }, onclick: async () => {
    if (!rating) { toast('請先點星星給個評分'); return; }
    try { await reviewSave(code, { rating, text: ta.value.trim() }); toast(mine ? '已更新心得' : '已送出心得 🙌'); await reloadDetailReviews(); }
    catch (e) { toast('送出失敗：' + (e && e.message || '')); }
  } }, [mine ? '更新心得' : '送出心得']));
  if (mine) card.appendChild(el('button.btn.btn--block', { style: { marginTop: '6px', color: 'var(--sakura)' }, onclick: async () => {
    if (!await confirmDialog({ title: '刪除心得', message: '刪除你寫的心得？', confirmText: '刪除', danger: true })) return;
    try { await reviewDelete(code); toast('已刪除'); await reloadDetailReviews(); } catch (e) { toast('刪除失敗：' + (e && e.message || '')); }
  } }, ['刪除我的心得']));
  return card;
}
function reviewCard(code, r) {
  const helped = detailState.helpfulSet.has(r.uid);
  return el('.review-card', {}, [
    el('.review-card__head', {}, [
      avatarEl(r.name, r.photo, '.avatar--sm'),
      el('div', { style: { flex: '1 1 auto', minWidth: '0' } }, [el('.review-card__name', { text: r.name || '旅人' }), starsRow(r.rating)]),
      r.forked ? el('span.chip.chip--mini', { text: '✓ 已造訪' }) : null,
    ]),
    r.text ? el('.review-card__text', { text: r.text }) : null,
    el('.review-card__foot', {}, [
      el('button.like-badge' + (helped ? '.is-on' : ''), { onclick: async e => {
        const b = e.currentTarget; if (!fb.user) { toast('請先登入'); return; } if (b.dataset.busy) return; b.dataset.busy = '1';
        try { const now = await reviewHelpfulToggle(code, r.uid, !helped); if (now) detailState.helpfulSet.add(r.uid); else detailState.helpfulSet.delete(r.uid); r.helpful = Math.max(0, (r.helpful || 0) + (now ? 1 : -1)); renderDetail(); }
        catch { toast('操作失敗，請再試一次'); } finally { delete b.dataset.busy; }
      } }, [el('span.like-badge__heart', { text: '👍' }), el('span.like-badge__n', { text: String(r.helpful || 0) })]),
      el('.tiny.muted-3', { text: fmtAgo(r.createdAt) }),
    ]),
  ]);
}
async function reloadDetailReviews() {
  const code = detailState && detailState.code; if (!code) return;
  try {
    const [feed, reviews] = await Promise.all([feedGet(code), reviewList(code)]);
    if (!detailState || detailState.code !== code) return;
    detailState.feed = feed || detailState.feed; detailState.reviews = reviews || [];
    if (fb.user && reviews.length) { try { detailState.helpfulSet = await reviewHelpfulSet(code, reviews.map(r => r.uid)); } catch {} }
    communityLoaded = false;   // counts changed → refresh feed cards next time
    renderDetail();
  } catch {}
}
function shareDetailLink(f) {
  const code = (f && f.code) || (detailState && detailState.code);
  const link = location.origin + location.pathname + '?view=' + code;
  if (navigator.share) navigator.share({ title: (f && f.title) || '社群行程', text: '看看這份行程！', url: link }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(link).then(() => toast('已複製分享連結')).catch(() => toast(link));
  else toast(link);
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
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('kp_') && k !== 'kp_gemini_key' && k !== 'kp_theme' && k !== 'kp_synccode' && !k.startsWith('kp_base:')) o[k] = localStorage.getItem(k); }
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
let _syncing = false;
async function onAuthChange(user) {
  communityLoaded = false;   // auth changed → refresh feed + my-likes on next 社群 view
  if ($('#screen-plans') && !$('#screen-plans').hidden) renderPlans();
  if (!user) {
    // Clean logout: detach any live collaboration so stale-auth listeners can't error.
    stopCollab();
    if (!$('#app').hidden) renderActivePlan();
    return;
  }
  if (_syncing) return;       // guard against overlapping auth callbacks
  _syncing = true;
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
  } catch (e) { console.warn('cloud sync', e); toast('雲端同步暫時失敗，資料仍安全存在本機'); }
  finally { _syncing = false; }
  try { Notify.registerPush(); } catch {}
  // Resume a join intent that was deferred until sign-in (?join= link opened while logged out).
  let pending = null; try { pending = sessionStorage.getItem('kp_pending_join'); } catch {}
  if (pending && collabReady()) { try { sessionStorage.removeItem('kp_pending_join'); } catch {} joinCollab(pending); return; }
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
  // tap the app-bar title to quick-switch plans
  const appBrand = document.querySelector('#app .appbar__brand');
  if (appBrand) { appBrand.setAttribute('role', 'button'); appBrand.setAttribute('aria-label', '切換計劃'); appBrand.addEventListener('click', openPlanSwitcher); }
  $('#settingsBtn').addEventListener('click', openSettings);
  $('#locBtn').addEventListener('click', () => requestLocation(false));
  $('#searchBtn').addEventListener('click', openSearch);
  $('#searchClose').addEventListener('click', closeSheets);
  $('#searchInput').addEventListener('input', e => renderSearch(e.target.value));
  // plans / account
  $('#plansBtn').addEventListener('click', () => { snapshotCurrent(); showScreen('plans'); });
  $('#guestEnter').addEventListener('click', () => { store.set('kp_entered', true); showScreen('plans'); });
  // Guard a click handler against double-fires while an auth call is in flight.
  const withBusy = (btn, fn) => async () => {
    if (btn && btn.dataset.busy) return;
    if (btn) { btn.dataset.busy = '1'; btn.disabled = true; }
    try { await fn(); } finally { if (btn) { delete btn.dataset.busy; btn.disabled = false; } }
  };
  const gBtn = $('#googleSignIn');
  gBtn.addEventListener('click', withBusy(gBtn, async () => {
    store.set('kp_entered', true);
    try { await signInGoogle(); showScreen('plans'); }   // null (user cancelled) is not an error
    catch (e) { toast(authErrorMessage(e)); }
  }));
  const authBtn = $('#plansAuthBtn');
  authBtn.addEventListener('click', withBusy(authBtn, async () => {
    if (fb.user) {
      if (await confirmDialog({ title: '登出帳號', message: '登出後本機資料仍會保留。', confirmText: '登出' })) { try { await signOutUser(); } catch (e) { toast(authErrorMessage(e)); } renderPlans(); }
    } else if (fb.configured) {
      try { await signInGoogle(); } catch (e) { toast(authErrorMessage(e)); }
    } else { openSettings(); }
  }));
  $('#plansSettingsBtn').addEventListener('click', openSettings);
  // community plan detail page chrome
  const dBack = $('#detailBack'); if (dBack) dBack.addEventListener('click', () => { showScreen('plans'); communityTab(true); });
  const dShare = $('#detailShare'); if (dShare) dShare.addEventListener('click', () => { if (detailState) shareDetailLink(detailState.feed || { code: detailState.code }); });
  // 我的計劃 / 社群 segmented toggle
  $$('#plansSeg .plans-seg__btn').forEach(b => b.addEventListener('click', () => communityTab(b.dataset.seg === 'community')));
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
  // AI create-trip on HOME page → enters the app's AI chat with the text auto-sent
  const hai = $('#homeAiInput');
  if (hai) {
    $('#homeAiBtn').addEventListener('click', () => { const v = hai.value; hai.value = ''; hai.style.height = 'auto'; homeAiCreate(v); });
    hai.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#homeAiBtn').click(); } });
    hai.addEventListener('input', () => { hai.style.height = 'auto'; hai.style.height = Math.min(100, hai.scrollHeight) + 'px'; });
  }
  const hChips = $('#homeAiChips');
  if (hChips) ['5 天東京自由行', '6 天巴黎', '4 天首爾美食', '日本九州 8 天'].forEach(c => hChips.appendChild(el('button', { onclick: () => homeAiCreate(c) }, c)));
  // Cover landing: nav CTAs reuse the existing enter/login handlers
  ['coverStartTop', 'coverStartBottom'].forEach(idd => { const e = $('#' + idd); if (e) e.addEventListener('click', () => $('#guestEnter').click()); });
  const cw = $('#coverWizard'); if (cw) cw.addEventListener('click', () => { store.set('kp_entered', true); showScreen('plans'); setTimeout(openAiWizard, 60); });
  const clt = $('#coverLoginTop'); if (clt) clt.addEventListener('click', () => $('#googleSignIn').click());
  // Cover: scroll-reveal + 3D parallax
  try {
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) en.target.classList.add('in'); }), { threshold: 0.16 });
    $$('.reveal').forEach(e => io.observe(e));
  } catch { $$('.reveal').forEach(e => e.classList.add('in')); }
  const coverEl = $('#screen-home .cover');
  if (coverEl && !matchMedia('(pointer: coarse)').matches) {
    coverEl.addEventListener('mousemove', e => {
      coverEl.style.setProperty('--mx', (e.clientX / window.innerWidth - 0.5).toFixed(3));
      coverEl.style.setProperty('--my', (e.clientY / window.innerHeight - 0.5).toFixed(3));
    });
  }
  // Cover: scroll-pinned phone story — rotate the phone & cross-fade screenshots on scroll
  (function () {
    const track = $('#coverStory .story__track');
    const phone = $('#storyPhone');
    if (!track || !phone) return;
    const slides = $$('#coverStory .story__slide');
    const caps = $$('#coverStory .story__cap');
    const N = slides.length;
    const RY = [-16, 11, -13, 15]; // per-slide yaw targets (deg)
    const dotsWrap = $('#storyDots');
    if (dotsWrap && !dotsWrap.children.length) {
      for (let i = 0; i < N; i++) dotsWrap.appendChild(el('span', i === 0 ? { class: 'on' } : {}));
    }
    const dots = dotsWrap ? Array.from(dotsWrap.children) : [];
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      slides.forEach((s, i) => s.style.setProperty('--o', i === 0 ? '1' : '0'));
      return;
    }
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    let ticking = false;
    function update() {
      ticking = false;
      const r = track.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const p = clamp(-r.top / (span || 1), 0, 1);
      const pos = p * (N - 1);
      const active = Math.round(pos);
      slides.forEach((s, i) => s.style.setProperty('--o', clamp(1 - Math.abs(pos - i), 0, 1).toFixed(3)));
      caps.forEach((c, i) => c.classList.toggle('is-active', i === active));
      dots.forEach((d, i) => d.classList.toggle('on', i === active));
      const i0 = Math.floor(pos), f = pos - i0, i1 = Math.min(i0 + 1, N - 1);
      const ry = RY[i0] + (RY[i1] - RY[i0]) * f;
      phone.style.setProperty('--ry', ry.toFixed(2) + 'deg');
      phone.style.setProperty('--rx', (5 - p * 3).toFixed(2) + 'deg');
      phone.style.setProperty('--rz', (ry * 0.1).toFixed(2) + 'deg');
      phone.style.setProperty('--glx', (58 + ry * 2.4).toFixed(1) + '%');
    }
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  })();
  // 旅伴 mode toggle (AI 規劃 / 同行聊天) + collab chat composer
  $$('#aiModeSeg .chip').forEach(c => c.addEventListener('click', () => setAiMode(c.dataset.aimode)));
  const ci = $('#collabInput');
  if (ci) {
    $('#collabSendBtn').addEventListener('click', sendCollabMsg);
    ci.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCollabMsg(); } });
    ci.addEventListener('input', () => { ci.style.height = 'auto'; ci.style.height = Math.min(120, ci.scrollHeight) + 'px'; });
  }
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
    planAdd, planRemove, planUpdate, planMove, planReset, planAddDay, planRemoveDay, newPlan: aiNewPlan, applyModel,
    notifyAI: (t, b) => { Notify.notifyAI(t, b); if (currentCollab) collabSendMsg(currentCollab, { sender: 'ai', name: 'AI', text: b || t }); },
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
  initFirebase().then(() => { fb.onAuth(onAuthChange); if (pendingView) { const v = pendingView; pendingView = null; openPlanDetail(v); } });
  window.addEventListener('beforeunload', () => { try { snapshotCurrent(); } catch {} });

  // initial screen: shared link → plans (loads into app); else app if returning, home if first time
  const hadShare = importSharedFromURL();
  if (hadShare) store.set('kp_entered', true);
  // Landing: shared link → plans; returning/entered (or signed-in) users → their plans; first-timers → login/home.
  showScreen(hadShare ? 'plans' : (store.get('kp_entered', false) ? 'plans' : 'home'));
}

document.addEventListener('DOMContentLoaded', init);
