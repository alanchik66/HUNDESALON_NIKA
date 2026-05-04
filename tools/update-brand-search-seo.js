import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const domain = 'https://hundesalon-nika.com';
const brandIconVersion = '20260429-full-logo';
const searchLogo = `${domain}/assets/images/search-logo-clear-512.png?v=${brandIconVersion}`;
const socialPreview = `${domain}/assets/images/social-preview-1200x630.png`;

const skipDirs = new Set(['.git', 'node_modules', 'dist', 'temp', 'tmp', 'test-results', '.wrangler']);
const indexFiles = ['index.html', 'de/index.html', 'en/index.html', 'ru/index.html', 'uk/index.html'];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) files.push(...walk(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.html') && !entry.name.startsWith('google')) {
      files.push(fullPath);
    }
  }

  return files;
}

function buildBrandHeadBlock(indent) {
  const v = brandIconVersion;
  return [
    `${indent}<link rel="icon" href="/favicon.ico?v=${v}" sizes="any">`,
    `${indent}<link rel="icon" type="image/png" sizes="16x16" href="/assets/images/favicon-16x16.png?v=${v}">`,
    `${indent}<link rel="icon" type="image/png" sizes="32x32" href="/assets/images/favicon-32x32.png?v=${v}">`,
    `${indent}<link rel="icon" type="image/png" sizes="48x48" href="/assets/images/favicon-48x48.png?v=${v}">`,
    `${indent}<link rel="icon" type="image/png" sizes="64x64" href="/assets/images/favicon-64x64.png?v=${v}">`,
    `${indent}<link rel="icon" type="image/png" sizes="96x96" href="/assets/images/favicon-96x96.png?v=${v}">`,
    `${indent}<link rel="icon" type="image/png" sizes="128x128" href="/assets/images/favicon-128x128.png?v=${v}">`,
    `${indent}<link rel="icon" type="image/png" sizes="192x192" href="/assets/images/android-chrome-192x192.png?v=${v}">`,
    `${indent}<link rel="icon" type="image/png" sizes="256x256" href="/assets/images/favicon-256x256.png?v=${v}">`,
    `${indent}<link rel="icon" type="image/png" sizes="384x384" href="/assets/images/favicon-384x384.png?v=${v}">`,
    `${indent}<link rel="icon" type="image/png" sizes="512x512" href="/assets/images/favicon-search-512.png?v=${v}">`,
    `${indent}<link rel="apple-touch-icon" sizes="180x180" href="/assets/images/apple-touch-icon.png?v=${v}">`,
    `${indent}<link rel="manifest" href="/site.webmanifest?v=${v}">`,
    `${indent}<meta name="msapplication-TileColor" content="#0f6d66">`,
    `${indent}<meta name="msapplication-TileImage" content="/assets/images/mstile-150x150.png?v=${v}">`,
    `${indent}<meta name="msapplication-config" content="/browserconfig.xml">`,
  ].join('\n');
}

function normalizeBrandHead(html) {
  let next = html
    .replace(/\s*<link\s+rel=["'](?:shortcut icon|icon|apple-touch-icon|apple-touch-icon-precomposed|mask-icon)["'][^>]*>\s*/gim, '\n')
    .replace(/\s*<link\s+rel=["']manifest["'][^>]*>\s*/gim, '\n')
    .replace(/\s*<meta\s+name=["']msapplication-(?:TileColor|TileImage|config)["'][^>]*>\s*/gim, '\n');

  const themeMatch = next.match(/^([ \t]*)<meta\s+name=["']theme-color["'][^>]*>\s*$/im);
  if (themeMatch) {
    const block = buildBrandHeadBlock(themeMatch[1]);
    return next.replace(/^([ \t]*<meta\s+name=["']theme-color["'][^>]*>[ \t]*)(?:\r?\n[ \t]*)*/im, `$1\n${block}\n`);
  }

  const headMatch = next.match(/^([ \t]*)<\/head>/im);
  if (headMatch) {
    const block = buildBrandHeadBlock(headMatch[1] || '  ');
    return next.replace(/^([ \t]*)<\/head>/im, `${block}\n$1</head>`);
  }

  return next;
}

function replaceMetaContent(html, attrPattern, value) {
  const pattern = new RegExp(`(<meta\\s+${attrPattern}[^>]*?\\scontent=["'])[^"']+(["'][^>]*>)`, 'i');
  return html.replace(pattern, `$1${value}$2`);
}

function ensureMetaAfter(html, attrPattern, metaLine) {
  if (html.includes(metaLine)) return html;

  const pattern = new RegExp(`^([ \\t]*)(<meta\\s+${attrPattern}[^>]*>\\s*)$`, 'im');
  return html.replace(pattern, (_match, indent, line) => `${indent}${line.trimEnd()}\n${indent}${metaLine}`);
}

function logoObject() {
  return {
    '@type': 'ImageObject',
    '@id': `${domain}/#logo`,
    url: searchLogo,
    contentUrl: searchLogo,
    width: 512,
    height: 512,
  };
}

function organizationObject(sameAs = []) {
  return {
    '@type': 'Organization',
    '@id': `${domain}/#organization`,
    name: 'HUNDESALON NIKA',
    alternateName: 'HUNDESALON_NIKA',
    url: `${domain}/`,
    logo: logoObject(),
    image: searchLogo,
    sameAs,
  };
}

function websiteObject(inLanguage) {
  return {
    '@type': 'WebSite',
    '@id': `${domain}/#website`,
    url: `${domain}/`,
    name: 'HUNDESALON NIKA',
    inLanguage,
    publisher: { '@id': `${domain}/#organization` },
  };
}

function updateBusiness(business) {
  delete business['@context'];
  business.logo = logoObject();
  business.image = [searchLogo, socialPreview];
  business.parentOrganization = { '@id': `${domain}/#organization` };
  return business;
}

function getLanguage(relativePath) {
  if (relativePath.startsWith('ru/')) return 'ru';
  if (relativePath.startsWith('uk/')) return 'uk';
  if (relativePath.startsWith('en/')) return 'en';
  return 'de';
}

function normalizeJsonLd(json, relativePath) {
  const inLanguage = getLanguage(relativePath);
  const graph = Array.isArray(json['@graph']) ? json['@graph'] : [json];
  const business = graph.find((node) => node && node['@type'] === 'LocalBusiness');
  const sameAs = Array.isArray(business?.sameAs) ? business.sameAs : [];
  const filtered = graph.filter((node) => {
    if (!node || typeof node !== 'object') return false;
    return node['@type'] !== 'Organization' && node['@type'] !== 'WebSite';
  });

  const normalizedGraph = [
    organizationObject(sameAs),
    websiteObject(inLanguage),
    ...filtered.map((node) => (node['@type'] === 'LocalBusiness' ? updateBusiness(node) : node)),
  ];

  return {
    '@context': 'https://schema.org',
    '@graph': normalizedGraph,
  };
}

function updateJsonLd(html, relativePath) {
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (match, rawJson) => {
    try {
      const parsed = JSON.parse(rawJson);
      const normalized = normalizeJsonLd(parsed, relativePath);
      const indent = match.match(/^(\s*)<script/)?.[1] ?? '';
      const jsonText = JSON.stringify(normalized, null, 2)
        .split('\n')
        .map((line) => `${indent}${line}`)
        .join('\n');
      return `<script type="application/ld+json">\n${jsonText}\n${indent}</script>`;
    } catch {
      return match;
    }
  });
}

for (const file of walk(root)) {
  const relativePath = path.relative(root, file).replaceAll(path.sep, '/');
  let html = fs.readFileSync(file, 'utf8');
  html = normalizeBrandHead(html);

  if (indexFiles.includes(relativePath)) {
    html = html.replaceAll(`${domain}/assets/images/logo.png`, socialPreview);
    html = html
      .replace(/^[ \t]*<meta\s+property=["']og:image:(?:width|height)["'][^>]*>\s*\r?\n/gim, '')
      .replace(/^[ \t]*<meta\s+property=["']og:image:(?:width|height)["'][^>]*>\s*$/gim, '');
    html = replaceMetaContent(html, 'property=["\']og:image["\']', socialPreview);
    html = replaceMetaContent(html, 'name=["\']twitter:image["\']', socialPreview);
    html = ensureMetaAfter(html, 'property=["\']og:image["\']', '<meta property="og:image:width" content="1200">');
    html = ensureMetaAfter(html, 'property=["\']og:image:width["\']', '<meta property="og:image:height" content="630">');
    html = updateJsonLd(html, relativePath);
  }

  fs.writeFileSync(file, html);
}

for (const relativePath of ['site.webmanifest', 'browserconfig.xml']) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) continue;
  const next = fs.readFileSync(file, 'utf8').replace(/\?v=202[0-9a-z-]+/gi, `?v=${brandIconVersion}`);
  fs.writeFileSync(file, next);
}

console.log('Brand search SEO tags updated.');
