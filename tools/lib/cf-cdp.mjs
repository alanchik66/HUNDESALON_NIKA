/**
 * CDP helper for Cloudflare Dashboard (Chrome 9226 or Edge 9225).
 * CF_CDP_PORT — default 9226 if CF_CDP_BROWSER=chrome, else 9225.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const browser = (process.env.CF_CDP_BROWSER || 'edge').toLowerCase();
const defaultPort = browser === 'chrome' ? 9226 : 9225;
export const CF_CDP_PORT = Number(process.env.CF_CDP_PORT || defaultPort);

export async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

function browserExe() {
  if (browser === 'chrome') {
    const chrome = path.join(process.env.ProgramFiles || '', 'Google/Chrome/Application/chrome.exe');
    if (existsSync(chrome)) return chrome;
    throw new Error('Google Chrome not found');
  }
  const edge = [
    path.join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
  ].find(existsSync);
  if (edge) return edge;
  throw new Error('Microsoft Edge not found');
}

export function userDataDir() {
  const name = browser === 'chrome' ? 'hundesalon-nika-cf-chrome-debug' : 'hundesalon-nika-cf-edge-debug';
  return path.join(process.env.TEMP || '.', name);
}

export async function ensureCfCdp(startUrl = 'https://dash.cloudflare.com/profile/api-tokens') {
  try {
    await getJson(`http://127.0.0.1:${CF_CDP_PORT}/json/version`);
    return;
  } catch {
    const exe = browserExe();
    console.log(`Starting ${browser} CDP on port ${CF_CDP_PORT}…`);
    spawn(
      exe,
      [
        `--remote-debugging-port=${CF_CDP_PORT}`,
        `--user-data-dir=${userDataDir()}`,
        '--no-first-run',
        '--no-default-browser-check',
        startUrl,
      ],
      { detached: true, stdio: 'ignore' }
    ).unref();
    for (let i = 0; i < 35; i++) {
      await sleep(2000);
      try {
        await getJson(`http://127.0.0.1:${CF_CDP_PORT}/json/version`);
        return;
      } catch {
        // retry
      }
    }
    throw new Error(`${browser} CDP did not start on port ${CF_CDP_PORT}`);
  }
}

export async function connectCfTab() {
  const list = await getJson(`http://127.0.0.1:${CF_CDP_PORT}/json/list`);
  const t =
    list.find(x => x.type === 'page' && x.url?.includes('cloudflare.com')) ||
    list.find(x => x.type === 'page');
  if (!t?.webSocketDebuggerUrl) throw new Error(`No Cloudflare tab on port ${CF_CDP_PORT}`);

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
    eval: async (expression, timeoutMs = 60000) => {
      const r = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
        timeout: timeoutMs,
      });
      return r.result?.value;
    },
    navigate: async (url, waitMs = 12000) => {
      await send('Page.navigate', { url });
      await sleep(waitMs);
    },
    close: () => ws.close(),
  };
}
