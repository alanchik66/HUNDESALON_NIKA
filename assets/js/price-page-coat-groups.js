(function groupDogsByCoatAndSize(global) {
  'use strict';

  const catalog = global.PricePageCatalog;
  if (!catalog?.categoriesByLocale || !global.FciDogBreedIntegration) return;

  const sourceIds = new Set(Object.values(global.FciDogBreedIntegration.categories));
  const sizes = ['small', 'medium', 'large', 'giant'];
  const coats = ['short', 'wire', 'long', 'double'];
  const copy = {
    ru: {
      long: 'Длинношёрстные породы',
      short: 'Короткошёрстные породы',
      wire: 'Жёсткошёрстные породы',
      double: 'Породы с двойным типом шерсти',
      longSummary: 'Уход за длинной и кудрявой шерстью с учётом особенностей породы.',
      shortSummary: 'Купание, уход за короткой шерстью и кожей, гигиенические процедуры.',
      wireSummary: 'Уход за жёсткой шерстью с учётом породы; тримминг доступен по запросу.',
      doubleSummary: 'Уход за остевой шерстью и подшёрстком с учётом структуры шерсти.',
      care: 'Комплексный уход',
      bath: 'Купание + гигиенический уход',
      handstripping: 'Тримминг',
    },
    de: {
      long: 'Langhaarige Rassen',
      short: 'Kurzhaarige Rassen',
      wire: 'Rauhaarige Rassen',
      double: 'Rassen mit Doppelfell',
      longSummary: 'Pflege von langem und lockigem Fell passend zur jeweiligen Rasse.',
      shortSummary: 'Baden, Pflege von kurzem Fell und Haut sowie Hygienepflege.',
      wireSummary: 'Rassegerechte Pflege von rauem Fell; Trimmen ist auf Anfrage verfügbar.',
      doubleSummary: 'Pflege von Deckhaar und Unterwolle passend zur Fellstruktur.',
      care: 'Komplettpflege',
      bath: 'Baden + Hygienepflege',
      handstripping: 'Trimmen',
    },
    en: {
      long: 'Long-haired breeds',
      short: 'Short-haired breeds',
      wire: 'Wire-haired breeds',
      double: 'Double-coated breeds',
      longSummary: 'Care for long and curly coats, tailored to the breed.',
      shortSummary: 'Bathing, short coat and skin care, and hygiene care.',
      wireSummary: 'Breed-appropriate care for wire coats; hand stripping is available on request.',
      doubleSummary: 'Care for the outer coat and undercoat, tailored to the coat structure.',
      care: 'Full care',
      bath: 'Bath + hygiene care',
      handstripping: 'Hand stripping',
    },
    uk: {
      long: 'Довгошерсті породи',
      short: 'Короткошерсті породи',
      wire: 'Жорсткошерсті породи',
      double: 'Породи з подвійним типом шерсті',
      longSummary: 'Догляд за довгою та кучерявою шерстю з урахуванням породи.',
      shortSummary: 'Купання, догляд за короткою шерстю та шкірою, гігієнічні процедури.',
      wireSummary: 'Догляд за жорсткою шерстю з урахуванням породи; тримінг доступний за запитом.',
      doubleSummary: 'Догляд за остьовою шерстю та підшерстям з урахуванням структури шерсті.',
      care: 'Комплексний догляд',
      bath: 'Купання + гігієнічний догляд',
      handstripping: 'Тримінг',
    },
  };

  // Category membership is shared by all locales via stable breed keys, never translated names.
  // Wire coats have their own care category, whether or not they have undercoat.
  // Other double coats take precedence over hair length. The curly Pumi stays double;
  // FCI 168 (Dandie Dinmont) and 294 (Otterhound) explicitly describe coats as "not wiry".
  // FCI references: /Nomenclature/Standards/{097g05,215g09,208g09,094g05,165g07}-en.pdf.
  // Non-wire exceptions: /Nomenclature/Standards/{056g01,168g03,294g06}-en.pdf.
  // Salon size bands use adult breed-standard weight: up to 6, 6–15, 15–30, and 30+ kg.
  // A standard range that reaches the next boundary uses the heavier band; stable breed keys
  // keep coat/size varieties deterministic and identical in every locale.
  const shortDoubleFci = new Set([15, 44, 64, 163, 192, 223, 240, 254, 287, 293, 296, 315, 321, 351, 360]);
  const shortDoubleBase = new Set([6, 9, 25]); // Pug, Beagle, Rottweiler.
  const smallDoubleFci = new Set([75, 148, 209, 218, 231]);
  const smallDoubleBase = new Set([3, 6, 7, 8, 10]);
  const poodleDoubleFci = new Set([298, 301]);
  const nonWireDoubleFci = new Set([56, 168, 294]);
  const largeSingleFci = new Set([93, 99, 105, 110, 124, 228, 269, 372]);
  const mediumLargeFci = new Set([38, 39, 46, 47, 55, 87, 93, 138, 141, 221, 238, 251, 277, 312, 313, 364, 367]);
  const smallWireFci = new Set([67, 103, 148, 168, 308]);
  const smallWireBase = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14, 15, 18, 19, 20, 21, 22]);
  const tinyWireBase = new Set([2, 5, 6, 20, 21]);
  const largeSpanielFci = new Set([2, 6, 106, 108, 114, 117, 118, 120, 175, 224, 330]);
  const largePoodleFci = new Set([37, 298, 301, 336]);
  const largePoodleBase = new Set([15, 16]);
  const largeSpitzFci = new Set([48, 261, 291, 317, 318, 319, 334, 358]);
  const largeSpitzBase = new Set([4, 5, 7]);
  const giantSpitzFci = new Set([291]);
  const giantWireFci = new Set([15, 98, 107, 160, 164, 165, 191, 216, 223, 232, 239, 294, 320]);
  const giantWireBase = new Set([10, 17]);
  const mediumSmallCoatFci = new Set([75, 209, 231, 246]);

  function classify(category, index) {
    const key = category.breedKeys[index];
    const fci = category.breedFciNumbers[index];
    const base = key.includes(':base:') ? Number(key.split(':').at(-1)) : null;
    let coat = 'long';
    let size = category.pageSection;
    if (category.id === 'ru-small-growing-coat') {
      coat = smallDoubleFci.has(fci) || smallDoubleBase.has(base) ? 'double' : 'long';
      size = mediumSmallCoatFci.has(fci) ? 'medium' : 'small';
    } else if (category.id === 'ru-poodles-bichons') {
      coat = base === 4 || poodleDoubleFci.has(fci) ? 'double' : 'long';
      size = largePoodleFci.has(fci) || largePoodleBase.has(base) ? 'large'
        : fci || [2, 3, 14].includes(base) ? 'medium' : 'small';
    } else if (category.id === 'ru-spitz') {
      coat = 'double';
      size = giantSpitzFci.has(fci) ? 'giant'
        : largeSpitzBase.has(base) || largeSpitzFci.has(fci) ? 'large'
          : [0, 1, 2].includes(base) || fci === 195 ? 'small' : 'medium';
    } else if (category.id === 'ru-spaniels') {
      coat = [0, 1, 4, 5].includes(base) || [104, 222].includes(fci) ? 'double' : 'long';
      size = base === 8 ? 'giant'
        : largeSpanielFci.has(fci) || [4, 5, 6, 7, 9].includes(base) || [104, 222].includes(fci) ? 'large'
          : 'medium';
    } else if (category.id === 'ru-wire-coat') {
      coat = nonWireDoubleFci.has(fci) ? 'double' : 'wire';
      size = smallWireBase.has(base) || smallWireFci.has(fci) ? 'medium' : 'large';
      if (tinyWireBase.has(base) || (fci === 148 && /(?:rabbit|miniature)/.test(key))) size = 'small';
      if (fci === 148 && !/(?:rabbit|miniature)/.test(key)) size = 'medium';
      if (giantWireBase.has(base) || giantWireFci.has(fci)) size = 'giant';
      if (fci === 94) size = key.includes('small-') ? 'small' : key.includes('large-') ? 'large' : 'large';
      if (fci === 376) size = 'large';
    } else if (category.id === 'ru-short-coat') {
      coat = shortDoubleFci.has(fci) || shortDoubleBase.has(base) ? 'double' : 'short';
      const priceIndex = category.breedServiceIndexes[index];
      size = sizes[priceIndex] || 'giant';
    } else if (category.id === 'ru-large-dogs') {
      coat = base >= 28 || largeSingleFci.has(fci) ? 'long' : 'double';
      size = fci === 83 ? 'medium'
        : [3, 4, 5, 7, 8, 10, 25].includes(base) || mediumLargeFci.has(fci) ? 'large' : 'giant';
    }
    if (fci === 148) size = /(?:rabbit|miniature)/.test(key) ? 'small' : 'medium';
    return { coat, size };
  }

  const memberships = new Map();
  for (const category of catalog.categoriesByLocale.ru.filter(item => sourceIds.has(item.id))) {
    category.breedKeys.forEach((key, index) => {
      if (memberships.has(key)) throw new Error('Duplicate breed key: ' + key);
      memberships.set(key, classify(category, index));
    });
  }

  const serviceOrder = ['puppy-intro', 'full-care', 'bath-hygiene', 'handstripping'];
  const priceMatrix = {
    small: { puppy: 50, short: [60, 50], wire: [80, 60, 75], long: [80, 60], double: [80, 60] },
    medium: { puppy: 55, short: [70, 60], wire: [90, 70, 90], long: [90, 70], double: [90, 75] },
    large: { puppy: 60, short: [90, 75], wire: [110, 85, 110], long: [105, 85], double: [110, 90] },
    giant: { puppy: 70, short: [110, 95], wire: [140, 105, 140], long: [130, 110], double: [140, 120] },
  };
  const priceText = (lang, value) => ({
    [lang]: lang === 'en' ? `from €${value}` : lang === 'uk' ? `від ${value} €` : lang === 'de' ? `ab ${value} €` : `от ${value} €`,
  });
  const auditedRows = (source, membership, lang, text) => {
    const tariff = priceMatrix[membership.size];
    const [fullPrice, bathPrice] = tariff[membership.coat];
    const puppy = source.priceRows.find(row => row.key === 'puppy-intro');
    return [
      puppy && { ...puppy, key: 'puppy-intro', price: priceText(lang, tariff.puppy) },
      { key: 'full-care', label: { [lang]: text.care }, price: priceText(lang, fullPrice) },
      { key: 'bath-hygiene', label: { [lang]: text.bath }, price: priceText(lang, bathPrice) },
    ].filter(Boolean);
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
        const rows = auditedRows(source, membership, lang, text);
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
        const option = breeds.find(breed => breed.rows.some(row => row.key === key)).rows.find(row => row.key === key);
        return { ...option };
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
