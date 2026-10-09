import { applyApiResponseHeaders } from './http-security.js';

const MIB = 1024 * 1024;
const MAX_CONFIGURED_LIMIT = 100_000;
const MAX_CONFIGURED_BYTES = 10 * 1024 * MIB;
const RESOURCE_DEFAULTS = Object.freeze({
  ai: { account: 200, client: 30, session: 20 },
  uploads: {
    account: 100,
    client: 10,
    session: 10,
    accountBytes: 1024 * MIB,
    clientBytes: 300 * MIB,
    sessionBytes: 300 * MIB,
  },
  upload_transfer: {
    account: 2000,
    client: 200,
    session: 100,
    accountBytes: 1024 * MIB,
    clientBytes: 300 * MIB,
    sessionBytes: 300 * MIB,
  },
  storage: {
    account: 1000,
    client: 150,
    session: 100,
    accountBytes: 64 * MIB,
    clientBytes: 8 * MIB,
    sessionBytes: 8 * MIB,
  },
  gifs: { account: 1000, client: 100, session: 100 },
});

const COPY = Object.freeze({
  de: 'Das Tageslimit ist erreicht. Bitte versuchen Sie es später oder kontaktieren Sie uns direkt. Eine Terminbuchung ohne Foto ist weiterhin möglich.',
  en: 'The daily limit has been reached. Please try again later or contact us directly. You can still book an appointment without a photo.',
  ru: 'Достигнут дневной лимит. Попробуйте позже или свяжитесь с нами напрямую. Записаться без фотографии по-прежнему можно.',
  uk: 'Досягнуто денного ліміту. Спробуйте пізніше або зв’яжіться з нами напряму. Записатися без фотографії можна й надалі.',
});

const UNAVAILABLE_COPY = Object.freeze({
  de: 'Dieser Dienst ist vorübergehend nicht verfügbar. Bitte versuchen Sie es später oder kontaktieren Sie uns direkt. Eine Terminbuchung ohne Foto ist weiterhin möglich.',
  en: 'This service is temporarily unavailable. Please try again later or contact us directly. You can still book an appointment without a photo.',
  ru: 'Сервис временно недоступен. Попробуйте позже или свяжитесь с нами напрямую. Записаться без фотографии по-прежнему можно.',
  uk: 'Сервіс тимчасово недоступний. Спробуйте пізніше або зв’яжіться з нами напряму. Записатися без фотографії можна й надалі.',
});

function positiveSetting(env, name, fallback, maximum) {
  const raw = env?.[name];
  if (raw === undefined || raw === null || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : null;
}

async function scopeHash(kind, value) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode('nika-resource-quota-v1:' + kind + ':' + value)
  );
  return kind + ':' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Reserve before external work. Failed upstream attempts remain charged because
 * their actual provider cost is unknown; refunds would allow repeated cost bypass.
 * Missing schema, malformed config or database errors fail closed.
 */
export async function reserveResourceUsage(
  env,
  request,
  { resource, sessionId = '', units = 1, bytes = 0, now = Date.now() }
) {
  const defaults = RESOURCE_DEFAULTS[resource];
  const clock = new Date(now);
  if (
    !defaults ||
    !Number.isSafeInteger(units) ||
    units < 1 ||
    !Number.isSafeInteger(bytes) ||
    bytes < 0 ||
    !Number.isFinite(clock.getTime())
  ) {
    return { ok: false, reason: 'unavailable', retryAfter: 60 };
  }
  const prefix = 'RESOURCE_QUOTA_' + resource.toUpperCase() + '_';
  const caps = [
    positiveSetting(env, prefix + 'ACCOUNT', defaults.account, MAX_CONFIGURED_LIMIT),
    positiveSetting(env, prefix + 'CLIENT', defaults.client, MAX_CONFIGURED_LIMIT),
    positiveSetting(env, prefix + 'SESSION', defaults.session, MAX_CONFIGURED_LIMIT),
    positiveSetting(env, prefix + 'ACCOUNT_BYTES', defaults.accountBytes || 1, MAX_CONFIGURED_BYTES),
    positiveSetting(env, prefix + 'CLIENT_BYTES', defaults.clientBytes || 1, MAX_CONFIGURED_BYTES),
    positiveSetting(env, prefix + 'SESSION_BYTES', defaults.sessionBytes || 1, MAX_CONFIGURED_BYTES),
  ];
  if (caps.some(value => value === null) || !env?.CHAT_DB?.prepare)
    return { ok: false, reason: 'unavailable', retryAfter: 60 };
  const day = clock.toISOString().slice(0, 10);
  const retryAfter = Math.max(1, Math.ceil((Date.parse(day + 'T00:00:00Z') + 86_400_000 - clock.getTime()) / 1000));
  // Cloudflare supplies this header at the edge. Never trust X-Forwarded-For or
  // a caller's claimed customer ID; missing identity shares one conservative bucket.
  const trustedIp =
    String(request.headers.get('CF-Connecting-IP') || '')
      .trim()
      .slice(0, 80) || 'unknown';
  const clientKey = await scopeHash('client', trustedIp);
  const sessionKey = await scopeHash('session', sessionId || 'client:' + trustedIp);
  try {
    const result = await env.CHAT_DB.prepare(
      'INSERT INTO resource_usage_reservations (id, day, resource, client_key, session_key, units, bytes, account_limit, client_limit, session_limit, account_bytes, client_bytes, session_bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(crypto.randomUUID(), day, resource, clientKey, sessionKey, units, bytes, ...caps)
      .run();
    // A successful INSERT must change at least its ledger row. D1 may also
    // report trigger changes; accepting those does not weaken the SQL decision.
    const changes = Number(result?.meta?.changes);
    if (result?.success === false || !Number.isInteger(changes) || changes < 1)
      return { ok: false, reason: 'unavailable', retryAfter: 60 };
    return { ok: true };
  } catch (error) {
    if (String(error?.message || '').includes('resource_quota_exceeded'))
      return { ok: false, reason: 'exceeded', retryAfter };
    // Do not log error text: a database/provider error may contain confidential values.
    console.error(JSON.stringify({ event: 'resource_quota_unavailable', resource }));
    return { ok: false, reason: 'unavailable', retryAfter: 60 };
  }
}

export function resourceQuotaResponse(quota, origin, locale = 'de') {
  const copy = quota.reason === 'exceeded' ? COPY : UNAVAILABLE_COPY;
  const response = applyApiResponseHeaders(
    new Response(
      JSON.stringify({
        success: false,
        error: quota.reason === 'exceeded' ? 'RESOURCE_DAILY_LIMIT' : 'RESOURCE_TEMPORARILY_UNAVAILABLE',
        message: copy[locale] || copy.de,
      }),
      {
        status: quota.reason === 'exceeded' ? 429 : 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    ),
    origin
  );
  response.headers.set('Retry-After', String(quota.retryAfter || 60));
  return response;
}
