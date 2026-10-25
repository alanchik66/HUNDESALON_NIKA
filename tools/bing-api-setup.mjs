#!/usr/bin/env node
/**
 * Bing URL API setup: ensure Edge CDP, read or explicitly generate the key,
 * then verify a real batch submission.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { browserPidFile, launchTrackedBrowser, stopTrackedBrowser } from './lib/browser-launch.mjs';
import { getJson } from './lib/browser-cdp.mjs';
import { SITE_URL, siteQuery } from './lib/bing-wmt.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.BING_MAIL_EDGE_PORT || process.env.BING_EDGE_PORT || 9224);
const allowGenerate = process.argv.includes('--generate');

function runNode(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, 'tools', script), ...args], {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', reject);
    child.on('close', code => resolve(code ?? 1));
  });
}

async function ensureCdp() {
  try {
    await getJson(`http://127.0.0.1:${port}/json/version`);
    return true;
  } catch {
    // Launch a dedicated Edge profile below.
  }

  const candidates = [
    path.join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
  ].filter(existsSync);
  if (!candidates.length) return false;

  const userDataDir = path.join(process.env.TEMP || '.', 'hundesalon-nika-edge-debug');
  const pidFile = browserPidFile('hundesalon-nika-edge-debug');
  const startUrl = `https://www.bing.com/webmasters/home?siteUrl=${siteQuery(SITE_URL)}`;

  stopTrackedBrowser(pidFile);
  launchTrackedBrowser(
    candidates[0],
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      startUrl,
    ],
    pidFile
  );

  for (let attempt = 0; attempt < 24; attempt += 1) {
    try {
      await getJson(`http://127.0.0.1:${port}/json/version`);
      return true;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return false;
}

async function main() {
  console.log('Bing URL API setup...');
  if (!(await ensureCdp())) {
    throw new Error(`Edge CDP is not ready on port ${port}. Run: npm run bing:edge`);
  }

  if (!allowGenerate) {
    console.log('Credential creation is disabled. Existing keys can still be read.');
    console.log('To create a missing key after approval, add: -- --generate');
  }

  const fetchCode = await runNode('bing-fetch-api-key.mjs', allowGenerate ? ['--generate'] : []);
  if (fetchCode !== 0) {
    throw new Error(`Bing API key setup failed with exit code ${fetchCode}.`);
  }

  const verifyCode = await runNode('bing-url-submit.mjs');
  if (verifyCode !== 0) {
    throw new Error(`Bing URL API verification failed with exit code ${verifyCode}.`);
  }

  console.log('Bing URL API setup and live verification completed.');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
