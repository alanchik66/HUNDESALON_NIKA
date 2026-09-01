import { getEnvValue, sendSendPulseEmail } from './_lib/platform-integrations.js';
import { buildBrandedEmail } from './_lib/email-template.js';

const AUTOREPLY_FROM = 'HUNDESALON_NIKA <info@hundesalon-nika.com>';
const REPLY_TO_EMAIL = 'info@hundesalon-nika.com';
const COPY = {
  de: {
    subject: 'Automatische Information | HUNDESALON_NIKA',
    body: 'Dies ist eine automatische Informationsnachricht von HUNDESALON_NIKA.\n\nSie können direkt auf diese Nachricht antworten. Ihre Antwort geht an info@hundesalon-nika.com.\n\nSalonadresse: Walter-Markov-Ring 1 · 04288 Leipzig',
  },
  en: {
    subject: 'Automatic information | HUNDESALON_NIKA',
    body: 'This is an automatic information message from HUNDESALON_NIKA.\n\nYou can reply directly to this message. Your reply will go to info@hundesalon-nika.com.\n\nSalon address: Walter-Markov-Ring 1 · 04288 Leipzig',
  },
  ru: {
    subject: 'Автоматическая информация | HUNDESALON_NIKA',
    body: 'Это автоматическое информационное сообщение от HUNDESALON_NIKA.\n\nВы можете ответить прямо на это письмо. Ответ поступит на info@hundesalon-nika.com.\n\nАдрес салона: Walter-Markov-Ring 1 · 04288 Leipzig',
  },
  uk: {
    subject: 'Автоматична інформація | HUNDESALON_NIKA',
    body: 'Це автоматичне інформаційне повідомлення від HUNDESALON_NIKA.\n\nВи можете відповісти безпосередньо на цей лист. Відповідь надійде на info@hundesalon-nika.com.\n\nАдреса салону: Walter-Markov-Ring 1 · 04288 Leipzig',
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export async function onRequestPost({ request, env }) {
  const configuredSecret = getEnvValue(env, 'INFO_AUTOREPLY_SECRET');
  const authorization = request.headers.get('Authorization') || '';
  if (!configuredSecret) return json({ ok: false, error: 'Relay is not configured' }, 503);
  if (authorization !== `Bearer ${configuredSecret}`) return json({ ok: false, error: 'Unauthorized' }, 401);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const to = String(payload?.to || '').trim().toLowerCase();
  const lang = String(payload?.lang || 'en').trim().toLowerCase();
  const copy = COPY[lang] || COPY.en;
  if (!isValidEmail(to) || to === 'info@hundesalon-nika.com') {
    return json({ ok: false, error: 'Invalid recipient' }, 400);
  }

  const result = await sendSendPulseEmail(env, {
    to,
    from: AUTOREPLY_FROM,
    replyTo: REPLY_TO_EMAIL,
    subject: copy.subject,
    text: copy.body,
    html: buildBrandedEmail({ title: copy.subject, bodyText: copy.body, lang }),
  });
  if (!result.ok) {
    console.error('[info-auto-reply] SendPulse error', result.status, JSON.stringify(result.body || {}));
    return json({ ok: false, error: 'Email delivery failed' }, 502);
  }

  return json({ ok: true, recipient: to.replace(/(^.).*(@.*$)/, '$1***$2'), replyTo: REPLY_TO_EMAIL });
}
