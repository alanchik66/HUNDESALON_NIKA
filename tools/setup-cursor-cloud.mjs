/**
 * Prepare and guide Cursor Cloud Agents setup for HUNDESALON_NIKA.
 * Dashboard steps still require your logged-in browser session.
 */
import { exec, spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'alanchik66/HUNDESALON_NIKA';
const BRANCH = 'main';

const DASHBOARD_URLS = [
  'https://cursor.com/dashboard/cloud-agents#environments',
  'https://cursor.com/dashboard/cloud-agents',
  'https://cursor.com/dashboard',
];

const REQUIRED_SECRETS = ['OPENROUTER_API_KEY'];
const OPTIONAL_SECRETS = ['CLOUDFLARE_API_TOKEN'];
const REMOVE_SECRETS = [
  'OPENROUTER_SITE_URL',
  'OPENROUTER_SITE_NAME',
  'OPENROUTER_DEFAULT_MODEL',
  'OPENROUTER_FALLBACK_MODEL',
];

function parseDevVarKeys(filePath) {
  if (!existsSync(filePath)) {
    return [];
  }
  return readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.split('=')[0]?.trim())
    .filter(Boolean);
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', ...opts });
    child.on('close', code => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`))));
    child.on('error', reject);
  });
}

function openUrl(url) {
  const start =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(start);
}

async function main() {
  console.log('\n=== Cursor Cloud — HUNDESALON NIKA ===\n');
  console.log(`Repository: ${REPO}  branch: ${BRANCH}`);
  console.log('Config: .cursor/environment.json (install: npm install)\n');

  const envPath = join(root, '.cursor', 'environment.json');
  if (!existsSync(envPath)) {
    console.error('Missing .cursor/environment.json');
    process.exit(1);
  }

  console.log('1/3  npm install (cloud update script)…\n');
  try {
    await run('npm', ['install']);
  } catch {
    console.error('\nnpm install failed — fix before creating the cloud environment.\n');
    process.exit(1);
  }

  console.log('\n2/3  Local secrets check (.dev.vars names only)…\n');
  const localKeys = new Set(parseDevVarKeys(join(root, '.dev.vars')));
  for (const name of REQUIRED_SECRETS) {
    console.log(`  ${name}: ${localKeys.has(name) ? 'found locally — paste same value in Dashboard → Secrets' : 'MISSING in .dev.vars'}`);
  }
  for (const name of OPTIONAL_SECRETS) {
    console.log(`  ${name} (optional): ${localKeys.has(name) ? 'found locally' : 'not in .dev.vars'}`);
  }
  console.log('\n  Remove from Dashboard if present:', REMOVE_SECRETS.join(', '));

  console.log('\n3/3  Dashboard — do these clicks now:\n');
  console.log('  A. Environments → Create environment → GitHub');
  console.log(`  B. Select ${REPO}, branch ${BRANCH}`);
  console.log('  C. Wait for install → Environment ready → Save snapshot');
  console.log('  D. Secrets tab → add OPENROUTER_API_KEY (+ CLOUDFLARE_API_TOKEN if deploy from cloud)');
  console.log('  E. Getting started → cloud item should show completed (4/4)\n');

  for (const url of DASHBOARD_URLS) {
    console.log(url);
  }
  openUrl(DASHBOARD_URLS[0]);

  console.log('\nDocs: docs/cursor-cloud-secrets.md\n');
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
