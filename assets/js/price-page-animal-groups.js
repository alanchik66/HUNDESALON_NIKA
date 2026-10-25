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
      catLong: 'Langhaarige Katzenrassen',
      catShortSummary: 'Schonende Pflege von kurzem Fell und Haut, passend zur jeweiligen Rasse.',
      catLongSummary: 'Gründliche Pflege von langem und halblangem Fell mit Entfilzung nach Bedarf.',
      guinea: 'Meerschweinchen',
      rabbit: 'Kaninchen',
      guineaSummary: 'Sorgfältige Pflege für Meerschweinchen, passend zu ihren individuellen Bedürfnissen.',
      rabbitSummary: 'Sorgfältige Pflege für Kaninchen, passend zu ihren individuellen Bedürfnissen.',
    },
    en: {
      catShort: 'Short-haired cat breeds',
      catLong: 'Long-haired cat breeds',
      catShortSummary: 'Gentle short-coat and skin care tailored to the breed.',
      catLongSummary: 'Thorough care for long and semi-long coats, with detangling when needed.',
      guinea: 'Guinea pigs',
      rabbit: 'Rabbits',
      guineaSummary: 'Careful guinea-pig care tailored to each animal’s individual needs.',
      rabbitSummary: 'Careful rabbit care tailored to each animal’s individual needs.',
    },
    ru: {
      catShort: 'Короткошёрстные породы кошек',
      catLong: 'Длинношёрстные породы кошек',
      catShortSummary: 'Бережный уход за короткой шерстью и кожей с учётом особенностей породы.',
      catLongSummary: 'Тщательный уход за длинной и полудлинной шерстью с распутыванием при необходимости.',
      guinea: 'Морские свинки',
      rabbit: 'Кролики',
      guineaSummary: 'Бережный уход за морскими свинками с учётом индивидуальных особенностей.',
      rabbitSummary: 'Бережный уход за кроликами с учётом индивидуальных особенностей.',
    },
    uk: {
      catShort: 'Короткошерсті породи котів',
      catLong: 'Довгошерсті породи котів',
      catShortSummary: 'Делікатний догляд за короткою шерстю та шкірою з урахуванням особливостей породи.',
      catLongSummary: 'Ретельний догляд за довгою та напівдовгою шерстю з розплутуванням за потреби.',
      guinea: 'Морські свинки',
      rabbit: 'Кролики',
      guineaSummary: 'Дбайливий догляд за морськими свинками з урахуванням індивідуальних особливостей.',
      rabbitSummary: 'Дбайливий догляд за кроликами з урахуванням індивідуальних особливостей.',
    },
  };

  // Dense/double coats are deliberately folded into the two customer-facing
  // cat groups. Long-haired variants stay in the long group; the remaining
  // double-coated breeds are serviced with the short-coat tariff and workflow.
  const longDoubleCatIds = new Set([
    'british-longhair', 'kurilian-bobtail-longhair', 'maine-coon', 'maine-coon-polydactyl',
    'neva-masquerade', 'norwegian-forest-cat', 'siberian', 'turkish-van',
  ]);
  const catGroups = [
    {
      key: 'short',
      title: 'catShort',
      summary: 'catShortSummary',
      accepts: metadata => metadata.coatType === 'short'
        || (metadata.coatType === 'double' && !longDoubleCatIds.has(metadata.id)),
    },
    {
      key: 'long',
      title: 'catLong',
      summary: 'catLongSummary',
      accepts: metadata => metadata.coatType === 'long'
        || (metadata.coatType === 'double' && longDoubleCatIds.has(metadata.id)),
    },
  ];

  const smallAnimalGroups = [
    {
      id: 'ru-guinea-pigs', species: 'guinea-pig', title: 'guinea', summary: 'guineaSummary', priceIndexes: [0, 1],
      coatGroups: {
        short: {
        de: ['Glatthaar', 'English Crested', 'American Crested', 'Rex', 'US-Teddy'],
        en: ['American / English', 'English Crested', 'American Crested', 'Rex', 'Teddy'],
        ru: ['Американская гладкошёрстная', 'Английский крестед', 'Американский крестед', 'Рекс', 'Тедди'],
        uk: ['Американська гладкошерста', 'Англійський крестед', 'Американський крестед', 'Рекс', 'Тедді'],
        },
        long: {
        de: ['Peruaner', 'Sheltie', 'Coronet', 'Texel', 'Alpaka'],
        en: ['Peruvian', 'Silkie / Sheltie', 'Coronet', 'Texel', 'Alpaca'],
        ru: ['Перуанская', 'Шелти', 'Коронет', 'Тексель', 'Альпака'],
        uk: ['Перуанська', 'Шелті', 'Коронет', 'Тексель', 'Альпака'],
        },
      },
    },
    {
      id: 'ru-rabbits', species: 'rabbit', title: 'rabbit', summary: 'rabbitSummary', priceIndexes: [2],
      coatGroups: {
        short: {
        de: ['Farbenzwerge', 'Holländer', 'Mini Rex', 'Rex', 'Zwergwidder'],
        en: ['Netherland Dwarf', 'Dutch', 'Mini Rex', 'Rex', 'Holland Lop'],
        ru: ['Нидерландский карликовый', 'Голландский', 'Мини-рекс', 'Рекс', 'Карликовый баран'],
        uk: ['Нідерландський карликовий', 'Голландський', 'Міні-рекс', 'Рекс', 'Карликовий баран'],
        },
        long: {
        de: ['Englisches Angora', 'Französisches Angora', 'Löwenkopf', 'Jersey Wooly', 'American Fuzzy Lop'],
        en: ['English Angora', 'French Angora', 'Lionhead', 'Jersey Wooly', 'American Fuzzy Lop'],
        ru: ['Английская ангора', 'Французская ангора', 'Львиноголовый', 'Джерси вули', 'Американский пушистый баран'],
        uk: ['Англійська ангора', 'Французька ангора', 'Левоголовий', 'Джерсі вулі', 'Американський пухнастий баран'],
        },
      },
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
      const breedEntries = Object.entries(definition.coatGroups).flatMap(([coatType, names]) => names[lang].map((name, index) => ({
        name,
        coatType,
        breedKey: `${definition.species}:${coatType}:${index}`,
        photoTitle: names.en[index],
      })));
      return {
        ...smallSource,
        id: definition.id,
        animalType: 'smallAnimal',
        species: definition.species,
        title: { [lang]: copy[lang][definition.title] },
        summary: { [lang]: copy[lang][definition.summary] },
        breeds: { [lang]: breedEntries.map(entry => entry.name) },
        breedKeys: breedEntries.map(entry => entry.breedKey),
        breedMetadata: {
          [lang]: breedEntries.map(entry => ({
            id: entry.breedKey, species: definition.species, coatType: entry.coatType, sizeClass: 'small', surcharge: 0,
            photoTitle: entry.photoTitle,
          })),
        },
        breedPhotoTitles: { [lang]: breedEntries.map(entry => entry.photoTitle) },
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
