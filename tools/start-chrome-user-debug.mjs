/**
 * Restart Chrome with remote debugging on the Default profile (logged-in session).
 * npm run cf:chrome-user-debug
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { browserPidFile, launchTrackedBrowser, stopTrackedBrowser } from './lib/browser-launch.mjs';

const port = process.env.CF_USER_CHROME_PORT || '9222';
const chromeExe = path.join(process.env.ProgramFiles || '', 'Google/Chrome/Application/chrome.exe');
const userDataDir = path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data');
const startUrl = 'https://dash.cloudflare.com/profile/api-tokens';
const pidFile = browserPidFile('hundesalon-nika-chrome-user-debug');

if (!existsSync(chromeExe)) {
  console.error('Chrome not found');
  process.exit(1);
}

stopTrackedBrowser(pidFile, ['chrome.exe']);

console.log(`Starting Chrome (port ${port}, Default profile)…`);
launchTrackedBrowser(
  chromeExe,
  [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--profile-directory=Default',
    '--no-first-run',
    startUrl,
  ],
  pidFile
);

console.log(startUrl);
console.log(`\nThen: CF_CDP_PORT=${port} npm run cf:chrome-cdp-apply`);
