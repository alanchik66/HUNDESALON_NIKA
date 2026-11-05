import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { capsulePoint, contourHalfWidth, buildContourFrame, contourGradientStops, readContourReference, initMenuContours,
  MENU_CONTOUR_COLORS, MENU_CONTOUR_TIMING, MENU_CONTOUR_FILTER } from '../assets/js/menu-contour.js';

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

function contourEnvironment({ count = 1, contextFailure = false, assistantWidth } = {}) {
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
    const statistics = { draws: 0, transforms: [], fills: [], gradients: [] };
    const states = [], names = ['globalAlpha', 'globalCompositeOperation', 'fillStyle', 'shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY'];
    let transform = [1, 0, 0, 1, 0, 0], points = [];
    const point = (x, y) => [transform[0] * x + transform[2] * y + transform[4], transform[1] * x + transform[3] * y + transform[5]];
    const gradient = (kind, coordinates) => {
      const value = { kind, coordinates, stops: [], addColorStop(offset, color) {
        assert.ok(Number.isFinite(offset) && offset >= 0 && offset <= 1);
        this.stops.push({ offset, color });
      } };
      statistics.gradients.push(value);
      return value;
    };
    const target = {
      statistics,
      globalAlpha: 1, globalCompositeOperation: 'source-over', shadowColor: 'transparent', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
      clearRect() { if (contextFailure) throw Error('Canvas disabled'); statistics.draws += 1; },
      setTransform(...values) { statistics.transforms.push(values); transform = values; },
      translate(x, y) { const [px, py] = point(x, y); transform = [...transform.slice(0, 4), px, py]; },
      scale(x, y) { transform = [transform[0] * x, transform[1] * x, transform[2] * y, transform[3] * y, ...transform.slice(4)]; },
      save() { states.push({ transform: [...transform], values: names.map(name => this[name]) }); },
      restore() { const state = states.pop(); transform = state.transform; names.forEach((name, index) => { this[name] = state.values[index]; }); },
      beginPath() { points = []; }, moveTo(x, y) { points.push(point(x, y)); }, lineTo(x, y) { points.push(point(x, y)); },
      fill() { statistics.fills.push({ points: [...points], transform: [...transform], ...Object.fromEntries(names.map(name => [name, this[name]])) }); },
      createLinearGradient: (...values) => gradient('linear', values), createRadialGradient: (...values) => gradient('radial', values),
    };
    const context = new Proxy(target, { get: (value, name) => name in value ? value[name] : () => {} });
    return context;
  };
  const makeAssistant = width => ({ width, filter: MENU_CONTOUR_FILTER,
    rim: { getBoundingClientRect() { throw Error('A hover-transformed box is not the reference geometry'); } }, trace: {} });
  let assistant = assistantWidth == null ? null : makeAssistant(assistantWidth);
  document.head = new Node('head'); document.documentElement = new Node('html');
  document.createElement = tag => {
    const node = new Node(tag);
    if (tag === 'canvas') { node.context = makeContext(); node.getContext = () => node.context; }
    return node;
  };
  document.querySelector = selector => selector === 'style[data-menu-contour-styles]' ? document.head.querySelector(selector)
    : selector === '#hundesalon-ai-chat .hn-ai-launcher-rim' ? assistant?.rim || null
      : selector === '#hundesalon-ai-chat .hn-ai-launcher-rim-trace' ? assistant?.trace || null : null;
  document.querySelectorAll = selector => selector === '[data-price-breeds-toggle]' ? document.targets.filter(target => target.isConnected)
    : selector === '.header-weather-widget[data-weather-widget]' ? document.hosts.filter(host => host.isConnected)
      : assistant && selector === '#hundesalon-ai-chat .hn-ai-launcher-rim linearGradient stop'
        ? MENU_CONTOUR_COLORS.map(color => ({ getAttribute: () => color })) : [];
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
    getComputedStyle: node => node === assistant?.rim ? { width: `${assistant.width}px`, filter: assistant.filter }
      : node === assistant?.trace ? { animationDuration: '6.4s, 12.8s' }
        : { borderLeftWidth: '1px', borderTopWidth: '1px', getPropertyValue: () => '' },
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
    get assistant() { return assistant; }, mountAssistant(width) { assistant = makeAssistant(width); return assistant; },
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
  assert.deepEqual(reference, { colors, cycleMs: 6400, hueMs: 12800,
    scale: 0.325 / 0.48, halfWidth: 0.325, filter: MENU_CONTOUR_FILTER });
});

test('a hidden reference resolves its SVG percentage width through definite CSS geometry without using a transformed box', () => {
  const parent = {}, rim = { parentElement: parent, viewBox: { baseVal: { width: 100 } },
    getBoundingClientRect() { throw Error('Hidden or hovered bounds cannot calibrate the ribbon'); } }, trace = {};
  const document = { querySelectorAll: () => [], querySelector: selector => selector.endsWith('-trace') ? trace : rim };
  const reference = readContourReference(document, { getComputedStyle: node => node === parent ? { width: '44px' }
    : node === rim ? { width: 'calc(100% + 7.0375px)', left: '-3.51875px', filter: MENU_CONTOUR_FILTER }
      : { animationDuration: '6.4s, 12.8s' } });
  assert.equal(reference.scale, .510375);
  assert.equal(reference.halfWidth, .24498);
});

test('the actual draw paints one source-over RGB core per side and only a blurred native trail at every backing ratio', () => {
  for (const ratio of [1, 2.5, 3]) {
    const h = contourEnvironment({ assistantWidth: 51.0375 });
    h.window.devicePixelRatio = ratio;
    const api = initMenuContours(h.environment);
    h.step(0); h.step(3200);
    for (const target of [h.document.targets[0], h.shadow.targets[0]]) {
      const canvas = target.children[0], fills = canvas.context.statistics.fills;
      const cores = fills.filter(fill => fill.fillStyle?.kind === 'linear');
      const trails = fills.filter(fill => fill.fillStyle === '#00e897');
      assert.equal(cores.length, 2, 'each mirrored RGB core is filled once, not once per shadow');
      assert.equal(trails.length, 2);
      assert.ok(fills.every(fill => fill.globalCompositeOperation === 'source-over'), 'additive painting must not whiten the core or its antialiased edge');
      assert.equal(canvas.values.get('--menu-contour-filter'), MENU_CONTOUR_FILTER, 'the assistant group filter applies after complete canvas composition');
      const expected = buildContourFrame(target.offsetWidth - 1, target.offsetHeight - 1, 3200, MENU_CONTOUR_TIMING, .48 * .510375);
      for (let side = 0; side < 2; side += 1) {
        const core = cores[side], trail = trails[side];
        assert.equal(core.shadowBlur, 0); assert.equal(core.shadowColor, 'transparent');
        assert.equal(core.globalAlpha, 1);
        const outer = core.points[16], inner = core.points[49];
        assert.ok(Math.abs(Math.hypot(outer[0] - inner[0], outer[1] - inner[1]) / ratio - 2 * .48 * .510375) < 1e-10, 'real drawn width must follow the measured assistant SVG scale');
        assert.ok(trail.points.every(([x]) => x < 0), 'the solid trail source stays outside the bitmap');
        assert.ok(Math.abs(trail.shadowBlur - 2 * 1.3 * .510375 * ratio) < 1e-12, 'native shadow sigma matches the reference SVG blur');
        trail.points.forEach(([x, y], index) => {
          assert.ok(Math.abs((x + trail.shadowOffsetX) / ratio - expected.branches[side].trail[index][0] - 16.5) < 1e-9);
          assert.ok(Math.abs(y / ratio - expected.branches[side].trail[index][1] - 16.5) < 1e-9);
        });
      }
      const [left, right] = cores.map(fill => fill.fillStyle);
      assert.deepEqual(left.stops, right.stops, 'both mirrored ribbons carry the same complete colour spectrum');
      assert.ok(Math.abs(left.coordinates[0] + right.coordinates[0] - (target.offsetWidth - 1)) < 1e-9);
      assert.ok(Math.abs(left.coordinates[2] + right.coordinates[2] - (target.offsetWidth - 1)) < 1e-9);
      assert.equal(left.coordinates[1], right.coordinates[1]);
      assert.equal(left.coordinates[3], right.coordinates[3]);
    }
    api.dispose();
  }
});

test('gradient anchors continue behind the half-path clips instead of stretching the palette over a visible fragment', () => {
  for (const [width, height] of [[240, 44], [74, 18], [64, 64]]) for (const phase of [.02, .5, .87, .98]) {
    const [left, right] = buildContourFrame(width, height, phase * 6400).branches;
    for (const end of ['start', 'end']) {
      assert.ok(Math.abs(left.gradient[end].x + right.gradient[end].x - width) < 1e-9);
      assert.equal(left.gradient[end].y, right.gradient[end].y);
    }
    if (phase === .02) assert.ok(left.gradient.start.x > width / 2, 'the entering tail still anchors on the hidden opposite half');
    if (phase >= .87) assert.ok(left.gradient.end.x > width / 2, 'the exiting head continues beyond the top midpoint');
  }
});

test('CSS hue-rotate preserves its sRGB matrix and gamut crossings between palette stops', () => {
  const stops = contourGradientStops(['rgb(255, 0, 0)', 'rgb(0, 0, 255)'], 90);
  const parse = color => color.match(/[\d.e+-]+/g).map(Number);
  const sample = offset => {
    let index = 1;
    while (index < stops.length - 1 && stops[index].offset < offset) index += 1;
    const left = stops[index - 1], right = stops[index];
    const progress = (offset - left.offset) / (right.offset - left.offset);
    const from = parse(left.color), to = parse(right.color);
    return from.map((value, channel) => value + (to[channel] - value) * progress);
  };
  // W3C hueRotate matrix at 90deg, applied to the interpolated red/blue input.
  // Rotating/clamping only the two endpoints would give a different mid-colour.
  for (const [offset, expected] of [[0, [0, 90.78, 0]], [.5, [127.5, 18.4875, 0]], [.75, [191.25, 0, 0]], [.9, [229.5, 0, 18.411]], [1, [255, 0, 36.72]]]) {
    sample(offset).forEach((value, channel) => assert.ok(Math.abs(value - expected[channel]) < 1e-8));
  }
  assert.ok(stops.some(stop => Math.abs(stop.offset - .356 / .567) < 1e-12));
  assert.ok(stops.some(stop => Math.abs(stop.offset - .574 / .718) < 1e-12));
  assert.ok(stops.every((stop, index) => stop.offset >= 0 && stop.offset <= 1 && (!index || stop.offset >= stops[index - 1].offset)));
});

test('late mounting, target and viewport resize recalibrate width without reading hover-transformed bounds', async () => {
  const h = contourEnvironment();
  const api = initMenuContours(h.environment);
  h.step(0); h.step(3200);
  const context = h.document.targets[0].children[0].context;
  const drawnWidth = () => {
    const core = context.statistics.fills.filter(fill => fill.fillStyle?.kind === 'linear').at(-1);
    return Math.hypot(core.points[16][0] - core.points[49][0], core.points[16][1] - core.points[49][1]) / 3;
  };
  assert.ok(Math.abs(drawnWidth() - .65) < 1e-10, 'a not-yet-mounted assistant uses the compatible fallback');
  h.mountAssistant(51.0375);
  h.observers.mutation[0].emit([]); await Promise.resolve(); h.step(3300);
  assert.ok(Math.abs(drawnWidth() - .48996) < 1e-10);
  h.assistant.width = 68.24;
  h.observers.resize[0].emit([{ target: h.document.targets[0] }]); h.step(3400);
  assert.ok(Math.abs(drawnWidth() - .655104) < 1e-10, 'the untransformed computed SVG width updates after viewport changes');
  h.assistant.width = 51.0375;
  h.window.fire('resize'); h.step(3500);
  assert.ok(Math.abs(drawnWidth() - .48996) < 1e-10);
  api.dispose();
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
