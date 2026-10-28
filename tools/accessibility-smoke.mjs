import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

import { startStaticTestServer } from './lib/static-test-server.mjs';

const routes = [
  '/de/',
  '/ru/prays-list.html',
  '/en/onlayn-bronirovanie.html',
  '/uk/kontakty.html',
  '/reviews.html',
  ...['de', 'en', 'ru', 'uk'].map(locale => `/${locale}/reyting.html`),
];
const reports = [];
const server = await startStaticTestServer();
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });

try {
  for (const route of routes) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    await page.goto(`${server.baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // The universal QR chooser has no locale, so site-shell intentionally omits its localized header.
    const weatherHostRole =
      route === '/reviews.html' ? null : await page.locator('.header-weather-widget').getAttribute('role');
    if (route !== '/reviews.html') {
      assert.equal(weatherHostRole, 'group', `${route}: the named weather widget must expose a group role`);
    }

    const cookieAccept = page.locator('[data-cookie-choice="accept"]');
    if (await cookieAccept.count()) await cookieAccept.first().click();

    if (route.includes('prays-list')) {
      await page.waitForSelector('[data-price-open]', { timeout: 15000 });
      await page.locator('[data-price-open]').first().click();
      const bookingModal = page.locator('#booking-modal[data-price-booking-flow].active');
      await bookingModal.waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForFunction(() => document.querySelector('#booking-modal')?.dataset.bookingStep === '0');
      assert.equal(await bookingModal.getAttribute('role'), 'dialog');
      assert.equal(await bookingModal.getAttribute('aria-modal'), 'true');
      assert.equal(await bookingModal.getAttribute('aria-hidden'), 'false');
      assert.equal(await bookingModal.locator('.booking-step.active').count(), 1);
      assert.equal(await page.locator('#client-registration-modal').count(), 0);
      const closeButton = bookingModal.locator('.modal-close');
      assert.ok(await closeButton.getAttribute('aria-label'), 'the close control must have an accessible name');
      await closeButton.focus();
      await page.keyboard.press('Shift+Tab');
      assert.equal(await bookingModal.evaluate(element => element.contains(document.activeElement)), true,
        'reverse Tab must stay inside the unified dialog');
      await page.keyboard.press('Tab');
      assert.equal(await closeButton.evaluate(element => element === document.activeElement), true,
        'Tab must wrap from the last control back to the close button');
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
