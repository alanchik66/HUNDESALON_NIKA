const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

export function cleanText(value, maxLength = 2000) {
  return String(value ?? '')
    .trim()
    .replace(/<[^>]*>/g, '')
    .slice(0, maxLength);
}

export function getEnvValue(env, name, fallback = '') {
  return String(env?.[name] || fallback || '').trim();
}

export function hasUsableValue(value) {
  return Boolean(value) && !/ВАШ_|YOUR_|XXXXXXXX|TODO/i.test(value);
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

  return tokenResponse.ok && hasUsableValue(tokenResponse.body?.access_token)
    ? tokenResponse.body.access_token
    : '';
}

export async function appendGoogleSheetRow(env, { spreadsheetId, sheetName = 'bookings', values }) {
  const webhook = getEnvValue(env, 'GOOGLE_SHEETS_WEBHOOK_URL');
  if (hasUsableValue(webhook)) {
    return safeJsonFetch(webhook, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ spreadsheetId, sheetName, values }),
    });
  }

  const token = getEnvValue(env, 'GOOGLE_OAUTH_ACCESS_TOKEN');
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
  const token = getEnvValue(env, 'GOOGLE_OAUTH_ACCESS_TOKEN');
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
  const webhook = getEnvValue(env, 'TEAMS_WEBHOOK_URL');
  if (hasUsableValue(webhook)) {
    return safeJsonFetch(webhook, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ text: payload.text, title: payload.title || 'HUNDESALON NIKA' }),
    });
  }

  const graphToken = await getMicrosoftGraphToken(env);
  const teamId = getEnvValue(env, 'TEAM_ID');
  const channelId = getEnvValue(env, 'TEAM_CHANNEL_ID');
  if (!hasUsableValue(graphToken) || !hasUsableValue(teamId) || !hasUsableValue(channelId)) {
    return { ok: false, skipped: true, reason: 'Microsoft Teams credentials are not configured.' };
  }

  return safeJsonFetch(`https://graph.microsoft.com/v1.0/teams/${teamId}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      ...JSON_HEADERS,
      Authorization: `Bearer ${graphToken}`,
    },
    body: JSON.stringify({ body: { contentType: 'html', content: payload.html || payload.text } }),
  });
}

export async function sendGmailEmail(env, { to, subject, text }) {
  const token = getEnvValue(env, 'GOOGLE_OAUTH_ACCESS_TOKEN');
  const sender = getEnvValue(env, 'GMAIL_SENDER', 'info@hundesalon-nika.com');
  if (!hasUsableValue(token) || !hasUsableValue(to)) {
    return { ok: false, skipped: true, reason: 'Gmail credentials are not configured.' };
  }

  const message = [`From: ${sender}`, `To: ${to}`, `Subject: ${subject}`, 'Content-Type: text/plain; charset=UTF-8', '', text].join(
    '\r\n'
  );
  const bytes = new TextEncoder().encode(message);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000);
    binary += String.fromCharCode(...chunk);
  }
  const raw = btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

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
  const sender = getEnvValue(env, 'OUTLOOK_SENDER', getEnvValue(env, 'GMAIL_SENDER', 'info@hundesalon-nika.com'));
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

export async function uploadFileToDrive(env, { file, fileName, metadata = {} }) {
  const webhook = getEnvValue(env, 'GOOGLE_DRIVE_UPLOAD_WEBHOOK_URL');
  if (hasUsableValue(webhook)) {
    const formData = new FormData();
    formData.append('file', file, fileName);
    formData.append('metadata', JSON.stringify(metadata));
    return safeJsonFetch(webhook, { method: 'POST', body: formData });
  }

  const token = getEnvValue(env, 'GOOGLE_OAUTH_ACCESS_TOKEN');
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

  const upload = await safeJsonFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

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
