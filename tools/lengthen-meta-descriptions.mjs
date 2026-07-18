/**
 * Apply rich meta descriptions from config/meta-descriptions.mjs.
 * npm run seo:lengthen-descriptions
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { META_DESCRIPTIONS } from '../config/meta-descriptions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const langs = ['de', 'en', 'ru', 'uk'];
const MIN_LEN = 160;
const MAX_LEN = 170;

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function setMetaContent(html, attrName, attrValue, content, { property = false } = {}) {
  const selector = property
    ? `${attrName}=["']${attrValue}["']`
    : `name=["']${attrValue}["']`;
  const re = new RegExp(
    `(<meta\\s+${property ? 'property' : 'name'}=["']${attrValue}["'][^>]*content=["'])([^"']*)(["'][^>]*>)`,
    'i'
  );
  if (re.test(html)) return html.replace(re, `$1${escapeAttr(content)}$3`);

  const blockRe = new RegExp(
    `<meta\\s+${property ? 'property' : 'name'}=["']${attrValue}["'][\\s\\S]*?content=["']([^"']*)["'][\\s\\S]*?/?>`,
    'i'
  );
  if (blockRe.test(html)) {
    return html.replace(blockRe, match =>
      match.replace(/content=["'][^"']*["']/i, `content="${escapeAttr(content)}"`)
    );
  }

  const indent = html.match(/^([ \t]*)<title>/im)?.[1] || '    ';
  const tag = property
    ? `${indent}<meta property="${attrValue}" content="${escapeAttr(content)}" />\n`
    : `${indent}<meta name="${attrValue}" content="${escapeAttr(content)}" />\n`;

  if (/<title>/i.test(html)) {
    return html.replace(/(<title>[\s\S]*?<\/title>\s*\n)/i, `$1${tag}`);
  }
  return html.replace(/<head>\s*\n/i, `$&${tag}`);
}

function pageKey(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  const parts = normalized.split('/');
  if (parts.length === 2) return parts[1];
  if (parts.length === 3 && parts[1] === 'blog') return `blog/${parts[2]}`;
  return null;
}

const report = { updated: [], added: [], skipped: [], missingConfig: [] };

for (const lang of langs) {
  const dir = path.join(root, lang);
  if (!fs.existsSync(dir)) continue;

  for (const file of fs.readdirSync(dir, { recursive: true })) {
    if (typeof file !== 'string' || !file.endsWith('.html')) continue;
    const rel = path.join(lang, file);
    const key = pageKey(rel);
    if (!key || !META_DESCRIPTIONS[key]) {
      if (key) missingConfig.push(rel);
      continue;
    }

    const desc = META_DESCRIPTIONS[key][lang];
    if (!desc || desc.length < MIN_LEN) {
      report.skipped.push({ file: rel, reason: 'short-config', len: desc?.length || 0 });
      continue;
    }
    if (desc.length > MAX_LEN) {
      report.skipped.push({ file: rel, reason: 'long-config', len: desc.length });
      continue;
    }

    const full = path.join(root, rel);
    let html = fs.readFileSync(full, 'utf8');
    const had = /name=["']description["']/i.test(html);

    html = setMetaContent(html, 'name', 'description', desc);
    html = setMetaContent(html, 'property', 'og:description', desc, { property: true });
    html = setMetaContent(html, 'name', 'twitter:description', desc);

    fs.writeFileSync(full, html, 'utf8');
    report[had ? 'updated' : 'added'].push({ file: rel, len: desc.length });
  }
}

console.log(JSON.stringify({
  updated: report.updated.length,
  added: report.added.length,
  skipped: report.skipped.length,
  details: report,
}, null, 2));
