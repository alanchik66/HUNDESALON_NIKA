import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const langs = ['de', 'en', 'ru', 'uk'];
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
      .replace(/site-shell\.js\?v=[^"']+/g, 'site-shell.js?v=20260706-nav-gallery-v3')
      .replace(/main\.js\?v=[^"']+/g, 'main.js?v=20260706-nav-gallery-v3');
    if (next !== original) {
      fs.writeFileSync(fullPath, next, 'utf8');
      updated += 1;
    }
  }
}

for (const lang of langs) {
  walk(path.join(root, lang));
}
walk(root);
console.log(`Updated ${updated} HTML files.`);
