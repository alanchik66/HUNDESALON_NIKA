/**
 * Audit meta description lengths across lang HTML pages.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { META_DESCRIPTIONS } from '../config/meta-descriptions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const langs = ['de', 'en', 'ru', 'uk'];
const MIN = 140;
const TARGET = 155;

function readDesc(html) {
  const patterns = [
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i,
    /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i,
    /<meta\s+[\s\S]*?name=["']description["'][\s\S]*?content=["']([^"']*)["'][\s\S]*?\/?>/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  }
  return '';
}

const report = { htmlShort: [], configShort: [], missingHtml: [], ok: 0 };

for (const lang of langs) {
  const dir = path.join(root, lang);
  for (const file of fs.readdirSync(dir, { recursive: true })) {
    if (typeof file !== 'string' || !file.endsWith('.html')) continue;
    const rel = path.join(lang, file).replace(/\\/g, '/');
    const normalized = file.replace(/\\/g, '/');
    const key = normalized.includes('blog/') ? `blog/${path.basename(file)}` : path.basename(file);
    const html = fs.readFileSync(path.join(root, rel), 'utf8');
    const desc = readDesc(html);
    const len = desc.length;

    if (len < MIN) report.htmlShort.push({ file: rel, len, desc });
    else report.ok += 1;

    const cfg = META_DESCRIPTIONS[key]?.[lang];
    if (!cfg) report.missingHtml.push({ file: rel, key });
    else if (cfg.length < MIN) report.configShort.push({ file: rel, key, len: cfg.length });
    else if (desc !== cfg) report.htmlShort.push({ file: rel, len, mismatch: true, cfgLen: cfg.length });
  }
}

console.log(JSON.stringify({
  min: MIN,
  target: TARGET,
  ok: report.ok,
  htmlShort: report.htmlShort.length,
  configShort: report.configShort.length,
  missingConfig: report.missingHtml.length,
  samples: {
    htmlShort: report.htmlShort.slice(0, 15),
    configShort: report.configShort.slice(0, 10),
    missingConfig: report.missingHtml.slice(0, 10),
  },
}, null, 2));
