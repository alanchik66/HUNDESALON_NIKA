import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

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

test('cookie choices remain usable when browser storage rejects writes', async () => {
  const [cookieSource, analyticsSource] = await Promise.all([
    readFile(path.join(root, 'assets/js/cookie-consent.js'), 'utf8'),
    readFile(path.join(root, 'assets/js/analytics.js'), 'utf8'),
  ]);

  for (const choice of ['accept', 'necessary']) {
    const listeners = new Map();
    const trackingScripts = [];
    let click;
    let removed = false;
    class Element {}
    class ConsentEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options.detail;
      }
    }
    const banner = {
      setAttribute() {},
      addEventListener(type, handler) { click = handler; },
      classList: { add() {} },
      remove() { removed = true; },
    };
    const document = {
      currentScript: null,
      documentElement: { lang: 'de' },
      readyState: 'complete',
      querySelector: () => null,
      createElement: tag => tag === 'section' ? banner : {},
      body: { appendChild() {} },
      head: { appendChild: script => trackingScripts.push(script) },
    };
    const window = {
      location: { origin: 'https://hundesalon-nika.com' },
      addEventListener: (type, handler) => listeners.set(type, handler),
      dispatchEvent: event => listeners.get(event.type)?.(event),
      setTimeout: handler => handler(),
    };
    const context = {
      document, window, URL, HTMLElement: Element, CustomEvent: ConsentEvent,
      localStorage: {
        getItem: () => null,
        setItem() { throw new Error('Storage is unavailable'); },
      },
    };

    runInNewContext(analyticsSource, context);
    runInNewContext(cookieSource, context);
    assert.equal(trackingScripts.length, 0, 'tracking must wait for consent');
    const target = new Element();
    target.dataset = { cookieChoice: choice };
    assert.doesNotThrow(() => click({ target }));
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(removed, true, `${choice} must dismiss the banner`);
    assert.equal(window.__hundesalonCookieConsent.analytics, choice === 'accept');
    assert.equal(trackingScripts.length, choice === 'accept' ? 1 : 0);
    if (choice === 'accept') assert.match(trackingScripts[0].src, /googletagmanager\.com/);
  }
});

test('header sun uses one device-pixel scaling pass', async () => {
  const source = await readFile(path.join(root, 'assets/js/header-weather-sun-scene.js'), 'utf8');
  const runnable = source.replace(/^import .+;$/m, '').replace(/^export /gm, '');
  const context = {
    THREE: { MathUtils: { degToRad: value => value * Math.PI / 180 }, Clock: class {} },
    window: { devicePixelRatio: 2, matchMedia: () => ({ matches: false }) },
  };
  const Scene = runInNewContext(`${runnable}\nHeaderWeatherSunScene;`, context);

  for (const dpr of [1, 2, 3]) {
    context.window.devicePixelRatio = dpr;
    const canvas = { clientWidth: 100, clientHeight: 60 };
    const scene = new Scene(canvas);
    let pixelRatio;
    scene.renderer = {
      setPixelRatio: value => { pixelRatio = value; },
      setSize: (width, height) => {
        canvas.width = Math.floor(width * pixelRatio);
        canvas.height = Math.floor(height * pixelRatio);
      },
    };
    scene.camera = { updateProjectionMatrix() {} };
    scene.resize();
    assert.equal(canvas.width, 100 * Math.min(dpr, 2));
    assert.equal(canvas.height, 60 * Math.min(dpr, 2));
    assert.equal(scene.camera.aspect, 100 / 60);
  }
});

test('booking slots use the salon timezone for foreign visitors across DST changes', async () => {
  const source = await readFile(path.join(root, 'assets/js/price-booking.js'), 'utf8');
  const previousTimeZone = process.env.TZ;
  const timing = { safeBlockMinutes: 60, slotStepMinutes: 30 };

  try {
    for (const timeZone of ['Europe/Berlin', 'America/New_York', 'Asia/Tokyo']) {
      process.env.TZ = timeZone;
      const window = { PricePageCatalog: { categories: [] } };
      runInNewContext(source, { window, Intl, Date });
      const catalog = window.PriceBookingCatalog.build('de');

      for (const [date, offset] of [
        ['2026-03-28', '+01:00'], ['2026-03-29', '+02:00'],
        ['2026-10-24', '+02:00'], ['2026-10-25', '+01:00'],
      ]) {
        const busy = [{ start: `${date}T09:00:00${offset}`, end: `${date}T10:00:00${offset}` }];
        const slots = catalog.getAvailableStartTimes(date, timing, busy, {
          calendarConfigured: true,
          now: new Date('2026-01-01T00:00:00Z'),
        });
        assert.equal(slots[0], '10:00', `${timeZone}, ${date}: occupied salon slots must stay unavailable`);
        assert.equal(slots.includes('09:00'), false);
        assert.equal(slots.includes('09:30'), false);
      }

      const currentDay = catalog.getAvailableStartTimes('2026-10-26', timing, [], {
        calendarConfigured: true,
        now: new Date('2026-10-26T08:10:00Z'),
      });
      assert.equal(currentDay[0], '09:30', `${timeZone}: only future salon slots may be selected`);
      assert.equal(catalog.getAvailableStartTimes('2026-02-30', timing, [], {
        calendarConfigured: true, now: new Date('2026-01-01T00:00:00Z'),
      }).length, 0, 'invalid calendar dates must not normalize to another day');
    }
  } finally {
    if (previousTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimeZone;
  }
});

test('theme initialization and toggling work when browser storage is blocked', async () => {
  const source = await readFile(path.join(root, 'assets/js/main.js'), 'utf8');
  const themeCode = source.split('/* ========== THEME TOGGLE ========== */')[1].split('  const scrollRoot =')[0];
  const classes = new Set();
  let toggle;
  let label;
  const document = {
    getElementById: () => ({
      textContent: '',
      setAttribute: (name, value) => { label = value; },
      addEventListener: (type, handler) => { toggle = handler; },
    }),
    body: { classList: {
      add: value => classes.add(value),
      contains: value => classes.has(value),
      toggle: value => classes.has(value) ? classes.delete(value) : classes.add(value),
    } },
  };
  const storage = {
    getItem() { throw new Error('Storage read denied'); },
    setItem() { throw new Error('Storage write denied'); },
  };
  const initialize = new Function('document', 'localStorage', 'getThemeToggleLabel', `${themeCode}\nreturn true;`);
  assert.equal(initialize(document, storage, light => light ? 'Dark theme' : 'Light theme'), true);
  assert.equal(label, 'Light theme');
  assert.doesNotThrow(() => toggle());
  assert.equal(classes.has('light'), true);
  assert.equal(label, 'Dark theme');
});

test('blocked preference storage does not stop shell setup or language navigation', async () => {
  const source = await readFile(path.join(root, 'assets/js/site-shell.js'), 'utf8');
  const declaration = name => source.match(new RegExp(`  function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`))[0];
  const storage = {
    getItem() { throw new Error('Storage read denied'); },
    setItem() { throw new Error('Storage write denied'); },
  };
  const window = { navigator: { languages: ['ru-RU'] }, location: { href: 'https://hundesalon-nika.com/de/index.html' }, addEventListener() {} };
  const common = `${declaration('extractSupportedLang')}\n${declaration('rememberPreferredLanguage')}`;
  const preferred = new Function('SUPPORTED_LANGS', 'localStorage', 'window', `${common}\n${declaration('resolvePreferredLaunchLanguage')}\nreturn resolvePreferredLaunchLanguage();`);
  assert.equal(preferred(['de', 'en', 'ru', 'uk'], storage, window), 'ru');

  let headerInitialized = false;
  const context = { currentLang: 'de', pageLang: 'de', menuSections: { more: 'More' } };
  const helpers = {
    resolvePageContext: () => context,
    getLaunchLanguageRedirectUrl: () => null,
    initIndependentEuroMotion() {},
    standardizePageHeader: () => { headerInitialized = true; },
    hardenHeaderA11y() {}, syncHeaderWeatherWidget() {}, normalizeMenuSeparators() {}, fitHomeLabelToLogo() {},
  };
  const initialize = new Function('localStorage', 'window', 'document', ...Object.keys(helpers), `${common}\n${declaration('init')}\nreturn init();`);
  assert.equal(initialize(storage, window, {}, ...Object.values(helpers)).currentLang, 'de');
  assert.equal(headerInitialized, true);

  const navigateBody = source.match(/const navigateToLanguage = async \(\) => \{([\s\S]*?)\n      \};/)[1];
  const navigate = new Function('localStorage', 'window', 'closeLangDropdown', 'item', 'buildLanguageUrl', 'context', 'playWeatherLocaleSwitchAnimation', 'remountWeatherPreviewForLanguage', 'wait', `${common}\nreturn async () => {${navigateBody}};`)(
    storage, window, () => {}, { getAttribute: () => 'en' }, () => '/en/index.html', context,
    async () => {}, async () => {}, async () => {},
  );
  await navigate();
  assert.equal(window.location.href, '/en/index.html');
});
