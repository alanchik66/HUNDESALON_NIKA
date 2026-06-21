/**
 * Unified Cloudflare zone operations token for HUNDESALON NIKA.
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

export const TOKEN_NAME = 'HUNDESALON_NIKA — Zone Ops';
/** Current Dashboard token used by local zone automation. */
export const ZONE_OPS_TOKEN_ID = 'aa00284c2a404f75d68630a57c451a31';
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

export async function auditToken(auth, zoneId) {
  const report = {
    zoneRead: false,
    dnsWrite: false,
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

  return report;
}

export function isFullToken(report) {
  return report.zoneRead && report.dnsWrite && report.cachePurge && report.zoneRules && report.pageRules;
}

export function printAudit(report) {
  const row = (label, ok) => `${ok ? '✓' : '✗'} ${label}`;
  console.log(row('Zone Read', report.zoneRead));
  console.log(row('DNS Records Edit', report.dnsWrite));
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
    if (!audit.dnsWrite) missing.push('DNS Records Edit');
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
