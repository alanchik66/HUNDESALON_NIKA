import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../assets/js/header-weather-rain-layer.js', import.meta.url), 'utf8');
const { createHeaderWeatherRainLayer } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function fixture({ width = 375, height = 140, reduced = false, contextAvailable = true, observerError = false } = {}) {
  const events = new Map(), mediaEvents = new Set(), queue = new Map(), calls = [], strokes = [], fills = [];
  let id = 0;
  const style = { cssText: '', values: new Map(), setProperty(key, value, priority) { this.values.set(key, { value, priority }); } };
  const context = {
    clears: 0, paints: 0, points: [], transforms: [],
    setTransform(...args) { this.transforms.push(args); },
    clearRect() { this.clears++; strokes.length = 0; fills.length = 0; },
    createLinearGradient(...coordinates) { const stops = []; return { coordinates, stops, addColorStop(...stop) { stops.push(stop); } }; },
    createRadialGradient(...coordinates) { return this.createLinearGradient(...coordinates); },
    beginPath() { this.points = []; }, moveTo(x, y) { this.points.push([x, y]); }, lineTo(x, y) { this.points.push([x, y]); },
    stroke() { this.paints++; strokes.push({ points: this.points.map(point => [...point]), width: this.lineWidth, color: this.strokeStyle }); },
    ellipse(...args) { this.points.push(args); },
    fill() { this.paints++; fills.push({ ellipses: this.points.map(point => [...point]), color: this.fillStyle }); },
  };
  const canvas = { style, dataset: {}, attributes: {}, setAttribute(key, value) { this.attributes[key] = value; }, getContext(type) { calls.push(type); return contextAvailable ? context : null; }, remove() { container.children = container.children.filter(n => n !== this); } };
  const media = { matches: reduced, addEventListener(_, listener) { mediaEvents.add(listener); }, removeEventListener(_, listener) { mediaEvents.delete(listener); } };
  const observers = [];
  class Observer {
    constructor(callback) { if (observerError === true || observerError === observers.length + 1) throw new Error('observer failed'); this.callback = callback; observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.disconnected = true; }
  }
  const view = { innerWidth: 1440, innerHeight: 900, devicePixelRatio: 3, matchMedia: () => media, ResizeObserver: Observer, IntersectionObserver: Observer,
    requestAnimationFrame(callback) { queue.set(++id, callback); return id; }, cancelAnimationFrame(token) { queue.delete(token); }, addEventListener() {}, removeEventListener() {} };
  const document = { hidden: false, visibilityState: 'visible', defaultView: view, createElement(type) { assert.equal(type, 'canvas'); return canvas; }, addEventListener(name, listener) { events.set(name, listener); }, removeEventListener(name) { events.delete(name); } };
  const container = { ownerDocument: document, children: [{ name: 'existing child' }], width, height, appendChild(node) { this.children.push(node); }, getBoundingClientRect() { return { width: this.width, height: this.height, left: 0, top: 0, right: this.width, bottom: this.height }; } };
  return { canvas, container, context, calls, strokes, fills, events, media, mediaEvents, queue, observers,
    frame(time) { const callbacks = [...queue.values()]; queue.clear(); for (const callback of callbacks) callback(time); },
    reduce(value) { media.matches = value; for (const listener of mediaEvents) listener(); },
    visible(value) { document.hidden = !value; document.visibilityState = value ? 'visible' : 'hidden'; events.get('visibilitychange')?.(); },
    intersect(value) { observers[1].callback([{ target: container, isIntersecting: value }]); },
  };
}

const rainy = { kind: 'rain', precipitationMm: 3, windKph: 25, windDegree: 90 };

test('native transparent canvas owns only its leaf, caps DPR, and overrides generic weather CSS', () => {
  const f = fixture(), layer = createHeaderWeatherRainLayer(f.container, rainy);
  assert.deepEqual(f.calls, ['2d']); assert.equal(f.canvas.dataset.weatherLayer, 'rain'); assert.equal(f.canvas.attributes['aria-hidden'], 'true');
  assert.equal(f.canvas.width, 750); assert.equal(f.canvas.height, 280); assert.deepEqual(f.context.transforms[0], [2, 0, 0, 2, 0, 0]);
  for (const property of ['pointer-events:none!important', 'z-index:200!important', 'transform:none!important', 'filter:none!important', 'mix-blend-mode:normal!important']) assert.ok(f.canvas.style.cssText.includes(property));
  assert.ok(f.strokes.length > 5); assert.equal(f.queue.size, 1);
  layer.dispose(); assert.equal(f.container.children.length, 1); assert.equal(f.container.children[0].name, 'existing child');
});

test('actual drawing commands move at at most30fps and contain varied gradient trails', () => {
  const f = fixture(), layer = createHeaderWeatherRainLayer(f.container, rainy), initial = f.strokes.map(stroke => stroke.points.map(point => [...point]));
  const paints = f.context.paints;
  f.frame(0); f.frame(16); assert.equal(f.context.paints, paints);
  f.frame(34); assert.notDeepEqual(f.strokes.map(stroke => stroke.points), initial);
  assert.ok(new Set(f.strokes.map(stroke => stroke.width)).size > 3);
  const gradients = f.strokes.filter(stroke => typeof stroke.color === 'object');
  assert.ok(gradients.length > 5); assert.match(gradients[0].color.stops[0][1], /,0\)$/);
  assert.ok(gradients.every(stroke => stroke.points.flat().every(Number.isFinite)));
  assert.ok(f.fills.length > 5, 'rain has tiny optical heads rather than only long needles');
  assert.ok(gradients.every(stroke => Math.hypot(stroke.points[1][0] - stroke.points[0][0], stroke.points[1][1] - stroke.points[0][1]) < 13));
  assert.ok(f.fills.every(fill => fill.ellipses[0][2] < 1 && fill.ellipses[0][3] < 1));
  layer.dispose();
});

test('weather mapping changes density and wind slope while invalid extremes remain finite', () => {
  const f = fixture({ width: 700, height: 220 }), layer = createHeaderWeatherRainLayer(f.container, { ...rainy, precipitationMm: 0, windKph: 0 });
  const drizzle = f.strokes.length;
  layer.update({ ...rainy, precipitationMm: 100, windKph: 180 });
  f.frame(0); for (let time = 40; time <= 1200; time += 40) f.frame(time);
  assert.ok(f.strokes.length > drizzle);
  const downwind = f.strokes.filter(stroke => typeof stroke.color === 'object');
  assert.ok(downwind.every(stroke => stroke.points[1][0] < stroke.points[0][0]));
  layer.update({ ...rainy, precipitationMm: Infinity, windKph: NaN, windDegree: -1080 });
  assert.ok(f.strokes.every(stroke => stroke.points.flat().every(Number.isFinite)));
  assert.doesNotThrow(() => layer.update({ kind: 'rain', windKph: Symbol('invalid'), windDegree: {}, precipitationMm: [] }));
  layer.update(null); assert.equal(f.queue.size, 0); assert.equal(f.canvas.style.values.get('display').value, 'none');
  layer.dispose();
});

test('changing wind and intensity preserves live positions and fades new drops in', () => {
  const f = fixture(), layer = createHeaderWeatherRainLayer(f.container, { ...rainy, precipitationMm: .2, windKph: 0 });
  f.frame(0); f.frame(40);
  const before = f.strokes.map(stroke => [...stroke.points[1]]), count = f.strokes.length;
  layer.update({ ...rainy, precipitationMm: 20, windDegree: 270, windKph: 90 });
  assert.deepEqual(f.strokes.map(stroke => stroke.points[1]), before, 'weather refresh must not recompute phase positions');
  assert.equal(f.strokes.length, count, 'density does not pop to the new count on refresh');
  f.frame(80);
  assert.ok(f.strokes.length > count);
  for (let index = 0; index < before.length; index++) {
    const [x, y] = before[index];
    if (x > 30 && x < 340 && y > 0 && y < 110) assert.ok(Math.hypot(f.strokes[index].points[1][0] - x, f.strokes[index].points[1][1] - y) < 25);
  }
  layer.dispose();
});

test('drizzle, rain and hail have distinct density and shapes without an invented ground plane', () => {
  const drizzle = fixture(), rain = fixture(), hail = fixture();
  const layers = [
    createHeaderWeatherRainLayer(drizzle.container, { kind: 'drizzle', precipitationMm: .2 }),
    createHeaderWeatherRainLayer(rain.container, { kind: 'rain', precipitationMm: 12 }),
    createHeaderWeatherRainLayer(hail.container, { kind: 'hail', precipitationMm: null, intensity: 'heavy' }),
  ];
  assert.ok(rain.strokes.length > drizzle.strokes.length * 2);
  const longest = f => Math.max(...f.strokes.map(stroke => stroke.points[1][1] - stroke.points[0][1]));
  assert.ok(longest(drizzle) < longest(rain));
  assert.equal(hail.fills.length, hail.strokes.length * 2, 'ice pellets have their own body and a separate glint');
  assert.ok(hail.fills.some(fill => fill.ellipses[0][2] > 1));
  assert.ok([drizzle, rain, hail].every(f => f.strokes.every(stroke => stroke.points.length === 2)), 'there are no synthetic splash chevrons at the sky boundary');
  layers.forEach(layer => layer.dispose());
});

test('wet snow combines drifting soft flakes and finer raindrops, and showers vary density over time', () => {
  const mixed = fixture(), steady = fixture(), shower = fixture();
  const layers = [
    createHeaderWeatherRainLayer(mixed.container, { ...rainy, kind: 'mixed' }),
    createHeaderWeatherRainLayer(steady.container, rainy),
    createHeaderWeatherRainLayer(shower.container, { ...rainy, showers: true }),
  ];
  try {
    assert.ok(mixed.strokes.length > 5);
    assert.ok(mixed.strokes.length < steady.strokes.length);
    const flakes = mixed.fills.filter(fill => typeof fill.color === 'object');
    assert.ok(flakes.length > 5);
    assert.ok(flakes.some(fill => fill.ellipses[0][2] > 1));
    assert.ok(flakes.every(fill => fill.color.stops.at(-1)[1].endsWith(',0)')));
    const start = [...flakes[0].ellipses[0].slice(0, 2)];
    const startRainY = mixed.strokes[0].points[1][1];
    mixed.frame(0); mixed.frame(40);
    const currentFlake = mixed.fills.find(fill => typeof fill.color === 'object').ellipses[0];
    assert.ok(Math.abs(currentFlake[1] - start[1]) < Math.abs(mixed.strokes[0].points[1][1] - startRainY));
    assert.equal(steady.strokes.length, shower.strokes.length);
    for (let time = 0; time <= 2200; time += 40) { steady.frame(time); shower.frame(time); }
    assert.ok(shower.strokes.length > steady.strokes.length);
    for (let time = 2240; time <= 7300; time += 40) { steady.frame(time); shower.frame(time); }
    assert.ok(shower.strokes.length < steady.strokes.length);
  } finally {
    layers.forEach(layer => layer.dispose());
  }
});

test('missing rates respect the category while numeric rates control density and unsupported kinds stay clear', () => {
  const light = fixture(), heavy = fixture(), measured = fixture(), clear = fixture();
  const layers = [
    createHeaderWeatherRainLayer(light.container, { kind: 'rain', precipitationMm: null, intensity: 'light' }),
    createHeaderWeatherRainLayer(heavy.container, { kind: 'rain', precipitationMm: null, intensity: 'heavy' }),
    createHeaderWeatherRainLayer(measured.container, { kind: 'rain', precipitationMm: .1, intensity: 'heavy' }),
    createHeaderWeatherRainLayer(clear.container, { kind: 'snow', precipitationMm: 20 }),
  ];
  assert.ok(heavy.strokes.length > light.strokes.length);
  assert.ok(measured.strokes.length < light.strokes.length, 'known rate takes precedence over categorical fallback');
  assert.equal(clear.strokes.length, 0); assert.equal(clear.queue.size, 0); assert.equal(clear.canvas.hidden, true);
  layers.forEach(layer => layer.dispose());
});

test('rain→clear→rain clears, hides, and resumes without accumulating animation loops', () => {
  const f = fixture(), layer = createHeaderWeatherRainLayer(f.container, rainy);
  layer.update({ kind: 'none' });
  assert.equal(f.queue.size, 0); assert.equal(f.strokes.length, 0); assert.equal(f.canvas.hidden, true);
  assert.deepEqual(f.canvas.style.values.get('visibility'), { value: 'hidden', priority: 'important' });
  layer.update(rainy); layer.update(rainy); assert.equal(f.queue.size, 1); assert.equal(f.canvas.hidden, false);
  layer.dispose(); layer.dispose(); layer.update(rainy); assert.equal(f.queue.size, 0);
});

test('visibility, viewport intersection, and reduced motion suspend with a static frame', () => {
  const f = fixture(), layer = createHeaderWeatherRainLayer(f.container, rainy);
  f.visible(false); assert.equal(f.queue.size, 0);
  const paints = f.context.paints; f.frame(5000); assert.equal(f.context.paints, paints);
  f.visible(true); assert.equal(f.queue.size, 1);
  f.intersect(false); assert.equal(f.queue.size, 0);
  f.intersect(true); assert.equal(f.queue.size, 1);
  f.reduce(true); assert.equal(f.queue.size, 0); assert.ok(f.context.paints > paints);
  f.reduce(false); assert.equal(f.queue.size, 1);
  layer.dispose(); assert.equal(f.events.size, 0); assert.equal(f.mediaEvents.size, 0); assert.ok(f.observers.every(o => o.disconnected));
});

test('initial reduced motion paints once and resize updates physical pixels without a timer', () => {
  const f = fixture({ reduced: true }), layer = createHeaderWeatherRainLayer(f.container, rainy);
  assert.ok(f.strokes.length > 0); assert.equal(f.queue.size, 0);
  const paints = f.context.paints; layer.update(rainy); assert.equal(f.context.paints, paints);
  f.container.width = 200; f.container.height = 100; f.observers[0].callback();
  assert.equal(f.canvas.width, 400); assert.equal(f.canvas.height, 200); assert.equal(f.queue.size, 0);
  layer.dispose();
});

test('reduced motion still refreshes a static density and wind direction from new weather', () => {
  const f = fixture({ reduced: true }), layer = createHeaderWeatherRainLayer(f.container, { kind: 'rain', precipitationMm: .1, windKph: 0 });
  const light = f.strokes.length;
  layer.update({ kind: 'rain', precipitationMm: 30, windKph: 80, windDegree: 90 });
  assert.ok(f.strokes.length > light);
  assert.ok(f.strokes.every(stroke => stroke.points[1][0] < stroke.points[0][0]));
  assert.equal(f.queue.size, 0);
  layer.dispose();
});

test('unavailable2D and partial observer setup throw after releasing only owned resources', () => {
  const unavailable = fixture({ contextAvailable: false });
  assert.throws(() => createHeaderWeatherRainLayer(unavailable.container, rainy), /canvas unavailable/);
  assert.equal(unavailable.container.children.length, 1);
  const partial = fixture({ observerError: 2 });
  assert.throws(() => createHeaderWeatherRainLayer(partial.container, rainy), /observer failed/);
  assert.equal(partial.container.children.length, 1); assert.equal(partial.events.size, 0); assert.equal(partial.mediaEvents.size, 0); assert.equal(partial.queue.size, 0);
  assert.ok(partial.observers[0].disconnected);
});

test('a detached container stops its own frame immediately before observer delivery', () => {
  const f = fixture(), layer = createHeaderWeatherRainLayer(f.container, rainy);
  f.container.isConnected = false; f.frame(100); assert.equal(f.queue.size, 0);
  layer.update(rainy); assert.equal(f.canvas.hidden, true); assert.equal(f.queue.size, 0);
  layer.dispose();
});
