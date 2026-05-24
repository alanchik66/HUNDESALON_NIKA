/**
 * Finish Cursor Cloud setup: wait for runs, fix defaults, clean secrets, verify dashboard.
 * npm run cursor:finish-cloud
 */
import { execSync, spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { loadDevVars, REPO_ROOT } from './lib/cloudflare-auth.mjs';

const REPO_SLUG = 'HUNDESALON_NIKA';
const BRANCH = 'main';
const CDP_PORT = process.env.CURSOR_CDP_PORT || '9227';
const RUN_WAIT_MS = Number(process.env.CURSOR_RUN_WAIT_MS || 900000);
const userDataDir = path.join(process.env.TEMP || '.', 'hundesalon-nika-cursor-playwright');
const shotDir = path.join(REPO_ROOT, 'logs');
const logFile = path.join(shotDir, 'cursor-cloud-finish.log');
const ENV_DETAIL = `https://cursor.com/dashboard/cloud-agents`;
const SETTINGS_URL = 'https://cursor.com/dashboard/cloud-agents';
const DASHBOARD_URL = 'https://cursor.com/dashboard';

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  mkdirSync(shotDir, { recursive: true });
  appendFileSync(logFile, `${line}\n`, 'utf8');
}

function edgePath() {
  return [
    path.join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
  ].find(existsSync);
}

async function snap(page, name) {
  const file = path.join(shotDir, `cursor-finish-${name}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  log(`Screenshot logs/cursor-finish-${name}.png`);
}

async function bodyText(page) {
  return page.locator('body').innerText().catch(() => '');
}

async function waitForCdp(ms = 45000) {
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

async function openSession() {
  if (await waitForCdp(3000)) {
    try {
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
      const context = browser.contexts()[0];
      const page = context.pages()[0] || (await context.newPage());
      log(`CDP :${CDP_PORT}`);
      return { page, close: async () => browser.close().catch(() => {}) };
    } catch {
      // fall through
    }
  }

  try {
    execSync('taskkill /IM msedge.exe /F', { stdio: 'ignore' });
  } catch {
    // ignore
  }
  await new Promise(r => setTimeout(r, 2000));

  const edge = edgePath();
  if (!edge) throw new Error('Edge not found');

  spawn(
    edge,
    [
      `--remote-debugging-port=${CDP_PORT}`,
      '--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      SETTINGS_URL,
    ],
    { detached: true, stdio: 'ignore' }
  ).unref();

  if (!(await waitForCdp(60000))) throw new Error('CDP timeout');
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
  const context = browser.contexts()[0];
  const page = context.pages()[0] || (await context.newPage());
  return { page, close: async () => browser.close().catch(() => {}) };
}

async function clickFirst(page, locators) {
  for (const loc of locators) {
    const el = loc.first();
    if (await el.isVisible().catch(() => false)) {
      await el.click({ timeout: 10000 }).catch(() => {});
      return true;
    }
  }
  return false;
}

async function dismissSecretForm(page) {
  const cancel = page.getByRole('button', { name: /^cancel$/i });
  if (await cancel.isVisible().catch(() => false)) {
    await cancel.click();
    log('Cancelled open secret form.');
    await page.waitForTimeout(1000);
  }
}

async function deleteBadSecrets(page) {
  await page.goto(SETTINGS_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(3000);
  await dismissSecretForm(page);

  const rows = page.locator('table tbody tr, [role="row"]');
  const count = await rows.count();
  let removed = 0;

  for (let i = 0; i < count; i += 1) {
    const row = rows.nth(i);
    const t = await row.innerText().catch(() => '');
    if (!t) continue;
    const bad =
      /=https?:\/\//i.test(t) ||
      /sk-or-v1/i.test(t) ||
      (/OPENROUTER_API_KEY/i.test(t) && t.length > 40 && !/Runtime Secret/i.test(t.slice(0, 30)));
    if (!bad) continue;

    const menu = row.getByRole('button').last();
    if (await menu.isVisible().catch(() => false)) {
      await menu.click().catch(() => {});
      await page.waitForTimeout(400);
      const del = page.getByRole('menuitem', { name: /delete|remove/i }).or(page.getByText(/delete/i));
      if (await del.first().isVisible().catch(() => false)) {
        await del.first().click().catch(() => {});
        await page.waitForTimeout(400);
        await clickFirst(page, [
          page.getByRole('button', { name: /^delete$/i }),
          page.getByRole('button', { name: /confirm/i }),
        ]);
        removed += 1;
        log(`Removed bad secret row: ${t.slice(0, 50)}…`);
        await page.waitForTimeout(1500);
      }
    }
  }

  if (removed) await snap(page, 'secrets-cleaned');
  return removed;
}

async function fixDefaults(page) {
  await page.goto(SETTINGS_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(3000);
  await dismissSecretForm(page);

  const labels = await page.locator('label, p, span, div').all();
  for (const node of labels) {
    const t = (await node.innerText().catch(() => '')).trim();
    if (!/^base branch$/i.test(t)) continue;
    const input = node.locator('xpath=following::input[1]').or(page.locator('input').nth(0));
    const field = page.locator('input:visible').filter({ has: page.locator('xpath=..') });
    const allInputs = page.locator('input:visible');
    for (let i = 0; i < (await allInputs.count()); i += 1) {
      const el = allInputs.nth(i);
      const val = await el.inputValue().catch(() => '');
      if (/OPENROUTER|sk-or|slack_webhook=https/i.test(val)) {
        await el.fill(BRANCH);
        log(`Base branch corrected (${val.slice(0, 20)} → ${BRANCH}).`);
        await clickFirst(page, [page.getByRole('button', { name: /^save$/i })]);
        await page.waitForTimeout(2000);
        return true;
      }
      if (val && val !== BRANCH && /branch/i.test(t)) {
        await el.fill(BRANCH);
        log(`Base branch set to ${BRANCH}.`);
        await clickFirst(page, [page.getByRole('button', { name: /^save$/i })]);
        await page.waitForTimeout(2000);
        return true;
      }
    }
  }

  const body = await bodyText(page);
  if (/base branch/i.test(body) && /OPENROUTER|sk-or-v1/i.test(body)) {
    const inp = page.locator('input:visible').first();
    await inp.fill(BRANCH);
    await clickFirst(page, [page.getByRole('button', { name: /^save$/i })]);
    log('Base branch fixed via first input.');
    return true;
  }

  return false;
}

async function openRepoEnvironment(page) {
  await page.goto(ENV_DETAIL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(3000);
  await clickFirst(page, [
    page.getByText(REPO_SLUG, { exact: false }),
    page.getByText(/HUNDESALON_NIKA/i),
    page.locator(`a:has-text("${REPO_SLUG}")`),
  ]);
  await page.waitForTimeout(3000);
}

async function waitForRunFinished(page) {
  await openRepoEnvironment(page);
  await clickFirst(page, [page.getByRole('tab', { name: /^runs$/i }), page.getByText(/^Runs$/i)]);
  await page.waitForTimeout(2000);

  const deadline = Date.now() + RUN_WAIT_MS;
  while (Date.now() < deadline) {
    const body = await bodyText(page);
    if (/Finished/i.test(body) && !/Running/i.test(body)) {
      log('Latest run: Finished.');
      await snap(page, 'run-finished');
      return true;
    }
    if (/Failed|Error/i.test(body) && /Running/i.test(body) === false) {
      log('Run may have failed — check Runs tab.');
      await snap(page, 'run-failed');
      return false;
    }
    log('Still Running…');
    await page.waitForTimeout(15000);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(2000);
    await clickFirst(page, [page.getByRole('tab', { name: /^runs$/i })]);
  }

  log('Run wait timeout — environment may still be usable.');
  return false;
}

async function verifyDashboard(page) {
  await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(3000);
  await snap(page, 'dashboard');
  const body = await bodyText(page);
  const cloudPending = /set up your cloud environment/i.test(body);
  const fourOfFour = /4\/4|4 of 4/i.test(body);
  if (fourOfFour || (!cloudPending && /getting started/i.test(body))) {
    log('Dashboard onboarding complete (4/4 or cloud item done).');
    return true;
  }
  if (cloudPending) {
    log('Dashboard still shows cloud setup — run may need more time or manual Set up click.');
  }
  return !cloudPending;
}

loadDevVars();

const { page, close } = await openSession();

try {
  await dismissSecretForm(page);
  await deleteBadSecrets(page);
  await fixDefaults(page);
  await waitForRunFinished(page);
  await deleteBadSecrets(page);
  await fixDefaults(page);
  const ok = await verifyDashboard(page);
  log(ok ? 'Cloud setup finished.' : 'Partial finish — see screenshots in logs/');
  process.exit(ok ? 0 : 2);
} catch (e) {
  log(`Error: ${e.message}`);
  await snap(page, 'error').catch(() => {});
  process.exit(1);
} finally {
  await close();
}
