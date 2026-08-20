import { existsSync } from 'node:fs';
import path from 'node:path';
import { sleep } from './browser-cdp.mjs';
import { siteQuery } from './bing-wmt.mjs';
import { browserPidFile, launchTrackedBrowser, stopTrackedBrowser } from './browser-launch.mjs';

export function edgePath() {
  const candidates = [
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
  ].filter(existsSync);
  return candidates[0] || null;
}

export async function cdpReady(port = 9224) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function stopStaleProfileEdge() {
  stopTrackedBrowser(browserPidFile('hundesalon-nika-edge-debug'));
}

export async function ensureBingEdgeCdp(options = {}) {
  const port = Number(options.port || process.env.BING_MAIL_EDGE_PORT || 9224);
  if (await cdpReady(port)) return true;

  const edge = edgePath();
  if (!edge) return false;

  const userDataDir = path.join(process.env.TEMP || '.', 'hundesalon-nika-edge-debug');
  const siteQ = options.siteQ || siteQuery();
  const startUrl =
    options.startUrl || `https://www.bing.com/webmasters/sitescan?siteUrl=${siteQ}`;

  console.log(`Starting Edge CDP on port ${port}…`);
  stopStaleProfileEdge();

  launchTrackedBrowser(
    edge,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      startUrl,
    ],
    browserPidFile('hundesalon-nika-edge-debug')
  );

  for (let i = 0; i < 40; i += 1) {
    if (await cdpReady(port)) {
      console.log('Edge CDP ready.');
      await sleep(5000);
      return true;
    }
    await sleep(500);
  }

  return false;
}
