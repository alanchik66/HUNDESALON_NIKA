/**
 * Ensure Pages deploy credentials (uses unified CLOUDFLARE_API_TOKEN when possible).
 * npm run cf:ensure-pages-token
 */
import { spawn } from 'node:child_process';
import {
  TOKEN_NAME,
  loadAllCredentials,
  resolveDeployToken,
} from './lib/cf-api-token.mjs';
import { loadWranglerOAuth, refreshWranglerOAuth } from './lib/cloudflare-auth.mjs';

async function main() {
  loadAllCredentials();
  const deployToken = await resolveDeployToken();
  if (deployToken) {
    console.log(`${TOKEN_NAME} — Pages deploy OK`);
    return;
  }

  try {
    const stored = loadWranglerOAuth();
    await refreshWranglerOAuth(stored);
    console.log('Wrangler OAuth OK (fallback). Prefer one unified API token.');
    console.log('  npm run cf:open-unified-token');
    return;
  } catch {
    // fall through
  }

  console.error('No Pages deploy credentials.');
  console.error('  npm run cf:open-unified-token');
  console.error('  npm run cf:set-api-token -- <token>');

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  if (process.stdin.isTTY) {
    spawn(npmCommand, ['run', 'cf:open-unified-token'], {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
    }).unref();
  }

  process.exit(1);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
