import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import htmlhint from 'htmlhint';
import { parseEntities } from 'parse-entities';
import { escapeCopy, escapeCopyAttribute, validEditorialLink } from '../../functions/_lib/page-copy.js';
import { pageEditorAssetPath, pageEditorEntries } from '../../functions/_lib/page-editor-catalog.js';
import { buildTelegramEditorCopy } from './page-copy-telegram.mjs';

const ignored = new Set([
  'script',
  'style',
  'svg',
  'form',
  'button',
  'nav',
  'footer',
  'dialog',
  'textarea',
  'template',
  'noscript',
]);
const voidTags = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const wrapper = (kind, id, text) => '<!--nika-copy:' + kind + ':' + id + '-->' + escapeCopy(text) + '<!--/nika-copy-->';
const editableText = {
  a: 'label',
  button: 'label',
  summary: 'label',
  figcaption: 'caption',
  caption: 'caption',
  li: 'list',
  dt: 'list',
  dd: 'list',
  th: 'cell',
  td: 'cell',
};
const contentTags = new Set(['main', 'section', 'article']);
const labelTags = new Set(['div', 'span', 'small', 'strong']);
const labelClass = /(?:^|[-_])(?:label|title|caption)$/;
const publicPriceCopy = [
  ['heroKicker', 'label'],
  ['heroTitle', 'heading'],
  ['heroLead', 'paragraph'],
  ['heroNote', 'paragraph'],
  ['searchLabel', 'label'],
  ['searchPlaceholder', 'label'],
  ['searchClear', 'label'],
  ['searchEmpty', 'paragraph'],
  ['searchMinChars', 'paragraph'],
  ['searchSuggestionsLabel', 'label'],
  ['cardLabel', 'label'],
  ['showBreedsLabel', 'label'],
  ['hideBreedsLabel', 'label'],
  ['showCardDetailsLabel', 'label'],
  ['hideCardDetailsLabel', 'label'],
];

function editorialHref(attrs, href) {
  return href &&
    !href.startsWith('#') &&
    !/\b(?:onlayn-bronirovanie(?:\.html)?|booking|payment|sendmail)(?:[/?#]|$)/i.test(href) &&
    !attrs.some(attr => /^(?:on\w+|data-|download$)/i.test(attr.name)) &&
    validEditorialLink(href);
}

// Annotate text nodes, leaving links, emphasis, layout and event handlers intact.
export function annotatePage(html, { metadataOnly = false } = {}) {
  const parser = new htmlhint.HTMLParser();
  const stack = [];
  const edits = [];
  const used = new Map();
  function annotateAttribute(tagName, pos, kind, id, attr) {
    if (!attr || !attr.value.trim()) return;
    const start = pos + tagName.length + 1 + attr.index;
    const whitespace = attr.raw.match(/^\s*/)[0];
    const value = escapeCopyAttribute(parseEntities(attr.value));
    edits.push({
      start,
      end: start + attr.raw.length,
      value: whitespace + 'data-nika-copy-' + kind + '="' + id + '" ' + attr.name + '="' + value + '"',
    });
  }
  parser.addListener('tagstart', ({ tagName, attrs, close, pos }) => {
    const parent = stack.at(-1);
    const attr = name => attrs.find(item => item.name === name);
    const classes = (attr('class')?.value || '').split(/\s+/);
    const hiddenOrShared =
      classes.includes('modal') ||
      classes.includes('header-controls') ||
      classes.includes('newsletter-section') ||
      attrs.some(attr => attr.name === 'hidden' || (attr.name === 'aria-hidden' && attr.value === 'true'));
    const excluded = parent?.excluded || ignored.has(tagName) || hiddenOrShared;
    const kind = /^h[1-6]$/.test(tagName) ? 'heading' : tagName === 'p' ? 'paragraph' : parent?.kind;
    const ancestors = parent?.children;
    const ordinal = (ancestors?.get(tagName) || 0) + 1;
    ancestors?.set(tagName, ordinal);
    const id = attr('id')?.value;
    const location = id ? '#' + id : (parent?.location || '') + '/' + tagName + '-' + ordinal;
    const fieldId = type => 'e-' + createHash('sha256').update(location + ':' + type).digest('hex').slice(0, 16);
    const editorial = parent?.editorial || contentTags.has(tagName) || attr('role')?.value === 'main' ||
      (parent?.tagName === 'body' && (classes.includes('container') || classes.includes('page-offset-top')));
    const staticButton = tagName === 'button' && attr('type')?.value === 'button' && !attr('data-route');
    const addedExcluded = parent?.addedExcluded || hiddenOrShared || !!attr('data-i18n') ||
      (ignored.has(tagName) && !staticButton);

    if (tagName === 'meta' && parent?.tagName === 'head') {
      const name = attr('name')?.value.toLowerCase();
      const property = attr('property')?.value.toLowerCase();
      if (name === 'description') annotateAttribute(tagName, pos, 'description', 'seo-description', attr('content'));
      else if (property === 'og:description' || name === 'twitter:description') {
        annotateAttribute(tagName, pos, 'description-mirror', 'seo-description', attr('content'));
      }
    }
    if (!metadataOnly && editorial && !addedExcluded) {
      if (tagName === 'img') annotateAttribute(tagName, pos, 'image-alt', fieldId('alt'), attr('alt'));
      if (tagName === 'a' && editorialHref(attrs, parseEntities(attr('href')?.value || ''))) {
        annotateAttribute(tagName, pos, 'link', fieldId('href'), attr('href'));
      }
    }
    if (close || voidTags.has(tagName)) return;
    const namedLabel = labelTags.has(tagName) && classes.some(name => labelClass.test(name));
    const addedKind = editorial && !addedExcluded ? (editableText[tagName] || (namedLabel ? 'label' : parent?.addedKind)) : null;
    stack.push({ tagName, excluded, kind, editorial, addedExcluded, addedKind, location, fieldId, children: new Map(), text: 0 });
  });
  parser.addListener('tagend', ({ tagName }) => {
    const i = stack.findLastIndex(item => item.tagName === tagName);
    if (i !== -1) stack.length = i;
  });
  parser.addListener('text', ({ raw, pos }) => {
    const el = stack.at(-1);
    if (metadataOnly || !el || !raw.trim()) return;
    const legacy = el.kind && !el.excluded;
    const kind = legacy ? el.kind : el.addedKind;
    if (!kind) return;
    const stripped = raw.trim();
    const text = parseEntities(stripped);
    if (!(legacy ? /\p{L}/u : /[\p{L}\p{N}]/u).test(text)) return;
    let id;
    if (legacy) {
      const digest = createHash('sha256')
        .update(kind + '\n' + text.replace(/\s+/g, ' '))
        .digest('hex')
        .slice(0, 16);
      const occurrence = (used.get(digest) || 0) + 1;
      used.set(digest, occurrence);
      id = 'f-' + digest + '-' + occurrence;
    } else {
      id = el.fieldId(kind) + '-' + (++el.text);
    }
    const start = pos + raw.indexOf(stripped);
    edits.push({
      start,
      end: start + stripped.length,
      value: wrapper(kind, id, text),
    });
  });
  parser.parse(html);
  let end = 0;
  const output = [];
  for (const edit of edits) {
    output.push(html.slice(end, edit.start), edit.value);
    end = edit.end;
  }
  output.push(html.slice(end));
  return output.join('');
}

export function annotateLocalizedPages(dist, assetVersion) {
  const sandbox = { window: {} };
  runInNewContext(fs.readFileSync(path.join(dist, 'assets/js/price-page-data.js'), 'utf8'), sandbox);
  for (const { slug, locales } of pageEditorEntries) {
    if (slug === 'telegram-menu') continue;
    for (const locale of locales) {
      const file = path.join(dist, pageEditorAssetPath(locale, slug).slice(1));
      const source = fs.readFileSync(file, 'utf8');
      // The price renderer replaces the legacy HTML. Expose its actual hero copy below.
      let html = slug === 'prays-list' ? annotatePage(source, { metadataOnly: true }) : annotatePage(source);
      html = html.replace(
        '</head>',
        '<script defer src="/assets/js/site-visibility.js?v=' + assetVersion + '"></script></head>'
      );
      if (slug === 'prays-list') {
        const price = sandbox.window.PricePageCatalog.locales[locale];
        const fields = publicPriceCopy
          .filter(([key]) => typeof price[key] === 'string' && price[key].trim())
          .map(
            ([key, kind]) =>
              '<span data-price-copy="' +
              key +
              '">' +
              wrapper(kind, 'price-' + key.toLowerCase(), price[key]) +
              '</span>'
          )
          .join('');
        html = html.replace('</head>', '<template id="price-editorial-copy">' + fields + '</template></head>');
      }
      fs.writeFileSync(file, html);
    }
  }
  buildTelegramEditorCopy(dist);
}
