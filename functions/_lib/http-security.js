/**
 * Shared HTTP security helpers for Cloudflare Pages Functions.
 */

const LOCAL_DEV_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Browser origins for the public site (apex + www). */
const TRUSTED_SITE_ORIGINS = new Set(['https://hundesalon-nika.com', 'https://www.hundesalon-nika.com']);
const TEXT_ENCODER = new TextEncoder();
const REQUEST_BODY_TOO_LARGE_CODE = 'REQUEST_BODY_TOO_LARGE';

function parseUrl(value) {
  try {
    return new URL(String(value || ''));
  } catch {
    return null;
  }
}

function isTrustedPagesDevHostname(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'hundesalon-nika.pages.dev' || /^[a-z0-9-]+\.hundesalon-nika\.pages\.dev$/.test(host);
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

export function getPublicReadCorsOrigin(request) {
  const method = String(request?.method || '').toUpperCase();
  if (!['GET', 'HEAD'].includes(method)) return '';

  const origin = sanitizeOrigin(request?.headers?.get('Origin'));
  const originUrl = parseUrl(origin);
  if (!originUrl) return '';

  if (
    TRUSTED_SITE_ORIGINS.has(originUrl.origin) ||
    isTrustedPagesDevHostname(originUrl.hostname) ||
    isLocalDevOrigin(originUrl.origin)
  ) {
    return originUrl.origin;
  }

  return '';
}

/**
 * POST from the public site must include a trusted Origin header.
 * Local dev is allowed only for exact localhost / loopback / private LAN origins.
 *
 * Custom domain traffic is reverse-proxied to *.pages.dev (workers/pages-proxy.js)
 * while the browser Origin stays on the public host — that pair must be allowed.
 */
export function isAllowedOrigin(origin, requestUrl) {
  if (!origin) return false;

  const originUrl = parseUrl(origin);
  const targetUrl = parseUrl(requestUrl);
  if (!originUrl || !targetUrl) return false;

  if (originUrl.origin === targetUrl.origin) {
    return true;
  }

  if (TRUSTED_SITE_ORIGINS.has(originUrl.origin)) {
    if (TRUSTED_SITE_ORIGINS.has(targetUrl.origin) || isTrustedPagesDevHostname(targetUrl.hostname)) {
      return true;
    }
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

/**
 * Compare arbitrary secret strings without leaking their original length.
 * Values are hashed to fixed-size digests before Cloudflare's timing-safe
 * comparison. The fixed-size fallback keeps local Node.js tests portable.
 */
export async function timingSafeEqualStrings(left, right) {
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', TEXT_ENCODER.encode(String(left ?? ''))),
    crypto.subtle.digest('SHA-256', TEXT_ENCODER.encode(String(right ?? ''))),
  ]);

  if (typeof crypto.subtle.timingSafeEqual === 'function') {
    return crypto.subtle.timingSafeEqual(leftDigest, rightDigest);
  }

  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

function bodyTooLargeError() {
  const error = new Error(REQUEST_BODY_TOO_LARGE_CODE);
  error.code = REQUEST_BODY_TOO_LARGE_CODE;
  return error;
}

export function isRequestBodyTooLarge(error) {
  return error?.code === REQUEST_BODY_TOO_LARGE_CODE;
}

async function readBoundedBodyBytes(request, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError('maxBytes must be a positive safe integer');
  }

  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw bodyTooLargeError();
  }

  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
    totalBytes += chunk.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => {});
      throw bodyTooLargeError();
    }
    chunks.push(chunk);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readJsonBody(request, maxBytes) {
  const body = await readBoundedBodyBytes(request, maxBytes);
  if (!body.byteLength) return {};
  return JSON.parse(new TextDecoder().decode(body));
}

export async function readFormDataBody(request, maxBytes) {
  const body = await readBoundedBodyBytes(request, maxBytes);
  const replay = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body,
  });
  return replay.formData();
}

function getClientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

/**
 * Best-effort edge rate limit via the data-center-local Cache API.
 * Costly public endpoints must also have an authoritative Cloudflare WAF rate
 * limiting rule; this helper remains a defense-in-depth application guard.
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

export function applyCorsResponseHeaders(response, origin) {
  if (!origin) return response;

  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);

  const vary = headers.get('Vary');
  const varyValues = String(vary || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  if (vary !== '*' && !varyValues.some(value => value.toLowerCase() === 'origin')) {
    varyValues.push('Origin');
    headers.set('Vary', varyValues.join(', '));
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function applyApiResponseHeaders(response, origin) {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cache-Control', 'no-store');
  return applyCorsResponseHeaders(
    new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }),
    origin
  );
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
      if (/stack|trace|exception|details|raw/i.test(key)) {
        continue;
      }
      output[key] = sanitizeApiPayload(item);
    }
    return output;
  }

  if (typeof value === 'string') {
    // Remove values that look like stack traces or internal diagnostics.
    if (
      /(?:^|\n)\s*at\s+(?:async\s+)?[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\([^\n()]+:\d+:\d+\)/.test(value) ||
      /\b(node:internal|file:\/\/|webpack:)/i.test(value)
    ) {
      return 'Internal server error';
    }
  }

  return value;
}

export function jsonResponse(data, status = 200, origin = '') {
  // Never expose stack traces or internal diagnostics in error responses.
  const safe =
    status >= 500
      ? { error: 'Internal server error' }
      : status >= 400
        ? { error: 'Request failed' }
        : sanitizeApiPayload(data);
  return applyApiResponseHeaders(
    new Response(JSON.stringify(safe), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }),
    origin
  );
}
