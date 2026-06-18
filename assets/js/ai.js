// ============================================================================
// ai.js — Plan AI assistant: chat + agent mode (function calling -> page control)
//         + full-trip generation. Provider is proxied via /api/ai (kept private).
// ============================================================================
import { DAYS, PASS, TRIP, CITIES, cityByKey, allPois } from './data.js';
import { getCurrentSummary } from './weather.js';
import { el, clear, icon, mdLite, gmapPlace, gmapDir, gmapHotels, toast, ymd } from './util.js';
import { t, getLang } from './i18n.js';

const LS = { key: 'kp_gemini_key', model: 'kp_gemini_model', mode: 'kp_agent_on' };
export function getCfg() {
  const raw = localStorage.getItem(LS.key) || '';
  // Allow MULTIPLE keys (comma / space / newline separated) → rotate on rate-limit.
  const keys = raw.split(/[\s,;]+/).map(k => k.trim()).filter(Boolean);
  return {
    key: keys[0] || '',          // back-compat: first key
    keys,                        // all keys, for rotation
    model: localStorage.getItem(LS.model) || 'gemini-flash-lite-latest',   // newest Flash Lite (= 3.x when live); fast + high free quota
  };
}

let history = [];          // [{role, parts}]
let agentOn = false;
let busy = false;
let API = null;            // app control API injected by main

const TAB_LABEL = { today: '今日', plan: '行程', route: '路線', weather: '天氣', gift: '伴手禮', ai: 'AI' };

// ---- system instruction ----
function tripContext() {
  const today = ymd(new Date());
  if (!DAYS.length) return t('ai.sys.ctx.today', { today }) + '\n' + t('ai.sys.ctx.empty');
  const cities = CITIES.map(c => c.name).filter(Boolean).join('、') || t('ai.sys.ctx.citiesNotSet');
  const days = DAYS.map((d, i) => {
    const acts = d.items.filter(x => x.type !== 'stay').map(x => `${x.time} ${x.title}${x.cost ? '(' + x.cost + ')' : ''}`).join('、') || t('ai.sys.ctx.notScheduled');
    const cn = cityByKey[d.cityKey] ? cityByKey[d.cityKey].name : '';
    return t('ai.sys.ctx.day', { n: i + 1, date: d.date, dow: d.dow || '', city: cn, title: d.title, acts });
  }).join('\n');
  const pass = (PASS && PASS.best) ? t('ai.sys.ctx.pass', { best: PASS.best, price: PASS.price || '', days: PASS.days || '' }) : '';
  const base = TRIP.base ? '，' + TRIP.base : '';
  return t('ai.sys.ctx.today', { today }) + '\n'
    + t('ai.sys.ctx.trip', { title: TRIP.title, start: TRIP.start, end: TRIP.end, days: DAYS.length, base, cities })
    + '\n' + days + pass;
}
function systemText() {
  const name = getLang() === 'en' ? 'English' : '繁體中文';
  // i18n persona/tools/brevity + language directive, but keep the (model-facing)
  // enhanced agent-mode instruction from origin/main verbatim.
  const agentBlock = agentOn
    ? '【代理模式開啟】你能操控 App 並直接修改這份行程：navigate、open_day、show_on_map、open_google_maps、show_souvenirs、find_hotels；add_activity／remove_activity／update_activity／move_activity 調整單一活動；add_day／remove_day 增減天數；reset_plan 還原。\n「從零規劃整趟」：使用者說「幫我規劃去○○、玩○天」時呼叫 plan_trip（在 request 中盡量帶齊：目的地、天數或起訖日期、出發地/機場、班機時間、偏好、預算、同行）。plan_trip 會自動產生「像專業旅遊書一樣完整」的行程（每城多個景點、每天 5–8 個含時間/停留/花費的活動、城市間交通、交通票、預算、打包、各城伴手禮、當地緊急電話）。完成後務必呼叫 open_day 1 讓使用者看到行程，並用 2–3 句說明重點與亮點。關鍵資訊不足時先用文字逐項問清楚（日期、機場、班機時間）再規劃。複雜調整可連續呼叫多個工具。'
    : t('ai.sys.agentOff');
  return [
    t('ai.sys.persona', { name }),
    t('ai.sys.tools'),
    agentBlock,
    t('ai.sys.brevity'),
    t('ai.sys.langDirective'),
  ].join('\n') + '\n\n' + tripContext();
}

// ---- tools ----
const READ_TOOLS = [
  { name: 'get_status', description: '取得使用者目前當地時間、今天日期對應的行程、目前與下一個活動，以及（若已授權）所在位置與到下一站距離。回答「我現在/接下來要做什麼」時務必先呼叫。', parameters: { type: 'object', properties: {} } },
  { name: 'get_weather', description: '取得指定城市即時天氣與今日高低溫、降雨機率。', parameters: { type: 'object', properties: { city: { type: 'string', description: '此行程中的城市名稱' } }, required: ['city'] } },
  { name: 'web_search', description: '用網路即時搜尋最新資訊。當需要「最新／即時」或你不確定的事實時呼叫，例如：最新營業時間與票價、當地活動/節慶、交通異動。回答前請以搜尋結果為準並可附上來源。', parameters: { type: 'object', properties: { query: { type: 'string', description: '搜尋關鍵字（可含地名與年份，建議用當地語言或英文較準）' }, recent: { type: 'boolean', description: '是否只要近一個月內的資訊' } }, required: ['query'] } },
  { name: 'check_hazards', description: '查詢某景點/地區「目前是否因災害、天災、事故或施工而暫停開放或需特別注意安全」。當使用者問安不安全、能不能去、有沒有關閉，或你在規劃/即將前往某地時主動確認現況，務必呼叫。', parameters: { type: 'object', properties: { place: { type: 'string', description: '景點或地區名稱（含城市與國家更準）' } }, required: ['place'] } },
];
const CONTROL_TOOLS = [
  { name: 'navigate', description: '切換 App 分頁。', parameters: { type: 'object', properties: { tab: { type: 'string', enum: ['today', 'plan', 'route', 'weather', 'gift', 'ai'] } }, required: ['tab'] } },
  { name: 'open_day', description: '開啟行程分頁並顯示第 N 天。', parameters: { type: 'object', properties: { day: { type: 'integer', description: '第幾天，從 1 起算' } }, required: ['day'] } },
  { name: 'show_on_map', description: '切到地圖分頁並標出某景點或車站。', parameters: { type: 'object', properties: { place: { type: 'string' } }, required: ['place'] } },
  { name: 'open_google_maps', description: '在新分頁開啟 Google 地圖。單點用 query；路線用 origin+destination（預設大眾運輸）。', parameters: { type: 'object', properties: { query: { type: 'string' }, origin: { type: 'string' }, destination: { type: 'string' }, mode: { type: 'string', enum: ['transit', 'walking', 'driving'] } } } },
  { name: 'show_souvenirs', description: '開啟伴手禮分頁並顯示某城市。', parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] } },
  { name: 'find_hotels', description: '在 Google 地圖開啟某地點附近的飯店（含即時房價），用於沿途找住宿。', parameters: { type: 'object', properties: { place: { type: 'string', description: '景點或車站名' } }, required: ['place'] } },
  { name: 'add_activity', description: '在行程某天新增一個活動。若為知名地點，請一併提供真實的 lat/lng 以便在地圖標點。', parameters: { type: 'object', properties: { day: { type: 'integer', description: '第幾天 1–8' }, time: { type: 'string', description: 'HH:MM 24小時制' }, title: { type: 'string' }, type: { type: 'string', enum: ['see', 'eat', 'shop', 'move', 'stay'] }, desc: { type: 'string' }, lat: { type: 'number', description: '緯度（確知才填，不確定就留空）' }, lng: { type: 'number', description: '經度（同上）' } }, required: ['day', 'time', 'title'] } },
  { name: 'remove_activity', description: '刪除某天的某個活動（以名稱比對）。', parameters: { type: 'object', properties: { day: { type: 'integer' }, title: { type: 'string' } }, required: ['day', 'title'] } },
  { name: 'update_activity', description: '修改某天某活動的時間/名稱/備註。', parameters: { type: 'object', properties: { day: { type: 'integer' }, title: { type: 'string' }, newTime: { type: 'string' }, newTitle: { type: 'string' }, desc: { type: 'string' } }, required: ['day', 'title'] } },
  { name: 'move_activity', description: '把某活動移到另一天/時間。', parameters: { type: 'object', properties: { day: { type: 'integer' }, title: { type: 'string' }, toDay: { type: 'integer' }, time: { type: 'string' } }, required: ['day', 'title', 'toDay'] } },
  { name: 'add_day', description: '在行程「增加一天」（延長天數）。可指定日期、城市與主題；不指定日期則接在最後一天之後。', parameters: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD，可省略' }, city: { type: 'string', description: '當天主要城市名，可省略' }, title: { type: 'string', description: '當天主題，可省略' } } } },
  { name: 'remove_day', description: '刪除第 N 天（其後天數會自動往前遞補）。', parameters: { type: 'object', properties: { day: { type: 'integer', description: '第幾天，從 1 起算' } }, required: ['day'] } },
  { name: 'reset_plan', description: '把目前行程還原成原始規劃。', parameters: { type: 'object', properties: {} } },
  { name: 'plan_trip', description: '從零規劃一整趟全新行程（任何國家），並套用到目前開啟的計劃。當使用者要你「規劃/安排一趟去某地、玩幾天」的行程時呼叫。', parameters: { type: 'object', properties: { request: { type: 'string', description: '盡量完整的需求：目的地、天數或起訖日期、出發地/機場、班機時間、偏好（美食/親子/節奏）等' } }, required: ['request'] } },
  { name: 'new_plan', description: '建立一個全新的空白計劃並開啟（之後可請 AI 規劃或手動編輯）。當使用者要「開一個新行程/新計劃」時呼叫。', parameters: { type: 'object', properties: { title: { type: 'string', description: '新計劃名稱，可省略' } } } },
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
      case 'show_souvenirs': { const key = resolveCity(a.city); API.goSouvenirs(key); const nm = (cityByKey[key] || {}).name || a.city || ''; return { label: `顯示 ${nm} 伴手禮`, result: { ok: true } }; }
      case 'find_hotels': {
        const p = allPois.find(p => p.name.includes(a.place) || a.place.includes(p.name) || (p.jp && p.jp.toLowerCase().includes(a.place.toLowerCase())));
        const url = p ? gmapHotels(p.lat, p.lng) : `https://www.google.com/maps/search/${encodeURIComponent(a.place + ' ホテル')}`;
        API.openMaps(url); return { label: `找「${a.place}」附近飯店`, result: { url } };
      }
      case 'add_activity': { const r = API.planAdd(a); return { label: `新增「${a.title}」到第 ${a.day} 天`, result: r }; }
      case 'remove_activity': { const r = API.planRemove(a); return { label: `刪除「${a.title}」`, result: r }; }
      case 'update_activity': { const r = API.planUpdate(a); return { label: `調整「${a.title}」`, result: r }; }
      case 'move_activity': { const r = API.planMove(a); return { label: `移動「${a.title}」到第 ${a.toDay} 天`, result: r }; }
      case 'add_day': { const r = API.planAddDay ? API.planAddDay(a) : { ok: false }; return { label: '新增一天', result: r }; }
      case 'remove_day': { const r = API.planRemoveDay ? API.planRemoveDay(a) : { ok: false }; return { label: `刪除第 ${a.day} 天`, result: r }; }
      case 'reset_plan': { const r = API.planReset(); return { label: '還原原始行程', result: r }; }
      case 'check_hazards': {
        try {
          const q = (a.place || '') + ' 開放 OR closed OR 休園 OR 災害 OR 地震 OR 颱風 OR 通行止め OR closure OR disaster OR warning';
          const r = await fetch('/api/websearch?q=' + encodeURIComponent(q) + '&recent=1&n=5');
          const d = await r.json();
          if (!r.ok || d.error) return { label: `查「${a.place}」現況`, result: { note: '即時查詢需部署後才可用；目前無法確認，建議出發前再查官方公告。' } };
          return { label: `查「${a.place}」是否有災害/封閉`, result: { place: a.place, results: (d.results || []).map(x => ({ title: x.title, snippet: x.content, url: x.url, date: x.date })) } };
        } catch { return { label: `查「${a.place}」現況`, result: { error: '查詢失敗' } }; }
      }
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
// Model aliases drift; if the configured model 404s we transparently retry with
// known-good fallbacks so a stale model id never breaks the whole AI.
// Flash Lite first (fast + high free quota); the bigger flash models are only deeper fallbacks.
const MODEL_FALLBACKS = ['gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];
const modelMissing = (status, t) => status === 404 || /not\s*found|not\s*supported|unknown name|is not found|call ListModels/i.test(t || '');
// Rate-limit / quota exhaustion (free-tier RPD/TPM). Different models often have
// separate quota pools, so on 429 we try the next model before giving up.
const isRateLimit = (status, t) => status === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit|too many requests/i.test(t || '');
const isBadKey = (status, t) => status === 401 || status === 403 || (status === 400 && /api.?key|API_KEY_INVALID|invalid.{0,8}key/i.test(t || ''));
// 503 / UNAVAILABLE / "model overloaded" = transient busy → retry on the next model/key (flash-lite).
const isOverloaded = (status, t) => status === 503 || /overloaded|unavailable|try again later/i.test(t || '');
async function callGemini(payload) {
  const cfg = getCfg();
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('OFFLINE');   // skip the full timeout when clearly offline
  if (cfg.keys && cfg.keys.length) {
    const models = [cfg.model, ...MODEL_FALLBACKS].filter((m, i, a) => m && a.indexOf(m) === i);
    let lastErr = 'direct error', rate = false, busy = false;
    // MODEL-outer / KEY-inner: each better model is tried across EVERY key before
    // degrading to the next model, so flash-lite is only used as a last resort.
    for (const m of models) {
      for (const key of cfg.keys) {
        let res;
        try {
          res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
            { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(payload) });
        } catch (e) { lastErr = '無法連線到 AI（網路或瀏覽器阻擋）：' + (e && e.message || e); continue; }
        if (res.ok) return res.json();
        const t = await res.text();
        lastErr = 'direct ' + res.status + ': ' + t.slice(0, 220);
        if (isRateLimit(res.status, t)) { rate = true; continue; }   // this key throttled → next key
        if (isOverloaded(res.status, t)) { busy = true; continue; }  // model overloaded → next key/model (flash-lite)
        if (modelMissing(res.status, t)) break;                      // stale alias → next model (no key fixes it)
        if (isBadKey(res.status, t)) continue;                       // dud/blocked key → next key
        throw new Error(lastErr);                                    // genuine error — surface it
      }
    }
    throw new Error(rate ? 'RATE_LIMIT' : busy ? 'BUSY' : lastErr);
  }
  let res;
  try { res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); }
  catch (e) { throw new Error('無法連線到伺服器：' + (e && e.message || e)); }
  if (!res.ok) {
    const t = await res.text();
    // Only a genuinely missing server key / undeployed function is NO_KEY. Google ALSO answers 503
    // (UNAVAILABLE / "model overloaded") when a free-tier model is busy — that must NOT look like "no key".
    if (res.status === 404 || res.status === 405 || /key not set on the server|AI key not set|GEMINI_API_KEY/i.test(t)) throw new Error('NO_KEY');
    if (res.status === 503 || /overloaded|unavailable|try again later/i.test(t)) throw new Error('BUSY');
    if (isRateLimit(res.status, t)) throw new Error('RATE_LIMIT');
    throw new Error('proxy ' + res.status + ': ' + t.slice(0, 220));
  }
  return res.json();
}

// ---- Full-trip generation (any country) -> structured model JSON -------------
// Returns either { needInfo:[{key,question,hint}] } or a full trip object.
// Gemini structured-output schema (OpenAPI subset) — forces a complete, well-shaped
// model so generated trips are as rich as the curated template. Top-level has NO
// required keys so a needInfo-only reply also validates. Souvenirs is an ARRAY of
// {cityKey,items} because JSON Schema can't express arbitrary-key maps (normalizeModel
// converts it to the keyed map the app uses).
const _leg = { type: 'OBJECT', properties: { dep: { type: 'STRING' }, arr: { type: 'STRING' }, line: { type: 'STRING' }, type: { type: 'STRING' }, dur: { type: 'STRING' }, note: { type: 'STRING' } } };
const TRIP_SCHEMA = {
  type: 'OBJECT',
  properties: {
    trip: { type: 'OBJECT', properties: {
      title: { type: 'STRING' }, subtitle: { type: 'STRING' }, start: { type: 'STRING' }, end: { type: 'STRING' },
      days: { type: 'INTEGER' }, base: { type: 'STRING' }, country: { type: 'STRING' }, emoji: { type: 'STRING' }, note: { type: 'STRING' },
      currency: { type: 'OBJECT', properties: { symbol: { type: 'STRING' }, rate: { type: 'NUMBER' }, note: { type: 'STRING' } } },
    } },
    cities: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      key: { type: 'STRING' }, name: { type: 'STRING' }, en: { type: 'STRING' }, lat: { type: 'NUMBER' }, lng: { type: 'NUMBER' },
      emoji: { type: 'STRING' }, color: { type: 'STRING' }, station: { type: 'STRING' }, blurb: { type: 'STRING' },
      pois: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
        name: { type: 'STRING' }, en: { type: 'STRING' }, lat: { type: 'NUMBER' }, lng: { type: 'NUMBER' },
        emoji: { type: 'STRING' }, tag: { type: 'STRING' }, desc: { type: 'STRING' }, hours: { type: 'STRING' }, fee: { type: 'STRING' },
      }, required: ['name', 'lat', 'lng'] } },
    }, required: ['key', 'name', 'lat', 'lng'] } },
    routes: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      from: { type: 'STRING' }, to: { type: 'STRING' }, fromStn: { type: 'STRING' }, toStn: { type: 'STRING' },
      line: { type: 'STRING' }, summary: { type: 'STRING' }, fare: { type: 'STRING' }, pass: { type: 'STRING' }, tip: { type: 'STRING' },
      legs: { type: 'ARRAY', items: _leg },
    }, required: ['from', 'to'] } },
    days: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      date: { type: 'STRING' }, cityKey: { type: 'STRING' }, weatherKey: { type: 'STRING' }, title: { type: 'STRING' }, summary: { type: 'STRING' },
      items: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
        time: { type: 'STRING' }, type: { type: 'STRING' }, title: { type: 'STRING' }, jp: { type: 'STRING' },
        desc: { type: 'STRING' }, cost: { type: 'STRING' }, dur: { type: 'STRING' }, lat: { type: 'NUMBER' }, lng: { type: 'NUMBER' },
        route: { type: 'OBJECT', properties: { fromStn: { type: 'STRING' }, toStn: { type: 'STRING' }, fare: { type: 'STRING' }, pass: { type: 'STRING' }, legs: { type: 'ARRAY', items: _leg } } },
      }, required: ['time', 'type', 'title'] } },
    }, required: ['date', 'cityKey', 'title', 'items'] } },
    pass: { type: 'OBJECT', properties: {
      best: { type: 'STRING' }, price: { type: 'STRING' }, days: { type: 'STRING' }, why: { type: 'STRING' }, buy: { type: 'STRING' }, highlights: { type: 'ARRAY', items: { type: 'STRING' } },
    } },
    souvenirs: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
      cityKey: { type: 'STRING' },
      items: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, emoji: { type: 'STRING' }, desc: { type: 'STRING' }, where: { type: 'STRING' }, price: { type: 'STRING' } }, required: ['name'] } },
    }, required: ['cityKey', 'items'] } },
    budget: { type: 'OBJECT', properties: {
      fixed: { type: 'ARRAY', items: { type: 'OBJECT', properties: { label: { type: 'STRING' }, amount: { type: 'NUMBER' } }, required: ['label', 'amount'] } },
      mealsPerDay: { type: 'NUMBER' }, hotelPerNight: { type: 'NUMBER' }, nights: { type: 'INTEGER' },
    } },
    packing: { type: 'ARRAY', items: { type: 'STRING' } },
    emergency: { type: 'OBJECT', properties: {
      numbers: { type: 'ARRAY', items: { type: 'OBJECT', properties: { label: { type: 'STRING' }, num: { type: 'STRING' }, emoji: { type: 'STRING' } }, required: ['num'] } },
      steps: { type: 'ARRAY', items: { type: 'STRING' } },
      offices: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, area: { type: 'STRING' }, tel: { type: 'STRING' }, addr: { type: 'STRING' } } } },
    } },
    needInfo: { type: 'ARRAY', items: { type: 'OBJECT', properties: { key: { type: 'STRING' }, question: { type: 'STRING' }, hint: { type: 'STRING' } }, required: ['key', 'question'] } },
  },
};
// Parse a day count out of free text / answers ("7 天", "天數：10", "7/1-7/5").
function parseDays(s) { 
  const str = String(s || '');
  const m = str.match(/(?:天數|共|玩)[：:\s]*(\d{1,4})/) || str.match(/(\d{1,4})\s*[天日]/); 
  if (m) return Math.min(366, parseInt(m[1], 10));
  const zh = str.match(/(一|二|兩|三|四|五|六|七|八|九|十|十一|十二|十三|十四|十五)\s*[天日]/);
  if (zh) {
    const map = {'一':1,'二':2,'兩':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'十二':12,'十三':13,'十四':14,'十五':15};
    return map[zh[1]];
  }
  const mo = str.match(/(一|半)[個]?(月)/);
  if (mo) return mo[1] === '半' ? 15 : 30;
  const dates = [];
  const re = /(?:20\d\d[-/])?(\d{1,2})[-/](\d{1,2})/g;
  let match;
  while ((match = re.exec(str)) !== null) dates.push({ m: parseInt(match[1], 10), d: parseInt(match[2], 10) });
  if (dates.length >= 2) {
    const d1 = new Date(2024, dates[0].m - 1, dates[0].d);
    let d2 = new Date(2024, dates[dates.length-1].m - 1, dates[dates.length-1].d);
    if (d2 < d1) d2.setFullYear(2025);
    const diff = Math.round((d2 - d1) / 86400000) + 1;
    if (diff > 0 && diff <= 30) return diff;
  }
  return 0; 
}
const CHUNK_DAYS = 4;    // days produced per Gemini call — reduced to 4 to avoid free API quota timeouts/truncation.
                         // never truncates (so the heavy generate can't blow Cloudflare's ~100s 524).

// One Gemini call. With `known` set it produces ONLY the next day-range (continuation);
// otherwise it produces the full framework + the first day-range.
async function genTripCall({ prompt, answers, total, dayFrom, dayTo, known, force } = {}) {
  const sys = `你是 Plan AI，一位世界級旅遊規劃師。根據使用者需求，為「任何國家」產生一份**像專業旅遊書一樣完整、準確、可直接出發使用**的逐日行程，並只輸出「嚴格 JSON」（不要 markdown、不要任何說明文字）。

先判斷必要資訊是否足夠。必要 = 目的地、以及（天數 或 起訖日期）。次要（可合理假設）= 出發地/機場、班機時間、旅遊節奏、偏好。
若有「真正必要」且無法合理假設的資訊缺漏，只回傳：
{"needInfo":[{"key":"dates","question":"請問你的旅遊日期或天數？","hint":"例如 7/10–7/15 或 5 天"}]}（最多 4 題，先問最關鍵的，問題一律使用${getLang() === 'en' ? '英文 English' : '繁體中文'}）。

否則回傳「完整」行程 JSON（所有人類可讀文字一律使用${getLang() === 'en' ? '英文 English' : '繁體中文'}）：
{
 "trip":{"title":"短標題","subtitle":"一句副標","start":"YYYY-MM-DD","end":"YYYY-MM-DD","days":N,"base":"進出點或概述","country":"國家","emoji":"🗼","currency":{"symbol":"€","rate":34.5,"note":"1 EUR ≈ 34.5 TWD（參考）"}},
 "cities":[{"key":"英數slug","name":"中文名","en":"English","lat":48.8566,"lng":2.3522,"emoji":"🗼","blurb":"一句話特色","pois":[{"name":"中文名","en":"English","lat":48.86,"lng":2.34,"emoji":"📍","tag":"see|eat|shop","desc":"簡短說明","hours":"09:00–18:00","fee":"€20"}]}],
 "routes":[{"from":"城市A","to":"城市B","summary":"交通方式與時間","fare":"票價"}],
 "days":[{"date":"YYYY-MM-DD","cityKey":"對應的城市key","weatherKey":"顯示哪一城天氣(通常=cityKey)","title":"當日主題","summary":"一句話","items":[{"time":"HH:MM","type":"arrive|see|eat|shop|move|stay|depart","title":"活動","desc":"簡短","cost":"€20","dur":"90 分","lat":48.86,"lng":2.34,"route":{"fromStn":"A站","toStn":"B站","fare":"€5","legs":[{"dep":"09:00","arr":"09:40","line":"地鐵1號線","type":"local","dur":"40 分"}]}}]}],
 "pass":{"best":"交通票名稱或留空","price":"","days":"","why":"","highlights":[]},
 "budget":{"fixed":[{"label":"機票/長途交通","amount":15000}],"mealsPerDay":1500,"hotelPerNight":4000,"nights":N-1},
 "packing":["護照","..."],
 "souvenirs":[{"cityKey":"對應城市key","items":[{"name":"伴手禮名","emoji":"🍫","desc":"特色說明","where":"哪裡買","price":"約 €10"}]}],
 "emergency":{"numbers":[{"label":"報警","num":"112","emoji":"🚓"},{"label":"救護/消防","num":"112","emoji":"🚑"}],"offices":[]}
}

完整度要求（務必全部填寫，不可省略任何區塊）：
- cities：每個城市至少 4 個 pois（著名景點／餐廳／購物），每個 poi 要有真實 lat/lng、desc、hours、fee。
- days：每天 5–8 個 items 並「依時間排序」；包含 see/eat，必要時加 move（城市間或長距離移動），首日含 arrive、末日含 depart、每天最後通常是 stay（住宿）。每個 see/eat 要同時有 desc、dur（停留時間）與 cost；type=move 的 item 請填 route{fromStn,toStn,fare,legs[]}（每段 dep/arr/line/type/dur）。
- routes：列出所有城市之間的移動，每段含 from/to 與 fare，並盡量附 legs[]（dep/arr/line/type/dur）。
- pass：當地若有適合的交通票券就建議，否則 best 留空。
- budget：fixed（機票／長途交通等）、mealsPerDay、hotelPerNight、nights 全部填數字。
- packing：依目的地與季節給 8–14 項（依該國客製，勿照抄）。
- souvenirs：陣列，每元素 {cityKey, items[]}，為「每個主要城市」各給 3–5 樣當地特產（含 where 與 price）；cityKey 必須對應 cities 的 key。
- emergency：填「該目的地國家」正確的緊急電話（至少報警與救護/消防，勿用預設 110/119）。

規則：
- lat/lng 必須是真實且正確的座標（著名地點用其實際經緯度）。
- 每個 day 的 cityKey 必須對應 cities 之一的 key。
- 有日期就用使用者的日期；只有天數就從最近的合理日期起算；days 與 start/end 要一致。
- 時間與當地交通要真實合理；desc 精簡（≤22 字）。
- 金額用「當地貨幣」並含其符號；currency.symbol 用該國符號。
- 只輸出 JSON 物件本身（一個完整且合法的 JSON）。`;
  // Long-trip chunking: instruct which day-range to produce this call.
  let chunkNote = '';
  if (known) {
    const cityList = (known.cities || []).map(c => `${c.key}=${c.name}`).join('、');
    const lastDate = (known.days && known.days.length) ? known.days[known.days.length - 1].date : (known.trip && known.trip.start) || '';
    chunkNote = `\n\n【延續產生】整趟共 ${total} 天，前面天數已排好。本次只產生「第 ${dayFrom}–${dayTo} 天」的 days，延續前面的城市、路線與節奏。可沿用既有城市 key：${cityList || '（無）'}。若這幾天去到新城市，請在 cities 補上新城市（key 不可與既有重複）並在 routes 補上往返路段、在 souvenirs 補上特產。days 第一天日期請接在「${lastDate}」之後，逐日遞增。trip/pass/budget/packing/emergency 可省略；本次重點是 days（與必要的新 cities/routes/souvenirs）。本次禁止回傳 needInfo，請直接以合理假設完成這幾天。`;
  } else if (total > CHUNK_DAYS) {
    chunkNote = `\n\n【長行程・分批產生】本趟共 ${total} 天。cities/routes/pass/budget/packing/souvenirs/emergency 等「框架」請針對整趟 ${total} 天完整規劃；但 days 本次只先產生「第 ${dayFrom}–${dayTo} 天」（其餘天稍後分批補上）。`;
  }
  const hasAnswers = answers && Object.keys(answers).length > 0;
  const userMsg = `使用者需求：「${(prompt || '').trim() || '(未提供文字，請依常見熱門選擇合理規劃並在 needInfo 詢問關鍵資訊)'}」`
    + (total ? `\n總天數：${total} 天。` : '')
    + (hasAnswers ? `\n使用者補充資訊：\n${Object.entries(answers).filter(([k]) => k !== '_skip').map(([k, v]) => `- ${k}：${v}`).join('\n')}${answers._skip ? '\n（使用者選擇略過提問）' : ''}\n\n【重要指令】使用者已回覆部分問題，請「直接利用現有資訊排定行程」，大膽假設任何其餘缺漏的細節（若天數未明則預設為 5 天）。【絕對禁止】再次回傳 needInfo 進入迴圈，請務必直接產出完整行程 JSON！` : '')
    + (force ? `\n\n【再次嘗試】上一次沒有產生 days。這次務必直接以合理假設完成，回傳「至少 ${dayTo || total || 5} 天」的完整 days 陣列；絕對禁止空的 days，也禁止 needInfo。` : '');
  const data = await callGemini({
    system_instruction: { parts: [{ text: sys + chunkNote }] },
    contents: [{ role: 'user', parts: [{ text: userMsg }] }],
    // 16384 = room for the whole framework + a 6-day chunk (8192 truncated rich trips → MAX_TOKENS).
    // thinkingBudget:0 stops 2.5/3 "thinking" tokens from eating the budget (ignored by older models).
    generationConfig: { temperature: 0.7, maxOutputTokens: 16384, responseMimeType: 'application/json', responseSchema: TRIP_SCHEMA, thinkingConfig: { thinkingBudget: 0 } },
  });
  // Distinguish the real failure mode so the user gets an actionable message (not a generic parse error).
  if (!data.candidates || !data.candidates.length) { throw new Error(data.promptFeedback && data.promptFeedback.blockReason ? 'BLOCKED' : 'BUSY'); }
  const cand = data.candidates[0];
  const fr = cand && cand.finishReason;
  if (fr === 'SAFETY' || fr === 'RECITATION') throw new Error('BLOCKED');
  const text = ((cand && cand.content && cand.content.parts) || []).filter(p => p.text).map(p => p.text).join('').trim();
  let obj = null;
  try { obj = JSON.parse(text); }
  catch { const m = text.match(/\{[\s\S]*\}/); if (m) { try { obj = JSON.parse(m[0]); } catch {} } }
  if (!obj) throw new Error(fr === 'MAX_TOKENS' ? 'TRUNCATED' : t('ai.gen.err.parse'));
  return obj;
}

// Full-trip generation. Short trips = 1 call; long trips are built in day-chunks so
// the content stays COMPLETE even for very long itineraries (up to a year), each call
// within the model's token budget. Returns { needInfo } or a full trip model. A chunk
// failing mid-way (e.g. quota) keeps everything built so far — a usable, complete plan.
export async function generateTripPlan({ prompt, answers, days, onProgress, noAsk } = {}) {
  const parsedTotal = Math.max(0, days || parseDays(prompt) || (answers ? parseDays(Object.values(answers).join(' ')) : 0) || 0);
  const total = (!parsedTotal && answers && Object.keys(answers).length > 0) ? 5 : parsedTotal;
  const day1to = total ? Math.min(total, CHUNK_DAYS) : 0;
  let first = await genTripCall({ prompt, answers, total, dayFrom: 1, dayTo: day1to });
  if (first && first.needInfo && first.needInfo.length) {
    if (!noAsk) return first;            // first round → let the caller ask the questions (one batch)
    // noAsk = the user already answered: NEVER ask again. Force a real plan instead of looping.
    first = await genTripCall({ prompt, answers, total, dayFrom: 1, dayTo: day1to, force: true });
  }
  // Weak models (esp. the flash-lite default) sometimes return valid JSON with an
  // empty/missing days array. Retry once, forcefully, before giving up — far better
  // than dead-ending the user with "行程內容不足".
  if (!first || !Array.isArray(first.days) || !first.days.length) {
    const retry = await genTripCall({ prompt, answers, total, dayFrom: 1, dayTo: day1to, force: true });
    if (retry && retry.needInfo && retry.needInfo.length && !noAsk) return retry;
    if (retry && Array.isArray(retry.days)) first = retry;
  }
  if (!first || !Array.isArray(first.days)) return first;
  const model = first;
  onProgress && onProgress(model.days.length, total || model.days.length);
  if (total > CHUNK_DAYS) {
    const haveD = new Set((model.days || []).map(d => d.date));
    for (let guard = 0; model.days.length < total && guard < 40; guard++) {
      const from = model.days.length + 1, to = Math.min(total, from + CHUNK_DAYS - 1);
      let chunk;
      try { chunk = await genTripCall({ prompt, answers, total, dayFrom: from, dayTo: to, known: model }); }
      catch { break; }   // quota/error → stop with a complete partial plan
      if (!chunk || !Array.isArray(chunk.days) || !chunk.days.length) break;
      // Only append days that ADVANCE past what we have (and aren't duplicates) — a
      // stateless continuation can re-emit the boundary date; duplicates would corrupt
      // dayByDate / day numbering downstream.
      const lastDate = model.days.length ? model.days[model.days.length - 1].date : '';
      let added = 0;
      chunk.days.forEach(d => { if (d && d.date && !haveD.has(d.date) && (!lastDate || d.date > lastDate)) { model.days.push(d); haveD.add(d.date); added++; } });
      if (!added) break;   // chunk didn't advance → stop with a clean partial plan
      if (!Array.isArray(model.cities)) model.cities = [];
      const ck = new Set(model.cities.map(c => c.key));
      (chunk.cities || []).forEach(c => { if (c && c.key && !ck.has(c.key)) { model.cities.push(c); ck.add(c.key); } });
      if (Array.isArray(chunk.routes) && chunk.routes.length) model.routes = (model.routes || []).concat(chunk.routes);
      if (Array.isArray(chunk.souvenirs) && chunk.souvenirs.length) model.souvenirs = (model.souvenirs || []).concat(chunk.souvenirs);
      onProgress && onProgress(model.days.length, total);
    }
    if (model.trip) {
      model.trip.days = model.days.length;   // reflect what was actually built
      if (model.days.length && model.days.length < total) model.trip.end = model.days[model.days.length - 1].date;   // partial: end at last built day
    }
  }
  return model;
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
      const msg = e.message === 'NO_KEY' ? t('ai.err.noKey')
        : e.message === 'RATE_LIMIT' ? '⚠️ AI 用量已達上限（配額／速率限制）。請稍等一兩分鐘再試；若經常發生，可到 Google AI Studio 確認方案與配額，或在「設定」改用自己的 API 金鑰。'
        : e.message === 'BUSY' ? '⚠️ AI 模型暫時忙線／過載（與金鑰無關），請稍等幾秒再送一次即可。'
        : e.message === 'OFFLINE' ? '⚠️ 目前似乎沒有網路連線，請連上網路後再試。'
        : t('ai.err.connect') + e.message;
      addAI(scroll, msg);
      return false;   // signal failure so send() can roll back the dangling turn (avoid wedging the chat)
    }
    // Prompt-level block returns NO candidates (only promptFeedback) — handle before deref.
    if (!data.candidates || !data.candidates.length) {
      typing.remove();
      addAI(scroll, (data.promptFeedback && data.promptFeedback.blockReason) ? t('ai.err.safety') : t('ai.err.noReply'));
      return false;
    }
    const cand = data.candidates[0];
    const parts = (cand && cand.content && cand.content.parts) || [];
    const calls = parts.filter(p => p.functionCall).map(p => p.functionCall);

    if (calls.length) {
      // record the model turn EXACTLY as returned — preserves `thoughtSignature` on
      // functionCall parts, which Gemini 3 requires to be echoed back (else 400).
      history.push({ role: 'model', parts: cand.content.parts });
      // Show any lead-in sentence the model returned alongside the tool call (else it feels terse).
      const lead = parts.filter(p => p.text).map(p => p.text).join('').trim();
      if (lead) { typing.before(el('.msg.msg--ai', { html: mdLite(lead) })); scroll.scrollTop = scroll.scrollHeight; }
      const responses = [];
      for (const c of calls) {
        const { label, result } = await execTool(c);
        if (/^(add|remove|update|move)_activity$|^(add|remove)_day$|^new_plan$|^reset_plan$|^plan_trip$/.test(c.name)) planChanged = true;
        typing.before(el('.msg-action', {}, [icon('i-ai'), label]));
        scroll.scrollTop = scroll.scrollHeight;
        responses.push({ functionResponse: { name: c.name, id: c.id, response: typeof result === 'object' ? result : { result } } });
      }
      history.push({ role: 'user', parts: responses });
      continue; // loop again for the model's natural-language reply
    }

    // text reply
    typing.remove();
    const fr = cand && cand.finishReason;
    const text = parts.filter(p => p.text).map(p => p.text).join('').trim()
      || (fr === 'SAFETY' ? t('ai.err.safety')
        : fr === 'MAX_TOKENS' ? '回覆過長被截斷，請換個說法或縮小範圍再試一次。'
        : t('ai.err.noReply'));
    history.push({ role: 'model', parts: (cand && cand.content && cand.content.parts) || [{ text }] });
    addAI(scroll, text);
    if (planChanged && API && API.notifyAI) API.notifyAI(t('ai.msg.notifyTitle'), text.replace(/\s+/g, ' ').slice(0, 60));
    return true;
  }
  typing.remove();
  addAI(scroll, t('ai.msg.done'));
  return false;   // tool loop exhausted with no final reply → drop the exchange so the chat doesn't wedge
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
  const base = history.length;                 // snapshot BEFORE this exchange
  history.push({ role: 'user', parts: [{ text }] });
  try {
    const ok = await turn(scroll);
    // A failed/incomplete turn must NOT leave a dangling user/functionResponse turn in history,
    // or the NEXT message hits Gemini's "two consecutive user turns" 400 and the chat wedges.
    if (!ok) history.length = base;
    else if (history.length > 40) history = history.slice(-40);
  } finally { busy = false; }
}

const SUGGESTIONS = [
  '幫我規劃 5 天的東京自由行',
  '規劃一趟 6 天巴黎，7/10 出發',
  '我現在該做什麼？',
  '這幾天要去的景點現在有沒有災害或關閉？',
  '幫我多加一天，去近郊走走',
  '幫我把今天排得輕鬆一點',
  '今天要帶傘嗎？',
  '幫我找今晚住宿',
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
  if (modelLabel) modelLabel.textContent = t('ai.label');

  // greeting
  addAI(scroll, t('ai.greeting'));

  // suggestions
  [1, 2, 3, 4, 5, 6, 7, 8].map(i => t('ai.suggest.' + i)).forEach(s => sug.appendChild(el('button', { onclick: () => { input.value = s; send(scroll, input); } }, s)));

  sendBtn.addEventListener('click', () => send(scroll, input));
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(scroll, input); } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; });

  // agent toggle
  const setAgent = on => { agentOn = on; sw.classList.toggle('is-on', on); sw.setAttribute('aria-checked', on); };
  sw.addEventListener('click', () => { setAgent(!agentOn); toast(agentOn ? '代理模式已開啟，我可以操控頁面了' : '代理模式已關閉'); });

  // mic (Web Speech API, optional)
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    const rec = new SR(); rec.lang = getLang() === 'en' ? 'en-US' : 'zh-TW'; rec.interimResults = false;
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
    setModelLabel: () => { if (modelLabel) modelLabel.textContent = t('ai.label'); },
    setAgent,
    ask: (text, opts = {}) => { if (opts.agent) setAgent(true); input.value = text; input.dispatchEvent(new Event('input')); send(scroll, input); },
  };
}
