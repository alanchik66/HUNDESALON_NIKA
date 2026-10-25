import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';
import { startStaticTestServer } from './lib/static-test-server.mjs';

const live = process.argv.includes('--submit-live');
const external = process.argv.find(arg => /^https?:/.test(arg));
if (live && !external) throw new Error('Live submission needs an explicit URL');
const server = external ? null : await startStaticTestServer();
const base = external || server.baseUrl;
const output = process.env.REGISTRATION_QA_OUTPUT || 'test-results/client-registration';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const locale of live ? ['ru'] : ['de', 'en', 'ru', 'uk']) {
    for (const mode of live ? ['mobile'] : ['desktop', 'mobile']) {
      const context = await browser.newContext(
        mode === 'mobile' ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 1000 } }
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      let calls = 0;
      let registrationId = '';
      if (!live)
        await page.route('**/sendmail', async route => {
          calls++;
          await route.fulfill({
            status: calls === 1 ? 503 : 200,
            contentType: 'application/json',
            body: JSON.stringify(
              calls === 1
                ? { error: 'Service unavailable' }
                : { success: true, registration_id: crypto.randomUUID(), message: 'QA saved' }
            ),
          });
        });
      page.on('response', async response => {
        if (response.url().endsWith('/sendmail') && response.ok()) {
          registrationId = (await response.json()).registration_id || '';
        }
      });
      await page.goto(`${base}/${locale}/prays-list.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const cookie = page.locator('[data-cookie-choice="accept"]');
      if (await cookie.isVisible()) await cookie.click();
      const card = page.locator('[data-price-categories] .price-card:visible').first();
      await card.locator('[data-price-open]:visible, [data-price-card-toggle]:visible').first().waitFor();
      const open = card.locator('[data-price-open]');
      if (!(await open.isVisible())) await card.locator('[data-price-card-toggle]').click();
      await open.click();
      await page.locator('#price-category-modal.active').waitFor();
      await page.locator('[data-price-modal-service-fieldset] .price-category-modal__service-option').first().click();
      await page.locator('[data-price-modal-service-conditions-consent]').check({ force: true });
      await page.locator('[data-price-modal-booking]').click();
      const form = page.locator('#client-registration-modal.active form');
      await form.waitFor();
      await page.waitForFunction(() =>
        document.activeElement?.matches('#client-registration-modal input[name="name"]')
      );
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
      await form.locator('[name="privacy_consent"]').check({ force: true });
      await form.locator('[name="agb_consent"]').check({ force: true });
      await form.locator('[type="submit"]').click();
      if (!live) {
        await form.locator('.form-status--error').waitFor();
        assert.equal(await form.locator('[name="name"]').inputValue(), marker);
        assert.equal(await form.locator('[name="email"]').inputValue(), 'qa@example.invalid');
        await form.locator('[type="submit"]').click();
      }
      await page.locator('[data-client-registration-success]:not([hidden])').waitFor({ timeout: 30000 });
      assert.match(registrationId, /^[a-f0-9-]{36}$/i);
      if (!live) assert.equal(calls, 2);
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false);
      await page.screenshot({ path: path.join(output, `${locale}-${mode}-saved.png`) });
      await page.locator('[data-client-registration-booking]').click();
      await page.locator('#booking-modal.active').waitFor({ timeout: 15000 });
      assert.equal(await page.locator('#booking-form [name="client_registration_id"]').inputValue(), registrationId);
      assert.equal(await page.locator('#booking-form [name="name"]').inputValue(), marker);
      await page.screenshot({ path: path.join(output, `${locale}-${mode}-booking.png`) });
      console.log(JSON.stringify({ locale, mode, ok: true, live, registrationId: live ? registrationId : undefined }));
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server?.close();
}
