import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { REPO_ROOT } from './lib/cloudflare-auth.mjs';

const CDP = process.env.CURSOR_CDP_PORT || '9227';
const profile = path.join(process.env.TEMP || '.', 'hundesalon-nika-cursor-playwright');

async function waitCdp() {
  for (let i = 0; i < 30; i += 1) {
    try {
      if ((await fetch(`http://127.0.0.1:${CDP}/json/version`)).ok) return;
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  if (!(await waitCdpOnce())) {
    const edge = [
      path.join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
      path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
    ].find(existsSync);
    spawn(
      edge,
      [`--remote-debugging-port=${CDP}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'https://cursor.com/dashboard/cloud-agents'],
      { detached: true, stdio: 'ignore' }
    ).unref();
    for (let i = 0; i < 45; i += 1) {
      if (await waitCdpOnce()) return;
      await new Promise(r => setTimeout(r, 1200));
    }
    throw new Error('CDP timeout');
  }
}

async function waitCdpOnce() {
  try {
    return (await fetch(`http://127.0.0.1:${CDP}/json/version`)).ok;
  } catch {
    return false;
  }
}

await waitCdp();
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP}`);
const page = browser.contexts()[0].pages()[0] || (await browser.contexts()[0].newPage());
page.on('dialog', async d => {
  await d.accept().catch(() => {});
});

await page.goto('https://cursor.com/dashboard/cloud-agents', { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForTimeout(6000);

if (!/SLACK_WEBHOOK_URL=https/i.test(await page.locator('body').innerText())) {
  console.log('OK: secrets clean');
  await browser.close().catch(() => {});
  process.exit(0);
}

const nameCell = page.getByText(/SLACK_WEBHOOK_URL=https:\/\/hooks\.slack/i).first();
await nameCell.scrollIntoViewIfNeeded().catch(() => {});
const row = nameCell.locator('xpath=ancestor::*[.//button[@aria-label="Delete"]][1]');
const del = row.locator('button[aria-label="Delete"]').first();

await del.click({ force: true, timeout: 15000 });
await page.waitForTimeout(1500);

const confirm = page.getByRole('button', { name: /^delete$/i });
if (await confirm.count()) {
  await confirm.last().click({ force: true });
}

const confirmInput = page.locator('input:visible').last();
if (await confirmInput.isVisible().catch(() => false)) {
  const v = await confirmInput.inputValue().catch(() => '');
  if (!v) await confirmInput.fill('SLACK_WEBHOOK_URL=https://hooks.slack.com/services/');
  await page.getByRole('button', { name: /^delete$/i }).last().click({ force: true }).catch(() => {});
}

await page.waitForTimeout(4000);
const ok = !/SLACK_WEBHOOK_URL=https/i.test(await page.locator('body').innerText());
const n = (await page.locator('body').innerText()).match(/My Secrets \((\d+)\)/)?.[1];
console.log(ok ? `OK: My Secrets (${n || '3'})` : 'WARN: delete manually — last row with URL in name');
await page.screenshot({ path: path.join(REPO_ROOT, 'logs', 'cursor-slack-final.png'), fullPage: true });
await browser.close().catch(() => {});
process.exit(ok ? 0 : 2);
