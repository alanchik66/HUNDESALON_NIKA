/**
 * Bing Webmaster URL Submission API (optional; IndexNow is primary).
 * Set BING_WEBMASTER_API_KEY in .dev.vars (Bing Webmaster → Settings → API Access).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBingApiKey, logBingApiNotConfigured } from './lib/bing-api.mjs';
import { SITE_URL } from './lib/bing-wmt.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteUrl = SITE_URL;
const listPath = path.join(root, 'tools', 'bing-submit-urls.txt');
const batchSize = 500;
const verbose = process.argv.includes('--verbose');

const apiKey = getBingApiKey();
if (!apiKey) {
  logBingApiNotConfigured({ verbose });
  process.exit(0);
}

if (!fs.existsSync(listPath)) {
  console.error(`Missing ${path.relative(root, listPath)}. Run npm run seo:indexnow first.`);
  process.exit(1);
}

const urlList = fs
  .readFileSync(listPath, 'utf8')
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(line => line.startsWith('https://'));

if (!urlList.length) {
  console.error('URL list is empty.');
  process.exit(1);
}

const endpoint = `https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlbatch?apikey=${encodeURIComponent(apiKey)}`;

for (let offset = 0; offset < urlList.length; offset += batchSize) {
  const batch = urlList.slice(offset, offset + batchSize);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ siteUrl, urlList: batch }),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error(`Bing URL API batch ${offset / batchSize + 1}: HTTP ${response.status}`);
    console.error(text.slice(0, 500));
    process.exit(1);
  }

  console.log(`Bing URL API accepted ${batch.length} URLs (batch ${offset / batchSize + 1}). HTTP ${response.status}`);
}

console.log(`Done. Submitted ${urlList.length} URLs to Bing Webmaster API.`);
