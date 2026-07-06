/**
 * Start Edge with remote debugging for npm run bing:automate (Windows).
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const port = process.env.BING_MAIL_EDGE_PORT || '9224';
const site = encodeURIComponent('https://hundesalon-nika.com/');
const startUrl = `https://www.bing.com/webmasters/urlinspection?siteUrl=${site}`;

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

function stopStaleProfileEdge() {
  if (process.platform !== 'win32') return;

  const marker = 'hundesalon-nika-edge-debug';
  const ps = spawnSync(
    'pwsh',
    [
      '-NoProfile',
      '-Command',
      `Get-CimInstance Win32_Process -Filter "name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${marker}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
    ],
    { encoding: 'utf8' }
  );
  if (ps.stderr?.trim()) {
    console.log(ps.stderr.trim());
  }
}

console.log(`Starting Edge (port ${port})…`);
console.log(startUrl);

stopStaleProfileEdge();

const child = spawn(
  edge,
  [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    startUrl,
  ],
  { detached: true, stdio: 'ignore' }
);

child.unref();

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

console.error(`\nCDP port ${port} not ready after 15s — close other Edge windows using the debug profile and rerun.`);
process.exit(1);
