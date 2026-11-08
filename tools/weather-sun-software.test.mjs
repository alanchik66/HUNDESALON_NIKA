import assert from 'node:assert/strict';
import test from 'node:test';
import { createSoftwareSunProjection, mountSoftwareSunBody } from '../assets/js/header-weather-sun-software-scene.js';

let fixtureId = 0;
function fixture({ deferred = false, missingContext = false, tainted = false } = {}) {
  const images = [], requests = [], timers = new Map(), stats = { paints: 0, frames: [], rafs: 0, tainted };
  let time = Date.UTC(2026, 10, 6, 15), monotonic = 1000, timerId = 0;
  const window = {
    devicePixelRatio: 3, visualViewport: { scale: 1 }, performance: { now: () => monotonic },
    setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; }, clearTimeout(id) { timers.delete(id); },
    requestAnimationFrame() { stats.rafs++; throw Error('The software body cannot own a frame loop.'); },
    Image: class {
      constructor() { this.naturalWidth = 128; this.naturalHeight = 64; this.complete = false; images.push(this); }
      set src(value) { this.url = value; if (value && !deferred) void Promise.resolve().then(() => { this.complete = true; this.onload?.(); }); }
      get src() { return this.url; }
    },
  };
  const document = { baseURI: 'https://preview.example/ru/', defaultView: window, createElement(tag) {
    assert.equal(tag, 'canvas');
    const canvas = { style: {}, dataset: {}, attributes: {}, width: 300, height: 150,
      setAttribute(name, value) { this.attributes[name] = value; },
      remove() { const parent = this.parentElement; if (parent) parent.children.splice(parent.children.indexOf(this), 1); this.parentElement = null; },
      getContext(type) {
        requests.push(type); if (missingContext) return null;
        assert.equal(type, '2d');
        return {
          createImageData(width, height) { return { width, height, data: new Uint8ClampedArray(width * height * 4) }; },
          drawImage() { if (stats.tainted) throw Error('Canvas pixels are unavailable.'); },
          getImageData(x, y, width, height) {
            const data = new Uint8ClampedArray(width * height * 4);
            for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
              const offset = (row * width + column) * 4;
              const shade = 128 + 62 * Math.sin(column / width * Math.PI * 2) - (column > width * .2 && column < width * .25 && row > height * .4 && row < height * .6 ? 40 : 0);
              data[offset] = data[offset + 1] = data[offset + 2] = shade; data[offset + 3] = 255;
            }
            return { data };
          },
          putImageData(frame) { stats.paints++; stats.frames.push({ width: frame.width, height: frame.height, data: frame.data.slice() }); },
        };
      },
    };
    return canvas;
  } };
  const overlay = { ownerDocument: document, isConnected: true, clientWidth: 68, clientHeight: 68, dataset: {}, children: [],
    getBoundingClientRect() { return { width: this.clientWidth, height: this.clientHeight }; },
    appendChild(canvas) { this.children.push(canvas); canvas.parentElement = this; },
  };
  const photometry = { getTimeMs: () => time, solarSurfaceColorUniform: { value: { r: 1, g: .96, b: .8 } }, solarSpotStrengthUniform: { value: .1 } };
  const sourceUrl = `../assets/sun.jpg?fixture=${++fixtureId}`;
  return { overlay, photometry, sourceUrl, window, stats, images, requests, timers,
    options: () => ({ overlay, photometry, sourceUrl }),
    advance(ms) { time += ms; monotonic += ms; },
    resolveImages() { for (const image of images) { image.complete = true; image.onload?.(); } },
    frame: () => stats.frames.at(-1),
  };
}

test('perspective coverage has the physical projected radius, transparent corners and symmetric limb', () => {
  for (const size of [204, 276]) {
    const projection = createSoftwareSunProjection(size, size);
    const expectedFraction = .7 / Math.sqrt(4.55 ** 2 - .7 ** 2) / Math.tan(35 * Math.PI / 360);
    assert.ok(Math.abs(projection.diameterFraction - expectedFraction) < 1e-12);
    const alpha = new Uint8Array(size * size);
    projection.pixels.forEach((offset, index) => { alpha[offset / 4] = projection.alpha[index]; });
    const expectedArea = Math.PI * (size * expectedFraction / 2) ** 2;
    const area = alpha.reduce((sum, value) => sum + value / 255, 0);
    assert.ok(Math.abs(area - expectedArea) / expectedArea < .005);
    assert.equal(alpha[0], 0); assert.equal(alpha.at(-1), 0); assert.equal(alpha[Math.floor(size / 2) * size + Math.floor(size / 2)], 255);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) assert.equal(alpha[y * size + x], alpha[y * size + size - 1 - x]);
    assert.ok(projection.drift.every(value => Number.isFinite(value) && value >= 0));
  }
  assert.throws(() => createSoftwareSunProjection(513, 513), /Invalid/);
  assert.throws(() => createSoftwareSunProjection(68, 68, { radius: 5 }), /Invalid/);
});

test('software mount requests only Canvas 2D, keeps transparent exterior and the shared cream tint', async () => {
  const h = fixture(), body = await mountSoftwareSunBody(h.options()), frame = h.frame();
  assert.deepEqual(h.requests, ['2d', '2d']); assert.equal(h.stats.rafs, 0); assert.equal(h.timers.size, 0);
  assert.equal(h.overlay.children[0], body.canvas); assert.equal(body.canvas.dataset.sunBodyRenderer, 'canvas2d');
  assert.match(body.canvas.style.cssText, /pointer-events:none!important/); assert.match(body.canvas.style.cssText, /z-index:2!important/);
  assert.equal(frame.data[3], 0); assert.equal(frame.data.at(-1), 0);
  const center = (Math.floor(frame.height / 2) * frame.width + Math.floor(frame.width / 2)) * 4;
  assert.equal(frame.data[center + 3], 255);
  assert.ok(frame.data[center] > frame.data[center + 1] && frame.data[center + 1] > frame.data[center + 2]);
  body.dispose(); assert.equal(h.overlay.children.length, 0); assert.equal(body.canvas.width, 1); assert.equal(h.overlay.dataset.sunBodyRenderer, undefined);
});

test('the parent-owned tick is bounded to one texture frame per second with idempotent start/stop', async () => {
  const h = fixture(), body = await mountSoftwareSunBody(h.options());
  for (let index = 0; index < 29; index++) { h.advance(33); body.start(); body.render(h.photometry.getTimeMs()); }
  assert.equal(body.stats.frames, 1); h.advance(100); assert.equal(body.render(h.photometry.getTimeMs()), true);
  assert.equal(body.stats.frames, 2); body.stop(); h.advance(3000); assert.equal(body.render(h.photometry.getTimeMs()), false);
  body.start(); assert.equal(body.stats.frames, 3); body.start(); assert.equal(body.stats.frames, 3);
  assert.equal(h.stats.rafs, 0); body.dispose(); body.dispose(); body.start(); assert.equal(body.stats.frames, 3);
});

test('palette changes repaint within a bounded transition cadence and resize retains the same source image', async () => {
  const h = fixture(), body = await mountSoftwareSunBody(h.options());
  h.photometry.solarSurfaceColorUniform.value.b = .5; h.advance(33); assert.equal(body.render(h.photometry.getTimeMs()), false);
  h.advance(100); assert.equal(body.render(h.photometry.getTimeMs()), true);
  const tinted = h.frame(); h.overlay.clientWidth = h.overlay.clientHeight = 92;
  assert.equal(body.render(h.photometry.getTimeMs()), true); assert.equal(body.stats.width, 276); assert.equal(h.images.length, 1);
  assert.ok(tinted.data.some((value, offset) => offset % 4 === 0 && value > tinted.data[offset + 2])); body.dispose();
});

test('two visible views share the original decoded map and a later physical phase moves its actual texture', async () => {
  const h = fixture(), a = await mountSoftwareSunBody(h.options());
  const other = { ...h.overlay, dataset: {}, children: [] };
  const b = await mountSoftwareSunBody({ ...h.options(), overlay: other });
  assert.equal(h.images.length, 1); const before = h.frame().data;
  a.dispose(); h.advance(86400000); b.render(h.photometry.getTimeMs(), { force: true });
  const after = h.frame().data, changed = after.reduce((sum, value, index) => sum + (Math.abs(value - before[index]) > 1 ? 1 : 0), 0);
  assert.ok(changed > 100, 'physical rotation must move source texture features instead of rotating a flat sprite');
  assert.equal(other.children.length, 1); b.dispose(); assert.equal(other.children.length, 0);
});

test('a cancelled or superseded pending mount cannot publish a stale software body', async () => {
  const h = fixture({ deferred: true }), first = mountSoftwareSunBody(h.options()), second = mountSoftwareSunBody(h.options());
  h.resolveImages(); const result = await Promise.allSettled([first, second]);
  assert.equal(result[0].status, 'rejected'); assert.match(result[0].reason.message, /no longer current/);
  assert.equal(result[1].status, 'fulfilled'); assert.equal(h.overlay.children.length, 1); assert.equal(h.images.length, 1);
  result[1].value.dispose(); assert.equal(h.timers.size, 0);
  const detached = fixture({ deferred: true }), pendingMount = mountSoftwareSunBody(detached.options());
  detached.overlay.isConnected = false; detached.resolveImages(); await assert.rejects(pendingMount, /no longer current/);
  assert.equal(detached.overlay.children.length, 0); assert.equal(detached.timers.size, 0);
});

test('unavailable Canvas 2D and unreadable texture pixels leave the existing reserve untouched and permit a later retry', async () => {
  const absent = fixture({ missingContext: true }); await assert.rejects(mountSoftwareSunBody(absent.options()), /Canvas 2D/);
  assert.equal(absent.images.length, 0); assert.equal(absent.overlay.children.length, 0);
  const h = fixture({ tainted: true }); await assert.rejects(mountSoftwareSunBody(h.options()), /pixels are unavailable/);
  assert.equal(h.overlay.children.length, 0); assert.equal(h.timers.size, 0);
  h.stats.tainted = false; const body = await mountSoftwareSunBody(h.options());
  assert.equal(h.images.length, 2); assert.equal(h.overlay.children.length, 1); body.dispose();
});
