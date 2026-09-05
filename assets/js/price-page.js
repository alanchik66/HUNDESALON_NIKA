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
  const breedPhotoCopy = {
    de: {
      loading: 'Foto wird geladen',
      unavailable: 'Kein eindeutiges Rassefoto gefunden',
      source: 'Quelle: Wikimedia-Projekte',
      generated: 'Illustration nach Rassestandard',
      viewSource: 'Bildquelle und Lizenz',
    },
    en: {
      loading: 'Loading photo',
      unavailable: 'No verified breed photo found',
      source: 'Source: Wikimedia projects',
      generated: 'Illustration based on the breed standard',
      viewSource: 'Photo source and licence',
    },
    ru: {
      loading: 'Загружаем фотографию',
      unavailable: 'Точная фотография породы не найдена',
      source: 'Источник: проекты Wikimedia',
      generated: 'Иллюстрация по стандарту породы',
      viewSource: 'Источник и лицензия фото',
    },
    uk: {
      loading: 'Завантажуємо фотографію',
      unavailable: 'Точне фото породи не знайдено',
      source: 'Джерело: проєкти Wikimedia',
      generated: 'Ілюстрація за стандартом породи',
      viewSource: 'Джерело та ліцензія фото',
    },
  }[lang];
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
    { key: 'large', sourceKeys: ['large'] },
    {
      key: 'cats-animals',
      sourceKeys: ['cats', 'smallAnimals'],
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
  const categoryNavigationKeys = ['small', 'medium', 'large', 'cats', 'smallAnimals'];
  const searchFilterCopy = ({
    de: {
      label: 'Suchfilter',
      animal: 'Tierart',
      allAnimals: 'Alle Tiere',
      dog: 'Hunde',
      cat: 'Katzen',
      smallAnimals: 'Kleintiere',
      size: 'Hundegröße',
      anySize: 'Alle Größen',
      small: 'Klein',
      medium: 'Mittelgroß',
      large: 'Groß',
      coat: 'Felltyp',
      anyCoat: 'Alle Felltypen',
      long: 'Langhaar',
      short: 'Kurzhaar',
      double: 'Doppelfell',
      results: 'Gefunden',
      reset: 'Alles zurücksetzen',
    },
    en: {
      label: 'Search filters',
      animal: 'Animal',
      allAnimals: 'All animals',
      dog: 'Dogs',
      cat: 'Cats',
      smallAnimals: 'Small animals',
      size: 'Dog size',
      anySize: 'Any size',
      small: 'Small',
      medium: 'Medium',
      large: 'Large',
      coat: 'Coat type',
      anyCoat: 'Any coat',
      long: 'Long-haired',
      short: 'Short-haired',
      double: 'Double coat',
      results: 'Found',
      reset: 'Reset all',
    },
    ru: {
      label: 'Фильтры поиска',
      animal: 'Вид животного',
      allAnimals: 'Все животные',
      dog: 'Собаки',
      cat: 'Кошки',
      smallAnimals: 'Мелкие животные',
      size: 'Размер собаки',
      anySize: 'Любой размер',
      small: 'Маленькие',
      medium: 'Средние',
      large: 'Большие',
      coat: 'Тип шерсти',
      anyCoat: 'Любой тип',
      long: 'Длинношёрстные',
      short: 'Короткошёрстные',
      double: 'Двойная шерсть',
      results: 'Найдено',
      reset: 'Сбросить всё',
    },
    uk: {
      label: 'Фільтри пошуку',
      animal: 'Вид тварини',
      allAnimals: 'Усі тварини',
      dog: 'Собаки',
      cat: 'Коти',
      smallAnimals: 'Дрібні тварини',
      size: 'Розмір собаки',
      anySize: 'Будь-який розмір',
      small: 'Малі',
      medium: 'Середні',
      large: 'Великі',
      coat: 'Тип шерсті',
      anyCoat: 'Будь-який тип',
      long: 'Довгошерсті',
      short: 'Короткошерсті',
      double: 'Подвійна шерсть',
      results: 'Знайдено',
      reset: 'Скинути все',
    },
  })[lang];
  const renderSearchFilterOptions = options => options
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
    .join('');

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

  const normalizePhotoName = value => String(value || '')
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  const animalPhotoData = global.AnimalBreedPhotoData || {};
  const animalPhotoEntries = animalPhotoData.entriesByKey || {};
  const getAnimalPhotoEntry = key => {
    const entry = key ? animalPhotoEntries[key] : null;
    const src = entry?.localAsset || entry?.src;
    return entry && src ? { key, ...entry, src } : null;
  };
  const getAnimalPhotoRecord = (category, displayedName, filteredIndex, sourceIndex) => {
    const resolvedIndex = Number.isInteger(sourceIndex) ? sourceIndex : filteredIndex;
    const sourceCategoryId = category.sourceId || category.id;
    const breedKey = category.breedKeys?.[resolvedIndex] || '';
    const metadata = category.breedMetadata?.[lang]?.[resolvedIndex]
      || category.breedMetadata?.[lang]?.[filteredIndex]
      || null;
    const lookupKeys = [
      animalPhotoData.keyByBreedKey?.[breedKey],
      animalPhotoData.keyByMetadataId?.[metadata?.id],
      animalPhotoData.keyByMetadataId?.[`cat:${metadata?.id || ''}`],
      animalPhotoData.keyByCategoryIndex?.[`${sourceCategoryId}:${resolvedIndex}`],
    ];
    for (const key of lookupKeys) {
      const entry = getAnimalPhotoEntry(key);
      if (entry) return entry;
    }

    return Object.entries(animalPhotoEntries)
      .map(([key, entry]) => ({ key, ...entry, src: entry.localAsset || entry.src }))
      .find(entry => entry.src && (
        (breedKey && entry.breedKey === breedKey)
        || (metadata?.id && entry.metadataId === metadata.id)
        || (entry.categoryId === sourceCategoryId && entry.sourceIndex === resolvedIndex)
        || (entry.kind === category.animalType && normalizePhotoName(entry.name) === normalizePhotoName(displayedName))
      )) || null;
  };
  const getPhotoAttribution = photo => {
    if (!photo) return '';
    if (photo.sourceType === 'generated' || String(photo.exactness || '').startsWith('illustrative')) {
      return breedPhotoCopy.generated;
    }
    return [photo.author, photo.license].filter(Boolean).join(' · ') || breedPhotoCopy.source;
  };
  const renderAnimalPhotoThumbnail = (photo, className) => photo
    ? `<span class="${className}"><img src="${escapeHtml(photo.src)}" alt="" width="72" height="54" loading="lazy" decoding="async" /></span>`
    : '';
  const getBreedPhotoSubject = (category, displayedName, filteredIndex, sourceIndex) => {
    const localPhoto = getAnimalPhotoRecord(category, displayedName, filteredIndex, sourceIndex);
    if (!localPhoto) return null;
    return {
      title: displayedName,
      language: lang,
      kind: localPhoto.kind,
      fciNumber: localPhoto.fciNumber || null,
      photoKey: localPhoto.key,
    };
  };
  const requestBreedPhoto = async subject => getAnimalPhotoEntry(subject?.photoKey || '');

  const breedPhotoPreview = document.createElement('aside');
  breedPhotoPreview.className = 'price-breed-photo';
  breedPhotoPreview.hidden = true;
  breedPhotoPreview.setAttribute('aria-live', 'polite');
  breedPhotoPreview.innerHTML = `
    <div class="price-breed-photo__media">
      <img class="price-breed-photo__image" alt="" decoding="async" />
      <span class="price-breed-photo__status"></span>
    </div>
    <strong class="price-breed-photo__title"></strong>
    <span class="price-breed-photo__source">${escapeHtml(breedPhotoCopy.source)}</span>`;
  document.body.append(breedPhotoPreview);
  const breedPhotoImage = breedPhotoPreview.querySelector('.price-breed-photo__image');
  const breedPhotoStatus = breedPhotoPreview.querySelector('.price-breed-photo__status');
  const breedPhotoTitle = breedPhotoPreview.querySelector('.price-breed-photo__title');
  const breedPhotoSource = breedPhotoPreview.querySelector('.price-breed-photo__source');
  let breedPhotoTimer = null;
  let breedPhotoRequestId = 0;
  const hideBreedPhoto = () => {
    window.clearTimeout(breedPhotoTimer);
    breedPhotoRequestId += 1;
    breedPhotoPreview.hidden = true;
    breedPhotoPreview.classList.remove('price-breed-photo--loading');
    breedPhotoImage?.removeAttribute('src');
  };
  const positionBreedPhoto = option => {
    const menu = option.closest('.price-card__breed-menu');
    if (!menu) return false;
    const menuRect = menu.getBoundingClientRect();
    const previewRect = breedPhotoPreview.getBoundingClientRect();
    const edge = 12;
    const gap = 14;
    const leftSpace = menuRect.left - edge - gap;
    const rightSpace = window.innerWidth - menuRect.right - edge - gap;
    if (Math.max(leftSpace, rightSpace) < previewRect.width) return false;
    const menuOnRight = menuRect.left > window.innerWidth / 2;
    const left = menuOnRight
      ? (leftSpace >= previewRect.width ? menuRect.left - previewRect.width - gap : menuRect.right + gap)
      : (rightSpace >= previewRect.width ? menuRect.right + gap : menuRect.left - previewRect.width - gap);
    const top = Math.max(edge, Math.min(menuRect.top, window.innerHeight - previewRect.height - edge));
    breedPhotoPreview.style.left = `${Math.round(left)}px`;
    breedPhotoPreview.style.top = `${Math.round(top)}px`;
    return true;
  };
  const showBreedPhoto = option => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    window.clearTimeout(breedPhotoTimer);
    breedPhotoTimer = window.setTimeout(async () => {
      const title = option.dataset.priceBreedPhotoTitle || '';
      if (!title) return;
      const subject = {
        title,
        language: option.dataset.priceBreedPhotoLanguage || 'en',
        kind: option.dataset.priceBreedPhotoKind || 'dog',
        fciNumber: Number(option.dataset.priceBreedPhotoFci) || null,
        photoKey: option.dataset.priceBreedPhotoKey || '',
      };
      const requestId = ++breedPhotoRequestId;
      const label = option.dataset.priceBreedLabel || option.textContent.trim();
      breedPhotoTitle.textContent = label;
      breedPhotoImage.alt = label;
      breedPhotoSource.textContent = breedPhotoCopy.source;
      breedPhotoImage.removeAttribute('src');
      breedPhotoStatus.textContent = breedPhotoCopy.loading;
      breedPhotoPreview.classList.add('price-breed-photo--loading');
      breedPhotoPreview.hidden = false;
      if (!positionBreedPhoto(option)) {
        hideBreedPhoto();
        return;
      }
      const photo = await requestBreedPhoto(subject);
      if (requestId !== breedPhotoRequestId || breedPhotoPreview.hidden) return;
      breedPhotoPreview.classList.remove('price-breed-photo--loading');
      if (!photo?.src) {
        breedPhotoStatus.textContent = breedPhotoCopy.unavailable;
        return;
      }
      breedPhotoStatus.textContent = '';
      breedPhotoSource.textContent = getPhotoAttribution(photo);
      breedPhotoImage.src = photo.src;
    }, 180);
  };
  breedPhotoImage?.addEventListener('error', () => {
    if (breedPhotoPreview.hidden) return;
    breedPhotoPreview.classList.remove('price-breed-photo--loading');
    breedPhotoStatus.textContent = breedPhotoCopy.unavailable;
    breedPhotoImage.removeAttribute('src');
  });

  const syncSelectedBreedServices = (card, category, breedIndex) => {
    const sourceCategoryId = category?.sourceId || category?.id;
    if (!card || !Number.isInteger(breedIndex)) return;
    const bookingCategory = bookingCatalog?.getCategory(sourceCategoryId);
    if (bookingCategory?.source.breedServiceRows || bookingCategory?.source.breedServicePrices) {
      const breedId = `${sourceCategoryId}:breed:${breedIndex}`;
      const services = bookingCatalog.getServices(sourceCategoryId, breedId);
      card.querySelectorAll('[data-price-service-select]').forEach(button => {
        const hidden = !services.some(service => service.index === Number(button.dataset.priceServiceIndex));
        button.hidden = hidden;
        button.classList.toggle('price-card__service-option--breed-hidden', hidden);
      });
      for (const service of services) {
        const button = card.querySelector(`[data-price-service-index="${service.index}"]`);
        if (!button) continue;
        button.querySelector('.price-card__service-option-label').innerHTML = renderCurrencyText(service.label);
        button.querySelector('.price-card__service-option-price').innerHTML = renderCurrencyText(service.price);
        button.setAttribute('aria-label', `${service.label} — ${service.price}`);
      }
      return;
    }
    if (sourceCategoryId !== 'ru-short-coat') return;
    const serviceIndex = bookingCategory?.breeds.find(breed => breed.index === breedIndex)?.serviceIndex;
    if (!Number.isInteger(serviceIndex)) return;

    card.querySelectorAll('[data-price-service-select]').forEach(button => {
      const buttonServiceIndex = Number(button.dataset.priceServiceIndex);
      if (buttonServiceIndex >= 0 && buttonServiceIndex <= 3) {
        const hidden = buttonServiceIndex !== serviceIndex;
        button.hidden = hidden;
        button.classList.toggle('price-card__service-option--breed-hidden', hidden);
      }
    });
  };

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
        syncBreedMenuScrollIndicator(breedMenuScrollTarget);
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
        const selectMenu = event.target instanceof Element
          ? event.target.closest('.site-select__menu')
          : null;
        if (selectMenu) return;

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
        const selectMenu = event.target instanceof Element
          ? event.target.closest('.site-select__menu')
          : null;
        if (selectMenu) return;

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
        </div>
      </div>
      <div class="price-page-hero__search">
        <div class="price-page-hero__search-frame">
          <div class="price-breed-search" data-price-breed-search>
            <label class="price-breed-search__label" for="price-breed-search-input">${escapeHtml(locale.searchLabel || 'Поиск породы')}</label>
            <div class="price-breed-search__control">
              <img class="price-breed-search__icon" src="../assets/images/icons/Lupa.png" alt="" width="64" height="64" decoding="async" aria-hidden="true" />
              <input id="price-breed-search-input" class="price-breed-search__input" type="search" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="search" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-controls="price-breed-search-suggestions" aria-expanded="false" data-price-breed-search-input placeholder="${escapeHtml(locale.searchPlaceholder || 'Например, шпиц или пудель')}" />
              <button type="button" class="price-breed-search__clear" data-price-breed-search-clear aria-label="${escapeHtml(locale.searchClear || 'Очистить поиск')}" hidden>&times;</button>
            </div>
            <div class="price-breed-search__filters" role="group" aria-label="${escapeHtml(searchFilterCopy.label)}" data-price-search-filters>
              <label class="price-breed-search__filter">
                <span class="price-breed-search__filter-label">${escapeHtml(searchFilterCopy.animal)}</span>
                <select class="price-breed-search__filter-select" data-price-search-filter="animal" aria-controls="price-categories price-breed-search-suggestions">
                  ${renderSearchFilterOptions([
                    ['all', searchFilterCopy.allAnimals],
                    ['dog', searchFilterCopy.dog],
                    ['cat', searchFilterCopy.cat],
                    ['smallAnimals', searchFilterCopy.smallAnimals],
                  ])}
                </select>
              </label>
              <label class="price-breed-search__filter">
                <span class="price-breed-search__filter-label">${escapeHtml(searchFilterCopy.size)}</span>
                <select class="price-breed-search__filter-select" data-price-search-filter="size" aria-controls="price-categories price-breed-search-suggestions">
                  ${renderSearchFilterOptions([
                    ['all', searchFilterCopy.anySize],
                    ['small', searchFilterCopy.small],
                    ['medium', searchFilterCopy.medium],
                    ['large', searchFilterCopy.large],
                  ])}
                </select>
              </label>
              <label class="price-breed-search__filter">
                <span class="price-breed-search__filter-label">${escapeHtml(searchFilterCopy.coat)}</span>
                <select class="price-breed-search__filter-select" data-price-search-filter="coat" aria-controls="price-categories price-breed-search-suggestions">
                  ${renderSearchFilterOptions([
                    ['all', searchFilterCopy.anyCoat],
                    ['long', searchFilterCopy.long],
                    ['short', searchFilterCopy.short],
                    ['double', searchFilterCopy.double],
                  ])}
                </select>
              </label>
            </div>
            <div class="price-breed-search__summary">
              <p class="price-breed-search__result-count" data-price-search-result-count aria-live="polite" aria-atomic="true"></p>
              <button type="button" class="price-breed-search__reset" data-price-search-reset hidden>${escapeHtml(searchFilterCopy.reset)}</button>
            </div>
            <div class="price-breed-search__suggestions" data-price-breed-search-suggestions hidden>
              <p class="price-breed-search__suggestions-title" data-price-breed-search-suggestions-title>${escapeHtml(locale.searchSuggestionsLabel || 'Possible breeds')}</p>
              <ul class="price-breed-search__suggestions-list" id="price-breed-search-suggestions" role="listbox" data-price-breed-search-suggestions-list></ul>
            </div>
            <p class="price-breed-search__status" data-price-breed-search-status aria-live="polite"></p>
          </div>
        </div>
      </div>
      <nav class="price-page-hero__actions" aria-label="${escapeHtml(locale.heroCategoriesAction || 'View categories')}">
        ${categoryNavigationKeys.map(sectionKey => `
          <button
            type="button"
            class="price-page-hero__categories-action online-order-pill"
            data-nav-pill="price-categories-action"
            data-price-categories-action
            data-price-section-action="${escapeHtml(sectionKey)}"
            aria-controls="price-section-${escapeHtml(sectionKey)}"
          >
            <span>${escapeHtml(locale.sizeGroupTitles?.[sectionKey] || sectionKey)}</span>
            <span class="price-page-hero__categories-action-icon" aria-hidden="true">
              <span class="site-icon-arrow site-icon-arrow-right"></span>
            </span>
          </button>`).join('')}
      </nav>
    `;
  };

  // Render the page heading before constructing the comparatively large modal and card DOM.
  // This gives the browser a stable, meaningful first paint instead of an empty hero.
  renderHero();

  const parsePriceAmount = price => {
    const normalized = String(price || '').replace(',', '.');
    if (!/(?:€|\beur\b|\b(?:ab|from|от|від)\b)/i.test(normalized)) return null;
    const match = normalized.match(/(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : null;
  };

  const amountNumberLocale = {
    de: 'de-DE',
    en: 'en-GB',
    ru: 'ru-RU',
    uk: 'uk-UA',
  }[lang] || 'en-GB';
  const formatAmountValue = amount => new Intl.NumberFormat(amountNumberLocale, {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);

  const formatFromAmount = amount => {
    const value = formatAmountValue(amount);
    if (lang === 'de') return `ab ${value} €`;
    if (lang === 'en') return `from €${value}`;
    if (lang === 'uk') return `від ${value} €`;
    return `от ${value} €`;
  };

  const formatExactAmount = amount => {
    const value = formatAmountValue(amount);
    return lang === 'en' ? `€${value}` : `${value} €`;
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
  const DENTAL_SERVICE_INDEX = 3;
  const DENTAL_MAX_WEIGHT_KG = 6;
  const DENTAL_GROOMING_DISCOUNT_RATE = 0.3;
  const CURRENCY_MINOR_UNITS = 100;
  const isDentalService = service => service?.index === DENTAL_SERVICE_INDEX;
  const roundCurrencyAmount = amount => Math.round((amount + Number.EPSILON) * CURRENCY_MINOR_UNITS) / CURRENCY_MINOR_UNITS;
  const calculateQuoteAmounts = ({ selectedPrimaryServices, selectedAdditionalServices, dentalWeightValid, breedSurcharge = 0 }) => {
    const selectedServices = [...selectedPrimaryServices, ...selectedAdditionalServices];
    const amounts = selectedServices.map(service => parsePriceAmount(service.price));
    const hasRequestPrice = amounts.some(amount => amount === null);
    const subtotalAmount = roundCurrencyAmount(amounts.reduce((sum, amount) => sum + (amount || 0), 0));
    const dentalService = selectedAdditionalServices.find(isDentalService);
    const dentalBaseAmount = dentalService ? parsePriceAmount(dentalService.price) : null;
    const dentalDiscountEligible = Boolean(
      selectedPrimaryServices.length
      && dentalWeightValid
      && dentalService
      && Number.isFinite(dentalBaseAmount)
    );
    const dentalDiscountAmount = dentalDiscountEligible
      ? roundCurrencyAmount(dentalBaseAmount * DENTAL_GROOMING_DISCOUNT_RATE)
      : 0;
    const surchargeAmount = selectedServices.length && !hasRequestPrice && Number.isFinite(Number(breedSurcharge))
      ? roundCurrencyAmount(Number(breedSurcharge))
      : 0;
    const totalAmount = roundCurrencyAmount(subtotalAmount - dentalDiscountAmount + surchargeAmount);

    return {
      selectedServices,
      hasRequestPrice,
      subtotalAmount,
      dentalBaseAmount,
      dentalDiscountAmount,
      surchargeAmount,
      totalAmount,
    };
  };
  const DOG_CATEGORY_IDS = new Set([
    'ru-small-growing-coat',
    'ru-poodles-bichons',
    'ru-spitz',
    'ru-spaniels',
    'ru-wire-coat',
    'ru-short-coat',
    'ru-short-coat-small',
    'ru-short-coat-medium',
    'ru-short-coat-large',
    'ru-double-coat-medium',
    'ru-double-coat-large',
    'ru-large-dogs',
    ...sourceCategories.filter(category => category.animalType === 'dog').map(category => category.id),
  ]);
  const additionalServiceIndexesByGroup = {
    small: [0, 3, 4, 5],
    medium: [1, 4, 5],
    large: [2, 4, 5],
    mixed: [0, 1, 2, 4, 5],
  };

  const getAdditionalServices = (category, selectedBreed = null) => {
    if (!bookingCatalog || !category) return [];
    const sourceCategoryId = category.sourceId || category.id;
    const services = bookingCatalog.getServices(ADDITIONAL_CATEGORY_ID);
    if (sourceCategoryId === ADDITIONAL_CATEGORY_ID) {
      const selectedBreedCategoryId = selectedBreed?.categoryId || null;
      return services.filter(service => {
        if (service.key !== 'trimming') return true;
        return selectedBreedCategoryId === 'ru-wire-coat';
      });
    }
    if (sourceCategoryId === 'ru-small-animals') {
      return services.filter(service => service.index === 0);
    }
    if (!DOG_CATEGORY_IDS.has(sourceCategoryId)) return [];
    const serviceGroup = category.additionalServiceGroup || category.groupKey;
    const allowedIndexes = additionalServiceIndexesByGroup[serviceGroup] || [];
    const selectedBreedCategoryId = selectedBreed?.categoryId || null;
    return services.filter(service => {
      if (!allowedIndexes.includes(service.index)) return false;
      if (service.key === 'trimming') return selectedBreedCategoryId === 'ru-wire-coat';
      return true;
    });
  };

  const getAdditionalServiceNotes = category => {
    if ((category?.sourceId || category?.id) === 'ru-small-animals') return [];
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
    const cardDetailsId = `price-card-details-${category.id}`;
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
          <button type="button" class="price-card__badge price-card__badge--button btn-neon" data-nav-pill="price-breed" data-price-breeds-toggle="${escapeHtml(breedMenuId)}" data-price-breed-sample="${escapeHtml(allBreeds[0] || '')}" aria-expanded="false" aria-controls="${escapeHtml(breedMenuId)}" aria-label="${escapeHtml(isAdditionalCategory ? locale.additionalCategoryMenuLabel : locale.showBreedsLabel || locale.cardCountSuffix)}">
            <span class="price-card__badge-count"><span class="price-card__badge-word">${escapeHtml(breedCountText.word)}:</span><span class="price-card__badge-number price-number">${escapeHtml(breedCountText.value)}</span></span>
            <span class="price-card__badge-icon-motion" aria-hidden="true"><span class="price-card__badge-icon"></span></span>
          </button>
          <div class="price-card__breed-menu" id="${escapeHtml(breedMenuId)}" hidden>
            <p class="price-card__breed-menu-title">${escapeHtml(isAdditionalCategory ? locale.additionalCategoryMenuLabel : locale.chooseBreedLabel || locale.cardCountSuffix)}</p>
            <ul class="price-card__breed-list" id="${escapeHtml(breedListId)}" data-price-breed-list></ul>
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
      <article class="price-card" data-category-id="${escapeHtml(category.id)}" data-price-card-expanded="false">
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
        <button type="button" class="price-card__mobile-toggle" data-price-card-toggle aria-expanded="false" aria-controls="${escapeHtml(cardDetailsId)}" aria-label="${escapeHtml(`${locale.showCardDetailsLabel || locale.servicesTitle}: ${cardTitle}`)}">
          <span data-price-card-toggle-label>${escapeHtml(locale.showCardDetailsLabel || locale.servicesTitle)}</span>
          <span class="site-icon-arrow price-card__mobile-toggle-icon" aria-hidden="true"></span>
        </button>
        <div class="price-card__details" id="${escapeHtml(cardDetailsId)}" data-price-card-details>
          <div class="price-card__details-inner">
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
            <div class="price-card__footer nav-main">
              <button type="button" class="price-card__cta filter-btn" data-nav-pill="price-card-action" data-price-open="${escapeHtml(category.id)}">
                ${escapeHtml(cardActionLabel)}
              </button>
            </div>
          </div>
        </div>
      </article>
    `;
  };

  const populateBreedMenu = (card, menu) => {
    if (!card || !menu || menu.dataset.priceBreedsPopulated === 'true') return;
    const category = categoryViews.find(item => item.id === card.dataset.categoryId);
    const list = menu.querySelector('[data-price-breed-list]');
    if (!category || !list) return;

    const allBreeds = category.breeds?.[lang] || category.breeds?.en || [];
    list.innerHTML = allBreeds
      .map((item, index) => {
        const sourceIndex = category.breedIndexes?.[index] ?? index;
        const photoSubject = getBreedPhotoSubject(category, item, index, sourceIndex);
        const photo = getAnimalPhotoEntry(photoSubject?.photoKey);
        const photoAttributes = photoSubject
          ? ` data-price-breed-photo-title="${escapeHtml(photoSubject.title)}" data-price-breed-photo-language="${escapeHtml(photoSubject.language)}" data-price-breed-photo-kind="${escapeHtml(photoSubject.kind)}" data-price-breed-photo-fci="${escapeHtml(photoSubject.fciNumber || '')}" data-price-breed-photo-key="${escapeHtml(photoSubject.photoKey || '')}"`
          : '';
        const credit = getPhotoAttribution(photo);
        return `<li><button type="button" class="price-card__breed-option" data-price-breed-select data-price-breed-index="${escapeHtml(sourceIndex)}" data-price-breed-label="${escapeHtml(item)}" aria-label="${escapeHtml(item)}"${photoAttributes}>${renderAnimalPhotoThumbnail(photo, 'price-card__breed-option-media')}<span class="price-card__breed-option-copy"><span class="price-card__breed-option-name">${escapeHtml(item)}</span>${credit ? `<span class="price-card__breed-option-credit">${escapeHtml(credit)}</span>` : ''}</span></button></li>`;
      })
      .join('');
    menu.dataset.priceBreedsPopulated = 'true';
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
    <div class="price-category-modal__selection-header" data-price-modal-selection-header>
      <div class="price-category-modal__selection-head">
        <p class="price-category-modal__selection-title">${escapeHtml(locale.selectionTitle || locale.chooseBreedLabel || 'Select a breed and service')}</p>
      </div>
      <label class="price-category-modal__selection-field">
        <span>${escapeHtml(locale.breedSelectLabel || 'Choose breed')}</span>
        <select data-price-modal-breed></select>
      </label>
    </div>
    <figure class="price-category-modal__breed-photo" data-price-modal-breed-photo hidden>
      <span class="price-category-modal__breed-photo-media">
        <img data-price-modal-breed-photo-image alt="" width="720" height="540" decoding="async" />
      </span>
      <figcaption class="price-category-modal__breed-photo-caption">
        <strong data-price-modal-breed-photo-name></strong>
        <span data-price-modal-breed-photo-credit></span>
        <a data-price-modal-breed-photo-source target="_blank" rel="noopener noreferrer">${escapeHtml(breedPhotoCopy.viewSource)}</a>
      </figcaption>
    </figure>
    <div class="price-category-modal__selection-controls" data-price-modal-selection-controls>
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
      <div class="price-category-modal__dental-weight" data-price-modal-dental-weight hidden>
        <label for="price-modal-dental-weight-input">${escapeHtml(locale.dentalWeightLabel || 'Dog weight for ultrasonic teeth cleaning (kg)')}</label>
        <input id="price-modal-dental-weight-input" type="number" min="0.1" max="${DENTAL_MAX_WEIGHT_KG}" step="0.1" inputmode="decimal" data-price-modal-dental-weight-input aria-describedby="price-modal-dental-weight-status" disabled />
        <p id="price-modal-dental-weight-status" data-price-modal-dental-weight-status aria-live="polite"></p>
      </div>
      <div class="price-category-modal__calculation" aria-live="polite">
        <p class="price-category-modal__calculation-label" data-price-modal-calculation-label>${escapeHtml(locale.calculationLabel || 'Calculation')}</p>
        <ul class="price-category-modal__breakdown" data-price-modal-breakdown></ul>
        <p class="price-category-modal__selection-price" data-price-modal-selected-price></p>
        <p class="price-category-modal__calculation-note" data-price-modal-calculation-note></p>
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
  const modalSelectionHeader = modalSelection.querySelector('[data-price-modal-selection-header]');
  const modalBreedSelect = modalSelection.querySelector('[data-price-modal-breed]');
  const modalBreedPhoto = modalSelection.querySelector('[data-price-modal-breed-photo]');
  const modalBreedPhotoImage = modalSelection.querySelector('[data-price-modal-breed-photo-image]');
  const modalBreedPhotoName = modalSelection.querySelector('[data-price-modal-breed-photo-name]');
  const modalBreedPhotoCredit = modalSelection.querySelector('[data-price-modal-breed-photo-credit]');
  const modalBreedPhotoSource = modalSelection.querySelector('[data-price-modal-breed-photo-source]');
  const modalServiceHint = modalSelection.querySelector('[data-price-modal-service-hint]');
  const modalServiceLegend = modalSelection.querySelector('[data-price-modal-service-legend]');
  const modalServiceFieldset = modalSelection.querySelector('[data-price-modal-service-fieldset]');
  const modalServiceOptions = modalSelection.querySelector('[data-price-modal-service-options]');
  const modalDentalWeight = modalSelection.querySelector('[data-price-modal-dental-weight]');
  const modalDentalWeightInput = modalSelection.querySelector('[data-price-modal-dental-weight-input]');
  const modalDentalWeightStatus = modalSelection.querySelector('[data-price-modal-dental-weight-status]');
  const modalAdditionalServiceFieldset = modalSelection.querySelector('[data-price-modal-additional-service-fieldset]');
  const modalAdditionalServiceLegend = modalSelection.querySelector('[data-price-modal-additional-service-legend]');
  const modalAdditionalServiceHint = modalSelection.querySelector('[data-price-modal-additional-service-hint]');
  const modalAdditionalServiceOptions = modalSelection.querySelector('[data-price-modal-additional-service-options]');
  const modalSelectedPrice = modalSelection.querySelector('[data-price-modal-selected-price]');
  const modalBreakdown = modalSelection.querySelector('[data-price-modal-breakdown]');
  const modalCalculationNote = modalSelection.querySelector('[data-price-modal-calculation-note]');
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
      const hasValidDentalWeight = modalBooking.dataset.bookingDentalWeightValid !== 'false';
      modalBooking.setAttribute('aria-disabled', String(
        !hasSelectedService || !hasValidDentalWeight || !modalServiceConditionsConsent.checked
      ));
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
      <header class="client-registration-modal__header">
        <button type="button" class="modal-close client-registration-modal__close" data-client-registration-close aria-label="${escapeHtml(locale.closeLabel || 'Close')}" >&times;</button>
        <p class="section-kicker" data-client-registration-kicker></p>
        <h2 class="section-title" data-client-registration-title></h2>
        <p class="client-registration-modal__lead" data-client-registration-lead></p>
      </header>
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
  const catCoatLabels = {
    long: { de: 'Langhaar', en: 'Long-haired', ru: 'Длинная шерсть', uk: 'Довга шерсть' },
    short: { de: 'Kurzhaar', en: 'Short-haired', ru: 'Короткая шерсть', uk: 'Коротка шерсть' },
    double: { de: 'Doppeltes Fell', en: 'Double coat', ru: 'Двойной тип шерсти', uk: 'Подвійний тип шерсті' },
  };
  const animalSizeLabels = {
    small: { de: 'klein', en: 'small', ru: 'маленький', uk: 'малий' },
    medium: { de: 'mittel', en: 'medium', ru: 'средний', uk: 'середній' },
    large: { de: 'groß', en: 'large', ru: 'большой', uk: 'великий' },
  };
  const weightUnit = { de: 'kg', en: 'kg', ru: 'кг', uk: 'кг' }[lang] || 'kg';
  const formatWeight = value => new Intl.NumberFormat(amountNumberLocale, { maximumFractionDigits: 2 }).format(value);
  const getBreedMetadataSummary = selectedBreed => {
    const metadata = selectedBreed?.metadata;
    if (!metadata) return '';
    const weight = metadata.weightKg?.min && metadata.weightKg?.max
      ? `${formatWeight(metadata.weightKg.min)}–${formatWeight(metadata.weightKg.max)} ${weightUnit}`
      : '';
    const parts = [
      weight && `${locale.breedWeightLabel || 'Adult weight'}: ${weight}`,
      metadata.coatType && `${locale.breedCoatLabel || 'Coat type'}: ${catCoatLabels[metadata.coatType]?.[lang] || metadata.coatType}`,
      metadata.sizeClass && `${locale.breedSizeLabel || 'Size'}: ${animalSizeLabels[metadata.sizeClass]?.[lang] || metadata.sizeClass}`,
      Number(metadata.surcharge) > 0 && `${locale.breedSurchargeLabel || 'Breed surcharge'}: +${formatExactAmount(Number(metadata.surcharge))}`,
    ].filter(Boolean);
    return parts.length ? ` · ${parts.join(', ')}` : '';
  };

  const getServiceDetails = (category, selectedServices, selectionMode = 'primary', selectedBreed = null) => {
    if (!category || !selectedServices.length) return [];
    const sourceCategoryId = category.sourceId || category.id;
    if (selectionMode === 'additional' && sourceCategoryId !== ADDITIONAL_CATEGORY_ID) {
      return getAdditionalServiceNotes(category);
    }
    if (sourceCategoryId !== ADDITIONAL_CATEGORY_ID) {
      if (selectedServices.every(service => service.key === 'puppy-intro')) {
        const puppyService = global.PriceCatalog?.build?.(lang)?.services.find(service => service.key === 'puppy-intro');
        if (puppyService) return [puppyService.note, puppyService.description].filter(Boolean);
      }
      const breedNotes = selectedBreed ? category.breedNotes?.[selectedBreed.index] : null;
      const notes = (breedNotes || category.notes || []).map(note => getText(note)).filter(Boolean);
      if (breedNotes) return notes;
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
    if (modalSelectionHeader) modalSelectionHeader.hidden = informationMode;
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
      ? `${conditions.breedLabel || locale.breedContextLabel || ''}: ${selectedBreed.label}${getBreedMetadataSummary(selectedBreed)}`
      : '';
    if (modalServiceConditionsService) modalServiceConditionsService.textContent = !informationMode
      ? `${conditions.serviceLabel || locale.servicesTitle || ''}: ${serviceLabels.join(' + ') || conditions.noService || ''}`
      : '';
    const selectionMode = modalBreedSelect?.dataset.selectionMode || 'primary';
    const primaryDetails = selectedPrimaryServices.length
      ? getServiceDetails(category, selectedPrimaryServices, selectionMode, selectedBreed)
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

  const NAIL_TRIM_SERVICE_INDEXES = new Set([0, 1, 2]);

  const getDentalWeight = () => {
    const normalized = String(modalDentalWeightInput?.value || '').replace(',', '.');
    const value = Number.parseFloat(normalized);
    return Number.isFinite(value) && value > 0 ? value : null;
  };

  const syncDentalEligibility = additionalServices => {
    const dentalService = additionalServices.find(isDentalService);
    const dentalInput = dentalService && modalAdditionalServiceOptions
      ? Array.from(modalAdditionalServiceOptions.querySelectorAll('input[type="checkbox"]'))
        .find(input => input.value === dentalService.id)
      : null;
    const dentalOption = dentalInput?.closest('.price-category-modal__service-option');
    const dentalSelected = Boolean(dentalInput?.checked);
    const weight = dentalSelected ? getDentalWeight() : null;
    const eligible = dentalSelected && weight !== null && weight <= DENTAL_MAX_WEIGHT_KG;

    if (modalDentalWeight) modalDentalWeight.hidden = !dentalSelected;
    if (modalDentalWeightInput) {
      modalDentalWeightInput.disabled = !dentalSelected;
      modalDentalWeightInput.required = dentalSelected;
      modalDentalWeightInput.setAttribute('aria-required', String(dentalSelected));
      if (dentalSelected) {
        modalDentalWeightInput.setAttribute('aria-invalid', String(!eligible));
      } else {
        modalDentalWeightInput.removeAttribute('aria-invalid');
      }
    }
    if (modalDentalWeightStatus) {
      modalDentalWeightStatus.textContent = !dentalSelected
        ? ''
        : weight === null
          ? locale.dentalWeightRequired || ''
          : eligible
            ? locale.dentalWeightEligible || ''
            : locale.dentalWeightTooHigh || '';
      if (dentalSelected) {
        modalDentalWeightStatus.dataset.state = weight === null ? 'required' : eligible ? 'eligible' : 'ineligible';
      } else {
        modalDentalWeightStatus.removeAttribute('data-state');
      }
    }

    if (dentalInput) {
      dentalInput.disabled = false;
    }
    dentalOption?.classList.remove('is-disabled');
    dentalOption?.removeAttribute('aria-disabled');
    return !dentalSelected || eligible;
  };

  const syncAdditionalNailTrimVisibility = (additionalServices, selectedPrimaryServices) => {
    if (!modalAdditionalServiceOptions) return;
    const nailsIncluded = selectedPrimaryServices.some(service => service.includesNailTrim);
    const additionalServiceById = new Map(additionalServices.map(service => [service.id, service]));

    modalAdditionalServiceOptions.querySelectorAll('label.price-category-modal__service-option').forEach(option => {
      const input = option.querySelector('input[type="checkbox"]');
      const service = additionalServiceById.get(input?.value);
      if (!service) return;
      const shouldHide = nailsIncluded && NAIL_TRIM_SERVICE_INDEXES.has(service.index);
      option.hidden = shouldHide;
      if (shouldHide && input.checked) input.checked = false;
    });
  };

  const updateModalQuote = (category, primaryServices, additionalServices = []) => {
    if (!bookingCatalog || !modalBreedSelect || !modalSelectedPrice || !modalBooking) return;
    const sourceCategoryId = category.sourceId || category.id;
    const selectedBreed = bookingCatalog.getBreed(modalBreedSelect.value);
    const selectedPrimaryServices = getSelectedServices(primaryServices, modalServiceOptions);
    syncAdditionalNailTrimVisibility(additionalServices, selectedPrimaryServices);
    const dentalWeightValid = syncDentalEligibility(additionalServices);
    const selectedAdditionalServices = getSelectedServices(additionalServices, modalAdditionalServiceOptions);
    const {
      selectedServices,
      hasRequestPrice,
      subtotalAmount,
      dentalBaseAmount,
      dentalDiscountAmount,
      surchargeAmount,
      totalAmount,
    } = calculateQuoteAmounts({
      selectedPrimaryServices,
      selectedAdditionalServices,
      dentalWeightValid,
      breedSurcharge: sourceCategoryId === 'ru-cats-grooming' ? Number(selectedBreed?.metadata?.surcharge) || 0 : 0,
    });
    const priceText = !selectedServices.length
      ? locale.chooseServiceLabel || locale.selectServicesLabel || 'Choose a service'
      : hasRequestPrice
        ? locale.priceOnRequestLabel || locale.noPriceLabel
        : selectedServices.length === 1 && !surchargeAmount
          ? selectedServices[0].price
          : formatFromAmount(totalAmount);

    if (modalSelectedPrice) {
      const hasNumericTotal = Boolean(selectedServices.length && !hasRequestPrice);
      const totalLabel = hasNumericTotal
        ? locale.totalFromLabel || locale.selectedPriceLabel || 'Total from'
        : locale.selectedPriceLabel || locale.calculationLabel || 'Price';
      const totalValue = hasNumericTotal ? formatExactAmount(totalAmount) : priceText;
      modalSelectedPrice.innerHTML = `<span class="price-category-modal__selection-price-label">${escapeHtml(totalLabel)}</span><strong>${renderCurrencyText(totalValue)}</strong>`;
      modalSelectedPrice.dataset.totalAmount = hasNumericTotal ? String(totalAmount) : '';
    }
    if (modalBreakdown) {
      const serviceRows = selectedServices
        .map(service => `<li class="price-category-modal__breakdown-service"><span>${escapeHtml(service.label)}</span><strong>${renderCurrencyText(service.price || locale.priceOnRequestLabel || locale.noPriceLabel)}</strong></li>`)
        .join('');
      const subtotalRow = selectedServices.length > 1 && !hasRequestPrice
        ? `<li class="price-category-modal__breakdown-subtotal" data-price-subtotal-amount="${escapeHtml(subtotalAmount)}"><span>${escapeHtml(locale.subtotalBeforeDiscountLabel || 'Subtotal before discount')}</span><strong>${renderCurrencyText(formatFromAmount(subtotalAmount))}</strong></li>`
        : '';
      const discountRow = dentalDiscountAmount > 0
        ? `<li class="price-category-modal__breakdown-discount" data-price-discount-base="${escapeHtml(dentalBaseAmount)}" data-price-discount-rate="${DENTAL_GROOMING_DISCOUNT_RATE}" data-price-discount-amount="${escapeHtml(dentalDiscountAmount)}"><span><span>${escapeHtml(locale.dentalDiscountLabel || '30% dental discount')}</span><small class="price-category-modal__breakdown-formula">${renderCurrencyText(`${formatExactAmount(dentalBaseAmount)} × ${DENTAL_GROOMING_DISCOUNT_RATE * 100}% = ${formatExactAmount(dentalDiscountAmount)}`)}</small></span><strong>−${renderCurrencyText(formatExactAmount(dentalDiscountAmount))}</strong></li>`
        : '';
      const surchargeRow = surchargeAmount > 0
        ? `<li class="price-category-modal__breakdown-surcharge" data-price-surcharge-amount="${escapeHtml(surchargeAmount)}"><span>${escapeHtml(locale.breedSurchargeLabel || 'Breed surcharge')}</span><strong>+${renderCurrencyText(formatExactAmount(surchargeAmount))}</strong></li>`
        : '';
      modalBreakdown.innerHTML = `${serviceRows}${subtotalRow}${discountRow}${surchargeRow}`;
    }
    if (modalCalculationNote) {
      const calculationNotes = [
        dentalDiscountAmount > 0 ? locale.dentalDiscountTerms : '',
        surchargeAmount > 0 ? locale.breedSurchargeLabel : '',
        locale.calculationNote,
      ].filter(Boolean);
      modalCalculationNote.textContent = calculationNotes.join(' ');
      modalCalculationNote.hidden = !calculationNotes.length;
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
    modalBooking.dataset.bookingPromotionKey = dentalDiscountAmount > 0 ? 'ultrasonic-dental-grooming-30' : '';
    modalBooking.dataset.bookingPromotionLabel = dentalDiscountAmount > 0 ? locale.dentalDiscountLabel || '' : '';
    modalBooking.dataset.bookingPromotionPrice = dentalDiscountAmount > 0 ? `−${formatExactAmount(dentalDiscountAmount)}` : '';
    modalBooking.dataset.bookingDentalWeightValid = String(dentalWeightValid);
    modalBooking.dataset.bookingPetSpecies = getPetSpecies(category, selectedBreed).key;
    updateServiceConditions(category, selectedBreed, selectedServices, priceText, selectedPrimaryServices, selectedAdditionalServices);
    const hasConsent = Boolean(modalServiceConditionsConsent?.checked);
    modalBooking.setAttribute('aria-disabled', String(!selectedServices.length || !dentalWeightValid || !hasConsent));
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
      label.dataset.serviceIndex = String(service.index);
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

  const syncModalBreedPhoto = () => {
    if (!modalBreedPhoto || !modalBreedPhotoImage || !modalBreedSelect) return;
    const selectedOption = modalBreedSelect.selectedOptions?.[0];
    const photo = getAnimalPhotoEntry(selectedOption?.dataset.priceBreedPhotoKey || '');
    if (!selectedOption || !photo) {
      modalBreedPhoto.hidden = true;
      modalBreedPhotoImage.removeAttribute('src');
      return;
    }

    const breedName = selectedOption.textContent?.trim() || '';
    modalBreedPhotoName.textContent = breedName;
    modalBreedPhotoCredit.textContent = getPhotoAttribution(photo);
    modalBreedPhotoImage.alt = breedName;
    modalBreedPhotoImage.src = photo.src;

    const sourceUrl = photo.sourceUrl || photo.licenseUrl || '';
    if (modalBreedPhotoSource) {
      const hasSourceUrl = /^https:\/\//i.test(sourceUrl);
      modalBreedPhotoSource.hidden = !hasSourceUrl;
      if (hasSourceUrl) modalBreedPhotoSource.href = sourceUrl;
      else modalBreedPhotoSource.removeAttribute('href');
    }
    modalBreedPhoto.hidden = false;
  };

  modalBreedPhotoImage?.addEventListener('error', () => {
    modalBreedPhoto.hidden = true;
    modalBreedPhotoImage.removeAttribute('src');
  });

  const updateModalBookingSelection = (category, preferredBreedIndex = null, preferredServiceIndex = null, selectionMode = 'primary') => {
    if (!bookingCatalog || !modalBreedSelect || !modalServiceOptions || !modalSelectedPrice || !modalBooking) return;
    const sourceCategoryId = category.sourceId || category.id;
    const bookingCategory = bookingCatalog.getCategory(sourceCategoryId);
    if (!bookingCategory) return;
    const isAdditionalSelection = selectionMode === 'additional';
    const resolvedPreferredBreedIndex = Number.isInteger(preferredBreedIndex)
      ? preferredBreedIndex
      : bookingCategory.source.breedServiceRows && Number.isInteger(preferredServiceIndex)
        ? bookingCategory.breeds.find(breed => bookingCatalog.getServices(sourceCategoryId, breed.id)
          .some(service => service.index === preferredServiceIndex))?.index ?? null
      : sourceCategoryId === 'ru-short-coat' && Number.isInteger(preferredServiceIndex)
        ? bookingCategory.breeds.find(breed => breed.serviceIndex === preferredServiceIndex)?.index ?? 0
        : null;

    if (modalBreedSelect.dataset.categoryId !== category.id) {
      modalBreedSelect.replaceChildren();
      modalBreedSelect.dataset.categoryId = category.id;
      const breedIndexes = new Set(category.breedIndexes || bookingCategory.breeds.map(breed => breed.index));
      bookingCategory.breeds.filter(breed => breedIndexes.has(breed.index)).forEach(breed => {
        const option = document.createElement('option');
        option.value = breed.id;
        option.textContent = breed.label;
        const photo = getAnimalPhotoRecord(category, breed.label, breed.index, breed.index);
        if (photo) option.dataset.priceBreedPhotoKey = photo.key;
        modalBreedSelect.appendChild(option);
      });
    }

    if (Number.isInteger(resolvedPreferredBreedIndex)) {
      const preferredBreedId = `${sourceCategoryId}:breed:${resolvedPreferredBreedIndex}`;
      if (Array.from(modalBreedSelect.options).some(option => option.value === preferredBreedId)) {
        modalBreedSelect.value = preferredBreedId;
      }
    }
    window.refreshSiteSelect?.(modalBreedSelect);
    syncModalBreedPhoto();

    const serviceIndexes = new Set(category.priceIndexes || bookingCategory.services.map(service => service.index));
    const primaryServices = isAdditionalSelection
      ? []
      : bookingCatalog
        .getServices(sourceCategoryId, modalBreedSelect.value)
        .filter(service => serviceIndexes.has(service.index));
    const selectedBreed = isAdditionalSelection
      ? null
      : bookingCatalog.getBreed(modalBreedSelect.value);
    const additionalServices = isAdditionalSelection || sourceCategoryId !== ADDITIONAL_CATEGORY_ID
      ? getAdditionalServices(category, selectedBreed)
      : [];
    const allowMultiplePrimary = isAdditionalSelection || sourceCategoryId === ADDITIONAL_CATEGORY_ID;
    const preferredServiceId = Number.isInteger(preferredServiceIndex)
      ? `${isAdditionalSelection ? ADDITIONAL_CATEGORY_ID : sourceCategoryId}:service:${preferredServiceIndex}`
      : '';
    state.primaryServices = primaryServices;
    state.additionalServices = additionalServices;

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
    primaryServices: [],
    additionalServices: [],
  };

  modalDentalWeightInput?.addEventListener('input', () => {
    if (!state.activeCategory) return;
    updateModalQuote(state.activeCategory, state.primaryServices, state.additionalServices);
  });

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
      ? getAdditionalServices(category, selectedBreed)
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
    if (modalDentalWeightInput) modalDentalWeightInput.value = '';
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

  window.HundesalonNavPill?.scan?.(heroRoot);
  const categoriesActions = Array.from(heroRoot.querySelectorAll('[data-price-section-action]'));
  const searchInput = heroRoot.querySelector('[data-price-breed-search-input]');
  const searchClear = heroRoot.querySelector('[data-price-breed-search-clear]');
  const searchSuggestions = heroRoot.querySelector('[data-price-breed-search-suggestions]');
  const searchSuggestionsList = heroRoot.querySelector('[data-price-breed-search-suggestions-list]');
  const searchStatus = heroRoot.querySelector('[data-price-breed-search-status]');
  const searchFilterSelects = Array.from(heroRoot.querySelectorAll('[data-price-search-filter]'));
  const searchResultCount = heroRoot.querySelector('[data-price-search-result-count]');
  const searchReset = heroRoot.querySelector('[data-price-search-reset]');
  const SEARCH_MIN_CHARS = 2;
  const searchFilterState = { animal: 'all', size: 'all', coat: 'all' };

  const normalizeSearch = value => String(value || '')
    .toLocaleLowerCase(lang)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const normalizeBreedTokens = value => normalizeSearch(value).split(/[\s/–—-]+/u).filter(Boolean);
  const breedSearchCollator = new Intl.Collator(lang, { sensitivity: 'base', numeric: true });
  const getMaxFuzzyDistance = token => {
    if (token.length >= 9) return 2;
    if (token.length >= 4) return 1;
    return 0;
  };
  const getEditDistance = (left, right, maxDistance) => {
    if (left === right) return 0;
    if (Math.abs(left.length - right.length) > maxDistance) return maxDistance + 1;

    let previousPrevious = null;
    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      const current = [leftIndex];
      for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
        const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
        let distance = Math.min(
          current[rightIndex - 1] + 1,
          previous[rightIndex] + 1,
          previous[rightIndex - 1] + substitutionCost
        );
        if (
          previousPrevious
          && leftIndex > 1
          && rightIndex > 1
          && left[leftIndex - 1] === right[rightIndex - 2]
          && left[leftIndex - 2] === right[rightIndex - 1]
        ) {
          distance = Math.min(distance, previousPrevious[rightIndex - 2] + 1);
        }
        current[rightIndex] = distance;
      }
      previousPrevious = previous;
      previous = current;
    }
    return previous[right.length];
  };
  const getBreedTokenScore = (candidateToken, queryToken) => {
    if (candidateToken.startsWith(queryToken)) return 0;
    const maxDistance = getMaxFuzzyDistance(queryToken);
    if (!maxDistance) return Number.POSITIVE_INFINITY;

    let distance = getEditDistance(queryToken, candidateToken, maxDistance);
    if (candidateToken.length > queryToken.length) {
      distance = Math.min(
        distance,
        getEditDistance(queryToken, candidateToken.slice(0, queryToken.length), maxDistance)
      );
    }
    return distance <= maxDistance ? 10 + distance : Number.POSITIVE_INFINITY;
  };
  const getBreedSearchTokens = label => {
    const aliases = locale.breedSearchAliases?.[label] || [];
    return [...new Set([label, ...aliases].flatMap(normalizeBreedTokens))];
  };

  const getSearchAnimalType = category => {
    if (category.animalType === 'dog' || ['small', 'medium', 'large'].includes(category.groupKey)) return 'dog';
    if (category.groupKey === 'cats') return 'cat';
    if (category.groupKey === 'smallAnimals') return 'smallAnimals';
    return 'other';
  };
  const matchesSearchFilters = match => {
    if (searchFilterState.animal !== 'all' && match.animalType !== searchFilterState.animal) return false;
    if (searchFilterState.size !== 'all' && (match.animalType !== 'dog' || match.size !== searchFilterState.size)) return false;
    if (searchFilterState.coat !== 'all' && (match.animalType !== 'dog' || match.coat !== searchFilterState.coat)) return false;
    return true;
  };
  const hasActiveSearchFilters = () => Object.values(searchFilterState).some(value => value !== 'all');

  const breedSearchMatches = categoryViews
    .filter(category => getSearchAnimalType(category) !== 'other')
    .flatMap(category => {
      const animalType = getSearchAnimalType(category);
      return (category.breeds?.[lang] || category.breeds?.en || []).map((label, index) => {
        const breedIndex = category.breedIndexes?.[index] ?? index;
        const photo = getAnimalPhotoRecord(category, label, index, breedIndex);
        return {
          id: `${category.id}:${breedIndex}`,
          label,
          normalizedTokens: getBreedSearchTokens(label),
          categoryId: category.id,
          breedIndex,
          categoryLabel: getText(category.title),
          sectionLabel: locale.sizeGroupTitles?.[category.groupKey] || locale.servicesTitle,
          animalType,
          size: animalType === 'dog' ? category.groupKey : '',
          coat: animalType === 'dog' ? category.coatType || '' : '',
          photoKey: photo?.key || '',
        };
      });
    });

  const findBreedMatches = query => {
    const normalizedQuery = normalizeSearch(query);
    if (normalizedQuery.length < SEARCH_MIN_CHARS) return breedSearchMatches.filter(matchesSearchFilters);
    const queryTokens = normalizeBreedTokens(query);
    return breedSearchMatches
      .map(match => ({
        match,
        score: queryTokens.reduce((total, queryToken) => {
          const tokenScore = Math.min(
            ...match.normalizedTokens.map(token => getBreedTokenScore(token, queryToken))
          );
          return total + tokenScore;
        }, 0),
      }))
      .filter(result => Number.isFinite(result.score))
      .sort((left, right) =>
        left.score - right.score
        || breedSearchCollator.compare(left.match.label, right.match.label)
        || left.match.id.localeCompare(right.match.id)
      )
      .map(result => result.match)
      .filter(matchesSearchFilters);
  };

  let activeSuggestionIndex = -1;
  const closeBreedSuggestions = () => {
    if (searchSuggestions) searchSuggestions.hidden = true;
    searchInput?.setAttribute('aria-expanded', 'false');
    searchInput?.removeAttribute('aria-activedescendant');
    activeSuggestionIndex = -1;
    searchSuggestionsList?.querySelectorAll('[data-price-breed-result]')
      .forEach(option => option.setAttribute('aria-selected', 'false'));
  };

  const getBreedSuggestionOptions = () => Array.from(
    searchSuggestionsList?.querySelectorAll('[data-price-breed-result]') || []
  );
  const setActiveBreedSuggestion = index => {
    const options = getBreedSuggestionOptions();
    if (!options.length) {
      activeSuggestionIndex = -1;
      searchInput?.removeAttribute('aria-activedescendant');
      return;
    }
    activeSuggestionIndex = (index + options.length) % options.length;
    options.forEach((option, optionIndex) => {
      const selected = optionIndex === activeSuggestionIndex;
      option.setAttribute('aria-selected', String(selected));
      if (selected) option.scrollIntoView({ block: 'nearest' });
    });
    searchInput?.setAttribute('aria-activedescendant', options[activeSuggestionIndex].id);
  };

  const renderBreedSuggestions = (query, providedMatches) => {
    const normalizedQuery = normalizeSearch(query);
    const matches = providedMatches || findBreedMatches(query);
    activeSuggestionIndex = -1;
    searchInput?.removeAttribute('aria-activedescendant');
    if (searchSuggestionsList) {
      searchSuggestionsList.innerHTML = matches
        .map(
          (match, index) => `
            <li class="price-breed-search__suggestion-item">
              <button type="button" class="price-breed-search__suggestion" id="price-breed-search-option-${index}" role="option" aria-selected="false" tabindex="-1" data-price-breed-result data-price-breed-result-category="${escapeHtml(match.categoryId)}" data-price-breed-result-index="${escapeHtml(match.breedIndex)}">
                ${renderAnimalPhotoThumbnail(getAnimalPhotoEntry(match.photoKey), 'price-breed-search__suggestion-media')}
                <span class="price-breed-search__suggestion-copy">
                  <span class="price-breed-search__suggestion-name">${escapeHtml(match.label)}</span>
                  <span class="price-breed-search__suggestion-category">${escapeHtml(match.sectionLabel)} · ${escapeHtml(match.categoryLabel)}</span>
                </span>
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
              <div class="price-size-section__category" id="price-section-${escapeHtml(categoryKey)}" data-price-section-target="${escapeHtml(categoryKey)}">
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
        <section class="price-size-section${sectionClass}" id="price-section-${escapeHtml(sectionKey)}" data-price-section="${escapeHtml(sectionKey)}" data-price-section-target="${escapeHtml(sectionKey)}"${gridAttribute}>
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

  let cardAlignmentFrame = 0;
  const alignPriceCardMetaRows = () => {
    cardAlignmentFrame = 0;
    const allTops = Array.from(cardsRoot.querySelectorAll('.price-card__top'));
    allTops.forEach(top => top.style.removeProperty('min-height'));
    if (window.matchMedia('(max-width: 720px)').matches) return;

    // Measure only after the reset has reached layout, then apply all writes together.
    cardAlignmentFrame = window.requestAnimationFrame(() => {
      cardAlignmentFrame = 0;
      const standaloneCardGrids = Array.from(cardsRoot.querySelectorAll('.price-size-section__cards'))
        .filter(grid => !grid.closest('.price-size-section__category-grid'));
      const alignmentRoots = [
        ...standaloneCardGrids,
        ...cardsRoot.querySelectorAll('.price-size-section__category-grid'),
      ];
      const updates = [];

      alignmentRoots.forEach(root => {
        const rows = new Map();
        root.querySelectorAll('.price-card').forEach(card => {
          const top = card.querySelector('.price-card__top');
          const rect = card.getBoundingClientRect();
          if (!top || rect.width <= 0 || rect.height <= 0) return;
          const rowKey = Math.round(rect.top);
          const row = rows.get(rowKey) || [];
          row.push(top);
          rows.set(rowKey, row);
        });

        rows.forEach(row => {
          if (row.length < 2) return;
          const maxHeight = Math.ceil(Math.max(...row.map(top => top.getBoundingClientRect().height)));
          row.forEach(top => updates.push([top, maxHeight]));
        });
      });

      updates.forEach(([top, height]) => top.style.setProperty('min-height', `${height}px`));
    });
  };

  const schedulePriceCardAlignment = () => {
    window.cancelAnimationFrame(cardAlignmentFrame);
    cardAlignmentFrame = window.requestAnimationFrame(alignPriceCardMetaRows);
  };

  const mobileCardDetailsMedia = window.matchMedia('(max-width: 720px)');
  const setCardDetailsExpanded = (card, expanded, collapseSiblings = false) => {
    if (!card) return;
    if (collapseSiblings && expanded) {
      cardsRoot.querySelectorAll('.price-card[data-price-card-expanded="true"]').forEach(otherCard => {
        if (otherCard !== card) setCardDetailsExpanded(otherCard, false);
      });
    }

    const toggle = card.querySelector('[data-price-card-toggle]');
    const details = card.querySelector('[data-price-card-details]');
    if (!toggle || !details) return;

    const isMobile = mobileCardDetailsMedia.matches;
    if (!isMobile) {
      details.removeAttribute('inert');
      details.removeAttribute('aria-hidden');
      return;
    }

    const nextExpanded = expanded;
    const title = card.querySelector('.price-card__title')?.textContent?.trim() || '';
    const label = nextExpanded
      ? locale.hideCardDetailsLabel || locale.servicesTitle
      : locale.showCardDetailsLabel || locale.servicesTitle;

    card.dataset.priceCardExpanded = String(nextExpanded);
    toggle.setAttribute('aria-expanded', String(nextExpanded));
    toggle.setAttribute('aria-label', `${label}: ${title}`);
    const toggleLabel = toggle.querySelector('[data-price-card-toggle-label]');
    if (toggleLabel) toggleLabel.textContent = label;

    if (!nextExpanded) {
      details.setAttribute('inert', '');
      details.setAttribute('aria-hidden', 'true');
    } else {
      details.removeAttribute('inert');
      details.removeAttribute('aria-hidden');
    }
  };

  const syncCardDetails = () => {
    cardsRoot.querySelectorAll('.price-card').forEach(card => {
      const expanded = card.dataset.priceCardExpanded === 'true';
      setCardDetailsExpanded(card, expanded);
    });
  };

  const resetSearchFilters = () => {
    searchFilterState.animal = 'all';
    searchFilterState.size = 'all';
    searchFilterState.coat = 'all';
  };
  const syncSearchFilterControls = () => {
    searchFilterSelects.forEach(select => {
      const filterKey = select.dataset.priceSearchFilter;
      if (!Object.hasOwn(searchFilterState, filterKey)) return;
      select.value = searchFilterState[filterKey];
      select.disabled = (filterKey === 'size' || filterKey === 'coat')
        && !['all', 'dog'].includes(searchFilterState.animal);
      select.dispatchEvent(new Event('site-select:refresh'));
    });
    if (searchReset) {
      searchReset.hidden = !hasActiveSearchFilters() && !normalizeSearch(searchInput?.value);
    }
  };

  let cardsHaveRendered = false;
  const renderCards = (query, providedMatches) => {
    cardsHaveRendered = true;
    const normalizedQuery = normalizeSearch(query);
    const isTextSearchActive = normalizedQuery.length >= SEARCH_MIN_CHARS;
    const isSearchActive = isTextSearchActive || hasActiveSearchFilters();
    const matches = providedMatches || findBreedMatches(query);
    const matchingBreedIds = new Set(matches.map(match => match.categoryId));
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
    syncCardDetails();
    if (searchStatus) {
      if (!normalizedQuery) {
        searchStatus.textContent = '';
      } else if (!isTextSearchActive) {
        searchStatus.textContent = locale.searchMinChars || 'Enter at least 2 letters.';
      } else {
        searchStatus.textContent = matches.length ? '' : locale.searchEmpty || 'No matching breed found.';
      }
    }
    if (searchResultCount) searchResultCount.textContent = `${searchFilterCopy.results}: ${matches.length}`;
    if (searchClear) searchClear.hidden = !normalizedQuery;
    syncSearchFilterControls();
    window.HundesalonNavPill?.scan?.(cardsRoot);
    schedulePriceCardAlignment();
  };

  const renderInitialCards = () => {
    if (!cardsHaveRendered) renderCards('');
  };
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(renderInitialCards, { timeout: 1000 });
      } else {
        window.setTimeout(renderInitialCards, 50);
      }
    });
  });
  document.fonts?.ready?.then(schedulePriceCardAlignment);

  const navigateToPriceSection = action => {
    const sectionKey = action.dataset.priceSectionAction || '';
    if (!sectionKey) return;
    if (searchInput) searchInput.value = '';
    resetSearchFilters();
    closeBreedSuggestions();
    renderCards('', findBreedMatches(''));

    window.requestAnimationFrame(() => {
      const target = cardsRoot.querySelector(`[data-price-section-target="${sectionKey}"]`);
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

      target.querySelector(
        '[data-price-breeds-toggle], [data-price-open], [data-price-service-select], [data-price-additional-select]'
      )?.focus({ preventScroll: true });
    });
  };
  categoriesActions.forEach(action => {
    action.addEventListener('click', () => navigateToPriceSection(action));
  });

  searchFilterSelects.forEach(select => {
    select.addEventListener('change', () => {
      const filterKey = select.dataset.priceSearchFilter;
      if (!Object.hasOwn(searchFilterState, filterKey)) return;
      searchFilterState[filterKey] = select.value;
      if (filterKey === 'animal' && !['all', 'dog'].includes(select.value)) {
        searchFilterState.size = 'all';
        searchFilterState.coat = 'all';
      } else if ((filterKey === 'size' || filterKey === 'coat') && select.value !== 'all') {
        searchFilterState.animal = 'dog';
      }

      syncSearchFilterControls();
      const query = searchInput?.value || '';
      const matches = findBreedMatches(query);
      if (normalizeSearch(query).length >= SEARCH_MIN_CHARS) {
        renderBreedSuggestions(query, matches);
      } else {
        closeBreedSuggestions();
      }
      renderCards(query, matches);
    });
  });

  searchInput?.addEventListener('input', event => {
    const query = event.target.value;
    const matches = findBreedMatches(query);
    renderBreedSuggestions(query, matches);
    renderCards(query, matches);
  });
  searchClear?.addEventListener('click', () => {
    if (!searchInput) return;
    searchInput.value = '';
    closeBreedSuggestions();
    renderCards('', findBreedMatches(''));
    searchInput.focus();
  });
  searchReset?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    resetSearchFilters();
    closeBreedSuggestions();
    renderCards('', findBreedMatches(''));
    searchInput?.focus();
  });

  searchInput?.addEventListener('focus', () => {
    if (normalizeSearch(searchInput.value).length >= SEARCH_MIN_CHARS) {
      renderBreedSuggestions(searchInput.value, findBreedMatches(searchInput.value));
    }
  });
  searchInput?.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeBreedSuggestions();
      return;
    }
    if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
      event.preventDefault();
      getBreedSuggestionOptions()[activeSuggestionIndex]?.click();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if (normalizeSearch(searchInput.value).length < SEARCH_MIN_CHARS) return;

    const matches = findBreedMatches(searchInput.value);
    if (!matches.length) return;
    event.preventDefault();
    if (searchSuggestions?.hidden) renderBreedSuggestions(searchInput.value, matches);
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const startIndex = activeSuggestionIndex < 0
      ? (direction > 0 ? 0 : getBreedSuggestionOptions().length - 1)
      : activeSuggestionIndex + direction;
    setActiveBreedSuggestion(startIndex);
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
      const targetCategory = categoryViews.find(category => category.id === match.categoryId);
      if (mobileCardDetailsMedia.matches) setCardDetailsExpanded(targetCard, true, true);
      targetCard.dataset.selectedBreedIndex = String(match.breedIndex);
      syncSelectedBreedServices(targetCard, targetCategory, match.breedIndex);
      targetCard.classList.add('price-card--search-target');
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetCard.querySelector('[data-price-service-select]:not([hidden])')?.focus({ preventScroll: true });
      window.setTimeout(() => targetCard.classList.remove('price-card--search-target'), 2200);
    });

    if (searchStatus) searchStatus.textContent = '';
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
    const cardDetailsToggle = event.target instanceof HTMLElement ? event.target.closest('[data-price-card-toggle]') : null;
    if (cardDetailsToggle) {
      const card = cardDetailsToggle.closest('.price-card');
      const expanded = cardDetailsToggle.getAttribute('aria-expanded') === 'true';
      setCardDetailsExpanded(card, !expanded, !expanded);
      return;
    }
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
      syncSelectedBreedServices(card, category, breedIndex);
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
        populateBreedMenu(breedCard, breedMenu);
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
    const card = trigger.closest('[data-category-id]');
    const selectedBreedIndex = Number(card?.dataset.selectedBreedIndex);
    openModal(
      category,
      Number.isInteger(selectedBreedIndex) ? selectedBreedIndex : null,
      null,
      sourceCategoryId === IMPORTANT_CATEGORY_ID ? 'information' : 'primary'
    );
  });

  cardsRoot.addEventListener('pointerover', event => {
    const option = event.target instanceof HTMLElement ? event.target.closest('[data-price-breed-photo-title]') : null;
    if (option) showBreedPhoto(option);
  });
  cardsRoot.addEventListener('pointerout', event => {
    const option = event.target instanceof HTMLElement ? event.target.closest('[data-price-breed-photo-title]') : null;
    if (option && !option.contains(event.relatedTarget)) hideBreedPhoto();
  });
  cardsRoot.addEventListener('focusin', event => {
    const option = event.target instanceof HTMLElement ? event.target.closest('[data-price-breed-photo-title]') : null;
    if (option) showBreedPhoto(option);
  });
  cardsRoot.addEventListener('focusout', event => {
    const option = event.target instanceof HTMLElement ? event.target.closest('[data-price-breed-photo-title]') : null;
    if (option && !option.contains(event.relatedTarget)) hideBreedPhoto();
  });
  cardsRoot.addEventListener('scroll', () => {
    const focusedOption = document.activeElement instanceof HTMLElement
      ? document.activeElement.closest('[data-price-breed-photo-title]')
      : null;
    if (focusedOption) showBreedPhoto(focusedOption);
    else hideBreedPhoto();
  }, true);

  const closeBreedMenusOutside = target => {
    if (!(target instanceof Node)) return;
    cardsRoot.querySelectorAll('[data-price-breeds-toggle][aria-expanded="true"]').forEach(openToggle => {
      const openMenu = document.getElementById(openToggle.dataset.priceBreedsToggle || '');
      if (openToggle.contains(target) || openMenu?.contains(target)) return;
      closeBreedMenu(openToggle);
    });
  };

  document.addEventListener('pointerdown', event => closeBreedMenusOutside(event.target), { capture: true });
  document.addEventListener('click', event => closeBreedMenusOutside(event.target));

  window.addEventListener('resize', () => {
    hideBreedPhoto();
    syncCardDetails();
    schedulePriceCardAlignment();
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
      if (modalBooking.dataset.bookingDentalWeightValid === 'false') {
        event.preventDefault();
        event.stopImmediatePropagation();
        modalDentalWeight?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        modalDentalWeightInput?.focus({ preventScroll: true });
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
