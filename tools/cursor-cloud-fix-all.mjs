/**
 * Variant B: Edge dashboard — self-hosted OFF, bad secrets, onboarding 4/4.
 * npm run cursor:variant-b
 */
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { REPO_ROOT } from './lib/cloudflare-auth.mjs';

const CDP = process.env.CURSOR_CDP_PORT || '9227';
const REPO = 'HUNDESALON_NIKA';
const BRANCH = 'main';
const AGENTS_URL = 'https://cursor.com/dashboard/cloud-agents';
const DASHBOARD_URL = 'https://cursor.com/dashboard';
const userDataDir = path.join(process.env.TEMP || '.', 'hundesalon-nika-cursor-playwright');

function edgePath() {
  return [
    path.join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
  ].find(existsSync);
}

async function waitCdp(ms = 45000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(`http://127.0.0.1:${CDP}/json/version`)).ok) return true;
    } catch {
      // retry
    }
    await new Promise(r => setTimeout(r, 1200));
  }
  return false;
}

async function ensureEdge() {
  if (await waitCdp(2000)) return;
  const edge = edgePath();
  if (!edge) throw new Error('Edge not found');
  try {
    execSync('taskkill /IM msedge.exe /F', { stdio: 'ignore' });
  } catch {
    // ignore
  }
  await new Promise(r => setTimeout(r, 2000));
  spawn(
    edge,
    [
      `--remote-debugging-port=${CDP}`,
      '--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      AGENTS_URL,
    ],
    { detached: true, stdio: 'ignore' }
  ).unref();
  console.log('Started Edge (cursor:edge-dashboard profile)');
  if (!(await waitCdp(60000))) throw new Error('CDP timeout — sign in to cursor.com in Edge');
}

async function snap(page, n) {
  mkdirSync(path.join(REPO_ROOT, 'logs'), { recursive: true });
  await page.screenshot({ path: path.join(REPO_ROOT, 'logs', `cursor-variant-b-${n}.png`), fullPage: true }).catch(() => {});
}

async function clickFirst(page, locs) {
  for (const l of locs) {
    const el = l.first();
    if (await el.isVisible().catch(() => false)) {
      await el.click({ timeout: 10000 }).catch(() => {});
      return true;
    }
  }
  return false;
}

async function bodyText(page) {
  return page.locator('body').innerText().catch(() => '');
}

async function disableSelfHosted(page) {
  const switchEl = page
    .locator('div, li, section')
    .filter({ hasText: /enable self-hosted pool/i })
    .getByRole('switch')
    .first();

  if (!(await switchEl.isVisible().catch(() => false))) {
    console.log('Self-hosted switch not found.');
    return false;
  }

  const checked = await switchEl.isChecked().catch(() => false);
  if (checked) {
    await switchEl.click();
    console.log('Self-hosted pool: OFF');
    await page.waitForTimeout(1500);
    return true;
  }
  console.log('Self-hosted pool: already OFF');
  return false;
}

async function fixBaseBranch(page) {
  for (const inp of await page.locator('input:visible').all()) {
    const v = await inp.inputValue().catch(() => '');
    if (!/OPENROUTER|CLOUDFLARE|sk-or|slack_webhook=/i.test(v)) continue;
    await inp.fill(BRANCH);
    console.log(`Base branch → ${BRANCH}`);
    await clickFirst(page, [page.getByRole('button', { name: /^save$/i })]);
    await page.waitForTimeout(2000);
    return true;
  }
  const body = await bodyText(page);
  if (/Base Branch[\s\S]{0,40}\bmain\b/i.test(body)) {
    console.log('Base branch: main (ok)');
    return true;
  }
  return false;
}

async function deleteBadSecrets(page) {
  let removed = 0;
  const rows = page.locator('table tbody tr');
  const n = await rows.count();
  for (let i = 0; i < n; i += 1) {
    const row = rows.nth(i);
    const t = await row.innerText().catch(() => '');
    if (!/hooks\.slack\.com|SLACK_WEBHOOK_URL=https/i.test(t)) continue;

    await row.locator('button').last().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    await clickFirst(page, [
      page.getByRole('menuitem', { name: /^delete$/i }),
      page.getByRole('menuitem', { name: /remove/i }),
      page.getByText(/^delete$/i),
    ]);
    await clickFirst(page, [
      page.getByRole('button', { name: /^delete$/i }),
      page.getByRole('button', { name: /confirm/i }),
    ]);
    removed += 1;
    console.log('Deleted malformed Slack secret row.');
    await page.waitForTimeout(2000);
  }
  return removed;
}

async function completeOnboarding(page) {
  await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(4000);

  if (!/set up your cloud environment/i.test(await bodyText(page))) {
    console.log('Onboarding: cloud step already done.');
    return true;
  }

  const setup = page
    .locator('div')
    .filter({ hasText: /set up your cloud environment/i })
    .getByRole('link', { name: /^set up$/i });

  await setup.click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(6000);

  await page.goto(AGENTS_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4000);

  await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4000);
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(3000);

  const ok = !/set up your cloud environment/i.test(await bodyText(page));
  console.log(ok ? 'Onboarding: 4/4' : 'Onboarding: cloud item still visible');
  return ok;
}

await ensureEdge();

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP}`);
const page = browser.contexts()[0].pages()[0] || (await browser.contexts()[0].newPage());

try {
  await page.goto(AGENTS_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(5000);

  if (/sign in|log in/i.test(await bodyText(page)) && !/cloud agents/i.test(await bodyText(page))) {
    console.error('Not signed in — log in to cursor.com in Edge, then: npm run cursor:variant-b');
    process.exit(1);
  }

  await clickFirst(page, [page.getByRole('button', { name: /^cancel$/i })]);
  await disableSelfHosted(page);
  await fixBaseBranch(page);
  const removed = await deleteBadSecrets(page);
  await snap(page, 'settings');

  const body = await bodyText(page);
  console.log('ENV:', /Active/i.test(body) && /HUNDESALON/i.test(body) ? 'Active' : 'check Environments table');
  console.log('SECRETS:', /OPENROUTER_API_KEY/.test(body) && /CLOUDFLARE_API_TOKEN/.test(body) ? 'ok' : 'missing');
  console.log('BAD_SLACK_REMOVED:', removed);

  const onboardOk = await completeOnboarding(page);
  await snap(page, 'dashboard');

  process.exit(onboardOk ? 0 : 2);
} catch (e) {
  console.error(e.message);
  await snap(page, 'error').catch(() => {});
  process.exit(1);
} finally {
  await browser.close().catch(() => {});
}
