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

test('reports failure when confirmation succeeds but no subscription is persisted', async () => {
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
    assert.equal(response.status, 503);
    assert.equal(body.error, 'Internal server error');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('does not treat an automation event as durable subscription persistence', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    const target = String(url);
    if (target.includes('/smtp/emails')) {
      return Response.json({ error: 'rejected' }, { status: 400 });
    }
    if (target.includes('events.sendpulse.com/events/name/newsletter_event')) {
      return Response.json({ result: true });
    }
    throw new Error(`Unexpected request: ${target}`);
  };

  try {
    const response = await onRequest({
      request: request(),
      env: {
        SENDPULSE_API_KEY: 'sp_test_key',
        SENDPULSE_NEWSLETTER_EVENT_NAME: 'newsletter_event',
      },
    });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, 'Internal server error');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('reports degraded success when persistence succeeds without confirmation delivery', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.equal(String(url), 'https://gateway.example/sheets');
    return Response.json({ success: true });
  };

  try {
    const response = await onRequest({
      request: request(),
      env: { GOOGLE_SHEETS_WEBHOOK_URL: 'https://gateway.example/sheets' },
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.degraded, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('reports full success when confirmation delivery and persistence both succeed', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    const target = String(url);
    if (target.includes('/oauth/access_token')) {
      return Response.json({ access_token: 'sp_test_token', expires_in: 3600 });
    }
    if (target === 'https://gateway.example/sheets') {
      return Response.json({ result: true });
    }
    if (/api\.sendpulse\.com\/(smtp\/emails|addressbooks\/123\/emails)/.test(target)) {
      return Response.json({ result: true });
    }
    throw new Error(`Unexpected request: ${target}`);
  };

  try {
    const response = await onRequest({
      request: request(),
      env: {
        GOOGLE_SHEETS_WEBHOOK_URL: 'https://gateway.example/sheets',
        SENDPULSE_API_KEY: 'sp_test_key',
        SENDPULSE_ADDRESSBOOK_ID: '123',
      },
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.degraded, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
