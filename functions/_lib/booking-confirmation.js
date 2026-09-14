import { cleanText, getEnvValue } from './platform-integrations.js';

export const BOOKING_CONFIRM_TTL_SECONDS = 48 * 60 * 60;
const REQUEST_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIGNATURE_RE = /^[A-Za-z0-9_-]{43}$/;
const ALLOWED_HOSTS = new Set(['hundesalon-nika.com', 'www.hundesalon-nika.com']);

function signingSecret(env) {
  return getEnvValue(env, 'BOOKING_CONFIRM_SECRET') || getEnvValue(env, 'TELEGRAM_WEBHOOK_SECRET');
}

function encodeBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function constantTimeEqual(left, right) {
  if (!left || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function signatureFor(env, requestId, expires) {
  const secret = signingSecret(env);
  if (secret.length < 24 || !REQUEST_ID_RE.test(requestId) || !Number.isSafeInteger(expires)) return '';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const payload = `hundesalon-booking-confirm-v1\0${requestId.toLowerCase()}\0${expires}`;
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return encodeBase64Url(new Uint8Array(signature));
}

export async function buildBookingConfirmationUrl(env, origin, requestId, now = Date.now()) {
  const safeRequestId = cleanText(requestId, 36).toLowerCase();
  let url;
  try {
    url = new URL('/api/booking-confirm', origin);
  } catch {
    return '';
  }
  if (
    url.protocol !== 'https:' ||
    !ALLOWED_HOSTS.has(url.hostname.toLowerCase()) ||
    !REQUEST_ID_RE.test(safeRequestId)
  ) {
    return '';
  }
  const expires = Math.floor(now / 1000) + BOOKING_CONFIRM_TTL_SECONDS;
  const signature = await signatureFor(env, safeRequestId, expires);
  if (!signature) return '';
  url.searchParams.set('id', safeRequestId);
  url.searchParams.set('expires', String(expires));
  url.searchParams.set('sig', signature);
  return url.toString();
}

export async function verifyBookingConfirmationToken(env, params, now = Date.now()) {
  const requestId = cleanText(params?.get?.('id'), 36).toLowerCase();
  const expiresText = cleanText(params?.get?.('expires'), 16);
  const signature = cleanText(params?.get?.('sig'), 64);
  const expires = Number(expiresText);
  const nowSeconds = Math.floor(now / 1000);
  if (
    !REQUEST_ID_RE.test(requestId) ||
    !/^\d{10}$/.test(expiresText) ||
    !Number.isSafeInteger(expires) ||
    !SIGNATURE_RE.test(signature)
  ) {
    return { ok: false, reason: 'invalid' };
  }
  if (expires < nowSeconds || expires > nowSeconds + BOOKING_CONFIRM_TTL_SECONDS + 60) {
    return { ok: false, reason: 'expired' };
  }
  const expected = await signatureFor(env, requestId, expires);
  return constantTimeEqual(expected, signature) ? { ok: true, requestId, expires } : { ok: false, reason: 'invalid' };
}
