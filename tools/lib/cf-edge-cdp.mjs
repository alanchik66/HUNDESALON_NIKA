/** CDP session for Cloudflare Dashboard (Edge CF_EDGE_PORT). */
import { spawn } from 'node:child_process';

const port = Number(process.env.CF_EDGE_PORT || 9225);

export async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

export async function ensureCfEdge() {
  try {
    await getJson(`http://127.0.0.1:${port}/json/version`);
    return;
  } catch {
    spawn('npm', ['run', 'cf:edge-dashboard'], { shell: true, detached: true, stdio: 'ignore' }).unref();
    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      try {
        await getJson(`http://127.0.0.1:${port}/json/version`);
        return;
      } catch {
        // retry
      }
    }
    throw new Error('CF Edge (9225) did not start');
  }
}

export async function connectCfTab() {
  const list = await getJson(`http://127.0.0.1:${port}/json/list`);
  const t = list.find(x => x.type === 'page' && x.url?.includes('cloudflare.com'));
  if (!t?.webSocketDebuggerUrl) throw new Error('No Cloudflare tab on port ' + port);

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

  return {
    url: t.url,
    send,
    eval: async (expression, timeoutMs = 45000) => {
      const r = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
        timeout: timeoutMs,
      });
      return r.result?.value;
    },
    close: () => ws.close(),
  };
}
