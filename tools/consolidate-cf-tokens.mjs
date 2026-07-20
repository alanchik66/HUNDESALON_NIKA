/**
 * Merge separate zone + Pages tokens into one local CLOUDFLARE_API_TOKEN.
 * npm run cf:consolidate-tokens
 */
import {
  TOKEN_NAME,
  auditToken,
  isUnifiedToken,
  listDeployTokenCandidates,
  loadAllCredentials,
  printAudit,
  resolveCfAuth,
  saveApiToken,
} from './lib/cf-api-token.mjs';
import { resolveZoneId } from './lib/cloudflare-auth.mjs';

loadAllCredentials();
const candidates = listDeployTokenCandidates();

if (candidates.length <= 1) {
  const auth = resolveCfAuth();
  if (!auth) {
    console.log('No Cloudflare tokens configured locally.');
    process.exit(1);
  }
  const zoneId = await resolveZoneId(auth);
  const audit = await auditToken(auth, zoneId);
  if (isUnifiedToken(audit)) {
    saveApiToken(candidates[0] || process.env.CLOUDFLARE_API_TOKEN);
    console.log(`${TOKEN_NAME} already unified locally.\n`);
    printAudit(audit);
    process.exit(0);
  }
  console.log('Single token found but not unified yet.');
  console.log('  npm run cf:open-edit-token → add Account → Cloudflare Pages → Edit');
  printAudit(audit);
  process.exit(1);
}

console.log(`Found ${candidates.length} different tokens locally.`);

for (const token of candidates) {
  const auth = { Authorization: `Bearer ${token}` };
  const zoneId = await resolveZoneId(auth).catch(() => null);
  if (!zoneId) continue;
  const audit = await auditToken(auth, zoneId);
  if (isUnifiedToken(audit)) {
    saveApiToken(token);
    console.log(`\n${TOKEN_NAME} consolidated to unified token.\n`);
    printAudit(audit);
    console.log('');
    console.log('Dashboard cleanup: delete redundant tokens (old Zone Ops / Pages Deploy / Agent).');
    process.exit(0);
  }
}

console.error('No candidate token covers zone + Pages deploy.');
console.error('Create unified token: npm run cf:open-unified-token');
process.exit(1);
