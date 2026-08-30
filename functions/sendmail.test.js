import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from './sendmail.js';

globalThis.caches = {
  default: { match: async () => null, put: async () => {} },
};

const origin = 'https://hundesalon-nika.com';

function registrationRequest(consents = {}) {
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
