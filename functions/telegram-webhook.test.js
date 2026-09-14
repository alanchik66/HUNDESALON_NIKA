import test from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from './telegram-webhook.js';

function telegramUpdate(text = '/start', languageCode = '') {
  return {
    message: {
      message_id: 1,
      chat: { id: 12345, type: 'private' },
      from: { id: 12345, first_name: 'Test', ...(languageCode ? { language_code: languageCode } : {}) },
      text,
    },
  };
}

function telegramCallback(data = 'support', languageCode = 'de') {
  return {
    callback_query: {
      id: 'callback-123',
      data,
      from: { id: 12345, first_name: 'Test', language_code: languageCode },
      message: {
        message_id: 2,
        chat: { id: 12345, type: 'private' },
        text: 'Willkommen bei HUNDESALON_NIKA.',
      },
    },
  };
}

function bookingConfirmationCallback(requestId, { senderId = 12345, chatId = -100123 } = {}) {
  return {
    callback_query: {
      id: 'booking-callback-123',
      data: `booking_confirm:${requestId}`,
      from: { id: senderId, first_name: 'Admin', language_code: 'ru' },
      message: {
        message_id: 50,
        message_thread_id: 9,
        chat: { id: chatId, type: 'supergroup' },
        text: 'Новая заявка на запись',
      },
    },
  };
}

function websiteChatAdminReply(
  text = 'Добрый день, я подключаюсь к диалогу.',
  { messageId = 72, threadId = 42, repliedMessageId = 71, repliedText = '💬 Сообщение из AI-чата сайта' } = {}
) {
  return {
    message: {
      message_id: messageId,
      message_thread_id: threadId,
      chat: { id: -100123, type: 'supergroup' },
      from: { id: 555, first_name: 'Admin' },
      text,
      ...(repliedMessageId
        ? { reply_to_message: { message_id: repliedMessageId, text: repliedText } }
        : {}),
    },
  };
}

function websiteChatDatabase({ conversationMode = 'ai', hasDelivery = true, sessionAvailable = hasDelivery } = {}) {
  const sqlCalls = [];
  const boundCalls = [];
  return {
    sqlCalls,
    boundCalls,
    prepare(sql) {
      sqlCalls.push(sql);
      return {
        bind(...values) {
          boundCalls.push({ sql, values });
          return this;
        },
        async first() {
          if (sql.includes('FROM chat_telegram_topics')) {
            return { message_thread_id: 197 };
          }
          if (sql.includes('SELECT 1 AS found FROM chat_telegram_deliveries')) {
            return hasDelivery ? { found: 1 } : null;
          }
          if (sql.includes('FROM chat_telegram_deliveries')) {
            if (!sessionAvailable) return null;
            return {
              session_id: '12345678-1234-4234-8234-123456789012',
              customer_id: '00000000-0000-4000-8000-000000000001',
              source_message_id: '87654321-4321-4234-8234-123456789012',
              conversation_mode: conversationMode,
              first_name: 'Test',
              last_name: 'Customer',
              email: 'test@example.com',
              phone: '',
              locale: 'ru',
            };
          }
          if (sql.includes('SELECT body FROM chat_messages')) {
            return { body: 'Сколько стоит комплексный уход за пуделем?' };
          }
          return null;
        },
        async run() {
          if (sql.includes('UPDATE chat_sessions SET conversation_mode')) {
            return { meta: { changes: conversationMode === 'human' ? 0 : 1 } };
          }
          return { meta: { changes: 1 } };
        },
      };
    },
  };
}

test('first administrator reply pauses AI and creates a continuation card in the personal topic', async () => {
  const originalFetch = globalThis.fetch;
  const telegramPayloads = [];
  let emailPayload = null;
  const database = websiteChatDatabase();
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('/smtp/emails')) {
      emailPayload = JSON.parse(options.body);
      return Response.json({ result: true });
    }
    assert.match(String(url), /api\.telegram\.org/);
    telegramPayloads.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ ok: true, result: { message_id: 73, chat: { id: -100123 } } }), {
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const response = await onRequest({
      request: new Request('https://hundesalon-nika.com/telegram-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'test-webhook-secret',
        },
        body: JSON.stringify(websiteChatAdminReply()),
      }),
      env: {
        CHAT_DB: database,
        SITE_NOTIFICATIONS_ENABLED: 'true',
        SENDPULSE_API_KEY: 'unit-test-token',
        TELEGRAM_BOT_TOKEN: 'test-token',
        TELEGRAM_CHAT_ID: '-100123',
        TELEGRAM_TOPIC_MESSAGES_ID: '42',
        TELEGRAM_TOPIC_PERSONAL_ID: '197',
        TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
      },
    });
    const payload = await response.json();

    assert.equal(payload.relayed, true);
    assert.equal(payload.mode, 'human');
    assert.equal(payload.movedToPersonal, true);
    assert.equal(telegramPayloads.length, 1);
    assert.equal(telegramPayloads[0].message_thread_id, 197);
    assert.match(telegramPayloads[0].text, /Диалог принят сотрудником/);
    assert.match(telegramPayloads[0].text, /AI-ассистент приостановлен/);
    assert.ok(emailPayload);
    const emailHtml = Buffer.from(emailPayload.email.html, 'base64').toString('utf8');
    assert.match(emailHtml, /assets\/images\/brand\/logo\.png/);
    assert.match(emailHtml, /Добрый день, я подключаюсь к диалогу\./);
    assert.match(emailHtml, /<html lang="ru"/);
    assert.ok(database.sqlCalls.some(sql => sql.includes("SET conversation_mode = ?")));
    assert.ok(database.boundCalls.some(
      call => call.sql.includes('INSERT OR REPLACE INTO chat_telegram_deliveries') && call.values[1] === 72
    ));
    assert.ok(database.boundCalls.some(
      call => call.sql.includes('INSERT OR IGNORE INTO chat_learning_examples') &&
        call.values[2] === 'Сколько стоит комплексный уход за пуделем?'
    ));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('administrator replies from the personal topic are delivered to the existing website chat', async () => {
  const database = websiteChatDatabase({ conversationMode: 'human' });
  const response = await onRequest({
    request: new Request('https://hundesalon-nika.com/telegram-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': 'test-webhook-secret',
      },
      body: JSON.stringify(websiteChatAdminReply('Ваш ответ из личной ветки.', {
        messageId: 74,
        threadId: 197,
        repliedMessageId: 73,
      })),
    }),
    env: {
      CHAT_DB: database,
      SITE_NOTIFICATIONS_ENABLED: 'true',
      TELEGRAM_CHAT_ID: '-100123',
      TELEGRAM_TOPIC_PERSONAL_ID: '197',
      TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
    },
  });
  const payload = await response.json();

  assert.equal(payload.relayed, true);
  assert.equal(payload.destination, 'website_chat');
  assert.equal(payload.mode, 'human');
  assert.equal(payload.movedToPersonal, false);
  assert.ok(database.boundCalls.some(
    call => call.sql.includes('INSERT OR REPLACE INTO chat_telegram_deliveries') && call.values[1] === 74
  ));
});

test('a plain administrator message in the personal topic is delivered to the latest website chat', async () => {
  const database = websiteChatDatabase({ conversationMode: 'human' });
  const response = await onRequest({
    request: new Request('https://hundesalon-nika.com/telegram-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': 'test-webhook-secret',
      },
      body: JSON.stringify(websiteChatAdminReply('Ответ без специальной функции Telegram.', {
        messageId: 75,
        threadId: 197,
        repliedMessageId: null,
      })),
    }),
    env: {
      CHAT_DB: database,
      SITE_NOTIFICATIONS_ENABLED: 'true',
      TELEGRAM_CHAT_ID: '-100123',
      TELEGRAM_TOPIC_PERSONAL_ID: '77',
      TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
    },
  });
  const payload = await response.json();

  assert.equal(payload.relayed, true);
  assert.equal(payload.destination, 'website_chat');
  assert.equal(payload.mode, 'human');
  assert.ok(database.boundCalls.some(
    call => call.sql.includes('d.message_thread_id = ?') && call.values[1] === 197
  ));
  assert.ok(database.boundCalls.some(
    call => call.sql.includes('INSERT OR REPLACE INTO chat_telegram_deliveries') && call.values[1] === 75 && call.values[2] === 197
  ));
});

test('the personal website topic never falls back to a Telegram client direct message', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return Response.json({ ok: true });
  };

  try {
    const database = websiteChatDatabase({ conversationMode: 'human', hasDelivery: false });
    const response = await onRequest({
      request: new Request('https://hundesalon-nika.com/telegram-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'test-webhook-secret',
        },
        body: JSON.stringify(websiteChatAdminReply('Не отправлять в Telegram клиента.', {
          messageId: 76,
          threadId: 197,
          repliedMessageId: 70,
          repliedText: 'Клиент Telegram ID: 12345',
        })),
      }),
      env: {
        CHAT_DB: database,
        SITE_NOTIFICATIONS_ENABLED: 'true',
        TELEGRAM_CHAT_ID: '-100123',
        TELEGRAM_TOPIC_PERSONAL_ID: '197',
        TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
      },
    });
    const payload = await response.json();

    assert.equal(payload.skipped, true);
    assert.equal(payload.destination, 'website_chat');
    assert.equal(payload.reason, 'website_session_not_found');
    assert.equal(requests.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a reply to a known website card never falls back to a Telegram direct message', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return Response.json({ ok: true });
  };

  try {
    const database = websiteChatDatabase({ hasDelivery: true, sessionAvailable: false });
    const response = await onRequest({
      request: new Request('https://hundesalon-nika.com/telegram-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'test-webhook-secret',
        },
        body: JSON.stringify(websiteChatAdminReply('Ответ предназначен только для сайта.', {
          messageId: 77,
          threadId: 42,
          repliedMessageId: 71,
          repliedText: 'Клиент Telegram ID: 12345',
        })),
      }),
      env: {
        CHAT_DB: database,
        SITE_NOTIFICATIONS_ENABLED: 'true',
        TELEGRAM_CHAT_ID: '-100123',
        TELEGRAM_TOPIC_PERSONAL_ID: '197',
        TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
      },
    });
    const payload = await response.json();

    assert.equal(payload.skipped, true);
    assert.equal(payload.destination, 'website_chat');
    assert.equal(payload.reason, 'website_session_not_found');
    assert.equal(requests.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a failed support notification does not prevent the customer auto reply', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    if (requests.length === 1) throw new Error('support group unavailable');
    return new Response(JSON.stringify({ ok: true, result: { message_id: 2 } }), { status: 200 });
  };

  try {
    const response = await onRequest({
      request: new Request('https://hundesalon-nika.com/telegram-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'test-webhook-secret',
        },
        body: JSON.stringify(telegramUpdate('Здравствуйте', 'ru')),
      }),
      env: {
        SITE_NOTIFICATIONS_ENABLED: 'true',
        TELEGRAM_AGENT_ENABLED: 'true',
        TELEGRAM_BOT_TOKEN: 'test-token',
        TELEGRAM_CHAT_ID: '-100123',
        TELEGRAM_TOPIC_MESSAGES_ID: '2',
        TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
      },
    });

    assert.equal(response.status, 200);
    assert.equal(requests.length, 2);
    assert.equal(requests[1].chat_id, '12345');
    assert.match(requests[1].text, /Спасибо за сообщение/);
    assert.equal(requests[1].reply_markup.remove_keyboard, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('uses the client language for the initial German response', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ ok: true, result: { message_id: requests.length } }), { status: 200 });
  };

  try {
    const response = await onRequest({
      request: new Request('https://hundesalon-nika.com/telegram-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'test-webhook-secret',
        },
        body: JSON.stringify(telegramUpdate('/start', 'de')),
      }),
      env: {
        SITE_NOTIFICATIONS_ENABLED: 'true',
        TELEGRAM_AGENT_ENABLED: 'true',
        TELEGRAM_BOT_TOKEN: 'test-token',
        TELEGRAM_CHAT_ID: '-100123',
        TELEGRAM_TOPIC_MESSAGES_ID: '2',
        TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
      },
    });

    assert.equal(response.status, 200);
    assert.equal(requests.length, 4);
    assert.equal(requests[0].chat_id, '12345');
    assert.equal(requests[0].menu_button.type, 'web_app');
    assert.equal(requests[0].menu_button.text, 'NIKA Menü');
    assert.equal(requests[0].menu_button.web_app.url, 'https://hundesalon-nika.com/telegram-menu.html?lang=de');
    assert.equal(requests[1].chat_id, undefined);
    assert.equal(requests[1].menu_button.web_app.url, 'https://hundesalon-nika.com/telegram-menu.html');
    assert.match(requests[3].text, /Willkommen bei HUNDESALON_NIKA/);
    assert.equal(requests[3].reply_markup.remove_keyboard, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('recognizes the public /address command', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ ok: true, result: { message_id: requests.length } }), { status: 200 });
  };

  try {
    const response = await onRequest({
      request: new Request('https://hundesalon-nika.com/telegram-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'test-webhook-secret',
        },
        body: JSON.stringify(telegramUpdate('/address', 'ru')),
      }),
      env: {
        SITE_NOTIFICATIONS_ENABLED: 'true',
        TELEGRAM_AGENT_ENABLED: 'true',
        TELEGRAM_BOT_TOKEN: 'test-token',
        TELEGRAM_CHAT_ID: '-100123',
        TELEGRAM_TOPIC_MESSAGES_ID: '2',
        TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
      },
    });

    assert.equal(response.status, 200);
    assert.equal(requests.length, 2);
    assert.match(requests[1].text, /Мы находимся в Лейпциге/);
    assert.equal(requests[1].reply_markup.inline_keyboard[0][0].url, 'https://hundesalon-nika.com/ru/kontakty');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('localizes the branded Web App menu button and removes the legacy keyboard', async () => {
  const originalFetch = globalThis.fetch;

  try {
    for (const item of [
      {
        language: 'de',
        text: /Willkommen bei HUNDESALON_NIKA/,
        menuButton: 'NIKA Menü',
      },
      {
        language: 'en',
        text: /Welcome to HUNDESALON_NIKA/,
        menuButton: 'NIKA Menu',
      },
      {
        language: 'ru',
        text: /Добро пожаловать в HUNDESALON_NIKA/,
        menuButton: 'Меню NIKA',
      },
      {
        language: 'uk',
        text: /Ласкаво просимо до HUNDESALON_NIKA/,
        menuButton: 'Меню NIKA',
      },
    ]) {
      const requests = [];
      globalThis.fetch = async (_url, options) => {
        requests.push(JSON.parse(options.body));
        return new Response(JSON.stringify({ ok: true, result: { message_id: requests.length } }), { status: 200 });
      };

      const response = await onRequest({
        request: new Request('https://hundesalon-nika.com/telegram-webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Bot-Api-Secret-Token': 'test-webhook-secret',
          },
          body: JSON.stringify(telegramUpdate('/start', item.language)),
        }),
        env: {
          SITE_NOTIFICATIONS_ENABLED: 'true',
          TELEGRAM_AGENT_ENABLED: 'true',
          TELEGRAM_BOT_TOKEN: 'test-token',
          TELEGRAM_CHAT_ID: '-100123',
          TELEGRAM_TOPIC_MESSAGES_ID: '2',
          TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
          TELEGRAM_BOOKING_URL: 'https://hundesalon-nika.com/de/onlayn-bronirovanie',
        },
      });

      assert.equal(response.status, 200);
      assert.equal(requests.length, 4);
      assert.equal(requests[0].chat_id, '12345');
      assert.equal(requests[0].menu_button.type, 'web_app');
      assert.equal(requests[0].menu_button.text, item.menuButton);
      assert.equal(requests[0].menu_button.web_app.url, `https://hundesalon-nika.com/telegram-menu.html?lang=${item.language}`);
      assert.equal(requests[1].chat_id, undefined);
      assert.equal(requests[1].menu_button.web_app.url, 'https://hundesalon-nika.com/telegram-menu.html');
      assert.match(requests[3].text, item.text);
      assert.equal(requests[3].reply_markup.remove_keyboard, true);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('the support button acknowledges the callback, notifies the team, and replies to the client', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), payload: JSON.parse(options.body) });
    return new Response(JSON.stringify({ ok: true, result: { message_id: requests.length } }), { status: 200 });
  };

  try {
    const response = await onRequest({
      request: new Request('https://hundesalon-nika.com/telegram-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'test-webhook-secret',
        },
        body: JSON.stringify(telegramCallback('support', 'de')),
      }),
      env: {
        SITE_NOTIFICATIONS_ENABLED: 'true',
        TELEGRAM_AGENT_ENABLED: 'true',
        TELEGRAM_BOT_TOKEN: 'test-token',
        TELEGRAM_CHAT_ID: '-100123',
        TELEGRAM_TOPIC_MESSAGES_ID: '2',
        TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
      },
    });

    assert.equal(response.status, 200);
    assert.equal(requests.length, 3);
    assert.match(requests[0].url, /answerCallbackQuery$/);
    assert.equal(requests[0].payload.callback_query_id, 'callback-123');
    assert.match(requests[0].payload.text, /Support-Anfrage erhalten/);
    assert.equal(requests[1].payload.chat_id, '-100123');
    assert.equal(requests[1].payload.message_thread_id, 2);
    assert.match(requests[1].payload.text, /Клиент запросил связь с сотрудником/);
    assert.equal(requests[2].payload.chat_id, '12345');
    assert.match(requests[2].payload.text, /Support-Anfrage wurde weitergeleitet/);
    assert.equal(requests[2].payload.reply_markup.remove_keyboard, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('public commands return the matching action with the same linked menu', async () => {
  const originalFetch = globalThis.fetch;

  try {
    for (const item of [
      { command: '/showcase', text: /интерактивное фирменное меню/, webAppUrl: 'https://hundesalon-nika.com/telegram-menu.html?lang=ru' },
      { command: '/booking', text: /Откройте онлайн-запись/, url: 'https://hundesalon-nika.com/ru/onlayn-bronirovanie' },
      { command: '/services', text: /Цены и услуги/, url: 'https://hundesalon-nika.com/ru/prays-list' },
      { command: '/address', text: /Адрес и часы работы/, url: 'https://hundesalon-nika.com/ru/kontakty' },
      { command: '/support', text: /Запрос передан в поддержку/, url: null },
      { command: '/start support', text: /Запрос передан в поддержку/, url: null },
    ]) {
      const requests = [];
      globalThis.fetch = async (url, options) => {
        requests.push({ url: String(url), payload: JSON.parse(options.body) });
        return new Response(JSON.stringify({ ok: true, result: { message_id: requests.length } }), { status: 200 });
      };

      const response = await onRequest({
        request: new Request('https://hundesalon-nika.com/telegram-webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Bot-Api-Secret-Token': 'test-webhook-secret',
          },
          body: JSON.stringify(telegramUpdate(item.command, 'ru')),
        }),
        env: {
          SITE_NOTIFICATIONS_ENABLED: 'true',
          TELEGRAM_AGENT_ENABLED: 'true',
          TELEGRAM_BOT_TOKEN: 'test-token',
          TELEGRAM_CHAT_ID: '-100123',
          TELEGRAM_TOPIC_MESSAGES_ID: '2',
          TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
        },
      });

      assert.equal(response.status, 200);
      assert.equal(requests.length, 2);
      const clientReply = requests.at(-1).payload;
      assert.match(clientReply.text, item.text);
      const markup = clientReply.reply_markup;
      if (item.webAppUrl) {
        assert.equal(markup.inline_keyboard[0][0].web_app.url, item.webAppUrl);
      } else if (item.url) {
        assert.equal(markup.inline_keyboard[0][0].url, item.url);
      } else {
        assert.equal(markup.remove_keyboard, true);
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('language selection is handled inside the branded Web App without support noise', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), payload: JSON.parse(options.body) });
    return new Response(JSON.stringify({ ok: true, result: { message_id: requests.length } }), { status: 200 });
  };

  const env = {
    SITE_NOTIFICATIONS_ENABLED: 'true',
    TELEGRAM_AGENT_ENABLED: 'true',
    TELEGRAM_BOT_TOKEN: 'test-token',
    TELEGRAM_CHAT_ID: '-100123',
    TELEGRAM_TOPIC_MESSAGES_ID: '2',
    TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
  };

  try {
    const selectorResponse = await onRequest({
      request: new Request('https://hundesalon-nika.com/telegram-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'test-webhook-secret',
        },
        body: JSON.stringify(telegramUpdate('/language', 'ru')),
      }),
      env,
    });

    assert.equal(selectorResponse.status, 200);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].payload.menu_button.type, 'web_app');
    assert.equal(requests[0].payload.menu_button.web_app.url, 'https://hundesalon-nika.com/telegram-menu.html?lang=ru');
    assert.match(requests[1].payload.text, /нажмите на глобус/);
    assert.equal(requests[1].payload.reply_markup.remove_keyboard, true);

    requests.length = 0;
    const selectionResponse = await onRequest({
      request: new Request('https://hundesalon-nika.com/telegram-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'test-webhook-secret',
        },
        body: JSON.stringify(telegramUpdate('Deutsch', 'ru')),
      }),
      env,
    });

    assert.equal(selectionResponse.status, 200);
    assert.equal(requests.length, 3);
    assert.equal(requests[0].payload.chat_id, '12345');
    assert.equal(requests[0].payload.menu_button.text, 'NIKA Menü');
    assert.equal(requests[1].payload.chat_id, undefined);
    assert.equal(requests[2].payload.chat_id, '12345');
    assert.match(requests[2].payload.text, /Willkommen bei HUNDESALON_NIKA/);
    assert.equal(requests[2].payload.reply_markup.remove_keyboard, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a legacy inline language callback is acknowledged and routes to the branded Web App', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), payload: JSON.parse(options.body) });
    return new Response(JSON.stringify({ ok: true, result: { message_id: requests.length } }), { status: 200 });
  };

  try {
    const response = await onRequest({
      request: new Request('https://hundesalon-nika.com/telegram-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'test-webhook-secret',
        },
        body: JSON.stringify(telegramCallback('language', 'ru')),
      }),
      env: {
        SITE_NOTIFICATIONS_ENABLED: 'true',
        TELEGRAM_AGENT_ENABLED: 'true',
        TELEGRAM_BOT_TOKEN: 'test-token',
        TELEGRAM_CHAT_ID: '-100123',
        TELEGRAM_TOPIC_MESSAGES_ID: '2',
        TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
      },
    });

    assert.equal(response.status, 200);
    assert.equal(requests.length, 3);
    assert.match(requests[0].url, /answerCallbackQuery$/);
    assert.match(requests[1].url, /setChatMenuButton$/);
    assert.match(requests[2].payload.text, /нажмите на глобус/);
    assert.equal(requests[2].payload.reply_markup.remove_keyboard, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('the previous reply-keyboard labels remain connected to the new menu', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ ok: true, result: { message_id: requests.length } }), { status: 200 });
  };

  try {
    const response = await onRequest({
      request: new Request('https://hundesalon-nika.com/telegram-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'test-webhook-secret',
        },
        body: JSON.stringify(telegramUpdate('Онлайн-запись', 'ru')),
      }),
      env: {
        SITE_NOTIFICATIONS_ENABLED: 'true',
        TELEGRAM_AGENT_ENABLED: 'true',
        TELEGRAM_BOT_TOKEN: 'test-token',
        TELEGRAM_CHAT_ID: '-100123',
        TELEGRAM_TOPIC_MESSAGES_ID: '2',
        TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
      },
    });

    assert.equal(response.status, 200);
    assert.equal(requests.length, 2);
    assert.match(requests[1].text, /Откройте онлайн-запись кнопкой ниже/);
    assert.equal(requests[1].reply_markup.inline_keyboard[0][0].url, 'https://hundesalon-nika.com/ru/onlayn-bronirovanie');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('the branded reply-keyboard labels route to every matching action', async () => {
  const originalFetch = globalThis.fetch;

  try {
    for (const item of [
      {
        label: '✨ Фирменное меню NIKA',
        language: 'ru',
        reply: /интерактивное фирменное меню/,
        requestCount: 2,
        webAppUrl: 'https://hundesalon-nika.com/telegram-menu.html?lang=ru',
        style: 'success',
      },
      {
        label: '📅 Онлайн-запись',
        language: 'ru',
        reply: /Откройте онлайн-запись/,
        requestCount: 2,
        url: 'https://hundesalon-nika.com/ru/onlayn-bronirovanie',
        style: 'success',
      },
      {
        label: '✂️ Услуги и цены',
        language: 'ru',
        reply: /Цены и услуги/,
        requestCount: 2,
        url: 'https://hundesalon-nika.com/ru/prays-list',
        style: 'primary',
      },
      {
        label: '📍 Адрес и часы',
        language: 'ru',
        reply: /Адрес и часы работы/,
        requestCount: 2,
        url: 'https://hundesalon-nika.com/ru/kontakty',
        style: 'primary',
      },
      {
        label: '🌐 Выбрать язык',
        language: 'ru',
        reply: /нажмите на глобус/,
        requestCount: 2,
        removesKeyboard: true,
      },
      {
        label: '💬 Связаться с сотрудником',
        language: 'ru',
        reply: /Запрос передан в поддержку/,
        requestCount: 2,
        removesKeyboard: true,
      },
      {
        label: '✨ Інтерактивне меню NIKA',
        language: 'uk',
        reply: /інтерактивне фірмове меню/,
        requestCount: 2,
        webAppUrl: 'https://hundesalon-nika.com/telegram-menu.html?lang=uk',
        style: 'success',
      },
    ]) {
      const requests = [];
      globalThis.fetch = async (url, options) => {
        requests.push({ url: String(url), payload: JSON.parse(options.body) });
        return new Response(JSON.stringify({ ok: true, result: { message_id: requests.length } }), { status: 200 });
      };

      const response = await onRequest({
        request: new Request('https://hundesalon-nika.com/telegram-webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Telegram-Bot-Api-Secret-Token': 'test-webhook-secret',
          },
          body: JSON.stringify(telegramUpdate(item.label, item.language)),
        }),
        env: {
          SITE_NOTIFICATIONS_ENABLED: 'true',
          TELEGRAM_AGENT_ENABLED: 'true',
          TELEGRAM_BOT_TOKEN: 'test-token',
          TELEGRAM_CHAT_ID: '-100123',
          TELEGRAM_TOPIC_MESSAGES_ID: '2',
          TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
        },
      });

      assert.equal(response.status, 200);
      assert.equal(requests.length, item.requestCount);
      const clientReply = requests.at(-1).payload;
      assert.match(clientReply.text, item.reply);

      if (item.webAppUrl) {
        const actionButton = clientReply.reply_markup.inline_keyboard[0][0];
        assert.equal(actionButton.web_app.url, item.webAppUrl);
        assert.equal(actionButton.style, item.style);
      } else if (item.url) {
        const actionButton = clientReply.reply_markup.inline_keyboard[0][0];
        assert.equal(actionButton.url, item.url);
        assert.equal(actionButton.style, item.style);
      } else if (item.removesKeyboard) {
        assert.equal(clientReply.reply_markup.remove_keyboard, true);
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('an unavailable auto reply makes Telegram retry the update', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false }), { status: 401 });

  try {
    const response = await onRequest({
      request: new Request('https://hundesalon-nika.com/telegram-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'test-webhook-secret',
        },
        body: JSON.stringify(telegramUpdate()),
      }),
      env: {
        SITE_NOTIFICATIONS_ENABLED: 'true',
        TELEGRAM_AGENT_ENABLED: 'true',
        TELEGRAM_BOT_TOKEN: 'test-token',
        TELEGRAM_CHAT_ID: '-100123',
        TELEGRAM_TOPIC_MESSAGES_ID: '2',
        TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
      },
    });

    assert.equal(response.status, 502);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a Telegram chat administrator confirms one booking in Google Calendar', async () => {
  const originalFetch = globalThis.fetch;
  const requestId = '12345678-1234-4123-8123-123456789abc';
  const eventId = `booking${requestId.replace(/-/g, '')}`;
  const row = Array(34).fill('');
  Object.assign(row, {
    3: 'Test Customer', 6: 'Komplettpflege', 7: '2030-01-02', 8: '10:00', 13: 'Nika', 15: 'Pudel',
    28: requestId, 29: 'pending', 32: '2030-01-02T10:00:00', 33: '2030-01-02T12:00:00',
  });
  const calendarEvent = {
    id: eventId,
    status: 'confirmed',
    created: '2030-01-01T00:00:00Z',
    start: { dateTime: '2030-01-02T10:00:00+01:00' },
    end: { dateTime: '2030-01-02T12:00:00+01:00' },
    extendedProperties: { private: { bookingRequestId: requestId } },
  };
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    calls.push({ target, options });
    if (target.endsWith('/getChatMember')) return Response.json({ ok: true, result: { status: 'administrator' } });
    if (target.includes('/values/bookings!A1%3AAH')) return Response.json({ values: [[], row] });
    if (target.endsWith(`/events/${eventId}`)) return Response.json({}, { status: 404 });
    if (target.endsWith('/calendar/v3/freeBusy')) {
      return Response.json({ calendars: { 'calendar@example.com': { busy: [] } } });
    }
    if (target.endsWith('/events') && options.method === 'POST') return Response.json(calendarEvent);
    if (target.includes('/events?')) return Response.json({ items: [calendarEvent] });
    if (target.includes('/values/bookings!AD2%3AAF2')) return Response.json({ updatedRange: 'bookings!AD2:AF2' });
    if (
      target.endsWith('/answerCallbackQuery') ||
      target.endsWith('/sendMessage') ||
      target.endsWith('/editMessageReplyMarkup')
    ) {
      return Response.json({ ok: true, result: { message_id: 51 } });
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };

  try {
    const response = await onRequest({
      request: new Request('https://hundesalon-nika.com/telegram-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'test-webhook-secret',
        },
        body: JSON.stringify(bookingConfirmationCallback(requestId)),
      }),
      env: {
        SITE_NOTIFICATIONS_ENABLED: 'true',
        TELEGRAM_BOT_TOKEN: 'test-token',
        TELEGRAM_CHAT_ID: '-100123',
        TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
        GOOGLE_OAUTH_ACCESS_TOKEN: 'access-token',
        GOOGLE_CALENDAR_ID: 'calendar@example.com',
        SHEET_ID: 'sheet-id',
      },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.confirmed, true);
    assert.equal(calls.filter(call => call.target.endsWith('/events')).length, 1);
    assert.equal(calls.some(call => call.target.includes('/values/bookings!AD2%3AAF2')), true);
    assert.equal(calls.some(call => call.target.endsWith('/answerCallbackQuery')), true);
    assert.equal(calls.some(call => call.target.endsWith('/sendMessage')), true);
    assert.equal(calls.some(call => call.target.endsWith('/editMessageReplyMarkup')), true);
    assert.equal(
      calls.findIndex(call => call.target.endsWith('/answerCallbackQuery')) <
        calls.findIndex(call => call.target.includes('/values/bookings!A1%3AAH')),
      true
    );
    assert.equal(
      calls.findIndex(call => call.target.endsWith('/sendMessage')) <
        calls.findIndex(call => call.target.endsWith('/editMessageReplyMarkup')),
      true
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('keeps the booking button and returns a retryable response when the final Telegram status is not delivered', async () => {
  const originalFetch = globalThis.fetch;
  const requestId = '12345678-1234-4123-8123-123456789abc';
  const eventId = `booking${requestId.replace(/-/g, '')}`;
  const row = Array(34).fill('');
  Object.assign(row, {
    3: 'Test Customer',
    6: 'Komplettpflege',
    7: '2030-01-02',
    8: '10:00',
    28: requestId,
    29: 'confirmed',
    31: eventId,
  });
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    calls.push({ target, options });
    if (target.endsWith('/getChatMember')) return Response.json({ ok: true, result: { status: 'administrator' } });
    if (target.endsWith('/answerCallbackQuery')) return Response.json({ ok: true });
    if (target.includes('/values/bookings!A1%3AAH')) return Response.json({ values: [[], row] });
    if (target.endsWith('/sendMessage')) return Response.json({ ok: false }, { status: 502 });
    throw new Error(`Unexpected fetch: ${target}`);
  };

  try {
    const response = await onRequest({
      request: new Request('https://hundesalon-nika.com/telegram-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'test-webhook-secret',
        },
        body: JSON.stringify(bookingConfirmationCallback(requestId)),
      }),
      env: {
        SITE_NOTIFICATIONS_ENABLED: 'true',
        TELEGRAM_BOT_TOKEN: 'test-token',
        TELEGRAM_CHAT_ID: '-100123',
        TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
        GOOGLE_OAUTH_ACCESS_TOKEN: 'access-token',
        GOOGLE_CALENDAR_ID: 'calendar@example.com',
        SHEET_ID: 'sheet-id',
      },
    });
    const body = await response.json();

    assert.equal(response.status, 502);
    assert.equal(body.retryable, true);
    assert.equal(body.confirmed, true);
    assert.equal(calls.some(call => call.target.endsWith('/editMessageReplyMarkup')), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a non-administrator cannot confirm a booking from the Telegram button', async () => {
  const originalFetch = globalThis.fetch;
  const requestId = '12345678-1234-4123-8123-123456789abc';
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const target = String(url);
    calls.push({ target, options });
    if (target.endsWith('/getChatMember')) return Response.json({ ok: true, result: { status: 'member' } });
    if (target.endsWith('/answerCallbackQuery')) return Response.json({ ok: true });
    throw new Error(`Unexpected fetch: ${target}`);
  };

  try {
    const response = await onRequest({
      request: new Request('https://hundesalon-nika.com/telegram-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': 'test-webhook-secret',
        },
        body: JSON.stringify(bookingConfirmationCallback(requestId)),
      }),
      env: {
        SITE_NOTIFICATIONS_ENABLED: 'true',
        TELEGRAM_BOT_TOKEN: 'test-token',
        TELEGRAM_CHAT_ID: '-100123',
        TELEGRAM_WEBHOOK_SECRET: 'test-webhook-secret',
        GOOGLE_OAUTH_ACCESS_TOKEN: 'access-token',
        GOOGLE_CALENDAR_ID: 'calendar@example.com',
        SHEET_ID: 'sheet-id',
      },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.confirmed, false);
    assert.equal(body.skipped, true);
    assert.equal(calls.some(call => call.target.includes('googleapis.com/calendar')), false);
    assert.equal(calls.some(call => call.target.includes('sheets.googleapis.com')), false);
    const acknowledgement = JSON.parse(calls.find(call => call.target.endsWith('/answerCallbackQuery')).options.body);
    assert.equal(acknowledgement.show_alert, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
