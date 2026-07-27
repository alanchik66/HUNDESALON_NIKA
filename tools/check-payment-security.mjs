import assert from 'node:assert/strict';
import { onRequest as payment } from '../functions/payment.js';
import { onRequest as paymentWebhook } from '../functions/payment-webhook.js';
import { onRequest as sendmail } from '../functions/sendmail.js';

const origin = 'https://hundesalon-nika.com';

globalThis.caches = {
  default: { match: async () => null, put: async () => {} },
};

const paymentResponse = await payment({
  request: new Request(`${origin}/payment`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test User', email: 'test@example.com' }),
  }),
  env: { PAYMENTS_ONLINE_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_test_should_not_be_used' },
});
const paymentJson = await paymentResponse.json();
assert.equal(paymentResponse.status, 200);
assert.equal(paymentJson.onlineEnabled, false);

const webhookResponse = await paymentWebhook({
  request: new Request(`${origin}/payment-webhook`, { method: 'POST', body: '{}' }),
  env: { PAYMENTS_ONLINE_ENABLED: 'true', STRIPE_WEBHOOK_SECRET: 'whsec_should_not_be_used' },
});
assert.equal(webhookResponse.status, 400);

const sendmailResponse = await sendmail({
  request: new Request(`${origin}/sendmail`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Test User',
      email: 'test@example.com',
      message: 'test',
      payment_choice: 'online',
      payment_now: 'on',
      stripe_session_id: 'cs_test_should_not_be_used',
    }),
  }),
  env: { PAYMENTS_ONLINE_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_test_should_not_be_used' },
});
assert.equal(sendmailResponse.status, 400);

console.log('Payment security checks passed: online payments are hard-disabled and Stripe is not invoked.');
