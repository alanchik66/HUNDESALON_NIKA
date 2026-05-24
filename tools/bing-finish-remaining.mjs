/**
 * Continue unfinished Bing steps: site scan, robots test, clarity, API page.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.BING_MAIL_EDGE_PORT || 9224);
const siteQ = encodeURIComponent('https://hundesalon-nika.com/');

let nextId = 1;
const pending = new Map();

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
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
      for (const el of document.querySelectorAll('a, button, [role="button"], input[type="submit"]')) {
        if (!visible(el) || el.disabled) continue;
        if (re.test(txt(el))) { el.click(); return txt(el); }
      }
      return null;
    };
    ${body}
  })()`;
}

async function openSession() {
  try {
    await getJson(`http://127.0.0.1:${port}/json/version`);
  } catch {
    throw new Error('NO_EDGE — npm run bing:edge');
  }
  const list = await getJson(`http://127.0.0.1:${port}/json/list`);
  const target =
    list.find(t => t.type === 'page' && /bing\.com\/webmaster/i.test(t.url)) ||
    list.find(t => t.type === 'page');
  if (!target?.webSocketDebuggerUrl) throw new Error('NO_EDGE_PAGE');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (!m.id) return;
    const x = pending.get(m.id);
    pending.delete(m.id);
    m.error ? x.rej(new Error(m.error.message)) : x.resolve(m.result);
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
      await send('Page.navigate', { url });
      await wait(9000);
      for (let i = 0; i < 4; i++) {
        const ok = await send('Runtime.evaluate', {
          expression: `!location.href.includes('chrome-error') && (document.body?.innerText||'').length > 100`,
          returnByValue: true,
        });
        if (ok.result?.value) break;
        await send('Page.reload', { ignoreCache: true });
        await wait(7000);
      }
      return url;
    },
    async eval(body) {
      const r = await send('Runtime.evaluate', {
        expression: pageScript(body),
        awaitPromise: true,
        returnByValue: true,
      });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description);
      return r.result?.value;
    },
    close: () => ws.close(),
  };
}

const report = { at: new Date().toISOString() };
const s = await openSession();

try {
  console.log('1/4 Site Scan — start…');
  await s.nav('sitescan');
  report.siteScan = await s.eval(`
    const btn = clickMatch('начать новое сканирование|start new scan|run scan|scan now|новое сканирование');
    await sleep(3000);
    const confirm = clickMatch('^start$|^начать$|^scan$|^да$|^yes$|confirm|подтверд|ok');
    await sleep(6000);
    const body = document.body?.innerText || '';
    return {
      clicked: btn,
      confirmed: confirm,
      scanning: /scanning|сканир|in progress|выполняется|queued|очередь|completed|заверш/i.test(body),
      notStarted: /не проводилось|not scanned|no scan/i.test(body),
      sample: body.slice(0, 500),
    };
  `);

  console.log('2/4 Robots.txt — fetch + test…');
  await s.nav('robotstxttester');
  report.robots = await s.eval(`
    const robots = 'https://hundesalon-nika.com/robots.txt';
    const fetchBtn = clickMatch('получить последний|fetch|get latest|загрузить');
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
      sample: body.slice(0, 1200),
    };
  `);

  console.log('3/4 API Access…');
  for (const apiPath of ['settings/apiaccess', 'settings/api', 'settings']) {
    await s.nav(apiPath);
    const probe = await s.eval(`return { url: location.href, body: (document.body?.innerText||'').slice(0, 400) };`);
    if (/api|ключ|key|token|subscription/i.test(probe.body) && !/не найдено|not found|страниц не найдено/i.test(probe.body)) {
      report.apiProbe = probe;
      break;
    }
    report.apiProbe = probe;
  }
  report.apiAccess = await s.eval(`
    const body = document.body?.innerText || '';
    const gen = clickMatch('generate api|создать ключ|generate key|new api|сгенерировать|create api');
    await sleep(2000);
    return {
      url: location.href,
      generateClicked: gen,
      hasApiSection: /api|ключ|key|token/i.test(body),
      sample: body.slice(0, 800),
    };
  `);

  console.log('4/4 Microsoft Clarity…');
  await s.nav('clarity');
  report.clarity = await s.eval(`
    let clicked = clickMatch('get started|начать работу|sign up|зарегистр|подключ|try clarity|попробовать|enable clarity|создать|бесплатно');
    if (!clicked) {
      for (const a of document.querySelectorAll('a[href]')) {
        if (!visible(a)) continue;
        const h = a.href || '';
        if (/clarity\\.microsoft/i.test(h)) { a.click(); clicked = h; break; }
      }
    }
    await sleep(6000);
    const body = document.body?.innerText || '';
    return {
      clicked,
      onClarityMs: /clarity\\.microsoft/i.test(location.href),
      hasClarity: /clarity/i.test(body),
      sample: body.slice(0, 700),
    };
  `);
} finally {
  s.close();
}

try {
  const r = await fetch('https://hundesalon-nika.com/robots.txt', { signal: AbortSignal.timeout(15000) });
  const text = await r.text();
  report.liveRobots = {
    status: r.status,
    hasAllow: /Allow:\s*\//i.test(text),
    hasSitemap: /Sitemap:/i.test(text),
    lineCount: text.split('\n').length,
  };
} catch (e) {
  report.liveRobots = { error: String(e.message) };
}

const devVars = path.join(root, '.dev.vars');
report.hasBingApiKey =
  fs.existsSync(devVars) && /BING_WEBMASTER_API_KEY\s*=\s*\S+/.test(fs.readFileSync(devVars, 'utf8'));

const out = path.join(root, 'temp', 'bing-finish-remaining-report.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
