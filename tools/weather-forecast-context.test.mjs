import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'espree';
import { buildForecastSlots, resolveForecastCloudCover, resolveForecastNoonMs, buildForecastSceneContext, formatWeatherObservationTime } from '../3d-weather-codrops-main/src/weather-lifecycle.mjs';
import { solarPosition } from '../assets/js/weather-solar-time.js';

const filenames = ['widget.mjs', 'header-preview.mjs', 'header-dropdown.mjs'];
const locales = ['ru', 'uk', 'de', 'en'];

function binding(source, name, nextName) {
  const marker = `  ${name} = `;
  const start = source.indexOf(marker);
  const end = source.indexOf(`,\n  ${nextName} = `, start);
  assert.ok(start >= 0 && end > start, `Cannot find ${name}`);
  return source.slice(start + marker.length, end);
}

function jsxBlock(source, className, nextClassName) {
  const position = source.indexOf(`className: \`${className}\``);
  const start = source.lastIndexOf('(0, jsxRuntime.jsxs)(`div`, {', position);
  const next = source.indexOf(`className: \`${nextClassName}\``, position);
  const end = source.lastIndexOf('(0, jsxRuntime.', next);
  assert.ok(position >= 0 && start >= 0 && next > position && end > start, `Cannot find ${className} JSX`);
  return source.slice(start, end).trim().replace(/,$/, '');
}

function text(node) {
  if (node === null || node === undefined || node === false) return '';
  if (Array.isArray(node)) return node.map(text).join('');
  return typeof node === 'object' ? text(node.props?.children) : String(node);
}

async function harness(filename) {
  const source = await readFile(new URL(`../3d-weather-codrops-main/src/${filename}`, import.meta.url), 'utf8');
  const copy = new Function(`return (${binding(source, 'localeCopy', 'conditionCodeLabels')});`)();
  const localeTags = new Function(`return (${binding(source, 'localeTags', 'formatCountry')});`)();
  const formatDate = new Function('localeTags', `return (${binding(source, 'formatForecastDate', 'translateCondition')});`)(localeTags);
  const formatTime = new Function('localeTags', `return (${binding(source, 'formatLocalTime', 'formatForecastDate')});`)(localeTags);
  const project = new Function('resolveForecastCloudCover', 'resolveForecastNoonMs', `return (${binding(source, 'weatherForForecastDay', 'weatherStatistics')});`)(resolveForecastCloudCover, resolveForecastNoonMs);
  const title = jsxBlock(source, 'weather-header-dropdown__hero-title', 'weather-header-dropdown__close');
  const condition = jsxBlock(source, 'weather-header-dropdown__hero-copy', 'weather-header-dropdown__hero-chips');
  const observedTime = source.match(/observedTime = (.+),\r?\n\s+le = /)?.[1];
  assert.ok(observedTime, 'observation time binding must be present');
  const render = new Function('Q', '$', 'u', 'U', 'B', 'de', 'ce', 'jsxRuntime', 'formatForecastDate', 'formatLocalTime', 'formatWeatherObservationTime', 'localeTags',
    `const observedTime = (${observedTime}); return { title: (${title}), condition: (${condition}) };`);
  const jsx = (type, props, key) => ({ type, props, key });
  return {
    source, copy, localeTags, formatDate, formatTime, project,
    render(data, selected, locale) {
      const weather = project(data, selected);
      return render(selected, weather, locale, copy[locale], selected ? 3 : null, 'Region', weather.current.condition.text,
        { jsx, jsxs: jsx, Fragment: 'Fragment' }, formatDate, formatTime, formatWeatherObservationTime, localeTags);
    },
  };
}

function weather() {
  return {
    current: { temp_c: 7, is_day: 0, last_updated_epoch: Date.parse('2026-11-04T20:30:00Z') / 1000, condition: { code: 1000, text: 'Current clear' } },
    location: { name: 'Current place', tz_id: 'Europe/Berlin', localtime: '2026-11-04 22:39' },
    weatherMeta: { observedAt: Date.parse('2026-11-04T20:30:00Z'), fetchedAt: Date.parse('2026-11-04T21:39:00Z') },
    forecast: { forecastday: ['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'].map((date, index) => ({
      date, day: { maxtemp_c: 10 + index, mintemp_c: 3, condition: { code: 1009, text: `Forecast ${date}` } },
    })) },
  };
}

for (const filename of filenames) {
  test(`${filename}: all localized current clocks stay 24-hour through midnight without a stale AM/PM marker`, async () => {
    const h = await harness(filename);
    for (const locale of locales) {
      assert.equal(h.formatTime('2026-11-04 22:05', locale), '22:05', locale);
      assert.equal(h.formatTime('2026-11-05 00:05', locale), '00:05', locale);
      const data = weather();
      data.location.localtime = '2026-11-04 22:05';
      assert.ok(text(h.render(data, null, locale).title.props.children[2]).startsWith('22:05'), locale);
      assert.doesNotMatch(text(h.render(data, null, locale).title), /\b(?:AM|PM)\b/u, locale);
    }
  });

  test(`${filename}: daily hero identifies the selected full date in all four languages without a fake update time`, async () => {
    const h = await harness(filename);
    const data = weather();
    const original = structuredClone(data);
    const selected = buildForecastSlots(data, Date.parse('2026-11-04T21:39:00Z'))[3];
    for (const locale of locales) {
      const view = h.render(data, selected, locale);
      const [eyebrow, place, meta] = view.title.props.children;
      const expectedDate = new Intl.DateTimeFormat(h.localeTags[locale], {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      }).format(new Date(2026, 10, 7));
      assert.equal(eyebrow.props.children, h.copy[locale].forecast, locale);
      assert.equal(place.props.children, data.location.name);
      assert.equal(text(meta), expectedDate, locale);
      assert.match(text(meta), /2026/);
      assert.ok(!text(meta).includes('12:00'), 'daily calendar date is not a forecast observation at noon');
      assert.equal(view.condition.props.children[0].props.children, selected.day.condition.text);
      const updated = view.condition.props.children[1];
      assert.equal(updated.props.hidden, true);
      assert.equal(updated.props.children, '', 'the retained node must not contain a fictional Updated 12:00 label');
      assert.ok(!text([view.title, view.condition]).includes(`${h.copy[locale].updated}:`));
      assert.equal(h.formatDate(selected.date, locale), new Intl.DateTimeFormat(h.localeTags[locale], { weekday: 'short' }).format(new Date(2026, 10, 7)), 'existing tile weekday stays compact');

      const current = h.render(data, null, locale);
      assert.equal(current.title.props.children[0].props.children, h.copy[locale].headerLabel);
      assert.ok(text(current.title.props.children[2]).startsWith(h.formatTime(data.location.localtime, locale)));
      assert.equal(current.condition.props.children[1].props.hidden, false);
      assert.equal(text(current.condition.props.children[1]), `${h.copy[locale].updated}: 21:30`, 'Updated uses the observation, not the live local clock');
      const later = structuredClone(data);
      later.location.localtime = '2026-11-04 22:40';
      later.weatherMeta.fetchedAt += 60000;
      assert.equal(text(h.render(later, null, locale).condition.props.children[1]), text(current.condition.props.children[1]), 'a new clock or fetch time is not a new observation');
    }
    assert.deepEqual(data, original, 'display context must not alter current observations or the provider forecast');
  });

  test(`${filename}: mounted consumers share the exact selected weather projection and slot resolver`, async () => {
    const h = await harness(filename);
    const mount = h.source.indexOf('  mountWeatherWidget = ');
    const start = h.source.indexOf('    let l = {', mount);
    const end = h.source.indexOf('    return (mountedWidgets.set', start);
    assert.ok(mount >= 0 && start > mount && end > start, 'mounted API must be present');
    const api = new Function('n', 'c', 'runtimeController', 'resolveForecastCloudCover', 'resolveForecastNoonMs', 'buildForecastSceneContext', 'buildForecastSlots', 'weatherForForecastDay', 'formatWeatherObservationTime', 'mountedWidgets',
      `${h.source.slice(start, end)}; return l;`)(
      { shadowRoot: {}, dataset: {} }, {}, {}, resolveForecastCloudCover, resolveForecastNoonMs, buildForecastSceneContext, buildForecastSlots, h.project, formatWeatherObservationTime, new WeakMap()
    );
    assert.equal(api.getForecastSlots, buildForecastSlots);
    assert.equal(api.getForecastWeather, h.project);
    assert.equal(api.getForecastNoonMs, resolveForecastNoonMs);
    assert.equal(api.getForecastSceneContext, buildForecastSceneContext);
    assert.equal(api.observationTime, formatWeatherObservationTime);
    assert.equal(api.getForecastNoonMs('2026-11-07', 'Europe/Berlin'), Date.parse('2026-11-07T11:00:00Z'));
    const data = weather();
    const selected = api.getForecastSlots(data, Date.parse('2026-11-04T21:39:00Z'))[3];
    const projected = api.getForecastWeather(data, selected);
    assert.equal(api.observationTime(data, 'ru-RU'), '21:30');
    assert.equal(projected.current.condition, selected.day.condition);
    assert.equal(projected.current.temp_c, selected.day.maxtemp_c);
    assert.equal(api.getForecastWeather(data, null), data);
    assert.equal(api.getForecastWeather(data, { date: selected.date, available: false }), data);
    assert.equal(data.current.condition.text, 'Current clear');
  });

  test(`${filename}: missing observation time stays hidden instead of presenting the fetch or current clock`, async () => {
    const h = await harness(filename);
    const data = weather();
    delete data.weatherMeta.observedAt;
    delete data.current.last_updated_epoch;
    for (const locale of locales) {
      const updated = h.render(data, null, locale).condition.props.children[1];
      assert.equal(updated.props.hidden, true, locale);
      assert.equal(text(updated), '', locale);
    }
  });
}

for (const filename of filenames.filter(name => name !== 'widget.mjs')) {
  test(`${filename}: forecast appearance uses selected local noon while retaining the real observation metadata`, async () => {
    const h = await harness(filename);
    const data = weather();
    const original = structuredClone(data);
    const selected = buildForecastSlots(data, Date.parse('2026-11-04T21:39:00Z'))[3];
    const projected = h.project(data, selected);
    assert.equal(projected.weatherMeta.appearanceTimeMs, Date.parse('2026-11-07T11:00:00Z'));
    assert.equal(projected.weatherMeta.observedAt, data.weatherMeta.observedAt);
    assert.equal(projected.current.last_updated_epoch, data.current.last_updated_epoch);
    assert.deepEqual(data, original);
  });
}

for (const filename of filenames) {
  test(`${filename}: every 3D scene receives the corrected clock and shared solar phase through mount and app props`, async () => {
    const { source } = await harness(filename);
    const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    const app = ast.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'WeatherApp');
    const calls = [];
    const pending = [ast];
    while (pending.length) {
      const node = pending.pop();
      if (node.type === 'CallExpression' && ['WeatherApp', 'Scene3D'].includes(node.arguments[0]?.name)) calls.push(node);
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) pending.push(...value.filter(child => child && typeof child.type === 'string'));
        else if (value && typeof value.type === 'string') pending.push(value);
      }
    }
    const correctedClock = () => Date.parse('2026-11-04T21:39:00Z');
    const sharedPhase = { dominantKind: 'moon', starOpacity: 1 };
    const getSolarPhase = () => sharedPhase;
    const mountCall = calls.find(node => node.arguments[0].name === 'WeatherApp');
    const mountProps = new Function('t', 'i', 'r', 'runtimeController', `return (${source.slice(mountCall.arguments[1].start, mountCall.arguments[1].end)});`)(
      { now: correctedClock, getSolarPhase }, '100%', 'header', {}
    );
    const bindApp = new Function('options', 'DEFAULT_LOCATION', `const ${source.slice(app.params[0].start, app.params[0].end)} = options; return { now, getSolarPhase };`);
    const appProps = bindApp(mountProps, 'Leipzig');
    assert.equal(appProps.now, correctedClock);
    assert.equal(appProps.getSolarPhase, getSolarPhase);
    assert.equal(bindApp({}, 'Leipzig').now, Date.now, 'standalone mounting keeps a working native-clock default');
    const sceneCalls = calls.filter(node => node.arguments[0].name === 'Scene3D');
    assert.equal(sceneCalls.length, 3, 'header, dropdown and standalone scenes must all share the clock path');
    for (const call of sceneCalls) {
      const props = new Function('Z', 'd', '$', '_', 'e', 'l', 'j', 'N', 'F', 'now', 'getSolarPhase', `return (${source.slice(call.arguments[1].start, call.arguments[1].end)});`)(
        null, weather(), weather(), false, true, 'header-panel', () => {}, () => {}, () => {}, appProps.now, appProps.getSolarPhase
      );
      assert.equal(props.now(), correctedClock());
      assert.equal(props.getSolarPhase(), sharedPhase);
    }
  });
}

test('all entry variants expose the same forecast calendar and hero text', async () => {
  const entries = await Promise.all(filenames.map(harness));
  const data = weather();
  const selected = buildForecastSlots(data, Date.parse('2026-11-04T21:39:00Z'))[3];
  for (const locale of locales) {
    const views = entries.map(h => h.render(data, selected, locale));
    for (const view of views.slice(1)) assert.deepEqual(view, views[0], locale);
  }
});

function sourceBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `Cannot extract ${startMarker.trim()}`);
  return source.slice(start, end);
}

test('shell shares the observation formatter and retains fresh API time instead of the widget clock', async () => {
  const source = await readFile(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8');
  const observation = sourceBlock(source, '  function getHeaderWeatherObservationTime(', '\n  function extractHeaderWeatherReadingsFromHost(');
  const readings = sourceBlock(source, '  function buildHeaderWeatherReadingsFromMeta(', '\n  function updateHeaderWeatherTextParts(');
  const h = new Function('resolveHeaderWeatherTimeZone', 'getHeaderWeatherPressureLang', 'getHeaderWeatherFiniteNumber',
    'convertHeaderWeatherHpaToMmHg', 'resolveHeaderWeatherConditionLabel', 'formatHeaderWeatherCelsiusText',
    'formatHeaderWeatherPressureValue', 'hydrateHeaderWeatherReadingsFromCache', 'isHeaderWeatherTextManualLocation',
    'extractHeaderWeatherReadingsFromHost', 'isHeaderWeatherCurrentMetaFresh', 'normalizeHeaderWeatherHumidityValue',
    `${observation}\n${readings}; return { time: getHeaderWeatherObservationTime, readings: resolveHeaderWeatherReadings };`)(
    host => host.timeZone, () => 'ru', value => value === undefined ? null : Number(value),
    () => null, () => 'Clear', value => `${value}°C`, (_host, value) => String(value),
    () => {}, () => false, host => host.widgetReadings, () => true, () => null
  );
  const data = weather();
  const host = {
    timeZone: 'Europe/Berlin',
    __weatherWidgetInstance: { getState: () => ({ weather: data }), observationTime: formatWeatherObservationTime },
    __weatherCurrentMeta: { ...data.weatherMeta, temperature: 5 },
    widgetReadings: { temp: 7, meta: '22:39', humidity: '75%' },
  };
  assert.equal(h.time(host), '21:30');
  assert.equal(h.readings(host).meta, '21:30');
  assert.equal(h.readings(host).temp, 5, 'the timestamp describes the same API readings as the displayed temperature');
  host.__weatherCurrentMeta.observedAt = Date.parse('2026-11-04T20:45:00Z');
  assert.equal(h.readings(host).meta, '21:45', 'a new observation can advance Updated independently of the widget clock');
  delete host.__weatherCurrentMeta.observedAt;
  assert.equal(h.readings(host).meta, '', 'fetch time must not supply an observation label');
  const fallback = { __weatherWidgetInstance: { observationTime: formatWeatherObservationTime }, __weatherWidgetData: data };
  assert.equal(h.time(fallback), '21:30', 'mounted consumers may use their real cached weather data');
  assert.equal(h.time({}), '', 'an unmounted widget must not invent a current time');
});

async function shellContextHarness() {
  const source = await readFile(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8');
  const selected = sourceBlock(source, '  function resolveHeaderWeatherSelectedForecast(', '\n  function resolveHeaderWeatherDropdownAtmosphere(');
  const context = sourceBlock(source, '  function resolveHeaderWeatherDropdownSceneContext(', '\n  async function resolveHeaderWeatherLocationMeta(');
  return new Function('resolveHeaderWeatherTimeZone', `${selected}\n${context}
    return { selected: resolveHeaderWeatherSelectedForecast, context: resolveHeaderWeatherDropdownSceneContext };`)(
    host => host.timeZone ?? 'Europe/Berlin'
  );
}

function contextHost(project, { date = '2026-11-07', disabled = false } = {}) {
  const data = weather();
  const original = structuredClone(data);
  const slots = buildForecastSlots(data, Date.parse('2026-11-04T21:39:00Z'));
  const active = { disabled, dataset: date === null ? {} : { forecastDate: date } };
  const calls = [];
  const host = {
    timeZone: data.location.tz_id,
    __weatherWidgetData: { current: { condition: { text: 'Stale fallback must not win' } } },
    __weatherWidgetInstance: {
      getState: () => ({ weather: data }),
      getForecastNoonMs: resolveForecastNoonMs,
      getForecastSceneContext: buildForecastSceneContext,
      getForecastSlots(input) {
        assert.equal(input, data);
        return slots;
      },
      getForecastWeather(input, selected) {
        assert.equal(input, data);
        calls.push(selected);
        return project(input, selected);
      },
    },
    shadowRoot: { querySelector: selector => selector === '.weather-header-dropdown__forecast-pill.is-active' ? active : null },
  };
  return { host, data, original, slots, active, calls };
}

function currentScene() {
  return {
    presentation: {
      dominantKind: 'moon',
      sun: { active: false, opacity: 0, previewLayout: { x: 10 }, dropdownLayout: { x: 20 }, timeline: { dayProgress: 0 } },
      moon: { active: true, opacity: 1, previewLayout: { x: 30 }, dropdownLayout: { x: 40 }, timeline: { nightProgress: .5 } },
    },
    geoState: { latitude: 51.2, longitude: 6.8, timeMs: Date.parse('2026-11-04T21:39:00Z') },
  };
}

test('shell selects a real available forecast by calendar date rather than tile index or stale host data', async () => {
  const h = await shellContextHarness();
  const entry = await harness('header-dropdown.mjs');
  const fixture = contextHost(entry.project);
  fixture.slots.unshift({ date: '2026-11-07', available: false, day: { condition: { text: 'Unavailable duplicate' } } });
  const selected = h.selected(fixture.host);
  assert.equal(selected, fixture.slots.at(-1));
  assert.equal(selected.day.condition.text, 'Forecast 2026-11-07');
  assert.deepEqual(fixture.data, fixture.original);
  fixture.active.disabled = true;
  assert.equal(h.selected(fixture.host), null);
  fixture.active.disabled = false;
  fixture.active.dataset.forecastDate = '2026-11-08';
  assert.equal(h.selected(fixture.host), undefined, 'an absent real forecast must not reuse an adjacent tile');
});

test('shell daily context changes a nighttime dropdown to daytime without mutating current weather, geometry or its UTC clock', async () => {
  const h = await shellContextHarness();
  const entry = await harness('header-dropdown.mjs');
  const fixture = contextHost(entry.project);
  const { presentation, geoState } = currentScene();
  const originalPresentation = structuredClone(presentation);
  const originalGeoState = structuredClone(geoState);
  const context = h.context(fixture.host, presentation, geoState);
  assert.equal(context.forecast, true);
  assert.equal(context.presentation.dominantKind, 'sun');
  assert.equal(context.presentation.sun.active, true);
  assert.equal(context.presentation.sun.opacity, 1);
  assert.equal(context.presentation.moon.active, false);
  assert.equal(context.presentation.moon.opacity, 0);
  assert.equal(context.geoState.appearanceTimeMs, Date.parse('2026-11-07T11:00:00Z'));
  assert.equal(context.geoState.timeMs, geoState.timeMs, 'forecast colour cannot replace the live animation time');
  assert.equal(context.presentation.sun.dropdownLayout, presentation.sun.dropdownLayout);
  assert.equal(context.presentation.moon.previewLayout, presentation.moon.previewLayout);
  assert.deepEqual(presentation, originalPresentation, 'the current preview presentation is shared read-only');
  assert.deepEqual(geoState, originalGeoState);
  assert.deepEqual(fixture.data, fixture.original, 'selecting a scene cannot upload a forecast as current weather');
  assert.deepEqual(fixture.calls, [fixture.slots[3]], 'reuse the existing pure projection rather than remounting the widget');
});

test('Now, disabled, missing and invalid forecast contexts retain original presentation and geo identities', async () => {
  const h = await shellContextHarness();
  const entry = await harness('header-dropdown.mjs');
  const cases = [
    { label: 'Now', options: { date: null } },
    { label: 'disabled slot', options: { disabled: true } },
    { label: 'unavailable forecast', alter: fixture => { fixture.slots[3].available = false; } },
    { label: 'missing date', options: { date: '2026-11-08' } },
    { label: 'missing mounted projection', alter: fixture => { delete fixture.host.__weatherWidgetInstance.getForecastWeather; } },
    { label: 'missing mounted scene helper', alter: fixture => { delete fixture.host.__weatherWidgetInstance.getForecastSceneContext; } },
    { label: 'projection returned current', alter: fixture => { fixture.host.__weatherWidgetInstance.getForecastWeather = () => fixture.data; } },
    { label: 'invalid timezone', alter: fixture => { fixture.host.timeZone = 'Invalid/Timezone'; } },
    { label: 'invalid date', alter: fixture => {
      fixture.active.dataset.forecastDate = '2026-02-30';
      fixture.slots.push({ ...fixture.slots[3], date: '2026-02-30' });
    } },
  ];
  for (const { label, options, alter } of cases) {
    const fixture = contextHost(entry.project, options);
    alter?.(fixture);
    const { presentation, geoState } = currentScene();
    const context = h.context(fixture.host, presentation, geoState);
    assert.equal(context.forecast, false, label);
    assert.equal(context.presentation, presentation, label);
    assert.equal(context.geoState, geoState, label);
    assert.deepEqual(fixture.data, fixture.original, label);
  }
});

test('shared forecast scene helper validates its representative time and preserves the original scene on unavailable input', () => {
  const { presentation, geoState } = currentScene();
  const original = structuredClone({ presentation, geoState });
  for (const [projected, date, timeZone] of [
    [null, '2026-11-07', 'Europe/Berlin'],
    [undefined, '2026-11-07', 'Europe/Berlin'],
    [{ current: { is_day: 1 } }, '2026-02-30', 'Europe/Berlin'],
    [{ current: { is_day: 1 } }, '2026-11-07', 'Invalid/Timezone'],
  ]) {
    const context = buildForecastSceneContext(projected, date, presentation, geoState, timeZone);
    assert.equal(context.forecast, false);
    assert.equal(context.presentation, presentation);
    assert.equal(context.geoState, geoState);
  }
  for (const isDay of [1, 0]) {
    const projected = { current: { is_day: isDay } };
    const context = buildForecastSceneContext(projected, '2026-11-07', presentation, geoState, 'Europe/Berlin');
    assert.equal(context.forecast, true);
    assert.equal(context.presentation.dominantKind, isDay ? 'sun' : 'moon');
    assert.equal(context.presentation.sun.active, isDay === 1);
    assert.equal(context.presentation.sun.opacity, isDay);
    assert.equal(context.presentation.moon.active, isDay === 0);
    assert.equal(context.presentation.moon.opacity, 1 - isDay);
    assert.equal(context.presentation.sun.timeline, presentation.sun.timeline);
    assert.equal(context.presentation.moon.dropdownLayout, presentation.moon.dropdownLayout);
    assert.equal(context.geoState.timeMs, geoState.timeMs);
    assert.equal(context.geoState.appearanceTimeMs, Date.parse('2026-11-07T11:00:00Z'));
    assert.deepEqual(projected, { current: { is_day: isDay } });
  }
  assert.deepEqual({ presentation, geoState }, original);
});

test('forecast noon resolves local calendar dates through DST, leap days and UTC year rollover', async () => {
  const fixtures = [
    ['Europe/Berlin', '2026-11-04', '2026-11-04T11:00:00Z'],
    ['Europe/Berlin', '2026-07-15', '2026-07-15T10:00:00Z'],
    ['Europe/Berlin', '2026-03-28', '2026-03-28T11:00:00Z'],
    ['Europe/Berlin', '2026-03-29', '2026-03-29T10:00:00Z'],
    ['Europe/Berlin', '2026-10-24', '2026-10-24T10:00:00Z'],
    ['Europe/Berlin', '2026-10-25', '2026-10-25T11:00:00Z'],
    ['Europe/Berlin', '2026-12-31', '2026-12-31T11:00:00Z'],
    ['Europe/Berlin', '2027-01-01', '2027-01-01T11:00:00Z'],
    ['Europe/Berlin', '2028-02-29', '2028-02-29T11:00:00Z'],
    ['Pacific/Kiritimati', '2027-01-01', '2026-12-31T22:00:00Z'],
    ['Asia/Kathmandu', '2026-11-04', '2026-11-04T06:15:00Z'],
    ['Asia/Tokyo', '2026-11-04', '2026-11-04T03:00:00Z'],
    ['Asia/Kolkata', '2026-11-04', '2026-11-04T06:30:00Z'],
    ['Australia/Sydney', '2026-11-04', '2026-11-04T01:00:00Z'],
    ['Pacific/Chatham', '2026-11-04', '2026-11-03T22:15:00Z'],
    ['Pacific/Pago_Pago', '2026-11-04', '2026-11-04T23:00:00Z'],
  ];
  for (const [timeZone, date, expected] of fixtures) {
    assert.equal(resolveForecastNoonMs(date, timeZone), Date.parse(expected), `${timeZone} ${date}`);
  }
  for (const date of [null, undefined, '', '2026-2-03', '2026-02-29', '2026-02-30', '2026-13-01', '2026-11-04T12:00:00Z']) {
    assert.equal(resolveForecastNoonMs(date, 'Europe/Berlin'), null, String(date));
  }
  assert.equal(resolveForecastNoonMs('2026-11-04', 'Invalid/Timezone'), null);
  for (const zone of [undefined, null, '', ' ', false, 0]) assert.equal(resolveForecastNoonMs('2026-11-04', zone), null, `missing zone ${String(zone)} cannot use the browser timezone`);
});

async function solarContextHarness() {
  const source = await readFile(new URL('../assets/js/header-weather-sun-scene.js', import.meta.url), 'utf8');
  const math = sourceBlock(source, 'const TAU = ', '\nfunction resolveSolarPixelRatio(').replace(/export /g, '');
  const state = sourceBlock(source, '  setGeoState(next) {', '\n  async init() {');
  const animation = sourceBlock(source, '  updateAnimation(', '\n  renderFrame() {');
  let tick = 0;
  const api = new Function('THREE', 'solarPosition', 'performance', `${math}\nclass SolarContext { ${state}\n${animation} }
    return { Scene: SolarContext, elevation: solarElevationDegrees, color: solarColorForElevation,
      surfaceColor: solarSurfaceColorForElevation, angle: solarRotationAngle, epoch: SOLAR_MODEL_EPOCH_MS };`)(
    { MathUtils: { degToRad: degrees => degrees * Math.PI / 180 } }, solarPosition, { now: () => tick }
  );
  api.finishBlend = () => { tick += 1200; };
  return api;
}

function solarScene(h, options) {
  const scene = Object.create(h.Scene.prototype);
  const color = { r: 1, g: 1, b: 1 };
  Object.defineProperty(color, 'setRGB', { value(r, g, b) { Object.assign(this, { r, g, b }); return this; } });
  const sharedColor = { value: color };
  Object.assign(scene, {
    options, geoState: {}, sunMesh: { rotation: { y: 0 } },
    solarDaysUniform: { value: 0 },
    solarColorUniform: sharedColor,
    solarSurfaceColorUniform: sharedColor,
    prominenceStates: [{}, {}, {}], prominenceUniform: { value: new Float32Array(12) },
    updateOpticalGeometry() {},
    solarSpotStrengthUniform: { value: 0 },
    flareMesh: { material: { uniforms: { uTime: { value: 0 } } } },
  });
  scene.setGeoState(options.geoState);
  return scene;
}

test('actual solar methods use forecast noon only for colour while rotation, spots and flare keep advancing on live UTC', async () => {
  const h = await solarContextHarness();
  let liveUtc = Date.parse('2026-11-04T21:39:00Z');
  const appearanceTimeMs = Date.parse('2026-11-07T11:00:00Z');
  const geoState = { latitude: 51.2, longitude: 6.8, timeMs: liveUtc };
  const appearances = [];
  const scene = solarScene(h, { getTimeMs: () => liveUtc, geoState: { ...geoState, appearanceTimeMs },
    onAppearanceChange: appearance => appearances.push(appearance) });
  const preview = solarScene(h, { getTimeMs: () => liveUtc, geoState });
  const expectedElevation = h.elevation(appearanceTimeMs, geoState.latitude, geoState.longitude);
  const liveElevation = () => h.elevation(liveUtc, geoState.latitude, geoState.longitude);
  const assertLiveMotion = () => {
    assert.equal(scene.sunMesh.rotation.y, h.angle(liveUtc));
    assert.equal(scene.solarDaysUniform.value, (liveUtc - h.epoch) / 86400000);
    assert.equal(scene.flareMesh.material.uniforms.uTime.value, ((liveUtc % 86400000) + 86400000) % 86400000 / 1000);
  };
  scene.updateAnimation(scene.getTimeMs());
  preview.updateAnimation(preview.getTimeMs());
  assert.ok(expectedElevation > 12 && liveElevation() < 0, 'the fixture must distinguish forecast daytime from the actual night');
  assertLiveMotion();
  assert.equal(scene.solarColorUniform, scene.solarSurfaceColorUniform, 'rays and photosphere use the same calibrated current palette');
  assert.deepEqual(scene.solarColorUniform.value, h.surfaceColor(expectedElevation));
  assert.deepEqual(scene.solarSurfaceColorUniform.value, h.surfaceColor(expectedElevation));
  assert.deepEqual(preview.solarColorUniform.value, h.surfaceColor(liveElevation()), 'the current preview keeps its live phase');
  assert.notDeepEqual(scene.solarColorUniform.value, preview.solarColorUniform.value);
  assert.equal(appearances.at(-1).elevationDeg, expectedElevation);
  const expectedGlow = Object.values(h.surfaceColor(expectedElevation)).map(channel => Math.round(255 *
    (channel <= .0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - .055))).join(' ');
  assert.equal(appearances.at(-1).glowRgb, expectedGlow, 'CSS glow follows the same representative daylight palette as the photosphere');
  const blue = h.surfaceColor(expectedElevation).b;
  const srgbBlue = blue <= .0031308 ? blue * 12.92 : 1.055 * blue ** (1 / 2.4) - .055;
  const recoveryWarmth = Math.max(0, Math.min(1, (1 - srgbBlue) / .93));
  assert.equal(Number(appearances.at(-1).recoveryFilter.match(/sepia\(([\d.]+)\)/)[1]), Number(recoveryWarmth.toFixed(3)), 'forecast recovery uses the same calibrated cream daylight as its actual surface');
  const firstRotation = scene.sunMesh.rotation.y;
  const firstFlareTime = scene.flareMesh.material.uniforms.uTime.value;
  const colorUniform = scene.solarColorUniform;
  const surfaceUniform = scene.solarSurfaceColorUniform;
  liveUtc += 20000;
  scene.updateAnimation(scene.getTimeMs());
  assertLiveMotion();
  assert.notEqual(scene.sunMesh.rotation.y, firstRotation);
  assert.equal(scene.flareMesh.material.uniforms.uTime.value, firstFlareTime + 20, 'forecast selection must not freeze optical animation');
  assert.deepEqual(scene.solarColorUniform.value, h.surfaceColor(expectedElevation));
  assert.equal(scene.solarColorUniform, colorUniform);
  assert.equal(scene.solarSurfaceColorUniform, surfaceUniform);
  scene.setGeoState(geoState);
  assert.equal(scene.geoState.appearanceTimeMs, null, 'returning to Now must clear the previous daily appearance sample');
  h.finishBlend();
  scene.updateAnimation(scene.getTimeMs());
  assertLiveMotion();
  for (const channel of ['r', 'g', 'b']) {
    assert.ok(Math.abs(scene.solarColorUniform.value[channel] - h.surfaceColor(liveElevation())[channel]) < 1e-12,
      'the completed interpolation must settle to the live palette within floating-point arithmetic');
    assert.ok(Math.abs(scene.solarSurfaceColorUniform.value[channel] - h.surfaceColor(liveElevation())[channel]) < 1e-12);
  }
  assert.equal(appearances.at(-1).elevationDeg, liveElevation());
});

test('solar appearance override accepts epoch zero but clears invalid samples instead of retaining a previous forecast', async () => {
  const h = await solarContextHarness();
  const liveUtc = Date.parse('2026-11-04T21:39:00Z');
  const scene = solarScene(h, { getTimeMs: () => liveUtc, geoState: { latitude: 0, longitude: 0, appearanceTimeMs: 0 } });
  assert.equal(scene.geoState.appearanceTimeMs, 0);
  assert.deepEqual(scene.solarColorUniform.value, h.surfaceColor(h.elevation(0, 0, 0)));
  for (const invalid of [undefined, null, NaN, Infinity, String(liveUtc)]) {
    scene.setGeoState({ appearanceTimeMs: liveUtc + 43200000 });
    scene.setGeoState({ appearanceTimeMs: invalid });
    assert.equal(scene.geoState.appearanceTimeMs, null, String(invalid));
    h.finishBlend(); scene.updateAnimation(scene.getTimeMs());
    assert.deepEqual(scene.solarColorUniform.value, h.surfaceColor(h.elevation(liveUtc, 0, 0)), String(invalid));
  }
});
