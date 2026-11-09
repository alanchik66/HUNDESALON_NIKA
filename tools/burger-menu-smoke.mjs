import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

import { startStaticTestServer } from './lib/static-test-server.mjs';

const output = path.resolve('test-results', 'burger-menu');
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
  { locale: 'ru', viewport: viewports[1], route: 'blog/blog.html', reducedMotion: 'no-preference' }
);

await mkdir(output, { recursive: true });
const server = await startStaticTestServer();
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
const results = [];
const targetChecks = new Map();
const withoutHash = value => {
  const url = new URL(value);
  url.hash = '';
  return url.href;
};

try {
  for (const scenario of scenarios) {
    const { locale, viewport, route, reducedMotion } = scenario;
    const name = `${locale}-${viewport.width}-${route.startsWith('blog/') ? 'blog' : 'home'}-${reducedMotion}`;
    const context = await browser.newContext({
      viewport,
      isMobile: viewport.width < 900,
      hasTouch: viewport.width < 900,
      serviceWorkers: 'block',
      reducedMotion,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let interceptNavigation = false;
    const navigations = [];
    await page.route('**/*', async requestRoute => {
      const request = requestRoute.request();
      if (new URL(request.url()).pathname === '/assets/js/local-dev-refresh.js') {
        await requestRoute.fulfill({ contentType: 'application/javascript', body: '/* Workstation refresh is isolated in browser QA. */' });
      } else if (interceptNavigation && request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        navigations.push(request.url());
        // Record a real native navigation, then cancel loading; targets are HTTP-checked separately below.
        // A 204 navigation leaves Playwright's document wait pending in some Chromium versions.
        await requestRoute.abort('aborted');
      } else if (new URL(request.url()).origin !== server.baseUrl) {
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
      if (await consent.isVisible()) await consent.click();
      const assertClosed = async () => {
        assert.deepEqual(await nav.evaluate(element => ({
          inert: element.inert,
          hidden: element.getAttribute('aria-hidden'),
          locked: document.body.classList.contains('nav-open'),
        })), { inert: true, hidden: 'true', locked: false }, `${name}: closed drawer must be inert and unlock the page`);
      };
      const open = async () => {
        await burger.click();
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
      assert.equal(await nav.locator('button').count(), 0, `${name}: every menu tile must be a direct link`);
      const hrefs = await links.evaluateAll(items => items.map(item => ({ href: item.href, label: item.textContent.trim() })));
      assert.equal(hrefs.length, locale === 'ru' ? 15 : 14, `${name}: menu destinations are complete`);
      assert.ok(hrefs.some(item => new URL(item.href).pathname.endsWith('/galereya.html')));
      assert.ok(hrefs.some(item => new URL(item.href).pathname.endsWith('/do-i-posle.html')));

      const geometry = await links.evaluateAll(items => items.map(item => {
        const rect = item.getBoundingClientRect();
        const text = document.createRange();
        text.selectNodeContents(item);
        const textRect = text.getBoundingClientRect();
        const style = getComputedStyle(item);
        return {
          width: rect.width, height: rect.height,
          textContained: textRect.left >= rect.left && textRect.right <= rect.right + 1 &&
            textRect.top >= rect.top && textRect.bottom <= rect.bottom + 1,
          infiniteMotion: style.animationIterationCount.split(',').some(value => value.trim() === 'infinite'),
        };
      }));
      assert.ok(geometry.every(item => Math.abs(item.width - geometry[0].width) <= 1 &&
        Math.abs(item.height - geometry[0].height) <= 1 && item.height >= 56), `${name}: tile dimensions must be uniform`);
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
        await link.click({ noWaitAfter: true });
        await requested;
        await assertClosed();
        tileChecks.push({ ...hrefs[index], hitPoints: hits.length, nativeNavigation: true });
        if (index < hrefs.length - 1) await open();
      }
      assert.equal(navigations.length, hrefs.length, `${name}: one native navigation per tile`);
      assert.deepEqual(errors, [], `${name}: no JavaScript errors`);
      results.push({ name, locale, viewport, route, reducedMotion, tileSize: geometry[0], drawer, tiles: tileChecks });
      console.log(JSON.stringify({ scenario: name, ok: true, tiles: hrefs.length }));
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
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ scenarios: results, targets: [...targetChecks.values()] }, null, 2));
}
console.log(JSON.stringify({ ok: true, scenarios: results.length, uniqueTargets: targetChecks.size, output }));
