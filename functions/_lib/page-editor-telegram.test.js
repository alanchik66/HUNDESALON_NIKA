import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { TELEGRAM_MENU_COPY } from '../../assets/js/telegram-menu-copy.js';
import { annotateTelegramEditorCopy } from '../../tools/lib/page-copy-telegram.mjs';
import {
  applyTelegramEditorCopy,
  renderTelegramEditorPreview,
  replaceTelegramEditorTemplates,
  telegramEditorFields,
  telegramFieldId,
} from './page-editor-telegram.js';

const source = await readFile(new URL('../../telegram-menu.html', import.meta.url), 'utf8');
const annotated = annotateTelegramEditorCopy(source);

test('Telegram templates contain the shared source copy in all four languages with stable field IDs', () => {
  for (const [locale, original] of Object.entries(TELEGRAM_MENU_COPY)) {
    const fields = telegramEditorFields(annotated, locale);
    assert.deepEqual(
      Object.fromEntries(fields.map(({ id, original }) => [id, original])),
      Object.fromEntries(Object.entries(original).map(([key, value]) => [telegramFieldId(key), value]))
    );
    assert.equal(fields.find(field => field.id === 'telegram-booking-title').kind, 'label');
  }
  assert.deepEqual(telegramEditorFields(annotated, 'fr'), []);
  assert.equal(annotateTelegramEditorCopy(annotated), annotated);
});

test('the scripts-off preview uses the chosen language and preserves HTML around edited text', () => {
  const html = renderTelegramEditorPreview(annotated, 'uk', { 'telegram-title': 'Тест <питомец> & друг' });
  assert.match(html, /<html lang="uk"/);
  assert.ok(html.includes('data-i18n="title">Тест &lt;питомец&gt; &amp; друг</h1>'));
  assert.ok(html.includes('data-i18n="bookingTitle">Онлайн-запис</span>'));
  assert.ok(html.includes('type="button" data-route="booking"'));
});

test('the public Telegram response reads published copy once and preserves identities of different locales', async () => {
  let queries = 0;
  const response = new Response(annotated, {
    headers: { 'Content-Type': 'text/html', ETag: 'old' },
  });
  const env = {
    CHAT_DB: {
      prepare(statement) {
        assert.match(statement, /FROM site_page_copy .* LIMIT 4/);
        queries++;
        return {
          bind(slug) {
            assert.equal(slug, 'telegram-menu');
            return {
              all: async () => ({
                results: [
                  { locale: 'en', values_json: JSON.stringify({ 'telegram-title': 'New English & safe' }) },
                  { locale: 'uk', values_json: JSON.stringify({ 'telegram-title': 'Новий український' }) },
                ],
              }),
            };
          },
        };
      },
    },
  };
  const rendered = await applyTelegramEditorCopy(response, env);
  assert.equal(queries, 1);
  assert.equal(rendered.headers.get('ETag'), null);
  const html = await rendered.text();
  const titles = {};
  replaceTelegramEditorTemplates(html, (_open, locale, content) => {
    const texts = content.replace(/<!--[\s\S]*?-->/g, '');
    titles[locale] = /<span data-telegram-text="title">([^<]+)<\/span>/.exec(texts)?.[1];
    return '';
  });
  assert.deepEqual(titles, {
    de: TELEGRAM_MENU_COPY.de.title,
    en: 'New English &amp; safe',
    ru: TELEGRAM_MENU_COPY.ru.title,
    uk: 'Новий український',
  });
});
