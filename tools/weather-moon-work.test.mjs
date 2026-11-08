import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { lunarLighting } from '../assets/js/weather-lunar-time.js';
import { renderLunarPixels } from '../assets/js/header-weather-moon-scene.js';

let fixtureId = 0;
const mapsFor = () => ({ width: 8, height: 4, albedo: new Uint8Array(8 * 4 * 3).fill(150), heightData: new Uint16Array(8 * 4).fill(20000) });
const lighting = () => lunarLighting(Date.parse('2026-11-07T18:00:00Z'), 51.23, 6.78);
const flush = () => new Promise(resolve => setImmediate(resolve));

function fakeView() {
  let time = 0, nextTimer = 1;
  const timers = new Map(), visibility = new Set(), workers = [];
  const state = { creationError: false };
  class Worker {
    constructor(url, options) {
      if (state.creationError) throw new Error('Worker blocked by policy.');
      this.url = new URL(url); this.options = options; this.listeners = new Map(); this.posts = []; this.terminated = 0; workers.push(this);
    }
    addEventListener(type, callback) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(callback); }
    removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
    postMessage(value, transfer = []) {
      if (this.postError) throw new Error('Structured clone failed.');
      this.posts.push({ data: globalThis.structuredClone(value), transfer });
    }
    terminate() { this.terminated++; }
    emit(type, event) { for (const callback of [...this.listeners.get(type) || []]) callback(event); }
    ready() { this.emit('message', { data: { type: 'ready' } }); }
    frame(id, size = 3) {
      const frame = { width: size, height: size, data: new Uint8ClampedArray(size * size * 4).fill(id), stats: { pixels: size * size } };
      this.emit('message', { data: { type: 'frame', id, frame } }); return frame;
    }
    get renders() { return this.posts.filter(post => post.data.type === 'render').map(post => post.data.id); }
  }
  const view = { Worker,
    document: { hidden: false, addEventListener: (_type, callback) => visibility.add(callback), removeEventListener: (_type, callback) => visibility.delete(callback) },
    setTimeout(callback, delay) { const id = nextTimer++; timers.set(id, { callback, at: time + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  return { view, workers, timers, visibility, state,
    advance(ms) {
      const end = time + ms;
      for (;;) {
        const entry = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!entry) break;
        const [id, timer] = entry; timers.delete(id); time = timer.at; timer.callback();
      }
      time = end;
    },
    hidden(value) { view.document.hidden = value; for (const callback of [...visibility]) callback(); },
  };
}

async function clientFixture() {
  const module = await import(`../assets/js/header-weather-moon-work.js?v=revision%26one&fixture=${fixtureId++}`);
  return { ...fakeView(), create: module.createLunarWorkClient };
}

test('two lunar surfaces share one worker/map clone while retaining their main-thread backup and independent leases', async () => {
  const h = await clientFixture(), maps = mapsFor(), original = maps.albedo.slice(), a = h.create(h.view), b = h.create(h.view);
  const one = a.render(lighting(), maps, { size: 3 }, () => true), two = b.render(lighting(), maps, { size: 3 }, () => true);
  assert.equal(h.workers.length, 1);
  const worker = h.workers[0];
  assert.equal(worker.posts.length, 1); assert.equal(worker.posts[0].data.type, 'init');
  assert.equal(worker.posts[0].transfer.length, 0, 'original arrays must not be transferred/detached');
  assert.notEqual(worker.posts[0].data.maps.albedo.buffer, maps.albedo.buffer);
  assert.deepEqual(maps.albedo, original); assert.equal(maps.heightData.byteLength, 64);
  assert.equal(worker.options.type, 'module'); assert.equal(worker.url.pathname.endsWith('/header-weather-moon-worker.js'), true);
  assert.equal(worker.url.searchParams.get('v'), 'revision&one');
  worker.ready(); assert.deepEqual(worker.renders, [1]); const first = worker.frame(1);
  assert.deepEqual(await one, first); assert.deepEqual(worker.renders, [1, 2]);
  const second = worker.frame(2); assert.deepEqual(await two, second);
  assert.equal(h.timers.size, 0, 'completed jobs leave no deadline timers running');
  a.dispose(); assert.equal(worker.terminated, 0);
  b.dispose(); assert.equal(worker.terminated, 1); assert.equal(h.timers.size, 0); assert.equal(h.visibility.size, 0);
  assert.ok([...worker.listeners.values()].every(set => set.size === 0));
});

test('superseding one owner coalesces its queued work and ignores the stale active result without cancelling its peer', async () => {
  const h = await clientFixture(), maps = mapsFor(), a = h.create(h.view), b = h.create(h.view);
  const old = a.render(lighting(), maps, { size: 3 }, () => true); const worker = h.workers[0]; worker.ready();
  const peer = b.render(lighting(), maps, { size: 3 }, () => true), latest = a.render(lighting(), maps, { size: 3 }, () => true);
  assert.equal(await old, null); assert.deepEqual(worker.renders, [1]);
  worker.frame(1); assert.deepEqual(worker.renders, [1, 2]);
  worker.frame(2); assert.ok(await peer); assert.deepEqual(worker.renders, [1, 2, 3]);
  const frame = worker.frame(3); assert.deepEqual(await latest, frame);
  a.dispose(); b.dispose(); assert.equal(h.timers.size, 0);
});

test('owner validation rejects obsolete queued and completed surfaces, including callbacks that throw', async () => {
  const h = await clientFixture(), maps = mapsFor(), a = h.create(h.view), b = h.create(h.view);
  let firstCurrent = true, peerCurrent = true;
  const one = a.render(lighting(), maps, { size: 3 }, () => firstCurrent), peer = b.render(lighting(), maps, { size: 3 }, () => peerCurrent);
  const worker = h.workers[0]; worker.ready(); firstCurrent = peerCurrent = false; worker.frame(1);
  assert.equal(await one, null); assert.equal(await peer, null); assert.deepEqual(worker.renders, [1]);
  assert.equal(await a.render(lighting(), maps, {}, () => { throw new Error('Obsolete view'); }), null);
  a.dispose(); b.dispose(); assert.equal(h.timers.size, 0);
});

test('hidden documents terminate pending work without a failure penalty and recreate only on a visible render', async () => {
  const h = await clientFixture(), maps = mapsFor(), client = h.create(h.view);
  const pending = client.render(lighting(), maps, { size: 3 }, () => true), old = h.workers[0]; old.ready();
  const oldMessage = [...old.listeners.get('message')][0];
  h.hidden(true); assert.equal(await pending, null); assert.equal(old.terminated, 1); assert.equal(h.timers.size, 0);
  assert.equal(await client.render(lighting(), maps, { size: 3 }, () => true), null); assert.equal(h.workers.length, 1);
  h.hidden(false); assert.equal(h.workers.length, 1, 'no autonomous worker or animation loop');
  const next = client.render(lighting(), maps, { size: 3 }, () => true), worker = h.workers[1];
  oldMessage({ data: { type: 'frame', id: 2, frame: { width: 3, height: 3, data: new Uint8ClampedArray(36), stats: {} } } });
  worker.ready(); const frame = worker.frame(2); assert.deepEqual(await next, frame);
  client.dispose(); assert.equal(h.timers.size, 0); assert.equal(h.visibility.size, 0);
});

test('startup and active-job deadlines settle all callers and prevent repeated worker creation until the leases are released', async () => {
  for (const ready of [false, true]) {
    const h = await clientFixture(), maps = mapsFor(), a = h.create(h.view), b = h.create(h.view);
    const one = a.render(lighting(), maps, { size: 3 }, () => true), peer = b.render(lighting(), maps, { size: 3 }, () => true);
    const worker = h.workers[0]; if (ready) worker.ready();
    h.advance(9999); assert.equal(worker.terminated, 0);
    h.advance(1); assert.equal(await one, null); assert.equal(await peer, null); assert.equal(worker.terminated, 1);
    assert.equal(h.timers.size, 0); assert.equal(await a.render(lighting(), maps, { size: 3 }, () => true), null);
    assert.equal(h.workers.length, 1); a.dispose(); b.dispose(); assert.equal(h.visibility.size, 0);
    const fresh = h.create(h.view), retry = fresh.render(lighting(), maps, { size: 3 }, () => true);
    assert.equal(h.workers.length, 2); fresh.dispose(); assert.equal(await retry, null); assert.equal(h.timers.size, 0);
  }
});

test('worker restrictions, clone errors and invalid frames use null fallback without uncaught errors or leaked timers', async () => {
  for (const mode of ['unsupported', 'constructor', 'init-post', 'render-post', 'error', 'messageerror', 'invalid']) {
    const h = await clientFixture(), maps = mapsFor();
    if (mode === 'unsupported') h.view.Worker = undefined;
    if (mode === 'constructor') h.state.creationError = true;
    if (mode === 'init-post') { const Base = h.view.Worker; h.view.Worker = class extends Base { postMessage() { throw new Error('Clone blocked'); } }; }
    const client = h.create(h.view), pending = client.render(lighting(), maps, { size: 3 }, () => true);
    let prevented = 0;
    if (h.workers.length) {
      const worker = h.workers[0]; if (mode === 'render-post') worker.postError = true; worker.ready();
      if (mode === 'invalid') worker.frame(1, 4);
      else worker.emit(mode, { preventDefault() { prevented++; } });
    }
    assert.equal(await pending, null, mode);
    if (mode === 'error' || mode === 'messageerror') assert.equal(prevented, 1);
    client.dispose(); assert.equal(h.timers.size, 0); assert.equal(h.visibility.size, 0);
  }
});

test('a cancelled active owner still has a finite worker deadline even with no caller left waiting', async () => {
  const h = await clientFixture(), maps = mapsFor(), client = h.create(h.view);
  const old = client.render(lighting(), maps, { size: 3 }, () => true), worker = h.workers[0]; worker.ready();
  assert.equal(await client.render(lighting(), maps, { size: 3 }, () => false), null);
  assert.equal(await old, null); h.advance(10000);
  assert.equal(worker.terminated, 1); assert.equal(h.timers.size, 0);
  client.dispose(); assert.equal(h.visibility.size, 0);
});

test('disposing a pending client rejects late responses and changing maps/windows keeps ownership separate', async () => {
  const h = await clientFixture(), other = fakeView(), firstMaps = mapsFor(), nextMaps = mapsFor(), client = h.create(h.view);
  const old = client.render(lighting(), firstMaps, { size: 3 }, () => true), firstWorker = h.workers[0];
  const next = client.render(lighting(), nextMaps, { size: 3 }, () => true); assert.equal(await old, null); assert.equal(firstWorker.terminated, 1);
  const peer = h.create(other.view), remote = peer.render(lighting(), nextMaps, { size: 3 }, () => true);
  assert.equal(h.workers.length, 2); assert.equal(other.workers.length, 1);
  client.dispose(); client.dispose(); peer.dispose(); assert.equal(await next, null); assert.equal(await remote, null);
  assert.equal(h.timers.size + other.timers.size, 0); assert.equal(h.visibility.size + other.visibility.size, 0);
  assert.equal(await client.render(lighting(), firstMaps, { size: 3 }, () => true), null);
});

test('the actual worker transfers exactly the same lunar pixels/stats and rejects malformed requests', async () => {
  const originals = new Map(['addEventListener', 'postMessage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let receive; const outputs = [], transfers = [];
  try {
    globalThis.addEventListener = (_type, callback) => { receive = callback; };
    globalThis.postMessage = (value, transfer = []) => { outputs.push(globalThis.structuredClone(value, { transfer })); transfers.push(transfer.length); };
    await import(`../assets/js/header-weather-moon-worker.js?v=worker-test-${fixtureId++}`);
    await receive({ data: { type: 'render', id: 1 } }); assert.equal(outputs.pop().type, 'error');
    const maps = mapsFor(), state = lighting(), options = { size: 33, earthshine: true, terrain: true };
    await receive({ data: { type: 'init', maps } }); assert.equal(outputs.pop().type, 'ready');
    const reference = renderLunarPixels(state, maps, options);
    await receive({ data: { type: 'render', id: 2, lighting: state, options } });
    const result = outputs.pop(); assert.equal(result.type, 'frame'); assert.equal(result.id, 2);
    assert.deepEqual(result.frame, reference); assert.equal(transfers.at(-1), 1, 'only the result pixels transfer ownership');
    assert.equal(maps.albedo.byteLength, 96); assert.equal(maps.heightData.byteLength, 64);
    await receive({ data: { type: 'render', id: 3, lighting: state, options: { size: 1e9 } } }); assert.equal(outputs.pop().type, 'error');
    await flush();
  } finally {
    for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});

test('a cold worker receives init before its delayed renderer import and preserves queued work', async () => {
  const source = await readFile(new URL('../assets/js/header-weather-moon-worker.js', import.meta.url), 'utf8');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const execute = new AsyncFunction('globalThis', 'loadModule', 'entryUrl', source.replace(/\bimport\s*\(/g, 'loadModule(').replaceAll('import.meta.url', 'entryUrl'));
  let receive, release;
  const renderer = new Promise(resolve => { release = resolve; }), imports = [], outputs = [];
  const scope = { addEventListener(_type, handler) { receive = handler; },
    postMessage(value, transfer = []) { outputs.push(globalThis.structuredClone(value, { transfer })); } };
  const entry = execute(scope, url => { imports.push(new URL(url)); return renderer; },
    'https://preview.example/assets/js/header-weather-moon-worker.js?v=revision%26one&moon-retry=2');
  const maps = mapsFor(), state = lighting(), options = { size: 33 };
  try {
    // Native worker messages are tasks; a module suspended in top-level await
    // must already have its listener or this first init event is discarded.
    const initializing = receive?.({ data: { type: 'init', maps } });
    assert.equal(typeof receive, 'function', 'register the worker listener before awaiting the renderer dependency graph');
    assert.equal(outputs.length, 0, 'ready waits for the actual renderer');
    const rendering = receive({ data: { type: 'render', id: 7, lighting: state, options } });
    assert.equal(imports.length, 1, 'init and queued render share one dependency import');
    assert.equal(imports[0].pathname, '/assets/js/header-weather-moon-scene.js');
    assert.equal(imports[0].searchParams.get('v'), 'revision&one'); assert.equal(imports[0].searchParams.get('moon-retry'), '2');
    const expected = renderLunarPixels(state, maps, options);
    release({ renderLunarPixels }); await entry; await Promise.all([initializing, rendering]);
    assert.deepEqual(outputs.map(value => value.type), ['ready', 'frame']);
    assert.equal(outputs[1].id, 7); assert.deepEqual(outputs[1].frame, expected);
    let idleReceive, failedImports = 0;
    const failures = [];
    await execute({ addEventListener(_type, handler) { idleReceive = handler; }, postMessage: value => failures.push(value) },
      () => { failedImports++; return Promise.reject(new Error('Fixture renderer import failed.')); },
      'https://preview.example/assets/js/header-weather-moon-worker.js?v=failed');
    assert.equal(failedImports, 0, 'an idle/terminated worker starts no orphan dependency import');
    await idleReceive({ data: { type: 'init', maps } });
    assert.equal(failedImports, 1); assert.equal(failures.length, 1);
    assert.equal(failures[0].type, 'error'); assert.equal(failures[0].message, 'Fixture renderer import failed.');
  } finally { release({ renderLunarPixels }); await entry; }
});
