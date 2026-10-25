import { spawnSync } from 'node:child_process';
import { ACCOUNT_ID, loadWranglerOAuth, refreshWranglerOAuth } from './lib/cloudflare-auth.mjs';

if (!process.argv.includes('--apply')) throw new Error('Explicit --apply required');
await refreshWranglerOAuth(loadWranglerOAuth());
const env = { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID };
delete env.CLOUDFLARE_API_TOKEN;
const result = spawnSync(process.execPath, [
  'node_modules/wrangler/bin/wrangler.js', 'pages', 'deploy', 'dist',
  '--project-name', 'hundesalon-nika', '--branch', 'main', '--commit-dirty=true',
], { env, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
