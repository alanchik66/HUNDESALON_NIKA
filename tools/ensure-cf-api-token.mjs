/**
 * Ensure one Cloudflare API token with purge + zone/page rules for hundesalon-nika.com.
 * npm run cf:ensure-api-token
 */
import { exec } from 'node:child_process';
import {
  auditToken,
  createFullZoneToken,
  EXISTING_PURGE_TOKEN_ID,
  isFullToken,
  loadAllCredentials,
  loadGlobalKeyFile,
  printAudit,
  resolveCfAuth,
  saveApiToken,
  upgradeExistingZoneToken,
} from './lib/cf-api-token.mjs';
import { getCloudflareAuthHeaders, resolveZoneId } from './lib/cloudflare-auth.mjs';

async function main() {
  loadAllCredentials();
  loadGlobalKeyFile();

  const auth = resolveCfAuth();
  if (!auth) {
    console.error('No Cloudflare credentials.');
    console.error('  npm run cf:open-api-token');
    process.exit(1);
  }

  const zoneId = await resolveZoneId(auth);
  let audit = await auditToken(auth, zoneId);

  if (isFullToken(audit)) {
    console.log(`${'HUNDESALON — Zone API'} token OK:\n`);
    printAudit(audit);
    return;
  }

  console.log('Current credentials incomplete:\n');
  printAudit(audit);
  console.log('');

  const globalAuth = getCloudflareAuthHeaders();
  if (globalAuth?.['X-Auth-Key']) {
    if (audit.zoneRead && audit.cachePurge && audit.pageRules && !audit.zoneRules) {
      console.log(`Upgrading token ${EXISTING_PURGE_TOKEN_ID} (add Zone Rules Edit)…`);
      await upgradeExistingZoneToken(globalAuth, EXISTING_PURGE_TOKEN_ID, zoneId);
      audit = await auditToken(auth, zoneId);
      if (isFullToken(audit)) {
        console.log('\nExisting token upgraded:\n');
        printAudit(audit);
        return;
      }
    }

    console.log('Creating full zone token via Global API Key…');
    const created = await createFullZoneToken(globalAuth, zoneId);
    if (!created?.value) throw new Error('Token creation returned no value');
    saveApiToken(created.value);
    audit = await auditToken({ Authorization: `Bearer ${created.value}` }, zoneId);
    if (!isFullToken(audit)) throw new Error('Created token still missing permissions');
    console.log('\nSaved CLOUDFLARE_API_TOKEN to .dev.vars and .cloudflare-api.token\n');
    printAudit(audit);
    return;
  }

  if (audit.zoneRead && audit.cachePurge && audit.pageRules && !audit.zoneRules) {
    console.log('Fastest fix: edit your existing token in Dashboard');
    console.log('  → Add: Zone → Zone Rules → Edit');
    console.log('  → npm run cf:open-edit-token');
    console.log('');
    if (process.stdin.isTTY) {
      exec('npm run cf:open-edit-token', { shell: true, cwd: process.cwd() });
    }
  }

  console.log('Or create new full token:');
  console.log('  1. npm run cf:open-api-token');
  console.log('  2. Zone Read + Cache Purge + Page Rules Edit + Zone Rules Edit');
  console.log('  3. npm run cf:set-api-token -- <paste-token>');
  console.log('');
  console.log('Or: .cloudflare-global.json → npm run cf:ensure-api-token');

  if (process.stdin.isTTY) {
    exec('npm run cf:open-api-token', { shell: true, cwd: process.cwd() });
  }

  process.exit(1);
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
