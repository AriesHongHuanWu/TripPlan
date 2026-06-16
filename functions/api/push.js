// ============================================================================
// Cloudflare Pages Function — send FCM web push (HTTP v1)  →  POST /api/push
// Lets a server/cron deliver notifications even when the app is CLOSED.
//
// Setup (do NOT commit secrets):
//   1. In Firebase: generate a NEW service-account key (Project settings →
//      Service accounts → Generate new private key). Revoke the old/leaked one.
//   2. In Cloudflare Pages → Settings → Variables and Secrets, add SECRET:
//        FIREBASE_SERVICE_ACCOUNT = <the whole service-account JSON, one line>
//      and (recommended) PUSH_KEY = <a long random string> to protect this endpoint.
//
// Body: { tokens:[...], title, body, data?, link?, appKey? }
//   tokens = FCM web tokens (stored per user at users/{uid}.fcmTokens).
// ============================================================================

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });

function b64url(buf) {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let s = ''; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const enc = s => new TextEncoder().encode(s);
function pemToPkcs8(pem) {
  const b = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b), buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}
async function accessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(enc(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64url(enc(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })));
  const key = await crypto.subtle.importKey('pkcs8', pemToPkcs8(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc(`${head}.${claim}`));
  const jwt = `${head}.${claim}.${b64url(sig)}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const j = await res.json();
  if (!res.ok) throw new Error('oauth: ' + JSON.stringify(j));
  return j.access_token;
}

export async function onRequestPost({ request, env }) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) return json({ error: 'FIREBASE_SERVICE_ACCOUNT not set' }, 501);
  let body; try { body = await request.json(); } catch { return json({ error: 'bad body' }, 400); }
  if (env.PUSH_KEY && body.appKey !== env.PUSH_KEY && request.headers.get('x-app-key') !== env.PUSH_KEY) return json({ error: 'unauthorized' }, 401);

  let sa; try { sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT); } catch { return json({ error: 'service account JSON invalid' }, 500); }
  const tokens = (body.tokens || []).filter(Boolean);
  if (!tokens.length) return json({ error: 'no tokens' }, 400);

  let token; try { token = await accessToken(sa); } catch (e) { return json({ error: String(e) }, 500); }
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const results = [];
  for (const t of tokens.slice(0, 500)) {
    const msg = { message: { token: t, notification: { title: body.title || '旅程通知', body: body.body || '' }, data: body.data || {}, webpush: { fcmOptions: { link: body.link || '/' } } } };
    try {
      const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(msg) });
      results.push({ ok: r.ok, status: r.status });
    } catch (e) { results.push({ ok: false, error: String(e) }); }
  }
  return json({ sent: results.filter(r => r.ok).length, total: results.length, results });
}

export async function onRequestGet({ env }) {
  return json({ ok: true, configured: !!env.FIREBASE_SERVICE_ACCOUNT, protected: !!env.PUSH_KEY, hint: 'POST { tokens, title, body } to send FCM web push.' });
}
