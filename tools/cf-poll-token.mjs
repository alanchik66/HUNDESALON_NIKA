/** Poll until Zone Rules Edit appears or timeout. npm run cf:poll-token */
import { auditToken, isFullToken, loadAllCredentials, printAudit, resolveCfAuth } from './lib/cf-api-token.mjs';
import { resolveZoneId } from './lib/cloudflare-auth.mjs';

const maxMin = Number(process.argv[2] || 3);
loadAllCredentials();
const auth = resolveCfAuth();
const zoneId = await resolveZoneId(auth);

for (let i = 0; i < maxMin * 4; i++) {
  const audit = await auditToken(auth, zoneId);
  if (isFullToken(audit)) {
    console.log('Token complete:\n');
    printAudit(audit);
    process.exit(0);
  }
  console.log(`[${i + 1}]`, new Date().toISOString().slice(11, 19));
  printAudit(audit);
  await new Promise(r => setTimeout(r, 15000));
}
process.exit(1);
