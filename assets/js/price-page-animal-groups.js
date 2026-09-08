(function groupCatsAndSmallAnimals(global) {
  'use strict';

  const catalog = global.PricePageCatalog;
  const locales = ['de', 'en', 'ru', 'uk'];
  const catSourceId = 'ru-cats-grooming';
  const smallAnimalSourceId = 'ru-small-animals';
  const smallAnimalBreedSource = 'ARBA, ACBA and British Cavy Council recognised breed standards';
  const smallAnimalSourceUrls = Object.freeze([
    'https://arba.net/recognized-breeds/',
    'https://www.acbaonline.com/',
    'https://www.britishcavycouncil.org.uk/Standards/',
  ]);
  if (!catalog?.categoriesByLocale) return;

  const copy = {
    de: {
      catShort: 'Kurzhaarige Katzenrassen',
      catSpecial: 'Rex-, Drahthaar- und haarlose Rassen',
      catLong: 'Langhaarige Katzenrassen',
      catDouble: 'Katzenrassen mit Doppelfell',
      catShortSummary: 'Schonende Pflege von kurzem Fell und Haut, passend zur jeweiligen Rasse.',
      catSpecialSummary: 'Individuelle Pflege für lockiges, drahtiges, sehr feines oder haarloses Fell.',
      catLongSummary: 'Gründliche Pflege von langem und halblangem Fell mit Entfilzung nach Bedarf.',
      catDoubleSummary: 'Pflege von Deckhaar und dichter Unterwolle mit gründlichem Ausbürsten.',
      guineaShort: 'Kurzhaarige und plüschhaarige Meerschweinchen',
      guineaLong: 'Langhaarige und strukturierte Meerschweinchen',
      rabbitShort: 'Kurzhaarige und rexhaarige Kaninchen',
      rabbitLong: 'Langhaarige und Wollkaninchen',
      guineaShortSummary: 'Sanfte Hygiene- und Fellpflege für kurzes, glattes oder plüschiges Fell.',
      guineaLongSummary: 'Sorgfältiges Kämmen und Hygienepflege für langes, lockiges oder strukturiertes Fell.',
      rabbitShortSummary: 'Schonendes Ausbürsten und Hygienepflege; Baden gehört nicht zur Standardpflege.',
      rabbitLongSummary: 'Intensive Woll- und Langhaarpflege mit vorsichtigem Lösen von Verfilzungen.',
    },
    en: {
      catShort: 'Short-haired cat breeds',
      catSpecial: 'Rex, wire-haired and hairless breeds',
      catLong: 'Long-haired cat breeds',
      catDouble: 'Double-coated cat breeds',
      catShortSummary: 'Gentle short-coat and skin care tailored to the breed.',
      catSpecialSummary: 'Individual care for curly, wiry, very fine or hairless coats.',
      catLongSummary: 'Thorough care for long and semi-long coats, with detangling when needed.',
      catDoubleSummary: 'Outer-coat and dense-undercoat care with thorough brushing.',
      guineaShort: 'Short-haired and plush-coated guinea pigs',
      guineaLong: 'Long-haired and textured-coat guinea pigs',
      rabbitShort: 'Short-haired and rex-coated rabbits',
      rabbitLong: 'Long-haired and wool-coated rabbits',
      guineaShortSummary: 'Gentle hygiene and coat care for short, smooth or plush coats.',
      guineaLongSummary: 'Careful combing and hygiene care for long, curly or textured coats.',
      rabbitShortSummary: 'Gentle brushing and hygiene care; bathing is not part of standard rabbit care.',
      rabbitLongSummary: 'Intensive wool and long-coat care with careful detangling.',
    },
    ru: {
      catShort: 'Короткошёрстные породы кошек',
      catSpecial: 'Рексовые, жёсткошёрстные и бесшёрстные породы',
      catLong: 'Длинношёрстные породы кошек',
      catDouble: 'Породы кошек с двойным типом шерсти',
      catShortSummary: 'Бережный уход за короткой шерстью и кожей с учётом особенностей породы.',
      catSpecialSummary: 'Индивидуальный уход за кудрявой, жёсткой, очень тонкой шерстью или кожей бесшёрстных кошек.',
      catLongSummary: 'Тщательный уход за длинной и полудлинной шерстью с распутыванием при необходимости.',
      catDoubleSummary: 'Уход за остевой шерстью и плотным подшёрстком с тщательным вычёсыванием.',
      guineaShort: 'Короткошёрстные и плюшевые морские свинки',
      guineaLong: 'Длинношёрстные и структурношёрстные морские свинки',
      rabbitShort: 'Короткошёрстные и рексовые кролики',
      rabbitLong: 'Длинношёрстные и шерстяные кролики',
      guineaShortSummary: 'Бережный гигиенический уход за короткой, гладкой или плюшевой шерстью.',
      guineaLongSummary: 'Тщательное расчёсывание и гигиенический уход за длинной, кудрявой или структурной шерстью.',
      rabbitShortSummary: 'Бережное вычёсывание и гигиенический уход; купание не входит в стандартную процедуру.',
      rabbitLongSummary: 'Интенсивный уход за длинной и шерстяной шерстью с аккуратным распутыванием.',
    },
    uk: {
      catShort: 'Короткошерсті породи котів',
      catSpecial: 'Рексові, жорсткошерсті та безшерсті породи',
      catLong: 'Довгошерсті породи котів',
      catDouble: 'Породи котів із подвійним типом шерсті',
      catShortSummary: 'Делікатний догляд за короткою шерстю та шкірою з урахуванням особливостей породи.',
      catSpecialSummary: 'Індивідуальний догляд за кучерявою, жорсткою, дуже тонкою шерстю або шкірою безшерстих котів.',
      catLongSummary: 'Ретельний догляд за довгою та напівдовгою шерстю з розплутуванням за потреби.',
      catDoubleSummary: 'Догляд за остьовою шерстю та щільним підшерстям із ретельним вичісуванням.',
      guineaShort: 'Короткошерсті та плюшеві морські свинки',
      guineaLong: 'Довгошерсті та структурношерсті морські свинки',
      rabbitShort: 'Короткошерсті та рексові кролики',
      rabbitLong: 'Довгошерсті та вовняні кролики',
      guineaShortSummary: 'Делікатний гігієнічний догляд за короткою, гладкою або плюшевою шерстю.',
      guineaLongSummary: 'Ретельне розчісування та гігієнічний догляд за довгою, кучерявою або структурною шерстю.',
      rabbitShortSummary: 'Делікатне вичісування та гігієнічний догляд; купання не входить до стандартної процедури.',
      rabbitLongSummary: 'Інтенсивний догляд за довгою та вовняною шерстю з обережним розплутуванням.',
    },
  };

  const specialCatIds = new Set([
    'american-wirehair', 'cornish-rex', 'devon-rex', 'donskoy', 'german-rex',
    'laperm-longhair', 'laperm-shorthair', 'lykoi', 'peterbald',
    'selkirk-rex-longhair', 'selkirk-rex-shorthair', 'sphynx', 'tennessee-rex',
  ]);
  const catGroups = [
    { key: 'short', title: 'catShort', summary: 'catShortSummary', accepts: metadata => metadata.coatType === 'short' && !specialCatIds.has(metadata.id) },
    { key: 'special', title: 'catSpecial', summary: 'catSpecialSummary', accepts: metadata => specialCatIds.has(metadata.id) },
    { key: 'long', title: 'catLong', summary: 'catLongSummary', accepts: metadata => metadata.coatType === 'long' && !specialCatIds.has(metadata.id) },
    { key: 'double', title: 'catDouble', summary: 'catDoubleSummary', accepts: metadata => metadata.coatType === 'double' },
  ];

  const smallAnimalGroups = [
    {
      id: 'ru-guinea-pig-short-coat', species: 'guinea-pig', coatType: 'short', title: 'guineaShort', summary: 'guineaShortSummary',
      names: {
        de: ['Glatthaar', 'English Crested', 'American Crested', 'Rex', 'US-Teddy'],
        en: ['American / English', 'English Crested', 'American Crested', 'Rex', 'Teddy'],
        ru: ['Американская гладкошёрстная', 'Английский крестед', 'Американский крестед', 'Рекс', 'Тедди'],
        uk: ['Американська гладкошерста', 'Англійський крестед', 'Американський крестед', 'Рекс', 'Тедді'],
      },
      priceIndexes: [0, 1],
    },
    {
      id: 'ru-guinea-pig-long-coat', species: 'guinea-pig', coatType: 'long', title: 'guineaLong', summary: 'guineaLongSummary',
      names: {
        de: ['Peruaner', 'Sheltie', 'Coronet', 'Texel', 'Alpaka'],
        en: ['Peruvian', 'Silkie / Sheltie', 'Coronet', 'Texel', 'Alpaca'],
        ru: ['Перуанская', 'Шелти', 'Коронет', 'Тексель', 'Альпака'],
        uk: ['Перуанська', 'Шелті', 'Коронет', 'Тексель', 'Альпака'],
      },
      priceIndexes: [0, 1],
    },
    {
      id: 'ru-rabbit-short-coat', species: 'rabbit', coatType: 'short', title: 'rabbitShort', summary: 'rabbitShortSummary',
      names: {
        de: ['Farbenzwerge', 'Holländer', 'Mini Rex', 'Rex', 'Zwergwidder'],
        en: ['Netherland Dwarf', 'Dutch', 'Mini Rex', 'Rex', 'Holland Lop'],
        ru: ['Нидерландский карликовый', 'Голландский', 'Мини-рекс', 'Рекс', 'Карликовый баран'],
        uk: ['Нідерландський карликовий', 'Голландський', 'Міні-рекс', 'Рекс', 'Карликовий баран'],
      },
      priceIndexes: [2],
    },
    {
      id: 'ru-rabbit-long-coat', species: 'rabbit', coatType: 'long', title: 'rabbitLong', summary: 'rabbitLongSummary',
      names: {
        de: ['Englisches Angora', 'Französisches Angora', 'Löwenkopf', 'Jersey Wooly', 'American Fuzzy Lop'],
        en: ['English Angora', 'French Angora', 'Lionhead', 'Jersey Wooly', 'American Fuzzy Lop'],
        ru: ['Английская ангора', 'Французская ангора', 'Львиноголовый', 'Джерси вули', 'Американский пушистый баран'],
        uk: ['Англійська ангора', 'Французька ангора', 'Левоголовий', 'Джерсі вулі', 'Американський пухнастий баран'],
      },
      priceIndexes: [2],
    },
  ];

  for (const lang of locales) {
    const categories = catalog.categoriesByLocale[lang] || [];
    const catSource = categories.find(category => category.id === catSourceId);
    const smallSource = categories.find(category => category.id === smallAnimalSourceId);
    if (!catSource || !smallSource) throw new Error(`Missing animal price categories for ${lang}`);

    const catMetadata = catSource.breedMetadata?.[lang] || [];
    const cats = catGroups.map(definition => {
      const indexes = catMetadata.map((metadata, index) => definition.accepts(metadata) ? index : -1).filter(index => index >= 0);
      if (!indexes.length) throw new Error(`Empty cat coat group: ${definition.key} (${lang})`);
      return {
        ...catSource,
        id: `ru-cat-${definition.key}-coat`,
        animalType: 'cat',
        coatType: definition.key,
        title: { [lang]: copy[lang][definition.title] },
        summary: { [lang]: copy[lang][definition.summary] },
        breeds: { [lang]: indexes.map(index => catSource.breeds[lang][index]) },
        breedMetadata: { [lang]: indexes.map(index => catSource.breedMetadata[lang][index]) },
        breedPhotoTitles: { [lang]: indexes.map(index => catSource.breedPhotoTitles[lang][index]) },
        breedSourceCategoryIds: indexes.map(() => catSourceId),
      };
    });

    const smallAnimals = smallAnimalGroups.map(definition => {
      const breedKeys = definition.names[lang].map((_, index) => `${definition.species}:${definition.coatType}:${index}`);
      return {
        ...smallSource,
        id: definition.id,
        animalType: 'smallAnimal',
        species: definition.species,
        coatType: definition.coatType,
        title: { [lang]: copy[lang][definition.title] },
        summary: { [lang]: copy[lang][definition.summary] },
        breeds: { [lang]: [...definition.names[lang]] },
        breedKeys,
        breedMetadata: {
          [lang]: definition.names[lang].map((_, index) => ({
            id: breedKeys[index], species: definition.species, coatType: definition.coatType, sizeClass: 'small', surcharge: 0,
            photoTitle: definition.names.en[index],
          })),
        },
        breedPhotoTitles: { [lang]: [...definition.names.en] },
        breedSource: smallAnimalBreedSource,
        breedSourceUrls: smallAnimalSourceUrls,
        priceRows: definition.priceIndexes.map(index => smallSource.priceRows[index]),
        notes: definition.species === 'rabbit' ? [...smallSource.notes] : smallSource.notes.slice(1),
      };
    });

    const firstAnimalIndex = categories.findIndex(category => category.id === catSourceId || category.id === smallAnimalSourceId);
    const animalIds = new Set([catSourceId, smallAnimalSourceId]);
    const remaining = categories.filter(category => !animalIds.has(category.id));
    remaining.splice(firstAnimalIndex, 0, ...cats, ...smallAnimals);
    catalog.categoriesByLocale[lang] = remaining;
  }

  global.AnimalCareGroupIntegration = Object.freeze({
    catCategoryIds: Object.freeze(catGroups.map(group => `ru-cat-${group.key}-coat`)),
    smallAnimalCategoryIds: Object.freeze(smallAnimalGroups.map(group => group.id)),
    smallAnimalBreedSource,
    smallAnimalSourceUrls,
  });
})(typeof window !== 'undefined' ? window : globalThis);
