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
    assert(`${locale} ${label}: cards rendered`, state.cardCount >= 9);
    assert(`${locale} ${label}: card text present`, state.cardTitle.length > 0 && state.cardSummary.length > 0);
    assert(`${locale} ${label}: open button rendered`, state.cardButtonLabel.length > 0);
    assert(`${locale} ${label}: no horizontal overflow`, !state.overflowX);
    assert(`${locale} ${label}: modal exists`, state.modalReady);

    await page.locator('[data-price-categories] [data-price-open]').first().click();
    await page.waitForSelector('#price-category-modal.active', { timeout: 15000 });

    const modalState = await page.evaluate(() => {
      const modal = document.querySelector('#price-category-modal');
      const title = modal?.querySelector('[data-price-modal-title]')?.textContent?.trim() || '';
      const summary = modal?.querySelector('[data-price-modal-summary]')?.textContent?.trim() || '';
      const breeds = modal?.querySelectorAll('[data-price-modal-breeds] li').length || 0;
      const services = modal?.querySelectorAll('[data-price-modal-services] li').length || 0;
      const prices = modal?.querySelectorAll('[data-price-modal-prices] tr').length || 0;
      return { title, summary, breeds, services, prices };
    });

    assert(`${locale} ${label}: modal title`, modalState.title.length > 0);
    assert(`${locale} ${label}: modal summary`, modalState.summary.length > 0);
    assert(`${locale} ${label}: modal breeds`, modalState.breeds > 0);
    assert(`${locale} ${label}: modal services`, modalState.services > 0);
    assert(`${locale} ${label}: modal prices`, modalState.prices > 0);

    await page.screenshot({
      path: path.join(outDir, `${locale}-${screenshotSuffix}.png`),
      fullPage: false,
    });

    await page.keyboard.press('Escape');
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
      ]),
      checks,
    },
    null,
    2
  )
);
