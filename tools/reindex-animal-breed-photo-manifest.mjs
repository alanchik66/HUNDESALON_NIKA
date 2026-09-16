import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { loadAnimalPhotoCatalog } from './lib/animal-photo-catalog.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(projectRoot, 'assets', 'js', 'animal-breed-photo-data.js');
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(manifestPath, 'utf8'), context, { filename: manifestPath });

const previous = context.window.AnimalBreedPhotoData;
const { uniqueRecords } = loadAnimalPhotoCatalog();
if (!previous?.entriesByKey || Object.keys(previous.entriesByKey).length !== uniqueRecords.length) {
  throw new Error('Animal photo manifest entries do not match the current catalog');
}

const entriesByKey = { ...previous.entriesByKey };
const keyByCategoryIndex = {};
for (const record of uniqueRecords) {
  const entry = entriesByKey[record.key];
  if (!entry) throw new Error(`Missing animal photo entry: ${record.key}`);
  entriesByKey[record.key] = {
    ...entry,
    categoryId: record.categoryId,
    sourceIndex: record.sourceIndex,
  };
  const lookupKey = `${record.categoryId}:${record.sourceIndex}`;
  if (keyByCategoryIndex[lookupKey]) throw new Error(`Duplicate animal category index: ${lookupKey}`);
  keyByCategoryIndex[lookupKey] = record.key;
}

const manifest = { ...previous, entriesByKey, keyByCategoryIndex };
const source = `(function initAnimalBreedPhotoData(global) {\n  'use strict';\n  global.AnimalBreedPhotoData = Object.freeze(${JSON.stringify(manifest, null, 2)});\n})(window);\n`;
fs.writeFileSync(manifestPath, source, 'utf8');
console.log(`Reindexed ${uniqueRecords.length} animal photo records.`);
