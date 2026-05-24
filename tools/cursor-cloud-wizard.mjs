/**
 * Walk through cloud setup wizard from dashboard "Set up" button.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { REPO_ROOT } from './lib/cloudflare-auth.mjs';

const CDP = process.env.CURSOR_CDP_PORT || '9227';
const REPO = 'HUNDESALON_NIKA';

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP}`);
const page = browser.contexts()[0].pages()[0] || (await browser.contexts()[0].newPage());
mkdirSync(path.join(REPO_ROOT, 'logs'), { recursive: true });

const clickButtons = async () => {
  const names = [
    /^continue$/i,
    /^next$/i,
    /^done$/i,
    /^finish$/i,
    /^save snapshot$/i,
    /^get started$/i,
    /^confirm$/i,
    /^create environment$/i,
    /^start$/i,
  ];
  for (const re of names) {
    const btn = page.getByRole('button', { name: re });
    if (await btn.first().isVisible().catch(() => false)) {
      await btn.first().click({ timeout: 5000 }).catch(() => {});
      console.log(`Clicked: ${re}`);
      await page.waitForTimeout(2000);
    }
  }
};

await page.goto('https://cursor.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(3000);

const setup = page
  .locator('div')
  .filter({ hasText: /set up your cloud environment/i })
  .getByRole('link', { name: /^set up$/i });

if (!(await setup.isVisible().catch(() => false))) {
  console.log('No cloud setup item — done.');
  process.exit(0);
}

await setup.click();
await page.waitForTimeout(3000);
console.log('URL:', page.url());

for (let step = 0; step < 40; step += 1) {
  await clickButtons();
  await page.getByText(REPO, { exact: false }).first().click({ timeout: 3000 }).catch(() => {});
  await page.getByRole('button', { name: /^github$/i }).click({ timeout: 2000 }).catch(() => {});
  const search = page.locator('input').first();
  if (await search.isVisible().catch(() => false)) {
    await search.fill(REPO).catch(() => {});
  }
  await page.waitForTimeout(5000);

  const dash = await page.goto('https://cursor.com/dashboard', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null);
  await page.waitForTimeout(3000);
  const body = await page.locator('body').innerText();
  if (!/set up your cloud environment/i.test(body)) {
    console.log('Onboarding complete after step', step);
    await page.screenshot({ path: path.join(REPO_ROOT, 'logs', 'cursor-wizard-done.png'), fullPage: true });
    process.exit(0);
  }

  if (await setup.isVisible().catch(() => false)) {
    await setup.click();
    await page.waitForTimeout(3000);
    console.log('Step', step, 'URL:', page.url());
  }
}

console.log('Wizard did not clear checklist in 40 steps.');
await page.screenshot({ path: path.join(REPO_ROOT, 'logs', 'cursor-wizard-stuck.png'), fullPage: true });
process.exit(2);
