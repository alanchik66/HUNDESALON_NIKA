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
    `;
  };

  const primaryPrice = category => getText(category.priceRows?.[0]?.price) || locale.noPriceLabel;

  const renderCard = category => {
    const breeds = (category.breeds?.[lang] || category.breeds?.en || []).slice(0, 4);
    const services = (category.services || []).slice(0, 4);

    return `
      <article class="price-card" data-category-id="${escapeHtml(category.id)}">
        <div class="price-card__top">
          <div class="price-card__badge">${escapeHtml(locale.cardCountSuffix)}: ${category.breeds?.[lang]?.length || 0}</div>
          <h2 class="price-card__title">${escapeHtml(getText(category.title))}</h2>
          <p class="price-card__summary">${escapeHtml(getText(category.summary))}</p>
        </div>
        <div class="price-card__meta">
          <div class="price-card__price-label">${escapeHtml(locale.priceFromLabel)}</div>
          <div class="price-card__price">${escapeHtml(primaryPrice(category))}</div>
        </div>
        <div class="price-card__chips" aria-label="${escapeHtml(locale.servicesTitle)}">
          ${services
            .map(key => `<span class="price-card__chip">${escapeHtml(getText(catalog.serviceLabels[key]))}</span>`)
            .join('')}
        </div>
        <div class="price-card__footer">
          <button type="button" class="price-card__cta btn-neon" data-price-open="${escapeHtml(category.id)}">
            ${escapeHtml(locale.cardLabel)}
          </button>
          <p class="price-card__footer-copy">${breeds.map(item => escapeHtml(item)).join(' · ')}</p>
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

  const openModal = category => {
    if (!category) return;
    state.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    state.activeCategory = category;

    modalTitle.textContent = getText(category.title);
    modalSummary.textContent = getText(category.summary);
    modalBreeds.innerHTML = (category.breeds?.[lang] || category.breeds?.en || [])
      .map(breed => `<li class="price-modal__block">${escapeHtml(breed)}</li>`)
      .join('');
    modalServices.innerHTML = (category.services || [])
      .map(serviceKey => `<li>${escapeHtml(getText(catalog.serviceLabels[serviceKey]))}</li>`)
      .join('');
    modalPrices.innerHTML = (category.priceRows || [])
      .map(
        row => `
          <tr>
            <td>${escapeHtml(getText(row.label))}</td>
            <td>${escapeHtml(getText(row.price))}</td>
          </tr>`
      )
      .join('');
    modalNotes.innerHTML = (category.notes || [])
      .map(note => `<li>${escapeHtml(getText(note))}</li>`)
      .join('');

    modalBooking.textContent = modalCopy.bookingLabel;
    modal.classList.remove('is-closing');
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('price-modal-open');

    window.requestAnimationFrame(() => {
      modalClose?.focus?.();
    });
  };

  renderHero();
  cardsRoot.innerHTML = catalog.categories.map(renderCard).join('');

  cardsRoot.addEventListener('click', event => {
    const trigger = event.target instanceof HTMLElement ? event.target.closest('[data-price-open]') : null;
    if (!trigger) return;
    const category = catalog.categories.find(item => item.id === trigger.dataset.priceOpen);
    openModal(category);
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
