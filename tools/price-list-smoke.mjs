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
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    locale: locale === 'de' ? 'de-DE' : locale === 'en' ? 'en-GB' : locale === 'uk' ? 'uk-UA' : 'ru-RU',
  });
  const page = await context.newPage();
  const url = `${baseUrl}/${locale}/prays-list.html`;

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const cookieAccept = page.locator('[data-cookie-choice="accept"]');
  if (await cookieAccept.count()) {
    await cookieAccept.first().click();
  }
  await page.waitForSelector('[data-price-configurator][data-price-ready="true"]', { timeout: 15000 });
  await page.locator('[data-price-configurator]').scrollIntoViewIfNeeded();

  const state = await page.evaluate(() => {
    const root = document.querySelector('[data-price-configurator]');
    const serviceSelect = root?.querySelector('[data-price-service-select]');
    const optionSelect = root?.querySelector('[data-price-option-select]');
    const title = root?.querySelector('[data-price-result-title]')?.textContent?.trim() || '';
    const price = root?.querySelector('[data-price-result-price]')?.textContent?.trim() || '';
    const button = root?.querySelector('.select-service-btn');
    const wrapper = root?.querySelector('[data-price-booking-wrapper]');
    const firstTable = document.querySelector('.price-page .table-wrapper table');
    const firstRow = firstTable?.querySelector('tbody tr td');
    const controls = root?.querySelector('.price-configurator__controls');
    const result = root?.querySelector('.price-configurator__result');
    const actions = root?.querySelector('.price-configurator__actions');
    const controlsRect = controls?.getBoundingClientRect();
    const resultRect = result?.getBoundingClientRect();
    const actionsRect = actions?.getBoundingClientRect();

    return {
      serviceCount: serviceSelect?.options.length || 0,
      optionCount: optionSelect?.options.length || 0,
      title,
      price,
      buttonDisabled: button?.disabled ?? true,
      bookingService: wrapper?.dataset.service || '',
      tableHasDataLabel: Boolean(firstRow?.dataset.label),
      orderOk: Boolean(
        controlsRect &&
          resultRect &&
          actionsRect &&
          controlsRect.top < resultRect.top &&
          resultRect.top < actionsRect.top
      ),
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });

  assert(`${locale}: configurator ready`, state.serviceCount > 0 && state.optionCount > 0);
  assert(`${locale}: price populated`, state.price.length > 0 && state.title.length > 0);
  assert(`${locale}: booking enabled`, !state.buttonDisabled && state.bookingService.length > 0);
  assert(`${locale}: mobile table labels`, state.tableHasDataLabel);
  assert(`${locale}: mobile block order`, state.orderOk);
  assert(`${locale}: no horizontal overflow`, !state.overflowX);

  await page.selectOption('[data-price-service-select]', { index: 2 });
  await page.waitForTimeout(150);

  const afterChange = await page.evaluate(() => ({
    price: document.querySelector('[data-price-result-price]')?.textContent?.trim() || '',
    title: document.querySelector('[data-price-result-title]')?.textContent?.trim() || '',
  }));

  assert(`${locale}: updates on service change`, afterChange.price.length > 0 && afterChange.title.length > 0);

  await page.screenshot({
    path: path.join(outDir, `${locale}-mobile.png`),
    fullPage: false,
  });

  await context.close();
}

await browser.close();

console.log(
  JSON.stringify(
    {
      ok: true,
      screenshots: locales.map(locale => path.join(outDir, `${locale}-mobile.png`)),
      checks,
    },
    null,
    2
  )
);
