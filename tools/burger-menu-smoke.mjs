import assert from 'node:assert/strict';
import { mkdir, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

import { startStaticTestServer } from './lib/static-test-server.mjs';

const outputArgument = process.env.BURGER_MENU_OUTPUT;
let output = path.resolve('test-results', 'burger-menu');
const workspace = await realpath(fileURLToPath(new URL('../', import.meta.url)));
if (outputArgument !== undefined) {
  assert.ok(outputArgument.length > 0, 'BURGER_MENU_OUTPUT must not be empty');
  const outputRoot = await realpath(path.join(workspace, 'output'));
  const relativeOutputRoot = path.relative(workspace, outputRoot);
  assert.ok(relativeOutputRoot !== '..' && !relativeOutputRoot.startsWith(`..${path.sep}`) && !path.isAbsolute(relativeOutputRoot),
    'Workspace output must resolve inside this workspace');
  const requested = path.resolve(workspace, outputArgument);
  const parent = await realpath(path.dirname(requested));
  const relativeParent = path.relative(outputRoot, parent);
  assert.ok(relativeParent !== '..' && !relativeParent.startsWith(`..${path.sep}`) && !path.isAbsolute(relativeParent),
    'BURGER_MENU_OUTPUT parent must resolve inside workspace/output');
  assert.ok((await stat(parent)).isDirectory(), 'BURGER_MENU_OUTPUT parent must be an existing directory');
  const leaf = path.basename(requested);
  assert.match(leaf, /^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'BURGER_MENU_OUTPUT must name a new owned leaf');
  assert.ok(!leaf.endsWith('.'), 'BURGER_MENU_OUTPUT leaf must not end with a dot');
  output = path.join(parent, leaf);
}
const root = await realpath(path.resolve(workspace, process.env.BURGER_MENU_ROOT || '.'));
const relativeRoot = path.relative(workspace, root);
assert.ok(relativeRoot !== '..' && !relativeRoot.startsWith(`..${path.sep}`) && !path.isAbsolute(relativeRoot),
  'BURGER_MENU_ROOT must resolve inside this workspace');
assert.ok((await stat(root)).isDirectory(), 'BURGER_MENU_ROOT must be a directory');
const engine = process.env.BURGER_MENU_ENGINE ?? 'chromium';
assert.ok(['chromium', 'webkit'].includes(engine), 'BURGER_MENU_ENGINE must be chromium or webkit');
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];
const scenarios = ['de', 'en', 'ru', 'uk'].flatMap(locale =>
  viewports.map(viewport => ({ locale, viewport, route: 'index.html', reducedMotion: 'no-preference' }))
);
scenarios.push(
  { locale: 'ru', viewport: viewports[1], route: 'index.html', reducedMotion: 'reduce' },
  { locale: 'ru', viewport: viewports[1], route: 'blog/blog.html', reducedMotion: 'no-preference' },
  { locale: 'ru', viewport: viewports[1], route: 'kontakty.html', reducedMotion: 'no-preference', deviceScaleFactor: 3 }
);
const scenarioName = ({ locale, viewport, route, reducedMotion }) =>
  `${locale}-${viewport.width}-${route === 'kontakty.html' ? 'contacts' : route.startsWith('blog/') ? 'blog' : 'home'}-${reducedMotion}`;
const filters = {
  name: process.env.BURGER_MENU_CASE,
  locale: process.env.BURGER_MENU_LOCALE,
  width: process.env.BURGER_MENU_WIDTH,
};
if (filters.name !== undefined) assert.ok(scenarios.some(scenario => scenarioName(scenario) === filters.name),
  'BURGER_MENU_CASE must name an existing scenario');
if (filters.locale !== undefined) assert.ok(scenarios.some(scenario => scenario.locale === filters.locale),
  'BURGER_MENU_LOCALE must name an existing locale');
if (filters.width !== undefined) assert.ok(viewports.some(viewport => String(viewport.width) === filters.width),
  'BURGER_MENU_WIDTH must name an existing viewport width');
const selectedScenarios = scenarios.filter(scenario =>
  (filters.name === undefined || scenarioName(scenario) === filters.name) &&
  (filters.locale === undefined || scenario.locale === filters.locale) &&
  (filters.width === undefined || String(scenario.viewport.width) === filters.width)
);
assert.ok(selectedScenarios.length > 0, 'Scenario filters must select at least one existing case');
const selection = {
  engine, root, output, filters, scope: selectedScenarios.length === scenarios.length ? 'full-matrix' : 'filtered',
  availableScenarios: scenarios.length, selectedCases: selectedScenarios.map(scenarioName),
  selectedProfiles: selectedScenarios.map(scenario => ({ name: scenarioName(scenario), deviceScaleFactor: scenario.deviceScaleFactor ?? 1 })),
};
console.log(JSON.stringify({ selection }));

await mkdir(output, { recursive: outputArgument === undefined });
const server = await startStaticTestServer(root);
const browser = await ({ chromium, webkit })[engine].launch({
  headless: true,
  ...(engine === 'chromium' ? { channel: process.env.PLAYWRIGHT_CHANNEL || undefined } : {}),
});
const results = [];
const materialChecks = [];
const targetChecks = new Map();
const weatherServicePath = '/3d-weather-codrops-main/dist-widget/weatherService-iG8lrujy.mjs';
const offlineWeatherService = `
  export const i = {
    async getCurrentWeather() { throw new Error('Unable to load weather data right now.'); },
    async searchLocations() { return []; },
    async getCurrentLocation() { throw new Error('Geolocation is not available in navigation smoke.'); },
  };
  export const n = () => false;
  export const r = () => false;
  export const t = () => 'cloudy';
`;
const withoutHash = value => {
  const url = new URL(value);
  url.hash = '';
  return url.href;
};

try {
  for (const scenario of selectedScenarios) {
    const { locale, viewport, route, reducedMotion, deviceScaleFactor } = scenario;
    const name = scenarioName(scenario);
    const activate = (locator, options) => viewport.width < 900 ? locator.tap() : locator.click(options);
    const context = await browser.newContext({
      viewport,
      isMobile: viewport.width < 900,
      hasTouch: viewport.width < 900,
      serviceWorkers: 'block',
      reducedMotion,
      ...(deviceScaleFactor === undefined ? {} : { deviceScaleFactor }),
    });
    if (route === 'kontakty.html') {
      // Keep the document flow independent of weather. WebKit can report a
      // weather fetch canceled by navigation as an access-control error.
      await context.addInitScript(() => {
        const fetch = window.fetch.bind(window);
        window.fetch = (input, options) => {
          const address = input instanceof Request ? input.url : String(input);
          const url = new URL(address, location.href);
          if (url.origin === 'https://geocoding-api.open-meteo.com' && url.pathname === '/v1/search') {
            return Promise.resolve(Response.json({ results: [] }));
          }
          if (url.origin === location.origin && url.pathname === '/api/weather') {
            return Promise.resolve(Response.json({ error: 'Offline navigation fixture' }, { status: 503 }));
          }
          if (url.origin === 'https://api.sunrise-sunset.org' && url.pathname === '/json') {
            return Promise.resolve(Response.json({ error: 'Offline navigation fixture' }, { status: 503 }));
          }
          if (url.origin === location.origin && url.pathname === '/site.webmanifest' && url.searchParams.has('_ts')) {
            return Promise.resolve(new Response(null, { headers: { Date: new Date().toUTCString() } }));
          }
          if (url.origin === 'https://worldtimeapi.org' && url.pathname === '/api/timezone/Etc/UTC') {
            return Promise.resolve(Response.json({ utc_datetime: new Date().toISOString() }));
          }
          if (url.origin === 'https://timeapi.io' && url.pathname === '/api/Time/current/zone') {
            return Promise.resolve(Response.json({ dateTime: new Date().toISOString() }));
          }
          return fetch(input, options);
        };
      });
    }
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let interceptNavigation = false;
    let disabledSections = '';
    const navigations = [];
    await context.route('**/*', async requestRoute => {
      const request = requestRoute.request();
      const url = new URL(request.url());
      if (url.pathname === '/assets/js/local-dev-refresh.js') {
        await requestRoute.fulfill({ contentType: 'application/javascript', body: '/* Workstation refresh is isolated in browser QA. */' });
      } else if (interceptNavigation && request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        navigations.push(request.url());
        // Keep the source document alive for the full tile matrix. Real document navigation is tested below.
        await requestRoute.abort('aborted');
      } else if (request.isNavigationRequest() && request.frame() === page.mainFrame() && url.origin === server.baseUrl) {
        // Serve the same section state the Pages middleware supplies in production.
        const response = await requestRoute.fetch();
        const body = (await response.text()).replace('<html ', `<html data-disabled-sections="${disabledSections}" `);
        await requestRoute.fulfill({ response, body });
      } else if (route === 'kontakty.html' && url.origin === server.baseUrl && url.pathname === weatherServicePath) {
        // Keep the real widget mounted without starting Axios requests that can outlive the source document.
        await requestRoute.fulfill({ contentType: 'application/javascript', body: offlineWeatherService });
      } else if (request.method() === 'GET' && !request.isNavigationRequest() &&
        url.origin === 'https://geocoding-api.open-meteo.com' && url.pathname === '/v1/search') {
        // Also serve the pinned fixture when a browser context bypasses the window.fetch stub.
        await requestRoute.fulfill({
          headers: { 'access-control-allow-origin': server.baseUrl }, json: { results: [] },
        });
      } else if (request.method() === 'GET' && !request.isNavigationRequest() &&
        url.origin === server.baseUrl && url.pathname === '/api/weather') {
        await requestRoute.fulfill({ status: 503, json: { error: 'Offline navigation fixture' } });
      } else if (request.method() === 'GET' && !request.isNavigationRequest() &&
        url.origin === 'https://api.sunrise-sunset.org' && url.pathname === '/json') {
        await requestRoute.fulfill({
          status: 503,
          headers: { 'access-control-allow-origin': server.baseUrl },
          json: { error: 'Offline navigation fixture' },
        });
      } else if (url.origin !== server.baseUrl) {
        await requestRoute.abort();
      } else {
        await requestRoute.continue();
      }
    });
    try {
      await page.goto(`${server.baseUrl}/${locale}/${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const burger = page.locator('.premium-burger').first();
      const nav = page.locator('#mobile-nav');
      const links = nav.locator('a[href]');
      await burger.waitFor({ state: 'visible', timeout: 15000 });
      await page.evaluate(() => document.fonts.ready);
      const consent = page.locator('[data-cookie-choice="accept"]');
      if (await consent.isVisible()) await activate(consent);
      const assertClosed = async () => {
        await page.waitForFunction(() => {
          const menu = document.querySelector('#mobile-nav');
          return menu?.inert && menu.getAttribute('aria-hidden') === 'true' && !document.body.classList.contains('nav-open');
        });
        assert.deepEqual(await nav.evaluate(element => ({
          inert: element.inert,
          hidden: element.getAttribute('aria-hidden'),
          locked: document.body.classList.contains('nav-open'),
        })), { inert: true, hidden: 'true', locked: false }, `${name}: closed drawer must be inert and unlock the page`);
      };
      const open = async () => {
        await activate(burger);
        await page.waitForFunction(() => {
          const element = document.querySelector('#mobile-nav');
          return element?.classList.contains('active') && !element.inert &&
            element.getAnimations({ subtree: true }).filter(animation => !animation.effect?.pseudoElement).every(animation =>
              animation.effect?.getComputedTiming().iterations === Infinity || animation.playState !== 'running'
            );
        });
      };
      await assertClosed();
      await open();
      await page.waitForFunction(() => {
        const element = document.querySelector('#mobile-nav');
        return element?.dataset.menuContour === 'ready' && Boolean(element.querySelector(':scope > canvas.site-menu-contour'));
      }, undefined, { polling: 50, timeout: 15000 });
      if (route === 'kontakty.html') {
        await page.waitForFunction(() => {
          const contacts = document.querySelector('.contacts.section');
          return contacts && getComputedStyle(contacts).opacity === '0.4';
        }, undefined, { polling: 50, timeout: 5000 });
      }
      const material = await nav.evaluate(element => {
        const canvas = element.querySelector(':scope > canvas.site-menu-contour');
        const contacts = document.querySelector('.contacts.section');
        return {
          actualDpr: window.devicePixelRatio,
          canvasBacking: { width: canvas.width, height: canvas.height },
          canvasCssSize: { width: canvas.clientWidth, height: canvas.clientHeight },
          canvasFilter: getComputedStyle(canvas).filter,
          contactsFilter: contacts ? getComputedStyle(contacts).filter : null,
          contactsInfoFilter: contacts ? getComputedStyle(contacts.querySelector('.contacts-info')).filter : null,
          contactsOpacity: contacts ? getComputedStyle(contacts).opacity : null,
        };
      });
      materialChecks.push({ scenario: name, ...material });
      console.log(JSON.stringify({ scenario: name, engine, root, material }));
      if (route === 'kontakty.html') {
        assert.equal(material.actualDpr, 3, `${name}: contacts regression must exercise iPhone pixel density`);
        assert.equal(material.contactsFilter, 'none', `${name}: contacts map ancestor must not receive backdrop blur`);
        assert.equal(material.contactsInfoFilter, 'blur(2px)', `${name}: static contact details retain the background softness`);
        assert.equal(material.contactsOpacity, '0.4', `${name}: contacts retain the dimmed background while navigation is open`);
      }
      assert.equal(material.canvasFilter, 'none', `${name}: the large menu canvas must not receive a compositing filter`);
      assert.equal(await nav.locator('button').count(), 0, `${name}: every menu tile must be a direct link`);
      const hrefs = await links.evaluateAll(items => items.map(item => ({ href: item.href, label: item.textContent.trim() })));
      assert.equal(hrefs.length, 14, `${name}: menu destinations are complete`);
      assert.deepEqual(hrefs.slice(7).map(item => new URL(item.href).pathname.replace(`/${locale}/`, '')), [
        'o-nas.html', 'vvedenie.html', 'social.html', 'reyting.html',
        'blog/blog.html', 'partnerstvo.html', 'documents.html',
      ], `${name}: lower rows retain the requested left/right pairs`);
      assert.ok(hrefs.some(item => new URL(item.href).pathname.endsWith('/galereya.html')));
      assert.ok(hrefs.some(item => new URL(item.href).pathname.endsWith('/do-i-posle.html')));

      const geometry = await links.evaluateAll(items => items.map(item => {
        const rect = item.getBoundingClientRect();
        const text = document.createRange();
        text.selectNodeContents(item);
        const textRect = text.getBoundingClientRect();
        const style = getComputedStyle(item);
        return {
          promotion: item.classList.contains('mobile-nav-link--promotions'),
          left: rect.left, top: rect.top, bottom: rect.bottom,
          width: rect.width, height: rect.height,
          textContained: textRect.left >= rect.left && textRect.right <= rect.right + 1 &&
            textRect.top >= rect.top && textRect.bottom <= rect.bottom + 1,
          infiniteMotion: style.animationIterationCount.split(',').some(value => value.trim() === 'infinite'),
        };
      }));
      const regularTiles = geometry.filter(item => !item.promotion);
      assert.ok(regularTiles.every(item => Math.abs(item.width - regularTiles[0].width) <= 1 &&
        Math.abs(item.height - regularTiles[0].height) <= 1), `${name}: regular tiles must have uniform dimensions`);
      assert.ok(geometry.every(item => item.height >= 44 && item.height <= 48), `${name}: all tiles remain compact touch targets`);
      const promotionGeometry = geometry.find(item => item.promotion);
      const contentWidth = await nav.locator('.mobile-nav__content').evaluate(element => {
        const style = getComputedStyle(element);
        return element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      });
      assert.equal(geometry.findIndex(item => item.promotion), 6, `${name}: promotions separate the six service/result links from salon information`);
      assert.ok(Math.abs(promotionGeometry.width - contentWidth) <= 1 &&
        Math.abs(promotionGeometry.left - regularTiles[0].left) <= 1 &&
        promotionGeometry.top >= geometry[5].bottom && promotionGeometry.bottom <= geometry[7].top,
      `${name}: promotions occupy a full row between the groups`);
      const promotion = nav.locator('a[href$="promotions.html"]');
      assert.equal(await promotion.locator('.promo-btn-icon[aria-hidden="true"]').count(), 1, `${name}: promotions retain the decorative icon`);
      await page.waitForFunction(() => {
        const image = document.querySelector('#mobile-nav a[href$="promotions.html"] img');
        return image?.complete && image.naturalWidth > 0;
      }, undefined, { polling: 50, timeout: 15000 });
      assert.equal(await promotion.locator('img').evaluate(image => image.complete && image.naturalWidth > 0), true, `${name}: promotion icon loads`);
      assert.ok(geometry.every(item => item.textContained), `${name}: labels must fit inside their tile`);
      assert.ok(geometry.every(item => !item.infiniteMotion), `${name}: text must not move in a perpetual loop`);
      const drawer = await nav.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const viewport = window.visualViewport;
        return {
          left: rect.left, right: rect.right, bottom: rect.bottom,
          viewportBottom: (viewport?.offsetTop || 0) + (viewport?.height || innerHeight),
          overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        };
      });
      assert.ok(drawer.left >= 0 && drawer.right <= viewport.width && !drawer.overflowX &&
        drawer.bottom <= drawer.viewportBottom, `${name}: drawer must stay inside the viewport`);

      await activate(burger);
      await assertClosed();
      await open();
      await links.last().focus();
      await page.keyboard.press('Tab');
      assert.equal(await links.first().evaluate(element => document.activeElement === element), true, `${name}: Tab wraps to first tile`);
      await page.keyboard.press('Shift+Tab');
      assert.equal(await links.last().evaluate(element => document.activeElement === element), true, `${name}: Shift+Tab wraps to last tile`);
      await page.keyboard.press('Escape');
      await assertClosed();
      assert.equal(await burger.evaluate(element => document.activeElement === element), true, `${name}: Escape restores burger focus`);
      await open();
      await nav.locator('.mobile-nav__content').evaluate(element => { element.scrollTop = 0; });
      await page.screenshot({ path: path.join(output, `${name}.png`), animations: 'disabled' });

      const tileChecks = [];
      interceptNavigation = true;
      await page.evaluate(() => {
        window.__drawerActivation = null;
        window.addEventListener('click', event => {
          const link = event.target.closest?.('#mobile-nav a[href]');
          if (!link) return;
          window.__drawerActivation = {
            href: link.href,
            trusted: event.isTrusted,
            prevented: event.defaultPrevented,
            inert: link.closest('#mobile-nav').inert,
            locked: document.body.classList.contains('nav-open'),
          };
        });
      });
      for (let index = 0; index < hrefs.length; index++) {
        const destination = new URL(hrefs[index].href);
        assert.equal(destination.origin, server.baseUrl, `${name}: menu links stay on this site`);
        assert.ok(destination.pathname.startsWith(`/${locale}/`), `${name}: menu links preserve the selected locale`);
        const targetKey = destination.href;
        if (!targetChecks.has(targetKey)) {
          const response = await context.request.get(destination.href);
          assert.equal(response.status(), 200, `${name}: ${destination.pathname} must load`);
          const html = await response.text();
          assert.match(html, new RegExp(`<html\\b[^>]*\\blang=["']${locale}["']`, 'i'));
          if (destination.hash) {
            const anchor = decodeURIComponent(destination.hash.slice(1));
            assert.ok(html.includes(`id="${anchor}"`) || html.includes(`id='${anchor}'`), `${name}: ${anchor} target exists`);
          }
          targetChecks.set(targetKey, { pathname: destination.pathname, hash: destination.hash, status: response.status() });
        }
        const link = links.nth(index);
        await link.scrollIntoViewIfNeeded();
        const hits = await link.evaluate(element => {
          const rect = element.getBoundingClientRect();
          return [[rect.width / 2, rect.height / 2], [8, 8], [rect.width - 8, 8],
            [8, rect.height - 8], [rect.width - 8, rect.height - 8]].map(([x, y]) => {
            const hit = document.elementFromPoint(rect.left + x, rect.top + y);
            return hit === element || element.contains(hit);
          });
        });
        assert.ok(hits.every(Boolean), `${name}: the entire ${hrefs[index].label} tile must receive input`);
        const requested = page.waitForRequest(request => request.isNavigationRequest() &&
          request.frame() === page.mainFrame() && withoutHash(request.url()) === withoutHash(destination.href));
        await activate(link, { noWaitAfter: true });
        await requested;
        assert.deepEqual(await page.evaluate(() => window.__drawerActivation), {
          href: destination.href, trusted: true, prevented: false, inert: false, locked: true,
        }, `${name}: the native click must finish dispatch before the drawer closes`);
        await assertClosed();
        tileChecks.push({ ...hrefs[index], hitPoints: hits.length, nativeNavigation: true });
        if (index < hrefs.length - 1) await open();
      }
      assert.equal(navigations.length, hrefs.length, `${name}: one native navigation per tile`);
      let documentNavigation = null;
      if (route === 'kontakty.html') {
        interceptNavigation = false;
        const navigate = async locator => {
          const destination = await locator.evaluate(link => link.href);
          await Promise.all([
            page.waitForURL(destination, { waitUntil: 'domcontentloaded', timeout: 15000 }),
            activate(locator),
          ]);
          await assertClosed();
          return new URL(page.url()).pathname;
        };
        await open();
        const services = await navigate(links.first());
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 });
        assert.equal(new URL(page.url()).pathname, `/${locale}/${route}`);
        await assertClosed();
        await open();
        const home = await navigate(page.locator('.logo a[href]'));
        assert.equal(home, `/${locale}/`, 'Logo opens the locale home directly from an open drawer');
        const promotionsLink = nav.locator('a[href$="promotions.html"]');
        await open();
        const promotions = await navigate(promotionsLink);
        assert.equal(promotions, `/${locale}/promotions.html`, 'Promotions opens its own localized document');
        assert.equal(new URL(page.url()).hash, '');
        await page.locator('main h1').waitFor({ state: 'visible' });
        const heading = await page.locator('main h1').innerText();
        const oldUrl = `${server.baseUrl}/${locale}/social.html?ref=bookmark#promotions`;
        await page.goto(oldUrl, { waitUntil: 'commit' });
        await page.waitForURL(`${server.baseUrl}${promotions}?ref=bookmark`, { waitUntil: 'domcontentloaded' });
        assert.equal(await page.locator('main h1').innerText(), heading, 'Old promotion bookmarks open the same page');
        disabledSections = 'promotions';
        await page.goto(oldUrl, { waitUntil: 'commit' });
        await page.waitForURL(oldUrl.replace('#promotions', ''), { waitUntil: 'domcontentloaded' });
        await page.locator('#burgerBtn').waitFor();
        assert.equal(await nav.locator('a[href$="promotions.html"]').count(), 0, 'The disabled page is absent from the drawer');
        documentNavigation = { services, back: `/${locale}/${route}`, home, promotions, legacyPromotion: true, disabledPromotion: true };
      }
      assert.deepEqual(errors, [], `${name}: no JavaScript errors`);
      results.push({ name, locale, viewport, route, reducedMotion, deviceScaleFactor: deviceScaleFactor ?? 1, actualDpr: material.actualDpr, input: viewport.width < 900 ? 'tap' : 'click', tileSize: geometry[0], drawer, tiles: tileChecks, documentNavigation });
      console.log(JSON.stringify({ scenario: name, engine, root, scope: selection.scope, ok: true, tiles: hrefs.length }));
    } catch (error) {
      await page.screenshot({ path: path.join(output, `${name}-failure.png`) }).catch(() => {});
      throw error;
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ ...selection, scenarios: results, materialChecks, targets: [...targetChecks.values()] }, null, 2));
}
console.log(JSON.stringify({ ok: true, ...selection, scenarios: results.length, uniqueTargets: targetChecks.size, output }));
