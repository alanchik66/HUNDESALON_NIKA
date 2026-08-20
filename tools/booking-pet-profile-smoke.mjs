import { mkdir } from 'node:fs/promises';
import { chromium, devices } from 'playwright';

const baseUrl = process.argv[2] || 'http://127.0.0.1:8788';
const outputDir = 'test-results/booking-auto-species';
const expected = {
  ru: { species: 'Собака', breed: 'Йоркширский терьер' },
  uk: { species: 'Собака', breed: 'Йоркширський тер’єр' },
  en: { species: 'Dog', breed: 'Yorkshire Terrier' },
  de: { species: 'Hund', breed: 'Yorkshire Terrier' },
};
const locales = (process.argv[3] ? process.argv[3].split(',') : Object.keys(expected)).filter(locale => expected[locale]);

const getFutureDate = () => {
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return [...document.querySelectorAll('.calendar-day[data-date]:not(.is-disabled)')]
    .map(button => button.dataset.date)
    .find(date => date > todayIso) || '';
};

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const locale of locales) {
    for (const mode of ['desktop', 'mobile']) {
      const mobile = mode === 'mobile';
      const context = await browser.newContext({
        viewport: mobile ? devices['iPhone 13'].viewport : { width: 1440, height: 1000 },
        isMobile: mobile,
        hasTouch: mobile,
      });
      const page = await context.newPage();
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));

      try {
        await page.goto(`${baseUrl}/${locale}/onlayn-bronirovanie.html`, {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });
        const cookieAccept = page.locator('[data-cookie-choice="accept"]');
        if (await cookieAccept.count()) await cookieAccept.first().click();

        await page.locator('#open-booking-btn').click();
        await page.waitForSelector('#booking-modal.active', { timeout: 15000 });
        await page.waitForSelector('[data-booking-breed]', { timeout: 15000 });
        await page.locator('[data-booking-client-type]').selectOption('new');
        await page.locator('[data-booking-coat-condition]').selectOption('good');
        await page.locator('[data-booking-behavior]').selectOption('calm');
        await page.locator('#next-step-1').click();
        await page.waitForSelector('#step-2.active', { timeout: 15000 });

        const futureDate = await page.evaluate(getFutureDate);
        if (!futureDate) throw new Error(`${locale} ${mode}: future date missing`);
        await page.locator(`[data-date="${futureDate}"]`).click();
        await page.waitForFunction(
          () => document.querySelector('[data-booking-availability-status]')?.dataset.state !== 'loading',
          null,
          { timeout: 15000 }
        );
        await page.waitForFunction(
          () => document.querySelectorAll('#time-slots-container .time-slot').length > 0,
          null,
          { timeout: 15000 }
        );
        await page.locator('#time-slots-container .time-slot').first().click();
        await page.locator('#next-step-2').click();
        await page.waitForSelector('#step-3.active', { timeout: 15000 });
        await page.waitForTimeout(1000);

        const state = await page.evaluate(() => {
          const registration = document.querySelector('[data-booking-pet-registration]');
          const species = registration?.querySelector('[name="pet_species"]');
          const speciesDisplay = registration?.querySelector('[data-booking-pet-species-display]');
          const breed = registration?.querySelector('[name="pet_breed"]');
          const activeStep = document.querySelector('#step-3.active');
          return {
            speciesSelectCount: registration?.querySelectorAll('select[name="pet_species"]').length || 0,
            speciesKey: species?.value || '',
            speciesDisplay: speciesDisplay?.value || '',
            breed: breed?.value || '',
            breedReadonly: Boolean(breed?.readOnly),
            activeStepHeight: activeStep?.clientHeight || 0,
            activeStepScrollHeight: activeStep?.scrollHeight || 0,
            pageOverflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
          };
        });
        const expectedLocale = expected[locale];

        if (state.speciesSelectCount !== 0) throw new Error(`${locale} ${mode}: duplicate species select remains`);
        if (state.speciesKey !== 'dog') throw new Error(`${locale} ${mode}: species key is ${state.speciesKey}`);
        if (state.speciesDisplay !== expectedLocale.species) {
          throw new Error(`${locale} ${mode}: species label is ${state.speciesDisplay}`);
        }
        if (state.breed !== expectedLocale.breed) throw new Error(`${locale} ${mode}: breed is ${state.breed}`);
        if (!state.breedReadonly) throw new Error(`${locale} ${mode}: breed is not readonly`);
        if (state.pageOverflowX) throw new Error(`${locale} ${mode}: horizontal overflow`);
        if (pageErrors.length) throw new Error(`${locale} ${mode}: ${pageErrors.join(' | ')}`);

        if (locale === 'ru') {
          await page.screenshot({ path: `${outputDir}/ru-${mode}-step-3-auto.png`, fullPage: false });
        }
        results.push({ locale, mode, ...state });
      } finally {
        await context.close();
      }
    }
  }

  if (locales.includes('ru')) {
    const speciesCases = [
      { label: 'Кошки', key: 'cat', display: 'Кошка' },
      { label: 'Морские свинки', key: 'guinea_pig', display: 'Морская свинка' },
      { label: 'Кролики', key: 'rabbit', display: 'Кролик' },
    ];
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}/ru/onlayn-bronirovanie.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const cookieAccept = page.locator('[data-cookie-choice="accept"]');
      if (await cookieAccept.count()) await cookieAccept.first().click();
      await page.locator('#open-booking-btn').click();
      await page.waitForSelector('[data-booking-breed]', { timeout: 15000 });

      for (const speciesCase of speciesCases) {
        const optionValue = await page.locator('[data-booking-breed] option').evaluateAll((options, label) => {
          return options.find(option => option.textContent?.includes(label))?.value || '';
        }, speciesCase.label);
        if (!optionValue) throw new Error(`ru species case option missing: ${speciesCase.label}`);
        await page.locator('[data-booking-breed]').selectOption(optionValue);
        const detected = await page.evaluate(() => ({
          key: document.querySelector('[data-booking-pet-species]')?.value || '',
          display: document.querySelector('[data-booking-pet-species-display]')?.value || '',
        }));
        if (detected.key !== speciesCase.key || detected.display !== speciesCase.display) {
          throw new Error(`ru species case ${speciesCase.label}: ${JSON.stringify(detected)}`);
        }
        results.push({ locale: 'ru', mode: `species-${speciesCase.key}`, ...detected });
      }
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ ok: true, results }, null, 2));
