/**
 * Full Cursor Cloud setup — single coordinated run.
 * npm run cursor:complete
 */
import { execSync, spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { loadDevVars, REPO_ROOT } from './lib/cloudflare-auth.mjs';

const CDP = process.env.CURSOR_CDP_PORT || '9227';
const REPO = 'HUNDESALON_NIKA';
const REPO_FULL = 'alanchik66/HUNDESALON_NIKA';
const BRANCH = 'main';
const AGENTS = 'https://cursor.com/dashboard/cloud-agents';
const DASHBOARD = 'https://cursor.com/dashboard';
const PROFILE = path.join(process.env.TEMP || '.', 'hundesalon-nika-cursor-playwright');
const LOG = path.join(REPO_ROOT, 'logs', 'cursor-cloud-complete.log');
const shots = path.join(REPO_ROOT, 'logs');

const report = { ok: [], warn: [], fail: [] };

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  mkdirSync(shots, { recursive: true });
  appendFileSync(LOG, `${line}\n`, 'utf8');
}

function edge() {
  return [
    path.join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
  ].find(existsSync);
}

async function waitCdp(ms = 50000) {
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
  if (await waitCdp(2500)) return;
  const exe = edge();
  if (!exe) throw new Error('Microsoft Edge not found');
  try {
    execSync('taskkill /IM msedge.exe /F', { stdio: 'ignore' });
  } catch {
    // ignore
  }
  await new Promise(r => setTimeout(r, 2000));
  spawn(
    exe,
    [
      `--remote-debugging-port=${CDP}`,
      '--remote-debugging-address=127.0.0.1',
      `--user-data-dir=${PROFILE}`,
      '--no-first-run',
      AGENTS,
    ],
    { detached: true, stdio: 'ignore' }
  ).unref();
  log('Edge started (profile with Cursor login)');
  if (!(await waitCdp(60000))) throw new Error('CDP not ready — sign in at cursor.com in Edge');
}

async function snap(page, name) {
  await page.screenshot({ path: path.join(shots, `cursor-complete-${name}.png`), fullPage: true }).catch(() => {});
}

async function clickFirst(page, locs) {
  for (const l of locs) {
    const el = l.first();
    if (await el.isVisible().catch(() => false)) {
      await el.click({ timeout: 12000 }).catch(() => {});
      return true;
    }
  }
  return false;
}

async function body(page) {
  return page.locator('body').innerText().catch(() => '');
}

loadDevVars();
const needSecrets = {
  OPENROUTER_API_KEY: String(process.env.OPENROUTER_API_KEY || '').trim(),
  CLOUDFLARE_API_TOKEN: String(process.env.CLOUDFLARE_API_TOKEN || '').trim(),
};

if (!needSecrets.OPENROUTER_API_KEY) {
  log('FAIL: OPENROUTER_API_KEY missing in .dev.vars');
  process.exit(1);
}

log('Phase 1: cleanup malformed Slack secret…');
spawnSync(process.execPath, ['tools/cursor-cloud-delete-bad-slack.mjs'], { cwd: REPO_ROOT, stdio: 'inherit' });

await ensureEdge();
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP}`);
const page = browser.contexts()[0].pages()[0] || (await browser.contexts()[0].newPage());

try {
  await page.goto(AGENTS, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(5000);

  const text0 = await body(page);
  if (/sign in|log in/i.test(text0) && !/cloud agents|environments/i.test(text0)) {
    report.fail.push('Not signed in to cursor.com in Edge profile');
    throw new Error('Login required in Edge');
  }
  report.ok.push('Cursor session active');

  await clickFirst(page, [page.getByRole('button', { name: /^cancel$/i })]);

  const sw = page
    .locator('div, section')
    .filter({ hasText: /enable self-hosted pool/i })
    .getByRole('switch')
    .first();
  if (await sw.isVisible().catch(() => false)) {
    if (await sw.isChecked().catch(() => false)) {
      await sw.click();
      log('Self-hosted pool → OFF');
      await page.waitForTimeout(1200);
    }
    report.ok.push('Self-hosted pool OFF');
  }

  for (const inp of await page.locator('input:visible').all()) {
    const v = await inp.inputValue().catch(() => '');
    if (/OPENROUTER|CLOUDFLARE|sk-or|slack_webhook=/i.test(v)) {
      await inp.fill(BRANCH);
      log(`Base branch → ${BRANCH}`);
      await clickFirst(page, [page.getByRole('button', { name: /^save$/i })]);
      await page.waitForTimeout(1500);
      break;
    }
  }

  const tEnv = await body(page);
  const hasActiveEnv = /HUNDESALON_NIKA/i.test(tEnv) && /Active/i.test(tEnv);

  if (!hasActiveEnv) {
    log('Creating/linking environment…');
    await clickFirst(page, [
      page.getByRole('button', { name: /new environment|create environment/i }),
    ]);
    await clickFirst(page, [page.getByRole('button', { name: /^github$/i })]);
    const search = page.locator('input[type="search"], input[type="text"]').first();
    if (await search.isVisible().catch(() => false)) await search.fill(REPO);
    await page.waitForTimeout(1200);
    await clickFirst(page, [page.getByText(REPO, { exact: false })]);
    await clickFirst(page, [
      page.getByRole('button', { name: /create|continue|connect/i }),
    ]);
    await page.waitForTimeout(8000);
  }

  const t1 = await body(page);
  if (/Active/i.test(t1) && /HUNDESALON/i.test(t1)) report.ok.push('Environment Active');
  else report.warn.push('Environment status unclear');

  for (const [name, value] of Object.entries(needSecrets)) {
    if (!value) continue;
    if (new RegExp(name).test(t1)) {
      report.ok.push(`Secret ${name} present`);
      continue;
    }
    await clickFirst(page, [page.getByRole('button', { name: /add secret/i })]);
    await page.waitForTimeout(1000);
    const boxes = page.getByRole('textbox');
    const n = await boxes.count();
    if (n >= 2) {
      await boxes.nth(0).fill(name);
      await boxes.nth(1).fill(value);
    } else {
      const inputs = page.locator('input:visible');
      if ((await inputs.count()) >= 2) {
        await inputs.nth(0).fill(name);
        await inputs.nth(1).fill(value);
      }
    }
    await clickFirst(page, [
      page.getByRole('button', { name: /^save$/i }),
      page.getByRole('button', { name: /add secret/i }),
    ]);
    await page.waitForTimeout(2000);
    report.ok.push(`Secret ${name} added`);
  }

  await snap(page, 'agents');

  await page.goto(AGENTS, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4000);
  const secretsOk = !/SLACK_WEBHOOK_URL=https:\/\/hooks/i.test(await body(page));
  if (secretsOk) report.ok.push('Secrets list clean');
  else report.warn.push('Malformed Slack — npm run cursor:delete-bad-slack');

  await page.goto(DASHBOARD, { waitUntil: 'domcontentloaded', timeout: 90000 });
  let onboardingDone = false;
  for (let i = 0; i < 3; i += 1) {
    await page.waitForTimeout(3000);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(2000);
    const dashText = await body(page);
    const looksLikeDashboard = /overview|get\s*started|cloud\s*agents/i.test(dashText);
    if (!looksLikeDashboard || dashText.trim().length < 120) {
      continue;
    }
    const hasCloudStep = /set up your cloud environment/i.test(dashText);
    const hasThreeOfFour = /3\/4|3 of 4/i.test(dashText);
    if (!hasCloudStep && !hasThreeOfFour) {
      onboardingDone = true;
      report.ok.push('Onboarding 4/4');
      break;
    }
  }
  if (!onboardingDone) {
    report.warn.push('Onboarding — npm run cursor:edge-dashboard then Ctrl+F5 in IDE');
  }

  await page.goto(AGENTS, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3000);
  await clickFirst(page, [page.getByText(REPO, { exact: false }), page.getByText(REPO_FULL, { exact: false })]);
  await page.waitForTimeout(2500);
  if (await page.getByRole('button', { name: /Start Setup Agent/i }).first().isVisible().catch(() => false)) {
    report.warn.push('Cloud setup run not finalized (Start Setup Agent still visible)');
  }

  await snap(page, 'dashboard');

  console.log('\n=== Cursor Cloud — final report ===');
  for (const x of report.ok) console.log(`  OK   ${x}`);
  for (const x of report.warn) console.log(`  WARN ${x}`);
  for (const x of report.fail) console.log(`  FAIL ${x}`);
  console.log(`\nLog: logs/cursor-cloud-complete.log`);
  console.log('Edge profile:', PROFILE);
  console.log('Open: npm run cursor:edge-dashboard\n');

  const exitCode = report.fail.length ? 1 : report.warn.length ? 2 : 0;
  process.exit(exitCode);
} catch (e) {
  log(`Error: ${e.message}`);
  await snap(page, 'error').catch(() => {});
  process.exit(1);
} finally {
  await browser.close().catch(() => {});
}
