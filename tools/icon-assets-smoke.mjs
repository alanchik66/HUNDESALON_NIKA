import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const iconDirectory = path.join(root, 'assets', 'images', 'icons');
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage']);
const textExtensions = new Set(['.css', '.html', '.js', '.mjs', '.cjs', '.json', '.md', '.toml', '.xml']);
const canonicalIconName = /^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:png|webp)$/;
const ignoredFiles = new Set(['tools/optimize-ui-images.mjs']);

async function collectTextFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectTextFiles(absolutePath));
    else if (textExtensions.has(path.extname(entry.name))) files.push(absolutePath);
  }
  return files;
}

const iconFiles = (await readdir(iconDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .sort();

assert(iconFiles.length > 0, 'Icon directory is empty');
assert.deepEqual(
  iconFiles.filter((name) => !canonicalIconName.test(name)),
  [],
  'Every icon filename must use lowercase kebab-case',
);

const iconNames = new Set(iconFiles);
const missingReferences = [];
for (const file of await collectTextFiles(root)) {
  if (ignoredFiles.has(path.relative(root, file).replaceAll('\\', '/'))) continue;
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/(?:assets\/)?images\/icons\/([^"'`()\s?}]+)/g)) {
    const iconName = match[1];
    if (iconName.includes('$') || iconName.includes('{')) continue;
    if (!iconNames.has(iconName)) {
      missingReferences.push(`${path.relative(root, file)} -> ${iconName}`);
    }
  }
}

assert.deepEqual(missingReferences, [], 'Every icon reference must resolve inside assets/images/icons');
const transportMetadata = await sharp(path.join(iconDirectory, 'public-transport.png')).metadata();
assert.equal(transportMetadata.hasAlpha, true, 'The public transport icon must preserve transparency');
assert(transportMetadata.width >= 256 && transportMetadata.height >= 256, 'The public transport icon is too small');
const streetViewMetadata = await sharp(path.join(iconDirectory, 'street-view.png')).metadata();
assert.equal(streetViewMetadata.hasAlpha, true, 'The Street View icon must preserve transparency');
assert.equal(streetViewMetadata.width, 256, 'The Street View icon must use the canonical square size');
assert.equal(streetViewMetadata.height, 256, 'The Street View icon must use the canonical square size');
const recenterMetadata = await sharp(path.join(iconDirectory, 'map-recenter.png')).metadata();
assert.equal(recenterMetadata.hasAlpha, true, 'The recenter icon must preserve transparency');
assert.equal(recenterMetadata.width, 256, 'The recenter icon must use the canonical square size');
assert.equal(recenterMetadata.height, 256, 'The recenter icon must use the canonical square size');
const clockPath = path.join(iconDirectory, 'clock.png');
const clockMetadata = await sharp(clockPath).metadata();
assert.equal(clockMetadata.hasAlpha, true, 'The clock icon must preserve transparency');
const clockFacePixel = await sharp(clockPath)
  .extract({ left: 110, top: 120, width: 1, height: 1 })
  .ensureAlpha()
  .raw()
  .toBuffer();
assert.equal(clockFacePixel[3], 0, 'The clock face must not contain a black background');

console.log(`Icon assets OK: ${iconFiles.length} canonical files, all static references resolve, branded icon transparency preserved.`);
