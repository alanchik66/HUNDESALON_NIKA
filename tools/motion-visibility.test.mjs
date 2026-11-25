import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import postcss from 'postcss';
import { installMotionVisibility, installScrollFrameBudget } from '../assets/js/motion-visibility.js';

function fixture({ loading = false } = {}) {
  const events = new Map();
  const makeElement = (selector = '.price-card') => {
    const attributes = new Set();
    return {
      isConnected: true,
      attributes,
      matches: value => value.split(',').map(part => part.trim()).includes(selector),
      querySelectorAll: () => [],
      toggleAttribute(name, force) { if (force) attributes.add(name); else attributes.delete(name); },
      removeAttribute(name) { attributes.delete(name); },
    };
  };
  const cards = [makeElement(), makeElement()];
  const observed = new Set();
  const intersections = [];
  let mutations;
  const options = [];
  const document = {
    documentElement: makeElement(), body: {}, hidden: false,
    readyState: loading ? 'loading' : 'complete',
    querySelectorAll: () => cards,
    addEventListener(name, callback) { events.set(name, callback); },
    removeEventListener(name) { events.delete(name); },
  };
  const window = {
    IntersectionObserver: class {
      constructor(callback, value) { intersections.push(callback); options.push(value); }
      observe(element) { observed.add(element); }
      unobserve(element) { observed.delete(element); }
      disconnect() { observed.clear(); }
    },
    MutationObserver: class {
      constructor(callback) { mutations = callback; }
      observe() {}
      disconnect() {}
    },
    addEventListener(name, callback) { events.set(name, callback); },
    removeEventListener(name) { events.delete(name); },
  };
  return { document, window, cards, events, observed, makeElement,
    intersect: (entries, index = 0) => intersections[index](entries), mutate: entries => mutations(entries), options: (index = 0) => options[index] };
}

test('offscreen cards pause and resume before entering the viewport without scroll handlers', () => {
  const h = fixture();
  const controller = installMotionVisibility(h.document, h.window);
  assert.equal(h.observed.size, 2);
  assert.equal(h.options().rootMargin, '160px 0px');
  assert.equal(h.events.has('scroll'), false);
  h.intersect([{ target: h.cards[0], isIntersecting: false }, { target: h.cards[1], isIntersecting: true }]);
  assert.equal(h.cards[0].attributes.has('data-motion-offscreen'), true);
  assert.equal(h.cards[1].attributes.has('data-motion-offscreen'), false);
  h.intersect([{ target: h.cards[0], isIntersecting: true }]);
  assert.equal(h.cards[0].attributes.has('data-motion-offscreen'), false);
  controller.disconnect();
  assert.equal(h.observed.size, 0);
});

test('replaced catalog cards are released and newly inserted cards are observed', () => {
  const h = fixture();
  const controller = installMotionVisibility(h.document, h.window);
  const card = h.makeElement();
  h.cards[0].isConnected = false;
  h.cards[0].attributes.add('data-motion-offscreen');
  h.mutate([{ addedNodes: [card] }]);
  assert.equal(h.observed.has(card), true);
  assert.equal(h.observed.has(h.cards[0]), false);
  assert.equal(h.cards[0].attributes.has('data-motion-offscreen'), false);
  controller.disconnect();
});

test('repeated section navigation, hero, footer and service components share the visibility lifecycle', () => {
  const h = fixture();
  const selectors = ['.price-section-navigation', '.price-page-hero', '.newsletter-section', 'footer', '.services-grid .service-card'];
  const components = selectors.map(h.makeElement);
  h.cards.push(...components);
  const controller = installMotionVisibility(h.document, h.window);
  assert.equal(h.observed.size, 7);
  h.intersect(components.map(target => ({ target, isIntersecting: false })));
  assert.ok(components.every(component => component.attributes.has('data-motion-offscreen')));
  h.intersect(components.map(target => ({ target, isIntersecting: true })));
  assert.ok(components.every(component => !component.attributes.has('data-motion-offscreen')));
  controller.disconnect();
});

test('the fixed header pauses at the viewport boundary rather than staying inside the card prewarm margin', () => {
  const h = fixture();
  const header = h.makeElement('.header');
  h.cards.push(header);
  const controller = installMotionVisibility(h.document, h.window);
  assert.equal(h.options(1).rootMargin, '0px');
  h.intersect([{ target: header, isIntersecting: true, intersectionRatio: 0 }], 1);
  assert.equal(header.attributes.has('data-motion-offscreen'), true);
  h.intersect([{ target: header, isIntersecting: true, intersectionRatio: 0.2 }], 1);
  assert.equal(header.attributes.has('data-motion-offscreen'), false);
  controller.disconnect();
});

test('background state follows visibility and bfcache restoration, and cleanup restores motion', () => {
  const h = fixture({ loading: true });
  const controller = installMotionVisibility(h.document, h.window);
  assert.equal(h.observed.size, 0);
  h.events.get('DOMContentLoaded')();
  assert.equal(h.observed.size, 2);
  h.document.hidden = true;
  h.events.get('visibilitychange')();
  assert.equal(h.document.documentElement.attributes.has('data-motion-page-hidden'), true);
  h.document.hidden = false;
  h.events.get('pageshow')();
  assert.equal(h.document.documentElement.attributes.has('data-motion-page-hidden'), false);
  h.intersect([{ target: h.cards[0], isIntersecting: false }]);
  controller.disconnect();
  assert.equal(h.cards[0].attributes.has('data-motion-offscreen'), false);
  assert.equal(h.events.size, 0);
});

test('browsers without IntersectionObserver retain their original motion', () => {
  const h = fixture();
  delete h.window.IntersectionObserver;
  assert.equal(installMotionVisibility(h.document, h.window), null);
  assert.equal(h.events.size, 0);
});

function scrollBudgetFixture({ price = true, pendingLoader = false } = {}) {
  const observers = [];
  const frames = new Map();
  const listeners = { document: new Map(), window: new Map() };
  let frameId = 0;
  let resolveLoader;
  const element = initialClasses => {
    const classes = new Set(initialClasses);
    const attributes = new Map();
    return {
      isConnected: true,
      classList: { contains: name => classes.has(name), add: name => classes.add(name), remove: name => classes.delete(name) },
      hasAttribute: name => attributes.has(name),
      getAttribute: name => attributes.get(name) ?? null,
      setAttribute: (name, value) => attributes.set(name, value),
      removeAttribute: name => attributes.delete(name),
    };
  };
  const root = element([]);
  for (const name of ['scrollTop', 'scrollHeight', 'clientHeight', 'clientWidth']) {
    Object.defineProperty(root, name, { get() { throw Error('Frame budget must not read scroll or layout metrics.'); } });
  }
  const body = element(price ? ['price-page'] : []);
  const add = (target, name, callback) => {
    if (!listeners[target].has(name)) listeners[target].set(name, new Set());
    listeners[target].get(name).add(callback);
  };
  const remove = (target, name, callback) => listeners[target].get(name)?.delete(callback);
  const document = {
    body, hidden: false,
    documentElement: { dataset: { siteReady: pendingLoader ? 'false' : 'true', priceReady: 'true' } },
    querySelector: selector => selector === '.site-scroll-root' ? root : price ? {} : null,
    addEventListener: (name, callback) => add('document', name, callback),
    removeEventListener: (name, callback) => remove('document', name, callback),
  };
  const window = {
    MutationObserver: class {
      constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
      observe(target, options) { this.target = target; this.options = options; }
      disconnect() { this.disconnected = true; }
    },
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
    addEventListener: (name, callback) => add('window', name, callback),
    removeEventListener: (name, callback) => remove('window', name, callback),
  };
  Object.defineProperty(window, 'localStorage', { get() { throw Error('Scroll quality is never persisted.'); } });
  if (pendingLoader) window.NikaSiteLoader = { ready: new Promise(resolve => { resolveLoader = resolve; }) };
  const emit = (target, name, event = {}) => listeners[target].get(name)?.forEach(callback => callback(event));
  const mutation = target => observers.filter(observer => observer.target === target && !observer.disconnected)
    .forEach(observer => observer.callback([{ type: 'attributes', attributeName: 'class', target }]));
  return {
    document, window, root, body, observers, frames, listeners, emit,
    burst(active) { root.classList[active ? 'add' : 'remove']('site-scroll-active'); mutation(root); },
    modal(name, active) { body.classList[active ? 'add' : 'remove'](name); mutation(body); },
    step(timestamp) { for (const [id, callback] of [...frames]) { frames.delete(id); callback(timestamp); } },
    finishLoading() { document.documentElement.dataset.siteReady = 'true'; resolveLoader(); },
    mode: () => root.getAttribute('data-scroll-budget'),
    listenerCount: () => Object.values(listeners).reduce((sum, map) => sum + [...map.values()].reduce((n, set) => n + set.size, 0), 0),
  };
}

test('a normal 60 fps price scroll keeps full effects and has no idle sampling loop', () => {
  const h = scrollBudgetFixture();
  const controller = installScrollFrameBudget(h.document, h.window);
  assert.equal(h.frames.size, 0);
  h.burst(true);
  for (const timestamp of [0, 16.7, 33.4, 50.1, 66.8, 83.5, 100.2]) h.step(timestamp);
  assert.equal(h.mode(), null);
  assert.equal(h.frames.size, 1);
  h.burst(false);
  assert.equal(h.frames.size, 0);
  assert.equal(h.mode(), null);
  assert.equal(h.listeners.window.has('scroll'), false);
  assert.equal(h.listeners.document.has('scroll'), false);
  assert.ok(h.observers.every(observer => observer.options.attributes && observer.options.attributeFilter.join() === 'class'));
  controller.disconnect();
});

test('three consecutive slow intervals select balanced paint only during scroll bursts', () => {
  const h = scrollBudgetFixture();
  const controller = installScrollFrameBudget(h.document, h.window);
  h.burst(true);
  for (const timestamp of [0, 40, 80]) h.step(timestamp);
  assert.equal(h.mode(), null, 'two slow intervals are insufficient');
  h.step(120);
  assert.equal(h.mode(), 'balanced');
  assert.equal(h.frames.size, 0, 'sampling stops once the page budget is known');
  h.burst(false);
  assert.equal(h.mode(), null);
  h.burst(true);
  assert.equal(h.mode(), 'balanced', 'the next burst reuses only this document memory');
  assert.equal(h.frames.size, 0);
  h.burst(false);
  controller.disconnect();
});

test('an isolated long frame does not classify a healthy page as constrained', () => {
  const h = scrollBudgetFixture();
  const controller = installScrollFrameBudget(h.document, h.window);
  h.burst(true);
  for (const timestamp of [0, 45, 61.7, 101.7, 141.7]) h.step(timestamp);
  assert.equal(h.mode(), null);
  h.step(181.7);
  assert.equal(h.mode(), 'balanced');
  controller.disconnect();
});

test('sampling waits for the existing loader readiness instead of classifying startup work', async () => {
  const h = scrollBudgetFixture({ pendingLoader: true });
  const controller = installScrollFrameBudget(h.document, h.window);
  h.burst(true);
  assert.equal(h.frames.size, 0);
  h.emit('window', 'site:page-ready');
  assert.equal(h.frames.size, 0, 'price readiness alone does not bypass the global loader');
  h.finishLoading();
  await Promise.resolve();
  assert.equal(h.frames.size, 1);
  h.burst(false);
  controller.disconnect();
});

for (const name of ['nav-open', 'header-weather-expanded', 'price-modal-open', 'booking-modal-open', 'price-breed-menu-open']) {
  test(`${name} immediately restores full paint and prevents modal sampling`, () => {
    const h = scrollBudgetFixture();
    const controller = installScrollFrameBudget(h.document, h.window);
    h.burst(true);
    for (const timestamp of [0, 40, 80, 120]) h.step(timestamp);
    assert.equal(h.mode(), 'balanced');
    h.modal(name, true);
    assert.equal(h.mode(), null);
    assert.equal(h.frames.size, 0);
    h.modal(name, false);
    assert.equal(h.mode(), null, 'closing a modal does not revive an old scroll burst');
    h.burst(false);
    h.burst(true);
    assert.equal(h.mode(), 'balanced');
    controller.disconnect();
  });
}

test('visibility, pagehide and bfcache restoration clear the mode until a new scroll burst', () => {
  const h = scrollBudgetFixture();
  const controller = installScrollFrameBudget(h.document, h.window);
  const constrainedBurst = () => {
    h.burst(false); h.burst(true);
    for (const timestamp of [0, 40, 80, 120]) h.step(timestamp);
    assert.equal(h.mode(), 'balanced');
  };
  constrainedBurst();
  h.document.hidden = true;
  h.emit('document', 'visibilitychange');
  assert.equal(h.mode(), null);
  assert.equal(h.frames.size, 0);
  h.document.hidden = false;
  h.emit('document', 'visibilitychange');
  assert.equal(h.mode(), null);
  constrainedBurst();
  h.emit('window', 'pagehide');
  assert.equal(h.mode(), null);
  h.emit('window', 'pageshow', { persisted: true });
  assert.equal(h.mode(), null);
  assert.equal(h.frames.size, 0);
  constrainedBurst();
  controller.disconnect();
});

test('disconnect removes observers, listeners and frames and ignores a late loader resolution', async () => {
  const h = scrollBudgetFixture({ pendingLoader: true });
  const controller = installScrollFrameBudget(h.document, h.window);
  h.burst(true);
  controller.disconnect();
  h.finishLoading();
  await Promise.resolve();
  assert.equal(h.mode(), null);
  assert.equal(h.frames.size, 0);
  assert.equal(h.listenerCount(), 0);
  assert.ok(h.observers.every(observer => observer.disconnected));
});

test('other pages and missing platform APIs retain their original effects', () => {
  const other = scrollBudgetFixture({ price: false });
  assert.equal(installScrollFrameBudget(other.document, other.window), null);
  assert.equal(other.observers.length, 0);
  const unsupported = scrollBudgetFixture();
  delete unsupported.window.requestAnimationFrame;
  assert.equal(installScrollFrameBudget(unsupported.document, unsupported.window), null);
  assert.equal(unsupported.observers.length, 0);
});

test('balanced price rules are paint-only and retain animation timing and page geometry', async () => {
  const css = postcss.parse(await readFile(new URL('../assets/css/motion-visibility.css', import.meta.url), 'utf8'));
  const allowed = new Set(['animation-play-state', 'filter', '-webkit-backdrop-filter', 'backdrop-filter', 'box-shadow', 'text-shadow', 'color', 'background-image', '-webkit-background-clip', 'background-clip', '-webkit-text-fill-color', '-webkit-text-stroke', 'outline', 'outline-offset']);
  let count = 0;
  css.walkRules(rule => {
    if (!rule.selector.includes('[data-scroll-budget=')) return;
    count++;
    assert.ok(rule.selector.includes('body.price-page:not('));
    assert.ok(rule.selector.includes('.site-scroll-active'));
    assert.ok(rule.selector.includes('.booking-modal-open'));
    rule.walkDecls(declaration => {
      assert.ok(allowed.has(declaration.prop), `${declaration.prop} must not change geometry or animation duration`);
      if (declaration.prop === 'animation-play-state') assert.equal(declaration.value, 'paused');
    });
  });
  assert.equal(count, 3);
});

test('balanced scrolling retains a keyboard focus indicator when decorative focus shadows are removed', async () => {
  const css = postcss.parse(await readFile(new URL('../assets/css/motion-visibility.css', import.meta.url), 'utf8'));
  const rules = [];
  css.walkRules(rule => {
    if (rule.selector.includes('[data-scroll-budget=') && rule.selector.endsWith(':focus-visible')) rules.push(rule);
  });
  assert.equal(rules.length, 1);
  const rule = rules[0];
  assert.ok(rule.selector.includes('body.price-page:not('));
  assert.ok(rule.selector.includes('.site-scroll-active'));
  assert.ok(rule.selector.includes('.booking-modal-open'));
  const declarations = new Map(rule.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node]));
  assert.equal(declarations.size, 2);
  assert.equal(declarations.get('outline').value, '2px solid var(--accent-gold, #d5b66e)');
  assert.equal(declarations.get('outline').important, true);
  assert.equal(declarations.get('outline-offset').value, '2px');
  assert.equal(declarations.get('outline-offset').important, true);
});
