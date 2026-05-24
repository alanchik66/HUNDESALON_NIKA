/**
 * Edit NIKA token via Playwright + normal Edge profile (not CDP debug port).
 * npm run cf:edit-token-playwright
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  auditToken,
  GROUP_IDS,
  isFullToken,
  loadAllCredentials,
  printAudit,
  resolveCfAuth,
} from './lib/cf-api-token.mjs';
import { resolveZoneId } from './lib/cloudflare-auth.mjs';

import { EXISTING_PURGE_TOKEN_ID } from './lib/cf-api-token.mjs';

const TOKEN_ID = EXISTING_PURGE_TOKEN_ID;
const EDIT_URL = `https://dash.cloudflare.com/profile/api-tokens/${TOKEN_ID}/edit`;
const userDataDir = path.join(
  process.env.TEMP || '.',
  'hundesalon-nika-cf-playwright'
);

loadAllCredentials();
const auth = resolveCfAuth();
const zoneId = await resolveZoneId(auth);
let audit = await auditToken(auth, zoneId);
if (isFullToken(audit)) {
  console.log('Token already complete:\n');
  printAudit(audit);
  process.exit(0);
}

const edgeExe = [
  path.join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
  path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
].find(existsSync);
const launchOpts = {
  headless: false,
  args: ['--disable-blink-features=AutomationControlled'],
  viewport: { width: 1400, height: 900 },
};
if (edgeExe) launchOpts.executablePath = edgeExe;

let context;
try {
  context = await chromium.launchPersistentContext(userDataDir, launchOpts);
} catch (e) {
  console.error('Could not open Edge profile (close all Edge windows and retry).');
  console.error(e.message);
  process.exit(1);
}

const page = context.pages()[0] || (await context.newPage());
await page.goto(EDIT_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(8000);

const cookie = page.getByRole('button', { name: /allow all|alle erlauben|alle cookies/i });
if (await cookie.isVisible().catch(() => false)) {
  await cookie.click();
  await page.waitForTimeout(2000);
}

let body = await page.locator('body').innerText().catch(() => '');
if (/log in|anmelden|sign in/i.test(body) && !/NIKA|Purge|token/i.test(body)) {
  console.log('Sign in to Cloudflare in the opened Edge window (90s)…');
  await page.waitForTimeout(90000);
  await page.goto(EDIT_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(8000);
  body = await page.locator('body').innerText().catch(() => '');
}
if (/log in|anmelden|sign in/i.test(body) && !/NIKA|Purge/i.test(body)) {
  console.error('Still not signed in. Run: npm run cf:edge-dashboard — login — npm run cf:edit-token-playwright');
  await context.close();
  process.exit(1);
}

const zr = /zone rules|zonen.?regeln/i;
const ed = /edit|bearbeiten/i;

for (const row of await page.locator('tr, [role="row"]').all()) {
  const t = await row.innerText().catch(() => '');
  if (!/NIKA|Purge/i.test(t)) continue;
  const btn = row.getByRole('button', { name: ed }).or(row.getByRole('link', { name: ed }));
  if (await btn.count()) {
    await btn.first().click();
    break;
  }
}

await page.waitForTimeout(6000);

for (const label of await page.locator('label, button, [role="button"], span').all()) {
  const t = (await label.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  if (t.length > 120) continue;
  if (zr.test(t) && ed.test(t)) {
    await label.click().catch(() => {});
    await page.waitForTimeout(300);
  }
}

for (const cb of await page.locator('input[type="checkbox"]').all()) {
  const row = await cb.evaluate(el => (el.closest('tr,li,motion,motion.div,div')?.innerText || '').replace(/\s+/g, ' '));
  if (zr.test(row) && ed.test(row) && !(await cb.isChecked())) {
    await cb.click();
  }
}

await page.getByRole('button', { name: /continue|weiter|fortfahren/i }).click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(3000);
await page.getByRole('button', { name: /update token|token aktualisieren|speichern|save/i }).click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(3000);
await page.getByRole('button', { name: /confirm|bestätigen|update token|token aktualisieren/i }).click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(5000);

await context.close();

audit = await auditToken(auth, zoneId);
console.log('\nToken audit:\n');
printAudit(audit);
process.exit(isFullToken(audit) ? 0 : 1);
