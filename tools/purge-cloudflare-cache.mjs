/**
 * Purge all Cloudflare cache for hundesalon-nika.com.
 * Uses CLOUDFLARE_API_TOKEN from .dev.vars (zone token with Cache Purge).
 */
import { spawn } from 'node:child_process';
import { DOMAIN, cloudflareApi, loadDevVars, resolveZoneId } from './lib/cloudflare-auth.mjs';

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

async function purgeEverything(token) {
  const zoneId = await resolveZoneId(token);
  await cloudflareApi(token, `/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    body: JSON.stringify({ purge_everything: true }),
  });
  console.log(`Purged Cloudflare cache for ${DOMAIN} (zone ${zoneId}).`);
}

async function main() {
  loadDevVars();
  let token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!token) {
    await runEnsurePurgeToken();
    token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  }

  try {
    await purgeEverything(token);
  } catch (error) {
    if (!/purge_cache|Authentication error|not allowed/i.test(error.message)) {
      throw error;
    }
    console.warn('Purge failed with current token; creating a zone Cache Purge token...');
    await runEnsurePurgeToken();
    token = process.env.CLOUDFLARE_API_TOKEN?.trim();
    if (!token) throw new Error('CLOUDFLARE_API_TOKEN missing after ensure step');
    await purgeEverything(token);
  }
}

main().catch(error => {
  console.error(error.message);
  if (/purge_cache|Authentication error|not allowed/i.test(error.message)) {
    console.error('');
    console.error('Run: npm run cf:ensure-purge-token');
    console.error('Or set CLOUDFLARE_API_TOKEN in .dev.vars with Zone → Cache Purge.');
    console.error('See docs/cloudflare-caching.md');
  }
  process.exit(1);
});
