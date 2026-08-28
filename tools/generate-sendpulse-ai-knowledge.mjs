/**
 * Build the SendPulse AI Agent knowledge file from canonical website sources.
 *
 * The hand-written operating contract remains in the Markdown file. Prices,
 * salon rules, and the public-page snapshot are regenerated deterministically.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KNOWLEDGE_RELATIVE_PATH = 'knowledge/03_Resources/SendPulse_AI_Agent_Knowledge.md';
const KNOWLEDGE_PATH = path.join(ROOT, KNOWLEDGE_RELATIVE_PATH);

const PRICE_SOURCE_PATHS = [
  'assets/js/price-page-data.js',
  'assets/js/price-page-ru-data.js',
  'assets/js/price-page-locales.js',
];

const PUBLIC_PAGE_PATHS = [
  'index.html',
  'o-nas.html',
  'nashi-uslugi.html',
  'onlayn-bronirovanie.html',
  'kontakty.html',
  'reyting.html',
  'partnerstvo.html',
  'documents.html',
  'blog/blog.html',
  'blog/kak-podgotovit-sobaku.html',
  'blog/plokhaya-strizhka.html',
  'blog/preimushchestva-ekspress-linki.html',
  'blog/strizhka-koshek.html',
  'blog/zashchita-ot-parazitov.html',
];

const LOCALES = ['de', 'en', 'ru', 'uk'];
const AUTO_SITE_START = '<!-- SENDPULSE_AUTO_SITE_START -->';
const AUTO_SITE_END = '<!-- SENDPULSE_AUTO_SITE_END -->';

export function normalizeSourceText(content) {
  return content.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

function read(relativePath) {
  return normalizeSourceText(readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function sourceDigest(relativePaths) {
  const hash = createHash('sha256');
  hash.update('hundesalon-nika-sendpulse-knowledge-v1\0');
  for (const relativePath of relativePaths) {
    hash.update(relativePath.replaceAll('\\', '/'));
    hash.update('\0');
    hash.update(read(relativePath));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function loadPriceCatalog() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  for (const relativePath of PRICE_SOURCE_PATHS) {
    vm.runInContext(read(relativePath), sandbox, { filename: relativePath, timeout: 2_000 });
  }

  const catalog = sandbox.window.PricePageCatalog;
  if (!catalog?.categoriesByLocale) {
    throw new Error('PricePageCatalog.categoriesByLocale was not initialized.');
  }
  return catalog;
}

function localize(value, locale) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (Array.isArray(value)) return value.map(item => localize(item, locale)).filter(Boolean);
  const candidate = value[locale] ?? value.en ?? value.de ?? value.ru ?? value.uk ?? '';
  return Array.isArray(candidate)
    ? candidate.map(item => localize(item, locale)).filter(Boolean)
    : String(candidate).trim();
}

function chunks(items, size = 14) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function formatPriceCatalog(catalog) {
  const lines = [
    'This section is generated from the same JavaScript catalog used by the live price page. Do not edit it manually.',
    '',
    'All values marked as “from”, “ab”, “от”, or “від” are starting prices. The salon confirms the final price after assessing the pet, coat, behavior, safety, time, and requested scope.',
    'This detailed catalog is the only authoritative website price source. Generic overview cards elsewhere in the site snapshot are broad marketing summaries and must never override these category prices.',
  ];

  for (const locale of LOCALES) {
    const categories = catalog.categoriesByLocale[locale];
    if (!Array.isArray(categories) || categories.length === 0) {
      throw new Error(`No price categories found for locale ${locale}.`);
    }

    lines.push('', `### ${locale.toUpperCase()} — published catalog ###`);
    for (const category of categories) {
      const title = localize(category.title, locale) || category.id;
      lines.push('', `#### ${title} ####`);

      const summary = localize(category.summary, locale);
      if (summary) lines.push(`- Summary: ${summary}`);

      const rawBreeds = localize(category.breeds, locale);
      const breeds = Array.isArray(rawBreeds) ? rawBreeds : rawBreeds ? [rawBreeds] : [];
      chunks(breeds).forEach((group, index) => {
        const suffix = breeds.length > 14 ? ` ${index + 1}` : '';
        lines.push(`- Breeds${suffix}: ${group.join(', ')}`);
      });

      const services = (category.services || [])
        .map(service => localize(catalog.serviceLabels?.[service], locale))
        .filter(Boolean);
      if (services.length) lines.push(`- Included/listed care: ${services.join(', ')}`);

      for (const priceRow of category.priceRows || []) {
        const label = localize(priceRow.label, locale);
        const price = localize(priceRow.price, locale);
        if (label || price) lines.push(`- Price: ${label || 'Service'} — ${price || 'on request'}`);
      }

      for (const note of category.notes || []) {
        const text = localize(note, locale);
        if (text) lines.push(`- Note: ${text}`);
      }
    }
  }

  return lines.join('\n');
}

const HTML_ENTITIES = new Map([
  ['amp', '&'],
  ['apos', "'"],
  ['quot', '"'],
  ['lt', '<'],
  ['gt', '>'],
  ['nbsp', ' '],
  ['ndash', '–'],
  ['mdash', '—'],
  ['hellip', '…'],
  ['copy', '©'],
  ['reg', '®'],
  ['euro', '€'],
  ['times', '×'],
]);

function decodeEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&([a-z]+);/gi, (match, name) => HTML_ENTITIES.get(name.toLowerCase()) ?? match);
}

function removeElement(html, selectorPattern) {
  return html.replace(new RegExp(`<${selectorPattern}\\b[^>]*>[\\s\\S]*?<\\/${selectorPattern}>`, 'gi'), '\n');
}

export function extractPublicText(html, { maxCharacters = 16_000 } = {}) {
  let clean = html.replace(/<!--[\s\S]*?-->/g, '\n');
  for (const element of ['script', 'style', 'svg', 'template', 'noscript', 'header', 'nav', 'footer']) {
    clean = removeElement(clean, element);
  }
  clean = clean.replace(/<section\b[^>]*class=["'][^"']*newsletter-section[^"']*["'][^>]*>[\s\S]*?<\/section>/gi, '\n');

  const main = clean.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  const body = clean.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  clean = main || body || clean;

  clean = clean
    .replace(/\s+/g, ' ')
    .replace(/<span\b[^>]*class=["'][^"']*currency-inline[^"']*["'][^>]*><\/span>/gi, '€')
    .replace(/<input\b[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/(?:h[1-6]|p|li|div|section|article|aside|dt|dd|tr|label|button|option)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  const lines = [];
  const seen = new Set();
  let characterCount = 0;
  for (const rawLine of decodeEntities(clean).split(/\r?\n/)) {
    const line = rawLine.replace(/\s+/g, ' ').replace(/^[-•]\s*$/, '').trim();
    if (line.length < 3 || seen.has(line)) continue;
    if (/^(javascript:|data:|https?:\/\/static\.)/i.test(line)) continue;
    if (characterCount + line.length > maxCharacters) {
      lines.push('[Page text truncated after the configured safety limit.]');
      break;
    }
    seen.add(line);
    lines.push(line);
    characterCount += line.length;
  }
  return lines;
}

function formatRulesSnapshot() {
  const lines = [
    'This section is generated from the current public salon rules (`agb.html`). When it conflicts with older narrative text, this generated snapshot has priority.',
  ];

  for (const locale of LOCALES) {
    const relativePath = `${locale}/agb.html`;
    lines.push('', `### ${locale.toUpperCase()} — ${relativePath} ###`, `- URL: https://hundesalon-nika.com/${locale}/agb.html`);
    for (const line of extractPublicText(read(relativePath), { maxCharacters: 18_000 })) {
      lines.push(line.startsWith('- ') ? line : `- ${line}`);
    }
  }
  return lines.join('\n');
}

function formatPublicSiteSnapshot() {
  const lines = [
    AUTO_SITE_START,
    '## 14. Auto-generated public website snapshot ##',
    '',
    'This compact retrieval corpus is rebuilt from public pages during every production build. Generated price and AGB sections above remain authoritative for prices and salon rules. Prices shown on overview/service cards are non-authoritative summaries and must not override section 6. Legal notice and privacy-policy bodies are intentionally not copied into the customer assistant; link to those pages and hand off sensitive questions.',
  ];

  for (const locale of LOCALES) {
    for (const pagePath of PUBLIC_PAGE_PATHS) {
      const relativePath = `${locale}/${pagePath}`;
      if (!existsSync(path.join(ROOT, relativePath))) continue;
      const pageLines = extractPublicText(read(relativePath));
      if (!pageLines.length) continue;
      lines.push('', `### ${locale.toUpperCase()} — ${pagePath} ###`, `- URL: https://hundesalon-nika.com/${locale}/${pagePath}`);
      for (const line of pageLines) lines.push(line.startsWith('- ') ? line : `- ${line}`);
    }
  }

  lines.push(AUTO_SITE_END);
  return lines.join('\n');
}

function replaceSection(document, heading, nextHeadingPrefix, body) {
  const start = document.indexOf(heading);
  if (start === -1) throw new Error(`Knowledge heading not found: ${heading}`);
  const end = document.indexOf(`\n${nextHeadingPrefix}`, start + heading.length);
  if (end === -1) throw new Error(`Next knowledge heading not found: ${nextHeadingPrefix}`);
  return `${document.slice(0, start)}${heading}\n\n${body.trim()}\n${document.slice(end)}`;
}

function replaceSiteSnapshot(document, snapshot) {
  const start = document.indexOf(AUTO_SITE_START);
  const end = document.indexOf(AUTO_SITE_END);
  if (start !== -1 && end !== -1 && end > start) {
    return `${document.slice(0, start)}${snapshot}${document.slice(end + AUTO_SITE_END.length)}`;
  }
  return `${document.trimEnd()}\n\n${snapshot}\n`;
}

export function buildKnowledgeDocument({ template = read(KNOWLEDGE_RELATIVE_PATH) } = {}) {
  const sourcePaths = [
    ...PRICE_SOURCE_PATHS,
    ...LOCALES.map(locale => `${locale}/agb.html`),
    ...LOCALES.flatMap(locale => PUBLIC_PAGE_PATHS.map(pagePath => `${locale}/${pagePath}`))
      .filter(relativePath => existsSync(path.join(ROOT, relativePath))),
  ];
  const fingerprint = sourceDigest(sourcePaths);
  const catalog = loadPriceCatalog();

  let document = normalizeSourceText(template);
  const fingerprintLine = `Generated source fingerprint: sha256:${fingerprint}`;
  const fingerprintPattern = /^(?:Generated source fingerprint|Last content audit):.*$/m;
  if (fingerprintPattern.test(document)) {
    document = document.replace(fingerprintPattern, fingerprintLine);
  } else {
    document = document.replace(/^(# .+?#)\s*/m, `$1\n\n${fingerprintLine}\n\n`);
  }

  document = replaceSection(
    document,
    '## 6. Canonical published price list ##',
    '## 7.',
    formatPriceCatalog(catalog),
  );
  document = replaceSection(
    document,
    '## 8. First-visit preparation and salon rules ##',
    '## 9.',
    formatRulesSnapshot(),
  );
  document = replaceSiteSnapshot(document, formatPublicSiteSnapshot());
  return { content: `${document.trimEnd()}\n`, fingerprint, sourcePaths };
}

export function writeKnowledgeDocument({ check = false } = {}) {
  const current = read(KNOWLEDGE_RELATIVE_PATH);
  const result = buildKnowledgeDocument({ template: current });
  if (check) {
    if (current !== result.content) {
      throw new Error(`Knowledge file is stale. Run: npm run knowledge:build`);
    }
    return { ...result, changed: false };
  }

  const changed = current !== result.content;
  if (changed) writeFileSync(KNOWLEDGE_PATH, result.content, 'utf8');
  return { ...result, changed };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  try {
    const check = process.argv.includes('--check');
    const result = writeKnowledgeDocument({ check });
    const action = check ? 'verified' : result.changed ? 'updated' : 'unchanged';
    console.log(`[sendpulse-knowledge] ${action}: ${KNOWLEDGE_RELATIVE_PATH}`);
    console.log(`[sendpulse-knowledge] source fingerprint: ${result.fingerprint.slice(0, 16)}`);
    console.log(`[sendpulse-knowledge] canonical sources: ${result.sourcePaths.length}`);
  } catch (error) {
    console.error(`[sendpulse-knowledge] ${error.message}`);
    process.exitCode = 1;
  }
}
