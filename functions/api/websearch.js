// Cloudflare Pages Function — live web search proxy (for the AI's web_search tool)
//   GET /api/websearch?q=...&n=5&recent=1  -> { query, results:[{title,url,content,date}] }
//
// Proxies the free, key-less Miyami WebSearch tool (FastAPI + SearXNG):
//   https://github.com/ankushthakur2007/miyami_websearch_tool
// Server-side so the browser isn't blocked by CORS. Works out-of-the-box; no setup.
// Override the upstream by setting the WEBSEARCH_URL env var on the Pages project.

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=600' } });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || url.searchParams.get('query') || '').trim();
  if (!q) return json({ error: 'missing query', results: [] }, 400);
  const n = Math.min(8, Math.max(1, parseInt(url.searchParams.get('n') || '5', 10) || 5));
  const recent = url.searchParams.get('recent') === '1' || url.searchParams.get('recent') === 'true';

  const base = (env && env.WEBSEARCH_URL) || 'https://websearch.miyami.tech';
  const up = new URL(base.replace(/\/$/, '') + '/search-api');
  up.searchParams.set('query', q);
  up.searchParams.set('max_results', String(n));
  if (recent) up.searchParams.set('time_range', 'month');

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(up.toString(), { headers: { Accept: 'application/json' }, signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) return json({ error: 'upstream ' + r.status, results: [] }, 502);
    const data = await r.json();
    const results = (data.results || []).slice(0, n).map(x => ({
      title: x.title || '', url: x.url || '', content: String(x.content || '').slice(0, 500), date: x.publishedDate || null,
    }));
    return json({ query: q, results });
  } catch (e) {
    return json({ error: String(e && e.message || e), results: [] }, 502);
  }
}
