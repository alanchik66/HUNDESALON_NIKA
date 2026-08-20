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
        body: JSON.stringify(telegramUpdate('/start', 'ru')),
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
    assert.match(requests[1].text, /Добро пожаловать в HUNDESALON_NIKA/);
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
    assert.equal(requests.length, 2);
    assert.match(requests[1].text, /Willkommen bei HUNDESALON_NIKA/);
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

test('localizes every visible control in the persistent initial menu', async () => {
  const originalFetch = globalThis.fetch;

  try {
    for (const item of [
      {
        language: 'de',
        text: /Willkommen bei HUNDESALON_NIKA/,
        buttons: ['✨ Premium-Menü öffnen', 'Online-Termin', 'Leistungen & Preise', 'Adresse & Zeiten', 'Sprache wählen', 'Mitarbeiter kontaktieren'],
      },
      {
        language: 'en',
        text: /Welcome to HUNDESALON_NIKA/,
        buttons: ['✨ Open premium menu', 'Book online', 'Services & prices', 'Address & hours', 'Choose language', 'Contact support'],
      },
      {
        language: 'ru',
        text: /Добро пожаловать в HUNDESALON_NIKA/,
        buttons: ['✨ Открыть премиум-меню', 'Онлайн-запись', 'Услуги и цены', 'Адрес и часы', 'Выбрать язык', 'Связаться с сотрудником'],
      },
      {
        language: 'uk',
        text: /Ласкаво просимо до HUNDESALON_NIKA/,
        buttons: ['✨ Відкрити преміум-меню', 'Онлайн-запис', 'Послуги й ціни', 'Адреса й години', 'Обрати мову', 'Зв’язатися з підтримкою'],
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
      assert.equal(requests.length, 2);
      assert.match(requests[1].text, item.text);
      const buttons = requests[1].reply_markup.keyboard.flat();
      assert.deepEqual(buttons.map(button => button.text), item.buttons);
      assert.equal(requests[1].reply_markup.is_persistent, true);
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
    assert.equal(requests[2].payload.reply_markup.keyboard.flat().at(-1).text, 'Mitarbeiter kontaktieren');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('public commands return the matching action with the same linked menu', async () => {
  const originalFetch = globalThis.fetch;

  try {
    for (const item of [
      { command: '/showcase', text: /интерактивное фирменное меню/, url: 'https://hundesalon-nika.com/telegram-menu.html?lang=ru', silent: true },
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
      assert.equal(requests.length, item.silent ? 1 : 2);
      const clientReply = requests.at(-1).payload;
      assert.match(clientReply.text, item.text);
      const markup = clientReply.reply_markup;
      if (item.url) {
        assert.equal(markup.inline_keyboard[0][0].url, item.url);
      } else {
        assert.equal(markup.keyboard.flat().at(-1).text, 'Связаться с сотрудником');
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('the language keyboard returns a localized menu without creating support noise', async () => {
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
    assert.equal(requests.length, 1);
    assert.match(requests[0].payload.text, /Выберите язык общения/);
    assert.deepEqual(
      requests[0].payload.reply_markup.keyboard.flat().map(button => button.text),
      ['Deutsch', 'English', 'Русский', 'Українська']
    );

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
    assert.equal(requests.length, 1);
    assert.equal(requests[0].payload.chat_id, '12345');
    assert.match(requests[0].payload.text, /Willkommen bei HUNDESALON_NIKA/);
    assert.equal(requests[0].payload.reply_markup.keyboard.flat().at(-1).text, 'Mitarbeiter kontaktieren');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a legacy inline language callback is acknowledged and opens the persistent language keyboard', async () => {
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
    assert.equal(requests.length, 2);
    assert.match(requests[0].url, /answerCallbackQuery$/);
    assert.match(requests[1].payload.text, /Выберите язык общения/);
    assert.equal(requests[1].payload.reply_markup.keyboard.flat().at(-1).text, 'Українська');
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
