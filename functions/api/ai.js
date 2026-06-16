// Cloudflare Pages Function — AI proxy  →  route: /api/ai
// Keeps the API key server-side; the browser only ever talks to /api/ai (the AI
// provider is never exposed to the client). Model identity is stripped from
// responses too, so the engine stays private.
//
// Env (Cloudflare Pages → Settings → Variables):
//   AI_API_KEY   (secret)  — your provider key   (GEMINI_API_KEY also accepted)
//   AI_MODEL     (var, optional)                 (GEMINI_MODEL also accepted)

const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];
const missing = (s, t) => s === 404 || /not found|not supported|unknown name|call ListModels/i.test(t || '');

// Pass an upstream response back, stripping any model-identity fields.
function out(text, status) {
  let body = text;
  try { const o = JSON.parse(text); if (o && typeof o === 'object') { delete o.modelVersion; body = JSON.stringify(o); } } catch {}
  return new Response(body, { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export async function onRequestPost({ request, env }) {
  const KEY = env.AI_API_KEY || env.GEMINI_API_KEY;
  if (!KEY) return json({ error: 'AI key not set on the server.' }, 503);
  let body = '{}';
  try { body = await request.text(); } catch (_) {}

  const preferred = env.AI_MODEL || env.GEMINI_MODEL || MODELS[0];
  const models = [preferred, ...MODELS].filter((m, i, a) => m && a.indexOf(m) === i);
  let lastStatus = 502, lastText = JSON.stringify({ error: 'all models failed' });
  for (const model of models) {
    let up;
    try {
      up = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY }, body }
      );
    } catch (e) { return json({ error: 'Upstream fetch failed: ' + String(e) }, 502); }
    const text = await up.text();
    if (up.ok) return out(text, 200);
    lastStatus = up.status; lastText = text;
    if (!missing(up.status, text)) return out(text, up.status);   // real key/quota/permission error
  }
  return out(lastText, lastStatus);
}

export async function onRequestGet({ env }) {
  return json({ ok: true, ready: !!(env.AI_API_KEY || env.GEMINI_API_KEY) });
}
