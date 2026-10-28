import assert from 'node:assert/strict';
import { onRequest as payment } from '../functions/payment.js';
import { onRequest as paymentWebhook } from '../functions/payment-webhook.js';
import { onRequest as sendmail } from '../functions/sendmail.js';
import { onRequest as paymentStatus } from '../functions/payment-status.js';

const origin = 'https://hundesalon-nika.com';
globalThis.caches = { default: { match: async () => null, put: async () => {} } };
let stripeRequests = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  stripeRequests += 1;
  throw new Error('Unconfigured payments must not invoke a provider');
};
try {
  const config = await payment({ request: new Request(origin + '/payment'), env: {} });
  const configJson = await config.json();
  assert.equal(config.status, 200);
  assert.equal(configJson.onlineEnabled, false);
  assert.equal(Object.hasOwn(configJson, 'key'), false);

  const response = await payment({
    request: new Request(origin + '/payment', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: '{}',
    }),
    env: {
      PAYMENTS_ONLINE_ENABLED: 'true',
      STRIPE_SECRET_KEY: 'sk_test_should_not_be_used',
      STRIPE_WEBHOOK_SECRET: 'whsec_fixture',
      CHAT_DB: { prepare() {} },
    },
  });
  assert.equal((await response.json()).onlineEnabled, false);
  assert.equal(
    (await payment({ request: new Request(origin + '/payment', { method: 'POST', body: '{}' }), env: {} })).status,
    403
  );

  assert.equal(
    (
      await paymentWebhook({
        request: new Request(origin + '/payment-webhook', { method: 'POST', body: '{}' }),
        env: { STRIPE_WEBHOOK_SECRET: 'whsec_fixture' },
      })
    ).status,
    400
  );

  assert.equal(
    (await paymentStatus({ request: new Request(origin + '/payment-status?order=guess&token=guess'), env: {} })).status,
    403
  );

  const replay = await sendmail({
    request: new Request(origin + '/sendmail', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        payment_choice: 'online',
        stripe_session_id: 'cs_test_replay',
      }),
    }),
    env: {},
  });
  assert.equal(replay.status, 400);
  assert.equal(stripeRequests, 0);
} finally {
  globalThis.fetch = originalFetch;
}
console.log(
  'Payment security checks passed: fail-closed configuration, test/live separation, signed webhooks and protected status.'
);
