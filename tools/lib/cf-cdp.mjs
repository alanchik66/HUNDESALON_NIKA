/**
 * CDP helper for Cloudflare Dashboard (Chrome 9226 or Edge 9225).
 * CF_CDP_PORT — default 9226 if CF_CDP_BROWSER=chrome, else 9225.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { getJson, openCdpSession, sleep } from './browser-cdp.mjs';
import { browserPidFile, launchTrackedBrowser, stopTrackedBrowser } from './browser-launch.mjs';

const browser = (process.env.CF_CDP_BROWSER || 'edge').toLowerCase();
const defaultPort = browser === 'chrome' ? 9226 : 9225;
export const CF_CDP_PORT = Number(process.env.CF_CDP_PORT || defaultPort);

export { getJson, sleep };

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
    const pidName = browser === 'chrome' ? 'hundesalon-nika-cf-chrome-debug' : 'hundesalon-nika-cf-edge-debug';
    const pidFile = browserPidFile(pidName);
    console.log(`Starting ${browser} CDP on port ${CF_CDP_PORT}…`);
    stopTrackedBrowser(pidFile, browser === 'chrome' ? ['chrome.exe'] : ['msedge.exe']);
    launchTrackedBrowser(
      exe,
      [
        `--remote-debugging-port=${CF_CDP_PORT}`,
        `--user-data-dir=${userDataDir()}`,
        '--no-first-run',
        '--no-default-browser-check',
        startUrl,
      ],
      pidFile
    );
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
  const session = await openCdpSession({ port: CF_CDP_PORT, targetPattern: /cloudflare\.com/i });

  return {
    url: session.target.url,
    send: session.send,
    eval: async (expression, timeoutMs = 60000) => {
      const r = await session.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
        timeout: timeoutMs,
      });
      return r.result?.value;
    },
    navigate: async (url, waitMs = 12000) => {
      await session.send('Page.navigate', { url });
      await sleep(waitMs);
    },
    close: session.close,
  };
}
