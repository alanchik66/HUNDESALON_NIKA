/** Stripe events fulfil durable orders independently of the customer's browser. */
import { isRequestBodyTooLarge, jsonResponse, readTextBody, timingSafeEqualStrings } from './_lib/http-security.js';
import { getEnvValue, hasUsableValue } from './_lib/platform-integrations.js';
import { paymentConfiguration, PAYMENT_ORDER_ID_RE } from './_lib/payment-config.js';
import {
  reservePaymentFulfillment,
  completePaymentFulfillment,
  releasePaymentFulfillment,
} from './_lib/payment-orders.js';
import { fulfillPaidBookingOrder } from './sendmail.js';

const MAX_WEBHOOK_BODY_BYTES = 512 * 1024;
const COMPLETED_EVENTS = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded']);

async function hmacSha256Hex(secret, payload) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function verifyStripeSignature(rawBody, header, secret) {
  if (!header || !secret) return false;
  let timestamp = '';
  const signatures = [];
  for (const part of header.split(',')) {
    const [key, ...rest] = part.split('=');
    const value = rest.join('=').trim();
    if (key.trim() === 't') timestamp = value;
    if (key.trim() === 'v1' && /^[0-9a-f]{64}$/i.test(value)) signatures.push(value);
  }
  if (!/^\d{10}$/.test(timestamp) || !signatures.length || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300)
    return false;
  const expected = await hmacSha256Hex(secret, timestamp + '.' + rawBody);
  return (await Promise.all(signatures.map(signature => timingSafeEqualStrings(signature, expected)))).some(Boolean);
}

export async function onRequest(ctx) {
  const { request, env } = ctx;
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
  let rawBody;
  try {
    rawBody = await readTextBody(request, MAX_WEBHOOK_BODY_BYTES);
  } catch (error) {
    return jsonResponse(
      { success: false, message: isRequestBodyTooLarge(error) ? 'Payload too large' : 'Invalid request body' },
      isRequestBodyTooLarge(error) ? 413 : 400
    );
  }
  const secret = getEnvValue(env, 'STRIPE_WEBHOOK_SECRET');
  if (!hasUsableValue(secret)) return jsonResponse({ success: false, message: 'Webhook is not configured' }, 503);
  if (!(await verifyStripeSignature(rawBody, request.headers.get('Stripe-Signature') || '', secret)))
    return jsonResponse({ success: false, message: 'Invalid signature' }, 400);
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ success: false, message: 'Invalid JSON' }, 400);
  }
  if (!COMPLETED_EVENTS.has(event?.type)) return jsonResponse({ success: true, ignored: true }, 200);
  const config = paymentConfiguration(env);
  if (event.livemode !== (config.mode === 'live'))
    return jsonResponse({ success: false, message: 'Payment mode mismatch' }, 400);
  const session = event.data?.object;
  if (
    !session ||
    session.object !== 'checkout.session' ||
    session.mode !== 'payment' ||
    session.livemode !== event.livemode
  )
    return jsonResponse({ success: false, message: 'Invalid Checkout Session' }, 400);
  if (session.payment_status !== 'paid')
    return jsonResponse({ success: true, ignored: true, reason: 'payment_not_paid' }, 200);
  const orderId = session.metadata?.order_id;
  if (session.metadata?.payment_kind !== 'booking_deposit' || !PAYMENT_ORDER_ID_RE.test(orderId || ''))
    return jsonResponse({ success: true, ignored: true, reason: 'unsupported_payment_kind' }, 200);
  let claim;
  try {
    claim = await reservePaymentFulfillment(env, {
      orderId,
      sessionId: session.id,
      eventId: String(event.id || '').slice(0, 200),
      amount: session.amount_total,
      currency: session.currency,
      mode: config.mode,
    });
    if (!claim.ok)
      return jsonResponse(
        { success: false, message: claim.busy ? 'Payment processing is in progress' : 'Payment could not be matched' },
        claim.busy || claim.reason === 'payment_store_unavailable' ? 503 : 400
      );
    if (claim.duplicate) return jsonResponse({ success: true, duplicate: true }, 200);
    // Pausing new Checkout creation must never discard an already paid order.
    const fulfilled = await fulfillPaidBookingOrder(ctx, claim.order);
    if (!fulfilled.ok) {
      await releasePaymentFulfillment(env, { orderId, claimToken: claim.claimToken });
      return jsonResponse({ success: false, message: 'Booking delivery is pending. Please retry.' }, 503);
    }
    const completed = await completePaymentFulfillment(env, { orderId, claimToken: claim.claimToken });
    if (!completed.ok)
      return jsonResponse({ success: false, message: 'Payment completion is pending. Please retry.' }, 503);
    return jsonResponse({ success: true }, 200);
  } catch {
    if (claim?.claimToken) await releasePaymentFulfillment(env, { orderId, claimToken: claim.claimToken });
    console.error(JSON.stringify({ event: 'payment_fulfillment_unavailable' }));
    return jsonResponse({ success: false, message: 'Booking delivery is temporarily unavailable' }, 503);
  }
}
