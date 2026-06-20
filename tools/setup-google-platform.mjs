import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const PROJECT_NAME = 'hundesalon-nika';
const ACCOUNT_ID = '25e872aeab8cb246c69142ab07cd0fee';
const DEFAULT_SALON_EMAIL = 'info@hundesalon-nika.com';
const DEFAULT_RESOURCE_PREFIX = 'HUNDESALON NIKA';
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
];

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function latestOAuthClientJson() {
  const downloads = join(homedir(), 'Downloads');
  if (!existsSync(downloads)) return '';
  const candidates = readdirSync(downloads, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.json$/i.test(entry.name))
    .filter((entry) => /client_secret|oauth|credentials/i.test(entry.name))
    .map((entry) => {
      const fullPath = join(downloads, entry.name);
      return { fullPath, mtimeMs: statSync(fullPath).mtimeMs };
    });

  return candidates
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .map((item) => item.fullPath)[0] || '';
}

function readOAuthClient(filePath) {
  const raw = JSON.parse(readFileSync(filePath, 'utf8'));
  const client = raw.installed || raw.web || raw;
  if (!client.client_id || !client.client_secret) {
    throw new Error(`OAuth client JSON is invalid: ${filePath}`);
  }
  return {
    clientId: client.client_id,
    clientSecret: client.client_secret,
  };
}

function openBrowser(url) {
  if (process.platform === 'win32') {
    spawn('powershell.exe', ['-NoProfile', '-Command', 'Start-Process', url], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
    return;
  }
  const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
  spawn(command, [url], { detached: true, stdio: 'ignore' }).unref();
}

async function waitForOAuthCode({ clientId, port, state }) {
  const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  return new Promise((resolvePromise, rejectPromise) => {
    const server = createServer((request, response) => {
      try {
        const url = new URL(request.url || '/', redirectUri);
        if (url.pathname !== '/oauth2callback') {
          response.writeHead(404).end('Not found');
          return;
        }

        const returnedState = url.searchParams.get('state');
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        if (error) {
          response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`OAuth error: ${error}`);
          rejectPromise(new Error(`OAuth error: ${error}`));
          server.close();
          return;
        }
        if (!code || returnedState !== state) {
          response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Invalid OAuth callback');
          rejectPromise(new Error('Invalid OAuth callback'));
          server.close();
          return;
        }

        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(
          '<!doctype html><meta charset="utf-8"><title>HUNDESALON NIKA</title><body><h1>Google connected</h1><p>You can close this tab and return to Codex.</p></body>'
        );
        resolvePromise({ code, redirectUri });
        server.close();
      } catch (error) {
        rejectPromise(error);
        server.close();
      }
    });

    server.listen(port, '127.0.0.1', () => {
      console.log(`Open OAuth consent in browser. Waiting on localhost:${port} ...`);
      openBrowser(authUrl.toString());
    });
  });
}

async function googleFetch(accessToken, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${url} failed ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function exchangeCode({ clientId, clientSecret, code, redirectUri }) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const body = await response.json();
  if (!response.ok || !body.access_token || !body.refresh_token) {
    throw new Error(`OAuth token exchange failed: ${JSON.stringify({ status: response.status, error: body.error })}`);
  }
  return body;
}

async function createGoogleResources(accessToken, shareEmail, prefix) {
  const profile = await googleFetch(accessToken, 'https://www.googleapis.com/oauth2/v2/userinfo');
  const calendar = await googleFetch(accessToken, 'https://www.googleapis.com/calendar/v3/calendars', {
    method: 'POST',
    body: JSON.stringify({
      summary: `${prefix} Bookings`,
      timeZone: 'Europe/Berlin',
    }),
  });

  const spreadsheet = await googleFetch(accessToken, 'https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    body: JSON.stringify({
      properties: { title: `${prefix} Platform Log` },
      sheets: [
        { properties: { title: 'bookings' } },
        { properties: { title: 'subscribers' } },
      ],
    }),
  });

  await googleFetch(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet.spreadsheetId}/values/bookings!A1:L1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({
        values: [[
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
        ]],
      }),
    }
  );

  await googleFetch(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet.spreadsheetId}/values/subscribers!A1:E1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({ values: [['created_at', 'email', 'lang', 'page', 'origin']] }),
    }
  );

  const folder = await googleFetch(accessToken, 'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
    method: 'POST',
    body: JSON.stringify({
      name: `${prefix} Uploads`,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  const shareResults = [];
  if (shareEmail) {
    for (const item of [
      { type: 'drive', id: folder.id, label: 'drive folder' },
      { type: 'drive', id: spreadsheet.spreadsheetId, label: 'spreadsheet' },
    ]) {
      try {
        await googleFetch(accessToken, `https://www.googleapis.com/drive/v3/files/${item.id}/permissions?sendNotificationEmail=true`, {
          method: 'POST',
          body: JSON.stringify({ role: 'writer', type: 'user', emailAddress: shareEmail }),
        });
        shareResults.push(`${item.label}: shared`);
      } catch (error) {
        shareResults.push(`${item.label}: share failed`);
      }
    }

    try {
      await googleFetch(accessToken, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/acl`, {
        method: 'POST',
        body: JSON.stringify({ role: 'writer', scope: { type: 'user', value: shareEmail } }),
      });
      shareResults.push('calendar: shared');
    } catch (error) {
      shareResults.push('calendar: share failed');
    }
  }

  return {
    calendarId: calendar.id,
    spreadsheetId: spreadsheet.spreadsheetId,
    driveFolderId: folder.id,
    driveFolderUrl: folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`,
    googleAccountEmail: profile.email || '',
    shareResults,
  };
}

function wranglerOAuthToken() {
  const configPath = join(homedir(), '.wrangler', 'config', 'default.toml');
  if (!existsSync(configPath)) return '';
  const raw = readFileSync(configPath, 'utf8');
  return raw.match(/oauth_token\s*=\s*"([^"]+)"/)?.[1] || '';
}

async function updateCloudflareSecrets(vars) {
  const token = wranglerOAuthToken();
  if (!token) {
    return { ok: false, message: 'Wrangler OAuth token not found.' };
  }

  const envVars = Object.fromEntries(
    Object.entries(vars).map(([key, value]) => [key, { type: 'secret_text', value: String(value) }])
  );
  const body = {
    deployment_configs: {
      production: { env_vars: envVars },
      preview: { env_vars: envVars },
    },
  };

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok || result.success === false) {
    return { ok: false, message: JSON.stringify(result.errors || result) };
  }
  return { ok: true };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const clientFile = args['client-file'] ? resolve(String(args['client-file'])) : latestOAuthClientJson();
  if (!clientFile || !existsSync(clientFile)) {
    throw new Error('OAuth client JSON was not found. Download the Desktop app JSON from Google Auth Platform first.');
  }

  const salonEmail = String(args['salon-email'] || process.env.SALON_EMAIL || DEFAULT_SALON_EMAIL).trim();
  const shareEmail = String(args['share-email'] || process.env.GOOGLE_SHARE_EMAIL || salonEmail).trim();
  const prefix = String(args.prefix || DEFAULT_RESOURCE_PREFIX).trim();
  const { clientId, clientSecret } = readOAuthClient(clientFile);
  const port = Number(args.port || 53682);
  const state = randomBytes(16).toString('hex');
  const { code, redirectUri } = await waitForOAuthCode({ clientId, port, state });
  const token = await exchangeCode({ clientId, clientSecret, code, redirectUri });
  const resources = await createGoogleResources(token.access_token, shareEmail, prefix);

  const cloudflare = await updateCloudflareSecrets({
    GOOGLE_OAUTH_CLIENT_ID: clientId,
    GOOGLE_OAUTH_CLIENT_SECRET: clientSecret,
    GOOGLE_OAUTH_REFRESH_TOKEN: token.refresh_token,
    GOOGLE_CALENDAR_ID: resources.calendarId,
    SHEET_ID: resources.spreadsheetId,
    DRIVE_UPLOAD_FOLDER: resources.driveFolderId,
    GMAIL_SENDER: resources.googleAccountEmail,
    SALON_EMAIL: salonEmail,
    CONTACT_RECIPIENT_EMAIL: salonEmail,
    BOOKING_RECIPIENT_EMAIL: salonEmail,
    GOOGLE_SHARE_EMAIL: shareEmail,
  });

  console.log(JSON.stringify({
    clientFile: basename(clientFile),
    calendarId: resources.calendarId,
    spreadsheetId: resources.spreadsheetId,
    driveFolderId: resources.driveFolderId,
    driveFolderUrl: resources.driveFolderUrl,
    googleAccountEmail: resources.googleAccountEmail,
    shareEmail,
    shareResults: resources.shareResults,
    cloudflare,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
