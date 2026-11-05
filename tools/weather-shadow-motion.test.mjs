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
    events: [], sizes: [], textures: [], materialsDisposed: [], geometriesDisposed: [], colorsAtRender: [] };
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
          const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <uv_vertex>', fragmentShader: '#include <common>\nvoid main() {\n#include <map_fragment>\n#include <tonemapping_fragment>\n}' };
          node.material.onBeforeCompile(shader, this);
          stats.shader = shader;
        }
        node.children?.forEach(visit);
      };
      visit(scene);
    }
    getContext() { return { isContextLost: () => stats.contextLost }; }
    render() {
      if (stats.failRender) throw new Error('GPU unavailable');
      const color = stats.shader?.uniforms.uSolarSurfaceColor?.value;
      if (color) stats.colorsAtRender.push({ r: color.r, g: color.g, b: color.b });
      stats.events.push('render'); stats.renders += 1;
    }
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
    Color: class {
      constructor(r = 1, g = 1, b = 1) { this.setRGB(r, g, b); }
      setRGB(r, g, b) { Object.assign(this, { r, g, b }); return this; }
    },
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
  const api = new Function('THREE', 'window', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date', `${code}; return { mount: mountHeaderWeatherSunScene, rate: solarRotationRateDegPerDay, offset: solarTextureOffsetTurns, angle: solarRotationAngle, pixelRatio: resolveSolarPixelRatio, epoch: SOLAR_MODEL_EPOCH_MS, elevation: solarElevationDegrees, position: solarPosition, color: solarColorForElevation, surfaceColor: solarSurfaceColorForElevation };`)(
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
  const recoveryFilter = lastDeclaration(solarImage, 'filter').value;
  assert.match(recoveryFilter, /var\(--orb-sun-recovery-filter/);
  const defaultContrast = Number(recoveryFilter.match(/contrast\(([\d.]+)\)/)?.[1]);
  assert.ok(defaultContrast > 0 && defaultContrast <= .05, 'recovery before a renderer callback must also keep original spots subtle');
  assert.equal(lastDeclaration(solarImage, 'box-shadow'), undefined, 'the clipped image cannot own its external glow');
  assert.equal(lastDeclaration(solarImage, 'animation'), undefined);
  const nativeGlow = matchingRules(root, selector => selector === ".weather-orb-overlay.is-sun.is-header-sun[data-sun-surface='ready']:is([data-sun-scene='failed'], [data-sun-scene='lost'])");
  assert.match(lastDeclaration(nativeGlow, 'filter').value, /drop-shadow\([^]*var\(--orb-sun-glow-rgb, 255 255 255\)/, 'native recovery glow must be rendered outside the clipped image on its parent');
  assert.match(lastDeclaration(nativeGlow, 'animation').value, /weatherSunRecoveryGlow/);
  const parentClip = lastDeclaration(nativeGlow, 'clip-path')?.value;
  assert.ok(!parentClip || parentClip === 'none', 'the recovery parent must not clip its own glow');
  const orb = matchingRules(root, selector => selector === '.weather-orb-overlay');
  assert.equal(lastDeclaration(nativeGlow, 'overflow')?.value || lastDeclaration(orb, 'overflow').value, 'visible');
  keyframes(root, 'weatherSunRecoveryGlow').walkDecls('filter', declaration => {
    assert.match(declaration.value, /var\(--orb-sun-glow-rgb, 255 255 255\)/, 'every recovery pulse must use the same astronomical phase color');
  });
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
  assert.match(lastDeclaration(canvas, 'filter').value, /var\(--orb-sun-glow-rgb, 255 255 255\)/, 'the renderer halo must use the same phase color as native image recovery');
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

test('the actual solar flare shader overlaps only the antialiased limb without a dark gap and fades before the canvas edge', async () => {
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
  for (let i = 0; i <= 128; i += 1) {
    assert.equal(discMask((projectedRadius - .0025) * i / 128), 0, 'the original solar map stays untouched before its narrow antialiased limb');
  }
  assert.ok(discMask(projectedRadius) > .99, 'the optical light must already meet the sphere at its geometric edge, not start outside its antialias coverage');
  for (const [size, dpr] of [[92, 3], [111, 3], [384, 2.5]]) {
    const halfPixel = .5 / (size * dpr);
    assert.ok(discMask(projectedRadius - halfPixel) > .1, `${size}px canvas needs light beneath its inner antialiased edge`);
    assert.ok(discMask(projectedRadius + halfPixel) > .99, 'the outer antialiased edge cannot contain a transparent seam');
    assert.ok(.0025 * size < 1, 'the overlap must remain below one CSS pixel at the real and enlarged proof sizes');
  }
  assert.ok(discMask(projectedRadius + .001) > .15, 'the halo must begin at the limb rather than leave a fully transparent dark ring');
  assert.ok(discMask(projectedRadius + .002) > .65, 'the halo must already be strong within a subpixel distance outside the native-sized solar disc');
  assert.ok(discMask(projectedRadius + .02) > .9, 'optical light remains available immediately outside the photosphere');
  const attenuation = material.fragmentShader.match(/light\s*\*=\s*([^;]+);\s*float\s+alpha\s*=/)?.[1];
  assert.ok(attenuation, 'the exclusion mask must attenuate RGB before its alpha is calculated');
  assert.match(attenuation, /outsideDisc/);
  const attenuate = new Function('uSolarColor', 'outsideDisc', 'shimmer', 'smoothstep', 'radial', `return (${attenuation});`).bind(null, 1);
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

test('solar elevation follows independent NOAA fractional-year fixtures across longitudes, leap years and polar seasons', async () => {
  const h = await solarRecoveryHarness();
  // Numerical goldens for NOAA's published approximation, without atmospheric
  // refraction; the tolerance checks the implementation, not ephemeris accuracy.
  const fixtures = [
    ['2026-03-20T12:00:00Z', 0, 0, 87.9075757264],
    ['2026-03-20T06:00:00Z', 0, 90, 87.8652957447],
    ['2026-03-20T18:00:00Z', 0, -90, 87.9458471257],
    ['2026-03-20T00:00:00Z', 0, 180, 87.8192424737],
    ['2028-02-29T12:00:00Z', 0, 0, 81.4306369481],
    ['2026-06-21T12:00:00Z', 80, 0, 33.4518623548],
    ['2026-12-21T12:00:00Z', 80, 0, -13.4203113356],
    ['2026-12-21T01:55:00Z', -33.8688, 151.2093, 79.5350666274],
  ];
  for (const [iso, latitude, longitude, expected] of fixtures) {
    const actual = h.elevation(Date.parse(iso), latitude, longitude);
    assert.ok(Math.abs(actual - expected) < .001, `${iso}, ${latitude}, ${longitude}: expected NOAA approximation ${expected}, received ${actual}`);
  }
  for (const latitude of [-90, -89.999, 0, 89.999, 90]) {
    for (const longitude of [-180, 0, 180]) {
      for (const iso of ['2026-06-21T00:00:00Z', '2026-12-21T12:00:00Z', '2028-02-29T23:59:59Z']) {
        const altitude = h.elevation(Date.parse(iso), latitude, longitude);
        assert.ok(Number.isFinite(altitude) && altitude >= -90 && altitude <= 90, 'polar and leap-day calculations must stay finite and in degree range');
      }
    }
  }
  for (const args of [[NaN, 0, 0], [Date.now(), NaN, 0], [Date.now(), 0, Infinity]]) {
    const value = h.elevation(...args);
    assert.ok(Number.isNaN(value), 'missing coordinates must not fabricate a valid astronomical elevation');
    const fallback = h.color(value);
    assert.ok(['r', 'g', 'b'].every(channel => Number.isFinite(fallback[channel])), 'an invalid elevation must never leak NaN into a shader');
  }
});

test('the solar elevation palette changes smoothly from horizon red through orange to neutral high Sun in linear RGB', async () => {
  const h = await solarRecoveryHarness();
  const target = { r: 0, g: 0, b: 0 };
  assert.equal(h.color(12, target), target, 'the renderer must reuse its color object rather than allocate every animation frame');
  for (const altitude of [12, 30, 90]) {
    const color = h.color(altitude);
    assert.ok(Math.abs(color.r - 1) < 1e-12 && Math.abs(color.g - 1) < 1e-12 && Math.abs(color.b - 1) < 1e-12, 'high Sun must be neutral white rather than retain the orange photographic tint');
  }
  const levels = [-.833, 0, 3, 6, 12].map(altitude => h.color(altitude));
  assert.ok(levels[0].r > levels[0].g * 3 && levels[0].g > levels[0].b, 'the horizon end of the palette must be red');
  for (let i = 1; i < levels.length; i += 1) {
    assert.ok(levels[i].g / levels[i].r > levels[i - 1].g / levels[i - 1].r, 'green progressively returns as the Sun rises');
    assert.ok(levels[i].b / levels[i].r > levels[i - 1].b / levels[i - 1].r, 'blue progressively returns as the atmospheric path shortens');
  }
  for (const altitude of [-90, -.833, 0, 3, 6, 12, 90, NaN]) {
    const color = h.color(altitude);
    for (const channel of ['r', 'g', 'b']) assert.ok(Number.isFinite(color[channel]) && color[channel] >= 0 && color[channel] <= 1, 'the linear color must remain a bounded finite shader input');
  }
  for (const altitude of [-.833, 0, 3, 6, 12]) {
    const left = h.color(altitude - .0001);
    const right = h.color(altitude + .0001);
    assert.ok(Math.max(...['r', 'g', 'b'].map(channel => Math.abs(left[channel] - right[channel]))) < .001, 'palette knots cannot cause a visible color discontinuity');
  }
});

test('the separate photosphere palette remains seamless and pale above the horizon while retaining a red low endpoint', async () => {
  const h = await solarRecoveryHarness();
  const target = { r: 0, g: 0, b: 0 };
  assert.equal(h.surfaceColor(3, target), target, 'surface updates must reuse their own color object');
  const previous = { r: 0, g: 0, b: 0 };
  for (const elevation of [-.833, 0, 1, 3, 6, 12, 45]) {
    const surface = h.surfaceColor(elevation);
    for (const channel of ['r', 'g', 'b']) {
      assert.ok(Number.isFinite(surface[channel]) && surface[channel] >= 0 && surface[channel] <= 1);
      assert.ok(surface[channel] >= previous[channel], 'the surface must warm continuously as its elevation decreases');
      previous[channel] = surface[channel];
    }
    const left = h.surfaceColor(elevation - .0001);
    const right = h.surfaceColor(elevation + .0001);
    assert.ok(Math.max(...['r', 'g', 'b'].map(channel => Math.abs(left[channel] - right[channel]))) < .001, 'the independent surface calibration cannot create a color jump at a palette knot');
  }
  for (const elevation of [12, 45, 90]) {
    const surface = h.surfaceColor(elevation);
    assert.ok(surface.r === 1 && surface.g < 1 && surface.g > .98 && surface.b < surface.g && surface.b > .86, 'known daylight remains luminous with a slight cream-gold tint');
  }
  assert.deepEqual(h.surfaceColor(NaN), { r: 1, g: 1, b: 1 }, 'unknown geography must remain neutral rather than invent a daytime phase');
  const low = h.surfaceColor(-.833);
  assert.ok(low.r > low.g * 3 && low.g > low.b, 'a very low solar disc must still become red rather than remain white forever');
  assert.deepEqual(h.surfaceColor(-5), low);
  assert.ok(h.surfaceColor(1).g > h.surfaceColor(0).g && h.surfaceColor(1).b > h.surfaceColor(0).b);
  assert.ok(h.surfaceColor(3).b > h.color(3).b * 5, 'the pale photosphere cannot inherit the already orange halo tint');
});

test('morning, apparent noon and evening follow local solar hour angle without wall-clock phase switches', async () => {
  const h = await solarRecoveryHarness();
  const day = Date.UTC(2026, 2, 20);
  const timeAtAngle = target => {
    let low = day + 1800000, high = day + 84600000;
    for (let index = 0; index < 45; index += 1) {
      const midpoint = (low + high) / 2;
      if (h.position(midpoint, 0, 0).hourAngleDeg < target) low = midpoint;
      else high = midpoint;
    }
    return high;
  };
  h.setNow(timeAtAngle(-80));
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg', geoState: { latitude: 0, longitude: 0 } });
  const morning = scene.solarSpotStrengthUniform.value;
  assert.ok(morning > 0 && morning < .35);
  h.setNow(timeAtAngle(0)); scene.renderFrame();
  assert.equal(scene.solarSpotStrengthUniform.value, 0, 'the brightest local noon retains very delicate original detail');
  h.setNow(timeAtAngle(80)); scene.renderFrame();
  assert.ok(scene.solarSpotStrengthUniform.value > morning * 2, 'low setting light may reveal slightly more original detail as an explicit display calibration');
  assert.equal(h.stats.shader.uniforms.uSolarSpotStrength, scene.solarSpotStrengthUniform);
  const sameUtc = timeAtAngle(0);
  assert.ok(h.position(sameUtc, 0, -80).hourAngleDeg < 0 && h.position(sameUtc, 0, 80).hourAngleDeg > 0, 'one UTC instant must be morning or evening according to longitude');
  assert.ok(Math.abs(timeAtAngle(.001) - timeAtAngle(-.001)) < 1000, 'phase remains continuous across apparent noon');
  scene.dispose();
});

test('polar-day original spot contrast stays continuous across apparent solar midnight', async () => {
  const h = await solarRecoveryHarness();
  const geoState = { latitude: 70, longitude: 0 };
  let low = Date.UTC(2026, 5, 20, 23, 30), high = Date.UTC(2026, 5, 21, 0, 30);
  for (let index = 0; index < 45; index += 1) {
    const midpoint = (low + high) / 2;
    if (h.position(midpoint, geoState.latitude, geoState.longitude).hourAngleDeg > 0) low = midpoint;
    else high = midpoint;
  }
  h.setNow(low - 100);
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg', geoState });
  const before = scene.solarSpotStrengthUniform.value;
  assert.ok(h.elevation(low, geoState.latitude, geoState.longitude) > 3, 'the polar-day fixture must keep the Sun visible at its lowest altitude');
  assert.ok(before > .1, 'this low Sun must exercise nonzero original detail contrast');
  h.setNow(high + 100); scene.renderFrame();
  const after = scene.solarSpotStrengthUniform.value;
  assert.ok(Math.abs(after - before) < .00001, 'the wrapped +180/-180 hour angle cannot cause a visible contrast reset');
  scene.dispose();
});

test('the two Düsseldorf reference times retain a luminous disc while the halo changes from gold to orange', async () => {
  const srgb = linear => linear <= .0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - .055;
  const references = [
    { localTime: '2026-11-04T15:51:00+01:00', expectedElevation: 8.9 },
    { localTime: '2026-11-04T16:33:00+01:00', expectedElevation: 3.4 },
  ];
  let previousHalo;
  for (const { localTime, expectedElevation } of references) {
    const h = await solarRecoveryHarness();
    const now = Date.parse(localTime);
    // A public city-center fixture, not the visitor's precise geolocation.
    const geoState = { latitude: 51.22, longitude: 6.78 };
    const elevation = h.elevation(now, geoState.latitude, geoState.longitude);
    assert.ok(Math.abs(elevation - expectedElevation) < .25, 'the photographic reference must use its real CET-to-UTC instant and geographical elevation');
    h.setNow(now);
    const appearances = [];
    const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg', geoState, onAppearanceChange: appearance => appearances.push(appearance) });
    const surface = h.surfaceColor(elevation);
    const halo = h.color(elevation);
    const surfaceLuminance = surface.r * .2126 + surface.g * .7152 + surface.b * .0722;
    assert.ok(surfaceLuminance > .9 && srgb(surface.g) > .97 && srgb(surface.b) > .85, 'at both reference elevations the calibrated body must remain luminous and pale');
    assert.ok(srgb(surface.b) - srgb(halo.b) > .1, 'the surrounding halo must be visibly warmer than the disc');
    assert.ok(halo.r > halo.g && halo.g > halo.b);
    if (previousHalo) assert.ok(halo.b < previousHalo.b && halo.g < previousHalo.g, 'the later reference must progress from golden to orange surroundings');
    previousHalo = halo;
    assert.deepEqual({ ...scene.solarSurfaceColorUniform.value }, surface);
    assert.deepEqual({ ...scene.solarColorUniform.value }, halo);
    assert.deepEqual(h.stats.colorsAtRender[0], surface, 'the very first textured frame must use the pale body calibration');
    assert.equal(h.stats.shader.uniforms.uSolarSurfaceColor, scene.solarSurfaceColorUniform);
    assert.equal(scene.flareMesh.material.uniforms.uSolarColor, scene.solarColorUniform);
    const appearance = appearances.at(-1);
    assert.deepEqual(appearance.glowRgb.split(' ').map(Number), ['r', 'g', 'b'].map(channel => Math.round(255 * srgb(halo[channel]))));
    const recoveryWarmth = Number(appearance.recoveryFilter.match(/sepia\(([\d.]+)\)/)?.[1]);
    assert.ok(Math.abs(recoveryWarmth - (1 - srgb(surface.b)) / .93) < .00051, 'native image recovery must follow the pale surface rather than the stronger atmospheric tint');
    assert.ok(recoveryWarmth < .2, 'the pale reference disc cannot become a saturated orange fallback image');
    assert.equal(scene.sunMesh.material.map, h.stats.textures[0]);
    scene.dispose();
  }
});

test('solar initialization uses the requested coordinates before the first frame and geographic changes retain the same original texture and phase', async () => {
  const h = await solarRecoveryHarness();
  const now = Date.parse('2026-03-20T12:00:00Z');
  h.setNow(now);
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg', geoState: { latitude: 0, longitude: 0, timeMs: now } });
  assert.equal(scene.geoState.latitude, 0, 'the first mount must apply an equatorial latitude rather than the former Leipzig default');
  assert.equal(scene.geoState.longitude, 0, 'the Greenwich meridian is a valid zero coordinate');
  assert.deepEqual(h.stats.colorsAtRender[0], h.surfaceColor(h.elevation(now, 0, 0)), 'the hidden warmup frame must already have the correct geographic solar surface color');
  const phase = scene.sunMesh.rotation.y;
  const material = scene.sunMesh.material;
  const map = material.map;
  const uniform = scene.solarSurfaceColorUniform;
  const atmosphereUniform = scene.solarColorUniform;
  const compilationCount = h.stats.events.filter(event => event === 'compile').length;
  scene.setGeoState({ latitude: 0, longitude: 90, timeMs: now });
  scene.renderFrame();
  assert.equal(scene.geoState.latitude, 0);
  assert.equal(scene.geoState.longitude, 90);
  assert.deepEqual(h.stats.colorsAtRender.at(-1), h.surfaceColor(h.elevation(now, 0, 90)));
  assert.ok(uniform.value.r > uniform.value.g, 'the same UTC time must become warmer near a different local horizon');
  scene.setGeoState({ latitude: NaN, longitude: Infinity });
  scene.setGeoState({ latitude: 91, longitude: -181 });
  assert.equal(scene.geoState.latitude, 0, 'invalid latitude cannot replace the last valid selection');
  assert.equal(scene.geoState.longitude, 90, 'invalid longitude cannot replace the last valid selection');
  scene.setGeoState({ longitude: 0 });
  scene.renderFrame();
  assert.equal(scene.geoState.longitude, 0);
  assert.equal(scene.sunMesh.rotation.y, phase);
  assert.equal(scene.sunMesh.material, material);
  assert.equal(material.map, map);
  assert.equal(h.stats.textures.length, 1);
  assert.equal(h.stats.events.filter(event => event === 'compile').length, compilationCount);
  assert.equal(scene.solarSurfaceColorUniform, uniform);
  assert.equal(h.stats.shader.uniforms.uSolarSurfaceColor, uniform);
  assert.equal(scene.solarColorUniform, atmosphereUniform);
  assert.equal(scene.flareMesh.material.uniforms.uSolarColor, atmosphereUniform, 'the optical flare must retain its own stable atmospheric color uniform');
  assert.notEqual(uniform, atmosphereUniform, 'a golden halo must not force the luminous photosphere to the same saturated color');
  scene.dispose();
});

test('surface and flare tint use one server-corrected live UTC clock rather than cached weather or synthetic forecast noon', async () => {
  const preview = await solarRecoveryHarness();
  const dropdown = await solarRecoveryHarness();
  const rawTime = Date.parse('2026-03-20T12:00:00Z');
  let correctedTime = Date.parse('2026-03-20T06:00:00Z');
  preview.setNow(rawTime);
  dropdown.setNow(rawTime + 7200000);
  const getTimeMs = () => correctedTime;
  const options = { sunTextureUrl: '/solar.jpg', getTimeMs,
    geoState: { latitude: 0, longitude: 90, timeMs: Date.parse('2000-01-01T12:00:00Z'), localtime: '2040-12-21 12:00' } };
  const scenes = [await preview.mount(preview.canvas, options), await dropdown.mount(dropdown.canvas, options)];
  for (const scene of scenes) {
    assert.equal(scene.sunMesh.rotation.y, preview.angle(correctedTime));
    assert.equal(scene.solarDaysUniform.value, (correctedTime - preview.epoch) / 86400000);
    assert.equal(scene.flareMesh.material.uniforms.uTime.value, 6 * 3600);
    assert.deepEqual({ ...scene.solarColorUniform.value }, preview.color(preview.elevation(correctedTime, 0, 90)));
    assert.deepEqual({ ...scene.solarSurfaceColorUniform.value }, preview.surfaceColor(preview.elevation(correctedTime, 0, 90)));
  }
  correctedTime = rawTime;
  scenes.forEach(scene => scene.renderFrame());
  assert.deepEqual({ ...scenes[0].solarColorUniform.value }, { ...scenes[1].solarColorUniform.value }, 'both views follow one current astronomical phase, while forecast cloud cover remains independent');
  assert.deepEqual({ ...scenes[0].solarSurfaceColorUniform.value }, { ...scenes[1].solarSurfaceColorUniform.value }, 'the pale photosphere must use the same live UTC phase in both views');
  assert.ok(scenes[0].solarColorUniform.value.g < 1, 'the same location must warm as the server clock approaches its horizon');
  assert.equal(scenes[0].sunMesh.rotation.y, preview.angle(correctedTime));
  const color = { ...scenes[0].solarColorUniform.value };
  const surfaceColor = { ...scenes[0].solarSurfaceColorUniform.value };
  scenes[0].dispose();
  const remounted = await preview.mount(preview.canvas, options);
  assert.deepEqual({ ...remounted.solarColorUniform.value }, color);
  assert.deepEqual({ ...remounted.solarSurfaceColorUniform.value }, surfaceColor);
  assert.equal(remounted.sunMesh.rotation.y, preview.angle(correctedTime));
  for (const invalidTime of [NaN, Infinity, undefined]) {
    correctedTime = invalidTime;
    remounted.renderFrame();
    assert.equal(remounted.sunMesh.rotation.y, preview.angle(rawTime), 'an unavailable server clock must fall back to finite native UTC');
    assert.deepEqual({ ...remounted.solarColorUniform.value }, preview.color(preview.elevation(rawTime, 0, 90)));
    assert.deepEqual({ ...remounted.solarSurfaceColorUniform.value }, preview.surfaceColor(preview.elevation(rawTime, 0, 90)));
  }
  remounted.dispose();
  scenes[1].dispose();
});

test('the actual solar material preserves photographic luminance and applies its distinct surface color after tone mapping', async () => {
  const h = await solarRecoveryHarness();
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg', geoState: { latitude: 0, longitude: 90 } });
  const shader = h.stats.shader;
  assert.equal(shader.uniforms.uSolarSurfaceColor, scene.solarSurfaceColorUniform);
  assert.equal(scene.flareMesh.material.uniforms.uSolarColor, scene.solarColorUniform);
  assert.notEqual(shader.uniforms.uSolarSurfaceColor, scene.flareMesh.material.uniforms.uSolarColor);
  assert.equal(scene.sunMesh.material.map, h.stats.textures[0]);
  assert.equal(scene.sunMesh.material.customProgramCacheKey(), 'header-solar-atmosphere-v7');
  assert.match(shader.fragmentShader, /#include <tonemapping_fragment>\s*gl_FragColor\.rgb\s*\*=\s*uSolarSurfaceColor\s*;/, 'the pale surface color must tint already tone-mapped light rather than inherit the saturated atmospheric color');
  const weights = shader.fragmentShader.match(/float solarLuminance\s*=\s*dot\(diffuseColor\.rgb,\s*vec3\(([^)]+)\)\)/)?.[1].split(',').map(Number);
  assert.ok(weights?.length === 3 && weights.every(Number.isFinite), 'the shader must derive brightness from the original texture sample');
  assert.ok(Math.abs(weights.reduce((sum, weight) => sum + weight, 0) - 1) < 1e-12);
  const expression = shader.fragmentShader.match(/diffuseColor\.rgb\s*=\s*vec3\(([^;]+)\);/)?.[1];
  assert.ok(expression?.includes('solarLuminance'), 'the lifted brightness must still be computed from the actual sampled photographic luminance');
  const gamma = Number(expression.match(/pow\(clamp\(solarLuminance,\s*0\.0,\s*1\.0\),\s*([\d.]+)/)?.[1]);
  assert.ok(gamma > 0 && gamma < 1, 'a finite luminance lift retains spot structure while raising the original dark map');
  const lifted = new Function('solarLuminance', 'mix', 'pow', 'clamp', 'uSolarSpotStrength', `return (${expression});`);
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const mix = (low, high, weight) => low + (high - low) * weight;
  const luminance = rgb => rgb.reduce((sum, channel, i) => sum + channel * weights[i], 0);
  const brightness = rgb => lifted(luminance(rgb), mix, Math.pow, clamp, 0);
  const floor = brightness([0, 0, 0]);
  assert.ok(floor >= .45 && floor <= .6, 'the darkest original spots must be lifted without flattening almost the whole brightness range to white');
  let previous = -1;
  for (const value of [0, .001, .01, .05, .1, .25, .5, .75, 1]) {
    const actual = brightness([value, value, value]);
    assert.ok(Number.isFinite(actual) && actual >= floor && actual <= 1);
    assert.ok(actual > previous, 'every distinct sampled brightness must retain its ordering and photographic detail');
    previous = actual;
  }
  const bright = [.8, .5, .2];
  const dark = [.4, .2, .1];
  const contrast = brightness(bright) - brightness(dark);
  assert.ok(contrast > .01, 'the same photographic bright and dark features must remain spatially distinct');
  assert.ok(contrast < Math.pow(luminance(bright), gamma) - Math.pow(luminance(dark), gamma), 'the retained spot pattern must be subtler than the unlifted map');
  assert.equal(brightness([1, 1, 1]), 1);
  scene.dispose();
});

test('solar photographic detail remains faint but perceptible after the actual ACES and CSS display transforms', async () => {
  const h = await solarRecoveryHarness();
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' });
  const expression = h.stats.shader.fragmentShader.match(/diffuseColor\.rgb\s*=\s*vec3\(([^;]+)\);/)?.[1];
  const lift = new Function('solarLuminance', 'mix', 'pow', 'clamp', 'uSolarSpotStrength', `return (${expression});`);
  const engine = await readFile(new URL('../3d-weather-codrops-main/dist-widget/weather-3d-CKX6ob-m.mjs', import.meta.url), 'utf8');
  const fit = engine.match(/vec3 RRTAndODTFit\( vec3 v \) \{([\s\S]*?)\n\}/)?.[1];
  const exposureDivisor = Number(engine.match(/color \*= toneMappingExposure \/ ([\d.]+);/)?.[1]);
  assert.ok(fit && exposureDivisor > 0, 'use the real vendored Three tone mapper rather than a pre-tone contrast proxy');
  const toneMap = new Function('v', fit.replace(/\bvec3\b/g, 'const'));
  const shell = await readFile(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8');
  const displayGain = Number(shell.match(/const HEADER_WEATHER_SUN_BRIGHTNESS\s*=\s*([\d.]+);/)?.[1]);
  assert.ok(displayGain > 0);
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const display = (luminance, strength = 0) => {
    const lifted = lift(luminance, (a, b, amount) => a + (b - a) * amount, Math.pow, clamp, strength);
    const linear = clamp(toneMap(lifted * scene.renderer.toneMappingExposure / exposureDivisor), 0, 1);
    const srgb = linear <= .0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - .055;
    return clamp(srgb * displayGain, 0, 1);
  };
  const contrast = (display(.25) - display(.1)) * 255;
  assert.ok(contrast > 4.5 && contrast < 9, `original midtone detail must survive display mapping gently; got ${contrast} RGB levels`);
  assert.ok(display(0) > .85, 'even the darkest original sample remains luminous rather than creating a black outline');
  assert.ok(display(1) > .98, 'the unclouded white photosphere stays bright');
  const eveningContrast = (display(.25, 1) - display(.1, 1)) * 255;
  assert.ok(eveningContrast > contrast && eveningContrast < 12, 'warm evening detail becomes a little clearer while preserving soft original spots');
  assert.ok(display(0, 1) > .82, 'the evening shadow lift cannot create a dark limb');
  scene.dispose();
});

test('solar recovery appearance updates are quantized without emitting repeated DOM work for identical phases', async () => {
  const h = await solarRecoveryHarness();
  const now = Date.parse('2026-03-20T12:00:00Z');
  h.setNow(now);
  const appearances = [];
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg', geoState: { latitude: 0, longitude: 0 }, onAppearanceChange: value => appearances.push(value) });
  assert.equal(appearances.length, 1, 'constructor, warmup and first frame must share a single appearance notification');
  assert.equal(appearances[0].glowRgb, '255 255 255', 'the high Sun must have a neutral white halo');
  for (let i = 0; i < 120; i += 1) scene.updateAnimation(now + i * 16);
  assert.equal(appearances.length, 1, 'a stable high Sun must not trigger style mutations on every animation frame');
  scene.setGeoState({ longitude: 90 });
  assert.equal(appearances.length, 2, 'changing to a warm horizon still updates native image recovery');
  assert.match(appearances[1].recoveryFilter, /grayscale\(1\).*brightness\([\d.]+\).*sepia\([\d.]+\)/);
  scene.setGeoState({ longitude: 90 });
  scene.renderFrame();
  assert.equal(appearances.length, 2);
  assert.ok(appearances.every(value => Number.isFinite(value.elevationDeg) && !/NaN|Infinity/.test(value.recoveryFilter)));
  for (const appearance of appearances) {
    const channels = appearance.glowRgb.split(' ').map(Number);
    assert.ok(channels.length === 3 && channels.every(channel => Number.isInteger(channel) && channel >= 0 && channel <= 255), 'CSS glow channels must be finite bounded sRGB integers');
    assert.doesNotMatch(appearance.recoveryFilter, /hue-rotate|NaN|Infinity/);
    const contrast = Number(appearance.recoveryFilter.match(/contrast\(([\d.]+)\)/)?.[1]);
    assert.ok(contrast > 0 && contrast <= .05, 'the native recovery map must retain faint nonzero detail rather than harsh dark spots');
    const brightness = [...appearance.recoveryFilter.matchAll(/brightness\(([\d.]+)\)/g)].map(match => Number(match[1]));
    assert.equal(brightness.length, 2);
    assert.ok(brightness[0] >= .45 && brightness[0] <= 1.9);
    assert.ok(brightness[1] >= 1 && brightness[1] <= 1.2);
    const sepia = Number(appearance.recoveryFilter.match(/sepia\(([\d.]+)\)/)?.[1]);
    const saturation = Number(appearance.recoveryFilter.match(/saturate\(([\d.]+)\)/)?.[1]);
    assert.ok(sepia >= 0 && sepia <= 1 && saturation >= 1 && saturation <= 20, 'native phase filters must remain bounded finite CSS values');
  }
  const expectedGlow = ['r', 'g', 'b'].map(channel => {
    const linear = scene.solarColorUniform.value[channel];
    return Math.round(255 * (linear <= .0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - .055));
  });
  assert.deepEqual(appearances[1].glowRgb.split(' ').map(Number), expectedGlow, 'GPU light and CSS recovery glow must derive from the same linear RGB uniform');
  assert.ok(expectedGlow[0] > expectedGlow[1] && expectedGlow[1] > expectedGlow[2], 'the horizon halo must become warm together with the surface');
  scene.dispose();
});

test('solar recovery keeps reddening below the geometric horizon until the final palette stop and then remains stable', async () => {
  const h = await solarRecoveryHarness();
  const timeAtElevation = target => {
    let start = Date.parse('2026-03-20T17:00:00Z');
    let end = Date.parse('2026-03-20T20:00:00Z');
    while (end - start > 1) {
      const midpoint = Math.floor((start + end) / 2);
      if (h.elevation(midpoint, 0, 0) > target) start = midpoint;
      else end = midpoint;
    }
    assert.ok(Math.abs(h.elevation(end, 0, 0) - target) < .0001, 'the fixture must reach the requested geometric horizon altitude');
    return end;
  };
  h.setNow(timeAtElevation(0));
  const appearances = [];
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg', geoState: { latitude: 0, longitude: 0 }, onAppearanceChange: appearance => appearances.push(appearance) });
  let priorKey = scene.appearanceKey;
  let priorGlow = appearances.at(-1).glowRgb;
  assert.equal(appearances.length, 1);
  for (const [index, elevation] of [-.4, -.8].entries()) {
    h.setNow(timeAtElevation(elevation));
    scene.renderFrame();
    assert.ok(scene.appearanceKey > priorKey, 'appearance quantization must cover the complete palette below zero degrees');
    assert.equal(appearances.length, index + 2, 'each distinct sub-horizon phase must emit its updated recovery color');
    const glow = appearances.at(-1).glowRgb;
    assert.notEqual(glow, priorGlow, 'CSS glow must keep reddening with the GPU color rather than freeze at the horizon');
    priorKey = scene.appearanceKey;
    priorGlow = glow;
  }
  h.setNow(timeAtElevation(-.9));
  scene.renderFrame();
  const stoppedKey = scene.appearanceKey;
  const stoppedCount = appearances.length;
  const stoppedGlow = appearances.at(-1).glowRgb;
  const stoppedFilter = appearances.at(-1).recoveryFilter;
  const endpointBrightness = [...stoppedFilter.matchAll(/brightness\(([\d.]+)\)/g)].map(match => Number(match[1]));
  assert.deepEqual(endpointBrightness, [.45, 1.2], 'the lifted native detail must preserve the established warm horizon endpoint');
  for (const elevation of [-1.2, -2, -6]) {
    h.setNow(timeAtElevation(elevation));
    scene.renderFrame();
    assert.equal(scene.appearanceKey, stoppedKey);
    assert.equal(appearances.length, stoppedCount, 'below the final -0.833 degree stop a constant color must not trigger repeated style mutations');
    assert.equal(appearances.at(-1).glowRgb, stoppedGlow);
    assert.equal(appearances.at(-1).recoveryFilter, stoppedFilter);
  }
  scene.dispose();
});

const solarShaderMath = {
  sin: Math.sin, cos: Math.cos, atan: Math.atan2, pow: Math.pow, exp: Math.exp,
  abs: Math.abs, max: Math.max,
  clamp: (value, low, high) => Math.max(low, Math.min(high, value)),
  smoothstep: (low, high, value) => {
    const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
    return t * t * (3 - 2 * t);
  },
  vec2: (x, y) => ({ x, y }),
  dot: (a, b) => a.x * b.x + a.y * b.y,
  length: p => Math.hypot(p.x, p.y),
};

function solarShaderFloat(body, name) {
  const expression = body.match(new RegExp(`\\bfloat\\s+${name}\\s*=\\s*([^;]+);`))?.[1];
  assert.ok(expression, `the actual solar shader must declare ${name}`);
  return `const ${name} = ${expression};`;
}

function solarRaySampler(material) {
  const body = material.fragmentShader.match(/void main\(\)\s*\{([\s\S]*)\}/)?.[1];
  assert.ok(body);
  const rayBlock = body.match(/\bfloat outsideDisc\s*=[\s\S]*?(?=\bfloat plasma\s*=)/)?.[0];
  assert.ok(rayBlock, 'the actual ray field must precede the separate limb plasma composition');
  const fields = [...rayBlock.matchAll(/\bfloat\s+(\w+)\s*=/g)].map(match => match[1]);
  const sample = new Function('p', 'radial', 'uTime', 'math', `
    const { sin, cos, atan, pow, exp, max, clamp, smoothstep } = math;
    ${fields.map(name => solarShaderFloat(body, name)).join('\n')}
    return { outsideDisc, pulse, rayLength, rays, halo };
  `);
  return { body, sample };
}

test('actual solar ray light travels independently across the limb while retaining the original photosphere and texture', async () => {
  const h = await solarRecoveryHarness();
  h.setNow(h.epoch + 100000);
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' });
  const material = scene.flareMesh.material;
  const { body, sample: lightAt } = solarRaySampler(material);
  const firstTime = material.uniforms.uTime.value;
  const originalMap = scene.sunMesh.material.map;
  const initialRotation = scene.sunMesh.rotation.y;
  h.setNow(h.epoch + 103000);
  scene.renderFrame();
  const secondTime = material.uniforms.uTime.value;
  assert.equal(secondTime - firstTime, 3, 'the live UTC clock must advance the optical shader');
  const ratios = [];
  const rayGain = Number(body.match(/\brays\s*\*\s*([\d.]+)/)?.[1]);
  const displayChanges = [];
  assert.ok(rayGain > 0);
  let maximumChange = 0;
  for (let i = 0; i < 72; i += 1) {
    const angle = i * Math.PI / 36;
    for (const radial of [.262, .275, .29, .31]) {
      const point = { x: Math.cos(angle) * radial, y: Math.sin(angle) * radial };
      const first = lightAt(point, radial, firstTime, solarShaderMath);
      const second = lightAt(point, radial, secondTime, solarShaderMath);
      for (const sample of [first, second]) {
        assert.ok([sample.rays, sample.pulse, sample.halo].every(value => Number.isFinite(value) && value >= 0));
      }
      maximumChange = Math.max(maximumChange, Math.abs(first.rays - second.rays));
      displayChanges.push(Math.abs(first.rays - second.rays) * rayGain * 255 * 1.06);
      if (first.rays > .0001 && second.rays > .0001) ratios.push(second.rays / first.rays);
      assert.equal(first.halo, second.halo, 'moving light must not merely pulse the whole halo uniformly');
    }
  }
  assert.ok(maximumChange > .01, 'light along visible short rays must change perceptibly in three seconds');
  const displayRms = Math.sqrt(displayChanges.reduce((sum, change) => sum + change ** 2, 0) / displayChanges.length);
  assert.ok(displayRms > 8 && displayRms < 18, `local moving light must remain visible beside the steady halo without flashing the whole crown; got ${displayRms}`);
  assert.ok(ratios.length > 10 && Math.max(...ratios) - Math.min(...ratios) > .15, 'different ray positions must change independently rather than share one global shimmer');
  const radius = scene.sunMesh.geometry.parameters.radius;
  const distance = scene.camera.position.z;
  const photosphere = radius / Math.sqrt(distance ** 2 - radius ** 2) / (2 * Math.tan(scene.camera.fov * Math.PI / 360));
  for (const time of [firstTime, secondTime]) {
    for (const radial of [0, photosphere / 2, photosphere - .0025]) {
      assert.equal(lightAt({ x: radial, y: 0 }, radial, time, solarShaderMath).outsideDisc, 0, 'animated atmospheric light cannot cover the original solar disc');
    }
  }
  assert.equal(scene.sunMesh.material.map, originalMap);
  assert.equal(h.stats.textures.length, 1);
  assert.ok(Math.abs(scene.sunMesh.rotation.y - initialRotation) < .00001, 'the photographic surface keeps its physical slow rotation while optical light moves');
  scene.dispose();
});

test('mobile rays stay distinct from the halo at the shared 68px size after compositing', async () => {
  const h = await solarRecoveryHarness();
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' });
  const material = scene.flareMesh.material;
  const { body, sample } = solarRaySampler(material);
  const gain = Number(body.match(/\brays\s*\*\s*([\d.]+)/)?.[1]);
  const shell = await readFile(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8');
  const displayGain = Number(shell.match(/const HEADER_WEATHER_SUN_BRIGHTNESS\s*=\s*([\d.]+);/)?.[1]);
  const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
  const srgb = value => value <= .0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - .055;
  const composite = (light, transmission) => {
    const alpha = clamp(light, 0, .7);
    // The actual toneMapped=false layer divides light by alpha, encodes sRGB,
    // then normal source-over compositing and the shared CSS brightness apply.
    return (clamp(srgb(light / Math.max(alpha, .0001)) * alpha * displayGain) * transmission + .03 * (1 - alpha * transmission)) * 255;
  };
  assert.equal(material.toneMapped, false);
  assert.equal(material.depthWrite, false);
  assert.equal(material.transparent, true);
  for (const size of [68, 92]) {
    const reach = [], angular = [], movements = [];
    let clearMaximum = 0, cloudMaximum = 0;
    for (let index = 0; index < 360; index += 1) {
      const angle = index * Math.PI / 180;
      let length = 0;
      for (let pixels = 1; pixels <= 13; pixels += .5) {
        const radial = .247 + pixels / size;
        const point = { x: Math.cos(angle) * radial, y: Math.sin(angle) * radial };
        const values = [100, 103].map(time => {
          const value = sample(point, radial, time, solarShaderMath);
          const light = (value.halo + gain * value.rays) * value.outsideDisc;
          const base = value.halo * value.outsideDisc;
          const clear = composite(light, 1) - composite(base, 1);
          const cloud = composite(light, .015) - composite(base, .015);
          clearMaximum = Math.max(clearMaximum, clear); cloudMaximum = Math.max(cloudMaximum, cloud);
          return clear;
        });
        if (values[0] > 10) length = pixels;
        if (pixels === 4) { angular.push(values[0]); movements.push(Math.abs(values[1] - values[0])); }
      }
      reach.push(length);
    }
    reach.sort((a, b) => a - b);
    const extent = reach[Math.floor(reach.length * .9)];
    assert.ok(extent >= size * .06 && extent <= size * .13, `${size}px canvas needs visible short rays, received ${extent}px`);
    assert.ok(Math.max(...angular) - Math.min(...angular) > 18, 'unequal streamers must retain an angular silhouette instead of becoming a uniform ring');
    const sorted = [...angular].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const peak = sorted.at(-1);
    assert.ok(median < peak * .12, `rays must have dark gaps instead of merging into broad cloudy lobes: median ${median}, peak ${peak}`);
    let longest = 0, run = 0;
    for (const light of angular.concat(angular)) { run = light > peak * .5 ? run + 1 : 0; longest = Math.max(longest, Math.min(run, angular.length)); }
    const arcWidth = longest * Math.PI / 180 * (.247 * size + 4);
    assert.ok(arcWidth > .6 && arcWidth < 3, `${size}px canvas needs a narrow antialiased ray at half maximum, received ${arcWidth}px`);
    assert.ok(movements.filter(change => change > 6).length > 25, 'many visible angular positions must change smoothly across three seconds');
    assert.ok(cloudMaximum < clearMaximum * .016, 'thick clouds attenuate the complete luminous ray output, not just the photosphere');
  }
  scene.dispose();
});

test('actual limb plasma stays below six percent of the solar radius and contributes no opposite-side spokes', async () => {
  const h = await solarRecoveryHarness();
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' });
  const shader = scene.flareMesh.material.fragmentShader;
  const body = shader.match(/float limbPlasma\([^)]*\)\s*\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body, 'the shader must expose its small limb structures for bounded numerical verification');
  const plasmaAt = new Function('p', 'angle', 'width', 'height', 'phase', 'uTime', 'math', `
    const { sin, cos, pow, exp, abs, max, smoothstep, vec2, dot, length, fwidth } = math;
    ${body.replace(/\b(?:vec2|float)\s+(\w+)\s*=/g, 'let $1 =')}
  `);
  const arch = body.match(/float arch\s*=[^;]+;\s*arch\s*\+=\s*[^;]+;/)?.[0];
  assert.ok(arch, 'the actual deforming arch expression must be measured');
  const archAt = new Function('x', 'height', 'phase', 'uTime', 'sin', `${arch.replace(/\bfloat\b/, 'let')} return arch;`);
  const limbRadius = Number(body.match(/float y\s*=\s*dot\(p, normal\)\s*-\s*([\d.]+)/)?.[1]);
  assert.ok(Number.isFinite(limbRadius));
  const structures = [...shader.matchAll(/limbPlasma\(p,\s*([-\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)/g)]
    .map(match => match.slice(1).map(Number));
  assert.equal(structures.length, 3, 'the limb must retain a small, bounded number of independent structures');
  const radius = scene.sunMesh.geometry.parameters.radius;
  const distance = scene.camera.position.z;
  const photosphere = radius / Math.sqrt(distance ** 2 - radius ** 2) / (2 * Math.tan(scene.camera.fov * Math.PI / 360));
  for (const [angle, width, height, phase] of structures) {
    let maximumRadius = 0;
    for (let time = 0; time < 86400; time += 37) {
      assert.ok(limbRadius + archAt(0, height, phase, time, Math.sin) > photosphere, 'each microplasma apex must remain outside the photosphere');
      for (let i = -20; i <= 20; i += 1) {
        const x = i / 20;
        maximumRadius = Math.max(maximumRadius, Math.hypot(limbRadius + archAt(x, height, phase, time, Math.sin), x * width));
      }
    }
    assert.ok(maximumRadius <= photosphere * 1.06, 'deformation and tangent width must not grow a microstructure beyond six percent of the solar radius');
    const normal = { x: Math.cos(angle), y: Math.sin(angle) };
    for (const canvasPixels of [68, 96, 288, 1024]) {
      const math = { ...solarShaderMath, fwidth: () => 1 / canvasPixels };
      for (const time of [0, 1, 7, 60, 3600]) {
        const peakRadius = limbRadius + archAt(0, height, phase, time, Math.sin);
        const peak = plasmaAt({ x: normal.x * peakRadius, y: normal.y * peakRadius }, angle, width, height, phase, time, math);
        assert.ok(Number.isFinite(peak) && peak > .1, 'the intended limb structure must emit light at its own apex');
        for (const radial of [photosphere + .005, photosphere + .02, photosphere + .08]) {
          const opposite = plasmaAt({ x: -normal.x * radial, y: -normal.y * radial }, angle, width, height, phase, time, math);
          assert.ok(Number.isFinite(opposite) && Math.abs(opposite) < 1e-8, 'a microstructure must not create a long bright strip on the opposite side of the Sun');
        }
      }
    }
  }
  scene.dispose();
});
