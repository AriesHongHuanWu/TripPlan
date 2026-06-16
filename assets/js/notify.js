// ============================================================================
// notify.js — notifications: permission, per-type settings, local itinerary
// reminders (no server needed), + FCM web-push token registration (for future
// server-sent push like shared-chat). All guarded; nothing fires unless the
// user has authorized and enabled the relevant type.
// ============================================================================
import { store, toast, parseHM, nowMinutes, ymd } from './util.js';
import { DAYS, dayByDate } from './data.js';
import { VAPID_KEY } from './firebase-config.js';
import { fb, getPushToken, onForegroundMessage, saveFcmToken } from './firebase.js';

const KEY = 'kp_notify';
const DEFAULT = { enabled: false, types: { reminder: true, next: true, train: true, chat: true, ai: true } };
export const TYPES = [
  ['reminder', '⏰', '行程提醒', '到下一站前提醒你準備出發'],
  ['next', '➡️', '下一個行程', '切換到下一個活動時通知'],
  ['train', '🚆', '車次提醒', '搭車前的時間提醒'],
  ['chat', '💬', '共享聊天', '共享行程有新訊息（需登入）'],
  ['ai', '🤖', 'AI 完成通知', 'AI 幫你排好/調整行程時通知'],
];

export function cfg() { const c = store.get(KEY, null); return c && c.types ? c : JSON.parse(JSON.stringify(DEFAULT)); }
function setCfg(c) { store.set(KEY, c); }
export function supported() { return 'Notification' in window; }
export function permission() { return supported() ? Notification.permission : 'unsupported'; }
export function asked() { return store.get('kp_notify_asked', false); }
export function markAsked() { store.set('kp_notify_asked', true); }

let timers = [];
function clearTimers() { timers.forEach(t => clearTimeout(t)); timers = []; }

export async function requestEnable() {
  if (!supported()) { toast('此裝置/瀏覽器不支援通知'); return false; }
  markAsked();
  let p = Notification.permission;
  if (p === 'default') { try { p = await Notification.requestPermission(); } catch { p = Notification.permission; } }
  if (p !== 'granted') { toast('通知未授權（可在瀏覽器設定開啟）'); const c = cfg(); c.enabled = false; setCfg(c); return false; }
  const c = cfg(); c.enabled = true; setCfg(c);
  scheduleReminders(); registerPush();
  toast('通知已開啟 🔔');
  return true;
}
export function disable() { const c = cfg(); c.enabled = false; setCfg(c); clearTimers(); }
export function setType(k, v) { const c = cfg(); c.types[k] = v; setCfg(c); scheduleReminders(); }

// Actually display a notification. Uses an ACTIVE service worker if one exists
// (getRegistration resolves immediately, unlike `.ready` which can hang forever
// when no SW is active), else falls back to a page Notification (fine on desktop).
async function fire(title, body, tag, data) {
  const opts = { body: body || '', icon: 'assets/icons/icon-192.png', badge: 'assets/icons/icon-192.png', tag: tag || 'kp', data: data || {} };
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.active) { await reg.showNotification(title, opts); return true; }
    }
  } catch {}
  try { new Notification(title, { body: opts.body, icon: opts.icon, tag: opts.tag }); return true; }
  catch (e) { return false; }
}
export function notify(type, title, body, data) {
  const c = cfg();
  if (!c.enabled || !c.types[type] || permission() !== 'granted') return;
  fire(title, body, type, data);
}
export function notifyAI(title, body) { notify('ai', title || 'AI 已完成', body || ''); }

// Robust, self-diagnosing TEST notification (for the Settings button). Requests
// permission if needed and gives clear feedback instead of failing silently.
export async function testNotify() {
  if (!supported()) { toast('此瀏覽器不支援通知'); return; }
  let p = permission();
  if (p === 'default') { try { p = await Notification.requestPermission(); } catch {} }
  if (p === 'denied') { toast('通知被瀏覽器封鎖：點網址列左側鎖頭 → 通知 → 允許'); return; }
  if (p !== 'granted') { toast('尚未允許通知'); return; }
  const ok = await fire('🔔 測試通知', '通知運作正常！若沒看到，請檢查系統（Windows/macOS）的通知設定與勿擾模式。', 'test');
  toast(ok ? '已送出測試通知（沒看到請查系統通知設定）' : '無法顯示通知，請查瀏覽器/系統通知設定');
}

// Schedule today's itinerary reminders (fires while the app/PWA is open).
export function scheduleReminders() {
  clearTimers();
  const c = cfg(); if (!c.enabled || permission() !== 'granted') return;
  const entry = dayByDate[ymd(new Date())]; if (!entry) return;
  const day = DAYS[entry.index], nm = nowMinutes();
  day.items.filter(it => it.type !== 'stay').forEach(it => {
    const t = parseHM(it.time);
    if (c.types.reminder) {
      const lead = it.type === 'move' ? 20 : 15;
      const at = (t - lead - nm) * 60000;
      if (at > 0 && at < 12 * 3600000) timers.push(setTimeout(() => notify('reminder', `⏰ 約 ${lead} 分鐘後：${it.title}`, `${it.time}${it.desc ? ' · ' + it.desc : ''}`), at));
      if (it.type === 'move' && c.types.train) {
        const at2 = (t - 10 - nm) * 60000;
        if (at2 > 0 && at2 < 12 * 3600000) timers.push(setTimeout(() => notify('train', `🚆 準備搭車：${it.title}`, `${it.time} 出發`), at2));
      }
    }
    if (c.types.next) {
      const at = (t - nm) * 60000;
      if (at > 0 && at < 12 * 3600000) timers.push(setTimeout(() => notify('next', `➡️ 現在：${it.title}`, `${it.time}`), at));
    }
  });
}

// Server-push status: 'off' (not attempted) | 'pending' | 'ok' | 'unavailable'
export function pushStatus() { return store.get('kp_push', 'off'); }
let pushTried = false;
export async function registerPush() {
  if (pushTried || !cfg().enabled) return;
  if (!fb.configured || !fb.user) { store.set('kp_push', 'off'); return; }   // server push needs login; local reminders work regardless
  pushTried = true;
  store.set('kp_push', 'pending');
  try {
    const token = await getPushToken(VAPID_KEY);
    if (token) {
      await saveFcmToken(token);
      onForegroundMessage(p => { const n = p.notification || {}; notify('chat', n.title || '新通知', n.body || ''); });
      store.set('kp_push', 'ok');
    } else { store.set('kp_push', 'unavailable'); }
  } catch { store.set('kp_push', 'unavailable'); }
}
