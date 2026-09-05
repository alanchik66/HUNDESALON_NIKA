import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = ['de', 'en', 'ru', 'uk'];
const DOG_CATEGORY_IDS = [
  'ru-small-growing-coat',
  'ru-poodles-bichons',
  'ru-spitz',
  'ru-spaniels',
  'ru-wire-coat',
  'ru-short-coat',
  'ru-large-dogs',
];
const EXPECTED_CATEGORY_COUNTS = [22, 21, 29, 26, 65, 173, 99];
const EXPECTED_COAT_CATEGORY_COUNTS = [24, 35, 47, 16, 60, 75, 27, 61, 90];
const EXPECTED_IRISH_WOLFHOUND = {
  de: 'Irischer Wolfshund',
  en: 'Irish Wolfhound',
  ru: 'Ирландский волкодав',
  uk: 'Ірландський вовкодав',
};
const BASE_SOURCES = [
  'assets/js/price-page-data.js',
  'assets/js/price-page-ru-data.js',
  'assets/js/price-page-locales.js',
];
const FCI_SOURCES = [
  'assets/js/fci-dog-breeds-data.js',
  'assets/js/price-page-fci-breeds.js',
];

function runSources(sourcePaths) {
  const context = vm.createContext({ Intl, window: {} });
  for (const relativePath of sourcePaths) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'), context, {
      filename: relativePath,
    });
  }
  return context.window;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeName(value) {
  return String(value)
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

test('official FCI registry is complete, unique, localized, and deterministic', () => {
  const { FciDogBreedsData: registry } = runSources(['assets/js/fci-dog-breeds-data.js']);
  const numbers = registry.breeds.map(breed => breed.fciNumber);

  assert.equal(registry.source, 'https://www.fci.be/en/Nomenclature/Default.aspx');
  assert.equal(registry.generatedAt, '2026-08-31T00:00:00.000Z');
  assert.equal(registry.breeds.length, 364);
  assert.equal(new Set(numbers).size, registry.breeds.length);
  assert.deepEqual(clone(numbers), [...numbers].sort((left, right) => left - right));
  assert.equal(registry.breeds.filter(breed => breed.status === 'definitive').length, 344);
  assert.equal(registry.breeds.filter(breed => breed.status === 'provisional').length, 20);

  for (const breed of registry.breeds) {
    assert.ok(breed.group >= 1 && breed.group <= 10, `invalid group for FCI ${breed.fciNumber}`);
    for (const locale of LOCALES) {
      assert.ok(breed.names[locale]?.trim(), `missing ${locale} name for FCI ${breed.fciNumber}`);
    }
    assert.match(breed.names.ru, /\p{Script=Cyrillic}/u, `non-localized RU name for FCI ${breed.fciNumber}`);
    assert.match(breed.names.uk, /\p{Script=Cyrillic}/u, `non-localized UK name for FCI ${breed.fciNumber}`);
  }
});

test('every official FCI standard is represented by a breed or an explicit variety', () => {
  const window = runSources([...BASE_SOURCES, ...FCI_SOURCES]);
  const officialNumbers = new Set(window.FciDogBreedsData.breeds.map(breed => breed.fciNumber));
  const coveredNumbers = new Set([
    ...window.FciDogBreedIntegration.representedFciNumbers,
    ...window.FciDogBreedIntegration.entries.map(entry => entry.fciNumber),
  ]);

  assert.equal(window.FciDogBreedIntegration.registryCount, 364);
  assert.deepEqual([...officialNumbers].filter(number => !coveredNumbers.has(number)), []);
  assert.deepEqual([...coveredNumbers].filter(number => !officialNumbers.has(number)), []);
});

test('all locales expose the same categorized catalog without duplicates or price changes', () => {
  const baseWindow = runSources(BASE_SOURCES);
  const baseCatalog = clone(baseWindow.PricePageCatalog.categoriesByLocale);
  const integratedWindow = runSources([...BASE_SOURCES, ...FCI_SOURCES]);

  for (const locale of LOCALES) {
    const before = baseCatalog[locale].filter(category => DOG_CATEGORY_IDS.includes(category.id));
    const after = integratedWindow.PricePageCatalog.categoriesByLocale[locale]
      .filter(category => DOG_CATEGORY_IDS.includes(category.id));
    const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });

    assert.deepEqual(clone(after.map(category => category.id)), DOG_CATEGORY_IDS);
    assert.deepEqual(clone(after.map(category => category.breeds[locale].length)), EXPECTED_CATEGORY_COUNTS);
    assert.equal(after.reduce((sum, category) => sum + category.breeds[locale].length, 0), 435);

    for (let index = 0; index < after.length; index += 1) {
      const original = before[index];
      const expanded = after[index];
      const names = expanded.breeds[locale];
      const normalizedNames = names.map(normalizeName);

      assert.equal(new Set(normalizedNames).size, normalizedNames.length, `${locale}:${expanded.id} duplicates`);
      assert.deepEqual(
        clone(names),
        [...names].sort((left, right) => collator.compare(left, right)),
        `${locale}:${expanded.id} is not alphabetically sorted`
      );
      assert.deepEqual(clone(expanded.priceRows), original.priceRows, `${locale}:${expanded.id} prices changed`);
      assert.deepEqual(clone(expanded.services), original.services, `${locale}:${expanded.id} services changed`);
      assert.equal(expanded.breedFciNumbers.length, names.length, `${locale}:${expanded.id} FCI index drift`);
    }
  }
});

test('dog breed labels are localized and contain no generic or mixed-language placeholders', () => {
  const window = runSources([...BASE_SOURCES, ...FCI_SOURCES]);
  const forbiddenScripts = {
    de: /\p{Script=Cyrillic}/u,
    en: /\p{Script=Cyrillic}/u,
    ru: /[A-Za-zÄÖÜäöüßẞ]/u,
    uk: /[A-Za-zÄÖÜäöüßẞ]/u,
  };
  const genericLabel = /Другие|Other|Andere|Інші/iu;

  for (const locale of LOCALES) {
    const categories = window.PricePageCatalog.categoriesByLocale[locale]
      .filter(category => DOG_CATEGORY_IDS.includes(category.id));

    for (const category of categories) {
      for (const name of category.breeds[locale]) {
        assert.doesNotMatch(name, genericLabel, `${locale}:${category.id} generic breed label`);
        assert.doesNotMatch(name, /\//u, `${locale}:${category.id} mixed alias`);
        assert.doesNotMatch(name, forbiddenScripts[locale], `${locale}:${category.id} foreign script`);
        assert.doesNotMatch(name, /&[a-z]+;/iu, `${locale}:${category.id} encoded HTML entity`);
      }
    }
  }
});

test('Irish Wolfhound has one localized name and remains in the wire-coat category', () => {
  const window = runSources([...BASE_SOURCES, ...FCI_SOURCES]);

  for (const locale of LOCALES) {
    const categories = window.PricePageCatalog.categoriesByLocale[locale]
      .filter(category => DOG_CATEGORY_IDS.includes(category.id));
    const matches = categories.flatMap(category =>
      category.breeds[locale]
        .map((name, index) => ({ category, index, name }))
        .filter(item => item.name === EXPECTED_IRISH_WOLFHOUND[locale])
    );

    assert.equal(matches.length, 1, `${locale}: Irish Wolfhound must appear exactly once`);
    assert.equal(matches[0].category.id, 'ru-wire-coat', `${locale}: Irish Wolfhound category mismatch`);
    assert.equal(matches[0].category.breedFciNumbers[matches[0].index], 160, `${locale}: Irish Wolfhound FCI link mismatch`);
  }
});

test('every short-coat breed resolves to one exact size price bucket', () => {
  const window = runSources([...BASE_SOURCES, ...FCI_SOURCES, 'assets/js/price-booking.js']);

  for (const locale of LOCALES) {
    const catalog = window.PriceBookingCatalog.build(locale);
    const category = catalog.getCategory('ru-short-coat');
    assert.equal(category.breeds.length, 173);
    assert.equal(category.source.breedServiceIndexes.length, category.breeds.length);

    for (const breed of category.breeds) {
      assert.ok(Number.isInteger(breed.serviceIndex), `${locale}:${breed.label} missing size index`);
      assert.ok(breed.serviceIndex >= 0 && breed.serviceIndex <= 3, `${locale}:${breed.label} invalid size index`);
      const services = catalog.getServices(category.id, breed.id);
      const sizeServices = services.filter(service => service.key !== 'puppy-intro');
      assert.equal(services.length, 2, `${locale}:${breed.label} must expose size care plus puppy care`);
      assert.equal(sizeServices.length, 1, `${locale}:${breed.label} must expose one size service`);
      assert.equal(sizeServices[0].index, breed.serviceIndex, `${locale}:${breed.label} wrong service index`);
      assert.equal(sizeServices[0].label, category.services[breed.serviceIndex].label);
    }
  }
});

test('coat and size varieties are assigned to their professional service categories', () => {
  const { FciDogBreedIntegration: integration } = runSources([...BASE_SOURCES, ...FCI_SOURCES]);
  const findVariant = (fciNumber, key) => integration.entries.find(entry => entry.fciNumber === fciNumber && entry.key === key);

  assert.equal(findVariant(15, 'malinois').categoryId, 'ru-short-coat');
  assert.equal(findVariant(15, 'malinois').serviceIndex, 3);
  assert.equal(findVariant(94, 'small-smooth').serviceIndex, 0);
  assert.equal(findVariant(94, 'medium-smooth').serviceIndex, 2);
  assert.equal(findVariant(94, 'large-smooth').serviceIndex, 3);
  assert.equal(findVariant(103, 'rough').categoryId, 'ru-wire-coat');
  assert.equal(findVariant(103, 'coarse-smooth').serviceIndex, 1);
  assert.equal(findVariant(192, 'rough').categoryId, 'ru-wire-coat');
  assert.equal(findVariant(192, 'smooth').serviceIndex, 1);
  assert.equal(findVariant(234, 'miniature-hairless').serviceIndex, 1);
  assert.equal(findVariant(234, 'miniature-coated').serviceIndex, 1);
  assert.equal(findVariant(234, 'medium-coated').serviceIndex, 2);
  assert.equal(findVariant(234, 'standard-coated').serviceIndex, 3);
  assert.equal(findVariant(310, 'small-hairless').serviceIndex, 1);
  assert.equal(findVariant(310, 'medium-hairless').serviceIndex, 2);
  assert.equal(findVariant(310, 'large-hairless').serviceIndex, 3);
  assert.equal(findVariant(310, 'small-coated').serviceIndex, 1);
  assert.equal(findVariant(310, 'medium-coated').serviceIndex, 2);
  assert.equal(findVariant(310, 'large-coated').serviceIndex, 3);
  assert.equal(findVariant(339, 'smooth').serviceIndex, 1);
  assert.equal(findVariant(345, 'smooth').serviceIndex, 0);
  assert.equal(findVariant(361, 'smooth').serviceIndex, 2);
  assert.equal(findVariant(361, 'rough').categoryId, 'ru-wire-coat');
  assert.equal(findVariant(375, 'rough').categoryId, 'ru-wire-coat');
  assert.equal(findVariant(376, 'standard-smooth').serviceIndex, 2);
  assert.equal(findVariant(376, 'large-smooth').serviceIndex, 3);
  assert.equal(findVariant(376, 'standard-rough').categoryId, 'ru-wire-coat');
  assert.equal(findVariant(376, 'large-rough').categoryId, 'ru-wire-coat');

  for (const fciNumber of [98, 216, 239, 320]) {
    assert.equal(findVariant(fciNumber, 'breed').categoryId, 'ru-wire-coat', `FCI ${fciNumber} must be wire-coated`);
  }
  for (const [fciNumber, categoryId] of [[9, 'ru-poodles-bichons'], [75, 'ru-small-growing-coat'], [105, 'ru-large-dogs'], [124, 'ru-large-dogs'], [221, 'ru-large-dogs'], [246, 'ru-small-growing-coat']]) {
    assert.equal(findVariant(fciNumber, 'breed').categoryId, categoryId, `FCI ${fciNumber} category mismatch`);
  }
});

test('localized catalogs expose corrected base breeds and no generic Belgian Shepherd duplicate', () => {
  const window = runSources([...BASE_SOURCES, ...FCI_SOURCES]);
  const expectedPetit = {
    de: 'Brabanter Griffon',
    en: 'Petit Brabançon',
    ru: 'Пти брабансон',
    uk: 'Малий брабанський грифон — пті брабансон',
  };
  const genericBelgian = {
    de: 'Belgischer Schäferhund',
    en: 'Belgian Shepherd',
    ru: 'Бельгийская овчарка',
    uk: 'Бельгійська вівчарка',
  };
  const expectedDutch = {
    de: 'Holländischer Schäferhund – Kurzhaar',
    en: 'Dutch Shepherd Dog — short-haired',
    ru: 'Голландская овчарка — короткошёрстная',
    uk: 'Нідерландська вівчарка — короткошерста',
  };

  for (const locale of LOCALES) {
    const categories = window.PricePageCatalog.categoriesByLocale[locale];
    const namesByCategory = new Map(categories.map(category => [category.id, category.breeds?.[locale] || []]));
    const allNames = [...namesByCategory.values()].flat();

    assert.ok(namesByCategory.get('ru-short-coat').includes(expectedPetit[locale]), `${locale}: Petit Brabançon missing`);
    assert.ok(!namesByCategory.get('ru-wire-coat').includes(expectedPetit[locale]), `${locale}: Petit Brabançon in wire category`);
    assert.ok(namesByCategory.get('ru-short-coat').includes(expectedDutch[locale]), `${locale}: Dutch Shepherd localization missing`);
    assert.ok(!allNames.includes(genericBelgian[locale]), `${locale}: generic Belgian Shepherd duplicate remains`);
    assert.equal(allNames.filter(name => name.includes(locale === 'de' ? 'Belgischer Schäferhund –' : locale === 'en' ? 'Belgian Shepherd Dog —' : locale === 'ru' ? 'Бельгийская овчарка —' : 'Бельгійська вівчарка —')).length, 4);
  }
});

test('all localized price pages load FCI data before booking and UI code', () => {
  const expectedScripts = [
    'price-page-locales.js',
    'fci-dog-breeds-data.js',
    'price-page-fci-breeds.js',
    'price-page-coat-groups.js',
    'price-booking.js',
    'price-page.js',
  ];

  for (const locale of LOCALES) {
    const html = fs.readFileSync(path.join(ROOT, locale, 'prays-list.html'), 'utf8');
    const positions = expectedScripts.map(script => html.indexOf(script));
    assert.ok(positions.every(position => position >= 0), `${locale}: missing FCI integration script`);
    assert.deepEqual(positions, [...positions].sort((left, right) => left - right), `${locale}: invalid script order`);
  }
});

test('coat groups preserve every breed and its quote without public size codes', () => {
  const serviceOrder = ['puppy-intro', 'full-care', 'bath-hygiene', 'handstripping'];
  const before = runSources([...BASE_SOURCES, ...FCI_SOURCES, 'assets/js/price-booking.js']);
  const after = runSources([...BASE_SOURCES, ...FCI_SOURCES, 'assets/js/price-page-coat-groups.js', 'assets/js/price-booking.js']);
  const referenceCatalog = after.PriceBookingCatalog.build('ru');
  const expectedCounts = referenceCatalog.categories.map(category => category.breeds.length);
  assert.deepEqual(
    clone(referenceCatalog.categories
      .filter(category => category.source.animalType === 'dog')
      .map(category => category.breeds.length)),
    EXPECTED_COAT_CATEGORY_COUNTS
  );
  for (const lang of LOCALES) {
    const oldCatalog = before.PriceBookingCatalog.build(lang);
    const catalog = after.PriceBookingCatalog.build(lang);
    assert.equal(catalog.getCategory('ru-short-coat'), null);
    assert.deepEqual(clone(catalog.categories.map(category => category.breeds.length)), clone(expectedCounts), `${lang}: grouping parity`);
    const oldNames = oldCatalog.breeds.map(breed => breed.label).sort();
    assert.deepEqual(clone(catalog.breeds.map(breed => breed.label).sort()), clone(oldNames));
    const oldByName = new Map(oldCatalog.breeds.map(breed => [breed.label, breed]));
    for (const category of catalog.categories) {
      for (const row of category.services) assert.doesNotMatch(row.label, /\b(?:XS|S|M|L)\b/);
      if (category.source.animalType === 'dog') {
        const categoryServiceKeys = category.services.map(service => service.key);
        assert.deepEqual(clone(categoryServiceKeys), serviceOrder.filter(key => categoryServiceKeys.includes(key)), `${lang}:${category.id}: invalid service order`);
      }
      for (const breed of category.breeds) {
        const previous = oldByName.get(breed.label);
        const expected = oldCatalog.getServices(previous.categoryId, previous.id).map(service => [service.label, service.price]);
        const actual = catalog.getServices(category.id, breed.id).map(service => [service.label, service.price]);
        if (category.source.animalType === 'dog') {
          const breedServiceKeys = catalog.getServices(category.id, breed.id).map(service => service.key);
          assert.deepEqual(clone(breedServiceKeys), serviceOrder.filter(key => breedServiceKeys.includes(key)), `${lang}:${breed.label}: invalid service order`);
        }
        for (const service of expected) assert.ok(actual.some(item => item[0] === service[0] && item[1] === service[1]), `${lang}:${breed.label}: changed quote`);
        if (previous.categoryId === 'ru-short-coat') {
          const fullCare = catalog.getServices(category.id, breed.id).find(service => service.key === 'full-care');
          assert.equal(fullCare?.price, expected[0][1], `${lang}:${breed.label}: missing full care`);
          assert.equal(actual.length, expected.length + 1, `${lang}:${breed.label}: invalid short-coat services`);
        } else {
          assert.equal(actual.length, expected.length, `${lang}:${breed.label}: invalid service count`);
        }
      }
    }
    for (const section of ['small', 'medium', 'large']) {
      const categories = catalog.categories.filter(category => category.source.pageSection === section);
      assert.deepEqual(clone(categories.map(category => category.source.coatType)), ['long', 'short', 'double']);
      for (const category of categories) {
        assert.ok(category.breeds.length);
        assert.ok(category.services.some(service => service.key === 'full-care'));
        assert.ok(category.services.some(service => service.key === 'bath-hygiene'));
        assert.ok(category.services.some(service => service.key === 'puppy-intro'));
        for (const breed of category.breeds) {
          assert.ok(catalog.getServices(category.id, breed.id).some(service => service.key === 'full-care'));
          assert.ok(catalog.getServices(category.id, breed.id).some(service => service.key === 'bath-hygiene'));
          const keys = category.source.breedKeys;
          assert.equal(new Set(keys).size, keys.length);
        }
      }
    }
    assert.equal(catalog.categories.filter(category => category.source.animalType === 'dog').length, 9);
    for (const oldId of DOG_CATEGORY_IDS) assert.equal(catalog.getCategory(oldId), null);
  }
});

test('all locales use identical coat memberships and preserve specialist services', () => {
  const window = runSources([...BASE_SOURCES, ...FCI_SOURCES, 'assets/js/price-page-coat-groups.js', 'assets/js/price-booking.js']);
  const membership = lang => new Map(window.PricePageCatalog.categoriesByLocale[lang].filter(category => category.animalType === 'dog')
    .flatMap(category => category.breedKeys.map(key => [key, category.id])));
  const expected = membership('ru');
  assert.equal(expected.size, 435);
  for (const lang of LOCALES) assert.deepEqual([...membership(lang)].sort(), [...expected].sort());
  assert.equal(expected.get('ru-poodles-bichons:base:0'), 'ru-long-coat-small');
  assert.equal(expected.get('ru-poodles-bichons:base:4'), 'ru-double-coat-small');
  assert.equal(expected.get('ru-spitz:base:0'), 'ru-double-coat-small');
  assert.equal(expected.get('ru-large-dogs:base:0'), 'ru-double-coat-large');
  assert.equal(expected.get('fci:94:small-wire'), 'ru-long-coat-small');
  assert.equal(expected.get('fci:94:small-smooth'), 'ru-short-coat-small');
  const catalog = window.PriceBookingCatalog.build('ru');
  const westie = catalog.breeds.find(breed => breed.label === 'Вест-хайленд-уайт-терьер');
  const bichon = catalog.breeds.find(breed => breed.label === 'Бишон-фризе');
  assert.equal(westie.categoryId, bichon.categoryId);
  assert.ok(catalog.getServices(catalog.getCategory('ru-additional-services').id).some(service => service.key === 'trimming'));
  assert.ok(catalog.getServices(westie.categoryId, westie.id).every(service => service.key !== 'trimming'));
});
