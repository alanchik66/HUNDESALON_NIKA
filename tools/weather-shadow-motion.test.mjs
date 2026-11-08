import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'espree';
import postcss from 'postcss';
import { generate, lexer, parse as parseCss } from 'css-tree';
import { mountNativeSunRecovery } from '../assets/js/header-weather-sun-recovery.js';

const styles = readFile(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8').then(source => {
  const pending = [parse(source, { ecmaVersion: 'latest', sourceType: 'script' })];
  const starfieldNames = new Set(['STARFIELD_FAINT', 'STARFIELD_BRIGHT']);
  const starfieldLiterals = new Map();
  let template;
  while (pending.length) {
    const node = pending.pop();
    if (node.type === 'VariableDeclarator' && node.id?.name === 'HEADER_WEATHER_TRANSPARENT_STYLES') {
      template = node.init;
    } else if (node.type === 'VariableDeclarator' && starfieldNames.has(node.id?.name)) {
      assert.equal(node.init?.type, 'Literal', `${node.id.name} must remain a literal CSS field`);
      assert.equal(typeof node.init.value, 'string');
      starfieldLiterals.set(node.id.name, node.init.value);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) pending.push(...value.filter(item => item?.type));
      else if (value?.type) pending.push(value);
    }
  }
  assert.equal(template?.type, 'TemplateLiteral');
  assert.equal(starfieldLiterals.size, starfieldNames.size);
  // Read template quasis through the JavaScript AST; never execute source or use brace regexes.
  assert.ok(template.quasis.every(quasi => typeof quasi.value.cooked === 'string'));
  return postcss.parse(template.quasis.map((quasi, index) => {
    const expression = template.expressions[index];
    const value = expression ? starfieldLiterals.get(expression.name) ?? '0' : '';
    return quasi.value.cooked + value;
  }).join(''));
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

test('night star fields are finite, nonrepeating, disjoint populations with valid CSS and no lattice', async () => {
  const root = await styles;
  for (const area of ['preview', 'dropdown']) {
    const positions = [], alphas = new Set(), radii = new Set();
    for (const pseudo of ['before', 'after']) {
      const rules = matchingRules(root, selector => selector.endsWith(`.weather-header-${area}__stars-back.is-night-sky::${pseudo}`));
      const backgrounds = rules.flatMap(rule => rule.nodes.filter(node => node.type === 'decl' && ['background', 'background-image'].includes(node.prop)));
      assert.equal(backgrounds.length, 1, `${area}::${pseudo} must have one starfield background`);
      const declaration = backgrounds[0];
      assert.equal(lastDeclaration(rules, 'background-repeat').value, 'no-repeat', 'repeating single-point tiles create a dotted lattice');
      assert.doesNotMatch(declaration.value, /\/\s*[\d.]+px\s+[\d.]+px/u, 'a finite sky cannot contain pixel-sized repeat cells');
      // Long background lists exceed the lexer's bounded iteration guard. Split
      // only top-level AST commas; overlapping pairs also enforce that a color
      // can occur only in the final layer. Commas inside gradients stay intact.
      const groups = [[]];
      parseCss(declaration.value, { context: 'value' }).children.forEach(node => {
        if (node.type === 'Operator' && node.value === ',') groups.push([]);
        else groups.at(-1).push(node);
      });
      assert.ok(groups.every(nodes => nodes.length > 0), 'starfield layers must not be empty');
      const layers = groups.map(nodes => nodes.map(node => generate(node)).join(' '));
      assert.equal(layers.length, pseudo === 'before' ? 20 : 6, 'the faint and bright fields have separate bounded budgets');
      for (const layer of layers) {
        const center = layer.match(/circle\s+at\s+([\d.]+)%\s+([\d.]+)%/u);
        assert.ok(center, 'each star must have an explicit nonrepeating position');
        const point = center.slice(1).map(Number);
        assert.ok(point.every(value => value > 0 && value < 100));
        assert.ok(!positions.some(other => other[0] === point[0] && other[1] === point[1]), 'before/after populations cannot paint the same star twice');
        positions.push(point);
        alphas.add(layer.match(/rgba\([^)]*,\s*([\d.]+)\)/u)?.[1]);
        radii.add(layer.match(/\)\s*0\s+([\d.]+)px/u)?.[1]);
      }
      for (let index = 0; index < layers.length; index += 1) {
        const value = index ? `${layers[index - 1]}, ${layers[index]}` : layers[index];
        const result = lexer.matchProperty(declaration.prop, value);
        assert.ok(!result.error, `${area}::${pseudo} ${declaration.prop} layer ${index}: ${result.error?.message.split('\n')[0]}`);
        assert.ok(result.matched, `${area}::${pseudo} layer ${index} must match the declared CSS property grammar`);
      }
    }
    assert.ok(alphas.size >= 3 && !alphas.has(undefined), 'stars need varied magnitudes');
    assert.ok(radii.size >= 3 && !radii.has(undefined), 'all stars cannot have the same footprint');
    for (const width of [375, 547, 1440]) for (const dx of [30, 34, 38]) {
      const points = positions.map(([x, y]) => [x * width / 100, y * 186 / 100]);
      const eligible = points.filter(([x]) => x + dx < width);
      const aligned = eligible.filter(([x, y]) => points.some(([tx, ty]) => Math.abs(tx - x - dx) <= 1 && Math.abs(ty - y) <= 1));
      assert.ok(aligned.length / eligible.length < .2, `${area}: the ${dx}px repeat lattice must not return at width${width}`);
    }
  }
  const scene = await readFile(new URL('../3d-weather-codrops-main/src/scene.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(scene, /className:\s*`weather-app__stars-scene weather-app__stars-scene--header-panel`/u, 'CSS fields own header stars; a second header star canvas must not return');
});

test('dropdown foreground surfaces leave the stars visible above the opaque outer menu', async () => {
  const root = await styles;
  for (const part of ['hero', 'body', 'forecast-list', 'detail-card', 'forecast-pill']) {
    const rules = matchingRules(root, selector => selector === `.weather-header-dropdown__${part}`);
    const paint = rules.flatMap(rule => rule.nodes.filter(node => node.type === 'decl' && ['background', 'background-color'].includes(node.prop))).at(-1);
    assert.match(paint.value, /^(?:transparent|none)$/, part);
    assert.equal(lastDeclaration(rules, 'background-image').value, 'none', part);
  }
  const menu = matchingRules(root, selector => selector === '.weather-header-dropdown');
  assert.equal(lastDeclaration(menu, 'background-color').value, 'rgb(5 10 9)', 'the outer menu retains its readable opaque backdrop');
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

async function solarRecoveryHarness({ textureFailure = false, networkFailure = false, decodeFailure = false, decodeWait = Promise.resolve(), rendererFailure = false, uploadFailure = false, shaderFailure = false, contextMode = 'preferred', recoveryModule } = {}) {
  const [clock, sceneSource] = await Promise.all([
    readFile(new URL('../assets/js/weather-solar-time.js', import.meta.url), 'utf8'),
    readFile(new URL('../assets/js/header-weather-sun-scene.js', import.meta.url), 'utf8'),
  ]);
  const code = [clock, sceneSource].flatMap(source => {
    const program = parse(source, { ecmaVersion: 'latest', sourceType: 'module', range: true });
    return program.body.filter(node => node.type !== 'ImportDeclaration' &&
      !(node.type === 'VariableDeclaration' && node.declarations.some(declaration =>
        declaration.init?.type === 'AwaitExpression' || declaration.id?.name === 'SUN_RECOVERY_MODULE_URL'))).map(node => {
      const declaration = node.type === 'ExportNamedDeclaration' ? node.declaration : node;
      return source.slice(...declaration.range);
    });
  }).join('\n').replace('import(SUN_RECOVERY_MODULE_URL)', 'loadRecoveryModule()');
  const listeners = new Map();
  const windowListeners = new Map();
  const viewportListeners = new Map();
  const frames = new Map();
  let nextFrame = 0;
  let nowMs = Date.UTC(2026, 10, 4, 12);
  let monotonicMs = 0;
  const events = map => ({ addEventListener: (name, handler) => map.set(name, handler), removeEventListener: name => map.delete(name) });
  const viewport = { scale: 1, ...events(viewportListeners) };
  const window = { devicePixelRatio: 3, visualViewport: viewport, ...events(windowListeners) };
  const stats = { renders: 0, disposed: 0, texturesDisposed: 0, failRender: false, contextLost: false, forcedLoss: 0,
    events: [], sizes: [], textures: [], materialsDisposed: [], geometriesDisposed: [], colorsAtRender: [], contextRequests: [], observers: [], rendererCreations: 0, decodeWait };
  const context = { isContextLost: () => stats.contextLost, getContextAttributes: () => ({ antialias: contextMode !== 'compatible' }) };
  const canvas = { clientWidth: 96, clientHeight: 96, dataset: {}, isConnected: true, ownerDocument: {},
    getRootNode: () => ({}),
    getContext: (kind, attributes) => {
      stats.contextRequests.push({ kind, attributes: { ...attributes } });
      if (contextMode === 'none' || contextMode === 'compatible' && attributes.antialias) {
        listeners.get('webglcontextcreationerror')?.({ statusMessage: 'WebGL context creation failed.' });
        return null;
      }
      return context;
    },
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name),
  };
  const mapFragment = '#ifdef USE_MAP\n vec4 sampledDiffuseColor = texture2D( map, vMapUv );\n #ifdef DECODE_VIDEO_TEXTURE\n sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );\n #endif\n diffuseColor *= sampledDiffuseColor;\n#endif';
  class Renderer {
    constructor(options) {
      this.debug = {};
      stats.rendererCreations++;
      stats.rendererOptions = options;
      if (rendererFailure) {
        listeners.get('webglcontextcreationerror')?.({ statusMessage: 'WebGL context creation failed.' });
        throw new Error('Error creating WebGL context.');
      }
    }
    setPixelRatio(value) { this.pixelRatio = value; stats.pixelRatio = value; }
    getPixelRatio() { return this.pixelRatio; }
    setClearColor(color, alpha) { stats.clear = { color, alpha }; }
    setSize(width, height, updateStyle) {
      canvas.width = Math.floor(width * this.pixelRatio);
      canvas.height = Math.floor(height * this.pixelRatio);
      stats.sizes.push({ width, height, updateStyle });
    }
    initTexture() {
      stats.events.push('upload');
      if (uploadFailure) throw new Error('Texture upload failed');
    }
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
      if (shaderFailure) this.debug.onShaderError?.();
    }
    getContext() { return context; }
    render() {
      if (stats.failRender || stats.failRenderAt === stats.renders + 1) throw new Error('GPU unavailable');
      const color = stats.shader?.uniforms.uSolarSurfaceColor?.value;
      if (color) stats.colorsAtRender.push({ r: color.r, g: color.g, b: color.b });
      stats.events.push('render'); stats.renders += 1;
    }
    dispose() { stats.disposed += 1; }
    forceContextLoss() { stats.forcedLoss++; stats.contextLost = true; }
  }
  const THREE = {
    MathUtils: { degToRad: degrees => degrees * Math.PI / 180 },
    Clock: class { getElapsedTime() { return 0; } },
    ShaderChunk: { map_fragment: mapFragment },
    Scene: class { children = []; background = null; add(child) { this.children.push(child); } },
    PerspectiveCamera: class {
      constructor(fov) { this.fov = fov; }
      position = { set(x, y, z) { Object.assign(this, { x, y, z }); } };
      setViewOffset(fullWidth, fullHeight, offsetX, offsetY, width, height) {
        this.view = { fullWidth, fullHeight, offsetX, offsetY, width, height };
      }
      lookAt() {} updateProjectionMatrix() {}
    },
    WebGLRenderer: Renderer,
    TextureLoader: class { load(url, success, progress, failure) {
      if (textureFailure) throw new Error('Texture request failed');
      if (networkFailure) { failure(); return; }
      const texture = { image: { decode() { stats.events.push('decode'); return decodeFailure ? Promise.reject(new Error('Decode failed')) : stats.decodeWait; } }, dispose() { stats.texturesDisposed += 1; } };
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
  class Observer {
    constructor(callback) { this.callback = callback; this.targets = []; stats.observers.push(this); }
    observe(target) { this.active = true; this.targets.push(target); }
    disconnect() { this.active = false; }
  }
  const api = new Function('THREE', 'window', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date', 'MutationObserver', 'loadRecoveryModule', 'performance', `${code}; return { mount: mountHeaderWeatherSunScene, unmount: unmountHeaderWeatherSunScene, rate: solarRotationRateDegPerDay, offset: solarTextureOffsetTurns, angle: solarRotationAngle, pixelRatio: resolveSolarPixelRatio, epoch: SOLAR_MODEL_EPOCH_MS, elevation: solarElevationDegrees, position: solarPosition, color: solarColorForElevation, surfaceColor: solarSurfaceColorForElevation, prominence: solarProminenceState };`)(
    THREE, window, callback => { frames.set(++nextFrame, callback); return nextFrame; }, id => frames.delete(id), ClockDate, Observer, async () => recoveryModule, { now: () => monotonicMs }
  );
  return { ...api, canvas, context, listeners, windowListeners, viewportListeners, window, viewport, frames, stats, setNow: value => { nowMs = value; }, advanceMonotonic: value => { monotonicMs += value; } };
}

test('ray overscan preserves the logical photosphere and profile while expanding the transparent viewport', async () => {
  const h = await solarRecoveryHarness();
  h.canvas.clientWidth = h.canvas.clientHeight = 153;
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' });
  const geometry = scene.sunMesh.geometry, map = scene.sunMesh.material.map, fov = scene.camera.fov;
  for (const [logical, scale] of [[68, 1.3], [92, .8]]) {
    h.canvas.clientWidth = h.canvas.clientHeight = logical * 2.25;
    scene.resize();
    assert.deepEqual(scene.camera.view, { fullWidth: logical, fullHeight: logical,
      offsetX: -logical * .625, offsetY: -logical * .625, width: logical * 2.25, height: logical * 2.25 });
    assert.equal(scene.flareMesh.material.uniforms.uRayLengthScale.value, scale,
      'responsive ray length must use the original layout width, not the padded canvas');
    assert.equal(scene.camera.fov, fov);
    assert.equal(scene.sunMesh.geometry, geometry);
    assert.equal(scene.sunMesh.material.map, map);
  }
  scene.dispose();
});

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

test('a live Sun hands context loss and runtime render failure to native animation instead of the plain recovery photo', async t => {
  for (const failure of ['context-loss', 'render-error']) await t.test(failure, async () => {
    let mounts = 0;
    const recovery = { recovery: true, state: 'recovery', renderMode: 'animation', running: true,
      disposed: false, setGeoState() {}, dispose() { this.disposed = true; } };
    const h = await solarRecoveryHarness({ recoveryModule: { mountNativeSunRecovery: async settings => {
      mounts++; settings.options.onStateChange?.('recovery'); return recovery;
    } } });
    const overlay = { __sunSceneMountToken: 'current', dataset: {}, querySelector: name => name === 'video' ? {} : null };
    h.canvas.parentElement = overlay;
    const live = overlay.__sunScene = await h.mount(h.canvas, {
      onStateChange: state => { overlay.dataset.sunScene = state; },
    });
    assert.equal(live.state, 'ready');
    if (failure === 'context-loss') h.listeners.get('webglcontextlost')({ preventDefault() {} });
    else {
      h.stats.failRender = true;
      const [id, callback] = [...h.frames][0]; h.frames.delete(id); callback();
    }
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(mounts, 1, 'runtime failure must enter the existing native recovery, without a shell retry');
    assert.equal(overlay.__sunScene, recovery);
    assert.equal(overlay.dataset.sunScene, 'recovery');
    assert.equal(live.disposed, true); assert.equal(h.frames.size, 0);
    recovery.dispose();
  });
});

test('a failed first animation frame or a material compile callback enters native recovery before returning a live scene', async t => {
  for (const failure of ['first-tick', 'shader-compile']) await t.test(failure, async () => {
    let mounts = 0;
    const recovery = { recovery: true, state: 'recovery', renderMode: 'animation', dispose() {} };
    const h = await solarRecoveryHarness({ shaderFailure: failure === 'shader-compile',
      recoveryModule: { mountNativeSunRecovery: async () => { mounts++; return recovery; } } });
    h.canvas.parentElement = { __sunSceneMountToken: 'current', querySelector: name => name === 'video' ? {} : null };
    if (failure === 'first-tick') h.stats.failRenderAt = 2;
    assert.equal(await h.mount(h.canvas, {}), recovery);
    assert.equal(mounts, 1); assert.equal(h.frames.size, 0); assert.equal(h.stats.disposed, 1);
    if (failure === 'shader-compile') assert.equal(h.canvas.dataset.sunInitStage, 'shader-compile');
  });
});

test('a cancelled runtime recovery cannot replace a newer mounted Sun or retain its old GPU resources', async () => {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const recovery = { recovery: true, disposed: false, setGeoState() {}, dispose() { this.disposed = true; } };
  const h = await solarRecoveryHarness({ recoveryModule: { mountNativeSunRecovery: async () => pending } });
  const overlay = { __sunSceneMountToken: 'old', dataset: {}, querySelector: name => name === 'video' ? {} : null };
  h.canvas.parentElement = overlay;
  const live = overlay.__sunScene = await h.mount(h.canvas, {});
  live.onContextLost({ preventDefault() {} });
  await Promise.resolve();
  const next = { state: 'ready' }, owner = Symbol('new Sun');
  overlay.__sunSceneMountToken = 'new'; overlay.__sunScene = next; h.canvas.__sunInitializationOwner = owner;
  finish(recovery); await new Promise(resolve => setImmediate(resolve));
  assert.equal(overlay.__sunScene, next); assert.equal(h.canvas.__sunInitializationOwner, owner);
  assert.equal(recovery.disposed, true); assert.equal(live.disposed, true); assert.equal(h.frames.size, 0);
});

test('live Sun page lifecycle restarts one frame loop, respects an explicit stop and detects a lost context on return', async () => {
  const h = await solarRecoveryHarness();
  const scene = await h.mount(h.canvas, {});
  h.windowListeners.get('pagehide')(); assert.equal(h.frames.size, 0);
  h.windowListeners.get('pageshow')(); assert.equal(h.frames.size, 1);
  h.windowListeners.get('pageshow')(); assert.equal(h.frames.size, 1, 'a second resume cannot create a second RAF loop');
  h.windowListeners.get('pagehide')(); scene.stop(); h.windowListeners.get('pageshow')();
  assert.equal(h.frames.size, 0, 'an explicit stop cancels a pending lifecycle resume');
  scene.start(); h.windowListeners.get('pagehide')(); h.stats.contextLost = true;
  h.windowListeners.get('pageshow')();
  assert.equal(scene.state, 'lost'); assert.equal(h.frames.size, 0, 'a lost GPU cannot be presented as ready after return');
  scene.dispose(); assert.equal(h.windowListeners.size, 0);
});

test('the original Sun handle disposes its own native descendant and cannot dispose a foreign replacement mount', async t => {
  for (const unmount of [false, true]) await t.test(unmount ? 'exported unmount' : 'original dispose', async () => {
    const recovery = { recovery: true, disposed: false, setGeoState() {}, dispose() { this.disposed = true; } };
    const h = await solarRecoveryHarness({ recoveryModule: { mountNativeSunRecovery: async () => recovery } });
    const overlay = { __sunSceneMountToken: 'old', querySelector: name => name === 'video' ? {} : null };
    h.canvas.parentElement = overlay;
    const original = overlay.__sunScene = await h.mount(h.canvas, {});
    original.onContextLost({ preventDefault() {} }); await new Promise(resolve => setImmediate(resolve));
    assert.equal(overlay.__sunScene, recovery);
    overlay.__sunSceneMountToken = 'foreign';
    const next = overlay.__sunScene = await h.mount(h.canvas, {});
    const owner = h.canvas.__sunInitializationOwner;
    if (unmount) h.unmount(original); else original.dispose();
    assert.equal(recovery.disposed, true, 'the original lifetime releases its own descendant');
    assert.equal(next.disposed, false); assert.equal(overlay.__sunScene, next);
    assert.equal(h.canvas.__sunInitializationOwner, owner); assert.equal(h.frames.size, 1);
    next.dispose(); assert.equal(h.frames.size, 0);
  });
});

test('the original native handle disposes an accepted GPU descendant and cancels a pending runtime handoff', async () => {
  let restore;
  const recovery = { recovery: true, disposed: false, setGeoState() {}, dispose() { this.disposed = true; } };
  const h = await solarRecoveryHarness({ contextMode: 'none', recoveryModule: { mountNativeSunRecovery: async settings => { restore = settings.restore; return recovery; } } });
  const overlay = { __sunSceneMountToken: 'current', dataset: {}, querySelector: name => name === 'video' ? {} : null };
  h.canvas.parentElement = overlay;
  const original = overlay.__sunScene = await h.mount(h.canvas, {});
  h.canvas.getContext = () => h.context; await restore();
  const gpu = overlay.__sunScene; assert.equal(gpu.state, 'ready'); assert.equal(h.frames.size, 1);
  original.dispose(); assert.equal(gpu.disposed, true); assert.equal(h.frames.size, 0);

  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const late = { recovery: true, disposed: false, dispose() { this.disposed = true; } };
  const p = await solarRecoveryHarness({ recoveryModule: { mountNativeSunRecovery: async () => pending } });
  const parent = { __sunSceneMountToken: 'pending', querySelector: name => name === 'video' ? {} : null };
  p.canvas.parentElement = parent;
  const live = parent.__sunScene = await p.mount(p.canvas, {});
  live.onContextLost({ preventDefault() {} }); await Promise.resolve(); live.dispose();
  finish(late); await new Promise(resolve => setImmediate(resolve));
  assert.equal(late.disposed, true); assert.equal(parent.__sunScene, live);
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

test('repeated failed Sun initialization retains one recovery listener pair and releases it on stop', async () => {
  const source = await readFile(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8');
  const mountSource = source.match(/  async function mountHeaderWeatherSunScene\(overlay, assetConfig\) \{[\s\S]*?\n  \}/)[0];
  const stopSource = source.match(/  function stopHeaderWeatherSunScene\(overlay\) \{[\s\S]*?\n  \}/)[0];
  const trackedTarget = () => {
    const target = new globalThis.EventTarget(), handlers = new Set();
    return {
      handlers,
      addEventListener(type, handler) { handlers.add(handler); target.addEventListener(type, handler); },
      removeEventListener(type, handler) { handlers.delete(handler); target.removeEventListener(type, handler); },
      dispatchEvent: event => target.dispatchEvent(event),
    };
  };
  const window = trackedTarget(), document = { ...trackedTarget(), hidden: false };
  const canvas = { dataset: {} }, image = { decode: async () => {} };
  const overlay = { isConnected: true, dataset: {}, querySelector: tag => ({ canvas, img: image, video: {} })[tag] };
  let retries = 0;
  const { mount, stop } = new Function('window', 'document', 'stopHeaderWeatherOrbRender', 'loadHeaderWeatherSunSceneModule', 'setHeaderWeatherOrbSource', 'console',
    `${stopSource}\n${mountSource}\nreturn { mount: mountHeaderWeatherSunScene, stop: stopHeaderWeatherSunScene };`)(
    window, document, () => {}, async () => { throw new Error('Error creating WebGL context.'); }, () => { retries++; }, { error() {} }
  );
  for (let attempt = 0; attempt < 3; attempt++) {
    await mount(overlay, { assetsModuleBase: '/assets', sunTextureUrl: '/solar.jpg' });
    assert.equal(overlay.dataset.sunScene, 'failed');
    assert.equal(window.handlers.size, 1, 'retries must replace the preceding online listener');
    assert.equal(document.handlers.size, 1, 'retries must replace the preceding visibility listener');
  }
  window.dispatchEvent(new Event('online'));
  assert.equal(retries, 1, 'one online event schedules one recovery');
  stop(overlay);
  assert.equal(window.handlers.size, 0);
  assert.equal(document.handlers.size, 0);
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

test('solar failures preserve the initialization stage and native context refusal after cleanup', async () => {
  for (const [options, phase, message] of [
    [{ rendererFailure: true }, 'renderer-create', /creating WebGL context/],
    [{ networkFailure: true }, 'texture-load', /texture could not load/],
    [{ decodeFailure: true }, 'texture-decode', /Decode failed/],
    [{ uploadFailure: true }, 'texture-upload', /Texture upload failed/],
  ]) {
    const h = await solarRecoveryHarness(options);
    await assert.rejects(h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' }), message);
    assert.equal(h.canvas.dataset.sunInitStage, phase);
    assert.equal(h.canvas.__sunContextCreationError, options.rendererFailure ? 'WebGL context creation failed.' : undefined);
    assert.equal(h.listeners.size, 0, 'temporary creation and lifecycle listeners must be removed');
    assert.equal(h.windowListeners.size, 0);
    assert.equal(h.frames.size, 0);
    assert.equal(h.stats.disposed, options.rendererFailure ? 0 : 1);
    assert.equal(h.stats.renders, 0);
  }
});

test('successful solar initialization clears a previous context refusal and exposes its completed stage', async () => {
  const h = await solarRecoveryHarness();
  h.canvas.__sunContextCreationError = 'Old context refusal';
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' });
  assert.equal(h.canvas.dataset.sunInitStage, 'running');
  assert.equal(h.canvas.__sunContextCreationError, undefined);
  assert.equal(h.listeners.has('webglcontextcreationerror'), false);
  assert.ok(h.stats.renders > 0);
  scene.dispose();
});

test('a superseded solar decode cannot overwrite the stage of a failed newer attempt or render late', async () => {
  let finishDecode;
  const decodeWait = new Promise(resolve => { finishDecode = resolve; });
  const h = await solarRecoveryHarness({ decodeWait });
  const pending = h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' });
  assert.equal(h.canvas.dataset.sunInitStage, 'texture-decode');
  await assert.rejects(h.mount(h.canvas, {
    sunTextureUrl: '/solar.jpg',
    onAppearanceChange() { throw new Error('New construction failed'); },
  }), /New construction failed/);
  assert.equal(h.canvas.dataset.sunInitStage, 'constructor');
  finishDecode();
  const obsolete = await pending;
  assert.equal(obsolete.disposed, true);
  assert.equal(h.canvas.dataset.sunInitStage, 'constructor', 'late old work must leave the current failure stage intact');
  assert.equal(h.stats.renders, 0);
  assert.equal(h.stats.disposed, 1);
  assert.equal(h.stats.texturesDisposed, 1);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.frames.size, 0);
});

test('solar context selection preserves the preferred path and retries unsupported MSAA once with supersampling', async () => {
  for (const compatible of [false, true]) {
    const h = await solarRecoveryHarness({ contextMode: compatible ? 'compatible' : 'preferred' });
    const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' });
    assert.equal(h.stats.contextRequests.length, compatible ? 2 : 1);
    assert.deepEqual(h.stats.contextRequests.map(request => request.attributes.antialias), compatible ? [true, false] : [true]);
    assert.deepEqual(h.stats.contextRequests.map(request => request.attributes.powerPreference), compatible ? ['high-performance', 'default'] : ['high-performance']);
    for (const request of h.stats.contextRequests) {
      assert.equal(request.kind, 'webgl2');
      assert.equal(request.attributes.alpha, true);
      assert.equal(request.attributes.premultipliedAlpha, true);
      assert.equal(request.attributes.depth, true);
    }
    assert.equal(h.stats.rendererCreations, 1, 'the acquired context must be passed to one renderer');
    assert.equal(h.stats.rendererOptions.context, h.context);
    assert.equal(h.canvas.dataset.sunContextProfile, compatible ? 'compatible' : 'preferred');
    assert.equal(h.canvas.__sunContextCreationError, undefined, 'a successful retry does not report an active creation error');
    assert.equal(h.stats.pixelRatio, compatible ? 6 : 3);
    assert.equal(h.canvas.width, compatible ? 576 : 288);
    assert.equal(scene.sunMesh.material.map, h.stats.textures[0]);
    scene.dispose();
  }
});

test('complete WebGL denial performs two bounded probes without allocating a Three renderer', async () => {
  const h = await solarRecoveryHarness({ contextMode: 'none' });
  await assert.rejects(h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' }), /Error creating WebGL context/);
  assert.equal(h.stats.contextRequests.length, 2);
  assert.equal(h.stats.rendererCreations, 0);
  assert.equal(h.canvas.dataset.sunContextProfile, 'unavailable');
  assert.equal(h.canvas.dataset.sunInitStage, 'renderer-create');
  assert.equal(h.canvas.__sunContextCreationError, 'WebGL context creation failed.');
  assert.equal(h.stats.textures.length, 0);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.windowListeners.size, 0);
});

test('a reused non-MSAA context retains compatibility supersampling even if the preferred request returns it', async () => {
  const h = await solarRecoveryHarness({ contextMode: 'compatible' });
  h.canvas.getContext = (kind, attributes) => {
    h.stats.contextRequests.push({ kind, attributes: { ...attributes } });
    return h.context;
  };
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' });
  assert.equal(h.stats.contextRequests.length, 1);
  assert.equal(h.canvas.dataset.sunContextProfile, 'compatible');
  assert.equal(h.stats.pixelRatio, 6);
  scene.dispose();
});

test('detached pending initialization releases its owned context and every observer before decode finishes', async () => {
  let finishDecode;
  const h = await solarRecoveryHarness({ decodeWait: new Promise(resolve => { finishDecode = resolve; }) });
  const pending = h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' });
  const observer = h.stats.observers.find(item => item.active);
  assert.ok(observer);
  assert.equal(observer.targets.length, 2, 'watch shadow removal and removal of the complete host');
  h.canvas.isConnected = false;
  observer.callback();
  assert.equal(h.stats.disposed, 1);
  assert.equal(h.stats.forcedLoss, 1);
  assert.equal(observer.active, false);
  assert.equal(h.listeners.size, 0);
  assert.equal(h.windowListeners.size, 0);
  finishDecode();
  const scene = await pending;
  assert.equal(scene.disposed, true);
  assert.equal(h.stats.renders, 0);
  assert.equal(h.stats.forcedLoss, 1, 'repeated disposal is idempotent');
});

test('disposing an obsolete detached scene cannot lose the newer owner context', async () => {
  const h = await solarRecoveryHarness();
  const old = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' });
  const current = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' });
  h.canvas.isConnected = false;
  old.dispose();
  assert.equal(h.stats.forcedLoss, 0);
  current.dispose();
  assert.equal(h.stats.forcedLoss, 1);
  assert.equal(h.frames.size, 0);
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
  assert.equal(uniforms.uOpticalCenter.value.x, .5 + (center.x - .5) * 2.25);
  assert.equal(uniforms.uOpticalCenter.value.y, .5 + (center.y - .5) * 2.25);
  assert.equal(uniforms.uTime.value, 12.345);
  const initialSamples = samples;
  const axis = uniforms.uOpticalCenter.value;
  center = { x: .83, y: .27 };
  const allocations = h.stats.sizes.length;
  scene.renderFrame();
  assert.ok(samples > initialSamples, 'moving the Sun must resample its optical axis without a resize event');
  assert.equal(h.stats.sizes.length, allocations, 'tracking a moving source cannot resize or reallocate the renderer');
  assert.equal(uniforms.uOpticalCenter.value, axis, 'movement updates the existing GPU uniform without recreating a material');
  assert.equal(axis.x, .5 + (center.x - .5) * 2.25);
  assert.equal(axis.y, .5 + (center.y - .5) * 2.25);
  center = { x: 1.2, y: .27, space: 'logical' };
  scene.renderFrame();
  assert.equal(axis.x, center.x, 'a shared logical sky axis must not receive overscan twice or be clamped');
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

test('camera ghosts share a finite source-centre axis, bounded separation and smooth on-axis extinction', async () => {
  const h = await solarRecoveryHarness();
  let center = { x: .2, y: .2 };
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg', getOpticalCenter: () => center });
  const material = scene.flareMesh.material, time = h.epoch + 100000;
  const radius = scene.sunMesh.geometry.parameters.radius;
  for (const x of [.2, .8]) for (const y of [.2, .8]) {
    center = { x, y };
    const states = scene.getOpticalState(time);
    const axis = { x: (x - .5) * 2.25, y: (y - .5) * 2.25 };
    assert.equal(states.length, 7);
    assert.equal(states.filter(state => state.kind === 'diamond').length, 3);
    for (const [index, state] of states.entries()) {
      const dx = (state.x - 50) / 100, dy = (50 - state.y) / 100;
      assert.ok([dx, dy, state.size, state.opacity].every(Number.isFinite));
      assert.ok(Math.abs(dx * axis.y - dy * axis.x) < 1e-12, 'each ghost stays on the current camera optical axis');
      assert.equal(Math.sign(dx * axis.x + dy * axis.y), [2, 5, 6].includes(index) ? -1 : 1);
      assert.ok(state.opacity > 0 && state.opacity <= .7);
      assert.ok(Math.hypot(dx, dy) + state.size / 200 < 1.125, 'bounded ghosts remain inside transparent overscan');
      assert.match(state.color, /^\d+\.\d{3} \d+\.\d{3} \d+\.\d{3}$/u);
    }
  }
  center = { x: .6, y: .5 };
  const near = scene.getOpticalState(time).map(state => ({ ...state }));
  center = { x: 1.4, y: .5 };
  const far = scene.getOpticalState(time);
  assert.ok(far[0].x > near[0].x, 'separation responds to source distance as well as angle');
  assert.ok(Math.abs((far[0].x - 50) / 100 - .415 * 2 * 1.14) < 1e-12,
    'the primary diamond moves twice its former centre-to-centre distance at the same lens spread');
  center = { x: .5, y: .5 };
  for (const state of scene.getOpticalState(time)) {
    assert.equal(state.opacity, 0); assert.equal(state.x, 50); assert.equal(state.y, 50);
  }
  const opacity = [];
  for (let step = 0; step <= 100; step++) {
    center = { x: .5 + step * .001, y: .5 };
    opacity.push(scene.getOpticalState(time)[0].opacity);
  }
  assert.ok(opacity.every((value, index) => !index || value >= opacity[index - 1]));
  assert.ok(opacity.slice(1).every((value, index) => Math.abs(value - opacity[index]) < .02));
  assert.equal(material.uniforms.uOpticsEnabled.value, 1);
  assert.equal(scene.sunMesh.geometry.parameters.radius, radius);
  scene.dispose();
});

test('a hidden recovery canvas derives the same optical axis from its logical overlay', async () => {
  const h = await solarRecoveryHarness();
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg', getOpticalCenter: () => null });
  h.canvas.parentElement = {
    getBoundingClientRect: () => ({ left: 200, top: 50, width: 68, height: 68 }),
    closest: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 180 }) }),
  };
  const center = scene.updateOpticalGeometry();
  assert.equal(center.x, 0);
  assert.ok(Math.abs(center.y - (1 - 40 / 68)) < 1e-12);
  scene.dispose();
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
  const boundary = name => {
    const expression = material.fragmentShader.match(new RegExp(`float\\s+${name}\\s*=\\s*([^;]+);`))?.[1];
    assert.ok(expression, `the actual shader must bound ${name} separately`);
    return new Function('smoothstep', 'radial', `return (${expression});`).bind(null, smoothstep);
  };
  const haloBounds = boundary('haloBounds'), opticalBounds = boundary('opticalBounds'), rayBounds = boundary('rayBounds');
  assert.equal(haloBounds(.5), 0, 'the original halo retains its previous boundary');
  assert.ok(haloBounds(.48) > haloBounds(.49));
  assert.equal(opticalBounds(.5), 1, 'larger camera reflections extend beyond the old optical crop');
  assert.equal(opticalBounds(1.125), 0, 'camera reflections fade before the expanded canvas edge');
  assert.equal(rayBounds(.5), 1, 'longer rays must not be cut by the former canvas edge');
  assert.equal(rayBounds(.75), 0, 'longer rays must fade before reaching the expanded canvas edge');
  assert.ok(rayBounds(.71) > rayBounds(.74));
  assert.match(material.fragmentShader, /lensAxis\s*=\s*uOpticalCenter\s*-\s*vec2\(0\.5\)/);
  assert.match(material.fragmentShader, /direction\s*=\s*lensAxis\s*\/\s*max\(axisLength,\s*0\.0001\)/, 'a centered optical axis cannot divide by zero');
  scene.dispose();
});

test('the shell prefers the shared sky axis even for a hidden native canvas and retains its legacy geometry fallback', async () => {
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
  const sharedSky = { x: -.2, y: .8, space: 'logical' };
  overlay.__getWeatherSkyOpticalCenter = () => sharedSky;
  assert.equal(getCenter(), sharedSky, 'the main widget and dropdown share their sky camera even when the native renderer hides its canvas');
  delete overlay.__getWeatherSkyOpticalCenter;
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
    const srgb = value => value <= .0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - .055;
    assert.ok(surface.r === 1 && srgb(surface.g) > .975 && srgb(surface.g) < .995 && srgb(surface.b) > .895 && srgb(surface.b) < .925, 'known daylight stays pale cream with a perceptible, restrained blue reduction');
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

test('the two Düsseldorf reference times retain a luminous disc and one shared emitted-light palette', async () => {
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
    const halo = surface;
    const surfaceLuminance = surface.r * .2126 + surface.g * .7152 + surface.b * .0722;
    assert.ok(surfaceLuminance > .9 && srgb(surface.g) > .97 && srgb(surface.b) > .85, 'at both reference elevations the calibrated body must remain luminous and pale');
    assert.equal(scene.solarColorUniform, scene.solarSurfaceColorUniform, 'all emitted solar light must use the current disc colour');
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
  h.advanceMonotonic(1200);
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
  assert.equal(uniform, atmosphereUniform, 'the emitted atmosphere and photosphere now share one stable current colour');
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
    assert.deepEqual({ ...scene.solarColorUniform.value }, preview.surfaceColor(preview.elevation(correctedTime, 0, 90)));
    assert.deepEqual({ ...scene.solarSurfaceColorUniform.value }, preview.surfaceColor(preview.elevation(correctedTime, 0, 90)));
  }
  correctedTime = rawTime;
  scenes.forEach(scene => scene.renderFrame());
  preview.advanceMonotonic(1200); dropdown.advanceMonotonic(1200);
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
    assert.deepEqual({ ...remounted.solarColorUniform.value }, preview.surfaceColor(preview.elevation(rawTime, 0, 90)));
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
  assert.equal(shader.uniforms.uSolarSurfaceColor, scene.flareMesh.material.uniforms.uSolarColor);
  assert.equal(scene.sunMesh.material.map, h.stats.textures[0]);
  assert.equal(scene.sunMesh.material.customProgramCacheKey(), 'header-solar-atmosphere-v8');
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
  assert.ok(floor >= .4 && floor <= .6, 'the darkest original spots must be lifted without flattening almost the whole brightness range to white');
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
  assert.equal(appearances[0].glowRgb, '255 252 233', 'the high Sun and emitted light must share the cream photosphere palette');
  for (let i = 0; i < 120; i += 1) scene.updateAnimation(now + i * 16);
  assert.equal(appearances.length, 1, 'a stable high Sun must not trigger style mutations on every animation frame');
  scene.setGeoState({ longitude: 90 });
  h.advanceMonotonic(1200); scene.renderFrame();
  assert.ok(appearances.length >= 2, 'the completed transition must publish its warm recovery colour');
  const transitionCount = appearances.length;
  assert.match(appearances.at(-1).recoveryFilter, /grayscale\(1\).*brightness\([\d.]+\).*sepia\([\d.]+\)/);
  scene.setGeoState({ longitude: 90 });
  scene.renderFrame();
  assert.equal(appearances.length, transitionCount);
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
  assert.deepEqual(appearances.at(-1).glowRgb.split(' ').map(Number), expectedGlow, 'GPU light and CSS recovery glow must derive from the same linear RGB uniform');
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
    h.advanceMonotonic(1200); scene.renderFrame();
    assert.ok(scene.appearanceKey > priorKey, 'appearance quantization must cover the complete palette below zero degrees');
    assert.ok(appearances.length >= index + 2, 'each completed sub-horizon transition must publish its updated recovery colour');
    const glow = appearances.at(-1).glowRgb;
    assert.notEqual(glow, priorGlow, 'CSS glow must keep reddening with the GPU color rather than freeze at the horizon');
    priorKey = scene.appearanceKey;
    priorGlow = glow;
  }
  h.setNow(timeAtElevation(-.9));
  scene.renderFrame();
  h.advanceMonotonic(1200); scene.renderFrame();
  const stoppedKey = scene.appearanceKey;
  const stoppedCount = appearances.length;
  const stoppedGlow = appearances.at(-1).glowRgb;
  const stoppedFilter = appearances.at(-1).recoveryFilter;
  const endpointBrightness = [...stoppedFilter.matchAll(/brightness\(([\d.]+)\)/g)].map(match => Number(match[1]));
  assert.deepEqual(endpointBrightness, [.45, 1.2], 'the lifted native detail must preserve the established warm horizon endpoint');
  for (const elevation of [-1.2, -2, -6]) {
    h.setNow(timeAtElevation(elevation));
    scene.renderFrame();
    h.advanceMonotonic(1200); scene.renderFrame();
    assert.equal(scene.appearanceKey, stoppedKey);
    assert.equal(appearances.length, stoppedCount, 'below the final -0.833 degree stop a constant color must not trigger repeated style mutations');
    assert.equal(appearances.at(-1).glowRgb, stoppedGlow);
    assert.equal(appearances.at(-1).recoveryFilter, stoppedFilter);
  }
  scene.dispose();
});

const solarShaderMath = {
  sin: Math.sin, cos: Math.cos, atan: Math.atan2,
  // GLSL ES pow has an undefined result for a negative base, even for y=2.
  pow: (base, exponent) => base < 0 || base === 0 && exponent <= 0 ? NaN : Math.pow(base, exponent),
  exp: Math.exp,
  sqrt: Math.sqrt,
  mod: (value, divisor) => value - divisor * Math.floor(value / divisor),
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
  const expression = body.match(new RegExp(`\\b(?:float|vec2)\\s+${name}\\s*=\\s*([^;]+);`))?.[1];
  assert.ok(expression, `the actual solar shader must declare ${name}`);
  return `const ${name} = ${expression};`;
}

function solarGaussianSource(shader) {
  const match = shader.match(/float solarGaussian\(float (\w+)\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(match, 'the actual shader must expose its signed-distance Gaussian');
  return `function solarGaussian(${match[1]}) { ${match[2]} }`;
}

test('actual solar Gaussian callers stay finite for signed distances under the strict GLSL pow domain', async () => {
  const h = await solarRecoveryHarness();
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' });
  const shader = scene.flareMesh.material.fragmentShader;
  const lift = name => {
    const body = shader.match(new RegExp(`float ${name}\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1];
    assert.ok(body, `the actual ${name} shader body must be present`);
    return body.replace(/\b(?:vec2|float)\s+(\w+)\s*=/g, 'let $1 =');
  };
  const main = shader.match(/void main\(\)\s*\{([\s\S]*)\}/)?.[1];
  const ring = solarShaderFloat(main, 'opticalRing');
  const dimensions = ring.match(/length\(p\s*-\s*direction\s*\*\s*\(([\d.]+)\s*\*\s*lensSpread\)\)\s*-\s*([\d.]+)\)\s*\/\s*([\d.]+)/);
  assert.ok(dimensions, 'the actual optical ring must retain its axis, radius and width');
  const invalidPow = [];
  const math = { ...solarShaderMath, floor: Math.floor, fwidth: () => 1 / (68 * 3),
    pow(base, exponent) {
      const value = solarShaderMath.pow(base, exponent);
      if (!Number.isFinite(value)) invalidPow.push({ base, exponent });
      return value;
    },
  };
  assert.ok(Number.isNaN(math.pow(-1, 2)), 'Math.pow(-1,2)=1 must not mask GLSL undefined arithmetic');
  invalidPow.length = 0;
  const api = new Function('math', `
    const { sin, cos, atan, floor, pow, exp, abs, max, smoothstep, vec2, dot, length, fwidth } = math;
    ${solarGaussianSource(shader)}
    function ghost(p, sides, radius) { ${lift('apertureGhost')} }
    function plasma(p, angle, width, height, phase, uTime) { ${lift('limbPlasma')} }
    function ring(p, direction, lensSpread = 1) {
      ${ring.replace(/p\s*-\s*direction\s*\*\s*\(([\d.]+)\s*\*\s*lensSpread\)/g, 'vec2(p.x - direction.x * $1 * lensSpread, p.y - direction.y * $1 * lensSpread)')}
      return opticalRing;
    }
    return { gaussian: solarGaussian, ghost, plasma, ring };
  `)(math);
  let previous = Infinity;
  for (const distance of [0, 1e-6, .1, .5, 1, 5, 50, 1000]) {
    const positive = api.gaussian(distance), negative = api.gaussian(-distance);
    assert.ok(Number.isFinite(positive) && Number.isFinite(negative));
    assert.equal(positive, negative, 'the same signed distance on either side must have identical Gaussian intensity');
    assert.ok(positive >= 0 && positive <= 1 && positive <= previous);
    previous = positive;
  }
  assert.equal(api.gaussian(0), 1);
  for (const sides of [4, 6]) for (const x of [-.04, -.01, 0, .01, .04]) for (const y of [-.04, 0, .04]) {
    const point = { x, y };
    const value = api.ghost(point, sides, .034);
    assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
    assert.ok(Math.abs(value - api.ghost({ x: -x, y: -y }, sides, .034)) < 1e-10);
  }
  assert.ok(api.ghost({ x: 0, y: 0 }, 4, .034) > 0, 'negative ghost-rim distance must leave a visible aperture centre');
  const structures = scene.getProminenceStates(h.epoch + 100000);
  assert.equal(structures.length, 3);
  for (const entry of structures) {
    const { angle, width, height } = entry;
    for (const time of [0, 100, 86399]) {
      const value = api.plasma({ x: -Math.cos(angle) * .3, y: -Math.sin(angle) * .3 }, angle, width, height, 0, time);
      assert.ok(Number.isFinite(value) && Math.abs(value) < 1e-8, 'negative opposite-side distance must stay dark rather than poison the light sum');
    }
  }
  const [offset, radius, width] = dimensions.slice(1).map(Number);
  const direction = { x: .6, y: .8 }, center = { x: .6 * offset, y: .8 * offset };
  assert.ok(Number.isFinite(api.ring(center, direction)), 'the negative ring-centre distance must stay finite');
  assert.ok(Math.abs(api.ring({ x: center.x + radius - width / 2, y: center.y }, direction) -
    api.ring({ x: center.x + radius + width / 2, y: center.y }, direction)) < 1e-10);
  assert.deepEqual(invalidPow, [], 'actual ghost, plasma and ring callers must never rely on undefined GLSL pow inputs');
  scene.dispose();
});

function solarRaySampler(material, scene) {
  const body = material.fragmentShader.match(/void main\(\)\s*\{([\s\S]*)\}/)?.[1];
  assert.ok(body);
  const rayBlock = body.match(/\bfloat outsideDisc\s*=[\s\S]*?(?=\bfloat plasma\s*=)/)?.[0];
  assert.ok(rayBlock, 'the actual ray field must precede the separate limb plasma composition');
  const fields = [...rayBlock.matchAll(/\b(?:float|vec2)\s+(\w+)\s*=/g)].map(match => match[1]);
  const prelude = `
    const { sin, cos, atan, pow, exp, sqrt, max, mod, clamp, smoothstep, vec2, length, fwidth } = math;
    ${solarGaussianSource(material.fragmentShader)}
    ${solarShaderFloat(body, 'rayPhase')}
    ${solarShaderFloat(body, 'shimmer')}`;
  const phaseFields = fields.slice(0, fields.indexOf('finePhase') + 1);
  assert.ok(phaseFields.length, 'the actual shader must expose its continuous strand phase before filtering');
  const readPhase = new Function('p', 'radial', 'uTime', 'math', 'uRayLengthScale', 'wisp', `
    ${prelude}
    ${phaseFields.map(name => solarShaderFloat(body, name)).join('\n')}
    ${solarShaderFloat(body, 'wispPhase')}
    return wisp ? wispPhase : finePhase;
  `);
  const evaluate = new Function('p', 'radial', 'uTime', 'math', 'uRayLengthScale', `
    ${prelude}
    ${fields.map(name => solarShaderFloat(body, name)).join('\n')}
    return { outsideDisc, pulse, rayLength, rays, halo, rayAngle, shimmer, finePhase, widthPhase, rayFraction };
  `);
  const phase = (point, radial, time, math, wisp = false) => readPhase(point, radial, time, math, material.uniforms.uRayLengthScale.value, wisp);
  const sample = (point, radial, time, math) => {
    const logicalWidth = scene?.camera.view?.fullWidth || 68;
    const pixelRatio = scene?.renderer.getPixelRatio?.() || 3;
    const halfPixel = .5 / (logicalWidth * pixelRatio);
    const footprints = [false, true].map(wisp => {
      const neighbours = [[-halfPixel, 0], [halfPixel, 0], [0, -halfPixel], [0, halfPixel]].map(([x, y]) => {
        const neighbour = { x: point.x + x, y: point.y + y };
        const value = phase(neighbour, Math.hypot(neighbour.x, neighbour.y), time, math, wisp) - (wisp ? 0 : Math.PI / 2);
        return { x: Math.sin(value), y: Math.cos(value) };
      });
      return Object.fromEntries(['x', 'y'].map(axis => [axis,
        Math.abs(neighbours[1][axis] - neighbours[0][axis]) + Math.abs(neighbours[3][axis] - neighbours[2][axis])]));
    });
    // Finite differences approximate fragment derivatives on the continuous
    // phase unit circle. A raw atan phase would create a false seam here.
    let derivative = 0;
    const filteredMath = { ...math, fwidth: value => {
      assert.ok(value && typeof value === 'object', 'ray AA must use the wrapped phase circle');
      assert.ok(derivative < footprints.length, 'each independent strand layer needs its own fragment footprint');
      return footprints[derivative++];
    } };
    return evaluate(point, radial, time, filteredMath, material.uniforms.uRayLengthScale.value);
  };
  return { body, sample, phase };
}

test('actual solar ray light travels independently across the limb while retaining the original photosphere and texture', async () => {
  const h = await solarRecoveryHarness();
  h.setNow(h.epoch + 100000);
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' });
  const material = scene.flareMesh.material;
  const { body, sample: lightAt } = solarRaySampler(material, scene);
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
  const frameChanges = Array.from({ length: 24 }, () => []);
  assert.ok(rayGain > 0);
  let maximumChange = 0;
  for (let i = 0; i < 72; i += 1) {
    const angle = i * Math.PI / 36;
    for (const radial of [.277, .303, .333, .373]) {
      const point = { x: Math.cos(angle) * radial, y: Math.sin(angle) * radial };
      const first = lightAt(point, radial, firstTime, solarShaderMath);
      const second = lightAt(point, radial, secondTime, solarShaderMath);
      for (const sample of [first, second]) {
        assert.ok([sample.rays, sample.pulse, sample.halo].every(value => Number.isFinite(value) && value >= 0));
      }
      maximumChange = Math.max(maximumChange, Math.abs(first.rays - second.rays));
      displayChanges.push(Math.abs(first.rays - second.rays) * rayGain * 255 * 1.06);
      for (let phase = 0; phase < frameChanges.length; phase++) {
        const current = lightAt(point, radial, firstTime + phase, solarShaderMath);
        const nextFrame = lightAt(point, radial, firstTime + phase + 1 / 30, solarShaderMath);
        frameChanges[phase].push(Math.abs(current.rays - nextFrame.rays) * rayGain * 255 * 1.06);
      }
      if (first.rays > .0001 && second.rays > .0001) ratios.push(second.rays / first.rays);
      assert.equal(first.halo, second.halo, 'moving light must not merely pulse the whole halo uniformly');
    }
  }
  assert.ok(maximumChange > .01, 'light along visible short rays must change perceptibly in three seconds');
  const displayRms = Math.sqrt(displayChanges.reduce((sum, change) => sum + change ** 2, 0) / displayChanges.length);
  assert.ok(displayRms > 8, `ray movement must be visible within three seconds; got ${displayRms}`);
  for (const [phase, changes] of frameChanges.entries()) {
    const frameRms = Math.sqrt(changes.reduce((sum, change) => sum + change ** 2, 0) / changes.length);
    assert.ok(frameRms < 6 * 1.15, `adjacent animation frames must stay smooth with the requested 15% ray gain; phase ${phase}, got ${frameRms}`);
  }
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

test('actual ray roots drift independently around the disc instead of rotating as one crown', async t => {
  const h = await solarRecoveryHarness();
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' });
  const { body, sample, phase } = solarRaySampler(scene.flareMesh.material, scene);
  const radial = .255, tau = Math.PI * 2;
  const light = (angle, time) => sample({ x: Math.cos(angle) * radial, y: Math.sin(angle) * radial }, radial, time, solarShaderMath).rays;
  const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
  const frequency = Number(body.match(/finePhase\s*=\s*rayAngle\s*\*\s*([\d.]+)/u)?.[1]);
  assert.ok(frequency >= 8 && Number.isInteger(frequency));
  const unwrappedPhase = (angle, time) => {
    const point = { x: Math.cos(angle) * radial, y: Math.sin(angle) * radial };
    return phase(point, radial, time, solarShaderMath) + frequency * (angle - Math.atan2(point.y, point.x));
  };
  // Track the actual monotone shader phase, avoiding ambiguous peak matching
  // when two antialiased streamers temporarily approach the same raster pixel.
  const rootAt = (target, time) => {
    let low = -.5, high = tau + .5;
    assert.ok(unwrappedPhase(low, time) < target && unwrappedPhase(high, time) > target);
    for (let step = 0; step < 25; step++) {
      const middle = (low + high) / 2;
      if (unwrappedPhase(middle, time) < target) low = middle; else high = middle;
    }
    return (low + high) / 2;
  };
  const firstBranch = Math.ceil((unwrappedPhase(0, 0) - Math.PI / 2) / tau);
  const initial = Array.from({ length: frequency }, (_, index) => {
    const target = Math.PI / 2 + (firstBranch + index) * tau;
    const angle = rootAt(target, 0);
    return { target, angle, value: light(angle, 0) };
  }).filter(root => root.value > .005).sort((left, right) => right.value - left.value).slice(0, 10);
  assert.ok(initial.length >= 8, 'the field must expose many separate streamers for motion tracking');
  let tracks = initial.map(root => ({ ...root, displacement: 0, direction: 0, turns: [] }));
  const snapshots = [];
  let mixedFrames = 0;
  for (let frame = 1; frame <= 720; frame++) {
    const time = frame / 30;
    const directions = [];
    tracks = tracks.map(track => {
      const angle = rootAt(track.target, time);
      const movement = wrap(angle - track.angle);
      assert.ok(Math.abs(movement) < .015, `frame motion must stay below a quarter CSS pixel on the original mobile disc; time=${time}, movement=${movement}`);
      const direction = Math.abs(movement) > .00001 ? Math.sign(movement) : track.direction;
      directions.push(direction);
      if (track.direction && direction !== track.direction) track.turns.push(time);
      return { ...track, angle, direction, displacement: track.displacement + movement };
    });
    if (directions.filter(value => value > 0).length >= 3 && directions.filter(value => value < 0).length >= 3) mixedFrames++;
    assert.equal(new Set(tracks.map(track => track.angle)).size, tracks.length, 'independent streamers must not collapse onto one tracked maximum');
    if ([30, 90, 240, 420, 600].includes(frame)) snapshots.push({ time, values: tracks.map(track => track.displacement) });
  }
  const degrees = 180 / Math.PI;
  const mobileRadius = .247 * 68;
  assert.ok(snapshots.find(snapshot => snapshot.time === 3).values.filter(value => Math.abs(value) * mobileRadius > 1).length >= 3,
    'several ray roots must travel more than one CSS pixel in three seconds on the unchanged mobile disc');
  const laterSnapshots = snapshots.filter(snapshot => snapshot.time >= 8).map(snapshot => snapshot.values);
  const movement = laterSnapshots.flat();
  assert.ok(movement.filter(value => Math.abs(value) * degrees > 3).length >= initial.length, 'many actual maxima must visibly leave their initial positions over eight to twenty seconds');
  assert.ok(laterSnapshots.some(values => values.filter(value => value * degrees > 3).length >= 3 && values.filter(value => value * degrees < -3).length >= 3), 'different roots must travel in opposite directions at the same time');
  assert.ok(laterSnapshots.every(values => (Math.max(...values) - Math.min(...values)) * degrees > 6), 'one shared angular rotation must not explain the moving crown');
  assert.ok(mixedFrames >= 60, 'several rays must visibly travel in opposite directions at the same time');
  assert.ok(tracks.filter(track => track.turns.length >= 2).length >= 6, 'independent rays must reverse direction during the cycle');
  const turnBuckets = tracks.flatMap(track => track.turns.map(time => Math.round(time * 2)));
  assert.ok(new Set(turnBuckets).size >= 8, 'reversals must happen at different moments instead of one shared sway');
  t.diagnostic(JSON.stringify({ trackedRoots: tracks.length, oppositeDirectionFrames: mixedFrames,
    reversingRoots: tracks.filter(track => track.turns.length >= 2).length, distinctHalfSecondTurnBuckets: new Set(turnBuckets).size }));
  for (const time of [0, 8, 14, 20, 86399]) {
    assert.ok(Math.abs(light(-Math.PI, time) - light(Math.PI, time)) < 1e-10, 'irregular motion must stay continuous across the angular seam');
  }
  scene.dispose();
});

test('actual optical light stays continuous at its native animation seam and UTC midnight', async () => {
  const h = await solarRecoveryHarness();
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' });
  const { sample } = solarRaySampler(scene.flareMesh.material, scene);
  const radial = .255;
  for (let index = 0; index < 360; index++) {
    const angle = index * Math.PI / 180;
    const point = { x: Math.cos(angle) * radial, y: Math.sin(angle) * radial };
    const first = sample(point, radial, 0, solarShaderMath);
    const next = sample(point, radial, .001, solarShaderMath);
    for (const boundary of [24, 86400]) {
      const last = sample(point, radial, boundary - .001, solarShaderMath);
      const complete = sample(point, radial, boundary, solarShaderMath);
      for (const field of ['rayAngle', 'pulse', 'rayLength', 'rays', 'halo', 'shimmer']) {
        assert.ok([first[field], next[field], last[field], complete[field]].every(Number.isFinite));
        assert.ok(Math.abs(last[field] - first[field]) <= Math.abs(next[field] - first[field]) * 2 + .00001,
          `${field} must cross ${boundary}s with a normal one-millisecond step`);
        assert.ok(Math.abs(complete[field] - first[field]) < 1e-8, `${field} must meet exactly at ${boundary}s`);
      }
    }
  }
  scene.dispose();
});

test('mobile rays stay distinct from the halo at the shared 68px size after compositing', async () => {
  const h = await solarRecoveryHarness();
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' });
  const material = scene.flareMesh.material;
  const { body, sample, phase } = solarRaySampler(material, scene);
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
    h.canvas.clientWidth = h.canvas.clientHeight = size * 2.25;
    scene.resize();
    const angular = [], movements = [];
    let clearMaximum = 0, cloudMaximum = 0;
    for (let index = 0; index < 360; index += 1) {
      const angle = index * Math.PI / 180;
      for (let pixels = 1; pixels <= 26; pixels += .5) {
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
        if (pixels === 8) { angular.push(values[0]); movements.push(Math.abs(values[1] - values[0])); }
      }
    }
    const tau = Math.PI * 2, radial = .255;
    const frequency = Number(body.match(/finePhase\s*=\s*rayAngle\s*\*\s*([\d.]+)/u)?.[1]);
    const phaseAt = (angle, radius = radial) => {
      const point = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
      return phase(point, radius, 100, solarShaderMath) + frequency * (angle - Math.atan2(point.y, point.x));
    };
    const firstBranch = Math.ceil((phaseAt(0) - Math.PI / 2) / tau);
    const centrelineReach = Array.from({ length: frequency }, (_, index) => {
      const target = Math.PI / 2 + (firstBranch + index) * tau;
      let length = 0;
      for (let pixels = 1; pixels <= 34; pixels += .5) {
        const radius = .247 + pixels / size;
        // Follow the same strand phase at every radius: a flexible centreline
        // can leave the straight radial line through its original root.
        let low = -.5, high = tau + .5;
        for (let step = 0; step < 25; step++) {
          const middle = (low + high) / 2;
          if (phaseAt(middle, radius) < target) low = middle; else high = middle;
        }
        const angle = (low + high) / 2;
        const value = sample({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }, radius, 100, solarShaderMath);
        const base = value.halo * value.outsideDisc;
        const clear = composite(base + gain * value.rays * value.outsideDisc, 1) - composite(base, 1);
        if (clear > 10) length = pixels;
      }
      return length;
    }).sort((a, b) => a - b);
    // Cone tips occupy very few angles; measuring all-angle percentiles would
    // mistake their intentional narrowing for a loss of centreline length.
    const extent = centrelineReach[Math.floor(centrelineReach.length * .9)];
    const lengthScale = material.uniforms.uRayLengthScale.value;
    assert.ok(extent + .25 >= size * lengthScale * .16 * .75 && extent - .25 <= size * lengthScale * .35 * .75,
      `${size}px layout needs cone centrelines shortened by the requested 25%, received ${extent}px`);
    assert.ok(Math.max(...angular) - Math.min(...angular) > 18, 'unequal streamers must retain an angular silhouette instead of becoming a uniform ring');
    const sorted = [...angular].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const peak = sorted.at(-1);
    assert.ok(median < peak * .12, `rays must have dark gaps instead of merging into broad cloudy lobes: median ${median}, peak ${peak}`);
    let longest = 0, run = 0;
    for (const light of angular.concat(angular)) { run = light > peak * .5 ? run + 1 : 0; longest = Math.max(longest, Math.min(run, angular.length)); }
    const arcWidth = longest * Math.PI / 180 * (.247 * size + 8);
    // The doubled ray keeps its former angular width; its CSS arc naturally
    // grows at twice the distance above the limb. Dark gaps still prevent lobes.
    const angularWidthLimit = size * .04 / (.247 * size + 4);
    assert.ok(arcWidth > .6 && arcWidth / (.247 * size + 8) < angularWidthLimit,
      `${size}px layout needs narrow antialiased rays at half maximum, received ${arcWidth}px`);
    assert.ok(movements.filter(change => change > 6).length > 25, 'many visible angular positions must change smoothly across three seconds');
    assert.ok(cloudMaximum < clearMaximum * .016, 'thick clouds attenuate the complete luminous ray output, not just the photosphere');
  }
  scene.dispose();
});

test('actual event plasma uses one bounded canonical arch and contributes no opposite-side spokes', async () => {
  const h = await solarRecoveryHarness();
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg' });
  const shader = scene.flareMesh.material.fragmentShader;
  const body = shader.match(/float limbPlasma\([^)]*\)\s*\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body, 'the shader must expose its small limb structures for bounded numerical verification');
  const plasmaAt = new Function('p', 'angle', 'width', 'height', 'phase', 'uTime', 'math', `
    const { sin, cos, pow, exp, abs, max, smoothstep, vec2, dot, length, fwidth } = math;
    ${solarGaussianSource(shader)}
    ${body.replace(/\b(?:vec2|float)\s+(\w+)\s*=/g, 'let $1 =')}
  `);
  const arch = body.match(/float arch\s*=[^;]+;/)?.[0];
  assert.ok(arch, 'the actual canonical arch expression must be measured');
  const archAt = new Function('x', 'height', 'phase', 'uTime', 'sin', `${arch.replace(/\bfloat\b/, 'let')} return arch;`);
  const limbRadius = Number(body.match(/float y\s*=\s*dot\(p, normal\)\s*-\s*([\d.]+)/)?.[1]);
  assert.ok(Number.isFinite(limbRadius));
  const structures = [];
  for (let time = h.epoch; time <= h.epoch + 86400000; time += 137000) {
    structures.push(...scene.getProminenceStates(time).map(state => ({ ...state })));
  }
  const radius = scene.sunMesh.geometry.parameters.radius;
  const distance = scene.camera.position.z;
  const photosphere = radius / Math.sqrt(distance ** 2 - radius ** 2) / (2 * Math.tan(scene.camera.fov * Math.PI / 360));
  for (const { angle, width, height } of structures) {
    let maximumRadius = 0;
    assert.ok(limbRadius + archAt(0, height, 0, 0, Math.sin) > photosphere, 'each microplasma apex must remain outside the photosphere');
    for (let i = -20; i <= 20; i += 1) {
      const x = i / 20;
      maximumRadius = Math.max(maximumRadius, Math.hypot(limbRadius + archAt(x, height, 0, 0, Math.sin), x * width));
    }
    assert.ok(maximumRadius <= photosphere * 1.06, 'deformation and tangent width must not grow a microstructure beyond six percent of the solar radius');
    const normal = { x: Math.cos(angle), y: Math.sin(angle) };
    for (const canvasPixels of [68, 96, 288, 1024]) {
      const math = { ...solarShaderMath, fwidth: () => 1 / canvasPixels };
      for (const time of [0, 3600]) {
        const peakRadius = limbRadius + archAt(0, height, 0, time, Math.sin);
        const peak = plasmaAt({ x: normal.x * peakRadius, y: normal.y * peakRadius }, angle, width, height, 0, time, math);
        assert.ok(Number.isFinite(peak) && peak > .1, 'the intended limb structure must emit light at its own apex');
        for (const radial of [photosphere + .005, photosphere + .02, photosphere + .08]) {
          const opposite = plasmaAt({ x: -normal.x * radial, y: -normal.y * radial }, angle, width, height, 0, time, math);
          assert.ok(Number.isFinite(opposite) && Math.abs(opposite) < 1e-8, 'a microstructure must not create a long bright strip on the opposite side of the Sun');
        }
      }
    }
  }
  scene.dispose();
});

test('UTC prominence events vary between lanes and days with bounded sizes, slow envelopes and continuous midnight visibility', async () => {
  const h = await solarRecoveryHarness();
  const angles = new Set(), widths = new Set(), heights = new Set();
  const target = {};
  for (let elapsed = 0; elapsed < 86400000; elapsed += 60000) for (let lane = 0; lane < 3; lane++) {
    const time = h.epoch + elapsed;
    const state = h.prominence(time, lane, target);
    assert.equal(state, target, 'the render loop must reuse its state objects');
    assert.deepEqual(state, h.prominence(time, lane), 'one UTC instant must survive remount without choosing a new random event');
    assert.ok(state.angle >= 0 && state.angle < Math.PI * 2);
    assert.ok(state.width >= .007 && state.width <= .02 && state.height >= .004 && state.height <= .0146);
    assert.ok(state.opacity >= 0 && state.opacity <= 1);
    angles.add(state.angle.toFixed(6)); widths.add(state.width.toFixed(5)); heights.add(state.height.toFixed(5));
  }
  assert.ok(angles.size > 300 && widths.size > 100 && heights.size > 100, 'events must choose many independent positions and sizes, rather than three fixed or rotating arcs');
  for (let lane = 0; lane < 3; lane++) {
    const start = Math.ceil((h.epoch / 1000 + lane * 240) / 720) * 720000 - lane * 240000;
    assert.ok(h.prominence(start - 1, lane).opacity < 1e-8 && h.prominence(start + 1, lane).opacity < 1e-8, 'changing event identity must happen while both events are invisible');
    assert.ok(h.prominence(start + 1000, lane).opacity < .002, 'a new event cannot flash on within its first second');
    assert.equal(h.prominence(start + 45000, lane).opacity, 1, 'appearance takes a smooth forty-five seconds');
    let lastVisible = 0;
    for (let second = 0; second <= 720; second++) if (h.prominence(start + second * 1000, lane).opacity > 0) lastVisible = second;
    assert.ok(lastVisible >= 359 && lastVisible < 600, 'each event lives six to ten real minutes, then leaves a quiet interval');
    const before = h.prominence(h.epoch + 86400000 - 1, lane), after = h.prominence(h.epoch + 86400000 + 1, lane);
    assert.ok(Math.abs(before.opacity - after.opacity) < .0001);
    if (Math.max(before.opacity, after.opacity) > 1e-6) for (const field of ['angle', 'width', 'height']) assert.equal(before[field], after[field], 'a visible event cannot change its geometry at midnight');
    assert.notEqual(h.prominence(start + 60000, lane).angle, h.prominence(start + 86460000, lane).angle, 'different UTC days must not replay the same fixed daily event list');
  }
});

test('the live shader packs shared UTC event states and uses the same neutral emitted colour as its photographic disc', async () => {
  const h = await solarRecoveryHarness();
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg', geoState: { latitude: 51.22, longitude: 6.78 } });
  const material = scene.flareMesh.material;
  assert.equal(material.uniforms.uSolarColor, h.stats.shader.uniforms.uSolarSurfaceColor);
  assert.equal(material.uniforms.uPlasma, scene.prominenceUniform);
  assert.equal(material.uniforms.uPlasmaEnabled.value, 1, 'normal rendering includes the event layer; base recording can explicitly disable it');
  assert.match(material.fragmentShader, /vec3 light = vec3\(halo \+ diffraction \* 0\.65 \+ plasma \* 0\.6\)/);
  assert.match(material.fragmentShader, /light \+= vec3\(rays \* [\d.]+\) \* rayBounds;/,
    'extended rays remain neutral emitted light with a separate outer boundary');
  assert.match(material.fragmentShader, /light \*= uSolarColor \* outsideDisc \* shimmer;/,
    'both light groups must receive the same photosphere colour and exclusion mask');
  assert.doesNotMatch(material.fragmentShader, /vec3\(1\.0, 0\.5, 0\.24\)|limbPlasma\(p,\s*[-\d]/);
  const states = scene.getProminenceStates();
  const originalArray = scene.prominenceUniform.value, map = scene.sunMesh.material.map;
  for (const time of [h.epoch + 100000, h.epoch + 1700000]) {
    h.setNow(time); scene.renderFrame();
    assert.equal(scene.getProminenceStates(time), states);
    for (let lane = 0; lane < 3; lane++) for (const [offset, field] of ['angle', 'width', 'height', 'opacity'].entries()) {
      assert.equal(originalArray[lane * 4 + offset], Math.fround(h.prominence(time, lane)[field]));
    }
  }
  assert.equal(scene.prominenceUniform.value, originalArray); assert.equal(scene.sunMesh.material.map, map);
  assert.equal(h.stats.textures.length, 1); assert.equal(h.stats.rendererCreations, 1);
  scene.dispose();
});

test('geographic and corrected-clock colour changes blend for 1.2 monotonic seconds while initial colours are exact', async () => {
  const h = await solarRecoveryHarness();
  const now = Date.parse('2026-03-20T12:00:00Z'); h.setNow(now);
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg', geoState: { latitude: 0, longitude: 0 } });
  const first = { ...scene.solarSurfaceColorUniform.value };
  assert.deepEqual(first, h.surfaceColor(h.elevation(now, 0, 0)));
  scene.setGeoState({ longitude: 90 });
  assert.deepEqual({ ...scene.solarSurfaceColorUniform.value }, first, 'a new target cannot replace the current visible colour in one frame');
  const target = h.surfaceColor(h.elevation(now, 0, 90));
  h.advanceMonotonic(600); scene.renderFrame();
  for (const field of ['r', 'g', 'b']) assert.ok(Math.abs(scene.solarSurfaceColorUniform.value[field] - (first[field] + target[field]) / 2) < 1e-12);
  h.advanceMonotonic(600); scene.renderFrame();
  assert.deepEqual({ ...scene.solarSurfaceColorUniform.value }, target);
  h.setNow(now - 6 * 3600000); scene.renderFrame();
  assert.deepEqual({ ...scene.solarSurfaceColorUniform.value }, target, 'a wall-clock correction cannot advance the monotonic colour transition');
  for (let elapsed = 0; elapsed < 1200; elapsed += 100) {
    const before = scene.solarSurfaceColorUniform.value.b;
    h.advanceMonotonic(100); scene.renderFrame();
    assert.ok(scene.solarSurfaceColorUniform.value.b >= before - 1e-12);
  }
  assert.deepEqual({ ...scene.solarSurfaceColorUniform.value }, h.surfaceColor(h.elevation(now - 6 * 3600000, 0, 90)));
  scene.dispose();
});

test('a real UTC day changes emitted surface colour by less than one display level per second across seasons and latitudes', async () => {
  const h = await solarRecoveryHarness();
  const srgb = value => value <= .0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - .055;
  let maximum = 0;
  for (const day of ['2026-03-20', '2026-11-04']) for (const [latitude, longitude] of [[0, 0], [51.22, 6.78], [69.65, 18.96]]) {
    const midnight = Date.parse(`${day}T00:00:00Z`);
    for (let second = 0; second <= 86400; second += 30) {
      const a = h.surfaceColor(h.elevation(midnight + second * 1000, latitude, longitude));
      const b = h.surfaceColor(h.elevation(midnight + second * 1000 + 1000, latitude, longitude));
      for (const channel of ['r', 'g', 'b']) maximum = Math.max(maximum, Math.abs(srgb(a[channel]) - srgb(b[channel])) * 255);
    }
  }
  assert.ok(maximum > .1 && maximum < 1, `a full twenty-four-hour colour cycle must remain gradual without being frozen or accelerated; maximum ${maximum}`);
});

test('typed solar transmission and phase compose their independent fades without transitioning dependent opacity', async () => {
  for (const errorName of [null, 'InvalidModificationError', 'NotSupportedError']) {
    const h = await solarRecoveryHarness(); const changes = [], registrations = [];
    h.window.CSS = { registerProperty(settings) { registrations.push(settings); if (errorName) throw Object.assign(new Error(errorName), { name: errorName }); } };
    h.canvas.parentElement = { style: { setProperty: (...values) => changes.push(values) } };
    const scene = await h.mount(h.canvas, {});
    assert.deepEqual(registrations, (errorName === 'NotSupportedError' ? ['--orb-crossfade-opacity'] : ['--orb-crossfade-opacity', '--orb-sun-transmission'])
      .map(name => ({ name, syntax: '<number>', inherits: true, initialValue: '1' })));
    if (errorName === 'NotSupportedError') assert.deepEqual(changes, []);
    else assert.deepEqual(changes, [['transition', '--orb-crossfade-opacity 1.35s ease-in-out, --orb-sun-transmission 30s linear, translate var(--orb-sky-duration, 1s) linear', 'important']]);
    scene.dispose();
  }
});

class RecoveryElement extends globalThis.EventTarget {
  handlers = new Map(); attributes = new Map(); dataset = {}; hidden = false;
  style = {
    values: new Map(),
    getPropertyValue(name) { return this.values.get(name)?.value || ''; },
    getPropertyPriority(name) { return this.values.get(name)?.priority || ''; },
    setProperty(name, value, priority = '') { this.values.set(name, { value, priority }); },
    removeProperty(name) { this.values.delete(name); },
  };
  addEventListener(name, handler, options) {
    if (!this.handlers.has(name)) this.handlers.set(name, new Set());
    this.handlers.get(name).add(handler); super.addEventListener(name, handler, options);
  }
  removeEventListener(name, handler, options) { this.handlers.get(name)?.delete(handler); super.removeEventListener(name, handler, options); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); if (name === 'src') this.src = String(value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); if (name === 'src') this.src = ''; }
}

function nativeRecoveryHarness({ reducedMotion = false, maskSupported = true, animationDecode, posterDecode, spriteDecode = Promise.resolve(), decode = Promise.resolve(), blobMedia = false, assetFetch } = {}) {
  const document = new RecoveryElement(), window = new RecoveryElement(), motion = new RecoveryElement();
  const video = new RecoveryElement(), image = new RecoveryElement(), canvas = new RecoveryElement(), overlay = new RecoveryElement(), stack = new RecoveryElement();
  const stats = { animationDecodes: 0, geo: 0, states: [], intersections: [], removals: [], restores: 0, created: [], children: [], now: 100000, appearanceUpdates: 0, prominenceTimes: [], prominenceStates: [{ angle: Math.PI / 2, width: .01, height: .008, opacity: .4 }, { angle: 0, width: .02, height: .0146, opacity: .8 }, { angle: Math.PI, width: .007, height: .004, opacity: 0 }] };
  stats.fetches = []; stats.blobs = new Map(); stats.revoked = [];
  if (blobMedia) {
    let blobId = 0;
    window.AbortController = AbortController;
    window.URL = {
      createObjectURL(blob) { const url = `blob:solar-test/${++blobId}`; stats.blobs.set(url, blob.assetURL); return url; },
      revokeObjectURL(url) { stats.revoked.push(url); stats.blobs.delete(url); },
    };
    window.fetch = async (url, settings) => {
      stats.fetches.push({ url, signal: settings.signal });
      if (assetFetch) return assetFetch(url, settings, stats);
      return { ok: true, status: 200, blob: async () => ({ assetURL: url, size: url.includes('-loop.webp') ? 4000000 : 40000 }) };
    };
  }
  let current = true;
  canvas.clientWidth = 153; overlay.clientWidth = 68;
  document.defaultView = window; document.hidden = false;
  document.createElement = name => {
    assert.ok(['img', 'span'].includes(name));
    const element = new RecoveryElement();
    element.tagName = name.toUpperCase();
    element.decode = () => {
      const source = stats.blobs.get(element.src) || element.src || '';
      if (source.includes('sun-prominence-arch.png')) return spriteDecode;
      if (!/sun-recovery(?:-wide)?-loop\.webp/u.test(source)) return posterDecode ? posterDecode(element, stats) : decode;
      stats.animationDecodes++;
      return animationDecode ? animationDecode(element, stats) : Promise.resolve();
    };
    element.remove = () => { stats.children = stats.children.filter(child => child !== element); };
    stats.created.push(element);
    return element;
  };
  motion.matches = reducedMotion; window.matchMedia = () => motion;
  window.CSS = { supports: (name, value) => maskSupported && name === 'mask-mode' && value === 'luminance' };
  const opticalFrames = new Map(); let opticalFrameId = 0;
  window.requestAnimationFrame = callback => { opticalFrames.set(++opticalFrameId, callback); return opticalFrameId; };
  window.cancelAnimationFrame = id => opticalFrames.delete(id);
  window.setInterval = () => { throw new Error('Native recovery must not add an interval clock or draw its media frames.'); };
  window.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; stats.intersections.push(this); }
    observe() {} disconnect() { this.disconnected = true; }
  };
  window.MutationObserver = class {
    constructor(callback) { this.callback = callback; stats.removals.push(this); }
    observe() {} disconnect() { this.disconnected = true; }
  };
  canvas.ownerDocument = document; canvas.parentElement = overlay;
  canvas.getContext = () => { throw new Error('Native recovery cannot create a GPU context.'); };
  overlay.parentElement = stack; overlay.getRootNode = () => document;
  overlay.querySelector = name => ({ video, img: image, canvas })[name];
  overlay.append = (...children) => stats.children.push(...children);
  image.setAttribute('src', '/original-photo.jpg');
  const photometry = { solarSurfaceColorUniform: { value: { r: 1, g: .98, b: .94 } },
    viewportOverscan: 2.25, opticalStates: Array.from({ length: 7 }, () => ({})),
    getTimeMs: () => stats.now,
    getOpticalState() { stats.opticalSamples = (stats.opticalSamples || 0) + 1; return stats.opticalStates || []; },
    updateSolarAppearance(time) { stats.appearanceUpdates++; stats.lastAppearanceTime = time; },
    getProminenceStates(time) { stats.prominenceTimes.push(time); return stats.prominenceStates; },
    setGeoState(next) { stats.geo++; if (next.blue !== undefined) this.solarSurfaceColorUniform.value.b = next.blue; if (next.rgb) Object.assign(this.solarSurfaceColorUniform.value, next.rgb); } };
  return { canvas, overlay, stack, image, video, document, window, motion, stats, opticalFrames,
    advanceOpticalFrame(timestamp) {
      const [id, callback] = opticalFrames.entries().next().value || [];
      assert.ok(callback, 'the live native lens must have one pending geometry frame');
      opticalFrames.delete(id); callback(timestamp);
    },
    animation: () => stats.created.find(node => node.className === 'weather-orb-overlay__animation'),
    surface: () => stats.children.find(node => node.className === 'weather-orb-overlay__mask'),
    setCurrent: value => { current = value; },
    mount: () => mountNativeSunRecovery({ canvas, photometry, options: { onStateChange: state => stats.states.push(state) }, isCurrent: () => current, restore: async () => { stats.restores++; } }),
  };
}

async function settleNativeMedia() {
  for (let turn = 0; turn < 24; turn++) await Promise.resolve();
}

test('a stalled native poster decode settles through the finite animation fallback instead of holding mount forever', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = nativeRecoveryHarness({ blobMedia: true, posterDecode: () => new Promise(() => {}) });
  let settled = false, scene;
  const mounting = h.mount().then(value => { settled = true; scene = value; }, () => { settled = true; });
  try {
    await settleNativeMedia(); assert.equal(settled, false);
    t.mock.timers.tick(15001); await settleNativeMedia();
    assert.equal(settled, true, 'poster decode must have a deadline after its fetch timer has already cleared');
    await mounting;
    assert.ok(scene); assert.equal(scene.renderMode, 'animation');
    assert.equal(h.stats.animationDecodes, 1);
    const poster = h.stats.created.find(node => node.src === '' && node !== h.animation());
    assert.ok(poster, 'the failed decoder source is released');
  } finally {
    scene?.dispose(); h.setCurrent(false); h.stats.removals.forEach(observer => observer.callback());
  }
});

test('cancelling an initial native poster decoder immediately settles mount and ignores its late completion', async () => {
  let finish;
  const decoded = new Promise(resolve => { finish = resolve; });
  const h = nativeRecoveryHarness({ blobMedia: true, posterDecode: () => decoded });
  let settled = false, failure;
  const mounting = h.mount().then(() => { settled = true; }, error => { settled = true; failure = error; });
  await settleNativeMedia();
  const preload = h.stats.created.find(node => /sun-recovery-poster\.png/u.test(h.stats.blobs.get(node.src) || ''));
  assert.ok(preload);
  h.setCurrent(false); h.stats.removals.forEach(observer => observer.callback());
  await settleNativeMedia();
  assert.equal(settled, true, 'dispose must settle the native decoder without waiting for its native promise');
  await mounting; assert.ok(failure); assert.equal(preload.src, '');
  assert.equal(h.stats.blobs.size, 0); assert.equal(h.stats.children.length, 0); assert.equal(h.opticalFrames.size, 0);
  const appearances = h.stats.appearanceUpdates;
  finish(); await settleNativeMedia();
  assert.equal(h.stats.appearanceUpdates, appearances); assert.equal(h.stats.children.length, 0);
  for (const target of [h.window, h.document, h.motion, h.canvas]) assert.ok([...target.handlers.values()].every(handlers => handlers.size === 0));
});

test('a stalled animation decoder returns to the accepted poster and releases the expired source', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let finish;
  const h = nativeRecoveryHarness({ blobMedia: true, animationDecode: () => new Promise(resolve => { finish = resolve; }) });
  const scene = await h.mount(); await settleNativeMedia();
  assert.equal(scene.renderMode, 'poster'); assert.equal(h.stats.animationDecodes, 1);
  t.mock.timers.tick(15001); await settleNativeMedia();
  assert.equal(scene.renderMode, 'poster'); assert.equal(scene.running, false); assert.equal(h.animation().src, '');
  assert.equal(scene.media.sourceUrl, null); assert.ok(scene.media.posterUrl);
  finish(); await settleNativeMedia();
  assert.equal(scene.renderMode, 'poster', 'a late native result must not revive the expired animation');
  scene.dispose(); assert.equal(h.stats.blobs.size, 0); assert.equal(h.opticalFrames.size, 0);
});

test('an optional sprite decoder expires without blocking the base or publishing a late sprite', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let finish;
  const h = nativeRecoveryHarness({ blobMedia: true, spriteDecode: new Promise(resolve => { finish = resolve; }) });
  const scene = await h.mount(); await settleNativeMedia();
  assert.equal(scene.renderMode, 'animation');
  t.mock.timers.tick(15001); await settleNativeMedia();
  assert.equal(scene.renderMode, 'animation');
  const before = h.stats.appearanceUpdates;
  finish(); await settleNativeMedia();
  assert.equal(h.stats.appearanceUpdates, before);
  assert.ok(h.stats.children.filter(node => node.className === 'weather-orb-overlay__prominence').every(node => node.hidden));
  scene.dispose(); assert.equal(h.stats.blobs.size, 0);
});

test('two stalled initial native decoders reject finitely and release all temporary resources', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = nativeRecoveryHarness({ blobMedia: true, posterDecode: () => new Promise(() => {}), animationDecode: () => new Promise(() => {}) });
  let settled = false, failure;
  const mounting = h.mount().then(() => { settled = true; }, error => { settled = true; failure = error; });
  await settleNativeMedia(); t.mock.timers.tick(15001); await settleNativeMedia();
  assert.equal(settled, false, 'the available animation is attempted after poster timeout');
  t.mock.timers.tick(15001); await settleNativeMedia();
  assert.equal(settled, true); await mounting; assert.equal(failure.name, 'TimeoutError');
  assert.equal(h.stats.blobs.size, 0); assert.equal(h.stats.children.length, 0); assert.equal(h.opticalFrames.size, 0);
  for (const target of [h.window, h.document, h.motion, h.canvas]) assert.ok([...target.handlers.values()].every(handlers => handlers.size === 0));
});

test('native decoder and luminance mask share one fetched blob and release replaced profiles', async () => {
  const h = nativeRecoveryHarness({ blobMedia: true });
  const scene = await h.mount(); await settleNativeMedia();
  assert.equal(scene.media.transport, 'blob'); assert.equal(scene.renderMode, 'animation');
  assert.equal(h.animation().src, scene.media.sourceUrl);
  assert.ok(h.surface().style.getPropertyValue('mask-image').includes(scene.media.sourceUrl));
  assert.equal(h.stats.fetches.filter(entry => entry.url === scene.media.source).length, 1);
  const original = { ...scene.media }, count = h.stats.fetches.length;
  scene.stop(); scene.start(); await settleNativeMedia();
  assert.equal(h.stats.fetches.length, count, 'resume reuses accepted bytes rather than requesting a second mask consumer');
  assert.equal(scene.media.sourceUrl, original.sourceUrl);
  h.overlay.clientWidth = 92; scene.resize(); await settleNativeMedia();
  assert.equal(scene.media.profile, 'wide'); assert.equal(scene.renderMode, 'animation');
  assert.ok(h.stats.revoked.includes(original.sourceUrl)); assert.ok(h.stats.revoked.includes(original.posterUrl));
  assert.ok(scene.media.retainedBytes <= 7200000);
  scene.dispose();
  assert.equal(h.stats.blobs.size, 0); assert.equal(scene.media.retainedBytes, 0);
  assert.ok(h.stats.fetches.every(entry => entry.signal.aborted));
});

test('native media retries one transient fetch but keeps its decoded poster after a permanent animation failure', async () => {
  let loops = 0;
  const retry = nativeRecoveryHarness({ blobMedia: true, assetFetch: async url => {
    if (url.includes('-loop.webp') && !loops++) throw new TypeError('Connection interrupted');
    return { ok: true, status: 200, blob: async () => ({ assetURL: url, size: 1000 }) };
  } });
  const running = await retry.mount(); await settleNativeMedia();
  assert.equal(running.renderMode, 'animation'); assert.equal(loops, 2); running.dispose();
  const missing = nativeRecoveryHarness({ blobMedia: true, assetFetch: async url => url.includes('-loop.webp')
    ? { ok: false, status: 404 }
    : { ok: true, status: 200, blob: async () => ({ assetURL: url, size: 1000 }) } });
  const poster = await missing.mount(); await settleNativeMedia();
  assert.equal(poster.renderMode, 'poster');
  assert.equal(missing.stats.fetches.filter(entry => entry.url.includes('-loop.webp')).length, 1);
  assert.ok(missing.surface().style.getPropertyValue('mask-image').includes(poster.media.posterUrl));
  missing.window.dispatchEvent(new Event('online'));
  missing.document.dispatchEvent(new Event('visibilitychange')); await settleNativeMedia();
  assert.equal(missing.stats.fetches.filter(entry => entry.url.includes('-loop.webp')).length, 1, 'a permanent missing asset is not retried on foreground events');
  assert.equal(missing.surface().hidden, false); poster.dispose(); assert.equal(missing.stats.blobs.size, 0);
});

test('a failed native poster does not suppress a decodable animation and keeps the original disc while paused', async () => {
  const h = nativeRecoveryHarness({ posterDecode: () => Promise.reject(new Error('poster decode failed')) });
  const scene = await h.mount(); await settleNativeMedia();
  assert.equal(scene.renderMode, 'animation'); assert.equal(h.stats.animationDecodes, 1);
  assert.match(h.surface().style.getPropertyValue('mask-image'), /sun-recovery-loop\.webp/u);
  assert.equal(h.image.hidden, true);
  scene.stop();
  assert.equal(scene.renderMode, 'poster'); assert.equal(h.surface().hidden, true);
  assert.equal(h.image.hidden, false); assert.equal(h.image.src, '/original-photo.jpg');
  assert.equal(h.image.style.getPropertyValue('clip-path'), 'circle(50%)');
  scene.start(); await settleNativeMedia(); assert.equal(scene.renderMode, 'animation');
  scene.dispose();
});

test('native media resumes after a transient decoder error on a bounded foreground event without retrying weather ticks', async t => {
  let now = 100000;
  let broken = true;
  t.mock.method(Date, 'now', () => now);
  const h = nativeRecoveryHarness({ animationDecode: () => broken ? Promise.reject(new Error('decoder interrupted')) : Promise.resolve() });
  const scene = await h.mount(); await settleNativeMedia();
  assert.equal(h.stats.animationDecodes, 1); assert.equal(scene.renderMode, 'poster');
  scene.setGeoState({ blue: .8 }); scene.start(); await settleNativeMedia();
  assert.equal(h.stats.animationDecodes, 1);
  h.window.dispatchEvent(new Event('online')); await settleNativeMedia();
  assert.equal(h.stats.animationDecodes, 2);
  for (let index = 0; index < 4; index++) h.window.dispatchEvent(new Event('online'));
  h.document.dispatchEvent(new Event('visibilitychange')); await settleNativeMedia();
  assert.equal(h.stats.animationDecodes, 2, 'foreground events share one sixty-second retry budget');
  now += 60001; broken = false; h.document.dispatchEvent(new Event('visibilitychange')); await settleNativeMedia();
  assert.equal(h.stats.animationDecodes, 3); assert.equal(scene.renderMode, 'animation');
  scene.dispose();
});

test('native BFCache page lifecycle releases decoded animation and resumes the accepted blob without another fetch', async () => {
  const h = nativeRecoveryHarness({ blobMedia: true }); const scene = await h.mount(); await settleNativeMedia();
  const fetches = h.stats.fetches.length, decodes = h.stats.animationDecodes;
  h.window.dispatchEvent(new Event('pagehide'));
  assert.equal(scene.renderMode, 'poster'); assert.equal(h.animation().src, ''); assert.equal(h.opticalFrames.size, 0);
  scene.setGeoState({ blue: .9 }); await settleNativeMedia();
  assert.equal(h.stats.animationDecodes, decodes, 'a frozen page cannot restart from a model update');
  const show = new Event('pageshow'); Object.defineProperty(show, 'persisted', { value: true });
  h.window.dispatchEvent(show); await settleNativeMedia();
  assert.equal(scene.renderMode, 'animation'); assert.equal(h.stats.animationDecodes, decodes + 1);
  assert.equal(h.stats.fetches.length, fetches);
  scene.dispose();
});

test('native media cancellation aborts pending bytes and cannot publish a late blob to a replacement owner', async () => {
  let finishBlob, signal;
  const body = new Promise(resolve => { finishBlob = resolve; });
  const h = nativeRecoveryHarness({ blobMedia: true, assetFetch: async (url, settings) => {
    if (url.includes('-loop.webp')) { signal = settings.signal; return { ok: true, status: 200, blob: () => body }; }
    return { ok: true, status: 200, blob: async () => ({ assetURL: url, size: 1000 }) };
  } });
  const scene = await h.mount(); await settleNativeMedia();
  assert.ok(signal); scene.dispose(); assert.equal(signal.aborted, true);
  finishBlob({ assetURL: '/late-loop.webp', size: 1000 }); await settleNativeMedia();
  assert.equal(h.stats.blobs.size, 0); assert.equal(h.stats.children.length, 0);
});

test('native camera geometry moves independently of its decoded rays and cancels every inactive frame loop', async () => {
  const h = nativeRecoveryHarness();
  h.stats.opticalStates = ['diamond', 'soft', 'hexagon', 'ring', 'diamond', 'diamond', 'soft'].map((kind, index) => ({
    kind, x: 10 + index * 8, y: 70, size: 8, opacity: .4, color: '120 200 150',
  }));
  const scene = await h.mount(); await settleNativeMedia();
  const ghosts = h.stats.children.filter(node => node.className === 'weather-orb-overlay__optical-ghost');
  assert.equal(ghosts.length, 7); assert.equal(h.opticalFrames.size, 1);
  assert.ok(ghosts.every(node => node.getAttribute('aria-hidden') === 'true' && !node.hidden));
  const source = h.surface().style.getPropertyValue('mask-image'), decodes = h.stats.animationDecodes;
  h.stats.opticalStates[0].x = 92;
  h.advanceOpticalFrame(100);
  assert.equal(ghosts[0].style.getPropertyValue('left'), '92.000%');
  assert.equal(h.surface().style.getPropertyValue('mask-image'), source);
  assert.equal(h.surface().style.getPropertyValue('transform'), 'none');
  assert.equal(h.stats.animationDecodes, decodes, 'camera movement cannot restart the ray decoder');
  assert.equal(h.opticalFrames.size, 1);
  scene.stop(); assert.equal(h.opticalFrames.size, 0);
  scene.start(); await settleNativeMedia(); assert.equal(h.opticalFrames.size, 1);
  h.document.hidden = true; h.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(h.opticalFrames.size, 0);
  h.document.hidden = false; h.document.dispatchEvent(new Event('visibilitychange'));
  await settleNativeMedia(); assert.equal(h.opticalFrames.size, 1);
  h.stats.intersections[0].callback([{ isIntersecting: false }]); assert.equal(h.opticalFrames.size, 0);
  h.stats.intersections[0].callback([{ isIntersecting: true }]); await settleNativeMedia();
  assert.equal(h.opticalFrames.size, 1);
  h.motion.matches = true; h.motion.dispatchEvent(new Event('change')); assert.equal(h.opticalFrames.size, 0);
  h.motion.matches = false; h.motion.dispatchEvent(new Event('change')); await settleNativeMedia();
  assert.equal(h.opticalFrames.size, 1);
  scene.dispose(); assert.equal(h.opticalFrames.size, 0); assert.equal(h.stats.children.length, 0);
});

test('native ray media follows measured Sun size and keeps the current animation until its replacement is decoded', async () => {
  let finishWide;
  const wideReady = new Promise(resolve => { finishWide = resolve; });
  const h = nativeRecoveryHarness({ posterDecode: element => element.src.includes('sun-recovery-wide-') ? wideReady : Promise.resolve() });
  const scene = await h.mount(); await settleNativeMedia();
  const originalMask = h.surface().style.getPropertyValue('mask-image');
  assert.match(originalMask, /sun-recovery-loop\.webp/u);
  assert.equal(scene.running, true);
  h.overlay.clientWidth = 0; h.canvas.clientWidth = 153;
  scene.resize(); await settleNativeMedia();
  assert.equal(h.surface().style.getPropertyValue('mask-image'), originalMask,
    'the expanded mobile canvas must resolve to its logical profile when overlay measurement is unavailable');
  h.canvas.clientWidth = 0; // A display:none canvas must not override the measured overlay.
  h.overlay.clientWidth = 92;
  scene.resize(); await settleNativeMedia();
  assert.equal(h.surface().style.getPropertyValue('mask-image'), originalMask);
  assert.equal(scene.running, true, 'pending resize media cannot blank or freeze the accepted Sun');
  finishWide(); await settleNativeMedia();
  assert.match(h.surface().style.getPropertyValue('mask-image'), /sun-recovery-wide-loop\.webp/u);
  assert.equal(scene.running, true);
  const decodes = h.stats.animationDecodes;
  scene.resize(); scene.setGeoState({}); await settleNativeMedia();
  assert.equal(h.stats.animationDecodes, decodes, 'same-size atmosphere updates cannot restart native animation');
  h.overlay.clientWidth = 68;
  scene.resize(); await settleNativeMedia();
  assert.match(h.surface().style.getPropertyValue('mask-image'), /sun-recovery-loop\.webp/u);
  for (const [property, value] of [['width', '150%'], ['height', '150%'], ['left', '-25%'], ['top', '-25%'], ['transform', 'none']]) {
    assert.equal(h.surface().style.getPropertyValue(property), value, 'media selection must preserve the centered padded recording');
  }
  scene.dispose();
});

test('native ray resize races and disposal cannot publish obsolete or detached media', async () => {
  const pending = [];
  const h = nativeRecoveryHarness({ posterDecode: element => element.src.includes('sun-recovery-wide-')
    ? new Promise(resolve => pending.push(resolve)) : Promise.resolve() });
  const scene = await h.mount(); await settleNativeMedia();
  h.canvas.clientWidth = 0; h.overlay.clientWidth = 92;
  scene.resize(); await settleNativeMedia();
  assert.equal(pending.length, 1);
  h.overlay.clientWidth = 68;
  scene.resize();
  pending[0](); await settleNativeMedia();
  assert.match(h.surface().style.getPropertyValue('mask-image'), /sun-recovery-loop\.webp/u,
    'returning to the current size must invalidate the obsolete wider pending decode');
  h.overlay.clientWidth = 92;
  scene.resize(); await settleNativeMedia();
  assert.equal(pending.length, 2);
  scene.dispose(); pending[1](); await settleNativeMedia();
  assert.equal(h.stats.children.length, 0);
  assert.equal(h.image.getAttribute('src'), '/original-photo.jpg');
  assert.equal(scene.running, false);
});

test('native mask prominences share the surface RGB and project the UTC geometry into DOM coordinates', async () => {
  const h = nativeRecoveryHarness(); const scene = await h.mount(); await settleNativeMedia();
  const nodes = h.stats.children.filter(node => node.className === 'weather-orb-overlay__prominence');
  assert.equal(nodes.length, 3);
  for (const node of nodes) {
    assert.equal(node.style.getPropertyValue('background-color'), 'var(--sun-surface-rgb)');
    assert.equal(node.style.getPropertyValue('mask-mode'), 'luminance');
    assert.match(node.style.getPropertyValue('mask-image'), /sun-prominence-arch\.png/u);
    assert.equal(node.style.getPropertyValue('transform-origin'), '50% 82.30088%');
    assert.equal(node.hidden, false);
  }
  assert.equal(nodes[0].style.getPropertyValue('left'), '50.00000%');
  assert.equal(nodes[0].style.getPropertyValue('top'), '25.30000%');
  assert.equal(nodes[0].style.getPropertyValue('transform'), 'translate(-50%, -82.30088%) rotate(0.00000deg)');
  assert.equal(nodes[1].style.getPropertyValue('left'), '74.70000%');
  assert.equal(nodes[1].style.getPropertyValue('width'), '4.80000%');
  assert.equal(nodes[1].style.getPropertyValue('height'), '2.26000%');
  assert.equal(nodes[1].style.getPropertyValue('transform'), 'translate(-50%, -82.30088%) rotate(90.00000deg)');
  h.stats.now += 45000; scene.resize(); assert.equal(h.stats.lastAppearanceTime, h.stats.now); assert.equal(h.stats.prominenceTimes.at(-1), h.stats.now);
  h.stats.now += 1000; scene.setGeoState({}); assert.equal(h.stats.lastAppearanceTime, h.stats.now);
  scene.stop(); assert.ok(nodes.every(node => node.hidden));
  h.stats.now += 100000; scene.start(); await settleNativeMedia(); assert.equal(h.stats.lastAppearanceTime, h.stats.now); assert.ok(nodes.every(node => !node.hidden));
  h.motion.matches = true; h.motion.dispatchEvent(new Event('change')); assert.ok(nodes.every(node => node.hidden));
  scene.dispose(); assert.equal(h.stats.children.length, 0); assert.equal(h.overlay.style.getPropertyValue('--sun-surface-rgb'), '');
});

test('unsupported masks retain the native PNG while a missing optional prominence sprite keeps the base mask usable', async () => {
  const legacy = nativeRecoveryHarness({ maskSupported: false }); const scene = await legacy.mount();
  assert.equal(scene.renderMode, 'poster'); assert.equal(legacy.image.hidden, false); assert.equal(legacy.surface().hidden, true);
  assert.equal(legacy.stats.animationDecodes, 0); assert.match(legacy.image.src, /sun-recovery-poster\.png/u); assert.match(legacy.image.style.getPropertyValue('filter'), /grayscale\(1\)/u); scene.dispose();
  const noSprite = nativeRecoveryHarness({ spriteDecode: Promise.reject(new Error('sprite missing')) }); const recovered = await noSprite.mount(); await settleNativeMedia();
  assert.equal(recovered.renderMode, 'animation'); assert.equal(noSprite.surface().hidden, false);
  assert.ok(noSprite.stats.children.filter(node => node.className === 'weather-orb-overlay__prominence').every(node => node.hidden)); recovered.dispose();
});

test('a stalled optional sprite cannot delay the native base and a cancelled owner ignores late sprite completion', async () => {
  let finish;
  const spriteDecode = new Promise(resolve => { finish = resolve; });
  const h = nativeRecoveryHarness({ spriteDecode });
  const old = await h.mount(); await settleNativeMedia();
  assert.equal(old.renderMode, 'animation', 'the base must resolve without waiting for the optional sprite');
  assert.ok(h.stats.children.filter(node => node.className === 'weather-orb-overlay__prominence').every(node => node.hidden));
  const next = await h.mount(); await settleNativeMedia(); old.dispose();
  const children = [...h.stats.children], updates = h.stats.appearanceUpdates;
  assert.equal(children.length, 11); assert.deepEqual(old.getProminenceStates(), []);
  finish(); await settleNativeMedia();
  assert.deepEqual(h.stats.children, children); assert.equal(h.stats.appearanceUpdates, updates + 1, 'only the current owner can publish decoded sprite geometry');
  assert.ok(children.filter(node => node.className === 'weather-orb-overlay__prominence').every(node => !node.hidden));
  assert.equal(next.getProminenceStates()[1].height, .0146); next.dispose();
});

test('native Sun uses a decoded luminance mask and one full RGB surface color without GPU, video or ancestor blending', async () => {
  const h = nativeRecoveryHarness(); const scene = await h.mount();
  await settleNativeMedia();
  const animation = h.animation(), surface = h.surface();
  assert.equal(scene.recovery, true); assert.equal(scene.renderMode, 'animation'); assert.equal(scene.state, 'recovery');
  assert.equal(scene.renderer, null); assert.equal(h.overlay.dataset.sunRenderMode, 'animation');
  assert.deepEqual(h.stats.states, ['recovery']);
  assert.match(animation.src, /sun-recovery-loop\.webp/u);
  assert.match(h.image.src, /sun-recovery-poster\.png/u);
  assert.equal(animation.getAttribute('aria-hidden'), 'true');
  assert.equal(surface.hidden, false); assert.equal(h.image.hidden, true);
  assert.match(surface.style.getPropertyValue('mask-image'), /sun-recovery-loop\.webp/u);
  assert.equal(surface.style.getPropertyValue('mask-mode'), 'luminance');
  assert.equal(surface.style.getPropertyValue('background-color'), 'var(--sun-surface-rgb)');
  assert.equal(surface.style.getPropertyValue('transition'), 'background-color 1.2s linear');
  const loads = h.stats.animationDecodes, tint = h.overlay.style.getPropertyValue('--sun-surface-rgb');
  scene.setGeoState({ rgb: { g: .1 } });
  assert.notEqual(h.overlay.style.getPropertyValue('--sun-surface-rgb'), tint, 'green changes must affect the color even when blue is unchanged');
  assert.equal(surface.style.getPropertyValue('filter'), 'none');
  assert.equal(h.stats.animationDecodes, loads, 'weather updates cannot restart the artistic native loop');
  assert.equal(h.video.src, undefined, 'the fallback cannot load a video');
  assert.equal(h.overlay.style.getPropertyValue('filter'), 'none', 'recorded optical glow must not receive a second parent glow');
  assert.equal(h.overlay.style.getPropertyValue('mix-blend-mode'), '');
  assert.equal(h.stack.style.values.size, 0, 'native alpha cannot require ancestor stacking changes');
  scene.dispose();
  assert.equal(animation.src, ''); assert.equal(h.image.src, '/original-photo.jpg');
  assert.equal(h.stats.children.length, 0); assert.equal(h.video.style.getPropertyValue('display'), '');
  for (const target of [h.document, h.window, h.motion, h.video, h.canvas]) assert.ok([...target.handlers.values()].every(handlers => handlers.size === 0));
  assert.ok([...h.stats.intersections, ...h.stats.removals].every(observer => observer.disconnected));
});

test('reduced motion, hidden pages, offscreen and stopped native Sun release the animation source and request native decoding on resume', async () => {
  const h = nativeRecoveryHarness({ reducedMotion: true }); const scene = await h.mount();
  const animation = h.animation();
  assert.equal(scene.renderMode, 'poster'); assert.equal(h.stats.animationDecodes, 0); assert.equal(animation.src, '');
  h.motion.matches = false; h.motion.dispatchEvent(new Event('change')); await settleNativeMedia();
  assert.equal(scene.renderMode, 'animation'); assert.equal(h.stats.animationDecodes, 1);
  h.document.hidden = true; h.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(scene.renderMode, 'poster'); assert.equal(scene.running, false); assert.equal(animation.src, '');
  h.document.hidden = false; h.document.dispatchEvent(new Event('visibilitychange')); await settleNativeMedia();
  assert.equal(scene.renderMode, 'animation'); assert.equal(h.stats.animationDecodes, 2);
  h.stats.intersections[0].callback([{ isIntersecting: false }]); assert.equal(animation.src, '');
  h.stats.intersections[0].callback([{ isIntersecting: true }]); await settleNativeMedia();
  assert.equal(scene.renderMode, 'animation'); assert.equal(h.stats.animationDecodes, 3);
  scene.stop(); assert.equal(animation.src, ''); assert.equal(scene.renderMode, 'poster');
  scene.start(); await settleNativeMedia(); assert.equal(scene.renderMode, 'animation'); assert.equal(h.stats.animationDecodes, 4);
  scene.dispose();
});

test('pending animation decoding keeps a visible poster and an obsolete rejection cannot replace resumed animation', async () => {
  let rejectFirst;
  const first = new Promise((resolve, reject) => { rejectFirst = reject; });
  const h = nativeRecoveryHarness({ animationDecode: (image, stats) => stats.animationDecodes === 1 ? first : Promise.resolve() });
  const scene = await h.mount();
  assert.equal(scene.renderMode, 'poster'); assert.equal(h.surface().hidden, false); assert.match(h.surface().style.getPropertyValue('mask-image'), /sun-recovery-poster\.png/u);
  h.document.hidden = true; h.document.dispatchEvent(new Event('visibilitychange'));
  h.document.hidden = false; h.document.dispatchEvent(new Event('visibilitychange')); await settleNativeMedia();
  assert.equal(h.stats.animationDecodes, 2); assert.equal(scene.renderMode, 'animation');
  rejectFirst(new Error('obsolete request was cancelled')); await settleNativeMedia();
  assert.equal(scene.renderMode, 'animation'); assert.equal(h.stats.animationDecodes, 2);
  scene.dispose();
});

test('native animation errors retain the poster without retry spam and GPU restoration remains bounded by capability and visibility', async t => {
  let now = 100000;
  t.mock.method(Date, 'now', () => now);
  const h = nativeRecoveryHarness({ animationDecode: () => Promise.reject(new Error('image network failure')) }); const scene = await h.mount(); await settleNativeMedia();
  assert.equal(scene.renderMode, 'poster'); assert.equal(h.surface().hidden, false); assert.equal(h.animation().src, '');
  const loads = h.stats.animationDecodes;
  h.document.dispatchEvent(new Event('visibilitychange')); await settleNativeMedia();
  scene.setGeoState({ blue: .9 });
  assert.equal(h.stats.animationDecodes, loads + 1, 'one eligible foreground event retries native decoding independently of GPU support');
  h.document.dispatchEvent(new Event('visibilitychange')); await settleNativeMedia();
  assert.equal(h.stats.animationDecodes, loads + 1, 'subsequent foreground events are throttled');
  assert.equal(h.stats.restores, 0, 'a missing WebGL API is not polled with new contexts');
  h.window.WebGL2RenderingContext = function () {};
  h.document.hidden = true; h.document.dispatchEvent(new Event('visibilitychange')); await Promise.resolve();
  assert.equal(h.stats.restores, 0);
  h.document.hidden = false; h.document.dispatchEvent(new Event('visibilitychange')); await Promise.resolve();
  assert.equal(h.stats.restores, 1);
  h.window.dispatchEvent(new Event('online')); await Promise.resolve(); assert.equal(h.stats.restores, 1);
  now += 60001; h.window.dispatchEvent(new Event('online')); await Promise.resolve(); assert.equal(h.stats.restores, 2);
  scene.dispose();
});

test('native Sun cancellation and obsolete adapter calls cannot mutate a replacement media owner', async () => {
  let finishFirst;
  const first = new Promise(resolve => { finishFirst = resolve; });
  const h = nativeRecoveryHarness({ animationDecode: (image, stats) => stats.animationDecodes === 1 ? first : Promise.resolve() });
  const old = await h.mount(); await settleNativeMedia();
  assert.equal(old.renderMode, 'poster');
  const next = await h.mount(); await settleNativeMedia();
  const loads = h.stats.animationDecodes, geo = h.stats.geo;
  old.stop(); old.start(); old.setGeoState({ blue: 0 }); old.dispose();
  finishFirst(); await settleNativeMedia();
  assert.equal(h.stats.animationDecodes, loads); assert.equal(h.stats.geo, geo); assert.equal(next.renderMode, 'animation');
  assert.equal(h.overlay.style.getPropertyValue('filter'), 'none', 'disposing one owner must preserve shared fallback styles');
  assert.equal(h.stats.children.length, 11);
  next.dispose(); assert.equal(h.overlay.style.getPropertyValue('filter'), ''); assert.equal(h.image.src, '/original-photo.jpg', 'overlapping owners must restore the original image, not an intermediate poster');
  let decode;
  const pendingDecode = new Promise(resolve => { decode = resolve; });
  const detached = nativeRecoveryHarness({ decode: pendingDecode }); const pending = detached.mount();
  assert.equal(detached.image.src, '/original-photo.jpg', 'the original disc remains available during poster predecode');
  detached.setCurrent(false); decode();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(detached.stats.children.length, 0); assert.equal(detached.stats.animationDecodes, 0);
  const brokenPoster = nativeRecoveryHarness({ decode: Promise.reject(new Error('poster missing')),
    animationDecode: () => Promise.reject(new Error('animation missing')) });
  await assert.rejects(brokenPoster.mount(), /animation missing/u);
  assert.equal(brokenPoster.image.src, '/original-photo.jpg'); assert.equal(brokenPoster.image.hidden, false); assert.equal(brokenPoster.overlay.style.values.size, 0);
});

test('a recovered WebGL scene remains the canvas owner after disposing its native playback adapter', async () => {
  let restore;
  const recovery = { recovery: true, disposed: false, setGeoState() {}, dispose() { this.disposed = true; } };
  const h = await solarRecoveryHarness({ contextMode: 'none', recoveryModule: { mountNativeSunRecovery: async options => { restore = options.restore; return recovery; } } });
  const overlay = { __sunSceneMountToken: 'current', dataset: {}, querySelector: name => name === 'video' ? {} : null };
  h.canvas.parentElement = overlay;
  overlay.__sunScene = await h.mount(h.canvas, {});
  assert.equal(overlay.__sunScene, recovery);
  h.canvas.getContext = () => h.context;
  await restore();
  assert.equal(recovery.disposed, true);
  const scene = overlay.__sunScene;
  assert.notEqual(scene, recovery); assert.equal(scene.ownsInitialization(), true, 'successful GPU ownership cannot depend on the disposed old adapter');
  assert.equal(overlay.dataset.sunRenderMode, 'webgl'); assert.equal(scene.state, 'ready');
  scene.dispose();
});

test('a pending or failed GPU restoration cannot publish failed state over working native recovery, while an accepted scene publishes later live states', async () => {
  let restore;
  let recovery;
  const h = await solarRecoveryHarness({ contextMode: 'none', recoveryModule: { mountNativeSunRecovery: async options => {
    recovery = { recovery: true, renderMode: 'animation', disposed: false, setGeoState() {}, dispose() { this.disposed = true; } };
    restore = options.restore; options.options.onStateChange('recovery'); return recovery;
  } } });
  const overlay = { __sunSceneMountToken: 'current', dataset: {}, querySelector: name => name === 'video' ? {} : null };
  const notifications = [];
  const onStateChange = state => { notifications.push(state); overlay.dataset.sunScene = state; };
  h.canvas.parentElement = overlay;
  overlay.__sunScene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg', onStateChange });
  assert.deepEqual(notifications, ['recovery']);
  await restore();
  assert.deepEqual(notifications, ['recovery'], 'a refused context cannot mark the retained recovery as failed');
  h.canvas.getContext = () => h.context;
  h.stats.failRenderAt = h.stats.renders + 2;
  await restore();
  assert.equal(overlay.__sunScene, recovery); assert.equal(recovery.disposed, false);
  assert.equal(overlay.dataset.sunScene, 'recovery'); assert.deepEqual(notifications, ['recovery'], 'a failed first GPU frame cannot replace a working animation');
  h.stats.failRenderAt = null;
  let completeDecode;
  h.stats.decodeWait = new Promise(resolve => { completeDecode = resolve; });
  const pending = restore();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(overlay.__sunScene, recovery); assert.equal(overlay.dataset.sunScene, 'recovery');
  assert.deepEqual(notifications, ['recovery'], 'speculative initialization cannot publish a premature ready state');
  completeDecode(); await pending;
  const scene = overlay.__sunScene;
  assert.notEqual(scene, recovery); assert.equal(scene.ownsInitialization(), true);
  assert.equal(recovery.disposed, true); assert.equal(overlay.dataset.sunScene, 'ready');
  assert.deepEqual(notifications, ['recovery', 'ready'], 'ready is published once, after the accepted ownership handoff');
  scene.onContextLost({ preventDefault() {} });
  assert.equal(overlay.dataset.sunScene, 'lost');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(overlay.__sunScene, recovery, 'an accepted live scene retains runtime native recovery after its next context loss');
  scene.onContextRestored();
  assert.deepEqual(notifications, ['recovery', 'ready', 'lost', 'recovery'], 'a disposed live callback cannot publish ready over the replacement animation');
  recovery.dispose();
});
