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
    if (breedIndex < 5) return 0;
    if (breedIndex < 16) return 1;
    if (breedIndex < 24) return 2;
    return 3;
  };

  const BOOKING_SCHEDULE = Object.freeze({
    workdayStartMinutes: 9 * 60,
    workdayEndMinutes: 18 * 60,
    slotStepMinutes: 30,
    defaultBufferMinutes: 30,
    firstVisitExtraMinutes: 60,
    maxLookaheadDays: 90,
  });

  const COAT_CONDITION_EXTRA_MINUTES = Object.freeze({
    good: 0,
    slight_mats: 20,
    many_mats: 40,
    severe_matting: 60,
  });

  const BEHAVIOUR_EXTRA_MINUTES = Object.freeze({
    calm: 0,
    restless: 20,
    very_restless: 40,
    aggressive: 60,
  });

  const CATEGORY_DURATION_MINUTES = Object.freeze({
    'decorative-growing-coat': [120, 90],
    'poodles-and-doodles': [120, 150, 150, 180, 210, 180],
    bichons: [150, 150],
    spitzes: [120, 150, 180],
    'handstrip-breeds': [150, 210],
    spaniels: [150, 135, 180],
    'short-haired': [75, 105],
    'double-coat-longhair': [180, 150],
    'express-shedding': [90, 120, 150, 180],
    'additional-services': [15, 15, 20, 30, 60, 30, 20, 20, 90],
  });

  const parseServiceIndex = serviceId => {
    const match = String(serviceId || '').match(/:service:(\d+)$/);
    return match ? Number(match[1]) : 0;
  };

  const parseBreedIndex = breedId => {
    const match = String(breedId || '').match(/:breed:(\d+)$/);
    return match ? Number(match[1]) : 0;
  };

  const resolveStandardDuration = (categoryId, serviceIndex) => {
    const durations = CATEGORY_DURATION_MINUTES[categoryId] || [];
    return durations[serviceIndex] || durations[durations.length - 1] || 120;
  };

  const getExtraMinutes = (values, key) => {
    const value = values?.[key];
    return Number.isFinite(value) ? value : 0;
  };

  const resolveTiming = ({ categoryId, serviceIndex = 0, breedIndex = 0, clientType = 'new', coatCondition = 'good', behavior = 'calm' } = {}) => {
    const standardMinutes = resolveStandardDuration(categoryId, serviceIndex);
    const isAdditionalService = categoryId === 'additional-services';
    const firstVisitExtraMinutes = clientType === 'returning'
      ? 0
      : isAdditionalService
        ? 15
        : BOOKING_SCHEDULE.firstVisitExtraMinutes;
    const coatExtraMinutes = getExtraMinutes(COAT_CONDITION_EXTRA_MINUTES, coatCondition);
    const behaviourExtraMinutes = getExtraMinutes(BEHAVIOUR_EXTRA_MINUTES, behavior);
    const sizeExtraMinutes = categoryId === 'short-haired' && breedIndex >= 2 ? 30 : 0;
    const bufferMinutes = isAdditionalService ? 15 : BOOKING_SCHEDULE.defaultBufferMinutes;
    const estimatedMinutes = standardMinutes + firstVisitExtraMinutes + sizeExtraMinutes + coatExtraMinutes + behaviourExtraMinutes;

    return {
      standardMinutes,
      estimatedMinutes,
      bufferMinutes,
      safeBlockMinutes: estimatedMinutes + bufferMinutes,
      firstVisitExtraMinutes,
      sizeExtraMinutes,
      coatExtraMinutes,
      behaviourExtraMinutes,
      slotStepMinutes: BOOKING_SCHEDULE.slotStepMinutes,
    };
  };

  const formatMinutesAsTime = minutes => {
    const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
    const remainder = String(minutes % 60).padStart(2, '0');
    return `${hours}:${remainder}`;
  };

  const parseIsoDateParts = isoDate => {
    const match = String(isoDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? match.slice(1).map(Number) : null;
  };

  const toLocalDateTime = (isoDate, minutes) => {
    const parts = parseIsoDateParts(isoDate);
    if (!parts) return null;
    return new Date(parts[0], parts[1] - 1, parts[2], Math.floor(minutes / 60), minutes % 60, 0, 0);
  };

  const normalizeBusyIntervals = busyIntervals => (Array.isArray(busyIntervals) ? busyIntervals : [])
    .map(interval => {
      const start = Date.parse(interval?.start || '');
      const end = Date.parse(interval?.end || '');
      return Number.isFinite(start) && Number.isFinite(end) && end > start ? { start, end } : null;
    })
    .filter(Boolean);

  const getAvailableStartTimes = (isoDate, timing, busyIntervals = [], { calendarConfigured = false, now = new Date() } = {}) => {
    const dateParts = parseIsoDateParts(isoDate);
    if (!dateParts || !timing?.safeBlockMinutes) return [];

    const busy = normalizeBusyIntervals(busyIntervals);
    const lastStart = BOOKING_SCHEDULE.workdayEndMinutes - timing.safeBlockMinutes;
    if (lastStart < BOOKING_SCHEDULE.workdayStartMinutes) return [];

    const todayKey = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    const starts = [];
    const step = calendarConfigured ? timing.slotStepMinutes : timing.safeBlockMinutes;

    for (let minutes = BOOKING_SCHEDULE.workdayStartMinutes; minutes <= lastStart; minutes += step) {
      const start = toLocalDateTime(isoDate, minutes);
      const end = toLocalDateTime(isoDate, minutes + timing.safeBlockMinutes);
      if (!start || !end) continue;
      if (isoDate === todayKey && start.getTime() <= now.getTime()) continue;

      const overlaps = busy.some(interval => interval.start < end.getTime() && interval.end > start.getTime());
      if (!overlaps) starts.push(formatMinutesAsTime(minutes));
    }

    return starts;
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
        standardDurationMinutes: resolveStandardDuration(category.id, index),
        bufferMinutes: category.id === 'additional-services' ? 15 : BOOKING_SCHEDULE.defaultBufferMinutes,
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

    const getTiming = ({ categoryId, breedId = '', serviceId = '', clientType = 'new', coatCondition = 'good', behavior = 'calm' } = {}) =>
      resolveTiming({
        categoryId,
        serviceIndex: parseServiceIndex(serviceId),
        breedIndex: parseBreedIndex(breedId),
        clientType,
        coatCondition,
        behavior,
      });

    return {
      categories,
      breeds: categories.flatMap(category => category.breeds),
      getBreed,
      getCategory,
      getServices,
      resolveQuote,
      getTiming,
      getAvailableStartTimes,
      schedule: BOOKING_SCHEDULE,
    };
  };

  global.PriceBookingCatalog = { build };
})(window);
