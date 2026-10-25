import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const clientPath = path.join(root, '.secrets', 'google-oauth-desktop-client.json');
const tokenPath = path.join(root, '.secrets', 'google-oauth-token.json');
const devVarsPath = path.join(root, '.dev.vars');
const wranglerPath = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

const clientDocument = JSON.parse(await readFile(clientPath, 'utf8'));
const token = JSON.parse(await readFile(tokenPath, 'utf8'));
const client = clientDocument.installed ?? clientDocument.web;
const clientId = client?.client_id;
const clientSecret = client?.client_secret;
const refreshToken = token?.refresh_token;

if (
  !/^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId ?? '') ||
  !/^GOCSPX-[A-Za-z0-9_-]{20,}$/.test(clientSecret ?? '') ||
  typeof refreshToken !== 'string' ||
  refreshToken.length < 20
) {
  throw new Error('Google OAuth credentials failed format validation.');
}

const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }),
});
const tokenBody = await tokenResponse.json().catch(() => ({}));
if (!tokenResponse.ok || typeof tokenBody.access_token !== 'string') {
  throw new Error(`Google refresh-token validation failed (HTTP ${tokenResponse.status}).`);
}

function upsert(source, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  return pattern.test(source) ? source.replace(pattern, line) : `${source.replace(/\s*$/, '')}\n${line}\n`;
}

const secrets = {
  GOOGLE_OAUTH_CLIENT_ID: clientId,
  GOOGLE_OAUTH_CLIENT_SECRET: clientSecret,
  GOOGLE_OAUTH_REFRESH_TOKEN: refreshToken,
};

let devVars = await readFile(devVarsPath, 'utf8').catch(() => '');
for (const [name, value] of Object.entries(secrets)) {
  devVars = upsert(devVars, name, value);
}
await writeFile(devVarsPath, devVars, { encoding: 'utf8', mode: 0o600 });

for (const [name, value] of Object.entries(secrets)) {
  const wrangler = spawnSync(
    process.execPath,
    [wranglerPath, 'pages', 'secret', 'put', name, '--project-name', 'hundesalon-nika'],
    { cwd: root, input: `${value}\n`, encoding: 'utf8' }
  );
  if (wrangler.status !== 0) {
    throw new Error(`Cloudflare rejected ${name}: ${wrangler.stderr || wrangler.stdout}`);
  }
}

console.log('Google OAuth refresh token validated; local and Cloudflare secrets updated.');
