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
  const renderCurrencyText = value => {
    const rendered = global.NikaCurrency?.render?.(value) || escapeHtml(value ?? '');
    return rendered.replace(/(^|[^0-9A-Za-z_&#])(\d+(?:[.,]\d+)?)(?![0-9A-Za-z_])/g, '$1<span class="price-number">$2</span>');
  };

  const getText = value => {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    return value[lang] || value.en || value.de || value.ru || value.uk || '';
  };

  const sectionGroups = [
    { key: 'small', sourceKeys: ['small'] },
    { key: 'medium', sourceKeys: ['medium'] },
    {
      key: 'large',
      sourceKeys: ['large', 'cats', 'smallAnimals'],
      layout: 'category-row',
    },
    {
      key: 'additional',
      sourceKeys: ['additional', 'important'],
      grid: 'two',
      showHeading: false,
    },
    { key: 'other', sourceKeys: ['other'] },
  ];

  const createCategoryViews = () => {
    const views = [];
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
        const sourceTitle = getText(category.title);
        const title = sourceTitle.replace(/^\d+\.\s*/, '');

        views.push({
          ...category,
          id: category.sizeGroups ? `${category.id}--${groupKey}` : category.id,
          sourceId: category.id,
          groupKey,
          breedIndexes,
          priceIndexes,
          title,
          modalTitle: title,
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
  let breedMenuWheelBlocker = null;
  let breedMenuTouchBlocker = null;
  let breedMenuScrollTarget = null;
  let breedMenuScrollWheelHandler = null;
  let breedMenuScrollTouchHandler = null;
  let breedMenuScrollIndicatorScrollHandler = null;
  let breedMenuScrollIndicatorTimer = null;
  let breedMenuScrollRestoreHandler = null;
  let breedMenuScrollLockFrame = null;
  let savedBreedMenuScrollTop = 0;
  let priceModalWheelBlocker = null;
  let priceModalTouchBlocker = null;
  let priceModalScrollRestoreHandler = null;
  let savedPriceModalScrollTop = 0;

  const syncBreedMenuScrollIndicator = menu => {
    const track = menu?.querySelector('[data-price-breed-scrollbar]');
    const thumb = menu?.querySelector('[data-price-breed-scrollbar-thumb]');
    if (!track || !thumb) return;

    const hasOverflow = menu.scrollHeight > menu.clientHeight + 1;
    menu.classList.toggle('price-breed-menu--has-overflow', hasOverflow);
    if (!hasOverflow) {
      thumb.style.height = '0px';
      thumb.style.transform = 'translateY(0)';
      return;
    }

    const trackHeight = track.clientHeight;
    if (!trackHeight) return;

    const thumbHeight = Math.min(
      trackHeight,
      Math.max(32, Math.round(trackHeight * (menu.clientHeight / menu.scrollHeight)))
    );
    const maxThumbOffset = Math.max(0, trackHeight - thumbHeight);
    const maxScrollTop = Math.max(0, menu.scrollHeight - menu.clientHeight);
    const scrollTop = Math.min(maxScrollTop, Math.max(0, menu.scrollTop));
    const scrollProgress = maxScrollTop > 0 ? scrollTop / maxScrollTop : 0;

    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translate3d(0, ${Math.round(maxThumbOffset * scrollProgress)}px, 0)`;
  };

  const showBreedMenuScrollIndicator = menu => {
    if (!menu) return;
    syncBreedMenuScrollIndicator(menu);
    menu.classList.add('price-breed-menu--scrolling');
    if (breedMenuScrollIndicatorTimer) window.clearTimeout(breedMenuScrollIndicatorTimer);
    breedMenuScrollIndicatorTimer = window.setTimeout(() => {
      if (breedMenuScrollTarget === menu) menu.classList.remove('price-breed-menu--scrolling');
      breedMenuScrollIndicatorTimer = null;
    }, 900);
  };

  const setBreedMenuScrollLock = locked => {
    const scrollRoot = document.querySelector('.site-scroll-root');
    document.documentElement.classList.toggle('price-breed-menu-open', locked);
    document.body.classList.toggle('price-breed-menu-open', locked);
    scrollRoot?.classList.toggle('price-breed-menu-scroll-locked', locked);

    if (locked && !breedMenuScrollRestoreHandler) {
      savedBreedMenuScrollTop = scrollRoot?.scrollTop || 0;
      breedMenuScrollRestoreHandler = () => {
        if (scrollRoot && scrollRoot.scrollTop !== savedBreedMenuScrollTop) {
          scrollRoot.scrollTop = savedBreedMenuScrollTop;
        }
      };
      scrollRoot?.addEventListener('scroll', breedMenuScrollRestoreHandler, { passive: true });
      const keepScrollRootLocked = () => {
        breedMenuScrollRestoreHandler?.();
        if (breedMenuScrollRestoreHandler) {
          breedMenuScrollLockFrame = window.requestAnimationFrame(keepScrollRootLocked);
        }
      };
      breedMenuScrollLockFrame = window.requestAnimationFrame(keepScrollRootLocked);
    }

    if (locked && !breedMenuWheelBlocker) {
      breedMenuWheelBlocker = event => {
        const menu = event.target instanceof Element ? event.target.closest('.price-card__breed-menu') : null;
        if (menu) return;
        event.preventDefault();
        event.stopPropagation();
      };
      document.addEventListener('wheel', breedMenuWheelBlocker, { capture: true, passive: false });
    }

    if (locked && !breedMenuTouchBlocker) {
      breedMenuTouchBlocker = event => {
        const menu = event.target instanceof Element ? event.target.closest('.price-card__breed-menu') : null;
        if (menu) return;
        event.preventDefault();
        event.stopPropagation();
      };
      document.addEventListener('touchmove', breedMenuTouchBlocker, { capture: true, passive: false });
    }

    if (locked && !breedMenuScrollTarget) {
      breedMenuScrollTarget = document.querySelector('.price-card__breed-menu:not([hidden])');
      if (breedMenuScrollTarget) {
        breedMenuScrollWheelHandler = event => {
          const maxScroll = Math.max(0, breedMenuScrollTarget.scrollHeight - breedMenuScrollTarget.clientHeight);
          const nextScrollTop = Math.max(0, Math.min(maxScroll, breedMenuScrollTarget.scrollTop + event.deltaY));
          breedMenuScrollTarget.scrollTop = nextScrollTop;
          showBreedMenuScrollIndicator(breedMenuScrollTarget);
          event.preventDefault();
          event.stopPropagation();
        };
        breedMenuScrollTouchHandler = event => {
          showBreedMenuScrollIndicator(breedMenuScrollTarget);
          event.stopPropagation();
        };
        breedMenuScrollIndicatorScrollHandler = () => {
          const menu = breedMenuScrollTarget;
          if (!menu) return;
          window.requestAnimationFrame(() => {
            if (breedMenuScrollTarget === menu) showBreedMenuScrollIndicator(menu);
          });
        };
        breedMenuScrollTarget.addEventListener('wheel', breedMenuScrollWheelHandler, { passive: false });
        breedMenuScrollTarget.addEventListener('touchmove', breedMenuScrollTouchHandler, { passive: true });
        breedMenuScrollTarget.addEventListener('scroll', breedMenuScrollIndicatorScrollHandler, { passive: true });
        showBreedMenuScrollIndicator(breedMenuScrollTarget);
      }
    }

    if (!locked) {
      if (breedMenuScrollLockFrame) {
        window.cancelAnimationFrame(breedMenuScrollLockFrame);
        breedMenuScrollLockFrame = null;
      }
      if (breedMenuScrollRestoreHandler) {
        scrollRoot?.removeEventListener('scroll', breedMenuScrollRestoreHandler);
        if (scrollRoot) scrollRoot.scrollTop = savedBreedMenuScrollTop;
        breedMenuScrollRestoreHandler = null;
      }
      if (breedMenuWheelBlocker) {
        document.removeEventListener('wheel', breedMenuWheelBlocker, { capture: true });
        breedMenuWheelBlocker = null;
      }
      if (breedMenuTouchBlocker) {
        document.removeEventListener('touchmove', breedMenuTouchBlocker, { capture: true });
        breedMenuTouchBlocker = null;
      }
      if (breedMenuScrollTarget) {
        if (breedMenuScrollWheelHandler) breedMenuScrollTarget.removeEventListener('wheel', breedMenuScrollWheelHandler);
        if (breedMenuScrollTouchHandler) breedMenuScrollTarget.removeEventListener('touchmove', breedMenuScrollTouchHandler);
        if (breedMenuScrollIndicatorScrollHandler) breedMenuScrollTarget.removeEventListener('scroll', breedMenuScrollIndicatorScrollHandler);
        breedMenuScrollTarget.classList.remove('price-breed-menu--scrolling');
        breedMenuScrollTarget = null;
        breedMenuScrollWheelHandler = null;
        breedMenuScrollTouchHandler = null;
        breedMenuScrollIndicatorScrollHandler = null;
      }
      if (breedMenuScrollIndicatorTimer) {
        window.clearTimeout(breedMenuScrollIndicatorTimer);
        breedMenuScrollIndicatorTimer = null;
      }
    }
  };

  const setPriceModalScrollLock = locked => {
    const scrollRoot = document.querySelector('.site-scroll-root');
    document.documentElement.classList.toggle('price-modal-open', locked);
    document.body.classList.toggle('price-modal-open', locked);
    scrollRoot?.classList.toggle('price-modal-scroll-locked', locked);

    if (locked) {
      savedPriceModalScrollTop = scrollRoot?.scrollTop || 0;
      if (priceModalScrollRestoreHandler && scrollRoot) {
        scrollRoot.removeEventListener('scroll', priceModalScrollRestoreHandler);
      }
      priceModalScrollRestoreHandler = () => {
        if (scrollRoot && scrollRoot.scrollTop !== savedPriceModalScrollTop) {
          scrollRoot.scrollTop = savedPriceModalScrollTop;
        }
      };
      scrollRoot?.addEventListener('scroll', priceModalScrollRestoreHandler, { passive: true });

      priceModalWheelBlocker = event => {
        const content = event.target instanceof Element
          ? event.target.closest('#price-category-modal.active .modal-content, #client-registration-modal.active .client-registration-modal__content')
          : null;
        if (content && !event.ctrlKey && !event.metaKey) {
          const maxScroll = Math.max(0, content.scrollHeight - content.clientHeight);
          const delta = event.deltaY * (
            event.deltaMode === WheelEvent.DOM_DELTA_LINE
              ? 16
              : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
                ? content.clientHeight
                : 1
          );
          if (maxScroll > 0 && Math.abs(delta) > 0.01) {
            content.scrollTop = Math.max(0, Math.min(maxScroll, content.scrollTop + delta));
          }
        }
        event.preventDefault();
        event.stopPropagation();
      };
      priceModalTouchBlocker = event => {
        const content = event.target instanceof Element
          ? event.target.closest('#price-category-modal.active .modal-content, #client-registration-modal.active .client-registration-modal__content')
          : null;
        if (!content) event.preventDefault();
        event.stopPropagation();
      };
      document.addEventListener('wheel', priceModalWheelBlocker, { capture: true, passive: false });
      document.addEventListener('touchmove', priceModalTouchBlocker, { capture: true, passive: false });

      return;
    }

    if (priceModalScrollRestoreHandler) {
      scrollRoot?.removeEventListener('scroll', priceModalScrollRestoreHandler);
      priceModalScrollRestoreHandler = null;
    }
    if (scrollRoot) scrollRoot.scrollTop = savedPriceModalScrollTop;
    if (priceModalWheelBlocker) {
      document.removeEventListener('wheel', priceModalWheelBlocker, { capture: true });
      priceModalWheelBlocker = null;
    }
    if (priceModalTouchBlocker) {
      document.removeEventListener('touchmove', priceModalTouchBlocker, { capture: true });
      priceModalTouchBlocker = null;
    }
  };

  const bindModalWheelScroll = content => {
    if (!content || content.dataset.priceModalWheelBound === 'true') return;
    content.dataset.priceModalWheelBound = 'true';
    content.addEventListener(
      'wheel',
      event => {
        if (event.ctrlKey || event.metaKey) return;
        if (
          event.target instanceof Element
          && event.target.closest('select, textarea, [contenteditable="true"], .site-select__menu')
        ) {
          return;
        }

        const modal = content.closest('.modal');
        if (!modal?.classList.contains('active')) return;

        const maxScroll = Math.max(0, content.scrollHeight - content.clientHeight);
        const delta = event.deltaY * (
          event.deltaMode === WheelEvent.DOM_DELTA_LINE
            ? 16
            : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
              ? content.clientHeight
              : 1
        );
        if (maxScroll > 0 && Math.abs(delta) > 0.01) {
          content.scrollTop = Math.max(0, Math.min(maxScroll, content.scrollTop + delta));
        }
        event.preventDefault();
      },
      { passive: false }
    );
  };

  if (!cardsRoot || !heroRoot) return;

  if (!cardsRoot.id) cardsRoot.id = 'price-categories';

  const renderHero = () => {
    heroRoot.innerHTML = `
      <div class="price-page-hero__copy">
        <p class="section-kicker">${escapeHtml(locale.heroKicker)}</p>
        <h1 class="section-title">${escapeHtml(locale.heroTitle)}</h1>
        <div class="price-page-hero__intro">
          <div class="price-page-hero__intro-copy">
            <p class="price-page-hero__lead">${escapeHtml(locale.heroLead)}</p>
            <p class="price-page-hero__note">${escapeHtml(locale.heroNote)}</p>
          </div>
          <button
            type="button"
            class="price-page-hero__categories-action online-order-pill"
            data-nav-pill="price-categories-action"
            data-price-categories-action
            aria-controls="price-categories"
          >
            <span>${escapeHtml(locale.heroCategoriesAction || 'View categories')}</span>
            <span class="price-page-hero__categories-action-icon" aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      <div class="price-page-hero__search">
        <div class="price-page-hero__search-frame">
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
        </div>
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
  const IMPORTANT_CATEGORY_ID = 'ru-important-information';
  const DOG_CATEGORY_IDS = new Set([
    'ru-small-growing-coat',
    'ru-poodles-bichons',
    'ru-spitz',
    'ru-spaniels',
    'ru-wire-coat',
    'ru-short-coat',
    'ru-large-dogs',
  ]);
  const additionalServiceIndexesByGroup = {
    small: [0, 3, 4, 5, 6],
    medium: [1, 4, 5, 6],
    large: [2, 4, 5, 6],
    mixed: [0, 1, 2, 4, 5, 6],
  };

  const getAdditionalServices = category => {
    if (!bookingCatalog || !category) return [];
    const sourceCategoryId = category.sourceId || category.id;
    const services = bookingCatalog.getServices(ADDITIONAL_CATEGORY_ID);
    if (sourceCategoryId === ADDITIONAL_CATEGORY_ID) return services;
    if (!DOG_CATEGORY_IDS.has(sourceCategoryId)) return [];
    const serviceGroup = category.additionalServiceGroup || category.groupKey;
    const allowedIndexes = additionalServiceIndexesByGroup[serviceGroup] || [];
    return services.filter(service => allowedIndexes.includes(service.index));
  };

  const getAdditionalServiceNotes = category => {
    const notes = [locale.additionalServicesGeneralNote];
    const groupNote = locale[`additionalServices${category?.groupKey ? `${category.groupKey[0].toUpperCase()}${category.groupKey.slice(1)}` : ''}Note`];
    if (groupNote) notes.unshift(groupNote);
    return notes.filter(Boolean);
  };

  const renderCard = category => {
    const sourceCategoryId = category.sourceId || category.id;
    const isInformationCategory = sourceCategoryId === IMPORTANT_CATEGORY_ID;
    const isAdditionalCategory = sourceCategoryId === ADDITIONAL_CATEGORY_ID;
    const allBreeds = category.breeds?.[lang] || category.breeds?.en || [];
    const serviceRows = isInformationCategory ? [] : category.priceRows || [];
    const additionalServices = isAdditionalCategory
      ? []
      : getAdditionalServices(category);
    const additionalServicesLabel = locale.additionalServicesLabel || locale.sizeGroupTitles?.additional || 'Additional services';
    const additionalServicesPrice = locale.noPriceLabel || locale.priceOnRequestLabel || '';
    const cardTitle = getText(category.title);
    const breedMenuId = `price-breed-menu-${category.id}`;
    const breedListId = `price-breeds-${category.id}`;
    const breedCount = allBreeds.length;
    const breedCountText = isAdditionalCategory
      ? { word: locale.additionalCategoryCountLabel || locale.cardCountSuffix, value: breedCount }
      : formatBreedCount(breedCount);
    const cardMetaLabel = isInformationCategory
      ? locale.informationCardMetaLabel || locale.notesTitle
      : locale.pricesLabel || locale.pricesTitle;
    const cardPrice = isInformationCategory
      ? locale.informationCardMetaValue || locale.noPriceLabel
      : primaryPrice(category);
    const cardActionLabel = isInformationCategory
      ? locale.informationCardActionLabel || locale.cardLabel
      : isAdditionalCategory
        ? locale.additionalCardActionLabel || locale.cardLabel
        : locale.cardLabel;
    const cardBadge = isInformationCategory
      ? `<span class="price-card__badge price-card__badge--static">${escapeHtml(locale.informationCardBadge || locale.notesTitle || 'Rules')}</span>`
      : `<div class="price-card__breed-control">
          <button type="button" class="price-card__badge price-card__badge--button btn-neon" data-nav-pill="price-breed" data-price-breeds-toggle="${escapeHtml(breedMenuId)}" aria-expanded="false" aria-controls="${escapeHtml(breedMenuId)}" aria-label="${escapeHtml(isAdditionalCategory ? locale.additionalCategoryMenuLabel : locale.showBreedsLabel || locale.cardCountSuffix)}">
            <span class="price-card__badge-count"><span class="price-card__badge-word">${escapeHtml(breedCountText.word)}:</span><span class="price-card__badge-number price-number">${escapeHtml(breedCountText.value)}</span></span>
            <span class="price-card__badge-icon" aria-hidden="true">⌄</span>
          </button>
          <div class="price-card__breed-menu" id="${escapeHtml(breedMenuId)}" hidden>
            <p class="price-card__breed-menu-title">${escapeHtml(isAdditionalCategory ? locale.additionalCategoryMenuLabel : locale.chooseBreedLabel || locale.cardCountSuffix)}</p>
            <ul class="price-card__breed-list" id="${escapeHtml(breedListId)}">
              ${allBreeds
                .map((item, index) => {
                  const sourceIndex = category.breedIndexes?.[index] ?? index;
                  return `<li><button type="button" class="price-card__breed-option" data-price-breed-select data-price-breed-index="${escapeHtml(sourceIndex)}">${escapeHtml(item)}</button></li>`;
                })
                .join('')}
            </ul>
            <span class="price-card__breed-scrollbar" data-price-breed-scrollbar aria-hidden="true">
              <span class="price-card__breed-scrollbar-thumb" data-price-breed-scrollbar-thumb></span>
            </span>
          </div>
        </div>`;
    const informationPreview = isInformationCategory
      ? locale.informationCardPreview || locale.serviceConditions?.informationLead || ''
      : '';
    const informationHighlights = isInformationCategory ? locale.informationCardHighlights || [] : [];
    const serviceOptionsLabel = isInformationCategory
      ? locale.informationCardListLabel || locale.serviceConditions?.title || ''
      : locale.servicesTitle;

    return `
      <article class="price-card" data-category-id="${escapeHtml(category.id)}">
        <div class="price-card__top">
          ${cardBadge}
          <h2 class="price-card__title">${escapeHtml(cardTitle)}</h2>
          <p class="price-card__summary">${escapeHtml(getText(category.summary))}</p>
          ${informationPreview ? `
            <div class="price-card__information">
              <p class="price-card__information-label">${escapeHtml(locale.informationCardListLabel || locale.serviceConditions?.title || '')}</p>
              <p class="price-card__information-preview">${escapeHtml(informationPreview)}</p>
            </div>` : ''}
        </div>
        <div class="price-card__meta">
          <div class="price-card__price-label">${escapeHtml(cardMetaLabel)}</div>
          <div class="price-card__price">${renderCurrencyText(cardPrice)}</div>
        </div>
        <div class="price-card__service-options${isInformationCategory ? ' price-card__service-options--information' : ''}" role="group" aria-label="${escapeHtml(serviceOptionsLabel)}">
          ${serviceRows
            .map((row, index) => {
              const sourceIndex = category.priceIndexes?.[index] ?? index;
              const label = getText(row.label);
              const price = getText(row.price);
              return `<button type="button" class="price-card__service-option" data-price-service-select data-price-service-index="${escapeHtml(sourceIndex)}" aria-label="${escapeHtml(`${label}${price ? ` — ${price}` : ''}`)}"><span class="price-card__service-option-label"><span>${renderCurrencyText(label)}</span></span><span class="price-card__service-option-price">${renderCurrencyText(price)}</span></button>`;
            })
            .join('')}
          ${additionalServices.length ? `<button type="button" class="price-card__service-option price-card__service-option--additional" data-price-additional-select aria-label="${escapeHtml(`${additionalServicesLabel}${additionalServicesPrice ? ` — ${additionalServicesPrice}` : ''}`)}"><span class="price-card__service-option-label">${escapeHtml(additionalServicesLabel)}</span><span class="price-card__service-option-price">${renderCurrencyText(additionalServicesPrice)}</span></button>` : ''}
          ${informationHighlights.length ? `
            <div class="price-card__information-fill">
              <ul class="price-card__information-highlights">
                ${informationHighlights.map(highlight => `<li>${renderCurrencyText(highlight)}</li>`).join('')}
              </ul>
            </div>` : ''}
        </div>
        <div class="price-card__footer">
          <button type="button" class="price-card__cta btn-neon" data-price-open="${escapeHtml(category.id)}">
            ${escapeHtml(cardActionLabel)}
          </button>
        </div>
      </article>
    `;
  };

  const modalTitle = modal.querySelector('[data-price-modal-title]');
  const modalKicker = modal.querySelector('[data-price-modal-kicker]');
  const modalSummary = modal.querySelector('[data-price-modal-summary]');
  const modalBooking = modal.querySelector('[data-price-modal-booking]');
  const modalClose = modal.querySelector('[data-price-modal-close]');
  const modalContent = modal.querySelector('.price-category-modal__content');
  modalContent?.classList.add('price-category-modal--compact');
  bindModalWheelScroll(modalContent);

  const modalSelection = document.createElement('section');
  modalSelection.className = 'price-category-modal__selection';
  modalSelection.innerHTML = `
    <div class="price-category-modal__selection-controls" data-price-modal-selection-controls>
      <div class="price-category-modal__selection-head">
        <p class="price-category-modal__selection-title">${escapeHtml(locale.selectionTitle || locale.chooseBreedLabel || 'Select a breed and service')}</p>
      </div>
      <label class="price-category-modal__selection-field">
        <span>${escapeHtml(locale.breedSelectLabel || 'Choose breed')}</span>
        <select data-price-modal-breed></select>
      </label>
      <fieldset class="price-category-modal__service-fieldset" data-price-modal-service-fieldset>
        <legend data-price-modal-service-legend>${escapeHtml(locale.selectServicesLabel || locale.serviceSelectLabel || 'Choose a service')}</legend>
        <p class="price-category-modal__service-hint" data-price-modal-service-hint></p>
        <div class="price-category-modal__service-options" data-price-modal-service-options></div>
      </fieldset>
      <fieldset class="price-category-modal__service-fieldset price-category-modal__service-fieldset--additional" data-price-modal-additional-service-fieldset hidden>
        <legend data-price-modal-additional-service-legend>${escapeHtml(locale.selectAdditionalServicesLabel || locale.additionalServicesLabel || 'Choose additional services')}</legend>
        <p class="price-category-modal__service-hint price-category-modal__service-hint--additional" data-price-modal-additional-service-hint></p>
        <div class="price-category-modal__service-options" data-price-modal-additional-service-options></div>
      </fieldset>
      <div class="price-category-modal__calculation" aria-live="polite">
        <p class="price-category-modal__calculation-label" data-price-modal-calculation-label>${escapeHtml(locale.calculationLabel || 'Calculation')}</p>
        <p class="price-category-modal__selection-price" data-price-modal-selected-price></p>
        <ul class="price-category-modal__breakdown" data-price-modal-breakdown></ul>
      </div>
    </div>
    <section class="price-category-modal__service-conditions" data-price-modal-service-conditions hidden>
      <div class="price-category-modal__service-conditions-heading">
        <div>
          <p class="price-category-modal__service-conditions-kicker" data-price-modal-service-conditions-kicker></p>
          <h3 class="price-category-modal__service-conditions-title" data-price-modal-service-conditions-title></h3>
        </div>
        <strong class="price-category-modal__service-conditions-price" data-price-modal-service-conditions-price></strong>
      </div>
      <p class="price-category-modal__service-conditions-lead" data-price-modal-service-conditions-lead></p>
      <p class="price-category-modal__service-conditions-breed" data-price-modal-service-conditions-breed></p>
      <p class="price-category-modal__service-conditions-service" data-price-modal-service-conditions-service></p>
      <div class="price-category-modal__service-conditions-details" data-price-modal-service-conditions-details hidden>
        <p class="price-category-modal__service-conditions-details-label" data-price-modal-service-conditions-details-label></p>
        <ul class="price-category-modal__service-conditions-details-list" data-price-modal-service-conditions-details-list></ul>
      </div>
      <ul class="price-category-modal__service-conditions-list" data-price-modal-service-conditions-list></ul>
      <div class="price-category-modal__service-conditions-consent" data-price-modal-service-conditions-consent-wrap hidden>
        <label class="price-category-modal__service-conditions-consent-label">
          <input type="checkbox" data-price-modal-service-conditions-consent aria-describedby="price-modal-service-conditions-consent-message" />
          <span data-price-modal-service-conditions-consent-label></span>
        </label>
        <p class="price-category-modal__service-conditions-consent-message" id="price-modal-service-conditions-consent-message" data-price-modal-service-conditions-consent-message role="alert" hidden></p>
      </div>
      <div data-price-modal-service-conditions-booking-slot></div>
    </section>
  `;
  modalSummary?.closest('.price-category-modal__hero')?.insertAdjacentElement('afterend', modalSelection);
  const modalSelectionControls = modalSelection.querySelector('[data-price-modal-selection-controls]');
  const modalBreedSelect = modalSelection.querySelector('[data-price-modal-breed]');
  const modalServiceHint = modalSelection.querySelector('[data-price-modal-service-hint]');
  const modalServiceLegend = modalSelection.querySelector('[data-price-modal-service-legend]');
  const modalServiceFieldset = modalSelection.querySelector('[data-price-modal-service-fieldset]');
  const modalServiceOptions = modalSelection.querySelector('[data-price-modal-service-options]');
  const modalAdditionalServiceFieldset = modalSelection.querySelector('[data-price-modal-additional-service-fieldset]');
  const modalAdditionalServiceLegend = modalSelection.querySelector('[data-price-modal-additional-service-legend]');
  const modalAdditionalServiceHint = modalSelection.querySelector('[data-price-modal-additional-service-hint]');
  const modalAdditionalServiceOptions = modalSelection.querySelector('[data-price-modal-additional-service-options]');
  const modalSelectedPrice = modalSelection.querySelector('[data-price-modal-selected-price]');
  const modalBreakdown = modalSelection.querySelector('[data-price-modal-breakdown]');
  const modalServiceConditions = modalSelection.querySelector('[data-price-modal-service-conditions]');
  const modalServiceConditionsKicker = modalSelection.querySelector('[data-price-modal-service-conditions-kicker]');
  const modalServiceConditionsTitle = modalSelection.querySelector('[data-price-modal-service-conditions-title]');
  const modalServiceConditionsPrice = modalSelection.querySelector('[data-price-modal-service-conditions-price]');
  const modalServiceConditionsLead = modalSelection.querySelector('[data-price-modal-service-conditions-lead]');
  const modalServiceConditionsBreed = modalSelection.querySelector('[data-price-modal-service-conditions-breed]');
  const modalServiceConditionsService = modalSelection.querySelector('[data-price-modal-service-conditions-service]');
  const modalServiceConditionsDetails = modalSelection.querySelector('[data-price-modal-service-conditions-details]');
  const modalServiceConditionsDetailsLabel = modalSelection.querySelector('[data-price-modal-service-conditions-details-label]');
  const modalServiceConditionsDetailsList = modalSelection.querySelector('[data-price-modal-service-conditions-details-list]');
  const modalServiceConditionsList = modalSelection.querySelector('[data-price-modal-service-conditions-list]');
  const modalServiceConditionsConsentWrap = modalSelection.querySelector('[data-price-modal-service-conditions-consent-wrap]');
  const modalServiceConditionsConsent = modalSelection.querySelector('[data-price-modal-service-conditions-consent]');
  const modalServiceConditionsConsentLabel = modalSelection.querySelector('[data-price-modal-service-conditions-consent-label]');
  const modalServiceConditionsConsentMessage = modalSelection.querySelector('[data-price-modal-service-conditions-consent-message]');
  const modalServiceConditionsBookingSlot = modalSelection.querySelector('[data-price-modal-service-conditions-booking-slot]');

  const clearServiceConditionsConsentMessage = () => {
    modalServiceConditionsConsentWrap?.classList.remove('is-invalid');
    if (modalServiceConditionsConsentMessage) {
      modalServiceConditionsConsentMessage.hidden = true;
      modalServiceConditionsConsentMessage.textContent = '';
    }
  };

  const resetServiceConditionsConsent = () => {
    if (modalServiceConditionsConsent) modalServiceConditionsConsent.checked = false;
    clearServiceConditionsConsentMessage();
  };

  const showServiceConditionsConsentRequired = () => {
    const message = locale.serviceConditions?.consentRequired || '';
    if (modalServiceConditionsConsentWrap) modalServiceConditionsConsentWrap.classList.add('is-invalid');
    if (modalServiceConditionsConsentMessage) {
      modalServiceConditionsConsentMessage.textContent = message;
      modalServiceConditionsConsentMessage.hidden = !message;
    }
    modalServiceConditionsConsent?.focus({ preventScroll: true });
  };

  modalServiceConditionsConsent?.addEventListener('change', () => {
    if (modalServiceConditionsConsent.checked) clearServiceConditionsConsentMessage();
    if (modalBooking) {
      const hasSelectedService = Boolean(modalBooking.dataset.bookingServices);
      modalBooking.setAttribute('aria-disabled', String(!hasSelectedService || !modalServiceConditionsConsent.checked));
    }
  });

  if (modalBooking && modalServiceConditionsBookingSlot) {
    const modalBookingFooter = modalBooking.closest('.price-category-modal__footer');
    modalServiceConditionsBookingSlot.appendChild(modalBooking);
    modalBooking.classList.add('price-category-modal__service-conditions-register');
    modalBookingFooter?.remove();
  }

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

  const registrationModal = document.createElement('div');
  registrationModal.id = 'client-registration-modal';
  registrationModal.className = 'modal client-registration-modal';
  registrationModal.setAttribute('aria-hidden', 'true');
  registrationModal.innerHTML = `
    <div class="modal-content client-registration-modal__content">
      <button type="button" class="modal-close client-registration-modal__close" data-client-registration-close aria-label="${escapeHtml(locale.closeLabel || 'Close')}" >&times;</button>
      <p class="section-kicker" data-client-registration-kicker></p>
      <h2 class="section-title" data-client-registration-title></h2>
      <p class="client-registration-modal__lead" data-client-registration-lead></p>
      <form class="client-registration-form" data-client-registration-form data-disable-draft="true" data-form-type="client_registration" action="/sendmail" method="POST">
        <input type="hidden" name="form_type" value="client_registration" />
        <input type="hidden" name="lang" value="${escapeHtml(lang)}" />
        <input type="hidden" name="promotion_key" data-client-registration-promotion />
        <input type="hidden" name="service" data-client-registration-service />
        <input type="hidden" name="service_price" data-client-registration-price />
        <input type="hidden" name="service_category" data-client-registration-category />
        <input type="hidden" name="pet_species" data-client-registration-pet-species value="dog" />
        <input type="hidden" name="pet_breed" data-client-registration-pet-breed />
        <div class="client-registration-selection" data-client-registration-selection>
          <p><span data-client-registration-selected-service-label></span><strong data-client-registration-selected-service></strong></p>
          <p><span data-client-registration-selected-price-label></span><strong data-client-registration-selected-price></strong></p>
        </div>
        <fieldset class="client-registration-form__fieldset">
          <legend data-client-registration-client-legend></legend>
          <div class="client-registration-form__grid">
            <label class="booking-field-label"><span data-client-registration-client-name-label></span><input type="text" name="name" autocomplete="name" required /></label>
            <label class="booking-field-label"><span data-client-registration-email-label></span><input type="email" name="email" autocomplete="email" required /></label>
            <label class="booking-field-label"><span data-client-registration-phone-label></span><input type="tel" name="phone" autocomplete="tel" required /></label>
          </div>
        </fieldset>
        <fieldset class="client-registration-form__fieldset">
          <legend data-client-registration-pet-legend></legend>
          <div class="client-registration-form__grid">
            <label class="booking-field-label"><span data-client-registration-pet-name-label></span><input type="text" name="pet_name" required /></label>
            <p class="client-registration-selection client-registration-form__pet-context" data-client-registration-pet-context></p>
            <label class="booking-field-label"><span data-client-registration-pet-age-label></span><input type="text" name="pet_age" inputmode="text" /></label>
            <label class="booking-field-label"><span data-client-registration-pet-sex-label></span><select name="pet_sex" data-client-registration-pet-sex></select></label>
            <label class="booking-field-label"><span data-client-registration-pet-tag-label></span><input type="text" name="pet_tag_number" inputmode="text" maxlength="60" /></label>
          </div>
          <label class="booking-field-label client-registration-form__notes"><span data-client-registration-notes-label></span><textarea name="message" rows="3"></textarea></label>
        </fieldset>
        <p class="client-registration-form__required-hint" data-client-registration-required-hint></p>
        <label class="booking-check-label client-registration-form__consent"><input type="checkbox" name="privacy_consent" required /><span data-client-registration-privacy></span></label>
        <label class="booking-check-label client-registration-form__consent"><input type="checkbox" name="agb_consent" required /><span data-client-registration-terms></span></label>
        <div class="client-registration-form__actions">
          <button type="button" class="btn-neon" data-nav-pill="client-registration-action" data-client-registration-cancel></button>
          <button type="submit" class="btn-neon" data-nav-pill="client-registration-action" data-client-registration-submit></button>
        </div>
      </form>
      <section class="client-registration-success" data-client-registration-success hidden>
        <p data-client-registration-success-text></p>
        <button type="button" class="btn-neon" data-client-registration-booking></button>
      </section>
    </div>
  `;
  document.body.appendChild(registrationModal);
  window.HundesalonNavPill?.scan?.(registrationModal);

  const registrationForm = registrationModal.querySelector('[data-client-registration-form]');
  const registrationContent = registrationModal.querySelector('.client-registration-modal__content');
  bindModalWheelScroll(registrationContent);
  const registrationSuccess = registrationModal.querySelector('[data-client-registration-success]');
  const registrationSuccessText = registrationModal.querySelector('[data-client-registration-success-text]');
  const registrationBooking = registrationModal.querySelector('[data-client-registration-booking]');
  const registrationClose = registrationModal.querySelector('[data-client-registration-close]');
  const registrationCancel = registrationModal.querySelector('[data-client-registration-cancel]');
  const registrationPromotion = registrationForm?.querySelector('[data-client-registration-promotion]');
  const registrationService = registrationForm?.querySelector('[data-client-registration-service]');
  const registrationPrice = registrationForm?.querySelector('[data-client-registration-price]');
  const registrationCategory = registrationForm?.querySelector('[data-client-registration-category]');
  const registrationBreed = registrationForm?.querySelector('[data-client-registration-pet-breed]');
  const registrationSex = registrationForm?.querySelector('[data-client-registration-pet-sex]');
  const registrationPetSpeciesValue = registrationForm?.querySelector('[data-client-registration-pet-species]');
  const registrationPetContext = registrationForm?.querySelector('[data-client-registration-pet-context]');
  const registrationSelectedService = registrationModal.querySelector('[data-client-registration-selected-service]');
  const registrationSelectedPrice = registrationModal.querySelector('[data-client-registration-selected-price]');
  let registrationCompletedForSelection = false;
  let registrationSelectionSignature = '';

  const setRegistrationText = (context, selectedBreed, petSpecies) => {
    const copy = locale.registration || {};
    const fields = copy.fields || {};
    const petTypeLabel = copy.petTypes?.[petSpecies] || fields.other || '';
    const setText = (selector, value) => {
      const element = registrationModal.querySelector(selector);
      if (element) element.textContent = value || '';
    };
    const setConsent = (selector, value, href) => {
      const element = registrationModal.querySelector(selector);
      if (!element) return;
      element.innerHTML = `${escapeHtml(value || '')} <a href="${escapeHtml(href)}">${escapeHtml(href.endsWith('agb.html') ? (lang === 'ru' ? 'условиями салона' : lang === 'uk' ? 'умовами салону' : lang === 'de' ? 'Salonregeln' : 'salon rules') : lang === 'ru' ? 'политикой конфиденциальности' : lang === 'uk' ? 'політикою конфіденційності' : lang === 'de' ? 'Datenschutzerklärung' : 'privacy policy')}</a>`;
    };

    setText('[data-client-registration-kicker]', copy.kicker);
    setText('[data-client-registration-title]', copy.title);
    setText('[data-client-registration-lead]', copy.lead);
    setText('[data-client-registration-client-legend]', copy.clientLegend);
    setText('[data-client-registration-pet-legend]', copy.petLegend);
    setText('[data-client-registration-selected-service-label]', copy.selectedServiceLabel);
    setText('[data-client-registration-selected-price-label]', copy.selectedPriceLabel);
    setText('[data-client-registration-client-name-label]', fields.clientName);
    setText('[data-client-registration-email-label]', fields.email);
    setText('[data-client-registration-phone-label]', fields.phone);
    setText('[data-client-registration-pet-name-label]', fields.petName);
    setText('[data-client-registration-pet-breed-label]', fields.petBreed);
    setText('[data-client-registration-pet-age-label]', fields.petAge);
    setText('[data-client-registration-pet-sex-label]', fields.petSex);
    setText('[data-client-registration-pet-tag-label]', fields.petTag);
    setText('[data-client-registration-pet-species-label]', fields.petSpecies);
    setText('[data-client-registration-notes-label]', fields.notes);
    setText('[data-client-registration-required-hint]', fields.requiredHint);
    setText('[data-client-registration-submit]', copy.submit);
    setText('[data-client-registration-cancel]', copy.cancel);
    setText('[data-client-registration-booking]', copy.continue);
    setConsent('[data-client-registration-privacy]', fields.privacy, 'datenschutz.html');
    setConsent('[data-client-registration-terms]', fields.terms, 'agb.html');

    if (registrationSex) {
      registrationSex.replaceChildren();
      [
        ['', fields.sexPlaceholder],
        ['female', fields.sexFemale],
        ['male', fields.sexMale],
        ['unknown', fields.sexUnknown],
      ].forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label || '';
        registrationSex.appendChild(option);
      });
    }

    if (registrationBreed) registrationBreed.value = selectedBreed?.label || '';
    if (registrationPetContext) {
      registrationPetContext.textContent = [
        selectedBreed?.label && fields.petBreed ? `${fields.petBreed}: ${selectedBreed.label}` : selectedBreed?.label,
        petTypeLabel && fields.petSpecies ? `${fields.petSpecies}: ${petTypeLabel}` : petTypeLabel,
      ].filter(Boolean).join(' · ');
    }
    if (registrationSelectedService) registrationSelectedService.textContent = context.serviceLabel || '';
    if (registrationSelectedPrice) registrationSelectedPrice.innerHTML = renderCurrencyText(context.priceText || '');
  };

  const closeRegistrationModal = () => {
    registrationModal.classList.remove('active', 'is-closing');
    registrationModal.setAttribute('aria-hidden', 'true');
    setPriceModalScrollLock(false);
  };

  const openRegistrationModal = context => {
    if (!context || !registrationForm) return;
    const showRegistrationModal = () => {
      registrationForm.hidden = false;
      registrationSuccess.hidden = true;
      registrationForm.reset();
      registrationPromotion.value = '';
      registrationService.value = context.serviceLabel || '';
      registrationPrice.value = context.priceText || '';
      registrationCategory.value = context.categoryLabel || '';
      registrationPetSpeciesValue.value = context.petSpecies?.key || 'other';
      setRegistrationText(context, context.selectedBreed, context.petSpecies?.labelKey || 'other');
      registrationModal.classList.remove('is-closing');
      registrationModal.classList.add('active');
      registrationModal.setAttribute('aria-hidden', 'false');
      setPriceModalScrollLock(true);
      window.requestAnimationFrame(() => registrationModal.querySelector('input[name="name"]')?.focus());
    };

    if (modal.classList.contains('active')) {
      closeModal();
      window.setTimeout(showRegistrationModal, 240);
      return;
    }
    showRegistrationModal();
  };

  registrationClose?.addEventListener('click', closeRegistrationModal);
  registrationCancel?.addEventListener('click', closeRegistrationModal);
  registrationModal.addEventListener('click', event => {
    if (event.target === registrationModal) closeRegistrationModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && registrationModal.classList.contains('active')) closeRegistrationModal();
  });
  registrationForm?.addEventListener('sendmail:success', event => {
    const values = event.detail?.values || {};
    const bookingForm = document.querySelector('#booking-form');
    ['name', 'email', 'phone', 'pet_name', 'pet_species', 'pet_breed', 'pet_age', 'pet_sex', 'pet_tag_number'].forEach(name => {
      const field = bookingForm?.querySelector(`[name="${name}"]`);
      if (field && values[name]) field.value = values[name];
    });
    const registrationId = event.detail?.response?.registration_id || '';
    if (registrationId) {
      const registrationIdField = bookingForm?.querySelector('[name="client_registration_id"]');
      if (registrationIdField) registrationIdField.value = registrationId;
    }
    registrationForm.hidden = true;
    registrationSuccess.hidden = false;
    registrationCompletedForSelection = true;
    if (registrationSuccessText) registrationSuccessText.textContent = event.detail?.message || '';
    registrationBooking?.focus();
  });
  registrationBooking?.addEventListener('click', () => {
    closeRegistrationModal();
    modalClose?.click();
    window.setTimeout(() => modalBooking?.click(), 280);
  });

  const getPetSpecies = (category, selectedBreed) => {
    const sourceCategoryId = category?.sourceId || category?.id;
    let key = 'dog';
    if (sourceCategoryId === 'ru-cats-grooming') key = 'cat';
    else if (sourceCategoryId === 'ru-small-animals') key = 'smallAnimal';
    else if (sourceCategoryId === 'ru-important-information') key = 'other';
    else if (sourceCategoryId === ADDITIONAL_CATEGORY_ID) {
      key = selectedBreed?.index === 1 ? 'cat' : selectedBreed?.index === 2 ? 'smallAnimal' : 'dog';
    }
    const registration = locale.registration || {};
    return {
      key: key === 'smallAnimal' ? 'small_animal' : key,
      labelKey: key,
      label: registration.petTypes?.[key] || registration.fields?.other || '',
    };
  };

  const getServiceDetails = (category, selectedServices, selectionMode = 'primary') => {
    if (!category || !selectedServices.length) return [];
    const sourceCategoryId = category.sourceId || category.id;
    if (selectionMode === 'additional' && sourceCategoryId !== ADDITIONAL_CATEGORY_ID) {
      return getAdditionalServiceNotes(category);
    }
    if (category.sizeGroups && sourceCategoryId !== ADDITIONAL_CATEGORY_ID) {
      const notes = (category.notes || []).map(note => getText(note)).filter(Boolean);
      const priceRowCount = (category.priceRows || []).length;
      if (notes.length && notes.length === priceRowCount) {
        const selectedDetails = selectedServices
          .map(service => notes[service.index])
          .filter(Boolean);
        if (selectedDetails.length) return [...new Set(selectedDetails)];
      }
      return notes;
    }
    if (sourceCategoryId === ADDITIONAL_CATEGORY_ID) {
      return (category.notes || []).map(note => getText(note)).filter(Boolean);
    }
    return (category.notes || []).map(note => getText(note)).filter(Boolean);
  };

  const updateServiceConditions = (category, selectedBreed, selectedServices, priceText, selectedPrimaryServices = [], selectedAdditionalServices = [], informationMode = false) => {
    const conditions = locale.serviceConditions || {};
    const hasSelectedServices = selectedServices.length > 0;
    const showConditions = hasSelectedServices || informationMode;
    if (modalServiceConditions) {
      modalServiceConditions.hidden = !showConditions;
      modalServiceConditions.classList.toggle('price-category-modal__service-conditions--information', informationMode);
    }
    if (modalSelectionControls) modalSelectionControls.hidden = informationMode;
    if (modalServiceConditionsConsentWrap) modalServiceConditionsConsentWrap.hidden = !hasSelectedServices;
    if (modalServiceConditionsConsentLabel) modalServiceConditionsConsentLabel.textContent = conditions.consentLabel || '';
    if (modalServiceConditionsConsent) modalServiceConditionsConsent.required = hasSelectedServices;
    if (!hasSelectedServices) resetServiceConditionsConsent();
    const serviceLabels = selectedServices.map(service => service.label).filter(Boolean);
    if (modalBooking) modalBooking.hidden = informationMode;
    if (modalServiceConditionsKicker) modalServiceConditionsKicker.textContent = informationMode
      ? locale.informationCardMetaLabel || locale.notesTitle || ''
      : conditions.priceLabel || '';
    if (modalServiceConditionsTitle) modalServiceConditionsTitle.textContent = conditions.title || '';
    if (modalServiceConditionsPrice) modalServiceConditionsPrice.innerHTML = renderCurrencyText(informationMode
      ? locale.informationCardMetaValue || locale.noPriceLabel || ''
      : priceText || locale.noPriceLabel || '');
    if (modalServiceConditionsLead) modalServiceConditionsLead.textContent = informationMode
      ? conditions.informationLead || conditions.lead || ''
      : conditions.lead || '';
    if (modalServiceConditionsBreed) modalServiceConditionsBreed.textContent = !informationMode && selectedBreed?.label
      ? `${conditions.breedLabel || locale.breedContextLabel || ''}: ${selectedBreed.label}`
      : '';
    if (modalServiceConditionsService) modalServiceConditionsService.textContent = !informationMode
      ? `${conditions.serviceLabel || locale.servicesTitle || ''}: ${serviceLabels.join(' + ') || conditions.noService || ''}`
      : '';
    const selectionMode = modalBreedSelect?.dataset.selectionMode || 'primary';
    const primaryDetails = selectedPrimaryServices.length
      ? getServiceDetails(category, selectedPrimaryServices, selectionMode)
      : [];
    const additionalDetails = selectedAdditionalServices.length
      ? getAdditionalServiceNotes(category)
      : [];
    const serviceDetails = [...new Set([...primaryDetails, ...additionalDetails])];
    if (modalServiceConditionsDetailsLabel) modalServiceConditionsDetailsLabel.textContent = locale.serviceDetailsLabel || locale.notesTitle || '';
    if (modalServiceConditionsDetailsList) {
      modalServiceConditionsDetailsList.innerHTML = serviceDetails
        .map(detail => `<li>${renderCurrencyText(detail)}</li>`)
        .join('');
    }
    if (modalServiceConditionsDetails) modalServiceConditionsDetails.hidden = !serviceDetails.length;
    if (modalServiceConditionsList) {
      modalServiceConditionsList.innerHTML = (conditions.rules || [])
        .map(condition => `<li>${renderCurrencyText(condition)}</li>`)
        .join('');
    }
    if (modalBooking) modalBooking.textContent = conditions.registerLabel || locale.registration?.title || '';
  };

  const getCheckedServiceIds = container => new Set(
    Array.from(container?.querySelectorAll('input[type="checkbox"]:checked') || []).map(input => input.value)
  );

  const getSelectedServices = (services, container) => {
    const selectedIds = getCheckedServiceIds(container);
    return services.filter(service => selectedIds.has(service.id));
  };

  const updateModalQuote = (category, primaryServices, additionalServices = []) => {
    if (!bookingCatalog || !modalBreedSelect || !modalSelectedPrice || !modalBooking) return;
    const sourceCategoryId = category.sourceId || category.id;
    const selectedBreed = bookingCatalog.getBreed(modalBreedSelect.value);
    const selectedPrimaryServices = getSelectedServices(primaryServices, modalServiceOptions);
    const selectedAdditionalServices = getSelectedServices(additionalServices, modalAdditionalServiceOptions);
    const selectedServices = [...selectedPrimaryServices, ...selectedAdditionalServices];
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
      modalSelectedPrice.innerHTML = `${escapeHtml(locale.selectedPriceLabel || locale.calculationLabel || 'Price')}: ${renderCurrencyText(priceText)}`;
    }
    if (modalBreakdown) {
      modalBreakdown.innerHTML = selectedServices
        .map(service => `<li><span>${escapeHtml(service.label)}</span><strong>${renderCurrencyText(service.price || locale.priceOnRequestLabel || locale.noPriceLabel)}</strong></li>`)
        .join('');
    }
    const firstService = selectedServices[0];
    const selectionSignature = `${category.id}|${modalBreedSelect.value}|${selectedServices.map(service => service.id).join(',')}`;
    if (selectionSignature !== registrationSelectionSignature) {
      registrationSelectionSignature = selectionSignature;
      registrationCompletedForSelection = false;
      resetServiceConditionsConsent();
    }
    modalBooking.classList.add('online-order-btn');
    modalBooking.textContent = locale.bookSelectionLabel || locale.bookingLabel;
    modalBooking.dataset.bookingCategory = sourceCategoryId;
    modalBooking.dataset.bookingBreed = selectedBreed?.id || modalBreedSelect.value;
    modalBooking.dataset.bookingService = firstService?.id || '';
    modalBooking.dataset.bookingServices = selectedServices.map(service => service.id).join(',');
    modalBooking.dataset.bookingServiceLabel = selectedServices.map(service => service.label).join(' + ');
    modalBooking.dataset.bookingPrice = priceText;
    modalBooking.dataset.bookingPromotionKey = '';
    modalBooking.dataset.bookingPromotionLabel = '';
    modalBooking.dataset.bookingPromotionPrice = '';
    modalBooking.dataset.bookingPetSpecies = getPetSpecies(category, selectedBreed).key;
    updateServiceConditions(category, selectedBreed, selectedServices, priceText, selectedPrimaryServices, selectedAdditionalServices);
    const hasConsent = Boolean(modalServiceConditionsConsent?.checked);
    modalBooking.setAttribute('aria-disabled', String(!selectedServices.length || !hasConsent));
    modalBooking.tabIndex = selectedServices.length ? 0 : -1;
    modalBooking.classList.toggle('is-disabled', !selectedServices.length);
  };

  const renderServiceOptions = (container, services, {
    category,
    idPrefix,
    preferredServiceId = '',
    defaultFirst = false,
    allowMultiple = false,
    onChange,
  }) => {
    if (!container) return;
    container.replaceChildren();
    services.forEach((service, index) => {
      const id = `${idPrefix}-${category.id}-${service.index}`;
      const label = document.createElement('label');
      label.className = 'price-category-modal__service-option';
      const isChecked = preferredServiceId ? service.id === preferredServiceId : defaultFirst && index === 0;
      label.innerHTML = `
        <input type="checkbox" id="${escapeHtml(id)}" value="${escapeHtml(service.id)}" ${isChecked ? 'checked' : ''} />
        <span class="price-category-modal__service-option-check" aria-hidden="true"></span>
        <span class="price-category-modal__service-option-name"><span>${renderCurrencyText(service.label)}</span></span>
        <strong>${renderCurrencyText(service.price || locale.priceOnRequestLabel || locale.noPriceLabel)}</strong>`;
      const input = label.querySelector('input');
      input?.addEventListener('change', () => {
        if (!allowMultiple && input.checked) {
          container.querySelectorAll('input[type="checkbox"]').forEach(other => {
            if (other !== input) other.checked = false;
          });
        }
        onChange?.();
      });
      container.appendChild(label);
    });
  };

  const updateModalBookingSelection = (category, preferredBreedIndex = null, preferredServiceIndex = null, selectionMode = 'primary') => {
    if (!bookingCatalog || !modalBreedSelect || !modalServiceOptions || !modalSelectedPrice || !modalBooking) return;
    const sourceCategoryId = category.sourceId || category.id;
    const bookingCategory = bookingCatalog.getCategory(sourceCategoryId);
    if (!bookingCategory) return;
    const isAdditionalSelection = selectionMode === 'additional';
    const shortCoatBreedStarts = [0, 5, 16, 24];
    const resolvedPreferredBreedIndex = Number.isInteger(preferredBreedIndex)
      ? preferredBreedIndex
      : sourceCategoryId === 'ru-short-coat' && Number.isInteger(preferredServiceIndex)
        ? shortCoatBreedStarts[preferredServiceIndex] ?? 0
        : null;

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

    if (Number.isInteger(resolvedPreferredBreedIndex)) {
      const preferredBreedId = `${sourceCategoryId}:breed:${resolvedPreferredBreedIndex}`;
      if (Array.from(modalBreedSelect.options).some(option => option.value === preferredBreedId)) {
        modalBreedSelect.value = preferredBreedId;
      }
    }

    const serviceIndexes = new Set(category.priceIndexes || bookingCategory.services.map(service => service.index));
    const primaryServices = isAdditionalSelection
      ? []
      : bookingCatalog
        .getServices(sourceCategoryId, modalBreedSelect.value)
        .filter(service => serviceIndexes.has(service.index));
    const additionalServices = isAdditionalSelection || sourceCategoryId !== ADDITIONAL_CATEGORY_ID
      ? getAdditionalServices(category)
      : [];
    const allowMultiplePrimary = isAdditionalSelection || sourceCategoryId === ADDITIONAL_CATEGORY_ID;
    const preferredServiceId = Number.isInteger(preferredServiceIndex)
      ? `${isAdditionalSelection ? ADDITIONAL_CATEGORY_ID : sourceCategoryId}:service:${preferredServiceIndex}`
      : '';

    if (modalSummary) {
      modalSummary.textContent = `${getText(category.summary)}${isAdditionalSelection ? ` — ${locale.additionalServicesLabel || ''}` : ''}`;
    }
    if (modalServiceLegend) {
      modalServiceLegend.textContent = locale.selectServicesLabel || locale.serviceSelectLabel || 'Choose a service';
    }
    if (modalServiceHint) {
      modalServiceHint.textContent = allowMultiplePrimary
        ? locale.multipleServicesHint || ''
        : locale.singleServiceHint || '';
    }
    if (modalAdditionalServiceLegend) {
      modalAdditionalServiceLegend.textContent = locale.selectAdditionalServicesLabel || locale.additionalServicesLabel || 'Choose additional services';
    }
    if (modalAdditionalServiceHint) {
      modalAdditionalServiceHint.textContent = locale.additionalServicesHint || locale.multipleServicesHint || '';
    }
    if (modalServiceFieldset) modalServiceFieldset.hidden = isAdditionalSelection || !primaryServices.length;
    if (modalAdditionalServiceFieldset) modalAdditionalServiceFieldset.hidden = !additionalServices.length;

    renderServiceOptions(modalServiceOptions, primaryServices, {
      category,
      idPrefix: 'price-modal-service',
      preferredServiceId: isAdditionalSelection ? '' : preferredServiceId,
      defaultFirst: false,
      allowMultiple: allowMultiplePrimary,
      onChange: () => updateModalQuote(category, primaryServices, additionalServices),
    });
    renderServiceOptions(modalAdditionalServiceOptions, additionalServices, {
      category,
      idPrefix: 'price-modal-additional-service',
      preferredServiceId: isAdditionalSelection ? preferredServiceId : '',
      defaultFirst: false,
      allowMultiple: true,
      onChange: () => updateModalQuote(category, primaryServices, additionalServices),
    });

    updateModalQuote(category, primaryServices, additionalServices);
  };

  modalBreedSelect?.addEventListener('change', () => {
    const category = categoryViews.find(item => item.id === modalBreedSelect.dataset.categoryId);
    const selectionMode = modalBreedSelect.dataset.selectionMode || 'primary';
    if (category) {
      updateModalBookingSelection(
        category,
        null,
        null,
        selectionMode
      );
    }
  });

  const bookingHref = catalog.bookingHref?.[lang] || 'onlayn-bronirovanie.html';
  if (modalBooking instanceof HTMLElement && modalBooking.tagName === 'A') {
    modalBooking.href = bookingHref;
  }
  if (modalKicker) modalKicker.textContent = modalCopy.title;
  if (modalClose) modalClose.setAttribute('aria-label', modalCopy.closeLabel);

  const state = {
    activeCategory: null,
    lastFocus: null,
  };

  const getCurrentRegistrationContext = () => {
    const category = state.activeCategory;
    if (!category || !bookingCatalog || !modalBreedSelect) return null;
    const sourceCategoryId = category.sourceId || category.id;
    const selectedBreed = bookingCatalog.getBreed(modalBreedSelect.value);
    const selectionMode = modalBreedSelect.dataset.selectionMode || 'primary';
    const bookingCategory = bookingCatalog.getCategory(sourceCategoryId);
    if (!bookingCategory) return null;
    const serviceIndexes = new Set(category.priceIndexes || bookingCategory.services.map(service => service.index));
    const primaryServices = selectionMode === 'additional'
      ? []
      : bookingCatalog.getServices(sourceCategoryId, modalBreedSelect.value).filter(service => serviceIndexes.has(service.index));
    const additionalServices = selectionMode === 'additional' || sourceCategoryId !== ADDITIONAL_CATEGORY_ID
      ? getAdditionalServices(category)
      : [];
    const selectedPrimaryServices = getSelectedServices(primaryServices, modalServiceOptions);
    const selectedAdditionalServices = getSelectedServices(additionalServices, modalAdditionalServiceOptions);
    const selectedServices = [...selectedPrimaryServices, ...selectedAdditionalServices];
    const priceText = modalBooking?.dataset.bookingPrice || locale.noPriceLabel || '';
    return {
      categoryLabel: getText(category.title),
      serviceLabel: selectedServices.map(service => service.label).join(' + '),
      priceText,
      selectedBreed,
      petSpecies: getPetSpecies(category, selectedBreed),
    };
  };

  const closeModal = () => {
    if (!modal.classList.contains('active')) return;
    modal.classList.add('is-closing');
    window.setTimeout(() => {
      modal.classList.remove('active', 'is-closing');
      modal.setAttribute('aria-hidden', 'true');
      setPriceModalScrollLock(false);
      state.lastFocus?.focus?.();
    }, 220);
  };

  const openModal = (category, preferredBreedIndex = null, preferredServiceIndex = null, selectionMode = 'primary') => {
    if (!category) return;
    registrationCompletedForSelection = false;
    state.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    state.activeCategory = category;
    const isAdditionalSelection = selectionMode === 'additional';
    const isInformationSelection = selectionMode === 'information';
    const additionalServicesLabel = locale.additionalServicesLabel || locale.sizeGroupTitles?.additional || 'Additional services';

    modalTitle.textContent = isAdditionalSelection
      ? `${category.modalTitle || getText(category.title)} — ${additionalServicesLabel}`
      : category.modalTitle || getText(category.title);
    modalSummary.textContent = getText(category.summary);
    modalKicker.textContent = modalCopy.title;

    modalBreedSelect.dataset.selectionMode = selectionMode;
    modalBreedSelect.dataset.promotionKey = '';
    modalBreedSelect.dataset.promotionServiceIndex = '';
    modal.classList.remove('price-category-modal--promotion');
    if (isInformationSelection) {
      updateServiceConditions(category, null, [], locale.informationCardMetaValue || locale.noPriceLabel || '', [], [], true);
    } else {
      updateModalBookingSelection(category, preferredBreedIndex, preferredServiceIndex, selectionMode);
    }

    modal.classList.remove('is-closing');
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    setPriceModalScrollLock(true);

    window.requestAnimationFrame(() => {
      modalClose?.focus?.();
    });
  };

  renderHero();
  window.HundesalonNavPill?.scan?.(heroRoot);
  const categoriesAction = heroRoot.querySelector('[data-price-categories-action]');
  categoriesAction?.addEventListener('click', () => {
    const target = cardsRoot;
    if (!target) return;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const behavior = reducedMotion ? 'auto' : 'smooth';
    const scrollRoot = document.querySelector('.site-scroll-root');

    if (scrollRoot) {
      const rootRect = scrollRoot.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const maxScroll = Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
      const destination = Math.max(
        0,
        Math.min(maxScroll, scrollRoot.scrollTop + targetRect.top - rootRect.top - 18)
      );
      scrollRoot.scrollTo({ top: destination, behavior });
    } else {
      target.scrollIntoView({ behavior, block: 'start' });
    }

    const firstAction = target.querySelector(
      '[data-price-breeds-toggle], [data-price-open], [data-price-service-select], [data-price-additional-select]'
    );
    if (!firstAction) return;
    const focusFirstAction = () => firstAction.focus({ preventScroll: true });
    if (behavior === 'smooth') {
      window.setTimeout(focusFirstAction, 500);
    } else {
      focusFirstAction();
    }
  });
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

  const breedSearchMatches = categoryViews
    .filter(category => (category.sourceId || category.id) !== IMPORTANT_CATEGORY_ID)
    .flatMap(category =>
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

  const renderSection = (sectionKey, views, options = {}) => {
    const title = locale.sizeGroupTitles?.[sectionKey] || locale.servicesTitle;
    if (options.layout === 'category-row') {
      const categorySections = (options.sourceKeys || [])
        .map(categoryKey => {
          const categoryViews = views.filter(category => category.groupKey === categoryKey);
          if (!categoryViews.length) return '';
          const categoryTitle = locale.sizeGroupTitles?.[categoryKey] || locale.servicesTitle;
          return `
            <div class="price-size-section__category">
              <div class="price-size-section__heading">
                <h2 class="price-size-section__title">${escapeHtml(categoryTitle)}</h2>
              </div>
              <div class="price-size-section__cards">
                ${categoryViews.map(renderCard).join('')}
              </div>
            </div>`;
        })
        .join('');
      return `
        <section class="price-size-section price-size-section--category-row" data-price-section="${escapeHtml(sectionKey)}">
          <div class="price-size-section__category-grid">
            ${categorySections}
          </div>
        </section>
      `;
    }
    const sectionClass = options.showHeading === false ? ' price-size-section--cards-only' : '';
    const gridAttribute = options.grid ? ` data-price-section-grid="${escapeHtml(options.grid)}"` : '';
    return `
      <section class="price-size-section${sectionClass}" data-price-section="${escapeHtml(sectionKey)}"${gridAttribute}>
        ${options.showHeading === false ? '' : `
          <div class="price-size-section__heading">
            <h2 class="price-size-section__title">${escapeHtml(title)}</h2>
          </div>`}
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

    const sections = sectionGroups
      .map(group => renderSection(
        group.key,
        visibleCategories.filter(category => group.sourceKeys.includes(category.groupKey)),
        group
      ))
      .filter(section => section.includes('price-card'))
      .join('');

    setBreedMenuScrollLock(false);
    cardsRoot.querySelectorAll('[data-nav-pill]').forEach(toggle => {
      window.HundesalonNavPill?.deactivate?.(toggle);
    });
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
    window.HundesalonNavPill?.scan?.(cardsRoot);
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
    const card = toggle.closest('.price-card');
    const row = card?.closest('.price-size-section__cards, .price-size-section__category-grid');
    if (!menu || !control || !card) return;

    const gap = 12;
    const edge = 20;
    const controlRect = control.getBoundingClientRect();
    const toggleRect = toggle.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const rowRect = row?.getBoundingClientRect() || cardRect;
    const rowWidth = Math.max(0, rowRect.width - edge * 2);
    const preferredWidth = Math.min(680, Math.max(300, cardRect.width * 1.42), rowWidth);
    const preferredLeft = toggleRect.right + gap - controlRect.left;
    const availableRight = rowRect.right - edge - toggleRect.right - gap;
    const opensToRight = availableRight >= Math.min(preferredWidth, 320);
    const menuWidth = opensToRight ? Math.min(preferredWidth, availableRight) : preferredWidth;
    const rowRight = rowRect.right - edge - menuWidth - controlRect.left;
    const left = opensToRight ? preferredLeft : rowRight;
    menu.style.left = `${left}px`;
    menu.style.right = 'auto';
    menu.style.width = `${Math.max(0, menuWidth)}px`;
    const maxMenuHeight = Math.min(480, Math.max(220, window.innerHeight - edge * 2));
    menu.style.maxHeight = `${Math.round(maxMenuHeight)}px`;
    // The revealed menu gains its final scrollbar gutter after layout. Reserve a
    // small amount of vertical space so its final box cannot cross the viewport edge.
    const menuHeight = Math.min((menu.getBoundingClientRect().height || menu.scrollHeight || maxMenuHeight) + 20, maxMenuHeight);
    const menuViewportTop = Math.max(
      edge,
      Math.min(controlRect.top, window.innerHeight - edge - menuHeight)
    );
    const menuTop = menuViewportTop - controlRect.top;
    menu.style.top = `${Math.round(menuTop)}px`;
    menu.dataset.priceMenuAlign = opensToRight ? 'start' : 'end';
    showBreedMenuScrollIndicator(menu);
  };

  const startBreedArrowCloseAnimation = toggle => {
    const icon = toggle.querySelector('.price-card__badge-icon');
    if (!icon || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    toggle.classList.remove('price-breed-arrow--closing');
    void toggle.offsetWidth;
    toggle.classList.add('price-breed-arrow--closing');

    const cleanup = event => {
      if (event.animationName !== 'priceBreedArrowClose') return;
      toggle.classList.remove('price-breed-arrow--closing');
      icon.removeEventListener('animationend', cleanup);
      icon.removeEventListener('animationcancel', cleanup);
    };
    icon.addEventListener('animationend', cleanup);
    icon.addEventListener('animationcancel', cleanup);
  };

  const closeBreedMenu = toggle => {
    const breedMenu = document.getElementById(toggle.dataset.priceBreedsToggle || '');
    const card = toggle.closest('.price-card');
    if (!breedMenu) return;
    const wasExpanded = toggle.getAttribute('aria-expanded') === 'true';
    breedMenu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', locale.showBreedsLabel || locale.cardCountSuffix);
    card?.classList.remove('price-card--breeds-open');
    card?.style.removeProperty('transition-property');
    card?.style.removeProperty('transform');
    if (wasExpanded) startBreedArrowCloseAnimation(toggle);
    window.HundesalonNavPill?.deactivate?.(toggle);
    setBreedMenuScrollLock(false);
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
      if (category && Number.isInteger(serviceIndex)) {
        openModal(category, Number.isInteger(selectedBreedIndex) ? selectedBreedIndex : null, serviceIndex);
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
        const breedCard = breedsToggle.closest('.price-card');
        breedsToggle.classList.remove('price-breed-arrow--closing');
        breedCard?.style.setProperty('transition-property', 'box-shadow, background');
        breedCard?.style.setProperty('transform', 'none');
        breedMenu.hidden = false;
        breedsToggle.setAttribute('aria-expanded', 'true');
        breedsToggle.setAttribute('aria-label', locale.hideBreedsLabel || locale.cardCountSuffix);
        breedCard?.classList.add('price-card--breeds-open');
        window.HundesalonNavPill?.activate?.(breedsToggle);
        setBreedMenuScrollLock(true);
        positionBreedMenu(breedsToggle);
        window.requestAnimationFrame(() => {
          if (breedsToggle.getAttribute('aria-expanded') === 'true') positionBreedMenu(breedsToggle);
        });
      }
      return;
    }
    const trigger = event.target instanceof HTMLElement ? event.target.closest('[data-price-open]') : null;
    if (!trigger) return;
    const category = categoryViews.find(item => item.id === trigger.dataset.priceOpen);
    const sourceCategoryId = category?.sourceId || category?.id;
    openModal(category, null, null, sourceCategoryId === IMPORTANT_CATEGORY_ID ? 'information' : 'primary');
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
    if (event.key === 'Escape') {
      const openBreedToggle = cardsRoot.querySelector('[data-price-breeds-toggle][aria-expanded="true"]');
      if (openBreedToggle) {
        closeBreedMenu(openBreedToggle);
        openBreedToggle.focus();
        return;
      }
    }
    if (event.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });

  if (modalBooking) {
    modalBooking.addEventListener('click', event => {
      if (!modalBooking.dataset.bookingServices) {
        event.preventDefault();
        event.stopImmediatePropagation();
        modalServiceFieldset?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        modalServiceOptions?.querySelector('input')?.focus({ preventScroll: true });
        return;
      }
      if (!modalServiceConditionsConsent?.checked) {
        event.preventDefault();
        event.stopImmediatePropagation();
        modalServiceConditions?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showServiceConditionsConsentRequired();
        return;
      }
      if (!registrationCompletedForSelection) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const context = getCurrentRegistrationContext();
        if (context) openRegistrationModal(context);
        return;
      }
      closeModal();
    });
  }
})(window);
