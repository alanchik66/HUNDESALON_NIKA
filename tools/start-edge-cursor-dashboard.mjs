/**
 * Edge CDP for Cursor Dashboard (keeps login in profile).
 * npm run cursor:edge-dashboard
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const port = process.env.CURSOR_CDP_PORT || '9227';
const userDataDir = path.join(process.env.TEMP || '.', 'hundesalon-nika-cursor-playwright');
const startUrl = 'https://cursor.com/dashboard/cloud-agents#environments';

const edge = [
  path.join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
  path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
].find(existsSync);

if (!edge) {
  console.error('Microsoft Edge not found.');
  process.exit(1);
}

console.log(`Edge Cursor profile: ${userDataDir}`);
console.log(`CDP port: ${port}`);
console.log(startUrl);

spawn(
  edge,
  [
    `--remote-debugging-port=${port}`,
    '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    startUrl,
  ],
  { detached: true, stdio: 'ignore' }
).unref();

console.log('\nWhen signed in, run: npm run cursor:setup-cloud:auto');
