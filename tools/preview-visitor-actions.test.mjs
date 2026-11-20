import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { PREVIEW_VISITOR_ACTIONS_PATH, PREVIEW_VISITOR_ACTIONS_SCRIPT } from './lib/preview-visitor-actions.mjs';

test('guest actions keep local browsing and open official localized forms without carrying visitor data', async t => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const requests = [];
  const official = 'https://hundesalon-nika.com';
  const preview = 'https://preview.example.test';
  // Both origins are fixtures. A navigation or accidental POST never touches a real backend.
  await page.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    requests.push({ url, method: req.method(), referrer: req.headers().referer });
    if (url.pathname === PREVIEW_VISITOR_ACTIONS_PATH) {
      await route.fulfill({ contentType: 'text/javascript', body: PREVIEW_VISITOR_ACTIONS_SCRIPT });
    } else {
      await route.fulfill({ contentType: 'text/html', body: fixture(url.searchParams.get('off') || '') });
    }
  });

  for (const lang of ['de', 'en', 'ru', 'uk']) {
    await page.goto(preview + '/' + lang + '/prays-list?source=private-example#old');
    const base = official + '/' + lang + '/';
    const expected = {
      booking: 'onlayn-bronirovanie#open-booking-btn', contact: 'kontakty#contact-form',
      review: 'reyting#review-form', newsletter: '#newsletter-email-' + lang, chat: '#hundesalon-ai-chat',
    };
    for (const [action, path] of Object.entries(expected)) {
      const link = page.locator('a[data-preview-visitor-action="' + action + '"]').first();
      await link.waitFor({ state: 'visible' });
      assert.equal(await link.getAttribute('href'), base + path);
    }
    assert.equal(await page.locator('form input:visible').count(), 0);
    await page.locator('[data-price-card-toggle]').tap();
    await page.locator('[data-price-breed-select]').tap();
    assert.equal(await page.locator('[data-category-id]').getAttribute('data-selected-breed'), 'poodle');
    await page.locator('[data-price-service-select]').tap();
    assert.equal(await page.locator('[data-category-id]').getAttribute('data-selected-service'), 'coat');
    const link = page.locator('[data-price-modal-booking]');
    assert.equal(await link.getAttribute('href'), base + 'prays-list#price-card-details-small');
    await link.evaluate(el => { el.hidden = true; });
    assert.equal(await link.evaluate(el => el.nextElementSibling.hidden), true);
    await link.evaluate(el => { el.hidden = false; });
    assert.equal(await link.evaluate(el => el.nextElementSibling.hidden), false);
    // The catalog can reset href when rebuilding a selection. The public form must still open.
    await link.evaluate(el => { el.href = 'onlayn-bronirovanie.html'; });
    assert.equal(await link.getAttribute('href'), base + 'prays-list#price-card-details-small');
    assert.equal(await page.locator('[data-read-only]').getAttribute('href'), 'galereya');
    const moved = page.waitForURL(base + 'prays-list#price-card-details-small');
    await link.tap();
    await moved;
    assert.equal(await page.locator('a[data-preview-visitor-action]').count(), 0);
    assert.equal(requests.filter(req => req.url.origin === official && req.url.pathname.endsWith('/prays-list')).at(-1).referrer, undefined);
  }
  await page.goto(preview + '/ru/?off=booking+contacts+reviews+newsletter+aiChat');
  assert.equal(await page.locator('a[data-preview-visitor-action]').count(), 0);
  assert.ok(requests.every(req => req.method === 'GET'));
  assert.ok(requests.filter(req => req.url.origin === official).every(req => !req.url.search));
});

function fixture(disabled) {
  return '<!doctype html><html data-disabled-sections="' + disabled + '"><head><meta name="viewport" content="width=device-width, initial-scale=1"><script defer src="' + PREVIEW_VISITOR_ACTIONS_PATH + '"></script></head><body>' + [
    '<button id="open-booking-btn">Book</button><a href="galereya" data-read-only>Gallery</a>',
    '<form action="/sendmail"><input name="email" value="private@example.test"></form>',
    '<form action="/sendmail" data-review-form><input name="review"></form>',
    '<form action="/subscribe"><input name="newsletter"></form>',
    '<article data-category-id="small"><button data-price-card-toggle>Browse prices</button>',
    '<div id="price-card-details-small" data-price-card-details hidden><button data-price-breed-select>Poodle</button>',
    '<button data-price-service-select>Coat</button></div></article>',
    '<a href="onlayn-bronirovanie.html" data-price-modal-booking>Book the selected service</a>',
    '<script>const card = document.querySelector("article");',
    'document.querySelector("[data-price-card-toggle]").onclick = () => document.querySelector("[data-price-card-details]").hidden = false;',
    'document.querySelector("[data-price-breed-select]").onclick = () => card.dataset.selectedBreed = "poodle";',
    'document.querySelector("[data-price-service-select]").onclick = () => card.dataset.selectedService = "coat";',
    'document.querySelector("[data-price-modal-booking]").onclick = event => event.preventDefault();',
    'document.addEventListener("DOMContentLoaded", () => { const chat = document.createElement("button"); chat.className = "hn-ai-launcher"; chat.textContent="Help"; document.body.append(chat); });',
    '</script></body></html>',
  ].join('');
}
