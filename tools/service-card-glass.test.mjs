import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import postcss from 'postcss';

const script = readFileSync(new URL('../assets/js/service-card-glass.js', import.meta.url), 'utf8');
const stylesheet = postcss.parse(readFileSync(new URL('../assets/css/style.css', import.meta.url), 'utf8'));
const preferenceNames = ['prefers-reduced-motion', 'prefers-reduced-transparency', 'prefers-contrast', 'forced-colors'];

test('homepage and services pages in every locale connect one shared glass material after the legacy styles', async t => {
  for (const locale of ['de', 'en', 'ru', 'uk']) {
    for (const [page, cardCount] of [['index.html', 4], ['nashi-uslugi.html', 8]]) {
      await t.test(`${locale}/${page}`, () => {
        const html = readFileSync(new URL(`../${locale}/${page}`, import.meta.url), 'utf8');
        const links = [...html.matchAll(/<link\b[^>]*>/giu)].map(match => match[0]);
        const material = links.filter(tag => /\brel="stylesheet"/u.test(tag) && /\bhref="\.\.\/assets\/css\/service-card-glass\.css(?:\?[^"\s]*)?"/u.test(tag));
        assert.equal(material.length, 1, 'the rendered page must load the shared material once');
        assert.ok(html.indexOf(material[0]) > html.lastIndexOf('assets/css/page-modules.css'), 'glass must override the legacy opaque card surface');
        const grid = html.match(/<div\b[^>]*\bclass="[^"]*\bservices-grid\b[^"]*"[^>]*>/u)?.[0];
        assert.match(grid || '', /\bdata-service-glass(?:\s|=|>)/u, 'the actual service grid must opt into the effect');
        assert.equal([...html.matchAll(/\bclass="service-card"/gu)].length, cardCount, 'all existing service cards must remain present');
        const scripts = [...html.matchAll(/<script\b[^>]*>/giu)].map(match => match[0]);
        const effect = scripts.filter(tag => /\bsrc="\.\.\/assets\/js\/service-card-glass\.js(?:\?[^"\s]*)?"/u.test(tag));
        assert.equal(effect.length, 1, 'the page must initialize the shared effect once');
        assert.match(effect[0], /\bdefer(?:\s|=|>)/u);
        assert.ok(html.indexOf(effect[0]) > html.indexOf('assets/js/main.js'), 'the effect must retain the main scroller initialization order');
      });
    }
  }
});

function backgroundFor(theme = 'dark') {
  const variables = new Map();
  stylesheet.walkRules(rule => {
    if (rule.selector !== ':root' && !(theme === 'light' && rule.selector === 'body.light')) return;
    rule.nodes.filter(node => node.type === 'decl' && node.prop.startsWith('--'))
      .forEach(node => variables.set(node.prop, node.value));
  });
  const resolve = (value, depth = 0) => {
    assert.ok(depth < 20, 'the actual background variables must resolve without cycles');
    return value.replace(/var\((--[\w-]+)\)/g, (_, name) => {
      assert.ok(variables.has(name), `missing background variable ${name}`);
      return resolve(variables.get(name), depth + 1);
    });
  };
  return resolve(variables.get('--site-surface-background'));
}

class Target {
  listeners = new Map();
  addEventListener(type, callback, options = {}) {
    const entries = this.listeners.get(type) || [];
    entries.push({ callback, options });
    this.listeners.set(type, entries);
  }
  dispatch(type, event = {}) {
    for (const entry of [...(this.listeners.get(type) || [])]) {
      if (entry.options.once) this.listeners.set(type, this.listeners.get(type).filter(item => item !== entry));
      entry.callback({ type, ...event });
    }
  }
  count(type) { return this.listeners.get(type)?.length || 0; }
}

function harness(options = {}) {
  const trace = [], frames = new Map(), timers = new Map(), observers = { intersection: [], resize: [], mutation: [] };
  const metrics = { surfaces: 0, matrixInputs: [], requests: 0, maxFrames: 0 };
  let nextId = 1, time = 0;
  const element = (name, className = '') => {
    const node = new Target(), classes = new Set(className.split(/\s+/).filter(Boolean));
    const values = new Map(), writes = [], attributes = new Map();
    let image;
    Object.assign(node, { name, dataset: {}, children: [], attributes, writes, values,
      classList: { contains: value => classes.has(value), add: value => classes.add(value), remove: value => classes.delete(value) },
      setAttribute: (key, value) => attributes.set(key, value),
      prepend: child => node.children.unshift(child),
      rect: { left: 100, top: 180, width: 240, height: 170 },
      getBoundingClientRect() {
        trace.push(`read:${name}`);
        return { ...node.rect, bottom: node.rect.top + node.rect.height, right: node.rect.left + node.rect.width };
      },
      style: {
        setProperty(property, value) { trace.push(`write:${name}:${property}`); writes.push({ property, value }); values.set(property, value); },
        getPropertyValue: property => values.get(property) || '',
      },
    });
    Object.defineProperty(node.style, 'backgroundImage', {
      get: () => image,
      set(value) { trace.push(`write:${name}:backgroundImage`); writes.push({ property: 'backgroundImage', value }); image = value; },
    });
    return node;
  };
  const cards = Array.from({ length: options.cardCount ?? 4 }, (_, index) => {
    const card = element(`card${index}`, 'service-card');
    card.rect = { left: 100 + index * 20, top: 180 + index * 35, width: 240, height: 170 };
    return card;
  });
  const grid = element('grid'), body = element('body'), scrollRoot = element('scrollRoot');
  grid.children = [...cards, element('unrelated', 'other-card')];
  const document = new Target(), window = new Target(), visualViewport = new Target();
  let rootAvailable = options.root !== false && !options.rootOnDOMContentLoaded;
  document.readyState = options.loading ? 'loading' : options.interactive ? 'interactive' : 'complete';
  document.hidden = false;
  document.body = body;
  if (options.rootOnDOMContentLoaded) document.addEventListener('DOMContentLoaded', () => { rootAvailable = true; }, { once: true });
  document.querySelector = selector => selector === '.services-grid[data-service-glass]'
    ? (options.grid === false ? null : grid) : selector === '.site-scroll-root' ? (rootAvailable ? scrollRoot : null) : null;
  document.createElement = tag => element(tag);
  const surface = {
    width: '1240px', height: '992px', left: '-120px', top: '-96px',
    transform: 'matrix(1.025, 0, 0, 1.025, -9.92, -4.96)',
    backgroundImage: backgroundFor(), backgroundSize: 'auto', backgroundPositionX: '0%', backgroundPositionY: '0%',
    animationName: options.animated ? 'emeraldFacetDrift' : 'none', animationPlayState: 'running',
    ...options.surface,
  };
  const queries = preferenceNames.map((name, index) => {
    const target = new Target();
    target.matches = options.preference === index;
    target.media = name;
    target.addListener = callback => Target.prototype.addEventListener.call(target, 'change', callback);
    if (options.legacyMedia) target.addEventListener = undefined;
    return target;
  });
  Object.assign(window, {
    innerWidth: 1000, innerHeight: 800, visualViewport,
    matchMedia: query => queries.find(item => query.includes(item.media)),
    getComputedStyle(target, pseudo) {
      assert.equal(target, body, 'only the known decorative background may be sampled');
      assert.equal(pseudo, '::before');
      metrics.surfaces++;
      trace.push('read:surface');
      return surface;
    },
    requestAnimationFrame(callback) {
      const id = nextId++;
      frames.set(id, callback);
      metrics.requests++;
      metrics.maxFrames = Math.max(metrics.maxFrames, frames.size);
      return id;
    },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout(callback, delay) { const id = nextId++; timers.set(id, { callback, delay }); return id; },
    clearTimeout: id => timers.delete(id),
    DOMMatrixReadOnly: class {
      constructor(value) {
        metrics.matrixInputs.push(value);
        const numbers = value.slice(value.indexOf('(') + 1, -1).split(',').map(Number);
        const is3d = value.startsWith('matrix3d');
        Object.assign(this, { a: numbers[0], d: numbers[is3d ? 5 : 3], e: numbers[is3d ? 12 : 4], f: numbers[is3d ? 13 : 5] });
      }
    },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; observers.mutation.push(this); }
      observe(target, config) { this.target = target; this.config = config; }
    },
  });
  if (options.intersection !== false) window.IntersectionObserver = class {
    targets = new Set();
    constructor(callback, config) { this.callback = callback; this.config = config; observers.intersection.push(this); }
    observe(target) { this.targets.add(target); }
  };
  window.ResizeObserver = class {
    constructor(callback) { this.callback = callback; observers.resize.push(this); }
    observe(target) { this.target = target; }
  };
  const evaluate = () => runInNewContext(script, { window, document }, { filename: 'service-card-glass.js', timeout: 1000 });
  const tick = () => {
    trace.length = 0;
    const callbacks = [...frames.values()];
    frames.clear();
    time += 16;
    callbacks.forEach(callback => callback(time));
    return [...trace];
  };
  const settle = () => {
    let count = 0;
    while (frames.size) {
      assert.ok(count++ < 180, 'a stationary scene must settle instead of keeping an animation frame loop alive');
      tick();
    }
    return count;
  };
  const fireTimer = () => {
    const [id, timer] = [...timers.entries()][0] || [];
    assert.ok(timer, 'a background resampling timer must exist');
    timers.delete(id);
    timer.callback();
    return timer.delay;
  };
  const intersect = visible => observers.intersection[0].callback(cards.map(card => ({ target: card, isIntersecting: visible })));
  const preference = (index, value) => { queries[index].matches = value; queries[index].dispatch('change', { matches: value }); };
  evaluate();
  return { cards, grid, body, scrollRoot, document, window, visualViewport, surface, queries, trace, metrics,
    frames, timers, observers, evaluate, tick, settle, fireTimer, intersect, preference };
}

test('initialization waits for the DOM and remains idempotent across duplicate script loads', () => {
  const h = harness({ loading: true });
  h.evaluate();
  assert.equal(h.frames.size, 0);
  assert.equal(h.cards[0].children.length, 0);
  h.document.dispatch('DOMContentLoaded');
  h.evaluate();
  h.document.dispatch('DOMContentLoaded');
  assert.equal(h.grid.dataset.serviceGlass, 'ready');
  assert.equal(h.frames.size, 1);
  assert.equal(h.observers.intersection.length, 1);
  assert.equal(h.scrollRoot.count('scroll'), 1);
  for (const card of h.cards) {
    assert.equal(card.children.length, 1);
    assert.equal(card.children[0].className, 'service-glass__lens');
    assert.equal(card.children[0].attributes.get('aria-hidden'), 'true');
  }
  assert.equal(h.grid.children.at(-1).children.length, 0, 'unrelated grid children must not receive a lens');
  assert.equal(harness({ grid: false }).frames.size, 0);
  assert.equal(harness({ cardCount: 0 }).observers.intersection.length, 0);
});

test('deferred interactive boot waits for an earlier DOMContentLoaded listener to create the actual scroll root', () => {
  const h = harness({ interactive: true, rootOnDOMContentLoaded: true });
  assert.equal(h.document.querySelector('.site-scroll-root'), null);
  assert.equal(h.grid.dataset.serviceGlass, undefined, 'interactive is not complete: main.js has not created the scroller yet');
  assert.equal(h.frames.size, 0);
  assert.equal(h.window.count('scroll'), 0);
  h.document.dispatch('DOMContentLoaded');
  assert.equal(h.document.querySelector('.site-scroll-root'), h.scrollRoot);
  assert.equal(h.scrollRoot.count('scroll'), 1);
  assert.equal(h.window.count('scroll'), 0, 'initializing before the earlier DOMContentLoaded callback would bind the wrong target');
  assert.equal(h.observers.intersection[0].config.root, h.scrollRoot);
  h.settle();
  const before = h.cards[0].values.get('--glass-light-y');
  h.cards[0].rect.top = 550;
  h.scrollRoot.dispatch('scroll');
  assert.equal(h.frames.size, 1);
  h.settle();
  assert.notEqual(h.cards[0].values.get('--glass-light-y'), before, 'subsequent element scroll must actually update the reflection');
  h.document.readyState = 'complete';
  h.window.dispatch('load');
  assert.equal(h.observers.intersection.length, 1, 'the load fallback must not reinitialize an already mounted effect');
  assert.equal(h.cards[0].children.length, 1);
});

test('the eight-card services overview receives registered lenses and scroll reflections on every tile', () => {
  const h = harness({ cardCount: 8 });
  assert.equal(h.cards.length, 8);
  assert.equal(h.observers.intersection[0].targets.size, 8);
  h.settle();
  for (const card of h.cards) {
    assert.equal(card.children.length, 1);
    assert.equal(card.children[0].className, 'service-glass__lens');
    assert.equal(card.children[0].style.backgroundImage, backgroundFor());
    assert.ok(card.values.get('--glass-scene-x'));
  }
  const last = h.cards[7];
  const before = last.values.get('--glass-light-y');
  last.rect.top = 120;
  h.scrollRoot.dispatch('scroll');
  h.settle();
  assert.notEqual(last.values.get('--glass-light-y'), before, 'the additional four services must keep the same moving reflection');
  assert.equal(h.metrics.maxFrames, 1, 'all eight cards share one animation queue');
});

test('complete documents initialize immediately while the load fallback is once-only and idempotent with DOMContentLoaded', () => {
  const complete = harness();
  assert.equal(complete.grid.dataset.serviceGlass, 'ready');
  assert.equal(complete.frames.size, 1);
  assert.equal(complete.document.count('DOMContentLoaded'), 0);
  assert.equal(complete.window.count('load'), 0);
  const h = harness({ interactive: true });
  assert.equal(h.frames.size, 0);
  h.document.readyState = 'complete';
  h.window.dispatch('load');
  h.window.dispatch('load');
  h.document.dispatch('DOMContentLoaded');
  h.document.dispatch('DOMContentLoaded');
  assert.equal(h.frames.size, 1);
  assert.equal(h.scrollRoot.count('scroll'), 1);
  assert.equal(h.observers.intersection.length, 1);
  assert.equal(h.window.count('load'), 0);
  assert.equal(h.document.count('DOMContentLoaded'), 0);
  for (const card of h.cards) assert.equal(card.children.length, 1);
});

test('one scheduler coalesces scroll, resize and theme events, then settles without polling a static source', () => {
  const h = harness();
  for (let index = 0; index < 5; index++) {
    h.scrollRoot.dispatch('scroll');
    h.window.dispatch('resize');
    h.visualViewport.dispatch('resize');
    h.observers.resize[0].callback();
    h.observers.mutation[0].callback();
  }
  assert.equal(h.frames.size, 1);
  assert.equal(h.metrics.requests, 1);
  const trace = h.tick();
  const firstWrite = trace.findIndex(item => item.startsWith('write:'));
  assert.ok(firstWrite > trace.indexOf('read:surface'));
  for (const card of h.cards) assert.ok(trace.indexOf(`read:${card.name}`) < firstWrite, 'all geometry reads precede writes');
  h.settle();
  assert.equal(h.frames.size, 0);
  assert.equal(h.timers.size, 0);
  assert.equal(h.metrics.maxFrames, 1);
  assert.equal(h.scrollRoot.listeners.get('scroll')[0].options.passive, true);
});

test('the actual fixed site scroll root drives the full viewport highlight, with a window fallback', () => {
  const h = harness();
  h.cards[0].rect.top = 550;
  h.settle();
  const before = parseFloat(h.cards[0].values.get('--glass-light-y'));
  h.cards[0].rect.top = 30;
  h.scrollRoot.dispatch('scroll');
  assert.equal(h.frames.size, 1, 'element scroll events need their own listener because they do not bubble to window');
  h.settle();
  const after = parseFloat(h.cards[0].values.get('--glass-light-y'));
  assert.ok(before < 30 && after > 80, 'the reflection must travel across the card while it traverses the viewport');
  assert.equal(h.window.count('scroll'), 0);
  assert.equal(h.observers.intersection[0].config.root, h.scrollRoot);
  const fallback = harness({ root: false });
  assert.equal(fallback.window.count('scroll'), 1);
  assert.equal(fallback.observers.intersection[0].config.root, null);
});

test('an animated source uses one bounded resampling timer and does not rewrite unchanged scene values', () => {
  const h = harness({ animated: true });
  h.settle();
  assert.equal(h.frames.size, 0);
  assert.equal(h.timers.size, 1);
  const sceneWrites = () => h.cards[0].writes.filter(item => item.property.startsWith('--glass-scene')).length;
  const before = sceneWrites();
  assert.equal(h.fireTimer(), 250);
  h.settle();
  assert.equal(h.timers.size, 1);
  assert.equal(sceneWrites(), before, 'idle sampling must not write identical registered background coordinates');
  for (const card of h.cards) assert.equal(card.children[0].writes.filter(item => item.property === 'backgroundImage').length, 1);
  h.scrollRoot.dispatch('scroll');
  assert.equal(h.timers.size, 0, 'fresh input replaces the pending idle timer');
  assert.equal(h.frames.size, 1);
});

test('offscreen cards stop both queues and geometry reads, then resume on intersection', () => {
  const h = harness({ animated: true });
  h.settle();
  h.intersect(false);
  assert.equal(h.frames.size + h.timers.size, 0);
  const reads = h.metrics.surfaces;
  h.scrollRoot.dispatch('scroll');
  const trace = h.tick();
  assert.equal(trace.some(item => item.startsWith('read:card')), false);
  assert.equal(h.metrics.surfaces, reads);
  assert.equal(h.frames.size + h.timers.size, 0);
  h.intersect(true);
  assert.equal(h.frames.size, 1);
  h.settle();
  assert.ok(h.metrics.surfaces > reads);
  assert.equal(h.timers.size, 1);
  const fallback = harness({ intersection: false, animated: true });
  fallback.cards.forEach(card => { card.rect.top = 2000; });
  fallback.tick();
  assert.equal(fallback.metrics.surfaces, 0);
  assert.equal(fallback.frames.size + fallback.timers.size, 0, 'geometry still stops work without IntersectionObserver');
});

test('visibility and bfcache lifecycle cancel pending work and touch state without duplicate resumes', () => {
  const h = harness({ animated: true });
  h.settle();
  h.cards[0].dispatch('pointerdown', { pointerType: 'touch', clientX: 110, clientY: 190 });
  h.document.hidden = true;
  h.document.dispatch('visibilitychange');
  assert.equal(h.frames.size + h.timers.size, 0);
  assert.equal(h.cards[0].classList.contains('is-glass-touch'), false);
  h.scrollRoot.dispatch('scroll');
  h.window.dispatch('resize');
  assert.equal(h.frames.size, 0);
  h.document.hidden = false;
  h.document.dispatch('visibilitychange');
  assert.equal(h.frames.size, 1);
  h.window.dispatch('pagehide');
  h.window.dispatch('pagehide');
  h.observers.mutation[0].callback();
  h.window.dispatch('resize');
  assert.equal(h.frames.size + h.timers.size, 0, 'pagehide suspension persists even if document.hidden remains false');
  h.window.dispatch('pageshow');
  h.window.dispatch('pageshow');
  assert.equal(h.frames.size, 1);
  h.settle();
  assert.equal(h.timers.size, 1);
});

test('all reported accessibility preferences stop live work and release interaction, including legacy media listeners', async t => {
  for (const [index, name] of preferenceNames.entries()) {
    await t.test(name, () => {
      const h = harness({ animated: true, legacyMedia: index === 0 });
      h.settle();
      h.cards[0].dispatch('pointerdown', { pointerType: 'touch', clientX: 120, clientY: 200 });
      h.preference(index, true);
      assert.equal(h.frames.size + h.timers.size, 0);
      assert.equal(h.cards[0].classList.contains('is-glass-touch'), false);
      h.cards[0].dispatch('pointerdown', { pointerType: 'touch', clientX: 120, clientY: 200 });
      h.scrollRoot.dispatch('scroll');
      assert.equal(h.frames.size, 0);
      assert.equal(h.cards[0].classList.contains('is-glass-touch'), false);
      h.preference(index, false);
      assert.equal(h.frames.size, 1);
      const initiallyReduced = harness({ preference: index });
      assert.equal(initiallyReduced.frames.size + initiallyReduced.timers.size, 0);
      assert.equal(initiallyReduced.metrics.surfaces, 0);
    });
  }
  const h = harness({ preference: 0 });
  h.preference(1, true);
  h.preference(0, false);
  assert.equal(h.frames.size, 0, 'one cleared preference cannot override another active preference');
});

test('touch highlights clamp to the card and cancel on pointerup, pointercancel or blur without capturing input', () => {
  const h = harness(), card = h.cards[0];
  card.dispatch('pointerdown', { pointerType: 'mouse', clientX: 120, clientY: 200 });
  assert.equal(card.classList.contains('is-glass-touch'), false);
  for (const type of ['pointerup', 'pointercancel', 'blur']) {
    card.dispatch('pointerdown', { pointerType: 'touch', clientX: -100, clientY: 2000,
      preventDefault() { assert.fail('the decorative touch effect must not cancel native interaction'); } });
    h.settle();
    assert.ok(parseFloat(card.values.get('--glass-light-x')) < 30);
    assert.ok(parseFloat(card.values.get('--glass-light-y')) > 85);
    assert.equal(card.classList.contains('is-glass-touch'), true);
    h.window.dispatch(type);
    h.window.dispatch(type);
    assert.equal(card.classList.contains('is-glass-touch'), false);
  }
  assert.equal(card.listeners.get('pointerdown')[0].options.passive, true);
  assert.equal(h.window.listeners.get('pointercancel')[0].options.passive, true);
  assert.equal(card.children.length, 1);
});

test('touch movement changes the optical sample in one visible-card frame and releases without capturing scroll', () => {
  const h = harness(), card = h.cards[0];
  h.settle();
  const idleWidth = card.values.get('--glass-scene-width');
  card.dispatch('pointermove', { pointerType: 'touch', pointerId: 7, clientX: 120, clientY: 200 });
  assert.equal(h.frames.size, 0, 'a stray pointermove must not begin an interaction');
  h.trace.length = 0;
  card.dispatch('pointerdown', { pointerType: 'touch', pointerId: 7, clientX: 110, clientY: 190 });
  card.dispatch('pointermove', { pointerType: 'touch', pointerId: 7, clientX: 120, clientY: 200 });
  assert.equal(h.trace.length, 0, 'pointer input only records coordinates; layout and paint writes belong to RAF');
  assert.equal(h.frames.size, 1);
  h.settle();
  const before = card.values.get('--glass-scene-x');
  const upperWidth = parseFloat(card.values.get('--glass-scene-width'));
  card.dispatch('pointermove', { pointerType: 'touch', pointerId: 8, clientX: 340, clientY: 350 });
  assert.equal(h.frames.size, 0, 'another finger must not replace the active pointer');
  card.dispatch('pointermove', { pointerType: 'touch', pointerId: 7, clientX: 340, clientY: 350,
    preventDefault() { assert.fail('the glass must preserve native scrolling'); } });
  h.settle();
  assert.notEqual(card.values.get('--glass-scene-x'), before, 'the optical background moves with the focal point');
  assert.ok(parseFloat(card.values.get('--glass-scene-width')) > upperWidth, 'moving down changes magnification, not just the glow');
  h.window.dispatch('pointercancel', { pointerId: 7 });
  h.settle();
  assert.ok(Math.abs(parseFloat(card.values.get('--glass-scene-width')) - parseFloat(idleWidth)) < 0.2);
  assert.equal(h.frames.size + h.timers.size, 0, 'a settled static surface must not keep polling');
  assert.equal(card.listeners.get('pointermove')[0].options.passive, true);
});

test('scroll changes lens magnification while offscreen cards receive no optical writes', () => {
  const h = harness(), card = h.cards[0], hidden = h.cards[1];
  h.settle();
  h.observers.intersection[0].callback([{ target: hidden, isIntersecting: false }]);
  h.settle();
  const width = parseFloat(card.values.get('--glass-scene-width'));
  const hiddenWrites = hidden.writes.length;
  card.rect.top = 20;
  h.scrollRoot.dispatch('scroll');
  h.settle();
  assert.ok(parseFloat(card.values.get('--glass-scene-width')) > width);
  assert.equal(hidden.writes.length, hiddenWrites);
});

test('a second finger cannot replace or release the active optical interaction', () => {
  for (const release of ['pointerup', 'pointercancel']) {
    const h = harness(), card = h.cards[0];
    h.settle();
    card.dispatch('pointerdown', { pointerType: 'touch', pointerId: 7, clientX: 110, clientY: 190 });
    h.settle();
    const sample = card.values.get('--glass-scene-x');
    card.dispatch('pointerdown', { pointerType: 'touch', pointerId: 8, clientX: 340, clientY: 350 });
    h.window.dispatch(release, { pointerId: 8 });
    assert.equal(h.frames.size, 0, 'an unrelated finger cannot change the active sample or schedule a release');
    assert.equal(card.classList.contains('is-glass-touch'), true);
    card.dispatch('pointermove', { pointerType: 'touch', pointerId: 7, clientX: 340, clientY: 350 });
    h.settle();
    assert.notEqual(card.values.get('--glass-scene-x'), sample, 'the original finger must still control the lens');
    h.window.dispatch(release, { pointerId: 7 });
    assert.equal(card.classList.contains('is-glass-touch'), false);
    h.settle();
    assert.equal(h.frames.size + h.timers.size, 0);
  }
});

test('the registered lens samples the actual CSS background and DOMMatrix geometry without filtering content', () => {
  const before = stylesheet.nodes.find(node => node.type === 'rule' && node.selector === 'body::before');
  assert.ok(before.nodes.some(node => node.prop === 'position' && node.value === 'fixed'));
  assert.ok(before.nodes.some(node => node.prop === 'transform' && node.value.includes('translate3d') && node.value.includes('scale')));
  const dark = backgroundFor(), light = backgroundFor('light');
  assert.equal((dark.match(/linear-gradient\(/g) || []).length, 6);
  assert.equal((light.match(/linear-gradient\(/g) || []).length, 1);
  for (const transform of ['matrix(1.025, 0, 0, 1.025, -9.92, -4.96)',
    'matrix3d(1.025, 0, 0, 0, 0, 1.025, 0, 0, 0, 0, 1, 0, -9.92, -4.96, 0, 1)']) {
    const h = harness({ surface: { transform } });
    h.tick();
    const card = h.cards[0], lens = card.children[0];
    assert.equal(lens.style.backgroundImage, dark);
    assert.equal(h.metrics.matrixInputs[0], transform);
    const scale = parseFloat(card.values.get('--glass-scene-width')) / 1271;
    assert.ok(scale > 1.1 && scale < 1.17, 'the decorative sample has bounded optical magnification');
    assert.ok(Math.abs(parseFloat(card.values.get('--glass-scene-height')) / 1016.8 - scale) < 0.00001,
      'the background image must preserve its aspect ratio');
    const focusX = 238 * parseFloat(card.values.get('--glass-light-x')) / 100;
    const focusY = 168 * parseFloat(card.values.get('--glass-light-y')) / 100;
    const originX = parseFloat(card.values.get('--glass-scene-x'));
    const originY = parseFloat(card.values.get('--glass-scene-y'));
    assert.ok(Math.abs((focusX - originX) / scale - (focusX + 246.42)) < 0.02,
      'the focal point stays registered with the actual transformed background on x');
    assert.ok(Math.abs((focusY - originY) / scale - (focusY + 294.36)) < 0.02,
      'the focal point stays registered with the actual transformed background on y');
    assert.equal(card.values.has('filter'), false);
    assert.equal(card.values.has('transform'), false);
    h.surface.backgroundImage = light;
    h.observers.mutation[0].callback();
    h.tick();
    assert.equal(lens.style.backgroundImage, light, 'theme mutations refresh the actual known source');
    assert.equal(lens.writes.filter(item => item.property === 'backgroundImage').length, 2);
  }
});
