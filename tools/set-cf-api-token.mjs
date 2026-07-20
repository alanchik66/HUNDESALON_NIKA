/**
 * Save and verify unified Cloudflare automation token.
 * npm run cf:set-api-token -- <CLOUDFLARE_API_TOKEN>
 */
import {
  TOKEN_NAME,
  isUnifiedToken,
  printAudit,
  saveApiToken,
  verifyBearerToken,
} from './lib/cf-api-token.mjs';

const token = process.argv[2]?.trim();
if (!token) {
  console.error('Usage: npm run cf:set-api-token -- <CLOUDFLARE_API_TOKEN>');
  process.exit(1);
}

try {
  const { audit } = await verifyBearerToken(token, { requirePages: false });
  saveApiToken(token, { syncPagesAlias: isUnifiedToken(audit) });
  console.log(`${TOKEN_NAME} saved (.dev.vars + .cloudflare-api.token)\n`);
  printAudit(audit);
  if (!audit.pagesDeploy) {
    console.log('');
    console.log('Zone OK. Add Account → Cloudflare Pages → Edit, then rerun set-api-token.');
    console.log('  npm run cf:open-edit-token');
  }
} catch (error) {
  console.error(`Rejected: ${error.message}`);
  console.error('Create token: npm run cf:open-unified-token');
  process.exit(1);
}
