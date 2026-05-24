/**
 * Automate Cursor Cloud Agents environment + secrets via Playwright.
 * npm run cursor:setup-cloud:auto
 * npm run cursor:edge-dashboard  (then auto with CURSOR_CDP_PORT=9227)
 */
import { execSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { loadDevVars, REPO_ROOT } from './lib/cloudflare-auth.mjs';

const REPO_SLUG = 'HUNDESALON_NIKA';
const REPO_FULL = 'alanchik66/HUNDESALON_NIKA';
const BRANCH = 'main';
const ENV_URL = 'https://cursor.com/dashboard/cloud-agents#environments';
const SECRETS_URL = 'https://cursor.com/dashboard/cloud-agents';
const DASHBOARD_URL = 'https://cursor.com/dashboard';
const CDP_PORT = process.env.CURSOR_CDP_PORT || '9227';
const LOGIN_WAIT_MS = Number(process.env.CURSOR_LOGIN_WAIT_MS || 45000);
const BUILD_WAIT_MS = Number(process.env.CURSOR_BUILD_WAIT_MS || 480000);
const userDataDir = path.join(process.env.TEMP || '.', 'hundesalon-nika-cursor-playwright');
const shotDir = path.join(REPO_ROOT, 'logs');
const logFile = path.join(shotDir, 'cursor-cloud-setup.log');
const phase = process.argv.includes('--secrets-only') ? 'secrets' : process.argv.includes('--env-only') ? 'env' : 'all';

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
  mkdirSync(shotDir, { recursive: true });
  const file = path.join(shotDir, `cursor-cloud-${name}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  log(`Screenshot: logs/cursor-cloud-${name}.png`);
}

async function bodyText(page) {
  return page.locator('body').innerText().catch(() => '');
}

async function needsLogin(page) {
  const t = await bodyText(page);
  return /sign in|log in|continue with google|continue with github|create account/i.test(t) && !/cloud agents|environments|my secrets|environment ready/i.test(t);
}

async function waitForLogin(page) {
  if (!(await needsLogin(page))) return true;
  log(`Waiting for cursor.com login (${LOGIN_WAIT_MS / 1000}s)…`);
  const deadline = Date.now() + LOGIN_WAIT_MS;
  while (Date.now() < deadline) {
    await page.waitForTimeout(2500);
    if (!(await needsLogin(page))) return true;
  }
  return !(await needsLogin(page));
}

async function clickFirst(page, locators) {
  for (const loc of locators) {
    const el = typeof loc === 'string' ? page.locator(loc).first() : loc.first();
    if (await el.isVisible().catch(() => false)) {
      await el.click({ timeout: 12000 }).catch(() => {});
      return true;
    }
  }
  return false;
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
    await new Promise(r => setTimeout(r, 1500));
  }
  return false;
}

async function spawnEdgeCdp() {
  const edgeExe = edgePath();
  if (!edgeExe) throw new Error('Edge not found');
  const { spawn } = await import('node:child_process');
  spawn(
    edgeExe,
    [
      `--remote-debugging-port=${CDP_PORT}`,
      '--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      ENV_URL,
    ],
    { detached: true, stdio: 'ignore' }
  ).unref();
  log(`Started Edge CDP on :${CDP_PORT}`);
}

async function connectCdp() {
  if (!(await waitForCdp(5000))) return null;
  try {
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
    const context = browser.contexts()[0] || (await browser.newContext());
    const page = context.pages().find(p => /cursor\.com/i.test(p.url())) || context.pages()[0] || (await context.newPage());
    log(`Connected via CDP :${CDP_PORT}`);
    return { browser, context, page, close: async () => browser.close().catch(() => {}) };
  } catch (e) {
    log(`CDP connect failed: ${e.message}`);
    return null;
  }
}

async function openSession() {
  let session = await connectCdp();
  if (session) return session;

  if (process.env.CURSOR_SKIP_EDGE_KILL !== '1') {
    releaseEdgeLock();
    await new Promise(r => setTimeout(r, 2500));
  }

  await spawnEdgeCdp();
  if (!(await waitForCdp(60000))) {
    throw new Error(`CDP :${CDP_PORT} not available — close Edge and rerun npm run cursor:setup-cloud:auto`);
  }

  session = await connectCdp();
  if (session) return session;

  throw new Error('Could not attach to Edge CDP');
}

function releaseEdgeLock() {
  if (process.env.CURSOR_SKIP_EDGE_KILL === '1') return;
  try {
    execSync('taskkill /IM msedge.exe /F', { stdio: 'ignore' });
    log('Closed Edge to unlock profile');
  } catch {
    // not running
  }
}

async function ensureEnvironment(page) {
  await page.goto(ENV_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(5000);
  await snap(page, '01-environments');

  let body = await bodyText(page);
  if (/environment ready|ready to use/i.test(body) && /HUNDESALON|hundesalon/i.test(body)) {
    log('Environment already ready.');
    return true;
  }

  await clickFirst(page, [
    page.locator('a[href="/dashboard/cloud-agents"]'),
    page.locator('a[href*="cloud-agents"]').filter({ hasText: /set up/i }),
    page.getByRole('link', { name: /^set up$/i }),
    page.getByRole('button', { name: /^set up$/i }),
    page.getByRole('button', { name: /create environment/i }),
    page.getByRole('link', { name: /create environment/i }),
    page.getByRole('button', { name: /new environment/i }),
    page.getByRole('button', { name: /connect repository/i }),
  ]);
  await page.waitForTimeout(3000);
  await snap(page, '02-after-setup-click');

  await clickFirst(page, [
    page.getByRole('button', { name: /^github$/i }),
    page.getByText(/^GitHub$/i),
  ]);
  await page.waitForTimeout(2000);

  const search = page.locator('input[type="search"], input[type="text"]').first();
  if (await search.isVisible().catch(() => false)) {
    await search.fill(REPO_SLUG);
    await page.waitForTimeout(1200);
  }

  await clickFirst(page, [
    page.getByText(REPO_SLUG, { exact: false }),
    page.getByText(REPO_FULL, { exact: false }),
  ]);
  await page.waitForTimeout(2000);
  await snap(page, '03-repo-selected');

  await clickFirst(page, [
    page.getByRole('button', { name: /create environment/i }),
    page.getByRole('button', { name: /^create$/i }),
    page.getByRole('button', { name: /continue/i }),
    page.getByRole('button', { name: /connect/i }),
    page.getByRole('button', { name: /confirm/i }),
  ]);

  log(`Build wait up to ${BUILD_WAIT_MS / 1000}s…`);
  const deadline = Date.now() + BUILD_WAIT_MS;
  while (Date.now() < deadline) {
    await page.waitForTimeout(10000);
    body = await bodyText(page);
    if (/environment ready|ready to use|installation complete/i.test(body)) {
      log('Environment ready.');
      await clickFirst(page, [
        page.getByRole('button', { name: /save snapshot|create snapshot/i }),
        page.getByRole('button', { name: /^done$/i }),
        page.getByRole('button', { name: /finish/i }),
      ]);
      await snap(page, '04-environment-ready');
      return true;
    }
  }

  await snap(page, '04-build-timeout');
  log('Build still running or UI changed — continue with secrets manually if needed.');
  return false;
}

async function upsertSecret(page, name, value) {
  if (!value) return;

  await page.goto(SECRETS_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(4000);

  await clickFirst(page, [
    page.getByRole('tab', { name: /secrets/i }),
    page.getByRole('link', { name: /secrets/i }),
  ]);
  await page.waitForTimeout(1500);

  const body = await bodyText(page);
  if (new RegExp(name, 'i').test(body)) {
    const rows = page.locator('tr, li, [class*="secret"]');
    for (const row of await rows.all()) {
      const t = await row.innerText().catch(() => '');
      if (t.includes(name) && !/add secret|new secret/i.test(t)) {
        log(`Secret ${name} already present.`);
        return;
      }
    }
  }

  const nameBox = page.getByRole('textbox', { name: /^name$/i }).or(page.locator('input').nth(0));
  const valueBox = page
    .getByRole('textbox', { name: /^value$/i })
    .or(page.locator('input[type="password"]'))
    .or(page.locator('input').nth(1));

  const alreadyOpen = await nameBox.isVisible().catch(() => false);
  if (!alreadyOpen) {
    await clickFirst(page, [
      page.getByRole('button', { name: /add secret/i }),
      page.getByRole('link', { name: /add secret/i }),
      page.getByRole('button', { name: /new secret/i }),
    ]);
    await page.waitForTimeout(1500);
  }

  if (await nameBox.isVisible().catch(() => false)) await nameBox.fill(name);
  if (await valueBox.isVisible().catch(() => false)) await valueBox.fill(value);

  await clickFirst(page, [
    page.getByRole('button', { name: /^save$/i }),
    page.getByRole('button', { name: /add secret/i }),
    page.getByRole('button', { name: /create/i }),
    page.getByRole('button', { name: /confirm/i }),
  ]);
  await page.waitForTimeout(2500);
  log(`Secret ${name} submitted.`);
  await snap(page, `secret-${name}`);
}

loadDevVars();
const openRouter = String(process.env.OPENROUTER_API_KEY || '').trim();
const cfToken = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();

if (!openRouter) {
  console.error('OPENROUTER_API_KEY missing in .dev.vars');
  process.exit(1);
}

log(`Phase: ${phase}`);

const { page, close } = await openSession();

try {
  await page.bringToFront().catch(() => {});
  if (!(await waitForLogin(page))) {
    await snap(page, 'login-required');
    log('Not signed in — open npm run cursor:edge-dashboard, sign in, rerun.');
    process.exit(1);
  }

  if (phase === 'all' || phase === 'env') {
    await ensureEnvironment(page);
  }

  if (phase === 'all' || phase === 'secrets') {
    await upsertSecret(page, 'OPENROUTER_API_KEY', openRouter);
    if (cfToken) await upsertSecret(page, 'CLOUDFLARE_API_TOKEN', cfToken);
  }

  await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3000);
  await snap(page, '05-dashboard');

  const dash = await bodyText(page);
  if (/set up your cloud environment/i.test(dash)) {
    log('Onboarding: cloud setup line still visible — finish Environment in Cloud Agents.');
  } else {
    log('Dashboard onboarding looks complete.');
  }

  log('Done → https://cursor.com/dashboard/cloud-agents');
} catch (err) {
  log(`Error: ${err.message}`);
  await snap(page, 'error').catch(() => {});
  process.exit(1);
} finally {
  await close();
}
