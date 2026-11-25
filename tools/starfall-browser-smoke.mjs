import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, firefox, webkit } from 'playwright';
import { startStaticTestServer } from './lib/static-test-server.mjs';
import { calculateSolarDay } from '../assets/js/weather-solar-time.js';
import { attributeEntryNetworkErrors } from './lib/starfall-network-attribution.mjs';

// Capture the intentionally incomplete entrance without Playwright waiting for all page fonts.
// Supported by the installed playwright-core screenshotter (lib/coreBundle.js).
process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
// The normal command verifies the current loaders; historical profiling modes are explicit opt-ins.
const mode = process.env.STARFALL_MODE || 'loaders';
const diagnosticOnly = mode === 'diagnostic';
const shortMode = mode === 'short' || mode === 'frames';
const entriesOnly = mode === 'entries';
const glProbeOnly = mode === 'glprobe';
const deadlineProbeOnly = mode === 'deadlineprobe';
const visualReadyOnly = mode === 'visualready';
const loadersOnly = mode === 'loaders';
const trackNetwork = entriesOnly || visualReadyOnly || loadersOnly || mode === 'frames';
const selectedEngines = (process.env.STARFALL_ENGINES || 'chromium,webkit,firefox').split(',');
const selectedViewports = (process.env.STARFALL_VIEWPORTS || 'desktop,mobile').split(',');
const selectedLoaderScenarios = (process.env.STARFALL_LOADER_SCENARIOS || 'paws,weather,edges').split(',');
const entryDirectory = selectedEngines.length === 1 && ['chromium', 'webkit', 'firefox'].includes(selectedEngines[0]) ? `entries-${selectedEngines[0]}` : 'entries';
const frameDirectory = mode === 'frames' && selectedEngines.length === 1 && ['chromium', 'webkit', 'firefox'].includes(selectedEngines[0])
  ? `frames-${selectedEngines[0]}${selectedViewports.length === 1 && ['desktop', 'mobile'].includes(selectedViewports[0]) ? `-${selectedViewports[0]}` : ''}` : '.';
const output = path.resolve('output/playwright/starfall', loadersOnly ? 'loaders' : diagnosticOnly ? 'diagnostics' : entriesOnly ? entryDirectory : glProbeOnly ? 'glprobe' : deadlineProbeOnly ? 'deadlineprobe' : visualReadyOnly ? 'visualready' : frameDirectory);
const manifest = JSON.parse(await readFile('3d-weather-codrops-main/build-manifest.json', 'utf8'));
const previewModule = manifest.entries.find(entry => entry.source === 'src/header-preview.mjs')?.output;
assert.ok(previewModule, 'weather preview entry must be known');
await mkdir(output, { recursive: true });
const previousResult = path.join(output, 'results.json');
if (existsSync(previousResult)) {
  const previous = await readFile(previousResult, 'utf8');
  const previousTime = JSON.parse(previous).generatedAt.replaceAll(/[:.]/g, '-');
  await writeFile(path.join(output, `results-${previousTime}.json`), previous);
}
if (mode === 'frames' && frameDirectory !== '.') {
  const fullMatrix = path.resolve('output/playwright/starfall/results.json');
  if (existsSync(fullMatrix)) {
    const raw = await readFile(fullMatrix, 'utf8');
    const stamp = JSON.parse(raw).generatedAt.replaceAll(/[:.]/g, '-');
    await writeFile(path.resolve('output/playwright/starfall', `fullmatrix-${stamp}.json`), raw);
  }
}
const server = await startStaticTestServer(path.resolve('dist'));
const origin = new URL(server.baseUrl).origin;
const results = {
  generatedAt: new Date().toISOString(),
  mode,
  assetVersion: (await readFile('dist/config/deploy-asset-version.txt', 'utf8')).trim(),
  fixture: 'Isolated static production bundle; labelled weather fixture; external traffic and form submissions blocked.',
  metricScope: loadersOnly ? 'Rendered loader motion, readiness, session and disposal contracts; no FPS benchmark or live API validation.' : '4 seconds of main-thread requestAnimationFrame intervals during scripted steady scrolling, not physical display FPS.',
  browsers: [],
};
const save = () => writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
const day = new Date().toISOString().slice(0, 10);
const weather = {
  location: { name: 'Leipzig · QA fixture', region: 'Sachsen', country: 'Germany', lat: 51.34, lon: 12.37, tz_id: 'Europe/Berlin', localtime_epoch: Math.floor(Date.now() / 1000), localtime: `${day} 18:00` },
  current: { last_updated_epoch: Math.floor(Date.now() / 1000), last_updated: `${day} 18:00`, temp_c: 7, feelslike_c: 5, is_day: 0, wind_kph: 9, wind_degree: 220, wind_dir: 'SW', pressure_mb: 1016, precip_mm: 0, humidity: 62, cloud: 15, vis_km: 10, gust_kph: 14, uv: 0, condition: { code: 1000, text: 'Clear · QA fixture', icon: '' } },
  forecast: { forecastday: Array.from({ length: 4 }, (_, index) => {
    const date = new Date(Date.now() + index * 86400000).toISOString().slice(0, 10);
    return { date, date_epoch: Math.floor(new Date(date).getTime() / 1000), day: { maxtemp_c: 9, mintemp_c: 3, avgtemp_c: 6, maxwind_kph: 14, avghumidity: 62, avgvis_km: 10, daily_chance_of_rain: 0, condition: { code: 1000, text: 'Clear · QA fixture', icon: '' } }, astro: { sunrise: '07:00 AM', sunset: '04:30 PM', moonrise: '03:00 PM', moonset: '05:00 AM', moon_phase: 'Waxing Gibbous', moon_illumination: 85 }, hour: [] };
  }) },
};

function gate() {
  let release;
  const promise = new Promise(resolve => { release = resolve; });
  return { promise, release };
}

function weatherResponse(url) {
  const now = Date.now();
  const locationCoordinates = (url.searchParams.get('location') || '').split(',').map(Number);
  const coordinate = (key, index, fallback) => {
    const query = url.searchParams.get(key);
    if (query !== null && Number.isFinite(Number(query))) return Number(query);
    return locationCoordinates.length === 2 && locationCoordinates.every(Number.isFinite) ? locationCoordinates[index] : fallback;
  };
  const latitude = coordinate('latitude', 0, weather.location.lat);
  const longitude = coordinate('longitude', 1, weather.location.lon);
  return { ...weather, location: { ...weather.location, lat: latitude, lon: longitude }, weatherMeta: {
    source: 'qa-fixture', providerLabel: 'QA weather fixture', time: new Date(now).toISOString(), observedAt: now, fetchedAt: now,
    timezone: weather.location.tz_id, latitude, longitude, weatherCode: 0, precipitationKind: null,
    cloudCover: weather.current.cloud, humidity: weather.current.humidity, temperature: weather.current.temp_c,
    apparentTemperature: weather.current.feelslike_c, isDay: weather.current.is_day,
    pressureMsl: weather.current.pressure_mb, surfacePressure: null, pressureMmHg: Math.round(weather.current.pressure_mb * .750061683),
    windSpeedKph: weather.current.wind_kph, windDirection: weather.current.wind_degree, gustKph: weather.current.gust_kph,
    visibilityMeters: weather.current.vis_km * 1000,
  } };
}

async function prepareContext(browser, viewport, options = {}, routeOrigin = origin) {
  const { qaLocation, ...contextOptions } = options;
  const context = await browser.newContext({
    viewport,
    hasTouch: viewport.width < 500,
    isMobile: viewport.width < 500 && browser.browserType().name() !== 'firefox',
    deviceScaleFactor: viewport.width < 500 ? 2 : 1,
    locale: 'ru-RU',
    serviceWorkers: 'block',
    ...contextOptions,
  });
  const network = { engine: browser.browserType().name(), blockedExternal: [], blockedMutations: [], fixtureWeatherRequests: 0, fixtureSolarRequests: 0,
    requests: [], nativeEvents: [] };
  const requests = new Map();
  const requestRecord = request => {
    if (!requests.has(request)) requests.set(request, { url: request.url(), resourceType: request.resourceType(), at: Date.now() });
    return requests.get(request);
  };
  if (trackNetwork) {
    context.on('request', request => {
      const record = requestRecord(request);
      network.requests.push(record);
    });
    context.on('requestfailed', request => Object.assign(requestRecord(request), { failedAt: Date.now(), failure: request.failure()?.errorText }));
    context.on('requestfinished', request => Object.assign(requestRecord(request), { finishedAt: Date.now() }));
    context.on('response', response => Object.assign(requestRecord(response.request()), { status: response.status(),
      responseCors: response.headers()['access-control-allow-origin'] || null }));
    await context.exposeBinding('__starfallNativeRecord', (_source, record) => network.nativeEvents.push(record));
  }
  const controls = { critical: null, weather: null, entranceCritical: null, weatherData: null, pawAtlas: null, failAtlas: false,
    failLoader: false, moonModule: null, moonMaps: null, moonModuleRequests: 0, moonMapRequests: 0 };
  await context.addInitScript(({ trackNetwork, qaLocation }) => {
    if (trackNetwork) {
      const documentUrl = location.href;
      const report = record => window.__starfallNativeRecord({ documentUrl, wall: Date.now(), ...record }).catch(() => {});
      window.addEventListener('error', event => {
        if (typeof event.message === 'string') report({ kind: 'error', message: event.message, filename: event.filename, stack: event.error?.stack || '' });
      });
      window.addEventListener('unhandledrejection', event => report({ kind: 'unhandledrejection', message: String(event.reason?.message || event.reason), stack: event.reason?.stack || '' }));
      const originalFetch = window.fetch;
      window.fetch = function (...args) {
        try {
          const url = new URL(args[0]?.url || String(args[0]), location.href);
          if (url.hostname === 'api.sunrise-sunset.org' || url.pathname === '/api/weather') {
            report({ kind: 'fetch-call', url: url.href, stack: new Error('QA fetch initiation').stack });
          }
        } catch {}
        // Return the untouched original promise; telemetry must not mark a rejection handled.
        return originalFetch.apply(this, args);
      };
    }
    try {
      localStorage.setItem('hundesalon_cookie_consent', JSON.stringify({ essential: true, analytics: false, version: 1, decidedAt: new Date().toISOString() }));
      localStorage.setItem('preferred_lang', location.pathname.split('/')[1]);
    } catch {}
    Object.defineProperty(navigator, 'geolocation', { value: {
      getCurrentPosition(success, error) {
        setTimeout(() => qaLocation ? success({ coords: { ...qaLocation, accuracy: 5 }, timestamp: Date.now() }) : error?.({ code: 1, message: 'Isolated QA fixture' }), 0);
      },
      watchPosition() { return 1; },
      clearWatch() {},
    } });
    window.__starfallLongTasks = [];
    const glStats = { calls: 0, wrappedMethods: [], contexts: [] };
    window.__starfallGlStats = glStats;
    const wrappers = new WeakMap();
    const contexts = new WeakMap();
    for (const [name, prototype] of [
      ['WebGL', window.WebGLRenderingContext?.prototype],
      ['WebGL2', window.WebGL2RenderingContext?.prototype],
    ]) {
      if (!prototype) continue;
      for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
        const original = prototype[method];
        if (typeof original !== 'function') continue;
        let wrapped = wrappers.get(original);
        if (!wrapped) {
          wrapped = function (...args) {
            glStats.calls++;
            let context = contexts.get(this);
            if (!context) {
              const canvas = this.canvas;
              context = { id: glStats.contexts.length, calls: 0, canvasClass: canvas?.className || '',
                shadowHostClass: canvas?.getRootNode?.()?.host?.className || '',
                overlayClass: canvas?.closest?.('.weather-orb-overlay')?.className || '' };
              contexts.set(this, context);
              glStats.contexts.push(context);
            }
            context.calls++;
            if (glStats.trace) {
              if (glStats.trace.events.length < 128) glStats.trace.events.push({ at: performance.now(), context: context.id,
                hiddenHeader: document.body?.classList.contains('hide-header') || false,
                opaqueEntrance: document.documentElement.classList.contains('site-loading') });
              else glStats.trace.dropped++;
            }
            return original.apply(this, args);
          };
          wrappers.set(original, wrapped);
          wrappers.set(wrapped, wrapped);
        }
        try {
          prototype[method] = wrapped;
          glStats.wrappedMethods.push(`${name}.${method}`);
        } catch {}
      }
    }
    if (typeof PerformanceObserver === 'function') {
      try {
        new window.PerformanceObserver(list => window.__starfallLongTasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration })))).observe({ type: 'longtask', buffered: true });
      } catch {}
    }
  }, { trackNetwork, qaLocation });
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const record = trackNetwork ? requestRecord(request) : {};
    if (!['GET', 'HEAD'].includes(request.method())) {
      network.blockedMutations.push({ method: request.method(), pathname: url.pathname });
      record.action = 'blocked-mutation';
      return route.abort();
    }
    if (url.pathname === '/api/weather' && (url.origin === routeOrigin || ['hundesalon-nika.com', 'www.hundesalon-nika.com'].includes(url.hostname))) {
      network.fixtureWeatherRequests++;
      record.action = 'fixture-weather';
      record.fulfillCors = routeOrigin;
      if (controls.weatherData) await controls.weatherData.promise;
      return route.fulfill({ headers: { 'Access-Control-Allow-Origin': routeOrigin, 'Access-Control-Allow-Credentials': 'true' }, json: weatherResponse(url) });
    }
    if (url.hostname === 'api.sunrise-sunset.org' && url.pathname === '/json') {
      const solar = calculateSolarDay(url.searchParams.get('date'), url.searchParams.get('tzid') || 'UTC',
        Number(url.searchParams.get('lat')), Number(url.searchParams.get('lng')));
      const iso = value => Number.isFinite(value) ? new Date(value).toISOString() : null;
      network.fixtureSolarRequests++;
      record.action = 'fixture-solar-model';
      record.fulfillCors = routeOrigin;
      return route.fulfill({ headers: { 'Access-Control-Allow-Origin': routeOrigin }, json: {
        status: 'OK', qaFixture: 'Calculated by the repository solar model, not a live observation',
        results: { sunrise: iso(solar.sunrise), sunset: iso(solar.sunset), solar_noon: iso(solar.solarNoon),
          civil_twilight_begin: iso(solar.civilTwilightBegin), civil_twilight_end: iso(solar.civilTwilightEnd) },
      } });
    }
    if (url.origin !== routeOrigin) {
      if (!network.blockedExternal.includes(url.hostname)) network.blockedExternal.push(url.hostname);
      record.action = 'blocked-external';
      return route.abort();
    }
    if (url.pathname === '/assets/js/local-dev-refresh.js') return route.fulfill({ body: '// isolated QA' });
    if (controls.failLoader && /^\/assets\/(?:js|css)\/site-loader\.(?:js|css)$/.test(url.pathname)) return route.abort();
    if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { error: 'Isolated static QA: API is unavailable' } });
    if (controls.critical && url.pathname === '/assets/js/price-page-data.js') await controls.critical.promise;
    if (controls.entranceCritical && url.pathname === '/assets/js/price-booking.js') {
      controls.entranceCritical.heldAt ??= Date.now();
      controls.entranceCritical.onHeld?.();
      await controls.entranceCritical.promise;
    }
    if (url.pathname === '/assets/images/preloader/paws-atlas-v1.webp') {
      if (controls.failAtlas) { record.action = 'fixture-atlas-network-error'; return route.abort(); }
      if (controls.pawAtlas) await controls.pawAtlas.promise;
    }
    if (controls.weather && url.pathname.endsWith(`/${previewModule}`)) await controls.weather.promise;
    if (controls.moonModule && url.pathname === '/assets/js/header-weather-moon-scene.js') {
      controls.moonModuleRequests++;
      await controls.moonModule.promise;
    }
    if (controls.moonMaps && /\/assets\/images\/weather\/moon-(?:albedo\.webp|height\.png)$/.test(url.pathname)) {
      controls.moonMapRequests++;
      await controls.moonMaps.promise;
    }
    record.action ||= 'local-static';
    return route.continue();
  });
  return { context, network, controls };
}

async function awaitReady(page) {
  await page.waitForFunction(() => document.documentElement.dataset.siteReady === 'true', null, { timeout: 7500, polling: 50 });
  await page.locator('#preloader').waitFor({ state: 'detached', timeout: 1500 });
}

async function geometry(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.site-scroll-root') || document.scrollingElement;
    return { width: window.innerWidth, rootWidth: root.clientWidth, rootScrollWidth: root.scrollWidth, rootHeight: root.clientHeight,
      cards: document.querySelectorAll('.price-card').length, siteReady: document.documentElement.dataset.siteReady,
      priceReady: document.documentElement.dataset.priceReady,
      runningAnimations: document.getAnimations().filter(animation => animation.playState === 'running').length,
      pausedAnimations: document.getAnimations().filter(animation => animation.playState === 'paused').length,
      navigation: performance.getEntriesByType('navigation').map(entry => ({ domContentLoaded: entry.domContentLoadedEventEnd, load: entry.loadEventEnd, transferSize: entry.transferSize })),
    };
  });
}

async function scrollFrames(page) {
  return page.evaluate(() => new Promise(resolve => {
    const root = document.querySelector('.site-scroll-root') || document.scrollingElement;
    const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
    const frames = [];
    let fallbackFrames = 0;
    let nativeFrames = 0;
    let start;
    let previous;
    const tick = now => {
      start ??= now;
      if (previous !== undefined) {
        frames.push(now - previous);
        if (root.dataset.scrollBudget === 'balanced') fallbackFrames++;
        else nativeFrames++;
      }
      previous = now;
      const progress = Math.min(1, (now - start) / 4000);
      root.scrollTop = maxScroll * progress;
      if (progress < 1) return requestAnimationFrame(tick);
      const sorted = [...frames].sort((a, b) => a - b);
      const total = frames.reduce((sum, value) => sum + value, 0);
      resolve({ durationMs: now - start, frames: frames.length, meanIntervalMs: total / frames.length,
        medianIntervalMs: sorted[Math.floor(sorted.length / 2)], p95IntervalMs: sorted[Math.floor(sorted.length * 0.95)],
        maxIntervalMs: Math.max(...frames), intervalsOver50Ms: frames.filter(value => value > 50).length,
        approximateRafRate: frames.length * 1000 / total, scrollDistance: root.scrollTop,
        fallbackFrames, nativeFrames,
        longTasks: (window.__starfallLongTasks || []).filter(entry => entry.start >= start),
      });
    };
    root.scrollTop = 0;
    requestAnimationFrame(tick);
  }));
}

async function functionalPrice(page) {
  const initial = await page.locator('.price-card').count();
  assert.ok(initial > 10, 'the full price catalogue is rendered');
  await page.evaluate(() => { window.__starfallFirstCard = document.querySelector('.price-card'); });
  await page.locator('[data-price-breed-search-input]').fill('п');
  await page.waitForTimeout(180);
  assert.equal(await page.evaluate(() => window.__starfallFirstCard === document.querySelector('.price-card')), true, 'below-threshold search reuses cards');
  await page.locator('[data-price-breed-search-input]').fill('пудель');
  await page.waitForFunction(count => document.querySelectorAll('.price-card').length > 0 && document.querySelectorAll('.price-card').length < count, initial);
  const searchCards = await page.locator('.price-card').count();
  await page.locator('[data-price-breed-search-input]').fill('');
  await page.waitForFunction(count => document.querySelectorAll('.price-card').length === count, initial);
  const animal = page.locator('[data-price-search-filter="animal"]');
  const catValue = await animal.evaluate(select => [...select.options].find(option => /cat/.test(option.value))?.value);
  assert.ok(catValue, 'cat filter is available');
  await animal.selectOption(catValue, { force: true });
  await page.waitForFunction(count => document.querySelectorAll('.price-card').length < count, initial);
  const filteredCards = await page.locator('.price-card').count();
  await animal.selectOption('all', { force: true });
  await page.waitForFunction(count => document.querySelectorAll('.price-card').length === count, initial);
  await page.evaluate(() => { window.__starfallFirstCard = document.querySelector('.price-card'); });
  await page.locator('[data-price-categories-action][data-price-section-action="cats"]').click();
  assert.equal(await page.evaluate(() => window.__starfallFirstCard === document.querySelector('.price-card')), true, 'category navigation retains the catalogue DOM');
  await page.waitForTimeout(550);
  return { initialCards: initial, searchCards, filteredCards, categoryReusedCards: true };
}

async function nativePageWheel(page) {
  await page.evaluate(() => document.querySelector('.site-scroll-root')?.scrollTo({ top: 0, behavior: 'instant' }));
  const bounds = await page.locator('[data-price-hero]').boundingBox();
  assert.ok(bounds, 'page hero is present for a main-page wheel gesture');
  const viewport = page.viewportSize();
  if (page.context().browser().browserType().name() === 'webkit' && viewport.width < 500) {
    await page.evaluate(() => document.querySelector('.site-scroll-root').scrollTo({ top: 720, behavior: 'instant' }));
    await page.waitForFunction(() => document.querySelector('.site-scroll-root').scrollTop > 0);
    return { status: 'unsupported-mobile-webkit', nativeWheelVerified: false,
      reason: 'Playwright mobile WebKit does not support mouse.wheel; this lifecycle-only scroll is programmatic.',
      scrollTop: await page.locator('.site-scroll-root').evaluate(root => root.scrollTop) };
  }
  await page.mouse.move(bounds.x + bounds.width / 2, Math.min(viewport.height - 40, Math.max(140, bounds.y + 130)));
  const observed = page.evaluate(() => new Promise(resolve => {
    const timer = window.setTimeout(() => resolve({ timedOut: true }), 2000);
    document.addEventListener('wheel', event => {
      window.setTimeout(() => {
        window.clearTimeout(timer);
        resolve({ defaultPrevented: event.defaultPrevented, trusted: event.isTrusted,
          targetInMainPage: Boolean(event.target.closest('[data-price-page]')),
          targetInPrivateScrollPanel: Boolean(event.target.closest('.site-select__menu, [data-price-breeds-menu], .modal, .weather-header-dropdown')),
          scrollRootClass: document.querySelector('.site-scroll-root')?.className || '',
        });
      }, 0);
    }, { once: true, passive: true });
  })).then(value => ({ value }), error => ({ error }));
  await page.mouse.wheel(0, 720);
  const observation = await observed;
  if (observation.error) throw observation.error;
  const result = observation.value;
  assert.equal(result.timedOut, undefined, 'native wheel event reached the page');
  assert.equal(result.trusted, true);
  assert.equal(result.targetInMainPage, true, 'the wheel gesture targets the main price page');
  assert.equal(result.targetInPrivateScrollPanel, false, 'the native-wheel assertion does not cover intentional panel inertia');
  assert.match(result.scrollRootClass, /(?:^|\s)site-scroll-root(?:\s|$)/);
  assert.equal(result.defaultPrevented, false, 'main-page wheel keeps the native browser scroll path');
  await page.waitForFunction(() => document.querySelector('.site-scroll-root').scrollTop > 0, null, { timeout: 2500 });
  result.scrollTop = await page.locator('.site-scroll-root').evaluate(root => root.scrollTop);
  return result;
}

async function heldLoaderKeyboard(page) {
  const focusState = () => page.evaluate(() => {
    const active = document.activeElement;
    return { insideLoader: Boolean(active?.closest('#preloader')),
      backgroundInteractive: Boolean(active?.matches('a, button, input, select, textarea, [tabindex]') && !active.closest('#preloader')),
      insideAriaHidden: Boolean(active?.closest('[aria-hidden="true"]')) };
  });
  await page.locator('#preloader.site-loader').waitFor({ state: 'visible' });
  const presentation = await page.locator('#preloader.site-loader').evaluate(overlay => ({
    text: overlay.textContent.trim(), controls: overlay.querySelectorAll('a,button,input,select,textarea,[tabindex]').length,
    role: overlay.getAttribute('role'), label: overlay.getAttribute('aria-label'),
  }));
  assert.equal(presentation.text, '', 'the global entrance presents no visible text');
  assert.equal(presentation.controls, 0, 'the global entrance presents no button or other control');
  assert.equal(presentation.role, 'status');
  assert.ok(presentation.label, 'screen-reader-only loading status remains available');
  const tabStates = [];
  for (let index = 0; index < 3; index++) {
    await page.keyboard.press('Tab');
    const state = await focusState();
    tabStates.push(state);
    assert.equal(state.backgroundInteractive, false, 'Tab cannot enter interactive page content under the opaque entrance');
  }
  await page.evaluate(() => window.NikaSiteLoader.finish('skip'));
  const afterActivation = await focusState();
  assert.equal(afterActivation.insideLoader, false, 'the service lifecycle API leaves focus outside the decorative scene');
  assert.equal(afterActivation.insideAriaHidden, false);
  await awaitLoaderOutcome(page);
  const ready = await page.evaluate(() => ({ bodyLoaded: document.body.classList.contains('site-loaded'),
    footerVisibility: getComputedStyle(document.querySelector('footer')).visibility,
    loadingClass: document.documentElement.classList.contains('site-loading') }));
  assert.equal(ready.bodyLoaded, true);
  assert.equal(ready.loadingClass, false);
  assert.equal(ready.footerVisibility, 'visible', 'ready content restores its normal visibility');
  return { presentation, tabStates, afterActivation, ready, status: 'passed',
    cleanupMethod: 'Test-only NikaSiteLoader.finish("skip") lifecycle call; no visible skip button exists.' };
}

async function installPaintSnapshot(page) {
  await page.evaluate(() => {
    window.__starfallPaintSnapshot = () => {
      const root = document.querySelector('.site-scroll-root');
      const budgetRootSelector = "body.price-page:not(:is(.nav-open, .header-weather-expanded, .price-modal-open, .booking-modal-open, .price-breed-menu-open)) .site-scroll-root[data-scroll-budget='balanced'].site-scroll-active";
      const budgetScope = `${budgetRootSelector} :is(main[data-price-page], .header, .newsletter-section, footer)`;
      const selectors = { hero: '[data-price-hero]', heading: '[data-price-hero] h1', card: '.price-card', cardHeading: '.price-card__title' };
      const elements = Object.fromEntries(Object.entries(selectors).map(([name, selector]) => {
        const element = document.querySelector(selector);
        if (!element) return [name, null];
        const style = getComputedStyle(element);
        return [name, {
          width: element.offsetWidth, height: element.offsetHeight,
          fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight,
          lineHeight: style.lineHeight, letterSpacing: style.letterSpacing,
          matchesBudgetScope: element.matches(`${budgetScope}, ${budgetScope} *`),
          inMain: Boolean(element.closest('main[data-price-page]')), insideScrollRoot: root.contains(element),
          inlineBoxShadowPriority: element.style.getPropertyPriority('box-shadow'),
          paint: Object.fromEntries(['filter', 'backdropFilter', 'webkitBackdropFilter', 'boxShadow', 'textShadow',
            'backgroundImage', 'backgroundClip', 'webkitBackgroundClip', 'webkitTextFillColor', 'color',
            'webkitTextStrokeWidth', 'animationPlayState'].map(property => [property, style[property] || ''])),
        }];
      }));
      const matchedCardShadowRules = [];
      if (root.dataset.scrollBudget === 'balanced') {
        const card = document.querySelector('.price-card');
        const visit = (rules, source) => {
          for (const rule of rules) {
            if (rule.selectorText && rule.style?.getPropertyValue('box-shadow') && card.matches(rule.selectorText)) {
              matchedCardShadowRules.push({ selector: rule.selectorText, value: rule.style.getPropertyValue('box-shadow'), priority: rule.style.getPropertyPriority('box-shadow'), source });
            }
            if (rule.cssRules) visit(rule.cssRules, source);
          }
        };
        for (const sheet of document.styleSheets) {
          try { visit(sheet.cssRules, sheet.href?.split('?')[0] || 'inline'); } catch {}
        }
      }
      return { flag: root.dataset.scrollBudget || null, active: root.classList.contains('site-scroll-active'),
        rootMatchesBudgetSelector: root.matches(budgetRootSelector), bodyClass: document.body.className,
        cards: document.querySelectorAll('.price-card').length, elements, matchedCardShadowRules };
    };
  });
}

async function scrollToTopAndWaitIdle(page) {
  await page.evaluate(() => new Promise(resolve => {
    const root = document.querySelector('.site-scroll-root');
    window.__starfallQuietSince = null;
    if (root.scrollTop === 0) return resolve();
    const timer = window.setTimeout(done, 3500);
    function done() {
      if (root.scrollTop !== 0) return;
      window.clearTimeout(timer);
      root.removeEventListener('scroll', done);
      resolve();
    }
    root.addEventListener('scroll', done, { passive: true });
    root.scrollTo({ top: 0, behavior: 'instant' });
  }));
  await page.waitForFunction(() => {
    const root = document.querySelector('.site-scroll-root');
    if (root.scrollTop !== 0 || root.classList.contains('site-scroll-active') || root.hasAttribute('data-scroll-budget')) {
      window.__starfallQuietSince = null;
      return false;
    }
    window.__starfallQuietSince ??= performance.now();
    return performance.now() - window.__starfallQuietSince >= 650;
  }, null, { timeout: 8000, polling: 50 });
}

async function adaptivePaintLifecycle(page, screenshotPath, result) {
  await installPaintSnapshot(page);
  await scrollToTopAndWaitIdle(page);
  const baseline = await page.evaluate(() => window.__starfallPaintSnapshot());
  result.baseline = baseline;
  try {
    await page.evaluate(() => {
      const root = document.querySelector('.site-scroll-root');
      window.__starfallKeepScrolling = true;
      window.__starfallScrollFixture = { eventCount: 0, lastScrollAt: null };
      window.__starfallFixtureScrollListener = () => {
        window.__starfallScrollFixture.eventCount++;
        window.__starfallScrollFixture.lastScrollAt = performance.now();
      };
      root.addEventListener('scroll', window.__starfallFixtureScrollListener, { passive: true });
      window.__starfallPulseTimer = window.setInterval(() => {
        if (window.__starfallKeepScrolling) root.scrollTop += 3;
      }, 50);
      let steps = 0;
      const pulse = () => {
        if (!window.__starfallKeepScrolling || steps >= 7) return;
        // A separate labelled edge test simulates a busy device; raw frame samples never use this work.
        if (steps++ < 7) {
          const end = performance.now() + 45;
          while (performance.now() < end) { /* bounded slow-frame fixture */ }
        }
        window.requestAnimationFrame(pulse);
      };
      window.requestAnimationFrame(pulse);
    });
    await page.waitForFunction(() => document.querySelector('.site-scroll-root').dataset.scrollBudget === 'balanced', null, { timeout: 8000 });
    result.firstDuring = await page.evaluate(() => window.__starfallPaintSnapshot());
    // The authored card box-shadow transition lasts 420ms and remains intact in the fallback.
    await page.waitForTimeout(500);
    result.after500ms = await page.evaluate(() => window.__starfallPaintSnapshot());
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.price-card')).boxShadow === 'none', null,
      { timeout: 2500, polling: 'raf' });
    const during = await page.evaluate(() => window.__starfallPaintSnapshot());
    result.during = during;
    result.fixtureDuring = await page.evaluate(() => ({ ...window.__starfallScrollFixture }));
    assert.equal(during.active, true);
    assert.equal(during.cards, baseline.cards);
    for (const name of Object.keys(baseline.elements)) {
      const before = baseline.elements[name];
      const current = during.elements[name];
      assert.ok(before && current, `${name} is present throughout the fallback`);
      for (const property of ['width', 'height', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing']) {
        assert.equal(current[property], before[property], `${name}.${property} remains unchanged by the paint fallback`);
      }
      for (const property of ['filter', 'backdropFilter', 'boxShadow', 'textShadow']) {
        assert.equal(current.paint[property], 'none', `${name}.${property} uses the bounded scroll paint fallback`);
      }
      assert.equal(current.paint.animationPlayState, 'paused', `${name} pauses paint animation only while scrolling`);
    }
    await page.screenshot({ path: screenshotPath });
    const idleStarted = Date.now();
    await page.evaluate(() => {
      window.__starfallKeepScrolling = false;
      window.clearInterval(window.__starfallPulseTimer);
    });
    await scrollToTopAndWaitIdle(page);
    result.firstIdle = await page.evaluate(() => window.__starfallPaintSnapshot());
    await page.waitForFunction(expected => {
      const current = window.__starfallPaintSnapshot();
      return current.flag === null && !current.active && JSON.stringify(current.elements) === JSON.stringify(expected);
    }, baseline.elements, { timeout: Math.max(1, 8000 - (Date.now() - idleStarted)), polling: 50 });
    const idle = await page.evaluate(() => window.__starfallPaintSnapshot());
    result.idle = idle;
    assert.equal(idle.flag, null);
    assert.equal(idle.cards, baseline.cards);
    assert.deepEqual(idle.elements, baseline.elements, 'all sampled font, geometry and paint properties restore after scrolling');
    return { baseline, during, idle, status: 'passed', trigger: 'labelled seven-frame 45ms busy-device fixture; excluded from raw RAF measurements' };
  } finally {
    await page.evaluate(() => {
      window.__starfallKeepScrolling = false;
      window.clearInterval(window.__starfallPulseTimer);
      document.querySelector('.site-scroll-root').removeEventListener('scroll', window.__starfallFixtureScrollListener);
    }).catch(() => {});
  }
}

async function glDrawDelta(page, duration = 1000) {
  const before = await page.evaluate(() => window.__starfallGlStats.calls);
  await page.waitForTimeout(duration);
  return (await page.evaluate(() => window.__starfallGlStats.calls)) - before;
}

async function waitForNextDraw(page) {
  const before = await page.evaluate(() => window.__starfallGlStats.calls);
  const started = Date.now();
  await page.waitForTimeout(600);
  const initialDrawCalls = (await page.evaluate(() => window.__starfallGlStats.calls)) - before;
  if (!initialDrawCalls) {
    await page.waitForFunction(previous => window.__starfallGlStats.calls > previous, before,
      { timeout: Math.max(1, 3000 - (Date.now() - started)), polling: 50 });
  }
  return { initialWindowMs: 600, initialDrawCalls,
    drawCalls: (await page.evaluate(() => window.__starfallGlStats.calls)) - before,
    elapsedMs: Date.now() - started, deadlineMs: 3000 };
}

async function glDrawSample(page, duration = 1000) {
  const before = await page.evaluate(() => window.__starfallGlStats.contexts.map(context => ({ ...context })));
  await page.waitForTimeout(duration);
  const after = await page.evaluate(() => window.__starfallGlStats.contexts.map(context => ({ ...context })));
  const contexts = after.map(context => ({ ...context, calls: context.calls - (before.find(previous => previous.id === context.id)?.calls || 0) }));
  return { calls: contexts.reduce((sum, context) => sum + context.calls, 0), contexts };
}

async function weatherRenderLifecycle(page, nativeWheel, requireDrawing, result) {
  const visibleDrawCalls = await glDrawDelta(page);
  Object.assign(result, { visibleDrawCalls, intervalMs: 1000,
    sampleContract: 'All five consecutive one-second hidden samples are retained. The first three diagnose finite transition activity; the last two must both contain exactly zero WebGL draws. Source/unit checks cover immediate cancellation of authored loops.',
    samplePhases: ['transition', 'transition', 'transition', 'steady', 'steady'],
    entrancePreSampleSettleMs: 300, headerPreSampleSettleMs: 800,
    wrappedMethods: await page.evaluate(() => window.__starfallGlStats.wrappedMethods) });
  if (requireDrawing) assert.ok(visibleDrawCalls > 0, 'hardware Chromium weather scene must be drawing before the lifecycle probe');
  if (!visibleDrawCalls) return { ...result, status: 'no-active-WebGL-drawing', nativeWheel: await nativeWheel() };
  try {
    // Exercise the public loading state against an already-created renderer.
    await page.evaluate(() => document.documentElement.classList.add('site-loading'));
    await page.waitForTimeout(300);
    result.opaqueEntranceSamples = [];
    for (let index = 0; index < 5; index++) result.opaqueEntranceSamples.push(await glDrawSample(page));
    result.opaqueEntranceDrawCalls = result.opaqueEntranceSamples[0].calls;
    result.opaqueEntranceTransitionalDrawCalls = result.opaqueEntranceSamples[0].calls;
    result.opaqueEntranceStableDrawCalls = result.opaqueEntranceSamples[3].calls;
    result.opaqueEntranceFinalStableDrawCalls = result.opaqueEntranceSamples[4].calls;
    assert.equal(result.opaqueEntranceStableDrawCalls, 0, 'the existing renderer stops throughout the first steady opaque sample');
    assert.equal(result.opaqueEntranceFinalStableDrawCalls, 0, 'the existing renderer remains stopped throughout the next steady opaque sample');
  } finally {
    await page.evaluate(() => document.documentElement.classList.remove('site-loading'));
  }
  await page.waitForTimeout(300);
  result.afterEntranceResume = await waitForNextDraw(page);
  result.afterEntranceDrawCalls = result.afterEntranceResume.drawCalls;
  assert.ok(result.afterEntranceDrawCalls > 0, 'weather rendering resumes after the entrance state clears');
  result.nativeWheel = await nativeWheel();
  await page.waitForFunction(() => document.body.classList.contains('hide-header'), null, { timeout: 2500 });
  await page.waitForTimeout(800);
  result.hiddenHeaderSamples = [];
  for (let index = 0; index < 5; index++) result.hiddenHeaderSamples.push(await glDrawSample(page));
  result.hiddenHeaderDrawCalls = result.hiddenHeaderSamples[0].calls;
  result.hiddenHeaderTransitionalDrawCalls = result.hiddenHeaderSamples[0].calls;
  result.hiddenHeaderStableDrawCalls = result.hiddenHeaderSamples[3].calls;
  result.hiddenHeaderFinalStableDrawCalls = result.hiddenHeaderSamples[4].calls;
  assert.equal(result.hiddenHeaderStableDrawCalls, 0, 'the weather scene stops throughout the first steady collapsed-header sample');
  assert.equal(result.hiddenHeaderFinalStableDrawCalls, 0, 'the weather scene remains stopped throughout the next steady collapsed-header sample');
  await page.evaluate(() => document.querySelector('.site-scroll-root').scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForFunction(() => !document.body.classList.contains('hide-header'), null, { timeout: 2500 });
  await page.waitForTimeout(300);
  result.restoredHeaderResume = await waitForNextDraw(page);
  result.restoredHeaderDrawCalls = result.restoredHeaderResume.drawCalls;
  assert.ok(result.restoredHeaderDrawCalls > 0, 'restoring the header resumes its weather scene');
  return { ...result, status: 'passed' };
}

async function diagnoseFrames(browser) {
  const setup = await prepareContext(browser, { width: 1440, height: 900 });
  const page = await setup.context.newPage();
  try {
    await page.goto('about:blank');
    const blankBefore = await scrollFrames(page);
    await page.goto(`${origin}/ru/prays-list.html`, { waitUntil: 'domcontentloaded' });
    await awaitReady(page);
    await page.waitForFunction(() => document.querySelector('.header-weather-widget')?.__weatherWidgetInstance?.getState?.()?.weather?.current?.temp_c === 7, null, { timeout: 15000 });
    await page.waitForTimeout(1800);
    const normalGeometry = await geometry(page);
    const normalPrice = await scrollFrames(page);
    // Diagnostic isolation only: no shipped source is modified by this comparison.
    await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }' });
    await page.evaluate(() => {
      document.querySelector('.header-weather-shell')?.remove();
      document.getAnimations().forEach(animation => animation.cancel());
    });
    await page.waitForTimeout(350);
    const noMotionGeometry = await geometry(page);
    const motionAndWeatherDisabled = await scrollFrames(page);
    await page.goto('about:blank');
    const blankAfter = await scrollFrames(page);
    return { blankBefore, normalGeometry, normalPrice, noMotionGeometry, motionAndWeatherDisabled, blankAfter,
      scope: 'Same headless browser/context/page; normal current build versus temporary QA-only animation/transition disable and weather host removal; bracketing blank pages measure host scheduling.' };
  } finally {
    await setup.context.close();
  }
}

async function compareScrollBudget(browser) {
  const cases = [];
  for (const forcedFullPaint of [true, false]) {
    const setup = await prepareContext(browser, { width: 1440, height: 900 });
    const page = await setup.context.newPage();
    try {
      await page.goto(`${origin}/ru/prays-list.html`, { waitUntil: 'domcontentloaded' });
      await awaitReady(page);
      await page.waitForFunction(() => document.querySelector('.header-weather-widget')?.__weatherWidgetInstance?.getState?.()?.weather?.current?.temp_c === 7, null, { timeout: 15000 });
      await page.waitForFunction(() => Array.from(document.styleSheets).some(sheet => sheet.href?.includes('/motion-visibility.css')));
      await page.waitForTimeout(1800);
      const removedSelectors = forcedFullPaint ? await page.evaluate(() => {
        const removed = [];
        const sheet = Array.from(document.styleSheets).find(candidate => candidate.href?.includes('/motion-visibility.css'));
        const removeBudgetRules = owner => {
          for (let index = owner.cssRules.length - 1; index >= 0; index--) {
            const rule = owner.cssRules[index];
            if (rule.selectorText?.includes('[data-scroll-budget')) {
              removed.push(rule.selectorText);
              owner.deleteRule(index);
            } else if (rule.cssRules) {
              removeBudgetRules(rule);
            }
          }
        };
        removeBudgetRules(sheet);
        return removed;
      }) : [];
      if (forcedFullPaint) assert.ok(removedSelectors.length > 0, 'the baseline removes only the adaptive paint CSS rules');
      await installPaintSnapshot(page);
      const before = await page.evaluate(() => window.__starfallPaintSnapshot());
      const frames = await scrollFrames(page);
      const after = await page.evaluate(() => {
        // Test-only style assertion, after the raw frame sample has ended.
        const root = document.querySelector('.site-scroll-root');
        root.classList.add('site-scroll-active');
        root.dataset.scrollBudget = 'balanced';
        return window.__starfallPaintSnapshot();
      });
      if (forcedFullPaint) {
        for (const name of Object.keys(before.elements)) {
          for (const property of ['filter', 'backdropFilter', 'boxShadow', 'textShadow', 'backgroundImage', 'color', 'webkitTextFillColor']) {
            assert.equal(after.elements[name].paint[property], before.elements[name].paint[property], `${name}.${property} retains full paint even while the monitor flag is balanced`);
          }
        }
      }
      cases.push({ forcedFullPaint, removedSelectors, before, after, frames,
        styleProbeForcedBalancedAfterMeasurement: true });
    } finally {
      await setup.context.close();
    }
  }
  const geometryOf = snapshot => Object.fromEntries(Object.entries(snapshot.elements).map(([name, element]) => [name,
    Object.fromEntries(['width', 'height', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'].map(property => [property, element[property]]))]));
  assert.deepEqual(geometryOf(cases[0].before), geometryOf(cases[1].before), 'fresh-context full-paint and adaptive cases share the same layout and fonts');
  assert.equal(cases[0].before.cards, cases[1].before.cards);
  return { cases, geometryEquivalent: true,
    observedRafRateRatio: cases[1].frames.approximateRafRate / cases[0].frames.approximateRafRate,
    scope: 'Same production build and hardware browser; separate fresh contexts; baseline deletes only CSS rules containing [data-scroll-budget] from motion-visibility.css. Visibility IO, monitor, weather and all other features remain installed. Forced-balanced computed-style probe runs after each raw measurement.' };
}

async function checkEntryPages(browser) {
  const cases = [];
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const setup = await prepareContext(browser, viewport);
    const page = await setup.context.newPage();
    const entry = { scenario: 'localized-production-homes', viewport, homes: [], errors: [], status: 'running' };
    cases.push(entry);
    page.on('pageerror', error => {
      entry.errors.push(error.message);
      (entry.rawPageErrors ||= []).push({ name: error.name, message: error.message, stack: error.stack, at: Date.now() });
    });
    try {
      for (const locale of ['ru', 'uk', 'de', 'en']) {
        await page.goto(`${origin}/${locale}/`, { waitUntil: 'domcontentloaded' });
        await awaitReady(page);
        assert.equal(await page.locator('html').getAttribute('lang'), locale);
        const home = await geometry(page);
        assert.ok(home.rootScrollWidth <= home.rootWidth + 2, `${locale} production home has no horizontal overflow`);
        assert.equal(await page.locator('#preloader').count(), 0);
        entry.homes.push({ locale, ...home });
      }
      entry.status = 'passed';
    } catch (error) {
      entry.status = 'failed';
      entry.failure = error.stack || String(error);
    } finally {
      await setup.context.close();
      attributeEntryNetworkErrors(entry, setup.network);
    }
  }
  const sourceServer = await startStaticTestServer(process.cwd(), { weatherModuleDirectory: 'output/weather-production' });
  const setup = await prepareContext(browser, { width: 390, height: 844 }, {}, new URL(sourceServer.baseUrl).origin);
  const page = await setup.context.newPage();
  const source = { scenario: 'source-preview-pwa-bootstrap', paths: [], errors: [], status: 'running' };
  cases.push(source);
  page.on('pageerror', error => {
    source.errors.push(error.message);
    (source.rawPageErrors ||= []).push({ name: error.name, message: error.message, stack: error.stack, at: Date.now() });
  });
  try {
    for (const pathname of ['/ru/', '/ru/impressum.html']) {
      await page.goto(`${sourceServer.baseUrl}${pathname}`, { waitUntil: 'domcontentloaded' });
      await awaitReady(page);
      assert.equal(await page.locator('#preloader').count(), 0);
      assert.equal(await page.evaluate(() => document.body.classList.contains('site-loaded')), true);
      source.paths.push(pathname);
    }
    source.status = 'passed';
  } catch (error) {
    source.status = 'failed';
    source.failure = error.stack || String(error);
  } finally {
    await setup.context.close();
    attributeEntryNetworkErrors(source, setup.network);
    await sourceServer.close();
  }
  return cases;
}

async function probeHiddenDraws(browser) {
  const samples = [];
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const setup = await prepareContext(browser, viewport);
    const page = await setup.context.newPage();
    const sample = { viewport, errors: [] };
    samples.push(sample);
    page.on('pageerror', error => sample.errors.push(error.message));
    try {
      await page.goto(`${origin}/ru/prays-list.html`, { waitUntil: 'domcontentloaded' });
      await awaitReady(page);
      await page.waitForFunction(() => document.querySelector('.header-weather-widget')?.__weatherWidgetInstance?.getState?.()?.weather?.current?.temp_c === 7, null, { timeout: 15000 });
      await page.waitForTimeout(1800);
      sample.visibleDrawCalls = await glDrawDelta(page);
      await page.evaluate(() => { window.__starfallGlStats.trace = { events: [], dropped: 0 }; });
      sample.scroll = await nativePageWheel(page);
      await page.waitForFunction(() => document.body.classList.contains('hide-header'), null, { timeout: 3000 });
      sample.hiddenObservedAt = await page.evaluate(() => performance.now());
      sample.seconds = [];
      for (let index = 0; index < 5; index++) sample.seconds.push(await glDrawSample(page));
      sample.trace = await page.evaluate(() => {
        const trace = window.__starfallGlStats.trace;
        window.__starfallGlStats.trace = null;
        return trace;
      });
      sample.status = 'recorded';
    } finally {
      await setup.context.close();
    }
  }
  return { samples, scope: 'Read-only attribution probe: actual draw-call timestamps and context IDs for five seconds after the collapsed-header state; no source changes and no lifecycle threshold relaxed.' };
}

async function probeDeadlineState(browser) {
  const setup = await prepareContext(browser, { width: 390, height: 844 });
  const page = await setup.context.newPage();
  const result = { pageErrors: [] };
  page.on('pageerror', error => result.pageErrors.push(error.message));
  setup.controls.critical = gate();
  try {
    await page.goto(`${origin}/ru/prays-list.html`, { waitUntil: 'commit' });
    await page.locator('#preloader').waitFor({ state: 'visible' });
    const started = Date.now();
    try {
      // Preserve the original RAF-polling observation for attribution.
      await page.waitForFunction(() => document.documentElement.dataset.siteReady === 'true', null, { timeout: 7500 });
      result.rafObservation = 'resolved';
    } catch (error) {
      result.rafObservation = 'timed-out';
      result.rafFailure = error.message;
    }
    result.rafElapsedMs = Date.now() - started;
    result.stateAfterRafObservation = await page.evaluate(() => ({
      siteReady: document.documentElement.dataset.siteReady || null,
      apiPresent: Boolean(window.NikaSiteLoader), apiFinishType: typeof window.NikaSiteLoader?.finish,
      hidden: document.hidden, visibilityState: document.visibilityState, readyState: document.readyState,
      rootClass: document.documentElement.className, bodyLoaded: document.body?.classList.contains('site-loaded'),
      overlay: document.querySelector('#preloader') ? { ariaHidden: document.querySelector('#preloader').getAttribute('aria-hidden'), inert: document.querySelector('#preloader').hasAttribute('inert') } : null,
      now: performance.now(), timelineTime: document.timeline?.currentTime,
    }));
    const domStarted = Date.now();
    await page.waitForFunction(() => document.documentElement.dataset.siteReady === 'true', null, { timeout: 7500, polling: 50 });
    result.domObservation = 'resolved';
    result.domElapsedMs = Date.now() - domStarted;
    return result;
  } finally {
    setup.controls.critical.release();
    await setup.context.close();
  }
}

async function visualMoonReadiness(browser, engineName) {
  const setup = await prepareContext(browser, { width: 390, height: 844 });
  const page = await setup.context.newPage();
  const result = { scenario: 'actual-night-fixture-moon-readiness', errors: [], status: 'running',
    sunScope: 'No active daytime Sun is forced; actual night fixture selects the Moon. Shared Sun selectors remain covered by source/unit checks.' };
  page.on('pageerror', error => {
    result.errors.push(error.message);
    (result.rawPageErrors ||= []).push({ name: error.name, message: error.message, stack: error.stack, at: Date.now() });
  });
  setup.controls.moonModule = gate();
  setup.controls.moonMaps = gate();
  const inspect = () => page.evaluate(() => {
    const host = document.querySelector('.header-weather-widget');
    const preview = host.shadowRoot.querySelector('.weather-header-preview');
    const overlay = preview.querySelector('.weather-orb-overlay--preview.is-moon');
    const canvas = overlay.querySelector('.weather-orb-overlay__canvas');
    const before = getComputedStyle(preview, '::before'), after = getComputedStyle(preview, '::after');
    return { moonScene: overlay.dataset.moonScene, moonDetail: canvas.dataset.moonDetail || null,
      hidden: overlay.hidden, active: overlay.classList.contains('is-visible'), canvasHidden: canvas.hidden,
      canvasVisibility: getComputedStyle(canvas).visibility, starsContent: before.content, starsAnimation: before.animationName,
      starOpacity: Math.max(Number(before.opacity), Number(after.opacity)), renderer: canvas.dataset.moonRenderer || null };
  });
  const waitStars = () => page.waitForFunction(() => {
    const preview = document.querySelector('.header-weather-widget')?.shadowRoot?.querySelector('.weather-header-preview');
    return preview && Math.max(Number(getComputedStyle(preview, '::before').opacity), Number(getComputedStyle(preview, '::after').opacity)) > .05;
  }, null, { timeout: 4000, polling: 50 });
  try {
    await page.goto(`${origin}/ru/prays-list.html`, { waitUntil: 'domcontentloaded' });
    await awaitReady(page);
    await page.waitForFunction(() => document.querySelector('.header-weather-widget')?.shadowRoot?.querySelector('.weather-orb-overlay--preview.is-moon.is-visible:not([hidden])')?.dataset.moonScene === 'loading', null, { timeout: 20000, polling: 50 });
    await waitStars();
    result.modulePending = await inspect();
    assert.match(result.modulePending.starsAnimation, /weatherHeaderStarfall/);
    assert.equal(result.modulePending.canvasVisibility, 'hidden');
    assert.ok(setup.controls.moonModuleRequests > 0, 'the module gate actually holds a request');
    await page.locator('.header-weather-widget').screenshot({ path: path.join(output, `${engineName}-moon-module-pending.png`) });
    setup.controls.moonModule.release();
    await page.waitForFunction(() => document.querySelector('.header-weather-widget')?.shadowRoot?.querySelector('.weather-orb-overlay--preview.is-moon .weather-orb-overlay__canvas')?.dataset.moonDetail === 'loading', null, { timeout: 15000, polling: 50 });
    await waitStars();
    result.terrainPending = await inspect();
    assert.equal(result.terrainPending.canvasHidden, false, 'the phase surface exists during the terrain fetch');
    assert.equal(result.terrainPending.canvasVisibility, 'hidden', 'the loading phase surface is visually suppressed');
    assert.match(result.terrainPending.starsAnimation, /weatherHeaderStarfall/);
    assert.ok(setup.controls.moonMapRequests > 0, 'the terrain gate actually holds map requests');
    await page.locator('.header-weather-widget').screenshot({ path: path.join(output, `${engineName}-moon-terrain-pending.png`) });
    await page.waitForFunction(() => !document.querySelector('.header-weather-widget').shadowRoot.querySelector('.weather-app__scene-fallback, .weather-header-state'), null, { timeout: 15000, polling: 50 });
    result.inactiveStateChecks = await page.evaluate(() => {
      const preview = document.querySelector('.header-weather-widget').shadowRoot.querySelector('.weather-header-preview');
      const overlay = preview.querySelector('.weather-orb-overlay--preview.is-moon');
      overlay.hidden = true;
      const hidden = getComputedStyle(preview, '::before').animationName;
      overlay.hidden = false;
      overlay.classList.remove('is-visible');
      const inactive = getComputedStyle(preview, '::before').animationName;
      overlay.classList.add('is-visible');
      return { hidden, inactive, scope: 'Atomic public-state CSS checks, not a fabricated physics or asset failure.' };
    });
    assert.equal(result.inactiveStateChecks.hidden, 'none');
    assert.equal(result.inactiveStateChecks.inactive, 'none');
    setup.controls.moonMaps.release();
    await page.waitForFunction(() => {
      const overlay = document.querySelector('.header-weather-widget').shadowRoot.querySelector('.weather-orb-overlay--preview.is-moon');
      return overlay.dataset.moonScene === 'ready' && overlay.querySelector('canvas').dataset.moonDetail === 'terrain';
    }, null, { timeout: 30000, polling: 50 });
    result.ready = await inspect();
    assert.equal(result.ready.canvasVisibility, 'visible');
    assert.equal(result.ready.starsAnimation, 'none');
    assert.equal(result.ready.renderer, 'native-terrain');
    result.readyPixels = await page.evaluate(() => {
      const canvas = document.querySelector('.header-weather-widget').shadowRoot.querySelector('.weather-orb-overlay--preview.is-moon canvas');
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let opaquePixels = 0, min = 255, max = 0;
      for (let index = 0; index < pixels.length; index += 4) if (pixels[index + 3] > 128) {
        opaquePixels++; min = Math.min(min, pixels[index]); max = Math.max(max, pixels[index]);
      }
      return { opaquePixels, minRed: min, maxRed: max, detail: canvas.dataset.moonDetail };
    });
    assert.ok(result.readyPixels.opaquePixels > 100);
    assert.ok(result.readyPixels.maxRed - result.readyPixels.minRed > 10);
    await page.locator('.header-weather-widget').screenshot({ path: path.join(output, `${engineName}-moon-terrain-ready.png`) });
    result.terminalStateCss = await page.evaluate(() => {
      const preview = document.querySelector('.header-weather-widget').shadowRoot.querySelector('.weather-header-preview');
      const overlay = preview.querySelector('.weather-orb-overlay--preview.is-moon');
      overlay.dataset.moonScene = 'failed';
      const failedAnimation = getComputedStyle(preview, '::before').animationName;
      const failedCanvasVisibility = getComputedStyle(overlay.querySelector('canvas')).visibility;
      overlay.dataset.moonScene = 'ready';
      return { failedAnimation, failedCanvasVisibility, scope: 'Terminal-state CSS contract; network failure lifecycle is covered by source/unit tests.' };
    });
    assert.equal(result.terminalStateCss.failedAnimation, 'none');
    assert.equal(result.terminalStateCss.failedCanvasVisibility, 'visible');
    result.status = 'passed';
  } catch (error) {
    result.status = 'failed';
    result.failure = error.stack || String(error);
    await page.screenshot({ path: path.join(output, `${engineName}-moon-failure.png`) }).catch(() => {});
  } finally {
    setup.controls.moonModule.release(); setup.controls.moonMaps.release();
    await setup.context.close();
    attributeEntryNetworkErrors(result, setup.network);
  }
  return result;
}

function observePageErrors(page, result) {
  page.on('pageerror', error => {
    result.errors.push(error.message);
    (result.rawPageErrors ||= []).push({ name: error.name, message: error.message, stack: error.stack, at: Date.now() });
  });
}

async function awaitLoaderOutcome(page) {
  await page.waitForFunction(() => document.documentElement.dataset.siteReady === 'true', null, { polling: 50, timeout: 16500 });
  const state = await page.evaluate(async () => ({ outcome: await window.NikaSiteLoader.ready,
    overlay: document.querySelector('#preloader')?.outerHTML.slice(0, 500) || null }));
  assert.equal(state.overlay, null, 'the entrance is synchronously detached before readiness is exposed');
  return state.outcome;
}

async function pawMotionTrace(page, duration = 6000) {
  return page.evaluate(async duration => {
    const stage = document.querySelector('.site-loader__scene');
    const paws = [...stage.querySelectorAll('.paw-loader__paw')];
    const originals = new Set(paws), animationIds = new WeakMap();
    let animationId = 0, persistent = true;
    const samples = [], landings = [];
    const key = node => `${node.dataset.animal}/${node.dataset.foot}`;
    const point = transform => { const matrix = new window.DOMMatrixReadOnly(transform); return { x: matrix.e, y: matrix.f }; };
    const observer = new MutationObserver(records => {
      for (const record of records) for (const print of record.addedNodes) {
        if (!print.matches?.('.paw-loader__print')) continue;
        const paw = paws.find(paw => key(paw) === key(print));
        if (!paw) continue;
        const printPoint = point(print.style.transform), pawPoint = point(paw.style.transform);
        landings.push({ at: performance.now(), foot: key(print), print: printPoint, paw: pawPoint,
          distance: Math.hypot(printPoint.x - pawPoint.x, printPoint.y - pawPoint.y) });
      }
    });
    observer.observe(stage, { childList: true });
    const start = performance.now();
    try {
      while (performance.now() - start < duration) {
        const current = [...stage.querySelectorAll('.paw-loader__paw')];
        persistent &&= current.length === originals.size && current.every(node => originals.has(node));
        const activeSpecies = [...stage.querySelectorAll('.paw-loader__animal')].filter(group => !group.hidden && getComputedStyle(group).display !== 'none').map(group => group.dataset.animal);
        samples.push({ at: performance.now() - start, activeSpecies,
          prints: stage.querySelectorAll('.paw-loader__print').length,
          printSpecies: [...new Set([...stage.querySelectorAll('.paw-loader__print')].map(print => print.dataset.animal))],
          paws: current.map(node => {
            const animation = node.getAnimations().find(animation => animation.effect?.target === node);
            if (animation && !animationIds.has(animation)) animationIds.set(animation, ++animationId);
            const style = getComputedStyle(node);
            const bounds = node.getBoundingClientRect();
            const active = activeSpecies.includes(node.dataset.animal);
            return { foot: key(node), active, transform: style.transform, point: point(style.transform),
              visible: bounds.width > 0 && bounds.height > 0 && bounds.right > 0 && bounds.bottom > 0 && bounds.left < window.innerWidth && bounds.top < window.innerHeight,
              animation: animation ? animationIds.get(animation) : null,
              phase: animation?.effect.getComputedTiming().progress ?? null,
              opacity: Number(style.opacity), atlas: getComputedStyle(node, '::before').backgroundImage };
          }) });
        await new Promise(resolve => setTimeout(resolve, 90));
      }
    } finally { observer.disconnect(); }
    const movement = paws.map(node => {
      const id = key(node), history = samples.map(sample => sample.paws.find(paw => paw.foot === id && paw.active)).filter(Boolean);
      const stableStancePairs = history.slice(1).filter((paw, index) => {
        const previous = history[index];
        return paw.animation !== null && paw.animation === previous.animation && paw.phase >= .5 && paw.phase <= .97 &&
          previous.phase >= .5 && previous.phase <= .97 && Math.hypot(paw.point.x - previous.point.x, paw.point.y - previous.point.y) <= .15;
      }).length;
      return { foot: id, activeSamples: history.length, distinctTransforms: new Set(history.map(paw => paw.transform)).size, stableStancePairs };
    });
    let emptySince = null, longestEmptyMs = 0;
    for (const sample of samples) {
      sample.visibleSpecies = [...new Set(sample.paws.filter(paw => paw.active && paw.visible).map(paw => paw.foot.split('/')[0]))];
      if (!sample.visibleSpecies.length) {
        emptySince ??= sample.at;
        longestEmptyMs = Math.max(longestEmptyMs, sample.at - emptySince);
      } else emptySince = null;
    }
    const activeCounts = new Map();
    for (const sample of samples) for (const animal of sample.activeSpecies) activeCounts.set(animal, (activeCounts.get(animal) || 0) + 1);
    const mostSampledSpecies = [...activeCounts].sort((first, second) => second[1] - first[1])[0]?.[0] || null;
    return { duration: performance.now() - start, persistent, samples, movement, landings, longestEmptyMs, mostSampledSpecies,
      speciesCycleScope: 'Short default capture checks the most-observed active animal; the separate specialised QA checks a complete shuffled species bag.',
      groups: [...stage.querySelectorAll('.paw-loader__animal')].map(group => ({ animal: group.dataset.animal,
        feet: [...group.querySelectorAll('.paw-loader__paw')].map(paw => paw.dataset.foot) })) };
  }, duration);
}

async function checkPawEntrance(browser, engineName, viewport) {
  const size = viewport.width < 500 ? 'mobile' : 'desktop';
  const result = { scenario: 'first-entry-paws-actual-motion', viewport, status: 'running', errors: [],
    scope: 'Only the local price-booking.js response is held. Weather graph/API fixtures remain unchanged; HTTP cache retention is not benchmarked.' };
  const setup = await prepareContext(browser, viewport, { qaLocation: { latitude: 51.34, longitude: 12.37 },
    recordVideo: { dir: path.join(output, 'video-raw'), size: viewport } });
  const criticalEntered = gate();
  setup.controls.entranceCritical = { ...gate(), onHeld: criticalEntered.release };
  await setup.context.addInitScript(() => {
    const trace = window.__qaLoaderReadiness = { init: Date.now(), events: [] };
    document.addEventListener('DOMContentLoaded', () => trace.events.push({ event: 'DOMContentLoaded', at: Date.now() }));
    let currentShell;
    Object.defineProperty(window, 'SiteShell', { configurable: true, get: () => currentShell, set(api) {
      currentShell = api;
      const prepare = api?.prepareCriticalAssets;
      if (typeof prepare !== 'function') return;
      api.prepareCriticalAssets = function (...args) {
        trace.events.push({ event: 'prepare-start', at: Date.now() });
        const promise = prepare.apply(this, args);
        promise.then(() => trace.events.push({ event: 'prepare-fulfilled', at: Date.now() }),
          error => trace.events.push({ event: 'prepare-rejected', at: Date.now(), error: String(error) }));
        return promise;
      };
    } });
  });
  const page = await setup.context.newPage(), video = page.video();
  let captureDeadlineTimer = null;
  const releaseCritical = () => {
    if (result.timings && !result.timings.gateReleased) result.timings.gateReleased = Date.now();
    setup.controls.entranceCritical.release();
  };
  observePageErrors(page, result);
  try {
    const started = Date.now();
    result.timings = { started };
    await page.goto(`${origin}/ru/prays-list.html`, { waitUntil: 'commit', timeout: 15000 });
    await page.waitForFunction(() => document.querySelector('.site-loader__scene')?.querySelectorAll('.paw-loader__paw').length === 12, null, { polling: 50, timeout: 10000 });
    result.timings.actorsReady = Date.now();
    result.presentation = await page.locator('#preloader').evaluate(overlay => ({ text: overlay.textContent.trim(),
      controls: overlay.querySelectorAll('a,button,input,select,textarea,[tabindex]').length }));
    assert.deepEqual(result.presentation, { text: '', controls: 0 }, 'the entrance contains only decorative paws');
    await page.evaluate(() => { window.NikaSiteLoader.ready.then(outcome => {
      window.__qaImmediatePawStop = { actors: document.querySelectorAll('.paw-loader__animal,.paw-loader__print').length,
        animations: document.getAnimations().filter(animation => animation.effect?.target?.closest?.('.site-loader__scene')).length,
        overlay: document.querySelector('#preloader')?.outerHTML.slice(0, 500) || null };
      window.__qaLoaderReadiness.outcome = { at: Date.now(), outcome, readyState: document.readyState, fonts: document.fonts?.status,
        faces: [...document.fonts || []].map(font => ({ family: font.family, status: font.status })),
        images: [...document.images].filter(image => !image.complete).map(image => image.currentSrc || image.src) };
    }); });
    // A deadline fails this fixture explicitly. It must never release the real
    // critical response silently before the pending-state snapshot is captured.
    const captureDeadline = new Promise((_, reject) => {
      captureDeadlineTimer = setTimeout(() => {
        result.captureTimeout = { at: Date.now(), limitMs: 10000 };
        reject(new Error('Paw motion and held-pending capture exceeded the 10s fixture deadline'));
        releaseCritical();
        void setup.context.close().catch(() => {});
      }, 10000);
    });
    let screenshot;
    await Promise.race([(async () => {
      await criticalEntered.promise;
      result.timings.criticalHeld = setup.controls.entranceCritical.heldAt;
      // The authored fallback feet already walk while the atlas decodes.
      const trace = pawMotionTrace(page, 5500);
      const captureScreenshot = page.waitForTimeout(2500).then(() => {
        result.screenshot = path.join(output, `${engineName}-${size}-paws-loading.png`);
        screenshot = page.screenshot({ path: result.screenshot, timeout: 12000 }).catch(error => { result.screenshotFailure = String(error); });
      });
      [result.motion] = await Promise.all([trace, captureScreenshot]);
      result.timings.traceFinished = Date.now();
      result.pending = await page.evaluate(() => ({
        ready: document.documentElement.dataset.siteReady || null,
        active: window.NikaSiteLoader.active, animals: document.querySelectorAll('.paw-loader__animal').length,
        background: getComputedStyle(document.body, '::before').animationPlayState,
      }));
      result.timings.pendingCaptured = Date.now();
    })(), captureDeadline]);
    clearTimeout(captureDeadlineTimer);
    captureDeadlineTimer = null;
    assert.equal(result.timings.gateReleased, undefined, 'the critical response is still held at the pending snapshot');
    assert.ok(result.timings.pendingCaptured - result.timings.criticalHeld >= 5000, 'the actual critical request stays pending beyond the former 5s deadline');
    releaseCritical();
    await screenshot;
    assert.equal(result.screenshotFailure, undefined, 'the held entrance screenshot is captured');
    assert.equal(result.pending.ready, null, 'a still-pending real critical script cannot be declared ready after the former 5s deadline');
    assert.equal(result.pending.active, true);
    assert.equal(result.pending.background, 'paused');
    assert.equal(result.motion.persistent, true, 'four limb elements persist instead of spawning a drifting stream of footprints');
    assert.deepEqual(result.motion.groups.map(group => group.animal).sort(), ['cat', 'dog', 'guinea-pig']);
    for (const group of result.motion.groups) assert.deepEqual(group.feet.slice().sort(), ['front-left', 'front-right', 'hind-left', 'hind-right']);
    assert.ok(result.motion.samples.every(sample => sample.activeSpecies.length === 1 && sample.paws.filter(paw => paw.active).length === 4), 'exactly one animal and its four limbs are active');
    assert.ok(result.motion.samples.every(sample => sample.visibleSpecies.length <= 1), 'different species never paint simultaneously');
    assert.ok(result.motion.samples.every(sample => sample.printSpecies.every(animal => sample.activeSpecies.includes(animal))), 'switching species clears the previous animal\'s footprints');
    const activeFeet = result.motion.movement.filter(foot => foot.foot.startsWith(`${result.motion.mostSampledSpecies}/`));
    assert.equal(activeFeet.length, 4);
    for (const foot of activeFeet) {
      assert.ok(foot.distinctTransforms > 1, `${foot.foot}: computed motion actually changes`);
      assert.ok(foot.stableStancePairs > 0, `${foot.foot}: a planted stance does not slide`);
    }
    assert.ok(result.motion.samples.some(sample => sample.prints > 0));
    assert.ok(result.motion.samples.some(sample => sample.visibleSpecies.length === 1), 'the active animal is actually present on the visible glass');
    assert.ok(result.motion.longestEmptyMs < 600, 'animals return after their last foot exits instead of leaving a long empty scene');
    assert.ok(result.motion.samples.some(sample => sample.paws.filter(paw => paw.active && paw.visible).length > 0 && sample.paws.filter(paw => paw.active && paw.visible).every(paw => /paws-atlas-v1\.webp/.test(paw.atlas))), 'the sampled visible active paws actually paint the decoded photographic atlas');
    assert.ok(result.motion.landings.some(landing => landing.foot.startsWith(`${result.motion.mostSampledSpecies}/`) && landing.distance <= .15), 'the sampled active animal leaves a new footprint at its own planted foot position');
    result.outcome = await awaitLoaderOutcome(page);
    result.readiness = await page.evaluate(() => window.__qaLoaderReadiness);
    assert.equal(result.outcome.reason, 'ready');
    result.immediateStop = await page.evaluate(() => window.__qaImmediatePawStop);
    assert.deepEqual(result.immediateStop, { actors: 0, animations: 0, overlay: null }, 'the entire entrance is detached before ready observers execute');
    result.after = await page.evaluate(() => ({ actors: document.querySelectorAll('.paw-loader__animal,.paw-loader__print').length,
      animations: document.getAnimations().filter(animation => animation.effect?.target?.closest?.('.site-loader__scene')).length }));
    assert.deepEqual(result.after, { actors: 0, animations: 0 });
    result.elapsedMs = Date.now() - started;
    result.geometry = await geometry(page);
    assert.ok(result.geometry.rootScrollWidth <= result.geometry.rootWidth + 2);
    await page.screenshot({ path: path.join(output, `${engineName}-${size}-paws-ready.png`) });
    await page.waitForFunction(() => {
      const host = document.querySelector('.header-weather-widget');
      return host?.dataset.weatherMounted === 'true' && host.__weatherWidgetInstance?.getState?.()?.weather?.current &&
        !host.shadowRoot.querySelector('[data-weather-loading-scene="preview"]');
    }, null, { polling: 50, timeout: 25000 });
    // This scenario verifies ordinary settled-page navigation. The renderer's
    // separate disposal tests cover cancellation while terrain is still loading.
    const assetWaitStarted = Date.now();
    let quietSince = null;
    while (Date.now() - assetWaitStarted < 8000) {
      const assets = setup.network.requests.filter(request => /\/assets\/images\/weather\/|header-weather-(?:moon|sun).*\.js|Scene3D.*\.mjs/.test(request.url));
      if (assets.every(request => request.finishedAt || request.failure)) quietSince ??= Date.now();
      else quietSince = null;
      if (quietSince && Date.now() - quietSince >= 600) break;
      await page.waitForTimeout(100);
    }
    result.navigationAssetQuiescence = { waitedMs: Date.now() - assetWaitStarted,
      pending: setup.network.requests.filter(request => /\/assets\/images\/weather\/|header-weather-(?:moon|sun).*\.js|Scene3D.*\.mjs/.test(request.url) && !request.finishedAt && !request.failure).map(request => request.url) };
    assert.equal(result.navigationAssetQuiescence.pending.length, 0, 'ordinary navigation does not intentionally cancel pending terrain fetches');
    result.sessionBeforeNavigation = await page.evaluate(() => ({ origin: location.origin, path: location.pathname,
      marker: sessionStorage.getItem('nika:site-entrance:v1') }));
    await page.addInitScript(() => { window.__loaderWasMounted = false; new MutationObserver(records => {
      if (records.some(record => [...record.addedNodes].some(node => node.id === 'preloader'))) window.__loaderWasMounted = true;
    }).observe(document, { childList: true, subtree: true }); });
    await page.goto(`${origin}/uk/`, { waitUntil: 'domcontentloaded' });
    result.nextRoute = { path: '/uk/', outcome: await awaitLoaderOutcome(page),
      ...await page.evaluate(() => ({ mounted: window.__loaderWasMounted, active: window.NikaSiteLoader.active, lang: document.documentElement.lang })) };
    result.nextRoute.storage = await page.evaluate(() => ({ origin: location.origin, path: location.pathname,
      marker: sessionStorage.getItem('nika:site-entrance:v1') }));
    assert.equal(result.nextRoute.mounted, false, 'same-tab navigation across route/locale never replays the entrance');
    assert.equal(result.nextRoute.active, false);
    assert.equal(result.nextRoute.lang, 'uk');
    result.status = 'passed';
  } catch (error) {
    result.status = 'failed'; result.failure = error.stack || String(error);
    result.failureState = await page.evaluate(() => ({ url: location.href, readyState: document.readyState,
      siteReady: document.documentElement.dataset.siteReady, reason: document.documentElement.dataset.siteReadyReason,
      active: window.NikaSiteLoader?.active, overlays: [...document.querySelectorAll('#preloader')].map(node => ({ className: node.className, connected: node.isConnected })),
      fonts: document.fonts?.status, readiness: window.__qaLoaderReadiness })).catch(() => null);
    await page.screenshot({ path: path.join(output, `${engineName}-${size}-paws-failure.png`) }).catch(() => {});
  } finally {
    if (captureDeadlineTimer !== null) clearTimeout(captureDeadlineTimer);
    releaseCritical();
    await setup.context.close();
    if (video) { result.video = path.join(output, `${engineName}-${size}-paws.webm`); await video.saveAs(result.video); }
    result.network = setup.network;
    attributeEntryNetworkErrors(result, setup.network);
  }
  return result;
}

async function meteorMotionTrace(page, kind) {
  return page.evaluate(async kind => {
    const started = performance.now(), previous = new WeakMap(), ids = new WeakMap();
    let nextId = 0, maximumConcurrent = 0;
    const samples = [];
    while (performance.now() - started < 8000) {
      const root = document.querySelector('.header-weather-widget')?.shadowRoot;
      const stage = root?.querySelector(`[data-weather-loading-scene="${kind}"]`);
      const stars = [...stage?.querySelectorAll('.weather-header-shooting-star') || []];
      maximumConcurrent = Math.max(maximumConcurrent, stars.length);
      for (const star of stars) {
        const animation = star.getAnimations().find(animation => animation.effect?.target === star);
        if (!animation || animation.playState !== 'running') continue;
        if (!ids.has(star)) ids.set(star, ++nextId);
        const style = getComputedStyle(star);
        const second = { id: ids.get(star), at: performance.now() - started, transform: style.transform,
          opacity: Number(style.opacity), time: animation.currentTime, phase: animation.effect.getComputedTiming().progress };
        const first = previous.get(star);
        samples.push(second);
        if (first && first.transform !== second.transform && second.time > first.time) return { first, second,
          elapsed: performance.now() - started, maximumConcurrent, samples };
        previous.set(star, second);
      }
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    return { failure: `No observed moving WAAPI meteor on the ${kind} surface`, elapsed: performance.now() - started,
      maximumConcurrent, samples };
  }, kind);
}

async function loadingSurfaceBounds(page, kind) {
  return page.evaluate(kind => {
    const root = document.querySelector('.header-weather-widget').shadowRoot;
    const stage = root.querySelector(`[data-weather-loading-scene="${kind}"]`), surface = stage.parentElement;
    const rect = node => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
    return { stage: rect(stage), surface: rect(surface), parent: surface.className,
      stars: stage.querySelectorAll('.weather-header-shooting-star').length };
  }, kind);
}

function assertFullLoadingSurface(bounds) {
  for (const property of ['left', 'top', 'width', 'height']) assert.ok(Math.abs(bounds.stage[property] - bounds.surface[property]) <= 2.5,
    `loading scene covers the entire surface (${property})`);
}

async function checkWeatherLoadingScenes(browser, engineName, viewport) {
  const size = viewport.width < 500 ? 'mobile' : 'desktop';
  const result = { scenario: 'weather-full-surface-starfall', viewport, status: 'running', errors: [] };
  const setup = await prepareContext(browser, viewport, { qaLocation: { latitude: 51.34, longitude: 12.37 } });
  await setup.context.addInitScript(() => { try { sessionStorage.setItem('nika:site-entrance:v1', 'shown'); } catch {} });
  setup.controls.weatherData = gate();
  const page = await setup.context.newPage();
  observePageErrors(page, result);
  const stageCount = kind => page.evaluate(kind => document.querySelector('.header-weather-widget')?.shadowRoot?.querySelectorAll(`[data-weather-loading-scene="${kind}"]`).length || 0, kind);
  try {
    await page.goto(`${origin}/ru/`, { waitUntil: 'domcontentloaded' });
    result.pageOutcome = await awaitLoaderOutcome(page);
    await page.waitForFunction(() => document.querySelector('.header-weather-widget')?.shadowRoot?.querySelector('[data-weather-loading-scene="preview"]'), null, { polling: 50, timeout: 10000 });
    result.preview = { readinessSource: 'Existing labelled /api/weather fixture response held before fulfil; native fixed QA browser coordinates.' };
    result.preview.motion = await meteorMotionTrace(page, 'preview');
    assert.equal(result.preview.motion.failure, undefined);
    result.preview.bounds = await loadingSurfaceBounds(page, 'preview');
    assertFullLoadingSurface(result.preview.bounds);
    await page.screenshot({ path: path.join(output, `${engineName}-${size}-weather-full-loading.png`) });
    setup.controls.weatherData.release();
    await page.waitForFunction(() => {
      const host = document.querySelector('.header-weather-widget');
      return host?.__weatherWidgetInstance?.getState?.()?.weather?.current?.temp_c === 7 && !host.shadowRoot.querySelector('[data-weather-loading-scene="preview"]');
    }, null, { polling: 50, timeout: 25000 });
    result.preview.actualReadyStopped = await stageCount('preview') === 0;
    assert.ok(setup.network.fixtureWeatherRequests > 0);
    await page.screenshot({ path: path.join(output, `${engineName}-${size}-weather-full-ready.png`) });
    const toggle = page.locator('.header-weather-widget').locator('.weather-header-card__toggle');
    await toggle.click();
    await page.waitForFunction(() => {
      const host = document.querySelector('.header-weather-widget'), dropdown = host?.shadowRoot?.querySelector('.weather-header-dropdown');
      return host?.dataset.weatherExpanded === 'true' && dropdown && dropdown.getBoundingClientRect().height > 0;
    }, null, { polling: 50, timeout: 10000 });
    result.panel = await page.evaluate(() => {
      const root = document.querySelector('.header-weather-widget').shadowRoot, dropdown = root.querySelector('.weather-header-dropdown');
      const marker = document.createElement('span');
      marker.dataset.weatherSceneOwner = 'loading'; marker.dataset.qaLoadingOwner = 'true';
      dropdown.appendChild(marker);
      return { readinessSource: 'Actual menu opening; explicitly labelled public-DOM loading-owner lifecycle fixture extends pending state. No production controller or weather API schema is changed.',
        ownersBeforeFixture: [...dropdown.querySelectorAll('[data-weather-scene-owner]:not([data-qa-loading-owner])')].map(node => node.dataset.weatherSceneOwner) };
    });
    await page.waitForFunction(() => document.querySelector('.header-weather-widget')?.shadowRoot?.querySelector('[data-weather-loading-scene="panel"]'), null, { polling: 50 });
    result.panel.motion = await meteorMotionTrace(page, 'panel');
    assert.equal(result.panel.motion.failure, undefined);
    result.panel.bounds = await loadingSurfaceBounds(page, 'panel');
    assertFullLoadingSurface(result.panel.bounds);
    assert.ok(result.panel.bounds.stage.height > 200, 'the loader covers the full navigation panel, not just its weather hero');
    await page.screenshot({ path: path.join(output, `${engineName}-${size}-weather-panel-loading.png`) });
    await page.evaluate(() => document.querySelector('.header-weather-widget').shadowRoot.querySelector('[data-qa-loading-owner]').remove());
    await page.waitForFunction(() => !document.querySelector('.header-weather-widget')?.shadowRoot?.querySelector('[data-weather-loading-scene="panel"]'), null, { polling: 50, timeout: 25000 });
    result.panel.readyStopped = await stageCount('panel') === 0;
    await page.screenshot({ path: path.join(output, `${engineName}-${size}-weather-panel-ready.png`) });
    await toggle.click();
    await page.waitForFunction(() => document.querySelector('.header-weather-widget')?.dataset.weatherExpanded === 'false', null, { polling: 50 });
    assert.equal(await stageCount('panel'), 0);
    result.panel.closedStopped = true;
    result.status = 'passed';
  } catch (error) {
    result.status = 'failed'; result.failure = error.stack || String(error);
    await page.screenshot({ path: path.join(output, `${engineName}-${size}-weather-scene-failure.png`) }).catch(() => {});
  } finally {
    setup.controls.weatherData.release();
    await setup.context.close(); result.network = setup.network;
    attributeEntryNetworkErrors(result, setup.network);
  }
  return result;
}

async function checkLoaderEdges(browser, engineName) {
  const cases = [];
  for (const kind of ['legal-first-entry', 'storage-keyboard-lifecycle-api-finish', 'watchdog', 'atlas-failure', 'no-javascript']) {
    const result = { scenario: kind, status: 'running', errors: [] }; cases.push(result);
    const setup = await prepareContext(browser, { width: 390, height: 844 }, { qaLocation: { latitude: 51.34, longitude: 12.37 },
      ...(kind === 'no-javascript' ? { javaScriptEnabled: false } : {}) });
    const page = await setup.context.newPage(); observePageErrors(page, result);
    try {
      if (kind === 'storage-keyboard-lifecycle-api-finish') await setup.context.addInitScript(() => Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('QA restricted session storage'); } }));
      if (['storage-keyboard-lifecycle-api-finish', 'watchdog'].includes(kind)) setup.controls.entranceCritical = gate();
      if (kind === 'legal-first-entry') setup.controls.pawAtlas = gate();
      if (kind === 'atlas-failure') setup.controls.failAtlas = true;
      const started = Date.now();
      await page.goto(`${origin}${kind === 'legal-first-entry' ? '/de/impressum.html' : '/ru/prays-list.html'}`, { waitUntil: 'commit' });
      if (kind === 'no-javascript') {
        await page.waitForLoadState('domcontentloaded');
        assert.equal(await page.locator('#preloader').count(), 0);
      } else if (kind === 'storage-keyboard-lifecycle-api-finish') {
        result.keyboard = await heldLoaderKeyboard(page);
        result.outcome = await page.evaluate(() => window.NikaSiteLoader.ready);
        assert.equal(result.outcome.reason, 'skip');
      } else {
        if (kind === 'legal-first-entry') {
          await page.locator('#preloader.site-loader').waitFor({ state: 'visible' });
          assert.equal(await page.locator('.paw-loader__paw').count(), 12);
          setup.controls.pawAtlas.release();
        }
        result.outcome = await awaitLoaderOutcome(page);
        assert.equal(result.outcome.reason, kind === 'watchdog' ? 'timeout' : kind === 'atlas-failure' ? 'resource-error' : 'ready');
        if (kind === 'atlas-failure') assert.ok(result.outcome.failedResources.includes('entrance-atlas'));
        if (kind === 'watchdog') assert.ok(Date.now() - started >= 14000, 'the 15s emergency release is not a former short success timeout');
      }
      result.elapsedMs = Date.now() - started;
      result.status = 'passed';
    } catch (error) {
      result.status = 'failed'; result.failure = error.stack || String(error);
      await page.screenshot({ path: path.join(output, `${engineName}-${kind}-failure.png`) }).catch(() => {});
    } finally {
      setup.controls.entranceCritical?.release(); setup.controls.pawAtlas?.release();
      await setup.context.close(); result.network = setup.network;
      attributeEntryNetworkErrors(result, setup.network);
    }
  }
  return cases;
}

async function checkUngatedColdEntry(browser, engineName, viewport) {
  const result = { scenario: 'ungated-cold-entry-readiness', viewport, status: 'running', errors: [],
    scope: 'Fresh browser context, no response gates, no video/style sampling during readiness. Existing labelled weather/solar fixtures remain unchanged.' };
  const setup = await prepareContext(browser, viewport, { qaLocation: { latitude: 51.34, longitude: 12.37 } });
  await setup.context.addInitScript(() => {
    const started = performance.now();
    let loader;
    Object.defineProperty(window, 'NikaSiteLoader', { configurable: true, get: () => loader, set(value) {
      loader = value;
      value.ready.then(outcome => {
        const overlay = document.querySelector('#preloader');
        window.__qaColdEntry = { elapsedMs: performance.now() - started, outcome,
          actors: document.querySelectorAll('.paw-loader__animal,.paw-loader__print').length,
          animations: document.getAnimations().filter(animation => animation.effect?.target?.closest?.('.site-loader__scene')).length,
          overlay: overlay ? { inert: overlay.hasAttribute('inert'), hidden: overlay.getAttribute('aria-hidden'), pointerEvents: overlay.style.pointerEvents } : null };
      });
    } });
  });
  const page = await setup.context.newPage(); observePageErrors(page, result);
  try {
    await page.goto(`${origin}/ru/prays-list.html`, { waitUntil: 'commit' });
    await page.waitForFunction(() => Boolean(window.__qaColdEntry), null, { polling: 50, timeout: 16500 });
    result.actual = await page.evaluate(() => window.__qaColdEntry);
    assert.equal(result.actual.outcome.reason, 'ready');
    assert.ok(result.actual.elapsedMs < 15000, 'actual ungated critical readiness precedes the emergency watchdog');
    assert.equal(result.actual.actors, 0);
    assert.equal(result.actual.animations, 0);
    assert.equal(result.actual.overlay, null, 'ready.then observes no retained entrance shell');
    result.geometry = await geometry(page);
    assert.ok(result.geometry.rootScrollWidth <= result.geometry.rootWidth + 2);
    await page.waitForFunction(() => {
      const host = document.querySelector('.header-weather-widget');
      return host?.dataset.weatherMounted === 'true' && host.__weatherWidgetInstance?.getState?.()?.weather?.current &&
        !host.shadowRoot.querySelector('[data-weather-loading-scene="preview"]');
    }, null, { polling: 50, timeout: 25000 });
    const waitStarted = Date.now(); let quietSince = null;
    while (Date.now() - waitStarted < 8000) {
      const assets = setup.network.requests.filter(request => /\/assets\/images\/weather\/|header-weather-(?:moon|sun).*\.js|Scene3D.*\.mjs/.test(request.url));
      if (assets.every(request => request.finishedAt || request.failure)) quietSince ??= Date.now();
      else quietSince = null;
      if (quietSince && Date.now() - quietSince >= 600) break;
      await page.waitForTimeout(100);
    }
    result.sessionBefore = await page.evaluate(() => ({ origin: location.origin, path: location.pathname, marker: sessionStorage.getItem('nika:site-entrance:v1') }));
    await page.addInitScript(() => { window.__qaRepeatedEntrance = false; new MutationObserver(records => {
      if (records.some(record => [...record.addedNodes].some(node => node.id === 'preloader'))) window.__qaRepeatedEntrance = true;
    }).observe(document, { childList: true, subtree: true }); });
    await page.goto(`${origin}/uk/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.siteReady === 'true', null, { polling: 50, timeout: 16500 });
    result.nextRoute = await page.evaluate(() => ({ origin: location.origin, path: location.pathname, marker: sessionStorage.getItem('nika:site-entrance:v1'),
      mounted: window.__qaRepeatedEntrance, active: window.NikaSiteLoader.active, reason: document.documentElement.dataset.siteReadyReason }));
    assert.equal(result.nextRoute.mounted, false);
    assert.equal(result.nextRoute.active, false);
    assert.equal(result.nextRoute.marker, 'shown');
    assert.equal(result.nextRoute.reason, 'ready');
    result.status = 'passed';
  } catch (error) {
    result.status = 'failed'; result.failure = error.stack || String(error);
    result.state = await page.evaluate(() => ({ actual: window.__qaColdEntry, reason: document.documentElement.dataset.siteReadyReason, active: window.NikaSiteLoader?.active })).catch(() => null);
  } finally {
    await setup.context.close(); result.network = setup.network;
    attributeEntryNetworkErrors(result, setup.network);
  }
  console.log(`${engineName} ${viewport.width}: ungated cold entry ${result.status}`);
  return result;
}

try {
  for (const [engineName, engine] of Object.entries({ chromium, webkit, firefox })) {
    if (!selectedEngines.includes(engineName)) continue;
    if (diagnosticOnly && engineName !== 'chromium') continue;
    if (glProbeOnly && engineName !== 'webkit') continue;
    const engineResult = { engine: engineName, cases: [], errors: [] };
    results.browsers.push(engineResult);
    if (!existsSync(engine.executablePath())) {
      engineResult.status = 'unavailable';
      await save();
      continue;
    }
    let browser;
    try {
      const channel = engineName === 'chromium' ? (process.env.STARFALL_CHANNEL || 'chromium') : undefined;
      engineResult.launch = { headless: true, requestedChannel: channel || 'bundled' };
      try {
        browser = await engine.launch({ headless: true, channel, timeout: 15000 });
        engineResult.launch.actualChannel = channel || 'bundled';
      } catch (error) {
        if (engineName !== 'chromium' || !/executable.*(?:doesn't exist|not found)|distribution.*not found/i.test(error.message)) throw error;
        browser = await engine.launch({ headless: true, timeout: 15000 });
        engineResult.launch.actualChannel = 'bundled-fallback';
        engineResult.launch.fallbackReason = error.message.split('\n')[0];
      }
      if (engineName === 'chromium') {
        const session = await browser.newBrowserCDPSession();
        const info = await session.send('SystemInfo.getInfo');
        engineResult.gpu = {
          devices: info.gpu.devices.map(device => ({ vendor: device.vendorString, device: device.deviceString, driverVendor: device.driverVendor, driverVersion: device.driverVersion })),
          renderer: info.gpu.auxAttributes?.glRenderer,
          implementation: info.gpu.auxAttributes?.glImplementationParts,
          featureStatus: info.gpu.featureStatus,
        };
        engineResult.gpu.rendering = !engineResult.gpu.renderer ? 'unknown'
          : /swiftshader|llvmpipe|software/i.test(engineResult.gpu.renderer) ? 'software' : 'hardware-reported';
        await session.detach();
      }
      for (const viewport of diagnosticOnly || entriesOnly || glProbeOnly || deadlineProbeOnly || visualReadyOnly || loadersOnly ? [] :
        [{ width: 1440, height: 900 }, { width: 390, height: 844 }].filter(viewport => selectedViewports.includes(viewport.width < 500 ? 'mobile' : 'desktop'))) {
        const size = viewport.width < 500 ? 'mobile' : 'desktop';
        const item = { viewport, status: 'running', errors: [] };
        engineResult.cases.push(item);
        const setup = await prepareContext(browser, viewport);
        const page = await setup.context.newPage();
        page.setDefaultTimeout(10000);
        page.on('pageerror', error => {
          item.errors.push(error.message);
          (item.rawPageErrors ||= []).push({ name: error.name, message: error.message, stack: error.stack, at: Date.now() });
        });
        try {
          setup.controls.critical = gate();
          setup.controls.weather = gate();
          const started = Date.now();
          await page.goto(`${origin}/ru/prays-list.html`, { waitUntil: 'commit', timeout: 15000 });
          await page.locator('#preloader.site-loader').waitFor({ state: 'visible' });
          assert.equal(await page.locator('.site-loader__meteor').count(), 8);
          item.entranceMotion = await page.evaluate(() => ({
            reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
            bodyBackground: { name: getComputedStyle(document.body, '::before').animationName, state: getComputedStyle(document.body, '::before').animationPlayState },
            meteor: { name: getComputedStyle(document.querySelector('.site-loader__meteor')).animationName, state: getComputedStyle(document.querySelector('.site-loader__meteor')).animationPlayState },
          }));
          assert.notEqual(item.entranceMotion.bodyBackground.name, 'none', 'the authored background remains available');
          assert.equal(item.entranceMotion.bodyBackground.state, 'paused', 'opaque entrance pauses the hidden background');
          if (item.entranceMotion.reducedMotion) {
            assert.equal(item.entranceMotion.meteor.name, 'none', 'reduced motion retains still entrance stars');
          } else {
            assert.equal(item.entranceMotion.meteor.name, 'site-loader-meteor');
            assert.equal(item.entranceMotion.meteor.state, 'running', 'visible entrance meteors continue moving');
          }
          await page.screenshot({ path: path.join(output, `${engineName}-${size}-entrance.png`) });
          item.loader = await page.locator('.site-loader__meteor').first().evaluate(element => ({ animation: getComputedStyle(element).animationName, transform: getComputedStyle(element).transform }));
          setup.controls.critical.release();
          await awaitReady(page);
          item.entranceMotion.afterReadyBackgroundState = await page.evaluate(() => getComputedStyle(document.body, '::before').animationPlayState);
          assert.equal(item.entranceMotion.afterReadyBackgroundState, 'running', 'page background resumes after entrance dismissal');
          item.loader.openedAfterMs = Date.now() - started;
          assert.ok(item.loader.openedAfterMs < 7000, 'entrance remains bounded');
          await page.waitForFunction(() => document.querySelector('.header-weather-widget')?.shadowRoot?.querySelector('.weather-header-state__spinner'));
          item.weatherLoader = await page.locator('.header-weather-widget').evaluate(host => {
            const preview = host.shadowRoot.querySelector('.weather-header-preview');
            const style = getComputedStyle(preview, '::before');
            return { content: style.content, animation: style.animationName, background: style.backgroundImage, spinnerDisplay: getComputedStyle(host.shadowRoot.querySelector('.weather-header-state__spinner')).display };
          });
          assert.match(item.weatherLoader.animation, /weatherHeaderStarfall/);
          assert.equal(item.weatherLoader.spinnerDisplay, 'none');
          await page.locator('.header-weather-widget').screenshot({ path: path.join(output, `${engineName}-${size}-weather-loading.png`) });
          setup.controls.weather.release();
          await page.waitForFunction(() => document.querySelector('.header-weather-widget')?.dataset.weatherMounted === 'true', null, { timeout: 15000 });
          await page.waitForFunction(() => {
            const host = document.querySelector('.header-weather-widget');
            return host?.__weatherWidgetInstance?.getState?.()?.weather?.current?.temp_c === 7 &&
              host.shadowRoot.querySelector('.weather-header-card__temperature-value')?.textContent.trim() === '7';
          }, null, { timeout: 15000 });
          assert.ok(setup.network.fixtureWeatherRequests > 0, 'loaded weather must come from the labelled fixture');
          item.weatherReady = true;
          await page.waitForTimeout(1800);
          item.price = await geometry(page);
          assert.ok(item.price.cards > 10);
          assert.ok(item.price.rootScrollWidth <= item.price.rootWidth + 2, 'page has no horizontal overflow');
          await page.screenshot({ path: path.join(output, `${engineName}-${size}-price-ready.png`) });
          item.weatherRenderLifecycle = {};
          item.weatherRenderLifecycle = await weatherRenderLifecycle(page, () => nativePageWheel(page), engineName === 'chromium' && engineResult.gpu?.rendering === 'hardware-reported', item.weatherRenderLifecycle);
          item.nativeWheel = item.weatherRenderLifecycle.nativeWheel;
          if (mode === 'frames') {
            item.adaptivePaint = {};
            item.adaptivePaint = await adaptivePaintLifecycle(page, path.join(output, `${engineName}-${size}-scroll-fallback.png`), item.adaptivePaint);
          }
          item.scroll = await scrollFrames(page);
          item.functional = await functionalPrice(page);
          await page.setViewportSize({ width: size === 'mobile' ? 844 : 1100, height: size === 'mobile' ? 390 : 760 });
          await page.waitForTimeout(400);
          item.resized = await geometry(page);
          assert.ok(item.resized.rootScrollWidth <= item.resized.rootWidth + 2, 'resized page has no horizontal overflow');
          item.homes = [];
          await page.setViewportSize(viewport);
          for (const locale of shortMode ? [] : ['ru', 'uk', 'de', 'en']) {
            await page.goto(`${origin}/${locale}/`, { waitUntil: 'domcontentloaded' });
            await awaitReady(page);
            assert.equal(await page.locator('html').getAttribute('lang'), locale);
            const home = await geometry(page);
            assert.ok(home.rootScrollWidth <= home.rootWidth + 2, `${locale} home has no horizontal overflow`);
            item.homes.push({ locale, ...home });
          }
          item.status = 'passed';
        } catch (error) {
          item.status = 'failed';
          item.failure = error.stack || String(error);
          await page.screenshot({ path: path.join(output, `${engineName}-${size}-failure.png`) }).catch(() => {});
        } finally {
          setup.controls.critical?.release();
          setup.controls.weather?.release();
          item.network = setup.network;
          await setup.context.close();
          if (trackNetwork) attributeEntryNetworkErrors(item, setup.network);
          await save();
        }
      }
      if (glProbeOnly) engineResult.glProbe = await probeHiddenDraws(browser);
      if (deadlineProbeOnly) engineResult.deadlineProbe = await probeDeadlineState(browser);
      if (visualReadyOnly) engineResult.cases.push(await visualMoonReadiness(browser, engineName));
      if (entriesOnly) engineResult.cases.push(...await checkEntryPages(browser));
      if (loadersOnly) {
        for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }].filter(viewport => selectedViewports.includes(viewport.width < 500 ? 'mobile' : 'desktop'))) {
          if (selectedLoaderScenarios.includes('paws')) {
            engineResult.cases.push(await checkPawEntrance(browser, engineName, viewport));
            console.log(`${engineName} ${viewport.width}: paw scene ${engineResult.cases.at(-1).status}`);
            await save();
          }
          if (selectedLoaderScenarios.includes('cold')) {
            engineResult.cases.push(await checkUngatedColdEntry(browser, engineName, viewport));
            await save();
          }
          if (selectedLoaderScenarios.includes('weather')) {
            engineResult.cases.push(await checkWeatherLoadingScenes(browser, engineName, viewport));
            console.log(`${engineName} ${viewport.width}: weather scenes ${engineResult.cases.at(-1).status}`);
            await save();
          }
        }
        if (selectedLoaderScenarios.includes('edges')) engineResult.cases.push(...await checkLoaderEdges(browser, engineName));
      }
      if (!diagnosticOnly && !shortMode && !glProbeOnly && !deadlineProbeOnly && !visualReadyOnly && !loadersOnly) {
      // Accessibility/failure paths use a separate document and cannot contaminate frame samples.
      const edge = await prepareContext(browser, { width: 390, height: 844 }, { reducedMotion: 'reduce' });
      const page = await edge.context.newPage();
      edge.controls.critical = gate();
      await page.goto(`${origin}/ru/prays-list.html`, { waitUntil: 'commit' });
      await page.locator('.site-loader__meteor').first().waitFor({ state: 'attached' });
      const motion = await page.locator('.site-loader__meteor').first().evaluate(element => getComputedStyle(element).animationName);
      assert.equal(motion, 'none', 'reduced motion uses still stars');
      const keyboard = await heldLoaderKeyboard(page);
      assert.equal(await page.evaluate(() => document.documentElement.dataset.siteReady), 'true');
      edge.controls.critical.release();
      await edge.context.close();
      const deadline = await prepareContext(browser, { width: 390, height: 844 });
      const deadlinePage = await deadline.context.newPage();
      deadline.controls.critical = gate();
      await deadlinePage.goto(`${origin}/ru/prays-list.html`, { waitUntil: 'commit' });
      await deadlinePage.locator('#preloader').waitFor({ state: 'visible' });
      const deadlineStarted = Date.now();
      await awaitReady(deadlinePage);
      const deadlineMs = Date.now() - deadlineStarted;
      assert.ok(deadlineMs < 6000, 'failed critical script cannot block the entrance past its deadline');
      deadline.controls.critical.release();
      await deadline.context.close();
      const noScript = await prepareContext(browser, { width: 390, height: 844 }, { javaScriptEnabled: false });
      const noScriptPage = await noScript.context.newPage();
      const legacyPages = ['/ru/impressum.html', '/ru/datenschutz.html', '/ru/blog/blog.html'];
      for (const pathname of ['/ru/', ...legacyPages]) {
        await noScriptPage.goto(`${origin}${pathname}`, { waitUntil: 'domcontentloaded' });
        assert.equal(await noScriptPage.locator('#preloader').count(), 0, `${pathname}: no JavaScript never leaves a blocking entrance`);
      }
      await noScript.context.close();
      const legacy = await prepareContext(browser, { width: 390, height: 844 });
      const legacyPage = await legacy.context.newPage();
      for (const pathname of legacyPages) {
        await legacyPage.goto(`${origin}${pathname}`, { waitUntil: 'domcontentloaded' });
        await awaitReady(legacyPage);
        assert.equal(await legacyPage.locator('#preloader').count(), 0, `${pathname}: no duplicate legacy overlay remains`);
      }
      legacy.controls.failLoader = true;
      await legacyPage.goto(`${origin}/ru/impressum.html`, { waitUntil: 'domcontentloaded' });
      await legacyPage.waitForFunction(() => document.body.classList.contains('site-loaded'));
      assert.equal(await legacyPage.locator('#preloader').count(), 0, 'missing new loader script and stylesheet cannot revive a legacy overlay');
      await legacy.context.close();
      engineResult.edges = { reducedMotion: 'passed', skip: 'passed', noJavaScript: 'passed', missingCriticalScriptFailOpenMs: deadlineMs, keyboard };
      engineResult.legacyPages = { paths: legacyPages, noJavaScript: 'passed', normal: 'passed', loaderAssetsUnavailable: 'passed' };
      }
      if (engineName === 'chromium' && !entriesOnly && !glProbeOnly && !deadlineProbeOnly && !visualReadyOnly && !loadersOnly) {
        if (mode === 'frames') engineResult.scrollBudgetComparison = await compareScrollBudget(browser);
        else engineResult.frameDiagnostics = await diagnoseFrames(browser);
      }
      engineResult.status = glProbeOnly || deadlineProbeOnly ? 'recorded' : engineResult.cases.every(item => item.status === 'passed' && (item.unclassifiedErrors || item.errors).length === 0) ? 'passed' : 'failed';
    } catch (error) {
      engineResult.status = 'failed';
      engineResult.errors.push(error.stack || String(error));
    } finally {
      await browser?.close();
      await save();
    }
    console.log(`${engineName}: ${engineResult.status}`);
  }
} finally {
  await server.close();
  await save();
}
const failures = results.browsers.filter(browser => browser.status === 'failed');
console.log(`Starfall browser results: ${path.join(output, 'results.json')}`);
if (failures.length) process.exitCode = 1;
