const AUTOREPLY_ENDPOINT = 'https://hundesalon-nika.com/info-auto-reply';
const AUTOREPLY_TIMEOUT_MS = 8000;
const LANGUAGE_SAMPLE_MAX_BYTES = 256 * 1024;
const SALON_DOMAIN = 'hundesalon-nika.com';
const EMAIL_ADDRESS_RE = /^[^\s@<>,;:"]+@[^\s@<>,;:"]+\.[^\s@<>,;:"]{2,}$/;

function getForwardDestinations(env) {
  return [
    ...new Set(
      String(env.INFO_FORWARD_DESTINATION || '')
        .split(/[;,]/)
        .map(value => value.trim().toLowerCase())
        .filter(value => EMAIL_ADDRESS_RE.test(value) && value !== `info@${SALON_DOMAIN}`)
    ),
  ];
}

function shouldSuppressAutoReply(message) {
  const sender = String(message.from || '')
    .trim()
    .toLowerCase();
  if (!EMAIL_ADDRESS_RE.test(sender)) return true;

  const [localPart, domain] = sender.split('@');
  if (domain === SALON_DOMAIN || domain.endsWith(`.${SALON_DOMAIN}`)) return true;
  if (
    /no[._-]?reply|do[._-]?not[._-]?reply|^(?:mailer-daemon|postmaster)(?:$|[._+-])|(?:^|[._+-])bounces?(?:$|[._+-])|^owner[._+-]|[._+-]request$/.test(
      localPart
    )
  ) {
    return true;
  }

  const header = name => (message.headers.get(name) || '').trim().toLowerCase();
  const autoSubmitted = header('auto-submitted');
  const submissionType = autoSubmitted
    .replace(/\([^()]*\)/g, '')
    .split(';', 1)[0]
    .trim();
  if (autoSubmitted && submissionType !== 'no') return true;

  const suppression = header('x-auto-response-suppress');
  if (suppression && suppression !== 'none') return true;
  if (
    header('precedence')
      .split(/[\s,;]+/)
      .some(value => ['bulk', 'list', 'junk'].includes(value))
  )
    return true;
  if (
    /^(?:multipart\/report|message\/(?:global-)?(?:delivery-status|disposition-notification))(?:\s*;|$)/.test(
      header('content-type')
    )
  ) {
    return true;
  }

  return Array.from(message.headers.keys()).some(name => name.toLowerCase().startsWith('list-'));
}

async function fetchWithTimeout(url, options, timeoutMs = AUTOREPLY_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function decodeHeader(value) {
  return String(value || '')
    .replace(/=\?UTF-8\?B\?([^?]+)\?=/gi, (_, encoded) => {
      try {
        const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
        return new TextDecoder().decode(bytes);
      } catch {
        return encoded;
      }
    })
    .replace(/=\?UTF-8\?Q\?([^?]+)\?=/gi, (_, encoded) => {
      try {
        const bytes = encoded
          .replace(/_/g, ' ')
          .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
        return new TextDecoder().decode(Uint8Array.from(bytes, character => character.charCodeAt(0)));
      } catch {
        return encoded;
      }
    });
}

function decodeQuotedPrintable(value) {
  const binary = String(value || '')
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return new TextDecoder().decode(Uint8Array.from(binary, character => character.charCodeAt(0) & 255));
}

function detectLanguage(message, rawText = '') {
  const language =
    `${message.headers.get('content-language') || ''} ${message.headers.get('accept-language') || ''}`.toLowerCase();
  const subject = decodeHeader(message.headers.get('subject')).toLowerCase();
  const content = `${subject} ${decodeQuotedPrintable(rawText)}`.toLowerCase();
  if (/[іїєґ]/u.test(content) || /(^|[-,; ])uk([-,; ]|$)/.test(language)) return 'uk';
  if (/[ыэъё]/u.test(content) || /(^|[-,; ])ru([-,; ]|$)/.test(language)) return 'ru';
  if (/(^|[-,; ])de([-,; ]|$)/.test(language) || /rechnung|termin|nachricht|bitte/.test(content)) return 'de';
  return 'en';
}

async function sendAutoReply(env, to, lang) {
  const secret = String(env.INFO_AUTOREPLY_SECRET || '').trim();
  if (!secret) return { ok: false, reason: 'INFO_AUTOREPLY_SECRET is not configured' };

  const response = await fetchWithTimeout(AUTOREPLY_ENDPOINT, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to, lang }),
  });
  const body = await response.text().catch(() => '');
  return { ok: response.ok, status: response.status, body: body.slice(0, 300) };
}

export default {
  async email(message, env) {
    const sender = String(message.from || '').trim();
    const destinations = getForwardDestinations(env);
    if (!destinations.length) {
      console.error('[info-auto-reply] INFO_FORWARD_DESTINATION is not configured.');
      message.setReject('Routing configuration error.');
      return;
    }
    await Promise.all(destinations.map(destination => message.forward(destination)));
    if (shouldSuppressAutoReply(message)) return;

    let rawText = '';
    if (!Number.isFinite(message.rawSize) || message.rawSize <= LANGUAGE_SAMPLE_MAX_BYTES) {
      try {
        rawText = await new Response(message.raw).text();
      } catch {
        rawText = '';
      }
    }
    const lang = detectLanguage(message, rawText);
    try {
      const result = await sendAutoReply(env, sender, lang);
      if (!result.ok) {
        console.error('[info-auto-reply] SendPulse relay failed', JSON.stringify(result));
      }
    } catch (error) {
      console.error('[info-auto-reply] Unexpected relay error', error?.message || error);
    }
  },
};

export { getForwardDestinations };
