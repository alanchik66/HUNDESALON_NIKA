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
