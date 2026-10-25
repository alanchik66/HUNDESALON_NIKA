import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
import { loadWranglerOAuth, refreshWranglerOAuth } from './lib/cloudflare-auth.mjs';
import { getGoogleOAuthAccessToken } from '../functions/_lib/platform-integrations.js';
const config = parseEnv(readFileSync('.dev.vars', 'utf8'));
if (!process.argv.includes('--apply')) throw new Error('Explicit --apply required');
const token = await getGoogleOAuthAccessToken(config);
const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
  headers: { Authorization: `Bearer ${token}` },
});
const profile = await profileResponse.json();
if (profile.email !== 'ryndenko1982@gmail.com' || !profile.verified_email) throw new Error('Wrong Google account');
await refreshWranglerOAuth(loadWranglerOAuth());
const env = { ...process.env };
delete env.CLOUDFLARE_API_TOKEN;
const keys = process.argv.includes('--refresh-token-only')
  ? ['GOOGLE_OAUTH_REFRESH_TOKEN']
  : ['SHEET_ID', 'GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REFRESH_TOKEN'];
for (const key of keys) {
  if (!config[key]) throw new Error(`Missing ${key}`);
  const result = spawnSync(
    process.execPath,
    ['node_modules/wrangler/bin/wrangler.js', 'pages', 'secret', 'put', key, '--project-name', 'hundesalon-nika'],
    { input: config[key], encoding: 'utf8', env }
  );
  if (result.status !== 0) throw new Error(`Secret update failed: ${key}; values and CLI output withheld`);
  console.log(`Updated ${key}`);
}
