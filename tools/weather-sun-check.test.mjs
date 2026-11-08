import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const glassSource = readFileSync(new URL('../assets/js/service-card-glass.js', import.meta.url), 'utf8');
const diagnosticSource = readFileSync(new URL('../assets/js/weather-sun-check.js', import.meta.url), 'utf8');
const settle = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };

function loaderHarness({ query = '', source = 'https://site.test/assets/js/service-card-glass.js?v=release', fail = false, loading = false } = {}) {
  const imports = [], selectors = [], listeners = new Map();
  let mounts = 0, mutations = 0;
  const document = {
    currentScript: source ? { src: source } : null,
    readyState: loading ? 'loading' : 'complete',
    querySelector: selector => { selectors.push(selector); return null; },
    addEventListener: (name, callback) => listeners.set(name, callback),
    createElement() { mutations++; throw Error('The loader must not create diagnostic DOM.'); },
  };
  const window = { location: new URL(`https://site.test/ru/${query}`), addEventListener() {} };
  runInNewContext(glassSource.replace(/\bimport\(/gu, 'loadModule('), {
    document, window, URL, URLSearchParams,
    loadModule: async url => { imports.push(url); if (fail === true) throw Error('import unavailable'); return { mountWeatherSunCheck: () => { mounts++; if (fail === 'mount') throw Error('mount unavailable'); } }; },
  });
  return { document, imports, selectors, listeners, mounts: () => mounts, mutations: () => mutations };
}

test('ordinary pages never import or mount solar diagnostics or add diagnostic DOM', async () => {
  for (const query of ['', '?v=release', '?solar-check=0', '?solar-check=10', '?other=solar-check%3D1']) {
    const h = loaderHarness({ query });
    await settle();
    assert.deepEqual(h.imports, []);
    assert.equal(h.mounts(), 0);
    assert.equal(h.mutations(), 0);
    assert.deepEqual(h.selectors, ['.services-grid[data-service-glass]'], 'normal glass initialization remains intact');
  }
});

test('the explicit diagnostic link imports only its same-origin module and the synchronous script version', async () => {
  const h = loaderHarness({ query: '?solar-check=1&private_location=never-copy', loading: true,
    source: 'https://site.test/assets/js/service-card-glass.js?v=reviewed-release&secret=never-copy#ignored' });
  h.document.currentScript = null;
  assert.deepEqual(h.imports, ['https://site.test/assets/js/weather-sun-check.js?v=reviewed-release']);
  h.listeners.get('DOMContentLoaded')();
  await settle();
  assert.equal(h.mounts(), 1);
  assert.equal(h.mutations(), 0);
});

test('missing or cross-origin script sources cannot load diagnostic code', async () => {
  for (const source of [null, 'https://foreign.test/assets/js/service-card-glass.js?v=release', 'https://[invalid']) {
    const h = loaderHarness({ query: '?solar-check=1', source });
    await settle();
    assert.deepEqual(h.imports, []);
    assert.equal(h.mounts(), 0);
    assert.deepEqual(h.selectors, ['.services-grid[data-service-glass]']);
  }
});

test('a diagnostic import or mount failure cannot interrupt ordinary card initialization', async () => {
  for (const fail of [true, 'mount']) {
    const h = loaderHarness({ query: '?solar-check=1', fail });
    await settle();
    assert.equal(h.imports.length, 1);
    assert.equal(h.mounts(), fail === 'mount' ? 1 : 0);
    assert.deepEqual(h.selectors, ['.services-grid[data-service-glass]']);
    assert.equal(h.mutations(), 0);
  }
});

test('an unversioned script never copies the page query into the diagnostic module URL', async () => {
  const h = loaderHarness({ query: '?solar-check=1&v=not-the-script-version&private=never-copy',
    source: 'https://site.test/assets/js/service-card-glass.js?other=never-copy#ignored' });
  await settle();
  assert.deepEqual(h.imports, ['https://site.test/assets/js/weather-sun-check.js']);
  assert.equal(h.mounts(), 1);
});

function diagnosticHarness(options = {}) {
  const metrics = { queries: [], created: [], copies: [], privateReads: 0, network: 0, canvasContexts: 0, draws: 0, readbacks: 0, timers: 0 };
  const secrets = { latitude: 51.234567, longitude: 6.789123, chat: 'private-chat-message-unique', storage: 'private-storage-unique' };
  class Node {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.className = ''; this.attributes = new Map(); this.children = []; this.style = {}; this.dataset = {}; this.hidden = false; this.textContent = ''; this.listeners = new Map(); }
    setAttribute(name, value) { this.attributes.set(name, value); }
    append(...nodes) { for (const node of nodes) { node.parentElement = this; this.children.push(node); } }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this); this.parentElement = null; }
    getBoundingClientRect() { return { left: 20, top: 30, width: 68, height: 68 }; }
    getRootNode() { return { host: this.rootHost || null }; }
    get classList() { return { contains: name => this.className.split(/\s+/).includes(name) }; }
    addEventListener(name, callback) { this.listeners.set(name, callback); }
    async fire(name) { await this.listeners.get(name)?.({ type: name }); await settle(); }
    querySelector(selector) {
      const matches = node => selector.startsWith('[') ? node.attributes.has(selector.slice(1, -1)) : node.tagName.toLowerCase() === selector;
      for (const node of this.children) { if (matches(node)) return node; const found = node.querySelector(selector); if (found) return found; }
      return null;
    }
  }
  let now = 0, timerId = 0;
  const timers = new Map(), errors = [...(options.errorsBefore || [])];
  const setTimeout = (callback, delay) => { const id = ++timerId; timers.set(id, { callback, at: now + delay }); metrics.timers++; return id; };
  const clearTimeout = id => timers.delete(id);
  const advance = async ms => {
    const end = now + ms;
    for (;;) {
      const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at; timers.delete(next[0]); next[1].callback(); await settle();
    }
    now = end; await settle();
  };
  const body = new Node('body'), header = new Node('header'), host = new Node('div'), overlay = new Node('div');
  const chat = new Node('aside'); chat.id = 'hundesalon-ai-chat'; chat.textContent = secrets.chat;
  body.append(header, chat); header.append(host);
  host.__weatherGeoState = { latitude: secrets.latitude, longitude: secrets.longitude, accuracy: 7 };
  host.__weatherWidgetData = { location: { lat: secrets.latitude, lon: secrets.longitude } };
  overlay.className = 'is-header-sun weather-orb-overlay--preview'; overlay.rootHost = host;
  overlay.dataset = { sunScene: options.state || 'ready', sunSurface: 'original' };
  const canvas = new Node('canvas'), image = new Node('img');
  canvas.width = options.width ?? 8; canvas.height = options.height ?? 8; canvas.clientWidth = canvas.clientHeight = 68;
  canvas.getContext = () => { metrics.canvasContexts++; throw Error('No new canvas contexts allowed.'); };
  image.hidden = true; image.naturalWidth = 2048; image.naturalHeight = 1024;
  overlay.append(canvas, image);
  const state = { header: options.header !== false, overlay: options.overlay !== false, lost: !!options.lost };
  host.shadowRoot = { querySelectorAll(selector) { assert.equal(selector, '.is-header-sun'); return state.overlay ? [overlay] : []; } };
  const shader = 'float rays = 0.0; float apertureGhost; float solarGaussian; /* private source must not be copied */';
  const gl = {
    RGBA: 6408, UNSIGNED_BYTE: 5121, LINK_STATUS: 35714, COMPILE_STATUS: 35713, NO_ERROR: 0,
    drawingBufferWidth: canvas.width, drawingBufferHeight: canvas.height,
    isContextLost: () => state.lost,
    getContextAttributes: () => ({ alpha: true, antialias: true, preserveDrawingBuffer: false }),
    getProgramParameter: () => options.linked !== false,
    getShaderParameter: shaderId => shaderId === 'fragment' ? options.compiled !== false : true,
    getProgramInfoLog: () => options.log || '', getShaderInfoLog: () => options.log || '', getShaderSource: () => shader,
    getError: () => errors.shift() || 0,
    readPixels(x, y, width, height, format, type, bytes) {
      metrics.readbacks++;
      assert.ok(metrics.draws > 0, 'readPixels must follow a fresh frame on the existing renderer');
      assert.deepEqual([x, y, width, height, format, type], [0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE]);
      if (options.readError) throw Error('private-error-message-must-not-copy');
      const alpha = (px, py, value) => { bytes[(py * width + px) * 4 + 3] = value; };
      alpha(3, 3, 255); alpha(4, 4, 255); alpha(7, 7, 255);
      alpha(6, 4, 17); alpha(1, 3, 8);
      errors.push(...(options.errorsAfter || []));
    },
  };
  const scene = { state: options.state || 'ready', running: true, disposed: !!options.disposed, contextLost: false,
    renderer: options.renderer === false ? null : { getContext: () => gl, info: { programs: [{ program: 'program', vertexShader: 'vertex', fragmentShader: 'fragment' }] } },
    flareMesh: { material: { fragmentShader: shader } }, renderFrame() { metrics.draws++; } };
  Object.defineProperty(scene, 'options', { get() { metrics.privateReads++; throw Error('Private scene options must not be inspected.'); } });
  overlay.__sunScene = scene;
  const shellScript = { src: 'https://site.test/assets/js/site-shell.js?v=release-proof&private=never-copy' };
  const document = {
    body,
    querySelector(selector) {
      metrics.queries.push(selector);
      if (selector === '[data-solar-check]') return body.querySelector(selector);
      if (selector === '.header-weather-widget') return state.header ? host : null;
      if (selector === 'script[src*="/assets/js/site-shell.js"]') return shellScript;
      metrics.privateReads++; throw Error(`Unrelated document traversal: ${selector}`);
    },
    createElement(tag) { metrics.created.push(tag); assert.notEqual(tag, 'canvas', 'diagnostics cannot create a GPU context'); return new Node(tag); },
  };
  Object.defineProperty(document, 'scripts', { get() { metrics.privateReads++; throw Error('Do not enumerate unrelated scripts.'); } });
  const navigator = { clipboard: { async writeText(value) { metrics.copies.push(value); if (options.clipboardError) throw Error('clipboard unavailable'); } } };
  Object.defineProperty(navigator, 'geolocation', { get() { metrics.privateReads++; throw Error('Geolocation is forbidden.'); } });
  const localStorage = { getItem() { metrics.privateReads++; return secrets.storage; } };
  const window = { location: new URL(`https://site.test/ru/?solar-check=${options.flag ?? '1'}&latitude=${secrets.latitude}&chat=${secrets.chat}`),
    innerWidth: 430, innerHeight: 932, devicePixelRatio: 3, visualViewport: { scale: 1 }, localStorage, setTimeout, clearTimeout };
  const context = { document, window, navigator, localStorage, URL, URLSearchParams, Uint8Array,
    performance: { now: () => now }, setTimeout, clearTimeout,
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1', transform: 'none', filter: 'none' }),
    fetch() { metrics.network++; throw Error('Diagnostics cannot make network requests.'); },
  };
  runInNewContext(diagnosticSource.replace('export function mountWeatherSunCheck', 'function mountWeatherSunCheck'), context);
  const node = name => body.querySelector(`[data-solar-check${name ? `-${name}` : ''}]`);
  const json = () => JSON.parse(node('report').textContent);
  return { mount: context.mountWeatherSunCheck, node, json, advance, state, scene, overlay, canvas, metrics, secrets, timers, shellScript, now: () => now };
}

test('the diagnostic module itself is inert without its explicit flag and never auto-mounts on import', () => {
  const h = diagnosticHarness({ flag: '0' });
  assert.equal(h.node(''), null);
  assert.equal(h.metrics.created.length, 0);
  const dispose = h.mount();
  assert.equal(typeof dispose, 'function');
  assert.equal(h.metrics.created.length, 0);
  assert.equal(h.timers.size, 0);
  assert.equal(h.metrics.network, 0);
});

test('actual readback counts only exterior alpha and copies the privacy-limited JSON only after the explicit gesture', async () => {
  const h = diagnosticHarness();
  const dispose = h.mount();
  assert.equal(h.mount(), dispose, 'repeated imports must reuse one panel');
  assert.equal(h.metrics.copies.length, 0);
  const report = h.json(), light = report.sun[0].readback.exterior;
  assert.equal(report.buildStamp, 'release-proof');
  assert.deepEqual(report.viewport, { width: 430, height: 932, dpr: 3, scale: 1 });
  assert.equal(report.sun[0].readback.valid, true);
  assert.equal(light.samples, 28);
  assert.equal(light.nonzero, 2, 'two opaque photosphere pixels and the canvas corner must be excluded');
  assert.equal(light.above8, 1);
  assert.equal(light.maxAlpha, 17);
  assert.equal(light.meanAlpha, 25 / 28);
  const angular = Array(24).fill(0); angular[0] = 8; angular[12] = 17;
  assert.deepEqual(light.angularMax, angular);
  assert.equal(h.metrics.draws, 1); assert.equal(h.metrics.readbacks, 1);
  assert.equal(h.metrics.canvasContexts, 0); assert.equal(h.metrics.network, 0);
  await h.node('copy').fire('click');
  assert.equal(h.metrics.copies.length, 1);
  assert.deepEqual(JSON.parse(h.metrics.copies[0]), report, 'the actual copied payload is the displayed technical snapshot');
  const payload = h.metrics.copies[0];
  for (const value of Object.values(h.secrets)) assert.equal(payload.includes(String(value)), false, `private fixture value leaked: ${value}`);
  assert.equal(payload.includes('private source must not be copied'), false);
  assert.equal(h.metrics.privateReads, 0);
  dispose(); assert.equal(h.node(''), null); assert.equal(h.timers.size, 0);
});

test('a pre-mount WebGL failure exposes its stage and native creation status without creating a context', () => {
  const h = diagnosticHarness({ state: 'failed', renderer: false });
  h.overlay.__sunScene = null;
  h.canvas.dataset.sunInitStage = 'renderer-create';
  h.canvas.__sunContextCreationError = 'Could not create a WebGL context, VENDOR = 0xffff';
  h.overlay.__sunSceneError = Error('Error creating WebGL context with your selected attributes.');
  const dispose = h.mount(), report = h.json().sun[0];
  assert.equal(report.initializationStage, 'renderer-create');
  assert.deepEqual(report.failure, { name: 'Error', reason: 'webgl-context', message: 'Error creating WebGL context with your selected attributes.', resource: null });
  assert.equal(report.contextCreationStatus, h.canvas.__sunContextCreationError);
  assert.equal(report.scene, null);
  assert.equal(report.readback.valid, false);
  assert.equal(h.metrics.canvasContexts, 0); assert.equal(h.metrics.network, 0);
  assert.match(h.node('status').textContent, /renderer-create.*webgl-context/u);
  dispose();
});

test('caught Sun failures distinguish module, TDZ, texture and context errors with public resource paths only', () => {
  const fixtures = [
    ['module', 'TypeError', 'Failed to fetch dynamically imported module: https://site.test/assets/js/header-weather-sun-scene.js?v=release&latitude=51.234567#private', 'module-load', '/assets/js/header-weather-sun-scene.js'],
    ['module', 'TypeError', 'error loading dynamically imported module: https://site.test/3d-weather-codrops-main/dist-widget/react-vendor-DdSZTPSL.mjs?chat=private-chat-message-unique', 'module-load', '/3d-weather-codrops-main/dist-widget/react-vendor-DdSZTPSL.mjs'],
    ['module', 'TypeError', 'Importing a module script failed.', 'module-load', null],
    ['module', 'ReferenceError', "Cannot access 'private-chat-message-unique' before initialization", 'module-evaluation', null],
    ['module', 'ReferenceError', 'Cannot access uninitialized variable.', 'module-evaluation', null],
    ['module', 'SyntaxError', "Unexpected identifier 'private-storage-unique'", 'module-evaluation', null],
    ['texture-load', 'Error', 'The solar surface texture could not load.', 'texture-load', null],
    ['texture-decode', 'EncodingError', 'The source image cannot be decoded.', 'texture-decode', null],
    ['texture-upload', 'SecurityError', 'The operation is insecure.', 'texture-upload', null],
    ['texture-upload', 'Error', 'WebGL: INVALID_VALUE: texImage2D: width or height out of range', 'texture-upload', null],
    ['texture-upload', 'Error', 'Solar graphics context was lost during preparation.', 'context-lost', null],
  ];
  for (const [stage, name, message, reason, resource] of fixtures) {
    const h = diagnosticHarness({ state: 'failed', renderer: false });
    if (stage === 'module') h.overlay.__sunScene = null;
    else h.canvas.dataset.sunInitStage = stage;
    h.overlay.__sunSceneError = Object.assign(Error(message), { name });
    const dispose = h.mount(), report = h.json().sun[0], failure = report.failure;
    assert.equal(report.initializationStage, stage, 'pre-factory import failures infer the absent module marker');
    assert.equal(failure.name, name); assert.equal(failure.reason, reason, message);
    assert.equal(failure.resource, resource, message);
    assert.ok(failure.message && failure.message.length <= 300);
    const payload = JSON.stringify(h.json());
    for (const value of Object.values(h.secrets)) assert.equal(payload.includes(String(value)), false, `private value in failure: ${name}`);
    assert.doesNotMatch(payload, /https?:\/\//u);
    assert.equal(payload.includes('?v='), false);
    dispose();
  }
});

test('a missing module stage is inferred only from a retained caught error with no retained scene', () => {
  for (const [scene, stage, error, expected] of [
    [null, undefined, undefined, null],
    [undefined, undefined, Error('Load failed'), 'module'],
    [null, 'private-storage-unique', Error('Load failed'), 'module'],
    [{}, undefined, Error('Load failed'), null],
    [false, undefined, Error('Load failed'), null],
    [null, 'renderer-create', Error('Load failed'), 'renderer-create'],
  ]) {
    const h = diagnosticHarness({ state: error ? 'failed' : 'ready', renderer: false });
    h.overlay.__sunScene = scene; h.overlay.__sunSceneError = error;
    h.canvas.dataset.sunInitStage = stage;
    const dispose = h.mount();
    assert.equal(h.json().sun[0].initializationStage, expected);
    assert.equal(JSON.stringify(h.json()).includes(h.secrets.storage), false);
    dispose();
  }
});

test('unrecognized Sun exceptions and non-public URL paths cannot disclose arbitrary caught data', async () => {
  for (const message of ['private-chat-message-unique private-storage-unique 51.234567',
    'Failed to fetch dynamically imported module: https://private.invalid/private-storage-unique?latitude=51.234567']) {
    const h = diagnosticHarness({ state: 'failed', renderer: false });
    h.canvas.dataset.sunInitStage = 'private-storage-unique';
    h.canvas.__sunContextCreationError = 'private-chat-message-unique';
    const error = { name: 'private-storage-unique', message, extra: h.secrets, options: h.secrets };
    if (message.startsWith('private-')) error.name = { toString() { throw Error('Caught fields must not be coerced.'); } };
    Object.defineProperty(error, 'stack', { get() { throw Error('Stack must never be read.'); } });
    Object.defineProperty(error, 'location', { get() { h.metrics.privateReads++; throw Error('Extra caught fields must never be read.'); } });
    h.overlay.__sunSceneError = error;
    const dispose = h.mount(), report = h.json().sun[0];
    assert.equal(report.initializationStage, null); assert.equal(report.contextCreationStatus, null);
    assert.equal(report.failure.name, 'UnknownError'); assert.equal(report.failure.resource, null);
    if (!message.startsWith('Failed to fetch')) { assert.equal(report.failure.reason, 'unknown'); assert.equal(report.failure.message, null); }
    await h.node('copy').fire('click');
    for (const value of Object.values(h.secrets)) assert.equal(h.metrics.copies[0].includes(String(value)), false);
    assert.equal(h.metrics.privateReads, 0); assert.equal(h.metrics.canvasContexts, 0); assert.equal(h.metrics.network, 0);
    dispose();
  }
});

test('module TypeErrors distinguish exact network messages from ambiguous failures without guessing evaluation', () => {
  for (const [stage, name, message, reason, safeMessage] of [
    ['module', 'TypeError', 'Load failed', 'module-load', true],
    ['module', 'TypeError', 'Failed to fetch', 'module-load', true],
    ['module', 'TypeError', 'private-chat-message-unique', 'module-failure', false],
    ['module', 'ReferenceError', 'private-chat-message-unique', 'module-evaluation', false],
    ['texture-decode', 'TypeError', 'Load failed', 'texture-decode', false],
  ]) {
    const h = diagnosticHarness({ state: 'failed', renderer: false });
    h.canvas.dataset.sunInitStage = stage; h.overlay.__sunSceneError = { name, message };
    const dispose = h.mount(), failure = h.json().sun[0].failure;
    assert.equal(failure.reason, reason);
    assert.equal(failure.message !== null, safeMessage);
    assert.equal(JSON.stringify(h.json()).includes(h.secrets.chat), false);
    dispose();
  }
});

test('initialization stages are explicit and native creation status is bounded and strips URL queries', () => {
  for (const stage of ['module', 'constructor', 'renderer-create', 'texture-load', 'texture-decode', 'texture-upload', 'scene-setup', 'resize', 'shader-compile', 'first-frame', 'running']) {
    const h = diagnosticHarness(); h.canvas.dataset.sunInitStage = stage;
    const dispose = h.mount();
    assert.equal(h.json().sun[0].initializationStage, stage); assert.equal(h.json().sun[0].failure, null);
    dispose();
  }
  const h = diagnosticHarness({ state: 'failed', renderer: false });
  h.canvas.__sunContextCreationError = 'Could not create a WebGL context: https://site.test/assets/js/header-weather-sun-scene.js?chat=private-chat-message-unique ' + 'x'.repeat(400);
  const dispose = h.mount(), status = h.json().sun[0].contextCreationStatus;
  assert.equal(status.length, 300);
  assert.match(status, /\/assets\/js\/header-weather-sun-scene\.js/u);
  assert.equal(status.includes('https://'), false); assert.equal(status.includes('?'), false); assert.equal(status.includes(h.secrets.chat), false);
  dispose();
  const webgl2 = diagnosticHarness({ state: 'failed', renderer: false });
  webgl2.canvas.__sunContextCreationError = 'WebGL2 context creation failed.';
  const dispose2 = webgl2.mount();
  assert.equal(webgl2.json().sun[0].contextCreationStatus, 'WebGL2 context creation failed.');
  dispose2();
});

test('Sun render modes distinguish native media from WebGL without reading private values or creating contexts', () => {
  for (const value of ['webgl', 'video', 'animation', 'poster', undefined, null, 'video ', 'private-mode-value', { private: 'private-storage-value' }]) {
    const h = diagnosticHarness({ state: 'failed', renderer: false });
    h.overlay.dataset.sunRenderMode = value;
    const dispose = h.mount(), report = h.json();
    assert.equal(report.sun[0].renderMode, ['webgl', 'video', 'animation', 'poster'].includes(value) ? value : null);
    assert.equal(report.sun[0].readback.valid, false);
    assert.equal(h.metrics.canvasContexts, 0);
    assert.equal(h.metrics.network, 0);
    dispose();
  }
});

test('context profiles expose only the three public outcomes without reading requested options or creating contexts', async () => {
  for (const value of ['preferred', 'compatible', 'unavailable', undefined, null, 'preferred ', 'private-chat-message-unique', { private: 'private-storage-unique' }]) {
    const h = diagnosticHarness(); h.canvas.dataset.sunContextProfile = value;
    h.canvas.__sunContextOptions = h.secrets;
    Object.defineProperty(h.canvas, '__sunRequestedContextAttributes', { get() { throw Error('Raw context options must not be inspected.'); } });
    const dispose = h.mount(), report = h.json();
    assert.equal(report.sun[0].contextProfile, ['preferred', 'compatible', 'unavailable'].includes(value) ? value : null);
    assert.equal(report.sun[0].readback.valid, true);
    assert.equal(report.sun[0].readback.exterior.samples, 28);
    assert.equal(report.sun[0].readback.exterior.nonzero, 2);
    assert.equal(h.metrics.canvasContexts, 0); assert.equal(h.metrics.network, 0);
    await h.node('copy').fire('click');
    for (const secret of Object.values(h.secrets)) assert.equal(h.metrics.copies[0].includes(String(secret)), false);
    assert.equal(h.metrics.privateReads, 0);
    dispose();
  }
});

test('loading overlays are awaited, while a missing header stops polling at the thirty-second deadline', async () => {
  const loading = diagnosticHarness({ state: 'loading' });
  loading.mount();
  assert.equal(loading.node('report').textContent, '');
  assert.equal(loading.node('copy').disabled, true);
  await loading.advance(1000);
  assert.equal(loading.metrics.readbacks, 0);
  loading.overlay.dataset.sunScene = 'ready'; loading.scene.state = 'ready';
  await loading.advance(250);
  assert.equal(loading.json().sun[0].readback.valid, true);
  assert.equal(loading.timers.size, 0);
  loading.node('').__dispose();
  const missing = diagnosticHarness({ header: false });
  missing.mount();
  await missing.advance(29999);
  assert.equal(missing.node('report').textContent, '');
  await missing.advance(1);
  assert.deepEqual(missing.json().sun, []);
  assert.equal(missing.timers.size, 0);
  assert.ok(missing.metrics.timers <= 120);
  assert.equal(missing.node('copy').disabled, false);
  missing.node('').__dispose();
});

test('context loss, unavailable renderers, oversized buffers and readback exceptions never claim usable exterior pixels', () => {
  for (const [options, expected] of [
    [{ state: 'lost', lost: true }, 'context-lost'],
    [{ state: 'failed', renderer: false }, 'existing-renderer-unavailable'],
    [{ width: 2048, height: 1024 }, 'buffer-size-out-of-bounds'],
    [{ readError: true }, 'Error'],
  ]) {
    const h = diagnosticHarness(options); const dispose = h.mount();
    const readback = h.json().sun[0].readback;
    assert.equal(readback.valid, false);
    assert.equal(readback.skipped || readback.error, expected);
    assert.equal(readback.exterior, undefined);
    assert.equal(JSON.stringify(h.json()).includes('private-error-message-must-not-copy'), false);
    if (!options.readError) assert.equal(h.metrics.readbacks, 0);
    dispose();
  }
});

test('pre-existing GL errors remain separate and errors from the atomic read invalidate all pixel statistics', () => {
  const before = diagnosticHarness({ errorsBefore: [1282] });
  before.mount();
  assert.deepEqual(before.json().sun[0].glErrorsBefore, [1282]);
  assert.deepEqual(before.json().sun[0].glErrors, []);
  assert.equal(before.json().sun[0].readback.valid, true);
  before.node('').__dispose();
  const after = diagnosticHarness({ errorsAfter: [1281, 1282], linked: false, compiled: false, log: 'x'.repeat(2000) });
  after.mount();
  const report = after.json().sun[0];
  assert.deepEqual(report.glErrors, [1281, 1282]);
  assert.equal(report.programs[0].linked, false); assert.equal(report.programs[0].fragmentCompiled, false);
  assert.equal(report.programs[0].programLog.length, 1600);
  assert.equal(report.readback.valid, false); assert.equal(report.readback.error, 'webgl-error');
  assert.equal(report.readback.exterior, undefined);
  after.node('').__dispose();
});

test('retry and disposal cancel pending waits without late panel writes, and copy rejection remains local', async () => {
  const h = diagnosticHarness({ header: false });
  const dispose = h.mount();
  await h.advance(1000);
  await h.node('retry').fire('click');
  assert.equal(h.timers.size, 1, 'retry owns only one pending readiness timer');
  await h.node('close').fire('click');
  assert.equal(h.timers.size, 0);
  h.state.header = true;
  await h.advance(30000);
  assert.equal(h.node(''), null); assert.equal(h.metrics.readbacks, 0); assert.equal(h.metrics.copies.length, 0);
  dispose();
  const rejected = diagnosticHarness({ clipboardError: true }); rejected.mount();
  await rejected.node('copy').fire('click');
  assert.equal(rejected.metrics.copies.length, 1);
  assert.match(rejected.node('status').textContent, /Копирование недоступно/u);
  assert.equal(rejected.json().sun[0].readback.valid, true);
  rejected.node('').__dispose();
});
