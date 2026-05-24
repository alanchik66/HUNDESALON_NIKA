/**
 * Open Cloudflare dashboard to add www robots.txt → apex redirect.
 */
import { exec } from 'node:child_process';
import { loadDevVars } from './lib/cloudflare-auth.mjs';

loadDevVars();
const zone = process.env.CLOUDFLARE_ZONE_ID || '1c3c0c22d2414f5fbc37dd25b5e96af6';
const url = `https://dash.cloudflare.com/${process.env.CLOUDFLARE_ACCOUNT_ID || '25e872aeab8cb246c69142ab07cd0fee'}/${zone}/rules/redirect-rules/new`;

console.log('Create redirect rule:');
console.log('  If: Host equals www.hundesalon-nika.com AND URI Path equals /robots.txt');
console.log('  Then: Static redirect → https://hundesalon-nika.com/robots.txt (301)');
console.log('');
console.log('Or use API token with Zone Rules Edit + run: npm run cf:www-robots-redirect');
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
