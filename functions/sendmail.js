/**
 * Cloudflare Pages Function: POST /sendmail
 * ==========================================
 * Обрабатывает контактные формы и заявки на бронирование.
 *
 * Настройка (один раз в Cloudflare Dashboard):
 *   1. Зарегистрируйтесь на https://resend.com (бесплатно, 3000 писем/мес.)
 *   2. Подтвердите домен hundesalon-nika.com в Resend → Domains
 *   3. Создайте API-ключ на https://resend.com/api-keys
 *   4. В Cloudflare Pages → Settings → Environment variables
 *      добавьте секрет: RESEND_API_KEY = <ваш ключ>
 */

import { assertAllowedOrigin, enforceRateLimit, jsonResponse } from './_lib/http-security.js';
import {
  appendGoogleSheetRow,
  createGoogleCalendarEvent,
  getEnvList,
  getEnvValue,
  hasUsableValue,
  sendResendEmail,
  sendTeamsMessage,
} from './_lib/platform-integrations.js';

const DEFAULT_RECIPIENT = 'info@hundesalon-nika.com';
const DEFAULT_SUPPORT = 'support@hundesalon-nika.com';
const DEFAULT_FROM = 'Hundesalon Nika <noreply@hundesalon-nika.com>';
const DEFAULT_CLIENT_FROM = 'Hundesalon Nika <support@hundesalon-nika.com>';
const DEFAULT_ADMIN_EMAILS = ['snaiper1984@gmail.com', 'ryndenko1982@gmail.com'];
const SLACK_TIMEOUT_MS = 4500;
const RESEND_USER_AGENT = 'hundesalon-nika.com/1.0 (Cloudflare Pages Function)';

/** Строки для ответа на разных языках */
const COPY = {
  ru: {
    success: 'Сообщение отправлено! Мы свяжемся с вами в ближайшее время.',
    error: 'Ошибка при отправке. Пожалуйста, позвоните нам по телефону.',
  },
  uk: {
    success: "Повідомлення надіслано! Ми зв'яжемося з вами найближчим часом.",
    error: 'Помилка надсилання. Будь ласка, зателефонуйте нам.',
  },
  en: {
    success: 'Message sent! We will get back to you soon.',
    error: 'Failed to send. Please contact us by phone.',
  },
  de: {
    success: 'Ihre Nachricht wurde gesendet! Wir melden uns in Kürze.',
    error: 'Senden fehlgeschlagen. Bitte kontaktieren Sie uns telefonisch.',
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

/**
 * Basic email format validation.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function paymentsOnlineEnabled(env) {
  const raw = String(getEnvValue(env, 'PAYMENTS_ONLINE_ENABLED') || '').trim().toLowerCase();
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
  const sessionEmail = sanitize(metadata.email || session.customer_details?.email || session.customer_email).toLowerCase();
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

  if (formType === 'booking' && isValidEmail(bookingRecipient)) {
    return bookingRecipient;
  }
  if (isValidEmail(contactRecipient)) {
    return contactRecipient;
  }
  return isValidEmail(fallbackRecipient) ? fallbackRecipient : DEFAULT_RECIPIENT;
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
  const supportEmail =
    getEnvValue(env, 'SUPPORT_REPLY_TO_EMAIL') || getEnvValue(env, 'SUPPORT_EMAIL') || fallback;
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
    data.fileUrl ? `Файл: ${data.fileUrl}` : null,
    data.paymentStatus ? `Оплата: ${data.paymentStatus}` : null,
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
  const name = sanitize(fields.name);
  const email = sanitize(fields.email);
  const phone = sanitize(fields.phone);
  const message = sanitize(fields.message);
  const lang = sanitize(fields.lang).slice(0, 2) || 'de';
  const formType = sanitize(fields.form_type) || 'contact';
  const service = sanitize(fields.service);
  const date = sanitize(fields.date);
  const time = sanitize(fields.time);
  const uploadedFileUrl = sanitize(fields.uploaded_file_url || fields.file_url);
  const paymentChoice = sanitize(fields.payment_choice || fields.payment_method || '');
  const stripeSessionId = sanitize(fields.stripe_session_id);
  const paymentNow =
    sanitize(fields.payment_now || fields.pay_now) === 'on' || paymentChoice === 'online';
  const privacyConsent = sanitize(fields.privacy_consent);
  const agbConsent = sanitize(fields.agb_consent);

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
  const requestUrl = new URL(request.url);
  const recipient = getSalonRecipient(env, formType);
  const resendFrom = getEnvValue(env, 'RESEND_FROM', DEFAULT_FROM);
  const supportReplyTo = getSupportReplyTo(env, recipient);
  const clientEmailFrom = getClientEmailFrom(env, resendFrom);
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
    if (!phone) {
      return jsonResponse({ success: false, message: copy.error }, 400, origin);
    }
    if (!privacyConsent) {
      return jsonResponse({ success: false, message: copy.error }, 400, origin);
    }
    if (!agbConsent) {
      return jsonResponse({ success: false, message: copy.error }, 400, origin);
    }
  } else if (!message) {
    return jsonResponse({ success: false, message: copy.error }, 400, origin);
  }

  const resolvedMessage =
    message || (formType === 'booking' ? `Booking request: ${service} on ${date} at ${time}` : '');

  const slackLeadPayload = buildSlackPayload({
    level: 'info',
    formType,
    lang,
    name,
    email,
    phone,
    service,
    date,
    time,
    fileUrl: uploadedFileUrl,
    paymentStatus,
    message: resolvedMessage,
    origin,
    pagePath: requestUrl.pathname,
  });

  if (resolvedMessage.length > 2000) {
    return jsonResponse({ success: false, message: copy.error }, 400, origin);
  }

  /* ── Build email ───────────────────────────────────────────── */
  const subjects = {
    booking: 'Neue Buchungsanfrage — HUNDESALON NIKA',
    feedback: 'Bewertung von der Website — HUNDESALON NIKA',
    contact: 'Neue Kontaktanfrage — HUNDESALON NIKA',
  };
  const subject = subjects[formType] ?? subjects.contact;

  const bodyLines = [
    `Formulartyp: ${formType}`,
    `Sprache:     ${lang}`,
    `Name:        ${name}`,
    `E-Mail:      ${email}`,
    phone ? `Telefon:     ${phone}` : null,
    service ? `Leistung:    ${service}` : null,
    date ? `Datum:       ${date}` : null,
    time ? `Uhrzeit:     ${time}` : null,
    uploadedFileUrl ? `Datei:       ${uploadedFileUrl}` : null,
    formType === 'booking' ? `Zahlung:     ${paymentStatus}` : null,
    '',
    'Nachricht:',
    resolvedMessage,
  ].filter(l => l !== null);

  const textBody = bodyLines.join('\n');

  const runBookingIntegrations = async () => {
    if (formType !== 'booking') {
      return [];
    }

    const startDateTime = `${date}T${time}:00`;
    const endDate = new Date(`${date}T${time}:00`);
    endDate.setMinutes(endDate.getMinutes() + 90);
    const endDateTime = endDate.toISOString().replace(/\.\d{3}Z$/, '');
    const bookingSummary = [
      `Name: ${name}`,
      `E-Mail: ${email}`,
      phone ? `Telefon: ${phone}` : null,
      `Leistung: ${service}`,
      `Datum: ${date}`,
      `Uhrzeit: ${time}`,
      `Zahlung: ${paymentStatus}`,
      uploadedFileUrl ? `Datei: ${uploadedFileUrl}` : null,
      '',
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
        ],
      }),
      sendTeamsMessage(env, {
        title: 'Neue Buchung HUNDESALON NIKA',
        text: bookingSummary,
        html: bookingSummary.replaceAll('\n', '<br>'),
      }),
      sendResendEmail(env, {
        to: email,
        subject: 'Ihre Buchungsanfrage bei HUNDESALON NIKA',
        text: `Danke für Ihre Anfrage.\n\n${bookingSummary}`,
        replyTo: supportReplyTo,
        from: clientEmailFrom,
      }),
    ]);

    return results.map(result =>
      result.status === 'fulfilled' ? result.value : { ok: false, error: result.reason?.message || 'failed' }
    );
  };

  const sendAdminNotification = async () => {
    if (adminRecipients.length === 0) {
      return { ok: false, skipped: true, reason: 'Admin notification recipients are not configured.' };
    }

    const adminText = [
      'Admin-Kopie der Website-Anfrage.',
      `Antworten an Kunden bitte nur über ${supportReplyTo}.`,
      '',
      textBody,
    ].join('\n');

    return sendResendEmail(env, {
      to: adminRecipients,
      subject: `[Admin] ${subject}`,
      text: adminText,
      replyTo: supportReplyTo,
      from: resendFrom,
    });
  };

  /* ── Send via Resend API ───────────────────────────────────── */
  const apiKey = env?.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[sendmail] RESEND_API_KEY not configured');
    const slackDelivered = await sendSlackNotification(env, slackLeadPayload);
    const integrationResults = await runBookingIntegrations();
    const integrationDelivered = integrationResults.some(result => result?.ok === true);
    if (slackDelivered || integrationDelivered) {
      console.warn('[sendmail] Delivered via fallback because RESEND_API_KEY is not configured');
      return jsonResponse({ success: true, message: copy.success }, 200, origin);
    }
    return jsonResponse({ success: false, message: copy.error }, 503, origin);
  }

  let resendRes;
  try {
    const idempotencyKey =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        'User-Agent': RESEND_USER_AGENT,
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [recipient],
        reply_to: email,
        subject,
        text: textBody,
      }),
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
        service,
        date,
        time,
        message: `Network error while sending via Resend: ${err?.message || 'unknown error'}`,
        origin,
        pagePath: requestUrl.pathname,
      })
    );
    return jsonResponse({ success: false, message: copy.error }, 502, origin);
  }

  if (resendRes.ok) {
    await Promise.allSettled([
      sendSlackNotification(env, slackLeadPayload),
      runBookingIntegrations(),
      sendAdminNotification(),
    ]);
    return jsonResponse({ success: true, message: copy.success }, 200, origin);
  }

  const errBody = await resendRes.text().catch(() => '');
  console.error('[sendmail] Resend error', resendRes.status, errBody);
  await sendSlackNotification(
    env,
    buildSlackPayload({
      level: 'error',
      formType,
      lang,
      name,
      email,
      phone,
      service,
      date,
      time,
      message: `Resend error ${resendRes.status}: ${errBody.slice(0, 600) || 'no details'}`,
      origin,
      pagePath: requestUrl.pathname,
    })
  );
  return jsonResponse({ success: false, message: copy.error }, 502, origin);
}
