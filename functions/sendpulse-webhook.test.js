import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from './sendpulse-webhook.js';

const secret = 'sendpulse-webhook-test-fixture';
const env = { SENDPULSE_WEBHOOK_SECRET: secret };
globalThis.caches = { default: { match: async () => null, put: async () => {} } };

function webhookRequest(body, extra = {}) {
  return new Request('https://hundesalon-nika.com/sendpulse-webhook', {
    method: 'POST',
    headers: { 'X-SendPulse-Webhook-Secret': secret, 'Content-Type': 'application/json' },
    body,
    ...extra,
  });
}

test('acknowledges an authenticated SendPulse delivery event', async () => {
  const response = await onRequest({
    request: webhookRequest(JSON.stringify({ event: 'delivered', id: 'fixture' })),
    env,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, accepted: true });
});

test('rejects an unauthenticated SendPulse event before reading its body', async () => {
  const request = webhookRequest('{"event":"delivered"}');
  request.headers.delete('X-SendPulse-Webhook-Secret');
  const response = await onRequest({ request, env });
  assert.equal(response.status, 401);
  assert.equal(request.bodyUsed, false);
});

test('stops a SendPulse body without Content-Length as soon as the byte limit is exceeded', async () => {
  let cancelled = false;
  let remainderRead = false;
  const body = new ReadableStream(
    {
      start(controller) {
        controller.enqueue(new Uint8Array(512 * 1024 + 1));
      },
      pull(controller) {
        remainderRead = true;
        controller.close();
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 }
  );
  const request = webhookRequest(body, { duplex: 'half' });
  assert.equal(request.headers.has('Content-Length'), false);
  const response = await onRequest({ request, env });
  assert.equal(response.status, 413);
  assert.equal(cancelled, true);
  assert.equal(remainderRead, false);
});

test('returns a client error for unreadable and malformed SendPulse bodies', async () => {
  const malformed = await onRequest({ request: webhookRequest('{'), env });
  assert.equal(malformed.status, 400);

  const body = new ReadableStream({
    start(controller) {
      controller.error(new Error('fixture read failure'));
    },
  });
  const unreadable = await onRequest({ request: webhookRequest(body, { duplex: 'half' }), env });
  assert.equal(unreadable.status, 400);
});
