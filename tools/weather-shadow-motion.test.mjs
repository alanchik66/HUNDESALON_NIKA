import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'espree';
import postcss from 'postcss';

const styles = readFile(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8').then(source => {
  const pending = [parse(source, { ecmaVersion: 'latest', sourceType: 'script' })];
  let template;
  while (pending.length) {
    const node = pending.pop();
    if (node.type === 'VariableDeclarator' && node.id?.name === 'HEADER_WEATHER_TRANSPARENT_STYLES') {
      template = node.init;
      break;
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) pending.push(...value.filter(item => item?.type));
      else if (value?.type) pending.push(value);
    }
  }
  assert.equal(template?.type, 'TemplateLiteral');
  // Read template quasis through the JavaScript AST; never execute source or use brace regexes.
  assert.ok(template.quasis.every(quasi => typeof quasi.value.cooked === 'string'));
  return postcss.parse(template.quasis.map(quasi => quasi.value.cooked).join('0'));
});

const matchingRules = (root, matches) => {
  const rules = [];
  root.walkRules(rule => { if (rule.selectors.some(matches)) rules.push(rule); });
  return rules;
};
const lastDeclaration = (rules, property) => rules.flatMap(rule => rule.nodes.filter(node => node.type === 'decl' && node.prop === property)).at(-1);
const keyframes = (root, name) => {
  let result;
  root.walkAtRules('keyframes', rule => { if (rule.params === name) result = rule; });
  assert.ok(result, `Missing shadow keyframes ${name}`);
  return result;
};

test('weather arrow remains inside the flex pill and its keyframes own transform and opacity', async () => {
  const root = await styles;
  const pill = matchingRules(root, selector => selector === '.weather-header-card__toggle');
  assert.equal(lastDeclaration(pill, 'display').value, 'inline-flex');
  assert.equal(lastDeclaration(pill, 'align-items').value, 'center');
  assert.equal(lastDeclaration(pill, 'gap').value, '4px');
  const icon = matchingRules(root, selector => selector === '.weather-header-card__toggle-icon');
  assert.equal(lastDeclaration(icon, 'position').value, 'relative');
  assert.equal(lastDeclaration(icon, 'align-self').value, 'center');
  for (const property of ['left', 'right', 'top', 'bottom']) assert.equal(lastDeclaration(icon, property).value, 'auto', property);
  assert.match(lastDeclaration(icon, 'flex').value, /^0 0 /);
  const arrowRules = matchingRules(root, selector => /\.weather-header-card__toggle-icon(?:\.is-open)?$/.test(selector));
  for (const rule of arrowRules) {
    for (const decl of rule.nodes.filter(node => node.type === 'decl' && ['transform', 'opacity'].includes(node.prop))) {
      assert.equal(Boolean(decl.important), false, `${rule.selector}: ${decl.prop} must not override animation`);
    }
  }
  const animation = lastDeclaration(icon, 'animation').value.split(/\s+/)[0];
  const frames = keyframes(root, animation);
  const transforms = [];
  frames.walkDecls('transform', decl => transforms.push(decl.value));
  assert.ok(new Set(transforms).size > 1, 'the arrow must actually move through distinct transforms');
});

test('mobile weather menu expands only its transparent touch area while preserving the visual pill and rim', async () => {
  const root = await styles;
  const hit = matchingRules(root, selector => selector.endsWith('.weather-header-card__toggle::after'));
  assert.equal(hit.length, 1);
  assert.equal(hit[0].parent.name, 'media');
  assert.equal(hit[0].parent.params, '(max-width: 900px)', 'desktop hit testing remains unchanged');
  assert.equal(lastDeclaration(hit, 'content').value, "''");
  assert.equal(lastDeclaration(hit, 'position').value, 'absolute');
  assert.equal(lastDeclaration(hit, 'left').value, '50%');
  assert.equal(lastDeclaration(hit, 'bottom').value, '0', 'the 44px target expands upward inside the paint clip');
  assert.equal(lastDeclaration(hit, 'width').value, 'calc(100% + 24px)');
  assert.equal(lastDeclaration(hit, 'min-width').value, '44px');
  assert.equal(lastDeclaration(hit, 'height').value, '44px');
  assert.equal(lastDeclaration(hit, 'transform').value, 'translateX(-50%)');
  assert.equal(lastDeclaration(hit, 'background').value, 'transparent');
  assert.equal(lastDeclaration(hit, 'pointer-events').value, 'auto');
  for (const property of ['animation', 'filter', 'box-shadow', 'mask', '-webkit-mask']) {
    const declaration = lastDeclaration(hit, property);
    assert.ok(!declaration || declaration.value === 'none', `${property} cannot decorate the invisible hit area`);
  }
  const pill = matchingRules(root, selector => selector === '.weather-header-card__toggle');
  assert.equal(lastDeclaration(pill, 'min-height').value, '18px');
  assert.equal(lastDeclaration(pill, 'gap').value, '4px');
  assert.equal(lastDeclaration(pill, 'padding').value, '3px 8px');
  assert.equal(lastDeclaration(pill, 'width').value, 'max-content');
  const rim = matchingRules(root, selector => selector.endsWith('.weather-header-card__toggle::before'));
  assert.equal(lastDeclaration(rim, 'animation').value, 'weatherHeaderMenuRimFlow 12.8s ease-in-out infinite');
});

test('sun cloud veils retain their slow movement without important transform overrides', async () => {
  const root = await styles;
  for (const [pseudo, name, duration] of [['before', 'headerWeatherSunVeilA', '11.8s'], ['after', 'headerWeatherSunVeilB', '14.6s']]) {
    const rules = matchingRules(root, selector => selector === `.weather-orb-overlay.is-sun.has-cloud-veil::${pseudo}`);
    for (const rule of rules) {
      for (const decl of rule.nodes.filter(node => node.type === 'decl' && node.prop === 'transform')) {
        assert.equal(Boolean(decl.important), false, `${pseudo}: cloud transform must remain animatable`);
      }
    }
    assert.equal(lastDeclaration(rules, 'animation').value, `${name} ${duration} ease-in-out infinite`);
    const transforms = [];
    keyframes(root, name).walkDecls('transform', decl => transforms.push(decl.value));
    assert.ok(new Set(transforms).size > 1);
  }
});

test('night stars can twinkle while day hiding and the moon oval guard remain intact', async () => {
  const root = await styles;
  for (const area of ['preview', 'dropdown']) {
    const stars = matchingRules(root, selector => selector.includes(`.weather-header-${area}__stars-back.is-night-sky::`));
    assert.ok(stars.length > 0);
    for (const rule of stars) {
      for (const decl of rule.nodes.filter(node => node.type === 'decl' && node.prop === 'opacity')) {
        assert.equal(Boolean(decl.important), false, `${area}: night opacity must not override twinkle keyframes`);
      }
    }
    const hidden = matchingRules(root, selector => selector.includes(`.weather-header-${area}__stars-back:not(.is-night-sky)::`));
    assert.equal(lastDeclaration(hidden, 'display').value, 'none');
    assert.equal(lastDeclaration(hidden, 'content').value, 'none');
  }
  for (const name of ['weatherHeaderStarsTwinkle', 'weatherHeaderStarsTwinkleAlt', 'weatherDropdownStarsTwinkle', 'weatherDropdownStarsTwinkleAlt']) {
    const opacities = [];
    keyframes(root, name).walkDecls('opacity', decl => opacities.push(decl.value));
    assert.ok(new Set(opacities).size > 1, name);
  }
  const ovalGuard = matchingRules(root, selector => /^\.weather-orb-overlay\.has-cloud-veil::(?:before|after)$/.test(selector));
  assert.equal(lastDeclaration(ovalGuard, 'display').value, 'none');
  assert.equal(lastDeclaration(ovalGuard, 'content').value, 'none');
});

test('the fine weather menu rim keeps its 12.8 second glint and animated properties unlocked', async () => {
  const root = await styles;
  const rim = matchingRules(root, selector => selector.endsWith('.weather-header-card__toggle::before'));
  assert.equal(lastDeclaration(rim, 'animation').value, 'weatherHeaderMenuRimFlow 12.8s ease-in-out infinite');
  assert.equal(lastDeclaration(rim, 'padding').value, '0.5px');
  assert.ok(lastDeclaration(rim, 'mask') || lastDeclaration(rim, '-webkit-mask'));
  for (const rule of rim) {
    for (const decl of rule.nodes.filter(node => node.type === 'decl' && ['background-position', 'opacity'].includes(node.prop))) {
      assert.equal(Boolean(decl.important), false, `${decl.prop} must remain controlled by the rim animation`);
    }
  }
  const frames = keyframes(root, 'weatherHeaderMenuRimFlow');
  for (const property of ['background-position', 'opacity']) {
    const values = [];
    frames.walkDecls(property, decl => values.push(decl.value));
    assert.ok(new Set(values).size > 1, property);
    if (property === 'opacity') assert.ok(values.every(value => Number(value) > 0), 'the contour must stay visible throughout its cycle');
  }
});

test('weather dropdown clears the complete navigation on mobile and desktop and fits the visual viewport', async () => {
  const source = await readFile(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8');
  const declaration = source.match(/  function syncHeaderWeatherDropdownPlacement\(host\) \{[\s\S]*?\n  \}/)[0];
  for (const sample of [
    { width: 375, bottom: 185, navigationBottom: 185, parentTop: 54 },
    { width: 320, bottom: 220, navigationBottom: 232, parentTop: 60 },
    { width: 1440, bottom: 112, navigationBottom: 100, parentTop: 18 },
    { width: 1024, bottom: 232, navigationBottom: 232, parentTop: 90 },
    { width: 768, bottom: 210, navigationBottom: 224, parentTop: 52, scale: 1.25, border: 2, scroll: 7 },
    { width: 430, bottom: 190, navigationBottom: 190, parentTop: 54, viewportTop: 70, viewportHeight: 360 },
  ]) {
    let headerBottom = sample.bottom;
    const scale = sample.scale || 1;
    const properties = new Map();
    let writes = 0;
    const node = bottom => ({ getBoundingClientRect: () => ({ bottom, height: 30, width: sample.width }) });
    const navigation = node(sample.navigationBottom);
    const hidden = Object.assign(node(900), { hidden: true });
    const header = { getBoundingClientRect: () => ({ bottom: headerBottom, height: headerBottom, width: sample.width }), querySelectorAll: () => [navigation, hidden] };
    const parent = { offsetHeight: 78, clientTop: sample.border || 0, scrollTop: sample.scroll || 0,
      getBoundingClientRect: () => ({ top: sample.parentTop, height: 78 * scale }) };
    const dropdown = { offsetParent: parent, style: {
      getPropertyValue: name => properties.get(name)?.value || '',
      setProperty: (name, value, priority) => { writes += 1; properties.set(name, { value, priority }); },
    } };
    const host = { closest: () => header, shadowRoot: { querySelector: () => dropdown } };
    const window = { innerWidth: sample.width, innerHeight: 700,
      visualViewport: { offsetTop: sample.viewportTop || 0, height: sample.viewportHeight || 700 },
      getComputedStyle: element => ({ display: element.hidden ? 'none' : 'block', visibility: 'visible', opacity: '1' }),
    };
    const place = new Function('window', `${declaration}; return syncHeaderWeatherDropdownPlacement;`)(window);
    const assertPlacement = () => {
      const localTop = parseFloat(properties.get('top').value);
      const renderedTop = sample.parentTop + (localTop + parent.clientTop - parent.scrollTop) * scale;
      assert.ok(Math.abs(renderedTop - Math.max(headerBottom, sample.navigationBottom) - 10) < 0.02, JSON.stringify(sample));
      const available = Number(properties.get('max-height').value.match(/, ([\d.]+)px/)[1]);
      const viewportBottom = window.visualViewport.offsetTop + window.visualViewport.height;
      assert.ok(renderedTop + available * scale <= viewportBottom - 9.98);
      assert.equal(properties.get('top').priority, 'important', 'the measured anchor wins over the old CSS offset');
    };
    place(host);
    assertPlacement();
    place(host);
    assert.equal(writes, 2, 'unchanged geometry causes no repeated style writes');
    headerBottom += 24;
    place(host);
    assertPlacement();
  }
});

async function solarRecoveryHarness({ textureFailure = false, networkFailure = false, decodeFailure = false, decodeWait = Promise.resolve() } = {}) {
  const source = await readFile(new URL('../assets/js/header-weather-sun-scene.js', import.meta.url), 'utf8');
  const program = parse(source, { ecmaVersion: 'latest', sourceType: 'module', range: true });
  const code = program.body.filter(node => node.type !== 'ImportDeclaration').map(node => {
    const declaration = node.type === 'ExportNamedDeclaration' ? node.declaration : node;
    return source.slice(...declaration.range);
  }).join('\n');
  const listeners = new Map();
  const windowListeners = new Map();
  const viewportListeners = new Map();
  const frames = new Map();
  let nextFrame = 0;
  let nowMs = Date.UTC(2026, 10, 4, 12);
  const events = map => ({ addEventListener: (name, handler) => map.set(name, handler), removeEventListener: name => map.delete(name) });
  const viewport = { scale: 1, ...events(viewportListeners) };
  const window = { devicePixelRatio: 3, visualViewport: viewport, ...events(windowListeners) };
  const stats = { renders: 0, disposed: 0, texturesDisposed: 0, failRender: false, contextLost: false,
    events: [], sizes: [], textures: [], materialsDisposed: [], geometriesDisposed: [] };
  const canvas = { clientWidth: 96, clientHeight: 96,
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name),
  };
  const mapFragment = '#ifdef USE_MAP\n vec4 sampledDiffuseColor = texture2D( map, vMapUv );\n #ifdef DECODE_VIDEO_TEXTURE\n sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );\n #endif\n diffuseColor *= sampledDiffuseColor;\n#endif';
  class Renderer {
    constructor(options) { stats.rendererOptions = options; }
    setPixelRatio(value) { this.pixelRatio = value; stats.pixelRatio = value; }
    getPixelRatio() { return this.pixelRatio; }
    setClearColor(color, alpha) { stats.clear = { color, alpha }; }
    setSize(width, height, updateStyle) {
      canvas.width = Math.floor(width * this.pixelRatio);
      canvas.height = Math.floor(height * this.pixelRatio);
      stats.sizes.push({ width, height, updateStyle });
    }
    initTexture() { stats.events.push('upload'); }
    compile(scene) {
      stats.events.push('compile');
      const visit = node => {
        if (node.material?.onBeforeCompile) {
          const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <uv_vertex>', fragmentShader: '#include <common>\nvoid main() {\n#include <map_fragment>\n}' };
          node.material.onBeforeCompile(shader, this);
          stats.shader = shader;
        }
        node.children?.forEach(visit);
      };
      visit(scene);
    }
    getContext() { return { isContextLost: () => stats.contextLost }; }
    render() { if (stats.failRender) throw new Error('GPU unavailable'); stats.events.push('render'); stats.renders += 1; }
    dispose() { stats.disposed += 1; }
  }
  const THREE = {
    MathUtils: { degToRad: degrees => degrees * Math.PI / 180 },
    Clock: class { getElapsedTime() { return 0; } },
    ShaderChunk: { map_fragment: mapFragment },
    Scene: class { children = []; background = null; add(child) { this.children.push(child); } },
    PerspectiveCamera: class {
      constructor(fov) { this.fov = fov; }
      position = { set(x, y, z) { Object.assign(this, { x, y, z }); } };
      lookAt() {} updateProjectionMatrix() {}
    },
    WebGLRenderer: Renderer,
    TextureLoader: class { load(url, success, progress, failure) {
      if (textureFailure) throw new Error('Texture request failed');
      if (networkFailure) { failure(); return; }
      const texture = { image: { decode() { stats.events.push('decode'); return decodeFailure ? Promise.reject(new Error('Decode failed')) : decodeWait; } }, dispose() { stats.texturesDisposed += 1; } };
      stats.textures.push(texture);
      success(texture);
    } },
    Color: class { setRGB() {} },
    Vector2: class { constructor(x = 0, y = 0) { this.set(x, y); } set(x, y) { this.x = x; this.y = y; return this; } },
    ShaderMaterial: class { constructor(options) { Object.assign(this, options); } dispose() { stats.materialsDisposed.push(this); } },
    MeshBasicMaterial: class { constructor(options) { Object.assign(this, options); } dispose() { stats.materialsDisposed.push(this); } },
    SphereGeometry: class {
      constructor(radius, widthSegments, heightSegments) { this.parameters = { radius, widthSegments, heightSegments }; }
      dispose() { stats.geometriesDisposed.push(this); }
    },
    PlaneGeometry: class { constructor(width, height) { this.parameters = { width, height }; } dispose() { stats.geometriesDisposed.push(this); } },
    Mesh: class { constructor(geometry, material) { this.geometry = geometry; this.material = material; this.rotation = {}; } },
    Group: class { position = {}; rotation = {}; children = []; add(child) { this.children.push(child); } },
  };
  class ClockDate extends Date { static now() { return nowMs; } }
  const api = new Function('THREE', 'window', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date', `${code}; return { mount: mountHeaderWeatherSunScene, rate: solarRotationRateDegPerDay, offset: solarTextureOffsetTurns, angle: solarRotationAngle, pixelRatio: resolveSolarPixelRatio, epoch: SOLAR_MODEL_EPOCH_MS };`)(
    THREE, window, callback => { frames.set(++nextFrame, callback); return nextFrame; }, id => frames.delete(id), ClockDate
  );
  return { ...api, canvas, listeners, windowListeners, viewportListeners, window, viewport, frames, stats, setNow: value => { nowMs = value; } };
}

test('solar context loss shows recovery, resumes rendering after restoration and releases listeners on disposal', async () => {
  const h = await solarRecoveryHarness();
  const states = [];
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg', onStateChange: state => states.push(state) });
  assert.deepEqual(states, ['ready']);
  assert.equal(h.frames.size, 1);
  const renderedBeforeLoss = h.stats.renders;
  let prevented = false;
  h.listeners.get('webglcontextlost')({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true, 'context restoration remains permitted');
  assert.equal(h.frames.size, 0, 'no invalid GPU frames while the context is lost');
  assert.deepEqual(states, ['ready', 'lost']);
  h.listeners.get('webglcontextrestored')();
  assert.deepEqual(states, ['ready', 'lost', 'ready']);
  assert.ok(h.stats.renders > renderedBeforeLoss);
  assert.equal(h.frames.size, 1);
  scene.dispose();
  assert.equal(h.frames.size, 0);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.stats.disposed, 1);
});

test('failed solar initialization disposes its already allocated renderer and context listeners', async () => {
  const h = await solarRecoveryHarness({ textureFailure: true });
  await assert.rejects(h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' }), /Texture request failed/);
  assert.equal(h.stats.disposed, 1);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.frames.size, 0);
});

test('a solar render failure switches to recovery without an uncaught animation loop', async () => {
  const h = await solarRecoveryHarness();
  const states = [];
  const scene = await h.mount(h.canvas, { onStateChange: state => states.push(state) });
  h.stats.failRender = true;
  const [id, callback] = [...h.frames][0];
  h.frames.delete(id);
  callback();
  assert.deepEqual(states, ['ready', 'failed']);
  assert.equal(h.frames.size, 0);
  scene.dispose();
});

test('solar recovery preserves the canvas layout size and remounts a failed renderer after the retry delay', async () => {
  const root = await styles;
  const hiddenCanvas = matchingRules(root, selector => selector === ".weather-orb-overlay.is-header-sun:not([data-sun-scene='ready']) .weather-orb-overlay__canvas");
  assert.equal(lastDeclaration(hiddenCanvas, 'visibility').value, 'hidden');
  assert.notEqual(lastDeclaration(hiddenCanvas, 'display')?.value, 'none', 'restoration must retain the CSS dimensions rather than shrink the backing store to 8px');
  const solarImage = matchingRules(root, selector => selector === ".weather-orb-overlay.is-sun.is-header-sun[data-sun-surface='ready']:is([data-sun-scene='failed'], [data-sun-scene='lost']) .weather-orb-overlay__image");
  assert.equal(lastDeclaration(solarImage, 'position').value, 'absolute');
  assert.equal(lastDeclaration(solarImage, 'position').important, true, 'the recovery image must overlay the hidden canvas rather than follow it in document flow');
  assert.equal(lastDeclaration(solarImage, 'clip-path').value, 'circle(50%)');
  assert.equal(lastDeclaration(solarImage, 'clip-path').important, true, 'the solar texture cannot escape its circular silhouette under broad transparency styles');
  const source = await readFile(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8');
  const declaration = source.match(/  function setHeaderWeatherOrbSource\(overlay, kind, assetConfig\) \{[\s\S]*?\n  \}/)[0];
  let now = 100;
  let mounts = 0;
  let disposals = 0;
  const image = { hidden: false };
  const overlay = { dataset: { sunScene: 'failed' }, __sunScene: {}, __sunSceneRetryAfter: 200,
    classList: { toggle() {}, remove() {}, add() {} }, querySelector: tag => tag === 'img' ? image : {},
  };
  const setSource = new Function('stopHeaderWeatherSunScene', 'mountHeaderWeatherSunScene', 'Date', `${declaration}; return setHeaderWeatherOrbSource;`)(
    target => { disposals += 1; target.__sunScene = null; }, () => { mounts += 1; }, { now: () => now }
  );
  const assets = { type: 'header-sun', assetsModuleBase: '/assets', sunTextureUrl: '/solar.jpg' };
  setSource(overlay, 'sun', assets);
  assert.equal(mounts, 0, 'failed GPU attempts are throttled');
  assert.equal(image.hidden, false, 'the solar fallback remains visible');
  now = 201;
  setSource(overlay, 'sun', assets);
  assert.equal(disposals, 1, 'the invalid renderer must not trap future source synchronizations');
  assert.equal(mounts, 1, 'full 3D is tried again after a transient failure');
});

test('returning online immediately retries a failed solar import and disposal removes its recovery listeners', async () => {
  const source = await readFile(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8');
  const mountSource = source.match(/  async function mountHeaderWeatherSunScene\(overlay, assetConfig\) \{[\s\S]*?\n  \}/)[0];
  const stopSource = source.match(/  function stopHeaderWeatherSunScene\(overlay\) \{[\s\S]*?\n  \}/)[0];
  const online = new Map();
  const visibility = new Map();
  const events = listeners => ({ addEventListener: (name, handler) => listeners.set(name, handler), removeEventListener: name => listeners.delete(name) });
  const window = events(online);
  const document = { ...events(visibility), hidden: false };
  let finishSurface;
  const image = { decode: () => new Promise(resolve => { finishSurface = resolve; }) };
  const overlay = { isConnected: true, dataset: {}, querySelector: tag => tag === 'img' ? image : {} };
  let retries = 0;
  const { mount, stop } = new Function('window', 'document', 'stopHeaderWeatherOrbRender', 'loadHeaderWeatherSunSceneModule', 'setHeaderWeatherOrbSource', 'console',
    `${stopSource}\n${mountSource}\nreturn { mount: mountHeaderWeatherSunScene, stop: stopHeaderWeatherSunScene };`)(
    window, document, () => {}, async () => { throw new Error('Temporary import failure'); }, (target, kind) => {
      assert.equal(target, overlay); assert.equal(kind, 'sun'); assert.equal(target.__sunSceneRetryAfter, 0); retries += 1;
    }, { error() {} }
  );
  await mount(overlay, { assetsModuleBase: '/assets', sunTextureUrl: '/solar.jpg' });
  assert.equal(overlay.dataset.sunScene, 'failed');
  assert.equal(overlay.dataset.sunSurface, 'loading');
  finishSurface();
  await Promise.resolve();
  assert.equal(overlay.dataset.sunSurface, 'ready', 'a late fallback decode remains valid after the failed mount token is cleared');
  assert.equal(image.hidden, false);
  online.get('online')();
  assert.equal(retries, 1, 'network restoration must not wait for the minute clock or the retry throttle');
  document.hidden = true;
  visibility.get('visibilitychange')();
  assert.equal(retries, 1, 'hidden pages do not allocate another GPU context');
  stop(overlay);
  assert.equal(online.size, 0);
  assert.equal(visibility.size, 0);
});

test('solar readiness waits for texture decoding, GPU upload and hidden first render', async () => {
  let finishDecode;
  const decodeWait = new Promise(resolve => { finishDecode = resolve; });
  const h = await solarRecoveryHarness({ decodeWait });
  const states = [];
  const pending = h.mount(h.canvas, { sunTextureUrl: '/solar.jpg', onStateChange: state => { states.push(state); h.stats.events.push(state); } });
  await Promise.resolve();
  assert.deepEqual(states, [], 'an untextured solar disc must never be revealed');
  assert.equal(h.stats.renders, 0);
  finishDecode();
  const scene = await pending;
  assert.equal(scene.sunGroup.position.y, 0, 'the solar disc must project onto the shared canvas center');
  for (const [earlier, later] of [['decode', 'upload'], ['upload', 'compile'], ['compile', 'render'], ['render', 'ready']]) {
    assert.ok(h.stats.events.indexOf(earlier) < h.stats.events.indexOf(later), `${earlier} must precede ${later}`);
  }
  assert.deepEqual(states, ['ready']);
  scene.dispose();
  assert.equal(h.stats.texturesDisposed, 1);
});

test('missing or undecodable solar textures fail instead of showing a plain ready sphere', async () => {
  for (const options of [{ networkFailure: true }, { decodeFailure: true }]) {
    const h = await solarRecoveryHarness(options);
    const states = [];
    await assert.rejects(h.mount(h.canvas, { sunTextureUrl: '/solar.jpg', onStateChange: state => states.push(state) }), /texture could not load|Decode failed/);
    assert.deepEqual(states, []);
    assert.equal(h.stats.renders, 0);
    assert.equal(h.stats.disposed, 1);
    assert.equal(h.listeners.size, 0);
  }
});

test('the original solar surface stays hidden until ready and adds no SVG or rotating synthetic spokes', async () => {
  const root = await styles;
  const loading = matchingRules(root, selector => selector === ".weather-orb-overlay.is-sun.is-header-sun[data-sun-scene='loading']");
  assert.equal(lastDeclaration(loading, 'opacity').value, '0');
  assert.equal(lastDeclaration(loading, 'opacity').important, true);
  const visible = matchingRules(root, selector => selector === '.weather-orb-overlay.is-sun.is-header-sun.is-visible');
  assert.match(lastDeclaration(visible, 'opacity').value, /--orb-sun-transmission/, 'the complete solar surface retains its live cloud attenuation');
  const canvas = matchingRules(root, selector => selector === '.weather-orb-overlay.is-sun.is-header-sun .weather-orb-overlay__canvas');
  assert.doesNotMatch(lastDeclaration(canvas, 'filter').value, /contrast|saturate/, 'the original photographic detail must not be flattened or recolored');
  const shell = await readFile(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8');
  const scene = await readFile(new URL('../assets/js/header-weather-sun-scene.js', import.meta.url), 'utf8');
  const brightness = Number(shell.match(/HEADER_WEATHER_SUN_BRIGHTNESS = ([\d.]+)/)?.[1]);
  assert.ok(brightness > 1 && brightness <= 1.2, 'the original texture receives only a gentle exposure lift');
  assert.doesNotMatch(shell, /weather-orb-overlay__corona|weatherSolarCoronaOrbit|weatherSolarCoronaBreath/);
  assert.doesNotMatch(scene, /function mountSunProminences|createElementNS|weather-sun-prominence/);
  root.walkRules(rule => {
    if (!rule.selector.includes('.is-sun')) return;
    rule.walkDecls(decl => assert.doesNotMatch(decl.value, /repeating-conic-gradient/, 'Sun rules cannot reintroduce rotating spoke layers'));
  });
  for (const property of ['left', 'top']) {
    const moon = matchingRules(root, selector => selector === '.weather-orb-overlay--dropdown.is-moon');
    const sun = matchingRules(root, selector => selector === '.weather-orb-overlay--dropdown.is-sun');
    const anchors = rules => rules.flatMap(rule => rule.nodes
      .filter(node => node.type === 'decl' && node.prop === property)
      .map(decl => ({ media: rule.parent.params || 'all', value: decl.value, important: Boolean(decl.important) })));
    assert.deepEqual(anchors(sun), anchors(moon), 'both bodies must share every base and responsive anchor');
  }
});

test('the solar model uses latitude-dependent Earth-view rotation rather than a thirty-minute animation', async () => {
  const h = await solarRecoveryHarness();
  assert.equal(h.epoch, Date.UTC(2026, 10, 4));
  const earthRate = 360 / 365.256;
  assert.ok(Math.abs(h.rate(0) - (14.37 - earthRate)) < 1e-12);
  assert.ok(Math.abs(h.rate(30) - (14.37 - 2.33 / 4 - 1.56 / 16 - earthRate)) < 1e-12);
  assert.ok(h.rate(0) > h.rate(16) && h.rate(16) > h.rate(30) && h.rate(30) > h.rate(60));
  assert.equal(h.rate(-30), h.rate(30));
  const hour = h.epoch + 3600000;
  const delta = (h.angle(hour) - h.angle(h.epoch)) * 180 / Math.PI;
  assert.ok(Math.abs(delta - h.rate(0) / 24) < 1e-10);
  assert.ok(delta > .55 && delta < .56, 'physical hourly drift is small and cannot be accelerated for visual effect');
  assert.equal(h.offset(hour, 0), 0);
});

test('differential texture sampling moves a spherical feature at its latitude rate without reversing or doubling its speed', async () => {
  const h = await solarRecoveryHarness();
  const later = h.epoch + 3600000;
  const rotation = h.angle(later) - h.angle(h.epoch);
  // Installed SphereGeometry uses x=-cos(2πu)cos(latitude), z=sin(2πu)cos(latitude).
  // A texture feature at u=.25 is drawn at geometry u=.25-samplingOffset.
  for (const latitude of [0, 16, 30, 60]) {
    const offset = h.offset(later, latitude);
    const featureU = .25 - offset;
    const radius = Math.cos(latitude * Math.PI / 180);
    const x = -Math.cos(2 * Math.PI * featureU) * radius;
    const z = Math.sin(2 * Math.PI * featureU) * radius;
    const renderedX = Math.cos(rotation) * x + Math.sin(rotation) * z;
    const renderedZ = -Math.sin(rotation) * x + Math.cos(rotation) * z;
    const renderedDegrees = Math.atan2(renderedX, renderedZ) * 180 / Math.PI;
    assert.ok(Math.abs(renderedDegrees - h.rate(latitude) / 24) < 1e-10, 'latitude ' + latitude + ': base rotation minus sampled UV residual must equal the physical rate');
    assert.ok(renderedX > 0, 'visible features continue in the mesh rotation direction');
    assert.ok(Math.abs(offset - (h.rate(0) - h.rate(latitude)) / 24 / 360) < 1e-14);
    assert.equal(h.offset(h.epoch, latitude), 0);
  }
});

test('absolute UTC advances one material uniform without reloading or recompiling the original solar texture', async () => {
  const h = await solarRecoveryHarness();
  h.setNow(h.epoch);
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' });
  const material = scene.sunMesh.material;
  const uniform = scene.solarDaysUniform;
  const cacheKey = material.customProgramCacheKey();
  const start = scene.sunMesh.rotation.y;
  const compileCount = h.stats.events.filter(event => event === 'compile').length;
  assert.equal(material.map, h.stats.textures[0], 'the original decoded map remains the only surface source');
  assert.ok(Object.values(h.stats.shader.uniforms).includes(uniform));
  assert.ok(h.stats.shader.fragmentShader.includes('texture2D( map,'));
  assert.ok(h.stats.shader.fragmentShader.includes('diffuseColor *= sampledDiffuseColor'));
  assert.ok(h.stats.shader.fragmentShader.includes('DECODE_VIDEO_TEXTURE'), 'the original Three map chunk stays intact around the changed UV');
  const uvName = h.stats.shader.fragmentShader.match(/texture2D\(\s*map,\s*(\w+)\s*\)/)?.[1];
  assert.ok(uvName && uvName !== 'vMapUv', 'the texture must sample the latitude-adjusted coordinates');
  const residual = h.stats.shader.fragmentShader.match(new RegExp(uvName + '\\.x\\s*\\+=\\s*([^;]+);'))?.[1];
  assert.ok(residual, 'the compiled material must add the positive residual sampling offset');
  const sampleOffset = new Function('uSolarDays', 'solarSin2', 'return (' + residual + ');');
  for (const latitude of [0, 16, 30, 60]) {
    const actual = sampleOffset(1 / 24, Math.sin(latitude * Math.PI / 180) ** 2);
    assert.ok(Math.abs(actual - h.offset(h.epoch + 3600000, latitude)) < 1e-14, 'the actual injected shader must use the same latitude rate and sign as the spherical feature model');
  }
  h.setNow(h.epoch + 3600000);
  scene.renderFrame();
  assert.ok(Math.abs(scene.sunMesh.rotation.y - start - h.rate(0) / 24 * Math.PI / 180) < 1e-10, 'renderFrame must use wall-clock UTC rather than a fresh session clock');
  assert.equal(scene.solarDaysUniform, uniform);
  assert.equal(uniform.value, 1 / 24);
  assert.equal(material.customProgramCacheKey(), cacheKey);
  assert.equal(h.stats.events.filter(event => event === 'compile').length, compileCount);
  assert.equal(h.stats.textures.length, 1);
  assert.equal(h.stats.rendererOptions.alpha, true);
  assert.equal(h.stats.clear.alpha, 0);
  assert.equal(scene.scene.background, null, 'the Sun renderer cannot introduce a daytime sky into the header');
  scene.dispose();
  const restored = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' });
  assert.equal(restored.sunMesh.rotation.y, h.angle(h.epoch + 3600000), 'remounting the renderer cannot reset astronomical phase');
  assert.equal(restored.solarDaysUniform.value, 1 / 24);
  restored.dispose();
});

test('native retina and pinch zoom retain CSS dimensions, coalesce backing resize and release all resize work', async () => {
  const h = await solarRecoveryHarness();
  assert.equal(h.pixelRatio(100, 60, 3, 1), 3);
  assert.equal(h.pixelRatio(100, 60, 3, 2), 6);
  assert.ok(Math.abs(h.pixelRatio(900, 600, 3, 2) - 1024 / 900) < 1e-12);
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' });
  assert.equal(h.canvas.width, 96 * 3);
  assert.equal(h.canvas.height, 96 * 3);
  const priorFrames = new Set(h.frames.keys());
  const priorSizes = h.stats.sizes.length;
  h.viewport.scale = 2;
  h.windowListeners.get('resize')();
  h.viewportListeners.get('resize')();
  h.viewportListeners.get('resize')();
  const resizeFrames = [...h.frames].filter(([id]) => !priorFrames.has(id));
  assert.equal(resizeFrames.length, 1, 'multiple viewport signals must allocate one resize frame');
  const [id, callback] = resizeFrames[0];
  h.frames.delete(id);
  callback();
  assert.equal(h.stats.sizes.length, priorSizes + 1);
  assert.deepEqual(h.stats.sizes.at(-1), { width: 96, height: 96, updateStyle: false });
  assert.equal(h.canvas.width, 96 * 6);
  assert.equal(h.canvas.height, 96 * 6);
  h.viewport.scale = 30;
  scene.resize();
  assert.ok(Math.max(h.canvas.width, h.canvas.height) <= 1024, 'pinch zoom cannot exceed the bounded backing store');
  h.windowListeners.get('resize')();
  scene.dispose();
  assert.equal(h.frames.size, 0);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.windowListeners.size, 0);
  assert.equal(h.viewportListeners.size, 0);
});

test('the solar lens flare shares the transparent renderer and releases its own GPU resources', async () => {
  const h = await solarRecoveryHarness();
  const states = [];
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg', onStateChange: state => states.push(state) });
  const flare = scene.flareMesh;
  assert.ok(flare?.material?.vertexShader && flare.material.fragmentShader, 'the optical effect must be a renderer-owned shader plane');
  assert.deepEqual(flare.geometry.parameters, { width: 2, height: 2 });
  assert.equal(flare.renderOrder, 2);
  assert.equal(flare.frustumCulled, false);
  assert.equal(scene.scene.children.filter(node => node === flare).length, 1);
  assert.equal(scene.sunMesh.material.map, h.stats.textures[0], 'the flare must not replace or reload the original solar surface');
  assert.equal(h.stats.textures.length, 1);
  assert.equal(scene.scene.background, null);
  assert.equal(h.stats.clear.alpha, 0, 'the optical effect must preserve the transparent header');
  h.listeners.get('webglcontextlost')({ preventDefault() {} });
  h.listeners.get('webglcontextrestored')();
  assert.deepEqual(states, ['ready', 'lost', 'ready']);
  assert.equal(scene.flareMesh, flare, 'restoration must reuse one optical layer rather than accumulate planes');
  scene.dispose();
  assert.equal(h.stats.materialsDisposed.filter(material => material === flare.material).length, 1);
  assert.equal(h.stats.geometriesDisposed.filter(geometry => geometry === flare.geometry).length, 1);
  assert.equal(h.stats.texturesDisposed, 1);
  assert.equal(h.frames.size, 0);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.windowListeners.size, 0);
  assert.equal(h.viewportListeners.size, 0);
});

test('the solar lens flare axis follows the host callback while its optical phase follows absolute UTC', async () => {
  const h = await solarRecoveryHarness();
  let center = { x: .18, y: .73 };
  let samples = 0;
  h.setNow(h.epoch + 12345);
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg', getOpticalCenter() { samples += 1; return center; } });
  const uniforms = scene.flareMesh.material.uniforms;
  assert.equal(uniforms.uOpticalCenter.value.x, center.x);
  assert.equal(uniforms.uOpticalCenter.value.y, center.y);
  assert.equal(uniforms.uTime.value, 12.345);
  const initialSamples = samples;
  const axis = uniforms.uOpticalCenter.value;
  center = { x: .83, y: .27 };
  scene.resize();
  assert.ok(samples > initialSamples, 'layout changes must resample the optical center');
  assert.equal(uniforms.uOpticalCenter.value, axis, 'resizing updates the existing GPU uniform without recreating a material');
  assert.equal(axis.x, center.x);
  assert.equal(axis.y, center.y);
  h.setNow(h.epoch + 86400000 + 9876);
  scene.renderFrame();
  assert.equal(uniforms.uTime.value, 9.876, 'an optical phase wraps by UTC day rather than resetting with each mount');
  const phase = uniforms.uTime.value;
  scene.dispose();
  const remounted = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' });
  assert.equal(remounted.flareMesh.material.uniforms.uTime.value, phase);
  assert.equal(remounted.flareMesh.material.uniforms.uOpticalCenter.value.x, .22);
  assert.equal(remounted.flareMesh.material.uniforms.uOpticalCenter.value.y, .32);
  remounted.dispose();
});

test('the actual solar flare shader excludes the original photosphere and fades before the canvas edge', async () => {
  const h = await solarRecoveryHarness();
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' });
  const material = scene.flareMesh.material;
  assert.equal(material.transparent, true);
  assert.equal(material.depthTest, false);
  assert.equal(material.depthWrite, false);
  assert.equal(material.toneMapped, false);
  assert.match(material.vertexShader, /gl_Position\s*=\s*vec4\(position\.xy,\s*0\.0,\s*1\.0\)/, 'the optical plane must use screen UV coordinates rather than the sphere camera projection');
  const maskExpression = material.fragmentShader.match(/float\s+outsideDisc\s*=\s*([^;]+);/)?.[1];
  assert.ok(maskExpression, 'the flare must declare an explicit photosphere exclusion mask');
  const smoothstep = (low, high, value) => {
    const t = Math.min(1, Math.max(0, (value - low) / (high - low)));
    return t * t * (3 - 2 * t);
  };
  const discMask = new Function('smoothstep', 'radial', `return (${maskExpression});`).bind(null, smoothstep);
  const radius = scene.sunMesh.geometry.parameters.radius;
  const distance = scene.camera.position.z;
  const projectedRadius = radius / Math.sqrt(distance ** 2 - radius ** 2) / (2 * Math.tan(scene.camera.fov * Math.PI / 360));
  for (const fraction of [0, .25, .5, .75, 1]) {
    assert.equal(discMask(projectedRadius * fraction), 0, 'no shader light can wash over any part of the original solar disc');
  }
  assert.ok(discMask(projectedRadius + .02) > .9, 'optical light remains available immediately outside the photosphere');
  const attenuation = material.fragmentShader.match(/light\s*\*=\s*([^;]+);\s*float\s+alpha\s*=/)?.[1];
  assert.ok(attenuation, 'the exclusion mask must attenuate RGB before its alpha is calculated');
  assert.match(attenuation, /outsideDisc/);
  const attenuate = new Function('outsideDisc', 'shimmer', 'smoothstep', 'radial', `return (${attenuation});`);
  assert.equal(attenuate(0, 1, smoothstep, projectedRadius), 0);
  assert.equal(attenuate(1, 1, smoothstep, .5), 0, 'all optical light must fade completely before reaching the square canvas edge');
  assert.ok(attenuate(1, 1, smoothstep, .48) > attenuate(1, 1, smoothstep, .49));
  assert.match(material.fragmentShader, /lensAxis\s*=\s*uOpticalCenter\s*-\s*vec2\(0\.5\)/);
  assert.match(material.fragmentShader, /direction\s*=\s*lensAxis\s*\/\s*max\(axisLength,\s*0\.0001\)/, 'a centered optical axis cannot divide by zero');
  scene.dispose();
});

test('the shell derives the optical axis from the live header or dropdown rectangle with the correct UV vertical direction', async () => {
  const source = await readFile(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8');
  const pending = [parse(source, { ecmaVersion: 'latest', sourceType: 'script' })];
  let callback;
  while (pending.length) {
    const node = pending.pop();
    if (node.type === 'Property' && node.key?.name === 'getOpticalCenter') {
      callback = node.value;
      break;
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) pending.push(...value.filter(item => item?.type));
      else if (value?.type) pending.push(value);
    }
  }
  assert.ok(callback, 'the solar mount must supply a geometry-based getOpticalCenter callback');
  const canvasBounds = { left: 240, top: 50, width: 100, height: 100 };
  let region = { left: 0, top: 20, width: 430, height: 180 };
  const canvas = { getBoundingClientRect: () => canvasBounds };
  const overlay = { closest(selector) {
    assert.ok(selector.includes('.weather-header-preview') && selector.includes('.weather-header-dropdown__hero'), 'both solar variants must derive an optical axis');
    return region && { getBoundingClientRect: () => region };
  } };
  const getCenter = new Function('canvas', 'overlay', `return (${source.slice(callback.start, callback.end)});`)(canvas, overlay);
  assert.deepEqual(getCenter(), { x: -.25, y: .4 }, 'the optical axis points toward the weather region center, with UV Y growing upward');
  region = { left: 20, top: 0, width: 600, height: 140 };
  assert.deepEqual(getCenter(), { x: .8, y: .8 }, 'the callback must sample current bounds after responsive repositioning');
  canvasBounds.width = 0;
  assert.equal(getCenter(), null, 'an unmeasurable canvas must keep the safe default axis');
  canvasBounds.width = 100;
  region = null;
  assert.equal(getCenter(), null);
});
