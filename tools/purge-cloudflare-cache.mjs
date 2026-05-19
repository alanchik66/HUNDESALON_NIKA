/**
 * Purge all Cloudflare cache for hundesalon-nika.com.
 * Uses CLOUDFLARE_API_TOKEN when set; otherwise Wrangler OAuth from local config.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const DOMAIN = 'hundesalon-nika.com';

function wranglerConfigCandidates() {
  const home = homedir();
  return [
    process.env.WRANGLER_CONFIG,
    path.join(home, '.config', '.wrangler', 'config', 'default.toml'),
    path.join(home, 'AppData', 'Roaming', '.wrangler', 'config', 'default.toml'),
    path.join(home, 'AppData', 'Roaming', 'xdg.config', '.wrangler', 'config', 'default.toml'),
  ].filter(Boolean);
}

function loadWranglerOAuth() {
  const configPath = wranglerConfigCandidates().find(candidate => existsSync(candidate));

  if (!configPath) {
    throw new Error('Wrangler config not found. Run: npx wrangler login');
  }

  const raw = readFileSync(configPath, 'utf8');
  const oauthToken = raw.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
  const refreshToken = raw.match(/^refresh_token\s*=\s*"([^"]+)"/m)?.[1];
  const expirationTime = raw.match(/^expiration_time\s*=\s*"([^"]+)"/m)?.[1];

  if (!oauthToken || !refreshToken) {
    throw new Error('Wrangler OAuth credentials not found. Run: npx wrangler login');
  }

  return {
    access_token: oauthToken,
    refresh_token: refreshToken,
    expiration_time: expirationTime ? Date.parse(expirationTime) : 0,
  };
}

async function cloudflareApi(token, pathname, init = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(
      `Cloudflare API ${pathname} failed: ${payload.errors?.map(error => error.message).join('; ') || response.status}`
    );
  }

  return payload.result;
}

async function resolveAccessToken(stored) {
  if (stored.access_token && stored.expiration_time && Date.now() < stored.expiration_time - 60_000) {
    return stored.access_token;
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: stored.refresh_token,
    client_id: '54d11594-84e4-41aa-b438-e81b8f53c41e',
  });

  const response = await fetch('https://dash.cloudflare.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error('Failed to refresh Wrangler OAuth token. Run: npx wrangler login');
  }

  return payload.access_token;
}

async function resolveToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) {
    return process.env.CLOUDFLARE_API_TOKEN;
  }

  return resolveAccessToken(loadWranglerOAuth());
}

async function main() {
  const accessToken = await resolveToken();
  const zones = await cloudflareApi(accessToken, `/zones?name=${DOMAIN}`);
  const zone = zones.find(entry => entry.name === DOMAIN);

  if (!zone) {
    throw new Error(`Zone not found for ${DOMAIN}`);
  }

  await cloudflareApi(accessToken, `/zones/${zone.id}/purge_cache`, {
    method: 'POST',
    body: JSON.stringify({ purge_everything: true }),
  });

  console.log(`Purged Cloudflare cache for ${DOMAIN} (zone ${zone.id}).`);
}

main().catch(error => {
  console.error(error.message);
  if (/purge_cache|Authentication error/i.test(error.message) && !process.env.CLOUDFLARE_API_TOKEN) {
    console.error('');
    console.error('Create a zone API token: My Profile → API Tokens → Create Token');
    console.error('  Template: "Edit zone DNS" or custom with Zone → Cache Purge + Zone → Zone Read');
    console.error('  Zone: hundesalon-nika.com');
    console.error('Then set CLOUDFLARE_API_TOKEN in .dev.vars (local) or Cursor Cloud secrets.');
    console.error('Or purge manually: Caching → Configuration → Purge Everything');
    console.error('See docs/cloudflare-caching.md');
  }
  process.exit(1);
});
