/**
 * Cloudflare Pages deploy token helpers.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  ACCOUNT_ID,
  REPO_ROOT,
  cloudflareApi,
  loadDevVars,
  upsertDevVar,
} from './cloudflare-auth.mjs';
import { accountTokenTemplateUrl } from './cf-token-dashboard.mjs';

export const PAGES_TOKEN_NAME = 'HUNDESALON_NIKA — Pages Deploy';
export const PAGES_TOKEN_FILE = path.join(REPO_ROOT, '.cloudflare-pages.token');
export const DEFAULT_PAGES_PROJECT = process.env.CLOUDFLARE_PAGES_PROJECT || 'hundesalon-nika';

const PAGES_PERMISSION_KEYS = [{ key: 'page', type: 'edit' }];

/** Official dashboard template: Account → Cloudflare Pages → Edit */
export function pagesTokenTemplateUrl(name = PAGES_TOKEN_NAME) {
  return accountTokenTemplateUrl({ name, permissionKeys: PAGES_PERMISSION_KEYS });
}

function loadTokenFile(filePath, envKey) {
  if (!existsSync(filePath)) return '';
  const value = readFileSync(filePath, 'utf8').trim();
  if (value && !process.env[envKey]) process.env[envKey] = value;
  return value;
}

/** Load CLOUDFLARE_PAGES_API_TOKEN from .dev.vars or .cloudflare-pages.token */
export function loadPagesDeployCredentials() {
  loadDevVars();
  if (!process.env.CLOUDFLARE_PAGES_API_TOKEN?.trim()) {
    loadTokenFile(PAGES_TOKEN_FILE, 'CLOUDFLARE_PAGES_API_TOKEN');
  }
  return process.env.CLOUDFLARE_PAGES_API_TOKEN?.trim() || '';
}

export async function verifyPagesDeployToken(token, projectName = DEFAULT_PAGES_PROJECT) {
  const bearer = token.trim();
  if (!bearer) throw new Error('Empty Pages deploy token');

  const verify = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  const verifyPayload = await verify.json();
  if (!verify.ok || !verifyPayload.success) {
    throw new Error(verifyPayload.errors?.[0]?.message || 'Invalid Pages deploy token');
  }

  const auth = { Authorization: `Bearer ${bearer}` };
  await cloudflareApi(auth, `/accounts/${ACCOUNT_ID}/pages/projects/${projectName}`);
  return { projectName, status: verifyPayload.result?.status || 'active' };
}

export function savePagesDeployToken(token) {
  const value = token.trim();
  writeFileSync(PAGES_TOKEN_FILE, `${value}\n`, 'utf8');
  upsertDevVar('CLOUDFLARE_PAGES_API_TOKEN', value);
  process.env.CLOUDFLARE_PAGES_API_TOKEN = value;
}

export function extractTokenFromText(text) {
  const matches = String(text || '').match(/\b(cfut_[a-zA-Z0-9_-]{20,})\b/g);
  return matches?.[0] || '';
}
