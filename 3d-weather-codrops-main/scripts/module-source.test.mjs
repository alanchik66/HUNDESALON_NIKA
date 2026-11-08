import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renameModuleBindings } from './module-source.mjs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { patchWeatherVendorRecovery } from './vendor-recovery-patch.mjs';

test('recovery renames preserve public imports, exports, object keys, and nested scopes', () => {
  const input = 'import {x} from "vendor"; const value = {x}; function nested(x) { return x; } export {x};';
  const actual = renameModuleBindings(input, { x: 'readableName' });
  assert.match(actual, /import \{x as readableName\}/);
  assert.match(actual, /\{x: readableName\}/);
  assert.match(actual, /function nested\(x\) \{ return x; \}/);
  assert.match(actual, /export \{readableName as x\}/);
});

test('recovery rejects module binding collisions', () => {
  assert.throws(
    () => renameModuleBindings('const one = 1; const two = 2;', { one: 'two' }),
    /Module binding collision/
  );
});

const vendorFilename = 'weather-3d-CKX6ob-m.mjs';
const vendorSource = await readFile(new URL(`../dist-widget/${vendorFilename}`, import.meta.url), 'utf8');
const correctedVendor = patchWeatherVendorRecovery(vendorSource, vendorFilename);

function canvasInitialization(source, configure, onError, render) {
  const canvas = source.slice(source.indexOf('function nv({'), source.indexOf('\nfunction rv('));
  const start = canvas.indexOf('        async function n() {'), call = canvas.indexOf('\n        n()', start);
  assert.ok(start >= 0 && call > start, 'the existing Canvas initialization flow is present');
  const asyncFlow = canvas.slice(start, call), invocation = canvas.slice(call + 1, canvas.indexOf('\n', call + 1));
  const bindings = { M: { current: { configure, render } }, a: {}, y: null, o: null, l: false, u: false,
    d: false, f: false, p: false, m: 'demand', h: [1, 2], g: {}, _: null, v: {}, T: { width: 320, height: 140 },
    O: { current: null }, s: null, c: null, x: null, C: 'provider', Gh: { jsx: (type, props) => ({ type, props }) },
    dg: 'error-boundary', ee: onError, Q: { Suspense: 'Suspense' }, ug: 'suspense-block', A() {}, t: 'cloud-scene' };
  // Observe the real async function's promise without allowing the deliberately
  // broken pre-patch flow to create process-level unhandled-rejection noise.
  return new Function(...Object.keys(bindings), `${asyncFlow};
    const original = n; let pending;
    n = (...args) => { pending = original(...args); pending.catch(() => {}); return pending; };
    ${invocation}
    return pending;`)(...Object.values(bindings));
}

test('generated Canvas routes an actual asynchronous configure rejection to its existing React error setter', async () => {
  const failure = new Error('Error creating WebGL context.'), captured = [];
  let rendered = 0;
  await canvasInitialization(correctedVendor, async () => { throw failure; }, error => captured.push(error), () => { rendered++; }).catch(() => {});
  await Promise.resolve();
  assert.deepEqual(captured, [failure], 'the error setter makes the outer weather boundary own recovery');
  assert.equal(rendered, 0, 'failed configuration cannot start rendering');
});

test('generated Canvas retains its successful initialization flow and renders exactly once', async () => {
  let configured = 0, rendered = 0;
  await canvasInitialization(correctedVendor, async options => { configured++; assert.equal(options.size.width, 320); },
    () => assert.fail('a healthy renderer cannot enter recovery'), value => { rendered++; assert.equal(value.type, 'provider'); });
  assert.equal(configured, 1); assert.equal(rendered, 1);
});

function unmountRuntime(source, scene) {
  const start = source.indexOf('function T_(e, t) {'), end = source.indexOf('\nfunction E_(', start);
  const disposalStart = source.indexOf('function gg(e) {'), disposalEnd = source.indexOf('\nvar _g ', disposalStart);
  assert.ok(start >= 0 && end > start && disposalStart >= 0 && disposalEnd > disposalStart);
  const canvas = {}, roots = new Map(), callbacks = [];
  const calls = { events: 0, lists: 0, context: 0, complete: 0 };
  const state = { internal: { active: true }, scene, events: { disconnect: () => { calls.events++; } },
    gl: scene ? { renderLists: { dispose: () => { calls.lists++; } }, forceContextLoss: () => { calls.context++; } } : null };
  roots.set(canvas, { fiber: {}, store: { getState: () => state } });
  const unmount = new Function('b_', 'y_', 'setTimeout', `${source.slice(disposalStart, disposalEnd)};${source.slice(start, end)};return T_;`)(
    roots, { updateContainer: (element, fiber, parent, done) => { assert.equal(element, null); done(); } },
    (callback, delay) => { assert.equal(delay, 500); callbacks.push(callback); });
  unmount(canvas, () => { calls.complete++; });
  for (const callback of callbacks) callback();
  return { roots, state, calls };
}

test('generated failed-configure cleanup releases the root even when no scene or renderer was created', () => {
  const result = unmountRuntime(correctedVendor, null);
  assert.equal(result.state.internal.active, false);
  assert.equal(result.roots.size, 0, 'a failed initialization must not retain its canvas/root in the shared map');
  assert.equal(result.calls.events, 1); assert.equal(result.calls.complete, 1);
});

test('generated healthy cleanup still disposes GPU resources and removes the renderer root', () => {
  let resources = 0;
  const result = unmountRuntime(correctedVendor, { type: 'Scene', geometry: { dispose: () => { resources++; } } });
  assert.equal(result.roots.size, 0); assert.equal(result.calls.events, 1);
  assert.equal(result.calls.lists, 1); assert.equal(result.calls.context, 1); assert.equal(result.calls.complete, 1); assert.equal(resources, 1);
});

test('generated recovery leaves the provenance input, shaders, exports and other vendor files intact', async () => {
  const manifest = JSON.parse(await readFile(new URL('../build-manifest.json', import.meta.url), 'utf8'));
  const vendor = manifest.vendorInputs.find(item => item.file === vendorFilename);
  assert.equal(createHash('sha256').update(vendorSource).digest('hex'), vendor.sha256);
  assert.equal(patchWeatherVendorRecovery(vendorSource, 'unrelated.mjs'), vendorSource);
  assert.equal(correctedVendor.slice(correctedVendor.lastIndexOf('\nexport {')), vendorSource.slice(vendorSource.lastIndexOf('\nexport {')));
  assert.equal(await readFile(new URL(`../dist-widget/${vendorFilename}`, import.meta.url), 'utf8'), vendorSource);
  const original = correctedVendor.replace('        n().catch(ee);', '        n();')
    .replace('                i.scene && gg(i.scene),', '                gg(i.scene),');
  assert.equal(original, vendorSource, 'only the two reviewed recovery statements may change in generated bytes');
});

test('generated recovery rejects missing or duplicate anchors instead of patching a different vendor shape', () => {
  assert.throws(() => patchWeatherVendorRecovery(correctedVendor, vendorFilename), /exactly once/);
  assert.throws(() => patchWeatherVendorRecovery(vendorSource + vendorSource, vendorFilename), /exactly once/);
  assert.throws(() => patchWeatherVendorRecovery(vendorSource.replace('                gg(i.scene),', '                unknown(i.scene),'), vendorFilename), /exactly once/);
});
