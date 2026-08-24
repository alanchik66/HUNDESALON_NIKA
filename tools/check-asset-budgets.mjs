import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const budgets = [
  { file: 'dist/assets/css/style.css', gzip: 50_000 },
  // The modular stylesheet is minified in production. 26.5 KB gzip covers the
  // responsive booking, price, and shared arrow-motion modules with a strict cap.
  { file: 'dist/assets/css/page-modules.css', gzip: 26_500 },
  { file: 'dist/assets/js/site-shell.js', gzip: 75_000 },
  { file: 'dist/assets/js/main.js', gzip: 15_000 },
  { file: 'dist/assets/images/brand/hero-dog.webp', raw: 50_000 },
];

const results = [];
for (const budget of budgets) {
  const content = await readFile(budget.file);
  const raw = content.byteLength;
  const gzip = gzipSync(content, { level: 9 }).byteLength;
  const ok = (budget.raw === undefined || raw <= budget.raw) && (budget.gzip === undefined || gzip <= budget.gzip);
  results.push({ ...budget, raw, gzip, ok });
}

console.log(JSON.stringify({ ok: results.every(item => item.ok), results }, null, 2));
if (results.some(item => !item.ok)) process.exitCode = 1;
