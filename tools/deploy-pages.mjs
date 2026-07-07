/**
 * Deploy dist/ to Cloudflare Pages via Wrangler OAuth.
 * Zone Ops API token (DNS, purge, rules) is intentionally omitted — it lacks Pages Edit.
 *
 * npm run deploy
 * node tools/deploy-pages.mjs [-- wrangler flags]
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadWranglerOAuth, refreshWranglerOAuth } from './lib/cloudflare-auth.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = 'dist';
const projectName = process.env.CLOUDFLARE_PAGES_PROJECT || 'hundesalon-nika';

async function ensureWranglerOAuth() {
  try {
    const stored = loadWranglerOAuth();
    await refreshWranglerOAuth(stored);
    return true;
  } catch (error) {
    console.error('Pages deploy requires Wrangler OAuth (Zone Ops token cannot upload Pages).');
    console.error('  npx wrangler login');
    if (error?.message) console.error(`  ${error.message}`);
    return false;
  }
}

/** Env for wrangler: no CLOUDFLARE_API_TOKEN so OAuth is used instead of Zone Ops. */
export function pagesDeployEnv(baseEnv = process.env) {
  const env = { ...baseEnv };
  delete env.CLOUDFLARE_API_TOKEN;
  return env;
}

function runWrangler(argv) {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  return spawnSync(npx, ['wrangler', ...argv], {
    cwd: root,
    env: pagesDeployEnv(),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

const isMain =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

async function deployPages(argv = process.argv.slice(2)) {
  if (!(await ensureWranglerOAuth())) {
    return 1;
  }

  if (!existsSync(path.join(root, distDir))) {
    console.error(`Missing ${distDir}/. Run: npm run build`);
    return 1;
  }

  const wranglerArgs = ['pages', 'deploy', distDir, '--project-name', projectName];

  if (!argv.some(arg => arg.startsWith('--commit-dirty'))) {
    wranglerArgs.push('--commit-dirty=true');
  }

  wranglerArgs.push(...argv);

  console.log('Pages deploy: Wrangler OAuth (CLOUDFLARE_API_TOKEN omitted for upload).\n');

  const result = runWrangler(wranglerArgs);
  return result.status ?? 1;
}

if (isMain) {
  process.exit(await deployPages());
}
