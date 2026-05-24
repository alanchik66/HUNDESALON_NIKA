/**
 * Fix 4/4: use existing Finished snapshot, configure Slack, complete onboarding.
 * npm run cursor:fix-4of4-slack
 */
import { execSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { loadDevVars, REPO_ROOT } from './lib/cloudflare-auth.mjs';

const CDP = process.env.CURSOR_CDP_PORT || '9227';
const REPO = 'HUNDESALON_NIKA';
const BRANCH = 'main';
const PROFILE = path.join(process.env.TEMP || '.', 'hundesalon-nika-cursor-playwright');

loadDevVars();
const slackWebhook = String(process.env.SLACK_WEBHOOK_URL || '').trim();

function edge() {
  return [
    path.join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
  ].find(existsSync);
}

async function waitCdp() {
  for (let i = 0; i < 45; i += 1) {
    try {
      if ((await fetch(`http://127.0.0.1:${CDP}/json/version`)).ok) return;
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error('CDP timeout');
}

async function ensureEdge() {
  if (await fetch(`http://127.0.0.1:${CDP}/json/version`).then(r => r.ok).catch(() => false)) return;
  try {
    execSync('taskkill /IM msedge.exe /F', { stdio: 'ignore' });
  } catch {
    // ignore
  }
  await new Promise(r => setTimeout(r, 2000));
  spawn(
    edge(),
    [
      `--remote-debugging-port=${CDP}`,
      '--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${PROFILE}`,
      'https://cursor.com/dashboard',
    ],
    { detached: true, stdio: 'ignore' }
  ).unref();
  await waitCdp();
}

async function clickFirst(page, locs) {
  for (const l of locs) {
    if (await l.first().isVisible().catch(() => false)) {
      await l.first().click({ timeout: 10000 }).catch(() => {});
      return true;
    }
  }
  return false;
}

async function body(page) {
  return page.locator('body').innerText().catch(() => '');
}

async function safeGoto(page, url, options = {}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', ...options });
      return;
    } catch (e) {
      if (!/interrupted by another navigation/i.test(String(e?.message || '')) || attempt === 2) {
        throw e;
      }
      await page.waitForTimeout(1500);
    }
  }
}

async function snap(page, n) {
  mkdirSync(path.join(REPO_ROOT, 'logs'), { recursive: true });
  await page.screenshot({ path: path.join(REPO_ROOT, 'logs', `cursor-4of4-${n}.png`), fullPage: true }).catch(() => {});
}

async function stopStuckRun(page) {
  await safeGoto(page, 'https://cursor.com/dashboard/cloud-agents', { timeout: 120000 });
  await page.waitForTimeout(4000);
  await page.getByText(REPO, { exact: false }).first().click({ timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await clickFirst(page, [page.getByRole('tab', { name: /^runs$/i })]);
  await page.waitForTimeout(1500);

  const firstRow = page.locator('table tbody tr, [role="row"]').nth(1);
  const rowText = await firstRow.innerText().catch(() => '');
  if (!/Running/i.test(rowText)) return false;

  await firstRow.locator('button').last().click().catch(() => {});
  await page.waitForTimeout(500);
  await clickFirst(page, [page.getByRole('menuitem', { name: /cancel|stop/i })]);
  await clickFirst(page, [page.getByRole('button', { name: /confirm|yes/i })]);
  console.log('Stopped stuck Running setup run.');
  await page.waitForTimeout(3000);
  return true;
}

async function configureCloudAgents(page) {
  await safeGoto(page, 'https://cursor.com/dashboard/cloud-agents', { timeout: 120000 });
  await page.waitForTimeout(5000);

  const sw = page
    .locator('div, section')
    .filter({ hasText: /enable self-hosted pool/i })
    .getByRole('switch')
    .first();
  if (await sw.isChecked().catch(() => false)) await sw.click();

  for (const inp of await page.locator('input:visible').all()) {
    const v = await inp.inputValue().catch(() => '');
    if (/OPENROUTER|CLOUDFLARE|sk-or|slack_webhook=/i.test(v)) {
      await inp.fill(BRANCH);
      await clickFirst(page, [page.getByRole('button', { name: /^save$/i })]);
      break;
    }
  }

  const notif = page
    .locator('div, section')
    .filter({ hasText: /slack notifications/i })
    .getByRole('switch')
    .first();
  if (await notif.isVisible().catch(() => false) && !(await notif.isChecked().catch(() => false))) {
    await notif.click();
    console.log('Slack Notifications → ON');
  }

  if (slackWebhook && !/SLACK_WEBHOOK_URL=https:\/\/hooks/i.test(await body(page))) {
    if (!/\bSLACK_WEBHOOK_URL\b/.test(await body(page)) || (await body(page)).match(/SLACK_WEBHOOK_URL/g)?.length > 2) {
      await clickFirst(page, [page.getByRole('button', { name: /add secret/i })]);
      await page.waitForTimeout(800);
      const boxes = page.getByRole('textbox');
      if ((await boxes.count()) >= 2) {
        await boxes.nth(0).fill('SLACK_WEBHOOK_URL');
        await boxes.nth(1).fill(slackWebhook);
        await clickFirst(page, [page.getByRole('button', { name: /^save$/i })]);
        console.log('SLACK_WEBHOOK_URL → runtime secret');
      }
    }
  }

  spawnSync(process.execPath, ['tools/cursor-cloud-delete-bad-slack.mjs'], { cwd: REPO_ROOT, stdio: 'pipe' });
}

async function configureSlackIntegration(page) {
  await safeGoto(page, 'https://cursor.com/dashboard');
  await page.waitForTimeout(3000);

  const integrationsLink = page.getByRole('link', { name: /^integrations$/i });
  if (await integrationsLink.isVisible().catch(() => false)) {
    await integrationsLink.click();
    await page.waitForTimeout(3000);
  }

  const slackSection = page.locator('div').filter({ hasText: /Slack/i }).filter({ hasText: /Connect|Manage/i }).first();
  const connectBtn = slackSection.getByRole('link', { name: /^connect$/i }).or(slackSection.getByRole('button', { name: /^connect$/i }));

  if (await connectBtn.isVisible().catch(() => false)) {
    console.log('Slack: откройте OAuth в Edge (60s)…');
    await connectBtn.click();
    await page.waitForTimeout(60000);
  } else {
    console.log('Slack Integration: уже Connect/Manage');
  }
}

async function completeOnboarding(page) {
  await safeGoto(page, 'https://cursor.com/dashboard');
  await page.waitForTimeout(4000);

  for (let round = 0; round < 3; round += 1) {
    const t = await body(page);
    if (!/set up your cloud environment/i.test(t)) return true;

    const setup = page
      .locator('div')
      .filter({ hasText: /set up your cloud environment/i })
      .getByRole('link', { name: /^set up$/i });
    await setup.click().catch(() => {});
    await page.waitForTimeout(5000);

    await configureCloudAgents(page);
    await safeGoto(page, 'https://cursor.com/dashboard');
    await page.waitForTimeout(3000);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(3000);
  }
  return !/set up your cloud environment/i.test(await body(page));
}

await ensureEdge();
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP}`);
const page = browser.contexts()[0].pages()[0] || (await browser.contexts()[0].newPage());

try {
  console.log('=== Stop stuck run + use existing snapshot ===');
  await stopStuckRun(page);

  const runsBody = await body(page);
  if (/Finished/i.test(runsBody) && /snapshot-/i.test(runsBody)) {
    console.log('Finished run with snapshot exists — environment ready.');
  }

  await configureSlackIntegration(page);
  await configureCloudAgents(page);

  const ok = await completeOnboarding(page);
  await snap(page, ok ? 'done' : 'pending');

  if (ok) {
    console.log('\nOK: Dashboard 4/4 в Edge.');
    console.log('В Cursor IDE: закройте вкладку dashboard и откройте:');
    console.log('  npm run cursor:edge-dashboard');
    console.log('Или Ctrl+Shift+P → Simple Browser → https://cursor.com/dashboard\n');
    process.exit(0);
  }

  console.log('\nВ Edge всё ещё 3/4. Откройте Dashboard ТОЛЬКО через:');
  console.log('  npm run cursor:edge-dashboard');
  console.log('(встроенный браузер IDE — другая сессия, там останется 3/4)\n');
  process.exit(2);
} catch (e) {
  console.error(e.message);
  process.exit(1);
} finally {
  await browser.close().catch(() => {});
}
