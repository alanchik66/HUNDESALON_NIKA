import test from 'node:test';
import assert from 'node:assert/strict';

import { answerTelegramCallbackQuery, sendSendPulseAutomationEvent, sendTelegramMessage } from './platform-integrations.js';

test('Telegram notification skips when site notifications are disabled', async () => {
  const result = await sendTelegramMessage(
    { TELEGRAM_BOT_TOKEN: 'unit-test-token', TELEGRAM_CHAT_ID: '-100123' },
    { text: 'test' }
  );

  assert.equal(result.ok, false);
  assert.equal(result.skipped, true);
});

test('Telegram notification posts plain text without logging credentials', async () => {
  const originalFetch = globalThis.fetch;
  let request = null;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const result = await sendTelegramMessage(
      {
        SITE_NOTIFICATIONS_ENABLED: 'true',
        TELEGRAM_BOT_TOKEN: 'unit-test-token',
        TELEGRAM_CHAT_ID: '-100123',
      },
      { text: '<b>New request</b>' }
    );

    assert.equal(result.ok, true);
    assert.match(request.url, /api\.telegram\.org\/bot/);
    assert.equal(JSON.parse(request.options.body).text, 'New request');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Telegram client reply uses the client chat without an internal topic', async () => {
  const originalFetch = globalThis.fetch;
  let request = null;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify({ ok: true, result: { message_id: 2 } }), { status: 200 });
  };

  try {
    const result = await sendTelegramMessage(
      {
        SITE_NOTIFICATIONS_ENABLED: 'true',
        TELEGRAM_BOT_TOKEN: 'unit-test-token',
        TELEGRAM_CHAT_ID: '-100123',
        TELEGRAM_TOPIC_MESSAGES_ID: '4294967298',
      },
      {
        chatId: '777000',
        text: 'Ответ клиенту',
        replyMarkup: { keyboard: [[{ text: 'Онлайн-запись' }]] },
      }
    );

    assert.equal(result.ok, true);
    const payload = JSON.parse(request.options.body);
    assert.equal(payload.chat_id, '777000');
    assert.equal(Object.hasOwn(payload, 'message_thread_id'), false);
    assert.deepEqual(payload.reply_markup.keyboard[0][0].text, 'Онлайн-запись');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Telegram callback acknowledgement works without exposing the bot token', async () => {
  const originalFetch = globalThis.fetch;
  let request = null;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify({ ok: true, result: true }), { status: 200 });
  };

  try {
    const result = await answerTelegramCallbackQuery(
      { TELEGRAM_BOT_TOKEN: 'unit-test-token' },
      { callbackQueryId: 'callback-123', text: 'Support request received.' }
    );

    assert.equal(result.ok, true);
    assert.match(request.url, /api\.telegram\.org\/bot/);
    const payload = JSON.parse(request.options.body);
    assert.equal(payload.callback_query_id, 'callback-123');
    assert.equal(payload.text, 'Support request received.');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Automation 360 event skips cleanly when the event resource name is absent', async () => {
  const result = await sendSendPulseAutomationEvent(
    { SENDPULSE_API_KEY: 'unit-test-token' },
    { eventType: 'booking', data: { email: 'client@example.com' } }
  );

  assert.equal(result.ok, false);
  assert.equal(result.skipped, true);
  assert.match(result.reason, /SENDPULSE_BOOKING_EVENT_NAME/);
});

test('Automation 360 event posts normalized top-level contact data', async () => {
  const originalFetch = globalThis.fetch;
  const originalInfo = console.info;
  let request = null;

  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify({ result: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  console.info = () => {};

  try {
    const result = await sendSendPulseAutomationEvent(
      {
        SENDPULSE_API_KEY: 'unit-test-token',
        SENDPULSE_BOOKING_EVENT_NAME: 'website_booking',
      },
      {
        eventType: 'booking',
        data: {
          email: ' Client@Example.COM ',
          phone: '+49 341 000000',
          message: 'x'.repeat(300),
          'invalid-key': 'drop me',
        },
      }
    );

    assert.equal(result.ok, true);
    assert.equal(request.url, 'https://events.sendpulse.com/events/name/website_booking');
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.headers.Authorization, 'Bearer unit-test-token');

    const payload = JSON.parse(request.options.body);
    assert.equal(payload.email, 'client@example.com');
    assert.equal(payload.phone, '+49 341 000000');
    assert.equal(payload.message.length, 255);
    assert.equal(Object.hasOwn(payload, 'invalid-key'), false);
  } finally {
    globalThis.fetch = originalFetch;
    console.info = originalInfo;
  }
});

test('Automation 360 event rejects unsafe resource names before any network call', async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error('fetch must not be called');
  };
  console.error = () => {};

  try {
    const result = await sendSendPulseAutomationEvent(
      {
        SENDPULSE_API_KEY: 'unit-test-token',
        SENDPULSE_CONTACT_EVENT_NAME: '../wrong-host',
      },
      { eventType: 'contact', data: { email: 'client@example.com' } }
    );

    assert.equal(result.ok, false);
    assert.equal(result.skipped, true);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});

test('Automation 360 event requires email or phone', async () => {
  const result = await sendSendPulseAutomationEvent(
    {
      SENDPULSE_API_KEY: 'unit-test-token',
      SENDPULSE_NEWSLETTER_EVENT_NAME: 'website_newsletter',
    },
    { eventType: 'newsletter', data: { language: 'de' } }
  );

  assert.equal(result.ok, false);
  assert.equal(result.skipped, true);
  assert.match(result.reason, /requires email or phone/);
});

test('Automation 360 event retries a temporary rate limit without logging credentials', async () => {
  const originalFetch = globalThis.fetch;
  const originalInfo = console.info;
  const originalError = console.error;
  const logLines = [];
  let calls = 0;

  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify(calls === 1 ? { error: 'rate limited' } : { result: true }), {
      status: calls === 1 ? 429 : 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  console.info = (...args) => logLines.push(args.join(' '));
  console.error = (...args) => logLines.push(args.join(' '));

  try {
    const result = await sendSendPulseAutomationEvent(
      {
        SENDPULSE_API_KEY: 'unit-test-secret-token',
        SENDPULSE_BOOKING_EVENT_NAME: 'website_booking',
      },
      { eventType: 'booking', data: { email: 'client@example.com' } }
    );

    assert.equal(result.ok, true);
    assert.equal(calls, 2);
    assert.doesNotMatch(logLines.join('\n'), /unit-test-secret-token/);
  } finally {
    globalThis.fetch = originalFetch;
    console.info = originalInfo;
    console.error = originalError;
  }
});

test('Automation 360 event does not retry a permanent client error', async () => {
  const originalFetch = globalThis.fetch;
  const originalInfo = console.info;
  let calls = 0;

  globalThis.fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ error: 'invalid payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  };
  console.info = () => {};

  try {
    const result = await sendSendPulseAutomationEvent(
      {
        SENDPULSE_API_KEY: 'unit-test-token',
        SENDPULSE_CONTACT_EVENT_NAME: 'website_contact',
      },
      { eventType: 'contact', data: { phone: '+49 151 72450988' } }
    );

    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    console.info = originalInfo;
  }
});
