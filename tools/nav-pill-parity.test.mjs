import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { capsulePoint, contourHalfWidth, buildContourFrame, readContourReference, initMenuContours,
  MENU_CONTOUR_COLORS, MENU_CONTOUR_TIMING } from '../assets/js/menu-contour.js';

const source = readFileSync(new URL('../assets/js/main.js', import.meta.url), 'utf8');

test('price categories use the same plasma effect as gallery tabs', () => {
  const effects = source.slice(source.indexOf('const mountActivePlasma ='), source.indexOf('const siteArrowActivationAnimations ='));
  assert.ok(effects.includes('.filter-btn'));
  assert.ok(effects.includes("addEventListener('mouseenter'"));
  assert.ok(effects.includes("addEventListener('focus'"));
  assert.ok(effects.includes('playNavPillClickFlash(link);'));
  assert.ok(!effects.includes('data-price-section-action'));
  assert.ok(!source.includes('mountPlasmaGlobe'));
});

test('capsule contours follow wide, tiny and circular buttons with mirrored outward normals', () => {
  for (const [width, height] of [[240, 44], [74, 18], [64, 64], [30, 80]]) {
    assert.deepEqual(capsulePoint(width, height, 0), { x: width / 2, y: height, nx: 0, ny: 1 });
    const top = capsulePoint(width, height, 1);
    assert.ok(Math.abs(top.x - width / 2) < 1e-9 && Math.abs(top.y) < 1e-9);
    for (let index = 0; index <= 100; index += 1) {
      const left = capsulePoint(width, height, index / 100);
      const right = capsulePoint(width, height, index / 100, 1);
      assert.ok(left.x >= -1e-9 && left.x <= width / 2 + 1e-9 && left.y >= -1e-9 && left.y <= height + 1e-9);
      assert.ok(Math.abs(left.x + right.x - width) < 1e-9);
      assert.equal(left.y, right.y);
      assert.ok(Math.abs(Math.hypot(left.nx, left.ny) - 1) < 1e-9);
    }
  }
  assert.equal(capsulePoint(0, 20, 0), null);
  assert.equal(capsulePoint(20, NaN, 0), null);
  assert.equal(contourHalfWidth(0), 0);
  assert.equal(contourHalfWidth(1), 0);
  assert.equal(contourHalfWidth(0.5), 0.325);
  assert.ok(contourHalfWidth(0.01) < 0.002, 'both tips taper below a visible round line cap');
});

test('the real contour frame preserves the assistant cycle, trailing ribbon and separate origin and meeting flashes', () => {
  const frame = phase => buildContourFrame(240, 44, phase * MENU_CONTOUR_TIMING.cycleMs);
  assert.equal(frame(0).head, 0);
  assert.equal(frame(0.84).head, 1, 'the heads meet exactly at the upper midpoint');
  assert.equal(frame(0.02).origin.opacity, 1);
  assert.equal(frame(0.02).meeting.opacity, 0);
  assert.equal(frame(0.87).meeting.opacity, 1);
  assert.equal(frame(0.87).origin.opacity, 0);
  assert.equal(frame(0.5).trailOpacity, 0.36);
  assert.equal(frame(0).trailOpacity, 0);
  assert.deepEqual({ ...frame(0), hue: 180 }, frame(1), 'the geometry repeats while its slower colour cycle continues');
  assert.deepEqual(frame(0), frame(2), 'geometry and colour repeat together without a seam after 12.8 seconds');
  assert.equal(buildContourFrame(240, 44, 6400).hue, 180);
  assert.equal(buildContourFrame(240, 44, 12800).hue, 0);
  assert.equal(buildContourFrame(0, 44, 0), null);
  const middle = frame(0.5);
  assert.ok(middle.branches.every(branch => branch.polygon.length === 66 && branch.trail.length === 66));
  assert.notDeepEqual(middle.branches[0].polygon, middle.branches[0].trail, 'the emerald afterglow follows behind the moving light');
  const [left, right] = middle.branches;
  left.polygon.forEach(([x, y], index) => {
    assert.ok(Math.abs(x + right.polygon[index][0] - 240) < 1e-9);
    assert.ok(Math.abs(y - right.polygon[index][1]) < 1e-9);
  });
});

function events(target = {}) {
  const listeners = new Map();
  return Object.assign(target, {
    listeners,
    addEventListener(name, callback) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
    fire(name, event = {}) { for (const callback of [...(listeners.get(name) || [])]) callback(event); },
  });
}

function contourEnvironment({ count = 1, contextFailure = false } = {}) {
  const frames = new Map(), observers = { mutation: [], intersection: [], resize: [] };
  const document = events({ hidden: false, targets: [], hosts: [] });
  class Node {
    constructor(tag, root = document) {
      this.tag = tag; this.root = root; this.children = []; this.attributes = new Map(); this.attributeWrites = 0;
      this.values = new Map(); this.style = { setProperty: (name, value) => this.values.set(name, value) };
      this.isConnected = true;
    }
    appendChild(node) { this.children.push(node); node.parentNode = this; node.root = this.root; return node; }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(node => node !== this); this.parentNode = null; this.isConnected = false; }
    setAttribute(name, value) { this.attributes.set(name, value); this.attributeWrites += 1; }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    getRootNode() { return this.root; }
    querySelector(selector) { return selector === 'style[data-menu-contour-styles]' ? this.children.find(node => node.attributes.has('data-menu-contour-styles')) || null : null; }
  }
  const makeContext = () => {
    const statistics = { draws: 0, transforms: [] };
    const gradient = { addColorStop(offset) { assert.ok(Number.isFinite(offset) && offset >= 0 && offset <= 1); } };
    const context = new Proxy({
      statistics,
      clearRect() { if (contextFailure) throw Error('Canvas disabled'); statistics.draws += 1; },
      setTransform(...values) { statistics.transforms.push(values); },
      createLinearGradient: () => gradient, createRadialGradient: () => gradient,
    }, { get: (target, name) => name in target ? target[name] : () => {} });
    return context;
  };
  document.head = new Node('head'); document.documentElement = new Node('html');
  document.createElement = tag => {
    const node = new Node(tag);
    if (tag === 'canvas') { node.context = makeContext(); node.getContext = () => node.context; }
    return node;
  };
  document.querySelector = selector => selector === 'style[data-menu-contour-styles]' ? document.head.querySelector(selector) : null;
  document.querySelectorAll = selector => selector === '[data-price-breeds-toggle]' ? document.targets.filter(target => target.isConnected)
    : selector === '.header-weather-widget[data-weather-widget]' ? document.hosts.filter(host => host.isConnected) : [];
  class Observer {
    constructor(callback, type) { this.callback = callback; this.targets = new Set(); observers[type].push(this); }
    observe(target) { this.targets.add(target); }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); this.disconnected = true; }
    emit(entries) { this.callback(entries); }
  }
  let nextFrame = 0;
  const window = events({
    document, innerHeight: 900, devicePixelRatio: 3, visualViewport: events({ scale: 1 }),
    getComputedStyle: () => ({ borderLeftWidth: '1px', borderTopWidth: '1px', getPropertyValue: () => '' }),
    requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame; }, cancelAnimationFrame: id => frames.delete(id),
  });
  const environment = {
    window, document,
    MutationObserver: class extends Observer { constructor(callback) { super(callback, 'mutation'); } },
    IntersectionObserver: class extends Observer { constructor(callback) { super(callback, 'intersection'); } },
    ResizeObserver: class extends Observer { constructor(callback) { super(callback, 'resize'); } },
  };
  const makeTarget = (root = document, top = 100, width = 140, height = 44) => {
    const target = new Node('button', root);
    target.offsetWidth = width; target.offsetHeight = height;
    target.top = top;
    target.setAttribute('aria-expanded', 'false');
    target.getBoundingClientRect = () => ({ width: target.offsetWidth * 0.8, height: target.offsetHeight * 0.8, top: target.top, bottom: target.top + target.offsetHeight * 0.8 });
    return target;
  };
  for (let index = 0; index < count; index += 1) document.targets.push(makeTarget(document, index < 2 ? 100 : 2000));
  const host = new Node('weather-host');
  const shadow = new Node('shadow'); shadow.root = shadow; shadow.targets = [makeTarget(shadow, 100, 74, 18)];
  shadow.querySelectorAll = selector => selector === '.weather-header-card__toggle' ? shadow.targets.filter(target => target.isConnected) : [];
  host.shadowRoot = shadow; document.hosts.push(host);
  return {
    environment, document, window, frames, observers, host, shadow, makeTarget,
    step(time) { const batch = [...frames.values()]; frames.clear(); batch.forEach(callback => callback(time)); },
  };
}

test('all breed buttons and the open weather shadow root bind once without changing actions or ARIA', () => {
  const h = contourEnvironment({ count: 24 });
  const api = initMenuContours(h.environment);
  assert.equal(initMenuContours(h.environment), api);
  assert.deepEqual(api.getDiagnostics(), { bound: 25, visible: 3, running: true, cycleMs: 6400, colorCount: 15 });
  assert.equal(h.frames.size, 1);
  for (const target of [...h.document.targets, ...h.shadow.targets]) {
    assert.equal(target.children.filter(node => node.tag === 'canvas').length, 1);
    assert.equal(target.getAttribute('aria-expanded'), 'false');
    assert.equal(target.getAttribute('data-menu-contour'), 'pending', 'the old contour stays until a successful paint');
  }
  h.step(1000);
  assert.equal(h.document.targets[0].getAttribute('data-menu-contour'), 'ready');
  assert.equal(h.shadow.targets[0].getAttribute('data-menu-contour'), 'ready');
  assert.equal(h.document.targets[23].getAttribute('data-menu-contour'), 'pending', 'offscreen targets consume no drawing loop');
  assert.equal(h.document.head.children.length, 1);
  assert.equal(h.shadow.children.filter(node => node.tag === 'style').length, 1);
  const target = h.shadow.targets[0], canvas = target.children[0];
  assert.equal(canvas.getAttribute('aria-hidden'), 'true');
  assert.equal(canvas.width, (74 + 32) * 3);
  assert.equal(canvas.values.get('width'), '106px', 'a scaled parent cannot shrink or double the local canvas geometry');
  const writes = target.attributeWrites;
  h.step(1200);
  assert.equal(target.attributeWrites, writes, 'animation frames must not cause weather DOM-observer feedback');
  api.dispose();
});

test('one contour loop pauses offscreen and hidden, restores through BFCache and cleans replaced controls', async () => {
  const h = contourEnvironment();
  const api = initMenuContours(h.environment);
  h.step(0);
  const intersection = h.observers.intersection[0];
  const targets = [...h.document.targets, ...h.shadow.targets];
  intersection.emit(targets.map(target => ({ target, isIntersecting: false })));
  assert.equal(h.frames.size, 0);
  intersection.emit([{ target: targets[0], isIntersecting: true }]);
  assert.equal(h.frames.size, 1);
  h.document.hidden = true; h.document.fire('visibilitychange');
  assert.equal(h.frames.size, 0);
  h.document.hidden = false; h.document.fire('visibilitychange');
  h.window.fire('pagehide', { persisted: true });
  assert.equal(h.frames.size, 0);
  assert.equal(api.getDiagnostics().bound, 2);
  h.window.fire('pageshow', { persisted: true });
  assert.equal(h.frames.size, 1);
  const previous = h.shadow.targets[0]; previous.isConnected = false;
  h.shadow.targets = [h.makeTarget(h.shadow, 100, 100, 18)];
  h.observers.mutation.at(-1).emit([]);
  await Promise.resolve();
  assert.equal(api.getDiagnostics().bound, 2);
  assert.equal(previous.children.length, 0);
  assert.equal(intersection.targets.has(previous), false);
  h.step(100);
  assert.equal(h.shadow.targets[0].getAttribute('data-menu-contour'), 'ready');
  h.window.fire('pagehide', { persisted: false });
  api.refresh();
  assert.equal(api.getDiagnostics().bound, 0);
  assert.equal(h.frames.size, 0);
  assert.ok(Object.values(h.observers).flat().every(observer => observer.disconnected));
});

test('without observer APIs visibility and text-size changes recover on explicit scans and viewport resize', async () => {
  const h = contourEnvironment({ count: 3 });
  delete h.environment.IntersectionObserver;
  delete h.environment.ResizeObserver;
  const api = initMenuContours(h.environment);
  h.step(0);
  for (const target of [...h.document.targets, ...h.shadow.targets]) target.top = 2000;
  h.window.fire('resize');
  assert.equal(h.frames.size, 0);
  const target = h.document.targets[2];
  target.top = 100;
  h.window.fire('resize');
  assert.equal(h.frames.size, 1);
  h.step(100);
  assert.equal(target.getAttribute('data-menu-contour'), 'ready');
  target.offsetWidth = 220;
  h.observers.mutation[0].emit([]);
  await Promise.resolve();
  h.step(200);
  assert.equal(target.children[0].width, (220 + 32) * 3);
  api.dispose();
});

test('resize preserves crisp backing dimensions and an unsuccessful paint keeps the old rim available', () => {
  const h = contourEnvironment();
  const api = initMenuContours(h.environment);
  h.step(0);
  const target = h.document.targets[0], canvas = target.children[0];
  target.offsetWidth = 200;
  h.observers.resize[0].emit([{ target }]);
  h.step(10);
  assert.equal(canvas.width, 232 * 3);
  assert.equal(canvas.values.get('width'), '232px');
  api.dispose();
  const failed = contourEnvironment({ contextFailure: true });
  const recovery = initMenuContours(failed.environment);
  failed.step(0);
  assert.equal(failed.document.targets[0].getAttribute('data-menu-contour'), null);
  assert.equal(failed.frames.size, 0);
  recovery.refresh();
  assert.equal(recovery.getDiagnostics().bound, 0, 'a failed decoration cannot enter a DOM-observer retry loop');
  recovery.dispose();
});

test('the exact assistant palette and computed periods feed the reusable contour without depending on its visibility', () => {
  const assistant = readFileSync(new URL('../assets/js/ai-chat.js', import.meta.url), 'utf8');
  const colors = new Function(`return [${assistant.match(/const rimColors = \[([^]*?)\];/)[1]}];`)();
  assert.deepEqual(MENU_CONTOUR_COLORS, colors);
  const document = {
    querySelectorAll: () => colors.map(color => ({ getAttribute: () => color })), querySelector: () => ({ hidden: true }),
  };
  const reference = readContourReference(document, { getComputedStyle: () => ({ animationDuration: '6.4s, 12.8s' }) });
  assert.deepEqual(reference, { colors, cycleMs: 6400, hueMs: 12800 });
});

test('the optional contour bootstrap preserves the script cache query and contains rejected imports', async () => {
  const assistant = readFileSync(new URL('../assets/js/ai-chat.js', import.meta.url), 'utf8');
  const setup = assistant.match(/  const contourModuleUrl = [^\n]+\n  contourModuleUrl.search = [^\n]+/)[0];
  const resolve = new Function('document', 'window', `${setup}; return contourModuleUrl.href;`);
  const href = resolve({ currentScript: { src: 'https://example.test/assets/js/ai-chat.js?v=release-123&channel=preview' } }, { location: { href: 'https://example.test/ru/' } });
  assert.equal(href, 'https://example.test/assets/js/menu-contour.js?v=release-123&channel=preview');
  assert.equal(resolve({ currentScript: null }, { location: { href: 'https://example.test/ru/?v=page' } }), 'https://example.test/assets/js/menu-contour.js');
  const bootstrap = assistant.match(/  const startMenuContours = \(\) => \{[^]*?\n  \};/)[0].replace('import(', 'load(');
  const start = new Function('contourModuleUrl', 'load', `${bootstrap}; return startMenuContours;`);
  let initializations = 0;
  start(new URL(href), async () => ({ initMenuContours: () => { initializations += 1; } }))();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(initializations, 1);
  start(new URL(href), async () => { throw Error('Optional import unavailable'); })();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(initializations, 1);
});
