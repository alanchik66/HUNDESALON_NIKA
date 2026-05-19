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

upsertDevVar('CLOUDFLARE_API_TOKEN', token);
loadDevVars();

try {
  await resolveZoneId({ Authorization: `Bearer ${token}` });
  console.log('CLOUDFLARE_API_TOKEN saved and verified for zone lookup.');
} catch (error) {
  console.warn(`Token saved but zone lookup failed: ${error.message}`);
}
