import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';

const PROJECT_ID = 'hundesalon-nika-shell-2026';
const CREATE_URL = `https://console.cloud.google.com/auth/clients/create?project=${PROJECT_ID}`;
const CLIENTS_URL = `https://console.cloud.google.com/auth/clients?project=${PROJECT_ID}`;
const DOWNLOADS = join(homedir(), 'Downloads');
const SECRETS_DIR = join(process.cwd(), '.secrets');
const OAUTH_PORT = 53682;
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
];

function latestOAuthClientJson() {
  const roots = [DOWNLOADS, SECRETS_DIR];
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
  return candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.fullPath || '';
}

function readOAuthClient(filePath) {
  const raw = JSON.parse(readFileSync(filePath, 'utf8'));
  const client = raw.installed || raw.web || raw;
  if (!client.client_id || !client.client_secret) {
    throw new Error(`Invalid OAuth client JSON: ${filePath}`);
  }
  return { clientId: client.client_id, clientSecret: client.client_secret, filePath };
}

function saveClientCopy(sourcePath) {
  if (!existsSync(SECRETS_DIR)) mkdirSync(SECRETS_DIR, { recursive: true });
  const target = join(SECRETS_DIR, 'google-oauth-desktop-client.json');
  writeFileSync(target, readFileSync(sourcePath, 'utf8'), 'utf8');
  return target;
}

async function clickByText(page, pattern, timeoutMs = 15000) {
  const re = new RegExp(pattern, 'i');
  const locator = page.locator('button, a, [role="button"], mat-radio-button, label, cfc-message-actions button').filter({
    hasText: re,
  });
  await locator.first().waitFor({ state: 'visible', timeout: timeoutMs });
  await locator.first().click();
}

async function ensureDesktopClient(page) {
  const existing = latestOAuthClientJson();
  if (existing) return readOAuthClient(existing);

  await page.goto(CLIENTS_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(5000);

  const bodyText = await page.locator('body').innerText();
  if (/sign in|anmelden|войти/i.test(bodyText) && !/Desktop/i.test(bodyText)) {
    console.log('Google sign-in required in Playwright window. Waiting up to 3 minutes...');
    await page.waitForFunction(
      () => /Desktop|Desktop-App|Desktop app|Clients|Client/i.test(document.body?.innerText || ''),
      { timeout: 180000 }
    );
  }

  if (/Desktop|Desktop-App|Desktop app/i.test(await page.locator('body').innerText())) {
    console.log('Desktop OAuth client appears to exist. Open client details and download JSON if prompted.');
    await page.goto(CLIENTS_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(4000);
  } else {
    await page.goto(CREATE_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(4000);
    try {
      await clickByText(page, 'Desktop|Desktop-App|Desktop app|Desktopanwendung', 20000);
      await page.waitForTimeout(1500);
      await clickByText(page, 'Create|Erstellen|Создать|Create client|Client erstellen', 20000);
      await page.waitForTimeout(3000);
      try {
        await clickByText(page, 'Download JSON|JSON herunterladen|Скачать JSON', 10000);
      } catch {
        // download may appear on next screen
      }
    } catch (error) {
      console.log(`Automated client creation needs manual assist: ${error.message}`);
    }
  }

  console.log('Waiting up to 3 minutes for client_secret*.json in Downloads/.secrets ...');
  const started = Date.now();
  while (Date.now() - started < 180000) {
    const filePath = latestOAuthClientJson();
    if (filePath) return readOAuthClient(filePath);
    await page.waitForTimeout(2000);
  }

  throw new Error('OAuth Desktop client JSON was not downloaded in time.');
}

async function waitForOAuthCode({ clientId, state }) {
  const redirectUri = `http://127.0.0.1:${OAUTH_PORT}/oauth2callback`;
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
          response.writeHead(400).end(`OAuth error: ${error}`);
          rejectPromise(new Error(`OAuth error: ${error}`));
          server.close();
          return;
        }
        if (!code || returnedState !== state) {
          response.writeHead(400).end('Invalid OAuth callback');
          rejectPromise(new Error('Invalid OAuth callback'));
          server.close();
          return;
        }
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end('<h1>Google connected</h1>');
        resolvePromise({ code, redirectUri });
        server.close();
      } catch (error) {
        rejectPromise(error);
        server.close();
      }
    });
    server.listen(OAUTH_PORT, '127.0.0.1', () => resolvePromise.authUrl = authUrl.toString());
  }).then(async (result) => {
    if (result.authUrl) return { authUrl: result.authUrl, wait: result };
    return result;
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
  if (!response.ok || !body.refresh_token) {
    throw new Error(`Token exchange failed: ${JSON.stringify(body)}`);
  }
  return body;
}

async function main() {
  const userDataDir = join(homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chrome',
    headless: false,
    args: ['--profile-directory=Default', '--no-first-run', '--no-default-browser-check'],
    acceptDownloads: true,
  });

  try {
    const page = context.pages()[0] || await context.newPage();
    const { clientId, clientSecret, filePath } = await ensureDesktopClient(page);
    const savedClient = saveClientCopy(filePath);

    const state = randomBytes(16).toString('hex');
    const redirectUri = `http://127.0.0.1:${OAUTH_PORT}/oauth2callback`;
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', GOOGLE_SCOPES.join(' '));
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', state);

    const codePromise = new Promise((resolve, reject) => {
      const server = createServer((req, res) => {
        try {
          const url = new URL(req.url || '/', redirectUri);
          if (url.pathname !== '/oauth2callback') {
            res.writeHead(404).end();
            return;
          }
          const code = url.searchParams.get('code');
          const error = url.searchParams.get('error');
          if (error) {
            res.writeHead(400).end(error);
            reject(new Error(error));
            server.close();
            return;
          }
          if (!code || url.searchParams.get('state') !== state) {
            res.writeHead(400).end('invalid');
            reject(new Error('Invalid callback'));
            server.close();
            return;
          }
          res.writeHead(200).end('OK');
          resolve({ code, redirectUri });
          server.close();
        } catch (error) {
          reject(error);
          server.close();
        }
      }).listen(OAUTH_PORT, '127.0.0.1');
    });

    await page.goto(authUrl.toString(), { waitUntil: 'domcontentloaded', timeout: 120000 });
    console.log('Complete OAuth consent in the Playwright Chrome window if prompted...');
    const { code, redirectUri: uri } = await Promise.race([
      codePromise,
      page.waitForTimeout(180000).then(() => {
        throw new Error('OAuth consent timed out after 3 minutes');
      }),
    ]);

    const token = await exchangeCode({ clientId, clientSecret, code, redirectUri: uri });
    if (!existsSync(SECRETS_DIR)) mkdirSync(SECRETS_DIR, { recursive: true });
    const tokenPath = join(SECRETS_DIR, 'google-oauth-token.json');
    writeFileSync(tokenPath, JSON.stringify({
      client_id: clientId,
      refresh_token: token.refresh_token,
      scope: token.scope,
      token_type: token.token_type,
      updated_at: new Date().toISOString(),
    }, null, 2), 'utf8');

    console.log(JSON.stringify({
      ok: true,
      clientFile: basename(savedClient),
      tokenFile: basename(tokenPath),
      next: `npm run google:setup-platform -- --client-file "${savedClient}"`,
    }, null, 2));
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
