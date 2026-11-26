import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
import { startStaticTestServer } from './lib/static-test-server.mjs';

const baseline = process.argv.includes('--baseline');
const useWebKit = process.argv.includes('--webkit');
const engine = useWebKit ? 'webkit' : 'chromium';
const output = path.resolve('test-results', 'burger-menu-scroll');
await mkdir(output, { recursive: true });
const server = await startStaticTestServer(process.cwd(), { weatherModuleDirectory: 'output/weather-production' });
const browser = await (useWebKit ? webkit : chromium).launch({
  headless: true,
  ...(!useWebKit && process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
});
// Preserve the drawer's existing serial protocol; page gestures use a timed native stream.
async function nativeTouch(page, cdp, point, delta, stream = false) {
  if (!stream) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    for (let step = 1; step <= 8; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y - Math.sign(delta) * step * 16 }] });
      await page.waitForTimeout(25);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    return null;
  }
  const result = { acknowledgements: [], schedule: [], deadlineMs: 5000 };
  const start = performance.now(), pending = [];
  const send = (label, type, touchPoints, plannedMs) => {
    const sentAt = performance.now(), record = { label, plannedMs, sentMs: sentAt - start };
    result.acknowledgements.push(record);
    result.schedule.push({ label, plannedMs, actualMs: sentAt - start });
    const operation = cdp.send('Input.dispatchTouchEvent', { type, touchPoints }).then(value => {
      record.ackMs = performance.now() - sentAt; return value;
    });
    let timer;
    const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label + ': native ACK exceeded5000ms')), 5000); });
    pending.push(Promise.race([operation, deadline]).then(() => { record.withinBound = true; }, error => {
      record.withinBound = false; record.error = String(error);
    }).finally(() => clearTimeout(timer)));
  };
  send('touchStart', 'touchStart', [{ ...point, id: 1, force: 1 }], 0);
  for (let step = 1; step <= 8; step++) {
    const remaining = start + step * 40 - performance.now();
    if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
    send('touchMove' + step, 'touchMove', [{ x: point.x, y: point.y - Math.sign(delta) * step * 30, id: 1, force: 1 }], step * 40);
  }
  send('touchEnd', 'touchEnd', [], 320);
  result.emissionMs = performance.now() - start;
  await Promise.all(pending);
  if (result.acknowledgements.some(record => !record.withinBound)) {
    const error = new Error('Native touch stream did not meet its per-command deadline');
    error.gesture = result; throw error;
  }
  return result;
}

async function preparePriceConsent(page, setup) {
  await page.waitForFunction(() => document.documentElement.dataset.siteReady === 'true', undefined, { timeout: 20000, polling: 100 });
  let readyTimer;
  try {
    setup.ready = await Promise.race([
      page.evaluate(async () => ({ outcome: await window.NikaSiteLoader.ready, active: window.NikaSiteLoader.active, globalOverlay: document.querySelectorAll('#preloader').length, loading: document.documentElement.classList.contains('site-loading') })),
      new Promise((_, reject) => { readyTimer = setTimeout(() => reject(new Error('Price setup readiness timeout5000ms')), 5000); }),
    ]);
  } finally { clearTimeout(readyTimer); }
  assert.equal(setup.ready.outcome.reason, 'ready'); assert.equal(setup.ready.active, false);
  assert.equal(setup.ready.globalOverlay, 0); assert.equal(setup.ready.loading, false);
  await page.evaluate(() => document.fonts.ready);
  const readChoice = () => page.evaluate(() => {
    let stored = null; try { stored = JSON.parse(localStorage.getItem('hundesalon_cookie_consent') || 'null'); } catch {}
    const choice = window.__hundesalonCookieConsent || stored;
    return choice ? { essential: choice.essential, analytics: choice.analytics, version: choice.version } : null;
  });
  setup.choiceBefore = await readChoice();
  const consent = page.locator('[data-cookie-choice="necessary"]'), banner = page.locator('.cookie-consent');
  if (setup.choiceBefore) {
    assert.deepEqual(setup.choiceBefore, { essential: true, analytics: false, version: 1 }, 'existing consent must already be necessary-only; never substitute storage');
    setup.consentAction = 'existing necessary choice';
  } else {
    await consent.waitFor({ state: 'visible', timeout: 10000 });
    await consent.click({ timeout: 5000 });
    await consent.waitFor({ state: 'hidden', timeout: 5000 });
    setup.consentAction = 'visible native necessary control clicked';
  }
  await banner.waitFor({ state: 'detached', timeout: 5000 });
  setup.choiceAfter = await readChoice();
  assert.deepEqual(setup.choiceAfter, { essential: true, analytics: false, version: 1 });
  setup.cookieDOMBeforeFirstTouch = await page.evaluate(() => ({ bannerCount: document.querySelectorAll('.cookie-consent').length, necessaryControlCount: document.querySelectorAll('[data-cookie-choice="necessary"]').length }));
  assert.equal(setup.cookieDOMBeforeFirstTouch.bannerCount, 0); assert.equal(setup.cookieDOMBeforeFirstTouch.necessaryControlCount, 0);
  setup.completedAt = new Date().toISOString();
}

async function priceNative(page, context, errors, scenario) {
  const result = { name: scenario.name, scope: 'Static source fixture/API403, trusted native input; scheduler observations are not physical FPS or production cache proof.', setup: scenario.setup, errors, phases: {} };
  results.push(result);
  const cdp = await context.newCDPSession(page);
  const performanceFlags = () => Object.entries(result.phases).flatMap(([phase, value]) => [
    ...(value.frames?.above100ms ? [phase + ': rAF gaps above100ms'] : []),
    ...(!value.frames?.samples ? [phase + ': no rAF interval samples'] : []),
    ...(value.slowAcknowledgements?.length ? [phase + ': native ACK above1000ms'] : []),
    ...(value.native?.acknowledgements?.some(record => record.withinBound === false) ? [phase + ': native ACK deadline failed'] : []),
  ]);
  const state = () => page.evaluate(() => {
    const root = document.querySelector('.site-scroll-root'), audit = window.__priceNativeSmoke;
    const cards = [...document.querySelectorAll('.price-card')], header = document.querySelector('.header'), rect = header?.getBoundingClientRect();
    return { root: root.scrollTop, windowY: window.scrollY, active: root.classList.contains('site-scroll-active'), budget: root.dataset.scrollBudget || null,
      nativeIntent: root.dataset.nativeScrollIntent || null, primaryCoarseNoHover: typeof window.matchMedia === 'function' ? window.matchMedia('(hover: none) and (pointer: coarse)').matches : null,
      motionStylesheetLoaded: Boolean(document.querySelector('link[data-motion-visibility]')?.sheet),
      cards: cards.length, domStable: cards.length === audit.cards.length && cards.every((node, index) => node === audit.cards[index]),
      bodyClass: document.body.className, header: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height, offscreen: header.hasAttribute('data-motion-offscreen') } : null,
      events: audit.events, frames: audit.frames, startAt: audit.startAt, at: performance.now() };
  });
  const idle = async () => {
    await page.evaluate(() => { const audit = window.__priceNativeSmoke; audit.idleOffset = null; audit.idleSince = performance.now(); });
    await page.waitForFunction(() => {
      const root = document.querySelector('.site-scroll-root'), audit = window.__priceNativeSmoke, now = performance.now();
      if (audit.idleOffset !== root.scrollTop) { audit.idleOffset = root.scrollTop; audit.idleSince = now; }
      return !root.classList.contains('site-scroll-active') && !root.hasAttribute('data-scroll-budget') && now - audit.idleSince >= 200;
    }, undefined, { timeout: 5000, polling: 100 });
  };
  const begin = async phase => page.evaluate(phase => {
    const audit = window.__priceNativeSmoke;
    if (Number.isInteger(audit.frameRequest)) window.cancelAnimationFrame(audit.frameRequest);
    const epoch = audit.frameEpoch = (audit.frameEpoch || 0) + 1;
    audit.phase = phase; audit.frames = []; audit.measuring = true; audit.startAt = performance.now();
    let last;
    const frame = time => { if (!audit.measuring || audit.frameEpoch !== epoch) return; if (last !== undefined) audit.frames.push(time - last); last = time; audit.frameRequest = requestAnimationFrame(frame); };
    audit.frameRequest = requestAnimationFrame(frame);
  }, phase);
  const finish = async phase => {
    await page.evaluate(() => {
      const audit = window.__priceNativeSmoke; audit.measuring = false; audit.frameEpoch = (audit.frameEpoch || 0) + 1;
      if (Number.isInteger(audit.frameRequest)) window.cancelAnimationFrame(audit.frameRequest);
      audit.frameRequest = null;
    });
    const after = await state(), values = [...after.frames].sort((a, b) => a - b);
    const frames = { samples: values.length, medianMs: values[Math.floor(values.length / 2)] ?? null, p95Ms: values[Math.min(values.length - 1, Math.floor(values.length * 0.95))] ?? null,
      maxMs: values.at(-1) ?? null, above100ms: values.filter(value => value > 100).length };
    return { after, frames, events: after.events.filter(event => event.phase === phase) };
  };
  const point = kind => page.evaluate(kind => {
    const candidates = kind === 'card' ? [...document.querySelectorAll('.price-card')] : [
      ...document.querySelectorAll('.price-page-hero__lead, .price-page-hero__note'),
      ...document.querySelectorAll('[data-price-hero]'), document.querySelector('main[data-price-page]'),
    ];
    for (const node of candidates.filter(Boolean)) {
      const rect = node.getBoundingClientRect(), top = Math.max(320, rect.top + 8), bottom = Math.min(innerHeight - 32, rect.bottom - 8);
      if (bottom < top) continue;
      const y = Math.min(bottom, Math.max(top, 600));
      for (const x of [rect.left + rect.width / 2, rect.left + 8, rect.right - 8]) {
        if (x < 4 || x > window.innerWidth - 4) continue;
        const target = document.elementFromPoint(x, y);
        if (!target?.closest('main[data-price-page]') || target.closest('a, button, input, select, textarea, [role="button"], .service-list, .table-wrapper')) continue;
        if (kind === 'card' && target.closest('.price-card') !== node) continue;
        if (kind !== 'card' && target.closest('.price-card')) continue;
        return { point: { x, y }, tag: target.tagName, className: String(target.className || ''), kind, cardIndex: kind === 'card' ? [...document.querySelectorAll('.price-card')].indexOf(node) : null };
      }
    }
    return null;
  }, kind);
  const gesture = async (phase, kind) => {
    const chosen = await point(kind); assert.ok(chosen, phase + ': an actual visible noninteractive target is required');
    await begin(phase);
    const entry = result.phases[phase] = { chosen, before: await state() };
    try { entry.native = await nativeTouch(page, cdp, chosen.point, 240, true); }
    catch (error) {
      entry.native = error.gesture; entry.error = String(error);
      Object.assign(entry, await finish(phase).catch(() => ({})));
      entry.slowAcknowledgements = entry.native?.acknowledgements.filter(record => record.ackMs > 1000) || [];
      throw error;
    }
    await idle(); Object.assign(entry, await finish(phase));
    const touches = entry.events.filter(event => event.type.startsWith('touch'));
    assert.ok(touches.some(event => event.type === 'touchmove') && touches.some(event => event.type === 'touchend'), phase + ': native move/end must be delivered');
    assert.ok(touches.every(event => event.trusted && !event.prevented), phase + ': native input must remain unprevented');
    assert.ok(touches.filter(event => event.type === 'touchstart').every(event => !event.interactive && (kind === 'card' ? event.region === 'card' && event.cardIndex === chosen.cardIndex : ['hero', 'main'].includes(event.region))), phase + ': actual touch target must match the visible region');
    assert.ok(entry.after.root > entry.before.root + 20, phase + ': actual native scrolling must advance');
    assert.equal(entry.after.domStable, true); assert.equal(entry.after.cards, 25); assert.equal(entry.after.windowY, 0);
    entry.slowAcknowledgements = entry.native.acknowledgements.filter(record => record.ackMs > 1000);
  };
  try {
    await page.waitForFunction(() => document.documentElement.dataset.siteReady === 'true' && document.documentElement.dataset.priceReady === 'true' && document.querySelectorAll('.price-card').length === 25, undefined, { timeout: 20000 });
    result.readiness = await page.evaluate(async () => ({ outcome: await window.NikaSiteLoader.ready, active: window.NikaSiteLoader.active, globalOverlay: document.querySelectorAll('#preloader').length, loading: document.documentElement.classList.contains('site-loading') }));
    assert.equal(result.readiness.outcome.reason, 'ready'); assert.equal(result.readiness.active, false); assert.equal(result.readiness.globalOverlay, 0); assert.equal(result.readiness.loading, false);
    await page.waitForFunction(() => Boolean(document.querySelector('link[data-motion-visibility]')?.sheet) && document.querySelectorAll('.price-card[data-motion-offscreen]').length > 0, undefined, { timeout: 10000 });
    await page.evaluate(() => {
      const audit = window.__priceNativeSmoke = { cards: [...document.querySelectorAll('.price-card')], events: [], frames: [], measuring: false, phase: 'ready' };
      for (const type of ['wheel', 'touchstart', 'touchmove', 'touchend', 'touchcancel']) window.addEventListener(type, event => window.queueMicrotask(() => {
        const target = event.target, card = target.closest?.('.price-card');
        audit.events.push({ phase: audit.phase, type, trusted: event.isTrusted, prevented: event.defaultPrevented, tag: target.tagName, className: String(target.className || ''),
          region: card ? 'card' : target.closest?.('[data-price-hero]') ? 'hero' : target.closest?.('main[data-price-page]') ? 'main' : 'other',
          cardIndex: card ? audit.cards.indexOf(card) : null, interactive: Boolean(target.closest?.('a, button, input, select, textarea, [role="button"], .service-list, .table-wrapper')),
          touches: event.touches ? [...event.touches].map(touch => ({ identifier: touch.identifier, clientX: touch.clientX, clientY: touch.clientY, pageX: touch.pageX, pageY: touch.pageY, radiusX: touch.radiusX, radiusY: touch.radiusY, force: touch.force })) : undefined,
          changedTouches: event.changedTouches ? [...event.changedTouches].map(touch => ({ identifier: touch.identifier, clientX: touch.clientX, clientY: touch.clientY, pageX: touch.pageX, pageY: touch.pageY, radiusX: touch.radiusX, radiusY: touch.radiusY, force: touch.force })) : undefined });
      }), { passive: true });
    });
    result.initial = await state(); assert.ok(Math.abs(result.initial.root) <= 1, 'First touch must precede wheel or test positioning');
    await gesture('firstTouch', 'entry');
    await begin('wheel'); result.phases.wheel = { before: await state() };
    for (const deltaY of [...Array(12).fill(180), ...Array(8).fill(-180)]) {
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 8, y: 600, deltaX: 0, deltaY });
      await page.waitForTimeout(180);
    }
    await idle(); Object.assign(result.phases.wheel, await finish('wheel'));
    const wheel = result.phases.wheel.events.filter(event => event.type === 'wheel');
    assert.equal(wheel.length, 20); assert.ok(wheel.every(event => event.trusted && !event.prevented));
    assert.ok(result.phases.wheel.after.root > result.phases.wheel.before.root + 20);
    assert.equal(result.phases.wheel.after.domStable, true); assert.equal(result.phases.wheel.after.cards, 25);
    await gesture('cardAfterIdle', 'card');
    result.performanceFlags = performanceFlags();
    assert.deepEqual(errors, []); result.functionalPass = true;
    await page.screenshot({ path: path.join(output, engine + '-price-native.png') });
    console.log(JSON.stringify({ engine, scenario: scenario.name, ok: true, functionalOnly: true, performanceFlags: result.performanceFlags }));
  } catch (error) {
    result.error = String(error); result.functionalPass = false;
    await page.evaluate(() => {
      const audit = window.__priceNativeSmoke; if (!audit) return;
      audit.measuring = false; audit.frameEpoch = (audit.frameEpoch || 0) + 1;
      if (Number.isInteger(audit.frameRequest)) window.cancelAnimationFrame(audit.frameRequest);
      audit.frameRequest = null;
    }).catch(() => {});
    result.failureState = await state().catch(() => null);
    let postmortemTimer;
    try {
      result.postmortem = await Promise.race([
        page.evaluate(cardIndex => {
          const root = document.querySelector('.site-scroll-root'), main = document.querySelector('main[data-price-page]');
          const card = document.querySelectorAll('.price-card')[cardIndex], style = card ? getComputedStyle(card) : null;
          const chain = [];
          for (let node = card; node && chain.length < 10; node = node.parentElement) {
            const computed = node === card ? style : getComputedStyle(node);
            chain.push({ tag: node.tagName, className: String(node.className || ''), id: node.id || null,
              touchAction: computed.touchAction, overflowX: computed.overflowX, overflowY: computed.overflowY,
              overscrollBehavior: computed.overscrollBehavior, pointerEvents: computed.pointerEvents, transform: computed.transform, contain: computed.contain });
          }
          return { at: performance.now(), scope: 'After recorded failureState; excluded from gesture measurements', cardIndex,
            root: { nativeIntent: root?.dataset.nativeScrollIntent || null, active: root?.classList.contains('site-scroll-active') ?? null, budget: root?.dataset.scrollBudget || null },
            containment: { rootContainsMain: Boolean(main && root?.contains(main)), mainContainsCard: Boolean(card && main?.contains(card)), cardPriceMainMatches: Boolean(card && card.closest('main[data-price-page]') === main) }, chain,
            card: style ? { className: card.className, connected: card.isConnected, offscreen: card.hasAttribute('data-motion-offscreen'),
              backdropFilter: style.backdropFilter, webkitBackdropFilter: style.webkitBackdropFilter, filter: style.filter, boxShadow: style.boxShadow,
              textShadow: style.textShadow, animationPlayState: style.animationPlayState, transitionProperty: style.transitionProperty } : null };
        }, result.phases.cardAfterIdle?.chosen?.cardIndex ?? 0),
        new Promise((_, reject) => { postmortemTimer = setTimeout(() => reject(new Error('Postmortem timeout3000ms')), 3000); }),
      ]);
    } catch (postmortemError) {
      result.postmortem = { error: String(postmortemError), inconclusive: true };
    } finally { clearTimeout(postmortemTimer); }
    result.performanceFlags = performanceFlags();
    throw error;
  } finally { await cdp.detach(); }
}

const cases = [
  { name: 'short-desktop', width: 1280, height: 620 },
  { name: 'narrow-desktop', width: 390, height: 640 },
  { name: 'fitting-desktop', width: 1440, height: 1200, route: '/ru/index.html' },
  ...(!useWebKit ? [{ name: 'native-touch', width: 390, height: 640, touch: true }] : []),
  ...(!useWebKit && !baseline ? [{ name: 'price-native', width: 390, height: 844, touch: true, deviceScaleFactor: 3, priceNative: true, route: '/ru/prays-list.html' }] : []),
];
const results = [];
try {
  for (const scenario of cases) {
    const context = await browser.newContext({
      viewport: { width: scenario.width, height: scenario.height },
      isMobile: Boolean(scenario.touch), hasTouch: Boolean(scenario.touch), serviceWorkers: 'block',
      ...(scenario.deviceScaleFactor ? { deviceScaleFactor: scenario.deviceScaleFactor } : {}),
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith('/local-dev-refresh.js')) return route.fulfill({ contentType: 'application/javascript', body: '/* Isolated scroll QA. */' });
      return url.origin === server.baseUrl ? route.continue() : route.abort();
    });
    try {
      await page.goto(`${server.baseUrl}${scenario.route || '/ru/social.html'}`, { waitUntil: 'domcontentloaded' });
      if (scenario.priceNative) {
        scenario.setup = { startedAt: new Date().toISOString() };
        try { await preparePriceConsent(page, scenario.setup); }
        catch (error) {
          results.push({ name: scenario.name, setup: scenario.setup, errors, phases: {}, functionalPass: false, error: String(error) });
          throw error;
        }
        await priceNative(page, context, errors, scenario); continue;
      }
      await page.evaluate(() => document.fonts.ready);
      const consent = page.locator(scenario.priceNative ? '[data-cookie-choice="necessary"]' : '[data-cookie-choice="accept"]');
      if (await consent.isVisible()) await consent.click();
      const burger = page.locator('.premium-burger');
      const nav = page.locator('#mobile-nav');
      const content = nav.locator('.mobile-nav__content');
      const state = () => page.evaluate(() => {
        const root = document.querySelector('.site-scroll-root');
        const scroller = document.querySelector('.mobile-nav__content');
        return {
          root: root.scrollTop, rootMax: root.scrollHeight - root.clientHeight,
          windowY: window.scrollY, panel: scroller.scrollTop,
          max: scroller.scrollHeight - scroller.clientHeight,
          active: document.querySelector('#mobile-nav').classList.contains('active'),
          finePointer: window.matchMedia('(pointer: fine)').matches,
        };
      });
      await burger.click();
      await page.waitForTimeout(650);
      if (scenario.name === 'fitting-desktop') {
        await page.waitForFunction(() => {
          const element = document.querySelector('.mobile-nav__content');
          return element.scrollHeight === element.clientHeight;
        }, undefined, { timeout: 5000 });
      }
      const before = await state();
      const rect = await content.boundingBox();
      const point = { x: rect.x + rect.width / 2, y: rect.y + Math.min(rect.height * 0.65, 220) };
      const cdp = scenario.touch ? await context.newCDPSession(page) : null;
      const scrollMenu = async delta => {
        if (!cdp) {
          await page.mouse.move(point.x, point.y);
          await page.mouse.wheel(0, delta);
          return;
        }
        await nativeTouch(page, cdp, point, delta);
      };
      let start = before;
      if (!baseline) {
        // Place the edges before starting in-menu inertia. The gestures themselves use browser input.
        for (const edge of ['top', 'bottom']) {
          const delta = edge === 'bottom' ? 600 : -600;
          await content.evaluate((element, atBottom) => {
            element.scrollTop = atBottom ? element.scrollHeight : 0;
          }, edge === 'bottom');
          const placed = await state();
          assert.ok(Math.abs(placed.panel - (edge === 'bottom' ? placed.max : 0)) <= 1, `${engine}/${scenario.name}: expected to start at the ${edge} edge`);
          await scrollMenu(delta);
          await page.waitForTimeout(450);
          const atEdge = await state();
          assert.equal(atEdge.active, true, `${engine}/${scenario.name}: ${edge} must not close the menu`);
          assert.equal(atEdge.root, before.root, `${engine}/${scenario.name}: ${edge} must not chain to the page`);
        }
        start = await state();
      }
      await scrollMenu(baseline ? 600 : -600);
      await page.waitForTimeout(850);
      const after = await state();
      let nativeLock = null;
      if (!baseline) {
        assert.equal(after.active, true, `${engine}/${scenario.name}: scrolling must keep the menu open`);
        assert.equal(after.root, before.root, `${engine}/${scenario.name}: background must not scroll`);
        assert.equal(after.windowY, before.windowY);
        if (start.max > 0) assert.ok(after.panel < start.panel, `${engine}/${scenario.name}: menu must actually scroll`);
        if (cdp) await cdp.detach();
        // Wheel over the drawer's padding is also owned by the open menu.
        const panelRect = await nav.boundingBox();
        await page.mouse.move(panelRect.x + 5, panelRect.y + 5);
        await page.mouse.wheel(0, 500);
        await page.waitForTimeout(300);
        assert.equal((await state()).root, before.root);
        await page.screenshot({ path: path.join(output, `${engine}-${scenario.name}.png`) });
        await page.keyboard.press('Escape');
        await nav.waitFor({ state: 'hidden' });
        const closed = await state();
        assert.equal(closed.active, false);
        assert.equal(closed.root, before.root, 'Closing should preserve the page position');
        assert.ok(closed.rootMax > 20, `${engine}/${scenario.name}: the page must have room to scroll`);
        if (before.finePointer) {
          // Page scrolling is native. Start it with trusted browser input, then
          // verify that opening the drawer preserves and locks the actual offset.
          await page.mouse.move(12, scenario.height * 0.7);
          await page.mouse.wheel(0, 90);
          await page.waitForFunction(minimum => document.querySelector('.site-scroll-root').scrollTop > minimum,
            closed.root + 20, { timeout: 5000 });
          nativeLock = await page.evaluate(() => {
            const root = document.querySelector('.site-scroll-root');
            document.querySelector('.premium-burger').click();
            return {
              root: root.scrollTop, saved: Number(document.body.dataset.scrollY),
              locked: document.body.classList.contains('nav-open'), overflow: getComputedStyle(root).overflowY,
            };
          });
          assert.ok(nativeLock.root > closed.root + 20, `${engine}/${scenario.name}: native page input must actually move before locking`);
          assert.equal(nativeLock.saved, nativeLock.root, `${engine}/${scenario.name}: opening saves the actual native offset`);
          assert.equal(nativeLock.locked, true);
          assert.equal(nativeLock.overflow, 'hidden', `${engine}/${scenario.name}: the native page scroller must be locked`);
          await page.mouse.move(scenario.width - 5, scenario.height - 5);
          await page.mouse.wheel(0, 500);
          await page.waitForTimeout(700);
          assert.equal((await state()).root, nativeLock.root, `${engine}/${scenario.name}: native input must not move the open drawer's background`);
          assert.equal((await state()).active, true);
          await page.keyboard.press('Escape');
          await nav.waitFor({ state: 'hidden' });
          assert.equal((await state()).root, nativeLock.root, `${engine}/${scenario.name}: closing restores the locked native offset`);
        }
        const resumedFrom = (await state()).root;
        await page.mouse.move(12, scenario.height * 0.7);
        await page.mouse.wheel(0, 350);
        await page.waitForFunction(minimum => document.querySelector('.site-scroll-root').scrollTop > minimum, resumedFrom + 20, { timeout: 5000 });
        assert.deepEqual(errors, []);
      }
      results.push({ name: scenario.name, before, start, after, nativeLock, errors });
      console.log(JSON.stringify({ engine, scenario: scenario.name, baseline, before, start, after, nativeLock, ok: !baseline }));
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await server.close();
  await writeFile(path.join(output, `${engine}${baseline ? '-before' : ''}.json`), JSON.stringify(results, null, 2));
}
