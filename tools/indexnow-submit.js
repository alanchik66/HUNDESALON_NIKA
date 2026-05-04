import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteHost = 'hundesalon-nika.com';
const keyFile = 'indexnow-key.txt';
const keyPath = path.join(root, keyFile);
const sitemapPath = path.join(root, 'sitemap.xml');
const manualListPath = path.join(root, 'tools', 'bing-submit-urls.txt');
const endpoint = 'https://api.indexnow.org/IndexNow';
const isDryRun = process.argv.includes('--dry-run');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function getSitemapUrls() {
  const sitemap = read('sitemap.xml');
  return [...sitemap.matchAll(/<loc>(https:\/\/hundesalon-nika\.com\/[^<]*)<\/loc>/g)]
    .map(match => match[1].trim())
    .filter(Boolean);
}

function uniqueUrls(urls) {
  return [...new Set(urls)].sort((a, b) => {
    const priority = url => {
      if (url === 'https://hundesalon-nika.com/') return 0;
      if (/\/(?:de|en|ru|uk)\/$/.test(url)) return 1;
      if (/\/kontakty\.html$/.test(url)) return 2;
      if (/\/onlayn-bronirovanie\.html$/.test(url)) return 3;
      if (/\/prays-list\.html$/.test(url)) return 4;
      return 5;
    };

    return priority(a) - priority(b) || a.localeCompare(b);
  });
}

if (!fs.existsSync(keyPath)) {
  console.error(`Missing ${keyFile}. Generate it before submitting URLs.`);
  process.exit(1);
}

if (!fs.existsSync(sitemapPath)) {
  console.error('Missing sitemap.xml. Cannot build URL submission list.');
  process.exit(1);
}

const key = fs.readFileSync(keyPath, 'utf8').trim();
if (!/^[a-f0-9]{32,128}$/i.test(key)) {
  console.error(`${keyFile} must contain a 32-128 character hex key.`);
  process.exit(1);
}

const urlList = uniqueUrls(getSitemapUrls());
fs.writeFileSync(manualListPath, `${urlList.join('\n')}\n`, 'utf8');

const payload = {
  host: siteHost,
  key,
  keyLocation: `https://${siteHost}/${keyFile}`,
  urlList,
};

if (isDryRun) {
  console.log(`Prepared ${urlList.length} URLs for Bing/IndexNow.`);
  console.log(`Manual Bing list: ${path.relative(root, manualListPath)}`);
  console.log(`Key location: ${payload.keyLocation}`);
  console.log(urlList.join('\n'));
  process.exit(0);
}

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
  },
  body: JSON.stringify(payload),
});

const responseText = await response.text();
if (!response.ok) {
  console.error(`IndexNow submission failed: HTTP ${response.status}`);
  if (responseText.trim()) console.error(responseText);
  process.exit(1);
}

console.log(`IndexNow accepted ${urlList.length} URLs. HTTP ${response.status}`);
if (responseText.trim()) console.log(responseText);
