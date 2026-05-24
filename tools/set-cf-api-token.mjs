/**
 * Save and verify full zone API token.
 * npm run cf:set-api-token -- <token>
 */
import { printAudit, saveApiToken, verifyBearerToken } from './lib/cf-api-token.mjs';

const token = process.argv[2]?.trim();
if (!token) {
  console.error('Usage: npm run cf:set-api-token -- <CLOUDFLARE_API_TOKEN>');
  process.exit(1);
}

try {
  const { audit } = await verifyBearerToken(token);
  saveApiToken(token);
  console.log('CLOUDFLARE_API_TOKEN saved (.dev.vars + .cloudflare-api.token)\n');
  printAudit(audit);
} catch (error) {
  console.error(`Rejected: ${error.message}`);
  console.error('Create token: npm run cf:open-api-token');
  process.exit(1);
}
