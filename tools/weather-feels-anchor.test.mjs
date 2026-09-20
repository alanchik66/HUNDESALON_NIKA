import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.WEATHER_FEELS_TEST_URL || 'http://127.0.0.1:5502';
const pageSlug = process.env.WEATHER_FEELS_TEST_PAGE || 'do-i-posle.html';
const locales = ['de', 'en', 'ru', 'uk'];
const viewports = [320, 360, 390, 560, 768, 899, 900, 901, 1024, 1280, 1281, 1440, 1920, 390];
const tolerancePx = 1;
const screenshotDir = process.env.WEATHER_FEELS_SCREENSHOT_DIR || '';

if (screenshotDir) {
  await mkdir(screenshotDir, { recursive: true });
}

const browser = await chromium.launch({ headless: true });

try {
  for (const locale of locales) {
    const page = await browser.newPage({ viewport: { width: viewports[0], height: 900 } });

    try {
      await page.goto(`${baseUrl}/${locale}/${pageSlug}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      await page.waitForSelector('.header-weather-widget[data-weather-mounted="true"]', {
        timeout: 60_000,
      });
      await page.waitForFunction(
        () => {
          const root = document.querySelector('.header-weather-widget')?.shadowRoot;
          return Boolean(
            root?.querySelector('.weather-header-card__eyebrow')?.getBoundingClientRect().width &&
              root?.querySelector('.weather-header-card__chip--feels-like[data-weather-feels-layout="custom"]')
          );
        },
        null,
        { timeout: 60_000 }
      );
      await page.evaluate(() => document.fonts.ready);

      for (const width of viewports) {
        // City width must never become the alignment reference, even when it
        // is much longer than the localized geolocation eyebrow.
        await page.locator('.header-weather-widget').evaluate((host, nextWidth) => {
          host.dataset.weatherResolvedLocationLabel = 'Leipzig - Stötteritz';
          const city = host.shadowRoot?.querySelector('.weather-header-card__location');
          if (city) city.textContent = 'Leipzig - Stötteritz';
          // Exercise new readings as well as relayout; neither path may write
          // numbers into the approximation column or flatten the styled value.
          host.__weatherHumidityValue = `${40 + nextWidth % 50}%`;
          host.__weatherReadingsSnapshot = {
            ...host.__weatherReadingsSnapshot,
            humidity: host.__weatherHumidityValue,
          };
          host.__weatherPressureMmHg = 760 + nextWidth % 10;
          window.dispatchEvent(new Event('resize'));
        }, width);
        await page.setViewportSize({ width, height: 900 });
        await page.waitForTimeout(350);

        const geometry = await page.locator('.header-weather-widget').evaluate(host => {
          const root = host.shadowRoot;
          const location = root?.querySelector('.weather-header-card__eyebrow');
          const feels = root?.querySelector('.weather-header-card__chip--feels-like');
          const range = document.createRange();
          range.selectNodeContents(location);
          const locationBox = range.getBoundingClientRect();
          const feelsBox = feels?.getBoundingClientRect();
          const metrics = ['pressure', 'humidity'].map(metric => {
            const chip = root.querySelector(`[data-weather-metric="${metric}"]`);
            const children = Array.from(chip?.children || []);
            return {
              metric,
              count: children.length,
              approx: children[1]?.textContent,
              valueParts: children[2]?.childElementCount,
              metaParts: children[0]?.childElementCount,
              value: children[2]?.textContent,
              expected: metric === 'pressure' ? String(Math.round(host.__weatherPressureMmHg)) : host.__weatherHumidityValue,
              valueFontSizes: Array.from(children[2]?.children || []).map(node => Number.parseFloat(getComputedStyle(node).fontSize)),
              right: chip?.getBoundingClientRect().right,
              columns: children.map(node => getComputedStyle(node).gridColumnStart),
              text: chip?.textContent,
            };
          });

          return {
            metrics,
            location: location?.textContent?.trim() || '',
            locationRight: locationBox?.right ?? null,
            feelsRight: feelsBox?.right ?? null,
            label: feels?.querySelector('.weather-header-card__feels-label')?.textContent,
            labelLeft: feels?.querySelector('.weather-header-card__feels-label')?.getBoundingClientRect().left,
            prefixLeft: feels?.querySelector('.weather-header-card__feels-prefix')?.getBoundingClientRect().left,
            labelRight: feels?.querySelector('.weather-header-card__feels-label')?.getBoundingClientRect().right,
            dataRight: feels?.querySelector('.weather-header-card__feels-temp')?.getBoundingClientRect().right,
            contentRight: Math.max(...Array.from(feels?.querySelectorAll('*') || [], node => node.getBoundingClientRect().right)),
          };
        });

        assert.ok(geometry.locationRight !== null, `${locale}/${width}: location label is missing`);
        for (const metric of geometry.metrics) {
          const context = `${locale}/${width}/${metric.metric}: ${metric.text}`;
          assert.equal(metric.count, 3, `${context}: label, approximation and value only`);
          assert.equal(metric.approx, '≈', `${context}: approximation must not be overwritten by a duplicate value`);
          assert.equal(metric.value, metric.expected, `${context}: update the actual value, not the approximation`);
          assert.deepEqual(metric.columns, ['1', '2', '3'], `${context}: restore the three-column layout`);
          if (metric.metric === 'pressure') {
            assert.equal(metric.metaParts, 2, `${context}: preserve pressure label and localized unit`);
          } else {
            assert.equal(metric.valueParts, 2, `${context}: preserve separate number and small percent symbol`);
            assert.ok(metric.valueFontSizes[1] < metric.valueFontSizes[0], `${context}: percent must remain smaller than the number`);
          }
        }
        assert.ok(
          Math.abs(geometry.metrics[0].right - geometry.metrics[1].right) <= tolerancePx,
          `${locale}/${width}: pressure and humidity must share their right edge`
        );
        assert.ok(geometry.feelsRight !== null, `${locale}/${width}: feels-like block is missing`);
        assert.ok(
          Math.abs(geometry.feelsRight - geometry.locationRight) <= tolerancePx,
          `${locale}/${width}: feels-like right edge ${geometry.feelsRight}px does not match ` +
            `location "${geometry.location}" right edge ${geometry.locationRight}px`
        );
        for (const edge of ['labelRight', 'dataRight', 'contentRight']) {
          assert.ok(
            Math.abs(geometry[edge] - geometry.locationRight) <= tolerancePx,
            `${locale}/${width}: ${edge} ${geometry[edge]}px must match eyebrow ` +
              `"${geometry.location}" ${geometry.locationRight}px`
          );
        }

        if (locale === 'en') {
          assert.equal(geometry.label, 'APPARENT', `${locale}/${width}: English apparent-temperature label`);
          assert.ok(
            Math.abs(geometry.labelLeft - geometry.prefixLeft) <= tolerancePx,
            `${locale}/${width}: APPARENT left edge ${geometry.labelLeft}px must match LIKE ${geometry.prefixLeft}px`
          );
        }

        if (screenshotDir && ['ru', 'en'].includes(locale) && [360, 768, 1440].includes(width)) {
          await page.locator('.header-weather-shell').screenshot({
            path: path.join(screenshotDir, `weather-feels-${locale}-${width}.png`),
          });
        }
      }
      console.log(`${locale}: metrics, changing readings and feels alignment passed ${viewports.length} viewport steps.`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

console.log(
  `Weather feels-like anchor: ${locales.length} locales x ${viewports.length} responsive widths passed.`
);
