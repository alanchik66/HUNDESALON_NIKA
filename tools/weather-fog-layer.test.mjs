import test from 'node:test';
import assert from 'node:assert/strict';
import { applySkyFog, resolveFogLight } from '../assets/js/header-weather-fog-layer.js';

const fog = visibilityKm => ({ mode: 'fog', visibilityKm });
const sky = (elevationDeg, x = .5, y = .5) => ({ valid: true, elevationDeg, x, y, horizonOpacity: elevationDeg > 0 ? 1 : 0 });

test('fog visibility has bounded monotonic strength, without deriving it from clouds or humidity', () => {
  const models = [.01, .05, .1, .25, .5, 1, 2, 5, 10, 12, 100, 1e6].map(visibility => resolveFogLight(fog(visibility), sky(25)));
  for (const [index, model] of models.entries()) {
    assert.ok(model.strength >= .2 && model.strength <= 1);
    assert.ok(model.baseOpacity >= .24 && model.baseOpacity <= .8);
    assert.ok(model.directTransmission > 0 && model.directTransmission < .5);
    if (index) {
      assert.ok(model.strength <= models[index - 1].strength);
      assert.ok(model.baseOpacity <= models[index - 1].baseOpacity);
      assert.ok(model.directTransmission >= models[index - 1].directTransmission);
    }
  }
  const dense = models[0], thin = models.at(-1);
  assert.ok(dense.directTransmission * (1 - dense.baseOpacity) < .005, 'dense fog nearly obscures the complete source');
  assert.ok(thin.directTransmission * (1 - thin.baseOpacity) > .2, 'light fog can retain a weak disc');
  const denseFog = resolveFogLight(fog(.18), sky(25)), lightMist = resolveFogLight(fog(1.5), sky(25));
  assert.ok(denseFog.directTransmission * (1 - denseFog.baseOpacity) < .02, '180m fog strongly hides the source');
  assert.ok(lightMist.directTransmission * (1 - lightMist.baseOpacity) > .2, '1.5km mist retains a weak source instead of looking as opaque as dense fog');
  assert.ok(lightMist.directTransmission > denseFog.directTransmission * 5);
  const reference = resolveFogLight(fog(1), sky(25));
  assert.deepEqual(resolveFogLight({ ...fog(1), cloud: 0, humidity: 0 }, sky(25)), reference);
  assert.deepEqual(resolveFogLight({ ...fog(1), cloud: 100, humidity: 100 }, sky(25)), reference);
  assert.equal(resolveFogLight({ mode: 'overcast', visibilityKm: .1 }, sky(25)).active, false);
});

test('unavailable visibility uses an explicit visual default rather than fabricated optical measurements', () => {
  for (const visibilityKm of [null, undefined, '', ' ', false, [], NaN, Infinity, -1, 0, '0']) {
    const model = resolveFogLight(fog(visibilityKm), sky(20));
    assert.equal(model.visibilityKm, null);
    assert.equal(model.strength, .65);
  }
  assert.equal(resolveFogLight(fog('0.25'), sky(20)).visibilityKm, .25);
});

test('solar diffuse light continues through twilight, reaches zero at astronomical night, and changes continuously', () => {
  const night = resolveFogLight(fog(.3), sky(-18));
  const deepNight = resolveFogLight(fog(.3), sky(-35));
  const twilight = resolveFogLight(fog(.3), sky(-6));
  const day = resolveFogLight(fog(.3), sky(20));
  assert.equal(night.solarHalo, 0); assert.equal(deepNight.solarHalo, 0);
  assert.deepEqual(night.color, deepNight.color);
  assert.ok(twilight.solarHalo > 0, 'scattered sunlight can remain with the solar disc below the horizon');
  assert.ok(twilight.solarHalo < day.solarHalo);
  assert.ok(night.color.every((value, index) => value < day.color[index]));
  assert.ok(day.color.every(value => value <= 110), 'day fog is tone-mapped for the dark UI, instead of a pale sheet');
  assert.ok(day.solarHalo <= .17, 'diffuse daylight remains restrained beneath weather text');
  for (const elevation of [-18, -6, 0, 8]) {
    const a = resolveFogLight(fog(1), sky(elevation - 1e-4));
    const b = resolveFogLight(fog(1), sky(elevation + 1e-4));
    assert.ok(Math.abs(a.solarHalo - b.solarHalo) < 1e-4);
  }
  assert.equal(resolveFogLight(fog(1), {}).solarHalo, 0, 'missing astronomy cannot invent solar lighting');
});

function fixture() {
  let time = 0, reduced = false;
  const document = { defaultView: { performance: { now: () => time }, matchMedia: () => ({ matches: reduced }), getComputedStyle: node => ({ getPropertyValue: name => node.computed?.[name] || '' }) } };
  class Node {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.ownerDocument = document; this.children = []; this.attrs = new Map();
      this.values = new Map(); this.style = { setProperty: (name, value, priority) => this.values.set(name, { value, priority }), getPropertyValue: name => this.values.get(name)?.value || '' };
      this.dataset = {}; this.classes = new Set(); this.classList = { contains: name => this.classes.has(name) };
      this.bounds = { left: 10, top: 80, width: 360, height: 90 }; this.isConnected = true;
    }
    setAttribute(name, value) { this.attrs.set(name, value); }
    appendChild(node) { node.remove(); this.children.push(node); node.parentNode = this; return node; }
    remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; }
    getRootNode() { return this.parentNode?.getRootNode() || this; }
    getBoundingClientRect() { return this.bounds; }
    closest() { return this.region || null; }
    querySelector(selector) {
      const attr = selector.match(/\[([^=\]]+)(?:="([^"]+)")?\]/);
      return this.children.flatMap(child => [child, ...child.descendants()]).find(child => (!selector.startsWith('style') || child.tagName === 'STYLE') && attr && child.attrs.has(attr[1]) && (attr[2] === undefined || child.attrs.get(attr[1]) === attr[2])) || null;
    }
    descendants() { return this.children.flatMap(child => [child, ...child.descendants()]); }
  }
  document.createElement = tag => new Node(tag);
  const root = new Node('shadow-root'), region = new Node(), overlay = new Node();
  region.classes.add('weather-header-preview'); root.appendChild(region); region.appendChild(overlay);
  overlay.region = region; overlay.dataset.orbRole = 'sun'; overlay.bounds = { left: 100, top: 90, width: 68, height: 68 };
  overlay.computed = { '--header-weather-cloud-rise': '36px' };
  return { root, region, overlay, Node, advance: amount => { time += amount; }, reduce: () => { reduced = true; }, layer: () => region.querySelector('[data-weather-layer="fog"]') };
}

test('both panels share one full-sky layer below text and above clouds, including the preview rise', () => {
  for (const preview of [true, false]) {
    const f = fixture(); if (!preview) { f.region.classes.clear(); f.region.classes.add('weather-header-dropdown__hero'); }
    const part = { active: true, sky: sky(20, 0, 1) };
    applySkyFog(f.overlay, part, fog(.5)); const layer = f.layer();
    assert.ok(layer); assert.equal(layer.parentNode, f.region); assert.equal(layer.attrs.get('aria-hidden'), 'true');
    assert.equal(layer.values.get('top').value, preview ? '-36px' : '0px');
    assert.equal(layer.values.get('height').value, preview ? '126px' : '90px');
    applySkyFog(f.overlay, { ...part, sky: sky(21, 1, 0) }, fog(2));
    assert.equal(f.layer(), layer, 'sky/weather updates reuse the same owned node');
    assert.equal(f.root.children.filter(node => node.tagName === 'STYLE').length, 1);
    const css = f.root.querySelector('style[data-weather-fog-styles]').textContent;
    assert.match(css, /z-index:13!important/); assert.match(css, /prefers-reduced-motion:reduce/);
    assert.match(css, /pointer-events:none!important/);
    assert.match(css, /mask-composite:intersect/); assert.match(css, /-webkit-mask-composite:source-in/);
    assert.match(css, /:host\(\[data-weather-variant='header'\]\) \.weather-header-preview \[data-weather-layer="fog"\],\s*\[data-weather-layer="fog"\]\s*\{/,
      'the veil overrides the existing universal header anti-clip selector');
    assert.match(css, /-webkit-mask-image:[^;]+!important;/);
    assert.match(css, /\n\s*mask-image:[^;]+!important;/);
    assert.match(css, /linear-gradient\(90deg,transparent,#000 9%,#000 91%,transparent\)/);
    assert.match(css, /linear-gradient\(180deg,transparent,#000 12%,#000 88%,transparent\)/);
    assert.equal(layer.children.length, 2);
    assert.ok(layer.children[0].style.opacity > 0);
    assert.match(layer.children[1].style.transform, /^translate\([-\d.]+px,[-\d.]+px\)$/);
    assert.ok(Number(f.overlay.style.getPropertyValue('--orb-sun-transmission')) < 1, 'overflow rays are attenuated at either chart edge');
  }
});

test('night keeps fog but removes solar halo even when the Sun clock part is inactive', () => {
  const f = fixture();
  applySkyFog(f.overlay, { active: false, opacity: 0, sky: sky(-30) }, fog(.1));
  assert.ok(f.layer()); assert.equal(f.layer().children[1].style.opacity, '0');
  assert.equal(f.layer().children[0].style.backgroundColor, 'rgb(12,20,27)');
});

test('clear/remount, missing style, owner replacement and disconnection clean up without retaining stale fog', () => {
  const f = fixture(), part = { sky: sky(20) };
  applySkyFog(f.overlay, part, fog(1)); const first = f.layer();
  f.root.querySelector('style[data-weather-fog-styles]').remove();
  applySkyFog(f.overlay, part, fog(1));
  assert.ok(f.root.querySelector('style[data-weather-fog-styles]'), 'removed stylesheet can be reinstalled');
  applySkyFog(f.overlay, part, { mode: 'clear' });
  assert.equal(f.layer(), first); assert.equal(first.style.opacity, '0');
  assert.equal(f.overlay.style.getPropertyValue('--orb-sun-transmission'), '1');
  f.advance(1300); applySkyFog(f.overlay, part, { mode: 'clear' }); assert.equal(f.layer(), null);
  applySkyFog(f.overlay, part, fog(1)); assert.notEqual(f.layer(), first);
  const replacement = new f.Node(); replacement.dataset.orbRole = 'sun'; replacement.region = f.region; replacement.bounds = f.overlay.bounds;
  f.region.appendChild(replacement); applySkyFog(replacement, part, fog(.1)); const current = f.layer();
  f.overlay.isConnected = false; applySkyFog(f.overlay, part, fog(.1));
  assert.equal(f.layer(), current, 'a detached previous Sun cannot delete its replacement layer');
  replacement.isConnected = false; applySkyFog(replacement, part, fog(.1));
  assert.equal(f.layer(), null); assert.equal(replacement.style.getPropertyValue('--orb-sun-transmission'), '1');
});

test('moving a Sun between panel owners removes its previous layer; a Moon call cannot overwrite the Sun layer', () => {
  const f = fixture(), part = { sky: sky(20) };
  applySkyFog(f.overlay, part, fog(1)); const old = f.layer();
  const destination = new f.Node(); f.root.appendChild(destination); destination.appendChild(f.overlay); f.overlay.region = destination;
  applySkyFog(f.overlay, part, fog(2));
  assert.equal(old.parentNode, null); const layer = destination.querySelector('[data-weather-layer="fog"]'); assert.ok(layer);
  const moon = new f.Node(); moon.dataset.orbRole = 'moon'; moon.region = destination;
  assert.equal(applySkyFog(moon, part, { mode: 'clear' }), null);
  assert.equal(destination.querySelector('[data-weather-layer="fog"]'), layer);
});

test('uniformly scaled header ancestors preserve fog height and halo position in CSS pixels', () => {
  const regular = fixture(), scaled = fixture(), part = { sky: sky(20, .2, .8) };
  regular.region.clientWidth = scaled.region.clientWidth = 360;
  regular.region.clientHeight = scaled.region.clientHeight = 90;
  scaled.region.bounds = { ...scaled.region.bounds, width: 720, height: 180 };
  scaled.overlay.bounds = { ...scaled.overlay.bounds, width: 136, height: 136 };
  applySkyFog(regular.overlay, part, fog(.5)); applySkyFog(scaled.overlay, part, fog(.5));
  const a = regular.layer(), b = scaled.layer();
  assert.equal(b.style.getPropertyValue('height'), '126px');
  assert.equal(b.style.getPropertyValue('top'), '-36px');
  assert.equal(b.children[1].style.width, a.children[1].style.width);
  assert.equal(b.children[1].style.height, a.children[1].style.height);
  assert.equal(b.children[1].style.transform, a.children[1].style.transform);
});

test('clear fades before clock-driven removal, fog reentry cancels removal, and reduced motion removes immediately', () => {
  const f = fixture(), part = { sky: sky(20) };
  applySkyFog(f.overlay, part, fog(1)); const layer = f.layer();
  applySkyFog(f.overlay, part, { mode: 'clear' });
  assert.equal(f.layer(), layer); assert.equal(layer.style.opacity, '0');
  f.advance(1000); applySkyFog(f.overlay, part, { mode: 'clear' }); assert.equal(f.layer(), layer);
  applySkyFog(f.overlay, part, fog(.5)); assert.equal(f.layer(), layer); assert.equal(layer.style.opacity, '1');
  f.advance(2000); applySkyFog(f.overlay, part, fog(.5)); assert.equal(f.layer(), layer, 'reentry cancels the old exit timestamp');
  applySkyFog(f.overlay, part, { mode: 'clear' }); f.advance(1299);
  applySkyFog(f.overlay, part, { mode: 'clear' }); assert.equal(f.layer(), layer);
  f.advance(1); applySkyFog(f.overlay, part, { mode: 'clear' }); assert.equal(f.layer(), null);
  applySkyFog(f.overlay, part, fog(1)); f.reduce(); applySkyFog(f.overlay, part, { mode: 'clear' });
  assert.equal(f.layer(), null); assert.equal(f.overlay.style.getPropertyValue('--orb-sun-transmission'), '1');
});
