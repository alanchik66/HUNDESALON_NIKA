import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceFiles = ['assets/js/price-page-data.js', 'assets/js/price-page-ru-data.js'];
const expectedCategoryIds = [
  'ru-small-growing-coat',
  'ru-poodles-bichons',
  'ru-spitz',
  'ru-spaniels',
  'ru-wire-coat',
  'ru-short-coat',
  'ru-large-dogs',
  'ru-cats-grooming',
  'ru-small-animals',
  'ru-additional-services',
  'ru-important-information',
];
const expectedCatalogHash = '3a33b59e7f6df26f1bde56675f383f328a1d5ab7062b1b611b799f0265e8d784';

const loadRussianCatalog = () => {
  const context = vm.createContext({ window: {} });
  for (const relativePath of sourceFiles) {
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
    vm.runInContext(source, context, { filename: relativePath });
  }
  return JSON.parse(JSON.stringify(context.window.PricePageCatalog.categoriesByLocale.ru));
};

test('Russian price catalog keeps its public output stable', () => {
  const categories = loadRussianCatalog();
  const serialized = JSON.stringify(categories);
  const digest = createHash('sha256').update(serialized).digest('hex');

  assert.deepEqual(
    categories.map(category => category.id),
    expectedCategoryIds
  );
  assert.equal(
    categories.some(category => Object.hasOwn(category, 'sizeGroups')),
    false
  );
  assert.equal(digest, expectedCatalogHash, `Russian price catalog snapshot changed: ${digest}`);
});

const nailTrimLabels = {
  ru: ['Подстригание когтей — маленькие породы', 'Подстригание когтей — средние породы', 'Подстригание когтей — большие породы'],
  de: ['Krallenschneiden — kleine Rassen', 'Krallenschneiden — mittelgroße Rassen', 'Krallenschneiden — große Rassen'],
  en: ['Nail trimming — small breeds', 'Nail trimming — medium breeds', 'Nail trimming — large breeds'],
  uk: ['Підстригання кігтів — малі породи', 'Підстригання кігтів — середні породи', 'Підстригання кігтів — великі породи'],
};

test('nail trimming labels use dog breed sizes in every locale', () => {
  for (const lang of ['ru', 'de', 'en', 'uk']) {
    const context = vm.createContext({ window: {} });
    for (const relativePath of [...sourceFiles, 'assets/js/price-page-locales.js', 'assets/js/price-booking.js']) {
      vm.runInContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), context, { filename: relativePath });
    }
    const category = context.window.PriceBookingCatalog.build(lang).getCategory('ru-additional-services');
    assert.deepEqual(Array.from(category.services.slice(0, 3), service => service.label), nailTrimLabels[lang]);
  }
});

const puppyLabels = {
  ru: 'Первый груминг щенка',
  de: 'Welpen-Eingewöhnung',
  en: 'First puppy grooming',
  uk: 'Перший грумінг цуценяти',
};
const puppyPrices = { ru: 'от 50 €', de: 'ab 50 €', en: 'from €50', uk: 'від 50 €' };
const bathLabels = { ru: 'Купание + гигиенический уход', de: 'Baden + Hygienepflege', en: 'Bath + hygiene care', uk: 'Купання + гігієнічний догляд' };
const dogIds = expectedCategoryIds.slice(0, 7);

const puppyCarePatterns = {
  ru: [/до 4 месяцев/, /мастером/, /столу/, /расчёске/, /звуку фена/, /Если щенок спокоен/, /полностью расчесать/, /искупать/, /подсушить/, /в его темпе/],
  de: [/bis 4 Monate/, /Pflegeperson/, /Pflegetisch/, /Bürste/, /Föhngeräusch/, /Wenn der Welpe ruhig/, /vollständig bürsten/, /baden/, /antrocknen/, /in seinem Tempo/],
  en: [/up to 4 months/, /groomer/, /grooming table/, /brush/, /sound of the dryer/, /If the puppy stays calm/, /brush the whole coat/, /full bath/, /dry/, /at their pace/],
  uk: [/до 4 місяців/, /майстром/, /столу/, /гребінця/, /звуку фена/, /Якщо цуценя спокійне/, /повністю розчесати/, /викупати/, /підсушити/, /в його темпі/],
};

for (const lang of ['ru', 'de', 'en', 'uk']) {
  test(`${lang}: first puppy visit is up to four months with care adapted to the puppy's comfort`, () => {
    const context = vm.createContext({ window: {} });
    const relativePath = 'assets/js/price-catalog.js';
    vm.runInContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), context, { filename: relativePath });
    const catalog = context.window.PriceCatalog.build(lang);
    const puppy = catalog.services.find(service => service.key === 'puppy-intro');
    assert.ok(puppy);
    assert.equal(puppy.prices.default, 'ab 50 €');
    const details = `${puppy.note} ${puppy.description}`;
    for (const pattern of puppyCarePatterns[lang]) assert.match(details, pattern);
    assert.doesNotMatch(puppy.note, /6/);
  });

  test(`${lang}: puppy grooming is a main service for every dog breed, never an extra or a non-dog service`, () => {
    const context = vm.createContext({ window: {} });
    for (const relativePath of [...sourceFiles, 'assets/js/price-page-locales.js', 'assets/js/price-booking.js']) {
      vm.runInContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), context, { filename: relativePath });
    }
    const catalog = context.window.PriceBookingCatalog.build(lang);
    for (const category of catalog.categories) {
      const puppies = category.services.filter(service => service.key === 'puppy-intro');
      if (!dogIds.includes(category.id)) {
        assert.equal(puppies.length, 0, category.id);
        continue;
      }
      assert.equal(puppies.length, 1, category.id);
      const puppy = puppies[0];
      assert.equal(puppy.label, puppyLabels[lang]);
      assert.equal(puppy.price, puppyPrices[lang]);
      assert.equal(puppy.index, category.services.length - 1, 'existing service indexes must not move');
      assert.equal(category.source.services.filter(key => key === 'puppyIntro').length, 1);

      for (const breed of category.breeds) {
        const services = catalog.getServices(category.id, breed.id);
        assert.equal(services.filter(service => service.label.startsWith(bathLabels[lang])).length, 1, `${breed.label}: bath and hygiene care`);
        assert.equal(services.filter(service => service.key === 'puppy-intro').length, 1, breed.label);
        const quote = catalog.resolveQuote(category.id, breed.id, puppy.id);
        assert.equal(quote.price, puppyPrices[lang], breed.label);
        assert.equal(quote.label, `${puppyLabels[lang]} — ${breed.label}`);
        if (category.id === 'ru-short-coat') {
          const sizeIndex = breed.index < 5 ? 0 : breed.index < 16 ? 1 : breed.index < 24 ? 2 : 3;
          assert.equal(services.length, 2, 'one size-specific care option plus puppy grooming');
          assert.equal(services[0].label, bathLabels[lang]);
          assert.equal(services[0].price, category.services[sizeIndex].price);
        }
      }
    }
    assert.equal(catalog.getCategory(dogIds[0]).services[2].key, 'puppy-intro');
  });
}
