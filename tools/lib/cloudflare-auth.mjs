/**
 * Shared Cloudflare auth: .dev.vars, API Bearer token, Global API Key, or Wrangler OAuth (read-only).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DOMAIN = 'hundesalon-nika.com';
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '25e872aeab8cb246c69142ab07cd0fee';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export { DOMAIN, ACCOUNT_ID, REPO_ROOT };

export function loadDevVars(filePath = path.join(REPO_ROOT, '.dev.vars')) {
  for (const file of ['.cloudflare-api.token', '.cloudflare-purge.token', '.cloudflare-rules.token']) {
    const tokenPath = path.join(REPO_ROOT, file);
    if (existsSync(tokenPath) && !process.env.CLOUDFLARE_API_TOKEN) {
      const fromFile = readFileSync(tokenPath, 'utf8').trim();
      if (fromFile) process.env.CLOUDFLARE_API_TOKEN = fromFile;
    }
  }

  const globalFile = path.join(REPO_ROOT, '.cloudflare-global.json');
  if (existsSync(globalFile) && !process.env.CLOUDFLARE_API_KEY) {
    try {
      const data = JSON.parse(readFileSync(globalFile, 'utf8'));
      const email = String(data.email || data.CLOUDFLARE_API_EMAIL || '').trim();
      const key = String(data.api_key || data.CLOUDFLARE_API_KEY || '').trim();
      if (email && key) {
        process.env.CLOUDFLARE_API_EMAIL = email;
        process.env.CLOUDFLARE_API_KEY = key;
      }
    } catch {
      // ignore
    }
  }

  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.replace(/^\uFEFF/, '').trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  // Cloudflare Origin CA replacement token is accepted as an API Bearer token source.
  if (!process.env.CLOUDFLARE_API_TOKEN?.trim() && process.env.CLOUDFLARE_ORIGIN_CA_REPLACEMENT_TOKEN?.trim()) {
    process.env.CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_ORIGIN_CA_REPLACEMENT_TOKEN.trim();
  }
}

function looksLikeWranglerOAuthToken(apiToken) {
  try {
    const stored = loadWranglerOAuth();
    if (stored.access_token && apiToken === stored.access_token) return true;
  } catch {
    // no wrangler config
  }
  return false;
}

/** Headers for Cloudflare API v4 (token or Global API Key). */
export function getCloudflareAuthHeaders({ allowOAuthToken = false } = {}) {
  loadDevVars();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (apiToken) {
    if (!allowOAuthToken && looksLikeWranglerOAuthToken(apiToken)) {
      throw new Error(
        'CLOUDFLARE_API_TOKEN matches Wrangler OAuth (no Cache Purge). Create a zone API token: npm run cf:open-purge-token'
      );
    }
    return { Authorization: `Bearer ${apiToken}` };
  }

  const email = process.env.CLOUDFLARE_API_EMAIL?.trim();
  const globalKey = process.env.CLOUDFLARE_API_KEY?.trim();
  if (email && globalKey) {
    return {
      'X-Auth-Email': email,
      'X-Auth-Key': globalKey,
    };
  }

  return null;
}

function wranglerConfigCandidates() {
  const home = homedir();
  return [
    process.env.WRANGLER_CONFIG,
    path.join(home, '.config', '.wrangler', 'config', 'default.toml'),
    path.join(home, 'AppData', 'Roaming', '.wrangler', 'config', 'default.toml'),
    path.join(home, 'AppData', 'Roaming', 'xdg.config', '.wrangler', 'config', 'default.toml'),
  ].filter(Boolean);
}

export function loadWranglerOAuth() {
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

export async function refreshWranglerOAuth(stored) {
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

export async function cloudflareApi(tokenOrHeaders, pathname, init = {}) {
  const authHeaders =
    typeof tokenOrHeaders === 'string'
      ? { Authorization: `Bearer ${tokenOrHeaders}` }
      : tokenOrHeaders;

  const response = await fetch(`https://api.cloudflare.com/client/v4${pathname}`, {
    ...init,
    headers: {
      ...authHeaders,
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

export async function resolveZoneId(auth) {
  const headers = typeof auth === 'string' ? { Authorization: `Bearer ${auth}` } : auth;
  const zones = await cloudflareApi(headers, `/zones?name=${DOMAIN}`);
  const zone = zones.find(entry => entry.name === DOMAIN);
  if (!zone) throw new Error(`Zone not found for ${DOMAIN}`);
  return zone.id;
}

/** Auth that can purge cache (API token or Global API Key — not Wrangler OAuth). */
export function resolvePurgeAuth() {
  const headers = getCloudflareAuthHeaders();
  if (headers) return headers;
  throw new Error(
    'No purge credentials. Add CLOUDFLARE_API_TOKEN (zone: Cache Purge) or CLOUDFLARE_API_EMAIL + CLOUDFLARE_API_KEY to .dev.vars. Run: npm run cf:open-purge-token'
  );
}

export function removeDevVar(key, filePath = path.join(REPO_ROOT, '.dev.vars')) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  const next = lines.filter(row => !row.replace(/^\uFEFF/, '').trim().startsWith(`${key}=`));
  writeFileSync(filePath, `${next.join('\n').replace(/\n+$/, '')}\n`, 'utf8');
  delete process.env[key];
}

export function upsertDevVar(key, value, filePath = path.join(REPO_ROOT, '.dev.vars')) {
  const line = `${key}=${value}`;
  let lines = [];
  if (existsSync(filePath)) {
    lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  }

  let found = false;
  const next = lines.map(row => {
    const trimmed = row.replace(/^\uFEFF/, '').trim();
    if (trimmed.startsWith(`${key}=`)) {
      found = true;
      return line;
    }
    return row;
  });

  if (!found) {
    if (next.length && next[next.length - 1] !== '') next.push('');
    next.push(line);
  }

  writeFileSync(filePath, `${next.join('\n').replace(/\n+$/, '')}\n`, 'utf8');
  process.env[key] = value;
}
