import { adminDatabase } from './site-admin-auth.js';
import { PAGE_LABELS, pageEditorTarget } from './page-editor-catalog.js';

export { PAGE_LABELS };

export const validLocale = locale => ['de', 'en', 'ru', 'uk'].includes(locale);
const fieldTypes = {
  title: { label: 'Название вкладки', group: 'seo', maxLength: 220 },
  description: { label: 'Описание для поиска', group: 'seo', maxLength: 320 },
  heading: { label: 'Заголовок', group: 'text', maxLength: 220 },
  paragraph: { label: 'Текст', group: 'text', maxLength: 4000 },
  label: { label: 'Подпись кнопки или элемента', group: 'actions', maxLength: 220 },
  caption: { label: 'Подпись', group: 'text', maxLength: 1000 },
  list: { label: 'Пункт списка', group: 'text', maxLength: 1000 },
  cell: { label: 'Ячейка таблицы', group: 'text', maxLength: 1000 },
  'image-alt': { label: 'Описание изображения', group: 'accessibility', maxLength: 250 },
  link: { label: 'Адрес ссылки', group: 'actions', maxLength: 2048 },
};
const attributeTypes = {
  description: 'content',
  'description-mirror': 'content',
  'image-alt': 'alt',
  link: 'href',
};
const marker = /<!--nika-copy:(heading|paragraph|label|caption|list|cell):([a-z0-9-]+)-->([^<]*)<!--\/nika-copy-->/g;
const attributeMarker = /\bdata-nika-copy-(description(?:-mirror)?|image-alt|link)="([a-z0-9-]+)" (content|alt|href)="([^"]*)"/g;
const titleTag = /(<title>)([^<]+)(<\/title>)/i;

export const escapeCopy = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export const escapeCopyAttribute = text => escapeCopy(text).replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const decodeCopy = text =>
  text.replace(
    /&(amp|lt|gt|quot|apos|nbsp|#39);/g,
    (_, entity) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', '#39': "'" })[entity]
  );

export function validEditorialLink(value) {
  if (typeof value !== 'string' || !value || /[\s\\<>"\u0000-\u001f\u007f]/u.test(value)) return false;
  if (/^mailto:/i.test(value)) return /^mailto:[\w.+-]+@(?:[a-z0-9-]+\.)+[a-z]{2,63}$/i.test(value);
  if (/^tel:/i.test(value)) return /^tel:\+?[0-9][0-9().-]{2,29}$/i.test(value);
  try {
    if (/[\u0000-\u001f\u007f\\]/u.test(decodeURIComponent(value))) return false;
    const restricted = /^(?:[\/]+)(?:admin(?:\/|$)|api(?:\/|$)|__)/i;
    if (/^https:\/\/[^/]/i.test(value)) {
      const { hostname, username, password, port, pathname } = new URL(value);
      return !!hostname && !username && !password && !port &&
        (!/(^|\.)hundesalon-nika\.com$/i.test(hostname) || !restricted.test(decodeURIComponent(pathname)));
    }
    if (value.startsWith('//') || /^[a-z0-9+.-]+:/i.test(value)) return false;
    const target = new URL(value, 'https://hundesalon-nika.com/ru/');
    return target.origin === 'https://hundesalon-nika.com' && !restricted.test(decodeURIComponent(target.pathname));
  } catch {
    return false;
  }
}

export function validPageCopyValue(field, value) {
  const type = Object.hasOwn(fieldTypes, field?.kind) ? fieldTypes[field.kind] : null;
  if (!type || typeof value !== 'string' || value.length > type.maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) {
    return false;
  }
  return field.kind !== 'link' || !value.trim() || validEditorialLink(value.trim());
}

export function copyFields(html) {
  const fields = [];
  const seen = new Set();
  function add(kind, id, content) {
    if (seen.has(id)) return;
    seen.add(id);
    const decoded = decodeCopy(content).trim();
    const original = kind === 'link' ? decoded : decoded.replace(/\s+/gu, ' ');
    fields.push({ id, kind, original, ...fieldTypes[kind] });
  }
  const title = html.match(titleTag);
  if (title) add('title', 'title', title[2]);
  const marked = Array.from(html.matchAll(marker), match => {
    const [, kind, id, content] = match;
    return { kind, id, content, index: match.index };
  });
  for (const match of html.matchAll(attributeMarker)) {
    const [, kind, id, attribute, content] = match;
    if (kind !== 'description-mirror' && attributeTypes[kind] === attribute) {
      marked.push({ kind, id, content, index: match.index });
    }
  }
  marked.sort((a, b) => a.index - b.index).forEach(({ kind, id, content }) => add(kind, id, content));
  return fields;
}

export function renderPageCopy(html, values) {
  const replacement = (kind, id) => {
    if (!Object.hasOwn(values, id)) return null;
    const value = values[id];
    return validPageCopyValue({ kind }, value) && value.trim() ? value.trim() : null;
  };
  const updated = html
    .replace(attributeMarker, (full, kind, id, attribute) => {
      if (attributeTypes[kind] !== attribute) return full;
      const value = replacement(kind === 'description-mirror' ? 'description' : kind, id);
      return value === null ? full : attribute + '="' + escapeCopyAttribute(value) + '"';
    })
    .replace(marker, (full, kind, id) => {
      const value = replacement(kind, id);
      return value === null ? full : escapeCopy(value);
    });
  const title = replacement('title', 'title');
  return title !== null
    ? updated.replace(titleTag, (_, open, _old, close) => open + escapeCopy(title) + close)
    : updated;
}

export async function storedCopy(db, locale, slug) {
  const row = await db
    .prepare('SELECT revision, values_json FROM site_page_copy WHERE locale=? AND slug=?')
    .bind(locale, slug)
    .first();
  return row ? { revision: row.revision, values: JSON.parse(row.values_json) } : { revision: 0, values: {} };
}

export async function applyPageCopy(response, env, url) {
  const target = pageEditorTarget(url.pathname);
  if (
    !response.ok ||
    !response.body ||
    !target ||
    !response.headers.get('content-type')?.includes('text/html') ||
    !env?.CHAT_DB
  )
    return response;
  let saved;
  try {
    saved = await storedCopy(adminDatabase(env), target.locale, target.slug);
  } catch (error) {
    if (/no such table: (?:main\.)?site_page_copy/i.test(String(error))) return response;
    return new Response('Service unavailable', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '30' },
    });
  }
  if (!Object.keys(saved.values).length) return response;
  const headers = new Headers(response.headers);
  for (const name of ['Content-Length', 'ETag', 'Last-Modified', 'Content-Encoding']) headers.delete(name);
  headers.set('Cache-Control', 'private, no-store');
  return new Response(renderPageCopy(await response.text(), saved.values), { status: response.status, headers });
}
