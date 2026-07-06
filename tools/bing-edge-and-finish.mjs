/**
 * Ensure Edge CDP is up, then run bing-finish-remaining in the same process.
 * npm run bing:finish-all
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.BING_MAIL_EDGE_PORT || '9224';

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

function startEdge() {
  const site = encodeURIComponent('https://hundesalon-nika.com/');
  const startUrl = `https://www.bing.com/webmasters/sitescan?siteUrl=${site}`;
  const candidates = [
    path.join(process.env['ProgramFiles'] || '', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
  ].filter(existsSync);

  if (!candidates.length) throw new Error('Microsoft Edge not found.');

  const userDataDir = path.join(process.env.TEMP || '.', 'hundesalon-nika-edge-debug');
  const marker = 'hundesalon-nika-edge-debug';

  if (process.platform === 'win32') {
    spawnSync(
      'pwsh',
      [
        '-NoProfile',
        '-Command',
        `Get-CimInstance Win32_Process -Filter "name='msedge.exe'" | Where-Object { $_.CommandLine -like '*${marker}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
      ],
      { encoding: 'utf8' }
    );
  }

  spawn(
    candidates[0],
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      startUrl,
    ],
    { detached: true, stdio: 'ignore' }
  ).unref();
}

async function ensureEdge() {
  console.log(`Starting Edge CDP on port ${port}…`);
  startEdge();

  for (let i = 0; i < 40; i += 1) {
    if (await cdpReady()) {
      const json = await fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.json());
      console.log(`CDP ready: ${json.Browser || 'Edge'}`);
      await new Promise(r => setTimeout(r, 3000));
      return;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  throw new Error(`CDP port ${port} not ready after 20s`);
}

await ensureEdge();

const child = spawnSync(process.execPath, [path.join(root, 'tools', 'bing-finish-remaining.mjs')], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'inherit',
});

process.exit(child.status ?? 1);
