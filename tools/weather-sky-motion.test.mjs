import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'espree';
import * as astronomy from '../assets/js/weather-solar-time.js';
import { withSkyPresentation, skyLane, solarMoonContrast, avoidSkyControl, applySkyPosition, skyOpticalCenter } from '../assets/js/header-weather-sky-motion.js';

const coordinates = { latitude: 51.23, longitude: 6.78 };
const presentation = day => ({ phase: day ? 'day' : 'night', starOpacity: day ? 0 : 1,
  sun: { opacity: day ? 1 : 0 }, moon: { opacity: day ? 0 : 1 } });

test('daytime Moon follows its own horizon and a below-horizon Moon remains an explicit boundary indicator', () => {
  const day = withSkyPresentation(presentation(true), { ...coordinates, timeMs: Date.parse('2026-11-06T11:00:00Z') }, astronomy);
  assert.equal(day.sun.active, true);
  assert.equal(day.moon.active, true);
  assert.ok(day.moon.opacity > 0 && day.moon.opacity < day.sun.opacity);
  const night = withSkyPresentation(presentation(false), { ...coordinates, timeMs: Date.parse('2026-11-06T18:00:00Z') }, astronomy);
  assert.equal(night.sun.active, false); assert.equal(night.moon.active, true);
  assert.equal(night.moon.isBoundaryIndicator, true);
  assert.equal(night.moon.sky.visible, false, 'the Moon has not risen in the real sky');
  assert.equal(night.moon.sky.horizonOpacity, 0);
  assert.equal(night.moon.opacity, .72);
  assert.equal(night.starOpacity, 1);
});

test('Moon contrast follows gradual solar elevation rather than the legacy solar crossfade', () => {
  const at = (elevationDeg, legacyMoonOpacity) => withSkyPresentation({ ...presentation(false), moon: { opacity: legacyMoonOpacity } },
    { ...coordinates, timeMs: Date.parse('2026-11-07T06:23:00Z') }, { ...astronomy,
      solarPosition: () => ({ elevationDeg, azimuthDeg: 115 }),
      moonPosition: () => ({ elevationDeg: 15, azimuthDeg: 130 }),
    }).moon.opacity;
  assert.equal(at(-6, 0), 1, 'a risen Moon keeps full contrast in a dark sky even after the old phase crossfade ends');
  assert.ok(Math.abs(at(12, 1) - .18) < 1e-12, 'the existing daylight floor remains unchanged');
  let previous = 1;
  for (let step = 0; step <= 2400; step++) {
    const elevation = -8 + step * .01, value = at(elevation, 0);
    assert.equal(value, at(elevation, 1), 'solar phase weights must not determine lunar departure');
    assert.ok(value >= .18 - 1e-12 && value <= 1);
    assert.ok(value <= previous + 1e-12 && Math.abs(value - previous) < .001, 'sky contrast changes continuously');
    previous = value;
  }
});

test('the waning Moon keeps rising through the photographed dawn and leaves on its own afternoon horizon', () => {
  const morning = ['2026-11-07T06:23:00Z', '2026-11-07T07:07:00Z'].map(value => {
    const timeMs = Date.parse(value), day = astronomy.calculateSolarDay('2026-11-07', 'Europe/Berlin', coordinates.latitude, coordinates.longitude);
    const phase = astronomy.solarPhase(timeMs, day, coordinates.latitude, coordinates.longitude);
    const base = astronomy.solarPresentation(phase, { today: day }, timeMs, () => ({}), 458, 24);
    return withSkyPresentation(base, { ...coordinates, timeMs }, astronomy);
  });
  assert.ok(morning[1].moon.sky.up > morning[0].moon.sky.up, 'the Moon really rises while this Sun rises');
  assert.ok(morning[0].moon.opacity > .8 && morning[1].moon.opacity > .5, 'dawn must not prematurely erase the rising Moon');
  const afternoon = withSkyPresentation(presentation(true), { ...coordinates, timeMs: Date.parse('2026-11-07T15:00:00Z') }, astronomy);
  assert.equal(afternoon.sun.active, true);
  assert.equal(afternoon.moon.isBoundaryIndicator, true, 'its own horizon changes the Moon to a labelled rim marker before sunset');
  assert.equal(afternoon.moon.active, true);
});

test('lunar display crosses its own horizon continuously, preserving real altitude and keeping the Sun hidden at night', () => {
  for (const solarElevation of [-20, 25]) {
    let previous;
    for (let i = -200; i <= 200; i++) {
      const elevationDeg = i / 100;
      const clock = { ...astronomy, solarPosition: () => ({ elevationDeg: solarElevation, azimuthDeg: 20 }),
        moonPosition: () => ({ elevationDeg, azimuthDeg: 300 }) };
      const p = withSkyPresentation(presentation(solarElevation > 0), { ...coordinates, timeMs: 1 }, clock);
      assert.equal(p.moon.active, true);
      assert.equal(p.moon.isBoundaryIndicator, elevationDeg < 0);
      assert.equal(p.moon.sky.elevationDeg, elevationDeg);
      assert.equal(p.sun.active, solarElevation > 0);
      if (previous) {
        assert.ok(Math.abs(previous.opacity - p.moon.opacity) < .006);
        assert.ok(Math.hypot(previous.sky.x - p.moon.sky.x, previous.sky.y - p.moon.sky.y) < .001);
      }
      previous = p.moon;
    }
  }
});

test('forecast positions use the selected appearance timestamp and invalid coordinates hide both bodies', () => {
  const sampled = [], forecast = Date.parse('2026-11-09T11:00:00Z');
  const clock = { ...astronomy, solarPosition(time, ...args) { sampled.push(time); return astronomy.solarPosition(time, ...args); },
    moonPosition(time, ...args) { sampled.push(time); return astronomy.moonPosition(time, ...args); } };
  withSkyPresentation(presentation(true), { ...coordinates, timeMs: 123, appearanceTimeMs: forecast }, clock);
  assert.deepEqual(sampled, [forecast, forecast]);
  const hidden = withSkyPresentation(presentation(false), { latitude: NaN, longitude: 300, timeMs: forecast }, astronomy);
  assert.equal(hidden.sun.active, false); assert.equal(hidden.moon.active, false);
});

test('yesterday\'s long daylight cannot blank the next morning or flash bodies at the old cache boundary', () => {
  const yesterday = { ...astronomy.calculateSolarDay('2026-06-21', 'Europe/Berlin', coordinates.latitude, coordinates.longitude), source: 'api' };
  const oldBoundary = yesterday.sunset + 12 * 3600000;
  const samples = [oldBoundary - 1, oldBoundary + 1].map(timeMs => {
    const phase = astronomy.solarPhase(timeMs, yesterday, coordinates.latitude, coordinates.longitude);
    const base = astronomy.solarPresentation(phase, { today: yesterday }, timeMs, () => ({}), 458, 24);
    return withSkyPresentation(base, { ...coordinates, timeMs }, astronomy);
  });
  assert.ok(samples.every(sample => sample.sun.active && sample.sun.opacity > .99 && sample.starOpacity === 0));
  for (const kind of ['sun', 'moon']) {
    assert.ok(Math.abs(samples[0][kind].opacity - samples[1][kind].opacity) < 1e-6);
    assert.ok(Math.abs(samples[0][kind].sky.x - samples[1][kind].sky.x) < 1e-6);
  }
});

test('the compact sky lane reserves physical disc margins around weather readings', () => {
  const region = { left: 12, right: 363, top: 54, bottom: 132 };
  for (const radius of [16.8, 27.4]) {
    const lane = skyLane(region, { right: 166.5 }, { left: 287 }, radius);
    assert.ok(lane.left - radius >= 171.5);
    assert.ok(lane.right + radius <= 282);
    assert.ok(lane.right > lane.left);
    assert.ok(lane.bottom >= lane.top);
    assert.ok(lane.top - radius >= region.top);
    assert.ok(lane.bottom + radius <= region.bottom);
  }
  const collapsed = skyLane(region, { right: 270 }, { left: 280 }, 27.4);
  assert.equal(collapsed.left, collapsed.right);
  assert.ok(Number.isFinite(collapsed.left));
});

test('a compressed lane fades a nearby daytime Moon without displacing its astronomical coordinates', () => {
  assert.equal(solarMoonContrast(10, 17, 27, 1), 0);
  assert.equal(solarMoonContrast(10, 17, 27, 0), 1);
  assert.equal(solarMoonContrast(10, 17, 27, .4), .6);
  assert.equal(solarMoonContrast(100, 17, 27, 1), 1);
  const samples = Array.from({ length: 100 }, (_, index) => solarMoonContrast(index, 17, 27, 1));
  assert.ok(samples.every((value, index) => !index || value >= samples[index - 1]));
  assert.ok(samples.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
});

test('the projected disc clears the menu text with a continuous horizontal falloff', () => {
  const control = { left: 149, right: 225, top: 113, bottom: 127, width: 76, height: 14 };
  const near = avoidSkyControl(198, 105, 17, control);
  assert.equal(near.x, 198); assert.ok(near.y + 17 <= control.top - 3);
  const far = avoidSkyControl(290, 105, 17, control);
  assert.deepEqual(far, { x: 290, y: 105 });
  const samples = Array.from({ length: 800 }, (_, index) => avoidSkyControl(220 + index / 10, 105, 17, control));
  assert.ok(samples.slice(1).every((point, index) => Math.abs(point.y - samples[index].y) < .2));
  const tallIcon = { ...control, top: 95 };
  assert.ok(avoidSkyControl(200, 100, 27, tallIcon, 79).y >= 79, 'clearance cannot push a Moon disc into the header controls above the sky band');
});

function motionHarness() {
  let now = 1000;
  const writes = [], styles = new Map(), root = { children: [], append(node) { this.children.push(node); node.parentNode = this; } };
  const style = { setProperty(name, value) { styles.set(name, value); writes.push([name, value]); }, getPropertyValue(name) { return styles.get(name) || ''; } };
  const region = { classList: { contains: () => true }, ownerDocument: null,
    getBoundingClientRect: () => ({ left: 12, top: 54, right: 363, bottom: 132, width: 351, height: 78 }),
    querySelector: selector => selector === '.weather-header-card__title-block' ? { getBoundingClientRect: () => ({ right: 166.5 }) } : null,
    querySelectorAll: () => [], };
  const window = { performance: { now: () => now }, getComputedStyle: () => ({ translate: `${styles.get('--orb-sky-x') || '0px'} ${styles.get('--orb-sky-y') || '0px'}`, getPropertyValue: name => styles.get(name) || '' }),
    requestAnimationFrame() { throw new Error('Sky positions must reuse the existing clock, not add frames.'); },
    setInterval() { throw new Error('Sky positions must not create a clock or request data.'); } };
  const document = { defaultView: window, createElement: () => ({}) };
  region.ownerDocument = document;
  const children = [], attributes = new Map();
  const regionQuery = region.querySelector;
  region.append = node => children.push(node);
  region.querySelector = selector => children.find(node => `.${node.className}` === selector) || regionQuery(selector);
  const overlay = { dataset: { orbRole: 'sun' }, style, ownerDocument: document, closest: () => region, getRootNode: () => root,
    setAttribute: (name, value) => attributes.set(name, value), append: node => children.push(node),
    querySelector: selector => children.find(node => `.${node.className}` === selector) || null,
    getBoundingClientRect: () => ({ left: 220 + parseFloat(styles.get('--orb-sky-x') || 0), top: 50 + parseFloat(styles.get('--orb-sky-y') || 0), width: 68, height: 68 }) };
  return { overlay, region, writes, styles, root, children, attributes, advance: value => { now += value; } };
}

test('continuous CSS positions retain the same base anchor and reuse the existing clock', () => {
  const h = motionHarness();
  const east = { sky: { x: 0, y: 1 } }, west = { sky: { x: 1, y: 1 } };
  applySkyPosition(h.overlay, east);
  const firstX = parseFloat(h.styles.get('--orb-sky-x'));
  const opticalGetter = h.overlay.__getWeatherSkyOpticalCenter;
  assert.equal(h.styles.get('--orb-sky-duration'), '0s');
  h.advance(1000); applySkyPosition(h.overlay, west);
  const lastX = parseFloat(h.styles.get('--orb-sky-x'));
  assert.ok(lastX > firstX + 50, 'east to west traverses the safe lane rather than rotating in place');
  assert.equal(h.styles.get('--orb-sky-duration'), '1s');
  assert.equal(h.overlay.__getWeatherSkyOpticalCenter, opticalGetter, 'clock ticks reuse the same optical getter');
  const readBounds = h.overlay.getBoundingClientRect;
  const lastBounds = readBounds();
  h.overlay.getBoundingClientRect = () => ({ ...lastBounds, left: lastBounds.left - (lastX - firstX) / 2 });
  assert.ok(Math.abs(opticalGetter().x - .5) < .0001, 'optics follow the rendered halfway Sun during its CSS transition, not the new target');
  h.overlay.getBoundingClientRect = readBounds;
  h.advance(1000); applySkyPosition(h.overlay, west);
  assert.equal(parseFloat(h.styles.get('--orb-sky-x')), lastX, 'repeated samples must not accumulate the CSS translation');
  assert.equal(h.root.children.length, 1);
  assert.match(h.root.children[0].textContent, /prefers-reduced-motion:reduce/u);
  h.advance(60000); applySkyPosition(h.overlay, east);
  assert.equal(h.styles.get('--orb-sky-duration'), '0s', 'resume snaps to the actual sky rather than replaying hidden time');
});

test('both physical discs use full scene edges and keep their radius without text-column or toggle displacement',()=>{
  for(const variant of ['preview','dropdown'])for(const [kind,width,factor]of [['sun',68,.247],['moon',106,.255]]){
    const h=motionHarness(),bounds=variant==='preview'?{left:12,top:54,right:363,bottom:132,width:351,height:78}:{left:0,top:0,right:520,bottom:220,width:520,height:220};
    h.region.getBoundingClientRect=()=>bounds;
    h.region.querySelector=selector=>{if(selector==='[data-orb-role="moon"]')return null;throw Error('Text and controls cannot narrow the physical sky projection.');};
    h.overlay.dataset.orbRole=kind;
    h.overlay.classList={contains:()=>variant==='dropdown'};
    h.overlay.getBoundingClientRect=()=>({left:220+parseFloat(h.styles.get('--orb-sky-x')||0),top:50+parseFloat(h.styles.get('--orb-sky-y')||0),width,height:width});
    const radius=width*factor;
    for(const x of [0,1])for(const y of [0,1]){
      applySkyPosition(h.overlay,{active:true,opacity:1,sky:{x,y}});
      const rect=h.overlay.getBoundingClientRect(),cx=rect.left+width/2,cy=rect.top+width/2;
      assert.ok(Math.abs(cx-(x?bounds.right-radius-5:bounds.left+radius+5))<.001);
      assert.ok(Math.abs(cy-(y?bounds.bottom-radius-4:bounds.top+radius+4))<.001);
      assert.ok(cx-radius>=bounds.left&&cx+radius<=bounds.right);
      assert.ok(cy-radius>=bounds.top&&cy+radius<=bounds.bottom);
       const optical = skyOpticalCenter(h.overlay);
       assert.equal(optical.space, 'logical');
        assert.ok(Math.abs(optical.x - (1 - x)) < .0001);
       assert.ok(Math.abs(optical.y - y) < .0001, 'both layouts use the same sky axis, independent of local panel height');
    }
  }
});

test('both Moon views keep localized accessibility and boundary state without visible captions or position changes', () => {
  for (const variant of ['preview', 'dropdown']) {
    const h = motionHarness(); h.overlay.dataset.orbRole = 'moon';
    h.region.classList.contains = name => variant === 'preview' && name === 'weather-header-preview';
    const below = { active: true, opacity: .72, isBoundaryIndicator: true, sky: { x: 1, y: .5 } };
    let position;
    for (const [lang, name, caption] of [['ru', 'Луна', 'Под горизонтом'], ['uk', 'Місяць', 'Під горизонтом'], ['de', 'Mond', 'Unter dem Horizont'], ['en', 'Moon', 'Below horizon']]) {
      applySkyPosition(h.overlay, below, null, lang);
      assert.equal(h.overlay.dataset.orbBelowHorizon, 'true');
      assert.equal(h.children.length, 0, 'a visible caption must never be created');
      assert.equal(h.attributes.get('role'), 'img');
      assert.equal(h.attributes.get('aria-label'), `${name} — ${caption}`);
      assert.equal(h.styles.get('--orb-moon-sun-contrast'), '1', 'the boundary portrait remains visible under solar glare');
      const actual = { rect: h.overlay.getBoundingClientRect(), optical: skyOpticalCenter(h.overlay) };
      if (position) assert.deepEqual(actual, position, 'localization cannot displace the physical portrait or optical axis');
      else position = actual;
      assert.equal(below.active, true); assert.equal(below.opacity, .72);
      h.advance(1000);
    }
    assert.doesNotMatch(h.root.children[0].textContent, /weather-orb-horizon-label|--orb-label-/u);
    applySkyPosition(h.overlay, { active: true, sky: { x: .9, y: .4 } }, null, 'ru');
    assert.equal(h.overlay.dataset.orbBelowHorizon, 'false'); assert.equal(h.children.length, 0);
    assert.equal(h.attributes.get('aria-label'), 'Луна');
  }
});

test('updating either mounted Moon view removes a stale caption without recreating it', () => {
  for (const variant of ['preview', 'dropdown']) {
    const h = motionHarness(); h.overlay.dataset.orbRole = 'moon';
    h.region.classList.contains = name => variant === 'preview' && name === 'weather-header-preview';
    const stale = { className: 'weather-orb-horizon-label', remove() { h.children.splice(h.children.indexOf(this), 1); } };
    h.children.push(stale);
    h.region.querySelectorAll = selector => selector === '.weather-orb-horizon-label' ? [...h.children] : [];
    const below = { active: true, isBoundaryIndicator: true, sky: { x: 1, y: .5 } };
    applySkyPosition(h.overlay, below, null, 'ru');
    assert.equal(h.children.length, 0); assert.equal(h.overlay.dataset.orbBelowHorizon, 'true');
    const position = h.overlay.getBoundingClientRect();
    applySkyPosition(h.overlay, below, null, 'ru');
    assert.equal(h.children.length, 0); assert.deepEqual(h.overlay.getBoundingClientRect(), position);
  }
});

test('preview trajectories use the cloud sky above the weather text while popup bounds and disc sizes stay fixed', () => {
  for (const [kind, width, factor] of [['sun', 68, .247], ['moon', 106, .255]]) {
    const h = motionHarness();
    h.overlay.dataset.orbRole = kind;
    h.overlay.getBoundingClientRect = () => ({ left: 220 + parseFloat(h.styles.get('--orb-sky-x') || 0), top: 50 + parseFloat(h.styles.get('--orb-sky-y') || 0), width, height: width });
    const sample = (preview, rise, y) => {
      h.region.classList.contains = name => preview && name === 'weather-header-preview';
      h.styles.set('--header-weather-cloud-rise', rise);
      applySkyPosition(h.overlay, { active: true, opacity: 1, sky: { x: .5, y } });
      const rect = h.overlay.getBoundingClientRect();
      assert.equal(rect.width, width);
      return { x: rect.left + width / 2, y: rect.top + width / 2 };
    };
    const baselineTop = sample(true, '0px', 0), extendedTop = sample(true, '56px', 0);
    assert.ok(Math.abs(extendedTop.y - (baselineTop.y - 56)) < .001);
    assert.equal(extendedTop.x, baselineTop.x);
    const baselineBottom = sample(true, '0px', 1), extendedBottom = sample(true, '56px', 1);
    assert.deepEqual(extendedBottom, baselineBottom, 'the physical horizon stays at the same lower edge');
    assert.ok(Math.abs(extendedTop.y - width * factor - 2) < .001, 'the disc remains inside the same full-header sky as clouds');
    assert.deepEqual(sample(false, '56px', 0), baselineTop, 'popup clouds have no header rise');
    for (const invalid of ['-56px', '', 'invalid', 'Infinity']) assert.deepEqual(sample(true, invalid, 0), baselineTop);
  }
});

test('a remounted widget reinstalls the sky stylesheet after clearing the same ShadowRoot', () => {
  const h = motionHarness(), part = { sky: { x: .5, y: .5 } };
  applySkyPosition(h.overlay, part);
  const old = h.root.children[0];
  h.root.children.length = 0; old.parentNode = null;
  applySkyPosition(h.overlay, part);
  assert.equal(h.root.children.length, 1);
  assert.notEqual(h.root.children[0], old);
});

test('standalone sky demonstrations install their style in the document head', () => {
  const h = motionHarness();
  h.root.nodeType = 9;
  h.root.head = { children: [], append(node) { this.children.push(node); node.parentNode = this; } };
  applySkyPosition(h.overlay, { sky: { x: .5, y: .5 } });
  assert.equal(h.root.children.length, 0); assert.equal(h.root.head.children.length, 1);
});

test('Sun disappearance restores Moon contrast even after its source box becomes hidden', () => {
  const h = motionHarness(), moonStyles = new Map([['--orb-moon-sun-contrast', '0']]);
  const originalQuery = h.region.querySelector;
  h.region.querySelector = selector => selector === '[data-orb-role="moon"]'
    ? { style: { setProperty: (name, value) => moonStyles.set(name, value) } } : originalQuery(selector);
  h.overlay.getBoundingClientRect = () => ({ width: 0, height: 0 });
  applySkyPosition(h.overlay, { active: false, opacity: 0, sky: { x: .5, y: 1 } });
  assert.equal(moonStyles.get('--orb-moon-sun-contrast'), '1');
  assert.deepEqual(h.overlay.__getWeatherSkyOpticalCenter(), { x: .5, y: 1, space: 'logical' },
    'a collapsed initial layout retains its astronomical camera without consulting a hidden canvas');
  applySkyPosition(h.overlay, { sky: { x: NaN, y: 1 } });
  assert.equal(h.overlay.__getWeatherSkyOpticalCenter(), null, 'invalid sky data clears the previous optical target');
});

const shellStack = readFile(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8').then(source => {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script', range: true });
  let declaration;
  const visit = node => {
    if (!node || typeof node !== 'object' || declaration) return;
    if (node.type === 'VariableDeclarator' && node.id?.name === 'applyOrbStack') { declaration = node.init; return; }
    for (const [key, value] of Object.entries(node)) if (key !== 'range') {
      if (Array.isArray(value)) value.forEach(visit); else visit(value);
    }
  };
  visit(ast); assert.ok(declaration);
  return source.slice(...declaration.range);
});

test('a failed optional sky UI module keeps the original astronomical clock available', async () => {
  const source = await readFile(new URL('../assets/js/site-shell.js', import.meta.url), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script', range: true });
  let declaration;
  const visit = node => {
    if (!node || typeof node !== 'object' || declaration) return;
    if (node.type === 'FunctionDeclaration' && node.id?.name === 'loadHeaderWeatherSolarClockModule') { declaration = node; return; }
    for (const [key, value] of Object.entries(node)) if (key !== 'range') {
      if (Array.isArray(value)) value.forEach(visit); else visit(value);
    }
  };
  visit(ast); assert.ok(declaration);
  const calls = [], fallback = { ...astronomy };
  const loadModule = async url => {
    calls.push(new URL(url));
    if (url.includes('header-weather-sky-motion.js')) throw new Error('Temporary optional module failure');
    return fallback;
  };
  const body = source.slice(...declaration.range).replace(/\bimport\s*\(/g, 'loadModule(');
  const load = new Function('loadModule', 'resolveHeaderWeatherSunSceneModuleUrl', `
    let headerWeatherSolarClockModulePromise = null, headerWeatherSolarClockModuleRetry = 0;
    ${body}
    return loadHeaderWeatherSolarClockModule;
  `)(loadModule, () => 'https://preview.example/assets/js/header-weather-sun-scene.js?v=qa-current');
  assert.equal(await load(), fallback);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(url => url.pathname), ['/assets/js/header-weather-sky-motion.js', '/assets/js/weather-solar-time.js']);
  assert.ok(calls.every(url => url.origin === 'https://preview.example' && url.searchParams.get('v') === 'qa-current'));
});

test('the actual shell passes physical sky visibility to both source lifecycles and forwards forecast time', async () => {
  const expression = await shellStack, sources = [], sky = [], times = [];
  const geoState = { ...coordinates, timeMs: Date.parse('2026-11-06T18:00:00Z') };
  const clock = { ...astronomy, withSkyPresentation, applySkyPosition: (overlay, part) => sky.push([overlay.kind, part]),
    solarPosition(time, ...args) { times.push(time); return astronomy.solarPosition(time, ...args); } };
  const bindings = { host: { __weatherSolarClock: clock }, presentation: presentation(false), geoState, orbAtmosphere: {},
    sunAssetConfig: { type: 'header-sun' }, moonAssetConfig: { type: 'video-keyed' },
    resolveHeaderWeatherOrbFixedLayout: () => ({}), applyHeaderWeatherOrbCrossfade: () => {}, applyHeaderWeatherOrbLayout: () => {},
    setHeaderWeatherOrbSource: (overlay, kind) => sources.push([overlay.kind, kind]), applyHeaderWeatherOrbAtmosphere: () => {},
    updateHeaderWeatherSunSceneGeo: () => {}, stopHeaderWeatherSunScene: () => {}, getHeaderWeatherPressureLang: () => 'ru' };
  const apply = new Function(...Object.keys(bindings), `return ${expression};`)(...Object.values(bindings));
  const stack = { sun: { kind: 'sun' }, moon: { kind: 'moon' } };
  apply(stack, true);
  assert.deepEqual(sources, [['moon', 'moon'], ['sun', null]]);
  assert.equal(sky[0][1].isBoundaryIndicator, true);
  assert.equal(sky[1][1].active, false);
  const selectedTime = Date.parse('2026-11-09T11:00:00Z');
  apply(stack, true, 'dropdown', {}, { presentation: presentation(true), geoState: { ...geoState, appearanceTimeMs: selectedTime } });
  assert.equal(times.at(-1), selectedTime);
});
