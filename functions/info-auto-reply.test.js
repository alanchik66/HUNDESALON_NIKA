import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequestPost } from './info-auto-reply.js';

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
