/**
 * Open Cloudflare dashboard — pre-filled HUNDESALON_NIKA — Automation token.
 * npm run cf:open-unified-token
 */
import { exec } from 'node:child_process';
import { ACCOUNT_ID, DOMAIN } from './lib/cloudflare-auth.mjs';
import {
  TOKEN_NAME,
  unifiedTokenProfileTemplateUrl,
  unifiedTokenTemplateUrl,
} from './lib/cf-api-token.mjs';

const url = unifiedTokenTemplateUrl();
const fallbackUrl = unifiedTokenProfileTemplateUrl();

console.log(`Create one token: ${TOKEN_NAME}`);
console.log(`Account: HUNDESALON_NIKA (${ACCOUNT_ID})`);
console.log(`Zone: ${DOMAIN}`);
console.log('');
console.log('Opens account-scoped template (no account picker).');
console.log('If the page is blank, use the profile fallback URL printed below.');
console.log('');
console.log('Pre-filled permissions:');
console.log('  • Account → Cloudflare Pages → Edit');
console.log('  • Zone → DNS → Edit');
console.log('  • Zone → Zone → Read');
console.log('  • Zone → Page Rules → Edit');
console.log('  • Zone → Cache Purge → Purge');
console.log('');
console.log('After create: npm run cf:set-api-token -- <paste-token-once>');
console.log('Automated path: npm run cf:cleanup-dashboard-tokens');
console.log('');
console.log('Profile fallback (accountId=*):');
console.log(fallbackUrl);
console.log('');

const start =
  process.platform === 'win32'
    ? `start "" "${url}"`
    : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;

exec(start, error => {
  if (error) console.log(url);
});
