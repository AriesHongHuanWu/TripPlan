// ============================================================================
// Cloudflare Worker (Cron) — itinerary reminders via FCM.
// Every 15 min it reads each signed-in user's plan from Firestore and pushes
// "preparing to leave / catch your train" notifications even when the app is closed.
//
// The web app writes to Firestore users/{uid}:
//   scheduleJson (string)  – flattened plan items [{d:'YYYY-MM-DD', t:'HH:MM', title, type}]
//   notifyJson   (string)  – { enabled, types:{reminder,...} }
//   fcmTokens    (map)     – { <token>: ts }    (device push tokens)
//   pushCursor   (int)     – last-sent epoch ms (set by this Worker)
//
// Secrets (wrangler secret put):  FIREBASE_SERVICE_ACCOUNT, PUSH_KEY
// ============================================================================

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(run(env)); },
  async fetch(req, env) {                                   // manual test endpoint
    const u = new URL(req.url);
    if (env.PUSH_KEY && u.searchParams.get('key') !== env.PUSH_KEY) return new Response('unauthorized', { status: 401 });
    try { return Response.json(await run(env)); } catch (e) { return Response.json({ error: String(e) }, { status: 500 }); }
  },
};

const enc = s => new TextEncoder().encode(s);
function b64url(buf) { const b = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf; let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function pemToPkcs8(pem) { const b = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''); const bin = atob(b), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; }

async function accessToken(sa, scope) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(enc(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = b64url(enc(JSON.stringify({ iss: sa.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })));
  const key = await crypto.subtle.importKey('pkcs8', pemToPkcs8(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc(`${head}.${claim}`));
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${head}.${claim}.${b64url(sig)}` });
  const j = await res.json(); if (!res.ok) throw new Error('oauth ' + JSON.stringify(j)); return j.access_token;
}

const FS = 'https://firestore.googleapis.com/v1';
async function listUsers(project, token) {
  const out = []; let pageToken = '';
  do {
    const url = `${FS}/projects/${project}/databases/(default)/documents/users?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json(); if (j.documents) out.push(...j.documents); pageToken = j.nextPageToken || '';
  } while (pageToken);
  return out;
}
const strField = f => (f && f.stringValue != null) ? f.stringValue : null;
const intField = f => !f ? null : (f.integerValue != null ? Number(f.integerValue) : (f.doubleValue != null ? Number(f.doubleValue) : null));
const tokensField = f => (f && f.mapValue && f.mapValue.fields) ? Object.keys(f.mapValue.fields) : [];

async function setCursor(name, token, ts) {
  await fetch(`${FS}/${name}?updateMask.fieldPaths=pushCursor`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { pushCursor: { integerValue: String(ts) } } }),
  }).catch(() => {});
}
async function sendPush(project, token, tokens, title, body) {
  const url = `https://fcm.googleapis.com/v1/projects/${project}/messages:send`;
  for (const t of tokens.slice(0, 500)) {
    await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: { token: t, notification: { title, body }, webpush: { fcmOptions: { link: '/' } } } }) }).catch(() => {});
  }
}

async function run(env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) return { error: 'FIREBASE_SERVICE_ACCOUNT not set' };
  const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
  const token = await accessToken(sa, 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging');
  const project = sa.project_id;
  const users = await listUsers(project, token);
  const now = Date.now(); let sent = 0, scanned = 0;

  for (const u of users) {
    const f = u.fields || {};
    let notify = null, schedule = null;
    try { notify = JSON.parse(strField(f.notifyJson) || 'null'); } catch {}
    try { schedule = JSON.parse(strField(f.scheduleJson) || 'null'); } catch {}
    if (!notify || !notify.enabled || !notify.types || !notify.types.reminder) continue;
    const tokens = tokensField(f.fcmTokens);
    if (!tokens.length || !Array.isArray(schedule)) continue;
    scanned++;
    let cursor = intField(f.pushCursor); if (cursor == null) cursor = now - 15 * 60000;  // don't blast old items on first run

    for (const it of schedule) {
      if (!it || !it.d || !it.t) continue;
      const itemEpoch = Date.parse(`${it.d}T${it.t}:00+09:00`);   // itinerary times are JST
      if (isNaN(itemEpoch)) continue;
      const lead = (it.type === 'move' ? 20 : 15) * 60000;
      const remind = itemEpoch - lead;
      if (remind > cursor && remind <= now) {
        const title = it.type === 'move' ? `⏰ 約 20 分鐘後出發：${it.title}` : `⏰ 約 15 分鐘後：${it.title}`;
        await sendPush(project, token, tokens, title, it.t);
        sent++;
      }
    }
    await setCursor(u.name, token, now);
  }
  return { users: users.length, scanned, sent, at: new Date(now).toISOString() };
}
