/**
 * Continue unfinished Bing steps: site scan, robots test, clarity, API page.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openBingWebmasterSession } from './lib/browser-cdp.mjs';
import { BING_INDEXNOW_COVERAGE, hasBingApiKey } from './lib/bing-api.mjs';
import { siteQuery } from './lib/bing-wmt.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.BING_MAIL_EDGE_PORT || 9224);
const siteQ = siteQuery();

async function ensureCdp() {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

if (!(await ensureCdp())) {
  console.error(`Edge CDP missing on port ${port}. Run: npm run bing:edge`);
  process.exit(1);
}

const report = { at: new Date().toISOString() };

async function withSession(task) {
  const s = await openBingWebmasterSession({ port, siteQ, waitMs: 9000, reloadAttempts: 4 });
  try {
    return await task(s);
  } finally {
    s.close();
  }
}

async function evalRetry(s, body, { retries = 2 } = {}) {
  let lastError;
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await s.eval(body);
    } catch (error) {
      lastError = error;
      if (!/destroyed|target closed/i.test(String(error.message)) || i === retries) break;
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw lastError;
}

await withSession(async s => {
  console.log('1/4 Site Scan — start…');
  await s.nav('sitescan');
  report.siteScan = await evalRetry(
    s,
    `
    const openScan = () => {
      const patterns = ['start new scan', 'начать новое сканирование', 'run scan', 'scan now', 'новое сканирование'];
      for (const p of patterns) {
        const hit = clickMatch(p);
        if (hit) return hit;
      }
      for (const el of document.querySelectorAll('button, a, [role="button"]')) {
        if (!visible(el)) continue;
        const t = txt(el);
        if (/start new scan|новое сканирование/i.test(t)) {
          el.click();
          return t;
        }
      }
      return null;
    };

    const clicked = openScan();
    await sleep(3500);

    const nameInput =
      document.querySelector('input[placeholder*="scan" i]') ||
      document.querySelector('input[aria-label*="scan" i]') ||
      [...document.querySelectorAll('input')].find(el => visible(el) && !el.disabled && el.type !== 'hidden');
    if (nameInput) {
      setNativeValue(nameInput, 'HUNDESALON SEO scan');
      await sleep(800);
    }

    let confirmed = null;
    const modal = document.querySelector('[role="dialog"], .ms-Modal, .modal, [class*="modal" i]') || document;
    for (const el of modal.querySelectorAll('button, a, [role="button"], input[type="submit"]')) {
      if (!visible(el) || el.disabled) continue;
      const t = txt(el);
      if (/^start new scan$|^start scan$|^начать$|^start$|^scan$|^run$/i.test(t)) {
        el.click();
        confirmed = t;
        break;
      }
    }
    if (!confirmed) {
      confirmed = clickMatch('^start scan$|^start new scan$|^начать скан|^start$|^scan$|confirm|подтверд|proceed|продолж');
    }
    await sleep(12000);

    const modalOpen = !!document.querySelector('[role="dialog"], .ms-Modal, .modal, [class*="modal" i]');
    const body = document.body?.innerText || '';
    const notStarted = /no scans initiated|не проводилось|not scanned|no scan/i.test(body);
    const scanning = /scanning|сканир|in progress|выполняется|queued|очередь|completed|заверш|scheduled|заплан|initiated|quota left/i.test(body);
    return {
      clicked,
      confirmed,
      named: !!nameInput,
      modalOpen,
      scanning,
      notStarted,
      success: Boolean(confirmed) && (scanning || !modalOpen),
      sample: body.slice(0, 700),
    };
  `
  );

  if (report.siteScan?.modalOpen) {
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log('2/4 Robots.txt — fetch + test…');
  await s.nav('robotstxttester');
  await new Promise(r => setTimeout(r, 2000));
  if (!String(await s.evaluate(`location.href`)).includes('robotstxttester')) {
    await s.nav('robotstxttester');
    await new Promise(r => setTimeout(r, 3000));
  }

  report.robots = await evalRetry(
    s,
    `
    if (!location.href.includes('robotstxttester')) {
      return { success: false, wrongPage: location.href };
    }
    const fetchBtn = clickMatch('получить последний|fetch latest|fetch|get latest|загрузить');
    await sleep(5000);
    const testBtn = clickMatch('^тест$|^test$');
    await sleep(8000);
    const body = document.body?.innerText || '';
    return {
      fetchClicked: fetchBtn,
      testClicked: testBtn,
      hasAllow: /allow:\\s*\\//i.test(body),
      hasSitemap: /sitemap/i.test(body),
      hasDisallowTools: /disallow.*tools/i.test(body),
      success: /allow:\\s*\\//i.test(body) && /sitemap/i.test(body),
      sample: body.slice(0, 1200),
    };
  `
  );

  console.log('3/4 API Access…');
  for (const apiPath of ['settings/apiaccess', 'settings/api', 'settings']) {
    await s.nav(apiPath);
    const probe = await s.eval(`return { url: location.href, body: (document.body?.innerText||'').slice(0, 400) };`);
    if (
      /api|ключ|key|token|subscription/i.test(probe.body) &&
      !/не найдено|not found|страниц не найдено/i.test(probe.body)
    ) {
      report.apiProbe = probe;
      break;
    }
    report.apiProbe = probe;
  }
  report.apiAccess = await evalRetry(
    s,
    `
    const body = document.body?.innerText || '';
    const gen = clickMatch('generate api|создать ключ|generate key|new api|сгенерировать|create api');
    await sleep(2000);
    return {
      url: location.href,
      generateClicked: gen,
      hasApiSection: /api|ключ|key|token/i.test(body),
      success: /api|ключ|key|token/i.test(body),
      sample: body.slice(0, 800),
    };
  `
  );

  console.log('4/4 Microsoft Clarity…');
  await s.nav('clarity');
  report.clarity = await evalRetry(
    s,
    `
    let clicked = clickMatch('get started|начать работу|sign up|зарегистр|подключ|try clarity|попробовать|enable clarity|создать|бесплатно');
    await sleep(3000);

    const checkbox =
      document.querySelector('input[type="checkbox"]') ||
      document.querySelector('[role="checkbox"]');
    if (checkbox) {
      if (checkbox.type === 'checkbox' && !checkbox.checked) checkbox.click();
      else if (checkbox.getAttribute('role') === 'checkbox' && checkbox.getAttribute('aria-checked') !== 'true') checkbox.click();
      await sleep(800);
    }

    const accepted = clickMatch('^accept$|^принять$|^agree$|^соглас');
    await sleep(5000);

    const body = document.body?.innerText || '';
    const termsAccepted = /accepted|enabled|connected|подключ|актив|dashboard|проект/i.test(body);
    const onClarityMs = /clarity\\.microsoft/i.test(location.href);

    return {
      clicked,
      checkbox: !!checkbox,
      accepted,
      onClarityMs,
      termsAccepted,
      hasClarity: /clarity/i.test(body),
      success: Boolean(termsAccepted || accepted || /complete setup|clarity is enabled|clarity enabled/i.test(body)),
      sample: body.slice(0, 800),
    };
  `
  );
});

try {
  const r = await fetch('https://hundesalon-nika.com/robots.txt', { signal: AbortSignal.timeout(15000) });
  const text = await r.text();
  report.liveRobots = {
    status: r.status,
    hasAllow: /Allow:\s*\//i.test(text),
    hasSitemap: /Sitemap:/i.test(text),
    lineCount: text.split('\n').length,
    success: r.status === 200 && /Allow:\s*\//i.test(text),
  };
} catch (e) {
  report.liveRobots = { error: String(e.message), success: false };
}

report.hasBingApiKey = hasBingApiKey();
report.bingApi = report.hasBingApiKey
  ? { optional: true, configured: true, success: true }
  : { ok: true, coveredBy: 'indexnow', note: BING_INDEXNOW_COVERAGE, success: true };

report.ok =
  Boolean(report.siteScan?.success) &&
  Boolean(report.robots?.success) &&
  Boolean(report.liveRobots?.success) &&
  Boolean(report.bingApi?.success) &&
  Boolean(report.clarity?.success);

const out = path.join(root, 'temp', 'bing-finish-remaining-report.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
// Use explicit boolean conversions to avoid taint-flow from API key presence checks
const summary = {
  ok: Boolean(report.ok),
  siteScan: Boolean(report.siteScan?.success),
  robots: Boolean(report.robots?.success),
  liveRobots: Boolean(report.liveRobots?.success),
  bingApi: Boolean(report.bingApi?.success),
  clarity: Boolean(report.clarity?.success),
};
console.log(JSON.stringify(summary, null, 2));

if (!report.ok) {
  console.error('\nBing finish-remaining: some steps need attention (see report).');
  process.exit(2);
}

console.log('\nBing finish-remaining: all steps OK.');
