import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { parse } from 'espree';
import postcss from 'postcss';
import { calculateSolarDay, solarPhase, solarPosition, solarPresentation } from '../assets/js/weather-solar-time.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function solarShellDeclarations(names) {
  const source = await readFile(path.join(root, 'assets/js/site-shell.js'), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const body = ast.body.find(node => node.expression?.callee?.id?.name === 'siteShellBootstrap')?.expression.callee.body.body;
  return names.map(name => {
    const node = body?.find(item => item.type === 'FunctionDeclaration' && item.id.name === name);
    assert.ok(node, `Missing solar integration function ${name}`);
    return source.slice(node.start, node.end);
  }).join('\n');
}

test('solar clock imports share the deployed version, coalesce, and retry a failed module URL', async () => {
  const declaration = (await solarShellDeclarations(['loadHeaderWeatherSolarClockModule']))
    .replace('import(/* webpackIgnore: true */ target.href)', 'importModule(target.href)');
  const create = new Function('resolveHeaderWeatherSunSceneModuleUrl', 'window', 'importModule', `
    let headerWeatherSolarClockModulePromise = null, headerWeatherSolarClockModuleRetry = 0;
    ${declaration}; return loadHeaderWeatherSolarClockModule;
  `);
  const urls = [], module = { solarPhase };
  const load = create(() => 'https://hundesalon-nika.com/assets/js/header-weather-sun-scene.js?v=release%26one',
    { location: { href: 'https://hundesalon-nika.com/ru/' } }, url => {
      urls.push(new URL(url));
      return urls.length === 1 ? Promise.reject(new Error('temporary network failure')) : Promise.resolve(module);
    });
  await assert.rejects(load(), /temporary network failure/);
  const second = load(), coalesced = load();
  assert.equal(second, coalesced);
  assert.equal(await second, module);
  assert.equal(urls.length, 2);
  assert.equal(urls[1].pathname, '/assets/js/weather-solar-time.js');
  assert.equal(urls[1].searchParams.get('v'), 'release&one');
  assert.equal(urls[1].searchParams.get('weather-retry'), '1');
});

test('the header retains sunset light and the end-of-day surface timeline until civil twilight ends', async () => {
  const declarations = await solarShellDeclarations([
    'resolveHeaderWeatherOrbPresentation', 'resolveHeaderWeatherStarOpacity',
  ]);
  let now = Date.parse('2026-11-05T17:07:00+01:00');
  const api = new Function('parseHeaderWeatherCoordinates', 'getHeaderWeatherNowMs', 'resolveHeaderWeatherOrbFixedLayout',
    'clampHeaderWeatherValue', 'HEADER_WEATHER_MOON_VIDEO_DURATION_SEC', 'HEADER_WEATHER_SUN_VIDEO_DURATION_SEC', `
    ${declarations}; return { presentation: resolveHeaderWeatherOrbPresentation, stars: resolveHeaderWeatherStarOpacity };
  `)(value => value ? { latitude: 51.23, longitude: 6.78 } : null, () => now,
    (kind, variant) => ({ kind, variant }), (value, low, high) => Math.max(low, Math.min(high, value)), 100, 100);
  const today = {
    date: '2026-11-05', source: 'api', sunrise: Date.parse('2026-11-05T07:32:44+01:00'),
    sunset: Date.parse('2026-11-05T17:00:11+01:00'), civilTwilightBegin: Date.parse('2026-11-05T06:57:27+01:00'),
    civilTwilightEnd: Date.parse('2026-11-05T17:35:28+01:00'),
  };
  const host = { dataset: { weatherLocation: '51.23,6.78' }, __weatherSolarClock: { solarPhase, solarPresentation } };
  const astro = { locationMeta: { latitude: 51.23, longitude: 6.78 }, today,
    yesterday: { sunset: today.sunset - 86400000 }, tomorrow: { sunrise: today.sunrise + 86400000 } };
  const sunset = api.presentation(host, astro);
  assert.equal(host.dataset.weatherSolarPhase, 'sunset');
  assert.equal(sunset.sun.active, true);
  assert.ok(sunset.sun.opacity > .9);
  assert.equal(sunset.moon.active, false, 'seven minutes after sunset is still the early civil-twilight scene');
  assert.equal(api.stars(sunset), 0);
  assert.equal(sunset.sun.timeline.dayProgress, 1, 'afterglow must not reset the solar surface to its sunrise endpoint');
  now = today.civilTwilightEnd + 1;
  const night = api.presentation(host, astro);
  assert.equal(night.sun.active, false);
  assert.equal(night.moon.active, true);
  assert.equal(api.stars(night), 1);
  host.__weatherSolarClock = null;
  assert.equal(api.presentation(host, astro), night, 'a transient module failure keeps the last validated presentation');
  const unavailable = api.presentation({ dataset: {} }, null);
  assert.equal(unavailable.phase, 'unavailable');
  assert.equal(unavailable.sun.active || unavailable.moon.active, false, 'unknown astronomy must not invent a fixed-hour day or night');
  assert.equal(api.stars(unavailable), 0, 'an unavailable model must not invent night stars');
});

test('header star visibility follows current and selected-forecast cloud transmission without replacing Moon assets', async t => {
  const source = await readFile(path.join(root, 'assets/js/site-shell.js'), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const shell = ast.body.find(node => node.expression?.callee?.id?.name === 'siteShellBootstrap').expression.callee.body.body;
  const constants = ['HEADER_WEATHER_MOON_VIDEO_FILES', 'HEADER_WEATHER_MOON_VIDEO_DURATION_SEC', 'WEATHER_WIDGET_ASSET_VERSION']
    .map(name => {
      const node = shell.filter(item => item.type === 'VariableDeclaration').flatMap(item => item.declarations)
        .find(item => item.id.name === name);
      assert.ok(node, `Missing Moon asset constant ${name}`);
      return `const ${source.slice(node.start, node.end)};`;
    }).join('\n');
  const declarations = await solarShellDeclarations([
    'renderHeaderWeatherOrbOverlay', 'resolveHeaderWeatherStarOpacity', 'resolveHeaderWeatherOrbAtmosphere',
    'resolveHeaderWeatherDropdownAtmosphere', 'resolveHeaderWeatherSelectedForecast', 'getHeaderWeatherConditionCode',
    'getHeaderWeatherCloudCover', 'getHeaderWeatherFiniteNumber', 'clampHeaderWeatherValue',
  ]);
  const initialize = new Function('deps', `
    const { resolveHeaderWeatherOrbPresentation, getHeaderWeatherConditionText, applyHeaderWeatherTextReadability,
      getHeaderWeatherWidgetBasePath, getHeaderWeatherAssetsBasePath, getHeaderWeatherNowMs,
      resolveHeaderWeatherOrbFixedLayout, applyHeaderWeatherOrbCrossfade, applyHeaderWeatherOrbLayout,
      setHeaderWeatherOrbSource, applyHeaderWeatherOrbAtmosphere, ensureHeaderWeatherStarsBackLayer,
      ensureHeaderWeatherOrbStack, syncHeaderWeatherPreviewLayerOrder, resolveHeaderWeatherDropdownSceneContext,
      ensureHeaderWeatherDropdownStarsBackLayer, enforceHeaderWeatherToggleArrow, scheduleHeaderWeatherMenuPlacement,
      syncHeaderWeatherShootingStars, syncHeaderWeatherUnifiedReadings, scheduleHeaderWeatherReadingsSync,
      syncHeaderWeatherLiveClock, syncHeaderWeatherCloudBandLayout, document, window } = deps;
    ${constants}\n${declarations}; return renderHeaderWeatherOrbOverlay;
  `);
  const noop = () => {};
  const createHarness = ({ cloud = 0, code = 1000, starOpacity = 1, selectedForecast = null, forecastKind = 'moon' } = {}) => {
    const element = () => {
      const properties = new Map(), classes = new Set();
      return {
        properties, classes, isConnected: false,
        style: { setProperty: (name, value) => properties.set(name, value), removeProperty: name => properties.delete(name) },
        classList: {
          toggle(name, active) { if (active) classes.add(name); else classes.delete(name); },
          remove(...names) { names.forEach(name => classes.delete(name)); },
        },
      };
    };
    const container = () => ({ ...element(), stars: element(), stack: { moon: {} } });
    const preview = container(), hero = container(), scene = element();
    hero.querySelector = () => scene;
    const dropdown = { ...element(), stars: element(), querySelector: () => hero };
    const timeline = { nightProgress: 0.4, videoDurationSec: 458.233333 };
    const presentation = { starOpacity, dominantKind: 'moon', moon: { active: true, timeline, dropdownLayout: { variant: 'dropdown' } } };
    const host = {
      dataset: { weatherCloud: String(cloud), weatherCode: String(code) }, presentation, selectedForecast,
      shadowRoot: { querySelector: selector => ({
        '.weather-header-preview': preview, '.weather-header-dropdown': dropdown,
        '.weather-header-trigger': { getAttribute: () => 'true' },
        '.weather-header-dropdown__forecast-pill.is-active': host.selectedForecast
          ? { dataset: { forecastDate: host.selectedForecast.date } } : null,
      })[selector] || null },
      __weatherWidgetInstance: {
        getState: () => ({ weather: {} }), getForecastSlots: () => host.selectedForecast ? [host.selectedForecast] : [],
        getForecastCloudCover: day => day.cloudCover,
      },
    };
    const render = initialize({
      resolveHeaderWeatherOrbPresentation: () => presentation, getHeaderWeatherConditionText: () => '',
      applyHeaderWeatherTextReadability: noop, getHeaderWeatherWidgetBasePath: () => '/3d-weather-codrops-main',
      getHeaderWeatherAssetsBasePath: () => '/assets/js', getHeaderWeatherNowMs: () => 1000,
      resolveHeaderWeatherOrbFixedLayout: (kind, variant) => ({ kind, variant }),
      applyHeaderWeatherOrbCrossfade: (orb, part) => { orb.part = part; },
      applyHeaderWeatherOrbLayout: (orb, layout) => { orb.layout = layout; },
      setHeaderWeatherOrbSource: (orb, kind, config) => { orb.kind = kind; orb.config = config; },
      applyHeaderWeatherOrbAtmosphere: (orb, atmosphere) => { orb.atmosphere = atmosphere; },
      ensureHeaderWeatherStarsBackLayer: box => box.stars, ensureHeaderWeatherOrbStack: box => box.stack,
      syncHeaderWeatherPreviewLayerOrder: noop,
      resolveHeaderWeatherDropdownSceneContext: () => ({
        forecast: !!host.selectedForecast,
        presentation: host.selectedForecast ? { ...presentation, dominantKind: forecastKind } : presentation,
      }),
      ensureHeaderWeatherDropdownStarsBackLayer: box => box.stars, enforceHeaderWeatherToggleArrow: noop,
      scheduleHeaderWeatherMenuPlacement: noop, syncHeaderWeatherShootingStars: noop, syncHeaderWeatherUnifiedReadings: noop,
      scheduleHeaderWeatherReadingsSync: noop, syncHeaderWeatherLiveClock: noop, syncHeaderWeatherCloudBandLayout: noop,
      document: { querySelector: () => null }, window: { addEventListener: noop },
    });
    return { host, preview, dropdown, hero, timeline, render: () => render(host, null, { latitude: 51.2, longitude: 6.8 }) };
  };
  const assertLayer = (layer, variant, opacity, visible) => {
    assert.equal(layer.properties.get(`--${variant}-stars-opacity`), opacity);
    assert.equal(layer.properties.get('display'), visible ? 'block' : 'none');
    assert.equal(layer.classes.has('is-night-sky'), visible);
    assert.equal(layer.classes.has('is-day-sky'), false);
  };
  const assertDropdown = (ui, opacity, visible) => {
    assertLayer(ui.dropdown.stars, 'dropdown', opacity, visible);
    assert.equal(ui.dropdown.properties.get('--dropdown-stars-opacity'), opacity,
      'native stars in the sibling hero must inherit opacity from the common dropdown ancestor');
  };
  await t.test('native star scenes consume the renderer opacity through their CSS cascade', () => {
    const template = shell.filter(item => item.type === 'VariableDeclaration').flatMap(item => item.declarations)
      .find(item => item.id.name === 'HEADER_WEATHER_TRANSPARENT_STYLES')?.init;
    assert.equal(template?.type, 'TemplateLiteral');
    const styles = postcss.parse(template.quasis.map(quasi => quasi.value.cooked).join('0'));
    for (const [ancestor, variable] of [
      ['.weather-header-preview__stars-back', '--preview-stars-opacity'],
      ['.weather-header-dropdown', '--dropdown-stars-opacity'],
    ]) {
      const selector = `${ancestor} .weather-app__stars-scene--header-panel`;
      const bindings = [];
      styles.walkRules(rule => {
        if (!rule.selectors.some(value => value.includes(ancestor) && value.endsWith('.weather-app__stars-scene--header-panel'))) return;
        rule.walkDecls('opacity', declaration => {
          assert.equal(declaration.value, `var(${variable}, 0)`, `${rule.selector} must not override live star attenuation`);
          assert.equal(declaration.important, true, 'native canvas inline opacity must not bypass the weather state');
          if (rule.selectors.includes(selector)) bindings.push(declaration);
        });
      });
      assert.equal(bindings.length, 1, `${selector} must bind its native star scene to the renderer opacity`);
    }
  });
  await t.test('a clear night keeps both star layers fully visible and leaves the original Moon source and timeline intact', () => {
    const ui = createHarness();
    ui.render();
    assertLayer(ui.preview.stars, 'preview', '1.000', true);
    assertDropdown(ui, '1.000', true);
    assert.equal(ui.preview.stack.moon.config, ui.hero.stack.moon.config, 'both Moon renderers retain the same original source configuration');
    for (const moon of [ui.preview.stack.moon, ui.hero.stack.moon]) {
      assert.equal(moon.kind, 'moon');
      assert.equal(moon.config.type, 'video-keyed');
      assert.equal(moon.config.sources.length, 1);
      const moonSource = new URL(moon.config.sources[0], 'https://hundesalon-nika.com');
      assert.equal(moonSource.pathname, '/3d-weather-codrops-main/assets/Moon/mission_2160p30_fallback.mp4');
      assert.ok(moonSource.searchParams.get('v'), 'the original Moon asset keeps its release cache version');
      assert.equal(moon.config.timelineBase, ui.timeline, 'star updates must not reset the Moon phase playback');
      assert.equal(moon.part.active, true);
    }
  });
  await t.test('measured cloud cover dims stars and dense overcast hides both layers rather than retaining a bright opacity floor', () => {
    const partial = createHarness({ cloud: 50, code: 1006 });
    partial.render();
    assertLayer(partial.preview.stars, 'preview', '0.261', true);
    assertDropdown(partial, '0.261', true);
    const dense = createHarness({ cloud: 100, code: 1009 });
    dense.render();
    assertLayer(dense.preview.stars, 'preview', '0.015', false);
    assertDropdown(dense, '0.015', false);
    assert.equal(dense.preview.stack.moon.kind, 'moon', 'clouds attenuate the existing Moon renderer instead of replacing its asset');
    assert.equal(dense.preview.stack.moon.atmosphere.sunTransmission, 0.015);
  });
  await t.test('twilight preserves the solar model weight and applies the visibility threshold after cloud attenuation', () => {
    const dusk = createHarness({ starOpacity: 0.4 });
    dusk.render();
    assertLayer(dusk.preview.stars, 'preview', '0.400', true);
    assertDropdown(dusk, '0.400', true);
    const attenuated = createHarness({ cloud: 90, code: 1009, starOpacity: 0.4 });
    attenuated.render();
    assertLayer(attenuated.preview.stars, 'preview', '0.010', false);
    assertDropdown(attenuated, '0.010', false);
  });
  await t.test('selected forecasts use their own cloud atmosphere without changing current-night stars', () => {
    const selectedForecast = { date: '2026-11-06', available: true, cloudCover: 100, day: { condition: { code: 1009 } } };
    const ui = createHarness({ selectedForecast });
    ui.render();
    assertLayer(ui.preview.stars, 'preview', '1.000', true);
    assertDropdown(ui, '0.015', false);
    ui.host.selectedForecast = { ...selectedForecast, cloudCover: 0, day: { condition: { code: 1000 } } };
    ui.render();
    assertDropdown(ui, '1.000', true);
    const day = createHarness({ selectedForecast: ui.host.selectedForecast, forecastKind: 'sun' });
    day.render();
    assertLayer(day.preview.stars, 'preview', '1.000', true);
    assertDropdown(day, '0.000', false);
  });
});

test('an adjacent-day service failure preserves authoritative events for today and retries the calculated fallback', async () => {
  const declaration = await solarShellDeclarations(['resolveHeaderWeatherAstro']);
  const cache = new Map(), fetched = [], calculated = [];
  const today = { date: '2026-11-05', source: 'api', sunrise: 100, sunset: 200 };
  const clock = { calculateSolarDay: (...args) => { calculated.push(args); return calculateSolarDay(...args); } };
  const now = Date.parse('2026-11-05T16:07:00Z');
  const resolve = new Function('deps', `
    const { loadHeaderWeatherSolarClockModule, getHeaderWeatherLocationLabel, resolveHeaderWeatherLocationMeta,
      resolveHeaderWeatherTimeZone, getHeaderWeatherDateInTimeZone, headerWeatherAstroCache,
      fetchHeaderWeatherAstroDay, shiftHeaderWeatherDate, Date, HEADER_WEATHER_ASTRO_CACHE_TTL } = deps;
    ${declaration}; return resolveHeaderWeatherAstro;
  `)({
    loadHeaderWeatherSolarClockModule: async () => clock, getHeaderWeatherLocationLabel: () => '51.23,6.78',
    resolveHeaderWeatherLocationMeta: async () => ({ latitude: 51.23, longitude: 6.78, timezone: 'Europe/Berlin' }),
    resolveHeaderWeatherTimeZone: () => 'Europe/Berlin', getHeaderWeatherDateInTimeZone: () => '2026-11-05',
    headerWeatherAstroCache: cache,
    fetchHeaderWeatherAstroDay: async (meta, date, module) => {
      fetched.push({ meta, date, module });
      if (date !== today.date) throw new Error('adjacent day unavailable');
      return today;
    },
    shiftHeaderWeatherDate: (date, shift) => new globalThis.Date(globalThis.Date.parse(date) + shift * 86400000).toISOString().slice(0, 10),
    Date: { now: () => now }, HEADER_WEATHER_ASTRO_CACHE_TTL: 12 * 60 * 60 * 1000,
  });
  const host = {};
  const result = await resolve(host);
  assert.equal(result.today, today, 'a failed neighboring request must not discard the valid provider response');
  assert.equal(result.yesterday.source, 'calculated');
  assert.equal(result.tomorrow.source, 'calculated');
  assert.equal(calculated.length, 2);
  assert.equal(fetched.length, 3);
  assert.ok(fetched.every(call => call.module === clock && call.meta.timezone === 'Europe/Berlin'));
  assert.equal([...cache.values()][0].expiresAt, now + 5 * 60 * 1000, 'transient fallbacks must retry sooner than the normal twelve-hour astronomy cache');
  assert.equal(await resolve(host), result);
  assert.equal(fetched.length, 3, 'the short fallback cache still coalesces identical requests');
});

test('cached solar phases advance through failed or pending network refreshes without retrying services', async () => {
  const declarations = await solarShellDeclarations([
    'syncHeaderWeatherCachedOrbPhase', 'syncHeaderWeatherOrbOverlay',
    'resolveHeaderWeatherOrbPresentation',
  ]);
  let now = Date.parse('2026-11-05T17:07:00+01:00');
  let gate = null, release;
  const calls = { clock: 0, astro: 0, current: 0, scheduled: 0 }, rendered = [];
  const today = {
    source: 'api', sunrise: Date.parse('2026-11-05T07:32:44+01:00'),
    sunset: Date.parse('2026-11-05T17:00:11+01:00'),
    civilTwilightEnd: Date.parse('2026-11-05T17:35:28+01:00'),
  };
  const astro = { locationMeta: { latitude: 51.23, longitude: 6.78 }, today };
  let api;
  const coordinates = value => value === '51.23,6.78' ? astro.locationMeta
    : value === '0,0' ? { latitude: 0, longitude: 0 } : null;
  api = new Function('deps', `
    const { isHeaderWeatherCoordinateSelectionApplied, parseHeaderWeatherCoordinates,
      syncHeaderWeatherClockWithServers, resolveHeaderWeatherAstro, resolveHeaderWeatherCurrent,
      resolveHeaderWeatherTimeZone, renderHeaderWeatherOrbOverlay, scheduleHeaderWeatherOrbSync,
      getHeaderWeatherNowMs, resolveHeaderWeatherOrbFixedLayout, clampHeaderWeatherValue } = deps;
    const HEADER_WEATHER_MOON_VIDEO_DURATION_SEC = 100, HEADER_WEATHER_SUN_VIDEO_DURATION_SEC = 10;
    ${declarations};
    return { full: syncHeaderWeatherOrbOverlay, cached: syncHeaderWeatherCachedOrbPhase,
      presentation: resolveHeaderWeatherOrbPresentation };
  `)({
    isHeaderWeatherCoordinateSelectionApplied: host => host.applied !== false,
    parseHeaderWeatherCoordinates: coordinates,
    syncHeaderWeatherClockWithServers: async () => { calls.clock++; if (gate) await gate; },
    resolveHeaderWeatherAstro: async () => { calls.astro++; throw new Error('astronomy unavailable'); },
    resolveHeaderWeatherCurrent: async () => { calls.current++; throw new Error('weather unavailable'); },
    resolveHeaderWeatherTimeZone: () => 'Europe/Berlin',
    renderHeaderWeatherOrbOverlay: (host, events, geo) => {
      rendered.push({ presentation: api.presentation(host, events), events, geo });
    },
    scheduleHeaderWeatherOrbSync: () => { calls.scheduled++; },
    getHeaderWeatherNowMs: () => now,
    resolveHeaderWeatherOrbFixedLayout: () => ({}),
    clampHeaderWeatherValue: (value, low, high) => Math.max(low, Math.min(high, value)),
  });
  const host = { isConnected: true, shadowRoot: {}, __weatherSolarClock: { solarPhase, solarPresentation },
    dataset: { weatherMounted: 'true', weatherLocation: '51.23,6.78' },
    __weatherAstroSnapshot: { location: '51.23,6.78', data: astro } };
  await api.full(host);
  assert.deepEqual(calls, { clock: 1, astro: 1, current: 1, scheduled: 0 });
  assert.equal(rendered.at(-1).events, astro, 'failed refreshes retain the last astronomy for this location');
  const initialOpacity = rendered.at(-1).presentation.sun.opacity;
  for (let tick = 0; tick < 12; tick++) {
    now += 5000;
    api.cached(host);
  }
  assert.ok(rendered.at(-1).presentation.sun.opacity < initialOpacity, 'sunset opacity follows time between network refreshes');
  assert.deepEqual(calls, { clock: 1, astro: 1, current: 1, scheduled: 0 }, 'cached ticks never retry failed services');

  gate = new Promise(resolve => { release = resolve; });
  const pending = api.full(host);
  assert.equal(host.__weatherOrbSyncInFlight, true);
  now = today.civilTwilightEnd + 1;
  api.cached(host);
  assert.equal(rendered.at(-1).presentation.phase, 'night', 'a pending network request cannot freeze the local sky transition');
  assert.equal(rendered.at(-1).presentation.moon.active, true);
  assert.equal(host.__weatherOrbSyncPending, undefined, 'cached rendering must not queue a second network refresh');
  release();
  await pending;
  assert.deepEqual(calls, { clock: 2, astro: 2, current: 2, scheduled: 0 });

  host.dataset.weatherLocation = '0,0';
  api.cached(host);
  assert.equal(rendered.at(-1).events, null, 'old-location astronomy must not leak into a new location');
  assert.deepEqual(rendered.at(-1).geo, { latitude: 0, longitude: 0 });
  const count = rendered.length;
  host.isConnected = false;
  api.cached(host);
  host.isConnected = true;
  host.dataset.weatherMounted = 'false';
  api.cached(host);
  host.dataset.weatherMounted = 'true';
  host.applied = false;
  api.cached(host);
  host.applied = true;
  host.__weatherSolarClock = null;
  api.cached(host);
  assert.equal(rendered.length, count, 'detached, unmounted, unready and unapplied hosts do not render');
  assert.deepEqual(calls, { clock: 2, astro: 2, current: 2, scheduled: 0 });
});

test('the five-second phase timer pauses when hidden and is cleaned up independently of the minute refresh', async () => {
  const source = await readFile(path.join(root, 'assets/js/site-shell.js'), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const body = ast.body.find(node => node.expression?.callee?.id?.name === 'siteShellBootstrap').expression.callee.body.body;
  const constant = name => body.flatMap(node => node.declarations || []).find(node => node.id.name === name)?.init.value;
  assert.equal(constant('HEADER_WEATHER_ASTRO_REFRESH_INTERVAL'), 60000, 'the full network refresh retains its original minute cadence');
  assert.equal(constant('HEADER_WEATHER_SOLAR_PHASE_REFRESH_INTERVAL'), 5000);
  const begin = source.indexOf('    host.__weatherSolarPhaseRefreshId = window.setInterval(');
  const endToken = '    }, HEADER_WEATHER_SOLAR_PHASE_REFRESH_INTERVAL);';
  const end = source.indexOf(endToken, begin);
  assert.ok(begin >= 0 && end > begin, 'the independent phase timer must be installed');
  let tick, cadence, rendered = 0;
  const host = {}, document = { hidden: true }, cleared = [];
  const window = { setInterval: (callback, interval) => { tick = callback; cadence = interval; return 42; },
    clearInterval: id => cleared.push(id) };
  new Function('window', 'document', 'host', 'syncHeaderWeatherCachedOrbPhase', `
    const HEADER_WEATHER_SOLAR_PHASE_REFRESH_INTERVAL = 5000;
    ${source.slice(begin, end + endToken.length)};
  `)(window, document, host, () => { rendered++; });
  assert.equal(cadence, 5000);
  tick();
  assert.equal(rendered, 0);
  document.hidden = false;
  tick();
  assert.equal(rendered, 1);
  const cleanup = body.find(node => node.id?.name === 'unmountHeaderWeatherWidget').body.body
    .find(node => node.type === 'IfStatement' && node.test.type === 'MemberExpression'
      && node.test.property.name === '__weatherSolarPhaseRefreshId');
  assert.ok(cleanup, 'unmount must clear the independently installed phase timer');
  new Function('window', 'host', source.slice(cleanup.start, cleanup.end))(window, host);
  assert.deepEqual(cleared, [42]);
  assert.equal(host.__weatherSolarPhaseRefreshId, null);
});

test('mobile social and music icons reverse their rollout without losing toggle state', async t => {
  const source = await readFile(path.join(root, 'assets/js/main.js'), 'utf8');
  const controls = source.slice(source.indexOf('  let activeMusicPanel'), source.indexOf('  [pageHeader, pageTopRow, socialBar]'));
  const initialize = new Function('ui', `
    const { socialIconsToggle, socialIconsList, socialPlayerToggle, socialServicePicker,
      socialSpotifyPanel, socialMusicMenu, allMusicPanels, socialBar, localStorage, document, window,
      requestAnimationFrame, cancelAnimationFrame } = ui;
    ${controls}
    return { close: closeSocialIconsUI, closeMusic: closeAllMusicUI };
  `);
  const settle = () => new Promise(resolve => setImmediate(resolve));
  const createHarness = ({ mobile = true, reducedMotion = false, supported = true, supportsPlaybackRateUpdate = true, currentTime,
    savedMotion, storageBlocked = false } = {}) => {
    const classList = () => {
      const values = new Set();
      return { add: value => values.add(value), remove: value => values.delete(value), contains: value => values.has(value) };
    };
    const node = parent => {
      const attributes = new Map();
      const element = {
        parent, attributes, listeners: [], children: [], dataset: {}, classList: classList(), hidden: true, inert: true,
        style: { removeProperty() {} }, setAttribute: (key, value) => attributes.set(key, value),
        getAttribute: key => attributes.get(key),
        appendChild(child) { child.parent = this; this.children.push(child); },
        addEventListener(type, handler) { this.listeners.push({ type, handler }); },
        closest: () => parent,
        contains(target) { for (let item = target; item; item = item.parent) if (item === this) return true; return false; },
      };
      return element;
    };
    const group = count => {
      const wrap = node();
      const toggle = node(wrap);
      toggle.setAttribute('aria-expanded', 'false');
      const list = node(wrap);
      list.setAttribute('aria-hidden', 'true');
      const styleFlushes = [];
      Object.defineProperty(list, 'offsetWidth', {
        get() {
          styleFlushes.push({ hidden: list.hidden, open: list.classList.contains('is-open') });
          return 44;
        },
      });
      const animations = Array.from({ length: count }, (_, index) => {
        const endTime = 1800 + index * 120;
        let resolve;
        let reject;
        const finished = new Promise((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
        return {
          animationName: 'social-icon-rollout', currentTime: currentTime ?? endTime, playbackRate: 1, playCount: 0,
          effect: { getComputedTiming: () => ({ endTime }) }, finished,
          ...(supportsPlaybackRateUpdate ? { updatePlaybackRate(rate) { this.playbackRate = rate; } } : {}),
          play() {
            this.playCount += 1;
            if (this.playbackRate > 0 && this.currentTime >= endTime) this.currentTime = 0;
          },
          cancel() { reject(new Error('Animation cancelled')); },
          finish() { resolve(); },
        };
      });
      const links = animations.map(animation => Object.assign(node(list), {
        getAnimations: supported ? () => list.classList.contains('is-open') ? [animation, { animationName: 'social-icon-idle-wave' }] : [] : undefined,
      }));
      list.querySelectorAll = () => links;
      return { wrap, toggle, list, links, animations, styleFlushes, listAttributes: list.attributes };
    };
    const social = group(8);
    const music = group(2);
    const socialBar = node();
    const stored = new Map(savedMotion ? [['nika-social-icon-motion', savedMotion]] : []);
    const storageAccess = [];
    const localStorage = {
      getItem: key => { storageAccess.push(['get', key]); if (storageBlocked) throw new Error('Storage blocked'); return stored.get(key) ?? null; },
      setItem: (key, value) => { storageAccess.push(['set', key]); if (storageBlocked) throw new Error('Storage blocked'); stored.set(key, value); },
    };
    const mobileMedia = { matches: mobile };
    const reducedMedia = { matches: reducedMotion };
    const panels = music.links.map((link, index) => {
      const id = index ? 'social-apple-panel' : 'social-spotify-panel';
      link.dataset.panel = id;
      const iframe = node();
      iframe.dataset.lazySrc = `https://example.test/${id}`;
      const panel = node();
      panel.querySelector = () => iframe;
      return Object.assign(panel, { id, iframe });
    });
    const documentListeners = [];
    const createdElements = [];
    const document = {
      body: { dataset: {} }, getElementById: id => panels.find(panel => panel.id === id),
      documentElement: { lang: 'ru', dataset: {} },
      createElement: tag => { createdElements.push(tag); return node(); },
      querySelectorAll: selector => selector === '.social-service-btn' ? music.links : [social.wrap, social.list],
      addEventListener: (type, handler, options) => documentListeners.push({
        type, handler, capture: options === true || options?.capture === true,
      }),
    };
    const frames = new Map();
    let nextFrame = 0;
    const close = initialize({
      socialIconsToggle: social.toggle, socialIconsList: social.list, socialPlayerToggle: music.toggle,
      socialServicePicker: music.list, socialSpotifyPanel: panels[0], socialMusicMenu: null, allMusicPanels: panels,
      socialBar, localStorage,
      document, window: {
        matchMedia: query => query === '(max-width: 900px)' ? mobileMedia : reducedMedia, addEventListener() {},
      },
      requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame; },
      cancelAnimationFrame: frame => frames.delete(frame),
    });
    return {
      ...social, music, panels, documentData: document.body.dataset, close: close.close, closeMusic: close.closeMusic,
      stored, storageAccess, createdElements, addedControls: socialBar.children,
      click: (target = social.toggle, { stopAtTarget = false } = {}) => {
        let propagationStopped = false;
        const event = { target, preventDefault() {}, stopPropagation() { propagationStopped = true; } };
        documentListeners.filter(listener => listener.type === 'click' && listener.capture).forEach(listener => listener.handler(event));
        for (let item = target; item && !propagationStopped; item = item.parent) {
          item.listeners?.filter(listener => listener.type === 'click').forEach(listener => listener.handler(event));
        }
        if (stopAtTarget) event.stopPropagation();
        if (!propagationStopped) {
          documentListeners.filter(listener => listener.type === 'click' && !listener.capture).forEach(listener => listener.handler(event));
        }
      },
      escape: () => documentListeners.filter(listener => listener.type === 'keydown').forEach(listener => listener.handler({ key: 'Escape' })),
      enter: target => target.listeners.filter(listener => listener.type === 'pointerenter').forEach(listener => listener.handler({ target })),
      render: () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); },
    };
  };

  await t.test('mobile icon groups animate automatically under reduced motion without preference UI or storage access', async () => {
    for (const options of [
      { reducedMotion: true },
      { reducedMotion: true, savedMotion: 'system' },
      { reducedMotion: true, savedMotion: 'full' },
      { reducedMotion: true, savedMotion: 'system', storageBlocked: true },
    ]) {
      for (const name of ['social', 'music']) {
        const ui = createHarness(options);
        const group = name === 'music' ? ui.music : ui;
        ui.click(group.toggle);
        ui.render();
        assert.equal(group.list.classList.contains('is-open'), true);
        ui.click(group.toggle);
        assert.equal(group.list.hidden, false, 'automatic mobile motion must wait for retraction');
        assert.equal(group.list.inert, true);
        const endTime = 1800 + (group.animations.length - 1) * 120;
        assert.ok(group.animations.every(animation => animation.playbackRate === -1 && animation.currentTime === endTime));
        group.animations.slice(0, -1).forEach(animation => animation.finish());
        await settle();
        assert.equal(group.list.hidden, false);
        group.animations.at(-1).finish();
        await settle();
        assert.equal(group.list.hidden, true);
        assert.deepEqual(ui.createdElements, [], 'icon motion adds no new interface');
        assert.deepEqual(ui.addedControls, []);
        assert.deepEqual(ui.storageAccess, [], 'obsolete full/system preference is neither read nor written');
        assert.equal(ui.stored.get('nika-social-icon-motion'), options.savedMotion);
      }
    }
  });

  await t.test('automatic reduced-motion mobile groups resume the same Safari timeline after outside dismissal', async () => {
    for (const name of ['social', 'music']) {
      const ui = createHarness({ reducedMotion: true, savedMotion: 'system', storageBlocked: true, supportsPlaybackRateUpdate: false });
      const group = name === 'music' ? ui.music : ui;
      ui.click(group.toggle);
      ui.render();
      ui.click({}, { stopAtTarget: true });
      assert.equal(group.list.hidden, false);
      assert.ok(group.animations.every(animation => animation.playbackRate === -1));
      group.animations.forEach(animation => { animation.currentTime = 1300; });
      ui.click(group.toggle);
      assert.equal(group.list.inert, false);
      assert.equal(group.toggle.getAttribute('aria-expanded'), 'true');
      assert.ok(group.animations.every(animation => animation.playbackRate === 1 && animation.currentTime === 1300));
      group.animations.forEach(animation => animation.finish());
      await settle();
      assert.equal(group.list.hidden, false, 'stale closing completion cannot hide the resumed mobile rollout');
      assert.deepEqual(ui.storageAccess, []);
      assert.deepEqual(ui.createdElements, []);
    }
  });

  await t.test('full retraction remains visible and inert until every icon finishes', async () => {
    const ui = createHarness();
    ui.click();
    ui.render();
    ui.click();
    assert.equal(ui.list.hidden, false);
    assert.equal(ui.list.classList.contains('is-open'), true);
    assert.equal(ui.list.inert, true);
    assert.equal(ui.listAttributes.get('aria-hidden'), 'true');
    assert.equal(ui.toggle.getAttribute('aria-expanded'), 'false');
    assert.ok(ui.animations.every(animation => animation.currentTime === 2640 && animation.playbackRate === -1));
    ui.animations.slice(0, -1).forEach(animation => animation.finish());
    await settle();
    assert.equal(ui.list.hidden, false, 'the last icon still has to return to the source');
    ui.animations.at(-1).finish();
    await settle();
    assert.equal(ui.list.hidden, true);
    assert.equal(ui.list.classList.contains('is-open'), false);
  });

  await t.test('reopening preserves a partial reversal and ignores its stale completion', async () => {
    const ui = createHarness();
    ui.click();
    ui.render();
    ui.click();
    ui.animations.forEach(animation => { animation.currentTime = 2100; });
    ui.click();
    assert.equal(ui.toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(ui.list.inert, false);
    assert.equal(ui.listAttributes.get('aria-hidden'), 'false');
    assert.ok(ui.animations.every(animation => animation.playbackRate === 1 && animation.currentTime === 2100), 'play must not rewind early icons to zero');
    ui.animations.forEach(animation => animation.finish());
    await settle();
    assert.equal(ui.list.hidden, false);
    assert.equal(ui.list.classList.contains('is-open'), true);
  });

  for (const name of ['social', 'music']) {
    await t.test(`${name} flushes the unhidden reset state before every fresh opening`, () => {
      const ui = createHarness();
      const group = name === 'music' ? ui.music : ui;
      ui.click(group.toggle);
      assert.deepEqual(group.styleFlushes, [{ hidden: false, open: false }]);
      assert.equal(group.list.classList.contains('is-open'), false, 'the first open waits for its frame');
      ui.render();
      if (name === 'music') ui.closeMusic();
      else ui.close();
      ui.click(group.toggle);
      assert.deepEqual(group.styleFlushes, [
        { hidden: false, open: false },
        { hidden: false, open: false },
      ]);
      ui.render();
      assert.equal(group.list.classList.contains('is-open'), true);
    });

    await t.test(`${name} commits a new reset after closing and reopening before the first frame`, () => {
      const ui = createHarness();
      const group = name === 'music' ? ui.music : ui;
      ui.click(group.toggle);
      ui.click(group.toggle);
      assert.equal(group.list.hidden, true);
      ui.click(group.toggle);
      assert.deepEqual(group.styleFlushes, [
        { hidden: false, open: false },
        { hidden: false, open: false },
      ]);
      ui.render();
      assert.equal(group.list.hidden, false);
      assert.equal(group.list.classList.contains('is-open'), true);
      assert.equal(group.toggle.getAttribute('aria-expanded'), 'true');
    });

    await t.test(`${name} retracts until every Safari animation without updatePlaybackRate finishes`, async () => {
      const ui = createHarness({ supportsPlaybackRateUpdate: false });
      const group = name === 'music' ? ui.music : ui;
      assert.ok(group.animations.every(animation => !('updatePlaybackRate' in animation)));
      ui.click(group.toggle);
      ui.render();
      ui.click(group.toggle);
      assert.equal(group.list.hidden, false);
      assert.equal(group.list.inert, true);
      assert.equal(group.toggle.getAttribute('aria-expanded'), 'false');
      const endTime = 1800 + (group.animations.length - 1) * 120;
      assert.ok(group.animations.every(animation => animation.playbackRate === -1 && animation.currentTime === endTime));
      group.animations.slice(0, -1).forEach(animation => animation.finish());
      await settle();
      assert.equal(group.list.hidden, false, 'the last Safari animation must finish before hiding');
      group.animations.at(-1).finish();
      await settle();
      assert.equal(group.list.hidden, true);
    });

    await t.test(`${name} resumes Safari playbackRate animations from the same partial closing time`, async () => {
      const ui = createHarness({ supportsPlaybackRateUpdate: false });
      const group = name === 'music' ? ui.music : ui;
      ui.click(group.toggle);
      ui.render();
      ui.click(group.toggle);
      group.animations.forEach(animation => { animation.currentTime = 1300; });
      ui.click(group.toggle);
      assert.equal(group.list.hidden, false);
      assert.equal(group.list.inert, false);
      assert.equal(group.toggle.getAttribute('aria-expanded'), 'true');
      assert.ok(group.animations.every(animation => animation.playbackRate === 1 && animation.currentTime === 1300));
      assert.equal(group.styleFlushes.length, 1, 'resuming a partial reversal must not restart the reset state');
      group.animations.forEach(animation => animation.finish());
      await settle();
      assert.equal(group.list.hidden, false, 'stale closing completion cannot hide the resumed Safari rollout');
    });
  }

  await t.test('outside clicks retract in capture and repeated clicks do not restart closing', async () => {
    const ui = createHarness();
    ui.click();
    ui.render();
    ui.click({}, { stopAtTarget: true });
    assert.equal(ui.list.hidden, false, 'outside dismissal waits for the return animation');
    assert.equal(ui.list.inert, true);
    assert.equal(ui.toggle.getAttribute('aria-expanded'), 'false');
    assert.ok(ui.animations.every(animation => animation.playbackRate === -1 && animation.playCount === 1));
    ui.animations.forEach(animation => { animation.currentTime = 1400; });
    ui.click({});
    ui.escape();
    assert.equal(ui.list.hidden, false);
    assert.ok(ui.animations.every(animation => animation.currentTime === 1400 && animation.playCount === 1), 'repeat dismissal must preserve the closing timeline');
    ui.animations.forEach(animation => animation.finish());
    await settle();
    assert.equal(ui.list.hidden, true);
  });

  await t.test('internal clicks stay open and Escape uses the same graceful dismissal', async () => {
    const ui = createHarness();
    ui.click({ parent: ui.toggle });
    ui.render();
    ui.click(ui.list);
    ui.click(ui.links[0]);
    ui.click({ parent: ui.links[0] });
    assert.equal(ui.toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(ui.list.inert, false);
    assert.ok(ui.animations.every(animation => animation.playCount === 0));
    ui.escape();
    assert.equal(ui.list.hidden, false);
    assert.equal(ui.list.inert, true);
    assert.ok(ui.animations.every(animation => animation.playbackRate === -1));
    ui.animations.forEach(animation => animation.finish());
    await settle();
    assert.equal(ui.list.hidden, true);
  });

  await t.test('an outside close can reopen before its stale completion', async () => {
    const ui = createHarness({ currentTime: 800 });
    ui.click();
    ui.render();
    ui.click({});
    ui.animations.forEach(animation => { animation.currentTime = 400; });
    ui.click();
    assert.equal(ui.toggle.getAttribute('aria-expanded'), 'true');
    assert.equal(ui.list.inert, false);
    assert.ok(ui.animations.every(animation => animation.playbackRate === 1 && animation.currentTime === 400));
    ui.animations.forEach(animation => animation.finish());
    await settle();
    assert.equal(ui.list.hidden, false);
  });

  await t.test('a close during the opening rollout starts from the current shared time', async () => {
    const ui = createHarness({ currentTime: 450 });
    ui.click();
    ui.render();
    ui.click();
    assert.ok(ui.animations.every(animation => animation.currentTime === 450 && animation.playbackRate === -1));
    ui.close();
    ui.click();
    ui.render();
    await settle();
    assert.equal(ui.list.hidden, false, 'cancelled close promises cannot hide a newer opening');
    assert.equal(ui.toggle.getAttribute('aria-expanded'), 'true');
  });

  await t.test('music repeat toggles reverse and resume the same two-icon timeline', async () => {
    const ui = createHarness();
    ui.click({ parent: ui.music.toggle });
    ui.render();
    assert.equal(ui.music.list.hidden, false);
    assert.equal(ui.music.list.inert, false);
    ui.click(ui.music.toggle);
    assert.equal(ui.music.list.hidden, false);
    assert.equal(ui.music.list.inert, true);
    assert.equal(ui.music.toggle.getAttribute('aria-expanded'), 'false');
    assert.ok(ui.music.animations.every(animation => animation.currentTime === 1920 && animation.playbackRate === -1));
    ui.music.animations.forEach(animation => { animation.currentTime = 1300; });
    ui.click(ui.music.toggle);
    assert.equal(ui.music.list.inert, false);
    assert.equal(ui.music.toggle.getAttribute('aria-expanded'), 'true');
    assert.ok(ui.music.animations.every(animation => animation.currentTime === 1300 && animation.playbackRate === 1));
    ui.music.animations.forEach(animation => animation.finish());
    await settle();
    assert.equal(ui.music.list.hidden, false, 'stale retraction completion cannot hide the reopened picker');
  });

  await t.test('music outside capture reverses once and completes after both icons return', async () => {
    const ui = createHarness();
    ui.click(ui.music.toggle);
    ui.render();
    ui.click({}, { stopAtTarget: true });
    assert.equal(ui.music.list.hidden, false);
    assert.equal(ui.music.list.inert, true);
    ui.music.animations.forEach(animation => { animation.currentTime = 900; });
    ui.click({});
    ui.escape();
    assert.ok(ui.music.animations.every(animation => animation.currentTime === 900 && animation.playCount === 1));
    ui.music.animations[0].finish();
    await settle();
    assert.equal(ui.music.list.hidden, false);
    ui.music.animations[1].finish();
    await settle();
    assert.equal(ui.music.list.hidden, true);
    assert.equal(ui.music.list.classList.contains('is-open'), false);
  });

  await t.test('switching social and music keeps the previous group retracting and inert', async () => {
    const ui = createHarness();
    ui.click(ui.music.toggle);
    ui.render();
    ui.enter(ui.wrap);
    assert.equal(ui.music.list.hidden, false);
    assert.equal(ui.music.list.inert, true);
    ui.click();
    ui.render();
    assert.equal(ui.list.inert, false);
    assert.equal(ui.music.list.hidden, false, 'opening social must not interrupt music retraction');
    ui.music.animations.forEach(animation => { animation.currentTime = 800; });
    ui.enter(ui.music.wrap);
    ui.click(ui.music.toggle);
    assert.equal(ui.music.list.inert, false);
    assert.equal(ui.list.inert, true);
    assert.equal(ui.list.hidden, false);
    assert.ok(ui.music.animations.every(animation => animation.playbackRate === 1 && animation.currentTime === 800));
    ui.animations.forEach(animation => animation.finish());
    await settle();
    assert.equal(ui.list.hidden, true);
    assert.equal(ui.music.list.hidden, false);
  });

  await t.test('each service opens only its lazy iframe while the picker retracts', async () => {
    for (const serviceIndex of [0, 1]) {
      const ui = createHarness();
      assert.ok(ui.panels.every(panel => !panel.iframe.getAttribute('src')));
      ui.click(ui.music.toggle);
      ui.render();
      assert.ok(ui.panels.every(panel => !panel.iframe.getAttribute('src')), 'opening the chooser does not load players');
      ui.click({ parent: ui.music.links[serviceIndex] });
      const selected = ui.panels[serviceIndex];
      assert.equal(ui.music.list.hidden, false);
      assert.equal(ui.music.list.inert, true);
      assert.equal(selected.hidden, false);
      assert.equal(selected.iframe.getAttribute('src'), selected.iframe.dataset.lazySrc);
      assert.equal(ui.panels[1 - serviceIndex].iframe.getAttribute('src'), undefined);
      ui.render();
      assert.equal(selected.classList.contains('is-open'), true);
      assert.equal(ui.documentData.spotifyPanelOpen, 'true');
      ui.click(selected);
      assert.equal(selected.hidden, false, 'clicks inside the active player stay inside');
      ui.music.animations.forEach(animation => animation.finish());
      await settle();
      assert.equal(ui.music.list.hidden, true);
      assert.equal(selected.hidden, false, 'picker completion must not hide the selected lazy player');
      assert.equal(selected.classList.contains('is-open'), true);
      assert.equal(ui.documentData.spotifyPanelOpen, 'true');
      ui.click({}, { stopAtTarget: true });
      assert.equal(selected.hidden, true);
      assert.equal(ui.documentData.spotifyPanelOpen, 'false');
      assert.ok(ui.music.animations.every(animation => animation.playCount === 1));
    }
  });

  await t.test('music without WAAPI closes immediately and desktop retains bubbling outside clicks', () => {
    const unsupported = createHarness({ supported: false });
    unsupported.click(unsupported.music.toggle);
    unsupported.render();
    unsupported.click({}, { stopAtTarget: true });
    assert.equal(unsupported.music.list.hidden, true);
    assert.equal(unsupported.music.list.inert, true);
    const ui = createHarness({ mobile: false });
    ui.click(ui.music.toggle);
    ui.render();
    ui.click({}, { stopAtTarget: true });
    assert.equal(ui.music.list.hidden, false, 'desktop keeps its existing bubble listener');
    ui.click({});
    assert.equal(ui.music.list.hidden, true);
    const service = createHarness({ mobile: false });
    service.click(service.music.toggle);
    service.render();
    service.click(service.music.links[0]);
    assert.equal(service.music.list.hidden, true);
    assert.equal(service.panels[0].hidden, false);
  });

  await t.test('desktop, unsupported WAAPI and an unstarted rollout close immediately', () => {
    for (const options of [{ mobile: false }, { mobile: false, reducedMotion: true, savedMotion: 'full' }, { supported: false }, { currentTime: 0 }]) {
      const ui = createHarness(options);
      ui.click();
      ui.render();
      ui.click();
      assert.equal(ui.list.hidden, true, JSON.stringify(options));
      assert.equal(ui.list.inert, true);
      assert.equal(ui.toggle.getAttribute('aria-expanded'), 'false');
      assert.ok(ui.animations.every(animation => animation.playbackRate === 1));
      assert.deepEqual(ui.storageAccess, []);
      assert.deepEqual(ui.createdElements, []);
    }
    for (const options of [{ mobile: false }, { mobile: false, reducedMotion: true, savedMotion: 'system' }]) {
      const ui = createHarness(options);
      ui.click();
      ui.render();
      ui.click({}, { stopAtTarget: true });
      assert.equal(ui.list.hidden, true, 'outside clicks keep the immediate fallback');
      assert.equal(ui.list.inert, true);
      assert.equal(ui.toggle.getAttribute('aria-expanded'), 'false');
    }
    const beforeFirstFrame = createHarness();
    beforeFirstFrame.click();
    beforeFirstFrame.click();
    beforeFirstFrame.render();
    assert.equal(beforeFirstFrame.list.hidden, true, 'a pending opening frame must not reopen an immediate close');
  });
});

test('header shooting stars use one eligible night layer and stop with their host', async t => {
  const source = await readFile(path.join(root, 'assets/js/site-shell.js'), 'utf8');
  const declaration = source.match(/  function syncHeaderWeatherShootingStars\(host\) \{[\s\S]*?\n  \}/)[0];
  const initialize = new Function('window', 'document', 'randomBetween', `${declaration}\nreturn syncHeaderWeatherShootingStars;`);
  const settle = () => new Promise(resolve => setImmediate(resolve));
  const createHarness = ({ reduced = false, night = true, hidden = false, empty = false, width = 390, ratio = 0.5 } = {}) => {
    const timers = new Map();
    const animations = [];
    let timerId = 0;
    const media = matches => ({
      matches, listeners: new Set(),
      addEventListener(type, handler) { this.listeners.add(handler); },
      removeEventListener(type, handler) { this.listeners.delete(handler); },
      change(value) { this.matches = value; this.listeners.forEach(handler => handler()); },
    });
    const reducedQuery = media(reduced);
    const rect = (left, top, rectWidth, height) => ({ left, top, right: left + rectWidth, bottom: top + height, width: rectWidth, height });
    const header = { getBoundingClientRect: () => rect(0, 0, width, 180) };
    const dropdownBox = { getBoundingClientRect: () => rect(14, 190, width - 28, 400) };
    const layer = dropdown => {
      const result = {
        isConnected: true, night, style: { display: 'block' }, children: [],
        classList: { contains: name => name === 'is-night-sky' && result.night },
        closest: () => dropdown ? dropdownBox : null,
        getBoundingClientRect: dropdown ? dropdownBox.getBoundingClientRect : header.getBoundingClientRect,
        appendChild(element) { this.children.push(element); element.parentElement = this; },
      };
      return result;
    };
    const preview = layer(false);
    const dropdown = layer(true);
    const host = {
      isConnected: true, dataset: { weatherMounted: 'true', weatherExpanded: 'false' },
      shadowRoot: { querySelector: selector => empty ? null : selector.includes('dropdown') ? dropdown : preview },
    };
    const document = {
      hidden, querySelector: () => header,
      createElement() {
        const properties = new Map();
        const element = {
          style: { setProperty: (key, value) => properties.set(key, value) }, properties, setAttribute() {},
          remove() { const list = this.parentElement?.children; const index = list?.indexOf(this); if (index >= 0) list.splice(index, 1); },
          animate(frames, options) {
            let resolve;
            let reject;
            const animation = {
              element: this, frames, options, cancelled: false,
              finished: new Promise((onResolve, onReject) => { resolve = onResolve; reject = onReject; }),
              cancel() { this.cancelled = true; reject(new Error('Cancelled')); }, finish() { resolve(); },
            };
            animations.push(animation);
            return animation;
          },
        };
        return element;
      },
    };
    const sync = initialize({
      innerWidth: width, innerHeight: 700,
      matchMedia: query => { assert.equal(query, '(prefers-reduced-motion: reduce)'); return reducedQuery; },
      setTimeout: (handler, delay) => { timers.set(++timerId, { handler, delay }); return timerId; },
      clearTimeout: id => timers.delete(id),
    }, document, (min, max) => min + (max - min) * ratio);
    return {
      host, preview, dropdown, document, timers, animations, reducedQuery, sync: () => sync(host),
      runTimer() { const [id, timer] = timers.entries().next().value; timers.delete(id); timer.handler(); },
    };
  };

  await t.test('repeated synchronization cannot overlap stars and pauses are randomized in bounds', async () => {
    const ui = createHarness();
    ui.sync();
    ui.sync();
    assert.equal(ui.timers.size, 1);
    const firstDelay = [...ui.timers.values()][0].delay;
    assert.ok(firstDelay >= 2000 && firstDelay <= 5000);
    ui.runTimer();
    assert.equal(ui.preview.children.length, 1);
    assert.equal(ui.animations.length, 1);
    assert.ok(ui.animations[0].options.duration >= 2000 && ui.animations[0].options.duration <= 3000);
    assert.equal(ui.animations[0].options.duration, 7500 / 3, 'the same sampled trajectory takes exactly one third of its former duration');
    assert.equal(ui.animations[0].options.easing, 'linear');
    const frames = ui.animations[0].frames;
    const motionFrames = frames.filter(frame => frame.transform);
    assert.deepEqual(motionFrames.map(frame => frame.offset), [0, 1]);
    assert.equal(motionFrames[0].easing, 'linear', 'opacity easing must not change travel speed');
    assert.match(motionFrames[0].transform, /scale\(1\.000\)/);
    assert.match(motionFrames[1].transform, /scale\(0\.200\)/);
    assert.deepEqual(frames.filter(frame => 'opacity' in frame).map(frame => frame.opacity), [0, 0.8, 0.18, 0]);
    assert.ok(frames.filter(frame => 'opacity' in frame && frame.offset < 1).every(frame => frame.easing === 'ease-in-out'));
    ui.sync();
    assert.equal(ui.timers.size, 0, 'an active meteor owns the next interval');
    ui.animations[0].finish();
    await settle();
    assert.equal(ui.preview.children.length, 0);
    assert.equal(ui.timers.size, 1);
    const nextDelay = [...ui.timers.values()][0].delay;
    assert.ok(nextDelay >= 7000 && nextDelay <= 20000);
    ui.host.__weatherShootingStars.dispose();
  });

  await t.test('all directions stay inside mobile and desktop header or dropdown bounds', () => {
    for (const width of [280, 1440]) {
      for (const inDropdown of [false, true]) {
        for (const expectedAngle of [0, 45, 89.99, 90, 135, 180, 225, 270, 270.01, 315, 359.99]) {
          const ui = createHarness({ width, ratio: expectedAngle / 360 });
          if (inDropdown) {
            ui.preview.night = false;
            ui.host.dataset.weatherExpanded = 'true';
          }
          const layer = inDropdown ? ui.dropdown : ui.preview;
          const bounds = layer.getBoundingClientRect();
          ui.sync();
          ui.runTimer();
          assert.equal(ui.animations.length, 1, `${width}px, ${expectedAngle}deg`);
          const { element, frames } = ui.animations[0];
          assert.equal(element.parentElement, layer);
          const length = parseFloat(element.properties.get('--shooting-star-length'));
          const originX = bounds.left + parseFloat(element.style.left) + length * 0.9;
          const originY = bounds.top + parseFloat(element.style.top) + 9;
          for (const frame of frames.filter(keyframe => keyframe.transform)) {
            const [, x, y, angle, scale] = frame.transform.match(/translate3d\(([-\d.]+)px, ([-\d.]+)px, 0\) rotate\(([-\d.]+)deg\) scale\(([-\d.]+)\)/);
            assert.equal(Number(angle), expectedAngle);
            const radians = Number(angle) * Math.PI / 180;
            for (const localX of [-0.9 * length, 0.1 * length]) {
              for (const localY of [-9, 9]) {
                const px = originX + Number(x) + (localX * Math.cos(radians) - localY * Math.sin(radians)) * Number(scale);
                const py = originY + Number(y) + (localX * Math.sin(radians) + localY * Math.cos(radians)) * Number(scale);
                assert.ok(px >= bounds.left + 5.9 && px <= bounds.right - 5.9 && py >= bounds.top + 5.9 && py <= bounds.bottom - 5.9, `${width}px, ${angle}deg: ${px}, ${py}`);
              }
            }
          }
          ui.host.__weatherShootingStars.dispose();
        }
      }
    }
  });

  await t.test('day, hidden pages and missing layers never spawn', () => {
    for (const options of [{ night: false }, { hidden: true }, { empty: true }]) {
      const ui = createHarness(options);
      ui.sync();
      assert.equal(ui.timers.size, 0, JSON.stringify(options));
      assert.equal(ui.animations.length, 0);
      ui.host.__weatherShootingStars.dispose();
    }
  });

  await t.test('night shooting stars run at full duration regardless of system motion preference', async () => {
    for (const width of [280, 1440]) {
      const ui = createHarness({ reduced: true, width });
      ui.sync();
      assert.equal(ui.timers.size, 1);
      ui.runTimer();
      assert.equal(ui.preview.children.length, 1);
      assert.ok(ui.animations[0].options.duration >= 2000 && ui.animations[0].options.duration <= 3000);
      ui.reducedQuery.change(false);
      ui.reducedQuery.change(true);
      assert.equal(ui.animations[0].cancelled, false, 'changing the system preference cannot interrupt a star');
      assert.equal(ui.reducedQuery.listeners.size, 0);
      ui.host.__weatherShootingStars.dispose();
      await settle();
      assert.equal(ui.preview.children.length, 0);
      assert.equal(ui.timers.size, 0);
    }
  });

  await t.test('day, hidden pages and unmount cancel active stars without rescheduling', async () => {
    for (const state of ['day', 'hidden', 'disconnected', 'unmounted', 'dispose']) {
      const ui = createHarness();
      ui.sync();
      ui.runTimer();
      const controller = ui.host.__weatherShootingStars;
      if (state === 'day') ui.preview.night = false;
      if (state === 'hidden') ui.document.hidden = true;
      if (state === 'disconnected') ui.host.isConnected = false;
      if (state === 'unmounted') ui.host.dataset.weatherMounted = 'false';
      if (state === 'dispose') controller.dispose();
      else ui.sync();
      await settle();
      assert.equal(ui.animations[0].cancelled, true, state);
      assert.equal(ui.preview.children.length, 0);
      assert.equal(ui.timers.size, 0, 'cancelled animation completion cannot restart the scheduler');
      controller.dispose();
      assert.equal(ui.reducedQuery.listeners.size, 0);
    }
  });

  await t.test('open dropdown eligibility and lifecycle changes cancel stale animation callbacks', async () => {
    const ui = createHarness({ ratio: 0.9 });
    ui.host.dataset.weatherExpanded = 'true';
    ui.sync();
    ui.runTimer();
    assert.equal(ui.dropdown.children.length, 1);
    assert.equal(ui.preview.children.length, 0);
    ui.host.dataset.weatherExpanded = 'false';
    ui.sync();
    assert.equal(ui.animations[0].cancelled, true);
    await settle();
    assert.equal(ui.timers.size, 1, 'only the replacement timer survives cancellation');
    ui.runTimer();
    assert.equal(ui.preview.children.length, 1);
    ui.reducedQuery.change(true);
    await settle();
    assert.equal(ui.timers.size, 0);
    assert.equal(ui.preview.children.length, 1, 'system motion preference no longer changes eligibility');
    ui.reducedQuery.change(false);
    assert.equal(ui.animations[1].cancelled, false);
    ui.animations[1].finish();
    await settle();
    assert.equal(ui.timers.size, 1);
    ui.host.__weatherShootingStars.dispose();
    await settle();
    assert.equal(ui.timers.size, 0);
    assert.equal(ui.reducedQuery.listeners.size, 0);
  });
});

test('localized burger menus expose promotions while keeping booking in the header', async () => {
  const source = await readFile(path.join(root, 'assets/js/site-shell.js'), 'utf8');
  const copyDeclaration = source.match(/  const HEADER_COPY = \{[\s\S]*?\n  \};/)[0];
  const rendererDeclaration = source.match(/  function createHeaderMarkup\(context\) \{[\s\S]*?\n  \}/)[0];
  const { copy, renderHeader } = runInNewContext(`${copyDeclaration}\n${rendererDeclaration}\n({ copy: HEADER_COPY, renderHeader: createHeaderMarkup });`, {
    WEATHER_WIDGET_ASSET_VERSION: 'test',
  });

  for (const [locale, promotionsLabel] of Object.entries({ ru: 'АКЦИИ', uk: 'АКЦІЇ', de: 'AKTIONEN', en: 'PROMOTIONS' })) {
    for (const currentRoute of ['index.html', 'blog/blog.html']) {
      const markup = renderHeader({
        currentLang: locale, pageLang: locale, currentRoute, copy: copy[locale],
        mediaLibraryCopy: { mediaLibrary: 'Media' }, menuA11y: { openMenu: 'Menu', expandGallery: 'Gallery' },
        menuSections: { more: 'More' }, weatherWidgetCopy: { ariaLabel: 'Weather' },
      });
      const mobileNav = markup.match(/<nav id="mobile-nav"[^>]*>([\s\S]*?)<\/nav>/)[1];
      const mobileNavContent = mobileNav.match(/^\s*<div class="mobile-nav__content">([\s\S]*)<\/div>\s*$/)?.[1];
      assert.ok(mobileNavContent, 'all menu content scrolls inside the stationary outer panel');
      const header = markup.match(/<header class="header">([\s\S]*?)<\/header>/)[1];
      const prefix = currentRoute.startsWith('blog/') ? '../' : '';
      assert.ok(mobileNavContent.includes(`href="${prefix}social.html#promotions" class="mobile-nav-link--secondary">${promotionsLabel}</a>`), `${locale}/${currentRoute}: localized promotions link`);
      assert.doesNotMatch(mobileNav, /onlayn-bronirovanie\.html/);
      assert.ok(header.includes(`href="${prefix}onlayn-bronirovanie.html" class="header-online-btn online-order-pill"`), `${locale}/${currentRoute}: header booking remains available`);
      assert.ok(header.includes(`>${copy[locale].booking}</span></a>`));
    }
    const socialPage = await readFile(path.join(root, locale, 'social.html'), 'utf8');
    assert.match(socialPage, /id="promotions"/);
  }
});

test('social promotions deep links scroll after shell setup and on hash changes', async () => {
  const source = await readFile(path.join(root, 'assets/js/page-modules.js'), 'utf8');
  const declarations = ['resolveHashTarget', 'initSmoothHashLinks'].map(name =>
    source.match(new RegExp(`  const ${name} = [\\s\\S]*?\\n  \\};`))[0]
  ).join('\n');
  const initialize = new Function('document', 'window', 'scrollRoot', `${declarations}\ninitSmoothHashLinks();`);

  for (const pathname of ['/ru/social.html', '/uk/social.html', '/de/social', '/en/social.html', '/ru/prays-list.html']) {
    const frames = [];
    const scrollCalls = [];
    const listeners = new Map();
    const target = { scrollIntoView: options => scrollCalls.push(options) };
    const document = { querySelectorAll: () => [], getElementById: id => id === 'promotions' ? target : null };
    const window = {
      location: { pathname, hash: '#promotions' },
      requestAnimationFrame: callback => frames.push(callback),
      addEventListener: (type, handler) => listeners.set(type, handler),
    };
    initialize(document, window, {});
    assert.equal(scrollCalls.length, 0, 'wait until the shared shell has finished layout');
    frames.shift()();
    const expectedCount = pathname.includes('/social') ? 1 : 0;
    assert.equal(scrollCalls.length, expectedCount, pathname);
    if (expectedCount) assert.deepEqual(scrollCalls[0], { behavior: 'instant', block: 'start', inline: 'nearest' });

    window.location.hash = '#other';
    listeners.get('hashchange')();
    frames.shift()();
    assert.equal(scrollCalls.length, expectedCount, 'leave unrelated fragments unchanged');
    window.location.hash = '#promotions';
    listeners.get('hashchange')();
    frames.shift()();
    assert.equal(scrollCalls.length, expectedCount * 2, 'same-page hash navigation reaches promotions');
  }
});

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
      (html.match(/page-modules\.css\?v=20261027-search-selects/g) || []).length,
      3,
      `${locale} must load the latest price-page stylesheet version`
    );
  }
});

test('every localized price page keeps selection and booking inside one modal', async () => {
  for (const locale of ['de', 'en', 'ru', 'uk']) {
    const html = await readFile(path.join(root, locale, 'prays-list.html'), 'utf8');
    const modals = [...html.matchAll(/<div\b[^>]*class="([^"]*)"[^>]*>/g)]
      .filter(match => match[1].split(/\s+/).includes('modal'));
    assert.equal(modals.length, 1, `${locale}: only one booking overlay`);
    assert.match(modals[0][0], /id="booking-modal"/);
    assert.match(modals[0][0], /data-price-booking-flow/);
    assert.equal((html.match(/id="booking-form"/g) || []).length, 1);
    assert.equal((html.match(/data-booking-price-selection/g) || []).length, 1);
    assert.match(html, /price-booking-flow\.css\?v=20261027-unified-booking/);
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
      (html.match(/page-modules\.css\?v=20261027-search-selects/g) || []).length,
      3,
      `${locale} must load the equal compact card stylesheet version`
    );
    assert.match(html, /price-page\.js\?v=20261027-unified-booking/);
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

test('header Sun matches menu size with its own preview offset while Moon and menu anchors remain fixed', async () => {
  const source = await readFile(path.join(root, 'assets/js/site-shell.js'), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const bootstrap = ast.body.find(node =>
    node.type === 'ExpressionStatement' &&
    node.expression.type === 'CallExpression' &&
    node.expression.callee.type === 'FunctionExpression' &&
    node.expression.callee.id?.name === 'siteShellBootstrap'
  )?.expression.callee;
  assert.ok(bootstrap, 'site-shell.js must declare the siteShellBootstrap IIFE');
  const declarations = bootstrap.body.body;
  const styleTemplate = declarations
    .filter(item => item.type === 'VariableDeclaration')
    .flatMap(item => item.declarations)
    .find(item => item.id?.name === 'HEADER_WEATHER_TRANSPARENT_STYLES')?.init;
  assert.equal(styleTemplate?.type, 'TemplateLiteral');
  const styles = postcss.parse(styleTemplate.quasis.map(quasi => quasi.value.cooked).join('0'));
  const sunSizeRules = [];
  styles.walkRules(rule => {
    if (rule.selectors.some(selector => /^\.weather-orb-overlay--(?:preview|dropdown)\.is-sun$/.test(selector)) &&
      rule.nodes.some(node => node.type === 'decl' && ['width', 'height'].includes(node.prop))) sunSizeRules.push(rule);
  });
  assert.equal(sunSizeRules.length, 1, 'a mobile override must not enlarge only the preview Sun');
  assert.deepEqual(sunSizeRules[0].selectors, ['.weather-orb-overlay--preview.is-sun', '.weather-orb-overlay--dropdown.is-sun']);
  for (const property of ['width', 'height']) {
    assert.equal(sunSizeRules[0].nodes.find(node => node.prop === property)?.value, 'clamp(68px, 14vw, 92px)');
  }
  const declaration = name => {
    const node = declarations.find(item => item.type === 'FunctionDeclaration' && item.id?.name === name);
    assert.ok(node, `siteShellBootstrap must declare function ${name}`);
    return source.slice(node.start, node.end);
  };
  const constants = [
    'HEADER_WEATHER_MOON_DISPLAY_SCALE',
    'HEADER_WEATHER_MOON_SIZE_REDUCTION',
    'HEADER_WEATHER_MOON_SIZE_BOOST',
    'HEADER_WEATHER_ORB_PREVIEW_ANCHOR',
    'HEADER_WEATHER_MOON_PREVIEW_ANCHOR',
    'HEADER_WEATHER_SUN_PREVIEW_ANCHOR',
    'HEADER_WEATHER_MOON_PREVIEW_LAYOUT',
    'HEADER_WEATHER_MOON_DROPDOWN_LAYOUT',
    'HEADER_WEATHER_SUN_PREVIEW_LAYOUT',
    'HEADER_WEATHER_SUN_DROPDOWN_LAYOUT',
  ].map(name => {
    const node = declarations
      .filter(item => item.type === 'VariableDeclaration' && item.kind === 'const')
      .flatMap(item => item.declarations)
      .find(item => item.id.type === 'Identifier' && item.id.name === name);
    assert.ok(node, `siteShellBootstrap must declare const ${name}`);
    return `const ${source.slice(node.start, node.end)};`;
  }).join('\n');
  const { apply, fixed } = new Function(`${constants}\n${declaration('resolveHeaderWeatherOrbFixedLayout')}\n${declaration('applyHeaderWeatherOrbLayout')}\nreturn { apply: applyHeaderWeatherOrbLayout, fixed: resolveHeaderWeatherOrbFixedLayout };`)();
  const positions = ['--orb-left', '--orb-top', '--orb-offset-x', '--orb-offset-y'];
  const createOrb = (variant, kind) => {
    const values = new Map([['left', '50%'], ['top', '50%'], ...positions.map(name => [name, 'stale'])]);
    const writes = [];
    return {
      dataset: { orbRole: kind },
      classList: { contains: name => name === `weather-orb-overlay--${variant}` },
      style: {
        setProperty(name, value) { values.set(name, value); writes.push(name); },
        removeProperty: name => values.delete(name),
      },
      values, writes,
    };
  };
  const expectedScale = fixed('moon', 'preview').scale.toFixed(3);
  assert.equal(fixed('moon', 'dropdown').scale, fixed('moon', 'preview').scale);
  assert.equal(fixed('moon', 'dropdown').objectPosition, fixed('moon', 'preview').objectPosition);
  const anchor = layout => ({ left: layout.left, offsetX: layout.offsetX, offsetY: layout.offsetY });
  const originalAnchor = { left: 68, offsetX: -3, offsetY: -4 };
  assert.deepEqual(anchor(fixed('moon', 'preview')), originalAnchor);
  assert.deepEqual(anchor(fixed('moon', 'dropdown')), originalAnchor);
  assert.deepEqual(anchor(fixed('sun', 'dropdown')), originalAnchor);
  assert.deepEqual(anchor(fixed('sun', 'preview')), { left: 68, offsetX: 3, offsetY: -8 });
  assert.equal(fixed('sun', 'preview').scale, fixed('sun', 'dropdown').scale, 'equal CSS sizes must produce equal rendered solar sizes');

  for (const variant of ['preview', 'dropdown']) {
    const moon = createOrb(variant, 'moon');
    apply(moon, { left: -500, top: 'invalid', scale: 9, offsetX: 99, offsetY: 99 });
    assert.equal(moon.values.get('--orb-scale-visible'), expectedScale, `${variant}: stale model scale must not replace the fixed moon scale`);
    assert.equal(moon.dataset.orbPositionLocked, variant);
    for (const name of positions) assert.equal(moon.values.has(name), false, `${variant}: ${name} must be controlled by CSS`);
    assert.equal(moon.values.get('left'), '50%');
    assert.equal(moon.values.get('top'), '50%');
    assert.equal(moon.writes.some(name => positions.includes(name)), false);

    positions.forEach(name => moon.values.set(name, 'stale-again'));
    apply(moon, null);
    assert.equal(moon.values.get('--orb-scale-visible'), expectedScale);
    for (const name of positions) assert.equal(moon.values.has(name), false, 'cached layouts must still remove stale inline positions');
  }

  for (const variant of ['preview', 'dropdown']) {
    const sun = createOrb(variant, 'sun');
    const expectedSunScale = fixed('sun', variant).scale.toFixed(3);
    apply(sun, { left: 23, top: 41, scale: 0.7, offsetX: 4, offsetY: -2 });
    assert.equal(sun.values.get('--orb-scale-visible'), expectedSunScale);
    assert.equal(sun.dataset.orbPositionLocked, variant);
    for (const name of positions) assert.equal(sun.values.has(name), false, `${variant}: Sun must retain its own fixed CSS anchor`);
    positions.forEach(name => sun.values.set(name, 'stale-again'));
    apply(sun, null);
    assert.equal(sun.values.get('--orb-scale-visible'), expectedSunScale, 'missing model coordinates must not reset the rendered solar scale');
    for (const name of positions) assert.equal(sun.values.has(name), false);
  }
});

test('header moon readability matches in preview and dropdown without changing the sun', async () => {
  const source = await readFile(path.join(root, 'assets/js/site-shell.js'), 'utf8');
  const declaration = source.match(/  function lockHeaderWeatherMainTemperatureTypography\([^)]*\) \{[\s\S]*?\n  \}/)[0];
  class Element {
    constructor(classes) {
      this.classes = new Set(classes.split(' '));
      this.values = new Map([['opacity', '0.91'], ['filter', 'contrast(2)']]);
      this.priorities = new Map();
      this.style = { setProperty: (name, value, priority) => {
        this.values.set(name, value);
        this.priorities.set(name, priority);
      } };
    }
  }
  const previewMoon = new Element('weather-orb-overlay--preview is-moon');
  const dropdownMoon = new Element('weather-orb-overlay--dropdown is-moon');
  const sun = new Element('weather-orb-overlay--dropdown is-sun');
  const nodes = [previewMoon, dropdownMoon, sun];
  const shadowRoot = {
    querySelector: () => null,
    querySelectorAll: selector => nodes.filter(node => selector.split(',').some(part =>
      [...part.matchAll(/\.([\w-]+)/g)].every(([, name]) => node.classes.has(name))
    )),
  };
  const apply = new Function('HTMLElement', `${declaration}\nreturn lockHeaderWeatherMainTemperatureTypography;`)(Element);
  apply({ shadowRoot, dataset: { weatherVariant: 'header' } });
  for (const moon of [previewMoon, dropdownMoon]) {
    assert.equal(moon.values.get('opacity'), '0.62');
    assert.equal(moon.values.get('filter'), 'brightness(1.18) saturate(1.08) drop-shadow(0 0 12px rgba(232, 212, 139, 0.36))');
    assert.equal(moon.priorities.get('opacity'), 'important');
    assert.equal(moon.priorities.get('filter'), 'important');
  }
  assert.equal(sun.values.get('opacity'), '0.91');
  assert.equal(sun.values.get('filter'), 'contrast(2)');
});

test('weather menu arrow stays inside its pill and animates only actual expanded-state changes', async t => {
  const source = await readFile(path.join(root, 'assets/js/site-shell.js'), 'utf8');
  const names = ['ensureHeaderWeatherToggleArrowBase', 'stopHeaderWeatherToggleArrowAnimation', 'playHeaderWeatherToggleArrowAnimation', 'syncHeaderWeatherToggleArrow'];
  const declarations = names.map(name => source.match(new RegExp(`  function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`))[0]).join('\n');
  const constants = ['HEADER_WEATHER_TOGGLE_ARROW_CLOSED', 'HEADER_WEATHER_TOGGLE_ARROW_OPEN']
    .map(name => source.match(new RegExp(`  const ${name} = [^;]+;`))[0]).join('\n');
  const initialize = new Function('document', 'getComputedStyle', `${constants}\n${declarations}\nreturn { sync: syncHeaderWeatherToggleArrow, stop: stopHeaderWeatherToggleArrowAnimation };`);
  const settle = () => new Promise(resolve => setImmediate(resolve));
  const createHarness = ({ expanded = false, values = {} } = {}) => {
    const properties = new Map([
      ['position', ['absolute', 'important']], ['right', ['-9.906px', 'important']],
      ['bottom', ['-1px', 'important']], ['transform', ['rotate(0deg)', 'important']],
    ]);
    const classes = new Set();
    const animations = [];
    const icon = {
      dataset: { arrowBaseReady: 'true' }, textContent: '⌄',
      style: { setProperty: (name, value, priority = '') => properties.set(name, [value, priority]), removeProperty: name => properties.delete(name) },
      classList: { toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) }, setAttribute() {},
      animate(frames, options) {
        let resolve;
        let reject;
        const animation = {
          frames, options, cancelled: false,
          finished: new Promise((onResolve, onReject) => { resolve = onResolve; reject = onReject; }),
          cancel() { this.cancelled = true; reject(new Error('Cancelled')); }, finish() { resolve(); },
        };
        animations.push(animation);
        return animation;
      },
    };
    const trigger = { getAttribute: () => String(expanded) };
    const host = {
      isConnected: true, dataset: { weatherMounted: 'true', weatherExpanded: String(expanded) },
      shadowRoot: { querySelector: selector => selector === '.weather-header-trigger' ? trigger : icon },
    };
    const document = { hidden: false };
    const api = initialize(document, () => ({ getPropertyValue: name => values[name] || '' }));
    return {
      host, icon, document, properties, classes, animations, stop: () => api.stop(host), sync: () => api.sync(host),
      setExpanded(value) { expanded = value; host.dataset.weatherExpanded = String(value); },
    };
  };

  await t.test('initial synchronization migrates old offsets without changing the glyph size or starting a spin', () => {
    for (const expanded of [false, true]) {
      const ui = createHarness({ expanded });
      ui.sync();
      assert.equal(ui.properties.get('position')[0], 'relative');
      assert.equal(ui.properties.get('flex')[0], '0 0 7.906px');
      assert.equal(ui.properties.get('align-self')[0], 'center');
      assert.equal(ui.properties.get('width')[0], '7.906px');
      assert.equal(ui.properties.get('height')[0], '7.906px');
      for (const edge of ['left', 'right', 'top', 'bottom']) assert.equal(ui.properties.get(edge)[0], 'auto');
      assert.equal(ui.properties.has('transform'), false, 'inline transforms must not freeze the CSS bounce');
      assert.equal(ui.properties.get('opacity')[1], '');
      assert.equal(ui.classes.has('is-open'), expanded);
      ui.sync();
      assert.equal(ui.animations.length, 0);
    }
  });

  await t.test('open and close spin in opposite directions once and preserve the CSS orientation', async () => {
    const ui = createHarness();
    ui.sync();
    ui.setExpanded(true);
    ui.sync();
    ui.sync();
    assert.equal(ui.animations.length, 1);
    assert.deepEqual(ui.animations[0].frames, [{ rotate: '0deg' }, { rotate: '1080deg' }]);
    assert.equal(ui.animations[0].options.duration, 1800);
    assert.equal(ui.properties.get('--arrow-rotate')[0], 'rotate(0deg)');
    ui.setExpanded(false);
    ui.sync();
    assert.equal(ui.animations[0].cancelled, true);
    assert.deepEqual(ui.animations[1].frames, [{ rotate: '0deg' }, { rotate: '-1080deg' }]);
    assert.equal(ui.properties.get('--arrow-rotate')[0], 'rotate(90deg)');
    await settle();
    assert.equal(ui.host.__weatherToggleArrowAnimation, ui.animations[1], 'stale cancellation cannot clear a newer spin');
    ui.animations[1].finish();
    await settle();
    assert.equal(ui.host.__weatherToggleArrowAnimation, null);
    ui.sync();
    assert.equal(ui.animations.length, 2);
  });

  await t.test('the weather arrow reads shared timing, easing and turn tokens', async () => {
    for (const [duration, turns, expectedMs, expectedDegrees] of [['2.4s', '4', 2400, 1440], ['650ms', '2', 650, 720], ['invalid', '-1', 1800, 1080]]) {
      const ui = createHarness({ values: {
        '--site-arrow-activation-duration': duration,
        '--site-arrow-activation-turn-count': turns,
        '--site-arrow-activation-easing': 'ease-in-out',
      } });
      ui.sync(); ui.setExpanded(true); ui.sync();
      assert.equal(ui.animations[0].options.duration, expectedMs);
      assert.equal(ui.animations[0].options.easing, 'ease-in-out');
      assert.equal(ui.animations[0].frames[1].rotate, `${expectedDegrees}deg`);
      assert.ok(ui.animations[0].frames.every(frame => !('transform' in frame)), 'spin must compose with the independent CSS bounce');
      ui.stop();
      await settle();
    }
  });

  await t.test('hidden, disconnected and unmounted hosts cancel active spins without replaying them', async () => {
    for (const state of ['hidden', 'disconnected', 'unmounted']) {
      const ui = createHarness();
      ui.sync(); ui.setExpanded(true); ui.sync();
      if (state === 'hidden') ui.document.hidden = true;
      if (state === 'disconnected') ui.host.isConnected = false;
      if (state === 'unmounted') ui.host.dataset.weatherMounted = 'false';
      ui.sync();
      await settle();
      assert.equal(ui.animations[0].cancelled, true);
      assert.equal(ui.host.__weatherToggleArrowAnimation, null);
      ui.document.hidden = false; ui.host.isConnected = true; ui.host.dataset.weatherMounted = 'true';
      ui.sync();
      assert.equal(ui.animations.length, 1);
    }
    const unmount = source.match(/  function unmountHeaderWeatherWidget\(\) \{[\s\S]*?\n  \}/)[0];
    assert.match(unmount, /stopHeaderWeatherToggleArrowAnimation\(host\)/);
  });

  await t.test('missing WAAPI preserves the arrow state and CSS bounce without throwing', () => {
    const ui = createHarness();
    ui.icon.animate = undefined;
    ui.sync(); ui.setExpanded(true);
    assert.doesNotThrow(ui.sync);
    assert.equal(ui.classes.has('is-open'), true);
    assert.equal(ui.properties.get('--arrow-rotate')[0], 'rotate(0deg)');
    assert.equal(ui.animations.length, 0);
  });
});

test('header Sun preserves CSS geometry while rendering native retina and pinch-zoom pixels in one scaling pass', async () => {
  const source = await readFile(path.join(root, 'assets/js/header-weather-sun-scene.js'), 'utf8');
  const runnable = source.replace(/^(?:import .+|const \{ solarPosition \} = await import.+);$/gm, '').replace(/^export /gm, '');
  const context = {
    solarPosition,
    THREE: { MathUtils: { degToRad: value => value * Math.PI / 180 }, Clock: class {}, Color: class {} },
    window: { devicePixelRatio: 3, visualViewport: { scale: 1, addEventListener() {}, removeEventListener() {} }, matchMedia: () => ({ matches: false }), addEventListener() {}, removeEventListener() {} },
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  };
  const Scene = runInNewContext(`${runnable}\nHeaderWeatherSunScene;`, context);

  for (const [dpr, zoom] of [[1, 1], [2, 1], [3, 1], [3, 2], [3, 5]]) {
    context.window.devicePixelRatio = dpr;
    context.window.visualViewport.scale = zoom;
    const canvas = { clientWidth: 100, clientHeight: 60 };
    const scene = new Scene(canvas);
    let pixelRatio;
    let cssDimensions;
    scene.renderer = {
      setPixelRatio: value => { pixelRatio = value; },
      getPixelRatio: () => pixelRatio,
      setSize: (width, height, updateStyle) => {
        cssDimensions = [width, height, updateStyle];
        canvas.width = Math.floor(width * pixelRatio);
        canvas.height = Math.floor(height * pixelRatio);
      },
    };
    scene.camera = { updateProjectionMatrix() {} };
    scene.resize();
    const expectedRatio = Math.min(dpr * zoom, 1024 / 100);
    assert.equal(pixelRatio, expectedRatio);
    assert.deepEqual(cssDimensions, [100, 60, false], 'setSize must receive CSS dimensions rather than already multiplied backing dimensions');
    assert.equal(canvas.width, Math.floor(100 * expectedRatio));
    assert.equal(canvas.height, Math.floor(60 * expectedRatio));
    assert.equal(scene.camera.aspect, 100 / 60);
  }
});

test('header Sun advances at physical hourly speed from absolute UTC and retains phase after remount', async () => {
  const source = await readFile(path.join(root, 'assets/js/header-weather-sun-scene.js'), 'utf8');
  const runnable = source.replace(/^(?:import .+|const \{ solarPosition \} = await import.+);$/gm, '').replace(/^export /gm, '');
  const context = {
    solarPosition,
    THREE: { MathUtils: { degToRad: value => value * Math.PI / 180 }, Clock: class {}, Color: class {} },
    window: { visualViewport: { addEventListener() {}, removeEventListener() {} }, addEventListener() {}, removeEventListener() {} },
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  };
  const { Scene, epoch, rate } = runInNewContext(`${runnable}\n({ Scene: HeaderWeatherSunScene, epoch: SOLAR_MODEL_EPOCH_MS, rate: solarRotationRateDegPerDay });`, context);
  const scene = new Scene({});
  scene.reducedMotion = true;
  scene.sunMesh = { rotation: { y: 0 } };
  scene.updateAnimation(epoch);
  const start = scene.sunMesh.rotation.y;
  const later = epoch + 3600000;
  scene.updateAnimation(later);
  const expected = rate(0) * Math.PI / 180 / 24;
  assert.ok(Math.abs(scene.sunMesh.rotation.y - start - expected) < 1e-10);
  assert.ok(expected > 0.009 && expected < 0.01, 'an hour is about half a degree rather than two artificial full turns');
  assert.equal(scene.solarDaysUniform.value, 1 / 24);
  const remounted = new Scene({});
  remounted.sunMesh = { rotation: {} };
  remounted.updateAnimation(later);
  assert.equal(remounted.sunMesh.rotation.y, scene.sunMesh.rotation.y);
  assert.equal(remounted.solarDaysUniform.value, scene.solarDaysUniform.value);
  assert.doesNotThrow(() => Scene.prototype.updateAnimation.call({ sunMesh: null }, later));
});

test('the shared Sun bootstrap passes the live server clock without reading cached observations or artificial forecast noon', async () => {
  const source = await readFile(path.join(root, 'assets/js/site-shell.js'), 'utf8');
  const pending = [parse(source, { ecmaVersion: 'latest', sourceType: 'script' })];
  const clocks = [];
  let appearanceCallback;
  while (pending.length) {
    const node = pending.pop();
    if (node.type === 'Property' && node.key?.name === 'getTimeMs') clocks.push(node.value);
    if (node.type === 'Property' && node.key?.name === 'onAppearanceChange') appearanceCallback = node.value;
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) pending.push(...value.filter(item => item?.type));
      else if (value?.type) pending.push(value);
    }
  }
  assert.equal(clocks.length, 1, 'preview and dropdown must use one common solar mount clock');
  assert.equal(clocks[0].type, 'Identifier');
  assert.equal(clocks[0].name, 'getHeaderWeatherNowMs');
  let correctedTime = Date.parse('2026-03-20T06:00:00Z');
  const liveClock = () => correctedTime;
  const rendererClock = new Function('getHeaderWeatherNowMs', `return (${source.slice(clocks[0].start, clocks[0].end)});`)(liveClock);
  assert.equal(rendererClock, liveClock, 'the renderer receives a live callback rather than a sampled weather timestamp');
  assert.equal(rendererClock(), correctedTime);
  correctedTime += 3600000;
  assert.equal(rendererClock(), correctedTime);
  assert.ok(appearanceCallback, 'the shared mount must synchronize native image recovery and its halo');
  const writes = new Map();
  const mountToken = {};
  const overlay = { __sunSceneMountToken: mountToken, dataset: {}, style: { setProperty: (name, value) => writes.set(name, value) } };
  const applyAppearance = new Function('overlay', 'mountToken', `return (${source.slice(appearanceCallback.start, appearanceCallback.end)});`)(overlay, mountToken);
  const appearance = { recoveryFilter: 'grayscale(1)', glowRgb: '255 255 255', elevationDeg: 14.8081 };
  applyAppearance(appearance);
  assert.equal(writes.get('--orb-sun-recovery-filter'), 'grayscale(1)');
  assert.equal(writes.get('--orb-sun-glow-rgb'), '255 255 255');
  assert.equal(overlay.dataset.sunElevation, '14.808', 'the DOM diagnostic must expose finite geometric elevation in degrees');
  for (const elevationDeg of [undefined, NaN, Infinity]) {
    applyAppearance({ ...appearance, elevationDeg });
    assert.equal(overlay.dataset.sunElevation, 'unknown', 'missing astronomy must not expose a misleading numeric diagnostic');
  }
  applyAppearance(appearance);
  overlay.__sunSceneMountToken = null;
  applyAppearance({ recoveryFilter: 'stale', glowRgb: 'stale', elevationDeg: -.8 });
  assert.equal(writes.get('--orb-sun-recovery-filter'), 'grayscale(1)', 'a disposed renderer cannot write recovery styles after remount');
  assert.equal(writes.get('--orb-sun-glow-rgb'), '255 255 255');
  assert.equal(overlay.dataset.sunElevation, '14.808', 'a stale callback cannot overwrite the current renderer diagnostic');
});

test('weather server time preserves UTC across browser timezones and avoids the localized root redirect', async () => {
  const source = await readFile(path.join(root, 'assets/js/site-shell.js'), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const bootstrap = ast.body.find(node => node.type === 'ExpressionStatement' &&
    node.expression.type === 'CallExpression' && node.expression.callee.id?.name === 'siteShellBootstrap')?.expression.callee;
  assert.ok(bootstrap, 'the clock helpers must remain in the shared site shell');
  const declaration = name => {
    const node = bootstrap.body.body.find(item => item.type === 'FunctionDeclaration' && item.id?.name === name);
    assert.ok(node, `siteShellBootstrap must declare clock helper ${name}`);
    return source.slice(node.start, node.end);
  };
  const expected = Date.UTC(2026, 10, 4, 15, 6, 39, 771);
  const naive = '2026-11-04T15:06:39.7718954';
  let clientNow;
  const requests = [];
  const parsedInputs = [];
  class ClientDate extends Date {
    static now() { return clientNow; }
    static parse(value) {
      // Model strict portable input support, without assuming an observed
      // parsing failure in any particular browser engine.
      parsedInputs.push(value);
      const fraction = value.match(/\.(\d+)/)?.[1];
      if ((fraction && fraction.length !== 3) || /[+-]\d{4}$/.test(value)) return NaN;
      return Date.parse(value);
    }
  }
  const helpers = new Function('window', 'fetch', 'Date', `
    ${declaration('parseHeaderWeatherServerTimestamp')}
    ${declaration('getHeaderWeatherTimeSources')}
    ${declaration('fetchHeaderWeatherSourceTimeMs')}
    return { parse: parseHeaderWeatherServerTimestamp, sources: getHeaderWeatherTimeSources, fetchTime: fetchHeaderWeatherSourceTimeMs };
  `)({ location: { origin: 'https://example.com' } }, async (url, options) => {
    requests.push({ url: new URL(url), options });
    clientNow = expected + 100;
    return { ok: true, headers: { get: name => name === 'date' ? new Date(expected).toUTCString() : null },
      json: async () => ({ dateTime: naive, utc_datetime: '2026-11-04T15:06:39.7718954+00:00' }) };
  }, ClientDate);
  const sources = helpers.sources();
  assert.equal(sources[0].id, 'origin-date-header');
  assert.equal(sources[0].url, 'https://example.com/site.webmanifest', 'same-origin time must use a static route without the root language redirect');
  assert.equal(sources[0].mode, 'same-origin');
  for (const item of sources.filter(item => item.type === 'json-field')) assert.equal(item.timeZone, 'UTC');
  const previousTimeZone = process.env.TZ;
  try {
    for (const timeZone of ['UTC', 'Europe/Berlin', 'America/New_York']) {
      process.env.TZ = timeZone;
      if (timeZone === 'Europe/Berlin') assert.notEqual(Date.parse(naive), expected, 'the fixture must reproduce the former one-hour CET parsing error');
      assert.equal(helpers.parse(naive, 'UTC'), expected, `${timeZone}: a timezone-less TimeAPI UTC value must remain UTC`);
      assert.equal(helpers.parse('2026-11-04T15:06', 'UTC'), Date.UTC(2026, 10, 4, 15, 6));
      assert.equal(helpers.parse('2026-11-04T15:06:39.1', 'UTC'), Date.UTC(2026, 10, 4, 15, 6, 39, 100));
      assert.equal(helpers.parse('2026-11-04T15:06:39.12', 'UTC'), Date.UTC(2026, 10, 4, 15, 6, 39, 120));
      for (const explicit of ['2026-11-04T15:06:39.771Z', '2026-11-04T16:06:39.771+01:00', '2026-11-04T11:06:39.771-0400']) {
        assert.equal(helpers.parse(explicit, 'UTC'), expected, 'explicit zone offsets must not receive a second UTC suffix');
      }
      assert.equal(helpers.parse(naive), Date.parse(naive), 'UTC normalization must apply only to a source explicitly marked UTC');
      for (const item of sources) {
        clientNow = expected - 100;
        const offset = await helpers.fetchTime(item);
        assert.equal(offset, item.type === 'date-header' ? -771 : 0, `${timeZone}: the actual fetch helper must pass source UTC metadata to its parser`);
        const request = requests.at(-1);
        assert.ok(request.url.searchParams.has('_ts'));
        assert.equal(request.options.cache, 'no-store');
        assert.equal(request.options.credentials, 'omit');
      }
    }
  } finally {
    if (previousTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimeZone;
  }
  assert.equal(helpers.parse(expected, 'UTC'), expected);
  assert.equal(helpers.parse(Math.floor(expected / 1000), 'UTC'), Math.floor(expected / 1000) * 1000);
  assert.equal(helpers.parse(0, 'UTC'), 0);
  assert.equal(helpers.parse(new Date(expected).toUTCString(), 'UTC'), expected - 771);
  assert.ok(parsedInputs.includes('2026-11-04T15:06:39.771Z'), 'extended API precision must be truncated to portable milliseconds before Date.parse');
  assert.ok(parsedInputs.includes('2026-11-04T15:06:39.100Z'));
  assert.ok(parsedInputs.includes('2026-11-04T15:06:39.120Z'), 'short fractional values must preserve their instant while being padded');
  assert.ok(parsedInputs.includes('2026-11-04T11:06:39.771-04:00'), 'basic numeric offsets must become the portable colonized form');
  for (const invalid of [null, undefined, NaN, Infinity, '', 'not-a-time', '04/11/2026 15:06:39', '2026-11-04', {}, []]) {
    assert.ok(Number.isNaN(helpers.parse(invalid, 'UTC')), 'unsupported timestamps must fail rather than silently shift the solar clock');
  }
});

test('weather locale animation retains its requested timing under system reduced motion', async () => {
  const source = await readFile(path.join(root, 'assets/js/site-shell.js'), 'utf8');
  const declaration = source.match(/    const playWeatherLocaleSwitchAnimation = async durationMs => \{[\s\S]*?\n    \};/)[0];
  const durations = [];
  const classes = new Set();
  let host = { animate: (frames, options) => { durations.push(options.duration); return { finished: Promise.resolve() }; } };
  const play = new Function('getHeaderWeatherHost', 'wait', 'window', `${declaration}\nreturn playWeatherLocaleSwitchAnimation;`)(
    () => host,
    duration => { durations.push(duration); return Promise.resolve(); },
    { matchMedia: () => ({ matches: true }) }
  );
  await play(900);
  host = { classList: { add: value => classes.add(value), remove: value => classes.delete(value) } };
  await play(900);
  assert.deepEqual(durations, [900, 900]);
  assert.equal(classes.size, 0, 'the fallback still clears its temporary switching state');
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
    getVisibleHeaderBottom() {}, initHeaderAdaptiveLayout() {},
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
