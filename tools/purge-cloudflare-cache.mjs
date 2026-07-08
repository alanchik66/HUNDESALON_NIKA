/**
 * Purge all Cloudflare cache for hundesalon-nika.com.
 */
import { spawn } from 'node:child_process';
import {
  DOMAIN,
  cloudflareApi,
  loadDevVars,
  removeDevVar,
  resolvePurgeAuth,
  resolveZoneId,
} from './lib/cloudflare-auth.mjs';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

async function runEnsurePurgeToken() {
  await new Promise((resolve, reject) => {
    const child = spawn(npmCommand, ['run', 'cf:ensure-api-token'], {
      stdio: 'inherit',
    });
    child.on('close', code => (code === 0 ? resolve() : reject(new Error('cf:ensure-api-token failed'))));
  });
  loadDevVars();
}

async function purgeEverything() {
  const auth = resolvePurgeAuth();
  const zoneId = await resolveZoneId(auth);
  await cloudflareApi(auth, `/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    body: JSON.stringify({ purge_everything: true }),
  });
  console.log(`Purged Cloudflare cache for ${DOMAIN} (zone ${zoneId}).`);
}

async function main() {
  loadDevVars();
  try {
    await purgeEverything();
  } catch (error) {
    const msg = String(error.message || error);
    const badToken =
      process.env.CLOUDFLARE_API_TOKEN &&
      (msg.includes('Invalid request headers') ||
        msg.includes('Authentication error') ||
        msg.includes('Invalid API Token') ||
        msg.includes('Wrangler OAuth'));

    if (badToken) {
      removeDevVar('CLOUDFLARE_API_TOKEN');
    }

    if (!process.env.CLOUDFLARE_API_TOKEN?.trim()) {
      try {
        await runEnsurePurgeToken();
        await purgeEverything();
        return;
      } catch {
        // fall through
      }
    }
    throw error;
  }
}

main().catch(error => {
  console.error(error.message);
  console.error('Run: npm run cf:open-api-token');
  process.exit(1);
});
