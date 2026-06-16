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
    // Complete any pending redirect sign-in (mobile / popup-blocked path). Non-fatal.
    A.getRedirectResult(auth).catch(e => console.warn('redirect sign-in', e));
    return true;
  } catch (e) { console.warn('Firebase init failed', e); _ready = true; cbs.forEach(cb => cb(null)); return false; }
}

// In-app webviews (LINE/IG/FB) and many mobile browsers block or lose popups —
// redirect is far more reliable there.
const preferRedirect = () => /Android|iPhone|iPad|iPod|FBAN|FBAV|Instagram|Line\//i.test(navigator.userAgent || '');

// Returns the credential on success, or null when the user simply backed out
// (so callers can treat null as "no-op", not an error). Throws only on real errors.
export async function signInGoogle() {
  if (!auth) throw new Error('Firebase 尚未設定');
  const provider = new A.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  if (preferRedirect()) { await A.signInWithRedirect(auth, provider); return null; }
  try {
    return await A.signInWithPopup(auth, provider);
  } catch (e) {
    const code = (e && e.code) || '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;  // user dismissed
    if (code === 'auth/popup-blocked') { await A.signInWithRedirect(auth, provider); return null; }     // fall back to redirect
    throw e;
  }
}
export async function signOutUser() { if (auth) await A.signOut(auth); }

// Turn a Firebase auth error into a friendly, actionable Chinese message.
export function authErrorMessage(e) {
  const code = (e && e.code) || '';
  const map = {
    'auth/network-request-failed': '網路不穩，請檢查連線後再試一次。',
    'auth/unauthorized-domain': '這個網域尚未被授權登入。請到 Firebase 主控台 → Authentication → Settings → Authorized domains 加入目前網址。',
    'auth/operation-not-allowed': 'Google 登入尚未啟用，請到 Firebase 主控台 → Authentication → Sign-in method 開啟 Google。',
    'auth/account-exists-with-different-credential': '這個 email 已用其他方式登入過，請改用原本的登入方式。',
    'auth/too-many-requests': '嘗試次數過多，請稍後再試。',
    'auth/internal-error': '登入服務暫時有問題，請稍後再試。',
  };
  return map[code] || (e && e.message) || '登入失敗，請再試一次。';
}

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

// ---- Access control (Google-Docs-style roles) ----
// access = { general:'restricted'|'viewer'|'commenter'|'editor', people:{ <emailKey>:{role,name,ts} } }
// general holds the role granted to anyone with the link ('restricted' = only listed people).
export async function collabSetGeneral(code, general) {
  if (!db) throw new Error('需登入雲端才能變更權限');
  await F.setDoc(F.doc(db, 'collab', code), { access: { general } }, { merge: true });
}
// FieldPath segments keep dots in the email key from being parsed as a nested path.
export async function collabSetPersonRole(code, emailKey, entry) {
  if (!db) throw new Error('需登入雲端才能變更權限');
  await F.updateDoc(F.doc(db, 'collab', code), new F.FieldPath('access', 'people', emailKey), entry);
}
export async function collabRemovePerson(code, emailKey) {
  if (!db) throw new Error('需登入雲端才能變更權限');
  await F.updateDoc(F.doc(db, 'collab', code), new F.FieldPath('access', 'people', emailKey), F.deleteField());
}
export async function collabDelete(code) {
  if (!db) throw new Error('需登入雲端');
  await F.deleteDoc(F.doc(db, 'collab', code));
}
// Read just the itinerary model of a (public) collab doc — used to fork a community plan.
export async function collabModelGet(code) {
  if (!db) return null;
  try { const s = await F.getDoc(F.doc(db, 'collab', code)); return s.exists() ? (s.data().model || null) : null; }
  catch (e) { console.warn('collabModelGet', e); return null; }
}

// ---- Community feed (public mirror at feed/{code}; safe metadata only, never the model) ----
// feed/{code} = { code,title,emoji,country,region,themes[],days,cityCount,summary,owner,ownerName,
//                 visibility:'public'|'community', likeCount, createdAt, updatedAt }
// Likes are one-per-user at feed/{code}/likes/{uid}; likeCount is denormalized (±1 via transaction).
export function feedReady() { return !!db; }                 // browsing is public — needs db, not a user

// Publish/refresh a plan to the community feed. `meta` is the safe metadata computed by the caller
// (which owns the country→region map); ownership is also enforced server-side by the rules.
export async function feedPublish(code, meta) {
  if (!db) throw new Error('需登入雲端才能發佈');
  if (!_user) throw new Error('請先登入');
  let existing = null; try { existing = await feedGet(code); } catch {}
  const payload = { ...meta, code, owner: _user.uid, updatedAt: Date.now() };
  // Seed counters ONLY on first publish; on re-publish (merge) the server values are left untouched,
  // so a metadata/tag edit can never clobber a concurrent like (F.increment) — no lost update.
  if (!existing) { payload.likeCount = 0; payload.createdAt = Date.now(); }
  await F.setDoc(F.doc(db, 'feed', code), payload, { merge: true });
}
export async function feedUnpublish(code) {
  if (!db) throw new Error('需登入雲端');
  try { await F.deleteDoc(F.doc(db, 'feed', code)); } catch (e) { console.warn('feedUnpublish', e); }
}
export async function feedGet(code) {
  if (!db) return null;
  try { const s = await F.getDoc(F.doc(db, 'feed', code)); return s.exists() ? s.data() : null; }
  catch { return null; }
}
// One read of ≤max feed docs. Every doc in feed/ is already public/community (private/link are
// never mirrored), so we order by createdAt only — no composite index needed. Sorting/filtering
// is done client-side so toggling is instant and free.
export async function feedList(max = 60) {
  if (!db) return [];
  try {
    const q = F.query(F.collection(db, 'feed'), F.orderBy('createdAt', 'desc'), F.limit(max));
    const snap = await F.getDocs(q);
    return snap.docs.map(d => d.data());
  } catch (e) { console.warn('feedList', e); return []; }
}
// Atomic, idempotent like toggle: writes the per-user like doc AND the ±1 counter in one transaction.
export async function feedLikeToggle(code, like) {
  if (!db || !_user) throw new Error('請先登入再按讚');
  const likeRef = F.doc(db, 'feed', code, 'likes', _user.uid);
  const feedRef = F.doc(db, 'feed', code);
  return await F.runTransaction(db, async tx => {
    const has = (await tx.get(likeRef)).exists();
    if (like && !has) { tx.set(likeRef, { uid: _user.uid, ts: Date.now() }); tx.update(feedRef, { likeCount: F.increment(1) }); return true; }
    if (!like && has) { tx.delete(likeRef); tx.update(feedRef, { likeCount: F.increment(-1) }); return false; }
    return has;   // already in desired state — no write
  });
}
// Which of these codes the signed-in user has liked (one parallel point-read per visible code;
// N reads, acceptable at the current ≤60-card scale — denormalize later if the feed grows large).
export async function feedLikedSet(codes) {
  const out = new Set();
  if (!db || !_user || !codes || !codes.length) return out;
  await Promise.all(codes.map(async code => {
    try { if ((await F.getDoc(F.doc(db, 'feed', code, 'likes', _user.uid))).exists()) out.add(code); } catch {}
  }));
  return out;
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
