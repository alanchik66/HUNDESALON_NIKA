/**
 * Unified Cloudflare zone API token for HUNDESALON NIKA (purge + rules).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  cloudflareApi,
  getCloudflareAuthHeaders,
  loadDevVars,
  resolveZoneId,
  upsertDevVar,
} from './cloudflare-auth.mjs';

export const TOKEN_NAME = 'HUNDESALON — Zone API';
/** Existing purge token in Dashboard (NIKA-Purge-Cache). */
export const EXISTING_PURGE_TOKEN_ID = 'bc69976db0ebad603102ba39837d609e';
export const GROUP_IDS = {
  zoneRead: 'c8fed203ed3043cba015a93ad1616f1f',
  cachePurge: 'e22dca3480a4436b9c8a7100414e84b5',
  pageRules: 'ed07f73c33134c868f263e309f1c4e4a',
  zoneRules: 'dfe707eb8a1c476cb7f423c5a16b2b6c',
};

const PHASE = 'http_request_dynamic_redirect';
const TOKEN_FILE = path.join(REPO_ROOT, '.cloudflare-api.token');
const GLOBAL_FILE = path.join(REPO_ROOT, '.cloudflare-global.json');
const LEGACY_PURGE_FILE = path.join(REPO_ROOT, '.cloudflare-purge.token');
const LEGACY_RULES_FILE = path.join(REPO_ROOT, '.cloudflare-rules.token');

export function loadGlobalKeyFile() {
  if (!existsSync(GLOBAL_FILE)) return null;
  try {
    const data = JSON.parse(readFileSync(GLOBAL_FILE, 'utf8'));
    const email = String(data.email || data.CLOUDFLARE_API_EMAIL || '').trim();
    const key = String(data.api_key || data.CLOUDFLARE_API_KEY || '').trim();
    if (email && key) {
      process.env.CLOUDFLARE_API_EMAIL = email;
      process.env.CLOUDFLARE_API_KEY = key;
      return { email, key };
    }
  } catch {
    // ignore
  }
  return null;
}

function loadTokenFile(filePath, envKey) {
  if (!existsSync(filePath)) return '';
  const value = readFileSync(filePath, 'utf8').trim();
  if (value) process.env[envKey] = value;
  return value;
}

export function loadAllCredentials() {
  loadDevVars();
  loadGlobalKeyFile();
  if (!process.env.CLOUDFLARE_API_TOKEN?.trim()) {
    const fromApi = loadTokenFile(TOKEN_FILE, 'CLOUDFLARE_API_TOKEN');
    if (!fromApi) loadTokenFile(LEGACY_PURGE_FILE, 'CLOUDFLARE_API_TOKEN');
  }
  if (!process.env.CLOUDFLARE_API_TOKEN?.trim()) {
    loadTokenFile(LEGACY_RULES_FILE, 'CLOUDFLARE_API_TOKEN');
  }
}

export function resolveCfAuth() {
  loadAllCredentials();
  const bearer = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (bearer) return { Authorization: `Bearer ${bearer}` };
  return getCloudflareAuthHeaders();
}

/** @deprecated use resolveCfAuth */
export const resolveRulesAuth = resolveCfAuth;

async function findGroup(auth, name) {
  const groups = await cloudflareApi(
    auth,
    `/user/tokens/permission_groups?name=${encodeURIComponent(name)}&per_page=50`
  );
  const hit = groups.find(g => g.name === name);
  if (!hit?.id) throw new Error(`Permission group not found: ${name}`);
  return hit.id;
}

/** Add Zone Rules Edit to an existing user API token (requires Global API Key). */
export async function upgradeExistingZoneToken(globalAuth, tokenId, zoneId) {
  const existing = await cloudflareApi(globalAuth, `/user/tokens/${tokenId}`);
  const permIds = new Set(Object.values(GROUP_IDS));
  for (const policy of existing.policies || []) {
    for (const g of policy.permission_groups || []) {
      if (g?.id) permIds.add(g.id);
    }
  }
  try {
    permIds.add(await findGroup(globalAuth, 'Zone Rules Edit'));
  } catch {
    // keep GROUP_IDS.zoneRules
  }

  const resources =
    existing.policies?.[0]?.resources || {
      [`com.cloudflare.api.account.zone.${zoneId}`]: '*',
    };

  return cloudflareApi(globalAuth, `/user/tokens/${tokenId}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: existing.name || TOKEN_NAME,
      status: existing.status || 'active',
      policies: [
        {
          effect: 'allow',
          permission_groups: [...permIds].map(id => ({ id })),
          resources,
        },
      ],
    }),
  });
}

export async function createFullZoneToken(auth, zoneId) {
  let ids = { ...GROUP_IDS };
  try {
    ids.zoneRead = await findGroup(auth, 'Zone Read');
    ids.cachePurge = await findGroup(auth, 'Cache Purge');
    ids.pageRules = await findGroup(auth, 'Page Rules Write');
    ids.zoneRules = await findGroup(auth, 'Zone Rules Edit');
  } catch {
    // documented fallback IDs
  }

  return cloudflareApi(auth, '/user/tokens', {
    method: 'POST',
    body: JSON.stringify({
      name: `${TOKEN_NAME} ${new Date().toISOString().slice(0, 10)}`,
      policies: [
        {
          effect: 'allow',
          permission_groups: Object.values(ids).map(id => ({ id })),
          resources: {
            [`com.cloudflare.api.account.zone.${zoneId}`]: '*',
          },
        },
      ],
    }),
  });
}

export async function auditToken(auth, zoneId) {
  const report = {
    zoneRead: false,
    cachePurge: false,
    zoneRules: false,
    pageRules: false,
  };

  try {
    await resolveZoneId(auth);
    report.zoneRead = true;
  } catch {
    return report;
  }

  try {
    await cloudflareApi(auth, `/zones/${zoneId}/rulesets/phases/${PHASE}/entrypoint`);
    report.zoneRules = true;
  } catch {
    // missing
  }

  try {
    await cloudflareApi(auth, `/zones/${zoneId}/pagerules`);
    report.pageRules = true;
  } catch {
    // missing
  }

  try {
    await cloudflareApi(auth, `/zones/${zoneId}/purge_cache`, {
      method: 'POST',
      body: JSON.stringify({ files: ['https://hundesalon-nika.com/favicon.ico'] }),
    });
    report.cachePurge = true;
  } catch (e) {
    if (!/unauthorized|forbidden|authentication/i.test(String(e.message))) {
      report.cachePurge = true;
    }
  }

  return report;
}

export function isFullToken(report) {
  return report.zoneRead && report.cachePurge && report.zoneRules && report.pageRules;
}

export function printAudit(report) {
  const row = (label, ok) => `${ok ? '✓' : '✗'} ${label}`;
  console.log(row('Zone Read', report.zoneRead));
  console.log(row('Cache Purge', report.cachePurge));
  console.log(row('Zone Rules Edit', report.zoneRules));
  console.log(row('Page Rules Write', report.pageRules));
}

export async function verifyBearerToken(token) {
  const verify = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await verify.json();
  if (!verify.ok || !payload.success) {
    throw new Error(payload.errors?.[0]?.message || 'Invalid API token');
  }
  const auth = { Authorization: `Bearer ${token}` };
  const zoneId = await resolveZoneId(auth);
  const audit = await auditToken(auth, zoneId);
  if (!isFullToken(audit)) {
    const missing = [];
    if (!audit.cachePurge) missing.push('Cache Purge');
    if (!audit.zoneRules) missing.push('Zone Rules Edit');
    if (!audit.pageRules) missing.push('Page Rules Write');
    throw new Error(`Token missing permissions: ${missing.join(', ')}`);
  }
  return { zoneId, audit };
}

export function saveApiToken(token) {
  const value = token.trim();
  writeFileSync(TOKEN_FILE, `${value}\n`, 'utf8');
  upsertDevVar('CLOUDFLARE_API_TOKEN', value);
  process.env.CLOUDFLARE_API_TOKEN = value;
}
