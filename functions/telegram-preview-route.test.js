import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from './telegram-webhook.js';

const requestId = '12345678-1234-4123-8123-123456789abc';
const callbackId = 'retired-preview-callback';

function request(secret = 'telegram') {
  return new Request('https://hundesalon-nika.com/telegram-webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': secret,
    },
    body: JSON.stringify({
      callback_query: {
        id: callbackId,
        data: `preview_booking:${requestId}`,
        from: { id: 12345 },
        message: { message_id: 1, chat: { id: 12345, type: 'private' } },
      },
    }),
  });
}

test('rejects an unauthenticated retired preview callback without contacting any provider', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => assert.fail('Unauthenticated callbacks must have no network side effects');
  try {
    const response = await onRequest({ request: request('wrong'), env: { TELEGRAM_WEBHOOK_SECRET: 'telegram' } });
    assert.equal(response.status, 401);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

for (const mode of ['live', 'test']) {
  test(`acknowledges retired preview callbacks without forwarding or confirming in ${mode} mode`, async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push(String(url));
      assert.equal(String(url), 'https://api.telegram.org/botfixture-token/answerCallbackQuery');
      assert.equal(JSON.parse(options.body).callback_query_id, callbackId);
      return Response.json({ ok: true, result: true });
    };
    try {
      const response = await onRequest({
        request: request(),
        env: {
          PAYMENTS_ENVIRONMENT: mode,
          TELEGRAM_WEBHOOK_SECRET: 'telegram',
          TELEGRAM_PREVIEW_ROUTE_SECRET: 'retired-route-secret',
          TELEGRAM_BOT_TOKEN: 'fixture-token',
          TELEGRAM_CHAT_ID: '12345',
          CHAT_DB: { prepare: () => assert.fail('Retired callbacks must not access booking data') },
        },
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { ok: true, skipped: true });
      assert.equal(calls.length, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}
