import { copyFields, escapeCopy, renderPageCopy } from './page-copy.js';
import { adminDatabase } from './site-admin-auth.js';

const templatePattern = /(<template data-telegram-editor="(de|en|ru|uk)">)([\s\S]*?)(<\/template>)/g;
const visibleText = /(<(p|h1|h2|span)\b[^>]*\bdata-i18n="([a-zA-Z]+)"[^>]*>)[^<]*(<\/\2>)/g;
const labels = {
  eyebrow: 'Надпись над заголовком',
  title: 'Заголовок меню',
  lead: 'Текст под заголовком',
  bookingTitle: 'Кнопка онлайн-записи',
  bookingDescription: 'Подпись онлайн-записи',
  pricesTitle: 'Кнопка услуг и цен',
  pricesDescription: 'Подпись услуг и цен',
  contactTitle: 'Кнопка контактов',
  contactDescription: 'Подпись контактов',
  supportTitle: 'Кнопка поддержки',
  supportDescription: 'Подпись поддержки',
  promise: 'Текст о салоне',
  languageEyebrow: 'Подпись выбора языка',
  languageTitle: 'Заголовок выбора языка',
};

export const telegramFieldId = key => 'telegram-' + key.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase());
const fieldLabels = new Map(Object.entries(labels).map(([key, label]) => [telegramFieldId(key), label]));

function templateContent(html, locale) {
  for (const [, , language, content] of html.matchAll(templatePattern)) {
    if (language === locale) return content;
  }
  return '';
}

export function telegramEditorFields(html, locale) {
  return copyFields(templateContent(html, locale)).map(field => ({
    ...field,
    label: fieldLabels.get(field.id) ?? field.label,
  }));
}

export function replaceTelegramEditorTemplates(html, render) {
  return html.replace(templatePattern, (_, open, locale, content, close) => render(open, locale, content, close));
}

export function renderTelegramEditorPreview(html, locale, values) {
  const fields = telegramEditorFields(html, locale);
  if (!fields.length) return html;
  const copy = new Map(fields.map(field => [field.id, values[field.id] ?? field.original]));
  return html
    .replace(visibleText, (match, open, _tag, key, close) => {
      const text = copy.get(telegramFieldId(key));
      return typeof text === 'string' ? open + escapeCopy(text) + close : match;
    })
    .replace(/(<html\b[^>]*\blang=")[a-z]{2}(")/i, (_, open, close) => open + locale + close);
}

export async function applyTelegramEditorCopy(response, env) {
  if (!response.ok || !response.body || !response.headers.get('Content-Type')?.includes('text/html') || !env?.CHAT_DB) {
    return response;
  }
  let overrides;
  try {
    const { results } = await adminDatabase(env)
      .prepare(
        "SELECT locale, values_json FROM site_page_copy WHERE slug = ? AND locale IN ('de', 'en', 'ru', 'uk') LIMIT 4"
      )
      .bind('telegram-menu')
      .all();
    overrides = new Map(
      results.map(row => [row.locale, JSON.parse(row.values_json)]).filter(([, values]) => Object.keys(values).length)
    );
  } catch (error) {
    if (/no such table: (?:main\.)?site_page_copy/i.test(String(error))) return response;
    return new Response('Service unavailable', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '30' },
    });
  }
  if (!overrides.size) return response;
  const html = replaceTelegramEditorTemplates(
    await response.text(),
    (open, locale, content, close) =>
      open + (overrides.has(locale) ? renderPageCopy(content, overrides.get(locale)) : content) + close
  );
  const headers = new Headers(response.headers);
  for (const name of ['Content-Length', 'ETag', 'Last-Modified', 'Content-Encoding']) headers.delete(name);
  headers.set('Cache-Control', 'no-store');
  return new Response(html, { headers, status: response.status, statusText: response.statusText });
}
