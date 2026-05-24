/**
 * Submit sitemap-brand.xml in Bing Webmaster (Edge CDP 9224).
 */
const port = Number(process.env.BING_MAIL_EDGE_PORT || 9224);
const siteQ = encodeURIComponent('https://hundesalon-nika.com/');
const sitemaps = [
  'https://hundesalon-nika.com/sitemap.xml',
  'https://hundesalon-nika.com/sitemap-brand.xml',
];

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

async function withCdp(fn) {
  const list = await getJson(`http://127.0.0.1:${port}/json/list`);
  const target = list.find(t => t.type === 'page') || list[0];
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
  try {
    return await fn(send);
  } finally {
    ws.close();
  }
}

const results = [];
for (const sm of sitemaps) {
  const r = await withCdp(async send => {
    await send('Page.navigate', { url: `https://www.bing.com/webmasters/sitemaps?siteUrl=${siteQ}` });
    await wait(6000);
    const result = await send('Runtime.evaluate', {
      expression: `(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const body = document.body?.innerText || '';
        if (body.includes('${sm.replace(/'/g, "\\'")}')) return { already: true, sm: '${sm}' };
        const input = document.querySelector('input[type="url"], input');
        if (input) {
          const proto = Object.getPrototypeOf(input);
          const d = Object.getOwnPropertyDescriptor(proto, 'value');
          if (d?.set) d.set.call(input, '${sm}');
          else input.value = '${sm}';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        await sleep(500);
        for (const el of document.querySelectorAll('button, a')) {
          const t = (el.innerText || '').trim();
          if (/submit|add|добав|отправ/i.test(t)) { el.click(); break; }
        }
        await sleep(3000);
        return { added: true, sm: '${sm}', has: (document.body?.innerText||'').includes('sitemap-brand') };
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    return result.result?.value;
  });
  results.push(r);
}

console.log(JSON.stringify(results, null, 2));
