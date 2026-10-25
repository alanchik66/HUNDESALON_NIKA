import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startStaticTestServer } from '../../tools/lib/static-test-server.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const candidateRoot = '/output/weather-source-candidate';
const baselineRoot = '/3d-weather-codrops-main/dist-widget';
const artifactDirectory = path.join(repositoryRoot, 'output/playwright/weather-source-parity');
const variants = [
  { name: 'widget', file: 'weather-widget.es.js', variant: 'default' },
  { name: 'header-preview', file: 'weather-widget.header-panel-preview.es.js', variant: 'header' },
  { name: 'header-dropdown', file: 'weather-widget.header-panel-dropdown-scene.es.js', variant: 'header' },
];
const conditions = [
  { text: 'Sunny', code: 1000, is_day: 1 },
  { text: 'Light rain', code: 1183, is_day: 1 },
  { text: 'Light snow', code: 1213, is_day: 0 },
  { text: 'Thundery outbreaks possible', code: 1087, is_day: 0 },
];
const transparentTexture = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+cXWQAAAAASUVORK5CYII=',
  'base64'
);
const fontFixtures = new Map();
async function getFontFixture(url) {
  if (!fontFixtures.has(url))
    fontFixtures.set(
      url,
      (async () => {
        const relative = new URL(url).pathname.split('/packages/data/')[1];
        if (!relative || relative.includes('..')) throw new Error('Unexpected font fixture URL');
        const cachePath = path.join(
          artifactDirectory,
          'font-cache',
          createHash('sha256').update(relative).digest('hex')
        );
        try {
          return await fs.readFile(cachePath);
        } catch {}
        const source =
          'https://raw.githubusercontent.com/lojjic/unicode-font-resolver/v1.0.1/packages/data/' + relative;
        const bytes = await new Promise((resolve, reject) => {
          const request = https.get(source, { family: 4 }, response => {
            if (response.statusCode !== 200) {
              response.resume();
              reject(new Error('Font fixture HTTP ' + response.statusCode));
              return;
            }
            const chunks = [];
            let size = 0;
            response.on('data', chunk => {
              size += chunk.length;
              if (size > 5 * 1024 * 1024) request.destroy(new Error('Oversized font fixture'));
              else chunks.push(chunk);
            });
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
          });
          request.setTimeout(20000, () => request.destroy(new Error('Font fixture timed out')));
          request.on('error', reject);
        });
        await fs.mkdir(path.dirname(cachePath), { recursive: true });
        await fs.writeFile(cachePath, bytes);
        return bytes;
      })()
    );
  return fontFixtures.get(url);
}
const report = {
  scenarios: [],
  fixtureLimit:
    'Deterministic weather and cloud texture fixtures verify wrapper/scene behavior and DOM parity; they do not verify live weather providers or original third-party texture rights.',
};

function fixture(condition) {
  const current = {
    temp_c: 16,
    temp_f: 60.8,
    feelslike_c: 14,
    feelslike_f: 57.2,
    wind_mph: 6.8,
    vis_miles: 6.2,
    wind_kph: 11,
    humidity: 72,
    vis_km: 10,
    pressure_mb: 1014,
    gust_kph: 17,
    cloud: 40,
    precip_mm: 0.2,
    ...condition,
    condition: { text: condition.text, code: condition.code, icon: '' },
  };
  return {
    location: {
      name: 'Leipzig',
      region: 'Saxony',
      country: 'Germany',
      lat: 51.34,
      lon: 12.37,
      localtime: '2026-10-09 12:00',
      tz_id: 'Europe/Berlin',
    },
    current,
    forecast: {
      forecastday: [0, 1, 2].map(index => ({
        date: '2026-10-' + String(9 + index).padStart(2, '0'),
        day: {
          maxtemp_c: 18,
          maxtemp_f: 64.4,
          mintemp_c: 10,
          mintemp_f: 50,
          avgtemp_c: 14,
          avgtemp_f: 57.2,
          maxwind_kph: 18,
          totalprecip_mm: 0.2,
          avghumidity: 70,
          daily_chance_of_rain: 20,
          daily_chance_of_snow: 0,
          uv: 2,
          condition: current.condition,
        },
        astro: { sunrise: '07:20 AM', sunset: '06:30 PM' },
      })),
    },
  };
}

async function state(page) {
  return page.evaluate(() => {
    const root = document.querySelector('#fixture-host').shadowRoot;
    const round = value => Math.round(value * 100) / 100;
    const selector =
      '[data-weather-widget-root], .weather-app, .weather-header-preview, .weather-header-card, .weather-header-dropdown, .weather-header-card__temperature, .weather-header-card__location, button, input, canvas';
    return {
      text: root.textContent.replace(root.querySelector('style').textContent, '').replace(/\s+/g, ' ').trim(),
      geometry: [...root.querySelectorAll(selector)].map(element => {
        const rectangle = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          class: element.className?.baseVal ?? element.className,
          x: round(rectangle.x),
          y: round(rectangle.y),
          width: round(rectangle.width),
          height: round(rectangle.height),
          expanded: element.getAttribute('aria-expanded'),
        };
      }),
      canvas: [...root.querySelectorAll('canvas')].map(element => ({ width: element.width, height: element.height })),
    };
  });
}

await fs.mkdir(artifactDirectory, { recursive: true });
await fs.access(path.join(repositoryRoot, candidateRoot, 'weather-widget.es.js'));
const server = await startStaticTestServer(repositoryRoot);
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
try {
  for (const entry of variants) {
    for (let index = 0; index < 8; index++) {
      const locale = ['de', 'en', 'ru', 'uk'][index % 4];
      const mobile = index >= 4;
      const viewport = mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 };
      const condition = conditions[index % conditions.length];
      const name = entry.name + '-' + locale + '-' + (mobile ? 'mobile' : 'desktop');
      const pair = {};
      for (const [label, directory] of [
        ['baseline', baselineRoot],
        ['candidate', candidateRoot],
      ]) {
        const context = await browser.newContext({
          viewport,
          isMobile: mobile,
          hasTouch: mobile,
          reducedMotion: 'reduce',
          serviceWorkers: 'block',
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => {
          if (message.type() === 'error') {
            errors.push(message.text());
            console.log('BROWSER ERROR', message.text(), JSON.stringify(message.location()));
          }
        });
        page.on('requestfailed', request => console.log('FAILED REQUEST', request.url(), request.failure()?.errorText));
        await page.route('**/*', async route => {
          const url = new URL(route.request().url());
          if (url.pathname === '/weather-source-fixture.html') {
            await route.fulfill({
              contentType: 'text/html',
              body:
                '<!doctype html><html lang="' +
                locale +
                '"><head><meta charset="utf-8"><style>body{margin:0;background:#111820;color:white}#fixture-host{margin:16px;width:' +
                (mobile ? '358px' : entry.variant === 'header' ? '380px' : '780px') +
                ';height:' +
                (entry.variant === 'header' ? '132px' : '620px') +
                '}</style></head><body><div id="fixture-host" style="height:' +
                (entry.variant === 'header' ? '132px' : '620px') +
                ';width:' +
                (mobile ? '358px' : entry.variant === 'header' ? '380px' : '780px') +
                ';position:relative;"></div></body></html>',
            });
          } else if (url.origin === server.baseUrl) {
            await route.continue();
          } else if (/githack\.com$/.test(url.hostname) && url.pathname.endsWith('/cloud.png')) {
            await route.fulfill({ contentType: 'image/png', body: transparentTexture });
          } else if (/githack\.com$/.test(url.hostname) && url.pathname.endsWith('.hdr')) {
            await route.fulfill({
              contentType: 'application/octet-stream',
              body: Buffer.concat([
                Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 1 +X 1\n'),
                Buffer.from([128, 128, 128, 129]),
              ]),
            });
          } else if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('/lojjic/unicode-font-resolver')) {
            await route.fulfill({
              contentType: url.pathname.endsWith('.json') ? 'application/json' : 'font/woff',
              body: await getFontFixture(url.href),
              headers: { 'Access-Control-Allow-Origin': '*' },
            });
          } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
            await route.fulfill({ contentType: 'text/css', body: '' });
          } else {
            await route.abort('blockedbyclient');
          }
        });
        await page.goto(server.baseUrl + '/weather-source-fixture.html');
        await page.evaluate(
          async options => {
            const service = await import(options.directory + '/weatherService-iG8lrujy.mjs?v=20260728-weather-geo-v8');
            service.i.getCurrentWeather = async () => options.weather;
            const widget = await import(options.directory + '/' + options.file);
            window.fixtureHandle = widget.mountWeatherWidget('#fixture-host', {
              variant: options.variant,
              locale: options.locale,
              initialLocation: 'Leipzig',
              useGeolocation: false,
              minHeight: options.variant === 'header' ? '132px' : '620px',
            });
            window.fixtureUnmount = widget.unmountWeatherWidget;
          },
          { directory, file: entry.file, variant: entry.variant, locale, weather: fixture(condition) }
        );
        await page.waitForFunction(
          () => {
            const root = document.querySelector('#fixture-host').shadowRoot;
            return root?.textContent.includes('Leipzig') && root.querySelector('canvas')?.width > 0;
          },
          null,
          { timeout: 15000 }
        );
        await page.waitForTimeout(800);
        const closed = await state(page);
        assert.ok(!closed.text.includes('NaN'), name + ': finite weather values');
        let opened = null;
        if (entry.variant === 'header') {
          await page.locator('#fixture-host .weather-header-trigger').click();
          await page.waitForFunction(
            () =>
              document
                .querySelector('#fixture-host')
                .shadowRoot.querySelector('.weather-header-trigger')
                .getAttribute('aria-expanded') === 'true'
          );
          await page.waitForTimeout(250);
          opened = await state(page);
          assert.ok(
            opened.geometry.some(
              element => String(element.class).includes('weather-header-dropdown') && element.width > 0
            ),
            name + ': opened details rendered'
          );
        }
        await page.screenshot({
          path: path.join(artifactDirectory, name + '-' + label + '.png'),
          animations: 'disabled',
        });
        await page.evaluate(() => window.fixtureUnmount('#fixture-host'));
        assert.equal(await page.locator('#fixture-host canvas').count(), 0, name + ': clean unmount');
        assert.deepEqual(errors, [], name + ': no browser errors');
        pair[label] = { closed, opened };
        await context.close();
      }
      assert.deepEqual(pair.candidate, pair.baseline, name + ': source build preserves DOM text and geometry');
      report.scenarios.push({
        name,
        locale,
        mobile,
        condition: condition.text,
        isDay: Boolean(condition.is_day),
        ok: true,
        ...pair,
      });
      console.log('PASS ' + name);
    }
  }
  // The classic loader must preserve the public global contract as well.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.baseUrl + '/404-fixture-loader', { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ url: server.baseUrl + candidateRoot + '/weather-widget.iife.js' });
  assert.deepEqual(await page.evaluate(() => Object.keys(window.Weather3DWidget).sort()), [
    'load',
    'mountWeatherWidget',
    'unmountWeatherWidget',
  ]);
  await context.close();
  report.ok = true;
} catch (error) {
  report.ok = false;
  report.error = error.stack;
  throw error;
} finally {
  await fs.writeFile(path.join(artifactDirectory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  await server.close();
}
console.log('Weather source parity: ' + report.scenarios.length + ' baseline/candidate pairs passed.');
