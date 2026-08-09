(function initPricePage(global) {
  const catalog = global.PricePageCatalog;
  if (!catalog) return;

  const root = document.querySelector('[data-price-page]') || document.querySelector('body.price-page .container.page-offset-top');
  const modal = document.querySelector('[data-price-modal]');

  if (!root || !modal) return;

  const lang = (() => {
    const value = document.documentElement.lang || 'en';
    return ['de', 'en', 'ru', 'uk'].includes(value) ? value : 'en';
  })();

  const locale = catalog.locales[lang] || catalog.locales.en;
  const sourceCategories = catalog.categoriesByLocale?.[lang] || catalog.categories;
  const bookingCatalog = global.PriceBookingCatalog?.build?.(lang) || null;
  const escapeHtml = value =>
    String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

  const getText = value => {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    return value[lang] || value.en || value.de || value.ru || value.uk || '';
  };

  const sectionOrder = ['small', 'medium', 'large', 'cats', 'smallAnimals', 'additional', 'important', 'other'];

  const createCategoryViews = () => {
    const views = [];
    const sectionCounters = {};

    sourceCategories.forEach(category => {
      const groups = category.sizeGroups
        ? Object.entries(category.sizeGroups)
        : [[category.pageSection || 'other', {}]];

      groups.forEach(([groupKey, definition]) => {
        const breedIndexes = definition.breedIndexes || (category.breeds?.[lang] || []).map((_, index) => index);
        const priceIndexes = definition.priceIndexes || (category.priceRows || []).map((_, index) => index);
        const localizedBreeds = Object.fromEntries(
          Object.entries(category.breeds || {}).map(([localeKey, breeds]) => [
            localeKey,
            breeds.filter((_, index) => breedIndexes.includes(index)),
          ])
        );
        const title = getText(category.title).replace(/^\d+\.\s*/, '');
        sectionCounters[groupKey] = (sectionCounters[groupKey] || 0) + 1;
        const cardNumber = sectionCounters[groupKey];

        views.push({
          ...category,
          id: category.sizeGroups ? `${category.id}--${groupKey}` : category.id,
          sourceId: category.id,
          groupKey,
          breedIndexes,
          priceIndexes,
          title,
          cardNumber,
          modalTitle: `${cardNumber}. ${title}`,
          breeds: localizedBreeds,
          priceRows: (category.priceRows || []).filter((_, index) => priceIndexes.includes(index)),
        });
      });
    });

    return views;
  };

  const categoryViews = createCategoryViews();

  const ensurePageShell = () => {
    if (root.querySelector('[data-price-categories]') && root.querySelector('[data-price-hero]')) {
      return root;
    }

    root.innerHTML = `
      <section class="price-page-hero" data-price-hero></section>
      <section class="price-categories-grid" data-price-categories></section>
    `;

    return root;
  };

  const pageShell = ensurePageShell();
  const cardsRoot = pageShell.querySelector('[data-price-categories]');
  const heroRoot = pageShell.querySelector('[data-price-hero]');

  if (!cardsRoot || !heroRoot) return;

  const renderHero = () => {
    heroRoot.innerHTML = `
      <p class="section-kicker">${escapeHtml(locale.heroKicker)}</p>
      <h1 class="section-title">${escapeHtml(locale.heroTitle)}</h1>
      <p class="price-page-hero__lead">${escapeHtml(locale.heroLead)}</p>
      <p class="price-page-hero__note">${escapeHtml(locale.heroNote)}</p>
      <div class="price-breed-search" data-price-breed-search>
        <label class="price-breed-search__label" for="price-breed-search-input">${escapeHtml(locale.searchLabel || 'Поиск породы')}</label>
        <div class="price-breed-search__control">
          <span class="price-breed-search__icon" aria-hidden="true">⌕</span>
          <input id="price-breed-search-input" class="price-breed-search__input" type="search" autocomplete="off" role="combobox" aria-autocomplete="list" aria-controls="price-breed-search-suggestions" aria-expanded="false" data-price-breed-search-input placeholder="${escapeHtml(locale.searchPlaceholder || 'Например, шпиц или пудель')}" />
          <button type="button" class="price-breed-search__clear" data-price-breed-search-clear aria-label="${escapeHtml(locale.searchClear || 'Очистить поиск')}" hidden>&times;</button>
        </div>
        <div class="price-breed-search__suggestions" data-price-breed-search-suggestions hidden>
          <p class="price-breed-search__suggestions-title" data-price-breed-search-suggestions-title>${escapeHtml(locale.searchSuggestionsLabel || 'Possible breeds')}</p>
          <ul class="price-breed-search__suggestions-list" id="price-breed-search-suggestions" role="listbox" data-price-breed-search-suggestions-list></ul>
        </div>
        <p class="price-breed-search__status" data-price-breed-search-status aria-live="polite"></p>
      </div>
    `;
  };

  const parsePriceAmount = price => {
    const normalized = String(price || '').replace(',', '.');
    if (!/(?:€|\beur\b|\b(?:ab|from|от|від)\b)/i.test(normalized)) return null;
    const match = normalized.match(/(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : null;
  };

  const formatFromAmount = amount => {
    const value = Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/\.00$/, '');
    if (lang === 'de') return `ab ${value} €`;
    if (lang === 'en') return `from €${value}`;
    if (lang === 'uk') return `від ${value} €`;
    return `от ${value} €`;
  };

  const primaryPrice = category => {
    const amounts = (category.priceRows || [])
      .map(row => parsePriceAmount(getText(row.price)))
      .filter(Number.isFinite);
    return amounts.length ? formatFromAmount(Math.min(...amounts)) : locale.noPriceLabel;
  };

  const formatBreedCount = count => {
    const value = Number(count) || 0;
    if (lang === 'ru') {
      const mod10 = value % 10;
      const mod100 = value % 100;
      const word = mod10 === 1 && mod100 !== 11 ? 'порода' : mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20) ? 'породы' : 'пород';
      return { word, value };
    }
    if (lang === 'uk') {
      const mod10 = value % 10;
      const mod100 = value % 100;
      const word = mod10 === 1 && mod100 !== 11 ? 'порода' : mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20) ? 'породи' : 'порід';
      return { word, value };
    }
    if (lang === 'de') return { word: value === 1 ? 'Rasse' : 'Rassen', value };
    return { word: value === 1 ? 'Breed' : 'Breeds', value };
  };

  const ADDITIONAL_CATEGORY_ID = 'ru-additional-services';
  const DOG_CATEGORY_IDS = new Set([
    'ru-small-growing-coat',
    'ru-poodles-bichons',
    'ru-spitz',
    'ru-double-coat',
    'ru-spaniels',
    'ru-wire-coat',
    'ru-short-coat',
    'ru-large-dogs',
  ]);
  const additionalServiceIndexesByGroup = {
    small: [0, 3, 4, 5, 6],
    medium: [1, 4, 5, 6],
    large: [2, 4, 5, 6],
  };

  const getAdditionalServices = category => {
    if (!bookingCatalog || !category) return [];
    const sourceCategoryId = category.sourceId || category.id;
    const services = bookingCatalog.getServices(ADDITIONAL_CATEGORY_ID);
    if (sourceCategoryId === ADDITIONAL_CATEGORY_ID) return [];
    if (!DOG_CATEGORY_IDS.has(sourceCategoryId)) return [];
    const allowedIndexes = additionalServiceIndexesByGroup[category.groupKey] || [];
    return services.filter(service => allowedIndexes.includes(service.index));
  };

  const getAdditionalServiceNotes = category => {
    const notes = [locale.additionalServicesGeneralNote];
    const groupNote = locale[`additionalServices${category?.groupKey ? `${category.groupKey[0].toUpperCase()}${category.groupKey.slice(1)}` : ''}Note`];
    if (groupNote) notes.unshift(groupNote);
    return notes.filter(Boolean);
  };

  const renderCard = category => {
    const allBreeds = category.breeds?.[lang] || category.breeds?.en || [];
    const serviceRows = category.priceRows || [];
    const additionalServices = getAdditionalServices(category);
    const additionalServicesLabel = locale.additionalServicesLabel || locale.sizeGroupTitles?.additional || 'Additional services';
    const additionalServicesPrice = locale.noPriceLabel || locale.priceOnRequestLabel || '';
    const cardTitle = `${category.cardNumber}. ${getText(category.title)}`;
    const breedMenuId = `price-breed-menu-${category.id}`;
    const breedListId = `price-breeds-${category.id}`;
    const breedCount = allBreeds.length;
    const breedCountText = formatBreedCount(breedCount);

    return `
      <article class="price-card" data-category-id="${escapeHtml(category.id)}">
        <div class="price-card__top">
          <div class="price-card__breed-control">
            <button type="button" class="price-card__badge price-card__badge--button" data-price-breeds-toggle="${escapeHtml(breedMenuId)}" aria-expanded="false" aria-controls="${escapeHtml(breedMenuId)}" aria-label="${escapeHtml(locale.showBreedsLabel || locale.cardCountSuffix)}">
              <span class="price-card__badge-count"><span class="price-card__badge-word">${escapeHtml(breedCountText.word)}:</span><span class="price-card__badge-number">${escapeHtml(breedCountText.value)}</span></span>
              <span class="price-card__badge-icon" aria-hidden="true">⌄</span>
            </button>
            <div class="price-card__breed-menu" id="${escapeHtml(breedMenuId)}" hidden>
              <p class="price-card__breed-menu-title">${escapeHtml(locale.chooseBreedLabel || locale.cardCountSuffix)}</p>
              <ul class="price-card__breed-list" id="${escapeHtml(breedListId)}">
                ${allBreeds
                  .map((item, index) => {
                    const sourceIndex = category.breedIndexes?.[index] ?? index;
                    return `<li><button type="button" class="price-card__breed-option" data-price-breed-select data-price-breed-index="${escapeHtml(sourceIndex)}">${escapeHtml(item)}</button></li>`;
                  })
                  .join('')}
              </ul>
            </div>
          </div>
          <h2 class="price-card__title">${escapeHtml(cardTitle)}</h2>
          <p class="price-card__summary">${escapeHtml(getText(category.summary))}</p>
        </div>
        <div class="price-card__meta">
          <div class="price-card__price-label">${escapeHtml(locale.pricesLabel || locale.pricesTitle)}</div>
          <div class="price-card__price">${escapeHtml(primaryPrice(category))}</div>
        </div>
        <div class="price-card__service-options" role="group" aria-label="${escapeHtml(locale.servicesTitle)}">
          ${serviceRows
            .map((row, index) => {
              const sourceIndex = category.priceIndexes?.[index] ?? index;
              const label = getText(row.label);
              const price = getText(row.price);
              return `<button type="button" class="price-card__service-option" data-price-service-select data-price-service-index="${escapeHtml(sourceIndex)}" aria-label="${escapeHtml(`${label}${price ? ` — ${price}` : ''}`)}"><span class="price-card__service-option-label">${escapeHtml(label)}</span><span class="price-card__service-option-price">${escapeHtml(price)}</span></button>`;
            })
            .join('')}
          ${additionalServices.length ? `<button type="button" class="price-card__service-option price-card__service-option--additional" data-price-additional-select aria-label="${escapeHtml(`${additionalServicesLabel}${additionalServicesPrice ? ` — ${additionalServicesPrice}` : ''}`)}"><span class="price-card__service-option-label">${escapeHtml(additionalServicesLabel)}</span><span class="price-card__service-option-price">${escapeHtml(additionalServicesPrice)}</span></button>` : ''}
        </div>
        <div class="price-card__footer">
          <button type="button" class="price-card__cta btn-neon" data-price-open="${escapeHtml(category.id)}">
            ${escapeHtml(locale.cardLabel)}
          </button>
        </div>
      </article>
    `;
  };

  const modalTitle = modal.querySelector('[data-price-modal-title]');
  const modalKicker = modal.querySelector('[data-price-modal-kicker]');
  const modalSummary = modal.querySelector('[data-price-modal-summary]');
  const modalBreedsLabel = modal.querySelector('[data-price-modal-label-breeds]');
  const modalServicesLabel = modal.querySelector('[data-price-modal-label-services]');
  const modalPricesLabel = modal.querySelector('[data-price-modal-label-prices]');
  const modalNotesLabel = modal.querySelector('[data-price-modal-label-notes]');
  const modalPriceHeadService = modal.querySelector('[data-price-modal-price-head-service]');
  const modalPriceHeadValue = modal.querySelector('[data-price-modal-price-head-value]');
  const modalBreeds = modal.querySelector('[data-price-modal-breeds]');
  const modalServices = modal.querySelector('[data-price-modal-services]');
  const modalPrices = modal.querySelector('[data-price-modal-prices]');
  const modalNotes = modal.querySelector('[data-price-modal-notes]');
  const modalBooking = modal.querySelector('[data-price-modal-booking]');
  const modalClose = modal.querySelector('[data-price-modal-close]');
  const legacyDetails = modal.querySelector('.price-category-modal__grid');
  const legacyPrices = modal.querySelector('.price-category-modal__panel--prices');

  modal.classList.add('price-category-modal--compact');
  legacyDetails?.classList.add('price-category-modal__legacy');
  legacyPrices?.classList.add('price-category-modal__legacy');

  const modalSelection = document.createElement('section');
  modalSelection.className = 'price-category-modal__selection';
  modalSelection.innerHTML = `
    <div class="price-category-modal__selection-head">
      <p class="price-category-modal__selection-title">${escapeHtml(locale.chooseBreedLabel || 'Select a breed')}</p>
      <p class="price-category-modal__breed-context" data-price-modal-breed-context></p>
    </div>
    <label class="price-category-modal__selection-field">
      <span>${escapeHtml(locale.breedSelectLabel || 'Choose breed')}</span>
      <select data-price-modal-breed></select>
    </label>
    <fieldset class="price-category-modal__service-fieldset">
      <legend data-price-modal-service-legend>${escapeHtml(locale.selectServicesLabel || locale.serviceSelectLabel || 'Choose a service')}</legend>
      <p class="price-category-modal__service-hint" data-price-modal-service-hint></p>
      <div class="price-category-modal__service-options" data-price-modal-service-options></div>
    </fieldset>
    <div class="price-category-modal__calculation" aria-live="polite">
      <p class="price-category-modal__calculation-label" data-price-modal-calculation-label>${escapeHtml(locale.calculationLabel || 'Calculation')}</p>
      <p class="price-category-modal__selection-price" data-price-modal-selected-price></p>
      <ul class="price-category-modal__breakdown" data-price-modal-breakdown></ul>
      <p class="price-category-modal__calculation-note" data-price-modal-calculation-note></p>
    </div>
    <div class="price-category-modal__available">
      <p class="price-category-modal__available-label" data-price-modal-available-label>${escapeHtml(locale.availableServicesLabel || 'Possible services')}</p>
      <div class="price-category-modal__available-services" data-price-modal-available-services></div>
    </div>
  `;
  modalSummary?.insertAdjacentElement('afterend', modalSelection);
  const modalBreedSelect = modalSelection.querySelector('[data-price-modal-breed]');
  const modalBreedContext = modalSelection.querySelector('[data-price-modal-breed-context]');
  const modalServiceHint = modalSelection.querySelector('[data-price-modal-service-hint]');
  const modalServiceLegend = modalSelection.querySelector('[data-price-modal-service-legend]');
  const modalServiceOptions = modalSelection.querySelector('[data-price-modal-service-options]');
  const modalSelectedPrice = modalSelection.querySelector('[data-price-modal-selected-price]');
  const modalBreakdown = modalSelection.querySelector('[data-price-modal-breakdown]');
  const modalCalculationNote = modalSelection.querySelector('[data-price-modal-calculation-note]');
  const modalAvailableServices = modalSelection.querySelector('[data-price-modal-available-services]');

  const modalCopy = {
    title: locale.modalTitle,
    breedsTitle: locale.breedsTitle,
    servicesTitle: locale.servicesTitle,
    pricesTitle: locale.pricesTitle,
    notesTitle: locale.notesTitle,
    priceItemLabel: locale.priceItemLabel,
    priceValueLabel: locale.priceValueLabel,
    bookingLabel: locale.bookingLabel,
    closeLabel: locale.closeLabel,
  };

  const updateModalQuote = (category, services) => {
    if (!bookingCatalog || !modalBreedSelect || !modalSelectedPrice || !modalBooking) return;
    const sourceCategoryId = category.sourceId || category.id;
    const selectedBreed = bookingCatalog.getBreed(modalBreedSelect.value);
    const selectedInputs = Array.from(modalServiceOptions?.querySelectorAll('input[type="checkbox"]:checked') || []);
    const selectedServices = services.filter(service => selectedInputs.some(input => input.value === service.id));
    const amounts = selectedServices.map(service => parsePriceAmount(service.price));
    const hasRequestPrice = amounts.some(amount => amount === null);
    const totalAmount = amounts.reduce((sum, amount) => sum + (amount || 0), 0);
    const priceText = !selectedServices.length
      ? locale.chooseServiceLabel || locale.selectServicesLabel || 'Choose a service'
      : hasRequestPrice
        ? locale.priceOnRequestLabel || locale.noPriceLabel
        : selectedServices.length === 1
          ? selectedServices[0].price
          : formatFromAmount(totalAmount);

    if (modalSelectedPrice) {
      modalSelectedPrice.textContent = `${locale.selectedPriceLabel || locale.calculationLabel || 'Price'}: ${priceText}`;
    }
    if (modalBreakdown) {
      modalBreakdown.innerHTML = selectedServices
        .map(service => `<li><span>${escapeHtml(service.label)}</span><strong>${escapeHtml(service.price || locale.priceOnRequestLabel || locale.noPriceLabel)}</strong></li>`)
        .join('');
    }
    if (modalCalculationNote) {
      modalCalculationNote.textContent = !selectedServices.length || hasRequestPrice
        ? locale.calculationNote || ''
        : selectedServices.length > 1
          ? `${locale.calculationNote || ''} ${locale.totalFromLabel || ''}: ${formatFromAmount(totalAmount)}.`
          : locale.calculationNote || '';
    }
    const firstService = selectedServices[0];
    modalBooking.classList.add('online-order-btn');
    modalBooking.textContent = locale.bookSelectionLabel || locale.bookingLabel;
    modalBooking.dataset.bookingCategory = sourceCategoryId;
    modalBooking.dataset.bookingBreed = selectedBreed?.id || modalBreedSelect.value;
    modalBooking.dataset.bookingService = firstService?.id || '';
    modalBooking.dataset.bookingServices = selectedServices.map(service => service.id).join(',');
    modalBooking.dataset.bookingServiceLabel = selectedServices.map(service => service.label).join(' + ');
    modalBooking.dataset.bookingPrice = priceText;
    modalBooking.setAttribute('aria-disabled', String(!selectedServices.length));
    modalBooking.tabIndex = selectedServices.length ? 0 : -1;
    modalBooking.classList.toggle('is-disabled', !selectedServices.length);
  };

  const updateModalBookingSelection = (category, preferredBreedIndex = null, preferredServiceIndex = null, selectionMode = 'primary') => {
    if (!bookingCatalog || !modalBreedSelect || !modalServiceOptions || !modalSelectedPrice || !modalBooking) return;
    const sourceCategoryId = category.sourceId || category.id;
    const bookingCategory = bookingCatalog.getCategory(sourceCategoryId);
    if (!bookingCategory) return;
    const isAdditionalSelection = selectionMode === 'additional';

    if (modalBreedSelect.dataset.categoryId !== category.id) {
      modalBreedSelect.replaceChildren();
      modalBreedSelect.dataset.categoryId = category.id;
      const breedIndexes = new Set(category.breedIndexes || bookingCategory.breeds.map(breed => breed.index));
      bookingCategory.breeds.filter(breed => breedIndexes.has(breed.index)).forEach(breed => {
        const option = document.createElement('option');
        option.value = breed.id;
        option.textContent = breed.label;
        modalBreedSelect.appendChild(option);
      });
    }

    if (Number.isInteger(preferredBreedIndex)) {
      const preferredBreedId = `${sourceCategoryId}:breed:${preferredBreedIndex}`;
      if (Array.from(modalBreedSelect.options).some(option => option.value === preferredBreedId)) {
        modalBreedSelect.value = preferredBreedId;
      }
    }

    const selectedBreed = bookingCatalog.getBreed(modalBreedSelect.value);
    const serviceIndexes = new Set(category.priceIndexes || bookingCategory.services.map(service => service.index));
    const services = isAdditionalSelection
      ? getAdditionalServices(category)
      : bookingCatalog
        .getServices(sourceCategoryId, modalBreedSelect.value)
        .filter(service => serviceIndexes.has(service.index));
    const allowMultiple = isAdditionalSelection || sourceCategoryId === ADDITIONAL_CATEGORY_ID;

    if (modalBreedContext) {
      modalBreedContext.textContent = selectedBreed
        ? `${locale.breedContextLabel || 'Selected breed'}: ${selectedBreed.label}`
        : '';
    }
    if (modalSummary) {
      modalSummary.textContent = selectedBreed
        ? `${selectedBreed.label} — ${getText(category.summary)}${isAdditionalSelection ? ` — ${locale.additionalServicesLabel || ''}` : ''}`
        : getText(category.summary);
    }
    if (modalServiceLegend) {
      modalServiceLegend.textContent = isAdditionalSelection
        ? locale.selectAdditionalServicesLabel || locale.selectServicesLabel || locale.serviceSelectLabel || 'Choose additional services'
        : locale.selectServicesLabel || locale.serviceSelectLabel || 'Choose a service';
    }
    if (modalServiceHint) {
      modalServiceHint.textContent = allowMultiple
        ? locale.multipleServicesHint || ''
        : locale.singleServiceHint || '';
    }
    if (modalAvailableServices) {
      const availableServices = isAdditionalSelection
        ? services.map(service => `${service.label} — ${service.price || locale.noPriceLabel || ''}`)
        : (category.services || [])
          .map(serviceKey => getText(catalog.serviceLabels[serviceKey]))
          .filter(Boolean);
      modalAvailableServices.innerHTML = availableServices
        .map(service => `<span>${escapeHtml(service)}</span>`)
        .join('');
      modalAvailableServices.parentElement.hidden = !availableServices.length;
    }

    modalServiceOptions.replaceChildren();
    services.forEach((service, index) => {
      const id = `price-modal-service-${category.id}-${service.index}`;
      const label = document.createElement('label');
      label.className = 'price-category-modal__service-option';
      const preferredServiceId = Number.isInteger(preferredServiceIndex)
        ? `${isAdditionalSelection ? ADDITIONAL_CATEGORY_ID : sourceCategoryId}:service:${preferredServiceIndex}`
        : '';
      const isChecked = preferredServiceId ? service.id === preferredServiceId : !isAdditionalSelection && index === 0;
      label.innerHTML = `
        <input type="checkbox" id="${escapeHtml(id)}" value="${escapeHtml(service.id)}" ${isChecked ? 'checked' : ''} />
        <span class="price-category-modal__service-option-check" aria-hidden="true"></span>
        <span class="price-category-modal__service-option-name">${escapeHtml(service.label)}</span>
        <strong>${escapeHtml(service.price || locale.priceOnRequestLabel || locale.noPriceLabel)}</strong>`;
      const input = label.querySelector('input');
      input?.addEventListener('change', () => {
        if (!allowMultiple && input.checked) {
          modalServiceOptions.querySelectorAll('input[type="checkbox"]').forEach(other => {
            if (other !== input) other.checked = false;
          });
        }
        updateModalQuote(category, services);
      });
      modalServiceOptions.appendChild(label);
    });

    updateModalQuote(category, services);
  };

  modalBreedSelect?.addEventListener('change', () => {
    const category = categoryViews.find(item => item.id === modalBreedSelect.dataset.categoryId);
    if (category) updateModalBookingSelection(category, null, null, modalBreedSelect.dataset.selectionMode || 'primary');
  });

  const bookingHref = catalog.bookingHref?.[lang] || 'onlayn-bronirovanie.html';
  if (modalBooking instanceof HTMLElement && modalBooking.tagName === 'A') {
    modalBooking.href = bookingHref;
  }
  if (modalKicker) modalKicker.textContent = modalCopy.title;
  if (modalBreedsLabel) modalBreedsLabel.textContent = modalCopy.breedsTitle;
  if (modalServicesLabel) modalServicesLabel.textContent = modalCopy.servicesTitle;
  if (modalPricesLabel) modalPricesLabel.textContent = modalCopy.pricesTitle;
  if (modalNotesLabel) modalNotesLabel.textContent = modalCopy.notesTitle;
  if (modalPriceHeadService) modalPriceHeadService.textContent = modalCopy.priceItemLabel;
  if (modalPriceHeadValue) modalPriceHeadValue.textContent = modalCopy.priceValueLabel;
  if (modalClose) modalClose.setAttribute('aria-label', modalCopy.closeLabel);

  const state = {
    activeCategory: null,
    lastFocus: null,
  };

  const closeModal = () => {
    if (!modal.classList.contains('active')) return;
    modal.classList.add('is-closing');
    window.setTimeout(() => {
      modal.classList.remove('active', 'is-closing');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('price-modal-open');
      state.lastFocus?.focus?.();
    }, 220);
  };

  const openModal = (category, preferredBreedIndex = null, preferredServiceIndex = null, selectionMode = 'primary') => {
    if (!category) return;
    state.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    state.activeCategory = category;
    const isAdditionalSelection = selectionMode === 'additional';
    const additionalServices = isAdditionalSelection ? getAdditionalServices(category) : [];
    const additionalServicesLabel = locale.additionalServicesLabel || locale.sizeGroupTitles?.additional || 'Additional services';

    modalTitle.textContent = isAdditionalSelection
      ? `${category.modalTitle || getText(category.title)} — ${additionalServicesLabel}`
      : category.modalTitle || getText(category.title);
    modalSummary.textContent = getText(category.summary);
    modalBreeds.innerHTML = (category.breeds?.[lang] || category.breeds?.en || [])
      .map(breed => `<li class="price-modal__block">${escapeHtml(breed)}</li>`)
      .join('');
    modalServices.innerHTML = isAdditionalSelection
      ? additionalServices.map(service => `<li>${escapeHtml(service.label)}</li>`).join('')
      : (category.services || [])
        .map(serviceKey => `<li>${escapeHtml(getText(catalog.serviceLabels[serviceKey]))}</li>`)
        .join('');
    modalPrices.innerHTML = isAdditionalSelection
      ? additionalServices
        .map(service => `<tr><td>${escapeHtml(service.label)}</td><td>${escapeHtml(service.price || locale.noPriceLabel || '')}</td></tr>`)
        .join('')
      : (category.priceRows || [])
        .map(
          row => `
            <tr>
              <td>${escapeHtml(getText(row.label))}</td>
              <td>${escapeHtml(getText(row.price))}</td>
            </tr>`
        )
        .join('');
    modalNotes.innerHTML = (isAdditionalSelection ? getAdditionalServiceNotes(category) : category.notes || [])
      .map(note => `<li>${escapeHtml(getText(note))}</li>`)
      .join('');

    modalBreedSelect.dataset.selectionMode = selectionMode;
    updateModalBookingSelection(category, preferredBreedIndex, preferredServiceIndex, selectionMode);

    modalBooking.textContent = locale.bookSelectionLabel || modalCopy.bookingLabel;
    modal.classList.remove('is-closing');
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('price-modal-open');

    window.requestAnimationFrame(() => {
      modalClose?.focus?.();
    });
  };

  renderHero();
  const searchInput = heroRoot.querySelector('[data-price-breed-search-input]');
  const searchClear = heroRoot.querySelector('[data-price-breed-search-clear]');
  const searchSuggestions = heroRoot.querySelector('[data-price-breed-search-suggestions]');
  const searchSuggestionsList = heroRoot.querySelector('[data-price-breed-search-suggestions-list]');
  const searchStatus = heroRoot.querySelector('[data-price-breed-search-status]');
  const SEARCH_MIN_CHARS = 2;

  const normalizeSearch = value => String(value || '')
    .toLocaleLowerCase(lang)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const normalizeBreedTokens = value => normalizeSearch(value).split(/[\s/–—-]+/u).filter(Boolean);

  const breedSearchMatches = categoryViews.flatMap(category =>
    (category.breeds?.[lang] || category.breeds?.en || []).map((label, index) => ({
      id: `${category.id}:${category.breedIndexes?.[index] ?? index}`,
      label,
      normalizedTokens: normalizeBreedTokens(label),
      categoryId: category.id,
      breedIndex: category.breedIndexes?.[index] ?? index,
      categoryLabel: getText(category.title),
      sectionLabel: locale.sizeGroupTitles?.[category.groupKey] || locale.servicesTitle,
    }))
  );

  const findBreedMatches = query => {
    const normalizedQuery = normalizeSearch(query);
    if (normalizedQuery.length < SEARCH_MIN_CHARS) return [];
    return breedSearchMatches.filter(match => match.normalizedTokens.some(token => token.startsWith(normalizedQuery)));
  };

  const closeBreedSuggestions = () => {
    if (searchSuggestions) searchSuggestions.hidden = true;
    searchInput?.setAttribute('aria-expanded', 'false');
  };

  const renderBreedSuggestions = query => {
    const normalizedQuery = normalizeSearch(query);
    const matches = findBreedMatches(query);
    if (searchSuggestionsList) {
      searchSuggestionsList.innerHTML = matches
        .map(
          match => `
            <li class="price-breed-search__suggestion-item">
              <button type="button" class="price-breed-search__suggestion" role="option" data-price-breed-result data-price-breed-result-category="${escapeHtml(match.categoryId)}" data-price-breed-result-index="${escapeHtml(match.breedIndex)}">
                <span class="price-breed-search__suggestion-name">${escapeHtml(match.label)}</span>
                <span class="price-breed-search__suggestion-category">${escapeHtml(match.sectionLabel)} · ${escapeHtml(match.categoryLabel)}</span>
              </button>
            </li>`
        )
        .join('');
    }

    const hasSuggestions = normalizedQuery.length >= SEARCH_MIN_CHARS && matches.length > 0;
    if (searchSuggestions) searchSuggestions.hidden = !hasSuggestions;
    searchInput?.setAttribute('aria-expanded', String(hasSuggestions));
    return matches;
  };

  const renderSection = (sectionKey, views) => {
    const title = locale.sizeGroupTitles?.[sectionKey] || locale.servicesTitle;
    return `
      <section class="price-size-section" data-price-section="${escapeHtml(sectionKey)}">
        <div class="price-size-section__heading">
          <h2 class="price-size-section__title">${escapeHtml(title)}</h2>
        </div>
        <div class="price-size-section__cards">
          ${views.map(renderCard).join('')}
        </div>
      </section>
    `;
  };

  const renderCards = query => {
    const normalizedQuery = normalizeSearch(query);
    const isSearchActive = normalizedQuery.length >= SEARCH_MIN_CHARS;
    const matchingBreedIds = new Set(findBreedMatches(query).map(match => match.categoryId));
    const visibleCategories = isSearchActive
      ? categoryViews.filter(category => matchingBreedIds.has(category.id))
      : categoryViews;

    const sections = sectionOrder
      .map(sectionKey => renderSection(sectionKey, visibleCategories.filter(category => category.groupKey === sectionKey)))
      .filter(section => section.includes('price-card'))
      .join('');

    cardsRoot.innerHTML = visibleCategories.length
      ? sections
      : `<div class="price-breed-search__empty">${escapeHtml(locale.searchEmpty || 'Порода не найдена. Попробуйте другой запрос.')}</div>`;
    if (searchStatus) {
      if (!normalizedQuery) {
        searchStatus.textContent = '';
      } else if (!isSearchActive) {
        searchStatus.textContent = locale.searchMinChars || 'Enter at least 2 letters.';
      } else {
        const matches = findBreedMatches(query);
        searchStatus.textContent = matches.length
          ? `${locale.searchSuggestionsLabel || 'Possible breeds'}: ${matches.length}`
          : locale.searchEmpty || 'No matching breed found.';
      }
    }
    if (searchClear) searchClear.hidden = !normalizedQuery;
  };

  renderCards('');

  searchInput?.addEventListener('input', event => {
    const query = event.target.value;
    renderBreedSuggestions(query);
    renderCards(query);
  });
  searchClear?.addEventListener('click', () => {
    if (!searchInput) return;
    searchInput.value = '';
    closeBreedSuggestions();
    renderCards('');
    searchInput.focus();
  });

  searchInput?.addEventListener('focus', () => {
    if (normalizeSearch(searchInput.value).length >= SEARCH_MIN_CHARS) {
      renderBreedSuggestions(searchInput.value);
    }
  });
  searchInput?.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeBreedSuggestions();
  });

  heroRoot.addEventListener('click', event => {
    const result = event.target instanceof HTMLElement ? event.target.closest('[data-price-breed-result]') : null;
    if (!result) return;
    const categoryId = result.dataset.priceBreedResultCategory || '';
    const breedIndex = Number(result.dataset.priceBreedResultIndex);
    const match = breedSearchMatches.find(item => item.categoryId === categoryId && item.breedIndex === breedIndex);
    if (!match || !searchInput) return;

    searchInput.value = match.label;
    closeBreedSuggestions();
    renderCards(match.label);

    window.requestAnimationFrame(() => {
      const targetCard = Array.from(cardsRoot.querySelectorAll('[data-category-id]')).find(card => card.dataset.categoryId === match.categoryId);
      if (!targetCard) return;
      targetCard.dataset.selectedBreedIndex = String(match.breedIndex);
      targetCard.classList.add('price-card--search-target');
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetCard.querySelector('[data-price-service-select]')?.focus({ preventScroll: true });
      window.setTimeout(() => targetCard.classList.remove('price-card--search-target'), 2200);
    });

    if (searchStatus) searchStatus.textContent = `${locale.searchSelectedLabel || 'Selected breed'}: ${match.label}`;
  });

  document.addEventListener('click', event => {
    if (!(event.target instanceof Node) || !heroRoot.contains(event.target)) closeBreedSuggestions();
  });

  const positionBreedMenu = toggle => {
    const menu = document.getElementById(toggle.dataset.priceBreedsToggle || '');
    const control = toggle.closest('.price-card__breed-control');
    if (!menu || !control) return;

    const gap = 10;
    const edge = 8;
    const preferredLeft = toggle.offsetLeft + toggle.offsetWidth + gap;
    const availableRight = Math.max(0, control.clientWidth - preferredLeft - edge);
    const minWidth = 150;
    const maxWidth = Math.max(minWidth, Math.min(420, control.clientWidth - edge * 2));
    const menuWidth = Math.min(maxWidth, Math.max(minWidth, availableRight));
    const left = availableRight >= minWidth ? preferredLeft : edge;

    menu.style.left = `${left}px`;
    menu.style.right = 'auto';
    menu.style.width = `${Math.max(0, Math.min(menuWidth, control.clientWidth - left - edge))}px`;
  };

  const closeBreedMenu = toggle => {
    const breedMenu = document.getElementById(toggle.dataset.priceBreedsToggle || '');
    if (!breedMenu) return;
    breedMenu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', locale.showBreedsLabel || locale.cardCountSuffix);
    toggle.closest('.price-card')?.classList.remove('price-card--breeds-open');
  };

  cardsRoot.addEventListener('click', event => {
    const additionalOption = event.target instanceof HTMLElement ? event.target.closest('[data-price-additional-select]') : null;
    if (additionalOption) {
      const card = additionalOption.closest('[data-category-id]');
      const category = categoryViews.find(item => item.id === card?.dataset.categoryId);
      const selectedBreedIndex = Number(card?.dataset.selectedBreedIndex);
      const defaultBreedIndex = category?.breedIndexes?.[0] ?? 0;
      if (category) {
        openModal(category, Number.isInteger(selectedBreedIndex) ? selectedBreedIndex : defaultBreedIndex, null, 'additional');
      }
      return;
    }
    const serviceOption = event.target instanceof HTMLElement ? event.target.closest('[data-price-service-select]') : null;
    if (serviceOption) {
      const card = serviceOption.closest('[data-category-id]');
      const category = categoryViews.find(item => item.id === card?.dataset.categoryId);
      const serviceIndex = Number(serviceOption.dataset.priceServiceIndex);
      const selectedBreedIndex = Number(card?.dataset.selectedBreedIndex);
      const defaultBreedIndex = category?.breedIndexes?.[0] ?? 0;
      if (category && Number.isInteger(serviceIndex)) {
        openModal(category, Number.isInteger(selectedBreedIndex) ? selectedBreedIndex : defaultBreedIndex, serviceIndex);
      }
      return;
    }
    const breedOption = event.target instanceof HTMLElement ? event.target.closest('[data-price-breed-select]') : null;
    if (breedOption) {
      const card = breedOption.closest('[data-category-id]');
      const category = categoryViews.find(item => item.id === card?.dataset.categoryId);
      const breedIndex = Number(breedOption.dataset.priceBreedIndex);
      const toggle = card?.querySelector('[data-price-breeds-toggle]');
      if (toggle) closeBreedMenu(toggle);
      if (card && Number.isInteger(breedIndex)) card.dataset.selectedBreedIndex = String(breedIndex);
      if (category && Number.isInteger(breedIndex)) openModal(category, breedIndex);
      return;
    }
    const breedsToggle = event.target instanceof HTMLElement ? event.target.closest('[data-price-breeds-toggle]') : null;
    if (breedsToggle) {
      const breedMenu = document.getElementById(breedsToggle.dataset.priceBreedsToggle || '');
      if (!breedMenu) return;
      const expanded = breedsToggle.getAttribute('aria-expanded') === 'true';
      if (expanded) {
        closeBreedMenu(breedsToggle);
      } else {
        cardsRoot.querySelectorAll('[data-price-breeds-toggle][aria-expanded="true"]').forEach(otherToggle => {
          if (otherToggle !== breedsToggle) closeBreedMenu(otherToggle);
        });
        breedMenu.hidden = false;
        breedsToggle.setAttribute('aria-expanded', 'true');
        breedsToggle.setAttribute('aria-label', locale.hideBreedsLabel || locale.cardCountSuffix);
        breedsToggle.closest('.price-card')?.classList.add('price-card--breeds-open');
        positionBreedMenu(breedsToggle);
      }
      return;
    }
    const trigger = event.target instanceof HTMLElement ? event.target.closest('[data-price-open]') : null;
    if (!trigger) return;
    const category = categoryViews.find(item => item.id === trigger.dataset.priceOpen);
    openModal(category);
  });

  document.addEventListener('click', event => {
    if (event.target instanceof Node && cardsRoot.contains(event.target)) return;
    cardsRoot.querySelectorAll('[data-price-breeds-toggle][aria-expanded="true"]').forEach(closeBreedMenu);
  });

  window.addEventListener('resize', () => {
    cardsRoot.querySelectorAll('[data-price-breeds-toggle][aria-expanded="true"]').forEach(positionBreedMenu);
  });

  modalClose?.addEventListener('click', closeModal);
  modal.addEventListener('click', event => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });

  if (modalBooking) {
    modalBooking.addEventListener('click', () => {
      closeModal();
    });
  }
})(window);
