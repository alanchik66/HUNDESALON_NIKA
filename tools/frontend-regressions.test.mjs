import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('static preview 501 uses local Functions fallback without reporting false success', async () => {
  const source = await readFile(path.join(root, 'assets/js/page-modules.js'), 'utf8');
  const body = source.match(/const submitSendmailForm = async \(form, submitBtn\) => \{([\s\S]*?)\n  \};/)[1];
  const classes = new Set();
  const status = { classList: { add: value => classes.add(value), contains: value => classes.has(value) }, setAttribute() {}, focus() {} };
  const calls = [];
  const form = { querySelectorAll: () => [], appendChild() {}, reset() { assert.fail('must preserve unsaved data'); } };
  const button = { textContent: 'Save', disabled: false };
  const run = new Function('document', 'window', 'formCopy', 'pageLang', 'getSendmailEndpoints', 'getLocalCloudflareSendmailUrl', 'getLocalCloudflarePageUrl', 'LOCAL_SENDMAIL_PROBE_TIMEOUT_MS', 'FormData', 'fetch', `return async (form, submitBtn) => {${body}}`)(
    { createElement: () => status },
    { AbortController, setTimeout, clearTimeout, requestAnimationFrame: callback => callback() },
    { sending: { ru: 'sending' }, localFunctionsRequired: { ru: url => `not saved: ${url}` } },
    'ru', () => ['/sendmail', 'http://127.0.0.1:8788/sendmail'], () => 'http://127.0.0.1:8788/sendmail', () => 'http://127.0.0.1:8788/ru/prays-list.html', 4500,
    class { delete() {} },
    async endpoint => {
      calls.push(endpoint);
      if (calls.length === 1) return { status: 501, ok: false, json: async () => { throw new Error('HTML'); } };
      throw new Error('local Functions not running');
    }
  );
  assert.equal(await run(form, button), false);
  assert.equal(calls.length, 2);
  assert.match(status.textContent, /not saved: http:\/\/127.0.0.1:8788/);
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, 'Save');
});

test('full care clears included extras and restores their availability after switching', async () => {
  const source = await readFile(path.join(root, 'assets/js/price-page.js'), 'utf8');
  const body = source.match(/const syncIncludedAdditionalServices = \(additionalServices, selectedPrimaryServices\) => \{([\s\S]*?)\n  \};/)[1];
  const services = Array.from({ length: 6 }, (_, index) => ({ id: String(index), index }));
  const options = services.map(service => {
    const input = { value: service.id, checked: true, disabled: false };
    return { hidden: false, input, querySelector: () => input };
  });
  const hint = { textContent: '' };
  const sync = new Function('modalAdditionalServiceOptions', 'modalAdditionalServiceHint', 'locale', 'NAIL_TRIM_SERVICE_INDEXES', 'DESHEDDING_ADDITIONAL_SERVICE_INDEX', 'additionalServices', 'selectedPrimaryServices', body);
  const run = primary => sync({ querySelectorAll: () => options }, hint, { fullCareIncludedHint: 'included', additionalServicesHint: 'optional' }, new Set([0]), 5, services, primary);
  run([{ key: 'full-groom', includesNailTrim: true }]);
  for (const index of [0, 4, 5]) {
    assert.equal(options[index].hidden, true);
    assert.equal(options[index].input.disabled, true);
    assert.equal(options[index].input.checked, false);
  }
  for (const index of [1, 2, 3]) assert.equal(options[index].input.checked, true);
  assert.equal(hint.textContent, 'included');
  run([]);
  assert.ok(options.every(option => !option.hidden && !option.input.disabled));
  assert.equal(options[4].input.checked, false, 'do not silently re-add a paid extra');
  assert.equal(hint.textContent, 'optional');
});

test('booking title remains readable inside narrow viewports', async () => {
  const styles = await readFile(path.join(root, 'assets/css/page-modules.css'), 'utf8');

  assert.match(styles, /\.booking-container \.booking-title \{[\s\S]*?max-width: 100%/);
  assert.match(styles, /\.booking-container \.booking-title \{[\s\S]*?overflow-wrap: anywhere/);
  assert.match(styles, /@media \(width <= 480px\) \{[\s\S]*?font-size: clamp\(1\.35rem, 6\.4vw, 1\.7rem\)/);
});

test('analytics ignores malformed Microsoft Clarity project IDs', async () => {
  const source = await readFile(path.join(root, 'assets/js/analytics.js'), 'utf8');
  const env = await readFile(path.join(root, 'config/env.js'), 'utf8');

  assert.match(source, /const isClarityProjectId = value => \/\^\[a-z0-9\]\{6,24\}\$\/i/);
  assert.match(source, /if \(!isClarityProjectId\(id\) \|\| window\.__hundesalonClarityReady\)/);
  assert.match(env, /export const MS_CLARITY_ID = ''/);
  assert.doesNotMatch(env, /efbb2b19-7440-48bf-bc3a-166725c69d1b/);
});

test('weather geocoding rejects the technical Null Island coordinate', async () => {
  const source = await readFile(path.join(root, 'assets/js/site-shell.js'), 'utf8');

  assert.match(source, /!\(latitude === 0 && longitude === 0\)/);
  assert.match(
    source,
    /if \(headerWeatherReverseGeoProxyUnavailable \|\| !hasValidHeaderWeatherCoordinates\(latitude, longitude\)\)/
  );
});

test('home pages render one testimonial section with three localized cards', async () => {
  const testimonials = JSON.parse(await readFile(path.join(root, 'data/testimonials.json'), 'utf8'));
  const renderer = await readFile(path.join(root, 'assets/js/testimonials.js'), 'utf8');

  for (const locale of ['de', 'en', 'ru', 'uk']) {
    const html = await readFile(path.join(root, locale, 'index.html'), 'utf8');
    assert.equal((html.match(/id="testimonials"/g) || []).length, 1, `${locale} must have one testimonial host`);
    assert.doesNotMatch(html, /class="reviews section reveal"/, `${locale} must not keep the duplicate reviews block`);
    assert.match(html, /testimonials\.js\?v=20260919-reviews-dedup/);
    assert.equal(
      testimonials.filter(item => item.language === locale).length,
      3,
      `${locale} must provide three testimonials`
    );
  }

  assert.match(renderer, /testimonial-card__avatar/);
  assert.match(renderer, /testimonials\.json\?v=20260919-reviews-dedup/);
});

test('price sections follow content height without empty viewport reserves', async () => {
  const styles = await readFile(path.join(root, 'assets/css/page-modules.css'), 'utf8');

  assert.match(
    styles,
    /\.container\.page-offset-top > \.price-categories-grid\[data-price-categories\] \{\s*margin-top: 0;/
  );
  assert.match(
    styles,
    /body\.price-page \.container\.page-offset-top \{[\s\S]*?display: grid;[\s\S]*?gap: var\(--price-page-gap\);/
  );
  assert.match(
    styles,
    /\.price-page-hero\[data-price-hero\] \{[^}]*align-content: start;[^}]*min-height: 0;/
  );
  assert.match(
    styles,
    /\.price-size-section:is\([\s\S]*?\[data-price-section='cats-animals'\][\s\S]*?min-height: 0;[^}]*padding-bottom: 56px;/
  );

  for (const locale of ['de', 'en', 'ru', 'uk']) {
    const html = await readFile(path.join(root, locale, 'prays-list.html'), 'utf8');
    assert.equal(
      (html.match(/page-modules\.css\?v=20260920-safe-edge/g) || []).length,
      3,
      `${locale} must load the latest price-page stylesheet version`
    );
  }
});

test('price cards equalize within responsive content grids', async () => {
  const styles = await readFile(path.join(root, 'assets/css/page-modules.css'), 'utf8');
  const source = await readFile(path.join(root, 'assets/js/price-page.js'), 'utf8');

  assert.match(
    styles,
    /\[data-price-section='cats-animals'\] \.price-size-section__title \{[\s\S]*?font-size: clamp\(0\.72rem, 3\.4vw, 1\.05rem\);[\s\S]*?white-space: nowrap;/
  );
  assert.match(
    styles,
    /\[data-price-section='small'\][\s\S]*?grid-template-rows: auto auto auto;/
  );
  assert.match(styles, /\[data-price-section='cats-animals'\] \{[\s\S]*?grid-template-rows: auto minmax\(0, 1fr\);/);
  assert.match(
    styles,
    /> \.price-size-section__cards \{[\s\S]*?grid-auto-rows: 1fr;[\s\S]*?align-items: stretch;/
  );
  assert.match(
    styles,
    /\) \.price-card \{[\s\S]*?grid-template-rows: auto auto minmax\(0, 1fr\) auto;[\s\S]*?align-self: stretch;[\s\S]*?height: 100%;/
  );
  assert.match(
    styles,
    /\.price-card__title \{[\s\S]*?font-size: clamp\(1\.44rem, 1\.2vw \+ 0\.72rem, 1\.8rem\);/
  );
  assert.match(styles, /--price-ui-gap: clamp\(0\.52rem, 0\.7vw, 0\.7rem\);/);
  assert.match(styles, /--price-ui-pad: clamp\(0\.74rem, 1\.05vw, 0\.96rem\);/);
  assert.match(
    styles,
    /\.container\.page-offset-top \.price-card\[data-price-card-expanded='false'\] \{\s*padding-bottom: calc\(var\(--price-ui-pad\) - var\(--price-ui-gap\)\);/
  );
  assert.match(styles, /\[data-price-section='cats-animals'\] \.price-card__top \{\s*min-height: 5\.25rem;/);
  assert.match(styles, /min-height: 10rem;/);
  assert.match(styles, /min-height: 36px;/);
  assert.doesNotMatch(source, /giant-dog reference/);
  assert.doesNotMatch(source, /catAnimalCards\.forEach\(card => card\.style\.setProperty\('min-height'/);

  for (const locale of ['de', 'en', 'ru', 'uk']) {
    const html = await readFile(path.join(root, locale, 'prays-list.html'), 'utf8');
    assert.equal(
      (html.match(/page-modules\.css\?v=20260920-safe-edge/g) || []).length,
      3,
      `${locale} must load the equal compact card stylesheet version`
    );
    assert.match(html, /price-page\.js\?v=20260920-compact-modal-context/);
  }
});

test('express deshedding is an add-on for every non-wire dog coat', async () => {
  const [coatGroups, pricePage, russianData, locales] = await Promise.all([
    readFile(path.join(root, 'assets/js/price-page-coat-groups.js'), 'utf8'),
    readFile(path.join(root, 'assets/js/price-page.js'), 'utf8'),
    readFile(path.join(root, 'assets/js/price-page-ru-data.js'), 'utf8'),
    readFile(path.join(root, 'assets/js/price-page-locales.js'), 'utf8'),
  ]);

  assert.match(coatGroups, /const serviceOrder = \['puppy-intro', 'full-groom', 'hygiene', 'trimming'\];/);
  assert.doesNotMatch(coatGroups, /coatTariff\.deshedding/);
  assert.match(russianData, /key: 'deshedding'[\s\S]*?Экспресс-линька \/ удаление подшёрстка[\s\S]*?30 € \/ 30 мин\./);
  assert.match(locales, /Express deshedding \/ undercoat removal/);
  assert.match(pricePage, /small: \[0, 1, 2, 3, 4, 5\]/);
  assert.match(pricePage, /medium: \[0, 2, 4, 5\]/);
  assert.match(pricePage, /if \(category\.coatType === 'wire'\) allowedIndexes\.delete\(DESHEDDING_ADDITIONAL_SERVICE_INDEX\);/);
});
