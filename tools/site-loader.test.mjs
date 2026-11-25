import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const source = readFileSync(new URL('../assets/js/site-loader.js', import.meta.url), 'utf8');
const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const { EventTarget } = globalThis;

class Element extends EventTarget {
  constructor(tagName = 'div') {
    super();
    const classes = new Set();
    this.classList = {
      add: name => classes.add(name),
      remove: name => classes.delete(name),
      contains: name => classes.has(name),
      toggle: (name, active) => active ? classes.add(name) : classes.delete(name),
    };
    this.dataset = {};
    this.tagName = tagName.toUpperCase();
    this.textContent = '';
    this.style = {};
    this.children = [];
    this.attributes = {};
  }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.append(child); }
  prepend(child) { this.children.unshift(child); }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  contains(element) { return this === element || this.children.some(child => child.contains(element)); }
  remove() { this.removed = true; }
}

function harness({ price = false, fonts, images = [], deferFrames = false, bodyExists = true, sessionStorage, pawScene, criticalAssets } = {}) {
  const timers = new Map();
  const frames = [];
  let timerId = 0;
  let now = 0;
  const root = new Element();
  root.lang = 'ru';
  const document = Object.assign(new EventTarget(), {
    documentElement: root,
    body: bodyExists ? new Element() : null,
    readyState: 'loading',
    hidden: false,
    images,
    fonts,
    createElement: tagName => new Element(tagName),
    querySelector: () => price ? {} : null,
    querySelectorAll: () => document.body?.children.filter(element => element.id === 'preloader' && !element.removed) || [],
  });
  const window = Object.assign(new EventTarget(), {
    innerWidth: 1280,
    innerHeight: 800,
    sessionStorage,
    NikaPawScene: pawScene === undefined ? { mount: () => ({ ready: Promise.resolve() }) } : pawScene,
    SiteShell: criticalAssets ? { prepareCriticalAssets: criticalAssets } : undefined,
    setTimeout: (fn, delay) => {
      const id = ++timerId;
      timers.set(id, { fn, delay, due: now + delay });
      return id;
    },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame: fn => deferFrames ? frames.push(fn) : fn(),
  });
  const context = { window, document, Promise };
  const listeners = { window: new Map(), document: new Map() };
  for (const [name, target] of Object.entries({ window, document })) {
    const add = target.addEventListener.bind(target);
    const remove = target.removeEventListener.bind(target);
    target.addEventListener = (type, callback, options) => {
      if (!listeners[name].has(type)) listeners[name].set(type, new Set());
      listeners[name].get(type).add(callback);
      add(type, callback, options);
    };
    target.removeEventListener = (type, callback, options) => {
      listeners[name].get(type)?.delete(callback);
      remove(type, callback, options);
    };
  }
  vm.runInNewContext(source, context);
  return {
    window, document, root, timers,
    listenerCount: (target, type) => listeners[target].get(type)?.size || 0,
    frame() { frames.splice(0).forEach(fn => fn()); },
    domReady() {
      document.readyState = 'interactive';
      document.dispatchEvent(new Event('DOMContentLoaded'));
    },
    timeout(delay) {
      const entry = [...timers.entries()].find(([, timer]) => timer.delay === delay);
      assert.ok(entry, `expected a ${delay}ms deadline`);
      timers.delete(entry[0]);
      entry[1].fn();
    },
    advance(milliseconds) {
      const target = now + milliseconds;
      let entry;
      while ((entry = [...timers.entries()].filter(([, timer]) => timer.due <= target).sort((a, b) => a[1].due - b[1].due)[0])) {
        timers.delete(entry[0]);
        now = entry[1].due;
        entry[1].fn();
      }
      now = target;
    },
  };
}

const flush = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };

test('entrance waits for the price render, fonts and critical image decode', async () => {
  let resolveFonts;
  let resolveDecode;
  let decoded = 0;
  const hero = Object.assign(new Element(), {
    complete: true,
    naturalWidth: 100,
    getBoundingClientRect: () => ({ width: 100, height: 100, top: 20, bottom: 120, left: 0, right: 100 }),
    decode: () => { decoded++; return new Promise(resolve => { resolveDecode = resolve; }); },
  });
  const offscreen = {
    getBoundingClientRect: () => ({ width: 100, height: 100, top: 1000, bottom: 1100, left: 0, right: 100 }),
    decode: () => { throw new Error('offscreen images must stay lazy'); },
  };
  const page = harness({ price: true, fonts: { ready: new Promise(resolve => { resolveFonts = resolve; }) }, images: [hero, offscreen] });
  assert.equal(page.root.classList.contains('site-loading'), true);
  page.domReady();
  await flush();
  assert.equal(decoded, 1);
  assert.equal(page.root.dataset.siteReady, undefined);
  page.root.dataset.priceReady = 'true';
  page.window.dispatchEvent(new Event('site:page-ready'));
  resolveFonts();
  await flush();
  assert.equal(page.root.dataset.siteReady, undefined);
  resolveDecode();
  await page.window.NikaSiteLoader.ready;
  assert.equal(page.root.dataset.siteReady, 'true');
  assert.equal(page.document.body.classList.contains('site-loaded'), true);
});

test('a missing page-ready event or broken resource cannot trap visitors', async () => {
  const page = harness({ price: true, fonts: { ready: new Promise(() => {}) } });
  page.domReady();
  page.timeout(15000);
  const result = await page.window.NikaSiteLoader.ready;
  assert.equal(result.reason, 'timeout');
  assert.equal(page.root.classList.contains('site-loading'), false);
  assert.equal(page.document.body.children[0].style.pointerEvents, 'none');
});

test('the first entrance is shared across routes in one session without declaring the cache complete', async () => {
  const stored = new Map();
  const sessionStorage = { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value) };
  const first = harness({ price: true, sessionStorage });
  assert.equal(first.window.NikaSiteLoader.active, true, 'a deep price URL can be the first entry');
  assert.equal(first.document.body.children.length, 1);
  first.timeout(15000);
  await first.window.NikaSiteLoader.ready;
  let prepared = 0;
  const next = harness({ sessionStorage, criticalAssets: () => { prepared++; return Promise.resolve(); } });
  assert.equal(next.window.NikaSiteLoader.active, false);
  assert.equal(next.document.body.children.length, 0, 'subsequent routes do not mount the entrance');
  assert.equal(next.root.classList.contains('site-loading'), false, 'navigation remains visible and interactive');
  next.domReady();
  await next.window.NikaSiteLoader.ready;
  assert.equal(prepared, 1, 'the current page still prepares its critical resources');
  assert.equal(next.document.body.classList.contains('site-loaded'), true);
  assert.deepEqual([...stored], [['nika:site-entrance:v1', 'shown']], 'the marker records presentation, never cache retention or page-specific versions');
});

test('restricted session storage cannot prevent the first entrance or fail-open', async () => {
  const sessionStorage = { getItem() { throw new Error('Storage denied'); } };
  const page = harness({ sessionStorage });
  assert.equal(page.window.NikaSiteLoader.active, true);
  page.domReady();
  await page.window.NikaSiteLoader.ready;
  assert.equal(page.root.dataset.siteReady, 'true');
});

test('the paw atlas and shared critical weather graph are awaited; the complete entrance is removed immediately', async () => {
  let releaseAtlas, releaseWeather;
  const steps = [];
  const pawScene = { mount(stage) {
    assert.equal(stage.className, 'site-loader__scene');
    steps.push('mount');
    return {
      ready: new Promise(resolve => { releaseAtlas = resolve; }),
      stop: () => steps.push('stop'),
      dispose: () => steps.push('dispose'),
    };
  } };
  const page = harness({ pawScene, criticalAssets: () => new Promise(resolve => { releaseWeather = resolve; }) });
  page.domReady();
  await flush();
  assert.equal(page.root.dataset.siteReady, undefined);
  releaseWeather();
  await flush();
  assert.equal(page.root.dataset.siteReady, undefined, 'the local paw atlas is still pending');
  releaseAtlas();
  await page.window.NikaSiteLoader.ready;
  assert.deepEqual(steps, ['mount', 'stop', 'dispose']);
  assert.equal(page.window.NikaSiteLoader.active, false);
  assert.equal(page.document.querySelectorAll('#preloader').length, 0);
  page.window.dispatchEvent(new Event('pagehide'));
  assert.deepEqual(steps, ['mount', 'stop', 'dispose'], 'a completed entrance does not restart or dispose twice');
});

test('a stuck atlas or weather import cannot extend the entrance deadline', async () => {
  let stopped = 0;
  const page = harness({
    pawScene: { mount: () => ({ ready: new Promise(() => {}), stop: () => { stopped++; } }) },
    criticalAssets: () => new Promise(() => {}),
  });
  page.domReady();
  await flush();
  page.timeout(15000);
  const result = await page.window.NikaSiteLoader.ready;
  assert.equal(result.reason, 'timeout');
  assert.equal(stopped, 1);
  assert.equal(page.root.classList.contains('site-loading'), false);
});

test('failed decorative setup and rejected critical warmup still release the page', async () => {
  const page = harness({
    pawScene: { mount() { throw new Error('Scene unavailable'); } },
    criticalAssets: () => Promise.reject(new Error('Offline')),
  });
  page.domReady();
  const result = await page.window.NikaSiteLoader.ready;
  assert.equal(result.reason, 'resource-error');
  assert.ok(result.failedResources.includes('entrance-scene'));
  assert.ok(result.failedResources.includes('weather-modules'));
  assert.equal(page.root.dataset.siteReady, 'true');
});

test('a false atlas readiness settles as a resource error without trapping the fallback footprints', async () => {
  const page = harness({ pawScene: { mount: () => ({ ready: Promise.resolve(false) }) } });
  page.domReady();
  const result = await page.window.NikaSiteLoader.ready;
  assert.equal(result.reason, 'resource-error');
  assert.ok(result.failedResources.includes('entrance-atlas'));
  assert.equal(page.root.dataset.siteReady, 'true');
});

test('false atlas readiness caused by stop cannot overwrite a completed skip or timeout', async t => {
  for (const reason of ['skip', 'timeout']) await t.test(reason, async () => {
    let releaseAtlas;
    const page = harness({ pawScene: { mount: () => ({
      ready: new Promise(resolve => { releaseAtlas = resolve; }),
      stop: () => releaseAtlas(false),
    }) } });
    page.domReady();
    if (reason === 'skip') page.window.NikaSiteLoader.finish();
    else page.advance(15000);
    const result = await page.window.NikaSiteLoader.ready;
    await flush();
    assert.equal(result.reason, reason);
    assert.equal(result.failedResources.includes('entrance-atlas'), false);
    assert.equal(page.root.dataset.siteReadyReason, reason);
  });
});

test('critical hero or high-priority images are decoded ahead of six visible header icons', async t => {
  for (const priority of ['hero', 'fetchpriority']) await t.test(priority, async () => {
    const decoded = [];
    let releaseCritical;
    const images = Array.from({ length: 7 }, (_, index) => Object.assign(new Element(), {
      complete: true,
      naturalWidth: 100,
      getBoundingClientRect: () => ({ width: 100, height: 100, top: 0, bottom: 100, left: 0, right: 100 }),
      decode: () => {
        decoded.push(index);
        return index === 6 ? new Promise(resolve => { releaseCritical = resolve; }) : Promise.resolve();
      },
    }));
    if (priority === 'hero') images[6].classList.add('hero-photo-img');
    else images[6].setAttribute('fetchpriority', 'high');
    const page = harness({ images });
    page.domReady();
    await flush();
    assert.equal(decoded.length, 6, 'decode work remains bounded');
    assert.ok(decoded.includes(6), 'the seventh DOM image is still included when it is critical');
    assert.equal(page.root.dataset.siteReady, undefined, 'the entrance waits for that critical decode');
    releaseCritical();
    await page.window.NikaSiteLoader.ready;
  });
});

test('critical images inserted by later DOMContentLoaded handlers are included', async () => {
  let decoded = 0;
  const page = harness({ deferFrames: true });
  page.domReady();
  page.document.images.push(Object.assign(new Element(), {
    complete: true,
    naturalWidth: 100,
    getBoundingClientRect: () => ({ width: 100, height: 100, top: 0, bottom: 100, left: 0, right: 100 }),
    decode: () => { decoded++; return Promise.resolve(); },
  }));
  assert.equal(decoded, 0, 'no viewport measurement during earlier DOM handlers');
  page.frame();
  await flush();
  assert.equal(decoded, 1, 'the completed shared shell is measured');
  page.frame();
  page.frame();
  await page.window.NikaSiteLoader.ready;
});

test('a deadline before body parsing still restores the late body readiness class', async () => {
  const page = harness({ bodyExists: false });
  page.timeout(15000);
  await page.window.NikaSiteLoader.ready;
  assert.equal(page.root.dataset.siteReady, 'true');
  assert.equal(page.document.body, null);
  page.document.body = new Element();
  page.domReady();
  assert.equal(page.document.body.classList.contains('site-loaded'), true);
  assert.equal(page.document.body.children.length, 0, 'the completed entrance never replays on the late body');
});

test('legacy overlays parsed after the early entrance cannot remain over the ready page', async () => {
  const page = harness();
  const legacy = new Element();
  legacy.id = 'preloader';
  page.document.body.append(legacy);
  page.domReady();
  await page.window.NikaSiteLoader.ready;
  assert.equal(legacy.removed, true);
  assert.equal(page.document.body.children[0].style.pointerEvents, 'none');
});

test('the lifecycle API can finish immediately and a restored document never replays the entrance', async () => {
  const page = harness({ price: true });
  const overlay = page.document.body.children[0];
  page.window.NikaSiteLoader.finish('skip');
  assert.equal(overlay.removed, true, 'service cleanup removes the overlay synchronously');
  const result = await page.window.NikaSiteLoader.ready;
  assert.equal(result.reason, 'skip');
  const restored = new Event('pageshow');
  Object.defineProperty(restored, 'persisted', { value: true });
  page.window.dispatchEvent(restored);
  assert.equal(overlay.removed, true);
  assert.equal(page.root.classList.contains('site-loading'), false);
});

test('the entrance shows only the decorative scene, with no text or controls and a screen-reader status', async () => {
  const page = harness({ price: true });
  const overlay = page.document.body.children[0];
  assert.equal(overlay.getAttribute('role'), 'status');
  assert.equal(overlay.getAttribute('aria-label'), 'Загружаем сайт');
  assert.equal(overlay.children.length, 1);
  const stage = overlay.children[0];
  assert.equal(stage.className, 'site-loader__scene');
  assert.equal(stage.getAttribute('aria-hidden'), 'true');
  const descendants = element => [element, ...element.children.flatMap(descendants)];
  assert.ok(descendants(overlay).every(node => node.textContent.trim() === ''), 'no brand, caption or other visible text is inserted');
  assert.ok(descendants(overlay).every(node => !['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(node.tagName)), 'the loader has no interactive control');
  page.window.NikaSiteLoader.finish('skip');
  await page.window.NikaSiteLoader.ready;
  assert.equal(overlay.getAttribute('inert'), '');
  assert.equal(overlay.getAttribute('aria-hidden'), 'true');
  assert.equal(page.root.classList.contains('site-loading'), false);
  assert.equal(overlay.style.pointerEvents, 'none');
  assert.equal(overlay.removed, true, 'no empty entrance shell waits for another timer');
});

test('automatic readiness synchronously removes the overlay before page unhide and ready observers', async () => {
  const steps = [];
  let stopCalls = 0, disposeCalls = 0;
  const page = harness({ pawScene: { mount: () => ({ ready: Promise.resolve(true),
    stop: () => { stopCalls++; steps.push('stop'); },
    dispose: () => { disposeCalls++; steps.push('dispose'); },
  }) } });
  const overlay = page.document.body.children[0];
  const removeOverlay = overlay.remove.bind(overlay);
  overlay.remove = () => {
    assert.equal(page.root.classList.contains('site-loading'), true, 'renderers are still paused while the entrance is removed');
    assert.equal(overlay.getAttribute('inert'), '');
    assert.equal(overlay.getAttribute('aria-hidden'), 'true');
    assert.equal(overlay.style.pointerEvents, 'none');
    steps.push('remove'); removeOverlay();
  };
  const removeClass = page.root.classList.remove;
  page.root.classList.remove = name => {
    if (name === 'site-loading') {
      assert.equal(overlay.removed, true);
      assert.equal(stopCalls, 1);
      assert.equal(disposeCalls, 1);
      steps.push('unhide');
    }
    removeClass(name);
  };
  const observed = page.window.NikaSiteLoader.ready.then(result => {
    assert.equal(result.reason, 'ready');
    assert.equal(page.document.querySelectorAll('#preloader').length, 0);
    assert.equal(page.document.body.classList.contains('site-loaded'), true);
    steps.push('ready');
  });
  page.domReady();
  await observed;
  assert.deepEqual(steps, ['stop', 'dispose', 'remove', 'unhide', 'ready']);
  page.window.NikaSiteLoader.finish('skip');
  const restored = new Event('pageshow');
  Object.defineProperty(restored, 'persisted', { value: true });
  page.window.dispatchEvent(restored);
  assert.equal(stopCalls, 1);
  assert.equal(disposeCalls, 1);
  assert.equal(page.timers.size, 0, 'there is no cosmetic removal timer left to be delayed by renderer initialization');
});

test('automatic dismissal preserves focus outside the entrance', async () => {
  const page = harness({ price: true });
  const focused = new Element();
  let blurCalls = 0;
  focused.blur = () => { blurCalls++; };
  page.document.activeElement = focused;
  page.window.NikaSiteLoader.finish();
  await page.window.NikaSiteLoader.ready;
  assert.equal(page.document.activeElement, focused);
  assert.equal(blurCalls, 0);
});

test('loading hides background focus targets including explicit-visible descendants without removing their layout', () => {
  const css = postcss.parse(readFileSync(new URL('../assets/css/site-loader.css', import.meta.url), 'utf8'));
  const guarded = [];
  css.walkRules(rule => {
    if (rule.nodes.some(node => node.type === 'decl' && node.prop === 'visibility' && node.value === 'hidden' && node.important)) guarded.push(rule);
  });
  const rule = guarded.find(candidate => candidate.selector.includes('html.site-loading body > :not(#preloader) *'));
  assert.ok(rule, 'an inherited hidden value alone can be overridden by a visible child');
  const selectors = rule.selector.split(',').map(selector => selector.trim());
  assert.ok(selectors.includes('html.site-loading body > :not(#preloader)'));
  assert.ok(selectors.includes('html.site-loading body > :not(#preloader) *'));
  assert.ok(selectors.includes('html.site-loading body > :not(#preloader) *::before'));
  assert.ok(selectors.includes('html.site-loading body > :not(#preloader) *::after'));
  rule.walkDecls(declaration => {
    assert.ok(['visibility', 'animation-play-state'].includes(declaration.prop), 'background geometry and critical image bounds must remain intact');
  });
});

test('cached price readiness and browsers without optional APIs open without a fixed minimum delay', async () => {
  const page = harness({ price: true });
  page.root.dataset.priceReady = 'true';
  page.domReady();
  await page.window.NikaSiteLoader.ready;
  assert.equal(page.root.dataset.siteReady, 'true');
  assert.equal([...page.timers.values()].some(timer => timer.delay === 15000), false);
});

test('slow first-visit resources remain pending after ten seconds and open only on actual completion', async () => {
  let releaseFonts, releaseImage, releaseWeather, releaseAtlas;
  const image = Object.assign(new Element(), {
    complete: true, naturalWidth: 100,
    getBoundingClientRect: () => ({ width: 100, height: 100, top: 0, bottom: 100, left: 0, right: 100 }),
    decode: () => new Promise(resolve => { releaseImage = resolve; }),
  });
  const page = harness({
    price: true,
    fonts: { ready: new Promise(resolve => { releaseFonts = resolve; }) },
    images: [image],
    pawScene: { mount: () => ({ ready: new Promise(resolve => { releaseAtlas = resolve; }) }) },
    criticalAssets: () => new Promise(resolve => { releaseWeather = resolve; }),
  });
  page.domReady();
  await flush();
  page.advance(10000);
  await flush();
  assert.equal(page.root.dataset.siteReady, undefined, 'none of the former 1600/1800/4200/5000ms limits can claim success');
  releaseFonts(); releaseImage(); releaseWeather(); releaseAtlas();
  await flush();
  assert.equal(page.root.dataset.siteReady, undefined, 'the actual price render is still pending');
  page.root.dataset.priceReady = 'true';
  page.window.dispatchEvent(new Event('site:page-ready'));
  const result = await page.window.NikaSiteLoader.ready;
  assert.equal(result.reason, 'ready');
  assert.equal(result.failedResources.length, 0);
  assert.equal(page.root.dataset.siteReadyReason, 'ready');
});

test('the emergency watchdog releases at fifteen seconds and late completion cannot change its outcome', async () => {
  let releaseFonts;
  const page = harness({ fonts: { ready: new Promise(resolve => { releaseFonts = resolve; }) } });
  page.domReady();
  await flush();
  page.advance(14999);
  assert.equal(page.root.dataset.siteReady, undefined);
  page.advance(1);
  const result = await page.window.NikaSiteLoader.ready;
  assert.equal(result.reason, 'timeout');
  assert.equal(page.root.dataset.siteReadyReason, 'timeout');
  releaseFonts();
  await flush();
  assert.equal(page.root.dataset.siteReadyReason, 'timeout');
});

test('actual image and font failures settle gracefully with a resource-error result', async () => {
  const image = Object.assign(new Element(), {
    complete: false, naturalWidth: 0,
    getBoundingClientRect: () => ({ width: 100, height: 100, top: 0, bottom: 100, left: 0, right: 100 }),
  });
  const page = harness({ images: [image], fonts: { ready: Promise.reject(new Error('Font unavailable')) } });
  page.domReady();
  await flush();
  assert.equal(page.root.dataset.siteReady, undefined);
  image.dispatchEvent(new Event('error'));
  const result = await page.window.NikaSiteLoader.ready;
  assert.equal(result.reason, 'resource-error');
  assert.ok(result.failedResources.includes('fonts'));
  assert.ok(result.failedResources.includes('critical-image'));
});

test('each mandatory price script failure settles before the watchdog and removes its readiness listeners', async t => {
  for (const file of ['price-page.js', 'price-page-data.js', 'price-booking.js']) {
    for (const mode of ['network', 'runtime']) for (const beforeDom of [true, false]) await t.test(`${file}: ${mode}, ${beforeDom ? 'before' : 'after'} DOMContentLoaded`, async () => {
    const page = harness({ price: true });
    if (!beforeDom) page.domReady();
    const error = new Event('error');
    const url = `https://example.test/assets/js/${file}?v=revision`;
    if (mode === 'network') {
      Object.defineProperty(error, 'target', { value: { src: url } });
      page.document.dispatchEvent(error);
    } else {
      Object.defineProperty(error, 'filename', { value: url });
      page.window.dispatchEvent(error);
    }
    if (beforeDom) page.domReady();
    const result = await page.window.NikaSiteLoader.ready;
    assert.equal(result.reason, 'resource-error');
    assert.ok(result.failedResources.includes('price-page'));
    assert.equal(page.root.dataset.priceReady, undefined);
    assert.equal(page.listenerCount('window', 'site:page-ready'), 0);
    assert.equal(page.listenerCount('window', 'error'), 0);
    assert.equal(page.listenerCount('document', 'error'), 0);
    assert.equal([...page.timers.values()].some(timer => timer.delay === 15000), false);
  });
  }
});

test('unrelated or optional catalog errors do not fabricate completion of a still-pending price render', async () => {
  const page = harness({ price: true });
  page.domReady();
  for (const file of ['price-catalog.js', 'price-page-locales.js', 'unrelated.js']) {
    const error = new Event('error');
    Object.defineProperty(error, 'filename', { value: `https://example.test/assets/js/${file}` });
    page.window.dispatchEvent(error);
  }
  await flush();
  assert.equal(page.root.dataset.siteReady, undefined);
  page.root.dataset.priceReady = 'true';
  page.window.dispatchEvent(new Event('site:page-ready'));
  const result = await page.window.NikaSiteLoader.ready;
  assert.equal(result.reason, 'ready');
});

test('production adds versioned loader before page assets and keeps isolated documents unchanged', t => {
  const fixtureRoot = path.join(projectRoot, 'output');
  mkdirSync(fixtureRoot, { recursive: true });
  const directory = mkdtempSync(path.join(fixtureRoot, 'site-loader-test-'));
  t.after(() => {
    assert.equal(path.dirname(directory), fixtureRoot);
    assert.ok(path.basename(directory).startsWith('site-loader-test-'));
    rmSync(directory, { recursive: true, force: true });
  });
  const page = '<!doctype html><html><head><title>Nika</title></head><body><div id="preloader"><div class="loader"></div></div><main>Public page content</main><script src="../assets/js/main.js?v=old"></script></body></html>';
  const isolated = '<!doctype html><html><head><title>Map</title></head><body>Map</body></html>';
  mkdirSync(path.join(directory, 'ru'));
  writeFileSync(path.join(directory, 'ru', 'index.html'), page);
  writeFileSync(path.join(directory, 'map.html'), isolated);
  const build = readFileSync(new URL('./build-production.js', import.meta.url), 'utf8');
  const start = build.indexOf('function injectSiteLoader(');
  const end = build.indexOf('\nconst assetVersion =', start);
  assert.ok(start >= 0 && end > start);
  const inject = new Function('fs', 'path', `${build.slice(start, end)}\nreturn injectSiteLoader;`)(fs, path);
  assert.equal(inject(directory, 'test-version'), 1);
  const result = readFileSync(path.join(directory, 'ru', 'index.html'), 'utf8');
  assert.ok(result.indexOf('site-loader.js?v=test-version') < result.indexOf('<title>'));
  assert.ok(result.indexOf('paw-loader-scene.js?v=test-version') < result.indexOf('/js/site-loader.js?v=test-version'), 'the classic scene dependency executes before the entrance');
  assert.match(result, /site-loader\.css\?v=test-version/);
  assert.doesNotMatch(result, /id="preloader"/);
  assert.match(result, /<main>Public page content<\/main>/);
  assert.equal(readFileSync(path.join(directory, 'map.html'), 'utf8'), isolated);
  assert.equal(inject(directory, 'test-version'), 0, 'injection is idempotent');
});

test('source previews insert version-matched classic dependencies in execution order exactly once', () => {
  const pwa = readFileSync(new URL('../assets/js/pwa.js', import.meta.url), 'utf8');
  const head = new Element();
  const document = {
    head,
    currentScript: { src: 'http://localhost:5502/assets/js/pwa.js?v=source-page-version' },
    baseURI: 'http://localhost:5502/ru/',
    createElement: () => new Element(),
    querySelector: selector => head.children.find(element => selector.includes('/site-loader.js') && element.src?.includes('/site-loader.js')),
  };
  const context = { window: {}, document, navigator: {}, URL, location: { href: document.baseURI } };
  vm.runInNewContext(pwa, context);
  assert.equal(head.children[0].href, 'http://localhost:5502/assets/css/site-loader.css?v=source-page-version');
  const scripts = head.children.filter(element => element.src);
  assert.deepEqual(scripts.map(element => new URL(element.src).pathname), ['/assets/js/paw-loader-scene.js', '/assets/js/site-loader.js']);
  assert.ok(scripts.every(element => element.async === false && new URL(element.src).search === '?v=source-page-version'));
  vm.runInNewContext(pwa, context);
  assert.equal(head.children.length, 3);
});

function criticalWeatherHarness(api, meteorModules = () => Promise.resolve()) {
  const shell = readFileSync(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8');
  const start = shell.indexOf('  function loadHeaderWeatherWidgetLoader(');
  const end = shell.indexOf('  function enhanceHeaderWeatherCloudRenderer(', start);
  assert.ok(start > 0 && end > start);
  const head = new Element();
  const host = { dataset: { widgetSrc: '/3d-weather-codrops-main/dist-widget/weather-widget.iife.js?v=test-version' } };
  const document = {
    head,
    createElement: () => new Element(),
    querySelector: () => head.children.find(element => !element.removed),
  };
  const window = { Weather3DWidget: api };
  const context = { window, document, getHeaderWeatherHost: () => host, loadHeaderWeatherMeteorModules: meteorModules, Promise };
  vm.runInNewContext(`let headerWeatherLoaderPromise = null;\n${shell.slice(start, end)}\nwindow.prepare = prepareCriticalAssets;`, context);
  return { window, document };
}

test('critical weather warmup reuses one common scene import without mounting or fetching weather', async () => {
  let imports = 0, sceneImports = 0, releaseScene, releaseMeteors, meteorImports = 0, settled = false;
  const page = criticalWeatherHarness({
    load: async () => { imports++; return { preloadScene: () => { sceneImports++; return new Promise(resolve => { releaseScene = resolve; }); } }; },
    mountWeatherWidget() { assert.fail('warmup must not create another widget or controller'); },
  }, () => { meteorImports++; return new Promise(resolve => { releaseMeteors = resolve; }); });
  const first = page.window.prepare();
  first.then(() => { settled = true; });
  assert.equal(first, page.window.prepare());
  await flush();
  assert.equal(imports, 1);
  assert.equal(sceneImports, 1);
  assert.equal(meteorImports, 1);
  assert.equal(page.document.head.children.length, 0, 'an existing widget API is reused');
  releaseScene();
  await flush();
  assert.equal(settled, false, 'the transition to local weather starfall waits for its own small module graph');
  releaseMeteors();
  await first;
  await page.window.prepare();
  assert.equal(sceneImports, 1);
  assert.equal(meteorImports, 1);
});

test('a failed meteor module warmup can retry instead of being retained as critical readiness', async () => {
  let attempts = 0;
  const page = criticalWeatherHarness({ load: async () => ({ preloadScene: async () => {} }) },
    () => ++attempts === 1 ? Promise.reject(new Error('Meteor module offline')) : Promise.resolve());
  await assert.rejects(page.window.prepare(), /Meteor module offline/);
  await page.window.prepare();
  assert.equal(attempts, 2);
});

test('failed scene warmup can recover and a failed classic loader is removed before retry', async () => {
  let attempts = 0;
  const warm = criticalWeatherHarness({ load: async () => ({ preloadScene: () => ++attempts === 1 ? Promise.reject(new Error('Offline')) : Promise.resolve() }) });
  await assert.rejects(warm.window.prepare(), /Offline/);
  await warm.window.prepare();
  assert.equal(attempts, 2);
  const classic = criticalWeatherHarness();
  const first = classic.window.prepare();
  const failed = classic.document.head.children[0];
  failed.onerror();
  await assert.rejects(first, /Failed to load weather/);
  assert.equal(failed.removed, true);
  const second = classic.window.prepare();
  assert.equal(classic.document.head.children.length, 2);
  classic.window.Weather3DWidget = { load: async () => ({ preloadScene: async () => {} }) };
  classic.document.head.children[1].onload();
  await second;
});
