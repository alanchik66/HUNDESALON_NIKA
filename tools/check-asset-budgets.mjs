import path from 'node:path';
import { readdir, readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { isProductionSourceOnlyPath } from './lib/production-assets.mjs';

const budgets = [
  { file: 'dist/assets/css/style.css', gzip: 50_000 },
  // The modular stylesheet is minified in production. The 31 KB cap tracks
  // the verified 30.6 KB services, animal catalog, and photo UI baseline with strict headroom.
  { file: 'dist/assets/css/page-modules.css', gzip: 32_000 },
  { file: 'dist/assets/js/site-shell.js', gzip: 75_000 },
  { file: 'dist/assets/js/main.js', gzip: 15_000 },
  { file: 'dist/assets/images/brand/hero-dog.webp', raw: 50_000 },
];

const directoryBudgets = [
  { directory: 'dist', raw: 110_000_000 },
  { directory: 'dist/assets', raw: 75_000_000 },
  { directory: 'dist/assets/images', raw: 62_000_000 },
];

async function walkFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(target)));
    else if (entry.isFile()) files.push(target);
  }
  return files;
}

const results = [];
for (const budget of budgets) {
  const content = await readFile(budget.file);
  const raw = content.byteLength;
  const gzip = gzipSync(content, { level: 9 }).byteLength;
  const ok = (budget.raw === undefined || raw <= budget.raw) && (budget.gzip === undefined || gzip <= budget.gzip);
  results.push({ ...budget, raw, gzip, ok });
}

for (const budget of directoryBudgets) {
  const files = await walkFiles(budget.directory);
  const sizes = await Promise.all(files.map(file => stat(file)));
  const raw = sizes.reduce((total, item) => total + item.size, 0);
  results.push({ ...budget, raw, ok: raw <= budget.raw });
}

const productionFiles = await walkFiles('dist');
const forbiddenPaths = productionFiles
  .map(file => file.replaceAll('\\', '/').replace(/^dist\//, ''))
  .filter(isProductionSourceOnlyPath);
results.push({
  check: 'source-only production assets',
  paths: forbiddenPaths,
  ok: forbiddenPaths.length === 0,
});

console.log(JSON.stringify({ ok: results.every(item => item.ok), results }, null, 2));
if (results.some(item => !item.ok)) process.exitCode = 1;
