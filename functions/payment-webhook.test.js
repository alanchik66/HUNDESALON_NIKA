import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from './payment-webhook.js';

test('rejects an oversized Stripe webhook before signature processing', async () => {
  const request = new Request('https://hundesalon-nika.com/payment-webhook', {
    method: 'POST',
    body: 'x'.repeat(512 * 1024 + 1),
    headers: { 'Content-Type': 'application/json' },
  });

  const response = await onRequest({ request, env: {} });

  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: 'Request failed' });
});
