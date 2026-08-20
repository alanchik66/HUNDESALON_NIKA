import { assertAllowedOrigin, enforceRateLimit, jsonResponse } from './_lib/http-security.js';
import {
  appendGoogleSheetRow,
  cleanText,
  getEnvList,
  getEnvValue,
  sendSendPulseAutomationEvent,
  sendSendPulseEmail,
  sendTelegramMessage,
  sendTeamsMessage,
  upsertSendPulseContact,
  siteNotificationsEnabled,
} from './_lib/platform-integrations.js';
import { buildBrandedEmail } from './_lib/email-template.js';

const DEFAULT_FROM = 'Hundesalon Nika <noreply@hundesalon-nika.com>';
const DEFAULT_RECIPIENT = 'support@hundesalon-nika.com';
const DEFAULT_ADMIN_EMAILS = ['snaiper1984@gmail.com', 'ryndenko1982@gmail.com'];

const COPY = {
  de: 'Danke. Ihre Anmeldung wurde gespeichert.',
  ru: 'Спасибо. Подписка сохранена.',
  en: 'Thank you. Your subscription has been saved.',
  uk: 'Дякуємо. Підписку збережено.',
};

const NEWSLETTER_COPY = {
  de: { subject: 'Willkommen bei HUNDESALON_NIKA', title: 'Willkommen bei HUNDESALON_NIKA', body: 'Danke für Ihre Anmeldung. Wir senden nur ausgewählte Neuigkeiten, Pflege-Tipps und Angebote.' },
  en: { subject: 'Welcome to HUNDESALON_NIKA', title: 'Welcome to HUNDESALON_NIKA', body: 'Thank you for subscribing. We send selected news, care tips and offers.' },
  ru: { subject: 'Добро пожаловать в HUNDESALON_NIKA', title: 'Добро пожаловать в HUNDESALON_NIKA', body: 'Спасибо за подписку. Мы отправляем только избранные новости, советы по уходу и предложения.' },
  uk: { subject: 'Ласкаво просимо до HUNDESALON_NIKA', title: 'Ласкаво просимо до HUNDESALON_NIKA', body: 'Дякуємо за підписку. Ми надсилаємо лише вибрані новини, поради з догляду та пропозиції.' },
};

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function uniqueEmailList(items) {
  const seen = new Set();
  return items
    .map((item) => cleanText(item, 180).toLowerCase())
    .filter((item) => {
      if (!isValidEmail(item) || seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
  }

  const originCheck = assertAllowedOrigin(request);
  if (!originCheck.ok) {
    return jsonResponse({ success: false, message: 'Forbidden' }, 403);
  }

  const rateLimited = await enforceRateLimit(request, { route: 'subscribe', limit: 10, windowSec: 60 });
  if (rateLimited) {
    return jsonResponse({ success: false, message: 'Too many requests. Please try again later.' }, 429, originCheck.origin);
  }

  const contentType = request.headers.get('Content-Type') || '';
  const body = contentType.includes('application/json')
    ? await request.json().catch(() => ({}))
    : Object.fromEntries((await request.formData().catch(() => new FormData())).entries());

  const email = cleanText(body.email, 180).toLowerCase();
  const lang = cleanText(body.lang, 8) || 'de';
  const newsletterCopy = NEWSLETTER_COPY[lang] || NEWSLETTER_COPY.de;
  const page = cleanText(body.page, 260);
  const source = cleanText(body.source || page || 'website', 260);
  const consentRaw = String(body.newsletter_consent || body.consent || '').toLowerCase();
  const hasConsent = consentRaw === 'on' || consentRaw === 'true' || consentRaw === '1' || consentRaw === 'yes';
  if (!isValidEmail(email)) {
    return jsonResponse({ success: false, message: 'Invalid email' }, 400, originCheck.origin);
  }
  if (!hasConsent) {
    return jsonResponse({ success: false, message: 'Newsletter consent required' }, 400, originCheck.origin);
  }

  const createdAt = new Date().toISOString();
  const requestId = crypto.randomUUID();
  const supportReplyTo =
    getEnvValue(env, 'SUPPORT_REPLY_TO_EMAIL') ||
    getEnvValue(env, 'SUPPORT_EMAIL') ||
    'support@hundesalon-nika.com';
  const clientEmailFrom =
    getEnvValue(env, 'CLIENT_EMAIL_FROM') ||
    'Hundesalon Nika <support@hundesalon-nika.com>';
  const adminRecipients = uniqueEmailList(getEnvList(env, 'ADMIN_NOTIFICATION_EMAILS', DEFAULT_ADMIN_EMAILS.join(',')));

  await appendGoogleSheetRow(env, {
    spreadsheetId: getEnvValue(env, 'SHEET_ID'),
    sheetName: 'subscribers',
    values: [createdAt, email, lang, page, originCheck.origin, 'consent:yes'],
  });

  await sendSendPulseEmail(env, {
    to: email,
    subject: newsletterCopy.subject,
    text: newsletterCopy.body,
    html: buildBrandedEmail({
      title: newsletterCopy.title,
      bodyText: newsletterCopy.body,
      lang,
    }),
    replyTo: supportReplyTo,
    from: clientEmailFrom,
  });

  await upsertSendPulseContact(env, { email, lang, source, formType: 'newsletter' });
  await sendSendPulseAutomationEvent(env, {
    eventType: 'newsletter',
    data: {
      email,
      language: lang,
      lead_source: source,
      form_type: 'newsletter',
      marketing_consent: 'yes',
      source_url: page || source,
      site_origin: originCheck.origin,
      submitted_at: createdAt,
      request_id: requestId,
    },
  });

  if (adminRecipients.length > 0) {
    if (siteNotificationsEnabled(env)) {
      await sendSendPulseEmail(env, {
        to: adminRecipients,
        subject: '[Admin] Neue Newsletter-Anmeldung — HUNDESALON NIKA',
        text: `Neue Newsletter-Anmeldung: ${email}\nSprache: ${lang}\nSeite: ${page || 'unknown'}\nAntworten bitte über ${supportReplyTo}.`,
        html: buildBrandedEmail({
          title: 'Neue Newsletter-Anmeldung — HUNDESALON_NIKA',
          bodyText: `Neue Newsletter-Anmeldung: ${email}\nSprache: ${lang}\nSeite: ${page || 'unknown'}\nAntworten bitte über ${supportReplyTo}.`,
          lang,
        }),
        replyTo: supportReplyTo,
        from: getEnvValue(env, 'SENDPULSE_FROM', DEFAULT_FROM),
      });
    }
  }

  await sendTeamsMessage(env, {
    title: 'Neue Newsletter-Anmeldung',
    text: `Neue Newsletter-Anmeldung: ${email}\nSprache: ${lang}\nSeite: ${page || 'unknown'}`,
  });

  await sendTelegramMessage(env, {
    category: 'newsletter',
    text: [
      '🐕 Новая подписка на новости HUNDESALON NIKA',
      `E-mail: ${email}`,
      `Язык: ${lang}`,
      `Страница: ${page || 'unknown'}`,
    ].join('\n'),
  });

  return jsonResponse({ success: true, message: COPY[lang] || COPY.de }, 200, originCheck.origin);
}
