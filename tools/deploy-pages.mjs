/**
 * Deploy dist/ to Cloudflare Pages.
 * Auth priority: unified CLOUDFLARE_API_TOKEN → legacy Pages token → Wrangler OAuth.
 *
 * npm run deploy
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ACCOUNT_ID, loadWranglerOAuth, refreshWranglerOAuth } from './lib/cloudflare-auth.mjs';
import {
  DEFAULT_PAGES_PROJECT,
  TOKEN_NAME,
  resolveDeployToken,
} from './lib/cf-api-token.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = 'dist';
const projectName = process.env.CLOUDFLARE_PAGES_PROJECT || DEFAULT_PAGES_PROJECT;

function runWrangler(argv, env) {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  return spawnSync(npx, ['wrangler', ...argv], {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

function runWranglerQuiet(argv, env) {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  return spawnSync(npx, ['wrangler', ...argv], {
    cwd: root,
    env,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
}

/** Env for wrangler pages deploy. */
export function pagesDeployEnv(baseEnv = process.env, token = '') {
  const env = {
    ...baseEnv,
    CLOUDFLARE_ACCOUNT_ID: baseEnv.CLOUDFLARE_ACCOUNT_ID || ACCOUNT_ID,
  };

  if (token) {
    env.CLOUDFLARE_API_TOKEN = token;
    return env;
  }

  delete env.CLOUDFLARE_API_TOKEN;
  return env;
}

async function ensureDeployCredentials() {
  const deployToken = await resolveDeployToken(projectName);
  if (deployToken) {
    console.log(`Pages deploy auth: ${TOKEN_NAME} (API token).\n`);
    return { mode: 'api-token', token: deployToken };
  }

  try {
    const stored = loadWranglerOAuth();
    await refreshWranglerOAuth(stored);
    console.log('Pages deploy auth: Wrangler OAuth (refreshed + saved).\n');
    return { mode: 'wrangler-oauth', token: '' };
  } catch (refreshError) {
    console.warn(`Wrangler OAuth refresh: ${refreshError.message}`);
    console.warn('Trying Wrangler CLI session...\n');
  }

  const whoami = runWranglerQuiet(['whoami'], pagesDeployEnv(process.env));
  if (whoami.status === 0) {
    console.log('Pages deploy auth: Wrangler OAuth (CLI session OK).\n');
    return { mode: 'wrangler-oauth', token: '' };
  }

  console.error('Pages deploy auth failed.');
  console.error('');
  console.error(`Create one token: ${TOKEN_NAME}`);
  console.error('  npm run cf:open-unified-token');
  console.error('  npm run cf:set-api-token -- <paste-token>');
  console.error('');
  console.error('Or extend the existing zone token: npm run cf:open-edit-token');
  console.error('  → add Account → Cloudflare Pages → Edit');
  console.error('');
  console.error('OAuth fallback: npx wrangler login');
  return null;
}

const isMain =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

async function deployPages(argv = process.argv.slice(2)) {
  const auth = await ensureDeployCredentials();
  if (!auth) return 1;

  if (!existsSync(path.join(root, distDir))) {
    console.error(`Missing ${distDir}/. Run: npm run build`);
    return 1;
  }

  const wranglerArgs = ['pages', 'deploy', distDir, '--project-name', projectName];
  if (!argv.some(arg => arg.startsWith('--commit-dirty'))) {
    wranglerArgs.push('--commit-dirty=true');
  }
  wranglerArgs.push(...argv);

  const result = runWrangler(wranglerArgs, pagesDeployEnv(process.env, auth.token));
  if (result.status === 0 && auth.mode === 'wrangler-oauth') {
    console.log('');
    console.log(`Tip: npm run cf:open-unified-token → cf:set-api-token for stable ${TOKEN_NAME}.`);
  }
  return result.status ?? 1;
}

if (isMain) {
  process.exit(await deployPages());
}

export { deployPages };
