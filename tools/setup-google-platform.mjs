import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const PROJECT_NAME = 'hundesalon-nika';
const ACCOUNT_ID = '25e872aeab8cb246c69142ab07cd0fee';
const DEFAULT_SALON_EMAIL = 'info@hundesalon-nika.com';
const DEFAULT_SUPPORT_EMAIL = 'support@hundesalon-nika.com';
const DEFAULT_ADMIN_EMAILS = [];
const DEFAULT_CLIENT_EMAIL_FROM = 'Hundesalon Nika <support@hundesalon-nika.com>';
const DEFAULT_RESOURCE_PREFIX = 'HUNDESALON NIKA';
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
];
const CLIENT_REGISTRY_HEADERS = [
  'created_at',
  'request_id',
  'lang',
  'form_type',
  'service',
  'service_price',
  'service_category',
  'promotion_key',
  'promotion',
  'promotion_price',
  'client_name',
  'email',
  'phone',
  'pet_name',
  'pet_species',
  'pet_breed',
  'pet_age',
  'pet_sex',
  'pet_tag_number',
  'message',
  'privacy_consent',
  'agb_consent',
  'source',
  'origin',
  'page_path',
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
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
  const emails = items.length > 0 ? items : fallback;
  const seen = new Set();
  return emails.filter(email => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || seen.has(email)) return false;
    seen.add(email);
    return true;
  });
}

const SECRETS_DIR = join(process.cwd(), '.secrets');
const ADC_PATH = join(homedir(), 'AppData', 'Roaming', 'gcloud', 'application_default_credentials.json');
const DEFAULT_CALENDAR_ID =
  'ddf6fc992a66cc1808cdb0b6d99594cb20b548e692b1b6778614e3fdb26b5589@group.calendar.google.com';

function latestOAuthClientJson() {
  const roots = [join(homedir(), 'Downloads'), SECRETS_DIR];
  const candidates = [];

  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.json$/i.test(entry.name)) continue;
      if (!/client_secret|oauth|credentials|desktop/i.test(entry.name)) continue;
      const fullPath = join(root, entry.name);
      candidates.push({ fullPath, mtimeMs: statSync(fullPath).mtimeMs });
    }
  }

  return candidates.sort((a, b) => b.mtimeMs - a.mtimeMs).map(item => item.fullPath)[0] || '';
}

function readDevVarsValue(key) {
  const devVarsPath = join(process.cwd(), '.dev.vars');
  if (!existsSync(devVarsPath)) return '';
  const line = readFileSync(devVarsPath, 'utf8')
    .split(/\r?\n/)
    .find(entry => entry.startsWith(`${key}=`));
  if (!line) return '';
  const value = line.slice(key.length + 1).trim();
  return value && !/^YOUR_|^ВАШ_/i.test(value) ? value : '';
}

function resolveOAuthClient(args = {}) {
  const cliClientId = String(
    args['client-id'] || process.env.GOOGLE_OAUTH_CLIENT_ID || readDevVarsValue('GOOGLE_OAUTH_CLIENT_ID') || ''
  ).trim();
  const cliClientSecret = String(
    args['client-secret'] ||
      process.env.GOOGLE_OAUTH_CLIENT_SECRET ||
      readDevVarsValue('GOOGLE_OAUTH_CLIENT_SECRET') ||
      ''
  ).trim();
  if (cliClientId && cliClientSecret) {
    return { clientId: cliClientId, clientSecret: cliClientSecret, clientFile: '' };
  }

  const clientFile = args['client-file'] ? resolve(String(args['client-file'])) : latestOAuthClientJson();
  if (clientFile && existsSync(clientFile)) {
    const client = readOAuthClient(clientFile);
    return { ...client, clientFile };
  }

  if (args['allow-gcloud-adc'] && existsSync(ADC_PATH)) {
    const adc = JSON.parse(readFileSync(ADC_PATH, 'utf8'));
    if (adc.client_id && adc.client_secret) {
      console.warn(
        'Using gcloud ADC client. Calendar/Sheets scopes may be blocked by Google; prefer a Desktop OAuth client from Google Auth Platform.'
      );
      return {
        clientId: adc.client_id,
        clientSecret: adc.client_secret,
        clientFile: ADC_PATH,
      };
    }
  }

  throw new Error(
    [
      'OAuth Desktop client credentials were not found.',
      'Google Auth Platform -> Clients -> Create client -> Desktop app -> Download JSON.',
      'Then rerun with one of:',
      '  --client-file <desktop-app.json>',
      '  --wait-for-client-json (auto-waits for Downloads/.secrets/)',
      '  --client-id + --client-secret',
      '  GOOGLE_OAUTH_CLIENT_ID + GOOGLE_OAUTH_CLIENT_SECRET in env/.dev.vars',
    ].join('\n')
  );
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

function parseOAuthCallbackUrl(callbackUrl) {
  const url = new URL(callbackUrl);
  if (!url.pathname.endsWith('/oauth2callback')) {
    throw new Error('Callback URL must point to /oauth2callback');
  }

  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (error) {
    throw new Error(`OAuth error: ${error}`);
  }
  if (!code) {
    throw new Error('Callback URL is missing the OAuth code parameter');
  }

  const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
  const needsPort = port && port !== 80 && port !== 443;
  const redirectUri = `${url.protocol}//${url.hostname}${needsPort ? `:${port}` : ''}/oauth2callback`;
  return { code, redirectUri };
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

        response
          .writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          .end(
            '<!doctype html><meta charset="utf-8"><title>HUNDESALON NIKA</title><body><h1>Google connected</h1><p>Authorization received. You can close this tab and return to the terminal.</p></body>'
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
        { properties: { title: 'clients' } },
      ],
    }),
  });

  await googleFetch(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet.spreadsheetId}/values/bookings!A1:U1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({
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
            'client_registration_id',
            'pet_name',
            'pet_species',
            'pet_breed',
            'pet_age',
            'pet_sex',
            'pet_tag_number',
            'service_price',
            'service_category',
          ],
        ],
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

  await googleFetch(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheet.spreadsheetId}/values/clients!A1:Y1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({
        values: [CLIENT_REGISTRY_HEADERS],
      }),
    }
  );

  const folder = await googleFetch(
    accessToken,
    'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',
    {
      method: 'POST',
      body: JSON.stringify({
        name: `${prefix} Uploads`,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    }
  );

  const shareResults = [];
  for (const shareEmail of shareEmails) {
    if (shareEmail) {
      for (const item of [
        { type: 'drive', id: folder.id, label: 'drive folder' },
        { type: 'drive', id: spreadsheet.spreadsheetId, label: 'spreadsheet' },
      ]) {
        try {
          await googleFetch(
            accessToken,
            `https://www.googleapis.com/drive/v3/files/${item.id}/permissions?sendNotificationEmail=true`,
            {
              method: 'POST',
              body: JSON.stringify({ role: 'writer', type: 'user', emailAddress: shareEmail }),
            }
          );
          shareResults.push(`${item.label}: shared with ${shareEmail}`);
        } catch (error) {
          shareResults.push(`${item.label}: share failed for ${shareEmail}`);
        }
      }

      try {
        await googleFetch(
          accessToken,
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/acl`,
          {
            method: 'POST',
            body: JSON.stringify({ role: 'writer', scope: { type: 'user', value: shareEmail } }),
          }
        );
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

async function ensureClientRegistrySheet(accessToken, spreadsheetId) {
  const metadata = await googleFetch(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties`
  );
  const hasClientsSheet = (metadata.sheets || []).some(
    sheet => sheet.properties?.title === 'clients'
  );

  if (!hasClientsSheet) {
    await googleFetch(
      accessToken,
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
      {
        method: 'POST',
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'clients' } } }] }),
      }
    );
  }

  await googleFetch(
    accessToken,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/clients!A1:Y1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      body: JSON.stringify({ values: [CLIENT_REGISTRY_HEADERS] }),
    }
  );
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
    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    child.on('error', rejectPromise);
    child.on('close', code => {
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

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT_NAME}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );
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

async function waitForOAuthClientJson(timeoutMs = 180000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const filePath = latestOAuthClientJson();
    if (filePath) return filePath;
    await new Promise(resolvePromise => setTimeout(resolvePromise, 2000));
  }
  return '';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args['open-client-create']) {
    openBrowser(`https://console.cloud.google.com/auth/clients/create?project=hundesalon-nika-shell-2026`);
    console.log('Opened Google Auth Platform client creation page.');
    if (!args['callback-url']) return;
  }

  let oauthClient;
  try {
    oauthClient = resolveOAuthClient(args);
  } catch (error) {
    if (!args['wait-for-client-json']) throw error;
    openBrowser(`https://console.cloud.google.com/auth/clients/create?project=hundesalon-nika-shell-2026`);
    console.log('Create a Desktop OAuth client and download JSON to Downloads/. Waiting up to 3 minutes...');
    const downloaded = await waitForOAuthClientJson();
    if (!downloaded) throw error;
    oauthClient = { ...readOAuthClient(downloaded), clientFile: downloaded };
  }

  const { clientId, clientSecret, clientFile } = oauthClient;

  const salonEmail = String(args['salon-email'] || process.env.SALON_EMAIL || DEFAULT_SALON_EMAIL).trim();
  const adminEmails = parseEmailList(
    args['admin-emails'] || process.env.ADMIN_NOTIFICATION_EMAILS,
    DEFAULT_ADMIN_EMAILS
  );
  const shareEmails = parseEmailList(args['share-email'] || process.env.GOOGLE_SHARE_EMAIL, adminEmails);
  const supportEmail = String(
    args['support-email'] || process.env.SUPPORT_EMAIL || DEFAULT_SUPPORT_EMAIL
  ).trim();
  const supportReplyTo = String(
    args['support-reply-to'] || process.env.SUPPORT_REPLY_TO_EMAIL || supportEmail
  ).trim();
  const clientEmailFrom = String(
    args['client-email-from'] || process.env.CLIENT_EMAIL_FROM || DEFAULT_CLIENT_EMAIL_FROM
  ).trim();
  const gmailSender = String(args['gmail-sender'] || process.env.GMAIL_SENDER || '').trim();
  const prefix = String(args.prefix || DEFAULT_RESOURCE_PREFIX).trim();
  const port = Number(args.port || 53682);
  const state = randomBytes(16).toString('hex');
  const callbackUrl = String(args['callback-url'] || '').trim();
  const { code, redirectUri } = callbackUrl
    ? parseOAuthCallbackUrl(callbackUrl)
    : await waitForOAuthCode({ clientId, port, state });
  const token = await exchangeCode({ clientId, clientSecret, code, redirectUri });
  const resources =
    (await readExistingGoogleResources(token.access_token, {
      ...args,
      'calendar-id':
        args['calendar-id'] ||
        process.env.GOOGLE_CALENDAR_ID ||
        readDevVarsValue('GOOGLE_CALENDAR_ID') ||
        DEFAULT_CALENDAR_ID,
      'sheet-id': args['sheet-id'] || process.env.SHEET_ID || readDevVarsValue('SHEET_ID'),
      'drive-folder-id':
        args['drive-folder-id'] || process.env.DRIVE_UPLOAD_FOLDER || readDevVarsValue('DRIVE_UPLOAD_FOLDER'),
      })) || (await createGoogleResources(token.access_token, shareEmails, prefix));

  await ensureClientRegistrySheet(token.access_token, resources.spreadsheetId);

  if (!existsSync(SECRETS_DIR)) {
    mkdirSync(SECRETS_DIR, { recursive: true });
  }
  writeFileSync(
    join(SECRETS_DIR, 'google-oauth-token.json'),
    JSON.stringify(
      {
        client_id: clientId,
        refresh_token: token.refresh_token,
        scope: token.scope,
        token_type: token.token_type,
        updated_at: new Date().toISOString(),
      },
      null,
      2
    ),
    'utf8'
  );

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

  console.log('Google platform setup completed.');
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
