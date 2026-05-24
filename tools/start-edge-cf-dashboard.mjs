/**
 * Edge CDP for Cloudflare Dashboard automation.
 * npm run cf:edge-dashboard
 */
import { exec, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const port = process.env.CF_EDGE_PORT || '9225';
const startUrl = 'https://dash.cloudflare.com/profile/api-tokens';

const candidates = [
  path.join(process.env['ProgramFiles'] || '', 'Microsoft/Edge/Application/msedge.exe'),
  path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
].filter(existsSync);

if (!candidates.length) {
  console.error('Microsoft Edge not found.');
  process.exit(1);
}

const edge = candidates[0];
const userDataDir = path.join(process.env.TEMP || '.', 'hundesalon-nika-cf-edge-debug');

console.log(`Starting Edge for Cloudflare (port ${port})…`);
console.log(startUrl);

spawn(
  edge,
  [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    startUrl,
  ],
  { detached: true, stdio: 'ignore' }
).unref();

console.log('\n1. Sign in to Cloudflare');
console.log('2. Run: npm run cf:edit-token-zone-rules');

if (process.platform === 'win32') {
  setTimeout(() => {
    exec(`curl -s http://127.0.0.1:${port}/json/version`, (error, stdout) => {
      if (!error) console.log(`\nDebug OK on port ${port}`);
    });
  }, 4000);
}
