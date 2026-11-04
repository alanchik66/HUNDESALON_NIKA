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

async function solarRecoveryHarness({ textureFailure = false } = {}) {
  const source = await readFile(new URL('../assets/js/header-weather-sun-scene.js', import.meta.url), 'utf8');
  const program = parse(source, { ecmaVersion: 'latest', sourceType: 'module', range: true });
  const code = program.body.filter(node => node.type !== 'ImportDeclaration').map(node => {
    const declaration = node.type === 'ExportNamedDeclaration' ? node.declaration : node;
    return source.slice(...declaration.range);
  }).join('\n');
  const listeners = new Map();
  const frames = new Map();
  let nextFrame = 0;
  const stats = { renders: 0, disposed: 0, failRender: false };
  const canvas = { clientWidth: 96, clientHeight: 96,
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: name => listeners.delete(name),
  };
  class Renderer {
    setPixelRatio() {} setClearColor() {} setSize() {}
    render() { if (stats.failRender) throw new Error('GPU unavailable'); stats.renders += 1; }
    dispose() { stats.disposed += 1; }
  }
  const THREE = {
    MathUtils: { degToRad: degrees => degrees * Math.PI / 180 },
    Clock: class { getElapsedTime() { return 0; } },
    Scene: class { add() {} },
    PerspectiveCamera: class { position = { set() {} }; lookAt() {} updateProjectionMatrix() {} },
    WebGLRenderer: Renderer,
    TextureLoader: class { load(url, success, progress, failure) { if (textureFailure) throw new Error('Texture request failed'); failure(); } },
    Color: class { setRGB() {} },
    MeshBasicMaterial: class { dispose() {} },
    SphereGeometry: class { dispose() {} },
    Mesh: class { constructor(geometry, material) { this.geometry = geometry; this.material = material; this.rotation = {}; } },
    Group: class { position = {}; rotation = {}; add() {} },
  };
  const mount = new Function('THREE', 'window', 'requestAnimationFrame', 'cancelAnimationFrame', `${code}; return mountHeaderWeatherSunScene;`)(
    THREE, { devicePixelRatio: 3 }, callback => { frames.set(++nextFrame, callback); return nextFrame; }, id => frames.delete(id)
  );
  return { mount, canvas, listeners, frames, stats };
}

test('solar context loss shows recovery, resumes rendering after restoration and releases listeners on disposal', async () => {
  const h = await solarRecoveryHarness();
  const states = [];
  const scene = await h.mount(h.canvas, { sunTextureUrl: '/solar.jpg', onStateChange: state => states.push(state) });
  assert.deepEqual(states, ['ready']);
  assert.equal(h.frames.size, 1);
  let prevented = false;
  h.listeners.get('webglcontextlost')({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true, 'context restoration remains permitted');
  assert.equal(h.frames.size, 0, 'no invalid GPU frames while the context is lost');
  assert.deepEqual(states, ['ready', 'lost']);
  h.listeners.get('webglcontextrestored')();
  assert.deepEqual(states, ['ready', 'lost', 'ready']);
  assert.equal(h.stats.renders, 2);
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
  const solarImage = matchingRules(root, selector => selector === ".weather-orb-overlay.is-sun.is-header-sun:not([data-sun-scene='ready']) .weather-orb-overlay__image");
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
  const image = {};
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
  online.get('online')();
  assert.equal(retries, 1, 'network restoration must not wait for the minute clock or the retry throttle');
  document.hidden = true;
  visibility.get('visibilitychange')();
  assert.equal(retries, 1, 'hidden pages do not allocate another GPU context');
  stop(overlay);
  assert.equal(online.size, 0);
  assert.equal(visibility.size, 0);
});
