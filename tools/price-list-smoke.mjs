import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';

import { startStaticTestServer } from './lib/static-test-server.mjs';

const externalBaseUrl = process.argv[2] || '';
const staticServer = externalBaseUrl ? null : await startStaticTestServer();
const baseUrl = externalBaseUrl || staticServer.baseUrl;
const outDir = path.resolve('test-results', 'price-list-smoke');
const supportedLocales = ['ru', 'de', 'en', 'uk'];
const requestedLocales = (process.env.PRICE_SMOKE_LOCALES || '')
  .split(',')
  .map(locale => locale.trim())
  .filter(Boolean);
const locales = requestedLocales.length
  ? supportedLocales.filter(locale => requestedLocales.includes(locale))
  : supportedLocales;
const requestedLayout = process.env.PRICE_SMOKE_LAYOUT || '';
const layouts = [
  ['desktop', { width: 1440, height: 900 }, 'desktop'],
  ['mobile', devices['iPhone 13'].viewport, 'mobile'],
].filter(([label]) => !requestedLayout || label === requestedLayout);
const additionalScreenshots = locales.includes('ru') && layouts.some(([label]) => label === 'desktop')
  ? [
      path.join(outDir, 'ru-desktop-registration.png'),
      path.join(outDir, 'ru-desktop-registration-actions.png'),
      path.join(outDir, 'ru-desktop-category-scrolled.png'),
    ]
  : [];

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
  for (const [label, viewport, screenshotSuffix] of layouts) {
    console.log(`[price-smoke] Checking ${locale} ${label}`);
    const context = await browser.newContext({
      viewport,
      isMobile: label === 'mobile',
      hasTouch: label === 'mobile',
      serviceWorkers: 'block',
      locale: locale === 'de' ? 'de-DE' : locale === 'en' ? 'en-GB' : locale === 'uk' ? 'uk-UA' : 'ru-RU',
    });
    const page = await context.newPage();
    const url = `${baseUrl}/${locale}/prays-list.html`;

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const cookieAccept = page.locator('[data-cookie-choice="accept"]');
    if (await cookieAccept.count()) {
      await cookieAccept.first().evaluate(button => button.click());
    }

    await page.waitForSelector('[data-price-categories] .price-card', { timeout: 15000 });
    await page.locator('[data-price-categories]').scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    const state = await page.evaluate(() => {
      const hero = document.querySelector('[data-price-hero]');
      const cards = Array.from(document.querySelectorAll('[data-price-categories] .price-card'));
      const modal = document.querySelector('[data-price-modal]');
      const firstCardButton = document.querySelector('[data-price-categories] [data-price-open]');
      const categoryAction = hero?.querySelector('[data-price-categories-action]');
      const heroSearch = hero?.querySelector('.price-page-hero__search');
      const categoryActionIcon = categoryAction?.querySelector('.price-page-hero__categories-action-icon');
      const categoryActionArrow = categoryActionIcon?.querySelector('.site-icon-arrow.site-icon-arrow-right');
      const breedToggle = document.querySelector('[data-price-breeds-toggle]');
      const breedBadgeMotion = breedToggle?.querySelector('.price-card__badge-icon-motion');
      const breedBadgeIcon = breedToggle?.querySelector('.price-card__badge-icon');
      const firstCard = cards[0];
      const currentLocale = document.documentElement.lang;
      const additionalCard = document.querySelector('[data-category-id="ru-additional-services"]');
      const additionalSourceCategory = window.PricePageCatalog?.categoriesByLocale?.[currentLocale]
        ?.find(category => category.id === 'ru-additional-services');
      const additionalSourceBreeds = additionalSourceCategory?.breeds?.[currentLocale]
        || additionalSourceCategory?.breeds?.en
        || [];
      const firstCardDetailsToggle = firstCard?.querySelector('[data-price-card-toggle]');
      const firstCardDetails = firstCard?.querySelector('[data-price-card-details]');
      const heroRect = hero?.getBoundingClientRect();
      const cardRect = firstCard?.getBoundingClientRect();
      const firstThreeCardRects = cards.slice(0, 3).map(card => card.getBoundingClientRect());
      const cardButtonStyle = firstCardButton ? getComputedStyle(firstCardButton) : null;
      const cardButtonBefore = firstCardButton ? getComputedStyle(firstCardButton, '::before') : null;
      const cardButtonAfter = firstCardButton ? getComputedStyle(firstCardButton, '::after') : null;
      const categoryActionArrowStyle = categoryActionArrow ? getComputedStyle(categoryActionArrow) : null;
      const breedBadgeMotionStyle = breedBadgeMotion ? getComputedStyle(breedBadgeMotion) : null;
      const breedBadgeIconStyle = breedBadgeIcon ? getComputedStyle(breedBadgeIcon) : null;
      const rootStyle = getComputedStyle(document.documentElement);
      const firstSectionMetaTops = Array.from(
        document.querySelectorAll('[data-price-section="small"] .price-card__meta')
      ).slice(0, 3).map(meta => meta.offsetTop);
      const firstSectionCtaBottoms = Array.from(
        document.querySelectorAll('[data-price-section="small"] .price-card__cta')
      ).slice(0, 3).map(button => button.getBoundingClientRect().bottom);
      return {
        heroTitle: hero?.querySelector('.section-title')?.textContent?.trim() || '',
        breedSearchReady: Boolean(hero?.querySelector('[data-price-breed-search-input]')),
        categoryActionReady: Boolean(
          hero?.querySelector('[data-price-categories-action][aria-controls="price-categories"]')
        ),
        searchBeforeCategoryAction: Boolean(
          heroSearch
          && categoryAction
          && (heroSearch.compareDocumentPosition(categoryAction) & Node.DOCUMENT_POSITION_FOLLOWING)
        ),
        categoryActionUsesSiteArrow: Boolean(
          categoryAction?.dataset.navPillBound === '1'
          && categoryActionIcon?.getAttribute('aria-hidden') === 'true'
        && categoryActionArrowStyle?.backgroundImage.includes('chevron-down.webp')
          && categoryActionArrowStyle?.animationName.includes('siteArrowDirectionalBounce')
          && categoryActionArrowStyle?.getPropertyValue('--arrow-rotate').includes('-90deg')
        ),
        breedBadgeArrowUsesSiteMotion: Boolean(
          breedBadgeMotionStyle?.animationName.includes('siteArrowAxisBounce')
          && breedBadgeMotionStyle?.getPropertyValue('--site-arrow-motion-peak-x').trim() === '-7px'
        && breedBadgeIconStyle?.backgroundImage.includes('chevron-down.webp')
          && rootStyle.getPropertyValue('--site-arrow-bounce-peak').trim() === '7px'
        ),
        searchFrameReady: Boolean(hero?.querySelector('.price-page-hero__search-frame')),
        legacyHeroFlowAbsent: !hero?.querySelector('[data-price-hero-flow], [data-price-hero-step]'),
        cardCount: cards.length,
        additionalCardBreedCount: Number.parseInt(
          additionalCard?.querySelector('.price-card__badge-number')?.textContent || '',
          10
        ) || 0,
        additionalSourceBreedCount: additionalSourceBreeds.length,
        cardTitle: firstCard?.querySelector('.price-card__title')?.textContent?.trim() || '',
        cardSummary: firstCard?.querySelector('.price-card__summary')?.textContent?.trim() || '',
        cardButtonLabel: firstCardButton?.textContent?.trim() || '',
        cardButtonUsesNavigationSystem: Boolean(
          firstCardButton?.classList.contains('filter-btn')
          && firstCardButton?.parentElement?.classList.contains('nav-main')
          && firstCardButton?.dataset.navPillBound === '1'
          && cardButtonStyle?.animationName.includes('navPillBreath')
          && cardButtonBefore?.content !== 'none'
          && cardButtonAfter?.content !== 'none'
        ),
        cardFits: Boolean(heroRect && cardRect && cardRect.width > 0 && cardRect.width <= window.innerWidth + 1),
        cardDetailsToggleDisplay: firstCardDetailsToggle ? getComputedStyle(firstCardDetailsToggle).display : '',
        cardDetailsExpanded: firstCardDetailsToggle?.getAttribute('aria-expanded') || '',
        cardDetailsHidden: firstCardDetails?.getAttribute('aria-hidden') || '',
        cardDetailsInert: Boolean(firstCardDetails?.hasAttribute('inert')),
        cardSummaryDisplay: firstCard?.querySelector('.price-card__summary')
          ? getComputedStyle(firstCard.querySelector('.price-card__summary')).display
          : '',
        cardHeight: cardRect?.height || 0,
        firstThreeCardSpan: firstThreeCardRects.length === 3
          ? firstThreeCardRects[2].bottom - firstThreeCardRects[0].top
          : Infinity,
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
        modalReady: Boolean(modal),
        calculationLocalizationReady: Boolean(
          window.PricePageCatalog?.locales?.[document.documentElement.lang]?.subtotalBeforeDiscountLabel
          && window.PricePageCatalog?.locales?.[document.documentElement.lang]?.dentalDiscountTerms
        ),
        firstSectionMetaSpread: firstSectionMetaTops.length > 1
          ? Math.max(...firstSectionMetaTops) - Math.min(...firstSectionMetaTops)
          : 0,
        firstSectionCtaBottomSpread: firstSectionCtaBottoms.length > 1
          ? Math.max(...firstSectionCtaBottoms) - Math.min(...firstSectionCtaBottoms)
          : 0,
      };
    });

    assert(`${locale} ${label}: hero rendered`, state.heroTitle.length > 0);
    assert(`${locale} ${label}: breed search rendered`, state.breedSearchReady);
    assert(`${locale} ${label}: extra hero flow absent`, state.legacyHeroFlowAbsent);
    assert(`${locale} ${label}: cards rendered`, state.cardCount >= 9);
    assert(
      `${locale} ${label}: additional services contain only dogs and cats`,
      state.additionalCardBreedCount === 2 && state.additionalSourceBreedCount === 2,
      JSON.stringify({
        card: state.additionalCardBreedCount,
        source: state.additionalSourceBreedCount,
      })
    );
    assert(`${locale} ${label}: card text present`, state.cardTitle.length > 0 && state.cardSummary.length > 0);
    assert(`${locale} ${label}: open button rendered`, state.cardButtonLabel.length > 0);
    assert(`${locale} ${label}: card button uses navigation effects`, state.cardButtonUsesNavigationSystem);
    assert(`${locale} ${label}: no horizontal overflow`, !state.overflowX);
    assert(`${locale} ${label}: modal exists`, state.modalReady);
    assert(`${locale} ${label}: calculation localization exists`, state.calculationLocalizationReady);
    if (label === 'desktop') {
      assert(
        `${locale} ${label}: card dividers aligned`,
        state.firstSectionMetaSpread <= 1,
        `spread=${state.firstSectionMetaSpread}`
      );
      assert(
        `${locale} ${label}: card action buttons share one bottom row`,
        state.firstSectionCtaBottomSpread <= 1,
        `spread=${state.firstSectionCtaBottomSpread}`
      );
      assert(
        `${locale} ${label}: compact disclosure stays desktop-neutral`,
        state.cardDetailsToggleDisplay === 'none'
          && state.cardDetailsHidden === ''
          && !state.cardDetailsInert
          && state.cardSummaryDisplay !== 'none'
      );
    } else {
      assert(
        `${locale} ${label}: cards start compact and accessible`,
        state.cardDetailsToggleDisplay !== 'none'
          && state.cardDetailsExpanded === 'false'
          && state.cardDetailsHidden === 'true'
          && state.cardDetailsInert
          && state.cardSummaryDisplay === 'none'
      );
      assert(
        `${locale} ${label}: at least three compact cards fit one viewport`,
        state.cardHeight <= 220 && state.firstThreeCardSpan <= viewport.height,
        `height=${state.cardHeight}; span=${state.firstThreeCardSpan}; viewport=${viewport.height}`
      );
    }

    assert(locale + ' ' + label + ': category navigation rendered', state.categoryActionReady);
    assert(locale + ' ' + label + ': breed search precedes category navigation', state.searchBeforeCategoryAction);
    assert(locale + ' ' + label + ': category navigation uses site arrow system', state.categoryActionUsesSiteArrow);
    assert(locale + ' ' + label + ': breed badge arrow uses amplified site motion', state.breedBadgeArrowUsesSiteMotion);
    assert(locale + ' ' + label + ': animated search frame rendered', state.searchFrameReady);

    if (locale === 'ru' && label === 'desktop') {
      const additionalCard = page.locator('[data-category-id="ru-additional-services"]');
      const additionalBreedToggle = additionalCard.locator('[data-price-breeds-toggle]');
      const additionalBreedOptions = additionalCard.locator('[data-price-breed-select]');
      const modalBreedSelect = page.locator('[data-price-modal-breed]');
      const modalClose = page.locator('[data-price-modal-close]');

      await additionalBreedToggle.evaluate(toggle => toggle.click());
      await page.waitForSelector(
        '[data-category-id="ru-additional-services"] .price-card__breed-menu:not([hidden])',
        { timeout: 5000 }
      );
      const additionalBreedLabels = await additionalBreedOptions.allTextContents();
      assert(
        'ru desktop: additional category menu has exactly two species',
        additionalBreedLabels.length === 2,
        JSON.stringify(additionalBreedLabels)
      );

      for (let speciesIndex = 0; speciesIndex < additionalBreedLabels.length; speciesIndex += 1) {
        if (speciesIndex > 0) {
          await additionalBreedToggle.evaluate(toggle => toggle.click());
          await page.waitForSelector(
            '[data-category-id="ru-additional-services"] .price-card__breed-menu:not([hidden])',
            { timeout: 5000 }
          );
        }
        await additionalBreedOptions.nth(speciesIndex).evaluate(option => option.click());
        await page.waitForFunction(
          () => {
            const modal = document.querySelector('#price-category-modal');
            return modal?.classList.contains('active') && modal.getAttribute('aria-hidden') === 'false';
          },
          null,
          { timeout: 5000 }
        );
        const modalSpeciesState = await modalBreedSelect.evaluate(select => ({
          labels: Array.from(select.options, option => option.textContent?.trim() || ''),
          selected: select.selectedOptions[0]?.textContent?.trim() || '',
          visibleSelected: select.closest('.site-select')?.querySelector('.site-select__value')?.textContent?.trim() || '',
        }));
        assert(
          `ru desktop: additional species ${speciesIndex + 1} stays consistent in modal`,
          modalSpeciesState.labels.length === 2
            && modalSpeciesState.labels.every((species, index) => species === additionalBreedLabels[index])
            && modalSpeciesState.selected === additionalBreedLabels[speciesIndex]
            && modalSpeciesState.visibleSelected === additionalBreedLabels[speciesIndex],
          JSON.stringify(modalSpeciesState)
        );
        await modalClose.evaluate(button => button.click());
        await page.waitForFunction(
          () => !document.querySelector('#price-category-modal')?.classList.contains('active'),
          null,
          { timeout: 5000 }
        );
      }
    }

    if (label === 'mobile') {
      const firstCard = page.locator('[data-price-categories] .price-card').first();
      const secondCard = page.locator('[data-price-categories] .price-card').nth(1);
      const firstDetailsToggle = firstCard.locator('[data-price-card-toggle]');
      const secondDetailsToggle = secondCard.locator('[data-price-card-toggle]');

      await firstDetailsToggle.click();
      await page.waitForFunction(
        () => {
          const card = document.querySelector('[data-price-categories] .price-card');
          const details = card?.querySelector('[data-price-card-details]');
          return card?.dataset.priceCardExpanded === 'true'
            && (details?.getBoundingClientRect().height || 0) > 0;
        },
        null,
        { timeout: 5000 }
      );
      const firstExpandedState = await firstCard.evaluate(card => {
        const details = card.querySelector('[data-price-card-details]');
        return {
          expanded: card.dataset.priceCardExpanded,
          toggleExpanded: card.querySelector('[data-price-card-toggle]')?.getAttribute('aria-expanded'),
          detailsHidden: details?.getAttribute('aria-hidden') || '',
          detailsInert: Boolean(details?.hasAttribute('inert')),
          detailsHeight: details?.getBoundingClientRect().height || 0,
          serviceButtons: card.querySelectorAll('[data-price-service-select], [data-price-additional-select]').length,
          actionVisible: Boolean(card.querySelector('[data-price-open]')?.getBoundingClientRect().height),
        };
      });
      assert(
        `${locale} ${label}: compact card reveals all actions`,
        firstExpandedState.expanded === 'true'
          && firstExpandedState.toggleExpanded === 'true'
          && firstExpandedState.detailsHidden === ''
          && !firstExpandedState.detailsInert
          && firstExpandedState.detailsHeight > 0
          && firstExpandedState.serviceButtons > 0
          && firstExpandedState.actionVisible,
        JSON.stringify(firstExpandedState)
      );

      const firstServiceButton = firstCard.locator('.price-card__service-option').first();
      await firstServiceButton.hover();
      await page.waitForFunction(
        () => {
          const button = document.querySelector(
            '[data-price-categories] .price-card[data-price-card-expanded="true"] .price-card__service-option:hover'
          );
          return button && getComputedStyle(button).transform !== 'none';
        },
        null,
        { timeout: 5000 }
      );
      const serviceHoverLayerState = await firstServiceButton.evaluate(button => {
        const detailsInner = button.closest('.price-card__details-inner');
        const card = button.closest('.price-card');
        return {
          hovered: button.matches(':hover'),
          buttonZIndex: Number.parseInt(getComputedStyle(button).zIndex, 10) || 0,
          detailsOverflow: detailsInner ? getComputedStyle(detailsInner).overflow : '',
          cardZIndex: card ? Number.parseInt(getComputedStyle(card).zIndex, 10) || 0 : 0,
        };
      });
      assert(
        `${locale} ${label}: expanded service hover stays above unclipped content`,
        serviceHoverLayerState.hovered
          && serviceHoverLayerState.buttonZIndex >= 2
          && serviceHoverLayerState.detailsOverflow === 'visible'
          && serviceHoverLayerState.cardZIndex >= 2,
        JSON.stringify(serviceHoverLayerState)
      );

      await secondDetailsToggle.click();
      await page.waitForFunction(
        () => {
          const cards = [...document.querySelectorAll('[data-price-categories] .price-card')];
          return cards[0]?.dataset.priceCardExpanded === 'false'
            && cards[1]?.dataset.priceCardExpanded === 'true'
            && (cards[1]?.querySelector('[data-price-card-details]')?.getBoundingClientRect().height || 0) > 0;
        },
        null,
        { timeout: 5000 }
      );
      const exclusiveDisclosureState = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('[data-price-categories] .price-card')];
        const firstDetails = cards[0]?.querySelector('[data-price-card-details]');
        return {
          expandedCards: cards.filter(card => card.dataset.priceCardExpanded === 'true').length,
          firstCollapsed: cards[0]?.dataset.priceCardExpanded === 'false',
          firstHidden: firstDetails?.getAttribute('aria-hidden') === 'true',
          firstInert: Boolean(firstDetails?.hasAttribute('inert')),
          secondExpanded: cards[1]?.dataset.priceCardExpanded === 'true',
        };
      });
      assert(
        `${locale} ${label}: only one compact card expands`,
        exclusiveDisclosureState.expandedCards === 1
          && exclusiveDisclosureState.firstCollapsed
          && exclusiveDisclosureState.firstHidden
          && exclusiveDisclosureState.firstInert
          && exclusiveDisclosureState.secondExpanded,
        JSON.stringify(exclusiveDisclosureState)
      );

      await secondDetailsToggle.click();
      await page.waitForFunction(
        () => document.querySelectorAll('[data-price-categories] .price-card[data-price-card-expanded="true"]').length === 0,
        null,
        { timeout: 5000 }
      );
    }

    const euroIcon = page.locator('.site-icon-euro.currency-inline').first();
    await euroIcon.evaluate(icon => icon.scrollIntoView({ block: 'center' }));
    const euroMotionState = await euroIcon.evaluate(async icon => {
      const readMotion = () => {
        const style = getComputedStyle(icon);
        return {
          animationName: style.animationName,
          animationPlayState: style.animationPlayState,
          display: style.display,
          transform: style.transform,
          randomizedDuration: icon.style.getPropertyValue('--euro-spin-duration'),
          animationTimes: icon.getAnimations().map(animation => Number(animation.currentTime || 0)),
        };
      };
      const before = readMotion();
      let after = before;
      for (let sample = 0; sample < 8 && after.transform === before.transform; sample += 1) {
        await new Promise(resolve => setTimeout(resolve, 90));
        after = readMotion();
      }
      return { before, after };
    });
    const euroMotionPasses = euroMotionState.before.animationName.includes('iconCoinSpinVertical')
      && euroMotionState.before.animationPlayState.includes('running')
      && euroMotionState.before.display === 'inline-block'
      && euroMotionState.before.randomizedDuration === ''
      && (
        euroMotionState.before.transform !== euroMotionState.after.transform
        || euroMotionState.after.animationTimes.some((time, index) => time > (euroMotionState.before.animationTimes[index] || 0))
      );
    assert(
      `${locale} ${label}: euro icon uses the shared coin rotation`,
      euroMotionPasses,
      euroMotionPasses ? '' : JSON.stringify(euroMotionState)
    );

    if (locale === 'ru' && label === 'mobile') {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const reducedMotionEuroState = await page.locator('.site-icon-euro.currency-inline').first().evaluate(async icon => {
        const readMotion = () => {
          const style = getComputedStyle(icon);
          return {
            animationDuration: style.animationDuration,
            animationIterationCount: style.animationIterationCount,
            animationPlayState: style.animationPlayState,
            display: style.display,
            transform: style.transform,
            width: icon.offsetWidth,
          };
        };
        const before = readMotion();
        await new Promise(resolve => setTimeout(resolve, 420));
        const after = readMotion();
        return { before, after };
      });
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const reducedMotionEuroPasses = reducedMotionEuroState.before.animationDuration !== '1e-05s'
        && reducedMotionEuroState.before.animationIterationCount.includes('infinite')
        && reducedMotionEuroState.before.animationPlayState.includes('running')
        && reducedMotionEuroState.before.display === 'inline-block'
        && reducedMotionEuroState.before.width > 0
        && reducedMotionEuroState.before.transform !== reducedMotionEuroState.after.transform;
      assert(
        'ru mobile: euro icon keeps rotating when system motion is reduced',
        reducedMotionEuroPasses,
        reducedMotionEuroPasses ? '' : JSON.stringify(reducedMotionEuroState)
      );
    }

    const breedSearch = page.locator('[data-price-breed-search-input]');
    await breedSearch.focus();
    const breedSearchFocus = await page.evaluate(() => document.activeElement?.matches('[data-price-breed-search-input]') || false);
    assert(`${locale} ${label}: breed search focus`, breedSearchFocus);

    const breedAlphabetState = await page.evaluate(currentLocale => {
      const dogCategoryIds = new Set([
        'ru-small-growing-coat',
        'ru-poodles-bichons',
        'ru-spitz',
        'ru-spaniels',
        'ru-wire-coat',
        'ru-short-coat',
        'ru-large-dogs',
      ]);
      const collator = new Intl.Collator(currentLocale, { sensitivity: 'base', numeric: true });
      return (window.PricePageCatalog?.categoriesByLocale?.[currentLocale] || [])
        .filter(category => dogCategoryIds.has(category.id))
        .flatMap(category => {
          const names = category.breeds?.[currentLocale] || [];
          const sorted = [...names].sort((left, right) => collator.compare(left, right));
          return names.every((name, index) => name === sorted[index]) ? [] : [category.id];
        });
    }, locale);
    assert(
      `${locale} ${label}: every dog category uses the locale alphabet`,
      breedAlphabetState.length === 0,
      JSON.stringify(breedAlphabetState)
    );

    if (locale === 'ru' && label === 'desktop') {
      const typoCases = [
        { query: 'Командор', expected: 'Комондор', categoryId: 'ru-large-dogs' },
        { query: 'Коммандор', expected: 'Комондор', categoryId: 'ru-large-dogs' },
        { query: 'Ирланский валкодав', expected: 'Ирландский волкодав', categoryId: 'ru-wire-coat' },
      ];
      for (const typoCase of typoCases) {
        await breedSearch.fill(typoCase.query);
        const typoState = await page.evaluate(expected => {
          const results = Array.from(document.querySelectorAll('[data-price-breed-result]')).map(button => ({
            name: button.querySelector('.price-breed-search__suggestion-name')?.textContent?.trim() || '',
            categoryId: button.dataset.priceBreedResultCategory || '',
          }));
          return {
            match: results.find(result => result.name === expected.name) || null,
            results,
            filteredCardCount: document.querySelectorAll('[data-price-categories] .price-card').length,
          };
        }, { name: typoCase.expected });
        assert(
          `ru desktop: typo «${typoCase.query}» resolves to «${typoCase.expected}»`,
          typoState.match?.categoryId === typoCase.categoryId && typoState.filteredCardCount === 1,
          JSON.stringify(typoState)
        );
      }
    }

    const breedQuery = await page.evaluate(() => {
      const breedOption = document.querySelector('[data-price-breed-select]');
      const breedToggle = document.querySelector('[data-price-breeds-toggle]');
      const label = (breedOption?.textContent || breedToggle?.dataset.priceBreedSample || '').trim();
      const firstToken = label.split(/[\s/–—-]+/u)[0] || '';
      return firstToken.length >= 2 ? firstToken : label;
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
    await page.locator('[data-price-breed-result]').first().click();
    await page.waitForFunction(
      () => document.querySelectorAll('[data-price-categories] .price-card').length > 0
        && document.querySelector('[data-price-breed-search-suggestions]')?.hidden
        // Selection focuses the target service on the next animation frame.
        // Wait for it before fill('') can compete for the same focus.
        && document.activeElement?.matches('[data-price-service-select]')
        && document.activeElement.closest('[data-category-id]')?.hasAttribute('data-selected-breed-index'),
      null,
      { timeout: 15000 }
    );
    const breedSelectionState = await page.evaluate(() => {
      const status = document.querySelector('[data-price-breed-search-status]');
      return {
        value: document.querySelector('[data-price-breed-search-input]')?.value?.trim() || '',
        cardCount: document.querySelectorAll('[data-price-categories] .price-card').length,
        statusText: status?.textContent?.trim() || '',
        statusDisplay: status ? getComputedStyle(status).display : 'missing',
      };
    });
    assert(
      `${locale} ${label}: selected breed remains visible without redundant status row`,
      breedSelectionState.value.length > 0
        && breedSelectionState.cardCount > 0
        && breedSelectionState.statusText === ''
        && breedSelectionState.statusDisplay === 'none',
      JSON.stringify(breedSelectionState)
    );
    await breedSearch.fill('');
    await page.waitForSelector('[data-price-categories] .price-card', { timeout: 15000 });

    const categoryAction = page.locator('[data-price-categories-action]');
    if (label === 'desktop') {
      // Card filtering schedules an alignment frame that can move the element under
      // the synthetic pointer. Let layout settle, then verify both :hover and motion.
      await page.waitForTimeout(600);
      await categoryAction.hover();
      await page.waitForFunction(
        () => {
          const action = document.querySelector('[data-price-categories-action]');
          const icon = action?.querySelector('.price-page-hero__categories-action-icon');
          const transform = icon ? getComputedStyle(icon).transform : 'missing';
          return Boolean(
            action?.matches(':hover')
              && transform !== 'none'
              && !transform.startsWith('matrix(1, 0, 0, 1, 0, 0)')
          );
        },
        null,
        { timeout: 5000 }
      );
      const arrowHoverState = await categoryAction.evaluate(action => {
        const icon = action.querySelector('.price-page-hero__categories-action-icon');
        return {
          hovered: action.matches(':hover'),
          transform: icon ? getComputedStyle(icon).transform : 'missing',
        };
      });
      assert(
        `${locale} ${label}: category arrow hover motion`,
        arrowHoverState.hovered
          && arrowHoverState.transform !== 'none'
          && !arrowHoverState.transform.startsWith('matrix(1, 0, 0, 1, 0, 0)'),
        JSON.stringify(arrowHoverState)
      );
    }
    const categoryClickState = await categoryAction.evaluate(action => {
      action.click();
      return {
        clickFlashCount: action.querySelectorAll('.nav-plasma--cta-flash').length,
      };
    });
    assert(
      `${locale} ${label}: category navigation click effect`,
      categoryClickState.clickFlashCount === 1,
      JSON.stringify(categoryClickState)
    );
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
    if (label === 'mobile') await informationCard.locator('[data-price-card-toggle]').click();
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

    const firstCard = page.locator('[data-price-categories] .price-card').first();
    if (label === 'mobile') await firstCard.locator('[data-price-card-toggle]').click();
    await firstCard.locator('[data-price-open]').click();
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

    if (locale === 'ru') {
      const modalBreedTrigger = page.locator('#price-category-modal.active [data-price-modal-breed] + .site-select__trigger');
      await modalBreedTrigger.click();
      await page.waitForSelector('#price-category-modal.active .site-select__menu:not([hidden])', { timeout: 5000 });

      const nestedScrollBefore = await page.evaluate(() => ({
        menu: document.querySelector('#price-category-modal.active .site-select__menu')?.scrollTop || 0,
        modal: document.querySelector('#price-category-modal.active .modal-content')?.scrollTop || 0,
      }));
      const modalBreedMenuBox = await page.locator('#price-category-modal.active .site-select__menu').boundingBox();
      if (modalBreedMenuBox) {
        await page.mouse.move(
          modalBreedMenuBox.x + modalBreedMenuBox.width / 2,
          modalBreedMenuBox.y + modalBreedMenuBox.height / 2
        );
        await page.mouse.wheel(0, 180);
        await page.waitForTimeout(180);
      }

      const nestedScrollAfter = await page.evaluate(() => {
        const menu = document.querySelector('#price-category-modal.active .site-select__menu');
        const content = document.querySelector('#price-category-modal.active .modal-content');
        const menuRect = menu?.getBoundingClientRect();
        const nativeSelect = document.querySelector('#price-category-modal.active [data-price-modal-breed]');
        const target = [...(menu?.querySelectorAll('.site-select__option') || [])].find(option => {
          const rect = option.getBoundingClientRect();
          return option.dataset.value !== nativeSelect?.value
            && Boolean(menuRect && rect.top >= menuRect.top && rect.bottom <= menuRect.bottom);
        });
        const targetRect = target?.getBoundingClientRect();
        return {
          menu: menu?.scrollTop || 0,
          modal: content?.scrollTop || 0,
          menuActive: menu?.classList.contains('site-scroll-active'),
          target: targetRect && {
            value: target.dataset.value || '',
            text: target.textContent?.trim() || '',
            x: targetRect.left + targetRect.width / 2,
            y: targetRect.top + targetRect.height / 2,
          },
        };
      });
      assert(
        `ru ${label}: breed select scroll stays inside its menu`,
        nestedScrollAfter.menu > nestedScrollBefore.menu
          && Math.abs(nestedScrollAfter.modal - nestedScrollBefore.modal) <= 1
          && nestedScrollAfter.menuActive,
        JSON.stringify({ before: nestedScrollBefore, after: nestedScrollAfter })
      );

      if (nestedScrollAfter.target) {
        await page.mouse.click(nestedScrollAfter.target.x, nestedScrollAfter.target.y);
        await page.waitForTimeout(180);
      }
      const nestedSelectionState = await page.evaluate(() => {
        const select = document.querySelector('#price-category-modal.active [data-price-modal-breed]');
        return {
          nativeValue: select?.value || '',
          visibleValue: select?.closest('.site-select')?.querySelector('.site-select__value')?.textContent?.trim() || '',
          modalScroll: document.querySelector('#price-category-modal.active .modal-content')?.scrollTop || 0,
          menuClosed: !select?.closest('.site-select')?.classList.contains('is-open'),
        };
      });
      assert(
        `ru ${label}: scrolled breed option is selected without moving modal`,
        Boolean(
          nestedScrollAfter.target
          && nestedSelectionState.nativeValue === nestedScrollAfter.target.value
          && nestedSelectionState.visibleValue === nestedScrollAfter.target.text
          && Math.abs(nestedSelectionState.modalScroll - nestedScrollBefore.modal) <= 1
          && nestedSelectionState.menuClosed
        ),
        JSON.stringify({ target: nestedScrollAfter.target, selection: nestedSelectionState })
      );
    }

    await page.locator('[data-price-modal-service-fieldset] .price-category-modal__service-option').first().click();

      const modalState = await page.evaluate(() => {
        const modal = document.querySelector('#price-category-modal');
        const modalHeader = modal?.querySelector('.price-category-modal__header');
        const selectionHeader = modal?.querySelector('.price-category-modal__selection-header');
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
      const modalContent = modal?.querySelector('.modal-content');
        const legacyMarkup = modal?.querySelector('[data-price-modal-breeds], [data-price-modal-services], [data-price-modal-prices], [data-price-modal-notes]');
        const serviceOptionHeights = Array.from(
          modal?.querySelectorAll('.price-category-modal__service-option:not([hidden])') || []
        ).map(option => option.getBoundingClientRect().height);
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
          modalOverflowX: Boolean(modalContent && modalContent.scrollWidth > modalContent.clientWidth + 1),
          modalHeaderHeight: modalHeader?.getBoundingClientRect().height || 0,
          modalHeaderPosition: modalHeader ? getComputedStyle(modalHeader).position : '',
          selectionHeaderHeight: selectionHeader?.getBoundingClientRect().height || 0,
          selectionHeaderPosition: selectionHeader ? getComputedStyle(selectionHeader).position : '',
          serviceOptionMaxHeight: serviceOptionHeights.length ? Math.max(...serviceOptionHeights) : 0,
          legacyMarkup: Boolean(legacyMarkup),
        };
    });

      assert(`${locale} ${label}: modal title`, modalState.title.length > 0);
      assert(`${locale} ${label}: modal summary`, modalState.summary.length > 0);
      assert(
        `${locale} ${label}: category intro scrolls and selection uses compact sticky header`,
        modalState.modalHeaderPosition !== 'sticky'
          && modalState.modalHeaderHeight > 0
          && modalState.modalHeaderHeight <= 180
          && modalState.selectionHeaderPosition === 'sticky'
          && modalState.selectionHeaderHeight > 0
          && modalState.selectionHeaderHeight <= 190,
        JSON.stringify({
          intro: { position: modalState.modalHeaderPosition, height: modalState.modalHeaderHeight },
          selection: { position: modalState.selectionHeaderPosition, height: modalState.selectionHeaderHeight },
        })
      );
      assert(
        `${locale} ${label}: service controls stay compact`,
        modalState.serviceOptionMaxHeight > 0
          && modalState.serviceOptionMaxHeight <= (label === 'mobile' ? 96 : 90),
        `maxHeight=${modalState.serviceOptionMaxHeight}`
      );
    assert(`${locale} ${label}: breed selector`, modalState.breedOptions > 0);
    assert(`${locale} ${label}: service selector`, modalState.serviceOptions > 0);
    assert(`${locale} ${label}: applicable additional services`, modalState.additionalServicesVisible && modalState.additionalServiceOptions > 0);
    assert(`${locale} ${label}: automatic price`, modalState.selectedPrice.length > 0);
    assert(`${locale} ${label}: conditions block`, modalState.conditionsVisible && initialModalState.conditionsHidden && modalState.conditionsService.length > 0);
    assert(`${locale} ${label}: conditions consent`, modalState.consentVisible && !modalState.consentChecked);
    assert(`${locale} ${label}: one booking button`, modalState.oneBookingButton && modalState.bookingInConditions);
    assert(`${locale} ${label}: modal has no horizontal overflow`, !modalState.modalOverflowX);
    assert(`${locale} ${label}: no legacy duplicate blocks`, !modalState.legacyMarkup);

    if (locale === 'ru' && label === 'desktop') {
      const primaryServices = page.locator('[data-price-modal-service-options] input[type="checkbox"]');
      const dentalWeightControl = page.locator('[data-price-modal-dental-weight]');
      const dentalWeight = page.locator('[data-price-modal-dental-weight-input]');
      const dentalService = page.locator('[data-price-modal-additional-service-options] [data-service-index="3"] input');

      assert('ru desktop: three primary grooming services available', await primaryServices.count() >= 3);
      for (let index = 0; index < 3; index += 1) {
        await primaryServices.nth(index).check({ force: true });
        assert(`ru desktop: primary service ${index + 1} does not request dental weight`, !(await dentalWeightControl.isVisible()));
        assert(`ru desktop: dental option remains selectable for primary service ${index + 1}`, await dentalService.isEnabled());
      }

      await primaryServices.first().check({ force: true });
      assert('ru desktop: dental weight input disabled before dental selection', await dentalWeight.isDisabled());
      await dentalService.check({ force: true });
      const dentalRequiredState = await page.evaluate(() => ({
        weightVisible: Boolean(document.querySelector('[data-price-modal-dental-weight]')?.offsetParent),
        inputEnabled: !document.querySelector('[data-price-modal-dental-weight-input]')?.disabled,
        inputRequired: Boolean(document.querySelector('[data-price-modal-dental-weight-input]')?.required),
        status: document.querySelector('[data-price-modal-dental-weight-status]')?.dataset.state || '',
        dentalChecked: Boolean(document.querySelector('[data-price-modal-additional-service-options] [data-service-index="3"] input')?.checked),
        bookingDisabled: document.querySelector('[data-price-modal-booking]')?.getAttribute('aria-disabled') === 'true',
        totalAmount: document.querySelector('[data-price-modal-selected-price]')?.dataset.totalAmount || '',
        hasDiscount: Boolean(document.querySelector('.price-category-modal__breakdown-discount')),
      }));
      assert(
        'ru desktop: dental selection reveals required weight control',
        dentalRequiredState.weightVisible
          && dentalRequiredState.inputEnabled
          && dentalRequiredState.inputRequired
          && dentalRequiredState.status === 'required'
          && dentalRequiredState.dentalChecked
          && dentalRequiredState.bookingDisabled
          && dentalRequiredState.totalAmount === '180'
          && !dentalRequiredState.hasDiscount,
        JSON.stringify(dentalRequiredState)
      );

      await dentalWeight.fill('6.1');
      const dentalTooHeavyState = await page.evaluate(() => ({
        status: document.querySelector('[data-price-modal-dental-weight-status]')?.dataset.state || '',
        dentalChecked: Boolean(document.querySelector('[data-price-modal-additional-service-options] [data-service-index="3"] input')?.checked),
        bookingDisabled: document.querySelector('[data-price-modal-booking]')?.getAttribute('aria-disabled') === 'true',
        totalAmount: document.querySelector('[data-price-modal-selected-price]')?.dataset.totalAmount || '',
        hasDiscount: Boolean(document.querySelector('.price-category-modal__breakdown-discount')),
      }));
      assert(
        'ru desktop: dental remains selected but booking is blocked over 6 kg',
        dentalTooHeavyState.status === 'ineligible'
          && dentalTooHeavyState.dentalChecked
          && dentalTooHeavyState.bookingDisabled
          && dentalTooHeavyState.totalAmount === '180'
          && !dentalTooHeavyState.hasDiscount,
        JSON.stringify(dentalTooHeavyState)
      );

      await dentalWeight.fill('5.5');
      const dentalCalculation = await page.evaluate(() => ({
        status: document.querySelector('[data-price-modal-dental-weight-status]')?.dataset.state || '',
        dentalChecked: Boolean(document.querySelector('[data-price-modal-additional-service-options] [data-service-index="3"] input')?.checked),
        total: document.querySelector('[data-price-modal-selected-price]')?.textContent?.trim() || '',
        totalAmount: Number(document.querySelector('[data-price-modal-selected-price]')?.dataset.totalAmount || NaN),
        subtotalAmount: Number(document.querySelector('.price-category-modal__breakdown-subtotal')?.dataset.priceSubtotalAmount || NaN),
        subtotalText: document.querySelector('.price-category-modal__breakdown-subtotal')?.textContent?.trim() || '',
        discountLabel: document.querySelector('.price-category-modal__breakdown-discount span')?.textContent?.trim() || '',
        discountAmount: document.querySelector('.price-category-modal__breakdown-discount strong')?.textContent?.trim() || '',
        discountBase: Number(document.querySelector('.price-category-modal__breakdown-discount')?.dataset.priceDiscountBase || NaN),
        discountRate: Number(document.querySelector('.price-category-modal__breakdown-discount')?.dataset.priceDiscountRate || NaN),
        discountValue: Number(document.querySelector('.price-category-modal__breakdown-discount')?.dataset.priceDiscountAmount || NaN),
        discountFormula: document.querySelector('.price-category-modal__breakdown-formula')?.textContent?.trim() || '',
        calculationNote: document.querySelector('[data-price-modal-calculation-note]')?.textContent?.trim() || '',
      }));
      assert(
        'ru desktop: grooming dental discount calculation',
        dentalCalculation.status === 'eligible'
          && dentalCalculation.dentalChecked
          && dentalCalculation.total.includes('150')
          && dentalCalculation.total.includes('Итого от')
          && dentalCalculation.subtotalAmount === 180
          && dentalCalculation.subtotalText.includes('180')
          && dentalCalculation.discountLabel.includes('30%')
          && dentalCalculation.discountAmount.includes('30')
          && dentalCalculation.discountBase === 100
          && dentalCalculation.discountRate === 0.3
          && dentalCalculation.discountValue === 30
          && dentalCalculation.discountFormula.includes('100')
          && dentalCalculation.discountFormula.includes('30%')
          && dentalCalculation.subtotalAmount - dentalCalculation.discountValue === dentalCalculation.totalAmount
          && dentalCalculation.calculationNote.includes('только к стоимости ультразвуковой чистки'),
        JSON.stringify(dentalCalculation)
      );

      await dentalService.uncheck({ force: true });
      const dentalClearedState = await page.evaluate(() => ({
        weightHidden: Boolean(document.querySelector('[data-price-modal-dental-weight]')?.hidden),
        inputDisabled: Boolean(document.querySelector('[data-price-modal-dental-weight-input]')?.disabled),
        inputRequired: Boolean(document.querySelector('[data-price-modal-dental-weight-input]')?.required),
        total: document.querySelector('[data-price-modal-selected-price]')?.textContent?.trim() || '',
        hasDiscount: Boolean(document.querySelector('.price-category-modal__breakdown-discount')),
      }));
      assert(
        'ru desktop: deselecting dental hides weight and removes dental calculation',
        dentalClearedState.weightHidden
          && dentalClearedState.inputDisabled
          && !dentalClearedState.inputRequired
          && dentalClearedState.total.includes('80')
          && !dentalClearedState.hasDiscount,
        JSON.stringify(dentalClearedState)
      );
    }

    await page.screenshot({
      path: path.join(outDir, `${locale}-${screenshotSuffix}.png`),
      fullPage: false,
    });

    await page.waitForTimeout(240);
    const categoryContent = page.locator('#price-category-modal.active .modal-content');
    await page.evaluate(() => {
      window.__priceSmokeCategoryScrollActivity = null;
    });
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
      await page.waitForFunction(
        () => {
          const content = document.querySelector('#price-category-modal.active .modal-content');
          if (!content?.classList.contains('site-scroll-active')) return false;
          const scrollbar = getComputedStyle(content, '::-webkit-scrollbar');
          const thumb = getComputedStyle(content, '::-webkit-scrollbar-thumb');
          window.__priceSmokeCategoryScrollActivity = {
            scrollActive: true,
            scrollbarDisplay: scrollbar.display,
            scrollbarWidth: scrollbar.width,
            thumbBackground: thumb.backgroundColor,
            thumbRadius: thumb.borderRadius,
          };
          return true;
        },
        null,
        { timeout: 1000 }
      );
    }
    const categoryScrollState = await categoryContent.evaluate(content => {
      const root = document.querySelector('.site-scroll-root');
      const scrollbar = getComputedStyle(content, '::-webkit-scrollbar');
      const thumb = getComputedStyle(content, '::-webkit-scrollbar-thumb');
        const observedScrollActivity = window.__priceSmokeCategoryScrollActivity;
        const header = content.querySelector('.price-category-modal__header');
        const selectionHeader = content.querySelector('.price-category-modal__selection-header');
        const close = content.querySelector('.price-category-modal__close');
        const contentRect = content.getBoundingClientRect();
        const headerRect = header?.getBoundingClientRect();
        const selectionHeaderRect = selectionHeader?.getBoundingClientRect();
        const closeRect = close?.getBoundingClientRect();
        return {
        maxScroll: Math.max(0, content.scrollHeight - content.clientHeight),
        scrollTop: content.scrollTop,
        overflowY: getComputedStyle(content).overflowY,
        scrollActive: content.classList.contains('site-scroll-active'),
        scrollbarDisplay: scrollbar.display,
        scrollbarWidth: scrollbar.width,
        thumbBackground: thumb.backgroundColor,
        thumbRadius: thumb.borderRadius,
          observedScrollActivity,
          rootLocked: Boolean(
            root?.classList.contains('price-modal-scroll-locked')
            && getComputedStyle(root).overflowY === 'hidden'
          ),
          headerTop: headerRect?.top || 0,
          headerPosition: header ? getComputedStyle(header).position : '',
          introScrolledAway: Boolean(
            headerRect
            && selectionHeaderRect
            && headerRect.bottom <= selectionHeaderRect.top + 1
          ),
          selectionHeaderTop: selectionHeaderRect?.top || 0,
          selectionHeaderPosition: selectionHeader ? getComputedStyle(selectionHeader).position : '',
          selectionHeaderPinned: Boolean(
            selectionHeaderRect
            && selectionHeaderRect.top >= contentRect.top - 1
            && selectionHeaderRect.top <= contentRect.top + 32
            && selectionHeaderRect.bottom <= contentRect.bottom + 1
          ),
          closeVisible: Boolean(
            closeRect
            && closeRect.top >= contentRect.top - 1
            && closeRect.bottom <= contentRect.bottom + 1
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
      `${locale} ${label}: category modal scroll rail appears only while scrolling`,
      categoryScrollState.maxScroll < 2 || (
        categoryScrollState.overflowY === 'auto'
        && categoryScrollState.observedScrollActivity?.scrollActive
        && categoryScrollState.observedScrollActivity.scrollbarDisplay === 'block'
        && Number.parseFloat(categoryScrollState.observedScrollActivity.scrollbarWidth || '0') === 8
        && Number.parseFloat(categoryScrollState.observedScrollActivity.thumbRadius || '0') >= 999
        && categoryScrollState.observedScrollActivity.thumbBackground !== 'rgba(0, 0, 0, 0)'
      ),
      JSON.stringify(categoryScrollState)
    );
    assert(
      `${locale} ${label}: category intro collapses and breed selection stays pinned`,
      categoryScrollState.headerPosition !== 'sticky'
        && categoryScrollState.introScrolledAway
        && categoryScrollState.selectionHeaderPosition === 'sticky'
        && categoryScrollState.selectionHeaderPinned
        && categoryScrollState.closeVisible,
      JSON.stringify(categoryScrollState)
    );

    if (locale === 'ru' && label === 'desktop') {
      await page.screenshot({
        path: path.join(outDir, 'ru-desktop-category-scrolled.png'),
        fullPage: false,
      });
      await page.waitForTimeout(1300);
      const categoryScrollbarIdle = await categoryContent.evaluate(content => ({
        active: content.classList.contains('site-scroll-active'),
        thumbBackground: getComputedStyle(content, '::-webkit-scrollbar-thumb').backgroundColor,
      }));
      assert(
        'ru desktop: category modal scroll rail fades after scrolling',
        !categoryScrollbarIdle.active && categoryScrollbarIdle.thumbBackground === 'rgba(0, 0, 0, 0)',
        JSON.stringify(categoryScrollbarIdle)
      );
    }

    const serviceConditionsConsent = page.locator('[data-price-modal-service-conditions-consent]');
    await serviceConditionsConsent.check({ force: true });
    assert(
      `${locale} ${label}: service conditions consent selection`,
      await serviceConditionsConsent.isChecked()
    );
    const categoryBookingAction = page.locator('[data-price-modal-booking]');
    assert(
      `${locale} ${label}: category booking action enabled`,
      await categoryBookingAction.getAttribute('aria-disabled') !== 'true'
    );
    await categoryBookingAction.click({ timeout: 15000 });
    try {
      await page.waitForSelector('#client-registration-modal.active', { timeout: 30000 });
    } catch (error) {
      const registrationOpenDiagnostic = await page.evaluate(() => ({
        categoryModalActive: Boolean(document.querySelector('#price-category-modal.active')),
        registrationModalExists: Boolean(document.querySelector('#client-registration-modal')),
        registrationModalActive: Boolean(document.querySelector('#client-registration-modal.active')),
        bookingAriaDisabled: document.querySelector('[data-price-modal-booking]')?.getAttribute('aria-disabled') || '',
        bookingServices: document.querySelector('[data-price-modal-booking]')?.dataset.bookingServices || '',
        consentChecked: Boolean(document.querySelector('[data-price-modal-service-conditions-consent]')?.checked),
      }));
      throw new Error(
        `${locale} ${label}: registration modal did not open: ${JSON.stringify(registrationOpenDiagnostic)}`,
        { cause: error }
      );
    }
      await page.waitForTimeout(600);

      const registrationHeaderBefore = await page.locator('.client-registration-modal__content').evaluate(content => (
        content.querySelector('.client-registration-modal__header')?.getBoundingClientRect().top || 0
      ));
      await page.locator('.client-registration-modal__content').evaluate(content => {
      const maxScroll = Math.max(0, content.scrollHeight - content.clientHeight);
      content.scrollTop = Math.min(maxScroll, content.scrollTop + 160);
    });
    await page.waitForTimeout(160);

    const registrationState = await page.evaluate(() => {
      const modal = document.querySelector('#client-registration-modal');
      const content = modal?.querySelector('.client-registration-modal__content');
      const form = modal?.querySelector('[data-client-registration-form]');
      const root = document.querySelector('.site-scroll-root');
      const actions = form?.querySelector('.client-registration-form__actions');
      const scrollbar = content ? getComputedStyle(content, '::-webkit-scrollbar') : null;
      const thumb = content ? getComputedStyle(content, '::-webkit-scrollbar-thumb') : null;
        const modalMaxScroll = Math.max(0, (content?.scrollHeight || 0) - (content?.clientHeight || 0));
        const header = modal?.querySelector('.client-registration-modal__header');
        const close = modal?.querySelector('.client-registration-modal__close');
        const contentRect = content?.getBoundingClientRect();
        const headerRect = header?.getBoundingClientRect();
        const closeRect = close?.getBoundingClientRect();
        return {
        modalOpen: Boolean(modal?.classList.contains('active')),
        rootLocked: root?.classList.contains('price-modal-scroll-locked')
          && document.body.classList.contains('price-modal-open')
          && getComputedStyle(root || document.body).overflowY === 'hidden',
        modalCanScroll: modalMaxScroll > 1,
        modalScrolled: modalMaxScroll < 2 || (content?.scrollTop || 0) > 0,
        scrollbarStyled: Boolean(
          content
          && getComputedStyle(content).overflowY === 'auto'
          && scrollbar?.display === 'block'
          && Number.parseFloat(scrollbar?.width || '0') === 8
          && Number.parseFloat(thumb?.borderRadius || '0') >= 999
        ),
        matteBackdrop: getComputedStyle(modal || document.body).backdropFilter !== 'none',
        hiddenBreed: form?.querySelector('input[name="pet_breed"]')?.type === 'hidden',
        noSpeciesDuplicate: !form?.querySelector('[name="pet_species_display"]'),
        petContext: Boolean(form?.querySelector('[data-client-registration-pet-context]')?.textContent?.trim()),
          navActions: actions?.querySelectorAll('.btn-neon[data-nav-pill="client-registration-action"]').length === 2,
          singleColumnLayout: form ? getComputedStyle(form).gridTemplateColumns.trim().split(/\s+/).filter(column => Number.parseFloat(column) > 1).length === 1 : false,
          headerTop: headerRect?.top || 0,
          stickyHeader: Boolean(
            header
            && getComputedStyle(header).position === 'sticky'
            && contentRect
            && headerRect
            && closeRect
            && headerRect.top >= contentRect.top - 1
            && closeRect.top >= contentRect.top - 1
            && closeRect.bottom <= contentRect.bottom + 1
          ),
        };
    });

    assert(
      `${locale} ${label}: registration modal scroll isolation`,
      registrationState.modalOpen
        && registrationState.rootLocked
        && registrationState.modalScrolled
        && (!registrationState.modalCanScroll || registrationState.scrollbarStyled),
      JSON.stringify(registrationState)
    );
      assert(
        `${locale} ${label}: registration uses selected pet`,
        registrationState.hiddenBreed && registrationState.noSpeciesDuplicate && registrationState.petContext && registrationState.navActions && registrationState.singleColumnLayout && registrationState.matteBackdrop
      );
      assert(
        `${locale} ${label}: registration header stays visible while modal scrolls`,
        registrationState.stickyHeader
          && Math.abs(registrationState.headerTop - registrationHeaderBefore) <= 1,
        JSON.stringify({ before: registrationHeaderBefore, after: registrationState })
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
    const openedBreedArrowState = await breedToggle.evaluate(toggle => {
      const motion = toggle.querySelector('.price-card__badge-icon-motion');
      const icon = toggle.querySelector('.price-card__badge-icon');
      const motionStyle = motion ? getComputedStyle(motion) : null;
      const iconStyle = icon ? getComputedStyle(icon) : null;
      return {
        expanded: toggle.getAttribute('aria-expanded'),
        motionAnimation: motionStyle?.animationName || '',
        motionPeak: motionStyle?.getPropertyValue('--site-arrow-motion-peak-x').trim() || '',
        rotationAnimation: iconStyle?.animationName || '',
      };
    });
    const openedBreedArrowPasses = openedBreedArrowState.expanded === 'true'
      && openedBreedArrowState.motionAnimation.includes('siteArrowAxisBounce')
      && openedBreedArrowState.motionPeak === '7px'
      && openedBreedArrowState.rotationAnimation.includes('priceBreedArrowOpen');
    assert(
      `${locale} ${label}: opened breed arrow moves right and keeps rotation`,
      openedBreedArrowPasses,
      openedBreedArrowPasses ? '' : JSON.stringify(openedBreedArrowState)
    );
    await page.waitForFunction(
      () => {
        const menu = document.querySelector('.price-card__breed-menu:not([hidden])');
        return Boolean(menu && menu.getAnimations().every(animation => animation.playState === 'finished'));
      },
      null,
      { timeout: 15000 }
    );
    // Opening can trigger a delayed scroll event while fonts/layout settle.
    // Wait for the actual fade-out instead of racing its 900ms idle timer.
    await page.waitForFunction(
      () => {
        const menu = document.querySelector('.price-card__breed-menu:not([hidden])');
        if (!menu) return false;
        const track = menu.querySelector('[data-price-breed-scrollbar]');
        return menu.scrollHeight <= menu.clientHeight + 1
          || Boolean(track && Number.parseFloat(getComputedStyle(track).opacity) === 0);
      },
      null,
      { timeout: 5000 }
    );
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const breedMenuState = await page.evaluate(scrollBefore => {
      const root = document.querySelector('.site-scroll-root');
      const menu = document.querySelector('.price-card__breed-menu:not([hidden])');
      const openCard = menu?.closest('.price-card');
      const rect = menu?.getBoundingClientRect();
      const menuStyle = menu ? getComputedStyle(menu) : null;
      const breedScrollbar = menu?.querySelector('[data-price-breed-scrollbar]');
      const breedScrollbarRect = breedScrollbar?.getBoundingClientRect();
      const breedScrollbarStyle = breedScrollbar ? getComputedStyle(breedScrollbar) : null;
      const hasBreedOverflow = menu ? menu.scrollHeight > menu.clientHeight + 1 : false;
      const breedLabels = [...(menu?.querySelectorAll('.price-card__breed-option') || [])]
        .map(option => option.textContent?.trim())
        .filter(Boolean);
      const serviceButtons = [...(openCard?.querySelectorAll('.price-card__service-option') || [])];
      const intersectingServiceButtons = serviceButtons.filter(button => {
        const buttonRect = button.getBoundingClientRect();
        const horizontalOverlap = rect ? Math.min(buttonRect.right, rect.right) - Math.max(buttonRect.left, rect.left) : 0;
        const verticalOverlap = rect ? Math.min(buttonRect.bottom, rect.bottom) - Math.max(buttonRect.top, rect.top) : 0;
        return Boolean(
          rect
          && horizontalOverlap > 2
          && verticalOverlap > 2
        );
      });
      const menuAboveServices = intersectingServiceButtons.every(button => {
        const buttonRect = button.getBoundingClientRect();
        const x = Math.max(rect.left, buttonRect.left) + (Math.min(rect.right, buttonRect.right) - Math.max(rect.left, buttonRect.left)) / 2;
        const y = Math.max(rect.top, buttonRect.top) + (Math.min(rect.bottom, buttonRect.bottom) - Math.max(rect.top, buttonRect.top)) / 2;
        const topElement = document.elementFromPoint(x, y);
        return topElement === menu || Boolean(topElement && menu.contains(topElement));
      });
      const overlapTopElements = intersectingServiceButtons.map(button => {
        const buttonRect = button.getBoundingClientRect();
        const x = Math.max(rect.left, buttonRect.left) + (Math.min(rect.right, buttonRect.right) - Math.max(rect.left, buttonRect.left)) / 2;
        const y = Math.max(rect.top, buttonRect.top) + (Math.min(rect.bottom, buttonRect.bottom) - Math.max(rect.top, buttonRect.top)) / 2;
        const topElement = document.elementFromPoint(x, y);
        return {
          text: button.textContent?.trim() || '',
          point: { x, y },
          buttonRect: { top: buttonRect.top, right: buttonRect.right, bottom: buttonRect.bottom, left: buttonRect.left },
          top: topElement?.className || topElement?.tagName || '',
          topZ: topElement ? getComputedStyle(topElement).zIndex : '',
          menuZ: menuStyle?.zIndex || '',
          topSectionZ: openCard?.querySelector('.price-card__top') ? getComputedStyle(openCard.querySelector('.price-card__top')).zIndex : '',
          detailsZ: openCard?.querySelector('.price-card__details') ? getComputedStyle(openCard.querySelector('.price-card__details')).zIndex : '',
        };
      });
      return {
        rootStable: Math.abs((root?.scrollTop || 0) - scrollBefore) <= 2,
        rootLocked: root?.classList.contains('price-breed-menu-scroll-locked'),
        insideViewport: Boolean(rect && rect.left >= 8 && rect.right <= window.innerWidth - 8 && rect.top >= 8 && rect.bottom <= window.innerHeight - 8),
        boundedWidth: Boolean(rect && rect.width <= 681),
        roundedMenu: Boolean(menuStyle && Number.parseFloat(menuStyle.borderRadius) >= 18),
        scrollbarContained: !hasBreedOverflow || Boolean(
          rect
          && breedScrollbarRect
          && breedScrollbarRect.top > rect.top
          && breedScrollbarRect.right < rect.right
          && breedScrollbarRect.bottom < rect.bottom
        ),
        scrollbarRounded: !hasBreedOverflow || Boolean(
          breedScrollbarRect
          && breedScrollbarStyle
          && Number.parseFloat(breedScrollbarStyle.borderRadius) >= breedScrollbarRect.width / 2
        ),
        scrollbarIdleHidden: !hasBreedOverflow || Number.parseFloat(breedScrollbarStyle?.opacity || '1') === 0,
        breedLabels,
        menuAboveServices,
        overlapTopElements,
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
      && breedMenuState.roundedMenu
      && breedMenuState.scrollbarContained
      && breedMenuState.scrollbarRounded
      && breedMenuState.scrollbarIdleHidden
      && breedMenuState.menuAboveServices
      && breedMenuState.menuOpaque;
    assert(
      `${locale} ${label}: breed menu stays in its layer`,
      breedMenuPasses,
      breedMenuPasses ? '' : JSON.stringify(breedMenuState)
    );
    if (locale === 'ru') {
      assert(
        `${locale} ${label}: Russian Colored Bolonka label is canonical`,
        breedMenuState.breedLabels.includes('Русская Цветная болонка')
          && !breedMenuState.breedLabels.some(name => name.includes('/') || /Zwetna/i.test(name)),
        JSON.stringify(breedMenuState.breedLabels)
      );
    }

    const outsideBreedMenuTarget = page.locator('[data-price-categories] .price-size-section__heading').first();
    await outsideBreedMenuTarget.evaluate(target => {
      target.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        pointerType: 'touch',
      }));
    });
    await page.waitForFunction(
      () => !document.querySelector('.price-card__breed-menu:not([hidden])'),
      null,
      { timeout: 5000 }
    );
    assert(
      `${locale} ${label}: touch outside closes breed menu`,
      await breedToggle.getAttribute('aria-expanded') === 'false'
    );

    await breedToggle.evaluate(toggle => toggle.click());
    await page.waitForSelector('.price-card__breed-menu:not([hidden])', { timeout: 15000 });

    await page.keyboard.press('Escape');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const closedBreedArrowState = await breedToggle.evaluate(toggle => {
      const motion = toggle.querySelector('.price-card__badge-icon-motion');
      const icon = toggle.querySelector('.price-card__badge-icon');
      const motionStyle = motion ? getComputedStyle(motion) : null;
      const iconStyle = icon ? getComputedStyle(icon) : null;
      return {
        expanded: toggle.getAttribute('aria-expanded'),
        motionAnimation: motionStyle?.animationName || '',
        motionPeak: motionStyle?.getPropertyValue('--site-arrow-motion-peak-x').trim() || '',
        rotationAnimation: iconStyle?.animationName || '',
      };
    });
    const closedBreedArrowPasses = closedBreedArrowState.expanded === 'false'
      && closedBreedArrowState.motionAnimation.includes('siteArrowAxisBounce')
      && closedBreedArrowState.motionPeak === '-7px'
      && closedBreedArrowState.rotationAnimation.includes('priceBreedArrowClose');
    assert(
      `${locale} ${label}: closed breed arrow moves left and keeps rotation`,
      closedBreedArrowPasses,
      closedBreedArrowPasses ? '' : JSON.stringify(closedBreedArrowState)
    );
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
await staticServer?.close();

console.log(
  JSON.stringify(
    {
      ok: true,
      screenshots: locales.flatMap(locale => layouts.map(([, , screenshotSuffix]) =>
        path.join(outDir, `${locale}-${screenshotSuffix}.png`)
      )).concat(additionalScreenshots),
      checks,
    },
    null,
    2
  )
);
