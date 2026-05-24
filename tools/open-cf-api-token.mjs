/**
 * Open Cloudflare dashboard — create HUNDESALON — Zone API token.
 */
import { exec } from 'node:child_process';
import { TOKEN_NAME } from './lib/cf-api-token.mjs';

const url = 'https://dash.cloudflare.com/profile/api-tokens/create';

console.log(`Create custom token: ${TOKEN_NAME}`);
console.log('Zone resources: hundesalon-nika.com — include all:');
console.log('  • Zone → Zone → Read');
console.log('  • Zone → Cache Purge');
console.log('  • Zone → Page Rules → Edit');
console.log('  • Zone → Zone Rules → Edit');
console.log('');
console.log('Then: npm run cf:set-api-token -- <paste-token-once>');
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
