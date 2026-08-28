/**
 * Extend config/meta-descriptions.mjs entries to 155–165 chars (Bing recommendation).
 * npm run seo:extend-descriptions
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { META_DESCRIPTIONS } from '../config/meta-descriptions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIN = 155;
const MAX = 170;

const SUFFIX = {
  de: [
    ' Termin online oder telefonisch bei HUNDESALON NIKA in Leipzig.',
    ' Professionelle Fellpflege in Leipzig-Sachsen — jetzt Termin sichern.',
    ' Hundesalon in Leipzig — ruhige Betreuung für Hund und Katze.',
  ],
  en: [
    ' Book online or by phone at HUNDESALON NIKA in Leipzig, Germany.',
    ' Professional grooming in Leipzig, Saxony — reserve your appointment today.',
    ' Calm, caring pet salon in Leipzig for dogs and cats.',
  ],
  ru: [
    ' Запись онлайн или по телефону в салоне HUNDESALON NIKA в Лейпциге.',
    ' Профессиональный груминг в Лейпциге — забронируйте визит заранее.',
    ' Салон в Лейпциге с бережным уходом за собаками и кошками.',
  ],
  uk: [
    ' Запис онлайн або за телефоном у салоні HUNDESALON NIKA в Лейпцигу.',
    ' Професійний грумінг у Лейпцигу — забронюйте візит заздалегідь.',
    ' Салон у Лейпцигу з дбайливим доглядом за собаками й котами.',
  ],
};

const LEGAL_SUFFIX = {
  de: ' Leipzig, Sachsen.',
  en: ' Leipzig, Saxony.',
  ru: ' Лейпциг, Саксония.',
  uk: ' Лейпциг, Саксонія.',
};

function isLegal(page) {
  return /impressum|datenschutz/i.test(page);
}

const TAIL = {
  de: [' in Leipzig.', ' — HUNDESALON NIKA.', ' Sachsen.', ' Termin online in Leipzig.'],
  en: [' in Leipzig.', ' — HUNDESALON NIKA.', ' Saxony.', ' Book online in Leipzig.'],
  ru: [' в Лейпциге.', ' — HUNDESALON NIKA.', ' Саксония.', ' Запись онлайн в Лейпциге.'],
  uk: [' у Лейпцигу.', ' — HUNDESALON NIKA.', ' Саксонія.', ' Запис онлайн у Лейпцигу.'],
};

const BOOST = {
  de: [' HUNDESALON NIKA — Hundesalon in Leipzig.', ' Für Hunde und Katzen in Leipzig-Sachsen.'],
  en: [' HUNDESALON NIKA grooming salon in Leipzig.', ' For dogs and cats in Leipzig, Saxony.'],
  ru: [' Салон HUNDESALON NIKA в Лейпциге.', ' Для собак и кошек в Лейпциге, Саксония.'],
  uk: [' Салон HUNDESALON NIKA у Лейпцигу.', ' Для собак і котів у Лейпцигу, Саксонія.'],
};

function extendOne(page, lang, text) {
  if (!text || text.length >= MIN) return text;
  const base = text.replace(/\s+$/, '');
  if (isLegal(page)) {
    if (base.length >= MIN) return text;
    const legal = `${base}${LEGAL_SUFFIX[lang]}`;
    if (legal.length >= MIN && legal.length <= MAX) return legal;
    throw new Error(`${page} (${lang}): legal description needs manual edit (${legal.length})`);
  }

  const pool = base.length < 132
      ? [...BOOST[lang], ...TAIL[lang], ...SUFFIX[lang]]
      : [...TAIL[lang], ...SUFFIX[lang]];

  let closest = base;
  for (const suffix of pool) {
    const trimmed = suffix.trim();
    if (trimmed && base.includes(trimmed)) continue;
    const candidate = `${base}${suffix}`;
    if (candidate.length >= MIN && candidate.length <= MAX) return candidate;
    if (candidate.length >= MIN && candidate.length < closest.length) closest = candidate;
    if (candidate.length >= MIN && closest.length < MIN) closest = candidate;
  }

  if (closest.length >= MIN && closest.length <= MAX) return closest;
  if (closest.length > MAX) {
    throw new Error(`${page} (${lang}): shortest extension is ${closest.length} chars — edit manually`);
  }
  throw new Error(`${page} (${lang}): could not reach ${MIN} chars from ${base.length}`);
}

const next = structuredClone(META_DESCRIPTIONS);
const changed = [];

for (const [page, langs] of Object.entries(next)) {
  for (const lang of Object.keys(langs)) {
    const before = langs[lang];
    const after = extendOne(page, lang, before);
    if (after !== before) {
      langs[lang] = after;
      changed.push({ page, lang, before: before.length, after: after.length });
    }
  }
}

function serializeConfig(obj) {
  const lines = [
    '/** Rich meta descriptions (155–165 chars) — de / en / ru / uk by page path inside lang folder. */',
    'export const META_DESCRIPTIONS = {',
  ];
  for (const [page, langs] of Object.entries(obj)) {
    lines.push(`  '${page}': {`);
    for (const [lang, text] of Object.entries(langs)) {
      lines.push(`    ${lang}: ${JSON.stringify(text)},`);
    }
    lines.push('  },');
  }
  lines.push('};', '');
  return lines.join('\n');
}

const outPath = path.join(root, 'config', 'meta-descriptions.mjs');
fs.writeFileSync(outPath, serializeConfig(next), 'utf8');

const stillShort = [];
for (const [page, langs] of Object.entries(next)) {
  for (const [lang, text] of Object.entries(langs)) {
    if (text.length < MIN) stillShort.push({ page, lang, len: text.length });
  }
}

console.log(JSON.stringify({ changed: changed.length, stillShort, samples: changed.slice(0, 8) }, null, 2));
if (stillShort.length) process.exit(1);
