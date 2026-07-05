/**
 * Finish manual Bing WMT steps: Site Scan, Robots, URL Inspection, Settings/API, Clarity.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { getJson, openBingWebmasterSession } from './lib/browser-cdp.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
  for (const apiPath of ['settings/apiaccess', 'settings/api', 'settings']) {
    await s.nav(apiPath);
    const probe = await s.eval(`return { url: location.href, body: (document.body?.innerText||'').slice(0, 300) };`);
    if (/api|ключ|key|token/i.test(probe.body) && !/не найдено|not found/i.test(probe.body)) break;
  }
  report.apiAccess = await s.eval(`
    const body = document.body?.innerText || '';
    const gen = clickMatch('generate|создать|create|новый|add key|добавить');
    await sleep(2000);
    return {
      url: location.href,
      hasApiSection: /api|ключ|key|token/i.test(body),
      generateClicked: gen,
      sample: body.slice(0, 700),
    };
  `);

  const devVars = path.join(root, '.dev.vars');
  report.bingApiKeyInDevVars =
    fs.existsSync(devVars) && /BING_WEBMASTER_API_KEY\s*=\s*\S+/.test(fs.readFileSync(devVars, 'utf8'));

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
  await new Promise((resolve, reject) => {
    const p = spawn('npm', ['run', 'bing:api'], { cwd: root, shell: true, stdio: 'inherit' });
    p.on('close', c => (c === 0 ? resolve() : resolve()));
  });
  report.bingApi = { ran: true };
} else {
  report.bingApi = { skipped: true, reason: 'No BING_WEBMASTER_API_KEY in .dev.vars' };
}

const out = path.join(root, 'temp', 'bing-finish-manual-report.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
