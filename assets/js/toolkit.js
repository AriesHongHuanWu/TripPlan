// ============================================================================
// toolkit.js — 旅遊錦囊 (in-trip essentials): phrasebook, emergency, currency,
// IC/Pass guide, packing checklist, my bookings, favorites, etiquette.
// ============================================================================
import { PHRASES, EMERGENCY, PACKING, CURRENCY, TIPS, allPois, BUDGET, admissionTotal, DAYS, cityByKey } from './data.js';
import { el, clear, icon, store, favs, toast, gmapPlace, gmapHotels, downloadText } from './util.js';

let API = null;
const $ = id => document.getElementById(id);

export function initToolkit(api) {
  API = api;
  $('toolkitBtn').addEventListener('click', openToolkit);
  $('toolkitClose').addEventListener('click', closeToolkit);
}
function openToolkit() {
  renderHome();
  $('scrim').classList.add('is-open');
  $('toolkitSheet').classList.add('is-open');
}
export function closeToolkit() {
  $('scrim').classList.remove('is-open');
  $('toolkitSheet').classList.remove('is-open');
}

const TILES = [
  { key: 'phrase', t: '實用日語', d: '6 大情境會話・可發音', emoji: '💬', bg: '#4f46e5' },
  { key: 'emergency', t: '緊急求助', d: '110/119・台灣駐處', emoji: '🆘', bg: '#e11d48' },
  { key: 'currency', t: '日幣換算', d: 'JPY ⇄ TWD 即時換算', emoji: '💴', bg: '#16a34a' },
  { key: 'budget', t: '旅費試算', d: '預估總花費・記帳', emoji: '💰', bg: '#0ea5e9' },
  { key: 'pass', t: '車票・IC 卡', d: '周遊券劃位・免稅', emoji: '🎫', bg: '#2563eb' },
  { key: 'packing', t: '行李打包', d: '出發前檢查清單', emoji: '🎒', bg: '#d97706' },
  { key: 'bookings', t: '我的預訂', d: '航班・飯店・票券', emoji: '📋', bg: '#0d9488' },
  { key: 'favs', t: '我的收藏', d: '收藏的景點', emoji: '⭐', bg: '#f5b301' },
  { key: 'etiquette', t: '禮儀・上網', d: '禮儀・WiFi・宅配', emoji: '🎌', bg: '#7c3aed' },
];

function setTitle(t) { $('toolkitTitle').textContent = t; }
function backBar(title) {
  return el('button.tk-back', { onclick: renderHome }, [icon('i-chevron'), '錦囊首頁']);
}
function body() { return $('toolkitBody'); }

function renderHome() {
  setTitle('旅遊錦囊');
  const b = clear(body());
  b.appendChild(el('p', { class: 'tiny muted', style: { margin: '0 2px 14px' }, text: '旅途中需要的一切，一鍵搞定。' }));
  b.appendChild(el('.tk-grid', {}, TILES.map(tl =>
    el('button.tk-tile', { onclick: () => renderTool(tl.key) }, [
      el('.tk-tile__ico', { style: { background: 'var(--surface-2)' }, text: tl.emoji }),
      el('.tk-tile__t', { text: tl.t }),
      el('.tk-tile__d', { text: tl.d }),
    ])
  )));
  b.appendChild(el('button.btn.btn--block', { style: { marginTop: '14px' }, onclick: exportICS }, ['📅 匯出 8 日行程到行事曆 (.ics)']));
}

function exportICS() {
  const pad = n => String(n).padStart(2, '0');
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KyushuPlan//TW//ZH', 'CALSCALE:GREGORIAN'];
  DAYS.forEach((d, i) => {
    const dt = d.date.replace(/-/g, '');
    const dd = new Date(d.date + 'T00:00:00'); dd.setDate(dd.getDate() + 1);
    const end = `${dd.getFullYear()}${pad(dd.getMonth() + 1)}${pad(dd.getDate())}`;
    const sched = d.items.filter(x => x.type !== 'stay').map(x => `${x.time} ${x.title}`).join('\\n');
    L.push('BEGIN:VEVENT', `UID:kyushu-d${i + 1}@kyushuplan`, `DTSTART;VALUE=DATE:${dt}`, `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:Day ${i + 1} ${cityByKey[d.cityKey].name} — ${d.title}`, `DESCRIPTION:${sched}`, 'END:VEVENT');
  });
  L.push('END:VCALENDAR');
  downloadText('kyushu-trip-2026.ics', L.join('\r\n'), 'text/calendar');
  toast('已匯出行事曆 .ics');
}

function renderTool(key) {
  const map = { phrase: renderPhrase, emergency: renderEmergency, currency: renderCurrency, budget: renderBudget, pass: renderPass, packing: renderPacking, bookings: renderBookings, favs: renderFavs, etiquette: renderEtiquette };
  (map[key] || renderHome)();
  body().scrollTop = 0;
}

// ---- Phrasebook ----
function speak(text) {
  try { const u = new SpeechSynthesisUtterance(text); u.lang = 'ja-JP'; u.rate = .9; speechSynthesis.cancel(); speechSynthesis.speak(u); }
  catch { toast('此裝置不支援語音'); }
}
function renderPhrase() {
  setTitle('實用日語');
  const b = clear(body()); b.appendChild(backBar());
  PHRASES.forEach(cat => {
    b.appendChild(el('.ph-cat', {}, [el('span', { text: cat.emoji }), cat.cat]));
    cat.items.forEach(it => {
      b.appendChild(el('.ph-item', { onclick: () => speak(it.jp) }, [
        el('button.ph-speak', { onclick: e => { e.stopPropagation(); speak(it.jp); } }, [icon('i-speaker')]),
        el('.ph-zh', { text: it.zh }),
        el('.ph-jp', { text: it.jp }),
        el('.ph-ro', { text: it.ro }),
      ]));
    });
  });
  b.appendChild(el('p', { class: 'tiny muted-3', style: { marginTop: '12px' }, text: '點任一句即可發音（日語）。' }));
}

// ---- Emergency ----
function renderEmergency() {
  setTitle('緊急求助');
  const b = clear(body()); b.appendChild(backBar());
  const card = el('.emg', {}, [el('div', { style: { fontWeight: '800', fontSize: '15px', marginBottom: '4px' }, text: '🆘 緊急電話（全日本共通）' })]);
  EMERGENCY.numbers.forEach(n => card.appendChild(el('.emg-row', {}, [
    el('div', {}, [el('div', { style: { fontWeight: '700' }, text: `${n.emoji} ${n.num}` }), el('div', { style: { fontSize: '11.5px', opacity: '.9' }, text: n.label })]),
    el('a.emg-call', { href: `tel:${n.num.replace(/[^0-9]/g, '')}` }, '撥打'),
  ])));
  b.appendChild(card);

  b.appendChild(el('.info-card', {}, [
    el('div', { style: { fontWeight: '700', marginBottom: '6px' }, text: '🇹🇼 ' + EMERGENCY.taiwanLine.label }),
    el('.row.wrap', { style: { gap: '8px' } }, [
      el('a.chip.chip--brand', { href: `tel:${EMERGENCY.taiwanLine.intl.replace(/[^0-9+]/g, '')}` }, [icon('i-phone'), EMERGENCY.taiwanLine.intl]),
    ]),
    el('p', { class: 'tiny muted', style: { marginTop: '8px', lineHeight: '1.6' }, text: EMERGENCY.taiwanLine.note }),
  ]));

  EMERGENCY.offices.forEach(o => b.appendChild(el('.info-card', {}, [
    el('div', { style: { fontWeight: '700' }, text: o.name }),
    el('.tiny.muted', { style: { margin: '3px 0 8px' }, text: o.area }),
    el('.tiny', { style: { color: 'var(--text-2)' }, text: '📍 ' + o.addr }),
    el('.row.wrap', { style: { gap: '8px', marginTop: '10px' } }, [
      el('a.chip', { href: `tel:${o.tel.replace(/[^0-9]/g, '')}` }, [icon('i-phone'), '領務 ' + o.tel]),
      el('a.chip.chip--sakura', { href: `tel:${o.emg.replace(/[^0-9]/g, '')}` }, [icon('i-phone'), '急難 ' + o.emg]),
      el('a.chip', { href: gmapPlace(o.name, null, null), target: '_blank', rel: 'noopener' }, [icon('i-ext'), '地圖']),
    ]),
  ])));

  b.appendChild(el('.info-card', {}, [
    el('div', { style: { fontWeight: '700', marginBottom: '6px' }, text: '📝 遺失護照／證件處理' }),
    el('.stack', { style: { gap: '6px' } }, EMERGENCY.steps.map(s => el('.tiny', { style: { color: 'var(--text-2)', lineHeight: '1.55' }, text: '• ' + s }))),
  ]));
}

// ---- Currency ----
function renderCurrency() {
  setTitle('日幣換算');
  const b = clear(body()); b.appendChild(backBar());
  let rate = store.get('kp_rate', CURRENCY.rate);
  const jpy = el('input.cc-input', { type: 'number', inputmode: 'numeric', value: '10000' });
  const twd = el('input.cc-input', { type: 'number', inputmode: 'numeric', value: Math.round(10000 * rate) });
  let editing = null;
  const sync = from => { editing = from;
    if (from === 'jpy') twd.value = Math.round((parseFloat(jpy.value) || 0) * rate);
    else jpy.value = Math.round((parseFloat(twd.value) || 0) / rate);
    editing = null;
  };
  jpy.addEventListener('input', () => editing !== 'twd' && sync('jpy'));
  twd.addEventListener('input', () => editing !== 'jpy' && sync('twd'));

  b.appendChild(el('.cc-row', {}, [el('span.cc-flag', { text: '🇯🇵' }), el('div', {}, [el('.cc-cur', { text: '日圓 JPY' })]), jpy]));
  b.appendChild(el('.cc-row', {}, [el('span.cc-flag', { text: '🇹🇼' }), el('div', {}, [el('.cc-cur', { text: '台幣 TWD' })]), twd]));
  b.appendChild(el('.cc-rate', { text: `匯率 1 JPY = ${rate} TWD` }));
  b.appendChild(el('.cc-quick', {}, [100, 500, 1000, 3000, 5000, 10000].map(v =>
    el('button.chip.chip--tap', { onclick: () => { jpy.value = v; sync('jpy'); } }, `¥${v.toLocaleString()}`))));

  b.appendChild(el('.divider'));
  b.appendChild(el('label', { class: 'tiny muted-3', text: '自訂匯率（1 日圓 = ? 台幣）' }));
  const rateIn = el('input', { type: 'number', step: '0.001', value: rate, style: { width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--line-strong)', background: 'var(--surface)', marginTop: '4px' } });
  rateIn.addEventListener('input', () => { rate = parseFloat(rateIn.value) || rate; store.set('kp_rate', rate); sync('jpy'); });
  b.appendChild(rateIn);
  b.appendChild(el('p', { class: 'tiny muted-3', style: { marginTop: '8px' }, text: CURRENCY.note + ' 心算：日圓 ÷ 5 ≈ 台幣。' }));
}

// ---- Budget: trip estimate + expense log ----
const yen = n => '¥' + Math.round(n).toLocaleString();
function renderBudget() {
  setTitle('旅費試算');
  const b = clear(body()); b.appendChild(backBar());
  const rate = store.get('kp_rate', CURRENCY.rate);
  const cfg = store.get('kp_budgetcfg', { meals: BUDGET.mealsPerDay, hotel: BUDGET.hotelPerNight, other: 0 });
  const adm = admissionTotal();

  // ---- Estimate ----
  b.appendChild(el('.ph-cat', {}, ['📊 預估總花費（每人）']));
  const estCard = el('.card.card--pad', {});
  function recomputeEst() {
    clear(estCard);
    const rows = [
      ...BUDGET.fixed.map(f => [f.label, f.amount]),
      ['門票（行程內景點合計）', adm],
      [`餐食（${cfg.meals.toLocaleString()}/日 × 8）`, cfg.meals * 8],
      [`住宿（${cfg.hotel.toLocaleString()}/晚 × ${BUDGET.nights}）`, cfg.hotel * BUDGET.nights],
      ['其他（購物/雜支）', cfg.other],
    ];
    const total = rows.reduce((s, r) => s + r[1], 0);
    rows.forEach(r => estCard.appendChild(el('.emg-row', { style: { borderColor: 'var(--line)' } }, [
      el('span', { style: { fontSize: '13px', color: 'var(--text-2)' }, text: r[0] }),
      el('span', { style: { fontWeight: '700', fontVariantNumeric: 'tabular-nums' }, text: yen(r[1]) }),
    ])));
    estCard.appendChild(el('.row-between', { style: { marginTop: '10px', paddingTop: '10px', borderTop: '2px solid var(--line)' } }, [
      el('span', { style: { fontWeight: '800' }, text: '合計' }),
      el('div', { style: { textAlign: 'right' } }, [
        el('div', { style: { fontWeight: '800', fontSize: '18px', color: 'var(--brand-2)' }, text: yen(total) }),
        el('.tiny.muted', { text: '≈ NT$ ' + Math.round(total * rate).toLocaleString() }),
      ]),
    ]));
  }
  recomputeEst();
  b.appendChild(estCard);
  // editable assumptions
  const adj = (label, key, step) => {
    const inp = el('input', { type: 'number', step: step || 1000, value: cfg[key], style: { width: '100%', padding: '8px 10px', borderRadius: '10px', border: '1px solid var(--line-strong)', background: 'var(--surface)' } });
    inp.addEventListener('input', () => { cfg[key] = parseInt(inp.value) || 0; store.set('kp_budgetcfg', cfg); recomputeEst(); });
    return el('.bk-field', { style: { marginBottom: '8px' } }, [el('label', { text: label }), inp]);
  };
  b.appendChild(el('.tiny.muted', { style: { margin: '12px 2px 6px' }, text: '可調整下列估值：' }));
  b.appendChild(adj('餐食 / 每日 (¥)', 'meals'));
  b.appendChild(adj('住宿 / 每晚 (¥)', 'hotel'));
  b.appendChild(adj('其他預算 (¥)', 'other'));

  // ---- Expense log ----
  b.appendChild(el('.divider'));
  b.appendChild(el('.ph-cat', {}, ['🧾 實際花費紀錄']));
  let expenses = store.get('kp_expenses', []);
  let curCat = 'food';
  const amount = el('input', { type: 'number', inputmode: 'numeric', placeholder: '金額 (¥)', style: { width: '100%', padding: '11px 13px', borderRadius: '12px', border: '1px solid var(--line-strong)', background: 'var(--surface)', fontSize: '16px' } });
  const note = el('input', { type: 'text', placeholder: '備註（選填）', style: { width: '100%', padding: '10px 13px', borderRadius: '12px', border: '1px solid var(--line-strong)', background: 'var(--surface)', marginTop: '8px' } });
  const catRow = el('.cc-quick', { style: { marginTop: '8px' } });
  Object.entries(BUDGET.catLabels).forEach(([k, v]) =>
    catRow.appendChild(el('button.chip.chip--tap' + (k === curCat ? '.is-on' : ''), { onclick: e => { curCat = k; [...catRow.children].forEach(c => c.classList.remove('is-on')); e.currentTarget.classList.add('is-on'); } }, v)));
  const listWrap = el('div', { style: { marginTop: '12px' } });
  const totalWrap = el('div', {});
  function renderList() {
    clear(listWrap); clear(totalWrap);
    if (!expenses.length) { listWrap.appendChild(el('.tiny.muted-3', { style: { padding: '8px 2px' }, text: '尚無紀錄。新增第一筆花費吧！' })); return; }
    const byCat = {};
    expenses.forEach((e, idx) => {
      byCat[e.cat] = (byCat[e.cat] || 0) + e.amount;
      listWrap.appendChild(el('.emg-row', { style: { borderColor: 'var(--line)' } }, [
        el('span', { style: { fontSize: '13px' }, text: `${BUDGET.catLabels[e.cat] || e.cat}${e.note ? ' · ' + e.note : ''}` }),
        el('.row', { style: { gap: '8px' } }, [
          el('span', { style: { fontWeight: '700', fontVariantNumeric: 'tabular-nums' }, text: yen(e.amount) }),
          el('button.iconbtn', { style: { width: '28px', height: '28px' }, onclick: () => { expenses.splice(idx, 1); store.set('kp_expenses', expenses); renderList(); } }, [icon('i-close')]),
        ]),
      ]));
    });
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    totalWrap.appendChild(el('.row-between', { style: { marginTop: '10px', paddingTop: '10px', borderTop: '2px solid var(--line)' } }, [
      el('span', { style: { fontWeight: '800' }, text: '已花費合計' }),
      el('div', { style: { textAlign: 'right' } }, [el('div', { style: { fontWeight: '800', fontSize: '17px', color: 'var(--sakura)' }, text: yen(total) }), el('.tiny.muted', { text: '≈ NT$ ' + Math.round(total * rate).toLocaleString() })]),
    ]));
    totalWrap.appendChild(el('.row.wrap', { style: { gap: '6px', marginTop: '8px' } }, Object.entries(byCat).map(([k, v]) => el('span.chip', { text: `${BUDGET.catLabels[k] || k} ${yen(v)}` }))));
  }
  const addBtn = el('button.btn.btn--brand.btn--block', { style: { marginTop: '10px' }, onclick: () => {
    const a = parseInt(amount.value); if (!a) { toast('請輸入金額'); return; }
    expenses.unshift({ amount: a, cat: curCat, note: note.value.trim() }); store.set('kp_expenses', expenses);
    amount.value = ''; note.value = ''; renderList();
  } }, ['＋ 新增花費']);
  b.appendChild(amount); b.appendChild(catRow); b.appendChild(note); b.appendChild(addBtn);
  b.appendChild(listWrap); b.appendChild(totalWrap);
  renderList();
}

// ---- Pass / IC / tax-free ----
function renderPass() {
  setTitle('車票・IC 卡');
  const b = clear(body()); b.appendChild(backBar());
  const sec = (title, arr) => { b.appendChild(el('.ph-cat', {}, [title])); b.appendChild(el('.info-card', {}, arr.map(s => el('.tiny', { style: { color: 'var(--text-2)', lineHeight: '1.7', padding: '2px 0' }, text: '• ' + s })))); };
  sec('🎫 周遊券 & IC 卡', TIPS.iccard);
  sec('🧾 免稅購物', TIPS.taxfree);
}

// ---- Packing checklist ----
function renderPacking() {
  setTitle('行李打包');
  const b = clear(body()); b.appendChild(backBar());
  const state = store.get('kp_packing', {});
  const done = PACKING.filter(i => state[i]).length;
  const head = el('.row-between', { style: { marginBottom: '6px' } }, [
    el('.h-card', { text: '出發前檢查清單' }),
    el('span.chip.chip--brand', { id: 'ckCount', text: `${done}/${PACKING.length}` }),
  ]);
  b.appendChild(head);
  const list = el('.card.card--pad', {});
  PACKING.forEach(item => {
    const row = el('.ck-item' + (state[item] ? '.done' : ''), {}, [
      el('.ck-box', {}, [icon('i-check')]),
      el('.ck-label', { text: item }),
    ]);
    row.addEventListener('click', () => {
      state[item] = !state[item]; store.set('kp_packing', state);
      row.classList.toggle('done', state[item]);
      $('ckCount').textContent = `${PACKING.filter(i => state[i]).length}/${PACKING.length}`;
    });
    list.appendChild(row);
  });
  b.appendChild(list);
}

// ---- My bookings ----
function renderBookings() {
  setTitle('我的預訂');
  const b = clear(body()); b.appendChild(backBar());
  const data = store.get('kp_bookings', {});
  const fields = [
    ['flight', '✈️ 航班（去/回・班次・時間）'],
    ['pass', '🎫 JR 周遊券（兌換號碼/取票點）'],
    ['hotel', '🏨 飯店（每晚名稱・地址・訂房號）'],
    ['note', '📝 其他備註（緊急聯絡・保險）'],
  ];
  b.appendChild(el('p', { class: 'tiny muted', style: { margin: '0 2px 12px' }, text: '把重要訂房/票券資訊存在這裡，離線也看得到（僅存在本機）。' }));
  fields.forEach(([k, label]) => {
    const ta = el('textarea', { rows: k === 'note' || k === 'hotel' ? 4 : 2 });
    ta.value = data[k] || '';
    ta.addEventListener('input', () => { data[k] = ta.value; store.set('kp_bookings', data); });
    b.appendChild(el('.bk-field', {}, [el('label', { text: label }), ta]));
  });
  b.appendChild(el('p', { class: 'tiny muted-3', text: '自動儲存。' }));
}

// ---- Favorites ----
function renderFavs() {
  setTitle('我的收藏');
  const b = clear(body()); b.appendChild(backBar());
  const list = favs.list();
  if (!list.length) {
    b.appendChild(el('.empty', {}, [el('.empty__emoji', { text: '⭐' }), el('div', { text: '還沒有收藏。' }), el('.tiny.muted', { style: { marginTop: '6px' }, text: '在景點詳情頁點星號即可收藏。' })]));
    return;
  }
  list.forEach(name => {
    const p = allPois.find(p => p.name === name);
    b.appendChild(el('.card.card--pad', { style: { marginBottom: '10px' } }, [
      el('.row-between', {}, [
        el('div', {}, [el('div', { style: { fontWeight: '650' }, text: (p ? p.emoji + ' ' : '⭐ ') + name }), p ? el('.tiny.muted', { text: p.cityName }) : null]),
        el('button.fav-btn.is-fav', { onclick: e => { favs.toggle(name); renderFavs(); } }, [icon('i-star')]),
      ]),
      el('.row.wrap', { style: { gap: '8px', marginTop: '10px' } }, [
        p ? el('a.gmap-btn', { href: gmapPlace(p.name, p.lat, p.lng), target: '_blank', rel: 'noopener' }, [icon('i-ext'), '導航']) : null,
        p ? el('button.gmap-btn', { onclick: () => { closeToolkit(); API.showOnMap(p.name); } }, [icon('i-pin'), '地圖']) : null,
        p ? el('a.gmap-btn', { href: gmapHotels(p.lat, p.lng), target: '_blank', rel: 'noopener', style: { borderColor: 'var(--sakura)', color: 'var(--sakura)' } }, ['🏨 附近飯店']) : null,
      ]),
    ]));
  });
}

// ---- Etiquette / connectivity ----
function renderEtiquette() {
  setTitle('禮儀・上網');
  const b = clear(body()); b.appendChild(backBar());
  b.appendChild(el('.ph-cat', {}, ['🎌 旅遊禮儀']));
  b.appendChild(el('.info-card', {}, TIPS.etiquette.map(s => el('.tiny', { style: { color: 'var(--text-2)', lineHeight: '1.7', padding: '2px 0' }, text: '• ' + s }))));
  b.appendChild(el('.ph-cat', {}, ['📶 上網・貨幣・行李']));
  b.appendChild(el('.info-card', {}, TIPS.connectivity.map(s => el('.tiny', { style: { color: 'var(--text-2)', lineHeight: '1.7', padding: '2px 0' }, text: '• ' + s }))));
}
