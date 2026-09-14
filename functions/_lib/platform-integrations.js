const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const FORM_HEADERS = { 'Content-Type': 'application/x-www-form-urlencoded' };
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SENDPULSE_API_URL = 'https://api.sendpulse.com';
const SENDPULSE_EVENT_API_URL = 'https://events.sendpulse.com/events/name';
const TELEGRAM_API_URL = 'https://api.telegram.org';
export const TELEGRAM_FILE_MAX_BYTES = 50 * 1024 * 1024;
const SENDPULSE_EVENT_ENV_NAMES = Object.freeze({
  booking: 'SENDPULSE_BOOKING_EVENT_NAME',
  contact: 'SENDPULSE_CONTACT_EVENT_NAME',
  feedback: 'SENDPULSE_CONTACT_EVENT_NAME',
  client_registration: 'SENDPULSE_CONTACT_EVENT_NAME',
  newsletter: 'SENDPULSE_NEWSLETTER_EVENT_NAME',
});
const SENDPULSE_EVENT_NAME_RE = /^[a-z0-9][a-z0-9._-]{0,79}$/i;
const googleTokenCache = new Map();
let sendPulseTokenCache = null;

export function cleanText(value, maxLength = 2000) {
  let s = String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
  // Iteratively strip HTML tags to prevent partial-tag injection (e.g. <<script>)
  let prev;
  do {
    prev = s;
    s = s.replace(/<[^>]*>/g, '');
  } while (s !== prev);
  return s;
}

export function getEnvValue(env, name, fallback = '') {
  return String(env?.[name] || fallback || '').trim();
}

export function getEnvList(env, name, fallback = '') {
  const value = Array.isArray(env?.[name]) ? env[name].join(',') : getEnvValue(env, name, fallback);
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

export function hasUsableValue(value) {
  return Boolean(value) && !/ВАШ_|YOUR_|XXXXXXXX|TODO/i.test(value);
}

const DEFAULT_FETCH_TIMEOUT_MS = 10000;

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function siteNotificationsEnabled(env) {
  const raw = getEnvValue(env, 'SITE_NOTIFICATIONS_ENABLED', 'false').toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
}

function base64UrlEncode(value) {
  const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(String(value));
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64Encode(value) {
  const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(String(value));
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function pemToArrayBuffer(pem) {
  const normalized = String(pem || '').replace(/\\n/g, '\n');
  const base64 = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

async function signServiceAccountJwt(privateKeyPem, unsignedJwt) {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, key, new TextEncoder().encode(unsignedJwt));
  return `${unsignedJwt}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function safeJsonFetch(url, options = {}) {
  const { timeoutMs = DEFAULT_FETCH_TIMEOUT_MS, ...requestOptions } = options;
  const response = await fetchWithTimeout(url, requestOptions, timeoutMs);
  const bodyText = await response.text().catch(() => '');
  let body = null;

  try {
    body = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    body = { raw: bodyText };
  }

  return { ok: response.ok, status: response.status, body };
}

export async function getGoogleAccessToken(env, scopes, subject = '') {
  const email = getEnvValue(env, 'GOOGLE_SERVICE_ACCOUNT_EMAIL');
  const privateKey = getEnvValue(env, 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
  const scopeText = Array.isArray(scopes) ? scopes.join(' ') : String(scopes || '');
  const normalizedSubject = getEnvValue(env, 'GOOGLE_SERVICE_ACCOUNT_SUBJECT', subject);

  if (!hasUsableValue(email) || !hasUsableValue(privateKey) || !hasUsableValue(scopeText)) {
    return '';
  }

  const cacheKey = `${email}|${scopeText}|${normalizedSubject}`;
  const cached = googleTokenCache.get(cacheKey);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt - 90 > nowSeconds) {
    return cached.token;
  }

  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = {
    iss: email,
    scope: scopeText,
    aud: GOOGLE_TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };
  if (hasUsableValue(normalizedSubject)) {
    claims.sub = normalizedSubject;
  }

  const unsignedJwt = `${header}.${base64UrlEncode(JSON.stringify(claims))}`;
  const assertion = await signServiceAccountJwt(privateKey, unsignedJwt);
  const tokenResponse = await safeJsonFetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: FORM_HEADERS,
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!tokenResponse.ok || !hasUsableValue(tokenResponse.body?.access_token)) {
    return '';
  }

  const token = tokenResponse.body.access_token;
  googleTokenCache.set(cacheKey, {
    token,
    expiresAt: nowSeconds + Number(tokenResponse.body.expires_in || 3600),
  });
  return token;
}

export async function getGoogleOAuthAccessToken(env) {
  const directToken = getEnvValue(env, 'GOOGLE_OAUTH_ACCESS_TOKEN');
  const clientId = getEnvValue(env, 'GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = getEnvValue(env, 'GOOGLE_OAUTH_CLIENT_SECRET');
  const refreshToken = getEnvValue(env, 'GOOGLE_OAUTH_REFRESH_TOKEN');

  if (!hasUsableValue(clientId) || !hasUsableValue(clientSecret) || !hasUsableValue(refreshToken)) {
    return hasUsableValue(directToken) ? directToken : '';
  }

  const cacheKey = `oauth|${clientId}|${refreshToken.slice(-12)}`;
  const cached = googleTokenCache.get(cacheKey);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt - 90 > nowSeconds) {
    return cached.token;
  }

  const tokenResponse = await safeJsonFetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: FORM_HEADERS,
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenResponse.ok || !hasUsableValue(tokenResponse.body?.access_token)) {
    return '';
  }

  const token = tokenResponse.body.access_token;
  googleTokenCache.set(cacheKey, {
    token,
    expiresAt: nowSeconds + Number(tokenResponse.body.expires_in || 3600),
  });
  return token;
}

export async function callGoogleAppsScriptGateway(env, action, payload) {
  const webhook = getEnvValue(env, 'GOOGLE_APPS_SCRIPT_WEBHOOK_URL');
  if (!hasUsableValue(webhook)) {
    return { ok: false, skipped: true, reason: 'Google Apps Script gateway is not configured.' };
  }

  const result = await safeJsonFetch(webhook, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      action,
      secret: getEnvValue(env, 'GOOGLE_GATEWAY_SECRET'),
      ...payload,
    }),
  });

  return {
    ...result,
    ok: result.ok && result.body?.success !== false,
  };
}

export async function appendGoogleSheetRow(env, { spreadsheetId, sheetName = 'bookings', values }) {
  const appsScriptResult = await callGoogleAppsScriptGateway(env, 'sheets', { spreadsheetId, sheetName, values });
  if (!appsScriptResult.skipped) {
    return appsScriptResult;
  }

  const webhook = getEnvValue(env, 'GOOGLE_SHEETS_WEBHOOK_URL');
  if (hasUsableValue(webhook)) {
    return safeJsonFetch(webhook, {
      method: 'POST',
      headers: {
        ...JSON_HEADERS,
        'X-Hundesalon-Gateway-Secret': getEnvValue(env, 'GOOGLE_GATEWAY_SECRET'),
      },
      body: JSON.stringify({ spreadsheetId, sheetName, values }),
    });
  }

  const token =
    (await getGoogleAccessToken(env, ['https://www.googleapis.com/auth/spreadsheets'])) ||
    (await getGoogleOAuthAccessToken(env));
  if (!hasUsableValue(token) || !hasUsableValue(spreadsheetId)) {
    return { ok: false, skipped: true, reason: 'Google Sheets credentials are not configured.' };
  }

  const range = encodeURIComponent(`${sheetName}!A:AZ`);
  return safeJsonFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ values: [values] }),
    }
  );
}

export async function createGoogleCalendarEvent(
  env,
  { calendarId, summary, description, startDateTime, endDateTime, status = 'tentative' }
) {
  const appsScriptResult = await callGoogleAppsScriptGateway(env, 'calendar', {
    calendarId,
    summary,
    description,
    startDateTime,
    endDateTime,
    status,
  });
  if (!appsScriptResult.skipped) {
    return appsScriptResult;
  }

  const webhook = getEnvValue(env, 'GOOGLE_CALENDAR_WEBHOOK_URL');
  if (hasUsableValue(webhook)) {
    return safeJsonFetch(webhook, {
      method: 'POST',
      headers: {
        ...JSON_HEADERS,
        'X-Hundesalon-Gateway-Secret': getEnvValue(env, 'GOOGLE_GATEWAY_SECRET'),
      },
      body: JSON.stringify({ calendarId, summary, description, startDateTime, endDateTime, status }),
    });
  }

  const token =
    (await getGoogleAccessToken(env, ['https://www.googleapis.com/auth/calendar'])) ||
    (await getGoogleOAuthAccessToken(env));
  if (!hasUsableValue(token) || !hasUsableValue(calendarId)) {
    return { ok: false, skipped: true, reason: 'Google Calendar credentials are not configured.' };
  }

  return safeJsonFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: {
      ...JSON_HEADERS,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      summary,
      description,
      status,
      start: { dateTime: startDateTime, timeZone: 'Europe/Berlin' },
      end: { dateTime: endDateTime, timeZone: 'Europe/Berlin' },
    }),
  });
}

export async function getGoogleCalendarBusyIntervals(env, { calendarId, timeMin, timeMax }) {
  const gatewayPayload = { calendarId, timeMin, timeMax };
  const appsScriptResult = await callGoogleAppsScriptGateway(env, 'calendar_freebusy', gatewayPayload);
  if (!appsScriptResult.skipped) {
    const busy =
      appsScriptResult.body?.busyIntervals ||
      appsScriptResult.body?.busy ||
      appsScriptResult.body?.calendars?.[calendarId]?.busy;
    return {
      ok: appsScriptResult.ok && Array.isArray(busy),
      configured: appsScriptResult.ok,
      busyIntervals: Array.isArray(busy) ? busy : [],
    };
  }

  const webhook = getEnvValue(env, 'GOOGLE_CALENDAR_WEBHOOK_URL');
  if (hasUsableValue(webhook)) {
    const webhookResult = await safeJsonFetch(webhook, {
      method: 'POST',
      headers: {
        ...JSON_HEADERS,
        'X-Hundesalon-Gateway-Secret': getEnvValue(env, 'GOOGLE_GATEWAY_SECRET'),
      },
      body: JSON.stringify({ action: 'calendar_freebusy', ...gatewayPayload }),
    });
    const busy =
      webhookResult.body?.busyIntervals ||
      webhookResult.body?.busy ||
      webhookResult.body?.calendars?.[calendarId]?.busy;
    return {
      ok: webhookResult.ok && Array.isArray(busy),
      configured: webhookResult.ok,
      busyIntervals: Array.isArray(busy) ? busy : [],
    };
  }

  const token =
    (await getGoogleAccessToken(env, ['https://www.googleapis.com/auth/calendar.freebusy'])) ||
    (await getGoogleOAuthAccessToken(env));
  if (!hasUsableValue(token) || !hasUsableValue(calendarId)) {
    return { ok: false, configured: false, busyIntervals: [] };
  }

  const response = await safeJsonFetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      ...JSON_HEADERS,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: calendarId }] }),
  });
  const busy = response.body?.calendars?.[calendarId]?.busy;
  return {
    ok: response.ok && Array.isArray(busy),
    configured: response.ok,
    busyIntervals: Array.isArray(busy) ? busy : [],
  };
}

/** Sends a plain-text notification to a Telegram chat or channel. */
const TELEGRAM_TOPIC_ENV_NAMES = Object.freeze({
  messages: 'TELEGRAM_TOPIC_MESSAGES_ID',
  personal: 'TELEGRAM_TOPIC_PERSONAL_ID',
  orders: 'TELEGRAM_TOPIC_ORDERS_ID',
  newsletter: 'TELEGRAM_TOPIC_NEWSLETTER_ID',
  social: 'TELEGRAM_TOPIC_SOCIAL_ID',
  system: 'TELEGRAM_TOPIC_SYSTEM_ID',
});

function cleanTelegramText(value, maxLength = 3900) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .split('\n')
    .map(line => cleanText(line, maxLength))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

async function resolveTelegramTopicId(env, category, configuredTopicId) {
  const db = env?.CHAT_DB;
  if (!db || typeof db.prepare !== 'function') return configuredTopicId;
  try {
    const row = await db
      .prepare('SELECT message_thread_id FROM chat_telegram_topics WHERE category = ? LIMIT 1')
      .bind(category)
      .first();
    const override = Number.parseInt(String(row?.message_thread_id ?? ''), 10);
    return Number.isInteger(override) && override > 0 ? override : configuredTopicId;
  } catch {
    return configuredTopicId;
  }
}

export async function sendTelegramMessage(
  env,
  { text = '', category = 'messages', chatId = '', messageThreadId = null, replyMarkup = null } = {}
) {
  if (!siteNotificationsEnabled(env)) {
    return { ok: false, skipped: true, reason: 'Site notifications are disabled.' };
  }

  const token = getEnvValue(env, 'TELEGRAM_BOT_TOKEN');
  const configuredChatId = getEnvValue(env, 'TELEGRAM_CHAT_ID');
  const message = cleanTelegramText(text, 3900);
  const destinationChatId = String(chatId || configuredChatId).trim();
  if (!hasUsableValue(token) || !hasUsableValue(destinationChatId) || !message) {
    return { ok: false, skipped: true, reason: 'Telegram bot credentials are not configured.' };
  }

  const topicEnvName = TELEGRAM_TOPIC_ENV_NAMES[category] || TELEGRAM_TOPIC_ENV_NAMES.messages;
  const configuredTopicId = Number.parseInt(getEnvValue(env, topicEnvName), 10);
  const explicitThreadId = Number.parseInt(String(messageThreadId ?? ''), 10);
  const topicId =
    !chatId && !(Number.isInteger(explicitThreadId) && explicitThreadId > 0)
      ? await resolveTelegramTopicId(env, category, configuredTopicId)
      : configuredTopicId;
  const payload = { chat_id: destinationChatId, text: message, disable_web_page_preview: true };
  if (Number.isInteger(explicitThreadId) && explicitThreadId > 0) {
    payload.message_thread_id = explicitThreadId;
  } else if (!chatId && Number.isInteger(topicId) && topicId > 0) {
    payload.message_thread_id = topicId;
  }
  if (replyMarkup) payload.reply_markup = replyMarkup;

  return safeJsonFetch(`${TELEGRAM_API_URL}/bot${encodeURIComponent(token)}/sendMessage`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
}

function telegramMultipartBody({ fields, fileBody, fileName, mimeType, boundary }) {
  const encoder = new TextEncoder();
  const fieldParts = Object.entries(fields)
    .filter(([, value]) => String(value ?? '').trim())
    .map(
      ([name, value]) =>
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${String(value)}\r\n`
    )
    .join('');
  const safeName = cleanText(fileName, 180).replace(/[\\/:*?"<>|]/g, '-') || 'attachment';
  const asciiName = safeName.replace(/[^\x20-\x7E]/g, '_');
  const prefix = encoder.encode(
    `${fieldParts}--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(safeName)}\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const suffix = encoder.encode(`\r\n--${boundary}--\r\n`);
  const reader = fileBody.getReader();
  let phase = 0;
  return new ReadableStream({
    async pull(controller) {
      if (phase === 0) {
        phase = 1;
        controller.enqueue(prefix);
        return;
      }
      if (phase === 1) {
        const chunk = await reader.read();
        if (!chunk.done) {
          controller.enqueue(chunk.value);
          return;
        }
        phase = 2;
      }
      controller.enqueue(suffix);
      controller.close();
      phase = 3;
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

/** Streams an original file from a short-lived HTTPS URL into Telegram without recompression. */
export async function sendTelegramDocument(
  env,
  {
    documentUrl = '',
    fileName = '',
    fileSize = 0,
    mimeType = '',
    caption = '',
    category = 'messages',
    chatId = '',
    messageThreadId = null,
  } = {}
) {
  if (!siteNotificationsEnabled(env)) {
    return { ok: false, skipped: true, reason: 'Site notifications are disabled.' };
  }

  const token = getEnvValue(env, 'TELEGRAM_BOT_TOKEN');
  const configuredChatId = getEnvValue(env, 'TELEGRAM_CHAT_ID');
  const destinationChatId = String(chatId || configuredChatId).trim();
  let downloadUrl = '';
  try {
    const parsed = new URL(String(documentUrl || '').trim());
    if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) downloadUrl = parsed.toString();
  } catch {
    downloadUrl = '';
  }
  const size = Number(fileSize);
  const missing = [
    !hasUsableValue(token) && 'bot_token',
    !hasUsableValue(destinationChatId) && 'chat_id',
    !downloadUrl && 'download_url',
    (!Number.isSafeInteger(size) || size < 1 || size > TELEGRAM_FILE_MAX_BYTES) && 'file_size',
  ].filter(Boolean);
  if (missing.length) {
    return { ok: false, skipped: true, reason: `Telegram file delivery prerequisites: ${missing.join(', ')}.` };
  }

  const topicEnvName = TELEGRAM_TOPIC_ENV_NAMES[category] || TELEGRAM_TOPIC_ENV_NAMES.messages;
  const configuredTopicId = Number.parseInt(getEnvValue(env, topicEnvName), 10);
  const explicitThreadId = Number.parseInt(String(messageThreadId ?? ''), 10);
  const topicId =
    !chatId && !(Number.isInteger(explicitThreadId) && explicitThreadId > 0)
      ? await resolveTelegramTopicId(env, category, configuredTopicId)
      : configuredTopicId;
  const fields = { chat_id: destinationChatId };
  const message = cleanTelegramText(caption, 1000);
  if (message) fields.caption = message;
  if (Number.isInteger(explicitThreadId) && explicitThreadId > 0) {
    fields.message_thread_id = explicitThreadId;
  } else if (!chatId && Number.isInteger(topicId) && topicId > 0) {
    fields.message_thread_id = topicId;
  }

  const source = await fetchWithTimeout(downloadUrl, {}, 15000);
  const rawSourceLength = source.headers.get('Content-Length');
  const sourceLength = rawSourceLength ? Number(rawSourceLength) : Number.NaN;
  if (!source.ok || !source.body || (Number.isFinite(sourceLength) && sourceLength !== size)) {
    if (source.body) await source.body.cancel().catch(() => {});
    return { ok: false, status: source.status, reason: 'OneDrive file download failed.' };
  }
  const safeMimeType = cleanText(mimeType || source.headers.get('Content-Type'), 120).split(';', 1)[0];
  const boundary = `----hundesalon-${crypto.randomUUID()}`;
  const body = telegramMultipartBody({
    fields,
    fileBody: source.body,
    fileName,
    mimeType: /^[\w!#$&^_.+-]+\/[\w!#$&^_.+-]+$/.test(safeMimeType)
      ? safeMimeType
      : 'application/octet-stream',
    boundary,
  });

  return safeJsonFetch(`${TELEGRAM_API_URL}/bot${encodeURIComponent(token)}/sendDocument`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
    duplex: 'half',
    timeoutMs: 60000,
  });
}

export async function answerTelegramCallbackQuery(env, { callbackQueryId = '', text = '', showAlert = false } = {}) {
  const token = getEnvValue(env, 'TELEGRAM_BOT_TOKEN');
  const queryId = cleanText(callbackQueryId, 128);
  if (!hasUsableValue(token) || !queryId) {
    return { ok: false, skipped: true, reason: 'Telegram bot credentials are not configured.' };
  }

  const payload = { callback_query_id: queryId };
  const notice = cleanText(text, 200);
  if (notice) payload.text = notice;
  if (showAlert) payload.show_alert = true;

  return safeJsonFetch(`${TELEGRAM_API_URL}/bot${encodeURIComponent(token)}/answerCallbackQuery`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
}

async function getSendPulseAccessToken(env) {
  const apiKey = getEnvValue(env, 'SENDPULSE_API_KEY');
  if (hasUsableValue(apiKey)) return apiKey;

  const clientId = getEnvValue(env, 'SENDPULSE_CLIENT_ID');
  const clientSecret = getEnvValue(env, 'SENDPULSE_CLIENT_SECRET');
  const now = Math.floor(Date.now() / 1000);
  if (!hasUsableValue(clientId) || !hasUsableValue(clientSecret)) return '';
  if (sendPulseTokenCache && sendPulseTokenCache.expiresAt - 90 > now) {
    return sendPulseTokenCache.token;
  }

  const response = await safeJsonFetch(`${SENDPULSE_API_URL}/oauth/access_token`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
  });
  const token = response.body?.access_token;
  if (!response.ok || !hasUsableValue(token)) return '';
  sendPulseTokenCache = { token, expiresAt: now + Number(response.body.expires_in || 3600) };
  return token;
}

function parseMailbox(value, fallbackName = 'HUNDESALON_NIKA') {
  const raw = String(value || '').trim();
  const match = raw.match(/^(.*?)\s*<([^>]+)>$/);
  return { name: (match?.[1] || fallbackName).trim(), email: (match?.[2] || raw).trim() };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function sendSendPulseEmail(env, { to, subject, text, html = '', replyTo = '', from = '' }) {
  const recipients = (Array.isArray(to) ? to : String(to || '').split(','))
    .map(item => String(item || '').trim())
    .filter(Boolean);
  const token = await getSendPulseAccessToken(env);
  if (!hasUsableValue(token) || recipients.length === 0) {
    return { ok: false, skipped: true, reason: 'SendPulse credentials are not configured.' };
  }

  const htmlContent = String(html || '').trim();
  const payload = {
    email: {
      from: parseMailbox(from || getEnvValue(env, 'SENDPULSE_FROM', 'HUNDESALON_NIKA <info@hundesalon-nika.com>')),
      to: recipients.map(email => parseMailbox(email, email)),
      subject: String(subject || '').slice(0, 998),
      text: String(text || ''),
      html: htmlContent ? base64Encode(htmlContent) : undefined,
    },
  };
  if (hasUsableValue(replyTo)) {
    payload.email.reply_to = parseMailbox(replyTo, 'HUNDESALON NIKA');
  }

  let lastResult = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await safeJsonFetch(`${SENDPULSE_API_URL}/smtp/emails`, {
        method: 'POST',
        headers: {
          ...JSON_HEADERS,
          Authorization: `Bearer ${token}`,
          'User-Agent': 'hundesalon-nika.com/1.0 (Cloudflare Pages Function)',
        },
        body: JSON.stringify(payload),
      });
      result.ok = result.ok && result.body?.result === true;
      console.info(
        '[sendpulse] email delivery',
        JSON.stringify({ ok: result.ok, status: result.status, attempt: attempt + 1 })
      );
      if (result.ok || ![408, 429, 500, 502, 503, 504].includes(result.status)) return result;
      lastResult = result;
    } catch (error) {
      lastResult = { ok: false, status: 0, body: { error: error?.message || 'network error' } };
      console.error(
        '[sendpulse] email delivery error',
        JSON.stringify({ attempt: attempt + 1, error: error?.message || 'unknown' })
      );
    }
    if (attempt < 2) await sleep(250 * 2 ** attempt);
  }
  return lastResult || { ok: false, status: 0, body: { error: 'SendPulse request failed' } };
}

function normalizeSendPulseEventPayload(data) {
  const payload = {};

  for (const [key, value] of Object.entries(data || {})) {
    if (!/^[a-z][a-z0-9_]{0,63}$/i.test(key) || value === undefined || value === null) continue;

    if (key === 'automation_id' && Number.isFinite(Number(value))) {
      payload[key] = Number(value);
      continue;
    }

    const normalized = cleanText(value, 255);
    if (normalized) payload[key] = key === 'email' ? normalized.toLowerCase() : normalized;
  }

  return payload;
}

/**
 * Sends a server-side custom event to Automation 360 using the existing SendPulse bearer token.
 * Event resource names come only from Cloudflare configuration, never from form input.
 */
export async function sendSendPulseAutomationEvent(env, { eventType = '', data = {} } = {}) {
  const normalizedType = cleanText(eventType, 32).toLowerCase();
  const envName = SENDPULSE_EVENT_ENV_NAMES[normalizedType];
  if (!envName) {
    return { ok: false, skipped: true, reason: 'Unsupported SendPulse automation event type.' };
  }

  const eventName = getEnvValue(env, envName);
  if (!hasUsableValue(eventName)) {
    return { ok: false, skipped: true, reason: `SendPulse event ${envName} is not configured.` };
  }
  if (!SENDPULSE_EVENT_NAME_RE.test(eventName)) {
    console.error('[sendpulse] automation event configuration error', JSON.stringify({ eventType: normalizedType }));
    return { ok: false, skipped: true, reason: `SendPulse event ${envName} has an invalid resource name.` };
  }

  const payload = normalizeSendPulseEventPayload(data);
  if (!hasUsableValue(payload.email) && !hasUsableValue(payload.phone)) {
    return { ok: false, skipped: true, reason: 'SendPulse automation event requires email or phone.' };
  }

  const token = await getSendPulseAccessToken(env);
  if (!hasUsableValue(token)) {
    return { ok: false, skipped: true, reason: 'SendPulse credentials are not configured.' };
  }

  const endpoint = `${SENDPULSE_EVENT_API_URL}/${encodeURIComponent(eventName)}`;
  let lastResult = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await safeJsonFetch(endpoint, {
        method: 'POST',
        headers: {
          ...JSON_HEADERS,
          Authorization: `Bearer ${token}`,
          'User-Agent': 'hundesalon-nika.com/1.0 (Cloudflare Pages Function)',
        },
        body: JSON.stringify(payload),
      });
      console.info(
        '[sendpulse] automation event',
        JSON.stringify({ eventType: normalizedType, ok: result.ok, status: result.status, attempt: attempt + 1 })
      );
      if (result.ok || ![408, 429, 500, 502, 503, 504].includes(result.status)) return result;
      lastResult = result;
    } catch (error) {
      lastResult = { ok: false, status: 0, body: { error: error?.message || 'network error' } };
      console.error(
        '[sendpulse] automation event error',
        JSON.stringify({ eventType: normalizedType, attempt: attempt + 1, error: error?.message || 'unknown' })
      );
    }
    if (attempt < 2) await sleep(250 * 2 ** attempt);
  }

  return lastResult || { ok: false, status: 0, body: { error: 'SendPulse automation event failed' } };
}

export async function upsertSendPulseContact(
  env,
  { email, name = '', phone = '', lang = '', service = '', source = '', formType = '' }
) {
  const addressBookId = getEnvValue(env, 'SENDPULSE_ADDRESSBOOK_ID');
  const token = await getSendPulseAccessToken(env);
  if (!hasUsableValue(addressBookId) || !hasUsableValue(token) || !hasUsableValue(email)) {
    return { ok: false, skipped: true, reason: 'SendPulse address book is not configured.' };
  }

  const variables = [
    ['name', name],
    ['phone', phone],
    ['language', lang],
    ['service_type', service],
    ['lead_source', source],
    ['form_type', formType],
  ]
    .filter(([, value]) => hasUsableValue(value))
    .map(([variableName, value]) => ({ name: variableName, value: String(value) }));

  return safeJsonFetch(`${SENDPULSE_API_URL}/addressbooks/${encodeURIComponent(addressBookId)}/emails`, {
    method: 'POST',
    headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ emails: [{ email: String(email).trim().toLowerCase(), variables }] }),
  });
}
