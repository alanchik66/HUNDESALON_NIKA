/**
 * Fix NIKA-Purge-Cache via Google Chrome (CDP 9226) — dropdown UI + save.
 * npm run cf:chrome-dashboard  → login → npm run cf:chrome-fix-token
 */
process.env.CF_CDP_BROWSER = 'chrome';
if (!process.env.CF_CDP_PORT) process.env.CF_CDP_PORT = '9226';

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
} from './lib/cf-api-token.mjs';
import { resolveZoneId } from './lib/cloudflare-auth.mjs';

const EDIT_URL = `https://dash.cloudflare.com/profile/api-tokens/${EXISTING_PURGE_TOKEN_ID}/edit`;

const ADD_ZONE_RULES_DROPDOWN = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const norm = s => (s || '').replace(/\\s+/g, ' ').trim();
  const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const inCookie = el => !!el?.closest('#onetrust-consent-sdk, #onetrust-banner-sdk');
  const zr = /zonen.?regeln|zone rules|rulesets?|regelsätze/i;
  const body = norm(document.body?.innerText || '');

  if (zr.test(body) && /bearbeiten|edit/i.test(body)) {
    const rows = [...document.querySelectorAll('tr, [class*="permission"], fieldset, section')]
      .map(r => norm(r.innerText))
      .filter(t => zr.test(t) && /bearbeiten|edit|editieren/i.test(t));
    if (rows.length) return { ok: true, already: true, rows: rows.slice(0, 3) };
  }

  for (const b of document.querySelectorAll('button, a')) {
    if (!visible(b) || inCookie(b)) continue;
    if (/alle erlauben|allow all/i.test(norm(b.innerText))) { b.click(); await sleep(600); break; }
  }

  const pickOption = async (root, pattern) => {
    const re = new RegExp(pattern, 'i');
    for (const el of root.querySelectorAll('[role="option"], [role="menuitem"], li, button, div, span')) {
      if (!visible(el) || inCookie(el)) continue;
      const t = norm(el.innerText);
      if (re.test(t) && t.length < 80) { el.click(); return t; }
    }
    return null;
  };

  const setSelect = async (selectEl, labelRe) => {
    if (!selectEl) return null;
    if (selectEl.tagName === 'SELECT') {
      const opts = [...selectEl.options];
      const hit = opts.find(o => labelRe.test(norm(o.text)));
      if (hit) { selectEl.value = hit.value; selectEl.dispatchEvent(new Event('change', { bubbles: true })); return hit.text; }
      return null;
    }
    selectEl.click();
    await sleep(500);
    return pickOption(document, labelRe.source || labelRe);
  };

  for (const el of document.querySelectorAll('button, a, span')) {
    if (!visible(el) || inCookie(el)) continue;
    if (/weitere hinzufügen|add more/i.test(norm(el.innerText))) { el.click(); await sleep(1200); break; }
  }

  const permRoot =
    document.querySelector('[data-testid="api-token-permissions"]') ||
    [...document.querySelectorAll('section, fieldset, div')].find(s => /berechtigung|permission/i.test(norm(s.innerText || ''))) ||
    document.body;

  const selects = [...permRoot.querySelectorAll('select')].filter(visible);
  let rowSelects = selects;
  if (rowSelects.length >= 3) rowSelects = rowSelects.slice(-3);

  const hits = [];
  if (rowSelects.length >= 3) {
    hits.push(await setSelect(rowSelects[0], /^zone$/));
    await sleep(400);
    hits.push(await setSelect(rowSelects[1], /zonen.?regeln|zone rules|rulesets?/));
    await sleep(400);
    hits.push(await setSelect(rowSelects[2], /bearbeiten|edit/));
  } else {
    const combos = [...permRoot.querySelectorAll('button[aria-haspopup], [role="combobox"], button')]
      .filter(b => visible(b) && !inCookie(b));
    const row = combos.slice(-3);
    if (row[0]) { row[0].click(); await sleep(400); hits.push(await pickOption(document, '^zone$')); }
    if (row[1]) { row[1].click(); await sleep(400); hits.push(await pickOption(document, 'zonen.?regeln|zone rules')); }
    if (row[2]) { row[2].click(); await sleep(400); hits.push(await pickOption(document, 'bearbeiten|edit')); }
  }

  await sleep(800);
  const clickBtn = re => {
    for (const b of document.querySelectorAll('button,[role=button]')) {
      if (!visible(b) || inCookie(b) || b.disabled) continue;
      if (re.test(norm(b.innerText))) { b.click(); return norm(b.innerText); }
    }
    return null;
  };

  const cont = clickBtn(/weiter zur zusammenfassung|continue to summary/i);
  await sleep(2500);
  const save = clickBtn(/token aktualisieren|update token/i);
  await sleep(2500);
  const ok = clickBtn(/bestätigen|confirm/i);

  return { ok: true, hits, cont, save, okBtn: ok, url: location.href, selects: selects.length };
})()`;

loadAllCredentials();
const auth = resolveCfAuth();
const zoneId = await resolveZoneId(auth);
let audit = await auditToken(auth, zoneId);
if (isFullToken(audit)) {
  console.log('Token already complete:\n');
  printAudit(audit);
  process.exit(0);
}

const chromeExe = path.join(process.env.ProgramFiles || '', 'Google/Chrome/Application/chrome.exe');
const usePlaywright = process.argv.includes('--playwright');

async function tryCdp(CF_CDP_PORT, connectCfTab, ensureCfCdp, sleep) {
  await ensureCfCdp(EDIT_URL);
  console.log(`Waiting 35s for Cloudflare SPA (Chrome ${CF_CDP_PORT})…`);
  await sleep(35000);

  const session = await connectCfTab();
  try {
    if (!session.url?.includes('/edit')) {
      await session.navigate(EDIT_URL, 15000);
    }

    const login = await session.eval(`({
      url: location.href,
      login: /log in|anmelden|sign in/i.test(document.body?.innerText||'') && !/NIKA|Purge|berechtigung/i.test(document.body?.innerText||''),
      hasNika: /NIKA-Purge-Cache/i.test(document.body?.innerText||''),
    })`);
    console.log('Page:', JSON.stringify(login));

    if (login?.login) {
      console.error('Not signed in. Sign in in Chrome window, then re-run npm run cf:chrome-fix-token');
      return false;
    }

    const result = await session.eval(ADD_ZONE_RULES_DROPDOWN, 90000);
    console.log('Apply:', JSON.stringify(result, null, 2));
    return true;
  } finally {
    session.close();
  }
}

async function tryPlaywright() {
  if (!existsSync(chromeExe)) throw new Error('Chrome not found');
  const userDataDir = path.join(process.env.TEMP || '.', 'hundesalon-nika-cf-chrome-playwright');
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: chromeExe,
    args: ['--disable-blink-features=AutomationControlled'],
    viewport: { width: 1400, height: 900 },
  });
  const page = context.pages()[0] || (await context.newPage());
  await page.goto(EDIT_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(10000);

  const cookie = page.getByRole('button', { name: /allow all|alle erlauben/i });
  if (await cookie.isVisible().catch(() => false)) await cookie.click();

  const body = await page.locator('body').innerText();
  if (/log in|anmelden|sign in/i.test(body) && !/NIKA|Purge|Berechtigung/i.test(body)) {
    console.log('Sign in to Cloudflare in Chrome (90s)…');
    await page.waitForTimeout(90000);
    await page.goto(EDIT_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(8000);
  }

  const hasZr = /zonen.?regeln|zone rules/i.test(await page.locator('body').innerText());
  if (!hasZr) {
    await page.getByText(/weitere hinzufügen|add more/i).first().click({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const selects = page.locator('select');
    const n = await selects.count();
    if (n >= 3) {
      await selects.nth(n - 3).selectOption({ label: 'Zone' }).catch(() => {});
      await selects.nth(n - 2).selectOption({ label: /Zonen-Regeln|Zone Rules/i }).catch(() => {});
      await selects.nth(n - 1).selectOption({ label: /Bearbeiten|Edit/i }).catch(() => {});
    }
  }

  await page.getByRole('button', { name: /weiter zur zusammenfassung|continue to summary/i }).click({ timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /token aktualisieren|update token/i }).click({ timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /bestätigen|confirm/i }).click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await context.close();
  return true;
}

async function main() {
  const { CF_CDP_PORT, connectCfTab, ensureCfCdp, sleep } = await import('./lib/cf-cdp.mjs');

  try {
    if (usePlaywright) {
      await tryPlaywright();
    } else {
      await tryCdp(CF_CDP_PORT, connectCfTab, ensureCfCdp, sleep);
    }
  } catch (e) {
    console.error('CDP failed:', e.message);
    console.log('Retry with Playwright profile…');
    await tryPlaywright();
  }

  audit = await auditToken(auth, zoneId);
  console.log('\nToken audit (API check all permissions):\n');
  printAudit(audit);

  const ok = isFullToken(audit);
  if (!ok) {
    console.log('\nStill missing Zone Rules Edit.');
    console.log('Chrome: npm run cf:chrome-dashboard → login → add Zonen-Regeln → Bearbeiten → save');
    console.log('Then: npm run cf:ensure-api-token');
  }
  process.exit(ok ? 0 : 1);
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
