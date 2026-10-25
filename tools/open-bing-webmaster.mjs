/**
 * Open Bing Webmaster Tools (URL submit + IndexNow + URL Inspection).
 */
import { exec } from 'node:child_process';

const site = encodeURIComponent('https://hundesalon-nika.com/');
const urls = [
  `https://www.bing.com/webmasters/home?siteUrl=${site}`,
  `https://www.bing.com/webmasters/urlinspection?siteUrl=${site}`,
  `https://www.bing.com/webmasters/indexnow?siteUrl=${site}`,
];

console.log('Opening Bing Webmaster Tools…\n');
for (const url of urls) {
  const start =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(start);
}

console.log('\nAPI key: Settings -> API access -> API Key.');
console.log('Safe automation: npm run bing:api:setup');
console.log('Explicit key creation: npm run bing:api:setup -- --generate');
console.log('Priority: URL Inspection → https://hundesalon-nika.com/de/ → Request indexing');
