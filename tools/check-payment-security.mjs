import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { onRequest as payment } from '../functions/payment.js';
import { onRequest as paymentWebhook } from '../functions/payment-webhook.js';
import { onRequest as sendmail } from '../functions/sendmail.js';

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
  const timestamp = Math.floor(Date.now() / 1000);
  const unpaidEvent = JSON.stringify({
    id: 'evt_test_unpaid',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_unpaid', payment_status: 'unpaid', metadata: { payment_kind: 'booking_deposit' } } },
  });
  const validSignature = createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${unpaidEvent}`)
    .digest('hex');
  const unpaidResponse = await paymentWebhook({
    request: new Request(`${origin}/payment-webhook`, {
      method: 'POST',
      headers: { 'Stripe-Signature': `t=${timestamp},v1=invalid,v1=${validSignature}` },
      body: unpaidEvent,
    }),
    env: { PAYMENTS_ONLINE_ENABLED: 'true', STRIPE_WEBHOOK_SECRET: webhookSecret },
  });
  assert.equal(unpaidResponse.status, 200);
  assert.equal((await unpaidResponse.json()).reason, 'payment_not_paid');

  // In-flight "processing" must not be ACKed as a successful duplicate — Stripe can stop
  // retrying while the first attempt still fails and deletes the KV key.
  const processingStore = new Map([['stripe:evt_test_in_progress', 'processing']]);
  const processingEvents = {
    get: async key => processingStore.get(key) || null,
    put: async (key, value) => {
      processingStore.set(key, value);
    },
    delete: async key => {
      processingStore.delete(key);
    },
  };
  const inProgressEvent = JSON.stringify({
    id: 'evt_test_in_progress',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_in_progress',
        payment_status: 'paid',
        amount_total: 2000,
        currency: 'eur',
        metadata: { payment_kind: 'booking_deposit' },
      },
    },
  });
  const inProgressSignature = createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${inProgressEvent}`)
    .digest('hex');
  const inProgressResponse = await paymentWebhook({
    request: new Request(`${origin}/payment-webhook`, {
      method: 'POST',
      headers: { 'Stripe-Signature': `t=${timestamp},v1=${inProgressSignature}` },
      body: inProgressEvent,
    }),
    env: {
      PAYMENTS_ONLINE_ENABLED: 'true',
      STRIPE_WEBHOOK_SECRET: webhookSecret,
      PAYMENT_EVENTS: processingEvents,
    },
  });
  assert.equal(inProgressResponse.status, 503);
  assert.equal(processingStore.get('stripe:evt_test_in_progress'), 'processing');

  // Completed events remain true duplicates (idempotent success).
  processingStore.set('stripe:evt_test_completed', 'completed');
  const completedEvent = JSON.stringify({
    id: 'evt_test_completed',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_completed',
        payment_status: 'paid',
        amount_total: 2000,
        currency: 'eur',
        metadata: { payment_kind: 'booking_deposit' },
      },
    },
  });
  const completedSignature = createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${completedEvent}`)
    .digest('hex');
  const completedResponse = await paymentWebhook({
    request: new Request(`${origin}/payment-webhook`, {
      method: 'POST',
      headers: { 'Stripe-Signature': `t=${timestamp},v1=${completedSignature}` },
      body: completedEvent,
    }),
    env: {
      PAYMENTS_ONLINE_ENABLED: 'true',
      STRIPE_WEBHOOK_SECRET: webhookSecret,
      PAYMENT_EVENTS: processingEvents,
    },
  });
  assert.equal(completedResponse.status, 200);
  assert.equal((await completedResponse.json()).duplicate, true);

  // Sub-minimum / euro-mistyped deposit env must not desync Checkout vs verify.
  checkoutBody = '';
  const lowDepositPayment = await payment({
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
      }),
    }),
    env: {
      PAYMENTS_ONLINE_ENABLED: 'true',
      STRIPE_SECRET_KEY: 'sk_test_placeholder',
      STRIPE_DEPOSIT_AMOUNT_CENTS: '20',
    },
  });
  const lowDepositJson = await lowDepositPayment.json();
  assert.equal(lowDepositJson.amountCents, 2000);
  assert.match(checkoutBody, /line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=2000/);

  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes('/v1/checkout/sessions') && options.method === 'POST') {
      checkoutBody = String(options.body);
      return Response.json({ id: 'cs_test_secure', url: 'https://checkout.stripe.com/test' });
    }
    if (String(url).includes('/v1/checkout/sessions/')) {
      return Response.json({
        id: 'cs_test_paid_ok',
        payment_status: 'paid',
        currency: 'eur',
        amount_total: 2000,
        customer_email: 'test@example.com',
        metadata: {
          payment_kind: 'booking_deposit',
          email: 'test@example.com',
          service: 'Test grooming',
          date: '2026-08-01',
          time: '10:00',
        },
      });
    }
    if (String(url).includes('api.resend.com/emails')) {
      return Response.json({ id: 're_test' }, { status: 200 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const alignedVerify = await sendmail({
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
        stripe_session_id: 'cs_test_paid_ok',
        message: 'Deposit alignment check',
      }),
    }),
    env: {
      PAYMENTS_ONLINE_ENABLED: 'true',
      STRIPE_SECRET_KEY: 'sk_test_placeholder',
      STRIPE_DEPOSIT_AMOUNT_CENTS: '20',
      RESEND_API_KEY: 're_test_key',
    },
  });
  assert.equal(alignedVerify.status, 200);
  assert.equal((await alignedVerify.json()).success, true);

  // Restore unpaid session stub for the forged-session rejection check below.
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

  console.log('Payment trust-boundary checks passed.');
} finally {
  globalThis.fetch = originalFetch;
  globalThis.caches = originalCaches;
}
