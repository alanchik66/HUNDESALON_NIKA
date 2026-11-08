import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'espree';
import * as cloud from '../assets/js/weather-cloud-motion.js';
import { resolveForecastCloudCover, resolveForecastNoonMs, resolveWeatherSceneFallback } from '../3d-weather-codrops-main/src/weather-lifecycle.mjs';

const cloudy = (cover, layers) => ({ current: { cloud: cover, condition: { code: 1009, text: 'Overcast' } },
  weatherMeta: { cloudLayers: layers } });
const layers = (low, mid, high) => ({ low, mid, high, total: 100, source: 'met-norway-locationforecast', validTime: '2026-11-07T10:00:00Z' });

test('numeric cloud coverage controls strength and unknown coverage never becomes false clear', async () => {
  const clear = cloud.resolveCloudAppearance(cloudy(0)), partial = cloud.resolveCloudAppearance(cloudy(35)), full = cloud.resolveCloudAppearance(cloudy(100));
  assert.equal(clear.opacity, 0);
  assert.ok(partial.opacity > 0 && partial.opacity < full.opacity && full.opacity < .7);
  assert.equal(clear.measured, true);
  assert.equal(cloud.resolveCloudAppearance(cloudy(null)).measured, false);
  assert.ok(cloud.resolveCloudAppearance(cloudy(null)).opacity > 0);
  assert.equal(cloud.resolveCloudAppearance({ current: { cloud: null }, weatherMeta: { cloudCover: 0 } }).opacity, 0);
  assert.equal(cloud.resolveCloudAppearance(cloudy(false)).measured, false);
  assert.equal(cloud.resolveCloudAppearance(cloudy([])).measured, false);
  await new Promise(resolve => setImmediate(resolve)); // The optional enhancement never delays core module exports.
  assert.equal(resolveWeatherSceneFallback(cloudy(0)).clouds, false);
  assert.equal(resolveWeatherSceneFallback({ current: { cloud: 45, condition: { code: 1000, text: 'Clear sky' } } }).clouds, true);
});

test('a rejected optional cloud asset cannot prevent core weather loading or its static recovery', async () => {
  const temporaryRoot = resolve(tmpdir());
  const directory = await mkdtemp(join(temporaryRoot, 'weather-cloud-optional-'));
  try {
    const file = join(directory, '3d-weather-codrops-main/src/weather-lifecycle.mjs');
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, await readFile(new URL('../3d-weather-codrops-main/src/weather-lifecycle.mjs', import.meta.url)));
    // This real ESM copy has no assets/js sibling: its actual dynamic import rejects.
    const lifecycle = await import(`${pathToFileURL(file).href}?v=missing-cloud-asset`);
    const now = Date.parse('2026-11-07T10:00:00Z');
    const payload = { ...cloudy(75), location: { tz_id: 'UTC' }, forecast: { forecastday: [7, 8, 9, 10].map(day => ({ date: `2026-11-${String(day).padStart(2, '0')}`, day: {} })) } };
    const controller = lifecycle.createWeatherController({ service: { getCurrentWeather: async () => payload }, now: () => now });
    assert.equal(await controller.setLocation('public QA city'), payload);
    assert.equal(controller.getState().loading, false);
    assert.equal(controller.getState().error, null);
    assert.equal(lifecycle.resolveWeatherSceneFallback(payload).clouds, true);
    assert.equal(lifecycle.resolveWeatherSceneFallback({ current: { condition: { code: 1000, text: 'Clear sky' } } }).clouds, false);
    controller.dispose();
  } finally {
    assert.equal(dirname(directory), temporaryRoot, 'remove only the exact fixture directory created in the OS temporary directory');
    await rm(directory, { recursive: true, force: true });
  }
});

test('clear-label positive coverage creates the native container before a late helper and paints it without a weather rerender', async () => {
  const temporaryRoot = resolve(tmpdir());
  const directory = await mkdtemp(join(temporaryRoot, 'weather-cloud-late-'));
  const gateKey = `nika-cloud-helper:${directory}`;
  let release, timer, cloudNode;
  globalThis[gateKey] = new Promise(resolve => { release = resolve; });
  try {
    const file = join(directory, '3d-weather-codrops-main/src/weather-lifecycle.mjs'), helper = join(directory, 'assets/js/weather-cloud-motion.js');
    await mkdir(dirname(file), { recursive: true }); await mkdir(dirname(helper), { recursive: true });
    await writeFile(file, await readFile(new URL('../3d-weather-codrops-main/src/weather-lifecycle.mjs', import.meta.url)));
    await writeFile(helper, `await globalThis[${JSON.stringify(gateKey)}];\nexport * from ${JSON.stringify(new URL('../assets/js/weather-cloud-motion.js', import.meta.url).href)};\n`);
    const lifecycle = await Promise.race([import(`${pathToFileURL(file).href}?v=late-helper`), new Promise((_, reject) => { timer = setTimeout(() => reject(Error('core exports waited for optional cloud asset')), 1500); })]);
    clearTimeout(timer);
    const weather = cloudy(45, layers(0, 0, 100)); weather.current.condition = { code: 1000, text: 'Sunny' };
    const tree = lifecycle.renderWeatherSceneFallback((type, props) => ({ type, props }), { weatherData: weather, embedded: true, variant: 'header-panel' }, null);
    cloudNode = tree.props.children.find(node => node.props.className === 'weather-scene-recovery__clouds');
    assert.ok(cloudNode, 'positive measured cover creates a container even before the optional helper is ready');
    const f = fixture(); cloudNode.props.ref(f.container);
    assert.equal(f.styles[0].get('transform'), undefined, 'the helper is actually still pending');
    release(); await import(`${pathToFileURL(helper).href}?v=late-helper`); await new Promise(resolve => setImmediate(resolve));
    assert.ok(f.styles[0].get('transform'), 'the original ref receives the late helper without a React rerender');
    assert.ok(Number(f.styles[0].get('opacity')) > 0 && Number(f.styles[0].get('opacity')) < .1);
    cloudNode.props.ref(null); cloudNode = null;
    assert.equal(f.frames.size, 0);
  } finally {
    clearTimeout(timer); release(); cloudNode?.props.ref(null); delete globalThis[gateKey];
    assert.equal(dirname(directory), temporaryRoot);
    await rm(directory, { recursive: true, force: true });
  }
});

test('separate complete model layers change silhouette without replacing primary total coverage', () => {
  const low = cloud.resolveCloudAppearance(cloudy(75, layers(100, 0, 0)));
  const high = cloud.resolveCloudAppearance(cloudy(75, layers(0, 0, 100)));
  const mid = cloud.resolveCloudAppearance(cloudy(75, layers(0, 100, 0)));
  assert.equal(high.coverage, 75, 'model total=100 must not replace primary 75%');
  assert.equal(high.layerEvidence, true);
  assert.ok(low.opacity > mid.opacity && mid.opacity > high.opacity);
  assert.ok(low.flattenY > mid.flattenY && mid.flattenY > high.flattenY);
  assert.ok(high.spreadX > low.spreadX);
  const neutral = cloud.resolveCloudAppearance(cloudy(75));
  for (const invalid of [layers(null, 0, 100), { ...layers(0, 0, 100), source: 'unknown' }, { ...layers(0, 0, 100), validTime: '' }]) {
    const result = cloud.resolveCloudAppearance(cloudy(75, invalid));
    assert.equal(result.layerEvidence, false); assert.equal(result.opacity, neutral.opacity);
  }
  const future = cloudy(75, layers(0, 0, 100)); future.weatherMeta.appearanceTimeMs = Date.parse('2026-11-08T03:00:00Z');
  assert.equal(cloud.resolveCloudAppearance(future).layerEvidence, false);
  assert.equal(cloud.resolveCloudAppearance(cloudy(0, layers(100, 0, 0))).opacity, 0, 'separate model cannot invent clouds over a measured zero');
});

test('rain, snow, fog and storm retain their existing weather effects under thin-layer metadata', () => {
  for (const [code, text] of [[1183, 'Rain'], [1210, 'Snow'], [1030, 'Fog'], [1273, 'Thunderstorm']]) {
    const weather = cloudy(5, layers(0, 0, 100)); weather.current.condition = { code, text };
    const appearance = cloud.resolveCloudAppearance(weather), fallback = resolveWeatherSceneFallback(weather);
    assert.ok(appearance.opacity >= .65); assert.equal(appearance.flattenY, 1);
    assert.equal(fallback.clouds, true);
    assert.equal(fallback.precipitation, text !== 'Fog');
  }
});

test('cloud appearance transitions preserve state and ease shape and opacity without a pause catch-up jump', () => {
  const low = cloud.resolveCloudAppearance(cloudy(100, layers(100, 0, 0))), high = cloud.resolveCloudAppearance(cloudy(100, layers(0, 0, 100)));
  const state = {}; cloud.smoothCloudAppearance(state, low, 100);
  const first = { ...state }; cloud.smoothCloudAppearance(state, high, 100 + 1 / 30);
  assert.ok(state.opacity < first.opacity && state.opacity > first.opacity - .03);
  assert.ok(state.flattenY < first.flattenY && state.flattenY > first.flattenY - .03);
  const beforePause = state.opacity; cloud.smoothCloudAppearance(state, high, 500);
  assert.ok(beforePause - state.opacity < .03);
  const runAppearance = fps => { const value = {}; cloud.smoothCloudAppearance(value, low, 0); for (let frame = 1; frame <= 6 * fps; frame++) cloud.smoothCloudAppearance(value, high, frame / fps); return value; };
  assert.ok(Math.abs(runAppearance(30).opacity - runAppearance(60).opacity) < 1e-12);
  cloud.smoothCloudAppearance(state, high, 501, true); assert.equal(state.opacity, high.opacity);
});

test('all forecast entry projections discard current layer evidence and retain their own numeric cover', async () => {
  for (const entry of ['widget', 'header-preview', 'header-dropdown']) {
    const text = await readFile(new URL(`../3d-weather-codrops-main/src/${entry}.mjs`, import.meta.url), 'utf8');
    const ast = parse(text, { sourceType: 'module', ecmaVersion: 'latest', range: true });
    const node = ast.body.flatMap(item => item.declarations || []).find(item => item.id?.name === 'weatherForForecastDay');
    const project = new Function('resolveForecastCloudCover', 'resolveForecastNoonMs', `return ${text.slice(...node.init.range)}`)(resolveForecastCloudCover, resolveForecastNoonMs);
    const weather = { ...cloudy(90, layers(0, 0, 100)), location: { tz_id: 'Asia/Tokyo' } };
    const projected = project(weather, { date: '2026-11-08', day: { cloud: 25, condition: { code: 1003, text: 'Partly cloudy' } } });
    assert.equal(projected.current.cloud, 25, entry); assert.equal(projected.weatherMeta.cloudLayers, null, entry);
    assert.equal(weather.weatherMeta.cloudLayers.high, 100, 'current data must stay intact');
  }
});

function run(fps, wind = 20, degree = 90, seconds = 60) {
  const flow = cloud.createCloudFlow(0);
  for (let frame = 1; frame <= fps * seconds; frame++) cloud.advanceCloudFlow(flow, frame / fps, wind, degree);
  return flow;
}

test('wind drift is frame-rate independent and weather changes accelerate smoothly', () => {
  const a = run(30), b = run(60), north = run(30, 20, 0), west = run(30, 20, 270);
  assert.ok(Math.abs(a.travel - b.travel) < 1e-10);
  assert.ok(a.travel < 0 && west.travel > 0 && north.travel > 0);
  const previous = a.velocity;
  cloud.advanceCloudFlow(a, a.time + 1 / 30, 180, 270);
  assert.ok(Math.abs(a.velocity - previous) < .001);
  assert.deepEqual(cloud.cloudWind({ current: { wind_kph: 12, wind_degree: 240 } }), { speed: 12, degree: 240 });
  assert.deepEqual(cloud.cloudWind({ weatherMeta: { windSpeedKph: 17, windDirection: 45 } }), { speed: 17, degree: 45 });
});

test('the DOM-owned field survives a renderer retry and pauses instead of catching up', () => {
  const scope = {}, flow = cloud.sharedCloudFlow(scope, 100);
  cloud.advanceCloudFlow(flow, 100.1, 20, 90);
  const before = { ...flow };
  assert.equal(cloud.sharedCloudFlow(scope, 500), flow);
  cloud.advanceCloudFlow(flow, 500, 20, 90);
  assert.equal(flow.travel, before.travel);
  assert.equal(flow.elapsed, before.elapsed);
  cloud.advanceCloudFlow(flow, 500.1, 20, 90);
  assert.ok(Math.abs(flow.elapsed - before.elapsed - .1) < 1e-10);
  assert.equal(cloud.cloudMotionNow({ performance: { timeOrigin: 100000, now: () => 2500 } }), 102.5);
});

test('clouds deform independently and continuously without a short repeating spin', () => {
  const seed = cloud.cloudSeed([-5, 4, -2]), flow = run(30);
  const a = cloud.sampleCloudPuff(flow, seed, 0), b = cloud.sampleCloudPuff(flow, seed, 1);
  assert.notDeepEqual(a, b);
  assert.equal(cloud.cloudSeed([-5, 4, -2]), cloud.cloudSeed([...[-5, 4, -2]]));
  let previous;
  const sampled = [];
  for (let time = 0; time <= 600; time += .25) {
    const puff = cloud.sampleCloudPuff({ elapsed: time }, seed, 0);
    assert.ok(Math.abs(puff.rotation) <= .055 && Math.abs(puff.x) <= .075);
    assert.ok(puff.volume >= .935 && puff.volume <= 1.065);
    if (previous) assert.ok(Math.abs(puff.rotation - previous.rotation) < .002);
    if (time % 30 === 0) sampled.push(puff.rotation);
    previous = puff;
  }
  assert.equal(new Set(sampled.map(value => value.toFixed(6))).size, sampled.length);
  for (const time of [37, 43, 59, 67, 79]) {
    const delta = .0001;
    const left = (cloud.cloudNoise(time, seed) - cloud.cloudNoise(time - delta, seed)) / delta;
    const right = (cloud.cloudNoise(time + delta, seed) - cloud.cloudNoise(time, seed)) / delta;
    assert.ok(Math.abs(left - right) < .00001);
  }
});

test('a closed layer path has continuous position and velocity at its cycle seam without fading out', () => {
  const seed = cloud.cloudSeed([-5, 4, -2]);
  let previous, previousTravel = 0, seam;
  for (let travel = 0; travel <= 3; travel += .001) {
    const pose = cloud.sampleCloudLayer({ elapsed: 100, travel }, seed);
    if (previous) {
      if (pose.phase < previous.phase) {
        let low = previousTravel, high = travel;
        for (let step = 0; step < 35; step++) {
          const mid = (low + high) / 2;
          if (cloud.sampleCloudLayer({ elapsed: 100, travel: mid }, seed).phase > .5) low = mid;
          else high = mid;
        }
        seam = (low + high) / 2;
      }
      assert.ok(Math.abs(pose.x - previous.x) < .002 && Math.abs(pose.y - previous.y) < .002);
    }
    assert.ok(pose.opacity >= .92 && pose.opacity <= 1);
    assert.ok(Math.abs(pose.x) <= .145 && Math.abs(pose.y) <= .02);
    previous = pose; previousTravel = travel;
  }
  assert.ok(Number.isFinite(seam));
  const epsilon = .00001;
  const sample = offset => cloud.sampleCloudLayer({ elapsed: 100, travel: seam + offset * epsilon }, seed);
  const [before, left, right, after] = [-2, -1, 1, 2].map(sample);
  for (const key of ['x', 'y', 'z', 'scaleX', 'scaleY', 'opacity']) {
    assert.ok(Math.abs(left[key] - right[key]) < .0001, `${key} position`);
    const velocityLeft = (left[key] - before[key]) / epsilon;
    const velocityRight = (after[key] - right[key]) / epsilon;
    assert.ok(Math.abs(velocityLeft - velocityRight) < .001, `${key} velocity`);
  }
});

test('viewport sizing starts at the real size and eases resize targets without a catch-up jump', () => {
  const state = {};
  cloud.smoothCloudViewport(state, 28, 11, 100);
  assert.equal(state.width, 28); assert.equal(state.height, 11);
  cloud.smoothCloudViewport(state, 40, 16, 100 + 1 / 30);
  assert.ok(state.width > 28 && state.width < 29);
  const beforePause = state.width;
  cloud.smoothCloudViewport(state, 40, 16, 200);
  assert.ok(state.width > beforePause && state.width < beforePause + 1.3);
  for (let frame = 1; frame <= 90; frame++) cloud.smoothCloudViewport(state, 40, 16, 200 + frame / 30);
  assert.ok(Math.abs(state.width - 40) < .02 && Math.abs(state.height - 16) < .02);
});

function fixture({ observerFailure = false } = {}) {
  let now = 0, next = 1, resize, intersect, disconnected = 0;
  const frames = new Map(), listeners = new Map(), scope = {};
  const events = prefix => ({
    addEventListener: (name, listener) => listeners.set(prefix + name, listener),
    removeEventListener: name => listeners.delete(prefix + name),
  });
  const motion = { matches: false, ...events('motion:') };
  const view = {
    ...events('view:'), performance: { timeOrigin: 100000, now: () => now }, matchMedia: () => motion,
    requestAnimationFrame: callback => { const id = next++; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    ResizeObserver: class { constructor(callback) { resize = callback; } observe() { if (observerFailure) throw Error('observer failed'); } disconnect() { disconnected++; } },
    IntersectionObserver: class { constructor(callback) { intersect = callback; } observe() {} disconnect() { disconnected++; } },
  };
  const document = { ...events('document:'), defaultView: view, hidden: false };
  const styles = [new Map(), new Map(), new Map()];
  const container = { ownerDocument: document, isConnected: true, closest: () => scope,
    getBoundingClientRect: () => ({ width: 375, height: 100 }),
    children: styles.map(style => ({ style: { setProperty: (name, value) => style.set(name, value) } })),
  };
  return { container, styles, frames, listeners, motion, document, get disconnected() { return disconnected; },
    resize: () => resize(), intersect: value => intersect([{ target: container, isIntersecting: value }]),
    tick(time) { now = time; const current = [...frames.values()]; frames.clear(); current.forEach(callback => callback(time)); },
  };
}

test('native fallback changes its raster transform and pauses/cleans up all observers and frames', () => {
  const f = fixture(), controller = cloud.createFallbackCloudMotion(f.container, { current: { wind_kph: 18, wind_degree: 270 } });
  const before = f.styles[0].get('transform');
  for (let time = 34; time <= 3000; time += 34) f.tick(time);
  assert.notEqual(f.styles[0].get('transform'), before);
  assert.equal(f.frames.size, 1);
  f.document.hidden = true; f.listeners.get('document:visibilitychange')(); assert.equal(f.frames.size, 0);
  f.document.hidden = false; f.listeners.get('document:visibilitychange')(); assert.equal(f.frames.size, 1);
  f.intersect(false); assert.equal(f.frames.size, 0);
  f.intersect(true); assert.equal(f.frames.size, 1);
  f.motion.matches = true; f.listeners.get('motion:change')(); assert.equal(f.frames.size, 0);
  f.resize();
  controller.dispose(); controller.dispose();
  assert.equal(f.frames.size, 0); assert.equal(f.listeners.size, 0); assert.equal(f.disconnected, 2);
  const broken = fixture({ observerFailure: true });
  assert.throws(() => cloud.createFallbackCloudMotion(broken.container, {}), /observer failed/);
  assert.equal(broken.disconnected, 1); assert.equal(broken.frames.size, 0); assert.equal(broken.listeners.size, 0);
});

test('native fallback keeps three separated cloud anchors throughout its closed motion', () => {
  const f = fixture(); f.motion.matches = true;
  const controller = cloud.createFallbackCloudMotion(f.container, {});
  const lefts = f.styles.map(style => Number(style.get('transform').match(/translate3d\(([-\d.]+)px/)[1]));
  for (const [index, anchor] of [-.16, .24, .62].entries()) {
    assert.ok(lefts[index] >= (anchor - .145) * 375 && lefts[index] <= (anchor + .145) * 375);
  }
  assert.ok(lefts[1] - lefts[0] > 35 && lefts[2] - lefts[1] > 35);
  assert.equal(f.frames.size, 0);
  controller.dispose();
});

test('native layer updates ease the existing raster field instead of replacing or jumping its appearance', () => {
  const f = fixture(), weather = cloudy(100, layers(100, 0, 0));
  const first = cloud.createFallbackCloudMotion(f.container, weather);
  const opacity = Number(f.styles[0].get('opacity')), transform = f.styles[0].get('transform');
  first.dispose();
  const second = cloud.createFallbackCloudMotion(f.container, cloudy(100, layers(0, 0, 100)));
  assert.equal(Number(f.styles[0].get('opacity')), opacity, 'new model appearance begins at the retained old state');
  assert.equal(f.styles[0].get('transform'), transform, 'the same wind field and anchors are retained');
  f.tick(34);
  assert.ok(Number(f.styles[0].get('opacity')) < opacity && Number(f.styles[0].get('opacity')) > opacity - .02);
  for (let time = 68; time <= 8000; time += 34) f.tick(time);
  assert.ok(Number(f.styles[0].get('opacity')) < opacity * .25);
  const scaleY = Number(f.styles[0].get('transform').match(/scale\([^,]+,([\d.]+)\)/)[1]);
  assert.ok(scaleY < .25, 'known high layer uses the same raster flattened into a veil');
  second.dispose();
});

test('the actual 3D cloud wrapper retains geometry across ordinary React rerenders', async () => {
  const text = await readFile(new URL('../3d-weather-codrops-main/src/scene.mjs', import.meta.url), 'utf8');
  const ast = parse(text, { sourceType: 'module', ecmaVersion: 'latest', range: true });
  const node = ast.body.find(item => item.type === 'FunctionDeclaration' && item.id.name === 'WeatherCloudLayer');
  const slots = [], scope = {}, motion = { matches: false }, state = { gl: { domElement: { closest: () => scope } }, viewport: { width: 30, height: 10 } };
  let cursor = 0, frame, priority, now = 100, weather = { ...cloudy(100, layers(100, 0, 0)), current: { ...cloudy(100).current, wind_kph: 20, wind_degree: 270 } };
  const React = {
    useContext: () => weather,
    useRef: value => { const index = cursor++; return slots[index] ||= { current: value }; },
    useMemo: (factory, deps) => { const index = cursor++, old = slots[index]; if (!old || deps.some((value, key) => !Object.is(value, old.deps[key]))) slots[index] = { value: factory(), deps }; return slots[index].value; },
    useCallback: (callback, deps) => React.useMemo(() => callback, deps),
    createElement: (type, props) => ({ type, props }),
  };
  class Vector { set(x, y, z) { Object.assign(this, { x, y, z }); return this; } }
  const wrapper = new Function('React', 'CloudMotionContext', 'N', 'P', 'c', 'O', 'cloudMotion', 'document', 'globalThis', `${text.slice(...node.range)};return WeatherCloudLayer;`)(React, {}, () => state, (callback, value) => { frame = callback; priority = value; }, Vector, {}, { ...cloud, cloudMotionNow: () => now }, { hidden: false }, { matchMedia: () => motion });
  const props = { position: [-5, 4, -2], bounds: [12, 4, 4], segments: 2, volume: 15, color: '#FFFFFF', opacity: .6 };
  const first = wrapper(props), group = { position: new Vector(), scale: new Vector(), parent: { getWorldScale: vector => vector.set(1, 1, 1) }, updateMatrixWorld() {} };
  first.props.ref.current = group;
  const records = [0, 1].map(index => ({ position: new Vector().set(index, 2, 3), volume: 4, rotation: index }));
  records.forEach(first.props.distribute); frame();
  const positions = records.map(record => ({ ...record.position }));
  cursor = 0;
  const second = wrapper({ ...props, position: [...props.position], bounds: [...props.bounds] });
  assert.equal(second.props.bounds, first.props.bounds); assert.equal(second.props.position, first.props.position);
  assert.equal(second.props.seed, first.props.seed); assert.equal(second.props.distribute, first.props.distribute);
  assert.equal(second.props.speed, 0); assert.equal(second.props.growth, 0); assert.equal(priority, -1);
  frame();
  records.forEach((record, index) => assert.ok(Math.abs(record.position.x - positions[index].x) < .001));
  const previous = group.position.x;
  assert.ok(Math.abs(previous - props.position[0]) > .1, 'fixture has a visible drift offset');
  state.viewport.width = 60; state.viewport.height = 20; now += 1 / 30;
  frame();
  assert.ok(Math.abs(group.position.x - previous) < .6, 'doubling viewport width cannot immediately double the cloud offset');
  const resized = group.position.x;
  for (let index = 0; index < 90; index++) { now += 1 / 30; frame(); }
  assert.ok(Math.abs(group.position.x - resized) > 1, 'the actual wrapper reaches the resized placement smoothly');
  motion.matches = true;
  state.viewport.width = 40; state.viewport.height = 15; now += 1 / 30;
  frame();
  const reducedPosition = group.position.x;
  motion.matches = false; now += 1 / 30;
  frame();
  assert.ok(Math.abs(group.position.x - reducedPosition) < .05, 'resuming after a reduced-motion resize uses the current size without returning to the old orientation');
  const oldBounds = second.props.bounds, oldSeed = second.props.seed, oldDistribute = second.props.distribute;
  const opacity = records[0].opacity, scaleY = group.scale.y;
  weather = { ...weather, weatherMeta: { cloudLayers: layers(0, 0, 100) } };
  cursor = 0; const third = wrapper({ ...props }); now += 1 / 30; frame();
  assert.equal(third.props.bounds, oldBounds); assert.equal(third.props.seed, oldSeed); assert.equal(third.props.distribute, oldDistribute);
  assert.ok(records[0].opacity < opacity && records[0].opacity > opacity - .03);
  assert.ok(group.scale.y < scaleY && group.scale.y > scaleY - .03, 'profile changes ease the existing group rather than regenerating its puffs');
  for (let index = 0; index < 240; index++) { now += 1 / 30; frame(); }
  assert.ok(group.scale.y < .25 && records[0].opacity < opacity * .25);
});
