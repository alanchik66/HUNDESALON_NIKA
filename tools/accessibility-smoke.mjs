import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

import { startStaticTestServer } from './lib/static-test-server.mjs';

const routes = ['/de/', '/ru/prays-list.html', '/en/onlayn-bronirovanie.html', '/uk/kontakty.html'];
const reports = [];
const server = await startStaticTestServer();
const browser = await chromium.launch({ headless: true });

try {
  for (const route of routes) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    await page.goto(`${server.baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const weatherHostRole = await page.locator('.header-weather-widget').getAttribute('role');
    assert.equal(weatherHostRole, 'group', `${route}: the named weather widget must expose a group role`);

    const cookieAccept = page.locator('[data-cookie-choice="accept"]');
    if (await cookieAccept.count()) await cookieAccept.first().click();

    if (route.includes('prays-list')) {
      await page.waitForSelector('[data-price-open]', { timeout: 15000 });
      await page.locator('[data-price-open]').first().click();
      await page.waitForSelector('#price-category-modal.active', { timeout: 15000 });
    }

    const analysis = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const blocking = analysis.violations.filter(item => item.impact === 'critical' || item.impact === 'serious');
    reports.push({
      route,
      weatherHostRole,
      blocking: blocking.map(item => ({
        id: item.id,
        impact: item.impact,
        help: item.help,
        targets: item.nodes.flatMap(node => node.target.map(String)).slice(0, 8),
      })),
    });
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}

const failures = reports.filter(report => report.blocking.length > 0);
console.log(JSON.stringify({ ok: failures.length === 0, reports }, null, 2));
if (failures.length > 0) process.exitCode = 1;
