import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';

// Local-only OAuth recovery. No Cloudflare changes or Google resource creation.
const envPath = new URL('../.dev.vars', import.meta.url);
const env = parseEnv(await readFile(envPath, 'utf8'));
const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET;
const expectedEmail = (process.argv[2] || '').trim().toLowerCase();
if (!clientId || !clientSecret) throw new Error('Local Google OAuth client is missing.');
const redirectUri = 'http://127.0.0.1:53682/oauth2callback';
const state = randomBytes(32).toString('base64url');
const verifier = randomBytes(48).toString('base64url');
const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
auth.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: 'code',
  scope: ['calendar', 'drive.file', 'spreadsheets', 'userinfo.email']
    .map(scope => `https://www.googleapis.com/auth/${scope}`)
    .join(' '),
  access_type: 'offline',
  prompt: 'select_account consent',
  state,
  ...(expectedEmail ? { login_hint: expectedEmail } : {}),
  code_challenge: createHash('sha256').update(verifier).digest('base64url'),
  code_challenge_method: 'S256',
}).toString();
let exchanging = false;
let completed = false;
const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  const url = new URL(request.url, redirectUri);
  if (request.method !== 'GET') return response.writeHead(405).end('Method not allowed');
  if (completed && ['/start', '/oauth2callback'].includes(url.pathname)) {
    return response.end('Google уже подключён локально. Повторный вход не нужен. Вернитесь в Codex.');
  }
  if (url.pathname === '/start') return response.writeHead(302, { Location: auth.toString() }).end();
  if (url.pathname !== '/oauth2callback') return response.writeHead(404).end('Not found');
  if (url.searchParams.get('state') !== state) return response.writeHead(400).end('Invalid OAuth state');
  if (url.searchParams.has('error')) return response.writeHead(400).end('Доступ не предоставлен. Вернитесь в Codex.');
  if (!url.searchParams.get('code') || exchanging) return response.writeHead(400).end('Invalid callback');
  exchanging = true;
  try {
    const result = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: url.searchParams.get('code'),
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }),
      signal: AbortSignal.timeout(30000),
    });
    const token = await result.json();
    if (!result.ok || !token.refresh_token) throw new Error('Token exchange failed');
    if (expectedEmail) {
      const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token.access_token}` },
        signal: AbortSignal.timeout(15000),
      });
      const profile = await profileResponse.json();
      if (!profileResponse.ok || profile.email?.toLowerCase() !== expectedEmail || !profile.verified_email) {
        exchanging = false;
        return response
          .writeHead(400)
          .end('Выбран другой аккаунт. Настройки не изменены. Вернитесь к /start и выберите нужный аккаунт.');
      }
    }
    // Read again to preserve any unrelated settings changed during sign-in.
    let current = await readFile(envPath, 'utf8');
    const line = `GOOGLE_OAUTH_REFRESH_TOKEN=${JSON.stringify(token.refresh_token)}`;
    current = /^GOOGLE_OAUTH_REFRESH_TOKEN=.*$/m.test(current)
      ? current.replace(/^GOOGLE_OAUTH_REFRESH_TOKEN=.*$/m, () => line)
      : `${current.trimEnd()}\n${line}\n`;
    await writeFile(envPath, current, { mode: 0o600 });
    completed = true;
    console.log('Google OAuth renewed locally. No credentials printed; no cloud resources changed.');
    response.end('Google подключён локально. Вернитесь в Codex для проверки таблицы.');
    // Keep the confirmation reachable until the existing local session expires.
  } catch {
    exchanging = false;
    console.error('Google token exchange or local save failed; credentials were not logged.');
    response.writeHead(502).end('Не удалось завершить подключение. Вернитесь в Codex.');
  }
});
server.listen(53682, '127.0.0.1', () =>
  console.log('Open http://127.0.0.1:53682/start to authorize Google. Waiting up to 30 minutes.')
);
setTimeout(() => server.close(), 30 * 60 * 1000);
