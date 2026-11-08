import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../assets/js/header-weather-rain-layer.js', import.meta.url), 'utf8');
const { createHeaderWeatherRainLayer } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function fixture({ width = 375, height = 140, reduced = false, contextAvailable = true, observerError = false } = {}) {
  const events = new Map(), mediaEvents = new Set(), queue = new Map(), calls = [], strokes = [];
  let id = 0;
  const style = { cssText: '', values: new Map(), setProperty(key, value, priority) { this.values.set(key, { value, priority }); } };
  const context = {
    clears: 0, paints: 0, points: [], transforms: [],
    setTransform(...args) { this.transforms.push(args); },
    clearRect() { this.clears++; strokes.length = 0; },
    createLinearGradient(...coordinates) { const stops = []; return { coordinates, stops, addColorStop(...stop) { stops.push(stop); } }; },
    beginPath() { this.points = []; }, moveTo(x, y) { this.points.push([x, y]); }, lineTo(x, y) { this.points.push([x, y]); },
    stroke() { this.paints++; strokes.push({ points: this.points.map(point => [...point]), width: this.lineWidth, color: this.strokeStyle }); },
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
  return { canvas, container, context, calls, strokes, events, media, mediaEvents, queue, observers,
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
  assert.ok(gradients.length > 5); assert.equal(gradients[0].color.stops[0][1], 'rgba(203,225,239,0)');
  assert.ok(gradients.every(stroke => stroke.points.flat().every(Number.isFinite)));
  layer.dispose();
});

test('weather mapping changes density and wind slope while invalid extremes remain finite', () => {
  const f = fixture({ width: 700, height: 220 }), layer = createHeaderWeatherRainLayer(f.container, { ...rainy, precipitationMm: 0, windKph: 0 });
  const drizzle = f.strokes.length;
  layer.update({ ...rainy, precipitationMm: 100, windKph: 180 });
  assert.ok(f.strokes.length > drizzle);
  const downwind = f.strokes.filter(stroke => typeof stroke.color === 'object');
  assert.ok(downwind.every(stroke => stroke.points[1][0] < stroke.points[0][0]));
  layer.update({ ...rainy, precipitationMm: Infinity, windKph: NaN, windDegree: -1080 });
  assert.ok(f.strokes.every(stroke => stroke.points.flat().every(Number.isFinite)));
  assert.doesNotThrow(() => layer.update({ kind: 'rain', windKph: Symbol('invalid'), windDegree: {}, precipitationMm: [] }));
  layer.update(null); assert.equal(f.queue.size, 0); assert.equal(f.canvas.style.values.get('display').value, 'none');
  layer.dispose();
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
