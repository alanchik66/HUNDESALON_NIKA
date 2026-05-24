/**
 * Restart Chrome with remote debugging on the Default profile (logged-in session).
 * npm run cf:chrome-user-debug
 */
import { spawn, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const port = process.env.CF_USER_CHROME_PORT || '9222';
const chromeExe = path.join(process.env.ProgramFiles || '', 'Google/Chrome/Application/chrome.exe');
const userDataDir = path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data');
const startUrl = 'https://dash.cloudflare.com/profile/api-tokens';

if (!existsSync(chromeExe)) {
  console.error('Chrome not found');
  process.exit(1);
}

console.log('Closing Chrome…');
try {
  execSync('taskkill /IM chrome.exe /F', { stdio: 'ignore' });
} catch {
  // not running
}
await new Promise(r => setTimeout(r, 2000));

console.log(`Starting Chrome (port ${port}, Default profile)…`);
spawn(
  chromeExe,
  [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--profile-directory=Default',
    '--no-first-run',
    startUrl,
  ],
  { detached: true, stdio: 'ignore' }
).unref();

console.log(startUrl);
console.log(`\nThen: CF_CDP_PORT=${port} npm run cf:chrome-cdp-apply`);
