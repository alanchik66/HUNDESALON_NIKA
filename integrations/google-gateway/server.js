import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';

const PORT = Number(process.env.PORT || 8080);
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const TOKEN_URL = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/spreadsheets',
];
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || 'hundesalon-nika-shell-2026';
const MAX_JSON_BODY_BYTES = 64 * 1024;

const tokenCache = new Map();

function respond(res, status, body) {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(body));
}

function getSecret() {
  return String(process.env.GATEWAY_SHARED_SECRET || '').trim();
}

function secretsMatch(left, right) {
  const leftDigest = createHash('sha256')
    .update(String(left ?? ''), 'utf8')
    .digest();
  const rightDigest = createHash('sha256')
    .update(String(right ?? ''), 'utf8')
    .digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function publicHttpError(statusCode, publicMessage) {
  const error = new Error(publicMessage);
  error.statusCode = statusCode;
  error.publicMessage = publicMessage;
  return error;
}

function requireSecret(req, res) {
  const configured = getSecret();
  const provided =
    req.headers['x-hundesalon-gateway-secret'] || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');

  if (!configured || !secretsMatch(provided, configured)) {
    respond(res, 403, { success: false, message: 'Forbidden' });
    return false;
  }
  return true;
}

async function readJson(req) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_JSON_BODY_BYTES) {
      throw publicHttpError(413, 'Payload too large');
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw publicHttpError(400, 'Invalid JSON');
  }
}

async function getGoogleToken(scopes = SCOPES) {
  const scopeText = scopes.join(',');
  const cached = tokenCache.get(scopeText);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt - 90 > nowSeconds) return cached.token;

  const url = `${TOKEN_URL}?scopes=${encodeURIComponent(scopeText)}`;
  const response = await fetch(url, { headers: { 'Metadata-Flavor': 'Google' } });
  if (!response.ok) {
    throw new Error(`Metadata token failed: ${response.status}`);
  }
  const data = await response.json();
  tokenCache.set(scopeText, {
    token: data.access_token,
    expiresAt: nowSeconds + Number(data.expires_in || 3600),
  });
  return data.access_token;
}

async function googleJson(url, { method = 'GET', body = null, scopes = SCOPES } = {}) {
  const token = await getGoogleToken(scopes);
  const response = await fetch(url, {
    method,
    headers: {
      ...JSON_HEADERS,
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : null,
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const error = new Error(`Google API request failed with status ${response.status}`);
    error.statusCode = 502;
    throw error;
  }
  return data;
}

function firestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number' && Number.isFinite(value))
    return Number.isInteger(value) ? { integerValue: value } : { doubleValue: value };
  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, firestoreValue(nested)])),
      },
    };
  }
  return { stringValue: String(value) };
}

async function writeFirestoreDocument(collection, data) {
  const documentId = `${Date.now()}-${crypto.randomUUID()}`;
  const fields = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, firestoreValue(value)]));
  return googleJson(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${encodeURIComponent(collection)}?documentId=${encodeURIComponent(documentId)}`,
    {
      method: 'POST',
      body: { fields },
      scopes: ['https://www.googleapis.com/auth/datastore'],
    }
  );
}

async function createSetup(ownerEmail) {
  const calendar = await googleJson('https://www.googleapis.com/calendar/v3/calendars', {
    method: 'POST',
    body: { summary: 'HUNDESALON NIKA Bookings', timeZone: 'Europe/Berlin' },
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  if (ownerEmail) {
    await googleJson(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/acl`, {
      method: 'POST',
      body: { role: 'owner', scope: { type: 'user', value: ownerEmail } },
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
  }

  await writeFirestoreDocument('platform_setup', {
    createdAt: new Date().toISOString(),
    ownerEmail,
    calendarId: calendar.id,
    logMode: 'firestore',
  });

  return {
    success: true,
    calendarId: calendar.id,
    logMode: 'firestore',
  };
}

async function appendSheetRow(payload) {
  const spreadsheetId = payload.spreadsheetId || process.env.SHEET_ID;
  const sheetName = payload.sheetName || 'bookings';
  if (!spreadsheetId || process.env.GOOGLE_LOG_MODE === 'firestore') {
    const collection = sheetName === 'subscribers' ? 'subscribers' : 'bookings';
    const document = await writeFirestoreDocument(collection, {
      createdAt: new Date().toISOString(),
      sheetName,
      spreadsheetId: spreadsheetId || '',
      values: payload.values || [],
      source: 'cloudflare-pages',
    });
    return { success: true, logMode: 'firestore', documentName: document.name };
  }

  return googleJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(`${sheetName}!A:AZ`)}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      body: { values: [payload.values || []] },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    }
  );
}

async function createCalendarEvent(payload) {
  const calendarId = payload.calendarId || process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) throw new Error('Missing calendarId.');

  return googleJson(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: {
      summary: payload.summary || 'HUNDESALON NIKA Booking',
      description: payload.description || '',
      start: { dateTime: payload.startDateTime, timeZone: 'Europe/Berlin' },
      end: { dateTime: payload.endDateTime, timeZone: 'Europe/Berlin' },
    },
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
}

async function getCalendarBusyIntervals(payload) {
  const calendarId = payload.calendarId || process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId) throw new Error('Missing calendarId.');
  if (!payload.timeMin || !payload.timeMax) throw new Error('Missing free/busy time range.');

  return googleJson('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    body: {
      timeMin: payload.timeMin,
      timeMax: payload.timeMax,
      items: [{ id: calendarId }],
    },
    scopes: ['https://www.googleapis.com/auth/calendar.freebusy'],
  });
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'GET' && url.pathname === '/health') {
    respond(res, 200, { success: true, service: 'hundesalon-google-gateway' });
    return;
  }

  if (!requireSecret(req, res)) return;

  try {
    if (req.method === 'POST' && url.pathname === '/setup') {
      respond(res, 200, await createSetup((await readJson(req)).ownerEmail || ''));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/sheets') {
      respond(res, 200, await appendSheetRow(await readJson(req)));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/calendar') {
      const payload = await readJson(req);
      const result =
        payload.action === 'calendar_freebusy'
          ? await getCalendarBusyIntervals(payload)
          : await createCalendarEvent(payload);
      respond(res, 200, result);
      return;
    }
    respond(res, 404, { success: false, message: 'Not found' });
  } catch (error) {
    const status = Number(error?.statusCode || 502);
    console.error(JSON.stringify({ event: 'gateway_request_failed', status, error: error?.name || 'Error' }));
    respond(res, status, { success: false, message: error?.publicMessage || 'Gateway request failed' });
  }
}

createServer((req, res) => {
  handle(req, res).catch(error => {
    console.error(JSON.stringify({ event: 'gateway_unhandled_error', error: error?.name || 'Error' }));
    respond(res, 500, { success: false, message: 'Internal error' });
  });
}).listen(PORT, () => {
  console.log(`HUNDESALON Google gateway listening on ${PORT}`);
});
