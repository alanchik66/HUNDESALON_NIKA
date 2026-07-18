#!/usr/bin/env node
/**
 * Launch Chrome/Edge with a persistent profile so logins survive restarts.
 * Usage:
 *   node tools/start-persistent-browser.mjs chrome
 *   node tools/start-persistent-browser.mjs edge
 *   node tools/start-persistent-browser.mjs chrome https://dash.cloudflare.com
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const kind = (process.argv[2] || 'edge').toLowerCase();
const url = process.argv[3] || 'about:blank';
const root = join(homedir(), '.cursor', 'browser-profiles');
const profileDir = join(root, kind === 'chrome' ? 'chrome-persistent' : 'edge-persistent');
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

const exe = candidates.find((p) => existsSync(p));
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
  url,
];

spawn(exe, args, { detached: true, stdio: 'ignore' }).unref();
console.log(`Started ${kind} with persistent profile:\n  ${profileDir}\n  URL: ${url}`);
console.log('Logins in this window stay until you clear that profile folder.');
