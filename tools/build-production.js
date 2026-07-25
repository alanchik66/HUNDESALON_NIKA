import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const MAX_PAGES_FILE_BYTES = 24 * 1024 * 1024;

const STAMPED_ASSETS = [
  'style.css',
  'page-modules.css',
  'main.js',
  'page-modules.js',
  'site-shell.js',
  'price-catalog.js',
  'newsletter.js',
];

const SKIP_RELATIVE_PATHS = new Set([
  '3d-weather-codrops-main/dist-widget/assets/Moon/Moon_NASA_LRO_23k_Topo.usdz',
  '3d-weather-codrops-main/dist-widget/assets/Moon/mission_2160p30.mp4',
  '3d-weather-codrops-main/dist-widget/assets/Moon/mission_720p30.mp4',
  '3d-weather-codrops-main/dist-widget/assets/Moon/moon_texture_23k.png',
  '3d-weather-codrops-main/dist-widget/assets/Moon/moon_texture_web.png',
]);

const copyEntries = [
  'index.html',
  '404.html',
  'assets',
  'config',
  'data',
  'de',
  'en',
  'ru',
  'uk',
  'functions',
  '3d-weather-codrops-main/dist-widget',
  '.well-known',
  '_headers',
  '_redirects',
  'robots.txt',
  'llms.txt',
  'sitemap.xml',
  'sitemap-brand.xml',
  'indexnow-key.txt',
  'favicon.ico',
  'site.webmanifest',
  'sw.js',
  'browserconfig.xml',
  'BingSiteAuth.xml',
];

function copyRecursive(source, target) {
  if (!fs.existsSync(source)) return;

  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      copyRecursive(path.join(source, entry), path.join(target, entry));
    }
    return;
  }

  const relativeSource = path.relative(root, source).replaceAll('\\', '/');
  if (SKIP_RELATIVE_PATHS.has(relativeSource)) {
    return;
  }

  if (stat.size > MAX_PAGES_FILE_BYTES) {
    console.warn(
      `Skipped oversized file for Pages deploy: ${relativeSource} (${Math.round(stat.size / (1024 * 1024))} MB)`
    );
    return;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function ensureLeafletVendorBundle() {
  const vendorJs = path.join(root, 'assets/vendor/leaflet/1.9.4/leaflet.js');
  const sourceJs = path.join(root, 'node_modules/leaflet/dist/leaflet.js');
  if (fs.existsSync(vendorJs) || !fs.existsSync(sourceJs)) {
    return;
  }

  const vendorDir = path.join(root, 'assets/vendor/leaflet/1.9.4');
  const sourceDir = path.join(root, 'node_modules/leaflet/dist');
  fs.mkdirSync(path.join(vendorDir, 'images'), { recursive: true });
  for (const fileName of ['leaflet.css', 'leaflet.js']) {
    fs.copyFileSync(path.join(sourceDir, fileName), path.join(vendorDir, fileName));
  }
  for (const imageName of fs.readdirSync(path.join(sourceDir, 'images'))) {
    fs.copyFileSync(path.join(sourceDir, 'images', imageName), path.join(vendorDir, 'images', imageName));
  }
  console.log('Copied Leaflet vendor assets from node_modules.');
}

function emptyDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
  for (const entry of fs.readdirSync(directory)) {
    fs.rmSync(path.join(directory, entry), {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 250,
    });
  }
}

ensureLeafletVendorBundle();

emptyDirectory(dist);

for (const entry of copyEntries) {
  copyRecursive(path.join(root, entry), path.join(dist, entry));
}

function deployAssetVersion() {
  if (process.env.DEPLOY_ASSET_VERSION?.trim()) {
    return process.env.DEPLOY_ASSET_VERSION.trim();
  }
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  try {
    const hash = execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim();
    return `${date}-prod-${hash}`;
  } catch {
    return `${date}-prod-build`;
  }
}

function stampDistAssetVersions(directory, version) {
  let htmlFiles = 0;

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.name.endsWith('.html')) continue;

      const original = fs.readFileSync(fullPath, 'utf8');
      let next = original;
      for (const asset of STAMPED_ASSETS) {
        const pattern = new RegExp(`(${asset.replace('.', '\\.')})\\?v=[^"'\\s>]+`, 'g');
        next = next.replace(pattern, `$1?v=${version}`);
      }
      // CSP blocks inline onload handlers, leaving deferred stylesheets stuck at media="print".
      next = next.replace(
        /\s+media="print"\s+onload="this\.media\s*=\s*'all'"/g,
        ''
      );
      if (next !== original) {
        fs.writeFileSync(fullPath, next, 'utf8');
        htmlFiles += 1;
      }
    }
  }

  walk(directory);
  fs.mkdirSync(path.join(directory, 'config'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'config', 'deploy-asset-version.txt'), `${version}\n`, 'utf8');
  return htmlFiles;
}

const assetVersion = deployAssetVersion();
const stamped = stampDistAssetVersions(dist, assetVersion);

console.log('Production bundle created in dist/.');
console.log(`Asset cache version: ${assetVersion} (${stamped} HTML files stamped).`);
