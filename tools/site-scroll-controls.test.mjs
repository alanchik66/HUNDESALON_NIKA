import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'espree';

const main = readFileSync(new URL('../assets/js/main.js', import.meta.url), 'utf8');
const price = readFileSync(new URL('../assets/js/price-page.js', import.meta.url), 'utf8');
const sharedStyles = readFileSync(new URL('../assets/css/style.css', import.meta.url), 'utf8');
const pageStyles = readFileSync(new URL('../assets/css/page-modules.css', import.meta.url), 'utf8');
test('page scroll controls belong to the shared entry point, without price-page duplicates', () => {
  assert.equal((main.match(/scrollControls.className = 'price-scroll-controls'/g) || []).length, 1);
  assert.doesNotMatch(price, /scrollControls.className = 'price-scroll-controls'/);
  assert.match(main, /document.body.appendChild\(scrollControls\)/);
  assert.match(main, /button.dataset.priceScroll === 'top' \? 0 : scroller.scrollHeight/);
  for (const label of ['В начало страницы', 'На початок сторінки', 'Zum Seitenanfang', 'Back to top']) {
    assert.ok(main.includes(label));
  }
});

test('shared scroll controls do not depend on the optional page modules stylesheet', () => {
  const controlStyles = sharedStyles.match(/^\.price-scroll-controls\s*\{([^}]+)\}/m)?.[1];
  assert.ok(controlStyles, 'the stylesheet loaded by every page must position the shared controls');
  assert.match(controlStyles, /position:\s*fixed/);
  assert.match(controlStyles, /right:\s*max\(2px, env\(safe-area-inset-right\)\)/);
  assert.doesNotMatch(pageStyles, /(?:^|\n)\.price-scroll-controls\s*\{/);
});

test('scroll arrow clicks retain smooth movement when the system requests reduced motion', () => {
  const body = main.match(/scrollControls\.addEventListener\('click', event => \{([\s\S]*?)\n  \}\);/)[1];
  const calls = [];
  const scroller = { scrollHeight: 2400, scrollTo: options => calls.push(options) };
  const handleClick = new Function('event', 'document', 'window', body);
  for (const direction of ['top', 'bottom']) {
    handleClick(
      { target: { closest: () => ({ dataset: { priceScroll: direction } }) } },
      { querySelector: () => scroller },
      { matchMedia: () => ({ matches: true }) }
    );
  }
  assert.deepEqual(calls, [{ top: 0, behavior: 'smooth' }, { top: 2400, behavior: 'smooth' }]);
});

test('shared arrow activation keeps its configured turns and duration under reduced motion', () => {
  const controls = main.match(/  const siteArrowActivationAnimations = new WeakMap\(\);[\s\S]*?  const playSiteArrowActivation = \(control, state = \{\}\) => \{[\s\S]*?\n  \};/)[0];
  const animations = [];
  const arrow = {
    animate(frames, options) {
      const animation = { frames, options, addEventListener() {}, cancel() { this.cancelled = true; } };
      animations.push(animation);
      return animation;
    },
  };
  const values = { '--site-arrow-activation-duration': '1800ms', '--site-arrow-activation-turn-count': '3' };
  const play = new Function('document', 'getComputedStyle', 'window', 'prefersReducedMotion', `${controls}\nreturn playSiteArrowActivation;`)(
    { documentElement: {} },
    () => ({ getPropertyValue: name => values[name] || '' }),
    { matchMedia: () => ({ matches: true }) },
    true
  );
  const control = { dataset: {}, matches: () => false, querySelectorAll: () => [arrow] };
  play(control);
  assert.equal(animations.length, 1);
  assert.deepEqual(animations[0].frames, [{ rotate: '0deg' }, { rotate: '1080deg' }]);
  assert.equal(animations[0].options.duration, 1800);
  play(control);
  assert.equal(animations[0].cancelled, true, 'repeated activation must still replace the old animation');
  assert.equal(control.dataset.siteArrowActivationTurns, '3');
});

test('liquid scrollbar coalesces scroll and observer work without reading layout in events', () => {
  const start = main.indexOf('  const createLiquidScrollbar =');
  const end = main.indexOf('\n\n  window.HundesalonLiquidScrollbar =', start);
  assert.ok(start >= 0 && end > start);
  class Element {
    constructor() {
      this.dataset = {};
      this.listeners = new Map();
      this.classes = new Set();
      this.classList = {
        add: (...names) => names.forEach(name => this.classes.add(name)),
        remove: (...names) => names.forEach(name => this.classes.delete(name)),
        contains: name => this.classes.has(name),
      };
      this.style = { removeProperty: name => { delete this.style[name]; } };
      this.clientHeight = 500;
    }
    appendChild() {}
    addEventListener(type, callback) { this.listeners.set(type, callback); }
  }
  const reads = [];
  let scrollTop = 0;
  const scrollTarget = new Element();
  for (const [name, value] of [['scrollHeight', 2000], ['clientHeight', 500]]) {
    Object.defineProperty(scrollTarget, name, { get: () => { reads.push(name); return value; } });
  }
  Object.defineProperty(scrollTarget, 'scrollTop', { get: () => { reads.push('scrollTop'); return scrollTop; } });
  const document = { body: new Element(), createElement: () => new Element(), addEventListener() {} };
  const frames = [];
  let frameId = 0;
  const resizeCallbacks = [], mutationCallbacks = [], windowListeners = new Map();
  const ResizeObserver = class {
    constructor(callback) { resizeCallbacks.push(callback); }
    observe() {}
  };
  const MutationObserver = class {
    constructor(callback) { mutationCallbacks.push(callback); }
    observe() {}
  };
  const window = {
    ResizeObserver, MutationObserver,
    addEventListener: (type, callback) => windowListeners.set(type, callback),
  };
  const timers = new Map();
  let timerId = 0;
  const create = new Function('document', 'window', 'requestAnimationFrame', 'ResizeObserver', 'MutationObserver', 'setTimeout', 'clearTimeout',
    `${main.slice(start, end)}\nreturn createLiquidScrollbar;`)(
    document, window, callback => { frames.push(callback); return ++frameId; }, ResizeObserver, MutationObserver,
    (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; }, id => timers.delete(id)
  );
  const scrollbar = create({ scrollTarget, thumbParent: document.body });
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(scrollbar.thumb.style.height, '125px');
  assert.equal(scrollbar.thumb.style.top, '0px');
  reads.length = 0;

  scrollTop = 900;
  for (let count = 0; count < 20; count++) scrollTarget.listeners.get('scroll')();
  windowListeners.get('resize')();
  resizeCallbacks[0]();
  mutationCallbacks[0]();
  scrollbar.updateThumb();
  assert.deepEqual(reads, [], 'scroll events and observer callbacks must not force layout');
  assert.equal(frames.length, 1, 'all events before a paint share one frame');
  assert.equal(scrollbar.thumb.style.top, '0px', 'visual writes wait for that frame');
  assert.equal(scrollbar.thumb.classList.contains('scrolling'), false);
  assert.equal(timers.size, 0, 'scroll animation timers also wait for the frame');

  frames.shift()();
  assert.equal(reads.filter(name => name === 'scrollTop').length, 1);
  assert.equal(scrollbar.thumb.style.top, '225px');
  assert.equal(scrollbar.thumb.classList.contains('scrolling-down'), true);
  assert.equal(scrollbar.thumb.classList.contains('scrolling-up'), false);
  assert.equal(timers.size, 1);
  assert.equal([...timers.values()][0].delay, 1100);

  reads.length = 0;
  scrollTop = 300;
  for (let count = 0; count < 5; count++) scrollTarget.listeners.get('scroll')();
  assert.deepEqual(reads, []);
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(reads.filter(name => name === 'scrollTop').length, 1);
  assert.equal(scrollbar.thumb.style.top, '75px');
  assert.equal(scrollbar.thumb.classList.contains('scrolling-up'), true);
  assert.equal(scrollbar.thumb.classList.contains('scrolling-down'), false);
  assert.equal(timers.size, 1, 'the next scroll replaces its prior idle timer');
});

test('page scrolling preserves content offsets until an actual layout resize or load', () => {
  const ast = parse(main, { ecmaVersion: 'latest', sourceType: 'script' });
  const body = ast.body.find(node => node.expression?.arguments?.[0]?.value === 'DOMContentLoaded')?.expression.arguments[1].body.body;
  const declares = (node, name) => node.type === 'VariableDeclaration' && node.declarations.some(item => item.id.name === name);
  const layoutStart = body.findIndex(node => declares(node, 'syncPageLayout'));
  const layoutEnd = body.findIndex(node => node.expression?.callee?.name === 'syncPageLayout');
  const scrollStart = body.findIndex(node => declares(node, 'handleScroll'));
  const scrollEnd = body.findIndex(node => node.expression?.callee?.name === 'handleScroll');
  assert.ok(layoutEnd > layoutStart && scrollEnd > scrollStart);
  const layoutSource = main.slice(body[layoutStart].start, body[layoutEnd].end);
  const scrollSource = main.slice(body[scrollStart].start, body[scrollEnd].end);
  const windowListeners = new Map(), scrollListeners = new Map(), frames = [];
  let headerResize, observedHeader;
  let offsetSyncs = 0, scrollbarUpdates = 0, musicCloses = 0, socialCloses = 0;
  const header = {};
  const classes = new Set();
  const ResizeObserver = class {
    constructor(callback) { headerResize = callback; }
    observe(target) { observedHeader = target; }
  };
  const scrollRoot = { scrollTop: 0, addEventListener: (type, callback) => scrollListeners.set(type, callback) };
  const dependencies = {
    document: { querySelector: () => header, body: { classList: {
      add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name),
    } } },
    window: { innerWidth: 1440, ResizeObserver, addEventListener: (type, callback) => windowListeners.set(type, callback),
      requestAnimationFrame: callback => frames.push(callback) },
    ResizeObserver, scrollRoot, hero: null, socialBar: null, pageHeader: null,
    closeAllMusicUI() { musicCloses += 1; }, closeSocialIconsUI() { socialCloses += 1; },
    syncContentTopOffsets: () => { offsetSyncs += 1; },
    updatePageScrollbarOffset: () => { scrollbarUpdates += 1; },
  };
  new Function('dependencies', `
    const { ${Object.keys(dependencies).join(', ')} } = dependencies;
    let lastScroll = 0, ticking = false;
    const navProgressBar = null;
    ${layoutSource}
    ${scrollSource}
  `)(dependencies);
  assert.equal(offsetSyncs, 1, 'initial layout reserves the header footprint');
  assert.equal(observedHeader, header);
  offsetSyncs = 0;
  scrollbarUpdates = 0;

  scrollRoot.scrollTop = 300;
  for (let count = 0; count < 20; count++) scrollListeners.get('scroll')();
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(offsetSyncs, 0, 'scrolling must not measure and rewrite content clearance');
  assert.equal(scrollbarUpdates, 1, 'the scrollbar still follows scrolling');
  classes.add('hide-header');
  scrollRoot.scrollTop = 600;
  scrollListeners.get('scroll')();
  frames.shift()();
  assert.equal(musicCloses, 2, 'real open UI must still close when scrolling down with an already hidden header');
  assert.equal(socialCloses, 2);
  assert.equal(scrollbarUpdates, 2);

  windowListeners.get('resize')();
  windowListeners.get('load')();
  headerResize();
  assert.equal(offsetSyncs, 3, 'viewport size, load and native header ResizeObserver retain layout synchronization');
  assert.equal(scrollbarUpdates, 5);
});

test('queued page parallax keeps its last position while the navigation drawer is open and resumes afterwards', () => {
  const ast = parse(main, { ecmaVersion: 'latest', sourceType: 'script' });
  const body = ast.body.find(node => node.expression?.arguments?.[0]?.value === 'DOMContentLoaded')?.expression.arguments[1].body.body;
  const scrollStart = body.findIndex(node => node.type === 'VariableDeclaration' && node.declarations.some(item => item.id.name === 'handleScroll'));
  const scrollEnd = body.findIndex(node => node.expression?.callee?.name === 'handleScroll');
  assert.ok(scrollEnd > scrollStart);
  const scrollSource = main.slice(body[scrollStart].start, body[scrollEnd].end);
  const classes = new Set(), frames = [], listeners = new Map(), writes = [];
  const values = { transform: '', filter: '' };
  const style = Object.defineProperties({}, Object.fromEntries(Object.keys(values).map(property => [property, {
    get: () => values[property],
    set: value => { writes.push([property, value]); values[property] = value; },
  }])));
  let scrollbarUpdates = 0;
  const scrollRoot = { scrollTop: 0, addEventListener: (type, callback) => listeners.set(type, callback) };
  const dependencies = {
    document: { body: { classList: {
      add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name),
    } } },
    window: { innerWidth: 1440, requestAnimationFrame: callback => frames.push(callback) },
    scrollRoot, hero: { offsetHeight: 500, style }, socialBar: null, pageHeader: null,
    closeAllMusicUI() {}, closeSocialIconsUI() {},
    updatePageScrollbarOffset: () => { scrollbarUpdates += 1; },
  };
  new Function('dependencies', `
    const { ${Object.keys(dependencies).join(', ')} } = dependencies;
    let lastScroll = 0, ticking = false;
    const navProgressBar = null;
    ${scrollSource}
  `)(dependencies);
  writes.length = 0;
  scrollRoot.scrollTop = 40;
  listeners.get('scroll')();
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.deepEqual(values, { transform: 'translateY(6px)', filter: 'none' });
  assert.deepEqual(writes, [['transform', 'translateY(6px)'], ['filter', 'none']]);

  writes.length = 0;
  scrollbarUpdates = 0;
  scrollRoot.scrollTop = 90;
  listeners.get('scroll')();
  classes.add('nav-open'); // The drawer can open after native input queued this frame.
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.deepEqual(writes, [], 'a queued scroll frame must not move the locked background or reset its filter');
  assert.deepEqual(values, { transform: 'translateY(6px)', filter: 'none' }, 'locking preserves the existing parallax position');
  assert.equal(scrollbarUpdates, 1, 'the queued handler still completes its normal bookkeeping');

  classes.delete('nav-open');
  scrollRoot.scrollTop = 120;
  listeners.get('scroll')();
  assert.equal(frames.length, 1, 'the locked frame releases its ticking flag so later scrolling can resume');
  frames.shift()();
  assert.deepEqual(writes, [['transform', 'translateY(18px)'], ['filter', 'none']]);
  assert.equal(scrollbarUpdates, 2);
});

test('inertial wheel scrolling resumes from native positions without a scroll-event read', async t => {
  const ast = parse(main, { ecmaVersion: 'latest', sourceType: 'script' });
  const body = ast.body.find(node => node.expression?.arguments?.[0]?.value === 'DOMContentLoaded')?.expression.arguments[1].body.body;
  const declarations = ['normalizeWheelDelta', 'enableInertialScroll'].map(name => {
    const node = body.find(item => item.type === 'VariableDeclaration' && item.declarations.some(value => value.id.name === name));
    assert.ok(node, name);
    return main.slice(node.start, node.end);
  }).join('\n');
  for (const axis of ['y', 'x']) {
    await t.test(`${axis} axis: idle native movement is read once when wheel input begins`, () => {
      const listeners = new Map(), frames = new Map(), reads = [], writes = [];
      let position = 0, frameId = 0;
      const scrollKey = axis === 'y' ? 'scrollTop' : 'scrollLeft';
      const sizeKey = axis === 'y' ? 'scrollHeight' : 'scrollWidth';
      const clientKey = axis === 'y' ? 'clientHeight' : 'clientWidth';
      const target = { dataset: {}, addEventListener: (type, callback) => listeners.set(type, callback) };
      Object.defineProperty(target, scrollKey, {
        get: () => { reads.push(scrollKey); return position; },
        set: value => { position = value; writes.push(value); },
      });
      for (const [name, value] of [[sizeKey, 1000], [clientKey, 100]]) {
        Object.defineProperty(target, name, { get: () => { reads.push(name); return value; } });
      }
      class Element { closest() { return null; } }
      const document = { body: { classList: { contains: () => false } } };
      const window = { requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; } };
      const enable = new Function('hasFinePointer', 'scrollRoot', 'document', 'window', 'Element', 'WheelEvent',
        `${declarations}\nreturn enableInertialScroll;`)(
        true, axis === 'y' ? target : {}, document, window, Element, { DOM_DELTA_LINE: 1, DOM_DELTA_PAGE: 2 }
      );
      enable(target, { axis, intensity: 1, easing: .5, threshold: .1, maxStep: 200 });
      assert.deepEqual([...listeners.keys()], ['wheel'], 'native touch, keyboard and programmatic scroll events have no inertia listener');
      reads.length = 0;

      position = 400;
      for (let count = 0; count < 20; count++) listeners.get('scroll')?.();
      assert.deepEqual(reads, [], 'native movement while idle does not read layout');
      const wheel = (delta, overrides = {}) => {
        const event = {
          deltaX: axis === 'x' ? delta : 0, deltaY: axis === 'y' ? delta : 0,
          deltaMode: 0, target: new Element(), preventDefault() { this.defaultPrevented = true; }, ...overrides,
        };
        listeners.get('wheel')(event);
        return event;
      };
      const frame = () => {
        assert.equal(frames.size, 1);
        const [id, callback] = [...frames][0];
        frames.delete(id);
        callback();
      };
      if (axis === 'x') {
        assert.equal(wheel(0, { deltaY: 100 }).defaultPrevented, undefined, 'a vertical wheel does not hijack a horizontal panel');
        assert.deepEqual(reads, []);
      }
      assert.equal(wheel(100).defaultPrevented, true);
      assert.equal(reads.filter(name => name === scrollKey).length, 1, 'idle wheel input reads the actual offset once');
      assert.equal(reads.filter(name => name === sizeKey).length, 1);
      assert.equal(reads.filter(name => name === clientKey).length, 1, 'the maximum offset is measured once per wheel event');
      assert.deepEqual(writes, []);
      frame();
      assert.equal(position, 450, '400 + wheel 100 eases toward 500 without jumping toward the old zero');

      for (let count = 0; count < 5; count++) wheel(10000);
      assert.equal(frames.size, 1, 'continued input reuses the active animation');
      for (let count = 0; frames.size && count < 100; count++) frame();
      assert.equal(frames.size, 0);
      assert.equal(position, 900, 'accumulated targets clamp to the actual content end');
      assert.ok(writes.every(value => value >= 400 && value <= 900));
      assert.equal(wheel(100).defaultPrevented, undefined, 'outward wheel input at the end stays available to native scrolling');
      assert.equal(frames.size, 0);

      reads.length = 0;
      position = 250;
      listeners.get('scroll')?.();
      assert.deepEqual(reads, []);
      assert.equal(wheel(100, { ctrlKey: true }).defaultPrevented, undefined, 'browser zoom remains native');
      assert.equal(frames.size, 0);
      assert.deepEqual(reads, []);
      const keyboardFollowup = axis === 'x' ? { deltaX: 0, deltaY: 100, shiftKey: true } : {};
      wheel(100, keyboardFollowup);
      frame();
      assert.equal(position, 300, 'a later native position is the origin of the next gesture');
    });
  }
});

test('booking scroll lock replaces global input callbacks on repeated opens without unlocking the page', () => {
  const modules = readFileSync(new URL('../assets/js/page-modules.js', import.meta.url), 'utf8');
  const ast = parse(modules, { ecmaVersion: 'latest', sourceType: 'script' });
  const ready = ast.body.find(node => node.expression?.arguments?.[0]?.value === 'DOMContentLoaded');
  assert.ok(ready, 'page modules register their actual ready handler');
  const initializer = ready.expression.arguments[1].body.body.find(node => node.type === 'VariableDeclaration'
    && node.declarations.some(value => value.id.name === 'initBookingModal'));
  assert.ok(initializer, 'the actual booking initializer exists');
  const body = initializer.declarations.find(value => value.id.name === 'initBookingModal').init.body.body;
  const declarations = ['lockSiteScroll', 'unlockSiteScroll'].map(name => {
    const node = body.find(item => item.type === 'VariableDeclaration' && item.declarations.some(value => value.id.name === name));
    assert.ok(node, name);
    return modules.slice(node.start, node.end);
  }).join('\n');

  const createRegistry = () => {
    const callbacksByKey = new Map(), optionsByCallback = new WeakMap();
    const key = (type, options) => `${type}:${typeof options === 'boolean' ? options : Boolean(options?.capture)}`;
    return {
      addEventListener(type, callback, options) {
        const name = key(type, options);
        if (!callbacksByKey.has(name)) callbacksByKey.set(name, new Set());
        callbacksByKey.get(name).add(callback);
        optionsByCallback.set(callback, { capture: typeof options === 'boolean' ? options : Boolean(options?.capture), passive: options?.passive });
      },
      removeEventListener(type, callback, options) {
        callbacksByKey.get(key(type, options))?.delete(callback);
      },
      callbacks: (type, capture = false) => [...(callbacksByKey.get(key(type, capture)) || [])],
      optionsFor: callback => optionsByCallback.get(callback),
    };
  };
  const classRemovals = [];
  const classes = target => {
    const names = new Set();
    return {
      add: (...values) => values.forEach(value => names.add(value)),
      remove: (...values) => values.forEach(value => { classRemovals.push([target, value]); names.delete(value); }),
      contains: value => names.has(value),
    };
  };
  const scrollWrites = [];
  let offset = 640;
  const siteScrollRoot = { ...createRegistry(), classList: classes('root') };
  Object.defineProperty(siteScrollRoot, 'scrollTop', {
    get: () => offset,
    set: value => { scrollWrites.push(value); offset = value; },
  });
  const document = { ...createRegistry(), documentElement: { classList: classes('html') }, body: { classList: classes('body') } };
  const modal = { classList: classes('modal') };
  modal.classList.add('active');
  const { lockSiteScroll, unlockSiteScroll } = new Function('document', 'modal', 'siteScrollRoot', 'savedSiteScrollTop', `
    let wheelBlockHandler = null, touchBlockHandler = null, siteScrollRestoreHandler = null;
    ${declarations}
    return { lockSiteScroll, unlockSiteScroll };
  `)(document, modal, siteScrollRoot, offset);
  const assertInputCounts = expected => {
    for (const type of ['wheel', 'touchmove']) {
      assert.equal(document.callbacks(type, true).length, expected, `document ${type} capture listeners`);
      assert.equal(document.callbacks(type, false).length, 0, 'the lifecycle does not create bubble-phase blockers');
    }
  };

  lockSiteScroll();
  assertInputCounts(1);
  for (const type of ['wheel', 'touchmove']) {
    assert.deepEqual(document.optionsFor(document.callbacks(type, true)[0]), { capture: true, passive: false });
  }
  assert.equal(siteScrollRoot.callbacks('scroll').length, 1);
  lockSiteScroll();
  assertInputCounts(1);
  assert.equal(siteScrollRoot.callbacks('scroll').length, 1, 'relocking also retains exactly one scroll restore callback');
  assert.deepEqual(scrollWrites, [], 'relocking must not restore or change the current offset');
  assert.deepEqual(classRemovals, [], 'relocking must not briefly unlock any page element');
  assert.equal(siteScrollRoot.classList.contains('booking-scroll-locked'), true);
  for (const target of [document.documentElement, document.body]) assert.equal(target.classList.contains('booking-modal-open'), true);

  modal.classList.remove('active');
  unlockSiteScroll();
  assertInputCounts(0);
  assert.equal(siteScrollRoot.callbacks('scroll').length, 0);
  assert.deepEqual(scrollWrites, [640], 'closing retains the existing saved-position restoration');
  assert.equal(siteScrollRoot.classList.contains('booking-scroll-locked'), false);
  for (const target of [document.documentElement, document.body]) assert.equal(target.classList.contains('booking-modal-open'), false);
  unlockSiteScroll();
  assertInputCounts(0);

  modal.classList.add('active');
  lockSiteScroll();
  assertInputCounts(1);
  modal.classList.remove('active');
  unlockSiteScroll();
  assertInputCounts(0);
  assert.equal(siteScrollRoot.callbacks('scroll').length, 0);
});
