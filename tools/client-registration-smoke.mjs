import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
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
if (process.env.REGISTRATION_QA_DIAGNOSTIC === '1') {
  const session = await browser.newBrowserCDPSession();
  console.log(JSON.stringify({ event: 'registration-qa-processes', nodePid: process.pid,
    browserProcesses: (await session.send('SystemInfo.getProcessInfo')).processInfo }));
  await session.detach();
}
try {
  for (const locale of ['de', 'en', 'ru', 'uk']) {
    for (const mode of ['desktop', 'mobile']) {
      const context = await browser.newContext(
        mode === 'mobile' ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 1000 } }
      );
      const page = await context.newPage();
      // Keep the localhost development watcher independent of the fixed QA clock.
      await page.route('**/assets/js/local-dev-refresh.js*', route => route.fulfill({
        status: 200, contentType: 'application/javascript', body: '/* Development refresh is isolated in QA. */',
      }));
      await page.clock.setFixedTime(new Date('2026-11-02T08:00:00Z'));
      const errors = [];
      const blockedExternalRequests = [];
      page.on('pageerror', error => errors.push(error.message));
      // A simulated successful booking must never reach live analytics or another service.
      // Specific booking mocks registered below take priority over this safety boundary.
      await page.route('**/*', route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin !== new URL(base).origin || !['GET', 'HEAD'].includes(request.method())) {
          blockedExternalRequests.push({ origin: url.origin, hostname: url.hostname, path: url.pathname, method: request.method() });
          return route.abort('blockedbyclient');
        }
        return route.fallback();
      });
      let flowStarted = false;
      let unexpectedNavigations = 0;
      page.on('framenavigated', frame => {
        if (flowStarted && frame === page.mainFrame()) unexpectedNavigations++;
      });
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
      flowStarted = true;
      const cookie = page.locator('[data-cookie-choice="necessary"]');
      await cookie.waitFor({ state: 'visible', timeout: 20000 });
      await cookie.click();
      assert.equal(await page.evaluate(() => window.__hundesalonCookieConsent?.analytics), false,
        'Mock booking QA uses necessary cookies only');
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
      Object.entries(selected).forEach(([name, value]) => {
        assert.notEqual(value, '', `${locale}/${mode}: ${name} must be populated before the contact step`);
      });
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
      const checkConsent = async name => {
        const input = form.locator(`[name="${name}"]`);
        await input.waitFor({ state: 'visible' });
        if (await input.isChecked()) return;
        let point;
        try {
          await input.evaluate(element => {
            const describe = node => node?.nodeType === 1 ? `${node.tagName}#${node.id}.${node.className}[name=${node.getAttribute('name') || ''}]` : node?.nodeName || 'window';
            const box = node => {
              if (!node) return null;
              const rect = node.getBoundingClientRect();
              return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
            };
            const scroll = node => node && ({ target: describe(node), top: node.scrollTop, left: node.scrollLeft,
              height: node.clientHeight, scrollHeight: node.scrollHeight, rect: box(node),
              overflowY: getComputedStyle(node).overflowY, overflowX: getComputedStyle(node).overflowX });
            const snapshot = (type, event) => {
              const rect = box(element);
              return { type, elapsedMs: performance.now(), target: event ? describe(event.target) : null,
                trusted: event?.isTrusted, path: event?.composedPath().slice(0, 12).map(describe),
                pointer: event && { x: event.clientX, y: event.clientY }, checked: element.checked,
                input: rect, activeElement: describe(document.activeElement),
                centerHit: describe(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)),
                originalPointHit: window.__registrationConsentProbe?.point
                  ? describe(document.elementFromPoint(window.__registrationConsentProbe.point.x, window.__registrationConsentProbe.point.y)) : null,
                step: scroll(element.closest('#step-3')), form: scroll(element.closest('form')),
                frame: scroll(element.closest('.price-booking-flow__content')), site: scroll(document.querySelector('.site-scroll-root')) };
            };
            window.__registrationConsentSnapshot = snapshot;
            window.__registrationConsentProbe = { name: element.name, clicked: false, trusted: false, events: [], beforeScroll: snapshot('before-scroll') };
            const types = ['pointermove', 'pointerdown', 'mousedown', 'focusin', 'pointerup', 'mouseup', 'click', 'change', 'scroll'];
            const capture = event => {
              const probe = window.__registrationConsentProbe;
              if (probe.events.length < 50) probe.events.push(snapshot(event.type, event));
              if (event.type === 'click') {
                probe.clicked = event.composedPath().includes(element);
                probe.trusted = event.isTrusted;
              }
            };
            for (const type of types) window.addEventListener(type, capture, true);
            window.__registrationConsentCleanup = () => {
              for (const type of types) window.removeEventListener(type, capture, true);
            };
          });
          await input.evaluate(element => {
            const step = element.closest('#step-3');
            const rect = element.getBoundingClientRect();
            const panel = step.getBoundingClientRect();
            step.scrollTo({ top: step.scrollTop + rect.top - panel.top - panel.height / 2 + rect.height / 2,
              behavior: 'instant' });
          });
          point = await input.evaluate(async element => {
            const measure = () => {
              const rect = element.getBoundingClientRect();
              return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
            };
            let rect = measure();
            let stableSince = performance.now();
            const started = stableSince;
            while (performance.now() - started < 3000) {
              await new Promise(resolve => requestAnimationFrame(resolve));
              const next = measure();
              if (Object.keys(rect).some(key => Math.abs(next[key] - rect[key]) > 0.25)) stableSince = performance.now();
              rect = next;
              if (performance.now() - stableSince >= 100) break;
            }
            // Bbox corners are outside a circular checkbox; use its centre and four inner points.
            const hits = [[0.5, 0.5], [0.5, 0.3], [0.7, 0.5], [0.5, 0.7], [0.3, 0.5]].map(([x, y]) => {
              const hit = document.elementFromPoint(rect.left + rect.width * x, rect.top + rect.height * y);
              return { ok: hit === element, target: hit && `${hit.tagName}.${hit.className}` };
            });
            const visible = rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.top >= 0
              && rect.left + rect.width <= window.innerWidth && rect.top + rect.height <= window.innerHeight;
            window.__registrationConsentProbe.point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            window.__registrationConsentProbe.beforeNative = window.__registrationConsentSnapshot('before-native');
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, rect, hits, visible,
              stable: performance.now() - stableSince >= 100 };
          });
          assert.ok(point.stable && point.visible && point.hits.every(hit => hit.ok),
            `${locale}/${mode}: ${name} must be stable and hittable: ${JSON.stringify(point)}`);
          if (mode === 'mobile') await page.touchscreen.tap(point.x, point.y);
          else await page.mouse.click(point.x, point.y);
          const probe = await page.evaluate(() => ({ ...window.__registrationConsentProbe,
            afterNative: window.__registrationConsentSnapshot('after-native') }));
          await writeFile(path.join(output, `${locale}-${mode}-${name}-native.json`), JSON.stringify({ locale, mode, point, probe }, null, 2));
          assert.ok(probe.clicked && probe.trusted, `${locale}/${mode}: native input reaches ${name}`);
          assert.equal(await input.isChecked(), true, `${locale}/${mode}: ${name} is selected`);
        } catch (error) {
          const probe = await page.evaluate(() => ({ ...window.__registrationConsentProbe,
            failure: window.__registrationConsentSnapshot?.('failure') })).catch(() => null);
          await writeFile(path.join(output, `${locale}-${mode}-${name}-native.json`),
            JSON.stringify({ locale, mode, point, probe, error: { name: error.name, message: error.message } }, null, 2));
          await page.screenshot({ path: path.join(output, `${locale}-${mode}-${name}-hit-failure.png`) }).catch(() => {});
          throw error;
        } finally {
          await page.evaluate(() => window.__registrationConsentCleanup?.()).catch(() => {});
        }
      };
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
      await checkConsent('privacy_consent');
      await checkConsent('agb_consent');
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
      assert.equal(await page.evaluate(() => window.__hundesalonAnalyticsReady === true), false,
        'Mock successful booking must not initialize live analytics');
      assert.equal(blockedExternalRequests.some(request =>
        /(^|\.)(googletagmanager\.com|google-analytics\.com|googleadservices\.com|doubleclick\.net|googlesyndication\.com|clarity\.ms)$/.test(request.hostname)
      ), false, 'Necessary-only QA must not attempt analytics or conversion requests');
      for (const payload of payloads) {
        assert.equal(payload.form_type, 'booking');
        assert.equal(payload.name, marker);
        assert.equal(payload.email, 'qa@example.invalid');
        assert.equal(payload.pet_name, 'QA test pet');
        for (const [name, value] of Object.entries(selected)) assert.equal(payload[name], value);
      }
      assert.deepEqual(errors, []);
      assert.equal(unexpectedNavigations, 0, `${locale}/${mode}: the modal flow must not navigate or reload the page`);
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
