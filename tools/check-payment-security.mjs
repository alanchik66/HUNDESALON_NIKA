import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { onRequest as payment } from '../functions/payment.js';
import { onRequest as paymentWebhook, shouldRetryPaymentNotifications } from '../functions/payment-webhook.js';
import { onRequest as sendmail } from '../functions/sendmail.js';

function signStripeBody(secret, body, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return { timestamp, header: `t=${timestamp},v1=${signature}` };
}

function memoryKv() {
  const kv = new Map();
  return {
    store: {
      get: async key => kv.get(key) || null,
      put: async (key, value) => {
        kv.set(key, value);
      },
      delete: async key => {
        kv.delete(key);
      },
    },
    kv,
  };
}

const origin = 'https://hundesalon-nika.com';
const originalFetch = globalThis.fetch;
const originalCaches = globalThis.caches;

try {
  globalThis.caches = {
    default: {
      match: async () => null,
      put: async () => {},
    },
  };
  let checkoutBody = '';
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('/v1/checkout/sessions') && options.method === 'POST') {
      checkoutBody = String(options.body);
      return Response.json({ id: 'cs_test_secure', url: 'https://checkout.stripe.com/test' });
    }
    if (String(url).includes('/v1/checkout/sessions/')) {
      return Response.json({
        id: 'cs_test_forged',
        payment_status: 'unpaid',
        currency: 'eur',
        amount_total: 2000,
        metadata: {},
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const paymentResponse = await payment({
    request: new Request(`${origin}/payment`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lang: 'de',
        name: 'Test User',
        email: 'test@example.com',
        service: 'Test grooming',
        date: '2026-08-01',
        time: '10:00',
        amountCents: 500,
      }),
    }),
    env: {
      PAYMENTS_ONLINE_ENABLED: 'true',
      STRIPE_SECRET_KEY: 'sk_test_placeholder',
      STRIPE_DEPOSIT_AMOUNT_CENTS: '2000',
    },
  });
  const paymentJson = await paymentResponse.json();
  assert.equal(paymentJson.amountCents, 2000);
  assert.match(checkoutBody, /line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=2000/);

  const missingSecret = await paymentWebhook({
    request: new Request(`${origin}/payment-webhook`, { method: 'POST', body: '{}' }),
    env: {},
  });
  assert.equal(missingSecret.status, 503);

  const webhookSecret = 'whsec_test_placeholder';
  const unpaidEvent = JSON.stringify({
    id: 'evt_test_unpaid',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_unpaid', payment_status: 'unpaid', metadata: { payment_kind: 'booking_deposit' } } },
  });
  const unpaidSig = signStripeBody(webhookSecret, unpaidEvent);
  const unpaidResponse = await paymentWebhook({
    request: new Request(`${origin}/payment-webhook`, {
      method: 'POST',
      headers: { 'Stripe-Signature': `t=${unpaidSig.timestamp},v1=invalid,${unpaidSig.header.replace(/^t=\d+,/, '')}` },
      body: unpaidEvent,
    }),
    env: { PAYMENTS_ONLINE_ENABLED: 'true', STRIPE_WEBHOOK_SECRET: webhookSecret },
  });
  assert.equal(unpaidResponse.status, 200);
  assert.equal((await unpaidResponse.json()).reason, 'payment_not_paid');

  const sendmailResponse = await sendmail({
    request: new Request(`${origin}/sendmail`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        form_type: 'booking',
        name: 'Test User',
        email: 'test@example.com',
        phone: '+491234567',
        service: 'Test grooming',
        date: '2026-08-01',
        time: '10:00',
        privacy_consent: 'on',
        agb_consent: 'on',
        payment_choice: 'online',
        payment_now: 'on',
        stripe_session_id: 'cs_test_forged',
      }),
    }),
    env: {
      PAYMENTS_ONLINE_ENABLED: 'true',
      STRIPE_SECRET_KEY: 'sk_test_placeholder',
      STRIPE_DEPOSIT_AMOUNT_CENTS: '2000',
    },
  });
  assert.equal(sendmailResponse.status, 400);

  assert.equal(
    shouldRetryPaymentNotifications([
      { status: 'fulfilled', value: { ok: false, status: 503 } },
      { status: 'fulfilled', value: { ok: false, skipped: true } },
    ]),
    true
  );

  // Soft Resend failure must 502 + clear reservation so Stripe retries delivery.
  const paidEvent = JSON.stringify({
    id: 'evt_test_paid_softfail',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_paid_softfail',
        payment_status: 'paid',
        amount_total: 2000,
        currency: 'eur',
        customer_email: 'client@example.com',
        metadata: {
          payment_kind: 'booking_deposit',
          name: 'Client',
          email: 'client@example.com',
          phone: '+49111',
          service: 'Wash',
          date: '2026-08-01',
          time: '10:00',
        },
      },
    },
  });
  const paidSig = signStripeBody(webhookSecret, paidEvent);
  const { store, kv } = memoryKv();
  globalThis.fetch = async url => {
    if (String(url).includes('api.resend.com')) {
      return new Response(JSON.stringify({ message: 'unavailable' }), { status: 503 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  const softFailResponse = await paymentWebhook({
    request: new Request(`${origin}/payment-webhook`, {
      method: 'POST',
      headers: { 'Stripe-Signature': paidSig.header },
      body: paidEvent,
    }),
    env: {
      PAYMENTS_ONLINE_ENABLED: 'true',
      STRIPE_WEBHOOK_SECRET: webhookSecret,
      RESEND_API_KEY: 're_test_placeholder',
      PAYMENT_EVENTS: store,
    },
  });
  assert.equal(softFailResponse.status, 502);
  assert.equal(kv.has('stripe:evt_test_paid_softfail'), false);

  const paidOkEvent = JSON.stringify({
    id: 'evt_test_paid_ok',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_paid_ok',
        payment_status: 'paid',
        amount_total: 2000,
        currency: 'eur',
        customer_email: 'client@example.com',
        metadata: {
          payment_kind: 'booking_deposit',
          name: 'Client',
          email: 'client@example.com',
          service: 'Wash',
          date: '2026-08-01',
          time: '10:00',
        },
      },
    },
  });
  const paidOkSig = signStripeBody(webhookSecret, paidOkEvent);
  const okStore = memoryKv();
  globalThis.fetch = async url => {
    if (String(url).includes('api.resend.com')) {
      return Response.json({ id: 'email_ok' });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  const okResponse = await paymentWebhook({
    request: new Request(`${origin}/payment-webhook`, {
      method: 'POST',
      headers: { 'Stripe-Signature': paidOkSig.header },
      body: paidOkEvent,
    }),
    env: {
      PAYMENTS_ONLINE_ENABLED: 'true',
      STRIPE_WEBHOOK_SECRET: webhookSecret,
      RESEND_API_KEY: 're_test_placeholder',
      PAYMENT_EVENTS: okStore.store,
    },
  });
  assert.equal(okResponse.status, 200);
  assert.equal(okStore.kv.get('stripe:evt_test_paid_ok'), 'completed');

  console.log('Payment trust-boundary checks passed.');
} finally {
  globalThis.fetch = originalFetch;
  globalThis.caches = originalCaches;
}
