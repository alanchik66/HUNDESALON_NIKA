import { META_DESCRIPTIONS } from '../config/meta-descriptions.mjs';

const rows = [];
for (const [page, langs] of Object.entries(META_DESCRIPTIONS)) {
  for (const [lang, text] of Object.entries(langs)) {
    rows.push({ page, lang, len: text.length });
  }
}
rows.sort((a, b) => a.len - b.len);
console.log('under 150:', rows.filter(r => r.len < 150).length);
for (const r of rows.filter(r => r.len < 150)) console.log(r.len, r.lang, r.page);
console.log('under 155:', rows.filter(r => r.len < 155).length);
console.log('min', rows[0], 'max', rows[rows.length - 1]);
