import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY_PATH = path.join(PROJECT_ROOT, 'assets', 'js', 'fci-dog-breeds-data.js');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'data', 'fci-dog-breed-translations.json');
const RKF_INDEX_URL = 'https://help.rkf.online/ru/knowledge_base/cat/13/standarti-porod';
const UKU_GROUP_URL = group => `https://uku.com.ua/plem_work/breed_fci/${String(group).padStart(2, '0')}.html`;
const FETCH_ATTEMPTS = 3;
const FETCH_TIMEOUT_MS = 30_000;
const USER_AGENT = 'HUNDESALON_NIKA breed translation updater/1.0 (+https://hundesalon-nika.com)';

const RU_OVERRIDES = Object.freeze({
  49: 'Финский шпиц',
});

const UK_OVERRIDES = Object.freeze({
  275: 'Бразильський слідовий собака',
  368: 'Трансмонтанський мастиф',
  369: 'Континентальний бульдог',
});

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function fetchText(url) {
  let lastError;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': USER_AGENT },
        redirect: 'follow',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || '';
      const headerCharset = contentType.match(/charset\s*=\s*['"]?([^;'"\s]+)/iu)?.[1];
      const asciiPreview = new TextDecoder('windows-1252').decode(bytes.slice(0, 4096));
      const metaCharset = asciiPreview.match(/charset\s*=\s*['"]?([^;'"\s/>]+)/iu)?.[1];
      const charset = (headerCharset || metaCharset || 'utf-8').toLowerCase();
      return new TextDecoder(charset).decode(bytes);
    } catch (error) {
      lastError = error;
      if (attempt < FETCH_ATTEMPTS) await wait(attempt * 350);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`Failed to fetch ${url}: ${lastError?.message || lastError}`);
}

function decodeEntities(value) {
  const named = { amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"' };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/giu, (match, entity) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith('#')) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    return named[entity.toLowerCase()] ?? match;
  });
}

function htmlToText(value) {
  return decodeEntities(value)
    .replace(/<br\s*\/?>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

async function loadRegistry() {
  const context = vm.createContext({});
  vm.runInContext(await readFile(REGISTRY_PATH, 'utf8'), context, {
    filename: path.relative(PROJECT_ROOT, REGISTRY_PATH),
  });
  const registry = context.FciDogBreedsData;
  if (!Array.isArray(registry?.breeds) || registry.breeds.length === 0) {
    throw new Error('FCI dog registry was not initialized');
  }
  return JSON.parse(JSON.stringify(registry));
}

function addTranslation(target, fciNumber, name, sourceLabel) {
  if (!Number.isInteger(fciNumber) || !name) return;
  const existing = target.get(fciNumber);
  if (existing && existing !== name) {
    throw new Error(`${sourceLabel} contains conflicting names for FCI ${fciNumber}: ${existing} / ${name}`);
  }
  target.set(fciNumber, name);
}

async function loadRussianNames() {
  const indexHtml = await fetchText(RKF_INDEX_URL);
  const groupUrls = new Set();
  const categoryPattern = /href="(?<href>\/ru\/knowledge_base\/cat\/\d+\/[^"]+)"[^>]*>(?<name>[\s\S]*?)<\/a>/giu;
  for (const match of indexHtml.matchAll(categoryPattern)) {
    if (/группа\s+FCI/iu.test(htmlToText(match.groups.name))) {
      groupUrls.add(new URL(match.groups.href, RKF_INDEX_URL).href);
    }
  }
  if (groupUrls.size !== 10) throw new Error(`Expected 10 RKF group pages, found ${groupUrls.size}`);

  const names = new Map();
  for (const url of groupUrls) {
    const html = await fetchText(url);
    const articlePattern = /<a[^>]+href="[^"]*\/knowledge_base\/art\/[^"]+"[^>]*>(?<name>[\s\S]*?)<\/a>/giu;
    for (const match of html.matchAll(articlePattern)) {
      const label = htmlToText(match.groups.name);
      const parsed = label.match(/^(?<name>.+?)\s*№\s*(?<number>\d+)\b/u);
      if (!parsed) continue;
      addTranslation(names, Number(parsed.groups.number), parsed.groups.name.trim(), 'RKF');
    }
  }
  for (const [number, name] of Object.entries(RU_OVERRIDES)) names.set(Number(number), name);
  return names;
}

async function loadUkrainianNames() {
  const names = new Map();
  for (let group = 1; group <= 10; group += 1) {
    const html = await fetchText(UKU_GROUP_URL(group));
    for (const row of html.matchAll(/<tr[^>]*>(?<body>[\s\S]*?)<\/tr>/giu)) {
      const cells = [...row.groups.body.matchAll(/<td[^>]*>(?<body>[\s\S]*?)<\/td>/giu)]
        .map(match => htmlToText(match.groups.body));
      if (cells.length < 5 || !/^\d+$/u.test(cells[1])) continue;
      addTranslation(names, Number(cells[1]), cells[4], 'UKU');
    }
  }
  for (const [number, name] of Object.entries(UK_OVERRIDES)) names.set(Number(number), name);
  return names;
}

function validateCoverage(registry, names, locale) {
  const officialNumbers = new Set(registry.breeds.map(breed => breed.fciNumber));
  const unexpected = [...names.keys()].filter(number => !officialNumbers.has(number));
  const missing = registry.breeds
    .map(breed => breed.fciNumber)
    .filter(number => !names.has(number));
  if (unexpected.length) throw new Error(`${locale} source contains unknown FCI numbers: ${unexpected.join(', ')}`);
  if (missing.length) throw new Error(`${locale} source is missing FCI numbers: ${missing.join(', ')}`);

  const cyrillic = /\p{Script=Cyrillic}/u;
  for (const [number, name] of names) {
    if (!name || !cyrillic.test(name)) throw new Error(`${locale} name for FCI ${number} is not localized: ${name}`);
  }
}

function parseCheckedAt() {
  const argument = process.argv.slice(2).find(value => value.startsWith('--checked-at='));
  if (!argument) return new Date().toISOString().slice(0, 10);
  const value = argument.slice('--checked-at='.length);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`Invalid --checked-at date: ${value}`);
  }
  return value;
}

async function main() {
  const registry = await loadRegistry();
  const [russianNames, ukrainianNames] = await Promise.all([
    loadRussianNames(),
    loadUkrainianNames(),
  ]);
  validateCoverage(registry, russianNames, 'RU');
  validateCoverage(registry, ukrainianNames, 'UK');

  const translations = Object.fromEntries(
    registry.breeds.map(breed => [String(breed.fciNumber), {
      ru: russianNames.get(breed.fciNumber),
      uk: ukrainianNames.get(breed.fciNumber),
    }])
  );
  const output = {
    schemaVersion: 1,
    checkedAt: parseCheckedAt(),
    sources: {
      ru: RKF_INDEX_URL,
      uk: 'https://uku.com.ua/plem_work/breed_fci/',
      overrides: {
        ru: 'FCI 49 uses the established Russian salon label because the current RKF index omits it.',
        uk: 'FCI 275, 368 and 369 use reviewed Ukrainian names because the current UKU group pages omit them.',
      },
    },
    translations,
  };
  await writeFile(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Generated ${Object.keys(translations).length} RU/UK FCI translations in ${path.relative(PROJECT_ROOT, OUTPUT_PATH)}`);
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
