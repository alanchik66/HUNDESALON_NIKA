import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import test from 'node:test';
import {
  PAGE_LABELS,
  pageEditorAssetPath,
  pageEditorEntries,
  pageEditorPath,
  pageEditorTarget,
} from './page-editor-catalog.js';

test('the editor catalog covers each supported language and points to an actual HTML asset', async () => {
  assert.equal(PAGE_LABELS.size, 24);
  assert.equal(pageEditorEntries.length, 26);
  assert.equal(new Set(pageEditorEntries.map(page => page.slug)).size, pageEditorEntries.length);
  assert.equal(PAGE_LABELS.has('promotions'), true);
  assert.equal(PAGE_LABELS.has('reviews'), false);
  for (const { slug, group, locales } of pageEditorEntries) {
    assert.ok(group);
    for (const locale of locales) {
      const url = new URL(pageEditorPath(locale, slug), 'https://example.test');
      const target = { locale: slug === 'telegram-menu' ? 'de' : locale, slug };
      if (slug === 'telegram-menu') assert.equal(url.searchParams.get('lang'), locale);
      assert.deepEqual(pageEditorTarget(url.pathname), target);
      const asset = pageEditorAssetPath(locale, slug);
      assert.deepEqual(pageEditorTarget(asset), target);
      await access(new URL('../..' + asset, import.meta.url));
    }
  }
});

test('legacy public aliases resolve to existing editor targets', () => {
  for (const [pathname, locale, slug] of [
    ['/', 'de', 'index'],
    ['/index.html', 'de', 'index'],
    ['/ua/', 'uk', 'index'],
    ['/ua/preims', null, null],
    ['/ru/blog', 'ru', 'blog/blog'],
    ['/en/blog/index.html', 'en', 'blog/blog'],
    ['/ua/blog/kak-podgotovit-sobaku.html', 'uk', 'blog/kak-podgotovit-sobaku'],
    ['/de/hundesalon-leipzig', 'de', 'nashi-uslugi'],
    ['/en/price-list.html', 'en', 'prays-list'],
    ['/ru/reviews', 'ru', 'reyting'],
    ['/documents', 'de', 'documents'],
  ]) {
    assert.deepEqual(pageEditorTarget(pathname), locale ? { locale, slug } : null, pathname);
  }
});

test('standalone pages use their authored language and unrelated paths are not editable', () => {
  assert.equal(pageEditorPath('en', 'reviews'), '/reviews');
  assert.equal(pageEditorPath('de', 'telegram-menu'), '/telegram-menu?lang=de');
  assert.equal(pageEditorPath('de', 'reviews'), null);
  assert.equal(pageEditorAssetPath('ru', 'telegram-menu'), '/telegram-menu.html');
  assert.equal(pageEditorAssetPath('fr', 'telegram-menu'), null);
  assert.equal(pageEditorPath('ua', 'index'), null);
  for (const path of [
    '/blog',
    '/payment',
    '/404.html',
    '/admin/',
    '/api/admin/media',
    '/assets/frames/contact-map.html',
    '/ru/telegram-menu',
    '/ru/blog//blog',
    '/ru/%2e%2e/reviews',
  ]) {
    assert.equal(pageEditorTarget(path), null, path);
  }
});
