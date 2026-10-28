/**
 * Durable booking-deposit Checkout. Only the signed webhook fulfils the order.
 * Test keys require both STRIPE_MODE=test and PAYMENTS_ENVIRONMENT=test.
 */
import {
  assertAllowedOrigin,
  enforceRateLimit,
  isRequestBodyTooLarge,
  jsonResponse,
  readJsonBody,
  timingSafeEqualStrings,
} from './_lib/http-security.js';
import { attachCheckoutSession, createPaymentOrder, getPaymentOrder } from './_lib/payment-orders.js';
import {
  createPaymentStatusToken,
  hashPaymentStatusToken,
  paymentConfiguration,
  paymentSiteOrigin,
  PAYMENT_ORDER_ID_RE,
  PAYMENT_STATUS_TOKEN_RE,
} from './_lib/payment-config.js';
import { preparePaymentBooking } from './sendmail.js';
import { berlinLocalToUtc } from './_lib/booking-calendar.js';
import { getEnvValue, getGoogleCalendarBusyIntervals } from './_lib/platform-integrations.js';

const MAX_REQUEST_BODY_BYTES = 64 * 1024;
const DEPOSIT_NAMES = Object.freeze({
  de: 'Termin-Anzahlung HUNDESALON_NIKA',
  en: 'Booking deposit HUNDESALON_NIKA',
  ru: 'Предоплата записи HUNDESALON_NIKA',
  uk: 'Передоплата запису HUNDESALON_NIKA',
});

function respond(payload, status = 200, origin) {
  const response = jsonResponse(payload, status, origin);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

async function requestFingerprint(fields) {
  const entries = Object.entries(fields)
    .filter(
      ([key]) => !['request_id', 'statusToken', 'resume', 'cf-turnstile-response', 'turnstileToken'].includes(key)
    )
    .sort(([left], [right]) => left.localeCompare(right));
  return hashPaymentStatusToken(JSON.stringify(entries));
}

function checkoutResult(order, token) {
  return {
    success: true,
    url: order.url,
    orderId: order.id,
    statusToken: token,
    amountCents: order.amount,
    currency: order.currency,
  };
}

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const config = paymentConfiguration(env);
  if (request.method === 'GET') {
    return respond({
      success: true,
      onlineEnabled: config.enabled,
      amountCents: config.amount,
      currency: config.currency,
      depositLabel: (config.amount / 100).toFixed(2) + ' EUR',
    });
  }
  if (request.method !== 'POST')
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, POST' } });
  const originCheck = assertAllowedOrigin(request);
  if (!originCheck.ok) return respond({ success: false, message: 'Forbidden' }, 403);
  const origin = originCheck.origin;
  if (!config.enabled)
    return respond(
      {
        success: false,
        status: 'disabled',
        onlineEnabled: false,
        salonPayment: true,
        message: 'Online payment is currently unavailable. Please choose payment at the salon.',
      },
      200,
      origin
    );
  const limited = await enforceRateLimit(request, { route: 'payment', limit: 6, windowSec: 60 });
  if (limited) return limited;
  let fields;
  try {
    fields = await readJsonBody(request, MAX_REQUEST_BODY_BYTES);
  } catch (error) {
    return respond(
      { success: false, message: isRequestBodyTooLarge(error) ? 'Payload too large' : 'Invalid request body' },
      isRequestBodyTooLarge(error) ? 413 : 400,
      origin
    );
  }
  if (
    !fields ||
    typeof fields !== 'object' ||
    Array.isArray(fields) ||
    Object.values(fields).some(value => value !== null && !['string', 'number', 'boolean'].includes(typeof value))
  )
    return respond({ success: false, message: 'Invalid booking' }, 400, origin);
  fields = { ...fields, form_type: 'booking', payment_choice: 'online' };
  const id = fields.request_id || crypto.randomUUID();
  const token = fields.statusToken || createPaymentStatusToken();
  if (!PAYMENT_ORDER_ID_RE.test(id) || !PAYMENT_STATUS_TOKEN_RE.test(token))
    return respond({ success: false, message: 'Invalid payment request' }, 400, origin);
  const tokenHash = await hashPaymentStatusToken(token);
  const fingerprint = await requestFingerprint(fields);
  let order;
  try {
    order = await getPaymentOrder(env, id);
    if (order) {
      if (
        !(await timingSafeEqualStrings(order.tokenHash, tokenHash)) ||
        (fields.resume !== true && order.booking._payment_request_hash !== fingerprint) ||
        order.mode !== config.mode
      )
        return respond({ success: false, message: 'Payment request could not be resumed' }, 409, origin);
      if (order.paymentStatus === 'paid')
        return respond(
          {
            success: false,
            status: 'already_paid',
            orderId: id,
            statusToken: token,
            message: 'This deposit has already been paid. Check the booking status.',
          },
          409,
          origin
        );
      if (
        Date.parse(order.expiresAt) <= Date.now() ||
        (!order.sessionId && Date.parse(order.expiresAt) - Date.now() < 30 * 60 * 1000)
      )
        return respond(
          { success: false, status: 'expired', message: 'This payment link has expired. Start a new booking request.' },
          409,
          origin
        );
      if (order.sessionId && order.url) return respond(checkoutResult(order, token), 200, origin);
    } else {
      if (fields.resume === true)
        return respond({ success: false, message: 'Payment request could not be resumed' }, 403, origin);
      const prepared = await preparePaymentBooking({
        request: new Request(request.url, {
          method: 'POST',
          headers: { ...Object.fromEntries(request.headers), 'Content-Type': 'application/json' },
          body: JSON.stringify(fields),
        }),
        env,
      });
      if (prepared instanceof Response) return prepared;
      if (!prepared?.ok) return respond({ success: false, message: 'Invalid booking' }, 400, origin);
      const booking = { ...prepared.booking, _payment_request_hash: fingerprint };
      const timeMin = berlinLocalToUtc(booking.date + 'T' + booking.time + ':00');
      if (!timeMin || Date.parse(timeMin) <= Date.now())
        return respond({ success: false, message: 'Invalid booking time' }, 400, origin);
      const timeMax = new Date(Date.parse(timeMin) + Number(booking.booking_safe_block_minutes) * 60000).toISOString();
      const availability = await getGoogleCalendarBusyIntervals(env, {
        calendarId: getEnvValue(env, 'GOOGLE_CALENDAR_ID', 'primary'),
        timeMin,
        timeMax,
      });
      if (!availability.ok || !availability.configured)
        return respond(
          { success: false, message: 'Appointment availability could not be checked. Please try again later.' },
          503,
          origin
        );
      if (
        availability.busyIntervals.some(
          interval => Date.parse(interval.start) < Date.parse(timeMax) && Date.parse(interval.end) > Date.parse(timeMin)
        )
      )
        return respond(
          { success: false, message: 'The selected appointment time is no longer available.' },
          409,
          origin
        );
      const stored = await createPaymentOrder(env, {
        id,
        tokenHash,
        booking,
        amount: config.amount,
        currency: config.currency,
        mode: config.mode,
        createdAt: Date.now(),
        expiresAt: Date.now() + 35 * 60 * 1000,
      });
      if (!stored.ok)
        return respond(
          { success: false, message: 'Payment request could not be saved. Please try again.' },
          stored.reason === 'order_already_exists' ? 409 : 503,
          origin
        );
      order = stored.order;
    }
    const site = paymentSiteOrigin(env);
    const lang = ['de', 'en', 'ru', 'uk'].includes(order.booking.lang) ? order.booking.lang : 'de';
    const returnUrl = new URL('/' + lang + '/onlayn-bronirovanie', site);
    returnUrl.searchParams.set('order', order.id);
    returnUrl.searchParams.set('token', token);
    returnUrl.searchParams.set('payment', 'success');
    const cancelUrl = new URL(returnUrl);
    cancelUrl.searchParams.set('payment', 'cancelled');
    const params = new URLSearchParams({
      mode: 'payment',
      'payment_method_types[0]': 'card',
      'payment_method_types[1]': 'link',
      success_url: returnUrl.toString(),
      cancel_url: cancelUrl.toString(),
      customer_email: order.booking.email,
      client_reference_id: order.id,
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': order.currency,
      'line_items[0][price_data][unit_amount]': String(order.amount),
      'line_items[0][price_data][product_data][name]': DEPOSIT_NAMES[lang],
      'metadata[order_id]': order.id,
      'metadata[payment_kind]': 'booking_deposit',
      'payment_intent_data[metadata][order_id]': order.id,
      'payment_intent_data[metadata][payment_kind]': 'booking_deposit',
      expires_at: String(Math.floor(Date.parse(order.expiresAt) / 1000)),
      locale: lang === 'uk' ? 'en' : lang,
    });
    let response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + config.key,
          'Stripe-Version': '2026-06-24.dahlia',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Idempotency-Key': 'booking-deposit-' + order.id,
        },
        body: params,
        signal: controller.signal,
      });
    } catch {
      return respond(
        { success: false, message: 'Payment service is temporarily unavailable. Retry the same request.' },
        503,
        origin
      );
    } finally {
      clearTimeout(timeout);
    }
    const session = await response.json().catch(() => null);
    if (
      !response.ok ||
      !session?.id ||
      !session.url ||
      session.livemode !== (config.mode === 'live') ||
      session.amount_total !== order.amount ||
      session.currency !== order.currency
    )
      return respond({ success: false, message: 'Payment could not be started. Please try again.' }, 502, origin);
    const attached = await attachCheckoutSession(env, order.id, { sessionId: session.id, url: session.url });
    if (!attached.ok)
      return respond({ success: false, message: 'Payment is being prepared. Retry the same request.' }, 503, origin);
    return respond(checkoutResult(attached.order, token), 200, origin);
  } catch {
    console.error(JSON.stringify({ event: 'payment_checkout_unavailable' }));
    return respond(
      { success: false, message: 'Payment service is temporarily unavailable. Please try again.' },
      503,
      origin
    );
  }
}
