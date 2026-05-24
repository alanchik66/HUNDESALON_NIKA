import { chromium } from 'playwright';

const url = process.argv[2] || 'http://127.0.0.1:5502/ru/index.html';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const consoleErrors = [];
const failedRequests = [];

page.on('console', msg => {
  if (msg.type() === 'error') {
    consoleErrors.push(msg.text());
  }
});

page.on('requestfailed', req => {
  failedRequests.push({ url: req.url(), error: req.failure()?.errorText });
});

page.on('response', async res => {
  const u = res.url();
  if (
    (u.includes('open-meteo') || u.includes('nominatim') || u.includes('weatherapi') || u.includes('ipwho')) &&
    res.status() >= 400
  ) {
    failedRequests.push({ url: u, status: res.status() });
  }
});

await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(8000);

const host = page.locator('.header-weather-widget');
const mounted = await host.getAttribute('data-weather-mounted');
const location = await host.getAttribute('data-weather-location');

await page.waitForSelector('.header-weather-widget[data-weather-mounted="true"]', { timeout: 60000 });
await page.waitForTimeout(2000);

await page.locator('.header-weather-widget').evaluate(el => {
  const root = el.shadowRoot;
  const toggle =
    root?.querySelector('.weather-header-card__toggle') ||
    root?.querySelector('.weather-header-trigger') ||
    root?.querySelector('button[aria-expanded]');
  toggle?.click();
});
await page.waitForTimeout(4000);

const errorText = await page.locator('.header-weather-widget').evaluate(el => {
  const root = el.shadowRoot;
  if (!root) return { noShadow: true };
  const notice = root.querySelector('.weather-header-dropdown__notice')?.textContent?.trim() || '';
  return {
    notice,
    hasSearchError: /Не удалось загрузить погоду/i.test(notice),
    forecastPills: root.querySelectorAll('.weather-header-dropdown__forecast-pill').length,
    expanded: root.querySelector('.weather-header-trigger')?.getAttribute('aria-expanded'),
    temp: root.querySelector('.weather-header-card__temperature')?.textContent?.trim(),
    location: root.querySelector('.weather-header-card__location')?.textContent?.trim(),
  };
});

const sunScene404 = failedRequests.filter(r => String(r.url).includes('header-weather-sun-scene'));

console.log(
  JSON.stringify(
    {
      url,
      mounted,
      location,
      errorText,
      sunScene404,
      consoleErrors: consoleErrors.slice(0, 8),
      failedRequests: failedRequests.slice(0, 12),
    },
    null,
    2
  )
);

await browser.close();
