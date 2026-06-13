/**
 * Bing Webmaster: performance + logo/favicon signals for search.
 * Requires: npm run bing:edge (mail.ru), port 9224
 */
const port = Number(process.env.BING_MAIL_EDGE_PORT || 9224);
const siteUrl = 'https://hundesalon-nika.com/';
const siteQ = encodeURIComponent(siteUrl);
const performanceUrl = `https://www.bing.com/webmasters/aiperformance?siteUrl=${siteQ}`;

const logoUrls = [
  'https://hundesalon-nika.com/favicon.ico',
  'https://hundesalon-nika.com/assets/images/search-logo-clear-512.png',
  'https://hundesalon-nika.com/assets/images/logo.png',
  'https://hundesalon-nika.com/assets/images/favicon/favicon-search-512.png',
  'https://hundesalon-nika.com/de/',
];

let nextId = 1;
const pending = new Map();

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
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
      for (const el of document.querySelectorAll('a, button, [role="button"]')) {
        if (!visible(el) || el.disabled) continue;
        if (re.test(txt(el))) { el.click(); return txt(el); }
      }
      return null;
    };
    ${body}
  })()`;
}

async function withCdp(fn) {
  const list = await getJson(`http://127.0.0.1:${port}/json/list`);
  const target = list.find(t => t.type === 'page') && /bing/i.test(list.find(t => t.type === 'page')?.url || '')
    ? list.find(t => t.type === 'page' && /bing/i.test(t.url))
    : list.find(t => t.type === 'page');
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
  try {
    return await fn(send);
  } finally {
    ws.close();
  }
}

async function evalPage(send, body) {
  const result = await send('Runtime.evaluate', {
    expression: pageScript(body),
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description);
  return result.result?.value;
}

try {
  await getJson(`http://127.0.0.1:${port}/json/version`);
} catch {
  console.error('Edge CDP not running. Run: npm run bing:edge');
  process.exit(1);
}

const report = { at: new Date().toISOString(), logoUrls };

report.searchPerformance = await withCdp(async send => {
  await send('Page.navigate', { url: performanceUrl });
  await wait(8000);
  const page = await evalPage(
    send,
    `
    const body = document.body?.innerText || '';
    const started = clickMatch('get started|начать|loslegen|view report|просмотреть');
    await sleep(3000);
    return {
      title: document.title,
      url: location.href,
      started,
      hasSearchData: /citation|цитир|performance|упоминан/i.test(body),
      sample: body.slice(0, 1200),
    };
  `
  );
  return page;
});

report.logoSubmit = await withCdp(async send => {
  await send('Page.navigate', { url: `https://www.bing.com/webmasters/submiturl?siteUrl=${siteQ}` });
  await wait(7000);
  return evalPage(
    send,
    `
    const urls = ${JSON.stringify(logoUrls)};
    const input = document.querySelector('textarea') || document.querySelector('input');
    if (!input) return { ok: false, reason: 'NO_INPUT' };
    setNativeValue(input, urls.join('\\n'));
    await sleep(800);
    const s1 = clickMatch('submit urls|отправить url');
    await sleep(1500);
    const buttons = Array.from(document.querySelectorAll('button')).filter(el => visible(el));
    const confirm = buttons.find(el => /^(submit|отправить)$/i.test(txt(el)));
  if (confirm) confirm.click();
    else clickMatch('^submit$|^отправить$');
    await sleep(5000);
    return { ok: true, count: urls.length };
  `
  );
});

for (const url of ['https://hundesalon-nika.com/de/', 'https://hundesalon-nika.com/assets/images/search-logo-clear-512.png']) {
  const step = await withCdp(async send => {
    await send('Page.navigate', {
      url: `https://www.bing.com/webmasters/urlinspection?siteUrl=${siteQ}&urlToInspect=${encodeURIComponent(url)}`,
    });
    await wait(8000);
    return evalPage(
      send,
      `
      clickMatch('inspect|провер');
      await sleep(5000);
      return { url: '${url}', requestIndexing: clickMatch('request indexing|запросить индекс') };
    `
    );
  });
  report.inspections = report.inspections || [];
  report.inspections.push(step);
}

console.log(JSON.stringify(report, null, 2));
