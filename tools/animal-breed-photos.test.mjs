import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { loadAnimalPhotoCatalog } from './lib/animal-photo-catalog.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'assets', 'js', 'animal-breed-photo-data.js');

const loadManifest = () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(manifestPath, 'utf8'), context, { filename: manifestPath });
  return context.window.AnimalBreedPhotoData;
};

test('animal photo manifest covers every stable catalog record and lookup', () => {
  const { uniqueRecords } = loadAnimalPhotoCatalog();
  const manifest = loadManifest();
  const expectedKeys = uniqueRecords.map(record => record.key).sort();
  const actualKeys = Object.keys(manifest.entriesByKey).sort();

  assert.equal(manifest.version, 1);
  assert.equal(actualKeys.length, uniqueRecords.length);
  assert.deepEqual(actualKeys, expectedKeys);

  for (const record of uniqueRecords) {
    const entry = manifest.entriesByKey[record.key];
    assert.equal(entry.kind, record.kind, `kind mismatch for ${record.key}`);
    assert.equal(entry.name, record.name, `name mismatch for ${record.key}`);
    assert.equal(entry.fciNumber, record.fciNumber, `FCI mismatch for ${record.key}`);
    assert.equal(entry.breedKey, record.breedKey, `breedKey mismatch for ${record.key}`);
    assert.equal(entry.metadataId, record.metadataId, `metadataId mismatch for ${record.key}`);
    assert.equal(entry.categoryId, record.categoryId, `category mismatch for ${record.key}`);
    assert.equal(entry.sourceIndex, record.sourceIndex, `source index mismatch for ${record.key}`);
    assert.match(entry.localAsset, /^\/assets\/images\/animal-breeds\/[a-f0-9]{16}-[a-z0-9-]+\.webp$/);
    assert.ok(fs.existsSync(path.join(root, entry.localAsset.slice(1))), `missing local asset for ${record.key}`);
    assert.ok([
      'exact',
      'exact-search-match',
      'breed-standard',
      'illustrative-standard-based',
    ].includes(entry.exactness), `bad exactness for ${record.key}`);
    assert.ok(['licensed-media', 'generated'].includes(entry.sourceType), `bad source type for ${record.key}`);
    assert.match(entry.source, /\S/u, `missing source for ${record.key}`);
    assert.match(entry.author, /\S/u, `missing author for ${record.key}`);
    assert.match(entry.license, /\S/u, `missing license for ${record.key}`);
    if (entry.exactness === 'illustrative-standard-based') {
      assert.equal(entry.sourceType, 'generated');
      assert.equal(entry.source, 'OpenAI image generation');
      assert.equal(entry.licenseUrl, '');
      assert.equal(entry.sourceUrl, '');
    } else {
      assert.match(entry.licenseUrl, /^https?:\/\//u, `missing license URL for ${record.key}`);
      assert.match(entry.sourceUrl, /^https:\/\//u, `missing source URL for ${record.key}`);
    }
    assert.doesNotMatch(entry.license, /(?:non[- ]?commercial|no derivatives|fair use|non[- ]?free|all rights reserved|\bNC\b|\bND\b)/iu);
    assert.ok(entry.width > 0 && entry.width <= 720, `bad width for ${record.key}`);
    assert.ok(entry.height > 0 && entry.height <= 600, `bad height for ${record.key}`);

    const categoryIndex = `${record.categoryId}:${record.sourceIndex}`;
    assert.equal(manifest.keyByCategoryIndex[categoryIndex], record.key);
    if (record.kind === 'dog') {
      assert.match(record.breedKey || '', /\S/u, `missing dog breedKey for ${record.key}`);
      assert.equal(manifest.keyByBreedKey[record.breedKey], record.key);
    }
    if (record.kind === 'cat') {
      assert.match(record.metadataId || '', /\S/u, `missing cat metadataId for ${record.key}`);
      assert.equal(manifest.keyByMetadataId[record.metadataId], record.key);
    }
  }
});

test('every catalog record has a unique photo source and local asset', () => {
  const manifest = loadManifest();
  const entries = Object.values(manifest.entriesByKey);
  assert.equal(manifest.sharedPhotoGroups.length, 0);
  assert.equal(new Set(entries.map(entry => entry.localAsset)).size, entries.length);
  const remoteSources = entries.map(entry => entry.sourceUrl).filter(Boolean);
  assert.equal(new Set(remoteSources).size, remoteSources.length);
  const referencedAssets = entries.map(entry => path.basename(entry.localAsset)).sort();
  const directoryAssets = fs.readdirSync(path.join(root, 'assets', 'images', 'animal-breeds'))
    .filter(filename => filename.endsWith('.webp'))
    .sort();
  assert.deepEqual(directoryAssets, referencedAssets);
});

test('optimized animal photos retain their complete aspect ratio inside the size budget', async () => {
  const manifest = loadManifest();
  const assets = [...new Set(Object.values(manifest.entriesByKey).map(entry => entry.localAsset))];
  const results = await Promise.all(assets.map(async localAsset => ({
    localAsset,
    metadata: await sharp(path.join(root, localAsset.slice(1))).metadata(),
  })));

  for (const { localAsset, metadata } of results) {
    assert.equal(metadata.format, 'webp', `${localAsset} is not WebP`);
    assert.ok(metadata.width > 0 && metadata.width <= 720, `${localAsset} exceeds width budget`);
    assert.ok(metadata.height > 0 && metadata.height <= 600, `${localAsset} exceeds height budget`);
  }
});
