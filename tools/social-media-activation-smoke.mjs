import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import htmlhint from 'htmlhint';
import { chromium, webkit } from 'playwright';

import { startStaticTestServer } from './lib/static-test-server.mjs';

const providers = ['instagram', 'facebook', 'tiktok'];
const locales = ['de', 'en', 'ru', 'uk'];
const layouts = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'mobile', viewport: { width: 390, height: 844 }, mobile: true },
];
const useWebKit = process.argv.includes('--webkit');
if (process.argv.slice(2).some(argument => argument !== '--webkit')) {
  throw new Error('Usage: node tools/social-media-activation-smoke.mjs [--webkit]');
}
const select = (value, allowed, label) => {
  const requested = (value || '').split(',').map(item => item.trim()).filter(Boolean);
  if (requested.some(item => !allowed.includes(item))) throw new Error(`Unknown ${label}: ${requested.join(', ')}`);
  if (new Set(requested).size !== requested.length) throw new Error(`Duplicate ${label} filter values`);
  return requested.length ? requested : allowed;
};
const selectedLocales = select(process.env.SOCIAL_ACTIVATION_LOCALES, locales, 'locale');
const selectedLayouts = select(process.env.SOCIAL_ACTIVATION_LAYOUTS, layouts.map(layout => layout.name), 'layout');
const run = process.env.SOCIAL_ACTIVATION_RUN || 'latest';
if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/.test(run)) throw new Error('Invalid SOCIAL_ACTIVATION_RUN label');
const output = path.resolve('test-results', useWebKit ? 'social-media-activation-webkit' : 'social-media-activation', run);
const scenarios = selectedLocales.flatMap(locale => layouts.filter(layout => selectedLayouts.includes(layout.name))
  .map(layout => ({ locale, ...layout, id: `${useWebKit ? 'webkit' : 'chromium'}-${layout.name}-${locale}` })));
const defaultScenarioIds = new Set(locales.flatMap(locale => layouts.map(layout =>
  `${useWebKit ? 'webkit' : 'chromium'}-${layout.name}-${locale}`)));
const providerFor = value => {
  const hostname = new URL(value).hostname.toLowerCase();
  if (/(^|\.)(instagram\.com|cdninstagram\.com)$/.test(hostname)) return 'instagram';
  if (/(^|\.)(facebook\.com|facebook\.net|fbcdn\.net)$/.test(hostname)) return 'facebook';
  if (/(^|\.)(tiktok\.com|tiktokcdn\.com|tiktokcdn-us\.com|tiktokv\.com)$/.test(hostname)) return 'tiktok';
  return null;
};
const expectedFrame = (provider, original) => {
  const url = new URL(original);
  assert.equal(providerFor(original), provider, 'Original link belongs to its provider');
  if (provider === 'instagram') return `${url.href}embed/`;
  if (provider === 'facebook') return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url.href)}&show_text=false&width=360`;
  const id = url.pathname.split('/').filter(Boolean).at(-1);
  assert.match(id, /^\d+$/, 'TikTok original contains a video identifier');
  return `https://www.tiktok.com/player/v1/${id}?autoplay=0&rel=0`;
};

await mkdir(output, { recursive: true });
const results = [];
const sourceHashes = Object.fromEntries(await Promise.all(['assets/js/social-page.js', 'assets/css/social-page.css', 'assets/css/page-modules.css'].map(async filename =>
  [filename, createHash('sha256').update(await readFile(filename)).digest('hex')])));
const startedAt = new Date().toISOString();
const startup = { state: 'running', ok: false, startedAt, engine: useWebKit ? 'webkit' : 'chromium', run,
  planned: scenarios.map(scenario => scenario.id), sourceHashes, note: 'Recorded before browser launch; no case has passed yet.' };
await writeFile(path.join(output, 'startup.json'), `${JSON.stringify(startup, null, 2)}\n`);
// Invalidate an older same-label success before starting this run.
await writeFile(path.join(output, 'results.json'), `${JSON.stringify(startup, null, 2)}\n`);
let server;
let browser;
let fatal = null;
const cleanup = { browserClosed: false, serverClosed: false };

try {
  server = await startStaticTestServer();
  browser = await (useWebKit ? webkit : chromium).launch({
    headless: true,
    ...(!useWebKit && process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
  });
  for (const scenario of scenarios) {
    console.log(`[social-activation] ${scenario.id}`);
    const report = {
      id: scenario.id, locale: scenario.locale, viewport: scenario.viewport, status: 'running', sourceHashes,
      checks: [], nativeInputs: [], providerRequests: [], blockedWrites: [], pageErrors: [], snapshots: [],
      screenshots: [], contextClosed: false,
    };
    results.push(report);
    const check = (name, condition, detail = null) => {
      report.checks.push({ name, ok: Boolean(condition), detail });
      assert.ok(condition, `${scenario.id}: ${name}${detail ? `: ${JSON.stringify(detail)}` : ''}`);
    };
    const context = await browser.newContext({
      viewport: scenario.viewport, isMobile: scenario.mobile, hasTouch: scenario.mobile,
      serviceWorkers: 'block', reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    let phase = 'initial';
    page.on('pageerror', error => report.pageErrors.push({ message: error.message, stack: error.stack }));
    await page.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const provider = providerFor(url.href);
      if (provider) {
        // A real browser request reached interception. Never fabricate a successful provider response.
        report.providerRequests.push({ provider, url: url.href, method: request.method(), phase,
          navigation: request.isNavigationRequest(), outcome: 'aborted-after-request-intent', at: Date.now() });
        await route.abort('blockedbyclient');
      } else if (url.pathname === '/assets/js/local-dev-refresh.js') {
        await route.fulfill({ contentType: 'application/javascript', body: '/* Workstation refresh is isolated in browser QA. */' });
      } else if (!['GET', 'HEAD'].includes(request.method())) {
        report.blockedWrites.push({ url: url.href, method: request.method(), phase });
        await route.abort('blockedbyclient');
      } else if (url.origin !== server.baseUrl) {
        await route.abort('blockedbyclient');
      } else {
        await route.continue();
      }
    });

    const card = provider => page.locator(`.social-card--reel-carousel[data-social-network="${provider}"]`);
    const readCard = provider => card(provider).evaluate(element => {
      const frame = element.querySelector('.social-reel-frame');
      const placeholder = element.querySelector('.social-reel-placeholder');
      const activate = element.querySelector('[data-social-embed-action="activate"]');
      const disable = element.querySelector('[data-social-embed-action="disable"]');
      const original = element.querySelector('.social-reel-original');
      const logo = placeholder?.querySelector('img');
      const counter = element.querySelector('.social-reel-controls output')?.textContent.trim();
      const numbers = /^(\d+)\s*\/\s*(\d+)$/.exec(counter || '');
      const rect = node => {
        const box = node?.getBoundingClientRect();
        return box && { x: box.x, y: box.y, width: box.width, height: box.height };
      };
      const accessibleName = node => node?.getAttribute('aria-label') ||
        (node?.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean)
          .map(id => document.getElementById(id)?.textContent.trim() || '').join(' ') || node?.textContent.trim();
      return {
        provider: element.dataset.socialNetwork, active: element.dataset.socialEmbedActive,
        counter, index: numbers ? Number(numbers[1]) : null, total: numbers ? Number(numbers[2]) : null,
        frame: { count: element.querySelectorAll('.social-reel-frame').length, src: frame?.getAttribute('src'),
          srcdoc: frame?.getAttribute('srcdoc'), hidden: frame?.hidden, title: frame?.title, id: frame?.id, rect: rect(frame) },
        placeholder: { count: element.querySelectorAll('.social-reel-placeholder').length, hidden: placeholder?.hidden,
          display: placeholder && window.getComputedStyle(placeholder).display, text: placeholder?.textContent.trim(), rect: rect(placeholder) },
        logo: { src: logo?.src, complete: logo?.complete, naturalWidth: logo?.naturalWidth },
        activate: { name: accessibleName(activate), hidden: activate?.hidden, expanded: activate?.getAttribute('aria-expanded'),
          controls: activate?.getAttribute('aria-controls'), description: activate?.getAttribute('aria-describedby'), rect: rect(activate) },
        disable: { name: accessibleName(disable), hidden: disable?.hidden, controls: disable?.getAttribute('aria-controls'), rect: rect(disable) },
        masksHidden: [...element.querySelectorAll('.social-reel-mask')].every(mask => mask.hidden || window.getComputedStyle(mask).display === 'none'),
        original: { href: original?.href, target: original?.target, rel: original?.rel },
        focusedAction: element.contains(document.activeElement) ? document.activeElement?.dataset.socialEmbedAction || null : null,
      };
    });
    const readAll = async () => Object.fromEntries(await Promise.all(providers.map(async provider => [provider, await readCard(provider)])));
    const requestCounts = () => Object.fromEntries(providers.map(provider =>
      [provider, report.providerRequests.filter(request => request.provider === provider).length]));
    const assertNoProviderHints = async label => {
      const hints = await page.locator('link[href]').evaluateAll(links => links
        .filter(link => link.rel.toLowerCase().split(/\s+/).some(token =>
          ['preconnect', 'dns-prefetch', 'prefetch', 'preload', 'modulepreload', 'prerender'].includes(token)))
        .map(link => ({ rel: link.rel, href: link.href })));
      const providerHints = hints.filter(hint => providerFor(hint.href));
      check(`${label}: no provider resource or connection hints`, providerHints.length === 0, providerHints);
    };
    const assertInactive = (provider, state) => {
      check(`${provider}: local inactive state`, state.active === 'false' && state.frame.count === 1 && state.frame.hidden
        && state.frame.src === null && state.frame.srcdoc === null && state.placeholder.count === 1
        && !state.placeholder.hidden && state.placeholder.display !== 'none' && state.disable.hidden
        && state.activate.expanded === 'false' && state.masksHidden, state);
    };
    const snapshot = async label => {
      const cards = await readAll();
      report.snapshots.push({ phase: label, cards, requestCounts: requestCounts() });
      return cards;
    };
    const screenshot = async label => {
      const filename = path.join(output, `${scenario.id}-${label}.png`);
      await page.screenshot({ path: filename, fullPage: false });
      report.screenshots.push(filename);
    };
    const geometry = locator => locator.evaluate(element => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const radius = value => value.endsWith('%') ? parseFloat(value) * Math.min(rect.width, rect.height) / 100 : parseFloat(value);
      const round = Math.abs(rect.width - rect.height) < 2 && [style.borderTopLeftRadius, style.borderTopRightRadius,
        style.borderBottomLeftRadius, style.borderBottomRightRadius].every(value => radius(value) >= Math.min(rect.width, rect.height) / 2 - 1);
      const inset = Math.min(8, rect.width / 4, rect.height / 4);
      const points = round
        ? [[rect.width / 2, rect.height / 2], [rect.width / 2, inset], [rect.width - inset, rect.height / 2],
          [rect.width / 2, rect.height - inset], [inset, rect.height / 2]]
        : [[rect.width / 2, rect.height / 2], [inset, inset], [rect.width - inset, inset],
          [inset, rect.height - inset], [rect.width - inset, rect.height - inset]];
      const hits = points.map(([x, y]) => {
        const hit = document.elementFromPoint(rect.left + x, rect.top + y);
        return { x: rect.left + x, y: rect.top + y, ok: hit === element || element.contains(hit),
          target: hit && `${hit.tagName}#${hit.id}.${hit.className}` };
      });
      return { rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, round, hits,
        visible: rect.width > 16 && rect.height > 16 && rect.top >= 0 && rect.left >= 0
          && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth
          && style.visibility === 'visible' && style.display !== 'none' && !element.disabled };
    });
    const settleScroll = async locator => locator.evaluate(async element => {
      const root = document.querySelector('.site-scroll-root');
      let previous = null;
      let stable = 0;
      const deadline = performance.now() + 10000;
      while (performance.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const rect = element.getBoundingClientRect();
        const position = [root?.scrollTop || 0, root?.scrollLeft || 0, window.scrollX, window.scrollY,
          rect.x, rect.y, rect.width, rect.height];
        stable = previous && position.every((value, index) => Math.abs(value - previous[index]) <= 0.5) ? stable + 1 : 0;
        if (stable >= 3) return position;
        previous = position;
      }
      throw new Error('Social control alignment did not reach stable scrolling');
    });
    const align = async locator => {
      let last;
      for (const fraction of [0.3, 0.5, 0.7, 0.4]) {
        await locator.evaluate((element, bandFraction) => {
          const root = document.querySelector('.site-scroll-root');
          const rect = element.getBoundingClientRect();
          const header = document.querySelector('.header')?.getBoundingClientRect();
          const consent = document.querySelector('.cookie-consent');
          const consentRect = consent && window.getComputedStyle(consent).display !== 'none' ? consent.getBoundingClientRect() : null;
          const top = Math.max(0, Math.min(window.innerHeight, header?.bottom || 0)) + 20;
          const bottom = Math.min(window.innerHeight, consentRect?.height ? consentRect.top : window.innerHeight) - 20;
          const target = top + Math.max(0, bottom - top - rect.height) * bandFraction;
          if (root) root.scrollTo({ top: root.scrollTop + rect.top - target, behavior: 'instant' });
          else element.scrollIntoView({ block: 'center', behavior: 'instant' });
        }, fraction);
        await settleScroll(locator);
        last = await geometry(locator);
        if (last.visible && last.hits.every(hit => hit.ok)) return;
      }
      throw new Error(`Social control is obscured or outside the viewport: ${JSON.stringify(last)}`);
    };
    const press = async (locator, label, beforeNative) => {
      await align(locator);
      const measured = await geometry(locator);
      check(`${label}: rendered five-point target`, measured.visible && measured.hits.every(hit => hit.ok), measured);
      if (beforeNative) await beforeNative();
      const point = await locator.evaluate(element => {
        const rect = element.getBoundingClientRect();
        window.__socialActivationInput = { matched: false, trusted: false };
        window.addEventListener('click', event => {
          window.__socialActivationInput = { matched: event.composedPath().includes(element), trusted: event.isTrusted,
            target: `${event.target.tagName}#${event.target.id}.${event.target.className}` };
        }, { capture: true, once: true });
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      });
      phase = label;
      if (scenario.mobile) await page.touchscreen.tap(point.x, point.y);
      else await page.mouse.click(point.x, point.y);
      const input = await page.evaluate(() => window.__socialActivationInput);
      report.nativeInputs.push({ label, point, geometry: measured, ...input });
      check(`${label}: genuine input reaches the intended control`, input?.trusted && input.matched, input);
    };
    const waitIndex = (provider, index) => page.waitForFunction(({ network, expected }) => {
      const text = document.querySelector(`[data-social-network="${network}"] .social-reel-controls output`)?.textContent.trim();
      return Number(/^(\d+)\s*\//.exec(text || '')?.[1]) === expected;
    }, { network: provider, expected: index }, { timeout: 5000, polling: 100 });
    const assertRequestChange = async (before, provider, expectedUrl) => {
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline && report.providerRequests.length === Object.values(before).reduce((sum, count) => sum + count, 0)) {
        await page.waitForTimeout(100);
      }
      await page.waitForTimeout(100);
      const after = requestCounts();
      check(`${provider}: exactly one request intent and independent providers`, providers.every(network =>
        after[network] === before[network] + (network === provider ? 1 : 0)), { before, after });
      const latest = report.providerRequests.at(-1);
      check(`${provider}: exact iframe request intent`, latest?.provider === provider && latest.url === expectedUrl
        && latest.method === 'GET' && latest.navigation && latest.outcome === 'aborted-after-request-intent', latest);
    };

    try {
      const response = await page.goto(`${server.baseUrl}/${scenario.locale}/social.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const html = await response.body();
      report.htmlSha256 = createHash('sha256').update(html).digest('hex');
      const staticIframeSources = [];
      const parser = new htmlhint.HTMLParser();
      parser.addListener('tagstart', event => {
        if (event.tagName.toLowerCase() !== 'iframe') return;
        const attributes = event.attrs.filter(attribute => ['src', 'srcdoc'].includes(attribute.name.toLowerCase()));
        if (attributes.length) staticIframeSources.push({ line: event.line, col: event.col, attributes: attributes.map(attribute => attribute.name) });
      });
      parser.parse(html.toString('utf8'));
      check('Raw response HTML leaves iframe sources and inline documents to explicit activation', staticIframeSources.length === 0, staticIframeSources);
      check('HTML locale is preserved', await page.locator('html').getAttribute('lang') === scenario.locale);
      await page.waitForFunction(() => document.querySelectorAll('[data-social-network][data-social-embed-active="false"]').length === 3,
        null, { timeout: 15000, polling: 100 });
      await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 15000, polling: 100 });
      const initial = await snapshot('initial-inactive');
      for (const provider of providers) {
        const state = initial[provider];
        assertInactive(provider, state);
        check(`${provider}: local placeholder and accessible controls`, new URL(state.logo.src).origin === server.baseUrl
          && new URL(state.logo.src).pathname === `/assets/images/icons/${provider}.png`
          && state.placeholder.text.toLowerCase().includes(provider) && state.activate.name.toLowerCase().includes(provider)
          && state.disable.name.toLowerCase().includes(provider) && state.activate.controls === state.frame.id
          && state.disable.controls === state.frame.id && Boolean(state.activate.description)
          && state.original.target === '_blank' && ['noopener', 'noreferrer'].every(token => state.original.rel.split(/\s+/).includes(token)), state);
        check(`${provider}: counter and original are initialized`, state.index === 1 && state.total > 1
          && providerFor(state.original.href) === provider && state.frame.title.includes(`1 / ${state.total}`), state);
      }
      check('No provider request before activation', report.providerRequests.length === 0, report.providerRequests);
      await assertNoProviderHints('initial');
      await screenshot('initial-inactive');
      for (const provider of providers) {
        phase = `${provider}:inactive-alignment`;
        await align(card(provider).locator('[data-social-embed-action="activate"]'));
        await page.waitForFunction(network => {
          const image = document.querySelector(`[data-social-network="${network}"] .social-reel-placeholder img`);
          return image?.complete && image.naturalWidth > 0;
        }, provider, { timeout: 10000, polling: 100 });
        const original = (await readCard(provider)).original.href;
        await press(card(provider).locator('.social-reel-controls button').nth(1), `${provider}:inactive-next`);
        await waitIndex(provider, 2);
        const next = await readCard(provider);
        assertInactive(provider, next);
        check(`${provider}: inactive navigation updates the local original`, next.original.href !== original, next);
        await press(card(provider).locator('.social-reel-controls button').first(), `${provider}:inactive-previous`);
        await waitIndex(provider, 1);
        const previous = await readCard(provider);
        assertInactive(provider, previous);
        check(`${provider}: inactive previous restores original and title`, previous.original.href === original
          && previous.frame.title.includes(`1 / ${previous.total}`), previous);
        check(`${provider}: no provider request after scrolling and inactive navigation`, report.providerRequests.length === 0, report.providerRequests);
      }
      const necessary = page.locator('[data-cookie-choice="necessary"]');
      await necessary.waitFor({ state: 'visible', timeout: 15000 });
      await press(necessary, 'necessary-cookies');
      await page.locator('.cookie-consent').waitFor({ state: 'hidden', timeout: 5000 });
      await page.waitForTimeout(500);
      for (const provider of providers) assertInactive(provider, await readCard(provider));
      check('Necessary cookies do not activate any social provider', report.providerRequests.length === 0, report.providerRequests);
      await assertNoProviderHints('after inactive navigation and necessary cookies');
      await snapshot('after-necessary-cookies');

      for (const provider of providers) {
        console.log(`[social-activation] ${scenario.id} ${provider}`);
        const before = await readAll();
        const counts = requestCounts();
        const expectedUrl = expectedFrame(provider, before[provider].original.href);
        await press(card(provider).locator('[data-social-embed-action="activate"]'), `${provider}:activate`, () => {
          check(`${provider}: alignment does not itself activate a provider`, providers.every(network => requestCounts()[network] === counts[network]));
        });
        await page.waitForFunction(network => document.querySelector(`[data-social-network="${network}"]`)?.dataset.socialEmbedActive === 'true', provider);
        const active = await snapshot(`${provider}:active`);
        check(`${provider}: explicit activation has the correct visible iframe and focus`, active[provider].frame.src === expectedUrl
          && !active[provider].frame.hidden && active[provider].placeholder.hidden && !active[provider].disable.hidden
          && active[provider].activate.expanded === 'true' && active[provider].focusedAction === 'disable', active[provider]);
        check(`${provider}: activation leaves other cards inactive`, providers.filter(network => network !== provider).every(network =>
          active[network].active === before[network].active && active[network].frame.src === before[network].frame.src), active);
        await assertRequestChange(counts, provider, expectedUrl);
        if (provider === 'instagram') await screenshot('explicitly-activated-request-aborted');

        for (const [direction, expectedIndex, buttonIndex] of [['next', 2, 1], ['previous', 1, 0]]) {
          const prior = requestCounts();
          await press(card(provider).locator('.social-reel-controls button').nth(buttonIndex), `${provider}:active-${direction}`);
          await waitIndex(provider, expectedIndex);
          const navigated = await snapshot(`${provider}:active-${direction}`);
          const url = expectedFrame(provider, navigated[provider].original.href);
          check(`${provider}: active ${direction} updates counter, title and iframe`, navigated[provider].active === 'true'
            && navigated[provider].frame.src === url && navigated[provider].frame.title.includes(`${expectedIndex} / ${navigated[provider].total}`), navigated[provider]);
          await assertRequestChange(prior, provider, url);
        }
        const beforeDisable = requestCounts();
        await press(card(provider).locator('[data-social-embed-action="disable"]'), `${provider}:disable`);
        await page.waitForFunction(network => document.querySelector(`[data-social-network="${network}"]`)?.dataset.socialEmbedActive === 'false', provider);
        const disabled = await snapshot(`${provider}:disabled`);
        assertInactive(provider, disabled[provider]);
        check(`${provider}: deactivation returns focus to activation`, disabled[provider].focusedAction === 'activate', disabled[provider]);
        for (const [direction, expectedIndex, buttonIndex] of [['next', 2, 1], ['previous', 1, 0]]) {
          await press(card(provider).locator('.social-reel-controls button').nth(buttonIndex), `${provider}:disabled-${direction}`);
          await waitIndex(provider, expectedIndex);
          const navigated = await readCard(provider);
          assertInactive(provider, navigated);
          check(`${provider}: disabled ${direction} updates local original and title`,
            (direction === 'next' ? navigated.original.href !== disabled[provider].original.href
              : navigated.original.href === disabled[provider].original.href)
              && navigated.frame.title.includes(`${expectedIndex} / ${navigated.total}`), navigated);
        }
        await page.waitForTimeout(300);
        check(`${provider}: deactivation and inactive navigation make no provider requests`, providers.every(network =>
          requestCounts()[network] === beforeDisable[network]), { before: beforeDisable, after: requestCounts() });
      }
      await snapshot('final-inactive');
      await screenshot('final-inactive');
      check('No uncaught page errors', report.pageErrors.length === 0, report.pageErrors);
      check('Three explicit provider sessions produce exactly nine aborted iframe request intents', report.providerRequests.length === 9,
        report.providerRequests);
      report.status = 'pass';
    } catch (error) {
      report.status = 'fail';
      report.error = { name: error.name, message: error.message, stack: error.stack };
      await snapshot('failure').catch(snapshotError => { report.snapshotError = snapshotError.message; });
      await screenshot('failure').catch(screenshotError => { report.screenshotError = screenshotError.message; });
    } finally {
      try {
        await context.close();
        report.contextClosed = true;
      } catch (error) {
        report.cleanupError = error.message;
        report.status = 'fail';
      }
      await writeFile(path.join(output, `${scenario.id}.json`), `${JSON.stringify(report, null, 2)}\n`);
    }
    if (report.status !== 'pass') break;
  }
} catch (error) {
  fatal = { name: error.name, message: error.message, stack: error.stack };
} finally {
  try {
    if (browser) await browser.close();
    cleanup.browserClosed = true;
  } catch (error) {
    cleanup.browserError = error.message;
  }
  try {
    if (server) await server.close();
    cleanup.serverClosed = true;
  } catch (error) {
    cleanup.serverError = error.message;
  }
  const ok = !fatal && cleanup.browserClosed && cleanup.serverClosed && results.length === scenarios.length
    && results.every(result => result.status === 'pass' && result.contextClosed);
  const summary = {
    ok, state: ok ? 'completed-pass' : 'completed-fail', startedAt, completedAt: new Date().toISOString(),
    engine: useWebKit ? 'webkit' : 'chromium', run, planned: scenarios.map(scenario => scenario.id),
    completed: results.length, passed: results.filter(result => result.status === 'pass').length,
    fullDefaultMatrix: ok && results.length === defaultScenarioIds.size && new Set(results.map(result => result.id)).size === defaultScenarioIds.size
      && results.every(result => defaultScenarioIds.has(result.id)), sourceHashes, cleanup, fatal,
    scope: 'Local current site, genuine input and real intercepted provider request intents. Provider requests are deliberately aborted; no successful provider GET, playback, account or message-delivery claim.',
    isolation: 'Static helper does not inject production CSP. Non-local requests and non-GET/HEAD requests are aborted; workstation refresh is disabled. CSP admission is covered by separate middleware/provider checks. DOM connection hints are checked; raw DNS/TCP packets are not observed.',
    cases: results.map(result => ({ id: result.id, status: result.status, checks: result.checks.length,
      failedChecks: result.checks.filter(check => !check.ok), nativeInputs: result.nativeInputs.length,
      providerRequests: result.providerRequests.length, contextClosed: result.contextClosed, error: result.error,
      report: path.join(output, `${result.id}.json`) })),
  };
  await writeFile(path.join(output, 'results.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary));
  if (!ok) process.exitCode = 1;
}
