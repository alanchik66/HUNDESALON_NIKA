/**
 * Cancel stuck Cloud Agent setup run and refresh dashboard onboarding.
 */
import { chromium } from 'playwright';

const CDP = process.env.CURSOR_CDP_PORT || '9227';
const REPO = 'HUNDESALON_NIKA';

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP}`);
const page = browser.contexts()[0].pages()[0] || (await browser.contexts()[0].newPage());

await page.goto('https://cursor.com/dashboard/cloud-agents', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(3000);
await page.getByText(REPO, { exact: false }).first().click({ timeout: 15000 }).catch(() => {});
await page.waitForTimeout(3000);
await page.getByRole('tab', { name: /^runs$/i }).click({ timeout: 10000 }).catch(() => {});
await page.waitForTimeout(2000);

const runningRow = page.locator('tr, [role="row"]').filter({ hasText: /Running/i }).first();
if (await runningRow.isVisible().catch(() => false)) {
  await runningRow.locator('button').last().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(600);
  const stop = page.getByRole('menuitem', { name: /cancel|stop|abort/i }).or(page.getByText(/cancel|stop/i));
  if (await stop.first().isVisible().catch(() => false)) {
    await stop.first().click();
    await page.getByRole('button', { name: /confirm|yes|stop/i }).first().click({ timeout: 5000 }).catch(() => {});
    console.log('Stopped Running run.');
  }
}

await page.waitForTimeout(3000);
await page.goto('https://cursor.com/dashboard', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
const setup = page
  .locator('div')
  .filter({ hasText: /set up your cloud environment/i })
  .getByRole('link', { name: /^set up$/i });
if (await setup.isVisible().catch(() => false)) {
  await setup.click();
  await page.waitForTimeout(5000);
}

await page.goto('https://cursor.com/dashboard', { waitUntil: 'domcontentloaded' });
const body = await page.locator('body').innerText();
console.log(/4\/4|4 of 4/i.test(body) ? '4/4' : /set up your cloud environment/i.test(body) ? 'still 3/4' : 'cloud line gone');
await page.screenshot({ path: 'logs/cursor-after-cancel.png', fullPage: true }).catch(() => {});
await browser.close().catch(() => {});
