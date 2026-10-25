import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestPost } from './info-auto-reply.js';

test('stops an authenticated relay body without Content-Length before draining the stream', async () => {
  const relaySecret = 'bounded-relay-test-fixture';
  let cancelled = false;
  let remainderRead = false;
  const body = new ReadableStream(
    {
      start(controller) {
        controller.enqueue(new Uint8Array(8 * 1024 + 1));
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
  const request = new Request('https://hundesalon-nika.com/info-auto-reply', {
    method: 'POST',
    headers: { Authorization: `Bearer ${relaySecret}`, 'Content-Type': 'application/json' },
    body,
    duplex: 'half',
  });
  assert.equal(request.headers.has('Content-Length'), false);
  const response = await onRequestPost({ request, env: { INFO_AUTOREPLY_SECRET: relaySecret } });
  assert.equal(response.status, 413);
  assert.equal(cancelled, true);
  assert.equal(remainderRead, false);
});

test('automatic information mail sends from info and routes replies to info', async () => {
  const originalFetch = globalThis.fetch;
  let sendPulsePayload;

  globalThis.fetch = async (_url, options) => {
    sendPulsePayload = JSON.parse(options.body);
    return Response.json({ result: true, id: 'info-auto-reply-test' });
  };

  try {
    const request = new Request('https://hundesalon-nika.com/info-auto-reply', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer relay-test-secret',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: 'customer@example.com', lang: 'en' }),
    });
    const response = await onRequestPost({
      request,
      env: {
        INFO_AUTOREPLY_SECRET: 'relay-test-secret',
        SENDPULSE_API_KEY: 'sendpulse-test-token',
      },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.replyTo, 'info@hundesalon-nika.com');
    assert.equal(sendPulsePayload.email.from.email, 'info@hundesalon-nika.com');
    assert.equal(sendPulsePayload.email.reply_to.email, 'info@hundesalon-nika.com');
    assert.match(sendPulsePayload.email.text, /info@hundesalon-nika\.com/);
    assert.doesNotMatch(sendPulsePayload.email.text, /do not reply/i);
    assert.doesNotMatch(sendPulsePayload.email.text, /support@hundesalon-nika\.com/);
    assert.doesNotMatch(
      Buffer.from(sendPulsePayload.email.html, 'base64').toString('utf8'),
      /support@hundesalon-nika\.com/
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
