/**
 * Start Edge with remote debugging for npm run bing:automate (Windows).
 */
import { exec, spawn } from 'node:child_process';
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

console.log(`Starting Edge (port ${port})…`);
console.log(startUrl);

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

if (process.platform === 'win32') {
  setTimeout(() => {
    exec(`curl -s http://127.0.0.1:${port}/json/version`, (error, stdout) => {
      if (error) console.log(`\nDebug port not ready yet — wait a few seconds, then npm run bing:automate`);
      else console.log(`\nDebug OK: ${stdout.trim().slice(0, 120)}…`);
    });
  }, 4000);
}
