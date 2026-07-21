/**
 * Stripe Checkout for HUNDESALON NIKA booking deposits.
 * Env:
 *   PAYMENTS_ONLINE_ENABLED=true  — required to accept online deposits (default: off)
 *   STRIPE_SECRET_KEY             — Stripe secret (sk_test / sk_live)
 *   STRIPE_DEPOSIT_AMOUNT_CENTS   — default 2000 (€20)
 *   SITE_ORIGIN                   — default https://hundesalon-nika.com
 *
 * POST JSON → { success, url, sessionId } or error status
 * GET ?session_id= → verify paid session + metadata
 */
import { assertAllowedOrigin, jsonResponse } from './_lib/http-security.js';
import { cleanText, getEnvValue, hasUsableValue, resolveStripeDepositCents } from './_lib/platform-integrations.js';

const DEFAULT_DEPOSIT_CENTS = 2000;
const DEFAULT_ORIGIN = 'https://hundesalon-nika.com';

function paymentsOnlineEnabled(env) {
  const raw = String(getEnvValue(env, 'PAYMENTS_ONLINE_ENABLED') || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
}

function siteOrigin(env, requestOrigin) {
  return (
    getEnvValue(env, 'SITE_ORIGIN') ||
    getEnvValue(env, 'PUBLIC_SITE_URL') ||
    requestOrigin ||
    DEFAULT_ORIGIN
  ).replace(/\/$/, '');
}

function depositCents(env) {
  return resolveStripeDepositCents(env, DEFAULT_DEPOSIT_CENTS);
}

async function stripeForm(secretKey, path, params) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object') {
          for (const [k, v] of Object.entries(item)) {
            body.append(`${key}[${index}][${k}]`, String(v));
          }
        } else {
          body.append(`${key}[${index}]`, String(item));
        }
      });
      continue;
    }
    if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        body.append(`${key}[${k}]`, String(v));
      }
      continue;
    }
    body.append(key, String(value));
  }

  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function stripeGet(secretKey, path) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

function stripeKey(env) {
  return (
    getEnvValue(env, 'STRIPE_SECRET_KEY') ||
    getEnvValue(env, 'PAYMENT_PROVIDER_KEY') ||
    ''
  );
}

export async function onRequest(context) {
  const { request, env } = context;
  const originCheck = assertAllowedOrigin(request);
  if (!originCheck.ok) {
    return jsonResponse({ success: false, message: 'Forbidden' }, 403);
  }

  // Default OFF until the salon opens for business (set PAYMENTS_ONLINE_ENABLED=true to unlock).
  if (!paymentsOnlineEnabled(env)) {
    return jsonResponse(
      {
        success: false,
        status: 'disabled',
        message:
          'Online payment is not active yet. Please pay at the salon (cash or card) after your appointment is confirmed.',
        salonPayment: true,
        onlineEnabled: false,
      },
      200,
      originCheck.origin
    );
  }

  const secret = stripeKey(env);
  if (!hasUsableValue(secret)) {
    return jsonResponse(
      {
        success: false,
        status: 'not-configured',
        message:
          'Online payment is not configured yet. Pay at the salon (cash or card) or ask the salon for a payment link.',
        salonPayment: true,
      },
      200,
      originCheck.origin
    );
  }

  if (request.method === 'GET') {
    const url = new URL(request.url);
    const sessionId = cleanText(url.searchParams.get('session_id'), 200);
    if (!sessionId.startsWith('cs_')) {
      return jsonResponse({ success: false, message: 'Missing session_id' }, 400, originCheck.origin);
    }
    const result = await stripeGet(secret, `checkout/sessions/${sessionId}`);
    if (!result.ok) {
      return jsonResponse(
        { success: false, message: result.data?.error?.message || 'Stripe session lookup failed' },
        result.status || 502,
        originCheck.origin
      );
    }
    const session = result.data;
    return jsonResponse(
      {
        success: true,
        paid: session.payment_status === 'paid',
        status: session.status,
        paymentStatus: session.payment_status,
        amountTotal: session.amount_total,
        currency: session.currency,
        customerEmail: session.customer_details?.email || session.customer_email || '',
        metadata: session.metadata || {},
      },
      200,
      originCheck.origin
    );
  }

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'GET, POST' } });
  }

  const body = await request.json().catch(() => ({}));
  const lang = cleanText(body.lang || 'de', 8).slice(0, 2) || 'de';
  const name = cleanText(body.name, 120);
  const email = cleanText(body.email, 180).toLowerCase();
  const phone = cleanText(body.phone, 60);
  const service = cleanText(body.service, 160);
  const date = cleanText(body.date, 32);
  const time = cleanText(body.time, 32);
  const message = cleanText(body.message, 500);
  // Amount is a server-side policy. Never trust a client-supplied amount.
  const amount = depositCents(env);

  if (!name || !email || !service || !date || !time) {
    return jsonResponse({ success: false, message: 'Incomplete booking data' }, 400, originCheck.origin);
  }

  const origin = siteOrigin(env, originCheck.origin);
  const successUrl = `${origin}/${lang}/onlayn-bronirovanie?payment=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/${lang}/onlayn-bronirovanie?payment=cancelled`;

  const productName =
    lang === 'de'
      ? 'Termin-Anzahlung HUNDESALON NIKA'
      : lang === 'ru'
        ? 'Предоплата записи HUNDESALON NIKA'
        : lang === 'uk'
          ? 'Передоплата запису HUNDESALON NIKA'
          : 'Booking deposit HUNDESALON NIKA';

  const description = `${service} · ${date} ${time} · ${name}`;

  // Checkout Sessions use payment_method_types (not PaymentIntent automatic_payment_methods).
  // Extra EU methods are added when the Stripe account has them activated.
  const methodTypes = ['card', 'link', 'klarna', 'paypal', 'sepa_debit', 'amazon_pay'];
  const params = {
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: email,
    client_reference_id: `${date}_${time}_${email}`.slice(0, 200),
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': String(amount),
    'line_items[0][price_data][product_data][name]': productName,
    'line_items[0][price_data][product_data][description]': description.slice(0, 500),
    'metadata[lang]': lang,
    'metadata[name]': name,
    'metadata[email]': email,
    'metadata[phone]': phone,
    'metadata[service]': service,
    'metadata[date]': date,
    'metadata[time]': time,
    'metadata[message]': message.slice(0, 400),
    'metadata[payment_kind]': 'booking_deposit',
    'payment_intent_data[metadata][service]': service,
    'payment_intent_data[metadata][date]': date,
    'payment_intent_data[metadata][time]': time,
    locale: lang === 'uk' ? 'en' : lang,
  };
  methodTypes.forEach((type, index) => {
    params[`payment_method_types[${index}]`] = type;
  });

  let created = await stripeForm(secret, 'checkout/sessions', params);
  // Fallback to card (+ Link) if some methods are not enabled on the account yet
  if (!created.ok && /payment_method_types|invalid|not activated|cannot be used/i.test(created.data?.error?.message || '')) {
    const fallback = { ...params };
    Object.keys(fallback).forEach(key => {
      if (key.startsWith('payment_method_types[')) delete fallback[key];
    });
    fallback['payment_method_types[0]'] = 'card';
    fallback['payment_method_types[1]'] = 'link';
    created = await stripeForm(secret, 'checkout/sessions', fallback);
  }
  if (!created.ok && /payment_method_types|invalid|not activated|cannot be used/i.test(created.data?.error?.message || '')) {
    const cardOnly = { ...params };
    Object.keys(cardOnly).forEach(key => {
      if (key.startsWith('payment_method_types[')) delete cardOnly[key];
    });
    cardOnly['payment_method_types[0]'] = 'card';
    created = await stripeForm(secret, 'checkout/sessions', cardOnly);
  }

  if (!created.ok || !created.data?.url) {
    return jsonResponse(
      {
        success: false,
        status: 'stripe-error',
        message: created.data?.error?.message || 'Could not create Stripe Checkout session',
      },
      created.status >= 400 ? created.status : 502,
      originCheck.origin
    );
  }

  return jsonResponse(
    {
      success: true,
      url: created.data.url,
      sessionId: created.data.id,
      amountCents: amount,
      currency: 'eur',
      depositLabel: `${(amount / 100).toFixed(2)} EUR`,
    },
    200,
    originCheck.origin
  );
}
