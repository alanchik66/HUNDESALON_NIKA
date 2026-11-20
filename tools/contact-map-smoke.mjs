import assert from 'node:assert/strict';
import { chromium, devices, webkit } from 'playwright';

import { startStaticTestServer } from './lib/static-test-server.mjs';

const layouts = [
  ['desktop', { width: 1440, height: 900 }],
  ['mobile', devices['iPhone 13'].viewport],
];
const locales = ['de', 'en', 'ru', 'uk'];
const engine = process.env.CONTACT_MAP_ENGINE ?? 'chromium';
assert.ok(['chromium', 'webkit'].includes(engine), 'CONTACT_MAP_ENGINE must be chromium or webkit');
const server = await startStaticTestServer();
const browser = await ({ chromium, webkit })[engine].launch({ headless: true });
console.log(`[contact-map] engine=${engine}; scope=full-matrix-with-mocked-3d-lifecycle`);

const bounded = async (operation, timeoutMs, label) => {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label}: deadline ${timeoutMs}ms`)), timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

const frameSelector = '.map-native > iframe.contact-map-render-frame';
const activationPrefix = '[parent-contact-map-native-activation] ';
const mapRequestOrigins = new WeakMap();
const isMapChildRequest = (request, page) => {
  const frame = request.frame();
  const url = new URL(frame.url());
  return frame.parentFrame() === page.mainFrame() && url.origin === server.baseUrl
    && url.pathname === '/assets/frames/contact-map.html';
};
const utcClockRoute = /^https:\/\/(?:worldtimeapi\.org\/api\/timezone\/Etc\/UTC|timeapi\.io\/api\/Time\/current\/zone\?timeZone=UTC)$/;
const fulfillUtcClock = route => {
  const iso = new Date().toISOString();
  return route.fulfill({
    headers: { 'access-control-allow-origin': '*' },
    json: { utc_datetime: iso, dateTime: iso },
  });
};
const installMapProbes = async context => {
  // Keep the shared header clock deterministic during navigation in WebKit.
  await context.route(utcClockRoute, fulfillUtcClock);
  context.on('page', page => {
    const requests = [];
    mapRequestOrigins.set(page, requests);
    page.on('request', request => {
      const url = new URL(request.url());
      if ((url.origin === server.baseUrl && url.pathname === '/api/maps-config')
        || (url.origin === 'https://maps.googleapis.com' && url.pathname === '/maps/api/js')) {
        requests.push({ kind: url.pathname === '/api/maps-config' ? 'config' : 'sdk', inChild: isMapChildRequest(request, page) });
      }
    });
  });
  return context.addInitScript(({ origin, prefix }) => {
  // Chromium may preserve the initial about:blank global across iframe navigation.
  // Install first; validate the current origin when the observed event arrives.
  if (!window.__contactMapMessageProbeInstalled) {
    window.__contactMapMessageProbeInstalled = true;
    window.__contactMapMessages = [];
    window.addEventListener('message', event => {
    if (location.origin !== origin || event.data?.channel !== 'nika-contact-map') return;
    const frame = document.querySelector('iframe.contact-map-render-frame');
    window.__contactMapMessages.push({
      payload: event.data, origin: event.origin,
      expectedSource: window === window.top ? event.source === frame?.contentWindow : event.source === window.parent,
    });
    });
  }
  if (window !== window.top || document.__contactMapClickProbeInstalled) return;
  document.__contactMapClickProbeInstalled = true;
  document.addEventListener('click', event => {
    if (location.origin !== origin) return;
    const anchor = event.target.closest('.logo a[href]');
    if (!anchor) return;
    const frame = document.querySelector('iframe.contact-map-render-frame');
    const style = frame && getComputedStyle(frame);
    const rect = frame?.getBoundingClientRect();
    const childState = frame?.contentWindow?.__mockMapLease;
    console.log(prefix + JSON.stringify({
      href: anchor.href, trusted: event.isTrusted, defaultPrevented: event.defaultPrevented,
      googleAbsent: typeof window.google === 'undefined', connected: Boolean(frame?.isConnected),
      rendered: Boolean(style && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0),
      display: style?.display, visibility: style?.visibility, opacity: style?.opacity,
      pointerEvents: style?.pointerEvents, inert: frame?.inert,
      geometry: { width: rect?.width || 0, height: rect?.height || 0 },
      childPointerCount: childState?.pointerdowns.length, constructorCount: childState?.constructorCount,
      connectionCount: childState?.connectionCount, disconnectionCount: childState?.disconnectionCount,
      flyCount: childState?.flyCount, stopCount: childState?.stopCount,
      sameInstance: childState?.instances[0] === frame?.contentWindow?.__leaseOriginalMap,
      heading: childState?.instances[0]?.heading, range: childState?.instances[0]?.range,
    }));
  }, { passive: true });
  }, { origin: server.baseUrl, prefix: activationPrefix });
};

const getMapChild = async page => {
  const locator = page.locator(frameSelector);
  await locator.waitFor({ state: 'attached', timeout: 15000 });
  const handle = await locator.elementHandle();
  const frame = await handle.contentFrame();
  assert.ok(frame, 'first-party map iframe has its own document');
  await frame.waitForURL(url => url.origin === server.baseUrl && url.pathname === '/assets/frames/contact-map.html', { timeout: 15000 });
  return frame;
};
const assertDocumentIsolation = async page => {
  const state = await page.evaluate(() => {
    const frame = document.querySelector('.map-native > iframe.contact-map-render-frame');
    const script = [...document.scripts].find(node => new URL(node.src || location.href).pathname === '/assets/js/contact-map.js');
    return {
      googleAbsent: typeof window.google === 'undefined', registryAbsent: !window.customElements.get('gmp-map-3d'),
      renderers: document.querySelectorAll('gmp-map-3d, .contact-map-2d').length,
      sdkScripts: [...document.scripts].filter(node => node.src.startsWith('https://maps.googleapis.com/maps/api/js')).length,
      iframeCount: document.querySelectorAll('.map-native > iframe.contact-map-render-frame').length,
      src: frame?.src, title: frame?.title, label: frame?.parentElement.getAttribute('aria-label'),
      sourceVersion: script ? new URL(script.src).searchParams.get('v') : null,
    };
  });
  assert.equal(state.googleAbsent, true, 'Google namespace is absent from parent');
  assert.equal(state.registryAbsent, true, 'Google custom elements are not registered in parent');
  assert.equal(state.sdkScripts, 0, 'Google SDK script is absent from parent');
  assert.equal(state.renderers, 0, 'Google renderer DOM belongs only to child');
  assert.equal(state.iframeCount, 1, 'exactly one first-party map document');
  const requests = mapRequestOrigins.get(page) || [];
  assert.ok(requests.some(request => request.kind === 'config'), 'child requested map configuration');
  assert.ok(requests.every(request => request.inChild), 'map configuration and SDK requests belong only to child');
  const url = new URL(state.src);
  assert.equal(url.origin, server.baseUrl, 'map document is same-origin');
  assert.equal(url.pathname, '/assets/frames/contact-map.html', 'map document uses the fixed first-party path');
  assert.deepEqual([...url.searchParams.keys()], ['v'], 'iframe URL contains only asset version, no keys/data');
  assert.equal(url.searchParams.get('v'), state.sourceVersion, 'iframe follows host script version');
  assert.equal(state.title, state.label, 'iframe title follows localized map label');
  const child = await getMapChild(page);
  assert.equal(await child.locator('html[data-contact-map-frame] > body.contact-map-frame-body').count(), 1, 'child uses the authored frame document');
  assert.equal(await child.locator('html').getAttribute('lang'), await page.locator('html').getAttribute('lang'), 'child follows parent locale');
  assert.equal(await child.title(), state.title, 'child title follows localized iframe title');
  return child;
};
const assertMessageProtocol = async (page, child, locale) => {
  const received = await child.evaluate(() => window.__contactMapMessages);
  assert.ok(received.length, 'child received authored host messages');
  const init = received.filter(record => record.payload.type === 'init');
  assert.equal(init.length, 1, 'child receives init exactly once');
  assert.equal(init[0].payload.locale, locale, 'init locale follows parent');
  assert.equal(typeof init[0].payload.visible, 'boolean', 'init has typed visibility');
  assert.equal(typeof init[0].payload.light, 'boolean', 'init has typed theme');
  const attributes = init[0].payload.attributes;
  assert.ok(attributes && typeof attributes === 'object' && !Array.isArray(attributes), 'init has authored attributes');
  assert.deepEqual(Object.keys(attributes).sort(), ['lat', 'lng', 'zoom', 'modeControlLabel', 'hybridLabel', 'roadmapLabel', 'label'].sort(), 'init carries only authored map attributes');
  for (const key of ['lat', 'lng', 'zoom']) assert.ok(Number.isFinite(Number(attributes[key])), `init ${key} is numeric`);
  for (const key of ['modeControlLabel', 'hybridLabel', 'roadmapLabel', 'label']) assert.ok(typeof attributes[key] === 'string' && attributes[key].length > 0, `init ${key} is localized text`);
  assert.equal(attributes.label, await page.locator('.map-native').getAttribute('aria-label'), 'init label follows parent map');
  const commands = received.filter(record => record.payload.type === 'command').map(record => record.payload);
  if (commands.length) await page.waitForFunction(ids => ids.every(id => window.__contactMapMessages.some(record =>
    record.payload.type === 'result' && record.payload.id === id)), commands.map(command => command.id), { polling: 50, timeout: 5000 });
  const replies = await page.evaluate(() => window.__contactMapMessages);
  for (const record of [...received, ...replies]) {
    assert.equal(record.payload.channel, 'nika-contact-map', 'message channel is fixed');
    assert.equal(record.payload.version, 1, 'message version is fixed');
    assert.equal(record.origin, server.baseUrl, 'message arrives from same origin');
    assert.equal(record.expectedSource, true, 'message arrives from the expected document');
    assert.equal(JSON.stringify(record.payload).includes('test-google-key'), false, 'messages contain no API key');
    if (record.payload.type === 'visibility') {
      assert.equal(typeof record.payload.visible, 'boolean', 'visibility message is typed');
      assert.equal(typeof record.payload.light, 'boolean', 'theme message is typed');
    }
  }
  assert.equal(new Set(commands.map(command => command.id)).size, commands.length, 'command ids are unique');
  for (const command of commands) {
    assert.ok(Number.isInteger(command.id) && command.id > 0, 'command id is a positive integer');
    assert.ok(['north', 'recenter', 'zoom-in', 'zoom-out', 'mode'].includes(command.command), 'command name is supported');
    assert.ok(replies.some(record => record.payload.type === 'result' && record.payload.id === command.id && record.payload.ok === true), 'native command has a successful correlated reply');
  }
  const ready = replies.find(record => record.payload.type === 'ready')?.payload;
  assert.ok(ready && ['google', 'google-embed', 'unavailable'].includes(ready.provider), 'parent receives typed provider readiness');
};
const assertIgnoredFrameMessages = async (page, child) => {
  const project = () => {
    const mock = window.__mockMapLease;
    const map = mock.instances[0];
    return { constructors: mock.constructorCount, roadConstructors: mock.roadConstructorCount,
      fly: mock.flyCount, stop: mock.stopCount, heading: map.heading, range: map.range,
      mode: document.querySelector('.map-native').dataset.mapMode };
  };
  const before = await child.evaluate(project);
  const configCount = mapRequestOrigins.get(page).filter(request => request.kind === 'config').length;
  await page.evaluate(() => {
    const target = document.querySelector('iframe.contact-map-render-frame').contentWindow;
    const base = { channel: 'nika-contact-map', version: 1, type: 'command' };
    for (const data of [
      { ...base, id: 0, command: 'north' },
      { ...base, id: 9001, command: 'unknown' },
      { ...base, id: 9002, command: 'mode', mode: 'unknown' },
      { ...base, id: 9003, command: 1 },
      { ...base, version: 2, id: 9006, command: 'north' },
      { channel: 'nika-contact-map', version: 1, type: 'init', locale: 1, attributes: null, visible: 'yes', light: null },
    ]) target.postMessage(data, location.origin);
  });
  await child.evaluate(async () => {
    const base = { channel: 'nika-contact-map', version: 1, type: 'command', command: 'north' };
    window.postMessage({ ...base, id: 9004 }, location.origin); // Same-origin, wrong source document.
    window.dispatchEvent(new window.MessageEvent('message', {
      source: window.parent, origin: 'https://unrelated.invalid', data: { ...base, id: 9005 },
    }));
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  assert.deepEqual(await child.evaluate(project), before, 'invalid/unrelated messages do not run SDK commands or change mode/camera');
  assert.equal(mapRequestOrigins.get(page).filter(request => request.kind === 'config').length, configCount, 'invalid/repeated init does not fetch configuration again');
  const invalidIds = [0, 9001, 9002, 9003, 9004, 9005, 9006];
  assert.equal(await page.evaluate(ids => window.__contactMapMessages.filter(record => record.payload.type === 'result' && ids.includes(record.payload.id)).length, invalidIds), 0, 'ignored messages receive no command result');
};

const googleMapsMock = `
  (() => {
    const state = window.__mockMapLease = {
      instances: [], constructorCount: 0, connectionCount: 0, disconnectionCount: 0,
      roadConstructorCount: 0, flyCount: 0, stopCount: 0, pointerdowns: [],
      holdMapsImport: false, releaseMapsImport: null,
    };
    const isRendered = state.isRendered = element => {
      if (!element?.isConnected) return false;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
    };
    class MockMap3D extends HTMLElement {
      constructor(options = {}) {
        super(); Object.assign(this, options); state.constructorCount += 1; state.instances.push(this);
      }
      connectedCallback() { state.connectionCount += 1; }
      disconnectedCallback() { state.disconnectionCount += 1; }
      flyCameraTo(options) { state.flyCount += 1; this.lastFlyCameraTo = options; Object.assign(this, options.endCamera); }
      stopCameraAnimation() { state.stopCount += 1; }
    }
    class MockMarker extends HTMLElement {
      constructor(options = {}) { super(); Object.assign(this, options); }
    }
    class MockMap2D {
      constructor(element, options = {}) {
        state.roadConstructorCount += 1;
        this.element = element;
        this.options = options;
        this.zoom = options.zoom;
        element.mockMap = this;
      }
      setCenter(center) { this.center = center; }
      panTo(center) { this.center = center; }
      getZoom() { return this.zoom; }
      setZoom(zoom) { this.zoom = zoom; }
      setHeading(heading) { this.heading = heading; }
    }
    class MockMapMarker {
      constructor(options = {}) { this.options = options; window.__mockRoadMarker = this; }
    }
    class MockMapSize { constructor(width, height) { this.width = width; this.height = height; } }
    class MockMapPoint { constructor(x, y) { this.x = x; this.y = y; } }
    if (!customElements.get('gmp-map-3d')) customElements.define('gmp-map-3d', MockMap3D);
    if (!customElements.get('gmp-marker')) customElements.define('gmp-marker', MockMarker);
    const surfaceState = map => {
      if (!map) return { display: null, visibility: null, opacity: null, pointerEvents: null, inert: false, geometry: { width: 0, height: 0 } };
      const style = getComputedStyle(map);
      const rect = map.getBoundingClientRect();
      return {
        display: style.display, visibility: style.visibility, opacity: style.opacity,
        pointerEvents: style.pointerEvents, inert: map.inert,
        geometry: { width: rect.width, height: rect.height },
      };
    };
    document.addEventListener('pointerdown', event => state.pointerdowns.push({
      target: event.target.id || event.target.closest('a')?.className || event.target.tagName,
      connected: state.instances[0]?.isConnected ?? false,
      rendered: isRendered(state.instances[0]),
      ...surfaceState(state.instances[0]), trusted: event.isTrusted,
    }));
    document.addEventListener('click', event => {
      const anchor = event.target.closest('a[href]');
      if (!anchor) return;
      const map = state.instances[0];
      console.log('[contact-map-native-activation] ' + JSON.stringify({
        href: anchor.href, trusted: event.isTrusted, defaultPrevented: event.defaultPrevented,
        connected: map?.isConnected ?? false, rendered: isRendered(map), constructorCount: state.constructorCount,
        ...surfaceState(map),
        connectionCount: state.connectionCount, disconnectionCount: state.disconnectionCount,
        sameInstance: map === window.__leaseOriginalMap, heading: map?.heading, range: map?.range,
        flyCount: state.flyCount, stopCount: state.stopCount,
      }));
    });
    window.google = {
      maps: {
        importLibrary: async library => {
          if (library === 'maps3d') return { Map3DElement: MockMap3D, MarkerElement: MockMarker };
          if (library === 'maps') {
            if (state.holdMapsImport) return new Promise(resolve => {
              state.releaseMapsImport = () => { state.holdMapsImport = false; state.releaseMapsImport = null; resolve({ Map: MockMap2D }); };
            });
            return { Map: MockMap2D };
          }
          throw new Error('Unexpected Google Maps library');
        },
        Marker: MockMapMarker, Size: MockMapSize, Point: MockMapPoint, event: { trigger() {} },
      },
    };
    window.__hundesalonNikaMapsReady();
  })();
`;

try {
  const previewOrigin = 'https://preview.hundesalon-nika.com';
  const preview = await browser.newContext({ serviceWorkers: 'block' });
  try {
    await preview.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'maps.googleapis.com' && url.pathname === '/maps/api/js') {
        return route.fulfill({ contentType: 'application/javascript', body: googleMapsMock });
      }
      if (url.origin !== previewOrigin) return route.abort();
      if (url.pathname === '/api/maps-config') return route.fulfill({ json: { enabled: true, apiKey: 'fixture' } });
      if (url.pathname === '/ru/kontakty.html') return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html lang="ru">
          <div class="map-viewport" style="height:400px">
            <div class="map-native" style="height:100%" data-lat="51.320486" data-lng="12.416501"></div>
          </div>
          <script src="/assets/js/contact-map.js"></script></html>`,
      });
      const response = await preview.request.get(server.baseUrl + url.pathname + url.search);
      await route.fulfill({ response });
    });
    const page = await preview.newPage();
    await page.clock.install();
    await page.goto(`${previewOrigin}/ru/kontakty.html`, { waitUntil: 'domcontentloaded' });
    await page.locator('.map-native').scrollIntoViewIfNeeded();
    await page.waitForSelector('.map-native[data-map-provider="google"]');
    const child = page.frameLocator(frameSelector);
    await child.locator('.map-native[data-map-suspended="0"]').waitFor();
    const marker = child.locator('.contact-map-google-pin');
    await marker.evaluate(element => { element.style.display = 'none'; });
    assert.equal(await marker.evaluate(element => element.getBoundingClientRect().width), 0);
    await page.clock.runFor(16000);
    assert.equal(await page.locator('.map-native').getAttribute('data-map-provider'), 'google');
    assert.equal(await page.locator('.contact-map-3d-link').count(), 0);
    await marker.evaluate(element => { element.style.removeProperty('display'); });
    await child.locator('gmp-map-3d').evaluate(map => map.dispatchEvent(new Event('gmp-error')));
    await page.waitForSelector('.map-native[data-map-provider="openstreetmap"]');
    await child.locator('img.leaflet-marker-icon[alt="HUNDESALON NIKA"]').waitFor({ state: 'visible' });
    await child.getByRole('button', { name: 'Приблизить' }).click();
    assert.equal(await child.locator('.leaflet-control-attribution a').getAttribute('href'), 'https://www.openstreetmap.org/copyright');
    assert.equal(await page.locator('.contact-map-3d-link').getAttribute('href'), 'https://hundesalon-nika.com/ru/kontakty');
    assert.equal(await page.locator('.contact-map-controls, .map-mode-button').count(), 0);
    console.log(`[contact-map] ${engine} late preview SDK failure switches to the interactive street map`);
    await preview.route('https://maps.googleapis.com/maps/api/js*', route =>
      route.fulfill({ contentType: 'application/javascript', body: '/* SDK callback never arrives */' })
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.map-native[data-map-provider="openstreetmap"]', { timeout: 30000 });
    assert.equal(await page.locator('.contact-map-3d-link').count(), 1);
    console.log(`[contact-map] ${engine} unresponsive preview SDK keeps a working map and 3D link`);
  } finally {
    await preview.close();
  }
  for (const locale of locales) {
    for (const [layout, viewport] of layouts) {
      const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
      await installMapProbes(context);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));

      await page.goto(`${server.baseUrl}/${locale}/kontakty.html`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await page.locator('.map-native').scrollIntoViewIfNeeded();
      await page.waitForSelector('.map-native[data-map-ready="1"]', { timeout: 15000 });
      const mapChild = await assertDocumentIsolation(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(250);

      const state = await page.locator('.map-frame').evaluate(frame => {
        const viewportElement = frame.querySelector('.map-viewport');
        const map = frame.querySelector('.map-native');
        const rect = frame.getBoundingClientRect();
        const viewportRect = viewportElement?.getBoundingClientRect();
        const routeModes = [...frame.querySelectorAll('.map-actions a[href*="travelmode="]')]
          .map(link => new URL(link.href).searchParams.get('travelmode'))
          .sort();
        const modeButtons = [...frame.querySelectorAll('.map-mode-button')];
        const actionButtons = [...frame.querySelectorAll('.map-actions .btn-map')];
        const actionImages = [...frame.querySelectorAll('.map-actions .btn-map img')];
        const contactGridRect = document.querySelector('.contacts-container')?.getBoundingClientRect();
        const contactInfoRect = document.querySelector('.contacts-info')?.getBoundingClientRect();
        const actionRows = new Set(actionButtons.map(button => Math.round(button.getBoundingClientRect().top)));
        return {
          provider: map?.dataset.mapProvider,
          frameWidth: rect.width,
          viewportWidth: viewportRect?.width || 0,
          viewportHeight: viewportRect?.height || 0,
          documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          routeModes,
          modeButtonCount: modeButtons.length,
          modeIds: modeButtons.map(button => button.dataset.mapMode),
          activeModeCount: modeButtons.filter(button => button.getAttribute('aria-pressed') === 'true').length,
          alternateMapCount: frame.querySelectorAll('.leaflet-container, .contact-map-2d').length,
          writeTarget: frame.querySelector('.map-actions a[href="#contact-form"]')?.getAttribute('href'),
          actionCount: actionButtons.length,
          actionImageCount: actionImages.length,
          actionImageNames: actionImages.map(image => new URL(image.src).pathname.split('/').pop()),
          loadedActionImageCount: actionImages.filter(image => image.complete && image.naturalWidth > 0).length,
          actionImageSizes: actionImages.map(image => {
            const imageRect = image.getBoundingClientRect();
            return [Math.round(imageRect.width), Math.round(imageRect.height)];
          }),
          navPillCount: actionButtons.filter(button => button.hasAttribute('data-nav-pill')).length,
          boundNavPillCount: actionButtons.filter(button => button.dataset.navPillBound === '1').length,
          verticalActionCount: actionButtons.filter(button => getComputedStyle(button).flexDirection === 'column').length,
          iconsAboveLabels: actionButtons.filter(button => {
            const icon = button.querySelector('img, i');
            const label = button.querySelector('.btn-map-label');
            return icon && label && icon.getBoundingClientRect().bottom <= label.getBoundingClientRect().top + 1;
          }).length,
          actionHeights: actionButtons.map(button => Math.round(button.getBoundingClientRect().height)),
          externalTargetCount: actionButtons.filter(button => button.target === '_blank').length,
          defaultSelectedActionCount: actionButtons.filter(button =>
            button.matches('.btn-map-primary, .active, [aria-current], [aria-pressed="true"]')
          ).length,
          actionRowCount: actionRows.size,
          contactGridBottom: contactGridRect?.bottom || 0,
          windowHeight: window.innerHeight,
          contactInfoHeight: contactInfoRect?.height || 0,
          contactInfoWidth: contactInfoRect?.width || 0,
          mapFrameHeight: rect.height,
          mapFrameWidth: rect.width,
          leftGutter: contactInfoRect?.left || 0,
          rightGutter: window.innerWidth - rect.right,
          tileGap: rect.left - (contactInfoRect?.right || 0),
        };
      });

      state.alternateMapCount = await mapChild.locator('.leaflet-container, .contact-map-2d').count();
      assert.equal(await mapChild.locator('.map-native').getAttribute('data-map-provider'), 'unavailable', `${locale}/${layout}: child unavailable state`);
      await assertMessageProtocol(page, mapChild, locale);
      assert.equal(state.provider, 'unavailable', `${locale}/${layout}: Google-only unavailable state`);
      assert.ok(state.viewportWidth >= Math.min(320, state.frameWidth - 4), `${locale}/${layout}: map width`);
      assert.ok(state.viewportHeight >= 280, `${locale}/${layout}: map height`);
      assert.ok(state.documentOverflow <= 1, `${locale}/${layout}: no horizontal overflow`);
      assert.deepEqual(
        state.routeModes,
        ['bicycling', 'driving', 'transit', 'walking'],
        `${locale}/${layout}: all route modes`
      );
      assert.equal(state.modeButtonCount, 0, `${locale}/${layout}: no non-Google mode controls`);
      assert.equal(state.alternateMapCount, 0, `${locale}/${layout}: no alternate map provider`);
      assert.equal(state.writeTarget, '#contact-form', `${locale}/${layout}: write action targets form`);
      assert.equal(state.actionCount, 5, `${locale}/${layout}: five quick actions`);
      assert.equal(state.actionImageCount, 5, `${locale}/${layout}: every quick action uses a branded image`);
      assert.deepEqual(
        state.actionImageNames,
        ['car.png', 'public-transport.png', 'walking.png', 'bicycle.png', 'mail.png'],
        `${locale}/${layout}: correct branded action images`
      );
      assert.equal(state.loadedActionImageCount, 5, `${locale}/${layout}: branded action images load`);
      assert.deepEqual(
        state.actionImageSizes,
        Array(5).fill(layout === 'desktop' ? [32, 22] : [34, 24]),
        `${locale}/${layout}: branded action images share one visual frame`
      );
      assert.equal(state.navPillCount, 5, `${locale}/${layout}: navigation-pill behavior requested`);
      assert.equal(state.boundNavPillCount, 5, `${locale}/${layout}: navigation-pill effects initialized`);
      assert.equal(state.verticalActionCount, 5, `${locale}/${layout}: vertical quick-action layout`);
      assert.equal(state.iconsAboveLabels, 5, `${locale}/${layout}: every icon is above its label`);
      assert.ok(Math.max(...state.actionHeights) <= 52, `${locale}/${layout}: compact action height`);
      assert.ok(
        Math.min(...state.actionHeights) >= (layout === 'desktop' ? 40 : 44),
        `${locale}/${layout}: accessible action height`
      );
      assert.equal(state.externalTargetCount, 4, `${locale}/${layout}: routes keep opening separately`);
      assert.equal(state.defaultSelectedActionCount, 0, `${locale}/${layout}: no route looks selected by default`);
      if (layout === 'desktop') {
        assert.equal(state.actionRowCount, 1, `${locale}/${layout}: quick actions stay in one row`);
        assert.ok(
          state.contactGridBottom <= state.windowHeight + 1,
          `${locale}/${layout}: contact tiles fit in the initial viewport`
        );
        assert.ok(
          Math.abs(state.contactInfoHeight - state.mapFrameHeight) <= 1,
          `${locale}/${layout}: contact and map tiles have equal height`
        );
        assert.ok(state.contactInfoWidth <= 560, `${locale}/${layout}: contact tile hugs its content`);
        assert.ok(state.mapFrameWidth > state.contactInfoWidth, `${locale}/${layout}: map uses the released width`);
        assert.ok(state.leftGutter >= 24 && state.leftGutter <= 64, `${locale}/${layout}: professional left gutter`);
        assert.ok(state.rightGutter >= 24 && state.rightGutter <= 64, `${locale}/${layout}: professional right gutter`);
        assert.ok(state.tileGap >= 24 && state.tileGap <= 40, `${locale}/${layout}: professional tile gap`);
      }

      await page.locator('.map-actions a[href="#contact-form"]').click();
      await page.waitForFunction(() => {
        const rect = document.querySelector('#contact-form').getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
      }, null, { timeout: 3000 });
      const formPosition = await page.locator('#contact-form').evaluate(form => {
        const rect = form.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, viewportHeight: window.innerHeight };
      });
      assert.ok(
        formPosition.top < formPosition.viewportHeight && formPosition.bottom > 0,
        `${locale}/${layout}: form scrolled into view`
      );
      assert.deepEqual(errors, [], `${locale}/${layout}: no page errors`);
      console.log(`[contact-map] ${locale} ${layout}: ok (${Math.round(state.viewportWidth)}x${Math.round(state.viewportHeight)})`);
      await context.close();
    }
  }

  const googleContext = await browser.newContext({ viewport: layouts[0][1], serviceWorkers: 'block' });
  await installMapProbes(googleContext);
  const googlePage = await googleContext.newPage();
  let requestedGoogleScriptUrl = '';
  await googlePage.route('**/api/maps-config', route => {
    if (!isMapChildRequest(route.request(), googlePage)) return route.abort();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ enabled: true, apiKey: 'browser-test-key' }),
    });
  });
  await googlePage.route('https://maps.googleapis.com/maps/api/js**', route => {
    requestedGoogleScriptUrl = route.request().url();
    if (!isMapChildRequest(route.request(), googlePage)) return route.abort();
    return route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: googleMapsMock,
    });
  });

  await googlePage.goto(`${server.baseUrl}/ru/kontakty.html`, { waitUntil: 'domcontentloaded' });
  await googlePage.locator('.map-native').scrollIntoViewIfNeeded();
  await googlePage.waitForSelector('.map-native[data-map-provider="google"]', { timeout: 15000 });
  const googleChild = await assertDocumentIsolation(googlePage);
  await googleChild.waitForFunction(() => window.__mockMapLease.isRendered(window.__mockMapLease.instances[0]), undefined, { polling: 50, timeout: 5000 });

  const googleState = {
    ...await googlePage.evaluate(() => ({
      modeCount: document.querySelectorAll('.map-mode-button').length,
      modeIds: [...document.querySelectorAll('.map-mode-button')].map(button => button.dataset.mapMode),
      controlCount: document.querySelectorAll('.contact-map-control').length,
      badgeCount: document.querySelectorAll('.map-mode-badge').length,
      navControlCount: document.querySelectorAll('.map-nav-control[data-nav-pill]').length,
      boundNavControlCount: document.querySelectorAll('.map-nav-control[data-nav-pill][data-nav-pill-bound="1"]').length,
      activeModePlasmaCount: document.querySelectorAll('.map-mode-button[aria-pressed="true"] .nav-plasma--active').length,
      recenterIcon: document.querySelector('.contact-map-control-image-recenter')?.getAttribute('src'),
      streetViewIcon: document.querySelector('.contact-map-control-streetview .contact-map-control-image')?.getAttribute('src'),
    })),
    ...await googleChild.locator('.map-native').evaluate(map => {
      const marker = map.querySelector('gmp-marker');
      return {
      provider: map.dataset.mapProvider,
      mapMode: map.querySelector('gmp-map-3d')?.mode,
      mapCount: map.querySelectorAll('gmp-map-3d').length,
      alternateMapCount: document.querySelectorAll('.leaflet-container, .contact-map-2d').length,
      center: map.querySelector('gmp-map-3d')?.center,
      marker: marker
        ? {
            altitudeMode: marker.altitudeMode,
            position: marker.position,
            title: marker.title,
            visualClass: marker.firstElementChild?.className,
            visualText: marker.firstElementChild?.textContent,
            iconSrc: marker.querySelector('.contact-map-google-pin-image')?.getAttribute('src'),
          }
        : null,
      };
    }),
  };
  const scriptUrl = new URL(requestedGoogleScriptUrl);
  assert.equal(scriptUrl.searchParams.get('language'), 'ru', 'Google map follows page language');
  assert.equal(scriptUrl.searchParams.get('region'), 'DE', 'Google map uses German regional context');
  assert.equal(googleState.provider, 'google', 'single Google provider initialized');
  assert.equal(googleState.modeCount, 2, 'Google map exposes exactly two modes');
  assert.deepEqual(googleState.modeIds, ['HYBRID', 'ROADMAP'], 'only Hybrid 3D and Map are available');
  assert.equal(googleState.mapMode, 'HYBRID', 'Hybrid 3D is the initial mode');
  assert.equal(googleState.mapCount, 1, 'exactly one Google map is mounted');
  assert.equal(googleState.alternateMapCount, 0, 'no alternate map provider is mounted');
  assert.equal(googleState.controlCount, 5, 'camera, center, zoom and Street View controls are present');
  assert.equal(googleState.badgeCount, 0, 'no duplicate map mode badge');
  assert.equal(googleState.navControlCount, 7, 'all map controls use navigation-pill behavior');
  assert.equal(googleState.boundNavControlCount, 7, 'all map controls initialize navigation-pill effects');
  assert.equal(googleState.activeModePlasmaCount, 1, 'selected map mode keeps the active navigation effect');
  assert.equal(
    googleState.recenterIcon,
    '/assets/images/icons/map-recenter.png',
    'Recenter control uses the transparent branded icon'
  );
  assert.equal(
    googleState.streetViewIcon,
    '/assets/images/icons/street-view.png',
    'Street View uses the branded golden icon'
  );
  assert.deepEqual(
    googleState.center,
    { lat: 51.320486, lng: 12.416501, altitude: 113 },
    'Google 3D camera target follows the salon terrain altitude'
  );
  assert.deepEqual(
    googleState.marker,
    {
      altitudeMode: 'RELATIVE_TO_MESH',
      position: { lat: 51.320486, lng: 12.416501, altitude: 2 },
      title: 'HUNDESALON NIKA',
      visualClass: 'contact-map-google-pin',
      visualText: 'HUNDESALON NIKA',
      iconSrc: '/assets/images/icons/locate.png',
    },
    'Google 3D salon marker stays visible on the ground'
  );

  await googleChild.evaluate(() => {
    const map = window.__mockMapLease.instances[0];
    window.__modeOriginalCamera = { heading: map.heading, range: map.range };
    map.heading = 145;
    map.range = 420;
  });
  const assertGoogleMode = async expectedMode => {
    await googleChild.waitForFunction(mode => {
      const mock = window.__mockMapLease;
      const container = document.querySelector('.map-native');
      const threeD = container.querySelector(':scope > gmp-map-3d');
      const road = container.querySelector(':scope > .contact-map-2d');
      return threeD && road && mock.isRendered(threeD) === (mode === 'HYBRID')
        && mock.isRendered(road) === (mode === 'ROADMAP');
    }, expectedMode, { polling: 50, timeout: 5000 });
    await googlePage.waitForSelector(`.map-native[data-map-mode="${expectedMode.toLowerCase()}"]`, { timeout: 5000 });
    const state = await googleChild.locator('.map-native').evaluate(container => {
      const mock = window.__mockMapLease;
      const threeD = container.querySelector(':scope > gmp-map-3d');
      const road = container.querySelector(':scope > .contact-map-2d');
      const backends = [...container.querySelectorAll(':scope > gmp-map-3d, :scope > .contact-map-2d')];
      const surface = node => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return { display: style.display, visibility: style.visibility, opacity: style.opacity,
          pointerEvents: style.pointerEvents, inert: node.inert, geometry: { width: rect.width, height: rect.height } };
      };
      const rect = container.getBoundingClientRect();
      return {
        visibleBackends: backends.filter(mock.isRendered).map(node => node === threeD ? 'HYBRID' : 'ROADMAP'),
        threeDCount: container.querySelectorAll(':scope > gmp-map-3d').length,
        roadCount: container.querySelectorAll(':scope > .contact-map-2d').length,
        backendCount: backends.length, connected: threeD.isConnected, sameInstance: threeD === mock.instances[0],
        threeDSurface: surface(threeD), roadSurface: surface(road),
        viewportGeometry: { width: rect.width, height: rect.height },
        constructorCount: mock.constructorCount, roadConstructorCount: mock.roadConstructorCount,
        connectionCount: mock.connectionCount, disconnectionCount: mock.disconnectionCount,
        heading: threeD.heading, range: threeD.range, flyCount: mock.flyCount, stopCount: mock.stopCount,
        sdkPointerCount: mock.pointerdowns.length,
      };
    });
    state.selectedEffectCount = await googlePage.locator('.map-mode-button[aria-pressed="true"] .nav-plasma--active').count();
    console.log(`[contact-map-mode] ${engine} ${expectedMode}: ${JSON.stringify(state)}`);
    assert.deepEqual(state.visibleBackends, [expectedMode], `${expectedMode}: exactly one visible Google backend`);
    assert.equal(state.threeDCount, 1, `${expectedMode}: exactly one cached 3D backend`);
    assert.equal(state.roadCount, 1, `${expectedMode}: exactly one cached road backend`);
    assert.equal(state.backendCount, 2, `${expectedMode}: no duplicate Google backends`);
    assert.equal(state.connected, true, `${expectedMode}: cached 3D stays connected`);
    assert.equal(state.sameInstance, true, `${expectedMode}: original 3D instance retained`);
    const inactive = expectedMode === 'HYBRID' ? state.roadSurface : state.threeDSurface;
    const active = expectedMode === 'HYBRID' ? state.threeDSurface : state.roadSurface;
    assert.notEqual(inactive.display, 'none', `${expectedMode}: inactive backend retains its layout surface`);
    assert.equal(inactive.visibility, 'hidden', `${expectedMode}: inactive backend is visually hidden`);
    assert.equal(inactive.opacity, '0', `${expectedMode}: inactive backend has zero opacity`);
    assert.equal(inactive.pointerEvents, 'none', `${expectedMode}: inactive backend cannot intercept input`);
    assert.equal(inactive.inert, true, `${expectedMode}: inactive backend has no accessible controls`);
    assert.deepEqual(inactive.geometry, state.viewportGeometry, `${expectedMode}: inactive backend retains viewport dimensions`);
    assert.deepEqual(active.geometry, state.viewportGeometry, `${expectedMode}: active backend fills the same viewport`);
    assert.ok(active.geometry.width > 0 && active.geometry.height > 0, `${expectedMode}: viewport dimensions are nonzero`);
    assert.equal(active.inert, false, `${expectedMode}: active backend accepts interaction`);
    assert.notEqual(active.pointerEvents, 'none', `${expectedMode}: active backend does not suppress input`);
    assert.equal(state.constructorCount, 1, `${expectedMode}: no replacement Map3D constructor`);
    assert.equal(state.roadConstructorCount, 1, `${expectedMode}: road backend is cached`);
    assert.equal(state.connectionCount, 1, `${expectedMode}: 3D is connected only once`);
    assert.equal(state.disconnectionCount, 0, `${expectedMode}: mode switch does not disconnect 3D`);
    assert.equal(state.heading, 145, `${expectedMode}: camera heading retained`);
    assert.equal(state.range, 420, `${expectedMode}: camera range retained`);
    assert.equal(state.flyCount, 0, `${expectedMode}: mode switch does not fly/reset camera`);
    assert.equal(state.stopCount, 0, `${expectedMode}: mode switch does not enqueue camera stop`);
    assert.equal(state.sdkPointerCount, 0, `${expectedMode}: parent toolbar input stays outside SDK document listeners`);
    assert.equal(state.selectedEffectCount, 1, `${expectedMode}: selected navigation effect stays singular`);
  };

  await googlePage.getByRole('button', { name: 'Карта', exact: true }).click();
  await assertGoogleMode('ROADMAP');
  await googlePage.evaluate(() => document.body.classList.add('light'));
  await googleChild.waitForFunction(() => document.body.classList.contains('light'), undefined, { polling: 50, timeout: 5000 });
  await googlePage.evaluate(() => document.body.classList.remove('light'));
  await googleChild.waitForFunction(() => !document.body.classList.contains('light'), undefined, { polling: 50, timeout: 5000 });
  await googlePage.evaluate(() => document.body.classList.add('nav-open'));
  await googlePage.waitForFunction(() => {
    const frame = document.querySelector('iframe.contact-map-render-frame');
    return frame?.inert && getComputedStyle(frame).visibility === 'hidden';
  }, undefined, { polling: 50, timeout: 5000 });
  assert.equal(await googleChild.locator('gmp-map-3d').evaluate(map => window.__mockMapLease.isRendered(map)), false, 'hidden ROADMAP host does not enable 3D');
  await googlePage.evaluate(() => document.body.classList.remove('nav-open'));
  await googlePage.waitForFunction(() => {
    const frame = document.querySelector('iframe.contact-map-render-frame');
    return frame && !frame.inert && getComputedStyle(frame).visibility === 'visible';
  }, undefined, { polling: 50, timeout: 5000 });
  await assertGoogleMode('ROADMAP');
  assert.equal(
    await googlePage.locator('.map-mode-button[aria-pressed="true"] .nav-plasma--active').count(),
    1,
    'active navigation effect follows the selected map mode'
  );
  assert.equal(
    await googlePage.locator('.map-native').getAttribute('data-map-provider'),
    'google',
    'road map remains in the same Google provider'
  );
  assert.equal(await googleChild.locator('.map-native > .contact-map-2d:visible').count(), 1, 'Google road map is visible');
  assert.deepEqual(
    await googleChild.evaluate(() => ({
      url: window.__mockRoadMarker.options.icon.url,
      scaledSize: window.__mockRoadMarker.options.icon.scaledSize,
      anchor: window.__mockRoadMarker.options.icon.anchor,
    })),
    {
      url: '/assets/images/icons/locate.png',
      scaledSize: { width: 64, height: 64 },
      anchor: { x: 32, y: 56 },
    },
    'Google road map uses the salon location icon'
  );
  assert.equal(await googleChild.locator('.map-native > gmp-map-3d:visible').count(), 0, 'cached 3D map has no visible UI in road mode');
  assert.equal(
    await googlePage.locator('.contact-map-controls').evaluate(controls => controls.hidden),
    false,
    'the shared map controls remain visible in road mode'
  );
  await googlePage.getByRole('button', { name: 'Приблизить', exact: true }).click();
  await googleChild.waitForFunction(() => document.querySelector('.contact-map-2d')?.mockMap.zoom === 18,
    undefined, { polling: 50, timeout: 5000 });
  assert.equal(
    await googleChild.locator('.contact-map-2d').evaluate(map => map.mockMap.zoom),
    18,
    'custom zoom control changes the road-map zoom'
  );
  await googlePage.getByRole('button', { name: 'Гибрид 3D', exact: true }).click();
  await assertGoogleMode('HYBRID');
  assert.equal(await googleChild.locator('.map-native > gmp-map-3d:visible').count(), 1, 'Hybrid 3D map is rendered again');
  assert.equal(await googleChild.locator('.map-native > .contact-map-2d:visible').count(), 0, 'cached road map has no visible UI in Hybrid mode');
  assert.equal(
    await googlePage.locator('.contact-map-controls').evaluate(controls => controls.hidden),
    false,
    '3D camera controls are restored in Hybrid mode'
  );
  await googlePage.getByRole('button', { name: 'Карта', exact: true }).click();
  await assertGoogleMode('ROADMAP');
  await googlePage.getByRole('button', { name: 'Гибрид 3D', exact: true }).click();
  await assertGoogleMode('HYBRID');
  await googleChild.evaluate(() => Object.assign(window.__mockMapLease.instances[0], window.__modeOriginalCamera));
  await googlePage.getByRole('button', { name: 'Приблизить', exact: true }).click();
  await googleChild.waitForFunction(() => window.__mockMapLease.instances[0].lastFlyCameraTo?.endCamera.range < 520,
    undefined, { polling: 50, timeout: 5000 });
  assert.ok(
    (await googleChild.locator('gmp-map-3d').evaluate(map => map.lastFlyCameraTo.endCamera.range)) < 520,
    'custom zoom control changes the 3D camera range'
  );
  const zoomedRange = await googleChild.locator('gmp-map-3d').evaluate(map => map.range);
  await googlePage.getByRole('button', { name: 'Отдалить', exact: true }).click();
  await googleChild.waitForFunction(range => window.__mockMapLease.instances[0].range > range, zoomedRange, { polling: 50, timeout: 5000 });
  await googlePage.getByRole('button', { name: 'Ориентировать карту на север', exact: true }).click();
  await googleChild.waitForFunction(() => window.__mockMapLease.instances[0].heading === 0, undefined, { polling: 50, timeout: 5000 });
  await googlePage.getByRole('button', { name: 'Показать салон в центре карты', exact: true }).click();
  await googleChild.waitForFunction(() => {
    const map = window.__mockMapLease.instances[0];
    return map.center.lat === 51.320486 && map.center.lng === 12.416501 && map.range === 520 && map.heading === 332;
  }, undefined, { polling: 50, timeout: 5000 });
  assert.equal(await googleChild.evaluate(() => window.__mockMapLease.pointerdowns.length), 0, 'all parent camera controls stay outside SDK gesture listeners');
  await assertDocumentIsolation(googlePage);
  await assertMessageProtocol(googlePage, googleChild, 'ru');
  await assertIgnoredFrameMessages(googlePage, googleChild);
  // Synthetic lifecycle events test disposal; they are not native navigation/BFCache proof.
  await googleChild.evaluate(() => window.dispatchEvent(new window.PageTransitionEvent('pagehide', { persisted: false })));
  assert.equal(await googleChild.locator('gmp-map-3d').count(), 0, 'permanent child pagehide disconnects 3D');
  await googleChild.evaluate(async () => {
    window.dispatchEvent(new window.PageTransitionEvent('pageshow', { persisted: false }));
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    document.body.classList.add('nav-open');
    document.body.classList.remove('nav-open');
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const disposalState = await googleChild.evaluate(() => ({
    connected: window.__mockMapLease.instances[0].isConnected,
    rendered: window.__mockMapLease.isRendered(window.__mockMapLease.instances[0]),
    constructorCount: window.__mockMapLease.constructorCount,
    connectionCount: window.__mockMapLease.connectionCount,
    disconnectionCount: window.__mockMapLease.disconnectionCount,
    suspended: document.querySelector('.map-native').dataset.mapSuspended ?? null,
  }));
  console.log(`[contact-map-lease] ${engine} synthetic-permanent-dispose-late-events: ${JSON.stringify(disposalState)}`);
  assert.equal(disposalState.connected, false, 'disposed map is not reattached by late lifecycle/class events');
  assert.equal(disposalState.rendered, false, 'disposed map has no rendered UI');
  assert.equal(disposalState.constructorCount, 1, 'disposal does not recreate Map3D');
  assert.equal(disposalState.connectionCount, 1, 'terminal disposal does not reconnect 3D');
  assert.equal(disposalState.disconnectionCount, 1, 'only terminal disposal disconnects 3D');
  assert.equal(disposalState.suspended, null, 'permanent disposal removes lease state');
  await googlePage.evaluate(() => window.dispatchEvent(new window.PageTransitionEvent('pagehide', { persisted: false })));
  assert.equal(await googlePage.locator(frameSelector).count(), 0, 'terminal parent pagehide removes child iframe');
  await googlePage.evaluate(() => window.dispatchEvent(new window.PageTransitionEvent('pageshow', { persisted: false })));
  assert.equal(await googlePage.locator(frameSelector).count(), 0, 'disposed host does not recreate child after late pageshow');
  console.log('[contact-map] single Google map, two modes, controls, localization and marker: ok');
  await googleContext.close();

  // In-memory host fixture uses the real first-party frame; no fixture HTML is published.
  const protocolContext = await browser.newContext({ viewport: layouts[1][1], serviceWorkers: 'block' });
  await installMapProbes(protocolContext);
  try {
    const page = await protocolContext.newPage();
    const errors = [];
    let configRequests = 0;
    let sdkRequests = 0;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (utcClockRoute.test(url.href)) return fulfillUtcClock(route);
      if (!['GET', 'HEAD'].includes(request.method())) return route.abort();
      if (url.origin === server.baseUrl && url.pathname === '/api/maps-config') {
        configRequests += 1;
        if (!isMapChildRequest(request, page)) return route.abort();
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ enabled: true, apiKey: 'test-google-key' }) });
      }
      if (url.origin === 'https://maps.googleapis.com' && url.pathname === '/maps/api/js') {
        sdkRequests += 1;
        if (!isMapChildRequest(request, page)) return route.abort();
        return route.fulfill({ contentType: 'application/javascript', body: googleMapsMock });
      }
      return url.origin === server.baseUrl ? route.continue() : route.abort();
    });
    const frameUrl = `${server.baseUrl}/assets/frames/contact-map.html?v=protocol-fixture`;
    await page.goto(frameUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(src => {
      const frame = document.createElement('iframe');
      frame.className = 'contact-map-render-frame'; frame.title = 'Protocol fixture'; frame.src = src;
      document.querySelector('.map-native').replaceChildren(frame);
    }, frameUrl);
    const child = await getMapChild(page);
    await child.waitForLoadState('domcontentloaded', { timeout: 5000 });
    const init = {
      channel: 'nika-contact-map', version: 1, type: 'init', locale: 'ru', visible: true, light: false,
      attributes: { lat: '51.320486', lng: '12.416501', zoom: '17', modeControlLabel: 'Управление картой',
        hybridLabel: 'Гибрид 3D', roadmapLabel: 'Карта', label: 'Контроль протокола карты' },
    };
    await page.evaluate(data => {
      const target = document.querySelector('iframe.contact-map-render-frame').contentWindow;
      for (const invalid of [
        { ...data, version: 2 }, { ...data, type: 'unknown' }, { ...data, locale: 1 },
        { ...data, visible: 'yes' }, { ...data, attributes: null },
      ]) target.postMessage(invalid, location.origin);
    }, init);
    await child.evaluate(async data => {
      window.postMessage(data, location.origin); // Valid shape, wrong source.
      window.dispatchEvent(new window.MessageEvent('message', { source: window.parent, origin: 'https://unrelated.invalid', data }));
      await new Promise(resolve => setTimeout(resolve, 0));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }, init);
    assert.equal(configRequests, 0, 'invalid/unrelated init cannot request configuration');
    assert.equal(sdkRequests, 0, 'invalid/unrelated init cannot load SDK');
    assert.equal(await child.evaluate(() => typeof window.google), 'undefined', 'child has no SDK before valid init');
    await page.evaluate(data => document.querySelector('iframe.contact-map-render-frame').contentWindow.postMessage(data, location.origin), init);
    await page.waitForFunction(() => window.__contactMapMessages.some(record => record.payload.type === 'ready' && record.payload.provider === 'google'), undefined, { polling: 50, timeout: 15000 });
    assert.equal(configRequests, 1, 'valid init fetches configuration once in child');
    assert.equal(sdkRequests, 1, 'valid init loads SDK once in child');
    assert.equal(await page.evaluate(() => typeof window.google), 'undefined', 'controlled host never loads SDK');
    await child.evaluate(() => { window.__mockMapLease.holdMapsImport = true; });
    await page.evaluate(() => {
      const target = document.querySelector('iframe.contact-map-render-frame').contentWindow;
      for (const [id, mode] of [[1, 'ROADMAP'], [2, 'HYBRID']]) target.postMessage({
        channel: 'nika-contact-map', version: 1, type: 'command', id, command: 'mode', mode,
      }, location.origin);
    });
    await child.waitForFunction(() => typeof window.__mockMapLease.releaseMapsImport === 'function'
      && window.__contactMapMessages.some(record => record.payload.type === 'command' && record.payload.id === 2), undefined, { polling: 50, timeout: 5000 });
    await page.evaluate(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    assert.equal(await child.evaluate(() => window.__mockMapLease.roadConstructorCount), 0, 'held import has not created the road backend');
    assert.equal(await page.evaluate(() => window.__contactMapMessages.filter(record => record.payload.type === 'result').length), 0, 'later mode command cannot overtake held import');
    await child.evaluate(() => window.__mockMapLease.releaseMapsImport());
    await page.waitForFunction(() => window.__contactMapMessages.filter(record => record.payload.type === 'result').length === 2, undefined, { polling: 50, timeout: 5000 });
    const results = await page.evaluate(() => window.__contactMapMessages.filter(record => record.payload.type === 'result').map(record => record.payload));
    assert.deepEqual(results.map(result => [result.id, result.ok, result.mode]), [[1, true, 'roadmap'], [2, true, 'hybrid']], 'deferred commands complete in issue order');
    assert.equal(await child.evaluate(() => window.__mockMapLease.constructorCount), 1, 'serialized commands retain the single 3D backend');
    assert.equal(await child.evaluate(() => window.__mockMapLease.roadConstructorCount), 1, 'serialized commands retain one cached road backend');
    assert.deepEqual(errors, [], 'controlled protocol fixture has no page errors');
    console.log(`[contact-map] ${engine} pre-init validation and deferred command serialization: ok (controlled messages, no timer mirroring)`);
  } finally {
    await bounded(protocolContext.close(), 10000, 'protocolContext.close');
  }

  for (const [name, embedUrl, expectedProvider, configStatus = 200] of [
    ['share embed', 'https://www.google.com/maps/embed?pb=preview-map-fixture', 'google-embed'],
    ['transient configuration error', 'https://www.google.com/maps/embed?pb=preview-map-fixture', 'google-embed', 503],
    ['permanent configuration denial', 'https://www.google.com/maps/embed?pb=preview-map-fixture', 'unavailable', 403],
    ['foreign origin', 'https://www.google.com.example.test/maps/embed?pb=fixture', 'unavailable'],
    ['Google redirect', 'https://www.google.com/url?pb=fixture', 'unavailable'],
    ['credentialed URL', 'https://user@www.google.com/maps/embed?pb=fixture', 'unavailable'],
  ]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await installMapProbes(context);
    try {
      const page = await context.newPage();
      const errors = [];
      const mapRequests = [];
      let configRequests = 0;
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => {
        const url = new URL(request.url());
        if (url.pathname === '/maps/embed' || url.hostname === 'maps.googleapis.com') {
          mapRequests.push(request.url());
        }
      });
      await page.route('**/api/maps-config', route => {
        configRequests += 1;
        if (!isMapChildRequest(route.request(), page)) return route.abort();
        return route.fulfill({
          status: configRequests === 1 ? configStatus : 200,
          contentType: 'application/json', body: JSON.stringify({ enabled: false, embedUrl }),
        });
      });
      await page.route('https://www.google.com/maps/embed?**', route => route.fulfill({
        contentType: 'text/html', body: '<!doctype html><title>Google Maps fixture</title><p>Preview map fixture</p>',
      }));
      await page.goto(`${server.baseUrl}/ru/kontakty.html`, { waitUntil: 'domcontentloaded' });
      await page.locator('.map-native').scrollIntoViewIfNeeded();
      await page.waitForSelector(`.map-native[data-map-provider="${expectedProvider}"]`, { timeout: 15000 });
      const child = await assertDocumentIsolation(page);
      const frame = child.locator('.map-native iframe.map-embed-google');
      assert.equal(await frame.count(), expectedProvider === 'google-embed' ? 1 : 0, `${name}: iframe policy`);
      assert.equal(mapRequests.length, expectedProvider === 'google-embed' ? 1 : 0, `${name}: request policy`);
      assert.equal(configRequests, configStatus === 503 ? 2 : 1, `${name}: bounded transient retry`);
      assert.equal(await page.locator('.map-mode-controls').count(), 0, `${name}: no misleading 3D controls`);
      assert.deepEqual(errors, [], `${name}: no page errors`);
      await assertMessageProtocol(page, child, 'ru');
      if (expectedProvider === 'google-embed') {
        assert.equal(await frame.getAttribute('src'), embedUrl, 'official share URL is retained');
        assert.equal(await frame.getAttribute('title'), 'Карта расположения салона', 'iframe has a localized title');
        assert.ok(await child.frameLocator('.map-native iframe.map-embed-google').getByText('Preview map fixture').isVisible(), 'embedded content rendered');
        const bounds = await frame.boundingBox();
        assert.ok(bounds.width >= 320 && bounds.height >= 280, 'embed fills the responsive map viewport');
      }
      console.log(`[contact-map] ${name}: ok`);
    } finally {
      await context.close();
    }
  }

  const leaseContext = await browser.newContext({
    viewport: layouts[1][1], isMobile: true, hasTouch: true, deviceScaleFactor: 3,
    serviceWorkers: 'block', permissions: [],
  });
  await installMapProbes(leaseContext);
  try {
    const page = await leaseContext.newPage();
    const errors = [];
    let scriptRequests = 0;
    let interceptNavigation = false;
    const navigations = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.text().startsWith(activationPrefix)) console.log(`[contact-map-stage] ${engine} native console arrived: ${message.text()}`);
    });
    page.on('requestfailed', request => {
      if (interceptNavigation && request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        console.log(`[contact-map-stage] ${engine} native requestfailed arrived: ${request.url()}`);
      }
    });
    await page.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (utcClockRoute.test(url.href)) return fulfillUtcClock(route);
      if (url.origin === server.baseUrl && url.pathname === '/api/maps-config') {
        if (!isMapChildRequest(request, page)) return route.abort();
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ enabled: true, apiKey: 'test-google-key' }) });
      }
      if (url.origin === 'https://maps.googleapis.com' && url.pathname === '/maps/api/js') {
        scriptRequests += 1;
        if (!isMapChildRequest(request, page)) return route.abort();
        return route.fulfill({ contentType: 'application/javascript', body: googleMapsMock });
      }
      if (interceptNavigation && request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        navigations.push(request.url());
        console.log(`[contact-map-stage] ${engine} native request arrived: ${request.url()}`);
        return route.abort('aborted');
      }
      if (url.origin !== server.baseUrl || !['GET', 'HEAD'].includes(request.method())) return route.abort();
      return route.continue();
    });
    await page.goto(`${server.baseUrl}/ru/kontakty.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const consent = page.locator('[data-cookie-choice="accept"]');
    if (await consent.isVisible()) await consent.tap();
    await page.locator('.map-native').evaluate(map => map.scrollIntoView({ behavior: 'instant', block: 'center' }));
    await page.waitForSelector('.map-native[data-map-provider="google"]', { timeout: 15000 });
    const child = await assertDocumentIsolation(page);
    await child.evaluate(async () => {
      await document.fonts.ready;
      const map = window.__mockMapLease.instances[0];
      window.__leaseOriginalMap = map;
      window.__leaseOriginalCamera = { heading: map.heading, range: map.range };
      map.heading = 127;
      map.range = 360;
    });
    const snapshot = async label => {
      const state = {
        ...await child.evaluate(() => {
        const mock = window.__mockMapLease;
        const container = document.querySelector('.map-native');
        const map = mock.instances[0];
        const mapRect = map.getBoundingClientRect();
        const mapStyle = getComputedStyle(map);
        return {
          connected: map.isConnected, rendered: mock.isRendered(map), suspended: container.dataset.mapSuspended ?? null,
          mapDisplay: mapStyle.display, mapVisibility: mapStyle.visibility,
          mapOpacity: mapStyle.opacity, mapPointerEvents: mapStyle.pointerEvents,
          mapInert: map.inert, mapRect: { width: mapRect.width, height: mapRect.height },
          sameInstance: map === window.__leaseOriginalMap, constructorCount: mock.constructorCount,
          connectionCount: mock.connectionCount, disconnectionCount: mock.disconnectionCount,
          heading: map.heading, range: map.range, flyCount: mock.flyCount, stopCount: mock.stopCount,
          pointerdowns: mock.pointerdowns.slice(),
        };
        }),
        ...await page.locator(frameSelector).evaluate(frame => {
          const rect = frame.getBoundingClientRect();
          const style = getComputedStyle(frame);
          return {
            frameConnected: frame.isConnected, frameDisplay: style.display, frameVisibility: style.visibility,
            frameOpacity: style.opacity, framePointerEvents: style.pointerEvents, frameInert: frame.inert,
            frameRect: { width: rect.width, height: rect.height },
            visible: rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth,
            rect: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
            navOpen: document.body.classList.contains('nav-open'), actualDpr: window.devicePixelRatio,
            googleAbsent: typeof window.google === 'undefined',
          };
        }),
      };
      console.log(`[contact-map-lease] ${engine} ${label}: ${JSON.stringify(state)}`);
      return state;
    };
    let parentInputPointerBaseline;
    const expectLease = async (label, rendered) => {
      try {
        await child.waitForFunction(expected => {
          const mock = window.__mockMapLease;
          const map = mock?.instances[0];
          const container = document.querySelector('.map-native');
          return map?.isConnected && mock.isRendered(map) === expected
            && container.dataset.mapSuspended === (expected ? '0' : '1');
        }, rendered, { polling: 50, timeout: 5000 });
      } catch (error) {
        if (error.name !== 'TimeoutError') throw error;
      }
      const state = await snapshot(label);
      assert.equal(state.connected, true, `${label}: 3D remains connected until terminal disposal`);
      assert.equal(state.frameConnected, true, `${label}: first-party map document remains connected`);
      assert.equal(state.googleAbsent, true, `${label}: parent never loads Google SDK`);
      assert.deepEqual(state.frameRect, { width: 360, height: 440 }, `${label}: iframe viewport dimensions are retained`);
      assert.notEqual(state.frameDisplay, 'none', `${label}: iframe keeps its layout surface`);
      assert.equal(state.frameVisibility, rendered ? 'visible' : 'hidden', `${label}: parent iframe visibility follows lease`);
      assert.equal(state.frameOpacity, rendered ? '1' : '0', `${label}: parent iframe opacity follows lease`);
      assert.equal(state.frameInert, !rendered, `${label}: only active iframe accepts accessible input`);
      if (rendered) assert.notEqual(state.framePointerEvents, 'none', `${label}: active iframe accepts pointers`);
      else assert.equal(state.framePointerEvents, 'none', `${label}: inactive iframe does not intercept pointers`);
      assert.equal(state.rendered, rendered, `${label}: 3D render suppression`);
      assert.notEqual(state.mapDisplay, 'none', `${label}: lease does not collapse the 3D layout surface`);
      assert.deepEqual(state.mapRect, { width: 360, height: 440 }, `${label}: 3D viewport dimensions are retained`);
      assert.equal(state.mapVisibility, rendered ? 'visible' : 'hidden', `${label}: 3D visibility follows lease`);
      assert.equal(state.mapOpacity, rendered ? '1' : '0', `${label}: 3D opacity follows lease`);
      assert.equal(state.mapInert, !rendered, `${label}: only active 3D accepts accessible input`);
      if (rendered) assert.notEqual(state.mapPointerEvents, 'none', `${label}: active 3D accepts pointer input`);
      else assert.equal(state.mapPointerEvents, 'none', `${label}: suspended 3D does not intercept pointers`);
      assert.equal(state.suspended, rendered ? '0' : '1', `${label}: suspension state`);
      assert.equal(state.sameInstance, true, `${label}: original Map3DElement retained`);
      assert.equal(state.constructorCount, 1, `${label}: no replacement Map3D constructor`);
      assert.equal(state.connectionCount, 1, `${label}: 3D is connected only once`);
      assert.equal(state.disconnectionCount, 0, `${label}: lease does not disconnect 3D`);
      assert.equal(scriptRequests, 1, `${label}: no replacement SDK load`);
      assert.equal(state.heading, 127, `${label}: camera heading retained`);
      assert.equal(state.range, 360, `${label}: camera range retained`);
      assert.equal(state.flyCount, 0, `${label}: lease resume does not fly the camera`);
      assert.equal(state.stopCount, 0, `${label}: lease does not enqueue SDK commands`);
      if (parentInputPointerBaseline !== undefined) assert.equal(state.pointerdowns.length, parentInputPointerBaseline, `${label}: parent input never reaches child SDK listeners`);
      return state;
    };
    await expectLease('initial-visible', true);
    await bounded(child.locator('gmp-map-3d').tap({ timeout: 5000 }), 5000, 'positive native child map tap');
    await child.waitForFunction(() => window.__mockMapLease.pointerdowns.some(event => event.trusted), undefined, { polling: 50, timeout: 5000 });
    parentInputPointerBaseline = await child.evaluate(() => window.__mockMapLease.pointerdowns.length);
    assert.ok(parentInputPointerBaseline > 0, 'positive native child tap reaches child SDK listener');
    await expectLease('after-positive-native-child-map-input', true);
    // Controlled scrolling tests render ownership, not physical iPhone swipe delivery.
    await page.evaluate(() => { document.querySelector('.site-scroll-root').scrollTop = 0; });
    const offscreen = await expectLease('controlled-offscreen', false);
    assert.equal(offscreen.visible, false, 'offscreen fixture is outside the actual viewport');
    assert.equal(offscreen.stopCount, 0, 'render lease suspension must not enqueue SDK commands');
    await page.locator('.map-native').evaluate(map => map.scrollIntoView({ behavior: 'instant', block: 'center' }));
    await expectLease('controlled-return-visible', true);

    // These dispatches validate application lifecycle handling, not native BFCache/device visibility.
    await page.evaluate(() => window.dispatchEvent(new window.PageTransitionEvent('pagehide', { persisted: true })));
    await expectLease('synthetic-persisted-pagehide', false);
    await page.evaluate(() => window.dispatchEvent(new window.PageTransitionEvent('pageshow', { persisted: true })));
    await expectLease('synthetic-persisted-pageshow', true);
    await page.evaluate(() => document.querySelector('#burgerBtn').dispatchEvent(new window.PointerEvent('pointerdown', {
      bubbles: true, pointerId: 73, pointerType: 'touch', button: 0,
    })));
    await expectLease('synthetic-held-outside-pointer', false);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expectLease('synthetic-hidden', false);
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expectLease('synthetic-visible-clears-held-pointer', true);
    await page.evaluate(() => {
      document.querySelector('#burgerBtn').focus({ preventScroll: true });
      document.querySelector('#burgerBtn').dispatchEvent(new window.PointerEvent('pointerdown', {
        bubbles: true, pointerId: 74, pointerType: 'touch', button: 0,
      }));
      window.dispatchEvent(new Event('blur'));
    });
    await expectLease('synthetic-blur-clears-held-pointer', false);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expectLease('synthetic-focus-resumes-after-held-pointer', true);
    await page.evaluate(() => {
      document.querySelector('#burgerBtn').focus({ preventScroll: true });
      window.dispatchEvent(new Event('blur'));
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expectLease('synthetic-visible-resumes-without-focus-event', true);
    await page.evaluate(async () => {
      document.querySelector('#burgerBtn').dispatchEvent(new window.PointerEvent('pointerdown', {
        bubbles: true, pointerId: 75, pointerType: 'touch', button: 0,
      }));
      document.body.classList.add('booking-modal-open');
      window.dispatchEvent(new window.PointerEvent('pointerup', { pointerId: 75, pointerType: 'touch' }));
      await new Promise(resolve => setTimeout(resolve, 0));
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await expectLease('controlled-booking-open-after-resume-frame', false);
    await page.evaluate(() => document.body.classList.remove('booking-modal-open'));
    await expectLease('controlled-booking-close-resumes', true);

    const showHeader = async () => {
      if (await page.evaluate(() => document.body.classList.contains('hide-header'))) {
        await page.locator('.header-reveal-control').tap();
        await expectLease('native-header-reveal', true);
      }
    };
    await showHeader();
    await page.locator('#burgerBtn').tap();
    await page.waitForFunction(() => document.body.classList.contains('nav-open'), undefined, { polling: 50, timeout: 5000 });
    const openState = await expectLease('native-burger-open', false);
    assert.equal(openState.pointerdowns.length, parentInputPointerBaseline, 'native parent burger does not reach isolated SDK listeners');
    await page.locator('#burgerBtn').tap();
    await page.waitForFunction(() => !document.body.classList.contains('nav-open'), undefined, { polling: 50, timeout: 5000 });
    await expectLease('native-X-close', true);
    await assertDocumentIsolation(page);
    await assertMessageProtocol(page, child, 'ru');

    await showHeader();
    const logo = page.locator('.logo a[href]');
    await logo.waitFor({ state: 'visible', timeout: 5000 });
    const expectedHome = new URL(await logo.getAttribute('href'), page.url()).href;
    await child.evaluate(() => Object.assign(window.__leaseOriginalMap, window.__leaseOriginalCamera));
    const logoGeometry = await bounded(logo.evaluate(anchor => {
      const rect = anchor.getBoundingClientRect();
      const points = [[0.5, 0.5], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]].map(([xRatio, yRatio]) => {
        const x = rect.left + rect.width * xRatio;
        const y = rect.top + rect.height * yRatio;
        const target = document.elementFromPoint(x, y);
        return { x, y, hit: target === anchor || anchor.contains(target), target: target?.tagName || null };
      });
      return {
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
        viewport: { width: window.innerWidth, height: window.innerHeight }, points,
      };
    }), 5000, 'native logo geometry');
    console.log(`[contact-map-stage] ${engine} before native logo action: ${JSON.stringify(logoGeometry)}`);
    assert.ok(logoGeometry.rect.width > 0 && logoGeometry.rect.height > 0, 'native logo has nonzero geometry');
    assert.ok(logoGeometry.rect.left >= 0 && logoGeometry.rect.top >= 0
      && logoGeometry.rect.right <= logoGeometry.viewport.width && logoGeometry.rect.bottom <= logoGeometry.viewport.height, 'native logo is fully within viewport');
    assert.equal(logoGeometry.points.length, 5, 'native logo has five fresh hit-test points');
    assert.ok(logoGeometry.points.every(point => point.hit), 'all native logo points hit the actual anchor');
    interceptNavigation = true;
    const [, activationMessage] = await Promise.all([
      page.waitForRequest(request => request.isNavigationRequest() && request.frame() === page.mainFrame() && request.url() === expectedHome, { timeout: 5000 }),
      page.waitForEvent('console', {
        predicate: message => message.text().startsWith(activationPrefix)
          && JSON.parse(message.text().slice(activationPrefix.length)).href === expectedHome,
        timeout: 5000,
      }),
      page.waitForEvent('requestfailed', { predicate: request => request.url() === expectedHome, timeout: 5000 }),
      bounded(page.touchscreen.tap(logoGeometry.points[0].x, logoGeometry.points[0].y), 5000, 'native logo touchscreen tap')
        .then(() => console.log(`[contact-map-stage] ${engine} native logo touchscreen returned`)),
    ]);
    const navigationState = JSON.parse(activationMessage.text().slice(activationPrefix.length));
    console.log(`[contact-map-lease] ${engine} native-logo-click-before-default: ${JSON.stringify(navigationState)}`);
    assert.equal(navigationState.trusted, true, 'native logo activation is a trusted click');
    assert.equal(navigationState.googleAbsent, true, 'native logo parent has no Google namespace');
    assert.equal(navigationState.defaultPrevented, false, 'native logo activation is not canceled by app handlers');
    assert.equal(navigationState.connected, true, 'outside logo activation keeps the same 3D element connected');
    assert.equal(navigationState.rendered, false, 'outside logo activation suppresses 3D before native navigation');
    assert.notEqual(navigationState.display, 'none', 'native logo activation does not collapse the 3D surface');
    assert.deepEqual(navigationState.geometry, { width: 360, height: 440 }, 'native logo activation retains viewport dimensions');
    assert.equal(navigationState.visibility, 'hidden', 'native logo activation hides the 3D surface');
    assert.equal(navigationState.opacity, '0', 'native logo activation clears 3D opacity');
    assert.equal(navigationState.inert, true, 'native logo activation disables hidden 3D controls');
    assert.equal(navigationState.pointerEvents, 'none', 'native logo activation prevents 3D pointer interception');
    assert.equal(navigationState.sameInstance, true, 'native logo activation retains the original Map3D object');
    assert.ok(navigations.includes(expectedHome), 'native logo navigation request observed before local load cancellation');
    assert.equal(scriptRequests, 1, 'native transitions do not reload SDK');
    assert.equal(navigationState.constructorCount, 1, 'native transitions do not recreate Map3D');
    assert.equal(navigationState.connectionCount, 1, 'native transitions do not reconnect Map3D');
    assert.equal(navigationState.disconnectionCount, 0, 'native transitions do not disconnect Map3D');
    assert.equal(navigationState.stopCount, 0, 'native capture does not enqueue SDK commands');
    assert.equal(navigationState.childPointerCount, parentInputPointerBaseline, 'native parent logo does not reach isolated child SDK');
    assert.deepEqual(errors, [], 'mocked mobile render lease has no page errors');
    console.log(`[contact-map] ${engine} mobile mocked lifecycle: ok; trusted burger/X/logo; controlled scroll; synthetic visibility/BFCache; no physical-device/GPU claim`);
  } finally {
    console.log(`[contact-map-stage] ${engine} before leaseContext.close`);
    await bounded(leaseContext.close(), 10000, 'leaseContext.close');
    console.log(`[contact-map-stage] ${engine} after leaseContext.close`);
  }
} finally {
  try {
    console.log(`[contact-map-stage] ${engine} before browser.close`);
    await bounded(browser.close(), 10000, 'browser.close');
    console.log(`[contact-map-stage] ${engine} after browser.close`);
  } finally {
    console.log(`[contact-map-stage] ${engine} before server.close`);
    await bounded(server.close(), 5000, 'server.close');
    console.log(`[contact-map-stage] ${engine} after server.close`);
  }
}
