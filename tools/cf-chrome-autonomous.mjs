/**
 * Autonomous NIKA token fix via Google Chrome.
 * npm run cf:chrome-autonomous
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  auditToken,
  EXISTING_PURGE_TOKEN_ID,
  isFullToken,
  loadAllCredentials,
  printAudit,
  resolveCfAuth,
  saveApiToken,
  verifyBearerToken,
} from './lib/cf-api-token.mjs';
import { resolveZoneId } from './lib/cloudflare-auth.mjs';

const LIST_URL = 'https://dash.cloudflare.com/profile/api-tokens';
const EDIT_URL = `${LIST_URL}/${EXISTING_PURGE_TOKEN_ID}/edit`;
const chromeExe = path.join(process.env.ProgramFiles || '', 'Google/Chrome/Application/chrome.exe');
const chromeUserData = path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/User Data');
const tempProfile = path.join(process.env.TEMP || '.', 'hundesalon-nika-cf-chrome-playwright');

loadAllCredentials();
const auth = resolveCfAuth();
const zoneId = await resolveZoneId(auth);
let audit = await auditToken(auth, zoneId);
if (isFullToken(audit)) {
  console.log('Token already complete:\n');
  printAudit(audit);
  process.exit(0);
}

async function runPlaywright(profileDir, label) {
  console.log(`Chrome Playwright: ${label}`);
  const launchOpts = {
    headless: false,
    executablePath: existsSync(chromeExe) ? chromeExe : undefined,
    args: ['--disable-blink-features=AutomationControlled', '--profile-directory=Default'],
    viewport: { width: 1440, height: 900 },
  };

  const context = await chromium.launchPersistentContext(profileDir, launchOpts);
  const page = context.pages()[0] || (await context.newPage());

  try {
    await page.goto(LIST_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(8000);

    const allow = page.getByRole('button', { name: /alle erlauben|allow all/i });
    if (await allow.isVisible().catch(() => false)) await allow.click();

    let body = await page.locator('body').innerText();
    if (/log in|anmelden|sign in/i.test(body) && !/NIKA|API-Token/i.test(body)) {
      console.log('Войдите в Cloudflare (90 с)…');
      await page.waitForTimeout(90000);
      await page.goto(LIST_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForTimeout(8000);
    }

    for (let i = 0; i < 45; i++) {
      body = await page.locator('body').innerText();
      if (!/verifizierung|prüfcode senden/i.test(body)) break;
      if (i === 0) {
        console.log('Ожидание: введите код из почты Cloudflare (до 4.5 мин)…');
      }
      await page.waitForTimeout(6000);
    }

    const row = page.locator('tr').filter({ hasText: /NIKA-Purge-Cache/i }).first();
    if (await row.count()) {
      const menu = row.getByRole('button', { name: /aktionen|actions/i });
      if (await menu.isVisible().catch(() => false)) {
        await menu.click();
        await page.waitForTimeout(700);
        await page.getByRole('menuitem', { name: /^bearbeiten$|^edit$/i }).click({ timeout: 10000 });
        await page.waitForTimeout(12000);
      }
    }
    if (!page.url().includes('/edit')) {
      await page.goto(EDIT_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await page.waitForTimeout(12000);
    }

    body = await page.locator('body').innerText();
    if (/prüfcode senden|verifizierung/i.test(body)) {
      console.error('Всё ещё нужен код из почты — введите в окне Chrome.');
      return false;
    }

    if (!/zonen.?regeln|zone rules/i.test(body)) {
      const add = page.getByText(/weitere hinzufügen|add more/i).first();
      if (await add.isVisible().catch(() => false)) {
        await add.click();
        await page.waitForTimeout(1200);
      }
      const n = await page.locator('select').count();
      if (n >= 3) {
        await page.locator('select').nth(n - 3).selectOption({ label: 'Zone' }).catch(() => {});
        await page.locator('select').nth(n - 2).selectOption({ label: /Zonen-Regeln|Zone Rules/i }).catch(() => {});
        await page.locator('select').nth(n - 1).selectOption({ label: /Bearbeiten|Edit/i }).catch(() => {});
      }
    }

    await page.getByRole('button', { name: /weiter zur zusammenfassung|continue to summary/i }).click({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: /token aktualisieren|update token/i }).click({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.getByRole('button', { name: /bestätigen|confirm/i }).click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(4000);

    body = await page.locator('body').innerText();
    const m = body.match(/cfk_[A-Za-z0-9_-]{20,}/);
    if (m) {
      try {
        const { audit: a } = await verifyBearerToken(m[0]);
        saveApiToken(m[0]);
        console.log('Новый токен сохранён.');
        printAudit(a);
        return true;
      } catch (e) {
        console.log('Токен на экране, проверка:', e.message);
      }
    }
    return true;
  } finally {
    await context.close();
  }
}

process.env.CF_CDP_BROWSER = 'chrome';
process.env.CF_CDP_PORT = '9226';

try {
  const { ensureCfCdp, connectCfTab } = await import('./lib/cf-cdp.mjs');
  await ensureCfCdp(LIST_URL);
  await new Promise(r => setTimeout(r, 8000));
  const session = await connectCfTab();
  const r = await session.eval(`({
    url: location.href,
    nika: /NIKA-Purge-Cache/i.test(document.body?.innerText||''),
    verify: /prüfcode|verifizierung/i.test(document.body?.innerText||''),
    selects: document.querySelectorAll('select').length
  })`);
  console.log('CDP tab:', JSON.stringify(r));
  session.close();
} catch {
  console.log('CDP 9226 недоступен — Playwright…');
}

try {
  await runPlaywright(chromeUserData, 'ваш профиль Chrome');
} catch (e) {
  console.log('Профиль занят:', e.message?.slice(0, 100));
  console.log('Закройте все окна Chrome и повторите, либо используем отдельный профиль…');
  try {
    await runPlaywright(tempProfile, 'временный профиль');
  } catch (e2) {
    console.error(e2.message);
    process.exit(1);
  }
}

audit = await auditToken(auth, zoneId);
console.log('\n=== Итог API ===\n');
printAudit(audit);
process.exit(isFullToken(audit) ? 0 : 1);
