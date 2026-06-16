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
  const days = DAYS.map((d, i) => {
    const acts = d.items.filter(x => x.type !== 'stay').map(x => `${x.time} ${x.title}`).join('、');
    return `第${i + 1}天 ${d.date}(${d.dow}) 【${cityByKey[d.cityKey].name}】${d.title}：${acts}`;
  }).join('\n');
  return `行程總覽（${TRIP.start} ~ ${TRIP.end}，${TRIP.base}）：\n${days}\n\n` +
    `交通票：推薦「${PASS.best}」${PASS.price}／${PASS.days}，含のぞみ・みずほ，涵蓋廣島⇄下關⇄博多⇄熊本（不含阿蘇與四國）。建議 6/19 啟用。`;
}
function systemText() {
  return `你是「九州旅伴」— 一位專業、親切、簡潔的日本九州・本州自由行 AI 助理，使用繁體中文回答。
你掌握使用者的完整 8 日行程（如下）。回答要具體、可執行；提到車次/時間時提醒以即時 Google Maps/JR 官方為準。
你可以呼叫工具：get_status 取得使用者目前時間/位置/現在與下一個行程；get_weather 查即時天氣。
${agentOn ? '【代理模式開啟】你能操控 App：navigate 切換分頁、open_day 顯示某天、show_on_map 在地圖標出地點、open_google_maps 開啟導航、show_souvenirs 顯示伴手禮、find_hotels 找附近飯店。\n你也能「直接幫使用者調整行程」：add_activity 新增、remove_activity 刪除、update_activity 改時間/名稱、move_activity 把活動移到別天、reset_plan 還原、new_plan 建立一份全新計劃。當使用者反映行程有問題（某天太累、想換時間、想加/刪景點、想把 X 移到 Y 天、下雨想改室內），或說「幫我規劃一個新行程」時，主動用這些工具幫他改好/建立，改完呼叫 open_day 顯示那天，並用一句話說明你做了什麼。多項調整可連續呼叫多個工具。' : '【代理模式關閉】僅以文字回答；若使用者想調整行程，建議他開啟上方代理模式，你就能直接幫他改。'}
回答控制在 3–6 句，善用條列。\n\n${tripContext()}`;
}

// ---- tools ----
const READ_TOOLS = [
  { name: 'get_status', description: '取得使用者目前當地時間、今天日期對應的行程、目前與下一個活動，以及（若已授權）所在位置與到下一站距離。回答「我現在/接下來要做什麼」時務必先呼叫。', parameters: { type: 'object', properties: {} } },
  { name: 'get_weather', description: '取得指定城市即時天氣與今日高低溫、降雨機率。', parameters: { type: 'object', properties: { city: { type: 'string', description: '熊本/福岡/下關/廣島/宮島/高松/岡山/大阪/京都/奈良 之一' } }, required: ['city'] } },
];
const CONTROL_TOOLS = [
  { name: 'navigate', description: '切換 App 分頁。', parameters: { type: 'object', properties: { tab: { type: 'string', enum: ['today', 'plan', 'route', 'weather', 'gift', 'ai'] } }, required: ['tab'] } },
  { name: 'open_day', description: '開啟行程分頁並顯示第 N 天（1–8）。', parameters: { type: 'object', properties: { day: { type: 'integer', description: '1–8' } }, required: ['day'] } },
  { name: 'show_on_map', description: '切到地圖分頁並標出某景點或車站。', parameters: { type: 'object', properties: { place: { type: 'string' } }, required: ['place'] } },
  { name: 'open_google_maps', description: '在新分頁開啟 Google 地圖。單點用 query；路線用 origin+destination（預設大眾運輸）。', parameters: { type: 'object', properties: { query: { type: 'string' }, origin: { type: 'string' }, destination: { type: 'string' }, mode: { type: 'string', enum: ['transit', 'walking', 'driving'] } } } },
  { name: 'show_souvenirs', description: '開啟伴手禮分頁並顯示某城市。', parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] } },
  { name: 'find_hotels', description: '在 Google 地圖開啟某地點附近的飯店（含即時房價），用於沿途找住宿。', parameters: { type: 'object', properties: { place: { type: 'string', description: '景點或車站名' } }, required: ['place'] } },
  { name: 'add_activity', description: '在行程某天新增一個活動。', parameters: { type: 'object', properties: { day: { type: 'integer', description: '第幾天 1–8' }, time: { type: 'string', description: 'HH:MM 24小時制' }, title: { type: 'string' }, type: { type: 'string', enum: ['see', 'eat', 'shop', 'move', 'stay'] }, desc: { type: 'string' } }, required: ['day', 'time', 'title'] } },
  { name: 'remove_activity', description: '刪除某天的某個活動（以名稱比對）。', parameters: { type: 'object', properties: { day: { type: 'integer' }, title: { type: 'string' } }, required: ['day', 'title'] } },
  { name: 'update_activity', description: '修改某天某活動的時間/名稱/備註。', parameters: { type: 'object', properties: { day: { type: 'integer' }, title: { type: 'string' }, newTime: { type: 'string' }, newTitle: { type: 'string' }, desc: { type: 'string' } }, required: ['day', 'title'] } },
  { name: 'move_activity', description: '把某活動移到另一天/時間。', parameters: { type: 'object', properties: { day: { type: 'integer' }, title: { type: 'string' }, toDay: { type: 'integer' }, time: { type: 'string' } }, required: ['day', 'title', 'toDay'] } },
  { name: 'reset_plan', description: '把目前行程還原成原始規劃。', parameters: { type: 'object', properties: {} } },
  { name: 'new_plan', description: '建立一份全新的行程計劃（從九州範本複製）並開啟，之後可用其他工具繼續編輯。', parameters: { type: 'object', properties: { title: { type: 'string', description: '計劃名稱' } } } },
];

function resolveCity(name = '') {
  const n = name.toLowerCase();
  const c = CITIES.find(c => name.includes(c.name) || c.name.includes(name) || c.key === n || (c.jp && c.jp.toLowerCase().includes(n)))
    || CITIES.find(c => name.includes('博多') || name.includes('福岡')) && cityByKey.fukuoka
    || cityByKey.fukuoka;
  return (c && c.key) || 'fukuoka';
}

async function execTool(call) {
  const a = call.args || {};
  try {
    switch (call.name) {
      case 'get_status': return { label: '讀取目前行程狀態', result: API.status() };
      case 'get_weather': { const w = await getCurrentSummary(resolveCity(a.city)); return { label: `查 ${a.city} 即時天氣`, result: w || { error: '無法取得天氣' } }; }
      case 'navigate': API.goTab(a.tab); return { label: `切換到「${TAB_LABEL[a.tab] || a.tab}」分頁`, result: { ok: true } };
      case 'open_day': API.openDay(Math.max(1, Math.min(8, a.day))); return { label: `顯示第 ${a.day} 天行程`, result: { ok: true } };
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
        if (/^(add|remove|update|move)_activity$|^new_plan$|^reset_plan$/.test(c.name)) planChanged = true;
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
  '我現在該做什麼？',
  '幫我把今天排得輕鬆一點',
  '第 5 天太累，幫我把屋島拿掉',
  '把宮島改到上午看大鳥居',
  '今天要帶傘嗎？',
  '這趟必買伴手禮推薦',
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
  addAI(scroll, '你好！我是你的**九州旅伴** 👋\n我熟悉你 6/17–6/24 的完整行程。問我路線、天氣、伴手禮或「我現在該做什麼」。\n打開上方**代理模式**，我還能直接幫你**調整行程**（加/刪景點、換時間、把某天的活動移到別天）、切換頁面、在地圖標點與開啟 Google 導航。');

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
