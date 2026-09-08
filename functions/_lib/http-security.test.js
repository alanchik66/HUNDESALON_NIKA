import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyCorsResponseHeaders,
  getPublicReadCorsOrigin,
  isAllowedOrigin,
  isLocalDevOrigin,
  isRequestBodyTooLarge,
  jsonResponse,
  readFormDataBody,
  readJsonBody,
  timingSafeEqualStrings,
} from './http-security.js';

test('allows exact same-origin requests', () => {
  assert.equal(isAllowedOrigin('https://hundesalon-nika.com', 'https://hundesalon-nika.com/sendmail'), true);
});

test('allows local development cross-port requests on the same exact host', () => {
  assert.equal(isAllowedOrigin('http://[::1]:5502', 'http://[::1]:8788/sendmail'), true);
  assert.equal(isAllowedOrigin('http://127.0.0.1:5502', 'http://127.0.0.1:8788/sendmail'), true);
  assert.equal(isAllowedOrigin('http://127.1.2.3:5502', 'http://127.1.2.3:8788/sendmail'), true);
  assert.equal(isAllowedOrigin('http://10.2.3.4:5502', 'http://10.2.3.4:8788/sendmail'), true);
  assert.equal(isAllowedOrigin('http://172.20.10.5:5502', 'http://172.20.10.5:8788/sendmail'), true);
  assert.equal(isAllowedOrigin('http://192.168.1.25:5502', 'http://192.168.1.25:8788/sendmail'), true);
});

test('rejects attacker-controlled localhost lookalikes', () => {
  assert.equal(isLocalDevOrigin('http://localhost.attacker.tld:5502'), false);
  assert.equal(isLocalDevOrigin('http://sub.localhost:5502'), false);
  assert.equal(isLocalDevOrigin('http://local-host.com:5502'), false);
  assert.equal(isAllowedOrigin('http://localhost.attacker.tld:5502', 'https://hundesalon-nika.com/sendmail'), false);
  assert.equal(isAllowedOrigin('http://sub.localhost:5502', 'http://localhost:8788/sendmail'), false);
});

test('rejects protocol mismatches', () => {
  assert.equal(isAllowedOrigin('http://hundesalon-nika.com', 'https://hundesalon-nika.com/sendmail'), false);
});

test('rejects non-local cross-port origins for production hosts', () => {
  assert.equal(isAllowedOrigin('https://hundesalon-nika.com:444', 'https://hundesalon-nika.com/sendmail'), false);
});

test('allows public weather reads from local development without opening POST endpoints', () => {
  const localRead = new Request('https://hundesalon-nika.com/api/weather', {
    headers: { Origin: 'http://127.0.0.1:5503' },
  });
  const localPost = new Request('https://hundesalon-nika.com/api/weather', {
    method: 'POST',
    headers: { Origin: 'http://127.0.0.1:5503' },
  });
  const attackerRead = new Request('https://hundesalon-nika.com/api/weather', {
    headers: { Origin: 'https://localhost.attacker.example' },
  });

  assert.equal(getPublicReadCorsOrigin(localRead), 'http://127.0.0.1:5503');
  assert.equal(getPublicReadCorsOrigin(localPost), '');
  assert.equal(getPublicReadCorsOrigin(attackerRead), '');
});

test('adds local CORS without replacing cache policy or existing Vary values', () => {
  const response = applyCorsResponseHeaders(
    new Response('ok', {
      headers: {
        'Cache-Control': 'private, max-age=60',
        Vary: 'Accept-Language',
      },
    }),
    'http://127.0.0.1:5503'
  );

  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://127.0.0.1:5503');
  assert.equal(response.headers.get('Cache-Control'), 'private, max-age=60');
  assert.equal(response.headers.get('Vary'), 'Accept-Language, Origin');
});

test('preserves customer-facing text that is not a stack trace', async () => {
  const response = jsonResponse({ message: 'Please pay at the salon (cash or card).' });
  assert.deepEqual(await response.json(), { message: 'Please pay at the salon (cash or card).' });
});

test('compares secrets after normalizing them to fixed-size digests', async () => {
  assert.equal(await timingSafeEqualStrings('same-secret', 'same-secret'), true);
  assert.equal(await timingSafeEqualStrings('same-secret', 'different-secret'), false);
  assert.equal(await timingSafeEqualStrings('short', 'a-much-longer-secret'), false);
});

test('parses JSON only within the configured byte limit', async () => {
  const request = new Request('https://hundesalon-nika.com/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  });
  assert.deepEqual(await readJsonBody(request, 32), { ok: true });

  const oversized = new Request('https://hundesalon-nika.com/test', {
    method: 'POST',
    body: '123456789',
  });
  await assert.rejects(() => readJsonBody(oversized, 8), isRequestBodyTooLarge);
});

test('parses form data only within the configured byte limit', async () => {
  const form = new FormData();
  form.set('email', 'test@example.com');
  const request = new Request('https://hundesalon-nika.com/test', { method: 'POST', body: form });
  const parsed = await readFormDataBody(request, 1024);
  assert.equal(parsed.get('email'), 'test@example.com');
});
