/** CDP session for Cloudflare Dashboard (Edge CF_EDGE_PORT). */
import { spawn } from 'node:child_process';
import { getJson, openCdpSession, sleep } from './browser-cdp.mjs';

const port = Number(process.env.CF_EDGE_PORT || 9225);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export { getJson, sleep };

export async function ensureCfEdge() {
  try {
    await getJson(`http://127.0.0.1:${port}/json/version`);
    return;
  } catch {
    spawn(npmCommand, ['run', 'cf:edge-dashboard'], { detached: true, stdio: 'ignore' }).unref();
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
  const session = await openCdpSession({
    port,
    targetPattern: /cloudflare\.com/i,
    fallbackAny: false,
  });

  return {
    url: session.target.url,
    send: session.send,
    eval: async (expression, timeoutMs = 45000) => {
      const r = await session.send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
        timeout: timeoutMs,
      });
      return r.result?.value;
    },
    close: session.close,
  };
}
