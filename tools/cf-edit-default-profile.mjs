/**
 * Edit token via Edge Default profile (not CDP debug port).
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  auditToken,
  EXISTING_PURGE_TOKEN_ID,
  isFullToken,
  loadAllCredentials,
  printAudit,
  resolveCfAuth,
} from './lib/cf-api-token.mjs';
import { resolveZoneId } from './lib/cloudflare-auth.mjs';

const EDIT_URL = `https://dash.cloudflare.com/profile/api-tokens/${EXISTING_PURGE_TOKEN_ID}/edit`;
const edgeExe = [
  path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
  path.join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
].find(existsSync);

const userData = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data');

console.log('Edge:', edgeExe || 'bundled');
console.log('Profile:', userData);

loadAllCredentials();
const auth = resolveCfAuth();

let context;
try {
  context = await chromium.launchPersistentContext(userData, {
    ...(edgeExe ? { executablePath: edgeExe } : {}),
    headless: false,
    args: ['--profile-directory=Default'],
    viewport: { width: 1440, height: 900 },
  });
} catch (e) {
  console.error('FAIL launch:', e.message.slice(0, 200));
  console.error('→ Close all Edge windows and retry, or use: npm run cf:open-edit-token');
  process.exit(1);
}

const page = context.pages()[0] || (await context.newPage());
console.log('Goto edit…');
await page.goto(EDIT_URL, { waitUntil: 'networkidle', timeout: 120000 }).catch(() =>
  page.goto(EDIT_URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
);
await page.waitForTimeout(5000);

const cookie = page.getByRole('button', { name: /allow all|alle erlauben/i });
if (await cookie.isVisible({ timeout: 3000 }).catch(() => false)) await cookie.click();

const body = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
console.log('Has NIKA:', /NIKA|Purge/i.test(body));
console.log('Has login:', /log in|anmelden|sign in/i.test(body) && !/NIKA/i.test(body));

if (/log in|anmelden/i.test(body) && !/NIKA|Purge|zone/i.test(body)) {
  console.log('WAIT 60s login…');
  await page.waitForTimeout(60000);
}

const zr = /zone rules|zonen.?regeln|zonenregeln/i;
const ed = /edit|bearbeiten/i;
let hits = 0;

for (const cb of await page.locator('input[type=checkbox]').all()) {
  const row = await cb.evaluate(el => (el.closest('tr,li,motion.div,div')?.innerText || '').replace(/\s+/g, ' '));
  if (zr.test(row) && ed.test(row) && !(await cb.isChecked())) {
    await cb.click();
    hits++;
    console.log('Checked:', row.slice(0, 90));
  }
}

if (!hits) {
  for (const el of await page.getByText(zr).all()) {
    const t = await el.innerText().catch(() => '');
    if (ed.test(t) && t.length < 100) {
      await el.click().catch(() => {});
      hits++;
    }
  }
}

console.log('Checkbox clicks:', hits);
await page.getByRole('button', { name: /continue|weiter|fortfahren/i }).click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(2500);
await page.getByRole('button', { name: /update token|token aktualisieren|speichern|save/i }).click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(2500);
await page.getByRole('button', { name: /confirm|bestätigen|update/i }).click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(4000);

await context.close();

const zoneId = await resolveZoneId(auth);
const audit = await auditToken(auth, zoneId);
console.log('\nAudit:');
printAudit(audit);
process.exit(isFullToken(audit) ? 0 : 1);
