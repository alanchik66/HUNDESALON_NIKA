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
import { assertManualReleaseState, prepareManualRelease, runManualReleaseCommand } from './lib/manual-release-guard.mjs';
import { prepareProductionRelease, resolveWeatherReleaseAssets, verifyProductionArtifact, verifyProductionRelease } from './lib/production-release-verification.mjs';
import {
  DEFAULT_PAGES_PROJECT,
  TOKEN_NAME,
  resolveDeployToken,
} from './lib/cf-api-token.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = 'dist';
const projectName = process.env.CLOUDFLARE_PAGES_PROJECT || DEFAULT_PAGES_PROJECT;
const localWrangler = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');

function wranglerCommand(argv) {
  if (existsSync(localWrangler)) {
    return {
      command: process.execPath,
      args: [localWrangler, ...argv],
      shell: false,
    };
  }

  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  return {
    command: npx,
    args: ['wrangler', ...argv],
    shell: process.platform === 'win32',
  };
}

function runWrangler(argv, env) {
  const command = wranglerCommand(argv);
  return spawnSync(command.command, command.args, {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: command.shell,
  });
}

function runWranglerQuiet(argv, env) {
  const command = wranglerCommand(argv);
  return spawnSync(command.command, command.args, {
    cwd: root,
    env,
    encoding: 'utf8',
    shell: command.shell,
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

async function deployPages(argv = process.argv.slice(2), {
  run = runManualReleaseCommand, authenticate = ensureDeployCredentials, upload = runWrangler,
  prepareRelease = prepareProductionRelease, verifyArtifact = verifyProductionArtifact, resolveAssets = resolveWeatherReleaseAssets,
  verifyPublished = verifyProductionRelease,
} = {}) {
  try {
    const release = prepareManualRelease({ root, argv, run, prepareRelease, verifyArtifact, resolveAssets });
    const auth = await authenticate();
    if (!auth) return 1;
    // Credentials may take time to refresh; reject changes or a CI race before uploading.
    assertManualReleaseState({ root, run, commit: release.commit });
    verifyArtifact({ directory: release.directory, manifest: release.manifest, commit: release.commit, stamp: release.stamp,
      requiredAssets: release.requiredAssets });
    const wranglerArgs = ['pages', 'deploy', distDir, '--project-name', projectName,
      '--branch', 'main', '--commit-hash', release.commit, '--commit-dirty=false'];
    const result = upload(wranglerArgs, pagesDeployEnv(process.env, auth.token));
    if (result.status !== 0) return result.status ?? 1;
    await verifyPublished({ commit: release.commit, manifest: release.manifest, requiredAssets: release.requiredAssets });
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

if (isMain) {
  process.exit(await deployPages());
}

export { deployPages };
