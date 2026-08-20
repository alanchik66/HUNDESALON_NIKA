const AUTOREPLY_ENDPOINT = 'https://hundesalon-nika.com/info-auto-reply';
const AUTOREPLY_TIMEOUT_MS = 8000;

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
  return String(value || '').replace(/=\?UTF-8\?B\?([^?]+)\?=/gi, (_, encoded) => {
    try {
      const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch {
      return encoded;
    }
  }).replace(/=\?UTF-8\?Q\?([^?]+)\?=/gi, (_, encoded) => {
    try {
      const bytes = encoded.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
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
  const language = `${message.headers.get('content-language') || ''} ${message.headers.get('accept-language') || ''}`.toLowerCase();
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
    const lowerSender = sender.toLowerCase();
    const autoSubmitted = (message.headers.get('auto-submitted') || '').toLowerCase();
    const precedence = (message.headers.get('precedence') || '').toLowerCase();
    if (!sender || lowerSender === 'info@hundesalon-nika.com' || autoSubmitted.includes('auto-') || precedence === 'bulk' || precedence === 'list') {
      message.setReject('Automatic mailbox: please contact support@hundesalon-nika.com');
      return;
    }

    let rawText = '';
    try {
      rawText = await new Response(message.raw).text();
    } catch {
      rawText = '';
    }
    const lang = detectLanguage(message, rawText);
    try {
      const result = await sendAutoReply(env, sender, lang);
      if (!result.ok) {
        console.error('[info-auto-reply] SendPulse relay failed', JSON.stringify(result));
        message.setReject('Automatic mailbox: please contact support@hundesalon-nika.com');
      }
    } catch (error) {
      console.error('[info-auto-reply] Unexpected relay error', error?.message || error);
      message.setReject('Automatic mailbox: please contact support@hundesalon-nika.com');
    }
  },
};
