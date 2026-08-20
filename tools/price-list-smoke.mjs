import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const baseUrl = process.argv[2] || 'http://127.0.0.1:5502';
const outDir = path.resolve('test-results', 'price-list-smoke');
const locales = ['ru', 'de', 'en', 'uk'];

const checks = [];

const assert = (name, ok, detail = '') => {
  checks.push({ name, ok, detail });
  if (!ok) {
    throw new Error(`${name}${detail ? `: ${detail}` : ''}`);
  }
};

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

for (const locale of locales) {
  for (const [label, viewport, screenshotSuffix] of [
    ['desktop', { width: 1440, height: 900 }, 'desktop'],
    ['mobile', devices['iPhone 13'].viewport, 'mobile'],
  ]) {
    const context = await browser.newContext({
      viewport,
      isMobile: label === 'mobile',
      hasTouch: label === 'mobile',
      locale: locale === 'de' ? 'de-DE' : locale === 'en' ? 'en-GB' : locale === 'uk' ? 'uk-UA' : 'ru-RU',
    });
    const page = await context.newPage();
    const url = `${baseUrl}/${locale}/prays-list.html`;

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const cookieAccept = page.locator('[data-cookie-choice="accept"]');
    if (await cookieAccept.count()) {
      await cookieAccept.first().click();
    }

    await page.waitForSelector('[data-price-categories] .price-card', { timeout: 15000 });
    await page.locator('[data-price-categories]').scrollIntoViewIfNeeded();

    const state = await page.evaluate(() => {
      const hero = document.querySelector('[data-price-hero]');
      const cards = Array.from(document.querySelectorAll('[data-price-categories] .price-card'));
      const modal = document.querySelector('[data-price-modal]');
      const firstCardButton = document.querySelector('[data-price-categories] [data-price-open]');
      const firstCard = cards[0];
      const heroRect = hero?.getBoundingClientRect();
      const cardRect = firstCard?.getBoundingClientRect();
      return {
        heroTitle: hero?.querySelector('.section-title')?.textContent?.trim() || '',
        breedSearchReady: Boolean(hero?.querySelector('[data-price-breed-search-input]')),
        categoryActionReady: Boolean(
          hero?.querySelector('[data-price-categories-action][aria-controls="price-categories"]')
        ),
        searchFrameReady: Boolean(hero?.querySelector('.price-page-hero__search-frame')),
        legacyHeroFlowAbsent: !hero?.querySelector('[data-price-hero-flow], [data-price-hero-step]'),
        cardCount: cards.length,
        cardTitle: firstCard?.querySelector('.price-card__title')?.textContent?.trim() || '',
        cardSummary: firstCard?.querySelector('.price-card__summary')?.textContent?.trim() || '',
        cardButtonLabel: firstCardButton?.textContent?.trim() || '',
        cardFits: Boolean(heroRect && cardRect && cardRect.width > 0 && cardRect.width <= window.innerWidth + 1),
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
        modalReady: Boolean(modal),
      };
    });

    assert(`${locale} ${label}: hero rendered`, state.heroTitle.length > 0);
    assert(`${locale} ${label}: breed search rendered`, state.breedSearchReady);
    assert(`${locale} ${label}: extra hero flow absent`, state.legacyHeroFlowAbsent);
    assert(`${locale} ${label}: cards rendered`, state.cardCount >= 9);
    assert(`${locale} ${label}: card text present`, state.cardTitle.length > 0 && state.cardSummary.length > 0);
    assert(`${locale} ${label}: open button rendered`, state.cardButtonLabel.length > 0);
    assert(`${locale} ${label}: no horizontal overflow`, !state.overflowX);
    assert(`${locale} ${label}: modal exists`, state.modalReady);

    assert(locale + ' ' + label + ': category navigation rendered', state.categoryActionReady);
    assert(locale + ' ' + label + ': animated search frame rendered', state.searchFrameReady);

    const breedSearch = page.locator('[data-price-breed-search-input]');
    await breedSearch.focus();
    const breedSearchFocus = await page.evaluate(() => document.activeElement?.matches('[data-price-breed-search-input]') || false);
    assert(`${locale} ${label}: breed search focus`, breedSearchFocus);

    const breedQuery = await page.locator('[data-price-breed-select]').first().evaluate(button => {
      const firstToken = (button.textContent || '').trim().split(/[\s/–—-]+/u)[0] || '';
      return firstToken.length >= 2 ? firstToken : (button.textContent || '').trim();
    });
    await breedSearch.fill(breedQuery);
    const breedSearchAction = await page.evaluate(() => ({
      value: document.querySelector('[data-price-breed-search-input]')?.value?.trim() || '',
      suggestionsVisible: Boolean(
        document.querySelector('[data-price-breed-search-suggestions]:not([hidden]) [data-price-breed-result]')
      ),
      filteredCardCount: document.querySelectorAll('[data-price-categories] .price-card').length,
    }));
    assert(
      `${locale} ${label}: breed search filters cards`,
      breedSearchAction.value.length >= 2 && breedSearchAction.suggestionsVisible && breedSearchAction.filteredCardCount > 0
    );
    await breedSearch.fill('');
    await page.waitForSelector('[data-price-categories] .price-card', { timeout: 15000 });

    await page.locator('[data-price-categories-action]').click();
    await page.waitForFunction(
      () => Boolean(document.activeElement?.closest?.('[data-price-categories]')),
      null,
      { timeout: 15000 }
    );
    const categoryNavigationState = await page.evaluate(() => {
      const root = document.querySelector('.site-scroll-root');
      const cards = document.querySelector('[data-price-categories]');
      const focused = document.activeElement?.closest?.('[data-price-categories]');
      return {
        focusInCards: Boolean(focused),
        cardsVisible: Boolean(cards && cards.getBoundingClientRect().top < window.innerHeight),
        rootHasInternalScroll: Boolean(root && root.scrollHeight > root.clientHeight),
      };
    });
    assert(
      locale + ' ' + label + ': category navigation works',
      categoryNavigationState.focusInCards && categoryNavigationState.cardsVisible
    );

    const informationCard = page.locator('[data-category-id="ru-important-information"]');
    const informationPreview = await informationCard.locator('.price-card__information-preview').textContent();
    const informationHighlights = await informationCard.locator('.price-card__information-highlights li').count();
    assert(`${locale} ${label}: information card preview`, Boolean(informationPreview?.trim()) && informationHighlights === 5);
    await informationCard.locator('[data-price-open]').click();
    await page.waitForSelector('#price-category-modal.active', { timeout: 15000 });

    const informationModalState = await page.evaluate(() => {
      const modal = document.querySelector('#price-category-modal');
      const controls = modal?.querySelector('[data-price-modal-selection-controls]');
      const conditions = modal?.querySelector('[data-price-modal-service-conditions]');
      const booking = modal?.querySelector('[data-price-modal-booking]');
      const controlsRect = controls?.getBoundingClientRect();
      const bookingRect = booking?.getBoundingClientRect();
      return {
        controlsHidden: Boolean(controls?.hidden && (getComputedStyle(controls).display === 'none' || !controlsRect || controlsRect.height === 0)),
        conditionsVisible: Boolean(conditions && !conditions.hidden),
        bookingHidden: Boolean(booking?.hidden && (getComputedStyle(booking).display === 'none' || !bookingRect || bookingRect.height === 0)),
        rules: modal?.querySelectorAll('[data-price-modal-service-conditions-list] li').length || 0,
      };
    });

    assert(`${locale} ${label}: information modal`, informationModalState.controlsHidden && informationModalState.conditionsVisible && informationModalState.bookingHidden && informationModalState.rules === 8);
    await page.locator('[data-price-modal-close]').click();
    await page.waitForFunction(
      () => !document.querySelector('#price-category-modal')?.classList.contains('active'),
      null,
      { timeout: 15000 }
    );

    await page.locator('[data-price-categories] [data-price-open]').first().click();
    await page.waitForSelector('#price-category-modal.active', { timeout: 15000 });

    const initialModalState = await page.evaluate(() => {
      const modal = document.querySelector('#price-category-modal');
      const conditions = modal?.querySelector('[data-price-modal-service-conditions]');
      return {
        conditionsHidden: Boolean(conditions?.hidden),
        consentAbsentBeforeService: !modal?.querySelector('[data-price-modal-service-conditions-consent-wrap]:not([hidden])'),
      };
    });

    assert(`${locale} ${label}: conditions hidden before service`, initialModalState.conditionsHidden && initialModalState.consentAbsentBeforeService);
    await page.locator('[data-price-modal-service-fieldset] .price-category-modal__service-option').first().click();

    const modalState = await page.evaluate(() => {
      const modal = document.querySelector('#price-category-modal');
      const title = modal?.querySelector('[data-price-modal-title]')?.textContent?.trim() || '';
      const summary = modal?.querySelector('[data-price-modal-summary]')?.textContent?.trim() || '';
      const breedOptions = modal?.querySelectorAll('[data-price-modal-breed] option').length || 0;
      const serviceOptions = modal?.querySelectorAll('[data-price-modal-service-options] input[type="checkbox"]').length || 0;
      const additionalFieldset = modal?.querySelector('[data-price-modal-additional-service-fieldset]');
      const additionalServiceOptions = additionalFieldset?.querySelectorAll('input[type="checkbox"]').length || 0;
      const selectedPrice = modal?.querySelector('[data-price-modal-selected-price]')?.textContent?.trim() || '';
      const conditions = modal?.querySelector('[data-price-modal-service-conditions]');
      const conditionsService = modal?.querySelector('[data-price-modal-service-conditions-service]')?.textContent?.trim() || '';
      const consent = modal?.querySelector('[data-price-modal-service-conditions-consent]');
      const booking = modal?.querySelector('[data-price-modal-booking]');
      const legacyMarkup = modal?.querySelector('[data-price-modal-breeds], [data-price-modal-services], [data-price-modal-prices], [data-price-modal-notes]');
      return {
        title,
        summary,
        breedOptions,
        serviceOptions,
        additionalServiceOptions,
        additionalServicesVisible: Boolean(additionalFieldset && !additionalFieldset.hidden),
        selectedPrice,
        conditionsVisible: Boolean(conditions && !conditions.hidden),
        consentVisible: Boolean(consent && !consent.closest('[data-price-modal-service-conditions-consent-wrap]')?.hidden),
        consentChecked: Boolean(consent?.checked),
        conditionsService,
        oneBookingButton: modal?.querySelectorAll('[data-price-modal-booking]').length === 1,
        bookingInConditions: Boolean(booking && conditions?.contains(booking)),
        legacyMarkup: Boolean(legacyMarkup),
      };
    });

    assert(`${locale} ${label}: modal title`, modalState.title.length > 0);
    assert(`${locale} ${label}: modal summary`, modalState.summary.length > 0);
    assert(`${locale} ${label}: breed selector`, modalState.breedOptions > 0);
    assert(`${locale} ${label}: service selector`, modalState.serviceOptions > 0);
    assert(`${locale} ${label}: applicable additional services`, modalState.additionalServicesVisible && modalState.additionalServiceOptions > 0);
    assert(`${locale} ${label}: automatic price`, modalState.selectedPrice.length > 0);
    assert(`${locale} ${label}: conditions block`, modalState.conditionsVisible && initialModalState.conditionsHidden && modalState.conditionsService.length > 0);
    assert(`${locale} ${label}: conditions consent`, modalState.consentVisible && !modalState.consentChecked);
    assert(`${locale} ${label}: one booking button`, modalState.oneBookingButton && modalState.bookingInConditions);
    assert(`${locale} ${label}: no legacy duplicate blocks`, !modalState.legacyMarkup);

    await page.screenshot({
      path: path.join(outDir, `${locale}-${screenshotSuffix}.png`),
      fullPage: false,
    });

    await page.waitForTimeout(240);
    const categoryContent = page.locator('#price-category-modal.active .modal-content');
    const categoryMaxScroll = await categoryContent.evaluate(content => {
      content.scrollTop = 0;
      return Math.max(0, content.scrollHeight - content.clientHeight);
    });
    const categoryContentBox = await categoryContent.boundingBox();
    if (categoryContentBox && categoryMaxScroll > 1) {
      await page.mouse.move(
        categoryContentBox.x + Math.min(120, categoryContentBox.width / 2),
        categoryContentBox.y + Math.min(180, categoryContentBox.height / 2)
      );
      await page.mouse.wheel(0, 720);
      await page.waitForTimeout(160);
    }
    const categoryScrollState = await categoryContent.evaluate(content => {
      const root = document.querySelector('.site-scroll-root');
      const scrollbar = getComputedStyle(content, '::-webkit-scrollbar');
      return {
        maxScroll: Math.max(0, content.scrollHeight - content.clientHeight),
        scrollTop: content.scrollTop,
        overflowY: getComputedStyle(content).overflowY,
        scrollbarDisplay: scrollbar.display,
        scrollbarWidth: scrollbar.width,
        rootLocked: Boolean(
          root?.classList.contains('price-modal-scroll-locked')
          && getComputedStyle(root).overflowY === 'hidden'
        ),
      };
    });
    const categoryScrollPasses = categoryScrollState.maxScroll < 2 || (
      categoryScrollState.scrollTop > 1 && categoryScrollState.rootLocked
    );
    assert(
      `${locale} ${label}: category modal wheel scroll`,
      categoryScrollPasses,
      categoryScrollPasses ? '' : JSON.stringify(categoryScrollState)
    );
    assert(
      `${locale} ${label}: category modal hidden scroll rail`,
      categoryScrollState.overflowY === 'auto'
        && categoryScrollState.scrollbarDisplay === 'none'
        && Number.parseFloat(categoryScrollState.scrollbarWidth || '0') === 0,
      JSON.stringify(categoryScrollState)
    );

    if (locale === 'ru' && label === 'desktop') {
      await page.screenshot({
        path: path.join(outDir, 'ru-desktop-category-scrolled.png'),
        fullPage: false,
      });
    }

    await page.locator('[data-price-modal-service-conditions-consent]').check();
    await page.locator('[data-price-modal-booking]').click();
    await page.waitForSelector('#client-registration-modal.active', { timeout: 15000 });
    await page.waitForTimeout(600);

    const registrationState = await page.evaluate(async () => {
      const modal = document.querySelector('#client-registration-modal');
      const content = modal?.querySelector('.client-registration-modal__content');
      const form = modal?.querySelector('[data-client-registration-form]');
      const root = document.querySelector('.site-scroll-root');
      const actions = form?.querySelector('.client-registration-form__actions');
      const scrollbar = content ? getComputedStyle(content, '::-webkit-scrollbar') : null;
      const modalTop = content?.scrollTop || 0;
      const modalMaxScroll = Math.max(0, (content?.scrollHeight || 0) - (content?.clientHeight || 0));
      if (content) content.scrollTop = Math.min(modalMaxScroll, modalTop + 160);
      return {
        modalOpen: Boolean(modal?.classList.contains('active')),
        rootLocked: root?.classList.contains('price-modal-scroll-locked')
          && document.body.classList.contains('price-modal-open')
          && getComputedStyle(root || document.body).overflowY === 'hidden',
        modalCanScroll: modalMaxScroll > 1,
        modalScrolled: modalMaxScroll < 2 || (content?.scrollTop || 0) > modalTop,
        scrollbarHidden: Boolean(
          content
          && getComputedStyle(content).overflowY === 'auto'
          && scrollbar?.display === 'none'
          && Number.parseFloat(scrollbar?.width || '0') === 0
        ),
        matteBackdrop: getComputedStyle(modal || document.body).backdropFilter !== 'none',
        hiddenBreed: form?.querySelector('input[name="pet_breed"]')?.type === 'hidden',
        noSpeciesDuplicate: !form?.querySelector('[name="pet_species_display"]'),
        petContext: Boolean(form?.querySelector('[data-client-registration-pet-context]')?.textContent?.trim()),
        navActions: actions?.querySelectorAll('.btn-neon[data-nav-pill="client-registration-action"]').length === 2,
        singleColumnLayout: form ? getComputedStyle(form).gridTemplateColumns.trim().split(/\s+/).filter(column => Number.parseFloat(column) > 1).length === 1 : false,
      };
    });

    assert(
      `${locale} ${label}: registration modal scroll isolation`,
      registrationState.modalOpen && registrationState.rootLocked && registrationState.modalScrolled && registrationState.scrollbarHidden,
      JSON.stringify(registrationState)
    );
    assert(
      `${locale} ${label}: registration uses selected pet`,
      registrationState.hiddenBreed && registrationState.noSpeciesDuplicate && registrationState.petContext && registrationState.navActions && registrationState.singleColumnLayout && registrationState.matteBackdrop
    );

    if (locale === 'ru' && label === 'desktop') {
      await page.locator('.client-registration-modal__content').evaluate(content => {
        content.scrollTop = 0;
      });
      await page.waitForTimeout(100);
      await page.screenshot({
        path: path.join(outDir, 'ru-desktop-registration.png'),
        fullPage: false,
      });
      await page.locator('.client-registration-modal__content').evaluate(content => {
        content.scrollTop = content.scrollHeight;
      });
      await page.waitForTimeout(100);
      await page.screenshot({
        path: path.join(outDir, 'ru-desktop-registration-actions.png'),
        fullPage: false,
      });
    }

    await page.locator('[data-client-registration-cancel]').click();
    await page.waitForFunction(
      () => !document.querySelector('#client-registration-modal')?.classList.contains('active'),
      null,
      { timeout: 15000 }
    );

    const breedToggle = page.locator('[data-price-breeds-toggle]').first();
    await breedToggle.evaluate(toggle => {
      const root = document.querySelector('.site-scroll-root');
      if (root) root.style.scrollBehavior = 'auto';
      toggle.scrollIntoView({ block: 'center', inline: 'nearest' });
    });
    // Let any closing modal transition finish before we snapshot the page
    // position. This makes the following assertion about the opened menu,
    // rather than about an unrelated in-flight page positioning transition.
    await page.waitForTimeout(420);
    const scrollBeforeBreedMenu = await page.evaluate(() => document.querySelector('.site-scroll-root')?.scrollTop || 0);
    await breedToggle.evaluate(toggle => toggle.click());
    await page.waitForSelector('.price-card__breed-menu:not([hidden])', { timeout: 15000 });
    await page.waitForTimeout(320);
    const breedMenuState = await page.evaluate(scrollBefore => {
      const root = document.querySelector('.site-scroll-root');
      const menu = document.querySelector('.price-card__breed-menu:not([hidden])');
      const openCard = menu?.closest('.price-card');
      const rect = menu?.getBoundingClientRect();
      const menuStyle = menu ? getComputedStyle(menu) : null;
      const serviceButtons = [...(openCard?.querySelectorAll('.price-card__service-option') || [])];
      const intersectingServiceButtons = serviceButtons.filter(button => {
        const buttonRect = button.getBoundingClientRect();
        return Boolean(
          rect
          && buttonRect.left < rect.right
          && buttonRect.right > rect.left
          && buttonRect.top < rect.bottom
          && buttonRect.bottom > rect.top
        );
      });
      const menuAboveServices = intersectingServiceButtons.every(button => {
        const buttonRect = button.getBoundingClientRect();
        const x = Math.max(rect.left, buttonRect.left) + (Math.min(rect.right, buttonRect.right) - Math.max(rect.left, buttonRect.left)) / 2;
        const y = Math.max(rect.top, buttonRect.top) + (Math.min(rect.bottom, buttonRect.bottom) - Math.max(rect.top, buttonRect.top)) / 2;
        const topElement = document.elementFromPoint(x, y);
        return topElement === menu || Boolean(topElement && menu.contains(topElement));
      });
      return {
        rootStable: Math.abs((root?.scrollTop || 0) - scrollBefore) <= 2,
        rootLocked: root?.classList.contains('price-breed-menu-scroll-locked'),
        insideViewport: Boolean(rect && rect.left >= 8 && rect.right <= window.innerWidth - 8 && rect.top >= 8 && rect.bottom <= window.innerHeight - 8),
        boundedWidth: Boolean(rect && rect.width <= 681),
        menuAboveServices,
        menuOpaque: Boolean(menuStyle && !/^rgba\(/i.test(menuStyle.backgroundColor.trim())),
        scrollTop: root?.scrollTop || 0,
        scrollBefore,
        rect: rect && { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left },
        viewport: { width: window.innerWidth, height: window.innerHeight },
      };
    }, scrollBeforeBreedMenu);
    const breedMenuPasses = breedMenuState.rootStable
      && breedMenuState.rootLocked
      && breedMenuState.insideViewport
      && breedMenuState.boundedWidth
      && breedMenuState.menuAboveServices
      && breedMenuState.menuOpaque;
    assert(
      `${locale} ${label}: breed menu stays in its layer`,
      breedMenuPasses,
      breedMenuPasses ? '' : JSON.stringify(breedMenuState)
    );

    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => !document.querySelector('.price-card__breed-menu:not([hidden])'),
      null,
      { timeout: 15000 }
    );
    await page.waitForFunction(
      () => !document.querySelector('#price-category-modal')?.classList.contains('active'),
      null,
      { timeout: 15000 }
    );
    await context.close();
  }
}

await browser.close();

console.log(
  JSON.stringify(
    {
      ok: true,
      screenshots: locales.flatMap(locale => [
        path.join(outDir, `${locale}-desktop.png`),
        path.join(outDir, `${locale}-mobile.png`),
      ]).concat(
        path.join(outDir, 'ru-desktop-registration.png'),
        path.join(outDir, 'ru-desktop-registration-actions.png'),
        path.join(outDir, 'ru-desktop-category-scrolled.png')
      ),
      checks,
    },
    null,
    2
  )
);
