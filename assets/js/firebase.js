// ============================================================================
// firebase.js — guarded Firebase (Auth: Google sign-in + Firestore mirror/share)
// Loads the modular SDK from the gstatic CDN (no build step). Completely inert
// until FIREBASE_CONFIG is provided — the app then stays in local/guest mode.
// ============================================================================
import { FIREBASE_CONFIG } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/11.0.0';   // adjust version if needed
let app, auth, db, A, F, M, messaging, _user = null, _ready = false;
const cbs = [];

export const fb = {
  get configured() { return !!FIREBASE_CONFIG; },
  get user() { return _user; },
  get ready() { return _ready; },
  onAuth(cb) { cbs.push(cb); if (_ready) cb(_user); },
};

export async function initFirebase() {
  if (!FIREBASE_CONFIG) { _ready = true; cbs.forEach(cb => cb(null)); return false; }
  try {
    const appMod = await import(`${SDK}/firebase-app.js`);
    A = await import(`${SDK}/firebase-auth.js`);
    F = await import(`${SDK}/firebase-firestore.js`);
    app = appMod.initializeApp(FIREBASE_CONFIG);
    auth = A.getAuth(app); db = F.getFirestore(app);
    try { await A.setPersistence(auth, A.browserLocalPersistence); } catch {}
    A.onAuthStateChanged(auth, u => { _user = u; _ready = true; cbs.forEach(cb => cb(u)); });
    return true;
  } catch (e) { console.warn('Firebase init failed', e); _ready = true; cbs.forEach(cb => cb(null)); return false; }
}

export async function signInGoogle() {
  if (!auth) throw new Error('Firebase 尚未設定');
  const provider = new A.GoogleAuthProvider();
  try { return await A.signInWithPopup(auth, provider); }
  catch (e) { if (String(e).includes('popup')) return A.signInWithRedirect(auth, provider); throw e; }
}
export async function signOutUser() { if (auth) await A.signOut(auth); }

// ---- Firestore: per-user account mirror (single doc) ----
export async function pullUserData() {
  if (!_user) return null;
  const snap = await F.getDoc(F.doc(db, 'users', _user.uid));
  return snap.exists() ? snap.data() : null;
}
export async function pushUserData(data) {
  if (!_user) return;
  await F.setDoc(F.doc(db, 'users', _user.uid), { ...data, updatedAt: Date.now() }, { merge: true });
}

// ---- Firestore: public share by code ----
export async function shareSave(code, plan) {
  if (!db) throw new Error('Firebase 尚未設定');
  await F.setDoc(F.doc(db, 'shared', code), { plan, ts: Date.now(), by: _user ? _user.uid : null });
}
export async function shareGet(code) {
  if (!db) throw new Error('Firebase 尚未設定');
  const snap = await F.getDoc(F.doc(db, 'shared', code));
  return snap.exists() ? snap.data().plan : null;
}

// ---- Firestore: real-time COLLABORATIVE plans (collab/{code}) ----
// Doc: { model, meta, owner, members:{uid:{name,ts}}, writer, ts }; subcol messages/.
export function collabReady() { return !!(db && _user); }
export async function collabSave(code, data) {
  if (!db) throw new Error('需登入雲端才能共同編輯');
  await F.setDoc(F.doc(db, 'collab', code), { ...data, ts: Date.now() }, { merge: true });
}
export async function collabGet(code) {
  if (!db) return null;
  const snap = await F.getDoc(F.doc(db, 'collab', code));
  return snap.exists() ? snap.data() : null;
}
export async function collabJoin(code, member) {
  if (!db || !_user) return;
  await F.setDoc(F.doc(db, 'collab', code), { members: { [_user.uid]: member } }, { merge: true });
}
export async function collabSetPlan(code, model, writer) {
  if (!db) return;
  try { await F.setDoc(F.doc(db, 'collab', code), { model, writer, ts: Date.now() }, { merge: true }); } catch (e) { console.warn('collabSetPlan', e); }
}
export function collabOnDoc(code, cb) {
  if (!db) return () => {};
  try { return F.onSnapshot(F.doc(db, 'collab', code), s => { if (s.exists()) cb(s.data()); }, () => {}); } catch { return () => {}; }
}
export async function collabSendMsg(code, msg) {
  if (!db) return;
  try { await F.addDoc(F.collection(db, 'collab', code, 'messages'), { ...msg, ts: Date.now() }); } catch (e) { console.warn('collabSendMsg', e); }
}
export function collabOnMsgs(code, cb) {
  if (!db) return () => {};
  try {
    const q = F.query(F.collection(db, 'collab', code, 'messages'), F.orderBy('ts', 'asc'));
    return F.onSnapshot(q, snap => cb(snap.docs.map(d => d.data())), () => {});
  } catch { return () => {}; }
}

// ---- Cloud Messaging (web push) ----
export async function getPushToken(vapidKey) {
  if (!app) return null;
  try {
    if (!M) { M = await import(`${SDK}/firebase-messaging.js`); if (M.isSupported && !(await M.isSupported())) return null; }
    if (!messaging) messaging = M.getMessaging(app);
    const reg = await navigator.serviceWorker.register('firebase-messaging-sw.js');
    return (await M.getToken(messaging, { vapidKey, serviceWorkerRegistration: reg })) || null;
  } catch (e) {
    // Server-push token registration failed (commonly because the "Firebase Cloud
    // Messaging API" / "Firebase Installations API" aren't enabled in Google Cloud,
    // or the web API key is restricted). LOCAL itinerary reminders are unaffected.
    console.info('[Plan AI] 伺服器推播暫不可用（本地提醒仍正常）。如需 App 關閉時也收到推播，請在 Google Cloud 啟用 Firebase Cloud Messaging API 與 Firebase Installations API。');
    return null;
  }
}
export function onForegroundMessage(cb) { try { if (M && messaging) M.onMessage(messaging, cb); } catch {} }
export async function saveFcmToken(token) {
  if (!_user || !token) return;
  try { await F.setDoc(F.doc(db, 'users', _user.uid), { fcmTokens: { [token]: Date.now() } }, { merge: true }); } catch (e) { console.warn(e); }
}
