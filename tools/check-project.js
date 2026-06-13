import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outdatedCityPattern = new RegExp('\\b' + 'Ber' + 'lin' + '\\b', 'i');
const requiredFiles = [
  'index.html',
  'de/index.html',
  'en/index.html',
  'ru/index.html',
  'uk/index.html',
  'robots.txt',
  'sitemap.xml',
  'sitemap-brand.xml',
  'indexnow-key.txt',
  'favicon.ico',
  'site.webmanifest',
  '_headers',
  '_redirects',
  'wrangler.toml',
];

const indexFiles = ['index.html', 'de/index.html', 'en/index.html', 'ru/index.html', 'uk/index.html'];
const ignoredDirs = new Set(['.git', 'node_modules', 'dist', 'temp', 'tmp', 'test-results', '.wrangler']);
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) files.push(...walk(fullPath));
      continue;
    }

    if (entry.isFile()) files.push(fullPath);
  }

  return files;
}

for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(root, file)), `Missing required project file: ${file}`);
}

if (fs.existsSync(path.join(root, 'wrangler.toml'))) {
  const wrangler = read('wrangler.toml');
  assert(
    /pages_build_output_dir\s*=\s*"(dist|\.)"/.test(wrangler),
    'wrangler.toml must define pages_build_output_dir for Pages deploys'
  );
}

if (fs.existsSync(path.join(root, '_redirects'))) {
  const redirects = read('_redirects');
  for (const rule of [
    '/index.html / 301',
    '/de/index.html /de/ 301',
    '/en/index.html /en/ 301',
    '/ru/index.html /ru/ 301',
    '/uk/index.html /uk/ 301',
  ]) {
    assert(redirects.includes(rule), `_redirects missing canonical rule: ${rule}`);
  }
}

for (const file of indexFiles) {
  if (!fs.existsSync(path.join(root, file))) continue;

  const html = read(file);
  assert(html.includes('Leipzig'), `${file}: missing Leipzig geo signal`);
  assert(html.includes('"addressLocality": "Leipzig"'), `${file}: JSON-LD addressLocality must be Leipzig`);
  assert(html.includes('"streetAddress": "Untere-Eichstädtstraße 38"'), `${file}: JSON-LD streetAddress is missing`);
  assert(html.includes('"postalCode": "04299"'), `${file}: JSON-LD postalCode is missing`);
  assert(
    html.includes('/favicon.ico') || html.includes('/assets/images/favicon/favicon.ico'),
    `${file}: missing favicon.ico link`
  );
  assert(html.includes('/site.webmanifest'), `${file}: missing web manifest link`);
  assert(html.includes('search-logo-clear-512.png'), `${file}: missing transparent search logo structured signal`);

  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(match[1]);
    } catch (error) {
      failures.push(`${file}: invalid JSON-LD (${error.message})`);
    }
  }
}

if (fs.existsSync(path.join(root, 'robots.txt'))) {
  const robots = read('robots.txt');
  assert(robots.includes('Sitemap: https://hundesalon-nika.com/sitemap.xml'), 'robots.txt must point to sitemap.xml');
  assert(robots.includes('sitemap-brand.xml'), 'robots.txt must point to sitemap-brand.xml');
}

if (fs.existsSync(path.join(root, 'sitemap.xml'))) {
  const sitemap = read('sitemap.xml');
  for (const url of ['/de/', '/en/', '/ru/', '/uk/']) {
    assert(sitemap.includes(`https://hundesalon-nika.com${url}`), `sitemap.xml missing ${url}`);
  }
  assert(
    !sitemap.includes('<loc>https://hundesalon-nika.com/</loc>'),
    'sitemap.xml should not include the redirecting root URL'
  );
}

if (fs.existsSync(path.join(root, 'indexnow-key.txt'))) {
  const key = read('indexnow-key.txt').trim();
  assert(/^[a-f0-9]{32,128}$/i.test(key), 'indexnow-key.txt must contain a 32-128 character hex key');
  assert(read('_headers').includes('/indexnow-key.txt'), '_headers must include cache policy for indexnow-key.txt');
}

for (const file of [
  'assets/images/favicon-48x48.png',
  'assets/images/favicon-64x64.png',
  'assets/images/favicon-128x128.png',
  'assets/images/favicon-384x384.png',
  'assets/images/favicon-512x512.png',
  'assets/images/favicon-search-512.png',
  'assets/images/android-chrome-512x512.png',
  'assets/images/maskable-icon-512x512.png',
  'assets/images/mstile-150x150.png',
  'assets/images/search-logo-clear-512.png',
  'assets/images/social-preview-1200x630.png',
]) {
  assert(fs.existsSync(path.join(root, file)), `Missing brand search asset: ${file}`);
}

for (const file of walk(root)) {
  const relativePath = path.relative(root, file).replaceAll(path.sep, '/');
  if (relativePath.includes('node_modules/') || relativePath.includes('.git/')) continue;
  if (!/\.(?:html|xml|txt|js|css|md|json|toml|cjs|mjs)$/i.test(relativePath)) continue;

  const content = fs.readFileSync(file, 'utf8');
  const contentForCityCheck = content.replaceAll('Europe/Berlin', 'Europe/Timezone');
  if (outdatedCityPattern.test(contentForCityCheck)) failures.push(`${relativePath}: contains outdated city name`);
}

if (failures.length) {
  console.error('Project checks failed:');
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log('Project configuration checks passed.');
