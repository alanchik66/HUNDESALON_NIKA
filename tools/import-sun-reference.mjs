/**
 * Import a screen recording (e.g. NASA Eyes Sun) as header sun source.
 *
 * Usage:
 *   node tools/import-sun-reference.mjs path/to/20260520-1612-38.7547272.mp4
 *   npm run sun:import-reference
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sunDir = path.join(root, '3d-weather-codrops-main/dist-widget/assets/Sun');
const OUT = path.join(sunDir, 'sun_reference.mp4');

const argPath = process.argv[2];
const searchRoots = [
  path.join(process.env.USERPROFILE || '', 'Downloads'),
  path.join(process.env.USERPROFILE || '', 'Videos'),
  path.join(process.env.USERPROFILE || '', 'Desktop'),
  root,
];

function findReference() {
  if (argPath) {
    const resolved = path.resolve(argPath);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }

  for (const dir of searchRoots) {
    if (!dir || !fs.existsSync(dir)) {
      continue;
    }
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.mp4')) {
        continue;
      }
      if (/20260520-1612/i.test(entry.name) || /eyes.*sun/i.test(entry.name)) {
        return path.join(dir, entry.name);
      }
    }
  }

  return null;
}

const source = findReference();
if (!source) {
  console.error(
    'Reference MP4 not found. Pass path:\n  node tools/import-sun-reference.mjs "C:\\path\\20260520-1612-38.7547272.mp4"'
  );
  process.exit(1);
}

fs.mkdirSync(sunDir, { recursive: true });
fs.copyFileSync(source, OUT);
const sizeMb = (fs.statSync(OUT).size / (1024 * 1024)).toFixed(2);
console.log(`Copied → ${OUT} (${sizeMb} MB)`);
console.log('Next: npm run sun:build-alpha');
