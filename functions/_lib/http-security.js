/**
 * Shared HTTP security helpers for Cloudflare Pages Functions.
 */

const LOCAL_DEV_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

function parseUrl(value) {
  try {
    return new URL(String(value || ''));
  } catch {
    return null;
  }
}

function isPrivateIpv4Hostname(hostname) {
  const match = /^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/.exec(String(hostname || ''));
  if (!match) return false;

  const octets = match.slice(1).map(Number);
  if (octets.some(octet => octet < 0 || octet > 255)) {
    return false;
  }

  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
  );
}

export function sanitizeOrigin(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/\/$/, '');
}

export function getOriginHost(origin) {
  return parseUrl(origin)?.host || '';
}

export function isLocalDevOrigin(origin) {
  const originUrl = parseUrl(origin);
  if (!originUrl) return false;
  if (!['http:', 'https:'].includes(originUrl.protocol)) return false;

  return LOCAL_DEV_HOSTNAMES.has(originUrl.hostname) || isPrivateIpv4Hostname(originUrl.hostname);
}

/**
 * POST from the public site must include a trusted Origin header.
 * Local dev is allowed only for exact localhost / loopback / private LAN origins.
 */
export function isAllowedOrigin(origin, requestUrl) {
  if (!origin) return false;

  const originUrl = parseUrl(origin);
  const targetUrl = parseUrl(requestUrl);
  if (!originUrl || !targetUrl) return false;

  if (originUrl.origin === targetUrl.origin) {
    return true;
  }

  return (
    originUrl.protocol === targetUrl.protocol &&
    originUrl.hostname === targetUrl.hostname &&
    isLocalDevOrigin(origin) &&
    isLocalDevOrigin(targetUrl.origin)
  );
}

export function assertAllowedOrigin(request) {
  const origin = sanitizeOrigin(request.headers.get('Origin'));
  const host = sanitizeOrigin(request.headers.get('Host'));
  if (!isAllowedOrigin(origin, request.url)) {
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
    headers,
  });
}

function sanitizeApiPayload(value) {
  if (value instanceof Error) {
    return { error: 'Internal server error' };
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeApiPayload);
  }

  if (value && typeof value === 'object') {
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      if (/stack|trace|exception/i.test(key)) {
        continue;
      }
      output[key] = sanitizeApiPayload(item);
    }
    return output;
  }

  return value;
}

export function jsonResponse(data, status = 200, origin = '') {
  // Never expose stack traces or Error internals in API responses.
  const safe = status >= 500 ? { error: 'Internal server error' } : sanitizeApiPayload(data);
  return applyApiResponseHeaders(
    new Response(JSON.stringify(safe), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }),
    origin
  );
}
