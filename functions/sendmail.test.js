import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from './sendmail.js';

globalThis.caches = {
  default: { match: async () => null, put: async () => {} },
};

const origin = 'https://hundesalon-nika.com';

function registrationRequest(consents = {}, fields = {}) {
  return new Request(`${origin}/sendmail`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      form_type: 'client_registration',
      lang: 'de',
      name: 'Test Customer',
      email: 'customer@example.com',
      phone: '+49 341 000000',
      service: 'Komplettpflege',
      pet_name: 'Nika',
      pet_species: 'dog',
      pet_breed: 'Pudel',
      privacy_consent: consents.privacy,
      agb_consent: consents.agb,
      ...fields,
    }),
  });
}

function reviewRequest(fields = {}) {
  return new Request(`${origin}/sendmail`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      form_type: 'feedback',
      lang: 'ru',
      name: 'Test Reviewer',
      email: 'reviewer@example.com',
      message: 'Очень спокойный и аккуратный сервис.',
      inquiry_type: 'public_review',
      review_rating: 5,
      review_channel: 'website',
      source: '/ru/reyting',
      ...fields,
    }),
  });
}

test('rejects false-like consent values without running integrations', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error('Integrations must not run for rejected consent.');
  };

  try {
    const response = await onRequest({
      request: registrationRequest({ privacy: 'false', agb: 'no' }),
      env: {},
    });
    assert.equal(response.status, 400);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

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
        request: new Request(`${origin}/sendmail`, {
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
  test(`accepts a valid ${encoding} registration form`, async () => {
    const fields = await registrationRequest({ privacy: 'yes', agb: 'yes' }).json();
    const body = encoding === 'multipart' ? new FormData() : new URLSearchParams();
    for (const [name, value] of Object.entries(fields)) body.append(name, value);
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async (_url, options) => {
      calls += 1;
      const payload = JSON.parse(options.body);
      assert.equal(payload.action, 'sheets');
      assert.equal(payload.sheetName, 'clients');
      return Response.json({ success: true });
    };

    try {
      const response = await onRequest({
        request: new Request(`${origin}/sendmail`, { method: 'POST', headers: { Origin: origin }, body }),
        env: {
          GOOGLE_APPS_SCRIPT_WEBHOOK_URL: 'https://gateway.example/test',
          GOOGLE_GATEWAY_SECRET: 'unit-test-secret',
        },
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
      assert.equal((await response.json()).success, true);
      assert.equal(calls, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}

for (const scenario of [
  { name: 'calendar success cannot replace required client persistence', succeeds: 'calendar', status: 503 },
  { name: 'booking row success cannot replace required client persistence', succeeds: 'bookings', status: 503 },
  { name: 'successful required client persistence is accepted', succeeds: 'clients', status: 200 },
  {
    name: 'existing registration does not require another client row',
    succeeds: 'calendar',
    status: 200,
    id: 'existing',
  },
]) {
  test(`booking fallback: ${scenario.name}`, async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), 'https://gateway.example/test');
      const payload = JSON.parse(options.body);
      const operation = payload.action === 'sheets' ? payload.sheetName : payload.action;
      calls.push(operation);
      return Response.json({ success: operation === scenario.succeeds });
    };

    try {
      const response = await onRequest({
        request: registrationRequest(
          { privacy: 'yes', agb: 'yes' },
          {
            form_type: 'booking',
            date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
            time: '10:00',
            client_registration_id: scenario.id || '',
          }
        ),
        env: {
          GOOGLE_APPS_SCRIPT_WEBHOOK_URL: 'https://gateway.example/test',
          GOOGLE_GATEWAY_SECRET: 'unit-test-secret',
        },
      });
      assert.equal(response.status, scenario.status);
      assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
      const body = await response.json();
      if (scenario.status === 200) assert.equal(body.success, true);
      else assert.equal(body.error, 'Internal server error');
      assert.deepEqual(calls, scenario.id ? ['calendar', 'bookings'] : ['calendar', 'bookings', 'clients']);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}

test('accepts explicit consent and persists the registration', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    assert.equal(payload.action, 'sheets');
    assert.equal(payload.sheetName, 'clients');
    return Response.json({ success: true, updatedRange: 'clients' });
  };

  try {
    const response = await onRequest({
      request: registrationRequest({ privacy: 'on', agb: 'yes' }),
      env: {
        GOOGLE_APPS_SCRIPT_WEBHOOK_URL: 'https://script.google.com/macros/s/test/exec',
        GOOGLE_GATEWAY_SECRET: 'unit-test-secret',
      },
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.match(body.registration_id, /^[0-9a-f-]{36}$/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('accepts review feedback with rating metadata', async () => {
  const originalFetch = globalThis.fetch;
  const payloads = [];
  globalThis.fetch = async (_url, options) => {
    if (options?.body) {
      payloads.push(JSON.parse(options.body));
    }
    return Response.json({ success: true, result: true });
  };

  try {
    const response = await onRequest({
      request: reviewRequest(),
      env: {
        SENDPULSE_API_KEY: 'unit-test-key',
        SENDPULSE_CONTACT_EVENT_NAME: 'contact-review-test',
      },
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.ok(payloads.some(payload => JSON.stringify(payload).includes('5/5')));
    assert.ok(payloads.some(payload => payload.inquiry_type === 'public_review'));
    assert.ok(payloads.some(payload => payload.review_rating === '5'));
    assert.ok(payloads.some(payload => payload.review_channel === 'website'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
