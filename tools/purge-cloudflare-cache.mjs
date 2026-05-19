/**
 * Purge all Cloudflare cache for hundesalon-nika.com.
 */
import { spawn } from 'node:child_process';
import { DOMAIN, cloudflareApi, loadDevVars, resolvePurgeAuth, resolveZoneId } from './lib/cloudflare-auth.mjs';

async function runEnsurePurgeToken() {
  await new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'cf:ensure-purge-token'], {
      stdio: 'inherit',
      shell: true,
    });
    child.on('close', code => (code === 0 ? resolve() : reject(new Error('cf:ensure-purge-token failed'))));
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
    if (!process.env.CLOUDFLARE_API_TOKEN && !process.env.CLOUDFLARE_API_KEY) {
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
  console.error('Run: npm run cf:open-purge-token');
  process.exit(1);
});
