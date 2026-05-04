import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

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

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const entry of copyEntries) {
  copyRecursive(path.join(root, entry), path.join(dist, entry));
}

console.log('Production bundle created in dist/.');
