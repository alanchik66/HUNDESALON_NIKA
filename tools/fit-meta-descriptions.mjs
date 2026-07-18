/**
 * Fit every meta description to 160–168 chars using COMPLETE closing phrases only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { META_DESCRIPTIONS } from '../config/meta-descriptions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIN = 160;
const MAX = 168;

const CLOSE = {
  de: [
    ' heute.',
    ' jetzt.',
    ' Leipzig.',
    ' in Sachsen.',
    ' — jetzt buchen.',
    ' Termin online.',
    ' Jetzt Termin sichern.',
    ' Salonpflege in Leipzig-Sachsen.',
    ' HUNDESALON NIKA in Leipzig.',
    ' Ruhige Betreuung in Leipzig.',
  ],
  en: [
    ' today.',
    ' now.',
    ' Leipzig.',
    ' Saxony.',
    ' — book today.',
    ' Book today.',
    ' Book your Leipzig visit today.',
    ' Calm grooming in Leipzig, Saxony.',
    ' HUNDESALON NIKA in Leipzig.',
    ' Care for pets in Leipzig.',
  ],
  ru: [
    ' сегодня.',
    ' к нам.',
    ' — онлайн.',
    ' Лейпциг.',
    ' Саксония.',
    ' — запишитесь.',
    ' Запись онлайн.',
    ' Запишитесь сегодня.',
    ' Забронируйте визит.',
    ' Спокойный груминг в Лейпциге.',
    ' Салон HUNDESALON NIKA, Лейпциг.',
  ],
  uk: [
    ' сьогодні.',
    ' до нас.',
    ' — онлайн.',
    ' Лейпциг.',
    ' Саксонія.',
    ' — запишіться.',
    ' Запис онлайн.',
    ' Запишіться онлайн уже.',
    ' Забронюйте візит.',
    ' Спокійний грумінг у Лейпцигу.',
    ' Салон HUNDESALON NIKA, Лейпциг.',
  ],
};

function cleanBase(text) {
  return String(text)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+(Book online in|Termin online in|Запись онлайн|Запис онлайн)\.?$/i, '')
    .replace(/\s+\.?\s*in Leipzig\.\s*$/i, '')
    .replace(/\s*— HUNDESALON NIKA\.\s*$/i, '')
    .trim();
}

function fit(lang, text) {
  let s = cleanBase(text);
  if (s.length >= MIN && s.length <= MAX) return s;

  if (s.length > MAX) {
    let cut = s.slice(0, MAX);
    const sp = cut.lastIndexOf(' ');
    if (sp >= MIN) cut = cut.slice(0, sp);
    cut = cut.replace(/[,:;.—–-]\s*$/, '').trim();
    if (!/[.!?]$/.test(cut)) cut += '.';
    if (cut.length >= MIN && cut.length <= MAX) return cut;
    // if still short after period, fall through to pad
    s = cut.replace(/[.]$/, '');
  }

  const base = s.replace(/[.!?]$/, '');

  // Prefer closers that do not duplicate an already-present phrase
  // (allow geographic words if we need length — duplication filter is soft)
  const pool = CLOSE[lang].filter((c) => {
    const key = c.trim().replace(/^[.—–-]\s*/, '').slice(0, 10).toLowerCase();
    if (!key) return false;
    // only skip if the exact closer fragment already ends the base
    return !base.toLowerCase().endsWith(key) && !base.toLowerCase().includes(c.trim().toLowerCase());
  });

  const join = (b, closer) => {
    const c = closer.replace(/^\s+/, '');
    if (/^[A-ZÀ-ÖØ-ÞА-ЯІЇЄЁ]/.test(c)) {
      const stem = b.replace(/[.!?]+$/, '');
      return `${stem}. ${c}`.replace(/\s+/g, ' ').trim();
    }
    return `${b}${closer}`.replace(/\s+/g, ' ').trim();
  };

  const tryList = [...pool, ...CLOSE[lang]];
  for (const closer of tryList) {
    const cand2 = join(base, closer);
    if (cand2.length >= MIN && cand2.length <= MAX) return cand2;
  }

  // Brute: append shortest closers until in range (complete phrases only)
  let acc = base;
  for (const closer of CLOSE[lang]) {
    const next = join(acc, closer);
    if (next.length > MAX) continue;
    if (next.length >= MIN) return next;
    acc = next;
  }

  throw new Error(`Cannot fit (${lang}): base=${base.length} need=${MIN - base.length} — ${base.slice(0, 80)}`);
}

const next = structuredClone(META_DESCRIPTIONS);
const report = [];
for (const [page, langs] of Object.entries(next)) {
  for (const lang of Object.keys(langs)) {
    const before = langs[lang];
    const after = fit(lang, before);
    langs[lang] = after;
    report.push({ page, lang, before: before.length, after: after.length, text: after });
  }
}

const bad = report.filter(
  (r) =>
    r.after < MIN ||
    r.after > MAX ||
    /Book online in$|Termin online in$|Запись онлайн$|Запис онлайн$/i.test(r.text.trim())
);

function serializeConfig(obj) {
  const lines = [
    '/** Rich meta descriptions (160–168 chars) — de / en / ru / uk by page path inside lang folder. */',
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

fs.writeFileSync(path.join(root, 'config', 'meta-descriptions.mjs'), serializeConfig(next), 'utf8');
console.log(JSON.stringify({ fitted: report.length, bad, sample: report.slice(0, 8) }, null, 2));
if (bad.length) process.exit(1);
