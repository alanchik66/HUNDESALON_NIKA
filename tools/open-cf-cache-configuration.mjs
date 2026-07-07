/**
 * Open Cloudflare Caching → Configuration (Crawler Hints, CSAM) in the browser.
 */
import { exec } from 'node:child_process';
import { ACCOUNT_ID, DOMAIN } from './lib/cloudflare-auth.mjs';

const url = `https://dash.cloudflare.com/${ACCOUNT_ID}/${DOMAIN}/caching/configuration`;

console.log('Opening Cloudflare cache configuration…');
console.log('\nEnable: Crawler Hints (toggle), CSAM Scanning Tool (Configure → verify email → Submit)');

const start =
  process.platform === 'win32'
    ? `start "" "${url}"`
    : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;

exec(start, error => {
  if (error) console.log('Open the Cloudflare cache configuration page manually if the browser did not launch.');
});
