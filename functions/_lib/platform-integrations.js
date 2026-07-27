const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const FORM_HEADERS = { 'Content-Type': 'application/x-www-form-urlencoded' };
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const googleTokenCache = new Map();

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
  const response = await fetch(url, options);
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

export async function getMicrosoftGraphToken(env) {
  const directToken = getEnvValue(env, 'MS_GRAPH_ACCESS_TOKEN');
  if (hasUsableValue(directToken)) {
    return directToken;
  }

  const tenantId = getEnvValue(env, 'MS_TENANT_ID');
  const clientId = getEnvValue(env, 'MS_CLIENT_ID');
  const clientSecret = getEnvValue(env, 'MS_CLIENT_SECRET');
  if (!hasUsableValue(tenantId) || !hasUsableValue(clientId) || !hasUsableValue(clientSecret)) {
    return '';
  }

  const tokenResponse = await safeJsonFetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    }
  );

  return tokenResponse.ok && hasUsableValue(tokenResponse.body?.access_token) ? tokenResponse.body.access_token : '';
}

export async function callGoogleAppsScriptGateway(env, action, payload) {
  const webhook = getEnvValue(env, 'GOOGLE_APPS_SCRIPT_WEBHOOK_URL');
  if (!hasUsableValue(webhook)) {
    return { ok: false, skipped: true, reason: 'Google Apps Script gateway is not configured.' };
  }

  return safeJsonFetch(webhook, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      action,
      secret: getEnvValue(env, 'GOOGLE_GATEWAY_SECRET'),
      ...payload,
    }),
  });
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

  const range = encodeURIComponent(`${sheetName}!A:Z`);
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

export async function createGoogleCalendarEvent(env, { calendarId, summary, description, startDateTime, endDateTime }) {
  const appsScriptResult = await callGoogleAppsScriptGateway(env, 'calendar', {
    calendarId,
    summary,
    description,
    startDateTime,
    endDateTime,
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
      body: JSON.stringify({ calendarId, summary, description, startDateTime, endDateTime }),
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
      start: { dateTime: startDateTime, timeZone: 'Europe/Berlin' },
      end: { dateTime: endDateTime, timeZone: 'Europe/Berlin' },
    }),
  });
}

export async function sendTeamsMessage(env, payload) {
  return { ok: false, skipped: true, reason: 'Microsoft Teams integration is disabled.' };
}

export async function sendGmailEmail(env, { to, subject, text, replyTo = '', allowImplicitSender = false }) {
  const sender = getEnvValue(env, 'GMAIL_SENDER');
  if (!hasUsableValue(sender) && !allowImplicitSender) {
    return { ok: false, skipped: true, reason: 'Gmail sender is not explicitly configured.' };
  }

  const serviceAccountSubject = getEnvValue(env, 'GOOGLE_SERVICE_ACCOUNT_SUBJECT');
  const token =
    (hasUsableValue(serviceAccountSubject)
      ? await getGoogleAccessToken(env, ['https://www.googleapis.com/auth/gmail.send'], serviceAccountSubject)
      : '') || (await getGoogleOAuthAccessToken(env));
  if (!hasUsableValue(token) || !hasUsableValue(to)) {
    return { ok: false, skipped: true, reason: 'Gmail credentials are not configured.' };
  }

  const message = [
    hasUsableValue(sender) ? `From: ${sender}` : null,
    `To: ${to}`,
    hasUsableValue(replyTo) ? `Reply-To: ${replyTo}` : null,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    text,
  ]
    .filter(line => line !== null)
    .join('\r\n');
  const bytes = new TextEncoder().encode(message);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000);
    binary += String.fromCharCode(...chunk);
  }
  const raw = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

  return safeJsonFetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      ...JSON_HEADERS,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ raw }),
  });
}

export async function sendOutlookEmail(env, { to, subject, text }) {
  const token = await getMicrosoftGraphToken(env);
  if (!hasUsableValue(token) || !hasUsableValue(to)) {
    return { ok: false, skipped: true, reason: 'Outlook credentials are not configured.' };
  }

  const hasDirectToken = hasUsableValue(getEnvValue(env, 'MS_GRAPH_ACCESS_TOKEN'));
  const sender = getEnvValue(env, 'OUTLOOK_SENDER');
  if (!hasDirectToken && !hasUsableValue(sender)) {
    return { ok: false, skipped: true, reason: 'Outlook sender mailbox is not configured.' };
  }
  const endpoint = hasDirectToken
    ? 'https://graph.microsoft.com/v1.0/me/sendMail'
    : `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`;

  return safeJsonFetch(endpoint, {
    method: 'POST',
    headers: {
      ...JSON_HEADERS,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'Text', content: text },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    }),
  });
}

export async function sendResendEmail(env, { to, subject, text, replyTo = '', from = '' }) {
  const apiKey = getEnvValue(env, 'RESEND_API_KEY');
  const recipients = (Array.isArray(to) ? to : String(to || '').split(','))
    .map(item => String(item || '').trim())
    .filter(Boolean);
  if (!hasUsableValue(apiKey) || recipients.length === 0) {
    return { ok: false, skipped: true, reason: 'Resend credentials are not configured.' };
  }

  const payload = {
    from: from || getEnvValue(env, 'RESEND_FROM', 'Hundesalon Nika <noreply@hundesalon-nika.com>'),
    to: recipients,
    subject,
    text,
  };
  if (hasUsableValue(replyTo)) {
    payload.reply_to = replyTo;
  }

  return safeJsonFetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      ...JSON_HEADERS,
      Authorization: `Bearer ${apiKey}`,
      'Idempotency-Key': crypto.randomUUID(),
      'User-Agent': 'hundesalon-nika.com/1.0 (Cloudflare Pages Function)',
    },
    body: JSON.stringify(payload),
  });
}

const APPS_SCRIPT_MAX_BYTES = 35 * 1024 * 1024;

export async function createDriveResumableUploadSession(env, { fileName, mimeType, fileSize, metadata = {} }) {
  const token =
    (await getGoogleAccessToken(env, ['https://www.googleapis.com/auth/drive.file'])) ||
    (await getGoogleOAuthAccessToken(env));
  const folderId = getEnvValue(env, 'DRIVE_UPLOAD_FOLDER');
  if (!hasUsableValue(token) || !hasUsableValue(folderId)) {
    return { ok: false, skipped: true, reason: 'Google Drive credentials are not configured.' };
  }

  const safeName = String(fileName || 'pet-photo').replace(/[^\w.-]+/g, '-').slice(-90);
  const uniqueName = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const meta = {
    name: uniqueName,
    parents: [folderId],
    description: JSON.stringify(metadata),
  };

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType || 'application/octet-stream',
        'X-Upload-Content-Length': String(fileSize),
      },
      body: JSON.stringify(meta),
    }
  );

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    return { ok: false, status: response.status, body: bodyText };
  }

  const uploadUrl = response.headers.get('Location');
  if (!uploadUrl) {
    return { ok: false, reason: 'Missing resumable upload URL.' };
  }

  return { ok: true, uploadUrl, fileName: uniqueName };
}

export async function uploadFileToDrive(env, { file, fileName, metadata = {} }) {
  const appsScriptWebhook = getEnvValue(env, 'GOOGLE_APPS_SCRIPT_WEBHOOK_URL');
  if (hasUsableValue(appsScriptWebhook) && file.size <= APPS_SCRIPT_MAX_BYTES) {
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const appsScriptResult = await callGoogleAppsScriptGateway(env, 'drive', {
      fileName,
      mimeType: file.type || 'application/octet-stream',
      fileBase64: base64Encode(fileBytes),
      metadata,
    });

    if (appsScriptResult.ok && appsScriptResult.body?.fileUrl) {
      return {
        ...appsScriptResult,
        body: {
          ...appsScriptResult.body,
          id: appsScriptResult.body.fileId || appsScriptResult.body.id,
          webViewLink: appsScriptResult.body.fileUrl,
        },
      };
    }
    return appsScriptResult;
  }

  const webhook = getEnvValue(env, 'GOOGLE_DRIVE_UPLOAD_WEBHOOK_URL');
  if (hasUsableValue(webhook)) {
    const formData = new FormData();
    formData.append('file', file, fileName);
    formData.append('metadata', JSON.stringify(metadata));
    return safeJsonFetch(webhook, {
      method: 'POST',
      headers: { 'X-Hundesalon-Gateway-Secret': getEnvValue(env, 'GOOGLE_GATEWAY_SECRET') },
      body: formData,
    });
  }

  const token =
    (await getGoogleAccessToken(env, ['https://www.googleapis.com/auth/drive.file'])) ||
    (await getGoogleOAuthAccessToken(env));
  const folderId = getEnvValue(env, 'DRIVE_UPLOAD_FOLDER');
  if (!hasUsableValue(token) || !hasUsableValue(folderId)) {
    return { ok: false, skipped: true, reason: 'Google Drive credentials are not configured.' };
  }

  const boundary = `hundesalon_${crypto.randomUUID()}`;
  const fileBytes = await file.arrayBuffer();
  const encoder = new TextEncoder();
  const meta = {
    name: fileName,
    parents: [folderId],
    description: JSON.stringify(metadata),
  };
  const head = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`
  );
  const tail = encoder.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.byteLength + fileBytes.byteLength + tail.byteLength);
  body.set(head, 0);
  body.set(new Uint8Array(fileBytes), head.byteLength);
  body.set(tail, head.byteLength + fileBytes.byteLength);

  const upload = await safeJsonFetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (upload.ok && upload.body?.id) {
    return {
      ...upload,
      body: {
        ...upload.body,
        webViewLink: upload.body.webViewLink || `https://drive.google.com/file/d/${upload.body.id}/view`,
      },
    };
  }

  return upload;
}
