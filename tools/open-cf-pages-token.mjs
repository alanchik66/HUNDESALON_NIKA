/**
 * Open Cloudflare dashboard — pre-filled HUNDESALON_NIKA — Pages Deploy token.
 */
import { exec } from 'node:child_process';
import { ACCOUNT_ID } from './lib/cloudflare-auth.mjs';
import { PAGES_TOKEN_NAME, pagesTokenTemplateUrl } from './lib/cf-pages-token.mjs';

const url = pagesTokenTemplateUrl();

console.log(`Create token: ${PAGES_TOKEN_NAME}`);
console.log(`Account: HUNDESALON_NIKA (${ACCOUNT_ID})`);
console.log('Permission: Account → Cloudflare Pages → Edit (pre-filled)');
console.log('');
console.log('Then: npm run cf:set-pages-token -- <paste-token-once>');
console.log('Or auto: npm run cf:bootstrap-pages-token');
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
