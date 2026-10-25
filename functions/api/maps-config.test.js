import assert from 'node:assert/strict';
import test from 'node:test';

import { onRequestGet } from './maps-config.js';

test('maps config exposes the restricted browser key only when configured', async () => {
  const response = onRequestGet({ env: { GOOGLE_MAPS_BROWSER_KEY: 'restricted-test-key' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  assert.deepEqual(await response.json(), {
    enabled: true,
    apiKey: 'restricted-test-key',
  });
});

test('maps config disables Google Maps cleanly when the key is absent', async () => {
  const response = onRequestGet({ env: {} });
  assert.deepEqual(await response.json(), { enabled: false });
});
