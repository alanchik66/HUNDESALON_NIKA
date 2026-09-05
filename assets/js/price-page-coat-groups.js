(function groupDogsByCoatAndSize(global) {
  'use strict';

  const catalog = global.PricePageCatalog;
  if (!catalog?.categoriesByLocale || !global.FciDogBreedIntegration) return;

  const sourceIds = new Set(Object.values(global.FciDogBreedIntegration.categories));
  const sizes = ['small', 'medium', 'large'];
  const coats = ['long', 'short', 'double'];
  const copy = {
    ru: {
      long: 'Длинношёрстные породы',
      short: 'Короткошёрстные породы',
      double: 'Породы с двойным типом шерсти',
      longSummary: 'Уход за длинной, кудрявой и жёсткой шерстью с учётом особенностей породы.',
      shortSummary: 'Купание, уход за короткой шерстью и кожей, гигиенические процедуры.',
      doubleSummary: 'Уход за остевой шерстью и подшёрстком с учётом структуры шерсти.',
      care: 'Комплексный уход',
    },
    de: {
      long: 'Langhaarige Rassen',
      short: 'Kurzhaarige Rassen',
      double: 'Rassen mit Doppelfell',
      longSummary: 'Pflege von langem, lockigem und rauem Fell passend zur jeweiligen Rasse.',
      shortSummary: 'Baden, Pflege von kurzem Fell und Haut sowie Hygienepflege.',
      doubleSummary: 'Pflege von Deckhaar und Unterwolle passend zur Fellstruktur.',
      care: 'Komplettpflege',
    },
    en: {
      long: 'Long-haired breeds',
      short: 'Short-haired breeds',
      double: 'Double-coated breeds',
      longSummary: 'Care for long, curly and rough coats, tailored to the breed.',
      shortSummary: 'Bathing, short coat and skin care, and hygiene care.',
      doubleSummary: 'Care for the outer coat and undercoat, tailored to the coat structure.',
      care: 'Full care',
    },
    uk: {
      long: 'Довгошерсті породи',
      short: 'Короткошерсті породи',
      double: 'Породи з подвійним типом шерсті',
      longSummary: 'Догляд за довгою, кучерявою та жорсткою шерстю з урахуванням породи.',
      shortSummary: 'Купання, догляд за короткою шерстю та шкірою, гігієнічні процедури.',
      doubleSummary: 'Догляд за остьовою шерстю та підшерстям з урахуванням структури шерсті.',
      care: 'Комплексний догляд',
    },
  };

  // Category membership is shared by all locales via stable breed keys, never translated names.
  // Double coats take precedence over hair length; wire coats without undercoat stay in long care.
  // FCI references: /Nomenclature/Standards/{097g05,215g09,208g09,094g05,165g07}-en.pdf.
  const shortDoubleFci = new Set([15, 44, 64, 163, 223, 240, 254, 287, 293, 296, 315, 321, 351, 360]);
  const shortDoubleBase = new Set([6, 9, 25]); // Pug, Beagle, Rottweiler.
  const smallDoubleFci = new Set([75, 148, 209, 218, 231]);
  const smallDoubleBase = new Set([3, 6, 7, 8, 10]);
  const poodleDoubleFci = new Set([298, 301]);
  const wireSingleFci = new Set([89, 94, 165, 198]);
  const largeSingleFci = new Set([93, 99, 105, 110, 124, 228, 269, 372]);
  const mediumLargeFci = new Set([38, 39, 46, 47, 55, 87, 93, 138, 141, 221, 238, 251, 277, 312, 313, 364, 367]);
  const largeWireFci = new Set([15, 89, 98, 107, 160, 164, 165, 191, 216, 223, 232, 239, 245, 282, 294, 320]);
  const smallWireFci = new Set([67, 103, 148, 168, 302, 308]);
  const smallWireBase = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 18, 19, 20, 21, 22]);
  const largeSpanielFci = new Set([2, 6, 106, 108, 114, 117, 118, 120, 175, 224, 330]);

  function classify(category, index) {
    const key = category.breedKeys[index];
    const fci = category.breedFciNumbers[index];
    const base = key.includes(':base:') ? Number(key.split(':').at(-1)) : null;
    let coat = 'long';
    let size = category.pageSection;
    if (category.id === 'ru-small-growing-coat') {
      coat = smallDoubleFci.has(fci) || smallDoubleBase.has(base) ? 'double' : 'long';
      size = fci === 209 ? 'medium' : 'small';
    } else if (category.id === 'ru-poodles-bichons') {
      coat = base === 4 || poodleDoubleFci.has(fci) ? 'double' : 'long';
      size = fci || [2, 3, 14, 15, 16].includes(base) ? 'medium' : 'small';
    } else if (category.id === 'ru-spitz') {
      coat = 'double';
      size = [0, 1, 2, 3, 6].includes(base) || [195, 265].includes(fci) ? 'small' : 'medium';
    } else if (category.id === 'ru-spaniels') {
      coat = [0, 1, 4, 5].includes(base) || [104, 222].includes(fci) ? 'double' : 'long';
      size = [2, 3].includes(base) ? 'small' : largeSpanielFci.has(fci) || base === 8 ? 'large' : 'medium';
    } else if (category.id === 'ru-wire-coat') {
      coat = wireSingleFci.has(fci) ? 'long' : 'double';
      size = smallWireBase.has(base) || smallWireFci.has(fci) ? 'small'
        : [10, 17].includes(base) || largeWireFci.has(fci) ? 'large' : 'medium';
      if (fci === 94) size = key.includes('small-') ? 'small' : key.includes('large-') ? 'large' : 'medium';
      if (fci === 376) size = key.includes('large-') ? 'large' : 'medium';
    } else if (category.id === 'ru-short-coat') {
      coat = shortDoubleFci.has(fci) || shortDoubleBase.has(base) ? 'double' : 'short';
      const priceIndex = category.breedServiceIndexes[index];
      size = priceIndex < 2 ? 'small' : priceIndex === 2 ? 'medium' : 'large';
      if ([8, 9, 13, 14, 15].includes(base) || [34, 35, 64, 163].includes(fci)) size = 'medium';
      if (fci === 223) size = 'large';
    } else if (category.id === 'ru-large-dogs') {
      coat = base >= 28 || largeSingleFci.has(fci) ? 'long' : 'double';
      size = fci === 83 ? 'small' : [3, 4, 5].includes(base) || mediumLargeFci.has(fci) ? 'medium' : 'large';
    }
    return { coat, size };
  }

  const memberships = new Map();
  for (const category of catalog.categoriesByLocale.ru.filter(item => sourceIds.has(item.id))) {
    category.breedKeys.forEach((key, index) => {
      if (memberships.has(key)) throw new Error('Duplicate breed key: ' + key);
      memberships.set(key, classify(category, index));
    });
  }

  function serviceKey(source, row, index) {
    if (row.key === 'puppy-intro') return row.key;
    if (source.id === 'ru-short-coat' || index === source.priceRows.length - 2) return 'bath-hygiene';
    if (source.id === 'ru-wire-coat' && index === 1) return 'handstripping';
    return 'full-care';
  }
  const serviceOrder = ['puppy-intro', 'full-care', 'bath-hygiene', 'handstripping'];
  const amount = value => {
    const match = Object.values(value || {}).find(text => /\d/.test(text))?.match(/\d+(?:[.,]\d+)?/);
    return match ? Number(match[0].replace(',', '.')) : Infinity;
  };

  for (const [lang, text] of Object.entries(copy)) {
    const original = catalog.categoriesByLocale[lang];
    const buckets = new Map();
    for (const size of sizes) for (const coat of coats) buckets.set(size + ':' + coat, []);
    for (const source of original.filter(category => sourceIds.has(category.id))) {
      source.breeds[lang].forEach((name, index) => {
        const breedKey = source.breedKeys[index];
        const membership = memberships.get(breedKey);
        if (!membership) throw new Error('Missing breed classification: ' + breedKey);
        const rows = source.priceRows.flatMap((row, rowIndex) => {
          if (source.id === 'ru-short-coat' && row.key !== 'puppy-intro') {
            if (rowIndex !== source.breedServiceIndexes[index]) return [];
            return [
              { ...row, key: 'full-care', label: { [lang]: text.care } },
              { ...row, key: 'bath-hygiene' },
            ];
          }
          return [{ ...row, key: serviceKey(source, row, rowIndex) }];
        });
        buckets.get(membership.size + ':' + membership.coat).push({
          name, breedKey, fci: source.breedFciNumbers[index], rows, notes: source.notes,
          services: source.services, sourceCategoryId: source.id,
        });
      });
    }
    const grouped = [];
    const collator = new Intl.Collator(lang, { sensitivity: 'base', numeric: true });
    for (const size of sizes) for (const coat of coats) {
      const breeds = buckets.get(size + ':' + coat).sort((a, b) => collator.compare(a.name, b.name));
      if (!breeds.length) continue;
      const keys = serviceOrder.filter(key => breeds.some(breed => breed.rows.some(row => row.key === key)));
      const priceRows = keys.map(key => {
        const options = breeds.flatMap(breed => breed.rows.filter(row => row.key === key));
        const cheapest = options.reduce((best, row) => amount(row.price) < amount(best.price) ? row : best);
        return { ...cheapest, label: key === 'full-care' ? { [lang]: text.care } : cheapest.label };
      });
      grouped.push({
        id: 'ru-' + coat + '-coat-' + size,
        animalType: 'dog',
        coatType: coat,
        title: { [lang]: text[coat] },
        summary: { [lang]: text[coat + 'Summary'] },
        pageSection: size,
        additionalServiceGroup: size,
        breeds: { [lang]: breeds.map(breed => breed.name) },
        breedKeys: breeds.map(breed => breed.breedKey),
        breedFciNumbers: breeds.map(breed => breed.fci),
        breedServiceRows: breeds.map(breed => Object.fromEntries(breed.rows.map(row => [keys.indexOf(row.key), row]))),
        breedNotes: breeds.map(breed => breed.notes),
        breedSourceCategoryIds: breeds.map(breed => breed.sourceCategoryId),
        services: [...new Set(breeds.flatMap(breed => breed.services))],
        priceRows,
        notes: [],
      });
    }
    catalog.categoriesByLocale[lang] = [...grouped, ...original.filter(category => !sourceIds.has(category.id))];
  }
})(window);
