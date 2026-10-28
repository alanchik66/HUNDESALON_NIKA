import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const window = { PricePageCatalog: {} };
vm.runInNewContext(readFileSync(new URL('../assets/js/price-booking.js', import.meta.url), 'utf8'), { window });
const score = (label, query) => window.PriceBookingCatalog.breedSearchScore(label, query, 'ru');

for (const [label, query] of [
  ['Немецкая овчарка', 'авчарка'],
  ['Немецкая овчарка', 'овчрака'],
  ['Бивер-йоркширский терьер', 'бивер'],
  ['Бивер-йоркширский терьер', 'йорк'],
  ['Бивер-йоркширский терьер', 'йорк бивер'],
  ['Русский той-терьер', 'той'],
  ['Русский той-терьер', 'терьер'],
  ['Русский той-терьер', 'той терер'],
]) {
  test(`${query} finds ${label}`, () => assert.ok(Number.isFinite(score(label, query))));
}
test('unrelated queries do not match', () => assert.equal(score('Немецкая овчарка', 'пудель'), Infinity));
test('exact matches rank before typos', () => assert.ok(score('Немецкая овчарка', 'овчарка') < score('Немецкая овчарка', 'авчарка')));
for (const label of ['Toypudel', 'Zwergpudel', 'Kleinpudel', 'Großpudel']) {
  test(`Pudel finds the German compound ${label}`, () => {
    assert.equal(window.PriceBookingCatalog.breedSearchScore(label, 'Pudel', 'de'), 1);
  });
}
test('compound suffixes require four letters and reject unrelated or middle fragments', () => {
  const tokenScore = window.PriceBookingCatalog.tokenScore;
  assert.equal(tokenScore('zwergpudel', 'pudel'), 1);
  assert.equal(tokenScore('pudel', 'pudel'), 0);
  assert.equal(tokenScore('zwergpudel', 'el'), Infinity);
  assert.equal(tokenScore('zwergpudel', 'del'), Infinity);
  assert.equal(tokenScore('pudelpointer', 'udelp'), Infinity);
  assert.equal(tokenScore('labrador', 'pudel'), Infinity);
});

const priceSource = readFileSync(new URL('../assets/js/price-page.js', import.meta.url), 'utf8');
const declaration = name => {
  const match = priceSource.match(new RegExp(`  const ${name} = [\\s\\S]*?\\n  \\};`));
  assert.ok(match, `missing ${name}`);
  return match[0];
};
const normalizeDeclarations = priceSource.slice(
  priceSource.indexOf('  const normalizeSearch ='),
  priceSource.indexOf('  const getBreedSearchTokens =')
);
const matchDeclarations = priceSource.slice(
  priceSource.indexOf('  const breedSearchMatches ='),
  priceSource.indexOf('  const breedSearchMatchById =')
);
const createHeroSearch = new Function('lang', 'locale', 'sourceCategories', 'getBreedTokenScore', `
  const getText = value => typeof value === 'string' ? value : value?.[lang] || value?.en || '';
  const getAnimalPhotoRecord = () => null;
  const getBreedWeightProfile = () => ({ bands: [], value: 0 });
  const SEARCH_MIN_CHARS = 2;
  const searchFilterState = { animal: 'all', weight: 'all', coat: 'all', sort: 'default' };
  ${declaration('createCategoryViews')}
  const categoryViews = createCategoryViews();
  ${normalizeDeclarations}
  ${declaration('getBreedSearchTokens')}
  ${declaration('getSearchAnimalType')}
  ${declaration('getBreedSearchContext')}
  ${declaration('matchesSearchFilters')}
  ${matchDeclarations}
  ${declaration('compareBreedMatches')}
  ${declaration('sortBreedMatches')}
  ${declaration('findBreedMatches')}
  return { find: findBreedMatches, filters: searchFilterState };
`);

const catalogFiles = new Set([
  'price-page-data.js', 'price-page-ru-data.js', 'price-page-locales.js',
  'fci-dog-breeds-data.js', 'price-page-fci-breeds.js', 'price-page-coat-groups.js',
  'cat-breeds-data.js', 'price-page-cat-breeds.js', 'animal-breed-photo-data.js',
  'price-page-animal-groups.js', 'price-booking.js',
]);
const speciesQueries = {
  ru: ['кролик', 'морская свинка', 'кошки', 'собаки'],
  uk: ['кролик', 'морська свинка', 'кішки', 'собаки'],
  de: ['Kaninchen', 'Meerschweinchen', 'Katzen', 'Hunde'],
  en: ['rabbit', 'guinea pig', 'cats', 'dogs'],
};
const targets = ['ru-rabbits', 'ru-guinea-pigs', 'cat', 'dog'];
const matchesTarget = (match, target) => target.startsWith('ru-')
  ? match.categoryId === target
  : match.animalType === target;

for (const lang of ['ru', 'uk', 'de', 'en']) {
  const context = vm.createContext({ window: {}, Intl });
  const html = readFileSync(new URL(`../${lang}/prays-list.html`, import.meta.url), 'utf8');
  for (const [, file] of html.matchAll(/<script src="\.\.\/assets\/js\/([^?\"]+)(?:\?[^\"]*)?"/g)) {
    if (!catalogFiles.has(file)) continue;
    vm.runInContext(readFileSync(new URL(`../assets/js/${file}`, import.meta.url), 'utf8'), context);
  }
  const catalog = context.window.PricePageCatalog;
  const search = createHeroSearch(lang, catalog.locales[lang], catalog.categoriesByLocale[lang], context.window.PriceBookingCatalog.tokenScore);

  speciesQueries[lang].forEach((query, index) => {
    const target = targets[index];
    test(`${lang}: ${query} finds only the actual animal species, including every breed`, () => {
      const matches = search.find(query);
      const expected = search.find('').filter(match => matchesTarget(match, target));
      assert.ok(expected.length > 0);
      assert.equal(matches.length, expected.length);
      assert.ok(matches.every(match => matchesTarget(match, target)));
    });
  });

  test(`${lang}: species context preserves exact breed names and existing aliases`, () => {
    const query = ({ ru: 'пудель', uk: 'пудель', de: 'Pudel', en: 'Poodle' })[lang];
    const matches = search.find(query);
    assert.ok(matches.length > 0);
    assert.ok(matches.every(match => match.animalType === 'dog'));
    const exact = matches[0].label;
    assert.equal(search.find(exact)[0].label, exact);
    if (lang === 'de') {
      for (const label of ['Toypudel', 'Zwergpudel', 'Kleinpudel', 'Großpudel']) {
        assert.ok(matches.some(match => match.label === label), `Pudel must include ${label}`);
      }
    }
  });

  test(`${lang}: explicit animal filters still restrict species queries`, () => {
    search.filters.animal = 'dog';
    assert.deepEqual(search.find(speciesQueries[lang][2]), []);
    search.filters.animal = 'all';
  });

  if (lang === 'ru') {
    test('Russian species and breed tokens combine without leaking Rex guinea pigs', () => {
      const matches = search.find('кролик рекс');
      assert.ok(matches.length > 0);
      assert.ok(matches.every(match => match.categoryId === 'ru-rabbits' && /рекс/i.test(match.label)));
    });
    test('dog coat category titles do not become generic breed search matches', () => {
      assert.deepEqual(search.find('длинная'), []);
      assert.ok(search.find('овчрака').some(match => /Немецкая овчарка/.test(match.label)));
    });
  }
}

for (const lang of ['ru', 'uk', 'de', 'en']) {
  test(`${lang}: suggestion popup caps rows and explains the full result count without truncating matches`, () => {
    const title = { textContent: '' };
    const popup = { hidden: true, querySelector: () => title };
    const list = { innerHTML: '' };
    const input = { removeAttribute() {}, setAttribute() {} };
    const render = new Function('lang', 'locale', 'searchSuggestions', 'searchSuggestionsList', 'searchInput', `
      let activeSuggestionIndex = -1;
      const SEARCH_MIN_CHARS = 2;
      const normalizeSearch = value => String(value).trim();
      const findBreedMatches = () => [];
      const escapeHtml = value => String(value ?? '');
      const renderAnimalPhotoThumbnail = () => '';
      const getAnimalPhotoEntry = () => null;
      ${declaration('renderBreedSuggestions')}
      return renderBreedSuggestions;
    `)(lang, { searchSuggestionsLabel: 'Possible breeds' }, popup, list, input);
    const matches = Array.from({ length: 435 }, (_, index) => ({
      label: `Breed ${index}`, categoryId: 'dog', breedIndex: index, sectionLabel: 'Dogs', categoryLabel: 'Care',
    }));
    assert.equal(render('dogs', matches), matches, 'caller retains every match for counts and cards');
    assert.equal((list.innerHTML.match(/ data-price-breed-result /g) || []).length, 48);
    assert.match(title.textContent, /48/);
    assert.match(title.textContent, /435/);
    assert.match(title.textContent, ({ ru: /уточните/, uk: /уточніть/, de: /eingrenzen/, en: /refine/ })[lang]);
    assert.equal(popup.hidden, false);
    render('poodle', matches.slice(0, 2));
    assert.equal((list.innerHTML.match(/ data-price-breed-result /g) || []).length, 2);
    assert.equal(title.textContent, 'Possible breeds');
  });
}
