import { enforceRateLimit, jsonResponse, timingSafeEqualStrings } from './_lib/http-security.js';
import { getPaymentOrder } from './_lib/payment-orders.js';
import { hashPaymentStatusToken, PAYMENT_ORDER_ID_RE, PAYMENT_STATUS_TOKEN_RE } from './_lib/payment-config.js';

function respond(payload, status = 200) {
  const response = jsonResponse(payload, status);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

/** Order capability permits status only; customer details and Stripe secrets are never returned. */
export async function onRequest({ request, env }) {
  if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET' } });
  const limited = await enforceRateLimit(request, { route: 'payment-status', limit: 90, windowSec: 60 });
  if (limited) return limited;
  const params = new URL(request.url).searchParams;
  const id = params.get('order') || '';
  const token = params.get('token') || '';
  if (!PAYMENT_ORDER_ID_RE.test(id) || !PAYMENT_STATUS_TOKEN_RE.test(token))
    return respond({ success: false, message: 'Payment status is unavailable' }, 403);
  try {
    const order = await getPaymentOrder(env, id);
    if (!order || !(await timingSafeEqualStrings(order.tokenHash, await hashPaymentStatusToken(token))))
      return respond({ success: false, message: 'Payment status is unavailable' }, 403);
    const expired =
      order.paymentStatus === 'pending' &&
      (Date.parse(order.expiresAt) <= Date.now() ||
        (!order.sessionId && Date.parse(order.expiresAt) - Date.now() < 30 * 60 * 1000));
    const paymentStatus = expired ? 'expired' : order.paymentStatus;
    const bookingStatus =
      order.bookingStatus === 'confirmed'
        ? 'confirmed'
        : order.paymentStatus === 'paid' && order.fulfillmentStatus === 'completed'
          ? 'requested'
          : 'pending';
    return respond({
      success: true,
      paymentStatus,
      bookingStatus,
      amountCents: order.amount,
      currency: order.currency,
      ...(paymentStatus === 'pending' && order.url ? { checkoutUrl: order.url } : {}),
      ...(paymentStatus === 'pending' && !order.url ? { retryable: true } : {}),
    });
  } catch {
    console.error(JSON.stringify({ event: 'payment_status_unavailable' }));
    return respond({ success: false, message: 'Payment status is temporarily unavailable' }, 503);
  }
}
