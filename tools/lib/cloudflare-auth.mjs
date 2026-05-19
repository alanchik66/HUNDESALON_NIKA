/**
 * Shared Cloudflare auth: .dev.vars, CLOUDFLARE_API_TOKEN, or Wrangler OAuth refresh.
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

export async function cloudflareApi(token, pathname, init = {}) {
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

export async function resolveManagementToken() {
  loadDevVars();
  if (process.env.CLOUDFLARE_API_TOKEN) {
    return process.env.CLOUDFLARE_API_TOKEN;
  }
  return refreshWranglerOAuth(loadWranglerOAuth());
}

export async function resolveZoneId(token) {
  const zones = await cloudflareApi(token, `/zones?name=${DOMAIN}`);
  const zone = zones.find(entry => entry.name === DOMAIN);
  if (!zone) throw new Error(`Zone not found for ${DOMAIN}`);
  return zone.id;
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
