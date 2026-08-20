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
];

const results = [];
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
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}

console.log(JSON.stringify({ ok: true, screenshots: scenarios.map(item => path.join(outDir, `${item.name}.png`)), results }, null, 2));
