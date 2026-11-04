import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import postcss from 'postcss';
import { createWeatherController, createRetryableModuleLoader, createRecoverableScene, WEATHER_REFRESH_INTERVAL_MS, HEADER_WEATHER_RECOVERY_STYLES, resolveWeatherLocationNotice, resolveWeatherSceneFallback, renderWeatherSceneFallback, resolveForecastCloudCover, buildForecastSlots, hasCompleteForecast } from '../3d-weather-codrops-main/src/weather-lifecycle.mjs';

test('the complete authored weather module graph shares the shell cache revision', async () => {
  const shell = await readFile(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8');
  const version = shell.match(/WEATHER_WIDGET_ASSET_VERSION = '([^']+)'/)[1];
  for (const name of ['header-preview', 'header-dropdown', 'widget', 'scene']) {
    const source = await readFile(new URL(`../3d-weather-codrops-main/src/${name}.mjs`, import.meta.url), 'utf8');
    const dependencies = [...source.matchAll(/['"]\.\/(weather-service|weather-lifecycle|scene)\.mjs([^'"]*)['"]/g)];
    assert.equal(dependencies.length, name === 'scene' ? 1 : 3, name);
    for (const [, dependency, query] of dependencies) {
      assert.equal(new URLSearchParams(query.slice(1)).get('v'), version, `${name} -> ${dependency}`);
    }
  }
});

const sourceDirectory = new URL('../3d-weather-codrops-main/src/', import.meta.url);
const payload = (name, timeMs = Date.now()) => {
  const dates = Array.from({ length: 4 }, (_, index) => new Date(timeMs + index * 86400000).toISOString().slice(0, 10));
  return {
    current: { temp_c: 7 }, location: { name, tz_id: 'UTC', localtime: `${dates[0]} 00:00` },
    forecast: { forecastday: dates.map((date, index) => ({ date, day: { maxtemp_c: 9 + index, mintemp_c: 4 + index, condition: { code: 1000, text: 'Clear' } } })) },
  };
};
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const settle = () => new Promise(resolve => setImmediate(resolve));

async function solarAtmosphereHarness() {
  const source = await readFile(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8');
  const names = ['getHeaderWeatherFiniteNumber', 'getHeaderWeatherCloudCover', 'getHeaderWeatherConditionCode', 'resolveHeaderWeatherOrbAtmosphere', 'applyHeaderWeatherOrbAtmosphere'];
  const declarations = names.map(name => {
    const declaration = source.match(new RegExp(`  function ${name}\\([^]*?\\n  \\}`));
    assert.ok(declaration, name);
    return declaration[0];
  }).join('\n');
  return new Function('clampHeaderWeatherValue', 'getHeaderWeatherConditionText', 'HEADER_WEATHER_CLOUDS_ENABLED', `${declarations}; return { resolveHeaderWeatherOrbAtmosphere, applyHeaderWeatherOrbAtmosphere };`)(
    (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value)), host => (host.text || '').toLowerCase(), false
  );
}

test('live cloud cover monotonically attenuates the complete solar light even when the condition label disagrees', async () => {
  const { resolveHeaderWeatherOrbAtmosphere: resolve } = await solarAtmosphereHarness();
  let previous = 1;
  for (let cloudCover = 0; cloudCover <= 100; cloudCover += 1) {
    const atmosphere = resolve({ __weatherCurrentMeta: { cloudCover, weatherCode: 1000 }, text: 'Sunny' });
    assert.ok(atmosphere.sunTransmission >= 0 && atmosphere.sunTransmission <= previous, `cover ${cloudCover}`);
    previous = atmosphere.sunTransmission;
  }
  for (const [cloudCover, minimum, maximum] of [[0, 0.999, 1], [80, 0.05, 0.1], [90, 0.02, 0.04], [100, 0.01, 0.02]]) {
    const transmission = resolve({ __weatherCurrentMeta: { cloudCover, weatherCode: 3 }, text: 'Overcast' }).sunTransmission;
    assert.ok(transmission >= minimum && transmission <= maximum, `${cloudCover}% cover -> ${transmission}`);
  }
});

test('unknown cloud cover uses weather codes or localized labels while observed zero remains authoritative', async () => {
  const { resolveHeaderWeatherOrbAtmosphere: resolve } = await solarAtmosphereHarness();
  for (const code of [3, 1009, 45, 48, 1030, 61, 95, 1183]) {
    assert.ok(resolve({ __weatherCurrentMeta: { cloudCover: null, weatherCode: code } }).sunTransmission < 0.03, `code ${code}`);
  }
  for (const text of ['Overcast', 'Bedeckt', 'Пасмурно', 'Похмуро', 'Rain', 'Regen', 'Дождь', 'Дощ', 'Fog', 'Nebel', 'Туман']) {
    assert.ok(resolve({ text }).sunTransmission < 0.03, text);
  }
  const observedClear = resolve({ __weatherCurrentMeta: { cloudCover: 0, weatherCode: 3 }, dataset: { weatherCloud: '100' }, text: 'Overcast' });
  assert.equal(observedClear.sunTransmission, 1);
  assert.equal(resolve({ __weatherCurrentMeta: { cloudCover: null, weatherCode: 0 } }).sunTransmission, 1);
});

test('solar transmission reaches both orb variants and never attenuates the Moon', async () => {
  const { applyHeaderWeatherOrbAtmosphere: apply } = await solarAtmosphereHarness();
  for (const variant of ['preview', 'dropdown']) {
    const classes = new Set([`weather-orb-overlay--${variant}`, 'is-sun']);
    const values = new Map();
    const overlay = {
      classList: { contains: value => classes.has(value), remove: value => classes.delete(value), toggle: (value, enabled) => enabled ? classes.add(value) : classes.delete(value) },
      style: { setProperty: (key, value) => values.set(key, value), removeProperty: key => values.delete(key) },
    };
    apply(overlay, { alpha: 0, sunTransmission: 0.02485 });
    assert.equal(values.get('--orb-sun-transmission'), '0.025');
    apply(overlay, { alpha: 0, sunTransmission: 0 });
    assert.equal(values.get('--orb-sun-transmission'), '0.000', 'zero transmission cannot fall back to one');
    classes.delete('is-sun');
    classes.add('is-moon');
    apply(overlay, { alpha: 0.4, sunTransmission: 0.015 });
    assert.equal(values.has('--orb-sun-transmission'), false);
  }
});

test('selected forecast solar atmosphere is independent of current cloud cover without changing the live data', async () => {
  const { resolveHeaderWeatherOrbAtmosphere: resolve } = await solarAtmosphereHarness();
  const current = { __weatherCurrentMeta: { cloudCover: 100, weatherCode: 3 }, text: 'Overcast' };
  const before = JSON.stringify(current);
  assert.equal(resolve(current).sunTransmission, 0.015);
  assert.equal(resolve(current, { condition: { code: 1000, text: 'Sunny' } }).sunTransmission, 1);
  assert.ok(resolve(current, { condition: { code: 1009, text: 'Overcast' } }).sunTransmission < 0.03);
  assert.equal(resolve(current, { cloud: 0, condition: { code: 1009 } }).sunTransmission, 1, 'measured forecast zero is retained');
  assert.equal(resolve(current, { avgcloud: 100, condition: { code: 1000 } }).sunTransmission, 0.015, 'forecast cloud cover wins over its condition label');
  assert.equal(JSON.stringify(current), before, 'forecast presentation cannot mutate current observations or text');
});

test('forecast cloud observations preserve zero, prefer day data and average only valid hourly observations', () => {
  assert.equal(resolveForecastCloudCover({ day: { cloud: 0, avgcloud: 80 }, hour: [{ cloud: 100 }] }), 0);
  assert.equal(resolveForecastCloudCover({ day: { avgcloud: 80 } }), 80);
  assert.equal(resolveForecastCloudCover({ day: {}, hour: [{ cloud: 0 }, { cloud: 80 }, { cloud: null }, { cloud: '' }, { cloud: 'invalid' }] }), 40);
  assert.equal(resolveForecastCloudCover({ day: { condition: { code: 1009 } }, hour: [{ cloud: null }] }), null, 'conditions are not cloud measurements');
});

test('all forecast scene projections stop inheriting current cloud cover', async () => {
  for (const entry of ['header-preview', 'header-dropdown', 'widget']) {
    const source = await readFile(new URL(`../3d-weather-codrops-main/src/${entry}.mjs`, import.meta.url), 'utf8');
    const declaration = source.match(/weatherForForecastDay = ([^]*?),\n  weatherStatistics =/);
    assert.ok(declaration, entry);
    const project = new Function('resolveForecastCloudCover', `return (${declaration[1]});`)(resolveForecastCloudCover);
    const current = { current: { cloud: 100, condition: { code: 1009 } }, location: { localtime: '2026-11-04 10:00' } };
    const clearDay = { date: '2026-11-05', day: { avgtemp_c: 12, condition: { code: 1000 } } };
    assert.equal(project(current, clearDay).current.cloud, null, entry);
    assert.equal(project(current, { ...clearDay, day: { ...clearDay.day, cloud: 0 } }).current.cloud, 0, entry);
    assert.equal(project(current, { ...clearDay, day: { ...clearDay.day, avgcloud: 80 } }).current.cloud, 80, entry);
    assert.equal(project(current, { ...clearDay, hour: [{ cloud: 20 }, { cloud: 80 }] }).current.cloud, 50, entry);
    assert.equal(current.current.cloud, 100, 'current measurements are untouched');
  }
});

test('the dropdown selects its forecast atmosphere through the mounted pure helper and keeps preview observations intact', async () => {
  const source = await readFile(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8');
  const declaration = source.match(/  function resolveHeaderWeatherDropdownAtmosphere\([^]*?\n  \}/);
  assert.ok(declaration);
  const { resolveHeaderWeatherOrbAtmosphere: resolve, applyHeaderWeatherOrbAtmosphere: apply } = await solarAtmosphereHarness();
  const selectAtmosphere = new Function('resolveHeaderWeatherOrbAtmosphere', `${declaration[0]}; return resolveHeaderWeatherDropdownAtmosphere;`)(resolve);
  const current = { __weatherCurrentMeta: { cloudCover: 100, weatherCode: 3 }, text: 'Overcast' };
  const days = [null, { date: '2026-11-04', day: { maxtemp_c: null, mintemp_c: 3, cloud: 100 } }, { date: '2026-11-05', day: { maxtemp_c: 8, mintemp_c: 3, condition: { code: 1009 } } }, { date: '2026-11-06', day: { maxtemp_c: 10, mintemp_c: 4, condition: { code: 1000 } }, hour: [{ cloud: 20 }, { cloud: 80 }] }, { date: '2026-11-04', day: { maxtemp_c: 9, mintemp_c: 3, condition: { code: 1000 } } }];
  current.__weatherWidgetInstance = {
    getState: () => ({ weather: { current: { temp_c: 7 }, forecast: { forecastday: days } } }),
    getForecastCloudCover: resolveForecastCloudCover,
    getForecastSlots: data => buildForecastSlots(data, Date.parse('2026-11-04T12:00:00Z')),
  };
  const pills = [{}, ...['2026-11-04', '2026-11-05', '2026-11-06'].map(forecastDate => ({ dataset: { forecastDate } }))];
  let selected = pills[0];
  const dropdown = { querySelectorAll: () => pills, querySelector: () => selected };
  current.shadowRoot = { querySelector: () => dropdown };
  const observations = resolve(current);
  assert.equal(selectAtmosphere(current, observations), observations, 'Now reuses live observations');
  selected = pills[1];
  assert.equal(selectAtmosphere(current, observations).sunTransmission, 1, 'clear forecast does not inherit current 100% cloud');
  selected = pills[2];
  assert.ok(selectAtmosphere(current, observations).sunTransmission < 0.03);
  selected = pills[3];
  assert.equal(selectAtmosphere(current, observations).sunTransmission, 0.26125, 'hourly average drives the same solar model');
  selected = { dataset: { forecastDate: '2026-11-07' }, disabled: true };
  assert.equal(selectAtmosphere(current, observations), observations, 'an unavailable slot never projects invented forecast weather');
  assert.equal(current.__weatherCurrentMeta.cloudCover, 100);
  assert.equal(current.text, 'Overcast');
  const syncDeclaration = source.match(/  function syncHeaderWeatherDropdownAtmosphere\([^]*?\n  \}/);
  assert.ok(syncDeclaration);
  const sync = new Function('resolveHeaderWeatherOrbAtmosphere', 'resolveHeaderWeatherDropdownAtmosphere', 'applyHeaderWeatherOrbAtmosphere', `${syncDeclaration[0]}; return syncHeaderWeatherDropdownAtmosphere;`)(resolve, selectAtmosphere, apply);
  const values = new Map();
  const sun = {
    classList: { contains: name => name === 'is-sun', remove() {}, toggle() {} },
    style: { setProperty: (key, value) => values.set(key, value), removeProperty: key => values.delete(key) },
  };
  current.isConnected = true;
  current.dataset = { weatherMounted: 'true' };
  current.__weatherOrbAtmosphere = observations;
  current.shadowRoot.querySelector = selector => selector.endsWith('.is-sun') ? sun : dropdown;
  selected = pills[0];
  sync(current);
  assert.equal(values.get('--orb-sun-transmission'), '0.015');
  selected = pills[1];
  sync(current);
  assert.equal(values.get('--orb-sun-transmission'), '1.000', 'the existing solar DOM is updated synchronously');
  selected = pills[2];
  sync(current);
  assert.ok(Number(values.get('--orb-sun-transmission')) < 0.03);
});

test('forecast class changes immediately update solar atmosphere through the existing observed lifecycle', async () => {
  const source = await readFile(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8');
  const start = source.indexOf('    const observer = new MutationObserver', source.indexOf('  function bindHeaderWeatherState('));
  const marker = '    host.__weatherStateObserver = observer;';
  const end = source.indexOf(marker, start) + marker.length;
  assert.ok(start > 0 && end > start);
  const calls = [];
  let callback;
  let observed;
  class Observer {
    constructor(handler) { callback = handler; }
    observe(target, options) { observed = { target, options }; }
  }
  const host = { shadowRoot: {} };
  const names = ['applyHeaderWeatherPressureCopy', 'syncHeaderWeatherExpandedState', 'syncHeaderWeatherToggleArrow', 'scheduleHeaderWeatherOrbSync', 'scheduleHeaderWeatherReadingsSync', 'syncHeaderWeatherAttribution', 'applyHeaderWeatherLocationSearchCopy', 'bindHeaderWeatherDropdownScrollState', 'scheduleHeaderWeatherAreaLocationLabelRestore', 'syncHeaderWeatherDropdownAtmosphere'];
  const functions = Object.fromEntries(names.map(name => [name, () => calls.push(name)]));
  new Function('environment', `const { host, MutationObserver, ${names.join(', ')} } = environment; ${source.slice(start, end)}`)({ host, MutationObserver: Observer, ...functions });
  assert.equal(observed.target, host.shadowRoot);
  assert.ok(observed.options.attributeFilter.includes('class'));
  assert.ok(observed.options.attributeFilter.includes('aria-expanded'));
  assert.equal(host.__weatherStateObserver instanceof Observer, true, 'existing unmount cleanup owns this observer');
  callback([{ type: 'attributes', attributeName: 'class', target: { matches: selector => selector === '.weather-header-dropdown__forecast-pill' } }]);
  assert.deepEqual(calls, ['syncHeaderWeatherDropdownAtmosphere', 'scheduleHeaderWeatherOrbSync'], 'the pure update runs before any asynchronous astro refresh');
  calls.length = 0;
  callback([{ type: 'attributes', attributeName: 'class', target: { matches: () => false } }]);
  assert.deepEqual(calls, [], 'solar classes and arrow animations cannot trigger an observer loop');
});

test('weather controller refreshes full data, deduplicates and preserves the last successful payload on failure', async () => {
  const requests = [];
  const controller = createWeatherController({
    initialLocation: { latitude: 51.3, longitude: 12.4 }, now: () => 1234,
    service: { getCurrentWeather(location, options) { const request = deferred(); requests.push({ ...request, location, options }); return request.promise; } },
  });
  const first = controller.refresh();
  assert.equal(controller.refresh(), first);
  await settle();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.forceRefresh, true);
  const weather = payload('Device location');
  requests[0].resolve(weather);
  assert.equal(await first, weather);
  assert.equal(controller.getState().lastUpdatedAt, 1234);
  const failed = controller.refresh();
  await settle();
  requests[1].reject(new Error('Offline'));
  await assert.rejects(failed, /Offline/);
  assert.equal(controller.getState().weather, weather);
  assert.equal(controller.getState().lastUpdatedAt, 1234);
  assert.equal(controller.getState().loading, false);
  const stale = controller.refresh();
  await settle();
  requests[2].resolve({ ...payload('Old cache'), stale: true });
  await assert.rejects(stale, /stale/);
  assert.equal(controller.getState().weather, weather);
  assert.equal(controller.getState().lastUpdatedAt, 1234);
});

test('manual locations win over old requests and disposal prevents late state writes', async () => {
  const requests = [];
  const controller = createWeatherController({ initialLocation: 'Old city', service: {
    getCurrentWeather(location) { const request = deferred(); requests.push({ ...request, location }); return request.promise; },
  } });
  const old = controller.refresh();
  const location = { latitude: 48.1, longitude: 11.6, accuracy: 8 };
  const manual = controller.setLocation(location);
  await settle();
  const selected = payload('Selected city');
  requests[1].resolve(selected);
  assert.equal(await manual, selected);
  requests[0].resolve(payload('Old city'));
  assert.equal(await old, false);
  assert.equal(controller.getState().weather, selected);
  assert.equal(controller.getState().location, location);
  let writes = 0;
  controller.subscribe(() => { writes += 1; });
  const pending = controller.refresh();
  await settle();
  controller.dispose();
  const before = writes;
  requests[2].resolve(payload('Late update'));
  assert.equal(await pending, false);
  assert.equal(writes, before);
  assert.equal(controller.getState().weather, selected);
});

test('a slow device lookup cannot replace a manual choice and stale startup never looks fresh', async () => {
  const geo = deferred();
  const controller = createWeatherController({ useGeolocation: true, service: {
    getCurrentLocation: () => geo.promise, getCurrentWeather: async location => payload(location),
  } });
  const initial = controller.refresh();
  const selected = await controller.setLocation('Manual city');
  geo.resolve({ latitude: 1, longitude: 2 });
  assert.equal(await initial, false);
  assert.equal(controller.getState().weather, selected);
  const staleController = createWeatherController({ service: { getCurrentWeather: async () => ({ ...payload('Cache'), stale: true }) } });
  await assert.rejects(staleController.refresh(), /stale/);
  assert.equal(staleController.getState().weather.location.name, 'Cache');
  assert.equal(staleController.getState().lastUpdatedAt, 0);
  assert.equal(WEATHER_REFRESH_INTERVAL_MS, 600000);
});

test('module imports retry with unique URLs and a rejected batch can recover on a later call', async () => {
  const urls = [];
  let broken = true;
  const load = createRetryableModuleLoader('https://site.test/scene.mjs?v=release', async url => {
    urls.push(url);
    if (broken) throw new Error('Network error');
    return { default: 'Scene' };
  }, async () => {});
  await assert.rejects(load(), /Network/);
  assert.equal(urls.length, 3);
  broken = false;
  assert.deepEqual(await load(), { default: 'Scene' });
  assert.equal(new Set(urls).size, 4, 'a browser-cached failed module URL must not be reused');
  assert.equal(new URL(urls[3]).searchParams.get('v'), 'release');
});

test('a managed header requires a real location instead of fetching the default city', async () => {
  let requests = 0;
  const controller = createWeatherController({ requireLocation: true, fallbackLocation: 'Leipzig', service: {
    getCurrentWeather: async () => { requests += 1; return payload('Device'); },
    getCurrentLocation: async () => ({ latitude: 48.1, longitude: 11.6 }),
  } });
  await assert.rejects(controller.refresh(), /location is required/);
  assert.equal(requests, 0);
  assert.equal(controller.getState().lastUpdatedAt, 0);
  assert.equal(controller.getState().loading, false);
  assert.equal(controller.getState().error, null);
  assert.equal(controller.getState().geoStatus, 'pending');
  await controller.currentLocation();
  assert.equal(requests, 1, 'the existing retry action must actually request device coordinates');
  assert.equal(controller.getState().weather.location.name, 'Device');
});

test('GPS status stays separate from weather failures and resolves into the existing localized notice', async () => {
  const controller = createWeatherController({ requireLocation: true, service: { getCurrentWeather: async () => payload('Device') } });
  const copy = { locationPermissionDenied: 'Denied', locationTimeout: 'Timed out', locationUnavailable: 'Unavailable', loadError: 'Weather error' };
  assert.equal(resolveWeatherLocationNotice(controller.getState(), copy), null);
  for (const [status, expected] of [['denied', 'Denied'], ['timeout', 'Timed out'], ['unavailable', 'Unavailable']]) {
    controller.setLocationStatus({ status });
    assert.equal(resolveWeatherLocationNotice(controller.getState(), copy), expected);
    assert.equal(controller.getState().error, null);
    controller.setLocationStatus({ status: 'pending' });
    assert.equal(resolveWeatherLocationNotice(controller.getState(), copy), null);
  }
  await controller.setLocation({ latitude: 48.1, longitude: 11.6 });
  assert.equal(controller.getState().geoStatus, null);
  controller.dispose();
  controller.setLocationStatus({ status: 'denied' });
  assert.equal(controller.getState().geoStatus, null);
});

test('header status styles contain the notice and do not style or intercept any form controls', () => {
  const css = postcss.parse(HEADER_WEATHER_RECOVERY_STYLES);
  const rules = new Map();
  css.walkRules(rule => rules.set(rule.selector, new Map(rule.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]))));
  const state = [...rules].find(([selector]) => selector.endsWith('.weather-header-state--recovery'))[1];
  assert.equal(state.get('overflow'), 'hidden');
  assert.equal(state.get('height'), '100%');
  assert.equal(state.get('pointer-events'), 'none');
  assert.equal([...rules.keys()].some(selector => selector.includes('weather-location-selector')), false);
  assert.ok([...rules.keys()].filter(selector => selector.includes('weather-header-state')).every(selector => selector.includes(':host([data-weather-variant=\'header\']) .weather-header-preview .weather-header-state--recovery')));
});

test('the visual recovery model uses condition codes across locales and parses local time without Safari Date parsing', () => {
  const weather = (code, text = 'Локализованное условие', is_day) => ({ current: { condition: { code, text }, is_day }, location: { localtime: '2026-11-04 21:30' } });
  assert.equal(resolveWeatherSceneFallback(null), null, 'loading must not invent weather');
  for (const [code, kind] of [[1000, 'clear'], [1009, 'cloudy'], [1030, 'foggy'], [1195, 'rainy'], [1225, 'snowy'], [1276, 'stormy']]) {
    const model = resolveWeatherSceneFallback(weather(code));
    assert.equal(model.kind, kind);
    assert.equal(model.night, true);
    assert.equal(model.clouds, kind !== 'clear');
  }
  assert.equal(resolveWeatherSceneFallback(weather(1000, 'Clear', 1)).night, false, 'API day/night wins over the clock');
  assert.equal(resolveWeatherSceneFallback(weather(1000, 'Clear', '0')).night, true);
  assert.equal(resolveWeatherSceneFallback(weather(1003)).orb, true, 'partly cloudy keeps the celestial body');
  assert.equal(resolveWeatherSceneFallback(weather(undefined, 'Light rain', 1)).kind, 'rainy');
});

test('recovery renders current weather without controls and retains only one header celestial overlay', () => {
  const jsx = (type, props, key) => ({ type, props, key });
  const loading = { type: 'sonar' };
  assert.equal(renderWeatherSceneFallback(jsx, {}, loading), loading);
  const weatherData = { current: { condition: { code: 1003 }, is_day: 1 } };
  const header = renderWeatherSceneFallback(jsx, { weatherData, embedded: true, variant: 'header-panel' }, loading);
  assert.equal(header.props['aria-hidden'], true);
  assert.equal(header.props.children.length, 1);
  assert.equal(header.props.children[0].key, 'clouds');
  assert.equal(header.props.children[0].props.children.length, 3);
  const standalone = renderWeatherSceneFallback(jsx, { weatherData, variant: 'default' }, loading);
  assert.deepEqual(standalone.props.children.map(child => child.key), ['orb', 'clouds']);
  weatherData.current.condition.code = 1195;
  const rain = renderWeatherSceneFallback(jsx, { weatherData }, loading);
  assert.deepEqual(rain.props.children.map(child => child.key), ['clouds', 'precipitation']);
  assert.equal(rain.props['data-weather-fallback-kind'], 'rainy');
  assert.equal(rain.props.children.some(child => ['button', 'input', 'a'].includes(child.type)), false);
  const css = postcss.parse(HEADER_WEATHER_RECOVERY_STYLES);
  const keyframes = [];
  css.walkAtRules('keyframes', rule => keyframes.push(rule.params));
  for (const effect of ['CloudDrift', 'Rain', 'Snow', 'Lightning', 'OrbGlow']) assert.ok(keyframes.includes(`weatherRecovery${effect}`));
  assert.match(HEADER_WEATHER_RECOVERY_STYLES, /url\('\/assets\/images\/weather\/cloud-9225a9f1\.png'\)/);
});

for (const filename of ['header-preview.mjs', 'header-dropdown.mjs', 'widget.mjs']) {
  for (const locale of ['de', 'en', 'ru', 'uk']) {
    test(`${filename}/${locale}: initial GPS uses sonar and terminal failures recover through the existing dropdown`, async () => {
      const source = await readFile(new URL(filename, sourceDirectory), 'utf8');
      const start = source.indexOf('function WeatherApp(');
      const end = source.indexOf('\nvar ReactDOM', start);
      const copyStart = source.indexOf('  localeCopy = ') + '  localeCopy = '.length;
      const copyEnd = source.indexOf(',\n  conditionCodeLabels = ', copyStart);
      const copy = new Function(`return (${source.slice(copyStart, copyEnd)});`)();
      const states = [];
      const refs = [];
      const effects = [];
      let stateIndex;
      let refIndex;
      let registerEffects = true;
      const React = {
        useState(initial) {
          const index = stateIndex++;
          if (!(index in states)) states[index] = initial;
          return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
        },
        useRef(initial) { const index = refIndex++; return refs[index] ||= { current: initial }; },
        useEffect: effect => { if (registerEffects) effects.push(effect); },
        useMemo: factory => factory(),
      };
      let requests = 0;
      const controller = createWeatherController({ requireLocation: true, locale, service: { getCurrentWeather: async () => {
        requests += 1;
        return {
          ...payload('Device'), location: { name: 'Device', localtime: '2026-11-03 08:00' },
          current: { temp_c: 7, feelslike_c: 6, wind_kph: 3, humidity: 70, condition: { text: 'Cloudy', code: 1006 } },
          forecast: { forecastday: [{ date: '2026-11-03', day: { maxtemp_c: 9, mintemp_c: 4, condition: { text: 'Cloudy' } } }] },
        };
      } } });
      const jsx = (type, props) => ({ type, props });
      const App = new Function('React', 'jsxRuntime', 'localeCopy', 'resolveWeatherLocationNotice', 'Scene3D', 'LocationSearch', 'weatherForForecastDay', 'weatherStatistics', 'translateCondition', 'formatRegion', 'formatLocation', 'formatLocalTime', 'formatForecastDate', 'buildForecastSlots', `return (${source.slice(start, end)});`)(
        React, { jsx, jsxs: jsx, Fragment: 'Fragment' }, copy, resolveWeatherLocationNotice, 'Scene', 'Search', value => value,
        () => [], () => 'Cloudy', () => '', location => location.name, () => '08:00', value => value, buildForecastSlots
      );
      const render = () => {
        stateIndex = 0; refIndex = 0;
        return App({ embedded: true, variant: 'header', locale, fallbackLocation: '', useGeolocation: false, managedRefresh: true, runtimeController: controller });
      };
      const find = (tree, predicate) => {
        if (!tree || typeof tree !== 'object') return null;
        if (predicate(tree)) return tree;
        for (const child of [tree.props?.children].flat(Infinity)) { const found = find(child, predicate); if (found) return found; }
        return null;
      };
      const previousWindow = globalThis.window;
      globalThis.window = { addEventListener() {}, removeEventListener() {} };
      try {
        render();
        const cleanups = effects.map(effect => effect());
        registerEffects = false;
        await settle();
        let tree = render();
        assert.equal(requests, 0, 'no default-city request may run while the shell is acquiring GPS');
        assert.equal(controller.getState().error, null);
        assert.equal(find(tree, node => node.props?.className === 'weather-header-state__notice').props.children, copy[locale].locating);
        assert.equal(find(tree, node => node.type === 'Search'), null, 'pending front header must contain no search or GPS form');
        assert.ok(find(tree, node => node.props?.className === 'weather-header-state__spinner'), 'the existing spinner marker must activate the existing sonar');
        for (const [status, key] of [['denied', 'locationDeniedStatus'], ['timeout', 'locationTimeoutStatus'], ['unavailable', 'locationUnavailableStatus']]) {
          controller.setLocationStatus({ status });
          tree = render();
          assert.equal(find(tree, node => node.props?.className === 'weather-header-state__notice').props.children, copy[locale][key]);
          assert.ok(find(tree, node => node.props?.className?.includes('weather-header-state--recovery')));
          assert.equal(find(tree, node => node.type === 'Search'), null, 'terminal status must not add a front header form');
          const recoveryTrigger = find(tree, node => node.props?.className?.startsWith('weather-header-trigger'));
          assert.ok(recoveryTrigger, 'the existing weather menu must remain reachable before the first successful weather load');
          assert.equal(recoveryTrigger.props['aria-expanded'], false);
          assert.equal(recoveryTrigger.props['aria-label'], copy[locale].openDetails);
          recoveryTrigger.props.onClick();
          tree = render();
          const selector = find(tree, node => node.type === 'Search');
          assert.ok(selector, 'the same dropdown search and GPS selector must recover a terminal location failure');
          assert.equal(selector.props.isLoading, false, 'terminal status must not leave search or GPS disabled');
          assert.equal(selector.props.copy.currentLocation, copy[locale].currentLocation);
          for (const className of ['weather-header-dropdown__hero', 'weather-header-dropdown__forecast-list', 'weather-header-dropdown__details-head', 'weather-header-dropdown__details-grid']) {
            assert.equal(find(tree, node => node.props?.className === className), null, `${className} needs real weather data`);
          }
          const close = find(tree, node => node.props?.className === 'weather-header-dropdown__close');
          assert.ok(close, 'the existing close control remains available without a weather hero');
          assert.equal(close.props['aria-label'], copy[locale].closeDetails);
          controller.setLocationStatus({ status: 'pending' });
          tree = render();
          assert.equal(find(tree, node => node.type === 'Search'), null, 'a new location attempt collapses the menu back to sonar');
          assert.equal(find(tree, node => node.props?.className?.startsWith('weather-header-trigger')), null);
          assert.ok(find(tree, node => node.props?.className === 'weather-header-state__spinner'));
        }
        assert.equal(requests, 0, 'terminal GPS statuses must not fabricate weather for a fallback city');
        controller.setLocationStatus({ status: 'denied' });
        tree = render();
        find(tree, node => node.props?.className?.startsWith('weather-header-trigger')).props.onClick();
        tree = render();
        find(tree, node => node.props?.className === 'weather-header-dropdown__close').props.onClick();
        tree = render();
        assert.equal(find(tree, node => node.type === 'Search'), null, 'the close action works before any weather has loaded');
        find(tree, node => node.props?.className?.startsWith('weather-header-trigger')).props.onClick();
        tree = render();
        const manual = find(tree, node => node.type === 'Search').props.onLocationChange('Selected city');
        tree = render();
        assert.equal(find(tree, node => node.type === 'Search'), null, 'weather loading also collapses the initial recovery dropdown');
        assert.ok(find(tree, node => node.props?.className === 'weather-header-state__spinner'));
        await manual;
        assert.equal(controller.getState().location, 'Selected city');
        tree = render();
        const trigger = find(tree, node => node.props?.className?.startsWith('weather-header-trigger'));
        assert.ok(trigger);
        trigger.props.onClick();
        tree = render();
        assert.ok(find(tree, node => node.type === 'Search'), 'the loaded full dropdown keeps its existing location selector');
        for (const className of ['weather-header-dropdown__hero', 'weather-header-dropdown__forecast-list', 'weather-header-dropdown__details-head', 'weather-header-dropdown__details-grid']) {
          assert.ok(find(tree, node => node.props?.className === className), `${className} is retained after successful weather loading`);
        }
        assert.equal(find(tree, node => node.props?.className?.includes('weather-header-state--recovery')), null);
        for (const cleanup of cleanups) cleanup?.();
      } finally {
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        controller.dispose();
      }
    });
  }

  test(`${filename}: mounted API refreshes complete payloads and changes location without remounting`, async () => {
    const source = await readFile(new URL(filename, sourceDirectory), 'utf8');
    const marker = '  mountWeatherWidget = ';
    const start = source.indexOf(marker) + marker.length;
    const end = source.indexOf(',\n  unmountWeatherWidget = ', start);
    assert.ok(start >= marker.length && end > start);
    let renders = 0;
    let disposed = 0;
    let rendered;
    const calls = [];
    const host = { dataset: {}, shadowRoot: {} };
    const root = { render: tree => { renders += 1; rendered = tree; }, unmount: () => { disposed += 1; } };
    const mount = new Function('createWeatherController', 'weatherService', 'resolveHost', 'prepareShadowRoot', 'mountedWidgets', 'ReactDOM', 'jsxRuntime', 'React', 'WeatherApp', 'resolveForecastCloudCover', 'buildForecastSlots', `return (${source.slice(start, end)});`)(
      createWeatherController,
      { getCurrentWeather: async (location, options) => { calls.push({ location, options }); return payload(String(calls.length)); } },
      () => host, () => ({}), new WeakMap(), { createRoot: () => root },
      { jsx: (type, props) => ({ type, props }) }, { StrictMode: 'StrictMode' }, () => {}, resolveForecastCloudCover, buildForecastSlots
    );
    const initial = { latitude: 48.1, longitude: 11.6 };
    const api = mount(host, { initialLocation: initial, managedRefresh: true });
    assert.equal(api.getForecastCloudCover, resolveForecastCloudCover, 'mounted consumers share the exact pure forecast cloud resolver');
    assert.equal(api.getForecastSlots, buildForecastSlots, 'the shell and cards must resolve the same valid forecast day');
    assert.equal(rendered.props.children.props.managedRefresh, true);
    assert.equal(api.getState().lastUpdatedAt, 0, 'mount itself is not evidence of fresh weather');
    const full = await api.refresh();
    assert.equal(full.forecast.forecastday.length, 4);
    assert.equal(api.getState().weather, full);
    assert.equal(calls[0].location, initial);
    const manual = { latitude: 50.2, longitude: 8.7 };
    const next = await api.setLocation(manual);
    assert.equal(api.getState().weather, next);
    assert.equal(api.getState().location, manual);
    assert.equal(calls[1].location, manual);
    assert.equal(renders, 1, 'location changes must preserve the mounted dropdown state');
    api.unmount();
    assert.equal(disposed, 1);
    await assert.rejects(api.refresh(), /unmounted/);
  });

  test(`${filename}: the existing location button requests fresh GPS and never falls back to IP`, async () => {
    const source = await readFile(new URL(filename, sourceDirectory), 'utf8');
    const marker = '  LocationSearch = ';
    const start = source.indexOf(marker) + marker.length;
    const end = source.indexOf(',\n  installModulePreloadPolyfill = ', start);
    let success;
    let failure;
    let options;
    let writes = 0;
    let ipRequests = 0;
    const effects = [];
    const React = {
      useState: value => [value, () => { writes += 1; }], useRef: value => ({ current: value }),
      useEffect: effect => effects.push(effect),
    };
    const changes = [];
    const errors = [];
    const jsx = (type, props) => ({ type, props });
    const Search = new Function('React', 'jsxRuntime', 'weatherService', 'window', 'navigator', 'console', `return (${source.slice(start, end)});`)(
      React, { jsx, jsxs: jsx }, { getApproximateLocationByIp: () => { ipRequests += 1; throw Error('Must not use IP'); } },
      { isSecureContext: true }, { geolocation: { getCurrentPosition: (yes, no, settings) => { success = yes; failure = no; options = settings; } } }, { error() {} }
    );
    const tree = Search({ onLocationChange: value => changes.push(value), onLocationError: value => errors.push(value), isLoading: false, compact: true, copy: { locationPermissionDenied: 'Denied' } });
    const find = node => {
      if (!node || typeof node !== 'object') return null;
      if (node.type === 'button' && node.props.className?.includes('weather-location-selector__current')) return node;
      for (const child of [node.props?.children].flat(Infinity)) { const found = find(child); if (found) return found; }
      return null;
    };
    const current = find(tree);
    assert.ok(current, 'the existing GPS control must remain reachable');
    assert.equal(current.props.disabled, false, 'a terminal location notice must allow a fresh GPS attempt');
    const cleanup = effects[0]();
    const request = current.props.onClick();
    assert.equal(options.enableHighAccuracy, true);
    assert.equal(options.maximumAge, 0);
    success({ coords: { latitude: 48.1, longitude: 11.6 } });
    await request;
    assert.deepEqual(changes, [{ latitude: 48.1, longitude: 11.6 }]);
    const denied = current.props.onClick();
    failure({ code: 1 });
    await denied;
    assert.deepEqual(errors, ['Denied']);
    assert.equal(ipRequests, 0);
    const unmounted = current.props.onClick();
    cleanup();
    const before = writes;
    success({ coords: { latitude: 1, longitude: 2 } });
    await unmounted;
    assert.equal(writes, before, 'late GPS results must not update an unmounted selector');
    assert.equal(changes.length, 1);
  });
}

test('service cache is fresh for ten minutes and stale fallback never gains a new timestamp', async () => {
  const source = await readFile(new URL('weather-service.mjs', sourceDirectory), 'utf8');
  const marker = '    getCurrentWeather: ';
  const start = source.indexOf(marker) + marker.length;
  const end = source.indexOf(',\n    searchLocations:', start);
  let clock = 1000000;
  let calls = 0;
  let offline = false;
  const storage = new Map();
  const weather = payload('Actual location', clock);
  const getWeather = new Function('Pn', 'Z', 'localStorage', 'Date', 'un', 'qn', 'Wn', 'pn', 'Jn', 'Yn', 'kn', 'On', 'X', 'hasCompleteForecast', `return (${source.slice(start, end)});`)(
    query => ({ query }), value => value || 'en',
    { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) }, { now: () => clock }, true,
    async () => { calls += 1; if (offline) throw Error('Offline'); return weather; }, async value => value,
    false, null, null, () => false, () => false, () => Error('Unavailable'), hasCompleteForecast
  );
  await getWeather('48.1,11.6');
  const saved = [...storage.values()][0];
  assert.deepEqual(JSON.parse(saved).data.forecast, weather.forecast);
  assert.equal(JSON.parse(saved).expiresAt - JSON.parse(saved).savedAt, 600000);
  clock += 599999;
  assert.equal((await getWeather('48.1,11.6')).stale, false);
  assert.equal(calls, 1);
  await getWeather('48.1,11.6', { forceRefresh: true });
  assert.equal(calls, 2, 'explicit refresh must bypass a fresh local cache');
  const lastSaved = [...storage.values()][0];
  clock += 600001;
  offline = true;
  assert.equal((await getWeather('48.1,11.6')).stale, true);
  assert.equal([...storage.values()][0], lastSaved);
  clock += 172800000;
  await assert.rejects(getWeather('48.1,11.6'), /Offline/);
});

test('partial forecasts update current weather without poisoning the last complete cache and recover on refresh', async () => {
  const source = await readFile(new URL('weather-service.mjs', sourceDirectory), 'utf8');
  const marker = '    getCurrentWeather: ';
  const start = source.indexOf(marker) + marker.length;
  const end = source.indexOf(',\n    searchLocations:', start);
  let clock = Date.parse('2026-11-04T12:00:00Z');
  let response = payload('Current place', clock);
  let offline = false;
  const storage = new Map();
  const getWeather = new Function('Pn', 'Z', 'localStorage', 'Date', 'un', 'qn', 'Wn', 'pn', 'Jn', 'Yn', 'kn', 'On', 'X', 'hasCompleteForecast', `return (${source.slice(start, end)});`)(
    query => ({ query }), value => value || 'en',
    { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) }, { now: () => clock }, true,
    async () => { if (offline) throw Error('Offline'); return response; }, async value => value,
    false, null, null, () => false, () => false, () => Error('Unavailable'), hasCompleteForecast
  );
  await getWeather('48.1,11.6');
  const [key, completeSnapshot] = [...storage.entries()][0];
  assert.ok(key.startsWith('hn_weather_resilience_v2:'));
  const partial = { ...response, current: { temp_c: 11 }, forecast: { forecastday: response.forecast.forecastday.slice(0, 1) }, forecastStatus: 'partial' };
  response = partial;
  const actual = await getWeather('48.1,11.6', { forceRefresh: true });
  assert.equal(actual.current.temp_c, 11, 'fresh current observations remain usable during forecast failure');
  assert.equal(actual.forecast.forecastday.length, 1, 'the service must not manufacture future weather');
  assert.equal(storage.get(key), completeSnapshot, 'partial results cannot replace the complete forecast');
  clock += 30000;
  response = payload('Recovered place', clock);
  const recovered = await getWeather('48.1,11.6', { forceRefresh: true });
  assert.equal(hasCompleteForecast(recovered, clock), true);
  assert.equal(JSON.parse(storage.get(key)).savedAt, clock);
  storage.set(key, JSON.stringify({ savedAt: clock, expiresAt: clock + 600000, data: partial }));
  offline = true;
  await assert.rejects(getWeather('48.1,11.6'), /Offline/, 'even a fresh poisoned cache cannot bless one day as a complete forecast');
});

test('a complete cache saved before midnight retains real remaining days offline without creating the next day', async () => {
  const source = await readFile(new URL('weather-service.mjs', sourceDirectory), 'utf8');
  const marker = '    getCurrentWeather: ';
  const start = source.indexOf(marker) + marker.length;
  const end = source.indexOf(',\n    searchLocations:', start);
  let clock = Date.parse('2026-11-04T23:59:00Z');
  const weather = payload('Same place', clock);
  const storage = new Map();
  let offline = false;
  const getWeather = new Function('Pn', 'Z', 'localStorage', 'Date', 'un', 'qn', 'Wn', 'pn', 'Jn', 'Yn', 'kn', 'On', 'X', 'hasCompleteForecast', `return (${source.slice(start, end)});`)(
    query => ({ query }), value => value || 'en',
    { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) }, { now: () => clock }, true,
    async () => { if (offline) throw Error('Offline'); return weather; }, async value => value,
    false, null, null, () => false, () => false, () => Error('Unavailable'), hasCompleteForecast
  );
  await getWeather('48.1,11.6');
  const [key, saved] = [...storage.entries()][0];
  clock += 120000;
  offline = true;
  const cached = await getWeather('48.1,11.6', { forceRefresh: true });
  assert.equal(cached.stale, true);
  const slots = buildForecastSlots(cached, clock);
  assert.deepEqual(slots.map(day => day.date), ['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
  assert.deepEqual(slots.map(day => day.available), [true, true, true, false]);
  assert.equal(slots[3].day, undefined, 'the new fourth day has no fabricated temperatures');
  assert.equal(storage.get(key), saved);
});

for (const provider of ['same-origin', 'weatherapi']) {
  test(`${provider}: async normalization persists a complete payload that survives reload offline`, async () => {
    const source = await readFile(new URL('weather-service.mjs', sourceDirectory), 'utf8');
    const marker = '    getCurrentWeather: ';
    const start = source.indexOf(marker) + marker.length;
    const end = source.indexOf(',\n    searchLocations:', start);
    const storage = new Map();
    let clock = 1000000;
    const weather = payload('Exact device location', clock);
    let offline = false;
    let requests = 0;
    const request = async () => { requests += 1; if (offline) throw Error('Offline'); return weather; };
    const createService = () => new Function('Pn', 'Z', 'localStorage', 'Date', 'un', 'qn', 'Wn', 'pn', 'Jn', 'Yn', 'kn', 'On', 'X', 'hasCompleteForecast', `return (${source.slice(start, end)});`)(
      query => ({ query }), value => value || 'en',
      { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) }, { now: () => clock },
      provider === 'same-origin', request, async value => { await Promise.resolve(); return { ...value, normalized: true }; },
      provider === 'weatherapi', request, null, () => false, () => false, () => Error('Unavailable'), hasCompleteForecast
    );
    const initial = await createService()('48.1,11.6', { forceRefresh: true });
    assert.equal(initial.normalized, true);
    const [key, serialized] = [...storage.entries()][0];
    const cached = JSON.parse(serialized);
    assert.deepEqual(cached.data.current, weather.current);
    assert.deepEqual(cached.data.forecast, weather.forecast);
    assert.equal(cached.data.normalized, true);
    offline = true;
    clock += 600001;
    const afterReload = await createService()('48.1,11.6');
    assert.equal(afterReload.stale, true);
    assert.equal(afterReload.fromCache, true);
    assert.deepEqual(afterReload.forecast, weather.forecast);
    assert.equal(storage.get(key), serialized, 'offline use must not rewrite old data with a fresh timestamp');
    assert.equal(requests, 2);
    storage.set(key, JSON.stringify({ savedAt: clock, expiresAt: clock + 600000, data: {} }));
    await assert.rejects(createService()('48.1,11.6'), /Offline/, 'legacy Promise-shaped cache entries must not be treated as valid weather');
  });
}

test('normalization uses a supplied location label and exact coordinates without waiting for reverse geocoding', async () => {
  const source = await readFile(new URL('weather-service.mjs', sourceDirectory), 'utf8');
  const binding = (name, next) => {
    const marker = `  ${name} = `;
    const start = source.indexOf(marker) + marker.length;
    return source.slice(start, source.indexOf(`,\n  ${next} = `, start));
  };
  const merge = new Function(`return (${binding('Un', 'Wn')});`)();
  let reverseCalls = 0;
  const normalize = new Function('Un', '$', 'Hn', `return (${binding('Wn', 'Gn')});`)(
    merge, async () => { reverseCalls += 1; return { name: 'Reverse city' }; }, async () => null
  );
  const weather = { ...payload('Provider city'), location: { lat: 48, lon: 11 } };
  const exact = { latitude: 48.123456, longitude: 11.654321, name: 'Known district' };
  const normalized = await normalize(weather, { explicitMeta: exact });
  assert.equal(reverseCalls, 0);
  assert.equal(normalized.location.name, exact.name);
  assert.equal(normalized.location.lat, exact.latitude);
  assert.equal(normalized.location.lon, exact.longitude);
  assert.equal(normalized.current, weather.current);
  assert.equal(normalized.forecast, weather.forecast);
  await normalize(weather, { explicitMeta: { ...exact, name: '' } });
  assert.equal(reverseCalls, 1, 'unlabelled coordinates retain the existing lookup path');
});

test('normalization preserves an unknown cloud percentage and the provider condition', async () => {
  const source = await readFile(new URL('weather-service.mjs', sourceDirectory), 'utf8');
  const marker = '  Kn = ';
  const start = source.indexOf(marker) + marker.length;
  const end = source.indexOf(',\n  qn = ', start);
  const condition = { text: 'Cloudy', code: 1006 };
  const number = value => Number(value);
  const normalize = new Function('Gn', 'J', 'Y', 'Cn', 'Tn', 'wn', 'Bn', 'zn', 'Rn', 'Dn', 'En', `return (${source.slice(start, end)});`)(
    () => null, number, number, number, number, number, () => condition, Date.parse, value => value, () => 'N', number
  );
  for (const cloud of [null, undefined, 0, 77.4]) {
    const weather = normalize('Device', { latitude: 48.1, longitude: 11.6 }, { current: { cloud_cover: cloud, weather_code: 3, time: '2026-11-03T08:00' } });
    assert.equal(weather.current.cloud, cloud == null ? null : Math.round(cloud));
    assert.equal(weather.current.condition, condition);
  }
});

test('public loader retries the first failed import instead of keeping its rejected promise', async () => {
  const source = (await readFile(new URL('loader.mjs', sourceDirectory), 'utf8')).replace('import(target.href)', 'importModule(target.href)');
  const urls = [];
  const widget = { mountWeatherWidget: (...args) => args, unmountWeatherWidget() {} };
  const window = { setTimeout: callback => callback(), location: { href: 'https://site.test/' } };
  runInNewContext(source, {
    window, document: { currentScript: { src: 'https://site.test/src/loader.mjs?v=release' } }, URL,
    importModule: async url => { urls.push(url); if (urls.length === 1) throw new Error('Transient'); return widget; },
  });
  const first = window.Weather3DWidget.load();
  assert.equal(window.Weather3DWidget.load(), first);
  assert.equal(await first, widget);
  assert.equal(urls.length, 2);
  assert.notEqual(urls[0], urls[1]);
  assert.deepEqual(await window.Weather3DWidget.mountWeatherWidget('host', { managedRefresh: true }), ['host', { managedRefresh: true }]);
});

function recoveryHarness() {
  const timers = new Map();
  const listeners = new Map();
  let next = 0;
  const events = { addEventListener: (name, handler) => listeners.set(name, handler), removeEventListener: name => listeners.delete(name) };
  const environment = {
    window: { ...events, setTimeout: (callback, delay) => { const id = ++next; timers.set(id, { callback, delay }); return id; }, clearTimeout: id => timers.delete(id) },
    document: { ...events, hidden: false },
  };
  class Component {
    constructor(props) { this.props = props; }
    setState(update, callback) { this.state = { ...this.state, ...(typeof update === 'function' ? update(this.state) : update) }; callback?.(); }
  }
  let lazy = 0;
  const React = { Component, lazy: load => ({ load, id: ++lazy }), Suspense: 'Suspense' };
  const Boundary = createRecoverableScene(React, (type, props, key) => ({ type, props, key }), async () => ({ default: 'Scene' }), environment);
  const weather = payload('Retained city');
  const fallback = { type: 'existing-scene-fallback' };
  const boundary = new Boundary({ fallback, weatherData: weather });
  boundary.node = events;
  boundary.componentDidMount();
  const fire = delay => {
    const entry = [...timers].find(([, timer]) => timer.delay === delay);
    assert.ok(entry, `missing ${delay}ms timer`);
    timers.delete(entry[0]); entry[1].callback();
  };
  return { boundary, Boundary, timers, listeners, environment, weather, fallback, fire };
}

test('scene errors isolate the fallback, retry with a new lazy type and retain weather data', () => {
  const h = recoveryHarness();
  const previous = h.boundary.state.Scene;
  h.boundary.setState(h.Boundary.getDerivedStateFromError(new Error('GL failed')));
  h.boundary.componentDidCatch();
  assert.equal(h.boundary.render().props.children.props['data-weather-fallback-kind'], 'cloudy');
  assert.equal(h.boundary.props.weatherData, h.weather);
  h.fire(1000);
  assert.notEqual(h.boundary.state.Scene, previous);
  assert.equal(h.boundary.render().props.children[0].props.children.props.weatherData, h.weather);
  h.boundary.componentWillUnmount();
  assert.equal(h.timers.size, 0);
  assert.equal(h.listeners.size, 0);
});

test('context restoration gets time to recover, while a persistently lost context triggers bounded recovery', () => {
  const h = recoveryHarness();
  const canvas = {};
  let restorationAllowed = false;
  h.boundary.lost({ target: canvas, preventDefault: () => { restorationAllowed = true; } });
  assert.equal(restorationAllowed, true);
  assert.equal(h.boundary.render().props.children[1].props['data-weather-fallback-kind'], 'cloudy', 'a lost context must show weather immediately without unmounting its recovering canvas');
  h.boundary.restored({ target: canvas });
  assert.equal(h.timers.size, 0);
  assert.equal(h.boundary.state.error, null);
  assert.equal(h.boundary.state.contextLost, false);
  h.boundary.lost({ target: canvas });
  h.fire(5000);
  assert.equal(h.boundary.render().props.children.props['data-weather-fallback-kind'], 'cloudy');
  h.fire(1000);
  for (const delay of [4000, 12000]) {
    h.boundary.setState({ error: new Error('Still unavailable') });
    h.boundary.componentDidCatch();
    h.fire(delay);
  }
  h.boundary.setState({ error: new Error('Stop automatic retries') });
  h.boundary.componentDidCatch();
  assert.equal(h.timers.size, 0);
  h.listeners.get('online')();
  assert.equal(h.boundary.state.error, null);
  h.boundary.componentWillUnmount();
});

test('lazy suspension and permanent GPU failure retain animated current weather after bounded retries', () => {
  const h = recoveryHarness();
  const pending = h.boundary.render().props.children[0];
  assert.equal(pending.type, 'Suspense');
  assert.equal(pending.props.fallback, null, 'a single DOM recovery layer covers nested asset suspension');
  assert.equal(h.boundary.render().props.children[1].props['data-weather-fallback-kind'], 'cloudy');
  for (const delay of [1000, 4000, 12000]) {
    h.boundary.setState({ error: new Error('WebGL unavailable') });
    h.boundary.componentDidCatch();
    h.fire(delay);
  }
  h.boundary.setState({ error: new Error('Still unavailable') });
  h.boundary.componentDidCatch();
  h.boundary.props.weatherData = { current: { condition: { code: 1225 }, is_day: 1 } };
  assert.equal(h.boundary.render().props.children.props['data-weather-fallback-kind'], 'snowy', 'fallback follows refreshed weather instead of retaining its first condition');
  assert.equal(h.timers.size, 0);
  h.boundary.componentWillUnmount();
});

test('a delayed scene stays mounted under weather recovery until the current frame is ready', () => {
  const h = recoveryHarness();
  const initial = h.boundary.render().props.children;
  const lazy = initial[0].props.children.type;
  const ready = initial[0].props.children.props.onSceneReady;
  assert.equal(initial[1].props['data-weather-fallback-kind'], 'cloudy');
  assert.equal(h.boundary.render().props.children[0].props.children.type, lazy, 'waiting must not remount the suspended Canvas');
  ready(h.weather);
  assert.equal(h.boundary.render().props.children.type, 'Suspense', 'a healthy first frame hides the recovery layer');
  const canvas = {};
  h.boundary.lost({ target: canvas });
  ready(h.weather);
  assert.equal(h.boundary.state.readyWeather, null, 'pre-loss readiness cannot hide recovery');
  h.boundary.restored({ target: canvas });
  ready(h.weather);
  assert.equal(h.boundary.state.readyWeather, null, 'the previous context generation is stale after restoration');
  h.boundary.render().props.children[0].props.children.props.onSceneReady(h.weather);
  assert.equal(h.boundary.render().props.children.type, 'Suspense');
  h.boundary.props.weatherData = null;
  h.boundary.props.weatherData = { current: { condition: { code: 1195 } } };
  assert.equal(h.boundary.render().props.children[1].props['data-weather-fallback-kind'], 'rainy', 'new weather needs its own ready frame');
  ready(h.weather);
  assert.notEqual(h.boundary.state.readyWeather, h.boundary.props.weatherData);
  h.boundary.componentWillUnmount();
});

test('scene readiness comes from a rendered frame inside asset Suspense and never a lost context', async () => {
  const source = await readFile(new URL('scene.mjs', sourceDirectory), 'utf8');
  const start = source.indexOf('  SceneReady = ') + '  SceneReady = '.length;
  const end = source.indexOf(',\n  useVisibleSun', start);
  assert.ok(end > start);
  let frameCallback;
  const React = { useRef: value => ({ current: value }), useEffect: callback => callback() };
  const Ready = new Function('React', 'P', `return (${source.slice(start, end)});`)(React, callback => { frameCallback = callback; });
  const weatherData = { current: { condition: { code: 1009 } } };
  const calls = [];
  Ready({ weatherData, onSceneReady: value => calls.push(value), recoveryVersion: 0 });
  let lost = true;
  let invalidations = 0;
  const state = { gl: { getContext: () => ({ isContextLost: () => lost }), info: { render: { frame: 0 } } }, invalidate: () => { invalidations += 1; } };
  frameCallback(state);
  assert.equal(calls.length, 0);
  lost = false;
  frameCallback(state);
  assert.equal(calls.length, 0, 'mounting assets alone is not proof of a rendered frame');
  assert.equal(invalidations, 1, 'demand mode must be guaranteed one following frame without replacing its render loop');
  state.gl.info.render.frame = 1;
  frameCallback(state);
  frameCallback(state);
  assert.deepEqual(calls, [weatherData]);
  const suspense = source.slice(source.indexOf('fallback: null,', source.indexOf('  Scene3D = ')));
  assert.match(suspense, /children: \[\s*\(0, jsxRuntime\.jsx\)\(SceneReady,/);
});

test('header panels retain their established cloud composition on mobile and desktop', async () => {
  const source = await readFile(new URL('scene.mjs', sourceDirectory), 'utf8');
  const start = source.indexOf('  WeatherIcon = ') + '  WeatherIcon = '.length;
  const end = source.indexOf('\nj(k);', start);
  assert.ok(end > start);
  const jsx = (type, props) => ({ type, props });
  const Icon = new Function('jsxRuntime', 'weatherConditionType', 'isPartlyCloudy', 'WeatherClouds', 'WeatherRain', 'WeatherSnow', 'WeatherLightning', 'LegacySunPlaceholder', 'LegacyMoonPlaceholder', 'y', `return ${source.slice(start, end)}`)(
    { jsx, jsxs: jsx, Fragment: 'Fragment' }, () => 'rainy', () => false, 'Clouds', 'Rain', 'Snow', 'Lightning', 'Sun', 'Moon', 'Text'
  );
  const previous = globalThis.window;
  try {
    for (const [width, variant, compact, rainCount] of [[430, 'header-panel', false, 800], [899, 'header-panel', false, 800], [900, 'header-panel', false, 800], [1440, 'header-panel', false, 800], [430, 'default', false, 800], [1440, 'header', true, 220]]) {
      globalThis.window = { innerWidth: width };
      const tree = Icon({ weatherData: { current: { condition: { text: 'Rain' } }, location: { localtime: '2026-11-04T09:00' } }, variant, showConditionLabel: false });
      const children = tree.props.children[0].props.children;
      assert.equal(children[0].props.compact, compact, `${width}/${variant} clouds`);
      assert.equal(children[1].props.count, rainCount, `${width}/${variant} rain`);
    }
  } finally { globalThis.window = previous; }
});
