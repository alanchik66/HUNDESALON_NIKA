import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from './subscribe.js';

globalThis.caches = {
  default: { match: async () => null, put: async () => {} },
};

const origin = 'https://hundesalon-nika.com';

function request() {
  return new Request(`${origin}/subscribe`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@example.com', newsletter_consent: 'yes', lang: 'en' }),
  });
}

test('reports failure when persistence and confirmation delivery are unavailable', async () => {
  const response = await onRequest({ request: request(), env: {} });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'Internal server error');
});

test('reports degraded success when confirmation delivery succeeds without sheet persistence', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    const target = String(url);
    if (target.includes('/oauth/access_token')) {
      return Response.json({ access_token: 'sp_test_token', expires_in: 3600 });
    }
    assert.match(target, /api\.sendpulse\.com\/smtp\/emails/);
    return Response.json({ result: true });
  };

  try {
    const response = await onRequest({ request: request(), env: { SENDPULSE_API_KEY: 'sp_test_key' } });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.degraded, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
