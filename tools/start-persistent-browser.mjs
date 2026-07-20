#!/usr/bin/env node
/**
 * Launch Chrome/Edge with a persistent profile so logins survive restarts.
 * Usage:
 *   node tools/start-persistent-browser.mjs edge
 *   node tools/start-persistent-browser.mjs chrome https://dash.cloudflare.com
 *   node tools/start-persistent-browser.mjs edge --cdp 9222 https://dash.cloudflare.com
 *
 * With --cdp, remote debugging stays on so the agent can attach while you
 * click manually (OAuth / passkeys / Cloudflare).
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const argv = process.argv.slice(2);
const kind = (argv.find(a => !a.startsWith('--') && !a.includes('://') && a !== 'about:blank') || 'edge').toLowerCase();
const cdpIdx = argv.findIndex(a => a === '--cdp');
const cdpPort = cdpIdx >= 0 ? String(argv[cdpIdx + 1] || '9222') : null;
const url =
  argv.find(a => a.startsWith('http') || a === 'about:blank') ||
  (cdpPort ? 'about:blank' : 'about:blank');

const root = join(homedir(), '.cursor', 'browser-profiles');
const profileDir = join(
  root,
  cdpPort ? (kind === 'chrome' ? 'chrome-cdp' : 'edge-cdp') : kind === 'chrome' ? 'chrome-persistent' : 'edge-persistent'
);
mkdirSync(profileDir, { recursive: true });

const candidates =
  kind === 'chrome'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        join(homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      ]
    : [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      ];

const exe = candidates.find(p => existsSync(p));
if (!exe) {
  console.error(`Browser not found for: ${kind}`);
  process.exit(1);
}

const args = [
  `--user-data-dir=${profileDir}`,
  '--profile-directory=Default',
  '--disable-session-crashed-bubble',
  '--hide-crash-restore-bubble',
  '--no-first-run',
  '--no-default-browser-check',
];

if (cdpPort) {
  args.push(`--remote-debugging-port=${cdpPort}`);
  args.push('--remote-allow-origins=*');
}

args.push(url);

spawn(exe, args, { detached: true, stdio: 'ignore' }).unref();
console.log(`Started ${kind} with persistent profile:\n  ${profileDir}\n  URL: ${url}`);
if (cdpPort) {
  console.log(`CDP: http://127.0.0.1:${cdpPort}`);
  console.log('You can click manually; agent can attach via CDP / Playwright --cdp-endpoint.');
} else {
  console.log('Logins in this window stay until you clear that profile folder.');
}
