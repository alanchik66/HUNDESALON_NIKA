import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { loadAnimalPhotoCatalog, normalizeAnimalPhotoKey } from './lib/animal-photo-catalog.mjs';

const USER_AGENT = 'HUNDESALON_NIKA animal photo registry/1.0 (+https://hundesalon-nika.com)';
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
const OUTPUT_WIDTH = 720;
const OUTPUT_HEIGHT = 600;
const { projectRoot, uniqueRecords } = loadAnimalPhotoCatalog();
const candidatesPath = path.join(projectRoot, 'temp', 'animal-breed-photo-candidates.json');
const assetsDirectory = path.join(projectRoot, 'assets', 'images', 'animal-breeds');
const manifestPath = path.join(projectRoot, 'assets', 'js', 'animal-breed-photo-data.js');
const generatedTennesseeRexPath = path.join(
  projectRoot,
  'tools',
  'animal-photo-sources',
  'tennessee-rex-standard-generated.webp'
);
const generatedCherubimPath = path.join(
  projectRoot,
  'tools',
  'animal-photo-sources',
  'cherubim-standard-generated.webp'
);

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const cleanSlug = value => normalizeAnimalPhotoKey(value)
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 54) || 'animal';

const deriveLicenseUrl = license => {
  const normalized = String(license || '').toLocaleLowerCase('en');
  const version = normalized.match(/\b([1-4](?:\.0)?)\b/)?.[1] || '4.0';
  if (/cc0/.test(normalized)) return 'https://creativecommons.org/publicdomain/zero/1.0/';
  if (/(?:public domain|pdm|no restrictions)/.test(normalized)) return 'https://creativecommons.org/publicdomain/mark/1.0/';
  if (/cc.*by.*sa|by-sa/.test(normalized)) return `https://creativecommons.org/licenses/by-sa/${version}/`;
  if (/cc.*by|\bby\b/.test(normalized)) return `https://creativecommons.org/licenses/by/${version}/`;
  if (/gfdl|gnu free documentation/.test(normalized)) return 'https://www.gnu.org/licenses/fdl-1.3.html';
  if (/\bgpl\b|gnu general public/.test(normalized)) return 'https://www.gnu.org/licenses/gpl-3.0.html';
  if (/free art|\bfal\b/.test(normalized)) return 'https://artlibre.org/licence/lal/en/';
  return '';
};

async function fetchImage(url) {
  let lastError;
  const maximumAttempts = 6;
  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch(url, {
        headers: { Accept: 'image/*', 'User-Agent': USER_AGENT },
        redirect: 'follow',
        signal: controller.signal,
      });
      if (!response.ok) {
        const retryAfter = Number(response.headers.get('retry-after')) || attempt * 3;
        if (response.status === 429 && attempt < maximumAttempts) {
          await wait(Math.min(retryAfter * 1000, 30_000));
          continue;
        }
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      const length = Number(response.headers.get('content-length')) || 0;
      if (length > MAX_SOURCE_BYTES) throw new Error(`source is ${length} bytes`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length || buffer.length > MAX_SOURCE_BYTES) throw new Error(`downloaded ${buffer.length} bytes`);
      return buffer;
    } catch (error) {
      lastError = error;
      if (attempt < maximumAttempts) await wait(attempt * 1000);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`${url}: ${lastError?.message || lastError}`);
}

async function downloadAndOptimize(photo, destinationPath) {
  try {
    const existing = await sharp(destinationPath).metadata();
    if (existing.format === 'webp' && existing.width <= OUTPUT_WIDTH && existing.height <= OUTPUT_HEIGHT) return existing;
  } catch {
    // Missing or invalid cached output: rebuild it from its licensed source.
  }

  const urls = [...new Set([photo.src, photo.originalSrc].filter(value => /^https:\/\//i.test(value || '')))];
  let sourceBuffer = photo.localSourcePath ? await fs.readFile(photo.localSourcePath) : null;
  let lastError;
  for (const url of urls) {
    try {
      sourceBuffer = await fetchImage(url);
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!sourceBuffer) throw lastError || new Error('No image source URL');

  const temporaryPath = `${destinationPath}.${process.pid}.tmp`;
  await sharp(sourceBuffer, { animated: false, failOn: 'warning', limitInputPixels: 100_000_000 })
    .rotate()
    .resize({ width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78, effort: 5, smartSubsample: true })
    .toFile(temporaryPath);
  await fs.rename(temporaryPath, destinationPath);
  return sharp(destinationPath).metadata();
}

function addUniqueLookup(target, lookupKey, entryKey, label) {
  if (!lookupKey) return;
  if (target[lookupKey] && target[lookupKey] !== entryKey) {
    throw new Error(`Duplicate ${label} ${lookupKey}: ${target[lookupKey]} and ${entryKey}`);
  }
  target[lookupKey] = entryKey;
}

const report = JSON.parse(await fs.readFile(candidatesPath, 'utf8'));
const generatedIllustrations = new Map([
  ['metadata:tennessee-rex', {
    fileTitle: 'Tennessee Rex standard-based illustration',
    localSourcePath: generatedTennesseeRexPath,
  }],
  ['metadata:cherubim', {
    fileTitle: 'Cherubim standard-based illustration',
    localSourcePath: generatedCherubimPath,
  }],
  ['breed:fci:310:small-coated', {
    fileTitle: 'Peruvian Hairless Dog small coated standard-based illustration',
    localSourcePath: path.join(projectRoot, 'tools', 'animal-photo-sources', 'peruvian-small-coated-standard-generated.png'),
  }],
  ['breed:fci:234:miniature-coated', {
    fileTitle: 'Xoloitzcuintli miniature coated standard-based illustration',
    localSourcePath: path.join(projectRoot, 'tools', 'animal-photo-sources', 'xoloitzcuintli-miniature-coated-standard-generated.png'),
  }],
  ['breed:fci:234:medium-coated', {
    fileTitle: 'Xoloitzcuintli medium coated standard-based illustration',
    localSourcePath: path.join(projectRoot, 'tools', 'animal-photo-sources', 'xoloitzcuintli-medium-coated-standard-generated.png'),
  }],
  ['metadata:minuet-talls', {
    fileTitle: 'Minuet Talls Shorthair standard-based illustration',
    localSourcePath: path.join(projectRoot, 'tools', 'animal-photo-sources', 'minuet-talls-shorthair-standard-generated.webp'),
  }],
  ['metadata:minuet-talls-longhair', {
    fileTitle: 'Minuet Talls Longhair standard-based illustration',
    localSourcePath: path.join(projectRoot, 'tools', 'animal-photo-sources', 'minuet-talls-longhair-standard-generated.webp'),
  }],
  ['metadata:cymric-tailed', {
    fileTitle: 'Cymric Tailed standard-based illustration',
    localSourcePath: path.join(projectRoot, 'tools', 'animal-photo-sources', 'cymric-tailed-standard-generated.webp'),
  }],
  ['metadata:highlander', {
    fileTitle: 'Highlander Longhair standard-based illustration',
    localSourcePath: path.join(projectRoot, 'tools', 'animal-photo-sources', 'highlander-longhair-standard-generated.webp'),
  }],
  ['breed:fci:321:long', {
    fileTitle: 'Majorca Shepherd Dog Longhair standard-based illustration',
    localSourcePath: path.join(projectRoot, 'tools', 'animal-photo-sources', 'majorca-shepherd-longhair-standard-generated.webp'),
  }],
  ['metadata:american-bobtail-shorthair', {
    fileTitle: 'American Bobtail Shorthair standard-based illustration',
    localSourcePath: path.join(projectRoot, 'tools', 'animal-photo-sources', 'american-bobtail-shorthair-standard-generated.webp'),
  }],
  ['breed:fci:103:rough', {
    fileTitle: 'German Hunting Terrier Rough-haired FCI 103 standard-based illustration',
    localSourcePath: path.join(projectRoot, 'tools', 'animal-photo-sources', 'german-hunting-terrier-rough-standard-generated.webp'),
  }],
  ['breed:fci:103:coarse-smooth', {
    fileTitle: 'German Hunting Terrier Coarse Smooth-haired FCI 103 standard-based illustration',
    localSourcePath: path.join(projectRoot, 'tools', 'animal-photo-sources', 'german-hunting-terrier-coarse-smooth-standard-generated.webp'),
  }],
  ['breed:fci:316:breed', {
    fileTitle: 'French White and Orange Hound FCI 316 standard-based illustration',
    localSourcePath: path.join(projectRoot, 'tools', 'animal-photo-sources', 'french-white-orange-hound-standard-generated.webp'),
  }],
  ['breed:ru-poodles-bichons:base:14', {
    fileTitle: 'Schnoodle standard-based illustration',
    localSourcePath: path.join(projectRoot, 'tools', 'animal-photo-sources', 'schnoodle-standard-generated.png'),
  }],
]);
const generatedLookupKey = entry => entry.breedKey
  ? `breed:${entry.breedKey}`
  : entry.metadataId
    ? `metadata:${entry.metadataId}`
    : `name:${normalizeAnimalPhotoKey(entry.name)}`;
const matchedGeneratedKeys = new Set();
for (const entry of report.entries) {
  const lookupKey = generatedLookupKey(entry);
  const generated = generatedIllustrations.get(lookupKey);
  if (!generated) continue;
  matchedGeneratedKeys.add(lookupKey);
  entry.fileTitle = generated.fileTitle;
  entry.sourceMethod = 'generated-standard-illustration';
  entry.photo = {
    fileTitle: generated.fileTitle,
    src: '',
    originalSrc: `generated://hundesalon-nika/${lookupKey.replace(/[^a-z0-9]+/gi, '-')}-standard-v1`,
    sourceUrl: '',
    localSourcePath: generated.localSourcePath,
    author: 'HUNDESALON_NIKA / OpenAI',
    license: 'Generated illustrative image',
    licenseUrl: '',
    provider: 'OpenAI image generation',
  };
}
for (const [lookupKey, generated] of generatedIllustrations) {
  if (!matchedGeneratedKeys.has(lookupKey)) throw new Error(`Generated override is not in the catalog: ${lookupKey}`);
  await fs.access(generated.localSourcePath);
}
if (report.total !== uniqueRecords.length) {
  throw new Error(`Candidate count ${report.total} does not match catalog count ${uniqueRecords.length}`);
}
if (report.entries.some(entry => !entry.photo)) {
  throw new Error(`Photo candidates are incomplete: ${report.entries.filter(entry => entry.photo).length}/${report.total}`);
}

const catalogByKey = new Map(uniqueRecords.map(record => [record.key, record]));
const candidatesByKey = new Map(report.entries.map(entry => [entry.key, entry]));
if (candidatesByKey.size !== uniqueRecords.length) throw new Error('Candidate keys are not unique');
for (const key of catalogByKey.keys()) {
  if (!candidatesByKey.has(key)) throw new Error(`Missing candidate key ${key}`);
}

const sourceGroups = Object.groupBy(
  report.entries,
  entry => entry.photo.sourceUrl || entry.photo.originalSrc || entry.photo.src
);
const sharedPhotoGroups = [];
for (const [sourceUrl, entries] of Object.entries(sourceGroups)) {
  if (entries.length < 2) continue;
  throw new Error(`Photo source must be unique ${sourceUrl}: ${entries.map(entry => entry.name).join(', ')}`);
}

await fs.mkdir(assetsDirectory, { recursive: true });
const assetJobs = new Map();
for (const candidate of candidatesByKey.values()) {
  const sourceIdentity = candidate.photo.localSourcePath
    ? `generated:${crypto.createHash('sha256').update(await fs.readFile(candidate.photo.localSourcePath)).digest('hex')}`
    : candidate.photo.sourceUrl || candidate.photo.originalSrc || candidate.photo.src;
  const hash = crypto.createHash('sha256').update(sourceIdentity).digest('hex').slice(0, 16);
  const filename = `${hash}-${cleanSlug(candidate.photo.fileTitle || candidate.name)}.webp`;
  const destinationPath = path.join(assetsDirectory, filename);
  if (!assetJobs.has(filename)) assetJobs.set(filename, { photo: candidate.photo, destinationPath });
  candidate.outputFilename = filename;
}

const jobs = [...assetJobs.entries()];
const metadataByFilename = new Map();
let nextJobIndex = 0;
async function worker() {
  while (nextJobIndex < jobs.length) {
    const [filename, job] = jobs[nextJobIndex];
    nextJobIndex += 1;
    const metadata = await downloadAndOptimize(job.photo, job.destinationPath);
    metadataByFilename.set(filename, metadata);
    await wait(180);
    if (metadataByFilename.size % 25 === 0 || metadataByFilename.size === jobs.length) {
      console.log(`Optimized ${metadataByFilename.size}/${jobs.length} local animal photos`);
    }
  }
}
await Promise.all(Array.from({ length: Math.min(2, jobs.length) }, () => worker()));

const expectedFilenames = new Set(jobs.map(([filename]) => filename));
const resolvedAssetsDirectory = path.resolve(assetsDirectory);
for (const filename of await fs.readdir(assetsDirectory)) {
  if (!filename.endsWith('.webp') || expectedFilenames.has(filename)) continue;
  const stalePath = path.resolve(assetsDirectory, filename);
  if (path.dirname(stalePath) !== resolvedAssetsDirectory) {
    throw new Error(`Refusing to remove asset outside the generated photo directory: ${stalePath}`);
  }
  await fs.rm(stalePath);
}

const entriesByKey = {};
const keyByBreedKey = {};
const keyByMetadataId = {};
const keyByCategoryIndex = {};
for (const key of [...catalogByKey.keys()].sort()) {
  const record = catalogByKey.get(key);
  const candidate = candidatesByKey.get(key);
  const photo = candidate.photo;
  const metadata = metadataByFilename.get(candidate.outputFilename);
  const generatedIllustration = candidate.sourceMethod === 'generated-standard-illustration';
  const licenseUrl = (photo.licenseUrl || deriveLicenseUrl(photo.license)).replace(/^http:/i, 'https:');
  if (!licenseUrl && !generatedIllustration) throw new Error(`Missing license URL for ${key}: ${photo.license}`);
  const sharedGroup = sharedPhotoGroups.find(group => (
    group.sourceUrl === (photo.sourceUrl || photo.originalSrc || photo.src)
  ));
  const exactness = generatedIllustration
    ? 'illustrative-standard-based'
    : candidate.selectionExactness
      ? candidate.selectionExactness
      : sharedGroup || candidate.sourceMethod === 'wikidata-fci'
        ? 'breed-standard'
        : candidate.sourceMethod === 'openverse-unique-variant-search'
          ? 'exact-search-match'
          : 'exact';
  const entry = {
    kind: record.kind,
    name: record.name,
    fciNumber: record.fciNumber,
    breedKey: record.breedKey,
    metadataId: record.metadataId,
    categoryId: record.categoryId,
    sourceIndex: record.sourceIndex,
    localAsset: `/assets/images/animal-breeds/${candidate.outputFilename}`,
    width: metadata.width,
    height: metadata.height,
    exactness,
    sourceType: generatedIllustration ? 'generated' : 'licensed-media',
    source: photo.provider || 'Wikimedia Commons',
    author: photo.author || 'Unknown author',
    license: photo.license,
    licenseUrl,
    sourceUrl: String(photo.sourceUrl || '').replace(/^http:/i, 'https:'),
  };
  entriesByKey[key] = entry;
  if (record.kind === 'dog') addUniqueLookup(keyByBreedKey, record.breedKey, key, 'breedKey');
  if (record.kind === 'cat') addUniqueLookup(keyByMetadataId, record.metadataId, key, 'metadataId');
  addUniqueLookup(keyByCategoryIndex, `${record.categoryId}:${record.sourceIndex}`, key, 'category index');
}

const manifest = {
  version: 1,
  entriesByKey,
  keyByBreedKey,
  keyByMetadataId,
  keyByCategoryIndex,
  sharedPhotoGroups: sharedPhotoGroups.sort((left, right) => left.sourceUrl.localeCompare(right.sourceUrl)),
};
const source = `(function initAnimalBreedPhotoData(global) {\n  'use strict';\n  global.AnimalBreedPhotoData = Object.freeze(${JSON.stringify(manifest, null, 2)});\n})(window);\n`;
await fs.writeFile(manifestPath, source, 'utf8');
console.log(`Animal photo manifest: ${Object.keys(entriesByKey).length} entries, ${jobs.length} local assets`);
console.log(`Manifest: ${manifestPath}`);
