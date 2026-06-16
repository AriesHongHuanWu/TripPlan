// Cloudflare Pages Function — Gemini proxy  →  route: /api/gemini
// Keeps the API key server-side. Forwards the client's generateContent payload.
//
// Required env (set in Cloudflare Pages dashboard or via wrangler):
//   GEMINI_API_KEY  (secret)  — your Google AI Studio key
//   GEMINI_MODEL    (var)     — e.g. gemini-flash-latest  (Gemini Flash 3.0)

const DEFAULT_MODEL = 'gemini-flash-latest';

export async function onRequestPost({ request, env }) {
  if (!env.GEMINI_API_KEY) {
    return json({ error: 'GEMINI_API_KEY not set on the server. Configure it in Cloudflare Pages settings, or paste a key in the app Settings for direct mode.' }, 503);
  }
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  let body = '{}';
  try { body = await request.text(); } catch (_) {}

  let upstream;
  try {
    upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY }, body }
    );
  } catch (e) {
    return json({ error: 'Upstream fetch failed: ' + String(e) }, 502);
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function onRequestGet({ env }) {
  return json({ ok: true, model: env.GEMINI_MODEL || DEFAULT_MODEL, keyConfigured: !!env.GEMINI_API_KEY, hint: 'POST your generateContent payload here.' });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
