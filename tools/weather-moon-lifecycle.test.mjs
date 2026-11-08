import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'espree';

const source = await readFile(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8');
const body = parse(source, { ecmaVersion: 'latest', sourceType: 'script', range: true }).body
  .find(node => node.expression?.callee?.id?.name === 'siteShellBootstrap').expression.callee.body.body;
const declarations = ['mountHeaderWeatherMoonScene', 'setHeaderWeatherOrbSource', 'stopHeaderWeatherOrbRender'].map(name => {
  const node = body.find(item => item.type === 'FunctionDeclaration' && item.id.name === name);
  assert.ok(node, `Missing Moon lifecycle function ${name}`);
  return source.slice(...node.range);
}).join('\n').replace('import(/* webpackIgnore: true */ url.href)', 'importMoon(url.href)');
const state = body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations.map(item => ({ kind: node.kind, item })))
  .filter(({ item }) => ['headerWeatherMoonSceneModulePromise', 'headerWeatherMoonSceneModuleRetry'].includes(item.id.name))
  .map(({ kind, item }) => `${kind} ${source.slice(...item.range)};`).join('\n');
const settle = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

function overlay() {
  const classes = new Set(), properties = new Map(), stats = { pauses: 0, loads: 0 };
  const video = { dataset: { currentSrc: '/old-moon.mp4' }, hidden: false, pause: () => { stats.pauses++; }, load: () => { stats.loads++; },
    removeAttribute(name) { if (name === 'src') delete this.src; }, play() { throw new Error('Physical Moon must not play its old video'); } };
  const canvas = { hidden: true, dataset: {} }, image = { hidden: false, dataset: {}, removeAttribute() {} };
  return { isConnected: true, hidden: false, dataset: { orbRole: 'moon' },
    classList: { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); }, add: name => classes.add(name), remove: (...names) => names.forEach(name => classes.delete(name)), contains: name => classes.has(name) },
    style: { removeProperty: name => properties.delete(name) }, querySelector: name => ({ video, canvas, img: image })[name],
    video, canvas, image, classes, stats };
}

function harness() {
  let tick = 0, factory, importer;
  const imports = [], factories = [], scenes = [], frames = [], clock = () => 123456789;
  const createScene = () => { const scene = { inputs: [], disposed: 0, setGeoState(geo) { this.inputs.push(geo); }, dispose() { this.disposed++; } }; scenes.push(scene); return scene; };
  factory = async () => createScene();
  importer = async () => ({ createHeaderWeatherMoonScene: async (canvas, options) => { factories.push({ canvas, options }); return factory(canvas, options); } });
  const api = new Function('importMoon', 'resolveHeaderWeatherSunSceneModuleUrl', 'getHeaderWeatherNowMs', 'performance',
    'stopHeaderWeatherMoonTimelineSync', 'stopHeaderWeatherSunScene', 'cancelAnimationFrame', 'clearHeaderWeatherOrbCanvas',
    'updateHeaderWeatherSunSceneGeo', 'mountHeaderWeatherSunScene', `${state}\n${declarations};
      return { set: setHeaderWeatherOrbSource, stop: stopHeaderWeatherOrbRender };`)(
    url => { imports.push(new URL(url)); return importer(url); },
    () => 'https://preview.example/assets/js/header-weather-sun-scene.js?v=release%26one', clock, { now: () => tick },
    orb => { orb.__moonTimelineGetter = null; }, () => {}, id => frames.push(id), () => {}, () => {}, () => {});
  return { ...api, imports, factories, scenes, frames, clock, createScene,
    tick: value => { tick = value; }, factory: callback => { factory = callback; }, importer: callback => { importer = callback; } };
}

const geo = { latitude: 51.23, longitude: 6.78, timeMs: 123456789, appearanceTimeMs: null };
const config = value => ({ type: 'header-moon', geoState: value });

test('physical Moon mounts a versioned 2D scene without starting the video or another animation loop', async () => {
  const h = harness(), orb = overlay();
  h.set(orb, 'moon', config(geo)); await settle();
  assert.equal(h.imports.length, 1); assert.equal(h.imports[0].pathname, '/assets/js/header-weather-moon-scene.js');
  assert.equal(h.imports[0].searchParams.get('v'), 'release&one');
  assert.equal(h.factories.length, 1); assert.equal(h.factories[0].canvas, orb.canvas);
  assert.equal(h.factories[0].options.getTimeMs, h.clock); assert.equal(h.factories[0].options.isCurrent(), true);
  assert.equal(orb.__moonScene, h.scenes[0]); assert.equal(orb.canvas.hidden, false); assert.equal(orb.image.hidden, true);
  assert.equal(orb.video.hidden, true); assert.equal(orb.video.dataset.currentSrc, undefined); assert.equal(orb.dataset.moonScene, 'ready');
  assert.equal(orb.classes.has('is-moon'), true); assert.equal(orb.classes.has('is-sun'), false);
  assert.equal(orb.__orbFrameScheduler, null); assert.deepEqual(h.frames, []);
});

test('the existing one-second caller updates geo and forecast time without remounting the Moon', async () => {
  const h = harness(), orb = overlay(); h.set(orb, 'moon', config(geo)); await settle();
  const scene = orb.__moonScene, forecast = { ...geo, appearanceTimeMs: Date.parse('2026-11-10T11:00:00Z') };
  for (let i = 0; i < 5; i++) h.set(orb, 'moon', config({ ...geo, timeMs: geo.timeMs + i * 1000 }));
  h.set(orb, 'moon', config(forecast));
  assert.equal(h.imports.length, 1); assert.equal(h.factories.length, 1); assert.equal(scene.disposed, 0);
  assert.equal(scene.inputs.at(-1), forecast); assert.equal(scene.inputs.length, 7);
});

test('pending initialization coalesces and commits only the latest selected geo state', async () => {
  const h = harness(), orb = overlay(), gate = deferred(); h.factory(() => gate.promise);
  h.set(orb, 'moon', config(geo)); await settle();
  const changed = { ...geo, longitude: -74, appearanceTimeMs: 789000 };
  h.set(orb, 'moon', config(changed)); h.set(orb, 'moon', config(changed));
  assert.equal(h.factories[0].options.getGeoState(), changed, 'native pending work reads the latest selection before publication');
  const scene = h.createScene(); gate.resolve(scene); await settle();
  assert.equal(h.imports.length, 1); assert.equal(h.factories.length, 1); assert.equal(scene.inputs.at(-1), changed);
  assert.equal(orb.__moonScene, scene); assert.equal(orb.dataset.moonScene, 'ready');
});

test('a hidden first terrain frame stays paused until an actual paint reports readiness', async () => {
  const h = harness(), orb = overlay();
  h.factory(async () => { orb.canvas.dataset.moonDetail = 'paused'; return h.createScene(); });
  h.set(orb, 'moon', config(geo)); await settle();
  assert.equal(orb.dataset.moonScene, 'paused');
  h.factories[0].options.onReady();
  assert.equal(orb.dataset.moonScene, 'ready');
  h.stop(orb); orb.dataset.moonScene = 'unmounted';
  h.factories[0].options.onReady();
  assert.equal(orb.dataset.moonScene, 'unmounted', 'an obsolete renderer cannot change a new surface state');
});

test('a pending native terrain scene is published early, keeps its phase on failure and retries on the existing clock', async () => {
  const h = harness(), orb = overlay(), gate = deferred();
  h.factory(async () => { orb.canvas.hidden = false; const scene = h.createScene(); scene.whenReady = gate.promise; return scene; });
  h.set(orb, 'moon', config(geo)); await settle();
  const scene = orb.__moonScene;
  assert.ok(scene, 'the existing clock can update the phase while terrain downloads');
  const selected = { ...geo, appearanceTimeMs: geo.timeMs + 86400000 };
  h.set(orb, 'moon', config(selected)); assert.equal(scene.inputs.at(-1), selected);
  orb.canvas.dataset.moonDetail = 'fallback'; gate.reject(new Error('Native decode timed out')); await settle();
  assert.equal(orb.__moonScene, scene); assert.equal(scene.disposed, 0); assert.equal(orb.canvas.hidden, false);
  assert.equal(orb.dataset.moonScene, 'failed');
  h.tick(14000); h.set(orb, 'moon', config(geo)); assert.equal(scene.inputs.at(-1), geo); assert.equal(h.factories.length, 1);
  h.factory(async () => { orb.canvas.dataset.moonDetail = 'terrain'; return h.createScene(); });
  h.tick(15000); h.set(orb, 'moon', config(selected)); await settle();
  assert.equal(scene.disposed, 1); assert.equal(h.factories.length, 2); assert.equal(orb.dataset.moonScene, 'ready');
  h.stop(orb);
});

test('removing a Moon during asynchronous loading invalidates its owner and disposes the late scene', async () => {
  const h = harness(), orb = overlay(), gate = deferred(); h.factory(() => gate.promise);
  h.set(orb, 'moon', config(geo)); await settle(); const options = h.factories[0].options;
  h.set(orb, null, null); assert.equal(options.isCurrent(), false);
  const scene = h.createScene(); gate.resolve(scene); await settle();
  assert.equal(scene.disposed, 1); assert.equal(orb.__moonScene, null); assert.equal(orb.hidden, true); assert.equal(orb.canvas.hidden, true);
  assert.equal(orb.__moonLatestAssetConfig, undefined);
});

test('teardown releases a committed Moon and cancels legacy video callbacks through the shared cleanup', async () => {
  const h = harness(), orb = overlay(); h.set(orb, 'moon', config(geo)); await settle();
  const scene = orb.__moonScene, owner = h.factories[0].options;
  orb.__orbFrameScheduler = 'raf'; orb.__orbFrameHandle = 42;
  h.stop(orb); h.stop(orb);
  assert.equal(scene.disposed, 1); assert.equal(owner.isCurrent(), false); assert.equal(orb.__moonScene, null);
  assert.equal(orb.__moonSceneMountToken, null); assert.equal(orb.__moonLatestAssetConfig, undefined); assert.deepEqual(h.frames, [42]);
});

test('preview and dropdown share the import while keeping independent scene ownership', async () => {
  const h = harness(), preview = overlay(), dropdown = overlay();
  h.set(preview, 'moon', config(geo)); h.set(dropdown, 'moon', config({ ...geo, appearanceTimeMs: 900000 })); await settle();
  assert.equal(h.imports.length, 1); assert.equal(h.factories.length, 2); assert.notEqual(preview.__moonScene, dropdown.__moonScene);
  h.stop(dropdown); assert.equal(preview.__moonScene.disposed, 0); assert.equal(h.scenes[1].disposed, 1);
});

test('a module failure keeps the old baked video hidden and retries on a bounded existing clock tick', async () => {
  const h = harness(), orb = overlay(); h.importer(async () => { throw new Error('network'); });
  h.set(orb, 'moon', config(geo)); await settle();
  assert.equal(orb.dataset.moonScene, 'failed'); assert.equal(orb.video.hidden, true); assert.equal(orb.canvas.hidden, true);
  for (const tick of [1000, 5000, 14999]) { h.tick(tick); h.set(orb, 'moon', config(geo)); }
  assert.equal(h.imports.length, 1);
  h.importer(async () => ({ createHeaderWeatherMoonScene: async () => h.createScene() }));
  h.tick(15000); h.set(orb, 'moon', config(geo)); await settle();
  assert.equal(h.imports.length, 2); assert.equal(h.imports[1].searchParams.get('moon-retry'), '1');
  assert.equal(orb.dataset.moonScene, 'ready'); assert.equal(orb.video.hidden, true);
});
