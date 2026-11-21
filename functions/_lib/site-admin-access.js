import { readJsonBody } from './http-security.js';

const loopbackNames = new Set(['127.0.0.1', 'localhost', '[::1]']);
const teamOriginPattern = /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/;
const keyIdPattern = /^[A-Za-z0-9_-]{1,128}$/;
const accessAlgorithm = 'RSASSA-PKCS1-v1_5';
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const keyCacheLifetime = 60_000;

// Cache only public signing keys, scoped to the configured issuer.
let cachedKeys;

export function isAdminLoopback(url) {
  return ['http:', 'https:'].includes(url.protocol) && loopbackNames.has(url.hostname);
}

function decodeSegment(segment) {
  return Uint8Array.from(atob(segment.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0));
}

async function accessKey(issuer, kid) {
  if (cachedKeys?.issuer !== issuer || cachedKeys.expiresAt <= Date.now()) {
    const response = await fetch(issuer + '/cdn-cgi/access/certs', {
      cache: 'no-store',
      redirect: 'error',
      signal: globalThis.AbortSignal.timeout(4000),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const { keys } = await readJsonBody(response, 32 * 1024);
    if (!Array.isArray(keys)) return null;
    cachedKeys = { issuer, keys, expiresAt: Date.now() + keyCacheLifetime };
  }
  const matches = cachedKeys.keys.filter(key => key?.kid === kid);
  if (matches.length !== 1) return null;
  const [key] = matches;
  if (key.kty !== 'RSA' || key.alg !== 'RS256' || key.use !== 'sig') return null;
  return crypto.subtle.importKey('jwk', key, { name: accessAlgorithm, hash: 'SHA-256' }, false, ['verify']);
}

export async function hasSiteAdminAccess(request, env) {
  const url = new URL(request.url);
  if (isAdminLoopback(url)) return true;
  const origin = env?.SITE_ADMIN_ORIGIN;
  const issuer = env?.SITE_ADMIN_ACCESS_TEAM;
  const audience = env?.SITE_ADMIN_ACCESS_AUD;
  const email = env?.SITE_ADMIN_ACCESS_EMAIL;
  if (
    url.protocol !== 'https:' ||
    url.origin !== origin ||
    typeof issuer !== 'string' ||
    !teamOriginPattern.test(issuer) ||
    typeof audience !== 'string' ||
    !audience.trim() ||
    typeof email !== 'string' ||
    !/^[^\s@]+@[^\s@]+$/.test(email)
  )
    return false;

  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || token.length > 8192 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return false;
  const [encodedHeader, encodedClaims, signature] = token.split('.');
  try {
    const header = JSON.parse(decoder.decode(decodeSegment(encodedHeader)));
    if (
      header.alg !== 'RS256' ||
      typeof header.kid !== 'string' ||
      !keyIdPattern.test(header.kid) ||
      header.crit !== undefined ||
      header.b64 !== undefined
    )
      return false;

    const claims = JSON.parse(decoder.decode(decodeSegment(encodedClaims)));
    const now = Math.floor(Date.now() / 1000);
    const appAudience = Array.isArray(claims.aud) && claims.aud.length === 1 ? claims.aud[0] : claims.aud;
    if (
      claims.type !== 'app' ||
      claims.iss !== issuer ||
      appAudience !== audience ||
      claims.email !== email ||
      typeof claims.sub !== 'string' ||
      !claims.sub ||
      !Number.isSafeInteger(claims.exp) ||
      claims.exp <= now ||
      (claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || claims.nbf > now))
    )
      return false;

    const key = await accessKey(issuer, header.kid);
    return (
      key !== null &&
      (await crypto.subtle.verify(
        accessAlgorithm,
        key,
        decodeSegment(signature),
        encoder.encode(encodedHeader + '.' + encodedClaims)
      ))
    );
  } catch {
    return false;
  }
}
