import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const PROJECT_NAME = 'hundesalon-nika';
const ACCOUNT_ID = '25e872aeab8cb246c69142ab07cd0fee';
const DEFAULT_SALON_EMAIL = 'info@hundesalon-nika.com';
const DEFAULT_ADMIN_EMAILS = ['snaiper1984@gmail.com', 'ryndenko1982@gmail.com'];
const DEFAULT_CLIENT_EMAIL_FROM = 'Hundesalon Nika <noreply@hundesalon-nika.com>';
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

function parseEmailList(value, fallback = []) {
  const rawValue = Array.isArray(value) ? value.join(',') : String(value || '');
  const items = rawValue
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const emails = items.length > 0 ? items : fallback;
  const seen = new Set();
  return emails.filter((email) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || seen.has(email)) return false;
    seen.add(email);
    return true;
  });
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
      console.log(`OAuth URL: ${authUrl.toString()}`);
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

async function createGoogleResources(accessToken, shareEmails, prefix) {
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
  for (const shareEmail of shareEmails) {
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
          shareResults.push(`${item.label}: shared with ${shareEmail}`);
        } catch (error) {
          shareResults.push(`${item.label}: share failed for ${shareEmail}`);
        }
      }

      try {
        await googleFetch(accessToken, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/acl`, {
          method: 'POST',
          body: JSON.stringify({ role: 'writer', scope: { type: 'user', value: shareEmail } }),
        });
        shareResults.push(`calendar: shared with ${shareEmail}`);
      } catch (error) {
        shareResults.push(`calendar: share failed for ${shareEmail}`);
      }
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

function compactSecrets(vars) {
  return Object.fromEntries(
    Object.entries(vars)
      .filter(([, value]) => String(value || '').trim() !== '')
      .map(([key, value]) => [key, String(value)])
  );
}

function runCommand(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      ...options,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', rejectPromise);
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }
      rejectPromise(new Error(`${command} ${args.join(' ')} failed ${code}: ${stderr || stdout}`));
    });
  });
}

async function updateCloudflareSecretsWithWrangler(vars) {
  const envVars = compactSecrets(vars);
  const tempFile = join(tmpdir(), `hundesalon-pages-secrets-${randomBytes(8).toString('hex')}.json`);
  const wranglerArgs = ['wrangler', 'pages', 'secret', 'bulk', tempFile, '--project-name', PROJECT_NAME];
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
  const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'npx.cmd', ...wranglerArgs] : wranglerArgs;
  writeFileSync(tempFile, JSON.stringify(envVars, null, 2), 'utf8');
  try {
    await runCommand(command, args, { cwd: process.cwd() });
    return { ok: true, via: 'wrangler' };
  } finally {
    try {
      unlinkSync(tempFile);
    } catch {
      // The temp file only contains deployment secrets and should not persist.
    }
  }
}

async function updateCloudflareSecrets(vars) {
  const token = wranglerOAuthToken();
  if (!token) {
    return updateCloudflareSecretsWithWrangler(vars);
  }

  const envVars = Object.fromEntries(
    Object.entries(compactSecrets(vars)).map(([key, value]) => [key, { type: 'secret_text', value }])
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
    const fallback = await updateCloudflareSecretsWithWrangler(vars);
    return {
      ...fallback,
      rest: { ok: false, message: JSON.stringify(result.errors || result) },
    };
  }
  return { ok: true, via: 'cloudflare-api' };
}

async function readExistingGoogleResources(accessToken, args) {
  const calendarId = String(args['calendar-id'] || process.env.GOOGLE_CALENDAR_ID || '').trim();
  const spreadsheetId = String(args['sheet-id'] || process.env.SHEET_ID || '').trim();
  const driveFolderId = String(args['drive-folder-id'] || process.env.DRIVE_UPLOAD_FOLDER || '').trim();
  if (!calendarId || !spreadsheetId || !driveFolderId) return null;

  const profile = await googleFetch(accessToken, 'https://www.googleapis.com/oauth2/v2/userinfo');
  return {
    calendarId,
    spreadsheetId,
    driveFolderId,
    driveFolderUrl: `https://drive.google.com/drive/folders/${driveFolderId}`,
    googleAccountEmail: profile.email || '',
    shareResults: ['existing Google resources reused'],
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const clientFile = args['client-file'] ? resolve(String(args['client-file'])) : latestOAuthClientJson();
  if (!clientFile || !existsSync(clientFile)) {
    throw new Error('OAuth client JSON was not found. Download the Desktop app JSON from Google Auth Platform first.');
  }

  const salonEmail = String(args['salon-email'] || process.env.SALON_EMAIL || DEFAULT_SALON_EMAIL).trim();
  const adminEmails = parseEmailList(
    args['admin-emails'] || process.env.ADMIN_NOTIFICATION_EMAILS,
    DEFAULT_ADMIN_EMAILS
  );
  const shareEmails = parseEmailList(
    args['share-email'] || process.env.GOOGLE_SHARE_EMAIL,
    adminEmails
  );
  const supportEmail = String(args['support-email'] || process.env.SUPPORT_EMAIL || salonEmail).trim();
  const supportReplyTo = String(args['support-reply-to'] || process.env.SUPPORT_REPLY_TO_EMAIL || supportEmail).trim();
  const clientEmailFrom = String(args['client-email-from'] || process.env.CLIENT_EMAIL_FROM || DEFAULT_CLIENT_EMAIL_FROM).trim();
  const gmailSender = String(args['gmail-sender'] || process.env.GMAIL_SENDER || '').trim();
  const prefix = String(args.prefix || DEFAULT_RESOURCE_PREFIX).trim();
  const { clientId, clientSecret } = readOAuthClient(clientFile);
  const port = Number(args.port || 53682);
  const state = randomBytes(16).toString('hex');
  const { code, redirectUri } = await waitForOAuthCode({ clientId, port, state });
  const token = await exchangeCode({ clientId, clientSecret, code, redirectUri });
  const resources = await readExistingGoogleResources(token.access_token, args)
    || await createGoogleResources(token.access_token, shareEmails, prefix);

  const cloudflare = await updateCloudflareSecrets({
    GOOGLE_OAUTH_CLIENT_ID: clientId,
    GOOGLE_OAUTH_CLIENT_SECRET: clientSecret,
    GOOGLE_OAUTH_REFRESH_TOKEN: token.refresh_token,
    GOOGLE_CALENDAR_ID: resources.calendarId,
    SHEET_ID: resources.spreadsheetId,
    DRIVE_UPLOAD_FOLDER: resources.driveFolderId,
    GMAIL_SENDER: gmailSender,
    SALON_EMAIL: salonEmail,
    CONTACT_RECIPIENT_EMAIL: salonEmail,
    BOOKING_RECIPIENT_EMAIL: salonEmail,
    SUPPORT_EMAIL: supportEmail,
    SUPPORT_REPLY_TO_EMAIL: supportReplyTo,
    CLIENT_EMAIL_FROM: clientEmailFrom,
    ADMIN_NOTIFICATION_EMAILS: adminEmails.join(','),
    GOOGLE_SHARE_EMAIL: shareEmails.join(','),
  });

  console.log(JSON.stringify({
    clientFile: basename(clientFile),
    calendarId: resources.calendarId,
    spreadsheetId: resources.spreadsheetId,
    driveFolderId: resources.driveFolderId,
    driveFolderUrl: resources.driveFolderUrl,
    googleAccountEmail: resources.googleAccountEmail,
    shareEmails,
    adminEmails,
    gmailSenderConfigured: Boolean(gmailSender),
    shareResults: resources.shareResults,
    cloudflare,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
