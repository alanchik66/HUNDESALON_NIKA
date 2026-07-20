/**
 * Ensure HUNDESALON_NIKA — Automation token (zone + Pages deploy).
 * npm run cf:ensure-api-token
 */
import { spawn } from 'node:child_process';
import {
  TOKEN_NAME,
  auditToken,
  isUnifiedToken,
  isZoneToken,
  loadAllCredentials,
  printAudit,
  resolveCfAuth,
  resolveDeployToken,
} from './lib/cf-api-token.mjs';
import { resolveZoneId } from './lib/cloudflare-auth.mjs';

async function main() {
  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  loadAllCredentials();

  const auth = resolveCfAuth();
  if (!auth) {
    console.error('No Cloudflare credentials.');
    console.error('  npm run cf:open-unified-token');
    process.exit(1);
  }

  const zoneId = await resolveZoneId(auth);
  const audit = await auditToken(auth, zoneId);
  const deployToken = await resolveDeployToken();

  if (isUnifiedToken(audit) && deployToken) {
    console.log(`${TOKEN_NAME} OK (unified — zone + Pages deploy):\n`);
    printAudit(audit);
    if (!audit.zoneRules) {
      console.log('Optional: add Zone → Single Redirect → Edit in Dashboard for zone rulesets.');
    }
    return;
  }

  if (isZoneToken(audit)) {
    console.log(`${TOKEN_NAME} partial — zone OK, Pages deploy missing:\n`);
    printAudit(audit);
    console.log('');
    console.log('Fastest fix: edit the existing token in Dashboard');
    console.log('  → Add permission: Account → Cloudflare Pages → Edit');
    console.log('  → npm run cf:open-edit-token');
    console.log('');
    if (deployToken && deployToken !== auth.Authorization.replace('Bearer ', '')) {
      console.log('You still have a separate Pages token locally.');
      console.log('  npm run cf:consolidate-tokens');
    }
    if (process.stdin.isTTY) {
      spawn(npmCommand, ['run', 'cf:open-edit-token'], {
        cwd: process.cwd(),
        detached: true,
        stdio: 'ignore',
      }).unref();
    }
    process.exit(deployToken ? 0 : 1);
  }

  console.log('Current credentials incomplete:\n');
  printAudit(audit);
  console.log('');
  console.log('Create one unified token (automated):');
  console.log('  npm run cf:cleanup-dashboard-tokens');
  console.log('');
  console.log('Manual Dashboard (fixed template — no account picker):');
  console.log('  1. npm run cf:open-unified-token');
  console.log('  2. npm run cf:set-api-token -- <paste-token>');
  console.log('');
  console.log('Fastest if you already have Zone Ops token:');
  console.log('  npm run cf:open-edit-token');
  console.log('');

  if (process.stdin.isTTY) {
    spawn(npmCommand, ['run', 'cf:cleanup-dashboard-tokens'], {
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
