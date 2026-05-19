/**
 * Open Cloudflare CSAM onboarding (email verify + Submit).
 */
import { exec } from 'node:child_process';
import { ACCOUNT_ID, DOMAIN } from './lib/cloudflare-auth.mjs';

const url = `https://dash.cloudflare.com/${ACCOUNT_ID}/${DOMAIN}/caching/configuration/csam`;

console.log('CSAM setup:', url);
console.log('1) Set notify email: info@hundesalon-nika.com (forwards via Email Routing)');
console.log('2) Confirm verification link from Cloudflare (inbox for info@ or forwarded Gmail)');
console.log('3) Return to the page and click Submit (Absenden)');

const start =
  process.platform === 'win32'
    ? `start "" "${url}"`
    : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;

exec(start, error => {
  if (error) console.log(url);
});
