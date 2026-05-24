const port = Number(process.env.CF_EDGE_PORT || 9225);
let nextId = 1;
const pending = new Map();

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const target = list.find(t => t.type === 'page') || list[0];
console.log('target', target?.url);

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
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

const url = process.argv[2] || 'https://dash.cloudflare.com/profile/api-tokens';
await send('Page.navigate', { url });
await new Promise(r => setTimeout(r, 20000));

const r = await send('Runtime.evaluate', {
  expression: `JSON.stringify({
    url: location.href,
    title: document.title,
    len: (document.body?.innerText||'').length,
    sample: (document.body?.innerText||'').slice(0, 1000)
  })`,
  returnByValue: true,
});
console.log(r.result?.value);
ws.close();
