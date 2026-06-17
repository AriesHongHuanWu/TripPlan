// Cloudflare Pages Function — AI proxy  →  route: /api/ai
// Keeps the API key server-side; the browser only ever talks to /api/ai (the AI
// provider is never exposed to the client). Model identity is stripped from
// responses too, so the engine stays private.
//
// Env (Cloudflare Pages → Settings → Variables and Secrets):
//   AI_API_KEY   (secret)  — your provider key   (GEMINI_API_KEY also accepted)
//   AI_MODEL     (var, optional)                 (GEMINI_MODEL also accepted)
//
// MULTIPLE KEYS: put several keys in AI_API_KEY / GEMINI_API_KEY separated by
// commas, spaces or newlines. On a rate-limit (429 / quota) we automatically
// rotate to the next key; across the model fallbacks too (separate quota pools).
// You can also use AI_API_KEYS / GEMINI_API_KEYS for the list explicitly.

// Order = best→safest. flash-lite has a MUCH larger free quota, so it sits 2nd: the moment the
// primary flash is rate-limited we jump straight to lite (instead of wasting calls on the other
// flash tiers that share the same low free quota). The remaining tiers are extra safety nets.
const MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];
const missing = (s, t) => s === 404 || /not found|not supported|unknown name|call ListModels/i.test(t || '');
const rateLimited = (s, t) => s === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit|too many requests/i.test(t || '');
const badKey = (s, t) => s === 401 || s === 403 || (s === 400 && /api.?key|API_KEY_INVALID|invalid.{0,8}key/i.test(t || ''));
const parseKeys = v => (v || '').split(/[\s,;]+/).map(k => k.trim()).filter(Boolean);

// Pass an upstream response back, stripping any model-identity fields.
function out(text, status) {
  let body = text;
  try { const o = JSON.parse(text); if (o && typeof o === 'object') { delete o.modelVersion; body = JSON.stringify(o); } } catch {}
  return new Response(body, { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export async function onRequestPost({ request, env }) {
  const KEYS = parseKeys(env.AI_API_KEY || env.GEMINI_API_KEY || env.AI_API_KEYS || env.GEMINI_API_KEYS);
  if (!KEYS.length) return json({ error: 'AI key not set on the server.' }, 503);
  let body = '{}';
  try { body = await request.text(); } catch (_) {}

  const preferred = env.AI_MODEL || env.GEMINI_MODEL || MODELS[0];
  const models = [preferred, ...MODELS].filter((m, i, a) => m && a.indexOf(m) === i);
  let lastStatus = 502, lastText = JSON.stringify({ error: 'all keys/models failed' });

  // MODEL-outer / KEY-inner: try each (better) model across EVERY key before degrading
  // to the next model — so flash-lite (last in MODELS) is only used once every key has
  // exhausted the stronger flash models.
  for (const model of models) {
    for (const KEY of KEYS) {              // spread load across all keys for this model
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
      if (rateLimited(up.status, text)) continue;   // this key throttled for this model → next key
      if (missing(up.status, text)) break;          // model alias gone → no key fixes it → next model
      if (badKey(up.status, text)) continue;        // dud/blocked key → next key
      return out(text, up.status);                  // genuine request/server error → surface
    }
  }
  return out(lastText, lastStatus);   // every key throttled / rejected on every model
}

export async function onRequestGet({ env }) {
  const n = parseKeys(env.AI_API_KEY || env.GEMINI_API_KEY || env.AI_API_KEYS || env.GEMINI_API_KEYS).length;
  return json({ ok: true, ready: n > 0, keys: n });
}
