/**
 * Open Cloudflare WAF rate limiting rules in the browser.
 */
import { exec } from 'node:child_process';
import { ACCOUNT_ID, DOMAIN } from './lib/cloudflare-auth.mjs';

const url = `https://dash.cloudflare.com/${ACCOUNT_ID}/${DOMAIN}/security/waf/rate-limiting-rules`;

console.log('Opening Cloudflare WAF rate limiting rules…');
console.log('\nSuggested limits (POST, per IP, 60s): /sendmail 12, /message-draft 30, /seo-generate 8');

const start =
  process.platform === 'win32'
    ? `start "" "${url}"`
    : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;

exec(start, error => {
  if (error) console.log('Open the Cloudflare WAF rules page manually if the browser did not launch.');
});
