import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createWeatherController, formatWeatherObservationTime } from '../3d-weather-codrops-main/src/weather-lifecycle.mjs';

const source = await readFile(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8');
const declaration = name => {
  const match = source.match(new RegExp(`  (?:async )?function ${name}\\([^\\n]*\\) \\{[\\s\\S]*?\\n  \\}`));
  assert.ok(match, `Missing weather lifecycle function: ${name}`);
  return match[0];
};
const functions = [
  'hasValidHeaderWeatherCoordinates', 'parseHeaderWeatherCoordinates', 'getHeaderWeatherGeoAccuracy', 'setHeaderWeatherGeoStatus',
  'observeHeaderWeatherGeoPermission',
  'readHeaderWeatherStoredGeo', 'storeHeaderWeatherGeo', 'getHeaderWeatherDistanceMeters',
  'requestHeaderWeatherHighAccuracyPosition', 'resolveHeaderWeatherBrowserGeoCoords',
  'shouldApplyHeaderWeatherGeo', 'applyHeaderWeatherAutoGeoLocation', 'invalidateHeaderWeatherLocationRequest',
  'isHeaderWeatherManualCoordinateLocation', 'isHeaderWeatherTextManualLocation',
  'isHeaderWeatherCoordinateSelectionApplied',
  'resetHeaderWeatherReadingsState',
  'refreshHeaderWeatherLifecycle', 'refreshHeaderWeatherWidgetData',
];
const constants = [
  'HEADER_WEATHER_GEO_REFRESH_INTERVAL', 'HEADER_WEATHER_WIDGET_REFRESH_INTERVAL',
  'HEADER_WEATHER_GEO_CACHE_TTL', 'HEADER_WEATHER_GEO_STALE_MAX_AGE',
  'HEADER_WEATHER_GEO_TIMEOUT', 'HEADER_WEATHER_GEO_TARGET_ACCURACY_METERS',
  'HEADER_WEATHER_GEO_MOUNT_WAIT',
  'HEADER_WEATHER_LIVE_CLOCK_INTERVAL', 'HEADER_WEATHER_TIME_SYNC_INTERVAL', 'HEADER_WEATHER_ASTRO_REFRESH_INTERVAL',
  'HEADER_WEATHER_SOLAR_PHASE_REFRESH_INTERVAL',
];
const settle = async () => { for (let i = 0; i < 12; i += 1) await Promise.resolve(); };

function readingsHarness(locale) {
  class ReadingNode {
    constructor(text = '') { this.setParts([text]); }
    setParts(parts) {
      for (const part of this.childNodes || []) part.parentNode = null;
      this.childNodes = parts.map(text => ({ nodeType: 3, nodeValue: String(text), parentNode: this }));
    }
    get textContent() { return this.childNodes.map(part => part.nodeValue).join(''); }
    set textContent(text) { this.setParts([text]); }
    matches() { return false; }
  }
  const labels = {
    ru: ['Ощущается', 'Ветер', 'Влажность', 'Видимость', 'Давление', 'Порывы'],
    uk: ['Відчувається', 'Вітер', 'Вологість', 'Видимість', 'Атмосферний тиск', 'Пориви'],
    de: ['Gefühlt', 'Wind', 'Luftfeuchte', 'Sichtweite', 'Druck', 'Böen'],
    en: ['Feels like', 'Wind', 'Humidity', 'Visibility', 'Pressure', 'Gusts'],
  }[locale];
  const unit = ['ru', 'uk'].includes(locale) ? 'мм рт. ст.' : 'mmHg';
  const native = ['1°C', '14 km/h', '68%', '8 km', `755 ${unit}`, '11 km/h'];
  const cards = labels.map((text, index) => {
    const label = new ReadingNode(text);
    const value = new ReadingNode(native[index]);
    return { label, value, querySelector: selector => selector === 'span' ? label : selector === 'strong' ? value : null };
  });
  const chips = [new ReadingNode(`${labels[0]}: 1°C`), new ReadingNode(`${labels[1]}: 14 km/h`), new ReadingNode(`${labels[2]}: 68%`)];
  chips.forEach((chip, index) => {
    const [, number, unitPart] = native[index].match(/^(-?\d+)(.*)$/u);
    chip.setParts([labels[index], ': ', number, unitPart]);
  });
  const hero = { temperature: new ReadingNode('6,4'), condition: new ReadingNode('Renderer condition'), updated: new ReadingNode('') };
  const liveMeta = new ReadingNode('12:30');
  let liveTime = '22:05';
  hero.updated.setParts(['Updated', ':', ' ', '12:30']);
  hero.updated.matches = selector => selector.includes('.weather-header-dropdown__hero-copy > span');
  const pills = [{}, { dataset: { forecastDate: '2026-11-04' } }, { dataset: { forecastDate: '2026-11-05' } }];
  let active = 0;
  const cacheWrites = [];
  const previews = [];
  const h = harness([
    'getHeaderWeatherPressureLang', 'getHeaderWeatherPressureUnitText', 'formatHeaderWeatherPressureValue',
    'getHeaderWeatherReadingCopy', 'getHeaderWeatherFiniteNumber', 'parseHeaderWeatherNumericToken',
    'formatHeaderWeatherCelsiusText', 'convertHeaderWeatherHpaToMmHg', 'getHeaderWeatherObservationTime', 'buildHeaderWeatherReadingsFromMeta',
    'resolveHeaderWeatherReadings', 'isHeaderWeatherDropdownForecastSelected',
    'updateHeaderWeatherTextParts', 'applyHeaderWeatherDropdownReadings', 'syncHeaderWeatherUnifiedReadings',
    'refreshHeaderWeatherPreviewValues', 'rewriteHeaderWeatherTimeText', 'syncHeaderWeatherLiveClock',
  ], {
    HTMLElement: ReadingNode, normalizeLangCode: value => value, HEADER_WEATHER_CELSIUS_SUFFIX: '°C',
    hydrateHeaderWeatherReadingsFromCache() {}, isHeaderWeatherCurrentMetaFresh: () => true,
    resolveHeaderWeatherConditionLabel: () => 'Observed condition',
    getHeaderWeatherConditionPlainText: node => node?.textContent || '',
    applyHeaderWeatherDropdownConditionTypography: (node, text) => { node.textContent = text; },
    extractHeaderWeatherReadingsFromHost: () => ({
      temp: 6, condition: 'Renderer condition', meta: '', feels: native[0], wind: native[1],
      humidity: native[2], visibility: native[3], pressure: native[4], gusts: native[5], source: 'widget-preview',
    }),
    applyHeaderWeatherPreviewReadings: (host, readings) => { previews.push(readings); },
    normalizeHeaderWeatherHumidityValue: value => value,
    writeHeaderWeatherReadingsCache: (host, values) => { cacheWrites.push(values); },
    normalizeHeaderWeatherCelsiusUnits() {}, applyHeaderWeatherTextReadability() {},
    applyHeaderWeatherFeelsLikePreview() {}, ensureHeaderWeatherCollapsedFeelsFallback() {},
    ensureHeaderWeatherPreviewMetricsVisible() {}, syncHeaderWeatherMetaWidthToEyebrow() {},
    resolveHeaderWeatherTimeZone: () => 'Europe/Berlin', formatHeaderWeatherLiveTime: () => liveTime,
    formatHeaderWeatherLiveWeekday: () => '', stripHeaderWeatherWeekdayTokens: text => text,
  });
  h.host.__weatherLocale = locale;
  h.host.__weatherWidgetInstance = { observationTime: formatWeatherObservationTime };
  h.host.__weatherCurrentMeta = {
    temperature: 6.4, apparentTemperature: 3.2, windSpeedKph: 7.4, humidity: 63,
    visibilityMeters: 4500, gustKph: 10.2, pressureMmHg: 754.2, surfacePressure: 1005.4, source: 'observed-provider', observedAt: Date.parse('2026-11-05T20:30:00Z'),
  };
  h.host.shadowRoot = {
    querySelector: selector => ({
      '.weather-header-dropdown__forecast-pill.is-active': pills[active],
      '.weather-header-dropdown__hero-temp span': hero.temperature,
      '.weather-header-dropdown__hero-copy strong': hero.condition,
      '.weather-header-dropdown__hero-copy span': hero.condition,
      '.weather-header-dropdown__hero-copy > span': hero.updated,
    })[selector] || null,
    querySelectorAll: selector => selector.startsWith('.weather-header-card__meta,') ? [liveMeta] : ({
      '.weather-header-dropdown__forecast-pill': pills,
      '.weather-header-dropdown__hero-chips span': chips,
      '.weather-header-dropdown__detail-card': cards,
    })[selector] || [],
  };
  return { ...h, cards, chips, hero, liveMeta, unit, cacheWrites, previews, select: index => { active = index; }, setLiveTime: value => { liveTime = value; } };
}

for (const locale of ['ru', 'uk', 'de', 'en']) {
  test(`${locale}: current hero and all six details share observations while forecast days retain their native values`, () => {
    const h = readingsHarness(locale);
    const labels = h.cards.map(card => card.label);
    const values = h.cards.map(card => card.value);
    const humidityNode = h.chips[2].childNodes[2];
    const timestampNode = h.hero.updated.childNodes[3];
    const expected = ['3°C', '7 km/h', '63%', '5 km', `754 ${h.unit}`, '10 km/h'];
    h.context.syncHeaderWeatherUnifiedReadings(h.host);
    assert.deepEqual(h.cards.map(card => card.value.textContent), expected);
    assert.equal(h.hero.temperature.textContent, '6');
    assert.equal(h.hero.condition.textContent, 'Observed condition');
    assert.match(h.chips[2].textContent, /63%$/);
    assert.equal(h.chips[2].childNodes[2], humidityNode, 'the API overlay must retain the React-owned humidity text node');
    assert.equal(humidityNode.parentNode, h.chips[2]);
    assert.equal(h.host.__weatherReadingsSnapshot.visibility, '5 km');
    assert.equal(h.host.__weatherReadingsSnapshot.gusts, '10 km/h');
    assert.equal(h.host.__weatherPressureMmHg, 754);
    assert.ok(h.cacheWrites.some(value => value.pressureMmHg === 754));
    assert.equal(h.context.applyHeaderWeatherDropdownReadings(h.host, h.host.__weatherReadingsSnapshot), false, 'reapplying the same snapshot must preserve DOM and units');
    h.context.applyHeaderWeatherDropdownReadings(h.host, { ...h.host.__weatherReadingsSnapshot, meta: '13:10' });
    assert.equal(h.hero.updated.childNodes[3], timestampNode, 'the mixed updated label and timestamp must remain React-owned');
    assert.equal(timestampNode.nodeValue, '13:10');
    assert.equal(h.hero.condition.textContent, 'Observed condition', 'timestamp selection must not select a nested condition span');
    assert.equal(h.hero.updated.hidden, false);
    const unknownTime = { ...h.host.__weatherReadingsSnapshot, meta: '' };
    assert.equal(h.context.applyHeaderWeatherDropdownReadings(h.host, unknownTime), true);
    assert.equal(h.hero.updated.hidden, true, 'missing source time must hide the previous Updated label');
    assert.equal(h.context.applyHeaderWeatherDropdownReadings(h.host, unknownTime), false, 'hiding the same missing timestamp is idempotent');
    h.context.applyHeaderWeatherDropdownReadings(h.host, h.host.__weatherReadingsSnapshot);
    assert.equal(h.hero.updated.hidden, false, 'a valid provider timestamp restores the label');
    assert.equal(h.hero.updated.childNodes[3], timestampNode);
    assert.equal(timestampNode.nodeValue, '21:30');

    const forecast = ['6°C', '21 km/h', '74%', '10 km', `757 ${h.unit}`, '28 km/h'];
    h.select(2);
    h.cards.forEach((card, index) => { card.value.textContent = forecast[index]; });
    h.hero.temperature.textContent = '9';
    h.hero.condition.textContent = 'Forecast condition';
    humidityNode.nodeValue = '74';
    timestampNode.nodeValue = '12:00';
    h.context.syncHeaderWeatherUnifiedReadings(h.host);
    h.context.refreshHeaderWeatherPreviewValues(h.host);
    h.context.syncHeaderWeatherLiveClock(h.host);
    assert.deepEqual(h.cards.map(card => card.value.textContent), forecast);
    assert.equal(h.hero.temperature.textContent, '9');
    assert.equal(h.hero.condition.textContent, 'Forecast condition', 'the extra typography sync must also respect the selected day');
    assert.match(h.chips[2].textContent, /74%$/, 'a native React write to its retained numeric node must become visible');
    assert.equal(timestampNode.nodeValue, '12:00', 'live clock must not replace the selected forecast timestamp');
    assert.equal(h.previews.at(-1).humidity, '63%', 'the navigation preview remains current while a forecast is selected');

    h.select(0);
    h.context.syncHeaderWeatherUnifiedReadings(h.host);
    assert.deepEqual(h.cards.map(card => card.value.textContent), expected);
    assert.equal(h.hero.condition.textContent, 'Observed condition');
    h.context.syncHeaderWeatherLiveClock(h.host);
    assert.equal(h.hero.updated.childNodes[3], timestampNode);
    assert.equal(timestampNode.nodeValue, '21:30', 'Updated remains the source observation time');
    assert.equal(h.liveMeta.textContent, '22:05');
    h.setLiveTime('22:06');
    h.context.syncHeaderWeatherLiveClock(h.host);
    assert.equal(h.liveMeta.textContent, '22:06', 'the navigation wall clock continues to advance independently');
    assert.equal(timestampNode.nodeValue, '21:30', 'a clock tick cannot make an old observation look newly measured');
    assert.equal(h.host.__weatherPressureMmHg, 754, 'forecast pressure must never replace or reconvert the current pressure cache');
    h.cards.forEach((card, index) => {
      assert.equal(card.label, labels[index]);
      assert.equal(card.value, values[index]);
    });

    const localized = { ...h.host.__weatherReadingsSnapshot,
      feels: '3,5°C', wind: '7,5 km/h', visibility: '4,5 km', pressure: `754,5 ${h.unit}`, gusts: '10,5 km/h',
    };
    assert.equal(h.context.applyHeaderWeatherDropdownReadings(h.host, localized), true);
    assert.deepEqual(h.cards.map(card => card.value.textContent), ['3,5°C', '7,5 km/h', '63%', '4,5 km', `754,5 ${h.unit}`, '10,5 km/h']);
    assert.equal(h.context.applyHeaderWeatherDropdownReadings(h.host, localized), false, 'decimal commas and mmHg are already formatted and must be idempotent');
  });
}

test('visibility and gust observations retain legitimate zero and use current widget data when provider metadata is unknown', () => {
  const h = readingsHarness('en');
  h.host.__weatherCurrentMeta.visibilityMeters = null;
  h.host.__weatherCurrentMeta.gustKph = undefined;
  let readings = h.context.resolveHeaderWeatherReadings(h.host);
  assert.equal(readings.visibility, '8 km');
  assert.equal(readings.gusts, '11 km/h');
  h.host.__weatherCurrentMeta.visibilityMeters = 0;
  h.host.__weatherCurrentMeta.gustKph = 0;
  readings = h.context.resolveHeaderWeatherReadings(h.host);
  assert.equal(readings.visibility, '0 km');
  assert.equal(readings.gusts, '0 km/h');
  h.context.applyHeaderWeatherDropdownReadings(h.host, readings);
  assert.equal(h.cards[3].value.textContent, '0 km');
  assert.equal(h.cards[5].value.textContent, '0 km/h');
});

test('supplemental visibility and gusts come from the mounted current weather state without inventing missing measurements', () => {
  const h = readingsHarness('en');
  const query = h.host.shadowRoot.querySelector;
  h.host.shadowRoot.querySelector = selector => selector === '.weather-header-card__temperature-value'
    ? { textContent: '6' } : query(selector);
  let current = { vis_km: 4.5, gust_kph: 10.5 };
  h.host.__weatherWidgetInstance = { getState: () => ({ weather: { current } }) };
  vm.runInContext(declaration('extractHeaderWeatherReadingsFromHost'), h.context);
  let readings = h.context.extractHeaderWeatherReadingsFromHost(h.host);
  assert.equal(readings.visibility, '5 km');
  assert.equal(readings.gusts, '11 km/h');
  current = { vis_km: 0, gust_kph: 0 };
  readings = h.context.extractHeaderWeatherReadingsFromHost(h.host);
  assert.equal(readings.visibility, '0 km');
  assert.equal(readings.gusts, '0 km/h');
  current = { vis_km: null };
  readings = h.context.extractHeaderWeatherReadingsFromHost(h.host);
  assert.equal(readings.visibility, null);
  assert.equal(readings.gusts, null);
});

test('observed hPa is converted once before reaching detail values and the current pressure cache', () => {
  const h = readingsHarness('uk');
  h.host.__weatherCurrentMeta.pressureMmHg = null;
  h.host.__weatherCurrentMeta.surfacePressure = 1013.25;
  h.context.syncHeaderWeatherUnifiedReadings(h.host);
  h.context.syncHeaderWeatherUnifiedReadings(h.host);
  assert.equal(h.cards[4].value.textContent, '760 мм рт. ст.');
  assert.equal(h.host.__weatherReadingsSnapshot.pressure, '760 мм рт. ст.');
  assert.equal(h.host.__weatherPressureMmHg, 760);
  assert.deepEqual(h.cacheWrites.filter(value => value.pressureMmHg !== undefined).map(value => value.pressureMmHg), [760, 760]);
});

test('missing weather measurements stay unknown while real zero and negative values remain usable', () => {
  const context = vm.createContext({ clampHeaderWeatherValue: (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value)) });
  vm.runInContext(['getHeaderWeatherFiniteNumber', 'getHeaderWeatherConditionCode', 'getHeaderWeatherCloudCover'].map(declaration).join('\n'), context);
  for (const value of [null, undefined, '', '  ', 'invalid']) {
    assert.equal(context.getHeaderWeatherFiniteNumber(value), null);
    const host = { __weatherWidgetData: { current: { cloud: value, condition: { code: value } } } };
    assert.equal(context.getHeaderWeatherCloudCover(host), null);
    assert.equal(context.getHeaderWeatherConditionCode(host), null);
  }
  assert.equal(context.getHeaderWeatherFiniteNumber(-4), -4);
  assert.equal(context.getHeaderWeatherFiniteNumber('0'), 0);
  assert.equal(context.getHeaderWeatherCloudCover({ dataset: { weatherCloud: '0' } }), 0);
  assert.equal(context.getHeaderWeatherConditionCode({ dataset: { weatherCode: '0' } }), 0);
});
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function harness(extraFunctions = [], overrides = {}) {
  let now = 1700000000000;
  let sequence = 0;
  const timers = new Map();
  const clock = {
    now: () => now,
    setTimeout: (callback, delay) => { const id = ++sequence; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id),
    setInterval: (callback, delay) => { const id = ++sequence; timers.set(id, { callback, at: now + delay, delay }); return id; },
    clearInterval: id => timers.delete(id),
    advance: async delay => {
      const until = now + delay;
      for (;;) {
        const next = [...timers].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [id, timer] = next;
        now = timer.at;
        if (timer.delay) timer.at += timer.delay;
        else timers.delete(id);
        timer.callback();
        await settle();
      }
      now = until;
      await settle();
    },
    timers,
  };
  const document = Object.assign(new globalThis.EventTarget(), { hidden: false, body: { classList: { remove() {} } } });
  const window = Object.assign(new globalThis.EventTarget(), clock, { isSecureContext: true, AbortController });
  const watches = new Map();
  const requests = [];
  const context = vm.createContext({
    window, document,
    navigator: {
      onLine: true,
      geolocation: {
        watchPosition: (success, error, options) => {
          const id = ++sequence;
          const request = { id, success, error, options };
          requests.push(request);
          watches.set(id, request);
          return id;
        },
        clearWatch: id => watches.delete(id),
      },
    },
    Date: class extends Date { static now() { return now; } },
    headerWeatherCurrentCache: new Map(),
    syncHeaderWeatherPublicLocationLabel() {}, syncHeaderWeatherOrbOverlay: async () => {},
    syncHeaderWeatherPreciseLocationMeta: async () => {}, syncHeaderWeatherUnifiedReadings() {},
    scheduleHeaderWeatherReadingsSync() {}, syncHeaderWeatherAttribution() {}, syncHeaderWeatherLiveClock() {},
    syncHeaderWeatherExpandedState() {}, releaseHeaderWeatherSceneClip() {},
    ...overrides,
  });
  vm.runInContext(`
    let headerWeatherGeoCache = null;
    let headerWeatherGeoPermissionDenied = false;
    ${constants.map(name => source.match(new RegExp(`  const ${name} = [^\\n]+`))[0]).join('\n')}
    ${[...new Set([...functions, ...extraFunctions])].map(declaration).join('\n')}
    globalThis.setGeoCache = value => { headerWeatherGeoCache = value; };
  `, context);
  const host = { isConnected: true, dataset: { weatherMounted: 'true', weatherLocation: '51.34, 12.37', weatherGeoAccuracy: '10' }, classList: { remove() {} } };
  context.getHeaderWeatherHost = () => host;
  return { context, host, clock, window, document, requests, watches };
}

test('completed or cancelled GPS status preserves the loaded weather without another request', async () => {
  for (const status of ['none', 'aborted']) {
    const weather = { current: { temp_c: 7 }, forecast: { forecastday: [] } };
    let requests = 0;
    const controller = createWeatherController({ initialLocation: 'fixture-location', now: () => 12345, service: {
      getCurrentWeather: async () => { requests += 1; return weather; },
    } });
    await controller.refresh();
    const loaded = controller.getState();
    controller.setLocationStatus({ status: 'pending' });
    assert.equal(controller.getState().geoStatus, 'pending');
    controller.setLocationStatus({ status });
    assert.deepEqual(controller.getState(), loaded);
    assert.equal(controller.getState().weather, weather);
    assert.equal(requests, 1);
    controller.dispose();
  }
});

test('clearing GPS status does not cancel the loading state of an active weather request', async () => {
  for (const status of ['none', 'aborted']) {
    const response = deferred();
    const controller = createWeatherController({ initialLocation: 'fixture-location', service: {
      getCurrentWeather: () => response.promise,
    } });
    const request = controller.refresh();
    controller.setLocationStatus({ status: 'pending' });
    controller.setLocationStatus({ status });
    assert.equal(controller.getState().geoStatus, null);
    assert.equal(controller.getState().loading, true);
    response.resolve({ current: { temp_c: 7 }, forecast: { forecastday: [] } });
    await request;
    assert.equal(controller.getState().loading, false);
    controller.dispose();
  }
});

test('stationary GPS refresh clears the renderer pending state without remounting or refetching weather', async () => {
  const h = harness();
  const weather = { current: { temp_c: 7 }, forecast: { forecastday: [] } };
  let requests = 0;
  const controller = createWeatherController({ initialLocation: h.host.dataset.weatherLocation, now: h.clock.now, service: {
    getCurrentWeather: async () => { requests += 1; return weather; },
  } });
  await controller.refresh();
  h.host.__weatherWidgetInstance = controller;
  const updatedAt = controller.getState().lastUpdatedAt;
  const operation = h.context.applyHeaderWeatherAutoGeoLocation(h.host, { force: true });
  assert.equal(controller.getState().geoStatus, 'pending');
  h.requests[0].success({ coords: { latitude: 51.34, longitude: 12.37, accuracy: 10 }, timestamp: h.clock.now() });
  assert.equal((await operation).changed, false);
  assert.equal(h.host.dataset.weatherGeoPending, 'false');
  assert.equal(controller.getState().geoStatus, null);
  assert.equal(controller.getState().loading, false);
  assert.equal(controller.getState().weather, weather);
  assert.equal(controller.getState().lastUpdatedAt, updatedAt);
  assert.equal(h.host.__weatherWidgetInstance, controller);
  assert.equal(requests, 1);
  controller.dispose();
});

test('precise device location uses fresh high accuracy, retains the best fix and cleans up its watch', async () => {
  const h = harness();
  const operation = h.context.resolveHeaderWeatherBrowserGeoCoords({ force: true });
  const request = h.requests[0];
  assert.equal(request.options.enableHighAccuracy, true);
  assert.equal(request.options.maximumAge, 0);
  request.success({ coords: { latitude: 51.35, longitude: 12.38, accuracy: 120 }, timestamp: h.clock.now() });
  request.success({ coords: { latitude: 51.3501, longitude: 12.3801, accuracy: 7 }, timestamp: h.clock.now() });
  const result = await operation;
  assert.equal(result.accuracy, 7);
  assert.equal(result.updatedAt, h.clock.now());
  assert.equal(result.source, 'gps');
  assert.equal(h.watches.size, 0);
  assert.equal(h.clock.timers.size, 0);
});

test('a wider browser accuracy remains honest after timeout and null accuracy never becomes zero', async () => {
  const h = harness();
  const operation = h.context.resolveHeaderWeatherBrowserGeoCoords({ force: true });
  h.requests[0].success({ coords: { latitude: 51.35, longitude: 12.38, accuracy: 95 }, timestamp: h.clock.now() });
  await h.clock.advance(12000);
  assert.equal((await operation).accuracy, 95);
  h.context.setGeoCache({ latitude: 51.35, longitude: 12.38, accuracy: null, updatedAt: h.clock.now(), expiresAt: h.clock.now() + 300000 });
  assert.equal(h.context.readHeaderWeatherStoredGeo().accuracy, null);
  assert.equal(h.context.getHeaderWeatherGeoAccuracy(undefined), null);
  assert.equal(h.context.getHeaderWeatherGeoAccuracy(''), null);
  assert.equal(h.context.shouldApplyHeaderWeatherGeo(h.host, { latitude: 51.340005, longitude: 12.370005, accuracy: 10 }).changed, false);
});

test('stale device positions are bounded and transient failure preserves the working location and timestamp', async () => {
  const h = harness();
  const lastFixAt = String(h.clock.now() - 600000);
  h.host.dataset.weatherGeoUpdatedAt = lastFixAt;
  h.host.dataset.weatherResolvedLocationLabel = 'Previous location';
  const operation = h.context.applyHeaderWeatherAutoGeoLocation(h.host, { force: true });
  h.requests[0].error({ code: 2 });
  assert.equal((await operation).coords, null);
  assert.equal(h.host.dataset.weatherLocation, '51.34, 12.37');
  assert.equal(h.host.dataset.weatherGeoUpdatedAt, lastFixAt);
  assert.equal(h.host.dataset.weatherGeoSource, 'stale-cache');
  h.context.setGeoCache({ latitude: 51.35, longitude: 12.38, accuracy: 40, updatedAt: h.clock.now() - 1800001, expiresAt: h.clock.now() - 1500001 });
  assert.equal(h.context.readHeaderWeatherStoredGeo(true), null);
});

test('permission denial is not requested again automatically; the existing explicit action can retry', async () => {
  const h = harness();
  const denied = h.context.resolveHeaderWeatherBrowserGeoCoords({ force: true });
  h.requests[0].error({ code: 1 });
  assert.equal(await denied, null);
  assert.equal(await h.context.resolveHeaderWeatherBrowserGeoCoords({ force: true }), null);
  assert.equal(h.requests.length, 1);
  const retried = h.context.resolveHeaderWeatherBrowserGeoCoords({ force: true, retryDenied: true });
  h.requests[1].success({ coords: { latitude: 51.35, longitude: 12.38, accuracy: 5 }, timestamp: h.clock.now() });
  assert.equal((await retried).source, 'gps');
  assert.equal(h.requests.length, 2);
});

async function permissionObserverHarness(state = 'denied') {
  const h = harness(['observeHeaderWeatherGeoPermission']);
  const denied = h.context.resolveHeaderWeatherBrowserGeoCoords({ force: true });
  h.requests[0].error({ code: 1 });
  assert.equal(await denied, null);
  const permission = Object.assign(new globalThis.EventTarget(), { state });
  let queries = 0;
  h.context.navigator.permissions = { query: options => {
    assert.equal(options.name, 'geolocation');
    queries += 1;
    return Promise.resolve(permission);
  } };
  return { h, permission, queryCount: () => queries };
}

test('permission observation recovers a previous denial only after the browser grants access', async () => {
  const { h, permission } = await permissionObserverHarness();
  let recoveries = 0;
  const cleanup = h.context.observeHeaderWeatherGeoPermission(h.host, () => { recoveries += 1; });
  await settle();
  assert.equal(h.host.dataset.weatherGeoPermission, 'denied');
  permission.state = 'prompt';
  permission.dispatchEvent(new globalThis.Event('change'));
  await settle();
  assert.equal(h.host.dataset.weatherGeoPermission, 'prompt');
  assert.equal(recoveries, 0);
  assert.equal(h.requests.length, 1);
  permission.state = 'granted';
  permission.dispatchEvent(new globalThis.Event('change'));
  await settle();
  assert.equal(h.host.dataset.weatherGeoPermission, 'granted');
  assert.equal(recoveries, 1);
  permission.dispatchEvent(new globalThis.Event('change'));
  for (const [target, event] of [[h.window, 'focus'], [h.window, 'pageshow'], [h.document, 'visibilitychange']]) target.dispatchEvent(new globalThis.Event(event));
  await settle();
  assert.equal(recoveries, 1);
  assert.equal(h.requests.length, 1, 'observation must not request coordinates or show another prompt');
  const refreshed = h.context.resolveHeaderWeatherBrowserGeoCoords({ force: true });
  assert.equal(h.requests.length, 2, 'a real browser grant must clear the earlier denial latch');
  h.requests[1].success({ coords: { latitude: 51.35, longitude: 12.38, accuracy: 5 }, timestamp: h.clock.now() });
  assert.equal((await refreshed).source, 'gps');
  cleanup();
});

test('an initially granted browser permission recovers a previous denial only once', async () => {
  const { h, permission } = await permissionObserverHarness('granted');
  let recoveries = 0;
  const cleanup = h.context.observeHeaderWeatherGeoPermission(h.host, () => { recoveries += 1; });
  await settle();
  assert.equal(recoveries, 1);
  permission.dispatchEvent(new globalThis.Event('change'));
  h.window.dispatchEvent(new globalThis.Event('pageshow'));
  await settle();
  assert.equal(recoveries, 1);
  assert.equal(h.requests.length, 1);
  cleanup();
});

test('permission granted while hidden recovers once after the page becomes visible', async () => {
  const { h, permission } = await permissionObserverHarness();
  let recoveries = 0;
  const cleanup = h.context.observeHeaderWeatherGeoPermission(h.host, () => { recoveries += 1; });
  await settle();
  h.document.hidden = true;
  permission.state = 'granted';
  permission.dispatchEvent(new globalThis.Event('change'));
  await settle();
  assert.equal(recoveries, 0);
  h.document.hidden = false;
  h.document.dispatchEvent(new globalThis.Event('visibilitychange'));
  await settle();
  assert.equal(recoveries, 1);
  h.window.dispatchEvent(new globalThis.Event('focus'));
  await settle();
  assert.equal(recoveries, 1);
  assert.equal(h.requests.length, 1);
  cleanup();
});

test('permission recovery never replaces a manually selected location', async () => {
  const { h, permission } = await permissionObserverHarness();
  h.host.dataset.weatherManualLocation = 'true';
  const location = h.host.dataset.weatherLocation;
  let recoveries = 0;
  const cleanup = h.context.observeHeaderWeatherGeoPermission(h.host, () => { recoveries += 1; });
  await settle();
  permission.state = 'granted';
  permission.dispatchEvent(new globalThis.Event('change'));
  h.window.dispatchEvent(new globalThis.Event('focus'));
  await settle();
  assert.equal(h.host.dataset.weatherGeoPermission, 'granted');
  assert.equal(h.host.dataset.weatherLocation, location);
  assert.equal(recoveries, 0);
  assert.equal(h.requests.length, 1);
  cleanup();
});

test('permission observer cleanup ignores later changes, resume events and delayed query results', async () => {
  const { h, permission, queryCount } = await permissionObserverHarness();
  let recoveries = 0;
  const cleanup = h.context.observeHeaderWeatherGeoPermission(h.host, () => { recoveries += 1; });
  await settle();
  cleanup();
  const previousQueries = queryCount();
  permission.state = 'granted';
  permission.dispatchEvent(new globalThis.Event('change'));
  for (const [target, event] of [[h.window, 'focus'], [h.window, 'pageshow'], [h.document, 'visibilitychange']]) target.dispatchEvent(new globalThis.Event(event));
  await settle();
  assert.equal(h.host.dataset.weatherGeoPermission, 'denied');
  assert.equal(queryCount(), previousQueries);
  assert.equal(recoveries, 0);

  const late = await permissionObserverHarness('granted');
  const response = deferred();
  late.h.context.navigator.permissions.query = () => response.promise;
  const cleanupLate = late.h.context.observeHeaderWeatherGeoPermission(late.h.host, () => { recoveries += 1; });
  cleanupLate();
  response.resolve(late.permission);
  await settle();
  assert.equal(late.h.host.dataset.weatherGeoPermission, undefined);
  assert.equal(recoveries, 0);
  assert.equal(late.h.requests.length, 1);
});

test('missing or failing permission queries leave geolocation retry under the existing user action', async () => {
  for (const permissions of [undefined, { query: () => Promise.reject(new Error('Unsupported permission query.')) }, { query() { throw new Error('Unsupported permission query.'); } }]) {
    const { h } = await permissionObserverHarness();
    h.context.navigator.permissions = permissions;
    let recoveries = 0;
    const cleanup = h.context.observeHeaderWeatherGeoPermission(h.host, () => { recoveries += 1; });
    await settle();
    assert.equal(typeof cleanup, 'function');
    assert.equal(h.host.dataset.weatherGeoPermission, undefined);
    assert.equal(recoveries, 0);
    assert.equal(h.requests.length, 1);
    cleanup();
  }
});

test('old browser positions and synchronous browser failures clean up without claiming a current fix', async () => {
  const h = harness();
  const operation = h.context.resolveHeaderWeatherBrowserGeoCoords({ force: true });
  h.requests[0].success({ coords: { latitude: 51.35, longitude: 12.38, accuracy: 5 }, timestamp: h.clock.now() - 300001 });
  await h.clock.advance(12000);
  h.requests[0].error({ code: 3 });
  assert.equal(await operation, null);
  assert.equal(h.watches.size, 0);
  h.context.navigator.geolocation.watchPosition = () => { throw new Error('Browser policy'); };
  assert.equal(await h.context.resolveHeaderWeatherBrowserGeoCoords({ force: true }), null);
  assert.equal(h.clock.timers.size, 0);
});

test('permission can remain pending beyond twelve seconds before a bounded accuracy refinement', async () => {
  const h = harness();
  const statuses = [];
  h.host.__weatherWidgetInstance = { setLocationStatus: state => statuses.push(state) };
  const operation = h.context.applyHeaderWeatherAutoGeoLocation(h.host, { force: true });
  const request = h.requests[0];
  assert.equal(request.options.timeout, 12000);
  assert.equal(h.host.dataset.weatherGeoPending, 'true');
  assert.equal(h.host.dataset.weatherGeoError, 'none');
  await h.clock.advance(20000);
  assert.equal(h.host.dataset.weatherGeoPending, 'true');
  assert.equal(h.watches.size, 1);
  assert.equal(h.clock.timers.size, 0);
  request.success({ coords: { latitude: 48.85, longitude: 2.35, accuracy: 85 }, timestamp: h.clock.now() });
  await h.clock.advance(11999);
  assert.equal(h.host.dataset.weatherGeoPending, 'true');
  await h.clock.advance(1);
  assert.equal((await operation).coords.accuracy, 85);
  assert.equal(h.host.dataset.weatherGeoPending, 'false');
  assert.equal(h.host.dataset.weatherGeoError, 'none');
  assert.equal(h.watches.size, 0);
  assert.equal(h.clock.timers.size, 0);
  assert.equal(statuses[0].status, 'pending');
});

test('native geolocation errors expose only bounded status codes and retain no browser message', async () => {
  for (const [code, status] of [[1, 'denied'], [2, 'unavailable'], [3, 'timeout']]) {
    const h = harness();
    const statuses = [];
    h.host.__weatherWidgetInstance = { setLocationStatus: state => statuses.push(state) };
    const operation = h.context.applyHeaderWeatherAutoGeoLocation(h.host, { force: true });
    h.requests[0].error({ code, message: 'Private browser/provider details' });
    await operation;
    assert.equal(h.host.dataset.weatherGeoPending, 'false');
    assert.equal(h.host.dataset.weatherGeoError, status);
    assert.equal(statuses.at(-1).status, status);
    assert.equal(statuses.at(-1).code, code);
    assert.equal(JSON.stringify(statuses).includes('Private'), false);
  }
});

test('device acquisition starts with a synchronous one-shot and watches only after a coarse valid fix', async () => {
  const h = harness();
  let initial;
  h.context.navigator.geolocation.getCurrentPosition = (success, error, options) => { initial = { success, error, options }; };
  const operation = h.context.applyHeaderWeatherAutoGeoLocation(h.host, { force: true });
  // The native one-shot runs before the first await, preserving a tap's activation.
  assert.ok(initial);
  assert.equal(initial.options.enableHighAccuracy, true);
  assert.equal(initial.options.maximumAge, 0);
  assert.equal(initial.options.timeout, 12000);
  assert.equal(h.requests.length, 0);
  await h.clock.advance(20000);
  assert.equal(h.host.dataset.weatherGeoPending, 'true');
  initial.success({ coords: { latitude: 48.85, longitude: 2.35, accuracy: 85 }, timestamp: h.clock.now() });
  assert.equal(h.requests.length, 1);
  await h.clock.advance(8000);
  h.requests[0].success({ coords: { latitude: 48.85001, longitude: 2.35001, accuracy: 6 }, timestamp: h.clock.now() });
  const result = await operation;
  assert.equal(result.coords.accuracy, 6);
  assert.equal(h.host.dataset.weatherGeoPending, 'false');
  assert.equal(h.watches.size, 0);
  assert.equal(h.clock.timers.size, 0);
});

test('an accurate one-shot needs no watch and a cancelled late one-shot cannot replace manual coordinates', async () => {
  const h = harness();
  const initial = [];
  h.context.navigator.geolocation.getCurrentPosition = (success, error) => { initial.push({ success, error }); };
  const success = h.context.applyHeaderWeatherAutoGeoLocation(h.host, { force: true });
  initial[0].success({ coords: { latitude: 48.85, longitude: 2.35, accuracy: 7 }, timestamp: h.clock.now() });
  assert.equal((await success).coords.accuracy, 7);
  assert.equal(h.requests.length, 0);
  const cancelled = h.context.applyHeaderWeatherAutoGeoLocation(h.host, { force: true });
  h.context.invalidateHeaderWeatherLocationRequest(h.host);
  h.host.dataset.weatherManualLocation = 'true';
  h.host.dataset.weatherLocation = '40.71, -74.01';
  initial[1].success({ coords: { latitude: 48.86, longitude: 2.36, accuracy: 5 }, timestamp: h.clock.now() });
  assert.equal((await cancelled).coords, null);
  assert.equal(h.host.dataset.weatherLocation, '40.71, -74.01');
  assert.equal(h.requests.length, 0);
  assert.equal(h.clock.timers.size, 0);
});

test('a late device fix cannot overwrite a manual selection or a disposed lifecycle', async () => {
  for (const manual of [true, false]) {
    const h = harness();
    const operation = h.context.applyHeaderWeatherAutoGeoLocation(h.host, { force: true });
    const request = h.requests[0];
    h.context.invalidateHeaderWeatherLocationRequest(h.host);
    if (manual) { h.host.dataset.weatherManualLocation = 'true'; h.host.dataset.weatherLocation = '48.85, 2.35'; }
    else { h.host.__weatherLifecycleGeneration = 1; h.host.dataset.weatherMounted = 'false'; }
    request.success({ coords: { latitude: 51.35, longitude: 12.38, accuracy: 5 }, timestamp: h.clock.now() });
    assert.equal((await operation).coords, null);
    assert.equal(h.host.dataset.weatherLocation, manual ? '48.85, 2.35' : '51.34, 12.37');
    assert.equal(h.watches.size, 0);
    assert.equal(h.clock.timers.size, 0);
  }
});

test('full weather refresh occurs at five minutes, deduplicates overlap, and preserves timestamp after error', async () => {
  const pending = deferred();
  const h = harness([], { refreshHeaderWeatherGeoLocation: async () => {} });
  h.host.dataset.weatherGeoCheckedAt = String(h.clock.now());
  h.host.dataset.weatherDataUpdatedAt = String(h.clock.now());
  let requests = 0;
  h.host.__weatherWidgetInstance = { refresh: () => { requests += 1; return pending.promise; } };
  await h.clock.advance(299999);
  await h.context.refreshHeaderWeatherLifecycle(h.host);
  assert.equal(requests, 0);
  await h.clock.advance(1);
  const first = h.context.refreshHeaderWeatherLifecycle(h.host);
  const second = h.context.refreshHeaderWeatherLifecycle(h.host);
  await settle();
  assert.equal(requests, 1);
  pending.resolve({ current: {}, forecast: {} });
  assert.equal(await first, true);
  assert.equal(await second, true);
  const successfulAt = h.host.dataset.weatherDataUpdatedAt;
  await h.clock.advance(300000);
  h.host.__weatherWidgetInstance.refresh = async () => { throw new Error('offline'); };
  assert.equal(await h.context.refreshHeaderWeatherLifecycle(h.host), false);
  assert.equal(h.host.dataset.weatherDataUpdatedAt, successfulAt);
  assert.equal(h.host.dataset.weatherRefreshing, 'false');
});

test('missing refresh API and superseded payloads do not claim fresh weather', async () => {
  const h = harness();
  h.host.__weatherWidgetInstance = {};
  assert.equal(await h.context.refreshHeaderWeatherWidgetData(h.host), false);
  h.host.__weatherWidgetInstance.refresh = async () => false;
  assert.equal(await h.context.refreshHeaderWeatherWidgetData(h.host), false);
  assert.equal(h.host.dataset.weatherDataUpdatedAt, undefined);
  const pending = deferred();
  h.host.__weatherWidgetInstance.refresh = () => pending.promise;
  const operation = h.context.refreshHeaderWeatherWidgetData(h.host);
  h.context.invalidateHeaderWeatherLocationRequest(h.host);
  h.host.dataset.weatherManualLocation = 'true';
  pending.resolve({ current: {}, forecast: {} });
  assert.equal(await operation, false);
  assert.equal(h.host.dataset.weatherDataUpdatedAt, undefined);
});

test('an asynchronous initial load waits five minutes before refresh and another location cannot borrow its timestamp', async () => {
  const h = harness([], { refreshHeaderWeatherGeoLocation: async () => {} });
  const initialAt = h.clock.now();
  let requests = 0;
  let state = { weather: null, location: '51.34, 12.37', lastUpdatedAt: 0 };
  h.host.__weatherWidgetInstance = {
    getState: () => state,
    refresh: async () => { requests += 1; return { current: {}, forecast: {} }; },
  };
  // mount returned with no payload; React's initial request succeeds afterwards.
  await h.clock.advance(1000);
  state = { weather: { current: {}, forecast: {} }, location: '51.34, 12.37', lastUpdatedAt: h.clock.now() };
  await h.clock.advance(299999);
  h.host.dataset.weatherGeoCheckedAt = String(h.clock.now());
  await h.context.refreshHeaderWeatherLifecycle(h.host);
  assert.equal(requests, 0);
  assert.equal(h.host.dataset.weatherDataUpdatedAt, String(initialAt + 1000));
  await h.clock.advance(1);
  await h.context.refreshHeaderWeatherLifecycle(h.host);
  assert.equal(requests, 1);
  // The old initial payload cannot mark a new, failed coordinate selection fresh.
  h.host.dataset.weatherLocation = '48.85, 2.35';
  delete h.host.dataset.weatherDataUpdatedAt;
  h.host.__weatherWidgetInstance.refresh = async () => false;
  await h.context.refreshHeaderWeatherLifecycle(h.host);
  assert.equal(h.host.dataset.weatherDataUpdatedAt, undefined);
});

test('changing coordinates updates the existing widget and preserves its visible expanded state', async () => {
  const h = harness(['updateHeaderWeatherWidgetLocation']);
  const seen = [];
  h.host.dataset.weatherExpanded = 'true';
  h.host.__weatherCurrentMeta = { timezone: 'Europe/Berlin' };
  h.host.__weatherTimeZone = 'Europe/Berlin';
  h.host.__weatherReadingsSnapshot = { humidity: 80 };
  h.host.__weatherWidgetInstance = { setLocation: async coords => { seen.push(coords); return { current: {}, forecast: {} }; } };
  assert.equal(await h.context.updateHeaderWeatherWidgetLocation(h.host), true);
  assert.equal(seen[0].latitude, 51.34);
  assert.equal(h.host.dataset.weatherExpanded, 'true');
  assert.equal(h.host.dataset.weatherDataUpdatedAt, String(h.clock.now()));
  assert.equal(h.host.__weatherCurrentMeta, null);
  assert.equal(h.host.__weatherTimeZone, null);
  assert.equal(h.host.__weatherReadingsSnapshot, undefined, 'the new location cannot borrow readings from the previous city');
});

test('late full weather completion after unmount cannot alter freshness', async () => {
  const h = harness();
  const pending = deferred();
  h.host.__weatherWidgetInstance = { refresh: () => pending.promise };
  const operation = h.context.refreshHeaderWeatherWidgetData(h.host);
  h.host.__weatherLifecycleGeneration = 1;
  h.host.dataset.weatherMounted = 'false';
  h.host.__weatherWidgetInstance = null;
  pending.resolve({ current: {}, forecast: {} });
  assert.equal(await operation, false);
  assert.equal(h.host.dataset.weatherDataUpdatedAt, undefined);
});

test('late supplemental weather metadata cannot overwrite a later manual location', async () => {
  const pending = deferred();
  const h = harness(['syncHeaderWeatherOrbOverlay'], {
    syncHeaderWeatherClockWithServers: async () => {}, resolveHeaderWeatherAstro: async () => null,
    resolveHeaderWeatherCurrent: () => pending.promise, resolveHeaderWeatherTimeZone: () => 'Europe/Berlin',
  });
  h.host.shadowRoot = {};
  const previous = { temperature: 10 };
  h.host.__weatherCurrentMeta = previous;
  const operation = h.context.syncHeaderWeatherOrbOverlay(h.host);
  await settle();
  h.context.invalidateHeaderWeatherLocationRequest(h.host);
  h.host.dataset.weatherLocation = '48.85, 2.35';
  h.host.__weatherTimeZone = 'Europe/Paris';
  pending.resolve({ temperature: 99 });
  await operation;
  assert.equal(h.host.__weatherCurrentMeta, previous);
  assert.equal(h.host.__weatherTimeZone, 'Europe/Paris');
});

test('an unverified default city is not reverse geocoded or presented as the device location', async () => {
  const h = harness(['isHeaderWeatherManualCoordinateLocation', 'isHeaderWeatherTextManualLocation', 'getHeaderWeatherLocationLabel', 'syncHeaderWeatherPublicLocationLabel'], {
    getHeaderWeatherLocationStatusCopy: () => 'Location unavailable', scheduleHeaderWeatherMenuPlacement() {},
  });
  const node = { textContent: 'Leipzig - Zentrum', dataset: {}, setAttribute() {} };
  h.host.shadowRoot = { querySelector: () => node, querySelectorAll: () => [node] };
  delete h.host.dataset.weatherLocation;
  h.host.dataset.weatherFallbackLocation = '51.340632, 12.374733';
  h.host.dataset.weatherResolvedLocationLabel = 'Leipzig - Zentrum';
  h.host.dataset.weatherAreaState = 'unavailable';
  assert.equal(h.context.getHeaderWeatherLocationLabel(h.host), '');
  h.context.syncHeaderWeatherPublicLocationLabel(h.host);
  assert.equal(node.textContent, 'Location unavailable');
  assert.equal(node.dataset.weatherLocationState, 'unavailable');
});

test('the existing device action retries from automatic mode and uses exact device coordinates', async () => {
  const h = harness(['restoreHeaderWeatherDeviceLocation', 'updateHeaderWeatherWidgetLocation']);
  delete h.host.dataset.weatherLocation;
  const seen = [];
  h.host.__weatherWidgetInstance = { setLocation: async coords => { seen.push(coords); return { current: {}, forecast: {} }; } };
  h.context.navigator.geolocation.getCurrentPosition = (success, error, options) => { h.requests.push({ success, error, options }); };
  const operation = h.context.restoreHeaderWeatherDeviceLocation(h.host);
  assert.equal(h.requests.length, 1, 'the explicit device action must invoke the native one-shot before yielding the tap activation');
  h.requests[0].success({ coords: { latitude: 48.853421, longitude: 2.349857, accuracy: 6 }, timestamp: h.clock.now() });
  await operation;
  assert.equal(seen.length, 1);
  assert.equal(seen[0].latitude, 48.853421);
  assert.equal(seen[0].longitude, 2.349857);
  assert.equal(h.host.dataset.weatherGeoSource, 'gps');
  assert.equal(h.host.dataset.weatherGeoAccuracy, '6.0');
  assert.equal(h.host.dataset.weatherManualLocation, undefined);
  // A subsequent denied retry preserves the last working position.
  const denied = h.context.restoreHeaderWeatherDeviceLocation(h.host);
  h.requests[1].error({ code: 1 });
  await denied;
  assert.equal(h.host.dataset.weatherLocation, '48.853421, 2.349857');
  assert.equal(seen.length, 1);
});

test('a failed location change retains old displayed weather and blocks supplemental requests for the pending city', async () => {
  const requests = { location: 0, readings: 0, clock: 0 };
  const h = harness([
    'getHeaderWeatherLocationLabel', 'syncHeaderWeatherPreciseLocationMeta',
    'syncHeaderWeatherPublicLocationLabel', 'syncHeaderWeatherUnifiedReadings', 'syncHeaderWeatherOrbOverlay',
  ], {
    resolveHeaderWeatherLocationMeta: async () => { requests.location += 1; return null; },
    resolveHeaderWeatherReadings: () => { requests.readings += 1; return null; },
    syncHeaderWeatherClockWithServers: async () => { requests.clock += 1; },
  });
  const previousWeather = { current: { temp_c: 7 }, forecast: { forecastday: [] } };
  const state = { weather: previousWeather, location: { latitude: 51.34, longitude: 12.37 } };
  h.host.__weatherWidgetInstance = {
    getState: () => state,
    setLocation: async () => { throw new Error('New city weather unavailable'); },
  };
  const node = { textContent: 'Previous city' };
  h.host.shadowRoot = { querySelector: () => node };
  h.host.dataset.weatherManualLocation = 'true';
  h.host.dataset.weatherGeoSource = 'manual';
  h.host.dataset.weatherLocation = '48.85, 2.35';
  h.host.dataset.weatherResolvedLocationLabel = 'Pending city';
  const previousReadings = { temp: 7 };
  h.host.__weatherReadingsSnapshot = previousReadings;
  assert.equal(await h.context.refreshHeaderWeatherWidgetData(h.host, { coords: { latitude: 48.85, longitude: 2.35 } }), false);
  await h.context.syncHeaderWeatherPreciseLocationMeta(h.host);
  h.context.syncHeaderWeatherPublicLocationLabel(h.host);
  h.context.syncHeaderWeatherUnifiedReadings(h.host);
  await h.context.syncHeaderWeatherOrbOverlay(h.host);
  assert.deepEqual(requests, { location: 0, readings: 0, clock: 0 });
  assert.equal(node.textContent, 'Previous city');
  assert.equal(h.host.__weatherReadingsSnapshot, previousReadings);
  assert.equal(state.weather, previousWeather);
  assert.equal(h.host.dataset.weatherLocation, '48.85, 2.35');
  // The same selection can retry; its supplements resume after full weather succeeds.
  state.location = { latitude: 48.85, longitude: 2.35 };
  assert.equal(h.context.isHeaderWeatherCoordinateSelectionApplied(h.host), true);
  await h.context.syncHeaderWeatherPreciseLocationMeta(h.host);
  h.context.syncHeaderWeatherUnifiedReadings(h.host);
  assert.deepEqual(requests, { location: 1, readings: 1, clock: 0 });
});

function timerLifecycleHarness(overrides = {}) {
  const noops = Object.fromEntries([
    'applyHeaderWeatherLocationSearchCopy', 'bindHeaderWeatherOutsideDismiss', 'bindHeaderWeatherDropdownScrollState',
    'bindHeaderWeatherScrollContainment', 'syncHeaderWeatherToggleArrow', 'bindHeaderWeatherReadingsObserver',
    'scheduleHeaderWeatherOrbSync', 'syncHeaderWeatherCachedOrbPhase', 'stopHeaderWeatherToggleArrowAnimation', 'resetHeaderWeatherPreviewLayoutState', 'emitHeaderWeatherEvent',
  ].map(name => [name, () => {}]));
  const h = harness(['bindHeaderWeatherState', 'unmountHeaderWeatherWidget'], {
    ...noops, MutationObserver: class { observe() {} disconnect() {} },
    syncHeaderWeatherClockWithServers: async () => {}, refreshHeaderWeatherGeoLocation: async () => {},
    ...overrides,
  });
  h.host.shadowRoot = new globalThis.EventTarget();
  return h;
}

test('the five-minute heartbeat starts full data before a fourteen-second geolocation preflight and never duplicates it afterwards', async () => {
  const metadata = deferred();
  const h = timerLifecycleHarness({ refreshHeaderWeatherGeoLocation: () => metadata.promise });
  const initial = deferred();
  const periodic = deferred();
  const requestTimes = [];
  const weather = () => ({ current: {}, location: { tz_id: 'UTC' }, forecast: { forecastday: Array.from({ length: 4 }, (_, index) => ({
    date: new Date(h.clock.now() + index * 86400000).toISOString().slice(0, 10), day: { maxtemp_c: 9, mintemp_c: 4 },
  })) } });
  const controller = createWeatherController({ initialLocation: h.host.dataset.weatherLocation, now: h.clock.now, service: {
    getCurrentWeather: () => {
      requestTimes.push(h.clock.now());
      return requestTimes.length === 1 ? initial.promise : periodic.promise;
    },
  } });
  h.host.__weatherWidgetInstance = controller;
  h.host.dataset.weatherGeoCheckedAt = String(h.clock.now());
  const armedAt = h.clock.now();
  h.context.bindHeaderWeatherState(h.host);
  const first = controller.refresh();
  await settle();
  await h.clock.advance(12000);
  initial.resolve(weather());
  await first;
  assert.equal(controller.getState().lastUpdatedAt, armedAt + 12000);
  for (const [target, event] of [[h.document, 'visibilitychange'], [h.window, 'pageshow'], [h.window, 'online']]) target.dispatchEvent(new globalThis.Event(event));
  await settle();
  assert.equal(requestTimes.length, 1, 'resume events retain the freshness guard');
  await h.clock.advance(287999);
  assert.equal(requestTimes.length, 1);
  await h.clock.advance(1);
  assert.deepEqual(requestTimes, [armedAt, armedAt + 300000], 'the heartbeat must start before geolocation resolves');
  periodic.resolve(weather());
  await settle();
  assert.equal(h.host.dataset.weatherDataUpdatedAt, String(armedAt + 300000), 'current weather can complete while geolocation still waits');
  await h.clock.advance(14000);
  h.host.dataset.weatherGeoCheckedAt = String(h.clock.now());
  metadata.resolve();
  await settle();
  assert.deepEqual(requestTimes, [armedAt, armedAt + 300000], 'the same coordinate preflight must not repeat the completed weather request');
  controller.dispose();
  h.context.unmountHeaderWeatherWidget();
  assert.equal(h.clock.timers.size, 0);
});

test('forced periodic refresh starts during metadata preflight and duplicate ticks produce one full request', async () => {
  const metadata = deferred();
  const response = deferred();
  const h = harness([], { refreshHeaderWeatherGeoLocation: () => metadata.promise });
  h.host.dataset.weatherDataUpdatedAt = String(h.clock.now());
  let requests = 0;
  h.host.__weatherWidgetInstance = { refresh: () => { requests += 1; return response.promise; } };
  const resume = h.context.refreshHeaderWeatherLifecycle(h.host);
  const tick = h.context.refreshHeaderWeatherLifecycle(h.host, true);
  const duplicate = h.context.refreshHeaderWeatherLifecycle(h.host, true);
  assert.equal(requests, 1, 'current weather starts immediately while metadata still waits');
  response.resolve({ current: {}, forecast: {} });
  await Promise.all([tick, duplicate]);
  assert.ok(h.host.__weatherLifecyclePromise, 'metadata remains pending after the independent full request completes');
  h.host.dataset.weatherGeoCheckedAt = String(h.clock.now());
  metadata.resolve();
  await Promise.all([resume, tick, duplicate]);
  assert.equal(requests, 1, 'finishing a same-coordinate preflight must not duplicate the completed request');
});

test('forced periodic ticks coalesce with an actual weather request already in flight', async () => {
  const response = deferred();
  const h = harness();
  h.host.dataset.weatherGeoCheckedAt = String(h.clock.now());
  let requests = 0;
  h.host.__weatherWidgetInstance = { refresh: () => { requests += 1; return response.promise; } };
  const ongoing = h.context.refreshHeaderWeatherLifecycle(h.host);
  const tick = h.context.refreshHeaderWeatherLifecycle(h.host, true);
  const duplicate = h.context.refreshHeaderWeatherLifecycle(h.host, true);
  assert.equal(requests, 1);
  response.resolve({ current: {}, forecast: {} });
  await Promise.all([ongoing, tick, duplicate]);
  assert.equal(requests, 1, 'completion of the shared request must not trigger an extra forced request');
});

test('a failed forced request is not repeated when the same heartbeat geolocation preflight later completes', async () => {
  const metadata = deferred();
  let response = deferred();
  const h = timerLifecycleHarness({ refreshHeaderWeatherGeoLocation: () => metadata.promise });
  const originalTimestamp = String(h.clock.now());
  h.host.dataset.weatherDataUpdatedAt = originalTimestamp;
  h.host.dataset.weatherGeoCheckedAt = originalTimestamp;
  let requests = 0;
  h.host.__weatherWidgetInstance = { refresh: () => { requests += 1; return response.promise; }, unmount() {} };
  h.context.bindHeaderWeatherState(h.host);
  await h.clock.advance(300000);
  assert.equal(requests, 1);
  response.reject(new Error('offline during full request'));
  await settle();
  await h.clock.advance(14000);
  h.host.dataset.weatherGeoCheckedAt = String(h.clock.now());
  metadata.resolve();
  await settle();
  assert.equal(requests, 1, 'a failed full request belongs to this heartbeat and must not be retried by its metadata completion');
  assert.equal(h.host.dataset.weatherDataUpdatedAt, originalTimestamp, 'failure cannot advance freshness');
  response = deferred();
  const retry = h.context.refreshHeaderWeatherLifecycle(h.host, true);
  assert.equal(requests, 2, 'a later explicit refresh can retry after the failed heartbeat');
  response.resolve({ current: {}, forecast: {} });
  await retry;
  assert.equal(h.host.dataset.weatherDataUpdatedAt, String(h.clock.now()));
  h.context.unmountHeaderWeatherWidget();
  assert.equal(h.clock.timers.size, 0);
});

test('an unforced metadata lifecycle remembers a failed parallel forced request instead of retrying it after geolocation', async () => {
  const metadata = deferred();
  const response = deferred();
  const h = harness([], { refreshHeaderWeatherGeoLocation: () => metadata.promise });
  const originalTimestamp = String(h.clock.now() - 300000);
  h.host.dataset.weatherDataUpdatedAt = originalTimestamp;
  let requests = 0;
  h.host.__weatherWidgetInstance = { refresh: () => { requests += 1; return response.promise; } };
  const resume = h.context.refreshHeaderWeatherLifecycle(h.host);
  const tick = h.context.refreshHeaderWeatherLifecycle(h.host, true);
  assert.equal(requests, 1, 'the forced call starts without waiting for the existing geolocation lifecycle');
  response.reject(new Error('temporary full weather failure'));
  assert.equal(await tick, false);
  assert.equal(h.host.dataset.weatherDataUpdatedAt, originalTimestamp);
  h.host.dataset.weatherGeoCheckedAt = String(h.clock.now());
  metadata.resolve();
  await resume;
  assert.equal(requests, 1, 'a settled failed forced promise must suppress a duplicate age-based request in the same lifecycle');
  assert.equal(h.host.dataset.weatherDataUpdatedAt, originalTimestamp, 'the failed parallel request cannot bless the old payload');
});

test('a periodic weather refresh preserves a previous geolocation denial without requesting permission again', async () => {
  const h = harness(['refreshHeaderWeatherGeoLocation']);
  const denied = h.context.resolveHeaderWeatherBrowserGeoCoords({ force: true });
  h.requests[0].error({ code: 1 });
  await denied;
  h.host.dataset.weatherDataUpdatedAt = String(h.clock.now());
  let weatherRequests = 0;
  h.host.__weatherWidgetInstance = { refresh: async () => { weatherRequests += 1; return { current: {}, forecast: {} }; } };
  await h.context.refreshHeaderWeatherLifecycle(h.host, true);
  assert.equal(weatherRequests, 1, 'weather at the retained coordinates remains refreshable');
  assert.equal(h.requests.length, 1, 'the heartbeat must not repeat a denied native permission request');
});

test('forced requests respect entry visibility and identity guards while superseded responses cannot update freshness', async () => {
  for (const change of [
    h => { h.host.dataset.weatherMounted = 'false'; },
    h => { h.host.isConnected = false; },
    h => { h.context.navigator.onLine = false; },
    h => { h.document.hidden = true; },
  ]) {
    let requests = 0;
    let metadataRequests = 0;
    const h = harness([], { refreshHeaderWeatherGeoLocation: async () => { metadataRequests += 1; } });
    h.host.__weatherWidgetInstance = { refresh: async () => { requests += 1; return { current: {}, forecast: {} }; } };
    change(h);
    assert.equal(await h.context.refreshHeaderWeatherLifecycle(h.host, true), false);
    assert.equal(requests, 0, 'an inactive entry cannot start a full request');
    assert.equal(metadataRequests, 0, 'an inactive entry cannot start geolocation preflight');
  }
  for (const [name, change, supersedes] of [
    ['unmounted', h => { h.host.dataset.weatherMounted = 'false'; }, true],
    ['disconnected', h => { h.host.isConnected = false; }, true],
    ['disposed generation', h => { h.host.__weatherLifecycleGeneration = 1; }, true],
    ['manual selection', h => { h.host.__weatherLocationGeneration = 1; h.host.dataset.weatherManualLocation = 'true'; }, true],
    ['changed coordinates', h => { h.host.dataset.weatherLocation = '48.85, 2.35'; }, true],
    ['offline', h => { h.context.navigator.onLine = false; }, false],
    ['hidden', h => { h.document.hidden = true; }, false],
  ]) {
    for (const initialForce of [false, true]) {
      const metadata = deferred();
      const response = deferred();
      let applied = 0;
      const h = harness([], { refreshHeaderWeatherGeoLocation: () => metadata.promise, syncHeaderWeatherUnifiedReadings: () => { applied += 1; } });
      const originalTimestamp = String(h.clock.now() - 1000);
      h.host.dataset.weatherDataUpdatedAt = originalTimestamp;
      let requests = 0;
      h.host.__weatherWidgetInstance = { refresh: () => { requests += 1; return response.promise; } };
      const resume = h.context.refreshHeaderWeatherLifecycle(h.host, initialForce);
      const tick = h.context.refreshHeaderWeatherLifecycle(h.host, true);
      const duplicate = h.context.refreshHeaderWeatherLifecycle(h.host, true);
      assert.equal(requests, 1, 'the full request legitimately starts before the selection changes');
      change(h);
      metadata.resolve();
      response.resolve({ current: {}, forecast: {} });
      await Promise.all([resume, tick, duplicate]);
      assert.equal(requests, 1, `${name}: stale preflight must not start another full request (force=${initialForce})`);
      assert.equal(h.host.dataset.weatherDataUpdatedAt, supersedes ? originalTimestamp : String(h.clock.now()), `${name}: only the retained selection may advance freshness`);
      assert.equal(applied, supersedes ? 0 : 1, `${name}: a superseded response cannot overwrite readings`);
    }
  }
});

test('visible, bfcache and online resume refresh overdue data once and unmount removes lifecycle listeners', async () => {
  const h = timerLifecycleHarness();
  let requests = 0;
  let pending = deferred();
  h.host.__weatherWidgetInstance = { refresh: () => { requests += 1; return pending.promise; }, unmount() {} };
  h.host.dataset.weatherDataUpdatedAt = String(h.clock.now());
  h.host.dataset.weatherGeoCheckedAt = String(h.clock.now());
  h.context.bindHeaderWeatherState(h.host);
  h.document.hidden = true;
  await h.clock.advance(900000);
  assert.equal(requests, 0);
  h.document.hidden = false;
  for (const [target, event] of [[h.document, 'visibilitychange'], [h.window, 'pageshow'], [h.window, 'online']]) target.dispatchEvent(new globalThis.Event(event));
  await settle();
  assert.equal(requests, 1);
  pending.resolve({ current: {}, forecast: {} });
  await settle();
  h.context.navigator.onLine = false;
  await h.clock.advance(600000);
  assert.equal(requests, 1);
  h.context.navigator.onLine = true;
  pending = deferred();
  h.window.dispatchEvent(new globalThis.Event('online'));
  await settle();
  assert.equal(requests, 2);
  pending.resolve({ current: {}, forecast: {} });
  await settle();
  h.context.unmountHeaderWeatherWidget();
  assert.equal(h.clock.timers.size, 0);
  h.host.dataset.weatherMounted = 'true';
  h.host.__weatherWidgetInstance = { refresh: async () => { requests += 1; return {}; } };
  await h.clock.advance(600000);
  for (const [target, event] of [[h.document, 'visibilitychange'], [h.window, 'pageshow'], [h.window, 'online']]) target.dispatchEvent(new globalThis.Event(event));
  await settle();
  assert.equal(requests, 2);
});

test('the existing sonar occupies the renderer mount root before modules load without adding a form', () => {
  const node = () => ({ dataset: {}, style: {}, children: [], innerHTML: '',
    appendChild(child) { this.children.push(child); },
    querySelector(selector) {
      if (selector.startsWith('style[')) return this.children.find(child => child.dataset.headerWeatherTransparent === 'true') || null;
      if (selector === '[data-weather-widget-root]') return this.children.find(child => child.dataset.weatherWidgetRoot === 'true') || null;
      return selector === '.weather-header-preview' && this.innerHTML.includes('weather-header-preview') ? this : null;
    },
  });
  const root = node();
  const host = { dataset: {}, attachShadow: () => { host.shadowRoot = root; return root; } };
  const context = vm.createContext({ document: { createElement: node }, HEADER_WEATHER_TRANSPARENT_STYLES: 'existing sonar CSS' });
  vm.runInContext(declaration('prepareHeaderWeatherLoadingState'), context);
  context.prepareHeaderWeatherLoadingState(host);
  context.prepareHeaderWeatherLoadingState(host);
  assert.equal(root.children.length, 2, 'the same style and renderer root are reused');
  assert.equal(host.dataset.weatherVariant, 'header');
  const container = root.querySelector('[data-weather-widget-root]');
  assert.match(container.innerHTML, /weather-header-state__spinner/);
  assert.doesNotMatch(container.innerHTML, /<input|<button|<form/);
  assert.match(container.innerHTML, /aria-busy="true"/);
});

test('weather startup begins during the sonar without waiting for page load, idle time or device coordinates', async () => {
  let started = 0;
  const h = harness(['syncHeaderWeatherWidget'], { normalizeLangCode: value => value, unmountHeaderWeatherWidget() {} });
  h.host.dataset.weatherMounted = 'false';
  h.context.mountHeaderWeatherWidget = () => { started += 1; h.host.dataset.weatherMounted = 'loading'; };
  h.context.syncHeaderWeatherWidget('ru');
  h.context.syncHeaderWeatherWidget('ru');
  assert.equal(started, 1);
  assert.equal(h.clock.timers.size, 0);

  const loading = deferred();
  const location = deferred();
  const steps = [];
  const mount = harness(['mountHeaderWeatherWidget'], {
    prepareHeaderWeatherLoadingState: () => steps.push('sonar'),
    loadHeaderWeatherWidgetLoader: () => { steps.push('modules'); return loading.promise; },
  });
  mount.host.dataset.weatherMounted = 'false';
  mount.context.applyHeaderWeatherAutoGeoLocation = () => { steps.push('location'); return location.promise; };
  const operation = mount.context.mountHeaderWeatherWidget('ru');
  assert.deepEqual(steps, ['sonar', 'location', 'modules']);
  mount.host.isConnected = false;
  loading.resolve({});
  return mount.clock.advance(1500).then(() => operation).then(() => {
    assert.equal(mount.clock.timers.size, 0);
    assert.equal(mount.host.__weatherWidgetInstance, undefined);
  });
});
