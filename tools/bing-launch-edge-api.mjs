/**
 * Launch Edge with CDP and open the verified Bing Webmaster property.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { browserPidFile, launchTrackedBrowser, stopTrackedBrowser } from './lib/browser-launch.mjs';

const port = process.env.BING_MAIL_EDGE_PORT || '9224';
const siteQ = encodeURIComponent('https://hundesalon-nika.com/');
const startUrl = `https://www.bing.com/webmasters/home?siteUrl=${siteQ}`;

const candidates = [
  path.join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
  path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
].filter(existsSync);

if (!candidates.length) {
  console.error('Microsoft Edge not found.');
  process.exit(1);
}

const userDataDir = path.join(process.env.TEMP || '.', 'hundesalon-nika-edge-debug');
const edge = candidates[0];
const pidFile = browserPidFile('hundesalon-nika-edge-debug');

stopTrackedBrowser(pidFile);
launchTrackedBrowser(
  edge,
  [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    startUrl,
  ],
  pidFile
);

console.log(`Edge started on port ${port}`);
console.log(startUrl);
console.log('API access: Settings -> API access.');

for (let i = 0; i < 20; i += 1) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(2000) });
    if (response.ok) {
      const json = await response.json();
      console.log(`CDP ready: ${json.Browser || 'Edge'}`);
      process.exit(0);
    }
  } catch {
    await new Promise(r => setTimeout(r, 500));
  }
}

console.error('CDP port not ready after 10s — wait and run: npm run bing:fetch-api-key');
process.exit(1);
