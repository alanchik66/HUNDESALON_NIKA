/**
 * Shared HTTP security helpers for Cloudflare Pages Functions.
 */

const LOCAL_ORIGIN_PREFIXES = ['http://localhost', 'http://127.0.0.1'];

export function sanitizeOrigin(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/\/$/, '');
}

export function getOriginHost(origin) {
  try {
    return new URL(origin).host;
  } catch {
    return '';
  }
}

/**
 * POST from the public site must include a trusted Origin header.
 * Local dev (localhost / 127.0.0.1) is allowed for wrangler pages dev.
 */
export function isAllowedOrigin(origin, host) {
  if (!origin) return false;

  if (LOCAL_ORIGIN_PREFIXES.some(prefix => origin.startsWith(prefix))) {
    return true;
  }

  const originHost = getOriginHost(origin);
  if (!originHost || !host) return false;

  const requestHost = host.toLowerCase();
  const requestHostBase = requestHost.split(':')[0];
  const originHostLower = originHost.toLowerCase();
  const originHostBase = originHostLower.split(':')[0];

  return originHostLower === requestHost || originHostBase === requestHostBase;
}

export function assertAllowedOrigin(request) {
  const origin = sanitizeOrigin(request.headers.get('Origin'));
  const host = sanitizeOrigin(request.headers.get('Host'));
  if (!isAllowedOrigin(origin, host)) {
    return { ok: false, origin, host };
  }
  return { ok: true, origin, host };
}

function getClientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

/**
 * Edge rate limit via Cache API (per IP + route + time bucket).
 * @returns {Promise<Response|null>} 429 response or null when allowed
 */
export async function enforceRateLimit(request, { route, limit, windowSec = 60 }) {
  const ip = getClientIp(request);
  const bucket = Math.floor(Date.now() / (windowSec * 1000));
  const cacheKey = new Request(`https://rate-limit.hundesalon-nika.internal/${route}/${ip}/${bucket}`);

  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  const previous = cached ? Number.parseInt(await cached.text(), 10) : 0;
  const count = Number.isFinite(previous) ? previous + 1 : 1;

  if (count > limit) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Retry-After': String(windowSec),
      },
    });
  }

  await cache.put(
    cacheKey,
    new Response(String(count), {
      headers: { 'Cache-Control': `max-age=${windowSec}` },
    })
  );

  return null;
}

export function applyApiResponseHeaders(response, origin) {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cache-Control', 'no-store');
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function jsonResponse(data, status = 200, origin = '') {
  return applyApiResponseHeaders(
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }),
    origin
  );
}
