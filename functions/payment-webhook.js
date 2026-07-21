/**
 * Stripe webhook: checkout.session.completed → notify salon (Resend / Teams / Sheet).
 * Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 * Binding: PAYMENT_EVENTS (KV; required when online payments are enabled)
 */
import { jsonResponse } from './_lib/http-security.js';
import {
  appendGoogleSheetRow,
  cleanText,
  getEnvValue,
  hasUsableValue,
  sendResendEmail,
  sendTeamsMessage,
} from './_lib/platform-integrations.js';

const DEFAULT_FROM = 'Hundesalon Nika <noreply@hundesalon-nika.com>';

function paymentsOnlineEnabled(env) {
  const raw = String(getEnvValue(env, 'PAYMENTS_ONLINE_ENABLED') || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
}

async function hmacSha256Hex(secret, payload) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function verifyStripeSignature(rawBody, header, secret) {
  if (!header || !secret) return false;
  let timestamp = '';
  const signatures = [];
  header.split(',').forEach(part => {
    const [key, ...rest] = part.split('=');
    const value = rest.join('=').trim();
    if (key.trim() === 't') timestamp = value;
    if (key.trim() === 'v1' && value) signatures.push(value);
  });
  if (!timestamp || signatures.length === 0) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const signed = `${timestamp}.${rawBody}`;
  const expected = await hmacSha256Hex(secret, signed);
  return signatures.some(sig => timingSafeEqual(sig, expected));
}

async function reservePaymentEvent(env, eventId) {
  const store = env?.PAYMENT_EVENTS;
  if (!store || typeof store.get !== 'function' || typeof store.put !== 'function') {
    return { ok: false, reason: 'payment_event_store_not_configured' };
  }
  const key = `stripe:${eventId}`;
  if (await store.get(key)) return { ok: true, duplicate: true, key, store };
  await store.put(key, 'processing', { expirationTtl: 60 * 60 * 24 * 7 });
  return { ok: true, duplicate: false, key, store };
}

/**
 * Integration helpers resolve to `{ ok, skipped? }` and only reject on hard throws.
 * Soft `{ ok:false }` failures must still trigger a Stripe retry when nothing was delivered.
 * All-skipped (nothing configured) stays non-retry so undeployed channels do not loop forever.
 */
export function shouldRetryPaymentNotifications(settledResults) {
  const values = settledResults.map(result =>
    result.status === 'fulfilled' ? result.value : { ok: false, error: true }
  );
  if (values.some(value => value?.ok === true)) {
    return false;
  }
  return values.some(value => value && value.ok !== true && !value.skipped);
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
  }

  const webhookSecret = getEnvValue(env, 'STRIPE_WEBHOOK_SECRET');
  const rawBody = await request.text();
  const signature = request.headers.get('Stripe-Signature') || '';

  if (!hasUsableValue(webhookSecret)) {
    return jsonResponse({ success: false, message: 'Webhook is not configured' }, 503);
  }
  const signatureValid = await verifyStripeSignature(rawBody, signature, webhookSecret);
  if (!signatureValid) {
    return jsonResponse({ success: false, message: 'Invalid signature' }, 400);
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
  }

  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
    return jsonResponse({ success: true, ignored: true }, 200);
  }

  // Online payments paused until salon opens — acknowledge webhook, do not book/notify.
  if (!paymentsOnlineEnabled(env)) {
    return jsonResponse({ success: true, ignored: true, reason: 'payments_online_disabled' }, 200);
  }

  const session = event.data?.object || {};
  if (session.payment_status !== 'paid') {
    return jsonResponse({ success: true, ignored: true, reason: 'payment_not_paid' }, 200);
  }
  const meta = session.metadata || {};
  if (meta.payment_kind !== 'booking_deposit') {
    return jsonResponse({ success: true, ignored: true, reason: 'unsupported_payment_kind' }, 200);
  }

  const reservation = await reservePaymentEvent(env, cleanText(event.id || session.id, 160));
  if (!reservation.ok) {
    return jsonResponse({ success: false, message: reservation.reason }, 503);
  }
  if (reservation.duplicate) {
    return jsonResponse({ success: true, duplicate: true }, 200);
  }
  const summary = [
    `Stripe Checkout bezahlt`,
    `Session: ${cleanText(session.id, 120)}`,
    `Betrag: ${session.amount_total != null ? (session.amount_total / 100).toFixed(2) : '?'} ${(session.currency || 'eur').toUpperCase()}`,
    `Name: ${cleanText(meta.name, 120)}`,
    `E-Mail: ${cleanText(meta.email || session.customer_email, 180)}`,
    `Telefon: ${cleanText(meta.phone, 60)}`,
    `Leistung: ${cleanText(meta.service, 160)}`,
    `Datum: ${cleanText(meta.date, 32)} ${cleanText(meta.time, 32)}`,
    meta.message ? `Hinweis: ${cleanText(meta.message, 400)}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const sideEffects = await Promise.allSettled([
    sendResendEmail(env, {
      to:
        getEnvValue(env, 'BOOKING_RECIPIENT_EMAIL') ||
        getEnvValue(env, 'SALON_EMAIL') ||
        'info@hundesalon-nika.com',
      subject: 'Online-Anzahlung bezahlt — HUNDESALON NIKA',
      text: summary,
      from: getEnvValue(env, 'RESEND_FROM', DEFAULT_FROM),
    }),
    sendTeamsMessage(env, { title: 'Stripe: Anzahlung bezahlt', text: summary }),
    appendGoogleSheetRow(env, {
      spreadsheetId: getEnvValue(env, 'SHEET_ID'),
      sheetName: 'payments',
      values: [
        new Date().toISOString(),
        session.id || '',
        session.payment_status || '',
        session.amount_total || '',
        session.currency || '',
        meta.lang || '',
        meta.name || '',
        meta.email || session.customer_email || '',
        meta.phone || '',
        meta.service || '',
        meta.date || '',
        meta.time || '',
      ],
    }),
  ]);

  if (shouldRetryPaymentNotifications(sideEffects)) {
    await reservation.store.delete?.(reservation.key);
    return jsonResponse({ success: false, message: 'Payment notifications failed' }, 502);
  }
  await reservation.store.put(reservation.key, 'completed', { expirationTtl: 60 * 60 * 24 * 7 });

  return jsonResponse({ success: true }, 200);
}
