/**
 * Save and verify Cloudflare Pages deploy token.
 * npm run cf:set-pages-token -- <CLOUDFLARE_PAGES_API_TOKEN>
 */
import { PAGES_TOKEN_NAME, savePagesDeployToken, verifyPagesDeployToken } from './lib/cf-pages-token.mjs';

const token = process.argv[2]?.trim();
if (!token) {
  console.error('Usage: npm run cf:set-pages-token -- <CLOUDFLARE_PAGES_API_TOKEN>');
  process.exit(1);
}

try {
  const { projectName, status } = await verifyPagesDeployToken(token);
  savePagesDeployToken(token);
  console.log(`${PAGES_TOKEN_NAME} saved (.dev.vars + .cloudflare-pages.token)\n`);
  console.log(`✓ Pages project: ${projectName}`);
  console.log(`✓ Token status: ${status}`);
  console.log('');
  console.log('Deploy will use this token instead of Wrangler OAuth.');
} catch (error) {
  console.error(`Rejected: ${error.message}`);
  console.error('Create token: npm run cf:open-pages-token');
  process.exit(1);
}
