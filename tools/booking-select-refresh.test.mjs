import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { chromium, webkit } from 'playwright';
import { startStaticTestServer } from './lib/static-test-server.mjs';

const engines = { chromium, webkit };
const selectedEngines = (process.env.BOOKING_SELECT_ENGINES || 'chromium,webkit').split(',');
const outputRoot = path.resolve(
  process.env.BOOKING_SELECT_OUTPUT || 'output/release-2026-11-17/remediation/select-fix'
);

for (const name of selectedEngines) {
  if (process.env.BOOKING_SELECT_PHASES !== 'fallback')
    test(
      `${name}: mounted booking selects enhance once and preserve native change behavior`,
      { timeout: 45000 },
      async () => {
        const out = path.join(outputRoot, name);
        await mkdir(out, { recursive: true });
        const result = {
          engine: name,
          status: 'running',
          checkpoints: [],
          pointers: [],
          errors: [],
          blockedMutations: [],
          cleanup: {},
        };
        let server, browser, context, page;
        const save = () => writeFile(path.join(out, 'results.json'), JSON.stringify(result, null, 2));
        const checkpoint = async name => {
          result.checkpoints.push(name);
          await save();
        };
        const nativePointer = async locator => {
          await locator.waitFor({ state: 'visible', timeout: 5000 });
          await locator.evaluate(element =>
            element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
          );
          const samples = [];
          for (let index = 0; index < 3; index++) {
            if (index) await page.waitForTimeout(150);
            samples.push(
              await locator.evaluate(element => {
                const bounds = element.getBoundingClientRect(),
                  root = element.getRootNode();
                const hit = root.elementFromPoint?.(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
                const closeTarget = element.matches('.modal-close');
                const ancestors = [];
                if (closeTarget)
                  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
                    const style = getComputedStyle(parent);
                    ancestors.push({
                      tag: parent.tagName,
                      id: parent.id,
                      className: parent.className,
                      transform: style.transform,
                      animationName: style.animationName,
                      animationDuration: style.animationDuration,
                    });
                  }
                return {
                  bounds: bounds.toJSON(),
                  transform: getComputedStyle(element).transform,
                  hitTarget: hit === element || element.contains(hit),
                  hitTag: hit?.tagName,
                  closeTarget,
                  ancestors,
                };
              })
            );
          }
          result.pointers.push({ target: locator.toString(), samples });
          await save();
          const final = samples.at(-1),
            previous = samples.at(-2);
          assert.ok(final.hitTarget, 'native pointer point belongs to target');
          if (final.closeTarget)
            assert.ok(
              Math.abs(final.bounds.x - previous.bounds.x) < 0.5 && Math.abs(final.bounds.y - previous.bounds.y) < 0.5,
              'close target remains stationary before the native pointer click'
            );
          await page.mouse.click(final.bounds.x + final.bounds.width / 2, final.bounds.y + final.bounds.height / 2);
        };
        const mountedSelects = () =>
          page.locator('#booking-modal .booking-selection select:not([hidden])').evaluateAll(selects =>
            selects.map(select => ({
              field: [...select.attributes].find(attribute => attribute.name.startsWith('data-booking-'))?.name,
              wrappers: select.closest('.site-select') ? 1 : 0,
              nested: select.closest('.site-select')?.parentElement?.closest('.site-select') ? 1 : 0,
              triggers: select.closest('.site-select')?.querySelectorAll(':scope > .site-select__trigger').length || 0,
              nativeHidden: getComputedStyle(select).clipPath !== 'none',
            }))
          );
        const assertMounted = rows => {
          assert.equal(rows.length, 5, 'coat, breed and three risk fields remain present');
          assert.ok(
            rows.every(row => row.wrappers === 1 && row.nested === 0 && row.triggers === 1 && row.nativeHidden),
            'every mounted visible field uses exactly one shared select control'
          );
        };
        try {
          server = await startStaticTestServer(process.cwd(), { port: 0 });
          result.origin = server.baseUrl;
          browser = await engines[name].launch({ headless: true, timeout: 10000 });
          context = await browser.newContext({
            viewport: { width: 375, height: 900 },
            deviceScaleFactor: 2,
            isMobile: true,
            hasTouch: true,
            locale: 'ru',
            serviceWorkers: 'block',
          });
          await context.addInitScript(() =>
            Object.defineProperty(navigator, 'geolocation', {
              value: {
                getCurrentPosition(_success, error) {
                  setTimeout(() => error?.({ code: 1, message: 'Isolated booking QA: no real GPS' }), 0);
                },
                watchPosition() {
                  return 1;
                },
                clearWatch() {},
              },
            })
          );
          const origin = new URL(server.baseUrl);
          await context.route('**/*', route => {
            const request = route.request(),
              url = new URL(request.url());
            if (!['GET', 'HEAD'].includes(request.method())) {
              result.blockedMutations.push({ method: request.method(), pathname: url.pathname });
              return route.abort();
            }
            if (url.pathname === '/api/weather')
              return route.fulfill({ status: 503, json: { error: 'Labelled offline booking QA fixture' } });
            if (url.pathname === '/assets/js/local-dev-refresh.js') return route.fulfill({ body: '// isolated QA' });
            return url.origin === origin.origin || ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)
              ? route.continue()
              : route.abort();
          });
          page = await context.newPage();
          page.setDefaultTimeout(5000);
          page.on('pageerror', error => result.errors.push(error.message));
          await page.goto(server.baseUrl + '/ru/onlayn-bronirovanie.html', {
            waitUntil: 'domcontentloaded',
            timeout: 12000,
          });
          await nativePointer(page.locator('[data-cookie-choice="necessary"]'));
          await page.locator('.cookie-consent').waitFor({ state: 'hidden', timeout: 5000 });
          await checkpoint('native-necessary-consent');
          await nativePointer(page.locator('#open-booking-btn'));
          await page.waitForFunction(
            () => document.querySelector('#booking-modal')?.classList.contains('is-alive'),
            null,
            { timeout: 4000 }
          );
          result.initialMount = await mountedSelects();
          await checkpoint('first-mount-measured');
          assertMounted(result.initialMount);

          const coat = page.locator('[data-booking-coat-filter]');
          const value = await coat.evaluate(select => [...select.options].find(option => option.value)?.value);
          assert.ok(value, 'coat filter has a real non-placeholder option');
          await coat.evaluate(select => {
            window.__bookingSelectChangeCount = 0;
            select.addEventListener('change', () => window.__bookingSelectChangeCount++);
          });
          const wrapper = coat.locator('..');
          await nativePointer(wrapper.locator(':scope > .site-select__trigger'));
          await nativePointer(wrapper.locator(`.site-select__option[data-value="${value}"]`));
          assert.equal(await coat.inputValue(), value, 'custom option updates native selection');
          assert.equal(
            await page.evaluate(() => window.__bookingSelectChangeCount),
            1,
            'one choice emits exactly one native change'
          );
          await checkpoint('native-option-change-once');
          try {
            await page.screenshot({ path: path.join(out, 'booking-enhanced.png'), timeout: 3000 });
          } catch (error) {
            result.screenshotError = error.message;
          }
          await nativePointer(page.locator('#booking-modal .modal-close'));
          await page.waitForFunction(
            () =>
              !document.querySelector('#booking-modal')?.classList.contains('active') &&
              !document.body.classList.contains('booking-modal-open'),
            null,
            { timeout: 3000 }
          );
          await checkpoint('native-close-unlocks-page');
          await nativePointer(page.locator('#open-booking-btn'));
          await page.waitForFunction(
            () => document.querySelector('#booking-modal')?.classList.contains('is-alive'),
            null,
            { timeout: 4000 }
          );
          result.secondMount = await mountedSelects();
          assertMounted(result.secondMount);
          await checkpoint('reopen-without-duplicate-wrappers');
          assert.deepEqual(result.errors, [], 'no uncaught JS errors');
          assert.deepEqual(result.blockedMutations, [], 'test does not attempt submissions');

          result.status = 'pass';
        } catch (error) {
          result.status = 'fail';
          result.error = error.stack;
          if (page) await page.screenshot({ path: path.join(out, 'failure.png'), timeout: 1500 }).catch(() => {});
          throw error;
        } finally {
          if (context) {
            await context.close();
            result.cleanup.context = 'closed';
          }
          if (browser) {
            await browser.close();
            result.cleanup.browser = 'closed';
          }
          if (server) {
            await server.close();
            result.cleanup.server = 'closed';
          }
          await save();
        }
      }
    );

  if (process.env.BOOKING_SELECT_PHASES !== 'flow')
    test(`${name}: native booking fallback paints readable dark and light fields`, { timeout: 15000 }, async () => {
      const out = path.join(outputRoot, name, 'fallback');
      await mkdir(out, { recursive: true });
      const result = { status: 'running', fallback: [], cleanup: {} };
      const browser = await engines[name].launch({ headless: true, timeout: 5000 });
      const context = await browser.newContext({
        viewport: { width: 375, height: 900 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        serviceWorkers: 'block',
      });
      try {
        const page = await context.newPage();
        const css = await readFile(new URL('../assets/css/page-modules.css', import.meta.url), 'utf8');
        await page.setContent(
          `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div id="booking-modal" class="active"><div class="modal-content"><label class="booking-selection__field"><span>Native fallback</span><select data-site-select-skip><option>Порода</option></select></label></div></div></body></html>`
        );
        assert.equal(
          await page.evaluate(() => window.innerWidth),
          375,
          'fallback fixture uses the actual mobile viewport'
        );
        await page.waitForFunction(
          () =>
            ['#booking-modal', '#booking-modal .modal-content'].every(
              selector => getComputedStyle(document.querySelector(selector)).opacity === '1'
            ),
          null,
          { timeout: 3000 }
        );
        for (const theme of ['dark', 'light']) {
          await page.evaluate(theme => document.body.classList.toggle('light', theme === 'light'), theme);
          const appearance = await page.locator('select').evaluate(select => {
            const style = getComputedStyle(select);
            return { color: style.color, backgroundColor: style.backgroundColor, colorScheme: style.colorScheme };
          });
          assert.equal(appearance.colorScheme, theme, 'native fallback uses the intended browser color scheme');
          const frame = await page.screenshot({ path: path.join(out, `native-fallback-${theme}.png`), timeout: 3000 });
          const pixel = await page.evaluate(async base64 => {
            const image = new Image();
            image.src = 'data:image/png;base64,' + base64;
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const drawing = canvas.getContext('2d');
            drawing.drawImage(image, 0, 0);
            const rect = document.querySelector('select').getBoundingClientRect();
            return [
              ...drawing.getImageData(
                Math.round((rect.left + rect.width * 0.72) * window.devicePixelRatio),
                Math.round((rect.top + rect.height / 2) * window.devicePixelRatio),
                1,
                1
              ).data,
            ];
          }, frame.toString('base64'));
          result.fallback.push({ theme, ...appearance, pixel });
          assert.ok(
            theme === 'dark' ? Math.max(...pixel.slice(0, 3)) < 80 : Math.min(...pixel.slice(0, 3)) > 160,
            'rendered native fallback background follows theme'
          );
        }
        result.status = 'pass';
      } catch (error) {
        result.status = 'fail';
        result.error = error.stack;
        throw error;
      } finally {
        await context.close();
        result.cleanup.context = 'closed';
        await browser.close();
        result.cleanup.browser = 'closed';
        await writeFile(path.join(out, 'results.json'), JSON.stringify(result, null, 2));
      }
    });
}
