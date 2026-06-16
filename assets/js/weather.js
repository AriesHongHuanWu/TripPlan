// ============================================================================
// weather.js — Open-Meteo live forecast (no API key). Per-city, JST.
// ============================================================================
import { CITIES, cityByKey, wmo } from './data.js';
import { el, clear, icon, ymd, toast } from './util.js';

const TRIP_END = '2026-06-24';
const cache = new Map();           // key -> {data, ts}
const TTL = 15 * 60 * 1000;        // 15 min

export async function fetchWeather(city) {
  const k = city.key;
  const hit = cache.get(k);
  if (hit && Date.now() - hit.ts < TTL) return hit.data;

  const today = ymd(new Date());
  const end = today > TRIP_END ? today : TRIP_END;
  const u = new URL('https://api.open-meteo.com/v1/forecast');
  u.search = new URLSearchParams({
    latitude: city.lat, longitude: city.lng, timezone: 'Asia/Tokyo',
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,precipitation_probability,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max',
    start_date: today, end_date: end,
  }).toString();

  const res = await fetch(u);
  if (!res.ok) throw new Error('weather ' + res.status);
  const data = await res.json();
  cache.set(k, { data, ts: Date.now() });
  return data;
}

// gradient for the hero card
function wxGradient(code, isDay) {
  if (code >= 95) return 'linear-gradient(160deg,#4b5563,#1f2937)';
  if (code >= 80 || (code >= 51 && code <= 67)) return 'linear-gradient(160deg,#475569,#334155 60%,#1e293b)';
  if (code === 3 || code === 45 || code === 48) return 'linear-gradient(160deg,#64748b,#475569)';
  if (code === 1 || code === 2) return isDay ? 'linear-gradient(160deg,#3b82f6,#60a5fa 60%,#93c5fd)' : 'linear-gradient(160deg,#1e293b,#334155)';
  return isDay ? 'linear-gradient(160deg,#0ea5e9,#38bdf8 55%,#7dd3fc)' : 'linear-gradient(160deg,#0f172a,#1e3a8a)';
}

const WD = ['日', '一', '二', '三', '四', '五', '六'];

export async function renderWeatherCity(cityKey, root) {
  const city = cityByKey[cityKey] || CITIES[0];
  clear(root);
  root.appendChild(el('.skeleton', { style: { height: '180px', marginBottom: '14px' } }));
  let data;
  try { data = await fetchWeather(city); }
  catch (e) { clear(root); root.appendChild(el('.empty', {}, [el('.empty__emoji', { text: '🌧️' }), el('div', { text: '天氣載入失敗，請稍後再試。' })])); return; }
  clear(root);

  const cur = data.current, [clab, cemo] = wmo(cur.weather_code);
  const grad = wxGradient(cur.weather_code, cur.is_day);

  // Hero
  const hero = el('.wx-hero', {}, [
    el('.wx-hero__bg', { style: { background: grad } }),
    el('.wx-hero__body', {}, [
      el('.row-between', {}, [
        el('div', {}, [
          el('div', { style: { fontWeight: '700', fontSize: '15px', opacity: '.95' }, text: `${city.flag} ${city.name}` }),
          el('div', { class: 'tiny', style: { opacity: '.85' }, text: clab }),
        ]),
        el('div', { class: 'tiny', style: { opacity: '.85' }, text: '即時 · Open-Meteo' }),
      ]),
      el('.wx-now', { style: { marginTop: '8px' } }, [
        el('div', {}, [
          el('.wx-temp', { text: `${Math.round(cur.temperature_2m)}°` }),
          el('div', { class: 'tiny', style: { opacity: '.9' }, text: `體感 ${Math.round(cur.apparent_temperature)}°` }),
        ]),
        el('.wx-emoji', { text: cemo }),
      ]),
      el('.wx-meta', {}, [
        el('span', {}, [icon('i-drop'), ` 濕度 ${cur.relative_humidity_2m}%`]),
        el('span', {}, [icon('i-wind'), ` 風 ${Math.round(cur.wind_speed_10m)} km/h`]),
        el('span', {}, [icon('i-drop'), ` 降水 ${cur.precipitation} mm`]),
      ]),
    ]),
  ]);
  root.appendChild(hero);

  // Hourly (next 18h from now)
  const hrs = data.hourly, nowIso = new Date();
  const startIdx = Math.max(0, hrs.time.findIndex(t => new Date(t) >= new Date(nowIso.getTime() - 3600e3)));
  const hourCard = el('.card.card--pad', { style: { marginTop: '14px' } }, [
    el('.h-section', { text: '逐時預報' }),
    el('.wx-hours', {}, hrs.time.slice(startIdx, startIdx + 18).map((t, i) => {
      const idx = startIdx + i, d = new Date(t), [, e] = wmo(hrs.weather_code[idx]);
      const pp = hrs.precipitation_probability[idx];
      return el('.wx-hour', {}, [
        el('small', { text: i === 0 ? '現在' : `${d.getHours()}時` }),
        el('.e', { text: e }),
        el('b', { text: `${Math.round(hrs.temperature_2m[idx])}°` }),
        pp != null ? el('small', { class: 'wx-rain', text: `${pp}%` }) : null,
      ]);
    })),
  ]);
  root.appendChild(hourCard);

  // Daily for the trip
  const dl = data.daily;
  const tMax = Math.max(...dl.temperature_2m_max), tMin = Math.min(...dl.temperature_2m_min);
  const span = Math.max(1, tMax - tMin);
  const dayCard = el('.card.card--pad', { style: { marginTop: '14px' } }, [
    el('.h-section', { text: '行程期間每日預報' }),
    el('div', {}, dl.time.map((t, i) => {
      const d = new Date(t), [, e] = wmo(dl.weather_code[i]);
      const lo = dl.temperature_2m_min[i], hi = dl.temperature_2m_max[i];
      const left = ((lo - tMin) / span) * 100, w = ((hi - lo) / span) * 100;
      const isToday = ymd(d) === ymd(new Date());
      return el('.wx-day', {}, [
        el('.wx-day__name', { text: `${isToday ? '今天' : (d.getMonth() + 1) + '/' + d.getDate()} ${WD[d.getDay()]}` }),
        el('.wx-day__e', { text: e }),
        el('.wx-day__bar', {}, [el('.wx-day__fill', { style: { left: left + '%', width: Math.max(8, w) + '%' } })]),
        el('.wx-day__t', { text: `${Math.round(lo)}° / ${Math.round(hi)}°` }),
        el('div', { class: 'wx-rain', style: { width: '42px', textAlign: 'right' }, text: `${dl.precipitation_probability_max[i] ?? 0}%` }),
      ]);
    })),
    el('p', { class: 'tiny muted-3', style: { marginTop: '10px' }, text: '六月中旬為梅雨季，降水機率偏高；請隨身帶傘，並於出發前再次確認。' }),
  ]);
  root.appendChild(dayCard);
}

// Clothing / packing advice from a weather summary (rainy-season aware)
export function clothingAdvice(s) {
  if (!s) return null;
  const hi = s.hi, lo = s.lo, rain = s.rainProb ?? 0, items = [];
  let band;
  if (hi >= 31) { band = '炎熱'; items.push({ e: '👕', t: '短袖透氣衣' }, { e: '🧴', t: '防曬' }, { e: '🧢', t: '帽子/陽傘' }, { e: '💧', t: '勤補水' }); }
  else if (hi >= 27) { band = '溫暖偏熱'; items.push({ e: '👕', t: '短袖' }, { e: '🧴', t: '防曬' }, { e: '🕶️', t: '太陽眼鏡' }); }
  else if (hi >= 23) { band = '舒適'; items.push({ e: '👕', t: '短袖/薄長袖' }, { e: '🧥', t: '薄外套備用' }); }
  else if (hi >= 18) { band = '微涼'; items.push({ e: '👔', t: '長袖' }, { e: '🧥', t: '薄外套' }); }
  else { band = '偏涼'; items.push({ e: '🧥', t: '保暖外套' }, { e: '🧣', t: '可加圍巾' }); }
  if (hi - lo >= 8) items.push({ e: '🌡️', t: '早晚溫差大' });
  if (rain >= 60) items.push({ e: '☔', t: '雨傘/雨衣' }, { e: '👟', t: '防水好走鞋' });
  else { if (rain >= 25) items.push({ e: '🌂', t: '折疊傘備用' }); items.push({ e: '👟', t: '好走的鞋' }); }
  let tip = `高溫 ${hi}°、低溫 ${lo}°，降雨機率 ${rain}%。`;
  if (rain >= 50) tip += '梅雨季有雨，務必帶傘並穿防水鞋。';
  else tip += '梅雨季悶熱潮濕，建議透氣排汗衣物、隨身帶傘。';
  return { band, items, tip };
}

// Compact current weather for the Today page + Gemini tool
export async function getCurrentSummary(cityKey) {
  const city = cityByKey[cityKey] || CITIES[0];
  try {
    const data = await fetchWeather(city);
    const cur = data.current, [lab, emo] = wmo(cur.weather_code);
    const todayIdx = 0, dl = data.daily;
    return {
      city: city.name, emoji: emo, label: lab,
      temp: Math.round(cur.temperature_2m), feels: Math.round(cur.apparent_temperature),
      humidity: cur.relative_humidity_2m, wind: Math.round(cur.wind_speed_10m),
      hi: Math.round(dl.temperature_2m_max[todayIdx]), lo: Math.round(dl.temperature_2m_min[todayIdx]),
      rainProb: dl.precipitation_probability_max[todayIdx] ?? 0,
    };
  } catch { return null; }
}
