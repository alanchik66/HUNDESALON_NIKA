/**
 * Complete "Set up your cloud environment" onboarding step.
 * npm run cursor:complete-onboarding
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { REPO_ROOT } from './lib/cloudflare-auth.mjs';

const CDP_PORT = process.env.CURSOR_CDP_PORT || '9227';
const REPO = 'HUNDESALON_NIKA';
const REPO_FULL = 'alanchik66/HUNDESALON_NIKA';
const shotDir = path.join(REPO_ROOT, 'logs');

async function snap(page, name) {
  mkdirSync(shotDir, { recursive: true });
  await page.screenshot({ path: path.join(shotDir, `cursor-onboard-${name}.png`), fullPage: true }).catch(() => {});
  console.log(`screenshot: cursor-onboard-${name}.png`);
}

async function clickFirst(page, locators) {
  for (const loc of locators) {
    const el = loc.first();
    if (await el.isVisible().catch(() => false)) {
      await el.click({ timeout: 12000 }).catch(() => {});
      return true;
    }
  }
  return false;
}

async function bodyText(page) {
  return page.locator('body').innerText().catch(() => '');
}

async function safeGoto(page, url, options = {}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000, ...options });
      return;
    } catch (e) {
      if (!/interrupted by another navigation|ERR_INTERNET_DISCONNECTED/i.test(String(e?.message || '')) || attempt === 2) {
        throw e;
      }
      await page.waitForTimeout(2000);
    }
  }
}

async function ensureDefaults(page) {
  const body = await bodyText(page);
  const needsRepo = /Default Repository[\s\S]{0,120}Select repository/i.test(body);
  const needsBranch = /Base Branch/i.test(body) && !/\bmain\b/i.test(body);

  if (!needsRepo && !needsBranch) return false;

  const defaults = page.locator('div, section').filter({ hasText: /Defaults/i }).first();

  if (needsRepo) {
    const trigger = defaults.getByText(/Select repository|HUNDESALON_NIKA/i).first();
    await trigger.click({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);

    const search = page.locator('input[type="search"], input[type="text"]').filter({ has: page.locator(':visible') }).last();
    if (await search.isVisible().catch(() => false)) {
      await search.fill(REPO);
      await page.waitForTimeout(1200);
    }

    await clickFirst(page, [
      page.getByText(REPO_FULL, { exact: false }),
      page.getByText(REPO, { exact: false }),
    ]);
    await page.waitForTimeout(1200);
  }

  const branchInput = page.locator('input:visible').first();
  if (needsBranch && (await branchInput.isVisible().catch(() => false))) {
    const current = await branchInput.inputValue().catch(() => '');
    if (!current.trim()) {
      await branchInput.fill('main');
      await page.waitForTimeout(800);
    }
  }

  await clickFirst(page, [page.getByRole('button', { name: /^save$/i })]);
  await page.waitForTimeout(2500);
  return true;
}

async function cloudItemVisible(page) {
  return /set up your cloud environment/i.test(await bodyText(page));
}

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
const page = browser.contexts()[0].pages()[0] || (await browser.contexts()[0].newPage());

try {
  await safeGoto(page, 'https://cursor.com/dashboard', { waitUntil: 'networkidle' }).catch(() =>
    safeGoto(page, 'https://cursor.com/dashboard')
  );
  await page.waitForTimeout(4000);
  await snap(page, '01-dashboard');

  if (!(await cloudItemVisible(page))) {
    console.log('Cloud onboarding already complete.');
    process.exit(0);
  }

  const setupBtn = page
    .locator('div')
    .filter({ hasText: /set up your cloud environment/i })
    .locator('a[href="/dashboard/cloud-agents"], a[href*="cloud-agents"]')
    .filter({ hasText: /^set up$/i })
    .or(page.getByRole('link', { name: /^set up$/i }));

  await clickFirst(page, [setupBtn]);
  await page.waitForTimeout(5000);
  await snap(page, '02-cloud-agents');

  await ensureDefaults(page);

  let body = await bodyText(page);

  if (!/HUNDESALON|hundesalon/i.test(body)) {
    await clickFirst(page, [
      page.getByRole('button', { name: /create environment/i }),
      page.getByRole('button', { name: /new environment/i }),
      page.getByRole('button', { name: /connect repository/i }),
    ]);
    await page.waitForTimeout(2000);
    await clickFirst(page, [page.getByRole('button', { name: /^github$/i }), page.getByText(/^GitHub$/i)]);
    await page.waitForTimeout(1500);
    const search = page.locator('input[type="search"], input[type="text"]').first();
    if (await search.isVisible().catch(() => false)) await search.fill(REPO);
    await page.waitForTimeout(1200);
    await clickFirst(page, [page.getByText(REPO, { exact: false }), page.getByText(REPO_FULL, { exact: false })]);
    await clickFirst(page, [
      page.getByRole('button', { name: /create environment/i }),
      page.getByRole('button', { name: /^create$/i }),
      page.getByRole('button', { name: /continue/i }),
    ]);
    await page.waitForTimeout(8000);
  }

  await clickFirst(page, [page.getByText(REPO, { exact: false }), page.getByText(REPO_FULL, { exact: false })]);
  await page.waitForTimeout(4000);
  await snap(page, '03-env-detail');

  await clickFirst(page, [page.getByRole('tab', { name: /^runs$/i })]);
  await page.waitForTimeout(2000);

  const runningRow = page.locator('tr, [role="row"]').filter({ hasText: /Running/i }).first();
  if (await runningRow.isVisible().catch(() => false)) {
    await runningRow.locator('button').last().click().catch(() => {});
    await page.waitForTimeout(500);
    await clickFirst(page, [
      page.getByRole('menuitem', { name: /cancel|stop|abort/i }),
      page.getByText(/cancel|stop/i),
    ]);
    await clickFirst(page, [page.getByRole('button', { name: /confirm|yes|stop/i })]);
    console.log('Cancelled Running setup run.');
    await page.waitForTimeout(4000);
  }

  const finished = page.locator('tr, [role="row"]').filter({ hasText: /Finished/i }).first();
  if (await finished.isVisible().catch(() => false)) {
    console.log('Found Finished run with snapshot.');
  } else {
    await clickFirst(page, [page.getByRole('button', { name: /start setup agent/i })]);
    await page.waitForTimeout(2000);
    await clickFirst(page, [
      page.getByRole('menuitem').first(),
      page.getByRole('button', { name: /start|run|setup/i }),
    ]);
    console.log('Started setup agent — waiting up to 3 min…');
    const deadline = Date.now() + 180000;
    while (Date.now() < deadline) {
      await page.waitForTimeout(12000);
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(2000);
      await clickFirst(page, [page.getByRole('tab', { name: /^runs$/i })]);
      body = await bodyText(page);
      if (/Finished/i.test(body) && !/Running/i.test(body)) break;
    }
  }

  await snap(page, '04-runs');

  await safeGoto(page, 'https://cursor.com/dashboard/cloud-agents', { timeout: 90000 });
  await page.waitForTimeout(3000);
  await ensureDefaults(page);
  await safeGoto(page, 'https://cursor.com/dashboard', { waitUntil: 'networkidle', timeout: 90000 }).catch(() =>
    safeGoto(page, 'https://cursor.com/dashboard')
  );
  await page.waitForTimeout(5000);
  await snap(page, '05-dashboard-after');

  const done = !(await cloudItemVisible(page));
  console.log(done ? 'Onboarding: cloud step completed.' : 'Cloud item still visible — refresh dashboard in browser.');
  process.exit(done ? 0 : 2);
} catch (e) {
  console.error(e.message);
  await snap(page, 'error').catch(() => {});
  process.exit(1);
} finally {
  await browser.close().catch(() => {});
}
