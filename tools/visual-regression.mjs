import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices, webkit } from 'playwright';

import { startStaticTestServer } from './lib/static-test-server.mjs';

const useWebKit = process.argv.includes('--webkit');
const meteorOnly = process.argv.includes('--meteor-only');
const outputArgument = process.argv.find(value => value.startsWith('--output='));
const outDir = outputArgument
  ? path.resolve(outputArgument.slice('--output='.length))
  : path.resolve('test-results', useWebKit ? 'visual-regression-webkit' : 'visual-regression');
const requestedScenarios = (process.env.VISUAL_SCENARIOS || (meteorOnly ? 'mobile-dark' : ''))
  .split(',').map(name => name.trim()).filter(Boolean);
const scenarios = [
  { name: 'desktop-dark', viewport: { width: 1440, height: 900 }, light: false, mobile: false },
  { name: 'desktop-light', viewport: { width: 1440, height: 900 }, light: true, mobile: false },
  { name: 'mobile-dark', viewport: devices['iPhone 13'].viewport, light: false, mobile: true },
  { name: 'mobile-light', viewport: devices['iPhone 13'].viewport, light: true, mobile: true },
  { name: 'android-dark', viewport: devices['Pixel 7'].viewport, light: false, mobile: true },
].filter(scenario => !requestedScenarios.length || requestedScenarios.includes(scenario.name));
if (requestedScenarios.some(name => !scenarios.some(scenario => scenario.name === name))) {
  throw new Error(`Unknown visual scenario requested: ${requestedScenarios.join(', ')}`);
}

const results = [];
const completedScenarios = [];
let failure = null;
const drawerScreenshots = [];
const consentScreenshots = [];
const meteorStates = [];
const assert = (name, condition, detail = '') => {
  results.push({ name, ok: Boolean(condition), detail });
  if (!condition) throw new Error(`${name}${detail ? `: ${detail}` : ''}`);
};

const checkMeteorPseudoElements = async (page, scenarioName) => {
  await page.waitForFunction(() => {
    const host = document.querySelector('.header-weather-widget[data-weather-variant="header"]');
    return host?.shadowRoot && [...host.shadowRoot.querySelectorAll('style')]
      .some(style => style.textContent.includes('.weather-header-shooting-star'));
  }, {}, { timeout: 15000 });
  const measurement = await page.evaluate(() => {
    const host = document.querySelector('.header-weather-widget[data-weather-variant="header"]');
    const sourceStyles = [...host.shadowRoot.querySelectorAll('style')].map(style => style.textContent);
    // Keep functional weather class names away from the live widget's observers.
    // The frame has native Shadow DOM and the loaded CSS, but no application scripts.
    const frame = document.createElement('iframe');
    frame.dataset.visualMeteorFixture = 'true';
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('sandbox', 'allow-same-origin');
    frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${window.innerWidth}px;height:${window.innerHeight}px;visibility:hidden`;
    const states = [];
    let stylesCopiedExactly = false;
    try {
      document.body.append(frame);
      const fixtureDocument = frame.contentDocument;
      fixtureDocument.documentElement.lang = document.documentElement.lang;
      fixtureDocument.body.className = document.body.className;
      const fixtureHost = fixtureDocument.createElement('div');
      for (const attribute of host.attributes) fixtureHost.setAttribute(attribute.name, attribute.value);
      fixtureDocument.body.append(fixtureHost);
      const shadow = fixtureHost.attachShadow({ mode: 'open' });
      for (const text of sourceStyles) {
        const style = fixtureDocument.createElement('style');
        style.textContent = text;
        shadow.append(style);
      }
      stylesCopiedExactly = [...shadow.querySelectorAll('style')]
        .every((style, index) => style.textContent === sourceStyles[index]);
      const fixture = fixtureDocument.createElement('div');
      fixture.className = 'weather-app';
      shadow.append(fixture);
      for (const surface of ['preview', 'forecast']) {
        for (const depth of ['back', 'front']) {
          const container = fixtureDocument.createElement('div');
          container.className = surface === 'preview' ? 'weather-header-preview' : 'weather-header-dropdown';
          const stage = surface === 'preview' ? container : fixtureDocument.createElement('div');
          if (stage !== container) {
            stage.className = 'weather-header-dropdown__hero';
            container.append(stage);
          }
          const layer = depth === 'front' ? stage : fixtureDocument.createElement('div');
          if (layer !== stage) {
            layer.className = `${surface === 'preview' ? 'weather-header-preview' : 'weather-header-dropdown'}__stars-back is-night-sky`;
            stage.append(layer);
          }
          const meteor = fixtureDocument.createElement('span');
          meteor.className = `weather-header-shooting-star${depth === 'front' ? ' weather-header-shooting-star--foreground' : ''}`;
          layer.append(meteor);
          fixture.append(container);
          const pseudoStyle = selector => {
            const style = frame.contentWindow.getComputedStyle(meteor, selector);
            return { backgroundImage: style.backgroundImage, content: style.content, width: style.width, height: style.height };
          };
          states.push({ surface, depth, before: pseudoStyle('::before'), after: pseudoStyle('::after') });
        }
      }
    } finally {
      frame.remove();
    }
    return {
      states, stylesCopiedExactly, sourceStyleCount: sourceStyles.length,
      fixtureCountAfter: document.querySelectorAll('[data-visual-meteor-fixture]').length,
    };
  });
  meteorStates.push({ scenario: scenarioName, ...measurement });
  assert(`${scenarioName}: meteor check uses the loaded shell styles unchanged`,
    measurement.sourceStyleCount > 0 && measurement.stylesCopiedExactly);
  for (const state of measurement.states) {
    const label = `${scenarioName}: ${state.surface} ${state.depth} meteor`;
    assert(`${label} retains its radial head flash`,
      state.before.backgroundImage.includes('radial-gradient(') && !['none', 'normal'].includes(state.before.content) &&
        parseFloat(state.before.width) > 0 && parseFloat(state.before.height) > 0,
      JSON.stringify(state.before));
    assert(`${label} retains its linear trail glow`,
      state.after.backgroundImage.includes('linear-gradient(') && !['none', 'normal'].includes(state.after.content) &&
        parseFloat(state.after.height) > 0,
      JSON.stringify(state.after));
  }
  assert(`${scenarioName}: meteor fixtures are removed before screenshots`, measurement.fixtureCountAfter === 0);
};

await mkdir(outDir, { recursive: true });
const server = await startStaticTestServer();
const browser = await (useWebKit ? webkit : chromium).launch({
  headless: true,
  ...(!useWebKit && process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
});

try {
  for (const scenario of scenarios) {
    console.log(`[visual] ${useWebKit ? 'webkit' : 'chromium'} ${scenario.name}`);
    const context = await browser.newContext({
      viewport: scenario.viewport,
      isMobile: scenario.mobile,
      hasTouch: scenario.mobile,
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    if (meteorOnly) console.log('[visual] meteor context ready');
    const page = await context.newPage();
    if (meteorOnly) console.log('[visual] meteor page ready');
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route('**/assets/js/local-dev-refresh.js*', route => route.fulfill({
      contentType: 'application/javascript', body: '/* Workstation refresh is isolated in browser QA. */',
    }));
    await page.goto(`${server.baseUrl}/de/prays-list.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (meteorOnly) console.log('[visual] meteor document ready');
    await page.locator('body').evaluate((body, light) => body.classList.toggle('light', light), scenario.light);
    await checkMeteorPseudoElements(page, scenario.name);
    if (meteorOnly) console.log('[visual] meteor computed styles checked');
    if (meteorOnly) {
      assert(`${scenario.name}: meteor style check has no JavaScript errors`, pageErrors.length === 0,
        JSON.stringify(pageErrors));
      await context.close();
      completedScenarios.push(scenario.name);
      continue;
    }
    await page.addStyleTag({ url: `${server.baseUrl}/assets/css/ai-chat.css` });
    await page.addScriptTag({ url: `${server.baseUrl}/assets/js/ai-chat.js` });
    await page.waitForSelector('#hundesalon-ai-chat', { state: 'visible', timeout: 15000 });
    await page.locator('.cookie-consent').waitFor({ state: 'visible', timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.cookie-consent').evaluate(banner => Promise.all(banner.getAnimations().map(animation => animation.finished)));
    const consentButtons = await page.locator('[data-cookie-choice]').evaluateAll(buttons => buttons.map(button => {
      const rect = button.getBoundingClientRect();
      const points = [[rect.width / 2, rect.height / 2], [8, 8], [rect.width - 8, 8],
        [8, rect.height - 8], [rect.width - 8, rect.height - 8]];
      return {
        choice: button.dataset.cookieChoice,
        visible: rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= innerHeight,
        hits: points.map(([x, y]) => {
          const hit = document.elementFromPoint(rect.left + x, rect.top + y);
          return hit === button || button.contains(hit);
        }),
      };
    }));
    assert(`${scenario.name}: both consent choices accept input across their full area`,
      consentButtons.length === 2 && consentButtons.every(button => button.visible && button.hits.every(Boolean)),
      JSON.stringify(consentButtons));
    const consentScreenshot = path.join(outDir, `${scenario.name}-consent.png`);
    consentScreenshots.push(consentScreenshot);
    await page.screenshot({ path: consentScreenshot, fullPage: false, animations: 'disabled' });

    // A visitor can start booking before making a cookie choice.
    const pressRenderedControl = async control => {
      const point = await control.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const points = [[rect.width / 2, rect.height / 2], [8, 8], [rect.width - 8, 8],
          [8, rect.height - 8], [rect.width - 8, rect.height - 8]];
        const hits = points.map(([x, y]) => {
          const hit = document.elementFromPoint(rect.left + x, rect.top + y);
          return { ok: hit === element || element.contains(hit), target: hit && `${hit.tagName}.${hit.className}` };
        });
        const hittable = rect.width > 16 && rect.height > 16 && rect.top >= 0 && rect.bottom <= innerHeight
          && hits.every(hit => hit.ok);
        if (!hittable) throw new Error(`Control is obscured or outside the viewport: ${JSON.stringify({ text: element.textContent?.trim(), rect: { top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height }, hits })}`);
        window.__visualControlProbe = { clicked: false, before: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }, hits };
        window.addEventListener('click', event => {
          window.__visualControlProbe.clicked = event.composedPath().includes(element);
          window.__visualControlProbe.trusted = event.isTrusted;
          window.__visualControlProbe.target = `${event.target.tagName}.${event.target.className}`;
        }, { capture: true, once: true });
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      }).catch(async error => {
        await page.screenshot({ path: path.join(outDir, `${scenario.name}-control-hit-failure.png`) }).catch(() => {});
        throw error;
      });
      // Use native input at the current hit target, without forced clicks or a
      // WebKit automation scroll across the deliberately non-scrolling frame.
      if (scenario.mobile) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
      const probe = await page.evaluate(() => window.__visualControlProbe);
      assert(`${scenario.name}: native input reaches the intended control`, probe?.clicked && probe.trusted, JSON.stringify(probe));
    };
    const clickAboveConsent = async control => {
      // Header height changes after scrolling; align again once it settles.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await control.evaluate(element => {
          const root = document.querySelector('.site-scroll-root');
          const banner = document.querySelector('.cookie-consent')?.getBoundingClientRect();
          const header = document.querySelector('.header')?.getBoundingClientRect();
          const rect = element.getBoundingClientRect();
          const start = Math.max(0, header?.bottom || 0) + 16;
          const end = (banner?.top || innerHeight) - 16;
          const top = Math.max(start, start + (end - start - rect.height) / 2);
          root.scrollTo({ top: root.scrollTop + rect.top - top, behavior: 'instant' });
        });
        await page.waitForTimeout(350);
      }
      await pressRenderedControl(control);
    };
    const firstPriceCard = page.locator('[data-price-categories] .price-card:visible').first();
    const priceOpener = firstPriceCard.locator('[data-price-open]');
    await priceOpener.waitFor({ state: 'attached', timeout: 15000 });
    if (!(await priceOpener.isVisible())) await clickAboveConsent(firstPriceCard.locator('[data-price-card-toggle]'));
    await clickAboveConsent(priceOpener);
    const booking = page.locator('#booking-modal.active');
    await booking.waitFor({ state: 'visible', timeout: 15000 }).catch(async error => {
      const diagnostic = await page.evaluate(() => ({
        probe: window.__visualControlProbe,
        body: document.body.className,
        bookingExists: Boolean(document.querySelector('#booking-modal')),
        bookingClass: document.querySelector('#booking-modal')?.className,
        categoryClass: document.querySelector('#price-category-modal')?.className,
      }));
      await page.screenshot({ path: path.join(outDir, `${scenario.name}-booking-open-failure.png`) }).catch(() => {});
      throw new Error(`${scenario.name}: booking did not open: ${JSON.stringify({ ...diagnostic, pageErrors })}`, { cause: error });
    });
    assert(`${scenario.name}: pending consent does not cover the booking dialog`,
      !(await page.locator('.cookie-consent').isVisible()));
    assert(`${scenario.name}: floating help does not cover the booking dialog`,
      !(await page.locator('#hundesalon-ai-chat').isVisible()));
    const service = booking.locator('[data-price-modal-service-options] input[type="checkbox"]').first();
    if (!(await service.isChecked())) {
      const tile = service.locator('xpath=..');
      await tile.evaluate(element => {
        const panel = element.closest('.booking-step');
        const rect = element.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        panel.scrollTo({ top: panel.scrollTop + rect.top - panelRect.top - panelRect.height / 2 + rect.height / 2,
          behavior: 'instant' });
      });
      await pressRenderedControl(tile);
    }
    assert(`${scenario.name}: the visible service tile selects its checkbox`, await service.isChecked());
    const bookingFrame = await booking.evaluate(modal => {
      const frame = modal.querySelector('.price-booking-flow__content');
      const close = modal.querySelector('.modal-close');
      const rect = close?.getBoundingClientRect();
      const hit = rect && document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        scrollTop: frame?.scrollTop,
        closeRect: rect && { top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
        // The dialog can tilt: its projected rectangle is slightly smaller
        // than the 44px layout target. Keep viewport and hit checks strict.
        closeVisible: Boolean(rect && rect.top >= 0 && rect.bottom <= innerHeight && close.offsetWidth >= 44 && close.offsetHeight >= 44),
        closeHit: Boolean(close && (hit === close || close.contains(hit))),
      };
    });
    assert(`${scenario.name}: selecting a service keeps the dialog close control visible and clickable`,
      bookingFrame.scrollTop === 0 && bookingFrame.closeVisible && bookingFrame.closeHit, JSON.stringify(bookingFrame));
    const bookingScreenshot = path.join(outDir, `${scenario.name}-pending-consent-booking.png`);
    consentScreenshots.push(bookingScreenshot);
    await page.screenshot({ path: bookingScreenshot, fullPage: false, animations: 'disabled' });
    await pressRenderedControl(booking.locator('.modal-close'));
    await page.waitForFunction(() => !document.querySelector('#booking-modal')?.classList.contains('active'));
    assert(`${scenario.name}: closing booking restores the pending consent choice`,
      await page.locator('.cookie-consent').isVisible());
    assert(`${scenario.name}: closing booking restores floating help`,
      await page.locator('#hundesalon-ai-chat').isVisible());
    await page.locator('.site-scroll-root').evaluate(root => root.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForFunction(() => {
      const rect = document.querySelector('#theme-toggle')?.getBoundingClientRect();
      return rect && rect.top >= 0 && rect.bottom <= innerHeight;
    });
    await page.evaluate(() => {
      if (document.querySelector('sp-live-chat')) return;
      const sendPulseChat = document.createElement('sp-live-chat');
      sendPulseChat.dataset.visualRegressionFixture = 'true';
      sendPulseChat.style.cssText =
        'position:fixed;right:0;bottom:0;z-index:2147483646;display:block;width:12rem;height:8rem;';
      document.body.append(sendPulseChat);
    });
    await page.waitForSelector('.header .online-order-pill .nav-plasma--active', { timeout: 15000 });
    await page.evaluate(() => document.fonts.ready);

    const state = await page.evaluate(mobile => {
      const target = mobile
        ? document.querySelector('.header .online-order-pill .nav-plasma--active')
        : document.querySelector('.nav-main a[aria-current="page"] .nav-plasma--active');
      const targetRect = target?.getBoundingClientRect();
      const headerRect = document.querySelector('.header')?.getBoundingClientRect();
      const themeToggle = document.querySelector('#theme-toggle');
      const themeRect = themeToggle?.getBoundingClientRect();
      const themeHit = themeRect
        ? document.elementFromPoint(themeRect.left + themeRect.width / 2, themeRect.top + themeRect.height / 2)
        : null;
      const backgroundImage = target ? getComputedStyle(target, '::before').backgroundImage : '';
      return {
        backgroundImage,
        conicLayers: (backgroundImage.match(/conic-gradient\(/g) || []).length,
        headerHeight: headerRect?.height || 0,
        targetWidth: targetRect?.width || 0,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        themeVisible: Boolean(
          themeRect?.width > 0 &&
          themeRect.left >= 0 &&
          themeRect.right <= window.innerWidth &&
          themeRect.top >= 0 &&
          themeRect.bottom <= window.innerHeight
        ),
        themeHit: Boolean(themeToggle && (themeHit === themeToggle || themeToggle.contains(themeHit))),
      };
    }, scenario.mobile);

    assert(`${scenario.name}: plasma target rendered`, state.targetWidth > 0);
    assert(`${scenario.name}: two plasma conic layers`, state.conicLayers === 2, state.backgroundImage.slice(0, 180));
    assert(`${scenario.name}: header rendered`, state.headerHeight > 0);
    assert(`${scenario.name}: no horizontal overflow`, !state.overflowX);
    assert(`${scenario.name}: theme control remains inside the viewport`, state.themeVisible);
    assert(`${scenario.name}: theme control accepts pointer input`, state.themeHit);
    const initialLight = await page.locator('body').evaluate(body => body.classList.contains('light'));
    await pressRenderedControl(page.locator('#theme-toggle'));
    assert(
      `${scenario.name}: pointer click switches theme`,
      (await page.locator('body').evaluate(body => body.classList.contains('light'))) !== initialLight
    );
    await pressRenderedControl(page.locator('#theme-toggle'));
    assert(`${scenario.name}: a second native press restores the theme`,
      (await page.locator('body').evaluate(body => body.classList.contains('light'))) === initialLight);

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
    // Animation enumeration alone can precede the final rendered geometry.
    await page.evaluate(() => { window.__visualDrawerReadiness = null; });
    await page.waitForFunction(() => {
      const element = document.querySelector('#mobile-nav');
      if (!element?.classList.contains('active') || element.inert) {
        window.__visualDrawerReadiness = null;
        return false;
      }
      const box = element.getBoundingClientRect();
      const rect = { left: box.left, top: box.top, width: box.width, height: box.height };
      const animationsReady = element.getAnimations({ subtree: true }).filter(animation => !animation.effect?.pseudoElement).every(animation =>
        animation.effect?.getComputedTiming().iterations === Infinity || (!animation.pending && animation.playState !== 'running')
      );
      if (!animationsReady || Math.abs(rect.left - 12) > 1 || Math.abs(rect.width - Math.min(420, window.innerWidth - 24)) > 1) {
        window.__visualDrawerReadiness = null;
        return false;
      }
      const state = window.__visualDrawerReadiness;
      if (!state || Object.keys(rect).some(key => Math.abs(rect[key] - state.anchor[key]) > 0.25)) {
        window.__visualDrawerReadiness = { anchor: rect, stableSince: performance.now() };
        return false;
      }
      return performance.now() - state.stableSince >= 100;
    }, null, { timeout: 5000, polling: 'raf' }).catch(async error => {
      const diagnostic = await page.evaluate(() => {
        const nav = document.querySelector('#mobile-nav');
        const rect = nav?.getBoundingClientRect();
        const style = nav && getComputedStyle(nav);
        return { active: nav?.classList.contains('active'), inert: nav?.inert,
          rect: rect && { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
          transform: style?.transform, scale: style?.scale, translate: style?.translate, rotate: style?.rotate,
          readiness: window.__visualDrawerReadiness,
          animations: nav?.getAnimations({ subtree: true }).map(animation => ({
            name: animation.animationName, type: animation.constructor.name, pending: animation.pending,
            playState: animation.playState, currentTime: animation.currentTime,
            target: animation.effect?.target?.id || animation.effect?.target?.tagName,
            pseudoElement: animation.effect?.pseudoElement, infinite: animation.effect?.getComputedTiming().iterations === Infinity,
            progress: animation.effect?.getComputedTiming().progress,
          })) };
      });
      await writeFile(path.join(outDir, `${scenario.name}-drawer-readiness-failure.json`), JSON.stringify(diagnostic, null, 2));
      await page.screenshot({ path: path.join(outDir, `${scenario.name}-drawer-readiness-failure.png`), animations: 'allow' }).catch(() => {});
      throw new Error(`${scenario.name}: drawer never reached stable entrance geometry: ${JSON.stringify(diagnostic)}`, { cause: error });
    });

    const drawerState = await page.evaluate(() => {
      const nav = document.querySelector('#mobile-nav');
      const overlay = document.querySelector('#mobile-nav-overlay');
      const cookieConsent = document.querySelector('.cookie-consent');
      const aiChat = document.querySelector('#hundesalon-ai-chat');
      const sendPulseChat = document.querySelector('sp-live-chat');
      const rect = nav?.getBoundingClientRect();
      const viewportTop = window.visualViewport?.offsetTop || 0;
      const viewportBottom = viewportTop + (window.visualViewport?.height || window.innerHeight);
      const headerBottom = document.querySelector('.header')?.getBoundingClientRect().bottom || 0;
      const links = nav
        ? [...nav.querySelectorAll(':scope > .mobile-nav__content > .mobile-nav-group > a[href]')].filter(link => {
            const linkRect = link.getBoundingClientRect();
            return (
              linkRect.width > 0 && linkRect.height > 0 && linkRect.top >= rect.top && linkRect.bottom <= rect.bottom
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
        top: rect?.top ?? -1,
        bottom: rect?.bottom ?? -1,
        width: rect?.width ?? 0,
        height: rect?.height ?? 0,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        viewportTop,
        viewportBottom,
        headerBottom,
        overlayActive: Boolean(overlay?.classList.contains('active') && !overlay.hidden),
        bodyLocked: document.body.classList.contains('nav-open'),
        cookieSuppressed: !cookieConsent || getComputedStyle(cookieConsent).display === 'none',
        aiChatMounted: Boolean(aiChat),
        aiChatSuppressed: !aiChat || getComputedStyle(aiChat).display === 'none',
        sendPulseChatMounted: Boolean(sendPulseChat),
        sendPulseChatSuppressed: !sendPulseChat || getComputedStyle(sendPulseChat).display === 'none',
        visibleLinks: links.length,
        hitTestedLinks,
      };
    });

    assert(`${scenario.name}: drawer opens`, drawerState.active && drawerState.ariaHidden === 'false');
    assert(
      `${scenario.name}: drawer remains detached from the left edge`,
      Math.abs(drawerState.left - 12) <= 1,
      JSON.stringify(drawerState)
    );
    assert(
      `${scenario.name}: drawer remains a separate window`,
      Math.abs(drawerState.width - Math.min(420, drawerState.viewportWidth - 24)) <= 1 &&
        drawerState.right <= drawerState.viewportWidth - 11,
      JSON.stringify(drawerState)
    );
    assert(
      `${scenario.name}: drawer sits below the complete header`,
      Math.abs(drawerState.top - Math.max(drawerState.viewportTop, drawerState.headerBottom) - 10) <= 1,
      JSON.stringify(drawerState)
    );
    assert(
      `${scenario.name}: drawer stays inside the usable viewport`,
      drawerState.height > 0 && drawerState.bottom <= drawerState.viewportBottom - 9,
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
    assert(
      `${scenario.name}: drawer suppresses the AI assistant layer`,
      drawerState.aiChatMounted && drawerState.aiChatSuppressed,
      JSON.stringify(drawerState)
    );
    assert(
      `${scenario.name}: drawer suppresses the SendPulse live-chat layer`,
      drawerState.sendPulseChatMounted && drawerState.sendPulseChatSuppressed,
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
      const aiChat = document.querySelector('#hundesalon-ai-chat');
      const sendPulseChat = document.querySelector('sp-live-chat');
      const aiChatVisible = !aiChat || getComputedStyle(aiChat).display !== 'none';
      const sendPulseOwnedByAiChat =
        sendPulseChat?.getAttribute('data-hundesalon-ai-ready') === 'true' && aiChatVisible;
      return {
        closed: document.querySelector('#mobile-nav')?.getAttribute('aria-hidden') === 'true',
        bodyUnlocked: !document.body.classList.contains('nav-open'),
        cookieRestored: !cookieConsent || getComputedStyle(cookieConsent).display !== 'none',
        aiChatRestored: aiChatVisible,
        sendPulseChatRestored:
          !sendPulseChat || getComputedStyle(sendPulseChat).display !== 'none' || sendPulseOwnedByAiChat,
      };
    });
    assert(
      `${scenario.name}: outside pointer closes the drawer`,
      outsideCloseState.closed &&
        outsideCloseState.bodyUnlocked &&
        outsideCloseState.cookieRestored &&
        outsideCloseState.aiChatRestored &&
        outsideCloseState.sendPulseChatRestored,
      JSON.stringify(outsideCloseState)
    );

    await burger.click();
    await page.waitForSelector('#mobile-nav.active', { state: 'visible', timeout: 15000 });
    await page.waitForTimeout(500);

    const galleryState = await page.evaluate(() => {
      const checkedItems = [...document.querySelectorAll('#mobile-nav > .mobile-nav__content > .mobile-nav-group > a[href]')]
        .filter(item => !item.classList.contains('mobile-nav-link--promotions'));
      const details = checkedItems.map(item => {
        const rect = item.getBoundingClientRect();
        return {
          href: item.getAttribute('href'),
          width: rect.width,
          height: rect.height,
        };
      });

      return {
        flat: !document.querySelector('#mobileGalleryBtn, #mobileGalleryMenu'),
        gallery: checkedItems.some(item => new URL(item.href).pathname.endsWith('/galereya.html')),
        beforeAfter: checkedItems.some(item => new URL(item.href).pathname.endsWith('/do-i-posle.html')),
        checked: checkedItems.map(item => item.getAttribute('href')),
        details,
      };
    });

    assert(`${scenario.name}: both gallery destinations are direct links`, galleryState.flat && galleryState.gallery && galleryState.beforeAfter, JSON.stringify(galleryState));
    // Native subpixel bounds can differ slightly from the 44–48px CSS touch-target height.
    assert(
      `${scenario.name}: ordinary menu tiles share equal compact dimensions`,
      galleryState.checked.length === 14 && galleryState.details.every(item =>
        item.height >= 43.5 && item.height <= 48.5 && Math.abs(item.width - galleryState.details[0].width) <= 1 &&
        Math.abs(item.height - galleryState.details[0].height) <= 1),
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
      page.waitForURL(url => new URL(url).pathname !== originalPath, { waitUntil: 'domcontentloaded', timeout: 30000 }),
      links.nth(targetIndex).click({ noWaitAfter: true }),
    ]);
    assert(`${scenario.name}: drawer link navigation works`, new URL(page.url()).pathname !== originalPath, page.url());
    assert(`${scenario.name}: destination document keeps its language`, await page.locator('html').getAttribute('lang') === 'de');
    await context.close();
    completedScenarios.push(scenario.name);
  }
} catch (error) {
  failure = { name: error.name, message: error.message };
  throw error;
} finally {
  try {
    await writeFile(path.join(outDir, 'results.json'), JSON.stringify({
      ok: failure === null && completedScenarios.length === scenarios.length,
      plannedScenarios: scenarios.map(scenario => scenario.name),
      completedScenarios,
      engine: useWebKit ? 'webkit' : 'chromium',
      meteorOnly,
      meteorStates,
      results,
      error: failure,
    }, null, 2));
  } finally {
    try {
      await browser.close();
    } finally {
      await server.close();
    }
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      screenshots: (meteorOnly ? [] : scenarios.map(item => path.join(outDir, `${item.name}.png`)))
        .concat(drawerScreenshots, consentScreenshots),
      meteorStates,
      results,
    },
    null,
    2
  )
);
