/**
 * Fix Cloud Agents defaults (base branch) after automated setup.
 * npm run cursor:fix-cloud-settings
 */
import { execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const CDP_PORT = process.env.CURSOR_CDP_PORT || '9227';
const URL = 'https://cursor.com/dashboard/cloud-agents';
const BRANCH = 'main';

async function waitForCdp(ms = 30000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (res.ok) return true;
    } catch {
      // retry
    }
    await new Promise(r => setTimeout(r, 1200));
  }
  return false;
}

try {
  execSync('taskkill /IM msedge.exe /F', { stdio: 'ignore' });
} catch {
  // ignore
}
await new Promise(r => setTimeout(r, 2000));

const edge = [
  path.join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
  path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
].find(existsSync);

const userDataDir = path.join(process.env.TEMP || '.', 'hundesalon-nika-cursor-playwright');
spawn(
  edge,
  [
    `--remote-debugging-port=${CDP_PORT}`,
    '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    URL,
  ],
  { detached: true, stdio: 'ignore' }
).unref();

if (!(await waitForCdp(45000))) {
  console.error('CDP not ready');
  process.exit(1);
}

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
const context = browser.contexts()[0];
const page = context.pages()[0] || (await context.newPage());
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(4000);

const cancel = page.getByRole('button', { name: /cancel/i }).first();
if (await cancel.isVisible().catch(() => false)) {
  await cancel.click();
  console.log('Dismissed open secret form.');
}

const baseBranch = page.getByLabel(/base branch/i).or(page.locator('input').filter({ hasText: /base branch/i }));
const inputs = page.locator('input:visible');
for (let i = 0; i < (await inputs.count()); i += 1) {
  const el = inputs.nth(i);
  const label = await el.evaluate(node => {
    const row = node.closest('div,label,section');
    return (row?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  });
  if (/base branch/i.test(label)) {
    await el.fill(BRANCH);
    console.log(`Base branch set to ${BRANCH}.`);
    break;
  }
}

await page.getByRole('button', { name: /^save$/i }).click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(2000);
console.log('Settings page updated.');
await browser.close().catch(() => {});
