import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const cssV = '20260707-perf-balanced-v1';
const jsV = '20260707-perf-balanced-v1';
let updated = 0;

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!ent.name.endsWith('.html')) continue;
    const original = fs.readFileSync(fullPath, 'utf8');
    const next = original
      .replace(/style\.css\?v=[^"']+/g, `style.css?v=${cssV}`)
      .replace(/main\.js\?v=[^"']+/g, `main.js?v=${jsV}`);
    if (next !== original) {
      fs.writeFileSync(fullPath, next, 'utf8');
      updated += 1;
    }
  }
}

for (const lang of ['de', 'en', 'ru', 'uk']) {
  walk(path.join(root, lang));
}
walk(root);
console.log(`Updated ${updated} HTML files.`);
