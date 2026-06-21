/**
 * Ensure one Cloudflare API token with purge + zone/page rules for hundesalon-nika.com.
 * npm run cf:ensure-api-token
 */
import { exec } from 'node:child_process';
import {
  auditToken,
  isFullToken,
  loadAllCredentials,
  printAudit,
  resolveCfAuth,
} from './lib/cf-api-token.mjs';
import { resolveZoneId } from './lib/cloudflare-auth.mjs';

async function main() {
  loadAllCredentials();

  const auth = resolveCfAuth();
  if (!auth) {
    console.error('No Cloudflare credentials.');
    console.error('  npm run cf:open-api-token');
    process.exit(1);
  }

  const zoneId = await resolveZoneId(auth);
  let audit = await auditToken(auth, zoneId);

  if (isFullToken(audit)) {
    console.log('HUNDESALON_NIKA — Zone Ops token OK:\n');
    printAudit(audit);
    return;
  }

  console.log('Current credentials incomplete:\n');
  printAudit(audit);
  console.log('');

  if (audit.zoneRead && audit.cachePurge && audit.pageRules && (!audit.zoneRules || !audit.dnsWrite)) {
    console.log('Fastest fix: edit your existing token in Dashboard');
    if (!audit.dnsWrite) console.log('  → Add: Zone → DNS → Edit');
    if (!audit.zoneRules) console.log('  → Add: Zone → Zone Rules → Edit');
    console.log('  → npm run cf:open-edit-token');
    console.log('');
    if (process.stdin.isTTY) {
      exec('npm run cf:open-edit-token', { shell: true, cwd: process.cwd() });
    }
  }

  console.log('Or create new full token:');
  console.log('  1. npm run cf:open-api-token');
  console.log('  2. Zone Read + DNS Records Edit + Cache Purge + Page Rules Edit + Zone Rules Edit');
  console.log('  3. npm run cf:set-api-token -- <paste-token>');
  console.log('');

  if (process.stdin.isTTY) {
    exec('npm run cf:open-api-token', { shell: true, cwd: process.cwd() });
  }

  process.exit(1);
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
