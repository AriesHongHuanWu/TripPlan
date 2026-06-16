// ============================================================================
// Firebase web-app config — project "planaiid" (211797227663)
// ----------------------------------------------------------------------------
// Note: a Firebase web apiKey is NOT a secret (it only identifies the project);
// data is protected by Firestore rules + Auth authorized domains. Safe to commit.
//
// Still required in the Firebase console for login to work:
//   • Authentication → Sign-in method → enable Google
//   • Firestore Database → created + secure rules published
//   • Authentication → Settings → Authorized domains → add localhost + your
//     Cloudflare Pages domain (e.g. <project>.pages.dev) once deployed
// ============================================================================

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCzS3b9OtXOABiTt-xihcKv2riKNEaZf7A",
  authDomain: "planaiid.firebaseapp.com",
  projectId: "planaiid",
  storageBucket: "planaiid.firebasestorage.app",
  messagingSenderId: "211797227663",
  appId: "1:211797227663:web:220bd756e64c3f549598fa",
  measurementId: "G-GK0NFY5BY8"
};

// Web Push (FCM) VAPID *public* key — safe to expose. From Firebase console →
// Cloud Messaging → Web Push certificates → "Key pair".
// (The matching PRIVATE key + the Admin SDK service-account JSON are SECRETS —
//  keep them server-side only, never in this repo.)
export const VAPID_KEY = "BAgLE8V4WD8Wrwmfe9HYUWfOcmMcgLKlCMD5rFm2d3KJZkrkceXJYhE4zCOgBB8Jrau1D-TpdO2UbG9n1iB7jmA";

