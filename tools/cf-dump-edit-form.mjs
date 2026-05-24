process.env.CF_CDP_PORT = process.env.CF_CDP_PORT || '9226';
const port = Number(process.env.CF_CDP_PORT);
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const t = list.find(x => x.url?.includes('cloudflare.com'));
if (!t) {
  console.error('No CF tab on', port);
  process.exit(1);
}

let nextId = 1;
const pending = new Map();
const ws = new WebSocket(t.webSocketDebuggerUrl);
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

const r = await send('Runtime.evaluate', {
  expression: `(async () => {
    const norm = s => (s || '').replace(/\\s+/g, ' ').trim();
    const add = [...document.querySelectorAll('button, a')]
      .filter(e => /weitere hinzufügen|add more/i.test(norm(e.innerText)))
      .map(e => ({ tag: e.tagName, text: norm(e.innerText) }));
    const selects = [...document.querySelectorAll('select')].map(s => ({
      n: s.options.length,
      vals: [...s.options].slice(0, 8).map(o => norm(o.text)),
    }));
    const combos = [...document.querySelectorAll('button, [role=combobox]')]
      .filter(b => b.getAttribute('aria-haspopup') === 'listbox' || b.getAttribute('role') === 'combobox')
      .slice(0, 20)
      .map(b => norm(b.innerText || b.getAttribute('aria-label') || ''));
    const rows = [...document.querySelectorAll('tr, [class*=permission], [data-testid]')]
      .map(el => norm(el.innerText))
      .filter(t => t.length > 10 && t.length < 200 && /zone|cache|regel/i.test(t))
      .slice(0, 15);
    return { url: location.href, add, selectCount: selects.length, selects, combos, rows };
  })()`,
  awaitPromise: true,
  returnByValue: true,
  timeout: 30000,
});
ws.close();
console.log(JSON.stringify(r.result?.value, null, 2));
