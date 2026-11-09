import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
import { startStaticTestServer } from './lib/static-test-server.mjs';

const baseline = process.argv.includes('--baseline');
const useWebKit = process.argv.includes('--webkit');
const engine = useWebKit ? 'webkit' : 'chromium';
const output = path.resolve('test-results', 'burger-menu-scroll');
await mkdir(output, { recursive: true });
const server = await startStaticTestServer();
const browser = await (useWebKit ? webkit : chromium).launch({ headless: true });
const cases = [
  { name: 'short-desktop', width: 1280, height: 620 },
  { name: 'narrow-desktop', width: 390, height: 640 },
  { name: 'fitting-desktop', width: 1440, height: 1200, route: '/ru/index.html' },
  ...(!useWebKit ? [{ name: 'native-touch', width: 390, height: 640, touch: true }] : []),
];
const results = [];
try {
  for (const scenario of cases) {
    const context = await browser.newContext({
      viewport: { width: scenario.width, height: scenario.height },
      isMobile: Boolean(scenario.touch), hasTouch: Boolean(scenario.touch), serviceWorkers: 'block',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/local-dev-refresh.js')) return route.fulfill({ contentType: 'application/javascript', body: '/* Isolated scroll QA. */' });
      return url.origin === server.baseUrl ? route.continue() : route.abort();
    });
    try {
      await page.goto(`${server.baseUrl}${scenario.route || '/ru/social.html'}`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => document.fonts.ready);
      const consent = page.locator('[data-cookie-choice="accept"]');
      if (await consent.isVisible()) await consent.click();
      const burger = page.locator('.premium-burger');
      const nav = page.locator('#mobile-nav');
      const content = nav.locator('.mobile-nav__content');
      const state = () => page.evaluate(() => {
        const root = document.querySelector('.site-scroll-root');
        const scroller = document.querySelector('.mobile-nav__content');
        return {
          root: root.scrollTop, rootMax: root.scrollHeight - root.clientHeight,
          windowY: window.scrollY, panel: scroller.scrollTop,
          max: scroller.scrollHeight - scroller.clientHeight,
          active: document.querySelector('#mobile-nav').classList.contains('active'),
          finePointer: window.matchMedia('(pointer: fine)').matches,
        };
      });
      await burger.click();
      await page.waitForTimeout(650);
      if (scenario.name === 'fitting-desktop') {
        await page.waitForFunction(() => {
          const element = document.querySelector('.mobile-nav__content');
          return element.scrollHeight === element.clientHeight;
        }, undefined, { timeout: 5000 });
      }
      const before = await state();
      const rect = await content.boundingBox();
      const point = { x: rect.x + rect.width / 2, y: rect.y + Math.min(rect.height * 0.65, 220) };
      const cdp = scenario.touch ? await context.newCDPSession(page) : null;
      const scrollMenu = async delta => {
        if (!cdp) {
          await page.mouse.move(point.x, point.y);
          await page.mouse.wheel(0, delta);
          return;
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
        for (let step = 1; step <= 8; step++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y - Math.sign(delta) * step * 16 }] });
          await page.waitForTimeout(25);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      };
      let start = before;
      if (!baseline) {
        // Place the edges before starting in-menu inertia. The gestures themselves use browser input.
        for (const edge of ['top', 'bottom']) {
          const delta = edge === 'bottom' ? 600 : -600;
          await content.evaluate((element, atBottom) => {
            element.scrollTop = atBottom ? element.scrollHeight : 0;
          }, edge === 'bottom');
          const placed = await state();
          assert.ok(Math.abs(placed.panel - (edge === 'bottom' ? placed.max : 0)) <= 1, `${engine}/${scenario.name}: expected to start at the ${edge} edge`);
          await scrollMenu(delta);
          await page.waitForTimeout(450);
          const atEdge = await state();
          assert.equal(atEdge.active, true, `${engine}/${scenario.name}: ${edge} must not close the menu`);
          assert.equal(atEdge.root, before.root, `${engine}/${scenario.name}: ${edge} must not chain to the page`);
        }
        start = await state();
      }
      await scrollMenu(baseline ? 600 : -600);
      await page.waitForTimeout(850);
      const after = await state();
      if (!baseline) {
        assert.equal(after.active, true, `${engine}/${scenario.name}: scrolling must keep the menu open`);
        assert.equal(after.root, before.root, `${engine}/${scenario.name}: background must not scroll`);
        assert.equal(after.windowY, before.windowY);
        if (start.max > 0) assert.ok(after.panel < start.panel, `${engine}/${scenario.name}: menu must actually scroll`);
        if (cdp) await cdp.detach();
        // Wheel over the drawer's padding is also owned by the open menu.
        const panelRect = await nav.boundingBox();
        await page.mouse.move(panelRect.x + 5, panelRect.y + 5);
        await page.mouse.wheel(0, 500);
        await page.waitForTimeout(300);
        assert.equal((await state()).root, before.root);
        await page.screenshot({ path: path.join(output, `${engine}-${scenario.name}.png`) });
        await page.keyboard.press('Escape');
        await nav.waitFor({ state: 'hidden' });
        const closed = await state();
        assert.equal(closed.active, false);
        assert.equal(closed.root, before.root, 'Closing should preserve the page position');
        assert.ok(closed.rootMax > 20, `${engine}/${scenario.name}: the page must have room to scroll`);
        if (before.finePointer) {
          // Queue the actual custom page inertia, then open before its next RAF.
          const pending = await page.evaluate(() => {
            const root = document.querySelector('.site-scroll-root');
            const wheel = new window.WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 90 });
            root.dispatchEvent(wheel);
            document.querySelector('.premium-burger').click();
            return { root: root.scrollTop, queued: wheel.defaultPrevented, locked: document.body.classList.contains('nav-open') };
          });
          assert.deepEqual(pending, { root: before.root, queued: true, locked: true });
          await page.waitForTimeout(700);
          assert.equal((await state()).root, pending.root, `${engine}/${scenario.name}: queued page inertia must stop on open`);
          assert.equal((await state()).active, true);
          await page.keyboard.press('Escape');
          await nav.waitFor({ state: 'hidden' });
        }
        await page.mouse.move(scenario.width / 2, scenario.height * 0.7);
        await page.mouse.wheel(0, 350);
        await page.waitForFunction(minimum => document.querySelector('.site-scroll-root').scrollTop > minimum, before.root + 20, { timeout: 5000 });
        assert.deepEqual(errors, []);
      }
      results.push({ name: scenario.name, before, start, after, errors });
      console.log(JSON.stringify({ engine, scenario: scenario.name, baseline, before, start, after, ok: !baseline }));
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await server.close();
  await writeFile(path.join(output, `${engine}${baseline ? '-before' : ''}.json`), JSON.stringify(results, null, 2));
}
