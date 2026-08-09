(function initPriceBookingCatalog(global) {
  const pageCatalog = global.PricePageCatalog;
  if (!pageCatalog) return;

  const getText = (value, lang) => {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    return value[lang] || value.en || value.de || value.ru || value.uk || '';
  };

  const getSourceCategories = lang =>
    pageCatalog.categoriesByLocale?.[lang] || pageCatalog.categories || [];

  const getShortCoatPriceIndex = breedIndex => {
    if (breedIndex < 3) return 0;
    if (breedIndex < 8) return 1;
    return 2;
  };

  const build = lang => {
    const safeLang = ['de', 'en', 'ru', 'uk'].includes(lang) ? lang : 'en';
    const categories = getSourceCategories(safeLang).map(category => {
      const breeds = (category.breeds?.[safeLang] || category.breeds?.en || []).map((label, index) => ({
        id: `${category.id}:breed:${index}`,
        categoryId: category.id,
        index,
        label,
      }));
      const services = (category.priceRows || []).map((priceRow, index) => ({
        id: `${category.id}:service:${index}`,
        categoryId: category.id,
        index,
        label: getText(priceRow.label, safeLang),
        price: getText(priceRow.price, safeLang),
      }));

      return {
        id: category.id,
        title: getText(category.title, safeLang),
        breeds,
        services,
        source: category,
      };
    });

    const breedIndex = new Map();
    const categoryIndex = new Map(categories.map(category => [category.id, category]));
    categories.forEach(category => category.breeds.forEach(breed => breedIndex.set(breed.id, breed)));

    const getBreed = breedId => breedIndex.get(breedId) || null;
    const getCategory = categoryId => categoryIndex.get(categoryId) || null;
    const getServices = (categoryId, breedId = '') => {
      const category = getCategory(categoryId);
      if (!category) return [];

      if (category.id === 'ru-short-coat' && breedId) {
        const breed = getBreed(breedId);
        const service = category.services[getShortCoatPriceIndex(breed?.index ?? 0)];
        return service ? [service] : category.services;
      }

      return category.services;
    };

    const resolveQuote = (categoryId, breedId, serviceId) => {
      const category = getCategory(categoryId);
      const breed = getBreed(breedId);
      const service = getServices(categoryId, breedId).find(item => item.id === serviceId);

      if (!category || !breed || !service) {
        return { price: '', label: '', category: null, breed: null, service: null };
      }

      return {
        price: service.price,
        label: `${service.label} — ${breed.label}`,
        category,
        breed,
        service,
      };
    };

    return {
      categories,
      breeds: categories.flatMap(category => category.breeds),
      getBreed,
      getCategory,
      getServices,
      resolveQuote,
    };
  };

  global.PriceBookingCatalog = { build };
})(window);
