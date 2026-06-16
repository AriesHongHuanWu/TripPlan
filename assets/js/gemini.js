// ============================================================================
// gemini.js — Gemini Flash chat + agent mode (function calling -> page control)
// ============================================================================
import { DAYS, PASS, TRIP, CITIES, cityByKey } from './data.js';
import { getCurrentSummary } from './weather.js';
import { el, clear, icon, mdLite, gmapPlace, gmapDir, toast } from './util.js';

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
${agentOn ? '【代理模式開啟】你還能操控 App：navigate 切換分頁、open_day 顯示某天、show_on_map 在地圖標出地點、open_google_maps 開啟導航、show_souvenirs 顯示伴手禮。當使用者要你「帶我看/打開/導航/顯示」時，主動呼叫對應工具，再用一句話說明你做了什麼。' : '【代理模式關閉】僅以文字回答，必要時建議使用者開啟代理模式以自動操控頁面。'}
回答控制在 3–6 句，善用條列。\n\n${tripContext()}`;
}

// ---- tools ----
const READ_TOOLS = [
  { name: 'get_status', description: '取得使用者目前當地時間、今天日期對應的行程、目前與下一個活動，以及（若已授權）所在位置與到下一站距離。回答「我現在/接下來要做什麼」時務必先呼叫。', parameters: { type: 'object', properties: {} } },
  { name: 'get_weather', description: '取得指定城市即時天氣與今日高低溫、降雨機率。', parameters: { type: 'object', properties: { city: { type: 'string', description: '福岡/熊本/阿蘇/廣島/宮島/下關 之一' } }, required: ['city'] } },
];
const CONTROL_TOOLS = [
  { name: 'navigate', description: '切換 App 分頁。', parameters: { type: 'object', properties: { tab: { type: 'string', enum: ['today', 'plan', 'route', 'weather', 'gift', 'ai'] } }, required: ['tab'] } },
  { name: 'open_day', description: '開啟行程分頁並顯示第 N 天（1–8）。', parameters: { type: 'object', properties: { day: { type: 'integer', description: '1–8' } }, required: ['day'] } },
  { name: 'show_on_map', description: '切到地圖分頁並標出某景點或車站。', parameters: { type: 'object', properties: { place: { type: 'string' } }, required: ['place'] } },
  { name: 'open_google_maps', description: '在新分頁開啟 Google 地圖。單點用 query；路線用 origin+destination（預設大眾運輸）。', parameters: { type: 'object', properties: { query: { type: 'string' }, origin: { type: 'string' }, destination: { type: 'string' }, mode: { type: 'string', enum: ['transit', 'walking', 'driving'] } } } },
  { name: 'show_souvenirs', description: '開啟伴手禮分頁並顯示某城市。', parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] } },
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
      // record model turn
      history.push({ role: 'model', parts: calls.map(c => ({ functionCall: c })) });
      const responses = [];
      for (const c of calls) {
        const { label, result } = await execTool(c);
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
    history.push({ role: 'model', parts: [{ text }] });
    addAI(scroll, text);
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
  '我現在該做什麼？', '明天怎麼去廣島？', '帶我看熊本城在哪',
  '下關有什麼伴手禮？', '今天天氣如何？', '馬關條約在哪裡簽的？',
  '幫我導航到嚴島神社', '宮島看大鳥居的最佳時間？',
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
  addAI(scroll, '你好！我是你的**九州旅伴** 👋\n我熟悉你 6/17–6/24 的完整行程。問我路線、天氣、伴手禮或「我現在該做什麼」。打開上方**代理模式**，我還能直接幫你切換頁面、在地圖標點、開啟 Google 導航。');

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

  return { setModelLabel: () => { if (modelLabel) modelLabel.textContent = (getCfg().key ? '直連 · ' : '') + 'Gemini Flash 3.0'; } };
}
