// Cloudflare Pages Function — Gemini proxy  →  route: /api/gemini
// Keeps the API key server-side. Forwards the client's generateContent payload.
//
// Required env (set in Cloudflare Pages dashboard or via wrangler):
//   GEMINI_API_KEY  (secret)  — your Google AI Studio key
//   GEMINI_MODEL    (var)     — e.g. gemini-flash-latest  (Gemini Flash 3.0)

const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];
const modelMissing = (status, t) => status === 404 || /not found|not supported|unknown name|call ListModels/i.test(t || '');
const pass = (text, status) => new Response(text, { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

export async function onRequestPost({ request, env }) {
  if (!env.GEMINI_API_KEY) {
    return json({ error: 'GEMINI_API_KEY not set on the server. Configure it in Cloudflare Pages settings, or paste a key in the app Settings for direct mode.' }, 503);
  }
  let body = '{}';
  try { body = await request.text(); } catch (_) {}

  // Try the configured model, then known-good fallbacks if the model id is stale/unavailable.
  const preferred = env.GEMINI_MODEL || FALLBACK_MODELS[0];
  const models = [preferred, ...FALLBACK_MODELS].filter((m, i, a) => m && a.indexOf(m) === i);
  let lastStatus = 502, lastText = JSON.stringify({ error: 'all models failed' });
  for (const model of models) {
    let upstream;
    try {
      upstream = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY }, body }
      );
    } catch (e) { return json({ error: 'Upstream fetch failed: ' + String(e) }, 502); }
    const text = await upstream.text();
    if (upstream.ok) return pass(text, 200);
    lastStatus = upstream.status; lastText = text;
    if (!modelMissing(upstream.status, text)) return pass(text, upstream.status);  // real key/quota/permission error — surface it
  }
  return pass(lastText, lastStatus);
}

export async function onRequestGet({ env }) {
  return json({ ok: true, model: env.GEMINI_MODEL || DEFAULT_MODEL, keyConfigured: !!env.GEMINI_API_KEY, hint: 'POST your generateContent payload here.' });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
