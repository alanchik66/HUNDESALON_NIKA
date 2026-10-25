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

for (const body of ['null', '[]', '"text"', '42', 'true', '{']) {
  test(`rejects invalid JSON body ${body} with CORS and no integrations`, async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      throw new Error('Integrations must not run for invalid request bodies.');
    };

    try {
      const response = await onRequest({
        request: new Request(`${origin}/subscribe`, {
          method: 'POST',
          headers: { Origin: origin, 'Content-Type': 'application/json' },
          body,
        }),
        env: {},
      });
      assert.equal(response.status, 400);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
      assert.equal((await response.json()).error, 'Request failed');
      assert.equal(calls, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}

for (const encoding of ['urlencoded', 'multipart']) {
  test(`accepts a valid ${encoding} subscription form`, async () => {
    const body = encoding === 'multipart' ? new FormData() : new URLSearchParams();
    body.append('email', 'customer@example.com');
    body.append('newsletter_consent', 'yes');
    body.append('lang', 'en');
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async url => {
      calls += 1;
      assert.equal(String(url), 'https://gateway.example/sheets');
      return Response.json({ success: true });
    };

    try {
      const response = await onRequest({
        request: new Request(`${origin}/subscribe`, { method: 'POST', headers: { Origin: origin }, body }),
        env: { GOOGLE_SHEETS_WEBHOOK_URL: 'https://gateway.example/sheets' },
      });
      const result = await response.json();
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
      assert.equal(result.success, true);
      assert.equal(result.degraded, true);
      assert.equal(calls, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
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
  let emailPayload;
  globalThis.fetch = async (url, options) => {
    const target = String(url);
    if (target.includes('/oauth/access_token')) {
      return Response.json({ access_token: 'sp_test_token', expires_in: 3600 });
    }
    if (target === 'https://gateway.example/sheets') {
      return Response.json({ result: true });
    }
    if (/api\.sendpulse\.com\/(smtp\/emails|addressbooks\/123\/emails)/.test(target)) {
      if (target.includes('/smtp/emails')) emailPayload = JSON.parse(options.body);
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
    assert.equal(emailPayload.email.from.email, 'info@hundesalon-nika.com');
    assert.equal(emailPayload.email.reply_to.email, 'info@hundesalon-nika.com');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
