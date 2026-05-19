/**
 * Save CLOUDFLARE_API_TOKEN to .dev.vars from CLI argument.
 * Usage: npm run cf:set-purge-token -- <token>
 */
import { upsertDevVar, loadDevVars, resolveZoneId } from './lib/cloudflare-auth.mjs';

const token = process.argv[2]?.trim();
if (!token) {
  console.error('Usage: npm run cf:set-purge-token -- <CLOUDFLARE_API_TOKEN>');
  process.exit(1);
}

try {
  const verify = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await verify.json();
  if (!verify.ok || !payload.success) {
    const msg = payload.errors?.[0]?.message || 'Invalid API Token';
    console.error(`Cloudflare rejected this token: ${msg}`);
    console.error('Create a new token: npm run cf:open-purge-token');
    process.exit(1);
  }
  await resolveZoneId({ Authorization: `Bearer ${token}` });
} catch (error) {
  console.error(`Token verification failed: ${error.message}`);
  console.error('Create a new token: npm run cf:open-purge-token');
  process.exit(1);
}

upsertDevVar('CLOUDFLARE_API_TOKEN', token);
console.log('CLOUDFLARE_API_TOKEN saved and verified (zone read + purge capable).');
