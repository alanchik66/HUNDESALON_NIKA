import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://hundesalon-nika.com';
const brandIconVersion = '20260520-brand-bing';
const sitemapUrl = `${origin}/sitemap.xml`;
const reportPath = path.join(root, 'tools', 'google-search-console-report.json');
const urlListPath = path.join(root, 'tools', 'google-search-console-submit-urls.txt');

const requiredLiveUrls = [
  `${origin}/`,
  `${origin}/de/`,
  `${origin}/robots.txt`,
  sitemapUrl,
  `${origin}/google8f5e729bf8a13cc7.html`,
  `${origin}/assets/images/favicon/favicon.ico?v=${brandIconVersion}`,
  `${origin}/site.webmanifest?v=${brandIconVersion}`,
  `${origin}/assets/images/search-logo-clear-512.png?v=${brandIconVersion}`,
  `${origin}/assets/images/favicon/favicon-48x48.png?v=${brandIconVersion}`,
];

const indexUrls = [`${origin}/`, `${origin}/de/`, `${origin}/en/`, `${origin}/ru/`, `${origin}/uk/`];
const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'HUNDESALON-NIKA-GSC-Audit/1.0',
      'Cache-Control': 'no-cache',
    },
  });
  const text = await response.text();
  return { response, text };
}

async function checkStatus(url) {
  const { response } = await fetchText(url);
  if (!response.ok) fail(`${url}: HTTP ${response.status}`);
  return response;
}

function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>(https:\/\/hundesalon-nika\.com\/[^<]*)<\/loc>/g)]
    .map(match => match[1].trim())
    .filter(Boolean);
}

function groupBlocksWholeSite(robotsText, userAgent) {
  const groups = robotsText.split(/\r?\n\s*\r?\n/);
  return groups.some((group) => {
    const lines = group
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));

    const agents = lines
      .filter(line => /^User-agent:/i.test(line))
      .map(line => line.replace(/^User-agent:\s*/i, '').trim().toLowerCase());

    if (!agents.includes(userAgent.toLowerCase())) return false;

    return lines.some(line => /^Disallow:\s*\/\s*$/i.test(line));
  });
}

function parseJsonLd(html, url) {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!scripts.length) {
    fail(`${url}: missing JSON-LD`);
    return [];
  }

  return scripts.flatMap((match) => {
    try {
      const parsed = JSON.parse(match[1]);
      return Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed];
    } catch (error) {
      fail(`${url}: invalid JSON-LD (${error.message})`);
      return [];
    }
  });
}

function hasCanonical(html, url) {
  const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `<link[^>]*rel=["']canonical["'][^>]*href=["']${escaped}\\/?["'][^>]*>`,
    'i'
  ).test(html);
}

const robots = await fetchText(`${origin}/robots.txt`);
if (!robots.response.ok) fail(`robots.txt: HTTP ${robots.response.status}`);
if (!robots.text.includes(`Sitemap: ${sitemapUrl}`)) fail('robots.txt: missing sitemap directive');
if (groupBlocksWholeSite(robots.text, '*')) fail('robots.txt: wildcard group blocks the whole site');
if (groupBlocksWholeSite(robots.text, 'Googlebot')) fail('robots.txt: Googlebot group blocks the whole site');

const sitemap = await fetchText(sitemapUrl);
if (!sitemap.response.ok) fail(`sitemap.xml: HTTP ${sitemap.response.status}`);
const urls = sitemapUrls(sitemap.text);
fs.writeFileSync(urlListPath, `${urls.join('\n')}\n`, 'utf8');
if (urls.length < 5) fail('sitemap.xml: too few URLs found');
if (!urls.includes(`${origin}/de/`)) fail('sitemap.xml: missing default German page');
if (!urls.includes(`${origin}/ru/`) || !urls.includes(`${origin}/uk/`) || !urls.includes(`${origin}/en/`)) {
  fail('sitemap.xml: missing multilingual home pages');
}

for (const url of requiredLiveUrls) await checkStatus(url);

for (const url of urls) {
  const response = await checkStatus(url);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) continue;
}

for (const url of indexUrls) {
  const { response, text } = await fetchText(url);
  if (!response.ok) {
    fail(`${url}: HTTP ${response.status}`);
    continue;
  }

  if (!text.includes('Leipzig')) fail(`${url}: missing Leipzig signal`);
  if (new RegExp('\\b' + 'Ber' + 'lin' + '\\b', 'i').test(text)) fail(`${url}: contains outdated city signal`);
  if (!text.includes('/assets/images/favicon/favicon.ico')) fail(`${url}: missing root favicon link`);
  if (!text.includes('/site.webmanifest')) fail(`${url}: missing manifest link`);
  if (!text.includes('search-logo-clear-512.png')) fail(`${url}: missing search logo signal`);
  if (!text.includes('social-preview-1200x630.png')) warn(`${url}: missing social preview image`);
  if (!hasCanonical(text, url)) warn(`${url}: canonical differs from requested URL`);

  const graph = parseJsonLd(text, url);
  const types = graph.map(node => node?.['@type']).filter(Boolean);
  if (!types.includes('Organization')) fail(`${url}: missing Organization structured data`);
  if (!types.includes('WebSite')) fail(`${url}: missing WebSite structured data`);
  if (!types.includes('LocalBusiness')) fail(`${url}: missing LocalBusiness structured data`);

  const business = graph.find(node => node?.['@type'] === 'LocalBusiness');
  if (business?.address?.addressLocality !== 'Leipzig') fail(`${url}: LocalBusiness addressLocality is not Leipzig`);
  if (!JSON.stringify(business?.logo || '').includes('search-logo-clear-512.png')) fail(`${url}: LocalBusiness logo is not the search logo`);
}

const report = {
  generatedAt: new Date().toISOString(),
  property: 'sc-domain:hundesalon-nika.com',
  sitemap: sitemapUrl,
  urlCount: urls.length,
  checks: {
    requiredLiveUrls,
    indexUrls,
  },
  warnings,
  failures,
};

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (failures.length) {
  console.error('Google Search Console readiness audit failed:');
  for (const message of failures) console.error(`  ${message}`);
  console.error(`Report: ${path.relative(root, reportPath)}`);
  process.exit(1);
}

console.log(`Google Search Console readiness passed for ${urls.length} sitemap URLs.`);
if (warnings.length) {
  console.log('Warnings:');
  for (const message of warnings) console.log(`  ${message}`);
}
console.log(`URL list: ${path.relative(root, urlListPath)}`);
console.log(`Report: ${path.relative(root, reportPath)}`);
