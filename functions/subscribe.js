import { assertAllowedOrigin, enforceRateLimit, jsonResponse } from './_lib/http-security.js';
import {
  appendGoogleSheetRow,
  cleanText,
  getEnvValue,
  sendGmailEmail,
  sendTeamsMessage,
} from './_lib/platform-integrations.js';

const COPY = {
  de: 'Danke. Ihre Anmeldung wurde gespeichert.',
  ru: 'Спасибо. Подписка сохранена.',
  en: 'Thank you. Your subscription has been saved.',
  uk: 'Дякуємо. Підписку збережено.',
};

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
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
  if (!isValidEmail(email)) {
    return jsonResponse({ success: false, message: 'Invalid email' }, 400, originCheck.origin);
  }

  const createdAt = new Date().toISOString();
  await appendGoogleSheetRow(env, {
    spreadsheetId: getEnvValue(env, 'SHEET_ID'),
    sheetName: 'subscribers',
    values: [createdAt, email, lang, page, originCheck.origin],
  });

  await sendGmailEmail(env, {
    to: email,
    subject: 'HUNDESALON NIKA',
    text: 'Danke für Ihre Anmeldung. Wir senden nur ausgewählte Neuigkeiten, Pflege-Tipps und Angebote.',
  });

  await sendTeamsMessage(env, {
    title: 'Neue Newsletter-Anmeldung',
    text: `Neue Newsletter-Anmeldung: ${email}\nSprache: ${lang}\nSeite: ${page || 'unknown'}`,
  });

  return jsonResponse({ success: true, message: COPY[lang] || COPY.de }, 200, originCheck.origin);
}
