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
const expectedSmallAnimalSources = new Map([
  ['guinea-pig:short:0', 'File:An_orange_American_guinea_pig.jpg'],
  ['guinea-pig:short:1', 'File:Cavia_porcellus-Licorice.jpg'],
  ['guinea-pig:short:2', 'File:2006_TN_State_Fair-_Guinea_Pig.jpg'],
  ['guinea-pig:short:3', 'File:%D0%9C%D0%BE%D1%80%D1%81%D0%BA%D0%B8%D0%B5_%D1%81%D0%B2%D0%B8%D0%BD%D0%BA%D0%B8_%D0%9C%D0%BE%D1%80%D1%81%D1%8C%D0%BA%D1%96_%D1%81%D0%B2%D0%B8%D0%BD%D0%BA%D0%B8_Cavia_porcellus.jpg'],
  ['guinea-pig:short:4', 'File:Bennyboycavy.png'],
  ['guinea-pig:long:0', 'File:A_peruvian_with_hair_wraps.jpg'],
  ['guinea-pig:long:1', 'File:Black-haired_Sheltie_guinea_pig.jpg'],
  ['guinea-pig:long:2', 'File:Coronet_cavia.JPG'],
  ['guinea-pig:long:3', 'File:Texel_guinea_pig.jpg'],
  ['guinea-pig:long:4', 'File:Alpaka_Cavia.jpg'],
  ['rabbit:short:0', 'File:Netherland_Dwarf_Bunny-Strider.JPG'],
  ['rabbit:short:1', 'File:American_Grand_Champion_Dutch_Rabbit.jpg'],
  ['rabbit:short:2', 'File:Fast_Track,_Lilac_Mini_Rex.jpg'],
  ['rabbit:short:3', 'File:Castorex.jpg'],
  ['rabbit:short:4', 'File:Holland_lop_rabbit.jpg'],
  ['rabbit:long:0', 'File:Little_Bunny_LuLu.jpg'],
  ['rabbit:long:1', 'File:FrenchAngora.jpg'],
  ['rabbit:long:2', 'File:Brown_%26_White_Lion_Head_Rabbit.JPG'],
  ['rabbit:long:3', 'File:JerseyWoolySide.jpg'],
  ['rabbit:long:4', 'File:Rabbit_american_fuzzy_lop_buck_white.jpg'],
]);

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
    if (record.kind === 'dog' || record.kind === 'small-animal') {
      assert.match(record.breedKey || '', /\S/u, `missing breedKey for ${record.key}`);
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

test('every small-animal breed has its own verified photo and lookup', () => {
  const manifest = loadManifest();
  const entries = Object.values(manifest.entriesByKey).filter(entry => entry.kind === 'small-animal');
  assert.equal(entries.length, 20);
  assert.equal(new Set(entries.map(entry => entry.breedKey)).size, 20);
  assert.equal(new Set(entries.map(entry => entry.localAsset)).size, 20);
  assert.equal(new Set(entries.map(entry => entry.sourceUrl)).size, 20);
  assert.ok(entries.every(entry => entry.exactness === 'exact' || entry.exactness === 'exact-search-match'));
  for (const entry of entries) {
    const expectedSource = expectedSmallAnimalSources.get(entry.breedKey);
    assert.ok(expectedSource, `unexpected small-animal breedKey ${entry.breedKey}`);
    assert.ok(entry.sourceUrl.endsWith(expectedSource), `wrong breed source for ${entry.breedKey}`);
  }
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
