import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteHost = 'hundesalon-nika.com';
const wwwHost = `www.${siteHost}`;
const apexOrigin = `https://${siteHost}`;
const wwwOrigin = `https://${wwwHost}`;
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

function toWwwUrl(url) {
  return url.startsWith(apexOrigin) ? `${wwwOrigin}${url.slice(apexOrigin.length)}` : url;
}

function uniqueUrls(urls) {
  return [...new Set(urls)].sort((a, b) => {
    const priority = url => {
      const path = url.replace(/^https:\/\/(www\.)?hundesalon-nika\.com/, '');
      if (path === '/') return 0;
      if (/\/(?:de|en|ru|uk)\/$/.test(path)) return 1;
      if (/\/kontakty\.html$/.test(path)) return 2;
      if (/\/onlayn-bronirovanie\.html$/.test(path)) return 3;
      if (/\/prays-list\.html$/.test(path)) return 4;
      return url.includes('www.') ? 6 : 5;
    };

    return priority(a) - priority(b) || a.localeCompare(b);
  });
}

async function submitIndexNow({ host, key, urlList }) {
  const payload = {
    host,
    key,
    keyLocation: `https://${host}/${keyFile}`,
    urlList,
  };
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });
  const responseText = await response.text();
  if (!response.ok) {
    console.error(`IndexNow failed for ${host}: HTTP ${response.status}`);
    if (responseText.trim()) console.error(responseText);
    return false;
  }
  console.log(`IndexNow accepted ${urlList.length} URLs for ${host}. HTTP ${response.status}`);
  if (responseText.trim()) console.log(responseText);
  return true;
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

function getBrandSitemapUrls() {
  const brandPath = path.join(root, 'sitemap-brand.xml');
  if (!fs.existsSync(brandPath)) return [];
  const xml = fs.readFileSync(brandPath, 'utf8');
  return [...xml.matchAll(/<loc>(https:\/\/hundesalon-nika\.com\/[^<]*)<\/loc>/g)].map(m => m[1].trim());
}

const apexList = uniqueUrls([...getSitemapUrls(), ...getBrandSitemapUrls()]);
const wwwList = apexList.map(toWwwUrl);
const urlList = uniqueUrls([...apexList, ...wwwList]);
fs.writeFileSync(manualListPath, `${urlList.join('\n')}\n`, 'utf8');

if (isDryRun) {
  console.log(`Prepared ${apexList.length} apex + ${wwwList.length} www = ${urlList.length} URLs.`);
  console.log(`Manual Bing list: ${path.relative(root, manualListPath)}`);
  console.log(`Apex key: https://${siteHost}/${keyFile}`);
  console.log(`WWW key: https://${wwwHost}/${keyFile} (301 → apex)`);
  console.log(urlList.join('\n'));
  process.exit(0);
}

const apexOk = await submitIndexNow({ host: siteHost, key, urlList: apexList });
const wwwOk = await submitIndexNow({ host: wwwHost, key, urlList: wwwList });

if (!apexOk || !wwwOk) process.exit(1);
console.log(`Done: ${apexList.length} apex + ${wwwList.length} www URLs notified via IndexNow.`);
