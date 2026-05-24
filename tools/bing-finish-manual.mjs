/**
 * Finish manual Bing WMT steps: Site Scan, Robots, URL Inspection, Settings/API, Clarity.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.BING_MAIL_EDGE_PORT || 9224);
const siteQ = encodeURIComponent('https://hundesalon-nika.com/');
const inspectUrl = 'https://hundesalon-nika.com/de/';

let nextId = 1;
const pending = new Map();

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function pageScript(body) {
  return `(async () => {
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
      for (const el of document.querySelectorAll('a, button, [role="button"], input[type="submit"], span[role="button"]')) {
        if (!visible(el) || el.disabled) continue;
        if (re.test(txt(el))) { el.click(); return txt(el); }
      }
      return null;
    };
    ${body}
  })()`;
}

async function openSession() {
  const list = await getJson(`http://127.0.0.1:${port}/json/list`);
  let target = list.find(t => t.type === 'page' && /bing\.com\/webmaster/i.test(t.url));
  if (!target) target = list.find(t => t.type === 'page');
  if (!target?.webSocketDebuggerUrl) throw new Error('NO_EDGE');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (!m.id) return;
    const entry = pending.get(m.id);
    if (!entry) return;
    pending.delete(m.id);
    if (m.error) entry.reject(new Error(m.error.message));
    else entry.resolve(m.result);
  });
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const id = nextId++;
      pending.set(id, { resolve: res, reject: rej });
      ws.send(JSON.stringify({ id, method, params }));
    });
  await send('Runtime.enable');
  await send('Page.enable');

  return {
    async nav(pathPart, extra = '') {
      const url = `https://www.bing.com/webmasters/${pathPart}?siteUrl=${siteQ}${extra}`;
      await send('Page.navigate', { url, transitionType: 'reload' });
      await wait(9000);
      for (let i = 0; i < 8; i++) {
        const ok = await send('Runtime.evaluate', {
          expression: `!location.href.startsWith('chrome-error') && (document.body?.innerText||'').length > 100`,
          returnByValue: true,
        });
        if (ok.result?.value) break;
        await wait(2000);
        await send('Page.reload', { ignoreCache: true });
        await wait(6000);
      }
      return url;
    },
    async eval(body) {
      const result = await send('Runtime.evaluate', {
        expression: pageScript(body),
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description || 'eval failed');
      }
      return result.result?.value;
    },
    close: () => ws.close(),
  };
}

try {
  await getJson(`http://127.0.0.1:${port}/json/version`);
} catch {
  console.error('Run: npm run bing:edge');
  process.exit(1);
}

const report = { at: new Date().toISOString() };
const s = await openSession();

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
