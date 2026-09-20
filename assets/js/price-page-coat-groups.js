(function groupDogsByCoatAndSize(global) {
  'use strict';

  const catalog = global.PricePageCatalog;
  if (!catalog?.categoriesByLocale || !global.FciDogBreedIntegration) return;

  const sourceIds = new Set(Object.values(global.FciDogBreedIntegration.categories));
  const sizes = ['small', 'medium', 'large', 'giant'];
  const coats = ['short', 'wire', 'long', 'curly', 'double'];
  const copy = {
    ru: {
      long: 'Длинношёрстные породы',
      curly: 'Пудельный и кудрявый тип шерсти',
      short: 'Короткошёрстные породы',
      wire: 'Жёсткошёрстные породы',
      double: 'Породы с двойным типом шерсти',
      longSummary: 'Уход за постоянно растущей, длинной и полудлинной шерстью с учётом особенностей породы.',
      curlySummary: 'Стрижка и уход за пудельной и кудрявой шерстью с учётом формы и плотности завитка.',
      shortSummary: 'Купание, уход за короткой шерстью и кожей, гигиенические процедуры.',
      wireSummary: 'Уход за жёсткой шерстью с учётом породы; тримминг — отдельная основная услуга.',
      doubleSummary: 'Уход за остевой шерстью и подшёрстком с учётом структуры шерсти.',
      care: 'Комплексный уход',
      bath: 'Купание + гигиенический уход',
      handstripping: 'Тримминг',
    },
    de: {
      long: 'Langhaarige Rassen',
      curly: 'Pudel- und Lockenfell',
      short: 'Kurzhaarige Rassen',
      wire: 'Rauhaarige Rassen',
      double: 'Rassen mit Doppelfell',
      longSummary: 'Pflege von ständig wachsendem, langem und halblangem Fell passend zur Rasse.',
      curlySummary: 'Schnitt und Pflege von Pudel- und Lockenfell mit Blick auf Form und Lockendichte.',
      shortSummary: 'Baden, Pflege von kurzem Fell und Haut sowie Hygienepflege.',
      wireSummary: 'Rassegerechte Pflege von rauem Fell; Trimmen ist eine eigene Hauptleistung.',
      doubleSummary: 'Pflege von Deckhaar und Unterwolle passend zur Fellstruktur.',
      care: 'Komplettpflege',
      bath: 'Baden + Hygienepflege',
      handstripping: 'Trimmen',
    },
    en: {
      long: 'Long-haired breeds',
      curly: 'Poodle and curly coats',
      short: 'Short-haired breeds',
      wire: 'Wire-haired breeds',
      double: 'Double-coated breeds',
      longSummary: 'Care for continuously growing, long and semi-long coats, tailored to the breed.',
      curlySummary: 'Clipping and care for poodle and curly coats, tailored to shape and curl density.',
      shortSummary: 'Bathing, short coat and skin care, and hygiene care.',
      wireSummary: 'Breed-appropriate care for wire coats; trimming is a dedicated primary service.',
      doubleSummary: 'Care for the outer coat and undercoat, tailored to the coat structure.',
      care: 'Full care',
      bath: 'Bath + hygiene care',
      handstripping: 'Trimming',
    },
    uk: {
      long: 'Довгошерсті породи',
      curly: 'Пудельний і кучерявий тип шерсті',
      short: 'Короткошерсті породи',
      wire: 'Жорсткошерсті породи',
      double: 'Породи з подвійним типом шерсті',
      longSummary: 'Догляд за шерстю, що постійно росте, довгою та напівдовгою шерстю з урахуванням породи.',
      curlySummary: 'Стрижка й догляд за пудельною та кучерявою шерстю з урахуванням форми й густоти завитка.',
      shortSummary: 'Купання, догляд за короткою шерстю та шкірою, гігієнічні процедури.',
      wireSummary: 'Догляд за жорсткою шерстю з урахуванням породи; тримінг — окрема основна послуга.',
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
      coat = base === 4 || poodleDoubleFci.has(fci) ? 'double' : 'curly';
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
      coat = /(?:poodle|doodle)/iu.test(key)
        ? 'curly'
        : base >= 28 || largeSingleFci.has(fci) ? 'long' : 'double';
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

  const serviceOrder = ['puppy-intro', 'full-groom', 'hygiene', 'trimming'];
  const priceMatrix = {
    small: {
      puppy: 50,
      short: { full: 60, bath: 60 },
      wire: { full: 80, bath: 60, handstripping: 60 },
      long: { full: 80, bath: 60 },
      curly: { full: 80, bath: 60 },
      double: { full: 80, bath: 60 },
    },
    medium: {
      puppy: 50,
      short: { full: 80, bath: 70 },
      wire: { full: 90, bath: 70, handstripping: 60 },
      long: { full: 90, bath: 70 },
      curly: { full: 100, bath: 80 },
      double: { full: 90, bath: 75 },
    },
    large: {
      puppy: 50,
      short: { full: 100, bath: 90 },
      wire: { full: 120, bath: 90, handstripping: 60 },
      long: { full: 120, bath: 90 },
      curly: { full: 120, bath: 90 },
      double: { full: 120, bath: 90 },
    },
    giant: {
      puppy: 50,
      short: { full: 120, bath: 120 },
      wire: { full: 150, bath: 105, handstripping: 60 },
      long: { full: 150, bath: 110 },
      curly: { full: 150, bath: 110 },
      double: { full: 150, bath: 120 },
    },
  };
  const priceText = (lang, value) => ({
    [lang]: lang === 'en' ? `from €${value}` : lang === 'uk' ? `від ${value} €` : lang === 'de' ? `ab ${value} €` : `от ${value} €`,
  });
  const hourlyPriceText = (lang, amount) => ({
    [lang]: lang === 'en' ? `€${amount} / hour` : lang === 'uk' ? `${amount} € / год.` : lang === 'de' ? `${amount} € / Std.` : `${amount} € / час`,
  });
  const auditedRows = (membership, lang, text) => {
    const tariff = priceMatrix[membership.size];
    const coatTariff = tariff[membership.coat];
    return [
      { key: 'full-groom', label: { [lang]: text.care }, price: priceText(lang, coatTariff.full) },
      { key: 'hygiene', label: { [lang]: text.bath }, price: priceText(lang, coatTariff.bath) },
      coatTariff.handstripping && { key: 'trimming', label: { [lang]: text.handstripping }, price: hourlyPriceText(lang, coatTariff.handstripping) },
      { key: 'puppy-intro', label: { [lang]: catalog.serviceLabels.puppyIntro[lang] }, price: priceText(lang, tariff.puppy) },
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
        const rows = auditedRows(membership, lang, text);
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
