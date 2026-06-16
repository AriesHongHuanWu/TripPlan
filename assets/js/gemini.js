// ============================================================================
// gemini.js — Gemini Flash chat + agent mode (function calling -> page control)
// ============================================================================
import { DAYS, PASS, TRIP, CITIES, cityByKey, allPois } from './data.js';
import { getCurrentSummary } from './weather.js';
import { el, clear, icon, mdLite, gmapPlace, gmapDir, gmapHotels, toast } from './util.js';

const LS = { key: 'kp_gemini_key', model: 'kp_gemini_model', mode: 'kp_agent_on' };
export function getCfg() {
  return {
    key: localStorage.getItem(LS.key) || '',
    model: localStorage.getItem(LS.model) || 'gemini-flash-latest',
  };
}

let history = [];          // [{role, parts}]
let agentOn = false;
let busy = false;
let API = null;            // app control API injected by main

const TAB_LABEL = { today: '今日', plan: '行程', route: '路線', weather: '天氣', gift: '伴手禮', ai: 'AI' };

// ---- system instruction ----
function tripContext() {
  if (!DAYS.length) return '（目前是一份空白行程，使用者尚未規劃。你可呼叫 plan_trip 幫他從零建立整趟行程。）';
  const days = DAYS.map((d, i) => {
    const acts = d.items.filter(x => x.type !== 'stay').map(x => `${x.time} ${x.title}`).join('、');
    const cn = cityByKey[d.cityKey] ? cityByKey[d.cityKey].name : '';
    return `第${i + 1}天 ${d.date}(${d.dow || ''}) 【${cn}】${d.title}：${acts}`;
  }).join('\n');
  const pass = (PASS && PASS.best) ? `\n\n交通票：建議「${PASS.best}」${PASS.price || ''}／${PASS.days || ''}。` : '';
  return `目前這份行程（${TRIP.title}，${TRIP.start} ~ ${TRIP.end}${TRIP.base ? '，' + TRIP.base : ''}）：\n${days}${pass}`;
}
function systemText() {
  return `你是「Plan AI」— 一位世界級、親切、簡潔的旅遊規劃 AI 助理，使用繁體中文回答。你能規劃「任何國家」的行程。
你掌握使用者目前開啟的這份行程（如下）。回答要具體、可執行；提到交通/車次/時間時提醒以即時 Google Maps / 官方為準。
你可以呼叫工具：get_status 取得使用者目前時間/位置/現在與下一個行程；get_weather 查某城市即時天氣；web_search 用網路查最新資訊（景點是否整修/暫停開放、最新營業時間/票價、活動、交通異動）— 需要即時或不確定的事實時務必先搜尋再回答，並可附上來源。
${agentOn ? '【代理模式開啟】你能操控 App：navigate 切換分頁、open_day 顯示某天、show_on_map 在地圖標出地點、open_google_maps 開啟導航、show_souvenirs 顯示伴手禮、find_hotels 找附近飯店。\n你能「直接幫使用者調整行程」：add_activity 新增、remove_activity 刪除、update_activity 改時間/名稱、move_activity 移到別天、reset_plan 還原。\n你還能「從零規劃一整趟新行程」：當使用者說「幫我規劃一個去○○、玩○天」之類時，呼叫 plan_trip 並把完整需求字串（目的地、天數或起訖日期、出發地/機場、班機時間、偏好）傳入。規劃完呼叫 open_day 顯示第 1 天並用一句話說明重點。若關鍵資訊不足（日期、機場、班機時間），plan_trip 會回傳 needInfo，請改用文字逐項詢問使用者後再規劃。多項調整可連續呼叫多個工具。' : '【代理模式關閉】僅以文字回答；若使用者想調整或從零建立行程，建議他開啟上方代理模式。'}
回答控制在 3–6 句，善用條列。\n\n${tripContext()}`;
}

// ---- tools ----
const READ_TOOLS = [
  { name: 'get_status', description: '取得使用者目前當地時間、今天日期對應的行程、目前與下一個活動，以及（若已授權）所在位置與到下一站距離。回答「我現在/接下來要做什麼」時務必先呼叫。', parameters: { type: 'object', properties: {} } },
  { name: 'get_weather', description: '取得指定城市即時天氣與今日高低溫、降雨機率。', parameters: { type: 'object', properties: { city: { type: 'string', description: '此行程中的城市名稱' } }, required: ['city'] } },
  { name: 'web_search', description: '用網路即時搜尋最新資訊。當需要「最新／即時」或你不確定的事實時呼叫，例如：某景點是否整修中或因災害/事故暫停開放、最新營業時間與票價、當地活動/節慶、交通異動。回答前請以搜尋結果為準並可附上來源。', parameters: { type: 'object', properties: { query: { type: 'string', description: '搜尋關鍵字（可含地名與年份，建議用當地語言或英文較準）' }, recent: { type: 'boolean', description: '是否只要近一個月內的資訊' } }, required: ['query'] } },
];
const CONTROL_TOOLS = [
  { name: 'navigate', description: '切換 App 分頁。', parameters: { type: 'object', properties: { tab: { type: 'string', enum: ['today', 'plan', 'route', 'weather', 'gift', 'ai'] } }, required: ['tab'] } },
  { name: 'open_day', description: '開啟行程分頁並顯示第 N 天。', parameters: { type: 'object', properties: { day: { type: 'integer', description: '第幾天，從 1 起算' } }, required: ['day'] } },
  { name: 'show_on_map', description: '切到地圖分頁並標出某景點或車站。', parameters: { type: 'object', properties: { place: { type: 'string' } }, required: ['place'] } },
  { name: 'open_google_maps', description: '在新分頁開啟 Google 地圖。單點用 query；路線用 origin+destination（預設大眾運輸）。', parameters: { type: 'object', properties: { query: { type: 'string' }, origin: { type: 'string' }, destination: { type: 'string' }, mode: { type: 'string', enum: ['transit', 'walking', 'driving'] } } } },
  { name: 'show_souvenirs', description: '開啟伴手禮分頁並顯示某城市。', parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] } },
  { name: 'find_hotels', description: '在 Google 地圖開啟某地點附近的飯店（含即時房價），用於沿途找住宿。', parameters: { type: 'object', properties: { place: { type: 'string', description: '景點或車站名' } }, required: ['place'] } },
  { name: 'add_activity', description: '在行程某天新增一個活動。', parameters: { type: 'object', properties: { day: { type: 'integer', description: '第幾天 1–8' }, time: { type: 'string', description: 'HH:MM 24小時制' }, title: { type: 'string' }, type: { type: 'string', enum: ['see', 'eat', 'shop', 'move', 'stay'] }, desc: { type: 'string' } }, required: ['day', 'time', 'title'] } },
  { name: 'remove_activity', description: '刪除某天的某個活動（以名稱比對）。', parameters: { type: 'object', properties: { day: { type: 'integer' }, title: { type: 'string' } }, required: ['day', 'title'] } },
  { name: 'update_activity', description: '修改某天某活動的時間/名稱/備註。', parameters: { type: 'object', properties: { day: { type: 'integer' }, title: { type: 'string' }, newTime: { type: 'string' }, newTitle: { type: 'string' }, desc: { type: 'string' } }, required: ['day', 'title'] } },
  { name: 'move_activity', description: '把某活動移到另一天/時間。', parameters: { type: 'object', properties: { day: { type: 'integer' }, title: { type: 'string' }, toDay: { type: 'integer' }, time: { type: 'string' } }, required: ['day', 'title', 'toDay'] } },
  { name: 'reset_plan', description: '把目前行程還原成原始規劃。', parameters: { type: 'object', properties: {} } },
  { name: 'plan_trip', description: '從零規劃一整趟全新行程（任何國家），並套用到目前開啟的計劃。當使用者要你「規劃/安排一趟去某地、玩幾天」的行程時呼叫。', parameters: { type: 'object', properties: { request: { type: 'string', description: '盡量完整的需求：目的地、天數或起訖日期、出發地/機場、班機時間、偏好（美食/親子/節奏）等' } }, required: ['request'] } },
];

function resolveCity(name = '') {
  const n = name.toLowerCase();
  const c = CITIES.find(c => name.includes(c.name) || c.name.includes(name) || c.key === n || (c.jp && c.jp.toLowerCase().includes(n)));
  return (c && c.key) || (CITIES[0] && CITIES[0].key) || '';
}

async function execTool(call) {
  const a = call.args || {};
  try {
    switch (call.name) {
      case 'get_status': return { label: '讀取目前行程狀態', result: API.status() };
      case 'get_weather': { const w = await getCurrentSummary(resolveCity(a.city)); return { label: `查 ${a.city} 即時天氣`, result: w || { error: '無法取得天氣' } }; }
      case 'web_search': {
        try {
          const u = '/api/websearch?q=' + encodeURIComponent(a.query || '') + (a.recent ? '&recent=1' : '') + '&n=5';
          const r = await fetch(u);
          const d = await r.json();
          if (!r.ok || d.error) return { label: `搜尋「${a.query}」`, result: { error: '搜尋暫時無法使用（需部署後才可用）' } };
          return { label: `網路搜尋「${a.query}」`, result: { results: (d.results || []).map(x => ({ title: x.title, url: x.url, snippet: x.content, date: x.date })) } };
        } catch { return { label: `搜尋「${a.query}」`, result: { error: '搜尋暫時無法使用' } }; }
      }
      case 'navigate': API.goTab(a.tab); return { label: `切換到「${TAB_LABEL[a.tab] || a.tab}」分頁`, result: { ok: true } };
      case 'open_day': { const n = Math.max(1, Math.min(DAYS.length || 1, a.day)); API.openDay(n); return { label: `顯示第 ${n} 天行程`, result: { ok: true } }; }
      case 'show_on_map': { const ok = API.showOnMap(a.place); return { label: `在地圖標出「${a.place}」`, result: { ok } }; }
      case 'open_google_maps': {
        const url = (a.origin && a.destination) ? gmapDir(a.origin, a.destination, a.mode || 'transit') : gmapPlace(a.query || a.destination || '');
        API.openMaps(url); return { label: '開啟 Google 導航', result: { url } };
      }
      case 'show_souvenirs': { const key = resolveCity(a.city); API.goSouvenirs(key); return { label: `顯示 ${cityByKey[key].name} 伴手禮`, result: { ok: true } }; }
      case 'find_hotels': {
        const p = allPois.find(p => p.name.includes(a.place) || a.place.includes(p.name) || (p.jp && p.jp.toLowerCase().includes(a.place.toLowerCase())));
        const url = p ? gmapHotels(p.lat, p.lng) : `https://www.google.com/maps/search/${encodeURIComponent(a.place + ' ホテル')}`;
        API.openMaps(url); return { label: `找「${a.place}」附近飯店`, result: { url } };
      }
      case 'add_activity': { const r = API.planAdd(a); return { label: `新增「${a.title}」到第 ${a.day} 天`, result: r }; }
      case 'remove_activity': { const r = API.planRemove(a); return { label: `刪除「${a.title}」`, result: r }; }
      case 'update_activity': { const r = API.planUpdate(a); return { label: `調整「${a.title}」`, result: r }; }
      case 'move_activity': { const r = API.planMove(a); return { label: `移動「${a.title}」到第 ${a.toDay} 天`, result: r }; }
      case 'reset_plan': { const r = API.planReset(); return { label: '還原原始行程', result: r }; }
      case 'plan_trip': {
        const obj = await generateTripPlan({ prompt: a.request });
        if (obj && obj.needInfo && obj.needInfo.length) return { label: '需要更多資訊才能規劃', result: { needInfo: obj.needInfo } };
        const r = API.applyModel ? await API.applyModel(obj) : { ok: false, msg: '無法套用' };
        return { label: `規劃「${a.request}」`, result: r };
      }
      case 'new_plan': { const r = API.newPlan ? API.newPlan(a.title) : { ok: false }; return { label: `建立新計劃${a.title ? `「${a.title}」` : ''}`, result: r }; }
      default: return { label: call.name, result: { error: 'unknown tool' } };
    }
  } catch (e) { return { label: call.name, result: { error: String(e) } }; }
}

// ---- API call ----
async function callGemini(payload) {
  const cfg = getCfg();
  if (cfg.key) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent`;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.key }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error('direct ' + res.status + ': ' + (await res.text()).slice(0, 200));
    return res.json();
  }
  const res = await fetch('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 503 || /GEMINI_API_KEY/i.test(t)) throw new Error('NO_KEY');
    throw new Error('proxy ' + res.status + ': ' + t.slice(0, 200));
  }
  return res.json();
}

// ---- Full-trip generation (any country) -> structured model JSON -------------
// Returns either { needInfo:[{key,question,hint}] } or a full trip object.
export async function generateTripPlan({ prompt, answers } = {}) {
  const sys = `你是 Plan AI，一位世界級旅遊規劃師。根據使用者需求，為「任何國家」產生一份完整、準確、可直接使用的逐日行程，並只輸出「嚴格 JSON」（不要 markdown、不要說明文字）。

先判斷必要資訊是否足夠。必要 = 目的地、以及（天數 或 起訖日期）。次要（可合理假設）= 出發地/機場、班機時間、旅遊節奏、偏好。
若有「真正必要」且無法合理假設的資訊缺漏，只回傳：
{"needInfo":[{"key":"dates","question":"請問你的旅遊日期或天數？","hint":"例如 7/10–7/15 或 5 天"}]}（最多 4 題，先問最關鍵的，問題用繁體中文）。

否則回傳完整行程 JSON（所有人類可讀文字一律繁體中文）：
{
 "trip":{"title":"短標題","subtitle":"一句副標","start":"YYYY-MM-DD","end":"YYYY-MM-DD","days":N,"base":"進出點或概述","country":"國家","emoji":"🗼","currency":{"symbol":"€","rate":34.5,"note":"1 EUR ≈ 34.5 TWD（參考）"}},
 "cities":[{"key":"英數slug","name":"中文名","en":"English","lat":48.8566,"lng":2.3522,"emoji":"🗼","blurb":"一句話特色","pois":[{"name":"中文名","en":"English","lat":48.86,"lng":2.34,"emoji":"📍","tag":"see|eat|shop","desc":"簡短說明","hours":"09:00–18:00","fee":"€20"}]}],
 "routes":[{"from":"城市A","to":"城市B","summary":"交通方式與時間","fare":"票價"}],
 "days":[{"date":"YYYY-MM-DD","cityKey":"對應的城市key","title":"當日主題","summary":"一句話","items":[{"time":"HH:MM","type":"arrive|see|eat|shop|move|stay|depart","title":"活動","desc":"簡短","cost":"€20","lat":48.86,"lng":2.34}]}],
 "pass":{"best":"交通票名稱或留空","price":"","days":"","why":"","highlights":[]},
 "budget":{"fixed":[{"label":"機票/長途交通","amount":15000}],"mealsPerDay":1500,"hotelPerNight":4000,"nights":N-1},
 "packing":["護照","..."],
 "emergency":{"numbers":[{"label":"緊急電話","num":"112","emoji":"🚓"}],"offices":[]}
}

規則：
- lat/lng 必須是真實且正確的座標（著名地點用其實際經緯度）。
- 每個 day 的 cityKey 必須對應 cities 之一的 key。
- 有日期就用使用者的日期；只有天數就從最近的合理日期起算。
- 每天安排 4–7 個活動，時間與當地交通要真實合理；desc 盡量精簡（≤20 字）。
- 金額用「當地貨幣」並含其符號；currency.symbol 用該國符號。
- 只輸出 JSON 物件本身。`;
  const userMsg = `使用者需求：「${(prompt || '').trim() || '(未提供文字，請依常見熱門選擇合理規劃並在 needInfo 詢問關鍵資訊)'}」`
    + (answers && Object.keys(answers).length ? `\n使用者補充資訊：\n${Object.entries(answers).filter(([k]) => k !== '_skip').map(([k, v]) => `- ${k}：${v}`).join('\n')}${answers._skip ? '\n（使用者選擇略過提問，請用合理假設直接完成，不要再回傳 needInfo）' : ''}` : '');
  const data = await callGemini({
    system_instruction: { parts: [{ text: sys }] },
    contents: [{ role: 'user', parts: [{ text: userMsg }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 8192, responseMimeType: 'application/json' },
  });
  const cand = data.candidates && data.candidates[0];
  const text = ((cand && cand.content && cand.content.parts) || []).filter(p => p.text).map(p => p.text).join('').trim();
  let obj = null;
  try { obj = JSON.parse(text); }
  catch { const m = text.match(/\{[\s\S]*\}/); if (m) { try { obj = JSON.parse(m[0]); } catch {} } }
  if (!obj) throw new Error('AI 回傳格式無法解析，請再試一次');
  return obj;
}

// ---- chat turn (with function-calling loop) ----
async function turn(scroll) {
  const tools = [{ functionDeclarations: agentOn ? [...READ_TOOLS, ...CONTROL_TOOLS] : READ_TOOLS }];
  const typing = el('.msg.msg--ai', {}, [el('.typing', {}, [el('span'), el('span'), el('span')])]);
  scroll.appendChild(typing); scroll.scrollTop = scroll.scrollHeight;
  let planChanged = false;

  for (let i = 0; i < 6; i++) {
    let data;
    try {
      data = await callGemini({
        system_instruction: { parts: [{ text: systemText() }] },
        contents: history,
        tools,
        generationConfig: { temperature: 0.6, maxOutputTokens: 1400 },
      });
    } catch (e) {
      typing.remove();
      const msg = e.message === 'NO_KEY'
        ? '⚠️ 尚未設定 Gemini 金鑰。請在 Cloudflare 後台設定環境變數 `GEMINI_API_KEY`，或點右上「設定」貼上你的 API 金鑰即可立即使用。'
        : '⚠️ 連線發生問題：' + e.message;
      addAI(scroll, msg);
      return;
    }
    const cand = data.candidates && data.candidates[0];
    const parts = (cand && cand.content && cand.content.parts) || [];
    const calls = parts.filter(p => p.functionCall).map(p => p.functionCall);

    if (calls.length) {
      // record the model turn EXACTLY as returned — preserves `thoughtSignature` on
      // functionCall parts, which Gemini 3 requires to be echoed back (else 400).
      history.push({ role: 'model', parts: cand.content.parts });
      const responses = [];
      for (const c of calls) {
        const { label, result } = await execTool(c);
        if (/^(add|remove|update|move)_activity$|^new_plan$|^reset_plan$|^plan_trip$/.test(c.name)) planChanged = true;
        typing.before(el('.msg-action', {}, [icon('i-ai'), label]));
        scroll.scrollTop = scroll.scrollHeight;
        responses.push({ functionResponse: { name: c.name, id: c.id, response: typeof result === 'object' ? result : { result } } });
      }
      history.push({ role: 'user', parts: responses });
      continue; // loop again for the model's natural-language reply
    }

    // text reply
    typing.remove();
    const text = parts.filter(p => p.text).map(p => p.text).join('').trim()
      || (cand && cand.finishReason === 'SAFETY' ? '（這個問題我無法回答）' : '（沒有取得回覆，請再試一次）');
    history.push({ role: 'model', parts: (cand && cand.content && cand.content.parts) || [{ text }] });
    addAI(scroll, text);
    if (planChanged && API && API.notifyAI) API.notifyAI('AI 已更新你的行程', text.replace(/\s+/g, ' ').slice(0, 60));
    return;
  }
  typing.remove();
  addAI(scroll, '（已完成多個操作）');
}

function addAI(scroll, text) {
  scroll.appendChild(el('.msg.msg--ai', { html: mdLite(text) }));
  scroll.scrollTop = scroll.scrollHeight;
}
function addUser(scroll, text) {
  scroll.appendChild(el('.msg.msg--user', { text }));
  scroll.scrollTop = scroll.scrollHeight;
}

async function send(scroll, input) {
  const text = input.value.trim();
  if (!text || busy) return;
  busy = true; input.value = ''; input.style.height = 'auto';
  addUser(scroll, text);
  history.push({ role: 'user', parts: [{ text }] });
  if (history.length > 40) history = history.slice(-40);
  try { await turn(scroll); } finally { busy = false; }
}

const SUGGESTIONS = [
  '幫我規劃 5 天的東京自由行',
  '規劃一趟 6 天巴黎，7/10 出發',
  '我現在該做什麼？',
  '幫我把今天排得輕鬆一點',
  '今天要帶傘嗎？',
  '幫我找今晚住宿',
  '下雨了，幫我改成室內景點',
];

export function initGemini(api) {
  API = api;
  const scroll = document.getElementById('chatScroll');
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  const micBtn = document.getElementById('micBtn');
  const sw = document.getElementById('agentSwitch');
  const sug = document.getElementById('chatSuggest');
  const modelLabel = document.getElementById('aiModelLabel');
  if (modelLabel) modelLabel.textContent = (getCfg().key ? '直連 · ' : '') + 'Gemini Flash 3.0';

  // greeting
  addAI(scroll, '你好！我是 **Plan AI** 旅遊助理 👋\n打開上方**代理模式**，我能幫你**從零規劃任何國家的行程**（例如「幫我規劃 5 天東京自由行，7/10 出發」），也能調整目前行程、查天氣、找住宿、在地圖標點與開啟導航。');

  // suggestions
  SUGGESTIONS.forEach(s => sug.appendChild(el('button', { onclick: () => { input.value = s; send(scroll, input); } }, s)));

  sendBtn.addEventListener('click', () => send(scroll, input));
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(scroll, input); } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; });

  // agent toggle
  const setAgent = on => { agentOn = on; sw.classList.toggle('is-on', on); sw.setAttribute('aria-checked', on); };
  sw.addEventListener('click', () => { setAgent(!agentOn); toast(agentOn ? '代理模式已開啟，我可以操控頁面了' : '代理模式已關閉'); });

  // mic (Web Speech API, optional)
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    const rec = new SR(); rec.lang = 'zh-TW'; rec.interimResults = false;
    let recording = false;
    micBtn.addEventListener('click', () => {
      if (recording) { rec.stop(); return; }
      try { rec.start(); recording = true; micBtn.classList.add('is-rec'); } catch {}
    });
    rec.onresult = e => { input.value = e.results[0][0].transcript; input.dispatchEvent(new Event('input')); };
    rec.onend = () => { recording = false; micBtn.classList.remove('is-rec'); };
    rec.onerror = () => { recording = false; micBtn.classList.remove('is-rec'); toast('語音辨識無法使用'); };
  } else {
    micBtn.style.display = 'none';
  }

  return {
    setModelLabel: () => { if (modelLabel) modelLabel.textContent = (getCfg().key ? '直連 · ' : '') + 'Gemini Flash 3.0'; },
    setAgent,
    ask: (text, opts = {}) => { if (opts.agent) setAgent(true); input.value = text; input.dispatchEvent(new Event('input')); send(scroll, input); },
  };
}
