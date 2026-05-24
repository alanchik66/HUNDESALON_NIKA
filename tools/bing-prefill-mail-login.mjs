/**
 * Pre-fill snaiper1984@mail.ru on Microsoft login page (Edge 9224). Password still required manually.
 */
const port = Number(process.env.BING_MAIL_EDGE_PORT || 9224);
const email = 'snaiper1984@mail.ru';
let nextId = 1;

const list = await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json());
const target = list.find(t => t.type === 'page') || list[0];
if (!target?.webSocketDebuggerUrl) {
  console.error('No Edge on port', port);
  process.exit(1);
}

const pending = new Map();
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
await send('Page.navigate', {
  url: 'https://login.live.com/oauth20_authorize.srf?client_id=0000000048060c6a&response_type=code&scope=service::bingmaster.ms.com::MBI_SSL&redirect_uri=https%3A%2F%2Fwww.bing.com%2Fwebmasters%2F',
});
await new Promise(r => setTimeout(r, 6000));

const result = await send('Runtime.evaluate', {
  expression: `(async () => {
    const email = ${JSON.stringify(email)};
    const input = document.querySelector('input[type="email"], input[name="loginfmt"]');
    if (input) {
      input.focus();
      input.value = email;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 400));
      const next = document.querySelector('input[type="submit"], button[type="submit"], #idSIButton9');
      if (next) next.click();
      return { ok: true, url: location.href };
    }
    return { ok: false, url: location.href, title: document.title };
  })()`,
  awaitPromise: true,
  returnByValue: true,
});

console.log(JSON.stringify(result.result?.value, null, 2));
console.log('\nEnter password in Edge, then: npm run bing:mail-setup');
ws.close();
