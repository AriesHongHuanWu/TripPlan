// Cloudflare Pages Function — trip-plan cloud sync via Workers KV
//   GET  /api/plan?code=ab12cd   -> stored itinerary JSON (404 if none)
//   PUT  /api/plan?code=ab12cd   -> store body JSON under that code
//
// Setup (optional — app works fully without this, using on-device storage):
//   1. Create a KV namespace:  npx wrangler kv namespace create PLAN
//      (or Dashboard → Workers & Pages → KV → Create a namespace)
//   2. Bind it to this Pages project:
//      Dashboard → your Pages project → Settings → Bindings → Add → KV namespace
//      Variable name: PLAN   →   pick the namespace   →   Save & redeploy.

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

function code(request) {
  const c = new URL(request.url).searchParams.get('code') || '';
  return /^[a-z0-9]{4,16}$/i.test(c) ? c : null;
}

export async function onRequestGet({ request, env }) {
  if (!env.PLAN) return json({ error: 'KV_NOT_CONFIGURED' }, 501);
  const c = code(request); if (!c) return json({ error: 'bad code' }, 400);
  const data = await env.PLAN.get('plan:' + c, { type: 'json' });
  if (!data) return json({ error: 'not found' }, 404);
  return json(data);
}

export async function onRequestPut({ request, env }) {
  if (!env.PLAN) return json({ error: 'KV_NOT_CONFIGURED' }, 501);
  const c = code(request); if (!c) return json({ error: 'bad code' }, 400);
  let body;
  try { body = await request.text(); } catch { return json({ error: 'bad body' }, 400); }
  if (body.length > 1_000_000) return json({ error: 'too large' }, 413);
  await env.PLAN.put('plan:' + c, body, { expirationTtl: 60 * 60 * 24 * 120 }); // 120 days
  return json({ ok: true, code: c });
}

// allow POST as an alias for PUT
export const onRequestPost = onRequestPut;
