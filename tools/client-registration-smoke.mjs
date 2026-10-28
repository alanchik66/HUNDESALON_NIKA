import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';
import { startStaticTestServer } from './lib/static-test-server.mjs';

const live = process.argv.includes('--submit-live');
const external = process.argv.find(arg => /^https?:/.test(arg));
if (live) throw new Error('The unified booking smoke is mock-only; omit --submit-live. No real appointment is submitted.');
const server = external ? null : await startStaticTestServer();
const base = external || server.baseUrl;
const output = process.env.REGISTRATION_QA_OUTPUT || 'test-results/client-registration';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const locale of ['de', 'en', 'ru', 'uk']) {
    for (const mode of ['desktop', 'mobile']) {
      const context = await browser.newContext(
        mode === 'mobile' ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 1000 } }
      );
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date('2026-11-02T08:00:00Z'));
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      let calls = 0;
      const payloads = [];
      let busyIntervals = [];
      await page.route('**/sendmail', async route => {
        calls++;
        const request = route.request();
        assert.equal(request.method(), 'POST');
        const data = await new Response(request.postDataBuffer(), {
          headers: { 'Content-Type': request.headers()['content-type'] },
        }).formData();
        payloads.push(Object.fromEntries(data.entries()));
        await new Promise(resolve => setTimeout(resolve, 200));
        await route.fulfill({
          status: calls === 1 ? 503 : 200,
          contentType: 'application/json',
          body: JSON.stringify(calls === 1
            ? { error: 'Service unavailable' }
            : { success: true, message: 'QA booking saved' }),
        });
      });
      await page.route('**/booking-availability?*', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, configured: true, busyIntervals }),
      }));
      const assertStep = async step => {
        await page.waitForFunction(expected => {
          const modal = document.querySelector('#booking-modal');
          return modal?.dataset.bookingStep === String(expected) && !modal.classList.contains('is-transitioning');
        }, step);
        assert.equal(await page.locator('#booking-modal.active').count(), 1);
        assert.equal(await page.locator('#booking-modal .booking-step.active').count(), 1);
        assert.equal(await page.locator('#client-registration-modal').count(), 0);
      };
      const modal = page.locator('#booking-modal');
      await page.goto(`${base}/${locale}/prays-list.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const cookie = page.locator('[data-cookie-choice="accept"]');
      if (await cookie.isVisible()) await cookie.click();
      const card = page.locator('[data-price-categories] .price-card:visible').first();
      await card.locator('[data-price-open]:visible, [data-price-card-toggle]:visible').first().waitFor();
      const open = card.locator('[data-price-open]');
      if (!(await open.isVisible())) await card.locator('[data-price-card-toggle]').click();
      await open.click();
      await assertStep(0);
      await page.locator('[data-price-modal-service-fieldset] .price-category-modal__service-option').first().click();
      await page.locator('[data-price-modal-service-conditions-consent]').check({ force: true });
      await page.locator('[data-price-modal-booking]').click();
      await assertStep(1);
      for (const [selector, value] of [
        ['[data-booking-client-type]', 'returning'],
        ['[data-booking-coat-condition]', 'good'],
        ['[data-booking-behavior]', 'calm'],
      ]) {
        await modal.locator(selector).selectOption(value, { force: true });
      }
      await modal.locator('#next-step-1').click();
      await assertStep(2);
      const date = modal.locator('.calendar-day:not(.is-disabled):not(.is-empty)').first();
      await Promise.all([
        page.waitForResponse(response => response.url().includes('/booking-availability?')),
        date.click(),
      ]);
      await modal.locator('.time-slot').first().click();
      const selected = await modal.locator('#booking-form').evaluate(form => {
        const data = new FormData(form);
        return Object.fromEntries(['date', 'time', 'service', 'breed', 'service_ids', 'pet_species', 'pet_breed']
          .map(name => [name, String(data.get(name) || '')]));
      });
      Object.values(selected).forEach(value => assert.notEqual(value, ''));
      await modal.locator('#next-step-2').click();
      await assertStep(3);
      await modal.locator('[data-booking-flow-back]').click();
      await assertStep(2);
      assert.equal(await modal.locator('#selected-date').inputValue(), selected.date);
      assert.equal(await modal.locator('#selected-time').inputValue(), selected.time);
      if (locale === 'ru' && mode === 'desktop') {
        busyIntervals = [{ start: `${selected.date}T00:00:00+01:00`, end: `${selected.date}T23:59:59+01:00` }];
        await modal.locator('#next-step-2').click();
        await assertStep(3);
        await modal.locator('[data-booking-flow-back]').click();
        await assertStep(2);
        assert.equal(await modal.locator('#selected-time').inputValue(), '', 'a newly occupied slot must be cleared after revalidation');
        assert.equal(await modal.locator('.time-slot').count(), 0);
        busyIntervals = [];
        await modal.locator('[data-booking-flow-back]').click();
        await assertStep(1);
        await modal.locator('#next-step-1').click();
        await assertStep(2);
        await modal.locator('.time-slot').first().click();
        assert.equal(await modal.locator('#selected-time').inputValue(), selected.time);
      }
      await modal.locator('#next-step-2').click();
      await assertStep(3);
      const form = modal.locator('#booking-form');
      const marker = `QA-NIKA-${Date.now()}`;
      for (const [name, value] of Object.entries({
        name: marker,
        email: 'qa@example.invalid',
        phone: '+493410000000',
        pet_name: 'QA test pet',
        message: 'Technical verification only. Not a real customer or appointment.',
      })) {
        await form.locator(`[name="${name}"]`).fill(value);
      }
      await page.screenshot({ path: path.join(output, `${locale}-${mode}-contacts.png`) });
      await form.locator('[name="privacy_consent"]').check();
      await form.locator('[name="agb_consent"]').check();
      await form.locator('[type="submit"]').click();
      await form.locator('[data-booking-summary]:not([hidden])').waitFor();
      assert.equal(calls, 0, 'reviewing the booking must not submit a separate registration');
      await form.evaluate(element => {
        element.requestSubmit();
        element.requestSubmit();
      });
      await form.locator('.form-status--error').waitFor();
      assert.equal(calls, 1, 'duplicate submits while pending must be ignored');
      assert.equal(await form.locator('[name="name"]').inputValue(), marker);
      assert.equal(await form.locator('[name="email"]').inputValue(), 'qa@example.invalid');
      for (const [name, value] of Object.entries(selected)) {
        assert.equal(await form.locator(`[name="${name}"]`).inputValue(), value);
      }
      assert.equal(await form.locator('[type="submit"]').isEnabled(), true);
      await page.screenshot({ path: path.join(output, `${locale}-${mode}-retry.png`) });
      await form.locator('[type="submit"]').click();
      await form.locator('.form-status--success').waitFor({ timeout: 30000 });
      await page.locator('#booking-modal.booking-modal-sent').waitFor();
      assert.equal(calls, 2);
      assert.equal(payloads.length, 2);
      for (const payload of payloads) {
        assert.equal(payload.form_type, 'booking');
        assert.equal(payload.name, marker);
        assert.equal(payload.email, 'qa@example.invalid');
        assert.equal(payload.pet_name, 'QA test pet');
        for (const [name, value] of Object.entries(selected)) assert.equal(payload[name], value);
      }
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false);
      await page.screenshot({ path: path.join(output, `${locale}-${mode}-saved.png`) });
      console.log(JSON.stringify({ locale, mode, ok: true, mocked: true, calls, unifiedModal: true }));
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server?.close();
}
