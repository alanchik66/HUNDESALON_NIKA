import { createServer } from 'node:http';
import Busboy from 'busboy';

const PORT = Number(process.env.PORT || 8080);
const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const TOKEN_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
];
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || 'hundesalon-nika-shell-2026';
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || 'hundesalon-nika-shell-uploads';

const tokenCache = new Map();

function respond(res, status, body) {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(body));
}

function getSecret() {
  return String(process.env.GATEWAY_SHARED_SECRET || '').trim();
}

function requireSecret(req, res) {
  const configured = getSecret();
  const provided =
    req.headers['x-hundesalon-gateway-secret'] ||
    String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');

  if (!configured || provided !== configured) {
    respond(res, 403, { success: false, message: 'Forbidden' });
    return false;
  }
  return true;
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function readMultipart(req) {
  return new Promise((resolve, reject) => {
    const fields = {};
    let file = null;
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

    busboy.on('field', (name, value) => {
      fields[name] = value;
    });

    busboy.on('file', (name, stream, info) => {
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('limit', () => reject(new Error('File is larger than 5 MB.')));
      stream.on('end', () => {
        file = {
          fieldName: name,
          fileName: info.filename || 'upload.bin',
          mimeType: info.mimeType || 'application/octet-stream',
          buffer: Buffer.concat(chunks),
        };
      });
    });

    busboy.on('error', reject);
    busboy.on('finish', () => resolve({ fields, file }));
    req.pipe(busboy);
  });
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
    throw new Error(`${method} ${url} failed: ${response.status} ${JSON.stringify(data).slice(0, 600)}`);
  }
  return data;
}

function firestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number' && Number.isFinite(value)) return Number.isInteger(value) ? { integerValue: value } : { doubleValue: value };
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

function safeObjectName(fileName) {
  const cleaned = String(fileName || 'upload.bin')
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `uploads/${stamp}-${crypto.randomUUID()}-${cleaned || 'upload.bin'}`;
}

async function uploadStorageObject(file, metadata = {}) {
  const objectName = safeObjectName(file.fileName);
  const token = await getGoogleToken(['https://www.googleapis.com/auth/devstorage.read_write']);
  const response = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(STORAGE_BUCKET)}/o?uploadType=media&name=${encodeURIComponent(objectName)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': file.mimeType || 'application/octet-stream',
        'X-Goog-Meta-Source': 'hundesalon-nika',
        'X-Goog-Meta-Details': Buffer.from(JSON.stringify(metadata)).toString('base64url').slice(0, 1024),
      },
      body: file.buffer,
    }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Cloud Storage upload failed: ${response.status} ${JSON.stringify(data).slice(0, 600)}`);
  }
  return {
    success: true,
    id: data.id,
    name: data.name,
    bucket: STORAGE_BUCKET,
    object: objectName,
    webViewLink: `https://console.cloud.google.com/storage/browser/_details/${encodeURIComponent(STORAGE_BUCKET)}/${encodeURIComponent(objectName)}?project=${encodeURIComponent(PROJECT_ID)}`,
  };
}

async function shareDriveFile(fileId, emailAddress) {
  if (!emailAddress) return;
  await googleJson(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?sendNotificationEmail=false`,
    {
      method: 'POST',
      body: {
        type: 'user',
        role: 'writer',
        emailAddress,
      },
      scopes: ['https://www.googleapis.com/auth/drive'],
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
    await googleJson(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/acl`,
      {
        method: 'POST',
        body: { role: 'owner', scope: { type: 'user', value: ownerEmail } },
        scopes: ['https://www.googleapis.com/auth/calendar'],
      }
    );
  }

  await writeFirestoreDocument('platform_setup', {
    createdAt: new Date().toISOString(),
    ownerEmail,
    calendarId: calendar.id,
    storageBucket: STORAGE_BUCKET,
    storageMode: 'cloud-storage',
    logMode: 'firestore',
  });

  return {
    success: true,
    calendarId: calendar.id,
    logMode: 'firestore',
    storageBucket: STORAGE_BUCKET,
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
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(`${sheetName}!A:Z`)}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      body: { values: [payload.values || []] },
      scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
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

async function uploadDriveFile(req) {
  const { fields, file } = await readMultipart(req);
  if (!file) throw new Error('Missing file.');

  const metadata = JSON.parse(fields.metadata || '{}');
  if (STORAGE_BUCKET && process.env.GOOGLE_UPLOAD_MODE !== 'drive') {
    return uploadStorageObject(file, metadata);
  }

  const folderId = metadata.folderId || process.env.DRIVE_UPLOAD_FOLDER;
  if (!folderId) throw new Error('Missing Drive folder.');

  const boundary = `hundesalon_${crypto.randomUUID()}`;
  const meta = {
    name: file.fileName,
    parents: [folderId],
    description: JSON.stringify(metadata),
  };
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${file.mimeType}\r\n\r\n`,
    'utf8'
  );
  const tail = Buffer.from(`\r\n--${boundary}--`, 'utf8');
  const body = Buffer.concat([head, file.buffer, tail]);
  const token = await getGoogleToken(['https://www.googleapis.com/auth/drive.file']);
  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Drive upload failed: ${response.status} ${JSON.stringify(data).slice(0, 600)}`);
  return data;
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
      respond(res, 200, await createCalendarEvent(await readJson(req)));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/drive') {
      respond(res, 200, await uploadDriveFile(req));
      return;
    }

    respond(res, 404, { success: false, message: 'Not found' });
  } catch (error) {
    console.error(error);
    respond(res, 502, { success: false, message: error.message || 'Gateway failed' });
  }
}

createServer((req, res) => {
  handle(req, res).catch(error => {
    console.error(error);
    respond(res, 500, { success: false, message: 'Internal error' });
  });
}).listen(PORT, () => {
  console.log(`HUNDESALON Google gateway listening on ${PORT}`);
});
