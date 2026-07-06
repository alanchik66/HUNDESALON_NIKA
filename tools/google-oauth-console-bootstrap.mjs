import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { spawn } from 'node:child_process';
import { openCdpSession, sleep } from './lib/browser-cdp.mjs';

const PROJECT_ID = 'hundesalon-nika-shell-2026';
const CLIENTS_URL = `https://console.cloud.google.com/auth/clients?project=${PROJECT_ID}`;
const CREATE_URL = `https://console.cloud.google.com/auth/clients/create?project=${PROJECT_ID}`;
const CDP_PORT = Number(process.env.GOOGLE_OAUTH_CDP_PORT || process.env.CF_USER_CHROME_PORT || 9222);
const DOWNLOADS = join(homedir(), 'Downloads');
const SECRETS_DIR = join(process.cwd(), '.secrets');

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
    if (!next || next.startsWith('--')) args[key] = true;
    else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function latestOAuthClientJson() {
  const roots = [DOWNLOADS, SECRETS_DIR];
  const candidates = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.json$/i.test(entry.name)) continue;
      if (!/client_secret|oauth|credentials/i.test(entry.name)) continue;
      const fullPath = join(root, entry.name);
      candidates.push({ fullPath, mtimeMs: statSync(fullPath).mtimeMs });
    }
  }
  return candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.fullPath || '';
}

function readOAuthClient(filePath) {
  const raw = JSON.parse(readFileSync(filePath, 'utf8'));
  const client = raw.installed || raw.web || raw;
  if (!client.client_id || !client.client_secret) {
    throw new Error(`OAuth client JSON is invalid: ${filePath}`);
  }
  return { clientId: client.client_id, clientSecret: client.client_secret, filePath };
}

function saveOAuthClientCopy(sourcePath) {
  if (!existsSync(SECRETS_DIR)) mkdirSync(SECRETS_DIR, { recursive: true });
  const targetPath = join(SECRETS_DIR, 'google-oauth-desktop-client.json');
  writeFileSync(targetPath, readFileSync(sourcePath, 'utf8'), 'utf8');
  return targetPath;
}

function openBrowser(url) {
  spawn('powershell.exe', ['-NoProfile', '-Command', 'Start-Process', url], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref();
}

async function navigateCdp(url) {
  const session = await openCdpSession({ port: CDP_PORT, targetPattern: /./, fallbackAny: true });
  try {
    await session.send('Page.navigate', { url });
    await sleep(4000);
    return session.evalPage(`
      return {
        url: location.href,
        title: document.title,
        text: (document.body?.innerText || '').slice(0, 12000),
      };
    `);
  } finally {
    session.close();
  }
}

async function waitForOAuthClientJson(timeoutMs = 180000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const filePath = latestOAuthClientJson();
    if (filePath) return filePath;
    await sleep(2000);
  }
  return '';
}

function parseOAuthCallbackUrl(callbackUrl) {
  const url = new URL(callbackUrl);
  if (!url.pathname.endsWith('/oauth2callback')) {
    throw new Error('Callback URL must point to /oauth2callback');
  }
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  if (error) throw new Error(`OAuth error: ${error}`);
  if (!code) throw new Error('Callback URL is missing the OAuth code parameter');
  const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
  const redirectUri = `${url.protocol}//${url.hostname}${port && port !== 80 && port !== 443 ? `:${port}` : ''}/oauth2callback`;
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
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(
          '<!doctype html><meta charset="utf-8"><title>HUNDESALON NIKA</title><body><h1>Google connected</h1><p>Authorization received. You can close this tab.</p></body>'
        );
        resolvePromise({ code, redirectUri });
        server.close();
      } catch (error) {
        rejectPromise(error);
        server.close();
      }
    });
    server.listen(port, '127.0.0.1', () => {
      console.log(`OAuth consent URL:\n${authUrl.toString()}\n`);
      console.log(`Waiting for callback on http://127.0.0.1:${port}/oauth2callback ...`);
      openBrowser(authUrl.toString());
    });
  });
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
    throw new Error(`OAuth token exchange failed: ${JSON.stringify({ status: response.status, error: body.error, description: body.error_description })}`);
  }
  return body;
}

async function resolveClientCredentials(args) {
  if (args['client-id'] && args['client-secret']) {
    return {
      clientId: String(args['client-id']).trim(),
      clientSecret: String(args['client-secret']).trim(),
      filePath: '',
    };
  }

  const existing = latestOAuthClientJson();
  if (existing) return readOAuthClient(existing);

  console.log('OAuth Desktop client JSON not found locally.');
  console.log(`Opening Google Auth Platform for project ${PROJECT_ID} ...`);
  openBrowser(CREATE_URL);

  let pageInfo = null;
  try {
    pageInfo = await navigateCdp(CLIENTS_URL);
    console.log(`Chrome CDP page: ${pageInfo?.title || 'unknown'}`);
  } catch (error) {
    console.log(`Chrome CDP unavailable (${error.message}). Continue in the opened browser window.`);
  }

  if (pageInfo?.text && /Desktop|Desktop-App|Desktop app/i.test(pageInfo.text)) {
    console.log('Existing OAuth clients detected in Google Cloud Console.');
    console.log('If a Desktop client already exists, open it and download the JSON to Downloads.');
  } else {
    console.log('Create client: Application type = Desktop app, then download JSON to Downloads.');
  }

  console.log('Waiting up to 3 minutes for client_secret*.json in Downloads or .secrets/ ...');
  const downloaded = await waitForOAuthClientJson(180000);
  if (!downloaded) {
    throw new Error('OAuth client JSON was not downloaded in time. Save Desktop app JSON to Downloads and rerun.');
  }
  return readOAuthClient(downloaded);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { clientId, clientSecret, filePath } = await resolveClientCredentials(args);
  const savedPath = filePath ? saveOAuthClientCopy(filePath) : '';

  const port = Number(args.port || 53682);
  const state = randomBytes(16).toString('hex');
  const callbackUrl = String(args['callback-url'] || '').trim();
  const { code, redirectUri } = callbackUrl
    ? parseOAuthCallbackUrl(callbackUrl)
    : await waitForOAuthCode({ clientId, port, state });

  const token = await exchangeCode({ clientId, clientSecret, code, redirectUri });

  if (!existsSync(SECRETS_DIR)) mkdirSync(SECRETS_DIR, { recursive: true });
  const tokenPath = join(SECRETS_DIR, 'google-oauth-token.json');
  writeFileSync(tokenPath, JSON.stringify({
    client_id: clientId,
    refresh_token: token.refresh_token,
    scope: token.scope,
    token_type: token.token_type,
    created_at: new Date().toISOString(),
  }, null, 2), 'utf8');

  console.log(JSON.stringify({
    ok: true,
    clientFile: filePath ? basename(filePath) : 'cli-args',
    savedClientFile: savedPath ? basename(savedPath) : '',
    tokenFile: basename(tokenPath),
    refreshTokenReceived: Boolean(token.refresh_token),
    next: `npm run google:setup-platform -- --client-file "${savedPath || filePath}" --callback-url "PASTE_CALLBACK_URL_IF_NEEDED"`,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
