import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';

import { startStaticTestServer } from './lib/static-test-server.mjs';

const outDir = path.resolve('test-results', 'visual-regression');
const scenarios = [
  { name: 'desktop-dark', viewport: { width: 1440, height: 900 }, light: false, mobile: false },
  { name: 'desktop-light', viewport: { width: 1440, height: 900 }, light: true, mobile: false },
  { name: 'mobile-dark', viewport: devices['iPhone 13'].viewport, light: false, mobile: true },
  { name: 'mobile-light', viewport: devices['iPhone 13'].viewport, light: true, mobile: true },
  { name: 'android-dark', viewport: devices['Pixel 7'].viewport, light: false, mobile: true },
];

const results = [];
const drawerScreenshots = [];
const assert = (name, condition, detail = '') => {
  results.push({ name, ok: Boolean(condition), detail });
  if (!condition) throw new Error(`${name}${detail ? `: ${detail}` : ''}`);
};

await mkdir(outDir, { recursive: true });
const server = await startStaticTestServer();
const browser = await chromium.launch({ headless: true });

try {
  for (const scenario of scenarios) {
    const context = await browser.newContext({
      viewport: scenario.viewport,
      isMobile: scenario.mobile,
      hasTouch: scenario.mobile,
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    await page.goto(`${server.baseUrl}/de/prays-list.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('body').evaluate((body, light) => body.classList.toggle('light', light), scenario.light);
    await page.waitForSelector('.header .online-order-pill .nav-plasma--active', { timeout: 15000 });

    const state = await page.evaluate(mobile => {
      const target = mobile
        ? document.querySelector('.header .online-order-pill .nav-plasma--active')
        : document.querySelector('.nav-main a[aria-current="page"] .nav-plasma--active');
      const targetRect = target?.getBoundingClientRect();
      const headerRect = document.querySelector('.header')?.getBoundingClientRect();
      const backgroundImage = target ? getComputedStyle(target, '::before').backgroundImage : '';
      return {
        backgroundImage,
        conicLayers: (backgroundImage.match(/conic-gradient\(/g) || []).length,
        headerHeight: headerRect?.height || 0,
        targetWidth: targetRect?.width || 0,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      };
    }, scenario.mobile);

    assert(`${scenario.name}: plasma target rendered`, state.targetWidth > 0);
    assert(`${scenario.name}: two plasma conic layers`, state.conicLayers === 2, state.backgroundImage.slice(0, 180));
    assert(`${scenario.name}: header rendered`, state.headerHeight > 0);
    assert(`${scenario.name}: no horizontal overflow`, !state.overflowX);

    await page.screenshot({
      path: path.join(outDir, `${scenario.name}.png`),
      clip: { x: 0, y: 0, width: scenario.viewport.width, height: Math.min(240, scenario.viewport.height) },
      animations: 'disabled',
    });

    const originalPath = new URL(page.url()).pathname;
    const burger = page.locator('.premium-burger').first();
    await burger.waitFor({ state: 'visible', timeout: 15000 });
    await burger.click();
    await page.waitForSelector('#mobile-nav.active', { state: 'visible', timeout: 15000 });
    await page.waitForTimeout(650);

    const drawerState = await page.evaluate(() => {
      const nav = document.querySelector('#mobile-nav');
      const overlay = document.querySelector('#mobile-nav-overlay');
      const cookieConsent = document.querySelector('.cookie-consent');
      const rect = nav?.getBoundingClientRect();
      const links = nav
        ? [...nav.querySelectorAll(':scope > .mobile-nav-group > a[href]')].filter(link => {
            const linkRect = link.getBoundingClientRect();
            return (
              linkRect.width > 0 && linkRect.height > 0 && linkRect.top >= 0 && linkRect.bottom <= window.innerHeight
            );
          })
        : [];
      const hitTestedLinks = links.slice(0, 5).filter(link => {
        const linkRect = link.getBoundingClientRect();
        const hit = document.elementFromPoint(linkRect.left + linkRect.width / 2, linkRect.top + linkRect.height / 2);
        return hit === link || link.contains(hit);
      }).length;

      return {
        active: Boolean(nav?.classList.contains('active')),
        ariaHidden: nav?.getAttribute('aria-hidden'),
        left: rect?.left ?? -1,
        right: rect?.right ?? -1,
        width: rect?.width ?? 0,
        height: rect?.height ?? 0,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        overlayActive: Boolean(overlay?.classList.contains('active') && !overlay.hidden),
        bodyLocked: document.body.classList.contains('nav-open'),
        cookieSuppressed: !cookieConsent || getComputedStyle(cookieConsent).display === 'none',
        visibleLinks: links.length,
        hitTestedLinks,
      };
    });

    assert(`${scenario.name}: drawer opens`, drawerState.active && drawerState.ariaHidden === 'false');
    assert(
      `${scenario.name}: drawer starts at the left edge`,
      Math.abs(drawerState.left) <= 1,
      JSON.stringify(drawerState)
    );
    assert(
      `${scenario.name}: drawer remains a separate window`,
      drawerState.width >= 240 &&
        drawerState.width <= Math.min(420, drawerState.viewportWidth * 0.9) + 2 &&
        drawerState.right < drawerState.viewportWidth - 12,
      JSON.stringify(drawerState)
    );
    assert(
      `${scenario.name}: drawer fills the usable height`,
      drawerState.height >= drawerState.viewportHeight - 2,
      JSON.stringify(drawerState)
    );
    assert(
      `${scenario.name}: drawer overlay and body lock are active`,
      drawerState.overlayActive && drawerState.bodyLocked
    );
    assert(
      `${scenario.name}: drawer suppresses the cookie layer`,
      drawerState.cookieSuppressed,
      JSON.stringify(drawerState)
    );
    assert(`${scenario.name}: drawer links are visible`, drawerState.visibleLinks >= 4, JSON.stringify(drawerState));
    assert(
      `${scenario.name}: drawer links receive pointer hit tests`,
      drawerState.hitTestedLinks >= Math.min(4, drawerState.visibleLinks),
      JSON.stringify(drawerState)
    );

    if (scenario.mobile) {
      await page.touchscreen.tap(scenario.viewport.width - 8, Math.round(scenario.viewport.height / 2));
    } else {
      await page.mouse.click(scenario.viewport.width - 8, Math.round(scenario.viewport.height / 2));
    }
    await page.waitForFunction(() => !document.querySelector('#mobile-nav')?.classList.contains('active'));
    const outsideCloseState = await page.evaluate(() => {
      const cookieConsent = document.querySelector('.cookie-consent');
      return {
        closed: document.querySelector('#mobile-nav')?.getAttribute('aria-hidden') === 'true',
        bodyUnlocked: !document.body.classList.contains('nav-open'),
        cookieRestored: !cookieConsent || getComputedStyle(cookieConsent).display !== 'none',
      };
    });
    assert(
      `${scenario.name}: outside pointer closes the drawer`,
      outsideCloseState.closed && outsideCloseState.bodyUnlocked && outsideCloseState.cookieRestored,
      JSON.stringify(outsideCloseState)
    );

    await burger.click();
    await page.waitForSelector('#mobile-nav.active', { state: 'visible', timeout: 15000 });
    await page.waitForTimeout(500);

    const galleryButton = page.locator('#mobileGalleryBtn');
    await galleryButton.click();
    await page.waitForFunction(() => document.querySelector('#mobileGalleryMenu')?.classList.contains('open'));
    await page.waitForTimeout(500);

    const galleryState = await page.evaluate(() => {
      const galleryTrigger = document.querySelector('#mobileGalleryBtn');
      const primaryGroup = document.querySelector('.mobile-nav-group--primary');
      const galleryMenu = document.querySelector('#mobileGalleryMenu');
      const galleryDropdown = galleryMenu?.closest('.mobile-dropdown');
      const primaryItems = primaryGroup ? [...primaryGroup.children] : [];
      const galleryIndex = galleryDropdown ? primaryItems.indexOf(galleryDropdown) : -1;
      const followingLinks =
        galleryIndex >= 0
          ? primaryItems
              .slice(galleryIndex + 1)
              .filter(element => element.matches('a[href]'))
              .slice(0, 2)
          : [];
      const checkedItems = [...document.querySelectorAll('#mobileGalleryMenu > a[href]'), ...followingLinks];
      const details = checkedItems.map(item => {
        const rect = item.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return {
          href: item.getAttribute('href'),
          rect: {
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
          },
          hitHref: hit?.closest?.('a[href]')?.getAttribute('href') ?? null,
          clickable: hit === item || item.contains(hit),
        };
      });

      return {
        expanded: galleryTrigger?.getAttribute('aria-expanded') === 'true' && galleryMenu?.classList.contains('open'),
        galleryHeight: Math.round(galleryMenu?.getBoundingClientRect().height ?? 0),
        checked: checkedItems.map(item => item.getAttribute('href')),
        hit: details.filter(item => item.clickable).map(item => item.href),
        details,
      };
    });

    assert(`${scenario.name}: gallery submenu expands`, galleryState.expanded, JSON.stringify(galleryState));
    assert(
      `${scenario.name}: gallery and following links do not overlap`,
      galleryState.checked.length >= 4 && galleryState.hit.length === galleryState.checked.length,
      JSON.stringify(galleryState)
    );

    const drawerScreenshot = path.join(outDir, `${scenario.name}-drawer.png`);
    drawerScreenshots.push(drawerScreenshot);
    await page.screenshot({ path: drawerScreenshot, fullPage: false, animations: 'disabled' });

    const links = page.locator('#mobile-nav a[href]');
    const targetIndex = await links.evaluateAll(
      (items, currentPath) =>
        items.findIndex(item => {
          const href = item.getAttribute('href');
          if (!href || href.startsWith('#')) return false;
          const target = new URL(href, location.href);
          const rect = item.getBoundingClientRect();
          return (
            target.origin === location.origin && target.pathname !== currentPath && rect.width > 0 && rect.height > 0
          );
        }),
      originalPath
    );
    assert(`${scenario.name}: drawer has a navigable link`, targetIndex >= 0);

    await Promise.all([
      page.waitForURL(url => new URL(url).pathname !== originalPath, { timeout: 15000 }),
      links.nth(targetIndex).click(),
    ]);
    assert(`${scenario.name}: drawer link navigation works`, new URL(page.url()).pathname !== originalPath, page.url());
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}

console.log(
  JSON.stringify(
    {
      ok: true,
      screenshots: scenarios.map(item => path.join(outDir, `${item.name}.png`)).concat(drawerScreenshots),
      results,
    },
    null,
    2
  )
);
