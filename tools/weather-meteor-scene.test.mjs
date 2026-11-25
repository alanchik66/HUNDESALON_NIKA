import test from 'node:test';
import assert from 'node:assert/strict';
import { createMeteorScene } from '../assets/js/weather-meteor-scene.js';

const settle = () => new Promise(resolve => setImmediate(resolve));
const rectangle = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height });

function harness({ mode = 'loading', maxActive = 2, width = 390, height = 180, animate = true } = {}) {
  const timers = new Map();
  const animations = [];
  const listeners = new Map();
  let nextId = 0;
  let seed = 573;
  const view = {
    setTimeout(callback, delay) { const id = ++nextId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(type, callback) { listeners.set('window:' + type, callback); },
    removeEventListener(type) { listeners.delete('window:' + type); },
  };
  const root = {
    children: [],
    querySelector() { return this.children.find(node => node.attributes.has('data-weather-meteor-style')); },
    appendChild(node) { this.children.push(node); node.parentElement = this; node.isConnected = true; },
  };
  const ownerDocument = {
    defaultView: view, hidden: false,
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type) { listeners.delete(type); },
    createElement(tag) {
      const node = {
        tag, attributes: new Map(), properties: new Map(), isConnected: false,
        style: { setProperty(name, value) { node.properties.set(name, value); } },
        setAttribute(name, value) { this.attributes.set(name, value); },
        remove() {
          const list = this.parentElement?.children;
          const index = list?.indexOf(this);
          if (index >= 0) list.splice(index, 1);
          this.isConnected = false;
        },
        animate(frames, options) {
          if (!animate) throw new Error('WAAPI unavailable');
          let resolve;
          let reject;
          const animation = {
            element: this, frames, options, cancelled: false,
            finished: new Promise((finish, fail) => { resolve = finish; reject = fail; }),
            finish() { resolve(); },
            cancel() { this.cancelled = true; reject(new Error('Cancelled')); },
          };
          animations.push(animation);
          return animation;
        },
      };
      return node;
    },
  };
  const bounds = rectangle(14, 32, width, height);
  const stage = {
    ownerDocument, children: [], isConnected: true,
    getRootNode: () => root,
    getBoundingClientRect: () => bounds,
    appendChild(node) { this.children.push(node); node.parentElement = this; node.isConnected = true; },
  };
  let enabled = true;
  const scene = createMeteorScene({
    mode,
    getTargets: () => enabled ? [{ stage, bounds, rect: bounds, maxActive }] : [],
    random(min, max) {
      seed = (seed * 16807) % 2147483647;
      return min + (max - min) * (seed / 2147483647);
    },
  });
  return {
    scene, timers, animations, stage, root, ownerDocument, listeners, bounds,
    disable() { enabled = false; },
    runTimer() {
      const [id, timer] = timers.entries().next().value;
      timers.delete(id);
      timer.callback();
      return timer.delay;
    },
  };
}

test('loading starts immediately and keeps the preview and panel meteor limits', async () => {
  for (const maxActive of [2, 3]) {
    const ui = harness({ maxActive });
    ui.scene.sync();
    assert.equal(ui.stage.children.length, 1, 'first meteor does not wait for an ambient-night interval');
    for (let index = 1; index < maxActive; index++) {
      assert.equal(ui.timers.size, 1);
      assert.ok(ui.runTimer() >= 130);
    }
    assert.equal(ui.stage.children.length, maxActive);
    assert.equal(ui.timers.size, 0, 'no polling while the scene is at capacity');
    for (let index = 0; index < 10; index++) ui.scene.sync();
    assert.equal(ui.stage.children.length, maxActive);
    assert.equal(ui.timers.size, 0);
    ui.animations[0].finish();
    await settle();
    assert.equal(ui.stage.children.length, maxActive - 1);
    assert.equal(ui.timers.size, 1);
    ui.scene.dispose();
  }
});

test('loading uses the full stage with varied origins and installs the exact meteor style once', async () => {
  const ui = harness({ width: 1100, height: 620, maxActive: 3 });
  ui.scene.sync();
  for (let index = 0; index < 15; index++) {
    for (const animation of ui.animations) animation.finish();
    await settle();
    ui.runTimer();
  }
  const origins = ui.animations.map(({ element }) => [parseFloat(element.style.left), parseFloat(element.style.top)]);
  assert.ok(Math.max(...origins.map(origin => origin[0])) - Math.min(...origins.map(origin => origin[0])) > 600);
  assert.ok(Math.max(...origins.map(origin => origin[1])) - Math.min(...origins.map(origin => origin[1])) > 250);
  assert.equal(ui.root.children.length, 1);
  const css = ui.root.children[0].textContent;
  assert.match(css, /ellipse var\(--shooting-star-head-long/);
  assert.match(css, /clip-path: polygon\(0 50%, 76% 39%, 100% 10%, 100% 90%, 76% 61%\)/);
  assert.match(css, /weatherShootingStarGlint/);
  assert.match(css, /weatherShootingStarTrail/);
  assert.doesNotMatch(css, /infinite|backdrop-filter|filter:\s*blur/);
  assert.equal(ui.animations[0].element.attributes.get('aria-hidden'), 'true');
  assert.equal(ui.stage.style, undefined, 'the renderer never changes the surface layout');
  ui.scene.dispose();
});

test('readiness stops immediately and stale completion cannot restart a stopped scene', async () => {
  const ui = harness();
  ui.scene.sync();
  ui.runTimer();
  ui.disable();
  ui.scene.sync();
  assert.equal(ui.stage.children.length, 0);
  assert.equal(ui.timers.size, 0);
  assert.ok(ui.animations.every(animation => animation.cancelled));
  await settle();
  assert.equal(ui.timers.size, 0);
  ui.scene.dispose();
});

test('hidden documents and pagehide release animations and disposal removes listeners', async () => {
  for (const event of ['visibilitychange', 'window:pagehide']) {
    const ui = harness();
    ui.scene.sync();
    if (event === 'visibilitychange') ui.ownerDocument.hidden = true;
    ui.listeners.get(event)();
    assert.equal(ui.stage.children.length, 0);
    assert.equal(ui.timers.size, 0);
    await settle();
    assert.equal(ui.timers.size, 0);
    if (event === 'visibilitychange') {
      ui.ownerDocument.hidden = false;
      ui.listeners.get(event)();
      assert.equal(ui.stage.children.length, 1);
    }
    ui.scene.dispose();
    ui.scene.dispose();
    assert.equal(ui.listeners.size, 0);
    await settle();
    assert.equal(ui.timers.size, 0);
  }
});

test('detached stages cancel before rescheduling and unsupported animation fails open', async () => {
  const detached = harness();
  detached.scene.sync();
  detached.stage.isConnected = false;
  detached.scene.sync();
  await settle();
  assert.equal(detached.stage.children.length, 0);
  assert.equal(detached.timers.size, 0);
  detached.scene.dispose();
  const unsupported = harness({ animate: false });
  unsupported.scene.sync();
  unsupported.scene.sync();
  assert.equal(unsupported.stage.children.length, 0);
  assert.equal(unsupported.timers.size, 0);
  unsupported.scene.dispose();
});

test('ambient mode keeps the original rare interval and never overlaps stars', async () => {
  const ui = harness({ mode: 'ambient' });
  ui.scene.sync();
  assert.equal(ui.animations.length, 0);
  const delay = [...ui.timers.values()][0].delay;
  assert.ok(delay >= 4500 && delay <= 9500);
  ui.runTimer();
  assert.equal(ui.animations.length, 1);
  assert.equal(ui.timers.size, 0);
  ui.scene.sync();
  assert.equal(ui.timers.size, 0);
  ui.animations[0].finish();
  await settle();
  const nextDelay = [...ui.timers.values()][0].delay;
  assert.ok(nextDelay >= 28000 && nextDelay <= 68000);
  ui.scene.dispose();
});
