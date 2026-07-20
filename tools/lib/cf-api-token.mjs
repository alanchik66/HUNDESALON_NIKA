/**
 * Unified Cloudflare automation token for HUNDESALON NIKA (zone + Pages deploy).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  ACCOUNT_ID,
  REPO_ROOT,
  cloudflareApi,
  getCloudflareAuthHeaders,
  loadDevVars,
  removeDevVar,
  resolveZoneId,
  upsertDevVar,
} from './cloudflare-auth.mjs';
import {
  UNIFIED_PERMISSION_KEYS,
  accountTokenTemplateUrl,
  userTokenTemplateUrl,
} from './cf-token-dashboard.mjs';

/** One scoped User API Token for all project automation. */
export const TOKEN_NAME = 'HUNDESALON_NIKA — Automation';
/** @deprecated use TOKEN_NAME — kept for edit URL */
export const ZONE_OPS_TOKEN_NAME = 'HUNDESALON_NIKA — Zone Ops';
/** Current Dashboard token — rename to Automation when editing in Dashboard. */
export const ZONE_OPS_TOKEN_ID = 'aa00284c2a404f75d68630a57c451a31';
export const DEFAULT_PAGES_PROJECT = process.env.CLOUDFLARE_PAGES_PROJECT || 'hundesalon-nika';

/**
 * Dashboard URL for HUNDESALON_NIKA — Automation.
 * Uses account-scoped route (no :account picker). Fallback: userTokenTemplateUrl().
 */
export function unifiedTokenTemplateUrl(name = TOKEN_NAME) {
  return accountTokenTemplateUrl({ name, permissionKeys: UNIFIED_PERMISSION_KEYS });
}

/** Profile-level template (official docs); accountId=* avoids account-selection dead-end. */
export function unifiedTokenProfileTemplateUrl(name = TOKEN_NAME) {
  return userTokenTemplateUrl({ name, permissionKeys: UNIFIED_PERMISSION_KEYS });
}
export const GROUP_IDS = {
  zoneRead: 'c8fed203ed3043cba015a93ad1616f1f',
  dnsWrite: '4755a26eedb94da69e1066d98aa820be',
  cachePurge: 'e22dca3480a4436b9c8a7100414e84b5',
  pageRules: 'ed07f73c33134c868f263e309f1c4e4a',
  zoneRules: 'dfe707eb8a1c476cb7f423c5a16b2b6c',
};

const PHASE = 'http_request_dynamic_redirect';
const TOKEN_FILE = path.join(REPO_ROOT, '.cloudflare-api.token');

function loadTokenFile(filePath, envKey) {
  if (!existsSync(filePath)) return '';
  const value = readFileSync(filePath, 'utf8').trim();
  if (value) process.env[envKey] = value;
  return value;
}

export function loadAllCredentials() {
  loadDevVars();
  if (!process.env.CLOUDFLARE_API_TOKEN?.trim()) {
    loadTokenFile(TOKEN_FILE, 'CLOUDFLARE_API_TOKEN');
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

export async function auditPagesDeploy(auth, projectName = DEFAULT_PAGES_PROJECT) {
  try {
    await cloudflareApi(auth, `/accounts/${ACCOUNT_ID}/pages/projects/${projectName}`);
    return true;
  } catch {
    return false;
  }
}

export async function auditToken(auth, zoneId) {
  const report = {
    zoneRead: false,
    dnsWrite: false,
    cachePurge: false,
    zoneRules: false,
    pageRules: false,
    pagesDeploy: false,
  };

  try {
    await resolveZoneId(auth);
    report.zoneRead = true;
  } catch {
    return report;
  }

  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
      method: 'POST',
      headers: {
        ...auth,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'INVALID_PROBE',
        name: '_codex-permission-check.hundesalon-nika.com',
        content: 'permission-check',
      }),
    });
    const payload = await response.json();
    if (
      response.status === 400 &&
      payload.errors?.some(error => /record type .* invalid/i.test(String(error.message)))
    ) {
      report.dnsWrite = true;
    }
  } catch {
    // missing
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

  report.pagesDeploy = await auditPagesDeploy(auth);
  return report;
}

export function isZoneToken(report) {
  return report.zoneRead && report.dnsWrite && report.cachePurge && report.pageRules;
}

/** Zone + Pages deploy — enough for deploy, purge, DNS, Page Rules. */
export function isDeployToken(report) {
  return isZoneToken(report) && report.pagesDeploy;
}

/** Full zone automation incl. dynamic redirect / zone rulesets. */
export function isFullZoneToken(report) {
  return isZoneToken(report) && report.zoneRules;
}

/** @deprecated use isZoneToken */
export const isFullToken = isZoneToken;

export function isUnifiedToken(report) {
  return isDeployToken(report);
}

export function printAudit(report) {
  const row = (label, ok) => `${ok ? '✓' : '✗'} ${label}`;
  console.log(row('Zone Read', report.zoneRead));
  console.log(row('DNS Records Edit', report.dnsWrite));
  console.log(row('Cache Purge', report.cachePurge));
  console.log(row('Zone Rules Edit', report.zoneRules));
  console.log(row('Page Rules Write', report.pageRules));
  console.log(row('Pages Deploy', report.pagesDeploy));
}

export async function verifyBearerToken(token, { requirePages = false } = {}) {
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
  if (!isZoneToken(audit)) {
    const missing = [];
    if (!audit.dnsWrite) missing.push('DNS Records Edit');
    if (!audit.cachePurge) missing.push('Cache Purge');
    if (!audit.pageRules) missing.push('Page Rules Write');
    throw new Error(`Token missing permissions: ${missing.join(', ')}`);
  }
  if (requirePages && !audit.pagesDeploy) {
    throw new Error('Token missing Account → Cloudflare Pages → Edit');
  }
  if (!audit.zoneRules) {
    // ponytail: zone rules (Single Redirect) optional for deploy; add in Dashboard if needed
  }
  return { zoneId, audit };
}

export function saveApiToken(token, { syncPagesAlias = true } = {}) {
  const value = token.trim();
  writeFileSync(TOKEN_FILE, `${value}\n`, 'utf8');
  upsertDevVar('CLOUDFLARE_API_TOKEN', value);
  process.env.CLOUDFLARE_API_TOKEN = value;
  if (syncPagesAlias) {
    upsertDevVar('CLOUDFLARE_PAGES_API_TOKEN', value);
    process.env.CLOUDFLARE_PAGES_API_TOKEN = value;
    writeFileSync(path.join(REPO_ROOT, '.cloudflare-pages.token'), `${value}\n`, 'utf8');
  }
}

/** Unique deploy-capable tokens from env/files (unified first). */
export function listDeployTokenCandidates() {
  loadAllCredentials();
  const fromPagesFile = existsSync(path.join(REPO_ROOT, '.cloudflare-pages.token'))
    ? readFileSync(path.join(REPO_ROOT, '.cloudflare-pages.token'), 'utf8').trim()
    : '';
  const values = [
    process.env.CLOUDFLARE_API_TOKEN,
    process.env.CLOUDFLARE_PAGES_API_TOKEN,
    fromPagesFile,
  ]
    .map(value => value?.trim())
    .filter(Boolean);
  return [...new Set(values)];
}

export async function resolveDeployToken(projectName = DEFAULT_PAGES_PROJECT) {
  for (const token of listDeployTokenCandidates()) {
    const auth = { Authorization: `Bearer ${token}` };
    if (await auditPagesDeploy(auth, projectName)) {
      return token;
    }
  }
  return '';
}

export function clearLegacyPagesTokenAlias() {
  removeDevVar('CLOUDFLARE_PAGES_API_TOKEN');
  delete process.env.CLOUDFLARE_PAGES_API_TOKEN;
}
