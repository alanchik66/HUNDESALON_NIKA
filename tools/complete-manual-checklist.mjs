/**
 * Finish remaining manual checklist: Bing Site Scan, Clarity, CSAM verify.
 * npm run ops:finish-manual
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACCOUNT_ID, DOMAIN } from './lib/cloudflare-auth.mjs';
import { CF_CDP_PORT, connectCfTab, ensureCfCdp, sleep } from './lib/cf-cdp.mjs';
import { getJson, openBingWebmasterSession } from './lib/browser-cdp.mjs';
import { SITE_URL, siteQuery } from './lib/bing-wmt.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bingPort = Number(process.env.BING_MAIL_EDGE_PORT || 9224);
const siteQ = siteQuery();
const report = { at: new Date().toISOString(), steps: {} };

async function ensureBingCdp() {
  try {
    await getJson(`http://127.0.0.1:${bingPort}/json/version`);
    return true;
  } catch {
    return false;
  }
}

async function runBingSiteScan() {
  console.log('Bing 1/2 — Site Scan…');
  const s = await openBingWebmasterSession({
    port: bingPort,
    siteQ,
    waitMs: 8000,
    reloadAttempts: 3,
    clickSelectors: 'a, button, [role="button"], input[type="submit"], span[role="button"]',
  });

  try {
    await s.nav('sitescan');
    const opened = await s.eval(`return clickMatch('start new scan|начать новое сканирование');`);
    await sleep(2500);

    const started = await s.eval(`
      const nameInput = Array.from(document.querySelectorAll('input')).find(el =>
        visible(el) && (/scan|name|имя/i.test(el.placeholder || '') || /text|search/i.test(el.type || ''))
      );
      if (nameInput && !nameInput.value) {
        setNativeValue(nameInput, 'HUNDESALON SEO scan ${new Date().toISOString().slice(0, 10)}');
      }
      await sleep(800);
      let submit = clickMatch('^start scan$|^start$|^начать$|^scan$|run scan|запустить');
      if (!submit) submit = clickMatch('start new scan|начать новое сканирование');
      await sleep(6000);
      const body = document.body?.innerText || '';
      const active = /scanning|сканир|in progress|выполняется|queued|очеред|scheduled|заплан|completed|заверш/i.test(body);
      const notStarted = /no scans initiated|сканирование не проводилось|not scanned/i.test(body);
      return {
        opened: ${JSON.stringify(opened)},
        submit,
        active: active && !notStarted,
        notStarted,
        success: active && !notStarted,
        sample: body.slice(0, 700),
      };
    `);

    report.steps.siteScan = started;
    console.log(started.success ? '  ✓ Site Scan started' : '  ⚠ Site Scan needs attention');
    return started.success;
  } finally {
    s.close();
  }
}

async function runBingClarity() {
  console.log('Bing 2/2 — Microsoft Clarity…');
  const s = await openBingWebmasterSession({
    port: bingPort,
    siteQ,
    waitMs: 8000,
    reloadAttempts: 2,
  });

  try {
    await s.nav('clarity');
    const bing = await s.eval(`
      let clicked = clickMatch('get started|начать|sign up|зарегистр|подключ|try clarity|попробовать|enable clarity');
      if (!clicked) {
        for (const a of document.querySelectorAll('a[href]')) {
          if (!visible(a)) continue;
          if (/clarity\\.microsoft/i.test(a.href || '')) { a.click(); clicked = a.href; break; }
        }
      }
      await sleep(4000);
      return {
        clicked,
        onClarityMs: /clarity\\.microsoft/i.test(location.href),
        sample: (document.body?.innerText || '').slice(0, 500),
      };
    `);

    if (!bing.onClarityMs) {
      await s.nav('https://clarity.microsoft.com/projects');
      await sleep(5000);
    }

    const clarity = await s.eval(`
      const site = '${SITE_URL.replace(/\/$/, '')}';
      const body = document.body?.innerText || '';
      const hasProject = /hundesalon/i.test(body) || body.includes(site);
      let clicked = clickMatch('add new project|new project|create project|добавить проект|создать проект');
      if (!clicked) clicked = clickMatch('sign in|войти|get started|начать');
      await sleep(5000);
      const body2 = document.body?.innerText || '';
      const signedIn = !/sign in|войти|log in/i.test(body2) || /projects|dashboard/i.test(location.href);
      return {
        url: location.href,
        hasProject,
        clicked,
        signedIn,
        success: hasProject || (signedIn && /projects|dashboard/i.test(location.href)),
        sample: body2.slice(0, 700),
      };
    `);

    report.steps.clarity = { bing, clarity };
    console.log(clarity.success ? '  ✓ Clarity reachable / project present' : '  ⚠ Clarity optional — sign in at clarity.microsoft.com');
    return clarity.success;
  } finally {
    s.close();
  }
}

async function runCsamSetup() {
  console.log('Cloudflare — CSAM email verify…');
  const csamUrl = `https://dash.cloudflare.com/${ACCOUNT_ID}/${DOMAIN}/caching/configuration/csam`;
  await ensureCfCdp(csamUrl);
  const tab = await connectCfTab();

  try {
    if (!/csam/i.test(tab.url)) {
      await tab.navigate(csamUrl, 14000);
    }

    const state = await tab.eval(`(() => {
      const body = document.body?.innerText || '';
      const inputs = Array.from(document.querySelectorAll('input[type="email"], input')).filter(el => el.offsetParent);
      const emailInput = inputs.find(el => /email|e-mail|почт/i.test(
        (el.placeholder || '') + (el.getAttribute('aria-label') || '') + (el.name || '')
      )) || inputs[0];
      return {
        url: location.href,
        loggedIn: !/log in|sign in|войти/i.test(body) || /dash\\.cloudflare/i.test(location.href),
        hasSubmit: /submit|absenden|отправ/i.test(body),
        hasVerify: /verify|verification|подтверд/i.test(body),
        enabled: /enabled|включен|active/i.test(body),
        emailValue: emailInput?.value || '',
        sample: body.slice(0, 900),
      };
    })()`);

    report.steps.csamBefore = state;

    if (!state.loggedIn) {
      console.log('  ⚠ Cloudflare Dashboard: sign in on port', CF_CDP_PORT, 'then rerun npm run ops:finish-manual');
      return false;
    }

    if (state.enabled) {
      console.log('  ✓ CSAM already enabled');
      report.steps.csam = { success: true, alreadyEnabled: true };
      return true;
    }

    const action = await tab.eval(`(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
      const norm = s => (s || '').replace(/\\s+/g, ' ').trim();
      const txt = el => norm(el.innerText || el.value || el.getAttribute('aria-label') || '');
      const setNativeValue = (el, value) => {
        const proto = Object.getPrototypeOf(el);
        const d = Object.getOwnPropertyDescriptor(proto, 'value');
        if (d?.set) d.set.call(el, value);
        else el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const clickMatch = pattern => {
        const re = new RegExp(pattern, 'i');
        for (const el of document.querySelectorAll('button, a, [role="button"], input[type="submit"]')) {
          if (!visible(el) || el.disabled) continue;
          if (re.test(txt(el))) { el.click(); return txt(el); }
        }
        return null;
      };

      const targetEmail = 'info@hundesalon-nika.com';
      const inputs = Array.from(document.querySelectorAll('input')).filter(visible);
      const emailInput = inputs.find(el => /email|e-mail/i.test(
        (el.placeholder || '') + (el.getAttribute('aria-label') || '') + (el.type || '')
      )) || inputs.find(el => el.type === 'email' || el.type === 'text');

      if (emailInput && emailInput.value !== targetEmail) {
        setNativeValue(emailInput, targetEmail);
        await sleep(600);
      }

      let clicked = clickMatch('send verification|verify email|send email|подтверд|отправ');
      if (!clicked) clicked = clickMatch('^save$|^submit$|^absenden$|сохран|отправ');
      await sleep(3000);

      const body = document.body?.innerText || '';
      return {
        emailSet: emailInput?.value || null,
        clicked,
        hasVerifyPending: /verify|verification|check your email|подтверд|письмо/i.test(body),
        hasSubmit: /submit|absenden/i.test(body),
        sample: body.slice(0, 900),
      };
    })()`);

    report.steps.csam = action;
    const ok = Boolean(action.hasVerifyPending || action.clicked);
    console.log(
      ok
        ? '  ✓ CSAM email set — confirm link in info@ inbox (or forwarded Gmail)'
        : '  ⚠ CSAM page opened; complete verify + Submit in Dashboard'
    );
    return ok;
  } finally {
    tab.close();
  }
}

async function main() {
  console.log('HUNDESALON — complete manual checklist\n');

  if (!(await ensureBingCdp())) {
    console.log('Starting Bing Edge CDP…');
    const { spawn } = await import('node:child_process');
    spawn('npm', ['run', 'bing:edge'], { shell: true, detached: true, stdio: 'ignore' }).unref();
    for (let i = 0; i < 25; i++) {
      await sleep(2000);
      if (await ensureBingCdp()) break;
    }
    if (!(await ensureBingCdp())) {
      console.error('Bing Edge CDP failed to start. Run: npm run bing:edge');
      process.exit(1);
    }
  }

  const siteScanOk = await runBingSiteScan();
  const clarityOk = await runBingClarity();
  const csamOk = await runCsamSetup();

  report.ok = { siteScan: siteScanOk, clarity: clarityOk, csam: csamOk };

  const out = path.join(root, 'temp', 'manual-checklist-report.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nReport: ${out}`);

  if (!siteScanOk) process.exitCode = 2;
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
