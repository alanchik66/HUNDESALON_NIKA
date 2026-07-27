import { assertAllowedOrigin, enforceRateLimit, jsonResponse } from './_lib/http-security.js';
import {
  appendGoogleSheetRow,
  cleanText,
  getEnvList,
  getEnvValue,
  sendResendEmail,
  sendTeamsMessage,
  siteNotificationsEnabled,
} from './_lib/platform-integrations.js';

const DEFAULT_FROM = 'Hundesalon Nika <noreply@hundesalon-nika.com>';
const DEFAULT_RECIPIENT = 'info@hundesalon-nika.com';
const DEFAULT_ADMIN_EMAILS = ['snaiper1984@gmail.com', 'ryndenko1982@gmail.com'];

const COPY = {
  de: 'Danke. Ihre Anmeldung wurde gespeichert.',
  ru: 'Спасибо. Подписка сохранена.',
  en: 'Thank you. Your subscription has been saved.',
  uk: 'Дякуємо. Підписку збережено.',
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
  const page = cleanText(body.page, 260);
  const consentRaw = String(body.newsletter_consent || body.consent || '').toLowerCase();
  const hasConsent = consentRaw === 'on' || consentRaw === 'true' || consentRaw === '1' || consentRaw === 'yes';
  if (!isValidEmail(email)) {
    return jsonResponse({ success: false, message: 'Invalid email' }, 400, originCheck.origin);
  }
  if (!hasConsent) {
    return jsonResponse({ success: false, message: 'Newsletter consent required' }, 400, originCheck.origin);
  }

  const createdAt = new Date().toISOString();
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

  await sendResendEmail(env, {
    to: email,
    subject: 'HUNDESALON NIKA',
    text: 'Danke für Ihre Anmeldung. Wir senden nur ausgewählte Neuigkeiten, Pflege-Tipps und Angebote.',
    replyTo: supportReplyTo,
    from: clientEmailFrom,
  });

  if (adminRecipients.length > 0) {
    if (siteNotificationsEnabled(env)) {
      await sendResendEmail(env, {
        to: adminRecipients,
        subject: '[Admin] Neue Newsletter-Anmeldung — HUNDESALON NIKA',
        text: `Neue Newsletter-Anmeldung: ${email}\nSprache: ${lang}\nSeite: ${page || 'unknown'}\nAntworten bitte über ${supportReplyTo}.`,
        replyTo: supportReplyTo,
        from: getEnvValue(env, 'RESEND_FROM', DEFAULT_FROM),
      });
    }
  }

  await sendTeamsMessage(env, {
    title: 'Neue Newsletter-Anmeldung',
    text: `Neue Newsletter-Anmeldung: ${email}\nSprache: ${lang}\nSeite: ${page || 'unknown'}`,
  });

  return jsonResponse({ success: true, message: COPY[lang] || COPY.de }, 200, originCheck.origin);
}
