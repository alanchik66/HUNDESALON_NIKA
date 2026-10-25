/**
 * Finish manual Bing WMT steps: Site Scan, Robots, URL Inspection, Settings/API, Clarity.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { openBingApiAccess } from './lib/bing-api-access.mjs';
import { getJson, openBingWebmasterSession } from './lib/browser-cdp.mjs';
import { BING_INDEXNOW_COVERAGE, hasBingApiKey } from './lib/bing-api.mjs';
import { SITE_HOST } from './lib/bing-wmt.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const port = Number(process.env.BING_MAIL_EDGE_PORT || 9224);
const siteQ = encodeURIComponent('https://hundesalon-nika.com/');
const inspectUrl = 'https://hundesalon-nika.com/de/';

try {
  await getJson(`http://127.0.0.1:${port}/json/version`);
} catch {
  console.error('Run: npm run bing:edge');
  process.exit(1);
}

const report = { at: new Date().toISOString() };
const s = await openBingWebmasterSession({
  port,
  siteQ,
  waitMs: 9000,
  reloadAttempts: 8,
  clickSelectors: 'a, button, [role="button"], input[type="submit"], span[role="button"]',
});

try {
  console.log('1/5 Site Scan…');
  await s.nav('sitescan');
  report.siteScan = await s.eval(`
    const body = document.body?.innerText || '';
    const btn = clickMatch('начать новое сканирование|start new scan|run scan|scan now|новое сканирование|start scan');
    await sleep(4000);
    const confirm = clickMatch('^start$|^начать$|^scan$|^да$|^yes$|confirm|подтверд');
    await sleep(5000);
    return {
      clicked: btn,
      confirmed: confirm,
      sample: (document.body?.innerText||'').slice(0, 500),
      scanning: /scanning|сканир|in progress|выполняется|queued|очеред/i.test(document.body?.innerText||''),
    };
  `);

  console.log('2/5 Robots.txt…');
  await s.nav('robotstxttester');
  report.robots = await s.eval(`
    if (!location.href.includes('robotstxt')) return { error: 'wrong page', url: location.href };
    const robots = 'https://hundesalon-nika.com/robots.txt';
    const inputs = Array.from(document.querySelectorAll('input')).filter(el => visible(el));
    const input = inputs.find(el => /url|robots|text/i.test(el.type || '') || /robots/i.test(el.placeholder || '')) || inputs[0];
    if (input) { setNativeValue(input, robots); await sleep(800); }
    let test = null;
    for (const el of document.querySelectorAll('button, a, [role="button"]')) {
      if (!visible(el)) continue;
      const t = txt(el);
      if (/robots|robot|test|провер|fetch/i.test(t) && !/url inspection|проверка url/i.test(t)) {
        el.click(); test = t; break;
      }
    }
    await sleep(6000);
    const body = document.body?.innerText || '';
    return {
      tested: test,
      onRobotsPage: true,
      hasAllow: /allow:\\s*\\//i.test(body),
      hasSitemap: /sitemap/i.test(body),
      sample: body.slice(0, 900),
    };
  `);

  console.log('3/5 URL Inspection…');
  await s.nav('urlinspection', `&urlToInspect=${encodeURIComponent(inspectUrl)}`);
  report.inspection = await s.eval(`
    const target = '${inspectUrl}';
    const input = document.querySelector('input[placeholder*="URL" i], input[type="url"], input[type="search"], input[type="text"]');
    if (input) {
      setNativeValue(input, target);
      await sleep(600);
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await sleep(5000);
    }
    let inspected = null;
    for (const b of document.querySelectorAll('button')) {
      if (!visible(b)) continue;
      const t = txt(b);
      if (/^inspect$/i.test(t) || /inspect url|проверить|prüfen/i.test(t)) { b.click(); inspected = t; break; }
    }
    await sleep(8000);
    let req = clickMatch('request indexing|запросить индексирование|indexierung anfordern|submit to index|запросить индекс');
    if (!req) {
      for (const b of document.querySelectorAll('button, a, [role="button"]')) {
        if (!visible(b)) continue;
        const t = txt(b);
        if (/request|запросить|indexing|индексирование/i.test(t)) { b.click(); req = t; await sleep(2500); break; }
      }
    }
    await sleep(3000);
    const body = document.body?.innerText || '';
    return {
      inspected,
      requestIndexing: req,
      canIndex: /can be indexed|может быть проиндексирован|indexed|проиндексирован|url is on bing/i.test(body),
      sample: body.slice(0, 600),
    };
  `);

  console.log('4/5 Settings / API…');
  report.apiAccess = await openBingApiAccess(s, { expectedHost: SITE_HOST });
  report.apiAccess.success = Boolean(report.apiAccess.hasApiKeyControl);

  report.bingApiKeyInDevVars = hasBingApiKey();

  console.log('5/5 Microsoft Clarity…');
  await s.nav('clarity');
  report.clarity = await s.eval(`
    if (!location.href.includes('clarity')) return { error: 'wrong page', url: location.href };
    const start = clickMatch('get started|начать|enable|включить|sign up|зарегистр|connect|подключ|try clarity|попробовать');
    await sleep(5000);
    const body = document.body?.innerText || '';
    return {
      clicked: start,
      hasClarity: /clarity/i.test(body),
      sample: body.slice(0, 600),
    };
  `);
} finally {
  s.close();
}

if (report.bingApiKeyInDevVars) {
  console.log('Running bing:api…');
  await new Promise(resolve => {
    const p = spawn(npmCommand, ['run', 'bing:api'], { cwd: root, stdio: 'inherit' });
    p.on('close', () => resolve());
  });
  report.bingApi = { ran: true };
} else {
  report.bingApi = { ok: true, coveredBy: 'indexnow', note: BING_INDEXNOW_COVERAGE };
}

const out = path.join(root, 'temp', 'bing-finish-manual-report.json');
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
