import test from 'node:test';
import assert from 'node:assert/strict';

const flush = () => new Promise(resolve => setImmediate(resolve));
const options = { size: 9, geoState: { latitude: 51.23, longitude: 6.78, timeMs: Date.parse('2026-11-07T11:00:00Z') } };
let fixtureId = 0;

async function withLoader(stall, run) {
  const keys = ['document', 'fetch', 'createImageBitmap', 'Image', 'setTimeout', 'clearTimeout'];
  const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const urls = new Map(['createObjectURL', 'revokeObjectURL'].map(key => [key, Object.getOwnPropertyDescriptor(URL, key)]));
  const realSetTimeout = globalThis.setTimeout, realClearTimeout = globalThis.clearTimeout;
  const gates = new Map(), pending = [], scenes = [], deadlines = new Map();
  const state = { stall, requests: [], closed: [], createdUrls: [], revokedUrls: [], removedSources: [], imageDecodes: [], bitmapCalls: [], failAlbedo: false };
  const gate = key => {
    if (!gates.has(key)) {
      let release;
      const promise = new Promise(resolve => { release = resolve; });
      gates.set(key, { promise, release });
    }
    return gates.get(key).promise;
  };
  const bitmap = kind => ({ kind, width: 8, height: 4, close() { state.closed.push(this); } });
  const response = kind => ({ ok: !(kind === 'albedo' && state.failAlbedo), status: kind === 'albedo' && state.failAlbedo ? 503 : 200,
    async blob() { if (kind === 'height' && state.stall === 'blob') await gate('blob'); return { kind }; } });
  let urlId = 0;
  try {
    globalThis.setTimeout = (callback, delay, ...args) => {
      if (delay !== 45000) return realSetTimeout(callback, delay, ...args);
      const id = {}; deadlines.set(id, callback); return id;
    };
    globalThis.clearTimeout = id => { if (!deadlines.delete(id)) realClearTimeout(id); };
    globalThis.fetch = async url => {
      const kind = String(url).includes('moon-height') ? 'height' : 'albedo'; state.requests.push(kind);
      if (kind === 'albedo' && state.failAlbedo === 'deferred') await gate('albedo-error');
      if (kind === 'height' && state.stall === 'fetch') await gate('fetch');
      return response(kind);
    };
    globalThis.createImageBitmap = async blob => {
      state.bitmapCalls.push(blob.kind);
      if (state.stall === 'image' || state.stall === 'image-success') throw new Error('Fixture: bitmap decoder unsupported.');
      if (blob.kind === 'height' && state.stall === 'bitmap') await gate('bitmap');
      return bitmap(blob.kind);
    };
    URL.createObjectURL = blob => {
      const value = `blob:moon-loader-${urlId++}`; state.createdUrls.push({ value, kind: blob.kind }); return value;
    };
    URL.revokeObjectURL = value => { state.revokedUrls.push(value); };
    globalThis.Image = class {
      constructor() { this.width = 8; this.height = 4; }
      set src(value) { this.source = value; this.kind = state.createdUrls.find(url => url.value === value)?.kind; }
      get src() { return this.source; }
      async decode() {
        state.imageDecodes.push(this.kind);
        if (this.kind === 'height' && state.stall === 'image') await gate('image');
      }
      removeAttribute(name) { if (name === 'src') { state.removedSources.push(this.source); this.source = ''; } }
    };
    globalThis.document = { createElement() {
      let image;
      return { width: 0, height: 0, getContext: () => ({ drawImage(value) { image = value; }, clearRect() {},
        getImageData() {
          const data = new Uint8ClampedArray(8 * 4 * 4);
          for (let i = 0; i < 32; i++) data.set(image.kind === 'height' ? [78, 32, 0, 255] : [90 + i * 3, 100 + i * 2, 120 + i, 255], i * 4);
          return { data };
        } }) };
    } };
    const { createHeaderWeatherMoonScene } = await import(`../assets/js/header-weather-moon-scene.js?loader-fixture=${fixtureId++}`);
    const target = () => {
      const frames = [];
      const canvas = { hidden: true, isConnected: true, width: 0, height: 0, dataset: {},
        ownerDocument: { hidden: false, defaultView: { matchMedia: () => ({ matches: false }) } },
        style: { setProperty() {}, removeProperty() {} }, getContext: () => ({
          createImageData: (width, height) => ({ data: new Uint8ClampedArray(width * height * 4) }),
          putImageData: image => frames.push(image.data.slice()), clearRect() {},
        }) };
      return { canvas, frames };
    };
    const mount = canvas => {
      const promise = createHeaderWeatherMoonScene(canvas, options);
      promise.then(scene => scenes.push(scene), () => {}); pending.push(promise); return promise;
    };
    const expire = () => { assert.equal(deadlines.size, 1, 'one shared map-pair deadline'); for (const callback of [...deadlines.values()]) callback(); };
    const outcome = async promise => {
      let result = { state: 'pending' };
      promise.then(value => { result = { state: 'fulfilled', value }; }, error => { result = { state: 'rejected', error }; });
      await flush(); await flush(); return result;
    };
    await run({ state, target, mount, expire, outcome, deadlines, release: key => gates.get(key)?.release(), flush });
  } finally {
    state.stall = null;
    for (const deferred of gates.values()) deferred.release();
    await Promise.allSettled(pending);
    for (const scene of scenes) scene.dispose();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
    for (const [key, descriptor] of urls) {
      if (descriptor) Object.defineProperty(URL, key, descriptor); else delete URL[key];
    }
  }
}

for (const stall of ['fetch', 'blob', 'bitmap', 'image']) {
  test(`the shared 45s deadline settles a stalled ${stall} without waiting for a non-cancellable API`, async () => {
    await withLoader(stall, async ({ state, target, mount, expire, outcome, deadlines, flush }) => {
      const targetSurface = target(), pending = mount(targetSurface.canvas); await flush();
      assert.equal(targetSurface.frames.length, 1, 'the current phase remains visible while maps wait');
      expire(); const result = await outcome(pending);
      assert.equal(result.state, 'rejected', 'deadline must settle the complete map/decode pipeline');
      assert.equal(result.error.name, 'TimeoutError');
      assert.equal(deadlines.size, 0);
      assert.equal(targetSurface.canvas.hidden, false); assert.equal(targetSurface.canvas.dataset.moonDetail, 'fallback');
      if (stall !== 'image') assert.equal(state.closed.length, 1, 'the completed partner bitmap is released');
      else {
        assert.equal(state.createdUrls.length, 2); assert.equal(state.revokedUrls.length, 2);
        assert.equal(state.removedSources.length, 1, 'the timed-out image stops retaining its blob source');
      }
    });
  });
}

test('a timed-out bitmap that resolves late is closed exactly once and never repaints the fallback', async () => {
  await withLoader('bitmap', async ({ state, target, mount, expire, outcome, release, flush }) => {
    const surface = target(), pending = mount(surface.canvas); await flush();
    expire(); assert.equal((await outcome(pending)).state, 'rejected'); const frames = surface.frames.length;
    release('bitmap'); await flush(); await flush();
    assert.equal(state.closed.length, 2); assert.equal(new Set(state.closed).size, 2);
    assert.equal(surface.frames.length, frames); assert.equal(surface.canvas.dataset.moonDetail, 'fallback');
    assert.equal(state.createdUrls.length, 0, 'an abort cannot start a second image decoder');
  });
});

test('a deadline resets the shared promise so simultaneous retries use one fresh pair and preserve decoded texture', async () => {
  await withLoader('blob', async ({ state, target, mount, expire, outcome, deadlines, flush }) => {
    const old = target(), rejected = mount(old.canvas); await flush(); expire();
    assert.equal((await outcome(rejected)).state, 'rejected');
    state.stall = null;
    const a = target(), b = target(), one = mount(a.canvas), two = mount(b.canvas);
    const [first, second] = await Promise.all([one, two]);
    assert.equal(state.requests.length, 4, 'failed pair plus one deduplicated retry pair');
    assert.equal(deadlines.size, 0); assert.equal(state.closed.length, 3);
    assert.equal(a.canvas.dataset.moonDetail, 'terrain'); assert.equal(b.canvas.dataset.moonDetail, 'terrain');
    assert.notDeepEqual(a.frames[0], a.frames.at(-1), 'original decoded channel data replaces the phase-only map');
    assert.deepEqual(a.frames.at(-1), b.frames.at(-1)); first.dispose(); second.dispose();
  });
});

test('a paired transfer error aborts a stalled partner immediately and still releases its late bitmap', async () => {
  await withLoader('bitmap', async ({ state, target, mount, outcome, release, deadlines, flush }) => {
    state.failAlbedo = 'deferred';
    const pending = mount(target().canvas); await flush();
    assert.ok(state.bitmapCalls.includes('height')); release('albedo-error');
    const result = await outcome(pending);
    assert.equal(result.state, 'rejected', 'known HTTP failure must not wait for the unrelated stalled decoder');
    assert.match(result.error.message, /503/); assert.equal(deadlines.size, 0);
    release('bitmap'); await flush(); await flush(); assert.equal(state.closed.length, 1);
  });
});

test('WebKit image fallback preserves decoded maps and revokes every temporary URL on success', async () => {
  await withLoader('image-success', async ({ state, target, mount, deadlines }) => {
    const surface = target(), scene = await mount(surface.canvas);
    assert.equal(surface.canvas.dataset.moonDetail, 'terrain');
    assert.deepEqual(state.imageDecodes.sort(), ['albedo', 'height']);
    assert.equal(state.createdUrls.length, 2); assert.equal(state.revokedUrls.length, 2);
    assert.equal(state.removedSources.length, 0); assert.equal(deadlines.size, 0);
    assert.notDeepEqual(surface.frames[0], surface.frames.at(-1)); scene.dispose();
  });
});
