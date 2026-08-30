/**
 * Cloudflare Pages Function: POST /sendmail
 * ==========================================
 * Обрабатывает контактные формы и заявки на бронирование.
 *
 * Настройка (один раз в Cloudflare Dashboard):
 *   1. Зарегистрируйтесь в SendPulse и подтвердите домен в разделе Senders.
 *   2. Создайте API key или Client credentials в SendPulse → API.
 *   3. В Cloudflare Pages → Settings → Environment variables добавьте
 *      SENDPULSE_API_KEY либо SENDPULSE_CLIENT_ID и SENDPULSE_CLIENT_SECRET.
 */

import { assertAllowedOrigin, enforceRateLimit, jsonResponse } from './_lib/http-security.js';
import {
  appendGoogleSheetRow,
  createGoogleCalendarEvent,
  getEnvList,
  getEnvValue,
  hasUsableValue,
  sendSendPulseAutomationEvent,
  sendSendPulseEmail,
  sendTelegramMessage,
  upsertSendPulseContact,
  siteNotificationsEnabled,
} from './_lib/platform-integrations.js';
import { buildBrandedEmail } from './_lib/email-template.js';

const DEFAULT_RECIPIENT = 'support@hundesalon-nika.com';
const DEFAULT_BOOKING_RECIPIENT = 'booking@hundesalon-nika.com';
const DEFAULT_SUPPORT = 'support@hundesalon-nika.com';
const DEFAULT_FROM = 'HUNDESALON_NIKA <noreply@hundesalon-nika.com>';
const DEFAULT_CLIENT_FROM = 'HUNDESALON_NIKA <support@hundesalon-nika.com>';
const DEFAULT_ADMIN_EMAILS = [];
const ONLINE_PAYMENTS_HARD_DISABLED = true;
const SLACK_TIMEOUT_MS = 4500;
const CLIENT_REGISTRATION_FORM_TYPE = 'client_registration';
const CLIENT_REGISTRATION_SHEET = 'clients';
const REGISTRATION_PET_SPECIES = new Set(['dog', 'cat', 'small_animal', 'rabbit', 'guinea_pig', 'other']);
const BOOKING_CLIENT_TYPES = new Set(['new', 'returning']);
const BOOKING_COAT_CONDITIONS = new Set(['good', 'slight_mats', 'many_mats', 'severe_matting']);
const BOOKING_BEHAVIOURS = new Set(['calm', 'restless', 'very_restless', 'aggressive']);
const BOOKING_SCHEDULE = Object.freeze({
  workdayStartMinutes: 9 * 60,
  workdayEndMinutes: 18 * 60,
  slotStepMinutes: 30,
  maxLookaheadDays: 90,
});

const BOOKING_COAT_EXTRA_MINUTES = Object.freeze({
  good: 0,
  slight_mats: 20,
  many_mats: 40,
  severe_matting: 60,
});

const BOOKING_BEHAVIOUR_EXTRA_MINUTES = Object.freeze({
  calm: 0,
  restless: 20,
  very_restless: 40,
  aggressive: 60,
});

const clampBookingMinutes = (value, fallback, min, max) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const parseBookingDate = value => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);

  if (
    !Number.isFinite(timestamp) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return timestamp;
};

const getBerlinDateKey = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const value = type => parts.find(part => part.type === type)?.value || '';
  return `${value('year')}-${value('month')}-${value('day')}`;
};

const isValidBookingWindow = (date, time) => {
  const dateTimestamp = parseBookingDate(date);
  const timeMatch = String(time || '').match(/^(\d{2}):(\d{2})$/);
  if (dateTimestamp === null || !timeMatch) return false;

  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const timeMinutes = hour * 60 + minute;
  if (
    hour > 23 ||
    minute > 59 ||
    timeMinutes < BOOKING_SCHEDULE.workdayStartMinutes ||
    timeMinutes >= BOOKING_SCHEDULE.workdayEndMinutes ||
    timeMinutes % BOOKING_SCHEDULE.slotStepMinutes !== 0
  ) {
    return false;
  }

  const todayTimestamp = parseBookingDate(getBerlinDateKey());
  if (todayTimestamp === null) return false;

  const maxTimestamp = todayTimestamp + BOOKING_SCHEDULE.maxLookaheadDays * 24 * 60 * 60 * 1000;
  return dateTimestamp >= todayTimestamp && dateTimestamp <= maxTimestamp;
};

const addLocalMinutes = (date, time, minutes) => {
  const timeMatch = String(time || '').match(/^(\d{2}):(\d{2})$/);
  const dateTimestamp = parseBookingDate(date);
  if (dateTimestamp === null || !timeMatch) return '';

  const base = new Date(dateTimestamp);
  base.setUTCMinutes(Number(timeMatch[1]) * 60 + Number(timeMatch[2]) + minutes);
  return `${base.toISOString().slice(0, 10)}T${base.toISOString().slice(11, 16)}:00`;
};

/** Строки для ответа на разных языках */
const COPY = {
  ru: {
    success: 'Сообщение отправлено! Мы свяжемся с вами в ближайшее время.',
    registrationSuccess: 'Данные сохранены в закрытом учёте салона. Теперь можно выбрать дату и время.',
    error: 'Ошибка при отправке. Пожалуйста, позвоните нам по телефону.',
  },
  uk: {
    success: "Повідомлення надіслано! Ми зв'яжемося з вами найближчим часом.",
    registrationSuccess: 'Дані збережено у закритому обліку салону. Тепер можна обрати дату й час.',
    error: 'Помилка надсилання. Будь ласка, зателефонуйте нам.',
  },
  en: {
    success: 'Message sent! We will get back to you soon.',
    registrationSuccess:
      'The details were saved in the salon’s protected register. You can now choose a date and time.',
    error: 'Failed to send. Please contact us by phone.',
  },
  de: {
    success: 'Ihre Nachricht wurde gesendet! Wir melden uns in Kürze.',
    registrationSuccess:
      'Die Daten wurden im geschützten Salonregister gespeichert. Jetzt können Sie Datum und Uhrzeit auswählen.',
    error: 'Senden fehlgeschlagen. Bitte kontaktieren Sie uns telefonisch.',
  },
};

const EMAIL_COPY = {
  de: {
    bookingSubject: 'Ihre Buchungsanfrage bei HUNDESALON_NIKA',
    bookingThanks: 'Vielen Dank für Ihre Buchungsanfrage.',
    field: {
      form: 'Formular',
      direction: 'Thema',
      language: 'Sprache',
      name: 'Name',
      email: 'E-Mail',
      replyInstruction: 'Für eine Antwort verwenden Sie bitte die Antwortfunktion dieser E-Mail.',
      phone: 'Telefon',
      service: 'Leistung',
      date: 'Datum',
      time: 'Uhrzeit',
      file: 'Datei',
      payment: 'Zahlung',
      message: 'Nachricht',
      promotion: 'Aktion',
      petName: 'Name des Tieres',
      petSpecies: 'Tierart',
      petBreed: 'Rasse',
      petAge: 'Alter/Geburtsdatum',
      petSex: 'Geschlecht',
      petTag: 'Marken-/Anhängernummer',
    },
  },
  en: {
    bookingSubject: 'Your booking request at HUNDESALON_NIKA',
    bookingThanks: 'Thank you for your booking request.',
    field: {
      form: 'Form',
      direction: 'Topic',
      language: 'Language',
      name: 'Name',
      email: 'Email',
      replyInstruction: 'To reply, please use the Reply function of this email.',
      phone: 'Phone',
      service: 'Service',
      date: 'Date',
      time: 'Time',
      file: 'File',
      payment: 'Payment',
      message: 'Message',
      promotion: 'Offer',
      petName: 'Pet name',
      petSpecies: 'Pet type',
      petBreed: 'Breed',
      petAge: 'Age/date of birth',
      petSex: 'Sex',
      petTag: 'Tag/token number',
    },
  },
  ru: {
    bookingSubject: 'Ваша заявка на запись в HUNDESALON_NIKA',
    bookingThanks: 'Спасибо за вашу заявку на запись.',
    field: {
      form: 'Форма',
      direction: 'Тема',
      language: 'Язык',
      name: 'Имя',
      email: 'Электронная почта',
      replyInstruction: 'Для ответа клиенту используйте кнопку «Ответить» в этом письме.',
      phone: 'Телефон',
      service: 'Услуга',
      date: 'Дата',
      time: 'Время',
      file: 'Файл',
      payment: 'Оплата',
      message: 'Сообщение',
      promotion: 'Акция',
      petName: 'Имя питомца',
      petSpecies: 'Вид животного',
      petBreed: 'Порода',
      petAge: 'Возраст/дата рождения',
      petSex: 'Пол',
      petTag: 'Номер жетона/адресника',
    },
  },
  uk: {
    bookingSubject: 'Ваша заявка на запис у HUNDESALON_NIKA',
    bookingThanks: 'Дякуємо за вашу заявку на запис.',
    field: {
      form: 'Форма',
      direction: 'Тема',
      language: 'Мова',
      name: 'Ім’я',
      email: 'Електронна пошта',
      replyInstruction: 'Для відповіді клієнту використовуйте кнопку «Відповісти» в цьому листі.',
      phone: 'Телефон',
      service: 'Послуга',
      date: 'Дата',
      time: 'Час',
      file: 'Файл',
      payment: 'Оплата',
      message: 'Повідомлення',
      promotion: 'Акція',
      petName: 'Ім’я тварини',
      petSpecies: 'Вид тварини',
      petBreed: 'Порода',
      petAge: 'Вік/дата народження',
      petSex: 'Стать',
      petTag: 'Номер жетона/адресника',
    },
  },
};

const ADMIN_EMAIL_COPY = {
  de: {
    intro: 'Admin-Kopie der Website-Anfrage.',
    reply: 'Antworten an Kunden bitte nur über den Support-Kanal.',
  },
  en: {
    intro: 'Admin copy of the website request.',
    reply: 'Please reply to clients only through the support channel.',
  },
  ru: {
    intro: 'Административная копия обращения с сайта.',
    reply: 'Отвечайте клиентам только через канал поддержки.',
  },
  uk: {
    intro: 'Адміністративна копія звернення із сайту.',
    reply: 'Відповідайте клієнтам лише через канал підтримки.',
  },
};

const BOOKING_META_COPY = {
  de: {
    clientType: 'Kundenstatus',
    coatCondition: 'Fellzustand',
    behaviour: 'Verhalten',
    estimatedDuration: 'Voraussichtliche Dauer',
    buffer: 'Interne Reserve',
    safeBlock: 'Sicher blockiert bis',
    confirmation: 'Bestätigungsmodus',
    requested: 'Anfrage zur Bestätigung',
    newClient: 'Erstbesuch / neuer Kunde',
    returningClient: 'Stammkunde',
  },
  en: {
    clientType: 'Client status',
    coatCondition: 'Coat condition',
    behaviour: 'Behaviour',
    estimatedDuration: 'Estimated duration',
    buffer: 'Internal reserve',
    safeBlock: 'Safely blocked until',
    confirmation: 'Confirmation mode',
    requested: 'Request for confirmation',
    newClient: 'First visit / new client',
    returningClient: 'Returning client',
  },
  ru: {
    clientType: 'Статус клиента',
    coatCondition: 'Состояние шерсти',
    behaviour: 'Поведение',
    estimatedDuration: 'Ориентировочная длительность',
    buffer: 'Внутренний резерв',
    safeBlock: 'Безопасно занято до',
    confirmation: 'Режим подтверждения',
    requested: 'Запрос на подтверждение',
    newClient: 'Первое посещение / новый клиент',
    returningClient: 'Постоянный клиент',
  },
  uk: {
    clientType: 'Статус клієнта',
    coatCondition: 'Стан шерсті',
    behaviour: 'Поведінка',
    estimatedDuration: 'Орієнтовна тривалість',
    buffer: 'Внутрішній резерв',
    safeBlock: 'Безпечно зайнято до',
    confirmation: 'Режим підтвердження',
    requested: 'Запит на підтвердження',
    newClient: 'Перший візит / новий клієнт',
    returningClient: 'Постійний клієнт',
  },
};

const BOOKING_VALUE_COPY = {
  de: {
    coat: {
      good: 'Guter Zustand',
      slight_mats: 'Einige kleine Verfilzungen',
      many_mats: 'Viele Verfilzungen',
      severe_matting: 'Stark verfilztes Fell',
    },
    behaviour: {
      calm: 'Ruhig',
      restless: 'Unruhig',
      very_restless: 'Sehr unruhig',
      aggressive: 'Kann aggressiv reagieren',
    },
  },
  en: {
    coat: {
      good: 'Good condition',
      slight_mats: 'A few small mats',
      many_mats: 'Many mats',
      severe_matting: 'Severe matting',
    },
    behaviour: {
      calm: 'Calm',
      restless: 'Restless',
      very_restless: 'Very restless',
      aggressive: 'May show aggression',
    },
  },
  ru: {
    coat: {
      good: 'Хорошее состояние',
      slight_mats: 'Есть небольшие колтуны',
      many_mats: 'Много колтунов',
      severe_matting: 'Сильное сваливание шерсти',
    },
    behaviour: {
      calm: 'Спокойный',
      restless: 'Беспокойный',
      very_restless: 'Очень беспокойный',
      aggressive: 'Может проявлять агрессию',
    },
  },
  uk: {
    coat: {
      good: 'Добрий стан',
      slight_mats: 'Є невеликі ковтуни',
      many_mats: 'Багато ковтунів',
      severe_matting: 'Сильне звалювання шерсті',
    },
    behaviour: {
      calm: 'Спокійний',
      restless: 'Неспокійний',
      very_restless: 'Дуже неспокійний',
      aggressive: 'Може проявляти агресію',
    },
  },
};

/**
 * Sanitizes a string: trims whitespace, strips HTML tags.
 * @param {string} val
 * @returns {string}
 */
function sanitize(val) {
  return String(val ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeLimit(val, maxLength) {
  return sanitize(val).slice(0, maxLength);
}

function hasExplicitConsent(value) {
  return ['1', 'true', 'on', 'yes'].includes(
    String(value ?? '')
      .trim()
      .toLowerCase()
  );
}

/**
 * Basic email format validation.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function isInboundMailbox(email) {
  return isValidEmail(email) && email.toLowerCase() !== 'info@hundesalon-nika.com';
}

function paymentsOnlineEnabled(env) {
  if (ONLINE_PAYMENTS_HARD_DISABLED) return false;
  const raw = String(getEnvValue(env, 'PAYMENTS_ONLINE_ENABLED') || '')
    .trim()
    .toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
}

async function verifyStripeBookingSession(env, sessionId, booking) {
  const secret = getEnvValue(env, 'STRIPE_SECRET_KEY') || getEnvValue(env, 'PAYMENT_PROVIDER_KEY');
  if (!hasUsableValue(secret) || !sessionId.startsWith('cs_')) return false;
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!response.ok) return false;
  const session = await response.json().catch(() => null);
  if (!session || session.payment_status !== 'paid' || session.currency !== 'eur') return false;

  const expectedAmount = Number(getEnvValue(env, 'STRIPE_DEPOSIT_AMOUNT_CENTS') || 2000);
  const metadata = session.metadata || {};
  const sessionEmail = sanitize(
    metadata.email || session.customer_details?.email || session.customer_email
  ).toLowerCase();
  return (
    Number.isFinite(expectedAmount) &&
    session.amount_total === Math.round(expectedAmount) &&
    metadata.payment_kind === 'booking_deposit' &&
    sessionEmail === booking.email.toLowerCase() &&
    sanitize(metadata.service) === booking.service &&
    sanitize(metadata.date) === booking.date &&
    sanitize(metadata.time) === booking.time
  );
}

function getSalonRecipient(env, formType) {
  const bookingRecipient = getEnvValue(env, 'BOOKING_RECIPIENT_EMAIL');
  const contactRecipient = getEnvValue(env, 'CONTACT_RECIPIENT_EMAIL');
  const fallbackRecipient = getEnvValue(env, 'SALON_EMAIL', DEFAULT_RECIPIENT);

  if (formType === 'booking') {
    if (isInboundMailbox(bookingRecipient)) return bookingRecipient;
    return DEFAULT_BOOKING_RECIPIENT;
  }
  if (isInboundMailbox(contactRecipient)) return contactRecipient;
  return isInboundMailbox(fallbackRecipient) ? fallbackRecipient : DEFAULT_RECIPIENT;
}

function uniqueEmailList(items) {
  const seen = new Set();
  return items
    .map(item => sanitize(item).toLowerCase())
    .filter(item => {
      if (!isValidEmail(item) || seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

function getAdminEmails(env) {
  return uniqueEmailList(getEnvList(env, 'ADMIN_NOTIFICATION_EMAILS', DEFAULT_ADMIN_EMAILS.join(',')));
}

function getSupportReplyTo(env, fallback = DEFAULT_SUPPORT) {
  const supportEmail = getEnvValue(env, 'SUPPORT_REPLY_TO_EMAIL') || getEnvValue(env, 'SUPPORT_EMAIL') || fallback;
  return isValidEmail(supportEmail) ? supportEmail : fallback;
}

function getClientEmailFrom(env, fallback = DEFAULT_CLIENT_FROM) {
  return getEnvValue(env, 'CLIENT_EMAIL_FROM') || fallback;
}

/**
 * Builds a compact, readable Slack payload for website leads.
 * @param {object} data
 * @returns {{ text: string, blocks: object[] }}
 */
function buildSlackPayload(data) {
  const lines = [
    `Форма: ${data.formType}`,
    `Язык: ${data.lang}`,
    `Имя: ${data.name}`,
    `E-mail: ${data.email}`,
    data.phone ? `Телефон: ${data.phone}` : null,
    data.service ? `Услуга: ${data.service}` : null,
    data.date ? `Дата: ${data.date}` : null,
    data.time ? `Время: ${data.time}` : null,
    data.bookingStatus ? `Статус: ${data.bookingStatus}` : null,
    data.clientType ? `Статус клиента: ${data.clientType}` : null,
    data.coatCondition ? `Состояние шерсти: ${data.coatCondition}` : null,
    data.behaviour ? `Поведение: ${data.behaviour}` : null,
    data.estimatedDurationMinutes ? `Ориентировочная длительность: ${data.estimatedDurationMinutes} мин` : null,
    data.bookingBufferMinutes ? `Внутренний резерв: ${data.bookingBufferMinutes} мин` : null,
    data.safeBlockMinutes ? `Безопасный блок: ${data.safeBlockMinutes} мин` : null,
    data.fileUrl ? `Файл: ${data.fileUrl}` : null,
    data.paymentStatus ? `Оплата: ${data.paymentStatus}` : null,
    data.promotion ? `Акция: ${data.promotion}` : null,
    data.petName ? `Питомец: ${data.petName}` : null,
    data.petBreed ? `Порода: ${data.petBreed}` : null,
    data.petTagNumber ? `Номер жетона: ${data.petTagNumber}` : null,
    data.pagePath ? `Страница: ${data.pagePath}` : null,
  ].filter(line => line !== null);

  const title =
    data.level === 'error'
      ? ':rotating_light: Ошибка отправки формы на сайте'
      : ':dog: Новая заявка с сайта HUNDESALON NIKA';

  const messagePreview = String(data.message || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 700);

  return {
    text: `${title}\n${lines.join('\n')}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: title.replace(/:[^\s:]+:/g, '').trim(),
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: lines.map(line => `• ${line}`).join('\n'),
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Сообщение:*\n${messagePreview || '—'}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Источник: ${data.origin || 'unknown'} | ${new Date().toISOString()}`,
          },
        ],
      },
    ],
  };
}

/**
 * Sends a message to Slack if SLACK_WEBHOOK_URL is configured.
 * @param {any} env
 * @param {object} payload
 */
async function sendSlackNotification(env, payload) {
  if (!siteNotificationsEnabled(env)) return false;
  const webhook = String(env?.SLACK_WEBHOOK_URL || '').trim();
  if (!webhook) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SLACK_TIMEOUT_MS);

  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return response.ok;
  } catch (err) {
    console.warn('[sendmail] Slack notify failed:', err?.message || err);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function buildTelegramNotification(data) {
  const lines = [
    data.level === 'error' ? '⚠️ Ошибка обработки заявки' : '🐕 Новая заявка с сайта HUNDESALON NIKA',
    `Форма: ${data.formType}`,
    `Язык: ${data.lang}`,
    `Имя: ${data.name}`,
    `E-mail: ${data.email}`,
    data.phone ? `Телефон: ${data.phone}` : null,
    data.service ? `Услуга: ${data.service}` : null,
    data.date ? `Дата: ${data.date}` : null,
    data.time ? `Время: ${data.time}` : null,
    data.paymentStatus ? `Оплата: ${data.paymentStatus}` : null,
    data.promotion ? `Акция: ${data.promotion}` : null,
    data.petName ? `Питомец: ${data.petName}` : null,
    data.petBreed ? `Порода: ${data.petBreed}` : null,
    data.petTagNumber ? `Номер жетона: ${data.petTagNumber}` : null,
    data.pagePath ? `Страница: ${data.pagePath}` : null,
    '',
    `Сообщение: ${data.message || '—'}`,
  ];
  return lines.filter(line => line !== null).join('\n');
}

/**
 * Main handler — called for every HTTP method.
 * @param {import('@cloudflare/workers-types').EventContext} ctx
 */
export async function onRequest(ctx) {
  const { request, env } = ctx;

  /* ── Allow only POST ──────────────────────────────────────── */
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'POST' },
    });
  }

  /* ── Origin check (CSRF mitigation) ──────────────────────── */
  const originCheck = assertAllowedOrigin(request);
  if (!originCheck.ok) {
    return jsonResponse({ success: false, message: 'Forbidden' }, 403);
  }
  const { origin } = originCheck;

  const rateLimited = await enforceRateLimit(request, {
    route: 'sendmail',
    limit: 12,
    windowSec: 60,
  });
  if (rateLimited) {
    return jsonResponse({ success: false, message: 'Too many requests. Please try again later.' }, 429, origin);
  }

  /* ── Parse form data ───────────────────────────────────────── */
  let fields;
  try {
    const ct = request.headers.get('Content-Type') ?? '';
    if (ct.includes('application/json')) {
      fields = await request.json();
    } else {
      const fd = await request.formData();
      fields = Object.fromEntries(fd.entries());
    }
  } catch {
    return jsonResponse({ success: false, message: 'Invalid request body' }, 400);
  }

  /* ── Extract and sanitize fields ───────────────────────────── */
  const name = sanitizeLimit(fields.name, 160);
  const email = sanitizeLimit(fields.email, 254);
  const phone = sanitizeLimit(fields.phone, 80);
  const message = sanitizeLimit(fields.message, 2000);
  const requestedLang = sanitizeLimit(fields.lang, 2).toLowerCase();
  const lang = ['de', 'en', 'ru', 'uk'].includes(requestedLang) ? requestedLang : 'de';
  const requestedFormType = sanitizeLimit(fields.form_type, 40).toLowerCase();
  const formType = ['booking', 'contact', 'feedback', CLIENT_REGISTRATION_FORM_TYPE].includes(requestedFormType)
    ? requestedFormType
    : 'contact';
  const service = sanitizeLimit(fields.service, 240);
  const servicePrice = sanitizeLimit(fields.service_price, 80);
  const serviceCategory = sanitizeLimit(fields.service_category, 180);
  const date = sanitizeLimit(fields.date, 32);
  const time = sanitizeLimit(fields.time, 16);
  const rawClientType = sanitizeLimit(fields.booking_client_type, 24).toLowerCase();
  const clientType = BOOKING_CLIENT_TYPES.has(rawClientType) ? rawClientType : 'new';
  const rawCoatCondition = sanitizeLimit(fields.coat_condition, 32).toLowerCase();
  const coatCondition = BOOKING_COAT_CONDITIONS.has(rawCoatCondition) ? rawCoatCondition : 'good';
  const rawBehaviour = sanitizeLimit(fields.behavior, 32).toLowerCase();
  const behaviour = BOOKING_BEHAVIOURS.has(rawBehaviour) ? rawBehaviour : 'calm';
  const estimatedDurationMinutes = clampBookingMinutes(fields.service_duration_minutes, 180, 15, 360);
  const bookingBufferMinutes = clampBookingMinutes(fields.booking_buffer_minutes, 30, 10, 90);
  const requestedSafeBlockMinutes = clampBookingMinutes(
    fields.booking_safe_block_minutes,
    estimatedDurationMinutes + bookingBufferMinutes,
    25,
    450
  );
  const minimumRiskDuration =
    (clientType === 'returning' ? 0 : 15) +
    (BOOKING_COAT_EXTRA_MINUTES[coatCondition] || 0) +
    (BOOKING_BEHAVIOUR_EXTRA_MINUTES[behaviour] || 0);
  const safeEstimatedDurationMinutes = Math.max(estimatedDurationMinutes, 15 + minimumRiskDuration);
  const safeBlockMinutes = Math.max(requestedSafeBlockMinutes, safeEstimatedDurationMinutes + bookingBufferMinutes);
  const uploadedFileUrl = sanitizeLimit(fields.uploaded_file_url || fields.file_url, 500);
  const source = sanitizeLimit(fields.source || fields.page || request.headers.get('Referer') || 'website', 500);
  const inquiryType = sanitizeLimit(fields.inquiry_type, 40);
  const paymentChoice = sanitizeLimit(fields.payment_choice || fields.payment_method || '', 40);
  const stripeSessionId = sanitizeLimit(fields.stripe_session_id, 200);
  const promotionKey = '';
  const petName = sanitizeLimit(fields.pet_name, 120);
  const petSpecies = sanitizeLimit(fields.pet_species, 40).toLowerCase();
  const petBreed = sanitizeLimit(fields.pet_breed, 160);
  const petAge = sanitizeLimit(fields.pet_age, 80);
  const petSex = sanitizeLimit(fields.pet_sex, 40);
  const petTagNumber = sanitizeLimit(fields.pet_tag_number, 60);
  const clientRegistrationId = sanitizeLimit(fields.client_registration_id, 120);
  const clientRecordRequired =
    formType === CLIENT_REGISTRATION_FORM_TYPE || (formType === 'booking' && !clientRegistrationId);
  const paymentNow = sanitizeLimit(fields.payment_now || fields.pay_now, 10) === 'on' || paymentChoice === 'online';
  const privacyConsent = hasExplicitConsent(fields.privacy_consent);
  const agbConsent = hasExplicitConsent(fields.agb_consent);
  const canonicalService = service;

  let stripePaymentVerified = false;
  if (paymentNow || stripeSessionId) {
    if (!paymentsOnlineEnabled(env) || !stripeSessionId) {
      return jsonResponse({ success: false, message: 'Online payment is unavailable' }, 400, origin);
    }
    stripePaymentVerified = await verifyStripeBookingSession(env, stripeSessionId, {
      email,
      service,
      date,
      time,
    });
    if (!stripePaymentVerified) {
      return jsonResponse({ success: false, message: 'Online payment could not be verified' }, 400, origin);
    }
  }

  const paymentStatus = paymentNow
    ? stripePaymentVerified
      ? `paid_online:${stripeSessionId}`
      : 'online_deposit_pending'
    : paymentChoice === 'salon_card'
      ? 'pay_at_salon_card'
      : paymentChoice === 'salon_cash'
        ? 'pay_at_salon_cash'
        : 'pay_at_salon';

  const copy = COPY[lang] ?? COPY.de;
  const emailCopy = EMAIL_COPY[lang] ?? EMAIL_COPY.de;
  const requestUrl = new URL(request.url);
  const recipient = getSalonRecipient(env, formType);
  const senderFrom = getEnvValue(env, 'SENDPULSE_FROM', DEFAULT_FROM);
  const supportReplyTo = getSupportReplyTo(env, recipient);
  const clientEmailFrom = getClientEmailFrom(env, senderFrom);
  const adminRecipients = getAdminEmails(env);

  /* ── Validate required fields ──────────────────────────────── */
  if (!name || !email) {
    return jsonResponse({ success: false, message: copy.error }, 400, origin);
  }
  if (!isValidEmail(email)) {
    return jsonResponse({ success: false, message: copy.error }, 400, origin);
  }

  if (formType === 'booking') {
    if (!service || !date || !time) {
      return jsonResponse({ success: false, message: copy.error }, 400, origin);
    }
    if (!isValidBookingWindow(date, time)) {
      return jsonResponse({ success: false, message: copy.error }, 400, origin);
    }
    if (!phone) {
      return jsonResponse({ success: false, message: copy.error }, 400, origin);
    }
    if (!petName || !petBreed || !REGISTRATION_PET_SPECIES.has(petSpecies)) {
      return jsonResponse({ success: false, message: copy.error }, 400, origin);
    }
    if (!privacyConsent) {
      return jsonResponse({ success: false, message: copy.error }, 400, origin);
    }
    if (!agbConsent) {
      return jsonResponse({ success: false, message: copy.error }, 400, origin);
    }
  } else if (formType === CLIENT_REGISTRATION_FORM_TYPE) {
    if (!canonicalService || !petName || !petBreed || !REGISTRATION_PET_SPECIES.has(petSpecies)) {
      return jsonResponse({ success: false, message: copy.error }, 400, origin);
    }
    if (!privacyConsent || !agbConsent) {
      return jsonResponse({ success: false, message: copy.error }, 400, origin);
    }
  } else if (!message) {
    return jsonResponse({ success: false, message: copy.error }, 400, origin);
  }

  const bookingMetaCopy = BOOKING_META_COPY[lang] || BOOKING_META_COPY.en;
  const bookingValueCopy = BOOKING_VALUE_COPY[lang] || BOOKING_VALUE_COPY.en;
  const bookingStatus = formType === 'booking' ? bookingMetaCopy.requested : '';
  const safeBlockEndDateTime = formType === 'booking' ? addLocalMinutes(date, time, safeBlockMinutes) : '';
  const clientTypeLabel = clientType === 'returning' ? bookingMetaCopy.returningClient : bookingMetaCopy.newClient;

  const registrationSummary =
    formType === CLIENT_REGISTRATION_FORM_TYPE
      ? [
          `Service: ${canonicalService}`,
          servicePrice ? `Estimated price: ${servicePrice}` : null,
          serviceCategory ? `Category: ${serviceCategory}` : null,
          `Pet name: ${petName}`,
          `Pet type: ${petSpecies}`,
          `Breed: ${petBreed}`,
          petAge ? `Age/date of birth: ${petAge}` : null,
          petSex ? `Sex: ${petSex}` : null,
          petTagNumber ? `Tag/token number: ${petTagNumber}` : 'Tag/token number: not provided',
          message ? `Additional notes: ${message}` : null,
        ]
          .filter(Boolean)
          .join('\n')
      : '';
  const resolvedMessage =
    registrationSummary ||
    message ||
    (formType === 'booking' ? `Booking request: ${service} on ${date} at ${time}` : '');
  const submittedAt = new Date().toISOString();
  const automationEventType =
    formType === 'booking' ? 'booking' : formType === CLIENT_REGISTRATION_FORM_TYPE ? 'client_registration' : 'contact';
  const automationEventData = {
    email,
    phone,
    name,
    language: lang,
    service_type: canonicalService,
    service_price: servicePrice,
    service_category: serviceCategory,
    promotion_key: promotionKey,
    promotion: '',
    lead_source: source,
    form_type: formType,
    inquiry_type: inquiryType,
    appointment_date: date,
    appointment_time: time,
    booking_status: bookingStatus,
    booking_client_type: formType === 'booking' ? clientType : '',
    coat_condition: formType === 'booking' ? coatCondition : '',
    behavior: formType === 'booking' ? behaviour : '',
    service_duration_minutes: formType === 'booking' ? String(safeEstimatedDurationMinutes) : '',
    booking_buffer_minutes: formType === 'booking' ? String(bookingBufferMinutes) : '',
    booking_safe_block_minutes: formType === 'booking' ? String(safeBlockMinutes) : '',
    payment_status: formType === 'booking' ? paymentStatus : '',
    client_registration_id: clientRegistrationId,
    privacy_consent: ['booking', CLIENT_REGISTRATION_FORM_TYPE].includes(formType) && privacyConsent ? 'yes' : '',
    agb_consent: ['booking', CLIENT_REGISTRATION_FORM_TYPE].includes(formType) && agbConsent ? 'yes' : '',
    file_url: uploadedFileUrl,
    pet_name: petName,
    pet_species: petSpecies,
    pet_breed: petBreed,
    pet_age: petAge,
    pet_sex: petSex,
    pet_tag_number: petTagNumber,
    message: resolvedMessage,
    source_url: source,
    page_path: requestUrl.pathname,
    site_origin: origin,
    submitted_at: submittedAt,
    request_id: crypto.randomUUID(),
  };

  const slackLeadPayload = buildSlackPayload({
    level: 'info',
    formType,
    lang,
    name,
    email,
    phone,
    service: canonicalService,
    date,
    time,
    bookingStatus,
    clientType: formType === 'booking' ? clientTypeLabel : '',
    coatCondition: formType === 'booking' ? coatCondition : '',
    behaviour: formType === 'booking' ? behaviour : '',
    estimatedDurationMinutes: formType === 'booking' ? safeEstimatedDurationMinutes : 0,
    bookingBufferMinutes: formType === 'booking' ? bookingBufferMinutes : 0,
    safeBlockMinutes: formType === 'booking' ? safeBlockMinutes : 0,
    fileUrl: uploadedFileUrl,
    paymentStatus,
    promotion: '',
    petName,
    petBreed,
    petTagNumber,
    message: resolvedMessage,
    origin,
    pagePath: requestUrl.pathname,
  });

  if (resolvedMessage.length > 2000) {
    return jsonResponse({ success: false, message: copy.error }, 400, origin);
  }

  /* ── Build email ───────────────────────────────────────────── */
  const subjects = {
    de: {
      booking: 'Neue Buchungsanfrage — HUNDESALON_NIKA',
      client_registration: 'Neue Kunden- und Tierregistrierung — HUNDESALON_NIKA',
      feedback: 'Bewertung von der Website — HUNDESALON_NIKA',
      contact: 'Neue Kontaktanfrage — HUNDESALON_NIKA',
    },
    en: {
      booking: 'New booking request — HUNDESALON_NIKA',
      client_registration: 'New client and pet registration — HUNDESALON_NIKA',
      feedback: 'Website feedback — HUNDESALON_NIKA',
      contact: 'New contact request — HUNDESALON_NIKA',
    },
    ru: {
      booking: 'Новая заявка на запись — HUNDESALON_NIKA',
      client_registration: 'Новая регистрация клиента и питомца — HUNDESALON_NIKA',
      feedback: 'Отзыв с сайта — HUNDESALON_NIKA',
      contact: 'Новое обращение с сайта — HUNDESALON_NIKA',
    },
    uk: {
      booking: 'Нова заявка на запис — HUNDESALON_NIKA',
      client_registration: 'Нова реєстрація клієнта і тварини — HUNDESALON_NIKA',
      feedback: 'Відгук із сайту — HUNDESALON_NIKA',
      contact: 'Нове звернення із сайту — HUNDESALON_NIKA',
    },
  };
  const inquiryLabelsByLang = {
    de: {
      booking: 'Termin vereinbaren',
      grooming: 'Frage zu Grooming',
      feedback: 'Feedback',
      partnership: 'Partnerschaft',
      general: 'Allgemeine Frage',
    },
    en: {
      booking: 'Book an appointment',
      grooming: 'Grooming question',
      feedback: 'Feedback',
      partnership: 'Partnership',
      general: 'General question',
    },
    ru: {
      booking: 'Запись на услугу',
      grooming: 'Вопрос о груминге',
      feedback: 'Отзыв и обратная связь',
      partnership: 'Партнёрство',
      general: 'Общий вопрос',
    },
    uk: {
      booking: 'Запис на послугу',
      grooming: 'Питання про грумінг',
      feedback: 'Відгук',
      partnership: 'Партнерство',
      general: 'Загальне питання',
    },
  };
  const inquiryLabel = inquiryLabelsByLang[lang]?.[inquiryType] || '';
  const subject = `${subjects[lang]?.[formType] ?? subjects.de[formType] ?? subjects.de.contact}${inquiryLabel ? ` — ${inquiryLabel}` : ''}`;

  const bodyLines = [
    `${emailCopy.field.form}: ${formType}`,
    inquiryLabel ? `${emailCopy.field.direction}: ${inquiryLabel}` : null,
    `${emailCopy.field.language}: ${lang}`,
    `${emailCopy.field.name}: ${name}`,
    emailCopy.field.replyInstruction,
    phone ? `${emailCopy.field.phone}: ${phone}` : null,
    canonicalService ? `${emailCopy.field.service}: ${canonicalService}` : null,
    date ? `${emailCopy.field.date}: ${date}` : null,
    time ? `${emailCopy.field.time}: ${time}` : null,
    formType === 'booking' ? `${bookingMetaCopy.clientType}: ${clientTypeLabel}` : null,
    formType === 'booking' ? `${bookingMetaCopy.coatCondition}: ${bookingValueCopy.coat[coatCondition]}` : null,
    formType === 'booking' ? `${bookingMetaCopy.behaviour}: ${bookingValueCopy.behaviour[behaviour]}` : null,
    formType === 'booking' ? `${bookingMetaCopy.estimatedDuration}: ${safeEstimatedDurationMinutes} min` : null,
    formType === 'booking' ? `${bookingMetaCopy.buffer}: ${bookingBufferMinutes} min` : null,
    formType === 'booking' ? `${bookingMetaCopy.safeBlock}: ${safeBlockEndDateTime}` : null,
    formType === 'booking' ? `${bookingMetaCopy.confirmation}: ${bookingStatus}` : null,
    uploadedFileUrl ? `${emailCopy.field.file}: ${uploadedFileUrl}` : null,
    formType === 'booking' ? `${emailCopy.field.payment}: ${paymentStatus}` : null,
    petName ? `${emailCopy.field.petName}: ${petName}` : null,
    petSpecies ? `${emailCopy.field.petSpecies}: ${petSpecies}` : null,
    petBreed ? `${emailCopy.field.petBreed}: ${petBreed}` : null,
    petAge ? `${emailCopy.field.petAge}: ${petAge}` : null,
    petSex ? `${emailCopy.field.petSex}: ${petSex}` : null,
    petTagNumber ? `${emailCopy.field.petTag}: ${petTagNumber}` : null,
    '',
    `${emailCopy.field.message}:`,
    resolvedMessage,
  ].filter(l => l !== null);

  const textBody = bodyLines.join('\n');

  const runBookingIntegrations = async () => {
    if (formType !== 'booking') {
      return [];
    }

    const startDateTime = `${date}T${time}:00`;
    const endDateTime = safeBlockEndDateTime;
    const bookingSummary = [
      `${emailCopy.field.name}: ${name}`,
      `${emailCopy.field.email}: ${email}`,
      phone ? `${emailCopy.field.phone}: ${phone}` : null,
      `${emailCopy.field.service}: ${service}`,
      `${emailCopy.field.date}: ${date}`,
      `${emailCopy.field.time}: ${time}`,
      `${bookingMetaCopy.clientType}: ${clientTypeLabel}`,
      `${bookingMetaCopy.coatCondition}: ${bookingValueCopy.coat[coatCondition]}`,
      `${bookingMetaCopy.behaviour}: ${bookingValueCopy.behaviour[behaviour]}`,
      `${bookingMetaCopy.estimatedDuration}: ${safeEstimatedDurationMinutes} min`,
      `${bookingMetaCopy.buffer}: ${bookingBufferMinutes} min`,
      `${bookingMetaCopy.safeBlock}: ${safeBlockEndDateTime}`,
      `${bookingMetaCopy.confirmation}: ${bookingStatus}`,
      `${emailCopy.field.payment}: ${paymentStatus}`,
      uploadedFileUrl ? `${emailCopy.field.file}: ${uploadedFileUrl}` : null,
      `${emailCopy.field.petName}: ${petName}`,
      `${emailCopy.field.petSpecies}: ${petSpecies}`,
      `${emailCopy.field.petBreed}: ${petBreed}`,
      petAge ? `${emailCopy.field.petAge}: ${petAge}` : null,
      petSex ? `${emailCopy.field.petSex}: ${petSex}` : null,
      petTagNumber ? `${emailCopy.field.petTag}: ${petTagNumber}` : null,
      '',
      `${emailCopy.field.message}:`,
      resolvedMessage,
    ]
      .filter(Boolean)
      .join('\n');

    const results = await Promise.allSettled([
      createGoogleCalendarEvent(env, {
        calendarId: getEnvValue(env, 'GOOGLE_CALENDAR_ID', 'primary'),
        summary: `HUNDESALON NIKA: ${service} — ${name}`,
        description: bookingSummary,
        startDateTime,
        endDateTime,
        status: 'tentative',
      }),
      appendGoogleSheetRow(env, {
        spreadsheetId: getEnvValue(env, 'SHEET_ID'),
        sheetName: 'bookings',
        values: [
          new Date().toISOString(),
          lang,
          formType,
          name,
          email,
          phone,
          service,
          date,
          time,
          uploadedFileUrl,
          paymentStatus,
          resolvedMessage,
          clientRegistrationId,
          petName,
          petSpecies,
          petBreed,
          petAge,
          petSex,
          petTagNumber,
          servicePrice,
          serviceCategory,
          bookingStatus,
          clientType,
          coatCondition,
          behaviour,
          safeEstimatedDurationMinutes,
          bookingBufferMinutes,
          safeBlockMinutes,
        ],
      }),
      sendSendPulseEmail(env, {
        to: email,
        subject: emailCopy.bookingSubject,
        text: `${emailCopy.bookingThanks}\n\n${bookingSummary}`,
        html: buildBrandedEmail({
          title: emailCopy.bookingSubject,
          bodyText: `${emailCopy.bookingThanks}\n\n${bookingSummary}`,
          lang,
        }),
        replyTo: supportReplyTo,
        from: clientEmailFrom,
      }),
      upsertSendPulseContact(env, { email, name, phone, lang, service, source, formType }),
    ]);

    return results.map(result =>
      result.status === 'fulfilled' ? result.value : { ok: false, error: result.reason?.message || 'failed' }
    );
  };

  const runClientRegistrationIntegration = async () => {
    const shouldStoreClientRecord =
      formType === CLIENT_REGISTRATION_FORM_TYPE || (formType === 'booking' && !clientRegistrationId);
    if (!shouldStoreClientRecord) {
      return [];
    }

    try {
      const result = await appendGoogleSheetRow(env, {
        spreadsheetId: getEnvValue(env, 'SHEET_ID'),
        sheetName: CLIENT_REGISTRATION_SHEET,
        values: [
          submittedAt,
          automationEventData.request_id,
          lang,
          formType,
          canonicalService,
          servicePrice,
          serviceCategory,
          promotionKey,
          '',
          '',
          name,
          email,
          phone,
          petName,
          petSpecies,
          petBreed,
          petAge,
          petSex,
          petTagNumber,
          message,
          privacyConsent ? 'yes' : 'no',
          agbConsent ? 'yes' : 'no',
          source,
          origin,
          requestUrl.pathname,
        ],
      });
      return [result];
    } catch (error) {
      console.error(
        JSON.stringify({
          message: 'client registration sheet write failed',
          error: error instanceof Error ? error.message : String(error),
        })
      );
      return [{ ok: false, error: 'client registration sheet write failed' }];
    }
  };

  const sendAdminNotification = async () => {
    if (!siteNotificationsEnabled(env)) {
      return { ok: false, skipped: true, reason: 'Site notifications are disabled.' };
    }
    if (adminRecipients.length === 0) {
      return { ok: false, skipped: true, reason: 'Admin notification recipients are not configured.' };
    }

    const adminCopy = ADMIN_EMAIL_COPY[lang] || ADMIN_EMAIL_COPY.de;
    const adminText = [adminCopy.intro, adminCopy.reply, '', textBody].join('\n');

    return sendSendPulseEmail(env, {
      to: adminRecipients,
      subject: `[Admin] ${subject}`,
      text: adminText,
      html: buildBrandedEmail({ title: subject, bodyText: adminText, lang }),
      replyTo: supportReplyTo,
      from: senderFrom,
    });
  };

  /* ── Send via SendPulse API ───────────────────────────────── */
  const hasSendPulseCredentials =
    Boolean(getEnvValue(env, 'SENDPULSE_API_KEY')) ||
    Boolean(getEnvValue(env, 'SENDPULSE_CLIENT_ID') && getEnvValue(env, 'SENDPULSE_CLIENT_SECRET'));
  if (!hasSendPulseCredentials) {
    console.error('[sendmail] SendPulse credentials not configured');
    const slackDelivered = await sendSlackNotification(env, slackLeadPayload);
    const telegramDelivered = await sendTelegramMessage(env, {
      text: buildTelegramNotification({
        formType,
        lang,
        name,
        email,
        phone,
        service: canonicalService,
        date,
        time,
        paymentStatus,
        promotion: '',
        petName,
        petBreed,
        petTagNumber,
        message: resolvedMessage,
        pagePath: requestUrl.pathname,
      }),
      category: formType === 'booking' ? 'orders' : 'messages',
    });
    const integrationResults = [...(await runBookingIntegrations()), ...(await runClientRegistrationIntegration())];
    const integrationDelivered = integrationResults.some(result => result?.ok === true);
    const requiredDeliveryCompleted = clientRecordRequired
      ? integrationDelivered
      : slackDelivered || telegramDelivered.ok || integrationDelivered;
    if (requiredDeliveryCompleted) {
      console.warn('[sendmail] Delivered via fallback because SendPulse is not configured');
      return jsonResponse(
        {
          success: true,
          message: formType === CLIENT_REGISTRATION_FORM_TYPE ? copy.registrationSuccess : copy.success,
          ...(formType === CLIENT_REGISTRATION_FORM_TYPE ? { registration_id: automationEventData.request_id } : {}),
        },
        200,
        origin
      );
    }
    return jsonResponse({ success: false, message: copy.error }, 503, origin);
  }

  let sendPulseRes;
  try {
    sendPulseRes = await sendSendPulseEmail(env, {
      from: senderFrom,
      to: recipient,
      replyTo: email,
      subject,
      text: textBody,
      html: buildBrandedEmail({ title: subject, bodyText: textBody, lang }),
    });
  } catch (err) {
    console.error('[sendmail] Network error:', err);
    await sendSlackNotification(
      env,
      buildSlackPayload({
        level: 'error',
        formType,
        lang,
        name,
        email,
        phone,
        service: canonicalService,
        date,
        time,
        message: `Network error while sending via SendPulse: ${err?.message || 'unknown error'}`,
        origin,
        pagePath: requestUrl.pathname,
      })
    );
    return jsonResponse({ success: false, message: copy.error }, 502, origin);
  }

  if (sendPulseRes.ok) {
    const registrationResults = await runClientRegistrationIntegration();
    if (clientRecordRequired && !registrationResults.some(result => result?.ok === true)) {
      console.error(JSON.stringify({ message: 'client registration was not stored in the admin register' }));
      return jsonResponse({ success: false, message: copy.error }, 503, origin);
    }

    await Promise.allSettled([
      sendSendPulseAutomationEvent(env, {
        eventType: automationEventType,
        data: automationEventData,
      }),
      sendSlackNotification(env, slackLeadPayload),
      sendTelegramMessage(env, {
        text: buildTelegramNotification({
          formType,
          lang,
          name,
          email,
          phone,
          service: canonicalService,
          date,
          time,
          paymentStatus,
          promotion: '',
          petName,
          petBreed,
          petTagNumber,
          message: resolvedMessage,
          pagePath: requestUrl.pathname,
        }),
        category: formType === 'booking' ? 'orders' : 'messages',
      }),
      runBookingIntegrations(),
      sendAdminNotification(),
    ]);
    return jsonResponse(
      {
        success: true,
        message: formType === CLIENT_REGISTRATION_FORM_TYPE ? copy.registrationSuccess : copy.success,
        ...(formType === CLIENT_REGISTRATION_FORM_TYPE ? { registration_id: automationEventData.request_id } : {}),
      },
      200,
      origin
    );
  }

  const errBody = JSON.stringify(sendPulseRes.body || {});
  console.error('[sendmail] SendPulse error', sendPulseRes.status, errBody);
  await sendSlackNotification(
    env,
    buildSlackPayload({
      level: 'error',
      formType,
      lang,
      name,
      email,
      phone,
      service: canonicalService,
      date,
      time,
      message: `SendPulse error ${sendPulseRes.status}: ${errBody.slice(0, 600) || 'no details'}`,
      origin,
      pagePath: requestUrl.pathname,
    })
  );
  return jsonResponse({ success: false, message: copy.error }, 502, origin);
}
