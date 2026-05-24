import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const MAX_PAGES_FILE_BYTES = 24 * 1024 * 1024;

const SKIP_RELATIVE_PATHS = new Set([
  '3d-weather-codrops-main/dist-widget/assets/Moon/Moon_NASA_LRO_23k_Topo.usdz',
  '3d-weather-codrops-main/dist-widget/assets/Moon/mission_720p30.mp4',
  '3d-weather-codrops-main/dist-widget/assets/Moon/moon_texture_23k.png',
  '3d-weather-codrops-main/dist-widget/assets/Moon/moon_texture_web.png',
]);

const copyEntries = [
  'index.html',
  'assets',
  'de',
  'en',
  'ru',
  'uk',
  'functions',
  '3d-weather-codrops-main/dist-widget',
  '_headers',
  '_redirects',
  'robots.txt',
  'sitemap.xml',
  'sitemap-brand.xml',
  'indexnow-key.txt',
  'favicon.ico',
  'site.webmanifest',
  'browserconfig.xml',
  'BingSiteAuth.xml',
  'google8f5e729bf8a13cc7.html',
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

ensureLeafletVendorBundle();

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const entry of copyEntries) {
  copyRecursive(path.join(root, entry), path.join(dist, entry));
}

console.log('Production bundle created in dist/.');
