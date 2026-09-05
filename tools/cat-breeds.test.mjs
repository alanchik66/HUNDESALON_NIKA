import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const locales = ['de', 'en', 'ru', 'uk'];
const baseSources = [
  'assets/js/price-page-data.js',
  'assets/js/price-page-ru-data.js',
  'assets/js/price-page-locales.js',
];
const catSources = [
  'assets/js/cat-breeds-data.js',
  'assets/js/price-page-cat-breeds.js',
];

const runSources = sourcePaths => {
  const context = vm.createContext({ Intl, window: {} });
  sourcePaths.forEach(relativePath => {
    vm.runInContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), context, { filename: relativePath });
  });
  return context.window;
};

const normalizeName = value => String(value || '')
  .normalize('NFKD')
  .toLocaleLowerCase()
  .replace(/\p{M}+/gu, '')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

test('cat registry contains unique localized weighted coat profiles', () => {
  const { CatBreedsData: registry } = runSources(['assets/js/cat-breeds-data.js']);

  assert.equal(registry.source, 'FIFe and TICA recognised breed lists');
  assert.deepEqual([...registry.sourceUrls], [
    'https://fifeweb.org/cats/breeds/',
    'https://tica.org/ticas-breeds/browse-all-breeds/',
  ]);
  assert.equal(registry.breeds.length, 87);
  assert.equal(new Set(registry.breeds.map(breed => breed.id)).size, registry.breeds.length);
  assert.deepEqual(
    JSON.parse(JSON.stringify(
      registry.breeds.filter(breed => breed.id.startsWith('selkirk-rex')).map(breed => [breed.id, breed.sourceCode])
    )),
    [['selkirk-rex-longhair', 'SRL'], ['selkirk-rex-shorthair', 'SR']]
  );

  for (const breed of registry.breeds) {
    for (const locale of locales) assert.ok(breed.names[locale]?.trim(), `missing ${locale} name for ${breed.id}`);
    assert.ok(breed.weightKg.min > 0, `invalid minimum weight for ${breed.id}`);
    assert.ok(breed.weightKg.max >= breed.weightKg.min, `invalid weight range for ${breed.id}`);
    assert.ok(['long', 'short', 'double'].includes(breed.coatType), `invalid coat type for ${breed.id}`);
    assert.ok(['small', 'medium', 'large'].includes(breed.sizeClass), `invalid size for ${breed.id}`);
    assert.ok(Number.isFinite(breed.surcharge) && breed.surcharge >= 0, `invalid surcharge for ${breed.id}`);
    assert.match(breed.photoTitle, /\p{Letter}/u, `missing photo title for ${breed.id}`);
  }

  for (const locale of ['de', 'en']) {
    assert.ok(registry.breeds.every(breed => !/[\u0400-\u04ff]/u.test(breed.names[locale])), `${locale} contains Cyrillic`);
  }
  for (const locale of ['ru', 'uk']) {
    assert.ok(registry.breeds.every(breed => /[\u0400-\u04ff]/u.test(breed.names[locale])), `${locale} lacks Cyrillic`);
  }
});

test('cat integration keeps one existing category with localized breeds and hygiene services', () => {
  const window = runSources([...baseSources, ...catSources]);

  for (const locale of locales) {
    const category = window.PricePageCatalog.categoriesByLocale[locale].find(item => item.id === 'ru-cats-grooming');
    assert.ok(category, `missing cat category for ${locale}`);
    assert.equal(category.breeds[locale].length, 87);
    assert.equal(category.breedMetadata[locale].length, 87);
    assert.equal(category.breedPhotoTitles[locale].length, 87);
    assert.equal(category.services.includes('hygiene'), true);
    assert.equal(new Set(category.breeds[locale].map(normalizeName)).size, 87);
    assert.ok(category.breeds[locale].every(label => !/all breeds|всіх порід|всех пород/i.test(label)));
  }

  const russianCategory = window.PricePageCatalog.categoriesByLocale.ru.find(item => item.id === 'ru-cats-grooming');
  assert.deepEqual(JSON.parse(JSON.stringify(russianCategory.breedMetadata.ru.find(item => item.id === 'maine-coon'))), {
    id: 'maine-coon',
    sourceCode: 'MCO',
    coatType: 'double',
    sizeClass: 'large',
    weightKg: { min: 4.5, max: 12 },
    handlingClass: 'large-volume',
    surcharge: 15,
    photoTitle: 'Maine Coon cat',
  });
});

test('booking catalog exposes cat metadata, hygiene labels, and the single large-breed surcharge', () => {
  const window = runSources([...baseSources, ...catSources, 'assets/js/price-booking.js']);
  const catalog = window.PriceBookingCatalog.build('ru');
  const category = catalog.getCategory('ru-cats-grooming');
  const maineCoon = category.breeds.find(breed => breed.metadata?.id === 'maine-coon');
  const ordinaryCat = category.breeds.find(breed => breed.metadata?.id === 'abyssinian');

  assert.equal(category.breeds.length, 87);
  assert.equal(category.services.length, 2);
  assert.match(category.services[0].label, /гигиенический уход/u);
  assert.match(category.services[1].label, /гигиенический уход/u);
  assert.equal(maineCoon.metadata.surcharge, 15);
  assert.equal(ordinaryCat.metadata.surcharge, 0);
});

test('all localized price pages load cat registry before booking and page logic', () => {
  for (const locale of locales) {
    const html = fs.readFileSync(path.join(root, locale, 'prays-list.html'), 'utf8');
    const orderedScripts = [
      'fci-dog-breeds-data.js',
      'price-page-fci-breeds.js',
      'cat-breeds-data.js',
      'price-page-cat-breeds.js',
      'price-booking.js',
      'price-page.js',
    ].map(script => html.indexOf(script));
    assert.ok(orderedScripts.every(index => index >= 0), `${locale} is missing a price-page script`);
    assert.deepEqual(orderedScripts, [...orderedScripts].sort((left, right) => left - right), `${locale} script order changed`);
  }
});
