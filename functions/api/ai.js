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

// Default = Flash Lite (fast + much larger free quota → fewest 429/524). MODELS[0] is the default
// when no AI_MODEL/GEMINI_MODEL env is set. The bigger flash models are only deeper fallbacks.
// To pin an exact build, set GEMINI_MODEL (e.g. gemini-3.1-flash-lite) — it's tried before these.
const MODELS = ['gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];
const missing = (s, t) => s === 404 || /not found|not supported|unknown name|call ListModels/i.test(t || '');
const rateLimited = (s, t) => s === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit|too many requests/i.test(t || '');
// Google answers 503 / UNAVAILABLE / "model overloaded" when a (free-tier) model is busy — transient,
// so retry on the next model/key (e.g. flash-lite) instead of surfacing it as a hard failure.
const overloaded = (s, t) => s === 503 || /overloaded|unavailable|try again later/i.test(t || '');
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

  // Time budgets so we ALWAYS answer before Cloudflare's ~100s edge timeout (524):
  const startedAt = Date.now();
  const TOTAL_BUDGET_MS = 85000;   // overall — leave headroom under the 524 cutoff
  const PER_CALL_MS = 28000;       // abort a single slow Gemini call and fall back (flash-lite is faster)

  // MODEL-outer / KEY-inner: try each (better) model across EVERY key before degrading
  // to the next model — so flash-lite (last in MODELS) is only used once every key has
  // exhausted the stronger flash models.
  for (const model of models) {
    for (const KEY of KEYS) {              // spread load across all keys for this model
      if (Date.now() - startedAt > TOTAL_BUDGET_MS) {   // out of time → graceful "busy" (client retries)
        return json({ error: 'AI is busy right now (timed out). Please try again in a moment.', busy: true }, 503);
      }
      let up;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), PER_CALL_MS);
      try {
        up = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY }, body, signal: ctrl.signal }
        );
      } catch (e) {                                     // timeout/abort or network → transient, try next key/model
        clearTimeout(timer);
        lastStatus = 503; lastText = JSON.stringify({ error: 'upstream timeout/abort', busy: true });
        continue;
      }
      clearTimeout(timer);
      const text = await up.text();
      if (up.ok) return out(text, 200);
      lastStatus = up.status; lastText = text;
      if (rateLimited(up.status, text)) continue;   // this key throttled for this model → next key
      if (overloaded(up.status, text)) continue;    // model busy/overloaded → try next key, then next model (flash-lite)
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
