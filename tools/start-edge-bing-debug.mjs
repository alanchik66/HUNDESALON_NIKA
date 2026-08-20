/**
 * Start Edge with remote debugging for npm run bing:automate (Windows).
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { browserPidFile, launchTrackedBrowser, stopTrackedBrowser } from './lib/browser-launch.mjs';

const port = process.env.BING_MAIL_EDGE_PORT || '9224';
const site = encodeURIComponent('https://hundesalon-nika.com/');
const startUrl = `https://www.bing.com/webmasters/urlinspection?siteUrl=${site}`;
const pidFile = browserPidFile('hundesalon-nika-edge-debug');

const candidates = [
  path.join(process.env['ProgramFiles'] || '', 'Microsoft/Edge/Application/msedge.exe'),
  path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
].filter(existsSync);

if (!candidates.length) {
  console.error('Microsoft Edge not found.');
  process.exit(1);
}

const edge = candidates[0];
const userDataDir = path.join(process.env.TEMP || '.', 'hundesalon-nika-edge-debug');

async function cdpReady() {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

console.log(`Starting Edge (port ${port})…`);
console.log(startUrl);

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

console.log('\n1. Sign in to Microsoft if prompted');
console.log('2. Wait for Bing Webmaster Tools to load');
console.log('3. Run: npm run bing:automate');

for (let i = 0; i < 30; i += 1) {
  if (await cdpReady()) {
    const json = await fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json());
    console.log(`\nDebug OK: ${json.Browser || 'Edge'} (port ${port})`);
    process.exit(0);
  }
  await new Promise(r => setTimeout(r, 500));
}

console.error(`\nCDP port ${port} not ready after 15s — close other Edge windows using this debug profile and rerun.`);
process.exit(1);
