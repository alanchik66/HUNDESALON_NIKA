/**
 * Shared Cloudflare auth: .dev.vars, scoped API token, or Wrangler OAuth (read-only).
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
  const tokenPath = path.join(REPO_ROOT, '.cloudflare-api.token');
  if (existsSync(tokenPath) && !process.env.CLOUDFLARE_API_TOKEN) {
    const fromFile = readFileSync(tokenPath, 'utf8').trim();
    if (fromFile) process.env.CLOUDFLARE_API_TOKEN = fromFile;
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

/** Headers for Cloudflare API v4 (scoped API token only). */
export function getCloudflareAuthHeaders({ allowOAuthToken = false } = {}) {
  loadDevVars();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (apiToken) {
    if (!allowOAuthToken && looksLikeWranglerOAuthToken(apiToken)) {
      throw new Error(
        'CLOUDFLARE_API_TOKEN matches Wrangler OAuth (no Cache Purge). Create a zone API token: npm run cf:open-api-token'
      );
    }
    return { Authorization: `Bearer ${apiToken}` };
  }

  return null;
}

function wranglerConfigCandidates() {
  const home = homedir();
  return [
    process.env.WRANGLER_CONFIG,
    path.join(home, '.wrangler', 'config', 'default.toml'),
    path.join(home, '.config', '.wrangler', 'config', 'default.toml'),
    path.join(home, 'AppData', 'Roaming', '.wrangler', 'config', 'default.toml'),
    path.join(home, 'AppData', 'Roaming', 'xdg.config', '.wrangler', 'config', 'default.toml'),
  ].filter(Boolean);
}

export function getWranglerConfigPath() {
  const configPath = wranglerConfigCandidates().find(candidate => existsSync(candidate));
  if (!configPath) {
    throw new Error('Wrangler config not found. Run: npx wrangler login');
  }
  return configPath;
}

function upsertTomlQuotedField(raw, key, value) {
  const pattern = new RegExp(`^${key}\\s*=\\s*"[^"]*"`, 'm');
  const line = `${key} = "${value}"`;
  if (pattern.test(raw)) return raw.replace(pattern, line);
  return `${raw.trimEnd()}\n${line}\n`;
}

/** Keep Wrangler CLI config in sync after OAuth refresh (prevents stale-token deploy failures). */
export function persistWranglerOAuth(payload) {
  const configPath = getWranglerConfigPath();
  let raw = readFileSync(configPath, 'utf8');

  raw = upsertTomlQuotedField(raw, 'oauth_token', payload.access_token);

  const expiration =
    payload.expiration_time != null
      ? new Date(payload.expiration_time).toISOString()
      : new Date(Date.now() + (Number(payload.expires_in) || 3600) * 1000).toISOString();
  raw = upsertTomlQuotedField(raw, 'expiration_time', expiration);

  if (payload.refresh_token) {
    raw = upsertTomlQuotedField(raw, 'refresh_token', payload.refresh_token);
  }

  writeFileSync(configPath, raw, 'utf8');
}

export function loadWranglerOAuth() {
  const configPath = getWranglerConfigPath();
  const raw = readFileSync(configPath, 'utf8');
  const oauthToken = raw.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
  const refreshToken = raw.match(/^refresh_token\s*=\s*"([^"]+)"/m)?.[1];
  const expirationTime = raw.match(/^expiration_time\s*=\s*"([^"]+)"/m)?.[1];

  if (!oauthToken || !refreshToken) {
    throw new Error('Wrangler OAuth credentials not found. Run: npx wrangler login');
  }

  return {
    configPath,
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
    client_id: '54d11594-84e4-41aa-b438-e81b8fa78ee7',
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

  persistWranglerOAuth({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token || stored.refresh_token,
    expires_in: payload.expires_in,
  });

  return payload.access_token;
}

export async function cloudflareApi(tokenOrHeaders, pathname, init = {}) {
  const authHeaders =
    typeof tokenOrHeaders === 'string' ? { Authorization: `Bearer ${tokenOrHeaders}` } : tokenOrHeaders;

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

/** Auth that can purge cache (scoped API token — not Wrangler OAuth). */
export function resolvePurgeAuth() {
  const headers = getCloudflareAuthHeaders();
  if (headers) return headers;
  throw new Error(
    'No purge credentials. Add CLOUDFLARE_API_TOKEN with Cache Purge to .dev.vars. Run: npm run cf:open-api-token'
  );
}

function isDevVarAssignment(row, key) {
  const separatorIndex = row.indexOf('=');
  return separatorIndex !== -1 && row.slice(0, separatorIndex).trim() === key;
}

export function removeDevVar(key, filePath = path.join(REPO_ROOT, '.dev.vars')) {
  if (existsSync(filePath)) {
    const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
    const next = lines.filter(row => !isDevVarAssignment(row, key));
    writeFileSync(filePath, `${next.join('\n').replace(/\n+$/, '')}\n`, 'utf8');
  }
  delete process.env[key];
}

export function upsertDevVar(key, value, filePath = path.join(REPO_ROOT, '.dev.vars')) {
  const line = `${key}=${value}`;
  let lines = [];
  if (existsSync(filePath)) {
    lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  }

  let found = false;
  const next = [];
  for (const row of lines) {
    if (isDevVarAssignment(row, key)) {
      if (!found) next.push(line);
      found = true;
    } else {
      next.push(row);
    }
  }

  if (!found) {
    if (next.length && next[next.length - 1] !== '') next.push('');
    next.push(line);
  }

  writeFileSync(filePath, `${next.join('\n').replace(/\n+$/, '')}\n`, 'utf8');
  process.env[key] = value;
}
