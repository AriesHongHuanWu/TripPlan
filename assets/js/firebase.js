// ============================================================================
// firebase.js — guarded Firebase (Auth: Google sign-in + Firestore mirror/share)
// Loads the modular SDK from the gstatic CDN (no build step). Completely inert
// until FIREBASE_CONFIG is provided — the app then stays in local/guest mode.
// ============================================================================
import { FIREBASE_CONFIG } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/11.0.0';   // adjust version if needed
let auth, db, A, F, _user = null, _ready = false;
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
    const app = appMod.initializeApp(FIREBASE_CONFIG);
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
  await F.setDoc(F.doc(db, 'users', _user.uid), { ...data, updatedAt: Date.now() });
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
