import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../assets/js/paw-loader-scene.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise(finish => { resolve = finish; });
  return { promise, resolve };
}

function harness({ width = 1440, height = 900, reduced = false, animationsSupported = true, randomSeed = 39 } = {}) {
  let clock = 0, nextId = 0, seed = randomSeed, geometryReads = 0;
  const timers = new Map(), animations = [], images = [], documentListeners = new Map(), windowListeners = new Map();
  const decoded = deferred();
  let ownerDocument;
  class Element {
    constructor() {
      this.children = []; this.dataset = {}; this.attributes = new Map(); this.properties = new Map();
      this.ownerDocument = ownerDocument; this.isConnected = true; this.className = '';
      this.createdAt = clock;
      this.style = { setProperty: (name, value) => this.properties.set(name, value) };
      this.classList = {
        add: name => { this.className = [...new Set([...this.className.split(' ').filter(Boolean), name])].join(' '); },
        remove: name => { this.className = this.className.split(' ').filter(value => value !== name).join(' '); },
        contains: name => this.className.split(' ').includes(name),
      };
    }
    setAttribute(name, value) { this.attributes.set(name, value); }
    getBoundingClientRect() { geometryReads++; return { width, height }; }
    appendChild(node) { this.children.push(node); node.parentElement = this; node.isConnected = true; }
    remove() {
      const list = this.parentElement?.children, index = list?.indexOf(this);
      if (index >= 0) list.splice(index, 1);
      this.isConnected = false;
    }
    animate(frames, options) {
      if (!animationsSupported) throw new Error('Web Animations unavailable');
      let resolve, reject, startedAt = clock, elapsed = 0;
      const animation = {
        node: this, frames, options, state: 'running', createdAt: clock,
        finished: new Promise((finish, cancel) => { resolve = finish; reject = cancel; }),
        get currentTime() { return this.state === 'paused' ? elapsed : clock - startedAt; },
        cancel() { this.state = 'cancelled'; reject(new Error('Cancelled')); },
        pause() { elapsed = clock - startedAt; this.state = 'paused'; },
        play() { startedAt = clock - elapsed; this.state = 'running'; },
        finish() { this.state = 'finished'; resolve(); },
      };
      animations.push(animation);
      return animation;
    }
  }
  const view = {
    performance: { now: () => clock }, innerWidth: width, innerHeight: height,
    setTimeout(callback, delay) { const id = ++nextId; timers.set(id, { callback, due: clock + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(type, callback) { windowListeners.set(type, callback); },
    removeEventListener(type) { windowListeners.delete(type); },
    matchMedia: () => ({ matches: reduced }),
    requestAnimationFrame() { throw new Error('No permanent frame loop is allowed'); },
    Image: class {
      constructor() { images.push(this); this.complete = false; this.naturalWidth = 0; this.decodeCalls = 0; }
      decode() { this.decodeCalls++; return decoded.promise; }
    },
  };
  ownerDocument = {
    defaultView: view, hidden: false, baseURI: 'https://preview.example/ru/',
    currentScript: { src: 'https://preview.example/assets/js/paw-loader-scene.js?v=current-build' },
    createElement: () => new Element(),
    addEventListener(type, callback) { documentListeners.set(type, callback); },
    removeEventListener(type) { documentListeners.delete(type); },
  };
  const math = Object.create(Math);
  math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  vm.runInNewContext(source, { window: view, document: ownerDocument, URL, Math: math, Promise });
  const stage = new Element();
  const handle = view.NikaPawScene.mount(stage);
  const groups = () => stage.children.filter(node => node.className === 'paw-loader__animal');
  const paws = () => groups().flatMap(group => group.children);
  return {
    stage, handle, view, ownerDocument, images, animations, timers, groups, paws, documentListeners, windowListeners,
    newStage: () => new Element(),
    loadImage() { images[0].complete = true; images[0].naturalWidth = 1536; images[0].onload(); },
    decode() { decoded.resolve(); },
    time: () => clock,
    geometryReads: () => geometryReads,
    elapse(milliseconds) { clock += milliseconds; },
    nextDue: () => Math.min(...[...timers.values()].map(task => task.due)),
    runNext() {
      const [id, task] = [...timers].sort((a, b) => a[1].due - b[1].due)[0];
      clock = task.due; timers.delete(id); task.callback();
    },
    resize(nextWidth, nextHeight) { width = nextWidth; height = nextHeight; windowListeners.get('resize')(); },
  };
}

const species = {
  dog: { cycle: 1400, wheelbase: 3.4, stride: .55, track: 1.15, mobile: 62 },
  cat: { cycle: 1280, wheelbase: 3.5, stride: .60, track: 1.05, mobile: 49 },
  'guinea-pig': { cycle: 900, wheelbase: 4.8, stride: .55, track: 1.6, mobile: 29 },
};
const footOrder = ['hind-left', 'front-left', 'hind-right', 'front-right'];
const activeGroup = ui => ui.groups().find(group => !group.hidden);
const prints = ui => ui.stage.children.filter(node => node.className === 'paw-loader__print');
const swings = ui => ui.animations.filter(animation => animation.node.className === 'paw-loader__paw');
function coordinates(frame) {
  const match = frame.transform.match(/translate3d\(([-\d.]+)px, ([-\d.]+)px, 0\) rotate(?:Z)?\(([-\d.]+)deg\)/);
  assert.ok(match, 'the foot exposes a world position and heading');
  return match.slice(1).map(Number);
}
function center(paw, frame = { transform: paw.style.transform }) {
  const [x, y, angle] = coordinates(frame);
  return [x + parseFloat(paw.style.width) / 2, y + parseFloat(paw.style.height) / 2, angle];
}
function runUntil(ui, predicate, limit = 4000) {
  for (let index = 0; !predicate(); index++) {
    assert.ok(index < limit && ui.timers.size, 'expected lifecycle state needs bounded work');
    ui.runNext();
  }
}
function contactBoundsAt(ui, paw, time) {
  const animation = ui.animations.filter(item => item.node === paw && item.state !== 'cancelled').at(-1);
  let point = center(paw), progress = Infinity, scaleX = 1, scaleY = 1;
  if (animation) {
    progress = (time - animation.createdAt) / animation.options.duration;
    assert.ok(progress === 0 || progress >= .25 - 1e-9, 'route checks occur at actual quarter-cycle contacts');
    const frame = progress === 0 ? animation.frames[0] : progress < .285
      ? animation.frames.find(item => item.offset === .25) : animation.frames.at(-1);
    point = center(paw, frame);
    const scale = frame.transform.match(/scale\(([-\d.]+)(?:,\s*([-\d.]+))?\)/);
    assert.ok(scale, 'contact bounds use the rendered keyframe scale');
    scaleX = Number(scale[1]); scaleY = Number(scale[2] ?? scale[1]);
  }
  const radians = point[2] * Math.PI / 180;
  const width = parseFloat(paw.style.width), height = parseFloat(paw.style.height);
  const extentX = (Math.abs(Math.cos(radians)) * width * scaleX + Math.abs(Math.sin(radians)) * height * scaleY) / 2;
  const extentY = (Math.abs(Math.sin(radians)) * width * scaleX + Math.abs(Math.cos(radians)) * height * scaleY) / 2;
  return { x: point[0], y: point[1], width, height, progress,
    left: point[0] - extentX, right: point[0] + extentX, top: point[1] - extentY, bottom: point[1] + extentY };
}
const intersects = (bounds, width, height) => bounds.right >= 0 && bounds.left <= width && bounds.bottom >= 0 && bounds.top <= height;
const visibleAt = (ui, paw, time) => intersects(contactBoundsAt(ui, paw, time), 1440, 900);

test('twelve persistent atlas feet belong to three groups, with exactly one visible animal', () => {
  const ui = harness();
  assert.equal(ui.groups().length, 3);
  assert.equal(ui.paws().length, 12);
  assert.equal(ui.groups().filter(group => !group.hidden).length, 1);
  assert.equal(activeGroup(ui).dataset.animal, ui.stage.dataset.activeAnimal);
  assert.equal(ui.stage.attributes.get('aria-hidden'), 'true');
  for (const [row, group] of ui.groups().entries()) {
    assert.equal(group.children.length, 4);
    assert.deepEqual(group.children.map(paw => paw.dataset.foot), ['front-left', 'front-right', 'hind-left', 'hind-right']);
    group.children.forEach((paw, column) => {
      assert.equal(paw.dataset.animal, group.dataset.animal);
      assert.equal(paw.properties.get('--paw-column'), column * 100 / 3 + '%');
      assert.equal(paw.properties.get('--paw-row'), row * 50 + '%');
      const svg = decodeURIComponent(paw.properties.get('--paw-print').slice('url("data:image/svg+xml,'.length, -2));
      const digits = (svg.match(/data-digit=/g) || []).length;
      assert.equal(digits, row === 2 && column >= 2 ? 3 : 4);
      assert.equal((svg.match(/data-claw=/g) || []).length, row === 1 ? 0 : digits);
      assert.match(svg, /data-main-pad/);
    });
    assert.equal(group.style.transform, undefined, 'the unseen body cannot drag planted feet');
  }
  assert.equal(prints(ui).length, 0, 'no fictitious initial contacts');
  assert.equal(ui.timers.size, 1, 'only the active animal has an upcoming step');
  assert.equal(ui.view.NikaPawScene.mount(ui.stage), ui.handle);
  ui.handle.dispose();
});

for (const [animal, spec] of Object.entries(species)) {
  test(animal + ' walks four beats with a short shared stride and a stationary 75% contact', () => {
    const ui = harness();
    runUntil(ui, () => ui.stage.dataset.activeAnimal === animal);
    const group = activeGroup(ui), originalFeet = [...group.children];
    const initial = group.children.map(paw => center(paw)), previous = swings(ui).length;
    ui.runNext();
    const first = swings(ui).at(-1);
    assert.equal(first.node.dataset.animal, animal);
    assert.equal(first.node.dataset.foot, 'hind-left');
    for (const index of [0, 1, 3]) assert.deepEqual(center(group.children[index]), initial[index]);
    runUntil(ui, () => swings(ui).length >= previous + 4);
    const steps = swings(ui).slice(previous, previous + 4);
    assert.deepEqual(steps.map(animation => animation.node.dataset.foot), footOrder);
    assert.deepEqual(steps.map(animation => animation.createdAt - first.createdAt), [0, spec.cycle / 4, spec.cycle / 2, spec.cycle * .75]);
    const size = parseFloat(group.children[0].style.width), wheelbase = size * 8 / 9 * spec.wheelbase;
    const stride = wheelbase * spec.stride;
    let direction;
    for (const animation of steps) {
      assert.equal(animation.options.duration, spec.cycle);
      assert.equal(animation.options.easing, 'linear');
      assert.deepEqual(Array.from(animation.frames, frame => frame.offset), [0, .035, .14, .225, .25, .285, 1]);
      assert.ok(animation.frames.every(frame => frame.opacity === 1), 'paws never dissolve during the step');
      const from = center(animation.node, animation.frames[0]), to = center(animation.node, animation.frames.at(-1));
      const vector = [to[0] - from[0], to[1] - from[1]], length = Math.hypot(...vector);
      assert.ok(Math.abs(length - stride) < .06, 'one cycle advances only the short species stride');
      if (!direction) direction = vector.map(value => value / length);
      assert.ok(Math.abs(vector[0] - direction[0] * stride) < .06);
      assert.ok(Math.abs(vector[1] - direction[1] * stride) < .06);
      assert.match(animation.frames.find(frame => frame.offset === .14).transform, /scale\(\.965\)$/);
      assert.match(animation.frames[1].transform, /rotateX\(-10deg\)/);
      assert.match(animation.frames.find(frame => frame.offset === .25).transform, /scale\(1\.012, \.995\)$/);
      for (const frame of animation.frames.filter(frame => frame.offset >= .25)) {
        assert.deepEqual(coordinates(frame), coordinates(animation.frames.at(-1)), 'translation ends at touchdown');
      }
      assert.equal(animation.frames.find(frame => frame.offset === .285).transform, animation.frames.at(-1).transform);
      if (animation !== steps.at(-1)) {
        assert.ok(ui.animations.some(item => item.node.className === 'paw-loader__print' &&
          item.node.dataset.animal === animal && item.node.dataset.foot === animation.node.dataset.foot &&
          item.createdAt === animation.createdAt + spec.cycle / 4), 'footprints begin at real touchdown');
      }
    }
    const origin = initial[2], lateral = [-direction[1], direction[0]], indices = [1, 3, 0, 2], sides = [-1, 1, -1, 1];
    const project = (point, axis) => (point[0] - origin[0]) * axis[0] + (point[1] - origin[1]) * axis[1];
    group.children.forEach((paw, index) => {
      assert.ok(Math.abs(project(initial[index], direction) - (index < 2 ? wheelbase : 0) - stride * indices[index] / 4) < .08,
        'initial front/hind stations match steady contact phases');
      assert.ok(Math.abs(project(initial[index], lateral) - (sides[index] + 1) * size * spec.track / 2) < .08,
        'left and right feet occupy consistent parallel tracks');
    });
    assert.deepEqual(group.children, originalFeet);
    assert.equal(ui.geometryReads(), 1, 'steps never measure DOM geometry');
    ui.handle.dispose();
  });
}

test('two minutes of routes never mix species or hand off while any paw remains visible', () => {
  const ui = harness(), paws = [...ui.paws()], groups = [...ui.groups()];
  const routes = [ui.stage.dataset.activeAnimal];
  let handoffs = 0;
  for (let index = 0; ui.time() < 120000; index++) {
    assert.ok(index < 4000, 'two minutes need bounded quarter-step tasks');
    const previous = activeGroup(ui), stillVisible = previous.children.some(paw => visibleAt(ui, paw, ui.nextDue()));
    ui.runNext();
    const current = activeGroup(ui);
    assert.equal(ui.groups().filter(group => !group.hidden).length, 1);
    assert.equal(current.dataset.animal, ui.stage.dataset.activeAnimal);
    assert.ok(prints(ui).every(print => print.dataset.animal === current.dataset.animal), 'old species cannot leave mixed prints');
    assert.ok(prints(ui).length <= 24, 'footprints remain bounded');
    if (current !== previous) {
      handoffs++; routes.push(current.dataset.animal);
      assert.equal(stillVisible, false, 'a visible foot must never teleport');
      assert.notEqual(current.dataset.animal, previous.dataset.animal, 'bag boundaries cannot repeat species');
      assert.equal(prints(ui).length, 0, 'handoff clears every previous footprint');
      assert.ok(current.children.some(paw => {
        const [x, y] = center(paw);
        return x < 0 || x > 1440 || y < 0 || y > 900;
      }), 'a subsequent group enters from the edge');
    }
    assert.deepEqual(ui.paws(), paws);
    assert.deepEqual(ui.groups(), groups);
  }
  assert.ok(handoffs >= 6, 'multiple complete bags and boundaries were observed');
  for (let index = 0; index + 3 <= routes.length; index += 3) {
    assert.deepEqual([...new Set(routes.slice(index, index + 3))].sort(), Object.keys(species).sort());
  }
  assert.equal(ui.geometryReads(), 1, 'exit checks never read DOM geometry');
  ui.handle.dispose();
});

test('mobile edge handoff uses real planted rectangles rather than waiting for an invisible circle', t => {
  let edgeCases = 0;
  for (const randomSeed of [39, 11, 53, 97]) {
    const ui = harness({ width: 390, height: 844, randomSeed });
    for (let iteration = 0; ui.time() < 60000; iteration++) {
      assert.ok(iteration < 2000, 'mobile route search remains bounded');
      const previous = activeGroup(ui), checkAt = ui.nextDue();
      const bounds = previous.children.map(paw => contactBoundsAt(ui, paw, checkAt));
      const allPlanted = bounds.every(box => box.progress >= .25);
      const allOutside = bounds.every(box => !intersects(box, 390, 844));
      const oldCircleStillVisible = bounds.some(box => {
        // This foot has more than a quarter-cycle until its next landing, so the
        // former circle would retain the empty route beyond the allowed handoff.
        if (box.progress >= 1 - 1e-9) return false;
        const radius = Math.hypot(box.width, box.height) * .54 + 4;
        return intersects({ left: box.x - radius, right: box.x + radius,
          top: box.y - radius, bottom: box.y + radius }, 390, 844);
      });
      if (allPlanted && allOutside && oldCircleStillVisible) {
        edgeCases++;
        const deadline = checkAt + species[previous.dataset.animal].cycle / 4;
        ui.runNext();
        while (activeGroup(ui) === previous && ui.nextDue() <= deadline) ui.runNext();
        assert.notEqual(activeGroup(ui), previous, 'the next animal enters by the next quarter-cycle, without an empty full stance');
        assert.ok(ui.time() <= deadline);
        assert.equal(ui.geometryReads(), 1, 'edge handoff requires no additional DOM measurement');
        assert.equal(prints(ui).length, 0, 'old edge contacts cannot leave mixed-species prints');
        break;
      }
      ui.runNext();
    }
    ui.handle.dispose();
  }
  assert.ok(edgeCases > 0, 'seeded mobile routes include an exited rectangle whose old circular buffer still touches the viewport');
  t.diagnostic('verified mobile rectangle/circle edge cases: ' + edgeCases);
});

test('the atlas is decoded once and readiness cannot precede decoding', async () => {
  const ui = harness(), secondStage = ui.newStage(), second = ui.view.NikaPawScene.mount(secondStage);
  assert.equal(ui.images.length, 1);
  assert.equal(ui.stage.attributes.has('data-paw-image-ready'), false);
  assert.match(ui.images[0].src, /\/assets\/images\/preloader\/paws-atlas-v1\.webp\?v=current-build$/);
  ui.loadImage();
  await settle();
  assert.equal(ui.images[0].decodeCalls, 1);
  assert.equal(ui.stage.attributes.has('data-paw-image-ready'), false);
  ui.decode();
  assert.equal(await ui.handle.ready, true);
  assert.equal(await second.ready, true);
  assert.equal(ui.stage.attributes.has('data-paw-image-ready'), true);
  assert.equal(secondStage.attributes.has('data-paw-image-ready'), true);
  assert.match(ui.stage.properties.get('--paw-atlas-image'), /paws-atlas-v1\.webp/);
  ui.handle.dispose(); second.dispose();
});

test('stop removes all work and feet and blocks late image, timer and animation revival', async () => {
  const ui = harness();
  ui.runNext();
  const lateCallbacks = [...ui.timers.values()].map(task => task.callback);
  ui.handle.stop(); ui.handle.stop();
  assert.equal(await ui.handle.ready, false);
  assert.equal(ui.timers.size, 0);
  assert.equal(ui.stage.children.length, 0);
  assert.equal(ui.stage.dataset.activeAnimal, undefined);
  assert.ok(ui.animations.every(animation => animation.state === 'cancelled'));
  assert.equal(ui.documentListeners.size + ui.windowListeners.size, 0);
  ui.loadImage(); ui.decode();
  lateCallbacks.forEach(callback => callback());
  ui.animations.forEach(animation => animation.finish());
  await settle();
  assert.equal(ui.stage.attributes.has('data-paw-image-ready'), false);
  assert.equal(ui.stage.children.length, 0);
  assert.equal(ui.timers.size, 0);
  ui.handle.dispose(); ui.handle.dispose();
});

test('hidden tabs resume one animal and one next step while preserving contact and flight time', () => {
  const ui = harness(), paws = [...ui.paws()], animal = ui.stage.dataset.activeAnimal;
  const initial = activeGroup(ui).children.map(paw => paw.style.transform);
  ui.ownerDocument.hidden = true;
  ui.documentListeners.get('visibilitychange')();
  assert.equal(ui.timers.size, 0);
  ui.elapse(3000);
  ui.ownerDocument.hidden = false;
  ui.documentListeners.get('visibilitychange')();
  ui.documentListeners.get('visibilitychange')();
  assert.equal(ui.timers.size, 1, 'resuming cannot start three animal clocks');
  assert.equal(ui.stage.dataset.activeAnimal, animal);
  assert.deepEqual(activeGroup(ui).children.map(paw => paw.style.transform), initial);
  ui.runNext(); ui.elapse(40);
  assert.equal(swings(ui).length, 1);
  ui.ownerDocument.hidden = true;
  ui.documentListeners.get('visibilitychange')();
  const elapsed = swings(ui)[0].currentTime;
  assert.equal(ui.timers.size, 0);
  assert.ok(ui.animations.every(animation => animation.state === 'paused'));
  ui.elapse(20000);
  assert.equal(swings(ui)[0].currentTime, elapsed);
  ui.ownerDocument.hidden = false;
  ui.documentListeners.get('visibilitychange')();
  assert.equal(ui.timers.size, 2, 'only the current landing and next beat resume');
  assert.equal(swings(ui)[0].currentTime, elapsed);
  ui.runNext(); ui.runNext();
  assert.equal(swings(ui).length, 2);
  assert.ok(swings(ui).every(animation => animation.node.dataset.animal === animal));
  assert.deepEqual(ui.paws(), paws);
  ui.windowListeners.get('pagehide')();
  assert.equal(ui.timers.size, 0);
  assert.equal(ui.stage.children.length, 0);
  ui.handle.dispose();
});

test('an unchanged startup resize preserves planted feet and the original landing and next beat', () => {
  const ui = harness(), group = activeGroup(ui), animal = ui.stage.dataset.activeAnimal;
  ui.runNext();
  const first = swings(ui)[0], positions = ui.paws().map(paw => paw.style.transform);
  const pending = [...ui.timers.keys()], lastFoot = group.dataset.lastFoot;
  assert.equal(lastFoot, 'hind-left');
  ui.resize(1440, 900);
  ui.runNext();
  assert.equal(ui.time(), 70);
  assert.equal(ui.stage.dataset.activeAnimal, animal);
  assert.equal(activeGroup(ui), group);
  assert.equal(group.dataset.lastFoot, lastFoot);
  assert.deepEqual(ui.paws().map(paw => paw.style.transform), positions, 'the same-size event cannot replant stance feet');
  assert.equal(swings(ui).length, 1, 'the existing swing continues rather than restarting');
  assert.equal(first.state, 'running');
  assert.deepEqual([...ui.timers.keys()], pending, 'the actual old landing and next-step tasks survive');
  assert.equal(ui.geometryReads(), 2, 'resize may measure the stage once');
  ui.runNext();
  assert.equal(ui.time(), species[animal].cycle / 4, 'touchdown retains its original deadline');
  assert.equal(first.node.style.transform, first.frames.at(-1).transform);
  assert.equal(prints(ui).length, 1);
  assert.equal(prints(ui)[0].dataset.foot, 'hind-left');
  for (const index of [0, 1, 3]) assert.equal(group.children[index].style.transform, positions[ui.paws().indexOf(group.children[index])]);
  ui.runNext();
  assert.equal(swings(ui).length, 2);
  assert.equal(swings(ui)[1].node.dataset.foot, 'front-left');
  assert.equal(swings(ui)[1].createdAt, first.createdAt + species[animal].cycle / 4);
  assert.equal(first.node.style.transform, first.frames.at(-1).transform, 'the landed foot stays planted during the next swing');
  assert.equal(ui.geometryReads(), 2, 'landing and next beat never read DOM geometry');
  ui.handle.dispose();
});

test('resize coalesces layout while preserving twelve nodes and the active species at mobile scale', () => {
  const ui = harness(), paws = [...ui.paws()], animal = ui.stage.dataset.activeAnimal;
  ui.runNext();
  const previousCount = ui.timers.size;
  ui.resize(390, 844); ui.resize(390, 844);
  assert.equal(ui.timers.size, previousCount + 1);
  ui.runNext();
  assert.equal(ui.time(), 70);
  assert.equal(ui.timers.size, 1, 'resize replaces obsolete work with one new route');
  assert.deepEqual(ui.paws(), paws);
  assert.equal(ui.stage.dataset.activeAnimal, animal);
  assert.equal(ui.groups().filter(group => !group.hidden).length, 1);
  const size = parseFloat(activeGroup(ui).children[0].style.width);
  assert.ok(size > species[animal].mobile * .65 && size <= species[animal].mobile);
  assert.equal(ui.geometryReads(), 2);
  ui.handle.dispose();
  assert.equal(ui.timers.size, 0);
});

test('stale landing and next-step callbacks after resize cannot move hidden feet or revive the old route', () => {
  const ui = harness();
  runUntil(ui, () => ui.stage.dataset.activeAnimal !== ui.groups()[0].dataset.animal);
  ui.runNext();
  const stale = [...ui.timers.values()].map(task => task.callback);
  assert.equal(stale.length, 2, 'capture actual old landing and next-beat callbacks');
  ui.resize(390, 844); ui.runNext();
  const animal = ui.stage.dataset.activeAnimal, positions = ui.paws().map(paw => paw.style.transform), pending = [...ui.timers.keys()];
  stale.forEach(callback => callback());
  assert.deepEqual(ui.paws().map(paw => paw.style.transform), positions);
  assert.equal(ui.stage.dataset.activeAnimal, animal);
  assert.equal(prints(ui).length, 0);
  assert.deepEqual([...ui.timers.keys()], pending, 'old callbacks cannot schedule a hidden animal');
  const count = swings(ui).length;
  ui.runNext();
  assert.equal(swings(ui).length, count + 1);
  assert.equal(swings(ui).at(-1).node.dataset.animal, animal);
  assert.equal(swings(ui).at(-1).node.dataset.foot, 'hind-left');
  assert.equal(ui.paws().length, 12);
  ui.handle.dispose();
});

test('image failure keeps vector paws while reduced motion retains a gentler four-beat gait', async () => {
  const ui = harness({ reduced: true }), spec = species[ui.stage.dataset.activeAnimal];
  ui.images[0].onerror();
  assert.equal(await ui.handle.ready, false);
  assert.equal(ui.stage.attributes.has('data-paw-image-ready'), false);
  ui.runNext();
  const animation = swings(ui)[0];
  assert.equal(animation.options.duration, spec.cycle * 1.35);
  assert.match(animation.frames.find(frame => frame.offset === .14).transform, /scale\(\.985\)$/);
  assert.match(animation.frames[1].transform, /rotateX\(-5deg\)/);
  assert.ok(animation.frames.every(frame => frame.opacity === 1));
  assert.equal(ui.paws().length, 12);
  assert.equal(ui.groups().filter(group => !group.hidden).length, 1);
  ui.handle.dispose();
});

test('without Web Animations the finite landing fallback still moves only the active animal', async () => {
  const ui = harness({ animationsSupported: false }), group = activeGroup(ui), before = group.children.map(paw => paw.style.transform);
  ui.images[0].onerror();
  assert.equal(await ui.handle.ready, false);
  ui.runNext(); ui.runNext();
  assert.equal(ui.animations.length, 0);
  assert.equal(prints(ui).length, 1);
  assert.equal(prints(ui)[0].dataset.animal, group.dataset.animal);
  assert.equal(prints(ui)[0].dataset.foot, 'hind-left');
  assert.notEqual(group.children[2].style.transform, before[2]);
  for (const index of [0, 1, 3]) assert.equal(group.children[index].style.transform, before[index]);
  assert.equal(ui.paws().length, 12);
  ui.handle.dispose();
  assert.equal(ui.timers.size, 0);
});
