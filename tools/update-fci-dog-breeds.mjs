import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://www.fci.be/en/Nomenclature/Default.aspx';
const GERMAN_SOURCE_URL = 'https://www.fci.be/de/Nomenclature/Default.aspx';
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'assets', 'js', 'fci-dog-breeds-data.js');
const FETCH_ATTEMPTS = 3;
const FETCH_TIMEOUT_MS = 30_000;
const USER_AGENT =
  'HUNDESALON_NIKA FCI breed registry updater/1.0 (+https://hundesalon-nika.com)';

const HTML_ENTITIES = Object.freeze({
  amp: '&',
  apos: "'",
  gt: '>',
  hellip: '…',
  ldquo: '“',
  lsquo: '‘',
  lt: '<',
  mdash: '—',
  nbsp: ' ',
  ndash: '–',
  quot: '"',
  rdquo: '”',
  rsquo: '’',
});

function printUsage() {
  console.log(`Usage: node tools/update-fci-dog-breeds.mjs [options]

Options:
  --translations <path>  JSON map keyed by FCI number. Every entry must contain
                         non-empty Cyrillic "ru" and "uk" names, and the map
                         must cover every generated breed.
  --generated-at <date>  Override generatedAt with an ISO-compatible date.
                         SOURCE_DATE_EPOCH is also supported.
  --help                 Show this help.

Translation map example:
  {
    "translations": {
      "1": { "ru": "...", "uk": "..." }
    }
  }`);
}

function parseArguments(argv) {
  const options = {
    generatedAt: null,
    translationsPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--help') {
      printUsage();
      process.exit(0);
    }

    if (argument === '--translations' || argument === '--generated-at') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for ${argument}`);
      }

      if (argument === '--translations') options.translationsPath = value;
      if (argument === '--generated-at') options.generatedAt = value;
      index += 1;
      continue;
    }

    if (argument.startsWith('--translations=')) {
      options.translationsPath = argument.slice('--translations='.length);
      continue;
    }

    if (argument.startsWith('--generated-at=')) {
      options.generatedAt = argument.slice('--generated-at='.length);
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function resolveGeneratedAt(explicitValue) {
  let value = explicitValue;

  if (!value && process.env.SOURCE_DATE_EPOCH) {
    const epochSeconds = Number(process.env.SOURCE_DATE_EPOCH);
    if (!Number.isInteger(epochSeconds) || epochSeconds < 0) {
      throw new Error('SOURCE_DATE_EPOCH must be a non-negative integer');
    }
    value = new Date(epochSeconds * 1000).toISOString();
  }

  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid generatedAt date: ${value}`);
  }

  return date.toISOString();
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

const responseCache = new Map();

async function fetchText(url) {
  if (responseCache.has(url)) return responseCache.get(url);

  let lastError;

  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': USER_AGENT,
        },
        redirect: 'follow',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      if (!html.includes('<html')) {
        throw new Error('Response does not look like an HTML document');
      }

      responseCache.set(url, html);
      return html;
    } catch (error) {
      lastError = error;
      if (attempt < FETCH_ATTEMPTS) await wait(350 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`Failed to fetch ${url}: ${lastError?.message || lastError}`);
}

function decodeHtmlEntities(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z][\da-z]+);/giu, (match, entity) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      if (codePoint <= 0x10ffff) return String.fromCodePoint(codePoint);
      throw new Error(`Invalid hexadecimal HTML entity: ${match}`);
    }

    if (entity.startsWith('#')) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      if (codePoint <= 0x10ffff) return String.fromCodePoint(codePoint);
      throw new Error(`Invalid decimal HTML entity: ${match}`);
    }

    const decoded = HTML_ENTITIES[entity];
    if (decoded === undefined) throw new Error(`Unsupported HTML entity: ${match}`);
    return decoded;
  });
}

function htmlToText(html) {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/giu, ' ')
      .replace(/<[^>]*>/gu, ' ')
  )
    .replace(/\u00a0/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function readAttribute(attributes, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const pattern = new RegExp(
    `(?:^|\\s)${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'iu'
  );
  const match = attributes.match(pattern);
  return match ? decodeHtmlEntities(match[1] ?? match[2] ?? match[3]) : null;
}

function extractAnchors(html) {
  const anchors = [];
  const pattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/giu;
  let match;

  while ((match = pattern.exec(html)) !== null) {
    anchors.push({
      attributes: match[1],
      html: match[2],
      index: match.index,
    });
  }

  return anchors;
}

function extractSpans(html) {
  const spans = [];
  const pattern = /<span\b([^>]*)>([\s\S]*?)<\/span>/giu;
  let match;

  while ((match = pattern.exec(html)) !== null) {
    spans.push({
      attributes: match[1],
      html: match[2],
      index: match.index,
    });
  }

  return spans;
}

function extractFciNumberFromHref(href) {
  const match = href.match(/-(\d{1,3})\.html(?:[?#].*)?$/iu);
  return match ? Number.parseInt(match[1], 10) : null;
}

function extractLocalizedBreedName(label, fciNumber) {
  const numberMatches = [...label.matchAll(/\((\d{1,3})\)/gu)];
  const numberMatch = numberMatches.find(match => Number.parseInt(match[1], 10) === fciNumber);

  if (!numberMatch) {
    throw new Error(`Breed label does not contain FCI number ${fciNumber}: ${label}`);
  }

  const originalName = label.slice(0, numberMatch.index).trim();
  const localizedSuffix = label.slice(numberMatch.index + numberMatch[0].length).trim();

  if (!localizedSuffix) return originalName;

  const localizedMatch = localizedSuffix.match(/^\((.+)\)$/u);
  if (!localizedMatch) {
    throw new Error(`Unexpected localized breed label format: ${label}`);
  }

  return localizedMatch[1].trim();
}

function parseBreedAnchor(anchor) {
  const className = readAttribute(anchor.attributes, 'class') || '';
  if (!className.split(/\s+/u).includes('nom')) return null;

  const href = readAttribute(anchor.attributes, 'href');
  if (!href || !/\/nomenclature\//iu.test(href)) return null;

  const fciNumber = extractFciNumberFromHref(href);
  if (!fciNumber) return null;

  const label = htmlToText(anchor.html);
  return {
    fciNumber,
    href,
    name: extractLocalizedBreedName(label, fciNumber),
  };
}

function parseBreedAnchors(html) {
  const breeds = extractAnchors(html).map(parseBreedAnchor).filter(Boolean);
  assertUniqueNumbers(breeds, 'breed listing');
  return breeds;
}

function parseGroupLinks(html, locale) {
  const expectedWord = locale === 'de' ? 'Gruppe' : 'Group';
  const links = new Map();

  for (const anchor of extractAnchors(html)) {
    const label = htmlToText(anchor.html);
    const match = label.match(new RegExp(`^${expectedWord}\\s+(\\d{1,2})$`, 'iu'));
    if (!match) continue;

    const group = Number.parseInt(match[1], 10);
    const href = readAttribute(anchor.attributes, 'href');
    if (!href || !/\/nomenclature\//iu.test(href)) continue;
    if (links.has(group)) throw new Error(`Duplicate ${locale} link for FCI group ${group}`);
    links.set(group, new URL(href, locale === 'de' ? GERMAN_SOURCE_URL : SOURCE_URL).href);
  }

  for (let group = 1; group <= 10; group += 1) {
    if (!links.has(group)) throw new Error(`Missing ${locale} link for FCI group ${group}`);
  }

  if (links.size !== 10) {
    throw new Error(`Expected 10 ${locale} FCI group links, found ${links.size}`);
  }

  return links;
}

function parseSectionLabel(value, group) {
  const match = value.match(/^Section\s+(\d+)\s*:\s*(.+)$/iu);
  if (!match) throw new Error(`Unexpected section label in group ${group}: ${value}`);
  return {
    name: match[2].trim(),
    number: Number.parseInt(match[1], 10),
  };
}

function parseSubsectionLabel(value, group, section) {
  const match = value.match(/^(\d+)\.(\d+)\s+(.+)$/u);
  if (!match) throw new Error(`Unexpected subsection label in group ${group}: ${value}`);

  const parentSection = Number.parseInt(match[1], 10);
  if (parentSection !== section) {
    throw new Error(
      `Subsection ${value} belongs to section ${parentSection}, expected ${section} in group ${group}`
    );
  }

  return {
    name: match[3].trim(),
    number: Number.parseInt(match[2], 10),
  };
}

function parseDefinitiveGroupPage(html, group) {
  const tokens = [];

  for (const span of extractSpans(html)) {
    const id = readAttribute(span.attributes, 'id') || '';
    if (/^ContentPlaceHolder1_SectionsRepeater_SectionLabel_\d+$/u.test(id)) {
      tokens.push({ index: span.index, type: 'section', value: htmlToText(span.html) });
    } else if (
      /^ContentPlaceHolder1_SectionsRepeater_SousSectionsRepeater_\d+_SousSectionLabel_\d+$/u.test(
        id
      )
    ) {
      tokens.push({ index: span.index, type: 'subsection', value: htmlToText(span.html) });
    }
  }

  for (const anchor of extractAnchors(html)) {
    const breed = parseBreedAnchor(anchor);
    if (breed) tokens.push({ breed, index: anchor.index, type: 'breed' });
  }

  tokens.sort((left, right) => left.index - right.index);

  const records = [];
  const sections = [];
  const subsections = [];
  const pageHasSections = tokens.some(token => token.type === 'section');
  let currentSection = null;
  let currentSubsection = null;

  for (const token of tokens) {
    if (token.type === 'section') {
      currentSection = parseSectionLabel(token.value, group);
      currentSubsection = null;
      sections.push(currentSection);
      continue;
    }

    if (token.type === 'subsection') {
      if (!currentSection) {
        throw new Error(`Subsection appears before a section in FCI group ${group}`);
      }
      currentSubsection = parseSubsectionLabel(token.value, group, currentSection.number);
      subsections.push({ ...currentSubsection, section: currentSection.number });
      continue;
    }

    if (pageHasSections && !currentSection) {
      throw new Error(`Breed ${token.breed.fciNumber} has no section in FCI group ${group}`);
    }

    records.push({
      ...token.breed,
      group,
      section: currentSection?.number ?? null,
      sectionName: currentSection?.name ?? null,
      subsection: currentSubsection?.number ?? null,
      subsectionName: currentSubsection?.name ?? null,
    });
  }

  if (records.length === 0) throw new Error(`No definitive breeds found in FCI group ${group}`);
  assertUniqueNumbers(records, `FCI group ${group}`);

  return { records, sections, subsections };
}

function normalizeClassificationName(value) {
  return value
    .normalize('NFKD')
    .replace(/\p{Mark}+/gu, '')
    .toLocaleLowerCase('en')
    .replace(/&/gu, ' and ')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim();
}

function addClassificationEntries(index, group, page) {
  for (const section of page.sections) {
    const key = `${group}:${normalizeClassificationName(section.name)}`;
    const existing = index.sections.get(key);
    if (existing && existing.number !== section.number) {
      throw new Error(`Ambiguous section name in FCI group ${group}: ${section.name}`);
    }
    index.sections.set(key, section);
  }

  for (const subsection of page.subsections) {
    const key = `${group}:${subsection.section}:${normalizeClassificationName(subsection.name)}`;
    const existing = index.subsections.get(key);
    if (existing && existing.number !== subsection.number) {
      throw new Error(`Ambiguous subsection name in FCI group ${group}: ${subsection.name}`);
    }
    index.subsections.set(key, subsection);
  }
}

function extractElementTextById(html, id, required = true) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const pattern = new RegExp(
    `<(a|span)\\b(?=[^>]*\\bid\\s*=\\s*["']${escapedId}["'])[^>]*>([\\s\\S]*?)<\\/\\1>`,
    'iu'
  );
  const match = html.match(pattern);
  const value = match ? htmlToText(match[2]) : '';

  if (required && !value) throw new Error(`Missing #${id} on FCI breed detail page`);
  return value || null;
}

function resolveSection(index, group, name, fciNumber) {
  const key = `${group}:${normalizeClassificationName(name)}`;
  const section = index.sections.get(key);
  if (section) return section.number;

  const available = [...index.sections.entries()]
    .filter(([entryKey]) => entryKey.startsWith(`${group}:`))
    .map(([, value]) => `${value.number}: ${value.name}`)
    .join('; ');
  throw new Error(
    `Cannot resolve section "${name}" for provisional breed ${fciNumber} in group ${group}. ` +
      `Available sections: ${available}`
  );
}

function resolveSubsection(index, group, section, name, fciNumber) {
  if (!name) return null;

  const key = `${group}:${section}:${normalizeClassificationName(name)}`;
  const subsection = index.subsections.get(key);
  if (subsection) return subsection.number;

  const available = [...index.subsections.entries()]
    .filter(([entryKey]) => entryKey.startsWith(`${group}:${section}:`))
    .map(([, value]) => `${section}.${value.number}: ${value.name}`)
    .join('; ');
  throw new Error(
    `Cannot resolve subsection "${name}" for provisional breed ${fciNumber} in group ${group}. ` +
      `Available subsections: ${available || 'none'}`
  );
}

function parseProvisionalDetailPage(html, fciNumber, classificationIndex) {
  const groupLabel = extractElementTextById(html, 'ContentPlaceHolder1_GroupeHyperLink');
  const groupMatch = groupLabel.match(/n\s*[°º]\s*(\d{1,2})/iu);
  if (!groupMatch) throw new Error(`Cannot parse group for provisional breed ${fciNumber}`);

  const group = Number.parseInt(groupMatch[1], 10);
  const sectionName = extractElementTextById(
    html,
    'ContentPlaceHolder1_SectionLabel',
    false
  );
  const subsectionName = extractElementTextById(
    html,
    'ContentPlaceHolder1_SousSectionLabel',
    false
  );
  const section = sectionName
    ? resolveSection(classificationIndex, group, sectionName, fciNumber)
    : null;
  if (subsectionName && section === null) {
    throw new Error(`Breed ${fciNumber} has a subsection but no section`);
  }
  const subsection = resolveSubsection(
    classificationIndex,
    group,
    section,
    subsectionName,
    fciNumber
  );

  return {
    fciNumber,
    group,
    names: {
      en: extractElementTextById(html, 'ContentPlaceHolder1_NomEnLabel'),
      de: extractElementTextById(html, 'ContentPlaceHolder1_NomDELabel'),
    },
    section,
    status: 'provisional',
    subsection,
  };
}

function assertSameNumberSet(left, right, context) {
  const leftNumbers = new Set(left.map(record => record.fciNumber));
  const rightNumbers = new Set(right.map(record => record.fciNumber));
  const missingFromRight = [...leftNumbers].filter(number => !rightNumbers.has(number));
  const missingFromLeft = [...rightNumbers].filter(number => !leftNumbers.has(number));

  if (missingFromRight.length || missingFromLeft.length) {
    throw new Error(
      `${context} FCI-number mismatch. Missing from DE: ${missingFromRight.join(', ') || 'none'}; ` +
        `missing from EN: ${missingFromLeft.join(', ') || 'none'}`
    );
  }
}

function assertUniqueNumbers(records, context) {
  const seen = new Set();
  const duplicates = new Set();

  for (const record of records) {
    if (seen.has(record.fciNumber)) duplicates.add(record.fciNumber);
    seen.add(record.fciNumber);
  }

  if (duplicates.size) {
    throw new Error(`Duplicate FCI numbers in ${context}: ${[...duplicates].join(', ')}`);
  }
}

function validateOfficialRecords(records) {
  assertUniqueNumbers(records, 'generated registry');

  for (const record of records) {
    if (!Number.isInteger(record.fciNumber) || record.fciNumber <= 0) {
      throw new Error(`Invalid FCI number: ${record.fciNumber}`);
    }
    if (!['definitive', 'provisional'].includes(record.status)) {
      throw new Error(`Invalid status for FCI ${record.fciNumber}: ${record.status}`);
    }
    if (!Number.isInteger(record.group) || record.group < 1 || record.group > 10) {
      throw new Error(`Invalid group for FCI ${record.fciNumber}: ${record.group}`);
    }
    if (
      record.section !== null &&
      (!Number.isInteger(record.section) || record.section <= 0)
    ) {
      throw new Error(`Invalid section for FCI ${record.fciNumber}: ${record.section}`);
    }
    if (
      record.subsection !== null &&
      (!Number.isInteger(record.subsection) || record.subsection <= 0)
    ) {
      throw new Error(`Invalid subsection for FCI ${record.fciNumber}: ${record.subsection}`);
    }
    if (!record.names.en || !record.names.de) {
      throw new Error(`Missing official EN/DE name for FCI ${record.fciNumber}`);
    }
  }
}

async function loadTranslations(translationsPath, records) {
  if (!translationsPath) return new Map();

  const absolutePath = path.resolve(process.cwd(), translationsPath);
  const parsed = JSON.parse(await readFile(absolutePath, 'utf8'));
  const sourceMap = parsed?.translations ?? parsed;
  if (!sourceMap || typeof sourceMap !== 'object' || Array.isArray(sourceMap)) {
    throw new Error('Translation map must be an object keyed by FCI number');
  }

  const knownNumbers = new Set(records.map(record => record.fciNumber));
  const translations = new Map();
  const cyrillic = /\p{Script=Cyrillic}/u;

  for (const [rawNumber, value] of Object.entries(sourceMap)) {
    const fciNumber = Number(rawNumber);
    if (!Number.isInteger(fciNumber) || String(fciNumber) !== rawNumber) {
      throw new Error(`Invalid FCI-number key in translation map: ${rawNumber}`);
    }
    if (!knownNumbers.has(fciNumber)) {
      throw new Error(`Translation map contains unknown FCI number ${fciNumber}`);
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`Translation entry for FCI ${fciNumber} must be an object`);
    }

    const unexpectedKeys = Object.keys(value).filter(key => !['ru', 'uk'].includes(key));
    if (unexpectedKeys.length) {
      throw new Error(
        `Translation entry for FCI ${fciNumber} has unsupported keys: ${unexpectedKeys.join(', ')}`
      );
    }

    const ru = typeof value.ru === 'string' ? value.ru.replace(/\s+/gu, ' ').trim() : '';
    const uk = typeof value.uk === 'string' ? value.uk.replace(/\s+/gu, ' ').trim() : '';
    if (!ru || !uk) {
      throw new Error(`Translation entry for FCI ${fciNumber} must contain both ru and uk`);
    }
    if (!cyrillic.test(ru) || !cyrillic.test(uk)) {
      throw new Error(`RU/UK names for FCI ${fciNumber} must contain Cyrillic characters`);
    }

    translations.set(fciNumber, { ru, uk });
  }

  const missing = records
    .map(record => record.fciNumber)
    .filter(fciNumber => !translations.has(fciNumber));
  if (missing.length) {
    throw new Error(
      `Translation map must cover every breed; missing ${missing.length} FCI numbers: ` +
        missing.slice(0, 20).join(', ') +
        (missing.length > 20 ? ', ...' : '')
    );
  }

  return translations;
}

function applyTranslations(records, translations) {
  if (translations.size === 0) return records;

  return records.map(record => ({
    ...record,
    names: {
      en: record.names.en,
      de: record.names.de,
      ru: translations.get(record.fciNumber).ru,
      uk: translations.get(record.fciNumber).uk,
    },
  }));
}

function renderRegistry(records, generatedAt) {
  const registry = {
    schemaVersion: 1,
    source: SOURCE_URL,
    generatedAt,
    breeds: records,
  };
  const json = JSON.stringify(registry, null, 2).replace(/\n/gu, '\n  ');

  return `/* This file is generated by tools/update-fci-dog-breeds.mjs. Do not edit manually. */
(function initFciDogBreedsData(global) {
  'use strict';

  global.FciDogBreedsData = ${json};
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

async function buildOfficialRegistry() {
  const [englishIndexHtml, germanIndexHtml] = await Promise.all([
    fetchText(SOURCE_URL),
    fetchText(GERMAN_SOURCE_URL),
  ]);
  const englishGroupLinks = parseGroupLinks(englishIndexHtml, 'en');
  const germanGroupLinks = parseGroupLinks(germanIndexHtml, 'de');
  const definitiveRecords = [];
  const classificationIndex = {
    sections: new Map(),
    subsections: new Map(),
  };

  for (let group = 1; group <= 10; group += 1) {
    const [englishGroupHtml, germanGroupHtml] = await Promise.all([
      fetchText(englishGroupLinks.get(group)),
      fetchText(germanGroupLinks.get(group)),
    ]);
    const englishPage = parseDefinitiveGroupPage(englishGroupHtml, group);
    const germanBreeds = parseBreedAnchors(germanGroupHtml);
    assertSameNumberSet(englishPage.records, germanBreeds, `FCI group ${group}`);
    addClassificationEntries(classificationIndex, group, englishPage);

    const germanNames = new Map(
      germanBreeds.map(record => [record.fciNumber, record.name])
    );
    for (const record of englishPage.records) {
      definitiveRecords.push({
        fciNumber: record.fciNumber,
        group,
        names: {
          en: record.name,
          de: germanNames.get(record.fciNumber),
        },
        section: record.section,
        status: 'definitive',
        subsection: record.subsection,
      });
    }
  }

  const provisionalLinks = parseBreedAnchors(englishIndexHtml);
  if (provisionalLinks.length === 0) {
    throw new Error('No provisionally recognised breeds found on the FCI index page');
  }

  const provisionalRecords = [];
  for (const provisional of provisionalLinks) {
    const detailUrl = new URL(provisional.href, SOURCE_URL).href;
    const detailHtml = await fetchText(detailUrl);
    provisionalRecords.push(
      parseProvisionalDetailPage(detailHtml, provisional.fciNumber, classificationIndex)
    );
  }

  assertUniqueNumbers(definitiveRecords, 'definitively recognised breeds');
  assertUniqueNumbers(provisionalRecords, 'provisionally recognised breeds');

  const records = [...definitiveRecords, ...provisionalRecords].sort(
    (left, right) => left.fciNumber - right.fciNumber
  );
  validateOfficialRecords(records);
  return records;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const generatedAt = resolveGeneratedAt(options.generatedAt);
  const officialRecords = await buildOfficialRegistry();
  const translations = await loadTranslations(options.translationsPath, officialRecords);
  const records = applyTranslations(officialRecords, translations);
  await writeFile(OUTPUT_PATH, renderRegistry(records, generatedAt), 'utf8');

  const definitiveCount = records.filter(record => record.status === 'definitive').length;
  const provisionalCount = records.length - definitiveCount;
  console.log(
    `Generated ${records.length} FCI breeds (${definitiveCount} definitive, ` +
      `${provisionalCount} provisional) in ${path.relative(PROJECT_ROOT, OUTPUT_PATH)}`
  );
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
