import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';

import { startStaticTestServer } from './lib/static-test-server.mjs';

const layouts = [
  ['desktop', { width: 1440, height: 900 }],
  ['mobile', devices['iPhone 13'].viewport],
];
const locales = ['de', 'en', 'ru', 'uk'];
const server = await startStaticTestServer();
const browser = await chromium.launch({ headless: true });

try {
  for (const locale of locales) {
    for (const [layout, viewport] of layouts) {
      const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));

      await page.goto(`${server.baseUrl}/${locale}/kontakty.html`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await page.locator('.map-native').scrollIntoViewIfNeeded();
      await page.waitForSelector('.map-native[data-map-ready="1"]', { timeout: 15000 });
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
      await page.waitForTimeout(700);
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
  const googlePage = await googleContext.newPage();
  let requestedGoogleScriptUrl = '';
  await googlePage.route('**/api/maps-config', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ enabled: true, apiKey: 'browser-test-key' }),
    })
  );
  await googlePage.route('https://maps.googleapis.com/maps/api/js**', route => {
    requestedGoogleScriptUrl = route.request().url();
    return route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        (() => {
          class MockMap3D extends HTMLElement {
            constructor(options = {}) { super(); Object.assign(this, options); }
            flyCameraTo(options) { this.lastFlyCameraTo = options; Object.assign(this, options.endCamera); }
          }
          class MockMarker extends HTMLElement {
            constructor(options = {}) { super(); Object.assign(this, options); }
          }
          class MockMap2D {
            constructor(element, options = {}) {
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
          window.google = {
            maps: {
              importLibrary: async library => {
                if (library === 'maps3d') {
                  return { Map3DElement: MockMap3D, MarkerElement: MockMarker };
                }
                if (library === 'maps') return { Map: MockMap2D };
                throw new Error('Unexpected Google Maps library');
              },
              Marker: MockMapMarker,
              Size: MockMapSize,
              Point: MockMapPoint,
              event: { trigger() {} },
            },
          };
          window.__hundesalonNikaMapsReady();
        })();
      `,
    });
  });

  await googlePage.goto(`${server.baseUrl}/ru/kontakty.html`, { waitUntil: 'domcontentloaded' });
  await googlePage.locator('.map-native').scrollIntoViewIfNeeded();
  await googlePage.waitForSelector('.map-native[data-map-provider="google"]', { timeout: 15000 });

  const googleState = await googlePage.locator('.map-native').evaluate(map => {
    const marker = map.querySelector('gmp-marker');
    return {
      modeCount: document.querySelectorAll('.map-mode-button').length,
      modeIds: [...document.querySelectorAll('.map-mode-button')].map(button => button.dataset.mapMode),
      provider: map.dataset.mapProvider,
      mapMode: map.querySelector('gmp-map-3d')?.mode,
      mapCount: map.querySelectorAll('gmp-map-3d').length,
      alternateMapCount: document.querySelectorAll('.leaflet-container, .contact-map-2d').length,
      controlCount: document.querySelectorAll('.contact-map-control').length,
      badgeCount: document.querySelectorAll('.map-mode-badge').length,
      navControlCount: document.querySelectorAll('.map-nav-control[data-nav-pill]').length,
      boundNavControlCount: document.querySelectorAll('.map-nav-control[data-nav-pill][data-nav-pill-bound="1"]').length,
      activeModePlasmaCount: document.querySelectorAll('.map-mode-button[aria-pressed="true"] .nav-plasma--active').length,
      recenterIcon: document.querySelector('.contact-map-control-image-recenter')?.getAttribute('src'),
      streetViewIcon: document.querySelector('.contact-map-control-streetview .contact-map-control-image')?.getAttribute('src'),
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
  });
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

  await googlePage.getByRole('button', { name: 'Карта', exact: true }).click();
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
  assert.equal(
    await googlePage.locator('.map-native > *').count(),
    1,
    'exactly one Google map remains mounted in road mode'
  );
  assert.equal(await googlePage.locator('.contact-map-2d').count(), 1, 'Google road map is visible');
  assert.deepEqual(
    await googlePage.evaluate(() => ({
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
  assert.equal(await googlePage.locator('.map-native > gmp-map-3d').count(), 0, '3D map is unmounted in road mode');
  assert.equal(
    await googlePage.locator('.contact-map-controls').evaluate(controls => controls.hidden),
    false,
    'the shared map controls remain visible in road mode'
  );
  await googlePage.getByRole('button', { name: 'Приблизить', exact: true }).click();
  assert.equal(
    await googlePage.locator('.contact-map-2d').evaluate(map => map.mockMap.zoom),
    18,
    'custom zoom control changes the road-map zoom'
  );
  await googlePage.getByRole('button', { name: 'Гибрид 3D', exact: true }).click();
  assert.equal(await googlePage.locator('.map-native > gmp-map-3d').count(), 1, 'Hybrid 3D map is mounted again');
  assert.equal(await googlePage.locator('.map-native > .contact-map-2d').count(), 0, 'road map is unmounted');
  assert.equal(
    await googlePage.locator('.contact-map-controls').evaluate(controls => controls.hidden),
    false,
    '3D camera controls are restored in Hybrid mode'
  );
  await googlePage.getByRole('button', { name: 'Приблизить', exact: true }).click();
  assert.ok(
    (await googlePage.locator('gmp-map-3d').evaluate(map => map.lastFlyCameraTo.endCamera.range)) < 520,
    'custom zoom control changes the 3D camera range'
  );
  console.log('[contact-map] single Google map, two modes, controls, localization and marker: ok');
  await googleContext.close();
} finally {
  await browser.close();
  await server.close();
}
