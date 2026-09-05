(function integrateCatBreeds(global) {
  'use strict';

  const catalog = global.PricePageCatalog;
  const registry = global.CatBreedsData;
  const locales = ['de', 'en', 'ru', 'uk'];
  const categoryId = 'ru-cats-grooming';
  const categorySource = catalog?.categoriesByLocale;

  if (!categorySource || !Array.isArray(registry?.breeds)) return;

  const metadataFor = record => ({
    id: record.id,
    sourceCode: record.sourceCode,
    coatType: record.coatType,
    sizeClass: record.sizeClass,
    weightKg: { ...record.weightKg },
    handlingClass: record.handlingClass,
    surcharge: record.surcharge,
    photoTitle: record.photoTitle,
  });

  for (const lang of locales) {
    const categories = categorySource[lang] || [];
    const category = categories.find(item => item.id === categoryId);
    if (!category) throw new Error(`Missing cat category for ${lang}`);

    category.breeds = { [lang]: registry.breeds.map(record => record.names[lang]) };
    category.breedMetadata = {
      [lang]: registry.breeds.map(metadataFor),
    };
    category.breedPhotoTitles = {
      [lang]: registry.breeds.map(record => record.photoTitle),
    };
    category.breedSource = registry.source;
  }

  global.CatBreedIntegration = Object.freeze({
    categoryId,
    registryCount: registry.breeds.length,
    source: registry.source,
    sourceUrls: registry.sourceUrls,
  });
})(typeof window !== 'undefined' ? window : globalThis);
