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
  'llms.txt',
  'sitemap.xml',
  'sitemap-brand.xml',
  'indexnow-key.txt',
  'favicon.ico',
  'site.webmanifest',
  '_headers',
  '_redirects',
  'wrangler.toml',
  'assets/js/agent-tools.js',
  '.well-known/api-catalog',
  '.well-known/openapi.json',
  '.well-known/agent-skills/index.json',
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

if (fs.existsSync(path.join(root, 'workers/pages-proxy.js'))) {
  const workerConfigPath = path.join(root, 'workers/wrangler.toml');
  assert(fs.existsSync(workerConfigPath), 'Missing worker config: workers/wrangler.toml');

  if (fs.existsSync(workerConfigPath)) {
    const workerWrangler = read('workers/wrangler.toml');
    assert(
      /main\s*=\s*"pages-proxy\.js"/.test(workerWrangler),
      'workers/wrangler.toml must point main to pages-proxy.js'
    );
    assert(/routes\s*=\s*\[/.test(workerWrangler), 'workers/wrangler.toml must define routes');
  }
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
    '/ /de/ 301',
    '/index.html /de/ 301',
    '/de/index.html /de/ 301',
    '/en/index.html /en/ 301',
    '/ru/index.html /ru/ 301',
    '/uk/index.html /uk/ 301',
    '/assets/images/logo.png /assets/images/brand/logo.png 301',
    '/assets/images/gallery1.jpg /assets/images/hero/slide-01.jpg 301',
    '/assets/images/icon-pak/Gotovie iconki dlya saita/Home.png /assets/images/icons/home.png 301',
  ]) {
    assert(redirects.includes(rule), `_redirects missing canonical rule: ${rule}`);
  }
}

for (const file of indexFiles) {
  if (!fs.existsSync(path.join(root, file))) continue;

  // Skip root index.html - it's just a redirect
  if (file === 'index.html') continue;

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
  assert(html.includes('agent-tools.js'), `${file}: missing WebMCP agent tools script`);
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
  assert(robots.includes('llms.txt'), 'robots.txt should mention llms.txt for AI agents');
  assert(robots.includes('Content-Signal:'), 'robots.txt should declare Content-Signal preferences');
  assert(robots.includes('GPTBot'), 'robots.txt should include explicit AI bot rules');
}

if (fs.existsSync(path.join(root, 'llms.txt'))) {
  const llms = read('llms.txt');
  assert(llms.includes('https://hundesalon-nika.com/de/'), 'llms.txt must include the German landing page');
  assert(llms.includes('https://hundesalon-nika.com/en/'), 'llms.txt must include the English landing page');
  assert(llms.includes('https://hundesalon-nika.com/ru/'), 'llms.txt must include the Russian landing page');
  assert(llms.includes('https://hundesalon-nika.com/uk/'), 'llms.txt must include the Ukrainian landing page');
  assert(read('_headers').includes('/llms.txt'), '_headers must include cache policy for llms.txt');
}

if (fs.existsSync(path.join(root, '.well-known/api-catalog'))) {
  const catalog = JSON.parse(read('.well-known/api-catalog'));
  assert(Array.isArray(catalog.linkset), '.well-known/api-catalog must contain a linkset array');
  assert(read('_headers').includes('rel="api-catalog"'), '_headers must advertise the API catalog');
}

if (fs.existsSync(path.join(root, '.well-known/agent-skills/index.json'))) {
  const skills = JSON.parse(read('.well-known/agent-skills/index.json'));
  assert(Array.isArray(skills.skills), 'agent-skills index must contain a skills array');
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

for (let card = 1; card <= 9; card += 1) {
  const folder = `card-${String(card).padStart(2, '0')}`;
  for (const name of ['before.jpg', 'after.jpg']) {
    assert(
      fs.existsSync(path.join(root, 'assets/images/before-after', folder, name)),
      `Missing before-after asset: assets/images/before-after/${folder}/${name}`
    );
  }
}

for (const file of [
  'assets/images/favicon/favicon.ico',
  'assets/images/favicon/favicon-48x48.png',
  'assets/images/favicon/favicon-64x64.png',
  'assets/images/favicon/favicon-128x128.png',
  'assets/images/favicon/favicon-384x384.png',
  'assets/images/favicon/favicon-512x512.png',
  'assets/images/favicon/favicon-search-512.png',
  'assets/images/favicon/android-chrome-512x512.png',
  'assets/images/favicon/maskable-icon-512x512.png',
  'assets/images/favicon/mstile-150x150.png',
  'assets/images/brand/logo.png',
  'assets/images/brand/search-logo-clear-512.png',
  'assets/images/brand/social-preview-1200x630.png',
  'assets/images/hero/slide-01.jpg',
  'assets/images/icons/home.png',
]) {
  assert(fs.existsSync(path.join(root, file)), `Missing brand search asset: ${file}`);
}

for (const lang of ['de', 'en', 'ru', 'uk']) {
  const langDir = path.join(root, lang);
  if (!fs.existsSync(langDir)) continue;

  for (const file of walk(langDir)) {
    if (!file.endsWith('.html')) continue;

    const relativePath = path.relative(root, file).replaceAll(path.sep, '/');
    const content = fs.readFileSync(file, 'utf8');
    if (!content.includes('data-newsletter-form')) continue;

    assert(content.includes('newsletter-form__label'), `${relativePath}: missing newsletter-form__label`);
    assert(
      content.includes(`id="newsletter-email-${lang}"`),
      `${relativePath}: missing newsletter-email-${lang} input id`
    );
    assert(
      content.includes(`for="newsletter-email-${lang}"`),
      `${relativePath}: newsletter label for attribute must target newsletter-email-${lang}`
    );
  }
}

const staleImagePatterns = [
  { pattern: /icon-pak\/Gotovie iconki dlya saita/i, label: 'legacy icon-pak path' },
  { pattern: /\/assets\/images\/gallery[1-6]\.jpg/i, label: 'legacy gallery slide path' },
  { pattern: /\/assets\/images\/logo\.png/i, label: 'legacy root logo path' },
  { pattern: /gallery-before-\d+\.jpg/i, label: 'legacy before-after filename' },
];

const staleImageScanRoots = ['assets', 'de', 'en', 'ru', 'uk'];
const staleImageScanFiles = ['index.html', 'sw.js', 'sitemap-brand.xml'];

function collectStaleImageScanFiles() {
  const files = staleImageScanFiles
    .map(relativePath => path.join(root, relativePath))
    .filter(filePath => fs.existsSync(filePath));

  for (const scanRoot of staleImageScanRoots) {
    const absoluteRoot = path.join(root, scanRoot);
    if (!fs.existsSync(absoluteRoot)) continue;
    files.push(...walk(absoluteRoot));
  }

  return files;
}

for (const file of collectStaleImageScanFiles()) {
  const relativePath = path.relative(root, file).replaceAll(path.sep, '/');
  if (!/\.(?:html|xml|js|css)$/i.test(relativePath)) continue;

  const content = fs.readFileSync(file, 'utf8');
  for (const { pattern, label } of staleImagePatterns) {
    if (pattern.test(content)) {
      failures.push(`${relativePath}: contains ${label}`);
    }
  }
}

for (const file of walk(root)) {
  const relativePath = path.relative(root, file).replaceAll(path.sep, '/');
  if (relativePath.includes('node_modules/') || relativePath.includes('.git/')) continue;
  if (!/\.(?:html|xml|txt|js|css|md|json|toml|cjs|mjs)$/i.test(relativePath)) continue;

  const content = fs.readFileSync(file, 'utf8');
  const contentForCityCheck = content.replaceAll('Europe/Berlin', 'Europe/Timezone');
  if (outdatedCityPattern.test(contentForCityCheck)) failures.push(`${relativePath}: contains outdated city name`);

  if (/^(?:de|en|ru|uk)\/.+\.html$/i.test(relativePath) && content.includes('class="nav-main"')) {
    failures.push(
      `${relativePath}: contains static nav-main markup; run "npm run shell:strip" and rely on site-shell.js`
    );
  }
}

if (failures.length) {
  console.error('Project checks failed:');
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log('Project configuration checks passed.');
