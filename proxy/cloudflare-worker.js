const ESPN_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=300&dates=20260611-20260719";
const ESPN_SUMMARY =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=";

const CACHE_SECONDS = {
  scoreboard: 60,
  summary: 300
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const route = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") return corsResponse(null, 204);
    if (request.method !== "GET") return corsResponse({ error: "Method not allowed" }, 405);

    if (route === "/health") return corsResponse({ ok: true });
    if (route === "/scoreboard") {
      return cachedJson(request, ESPN_SCOREBOARD, CACHE_SECONDS.scoreboard, ctx);
    }
    if (route === "/summary") {
      const eventId = url.searchParams.get("event") || "";
      if (!/^\d+$/.test(eventId)) return corsResponse({ error: "Invalid event id" }, 400);
      return cachedJson(request, `${ESPN_SUMMARY}${eventId}`, CACHE_SECONDS.summary, ctx);
    }

    return corsResponse({
      error: "Not found",
      routes: ["/scoreboard", "/summary?event=EVENT_ID", "/health"]
    }, 404);
  }
};

async function cachedJson(request, upstreamUrl, maxAgeSeconds, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).toString(), request);
  const cached = await cache.match(cacheKey);
  if (cached) return withCors(cached);

  const upstream = await fetch(upstreamUrl, {
    headers: {
      accept: "application/json",
      "user-agent": "WorldCupTrackerProxy/1.0"
    },
    cf: {
      cacheTtl: maxAgeSeconds,
      cacheEverything: true
    }
  });

  if (!upstream.ok) {
    return corsResponse({ error: `Upstream returned ${upstream.status}` }, upstream.status);
  }

  const response = new Response(await upstream.text(), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 4}`,
      "x-world-cup-proxy": "cloudflare-worker"
    }
  });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return withCors(response);
}

function corsResponse(body, status = 200) {
  return withCors(new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  }));
}

function withCors(response) {
  const next = new Response(response.body, response);
  next.headers.set("access-control-allow-origin", "*");
  next.headers.set("access-control-allow-methods", "GET, OPTIONS");
  next.headers.set("access-control-allow-headers", "content-type");
  return next;
}
