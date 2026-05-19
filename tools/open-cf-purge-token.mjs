/**
 * Open Cloudflare dashboard to create a Purge Cache API token.
 */
import { exec } from 'node:child_process';

const url = 'https://dash.cloudflare.com/profile/api-tokens?template=purge_cache';

console.log('Opening Cloudflare API token wizard (Purge Cache template)...');
console.log('After create: copy token once, then run:');
console.log('  npm run cf:set-purge-token -- <paste-token-here>');
console.log('  npm run cf:purge-cache');

const start =
  process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;

exec(start, error => {
  if (error) console.log(url);
});
