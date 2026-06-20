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

  const spreadsheetFile = await googleJson('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
    method: 'POST',
    body: {
      name: 'HUNDESALON NIKA Platform Log',
      mimeType: 'application/vnd.google-apps.spreadsheet',
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const spreadsheetId = spreadsheetFile.id;

  await googleJson(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: {
      requests: [
        {
          updateSpreadsheetProperties: {
            properties: { locale: 'de_DE', timeZone: 'Europe/Berlin' },
            fields: 'locale,timeZone',
          },
        },
        {
          updateSheetProperties: {
            properties: { sheetId: 0, title: 'bookings', gridProperties: { rowCount: 1000, columnCount: 16 } },
            fields: 'title,gridProperties(rowCount,columnCount)',
          },
        },
        {
          addSheet: {
            properties: { title: 'subscribers', gridProperties: { rowCount: 1000, columnCount: 8 } },
          },
        },
      ],
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
  });

  await googleJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/bookings!A1:L1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: {
        values: [
          [
            'created_at',
            'lang',
            'form_type',
            'name',
            'email',
            'phone',
            'service',
            'date',
            'time',
            'file_url',
            'payment_status',
            'message',
          ],
        ],
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
    }
  );
  await googleJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/subscribers!A1:E1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: { values: [['created_at', 'email', 'lang', 'page', 'origin']] },
      scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
    }
  );

  await shareDriveFile(spreadsheetId, ownerEmail);

  const folder = await googleJson('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
    method: 'POST',
    body: {
      name: 'HUNDESALON NIKA Uploads',
      mimeType: 'application/vnd.google-apps.folder',
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  await shareDriveFile(folder.id, ownerEmail);

  return {
    success: true,
    calendarId: calendar.id,
    spreadsheetId,
    driveFolderId: folder.id,
    driveFolderUrl: folder.webViewLink,
  };
}

async function appendSheetRow(payload) {
  const spreadsheetId = payload.spreadsheetId || process.env.SHEET_ID;
  const sheetName = payload.sheetName || 'bookings';
  if (!spreadsheetId) throw new Error('Missing spreadsheetId.');

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
