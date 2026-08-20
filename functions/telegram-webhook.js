import {
  answerTelegramCallbackQuery,
  cleanText,
  getEnvValue,
  hasUsableValue,
  sendTelegramMessage,
} from './_lib/platform-integrations.js';

const SITE_ORIGIN = 'https://hundesalon-nika.com';
const MENU_COPY = Object.freeze({
  de: {
    showcase: '✨ Premium-Menü öffnen',
    booking: 'Online-Termin',
    prices: 'Leistungen & Preise',
    address: 'Adresse & Zeiten',
    language: 'Sprache wählen',
    support: 'Mitarbeiter kontaktieren',
    supportAcknowledgement: 'Support-Anfrage erhalten.',
  },
  en: {
    showcase: '✨ Open premium menu',
    booking: 'Book online',
    prices: 'Services & prices',
    address: 'Address & hours',
    language: 'Choose language',
    support: 'Contact support',
    supportAcknowledgement: 'Support request received.',
  },
  ru: {
    showcase: '✨ Открыть премиум-меню',
    booking: 'Онлайн-запись',
    prices: 'Услуги и цены',
    address: 'Адрес и часы',
    language: 'Выбрать язык',
    support: 'Связаться с сотрудником',
    supportAcknowledgement: 'Запрос в поддержку получен.',
  },
  uk: {
    showcase: '✨ Відкрити преміум-меню',
    booking: 'Онлайн-запис',
    prices: 'Послуги й ціни',
    address: 'Адреса й години',
    language: 'Обрати мову',
    support: 'Зв’язатися з підтримкою',
    supportAcknowledgement: 'Запит до підтримки отримано.',
  },
});

const SITE_PATHS = Object.freeze({
  de: { booking: '/de/onlayn-bronirovanie', prices: '/de/prays-list', address: '/de/kontakty' },
  en: { booking: '/en/onlayn-bronirovanie', prices: '/en/prays-list', address: '/en/kontakty' },
  ru: { booking: '/ru/onlayn-bronirovanie', prices: '/ru/prays-list', address: '/ru/kontakty' },
  uk: { booking: '/uk/onlayn-bronirovanie', prices: '/uk/prays-list', address: '/uk/kontakty' },
});

const CALLBACK_ACTIONS = Object.freeze({
  support: 'support',
  language: 'language',
});

const LANGUAGE_OPTIONS = Object.freeze([
  ['de', 'Deutsch'],
  ['en', 'English'],
  ['ru', 'Русский'],
  ['uk', 'Українська'],
]);

const AUTO_REPLY_COPY = Object.freeze({
  de: {
    welcome: 'Willkommen bei HUNDESALON_NIKA. Wählen Sie bitte einen Bereich im Menü.',
    showcase: 'Öffnen Sie das interaktive HUNDESALON_NIKA Menü über die Schaltfläche unten.',
    booking: 'Öffnen Sie die Online-Terminbuchung über die Schaltfläche unten. Wenn Sie Hilfe benötigen, wählen Sie „Mitarbeiter kontaktieren“.',
    prices: 'Preise und Leistungen öffnen Sie über die Schaltfläche unten. Für eine individuelle Empfehlung nennen Sie bitte Rasse, Größe und Fellzustand Ihres Tieres.',
    address: 'Wir sind in Leipzig. Adresse und Öffnungszeiten öffnen Sie über die Schaltfläche unten.',
    language: 'Bitte wählen Sie Ihre Sprache.',
    support: 'Ihre Support-Anfrage wurde weitergeleitet. Schreiben Sie Ihre Nachricht direkt in diesen Chat – wir antworten hier.',
    fallback: 'Vielen Dank für Ihre Nachricht. Wählen Sie einen Bereich im Menü oder beschreiben Sie Ihr Anliegen kurz.',
  },
  en: {
    welcome: 'Welcome to HUNDESALON_NIKA. Please choose a section from the menu.',
    showcase: 'Open the interactive HUNDESALON_NIKA menu with the button below.',
    booking: 'Open online booking with the button below. If you need help, choose “Contact support”.',
    prices: 'Open services and prices with the button below. For a personalised recommendation, please tell us your pet’s breed, size and coat condition.',
    address: 'We are in Leipzig. Open our address and opening hours with the button below.',
    language: 'Please choose your language.',
    support: 'Your support request has been forwarded. Send your message in this chat and we will reply here.',
    fallback: 'Thank you for your message. Choose a section from the menu or briefly describe your question.',
  },
  ru: {
    welcome: 'Добро пожаловать в HUNDESALON_NIKA. Выберите нужный раздел в меню.',
    showcase: 'Откройте интерактивное фирменное меню HUNDESALON_NIKA кнопкой ниже.',
    booking: 'Откройте онлайн-запись кнопкой ниже. Если нужна помощь, выберите «Связаться с сотрудником».',
    prices: 'Цены и услуги открываются кнопкой ниже. Для индивидуальной рекомендации напишите породу, размер и состояние шерсти питомца.',
    address: 'Мы находимся в Лейпциге. Адрес и часы работы открываются кнопкой ниже.',
    language: 'Выберите язык общения.',
    support: 'Запрос передан в поддержку. Напишите сообщение прямо в этот чат — мы ответим здесь.',
    fallback: 'Спасибо за сообщение. Выберите раздел в меню или кратко опишите ваш вопрос.',
  },
  uk: {
    welcome: 'Ласкаво просимо до HUNDESALON_NIKA. Оберіть потрібний розділ у меню.',
    showcase: 'Відкрийте інтерактивне фірмове меню HUNDESALON_NIKA кнопкою нижче.',
    booking: 'Відкрийте онлайн-запис кнопкою нижче. Якщо потрібна допомога, оберіть «Зв’язатися з підтримкою».',
    prices: 'Ціни та послуги відкриваються кнопкою нижче. Для індивідуальної рекомендації напишіть породу, розмір і стан шерсті улюбленця.',
    address: 'Ми знаходимося в Лейпцигу. Адреса та години роботи відкриваються кнопкою нижче.',
    language: 'Оберіть мову спілкування.',
    support: 'Запит передано до підтримки. Напишіть повідомлення в цей чат — ми відповімо тут.',
    fallback: 'Дякуємо за повідомлення. Оберіть розділ у меню або коротко опишіть ваше питання.',
  },
});

function pageUrl(language, page) {
  return `${SITE_ORIGIN}${(SITE_PATHS[language] || SITE_PATHS.en)[page]}`;
}

function showcaseUrl(language) {
  return `${SITE_ORIGIN}/telegram-menu.html?lang=${encodeURIComponent(language)}`;
}

function bookingUrl(env, language) {
  const configured = getEnvValue(env, 'TELEGRAM_BOOKING_URL');
  if (!hasUsableValue(configured)) return pageUrl(language, 'booking');

  return configured.replace(
    /https:\/\/hundesalon-nika\.com\/(?:de|en|ru|uk)\/onlayn-bronirovanie(?:\.html)?(?=[?#]|$)/i,
    `${SITE_ORIGIN}${(SITE_PATHS[language] || SITE_PATHS.en).booking}`
  );
}

function buildMenuMarkup(language) {
  const labels = MENU_COPY[language] || MENU_COPY.en;
  return {
    keyboard: [
      [{ text: labels.showcase }],
      [
        { text: labels.booking },
        { text: labels.prices },
      ],
      [
        { text: labels.address },
        { text: labels.language },
      ],
      [{ text: labels.support }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

function buildLanguageMarkup() {
  return {
    keyboard: [
      LANGUAGE_OPTIONS.slice(0, 2).map(([, label]) => ({ text: label })),
      LANGUAGE_OPTIONS.slice(2).map(([, label]) => ({ text: label })),
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

function buildActionMarkup(intent, language, resolvedBookingUrl) {
  const labels = MENU_COPY[language] || MENU_COPY.en;
  const url = {
    showcase: showcaseUrl(language),
    booking: resolvedBookingUrl,
    prices: pageUrl(language, 'prices'),
    address: pageUrl(language, 'address'),
  }[intent];
  if (!url) return null;
  return { inline_keyboard: [[{ text: labels[intent], url }]] };
}

function parseCallbackAction(data) {
  const value = String(data || '').trim();
  if (value === CALLBACK_ACTIONS.support) return { intent: 'support', language: '' };
  if (value === CALLBACK_ACTIONS.language) return { intent: 'language', language: '' };

  const [action, language] = value.split(':', 2);
  const supportedLanguage = LANGUAGE_OPTIONS.some(([code]) => code === language) ? language : '';
  if (action === CALLBACK_ACTIONS.support && supportedLanguage) return { intent: 'support', language: supportedLanguage };
  if (action === CALLBACK_ACTIONS.language && supportedLanguage) return { intent: 'menu', language: supportedLanguage };
  return null;
}

function resolveIntent(text) {
  const value = text.toLocaleLowerCase();
  const commandMatch = value.match(/^\/([a-z]+)(?:@[a-z0-9_]+)?(?:\s+([a-z0-9_-]+))?\s*$/i);
  const command = commandMatch?.[1] || '';
  const commandPayload = commandMatch?.[2] || '';
  if (command === 'start' && commandPayload === 'support') return 'support';
  if (
    ['showcase', 'premium', 'app'].includes(command)
    || /(?:premium|фирменн|премиум|інтерактивн).{0,40}(?:menü|menu|меню)/i.test(value)
  ) return 'showcase';
  if (['start', 'menu'].includes(command) || /^\s*(?:menü|menu|меню)\s*$/i.test(value)) return 'menu';
  if (command === 'language' || /(?:^|\s)(?:language|sprache|язык|мова)(?:\s|$)/i.test(value)) return 'language';
  if (['booking', 'book', 'termin'].includes(command) || /buch|termin|запис|заказ|booking|appointment/.test(value)) return 'booking';
  if (['services', 'prices', 'price'].includes(command) || /preis|preise|leistung|prices|цены|услуг|послуг|service|стоим/.test(value)) return 'prices';
  if (['address', 'location', 'hours'].includes(command) || /address|adresse|адрес|адреса|где|öffnungszeit|zeiten|часы|годин|врем|open/.test(value)) return 'address';
  if (command === 'support' || /mitarbeiter|сотруд|оператор|человек|support|суппорт|підтрим|help|unterstützung/.test(value)) return 'support';
  if (/newsletter|подпис|підпис|рассыл|розсил|abonn/.test(value)) return 'newsletter';
  if (/instagram|facebook|tiktok|соцсет|соцмереж|social/.test(value)) return 'social';
  return 'fallback';
}

function classifyMessage(text) {
  const intent = resolveIntent(text);
  if (intent === 'booking') return 'orders';
  if (intent === 'newsletter') return 'newsletter';
  if (intent === 'social') return 'social';
  return 'messages';
}

function looksGerman(text) {
  return /\b(hallo|guten|preis|preise|leistung|termin|adresse|öffnungszeit|mitarbeiter)\b/i.test(text);
}

function preferredLanguage(text, languageCode = '') {
  const code = String(languageCode || '').trim().toLowerCase().split('-')[0];
  if (Object.hasOwn(AUTO_REPLY_COPY, code)) return code;

  const value = String(text || '');
  if (/[іїєґ]/iu.test(value)) return 'uk';
  if (/[а-яё]/iu.test(value)) return 'ru';
  return looksGerman(value) ? 'de' : 'en';
}

function selectedLanguageFromText(text) {
  const value = String(text || '').normalize('NFKC').trim().toLocaleLowerCase();
  return LANGUAGE_OPTIONS.find(([, label]) => value === label.toLocaleLowerCase())?.[0] || '';
}

function buildAutoReply(intent, language) {
  const copy = AUTO_REPLY_COPY[language] || AUTO_REPLY_COPY.en;
  if (intent === 'menu') return copy.welcome;
  return copy[intent] || copy.fallback;
}

function buildClientReply(text, env, languageCode = '', callbackAction = null) {
  const selectedLanguage = selectedLanguageFromText(text);
  const language = callbackAction?.language || selectedLanguage || preferredLanguage(text, languageCode);
  const intent = selectedLanguage ? 'menu' : callbackAction?.intent || resolveIntent(text);
  const resolvedBookingUrl = bookingUrl(env, language);
  const actionMarkup = buildActionMarkup(intent, language, resolvedBookingUrl);
  return {
    language,
    intent,
    languageSelected: Boolean(selectedLanguage),
    text: buildAutoReply(intent, language),
    replyMarkup: intent === 'language' ? buildLanguageMarkup() : actionMarkup || buildMenuMarkup(language),
  };
}

function buildSupportNotification(sender, text, fromMenuButton = false) {
  return [
    fromMenuButton ? '🤝 Клиент запросил связь с сотрудником через меню бота' : '💬 Входящее сообщение в Telegram-боте',
    `От: ${cleanText([sender.first_name, sender.last_name].filter(Boolean).join(' ') || 'неизвестно', 120)}`,
    sender.username ? `@${cleanText(sender.username, 80)}` : null,
    `Клиент Telegram ID: ${cleanText(sender.id, 40)}`,
    '',
    text,
  ].filter(line => line !== null).join('\n');
}

function extractClientId(message) {
  const source = cleanText(message?.reply_to_message?.text || '', 3900);
  const match = source.match(/Клиент Telegram ID:\s*(\d+)/i);
  return match?.[1] || '';
}

function secretsMatch(expected, received) {
  const encoder = new TextEncoder();
  const expectedBytes = encoder.encode(expected);
  const receivedBytes = encoder.encode(received);
  const maxLength = Math.max(expectedBytes.length, receivedBytes.length);
  let difference = expectedBytes.length ^ receivedBytes.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (expectedBytes[index] || 0) ^ (receivedBytes[index] || 0);
  }
  return difference === 0;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
  }

  const expectedSecret = getEnvValue(env, 'TELEGRAM_WEBHOOK_SECRET');
  const receivedSecret = String(request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '').trim();
  if (!hasUsableValue(expectedSecret) || !secretsMatch(expectedSecret, receivedSecret)) {
    return json({ ok: false }, 401);
  }

  const update = await request.json().catch(() => null);
  const callbackQuery = update?.callback_query;
  const message = callbackQuery?.message || update?.message;
  const sender = callbackQuery?.from || message?.from || {};
  const callbackAction = callbackQuery ? parseCallbackAction(callbackQuery.data) : null;
  if (callbackQuery && !callbackAction) {
    try {
      await answerTelegramCallbackQuery(env, { callbackQueryId: callbackQuery.id });
    } catch {
      console.error('[telegram] stale callback acknowledgement request failed');
    }
    return json({ ok: true, skipped: true });
  }
  const text = callbackAction?.intent || cleanText(message?.text || message?.caption, 2200);
  if (!message || !text || sender.is_bot) {
    return json({ ok: true, skipped: true });
  }

  const reply = buildClientReply(text, env, sender.language_code, callbackAction);
  if (callbackQuery?.id) {
    try {
      const acknowledgement = await answerTelegramCallbackQuery(env, {
        callbackQueryId: callbackQuery.id,
        text: callbackAction?.intent === 'support' ? (MENU_COPY[reply.language] || MENU_COPY.en).supportAcknowledgement : '',
      });
      if (!acknowledgement?.ok) {
        console.error('[telegram] callback acknowledgement failed', JSON.stringify({
          status: Number(acknowledgement?.status || 0),
          skipped: Boolean(acknowledgement?.skipped),
        }));
      }
    } catch {
      console.error('[telegram] callback acknowledgement request failed');
    }
  }

  const configuredChatId = getEnvValue(env, 'TELEGRAM_CHAT_ID');
  if (message.chat?.type !== 'private') {
    const clientId = extractClientId(message);
    if (clientId && String(message.chat?.id) === configuredChatId) {
      await sendTelegramMessage(env, { chatId: clientId, text });
      return json({ ok: true, relayed: true });
    }
    return json({ ok: true, skipped: true });
  }

  if (reply.intent !== 'language' && reply.intent !== 'showcase' && !reply.languageSelected && callbackAction?.intent !== 'menu') {
    try {
      const supportNotification = await sendTelegramMessage(env, {
        text: buildSupportNotification(sender, text, callbackAction?.intent === 'support'),
        category: classifyMessage(text),
      });
      if (!supportNotification?.ok) {
        console.error('[telegram] support notification failed', JSON.stringify({
          status: Number(supportNotification?.status || 0),
          skipped: Boolean(supportNotification?.skipped),
        }));
      }
    } catch {
      console.error('[telegram] support notification request failed');
    }
  }

  const agentEnabled = /^(1|true|on|yes)$/i.test(getEnvValue(env, 'TELEGRAM_AGENT_ENABLED', 'true'));
  if (agentEnabled) {
    try {
      const autoReply = await sendTelegramMessage(env, {
        chatId: String(message.chat.id),
        text: reply.text,
        replyMarkup: reply.replyMarkup,
      });
      if (!autoReply?.ok) {
        console.error('[telegram] auto reply failed', JSON.stringify({
          status: Number(autoReply?.status || 0),
          skipped: Boolean(autoReply?.skipped),
        }));
        return json({ ok: false }, 502);
      }
    } catch {
      console.error('[telegram] auto reply request failed');
      return json({ ok: false }, 502);
    }
  }

  return json({ ok: true });
}
