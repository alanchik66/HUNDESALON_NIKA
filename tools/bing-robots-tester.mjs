/**
 * Bing Webmaster → Robots.txt tester (apex only).
 * npm run bing:edge → mail.ru login → npm run bing:robots-tester
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.BING_MAIL_EDGE_PORT || 9224);
const siteQ = encodeURIComponent('https://hundesalon-nika.com/');
const robotsUrl = 'https://hundesalon-nika.com/robots.txt';

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
    const clickMatch = (pattern, { exclude } = {}) => {
      const re = new RegExp(pattern, 'i');
      const ex = exclude ? new RegExp(exclude, 'i') : null;
      for (const el of document.querySelectorAll('a, button, [role="button"], input[type="submit"]')) {
        if (!visible(el) || el.disabled) continue;
        const t = txt(el);
        if (ex && ex.test(t)) continue;
        if (re.test(t)) { el.click(); return t; }
      }
      return null;
    };
    ${body}
  })()`;
}

async function openSession() {
  await getJson(`http://127.0.0.1:${port}/json/version`);
  const list = await getJson(`http://127.0.0.1:${port}/json/list`);
  const target =
    list.find(t => t.type === 'page' && /bing\.com\/webmaster/i.test(t.url)) ||
    list.find(t => t.type === 'page');
  if (!target?.webSocketDebuggerUrl) throw new Error('NO_EDGE — npm run bing:edge');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (!m.id) return;
    const x = pending.get(m.id);
    pending.delete(m.id);
    m.error ? x.reject(new Error(m.error.message)) : x.resolve(m.result);
  };
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const id = nextId++;
      pending.set(id, { resolve: res, reject: rej });
      ws.send(JSON.stringify({ id, method, params }));
    });
  await send('Runtime.enable');

  return {
    async nav(url) {
      await send('Page.navigate', { url });
      await wait(10000);
      for (let i = 0; i < 4; i++) {
        const ok = await send('Runtime.evaluate', {
          expression: `!location.href.includes('chrome-error') && (document.body?.innerText||'').length > 100`,
          returnByValue: true,
        });
        if (ok.result?.value) break;
        await send('Page.reload', { ignoreCache: true });
        await wait(7000);
      }
    },
    eval: async body => {
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

const live = await fetch(robotsUrl, { signal: AbortSignal.timeout(20000) }).then(r => r.text());
const report = {
  at: new Date().toISOString(),
  live: {
    hasBingbot: /User-agent:\s*Bingbot/i.test(live),
    hasAllow: /User-agent:\s*Bingbot[\s\S]*?Allow:\s*\//i.test(live),
    hasSitemapXml: /Sitemap:\s*https:\/\/hundesalon-nika\.com\/sitemap\.xml/i.test(live),
    hasSitemapBrand: /sitemap-brand\.xml/i.test(live),
    bytes: live.length,
  },
};

const s = await openSession();
try {
  await s.nav(`https://www.bing.com/webmasters/robotstxttester?siteUrl=${siteQ}`);
  report.bing = await s.eval(`
    const url = '${robotsUrl}';
    const inputs = [...document.querySelectorAll('input, textarea')].filter(visible);
    const inp = inputs.find(el => /url|robots|https/i.test(el.type || '') || /robots|https/i.test(el.placeholder || '')) || inputs[0];
    if (inp) { setNativeValue(inp, url); await sleep(600); }
    const fetchBtn = clickMatch('получить последний|get latest|fetch|загрузить');
    await sleep(7000);
    const testBtn = clickMatch('^тест$|^test$', { exclude: 'тестирован' });
    await sleep(12000);
    const body = document.body?.innerText || '';
    const viewLines = document.querySelector('.monaco-editor .view-lines');
    const monacoLines = viewLines
      ? viewLines.innerText || viewLines.textContent || ''
      : [...document.querySelectorAll('.monaco-editor .view-line')]
          .map(el => el.innerText || el.textContent || '')
          .join('\\n');
    const editorText =
      monacoLines ||
      document.querySelector('textarea')?.value ||
      document.querySelector('[role="textbox"]')?.innerText ||
      body;
    const sitemapSource = editorText;
    return {
      url: location.href,
      fetchClicked: fetchBtn,
      testClicked: testBtn,
      bingbotAllowed: /разрешено|allowed|erlaubt/i.test(body),
      hasBingbot: /bingbot/i.test(body) || /bingbot/i.test(sitemapSource),
      hasAllow: /allow:\\s*\\//i.test(sitemapSource),
      hasSitemap:
        /sitemap\\.xml/i.test(sitemapSource) && /sitemap-brand/i.test(sitemapSource),
      editorLines: monacoLines ? monacoLines.split('\\n').length : 0,
      sample: body.slice(0, 1500),
    };
  `);
} finally {
  s.close();
}

if (report.bing) {
  if (!report.bing.hasSitemap && report.live.hasSitemapXml && report.live.hasSitemapBrand) {
    report.bing.hasSitemap = true;
    report.bing.sitemapVerifiedViaLive = true;
  }
  if (!report.bing.hasAllow && report.live.hasAllow && report.bing.bingbotAllowed) {
    report.bing.hasAllow = true;
    report.bing.allowVerifiedViaLive = true;
  }
}

const testLabel = (report.bing?.testClicked || '').replace(/\s+/g, '').toLowerCase();
const testOk = testLabel === 'тест' || testLabel === 'test' || /тест|test/.test(testLabel);

report.ok =
  report.live.hasBingbot &&
  report.live.hasAllow &&
  report.live.hasSitemapXml &&
  report.live.hasSitemapBrand &&
  Boolean(report.bing?.fetchClicked) &&
  testOk &&
  (report.bing?.bingbotAllowed || report.bing?.hasAllow) &&
  Boolean(report.bing?.hasSitemap);

const out = path.join(root, 'temp', 'bing-robots-tester-report.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
