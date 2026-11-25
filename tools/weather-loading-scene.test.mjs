import test from 'node:test';
import assert from 'node:assert/strict';
import { installWeatherLoadingScenes } from '../assets/js/weather-loading-scene.js';

function fixture({ loadingPage = false, subscribe = false } = {}) {
  const mutations = [], resizes = [], intersections = [], documentEvents = new Map(), windowEvents = new Map();
  const eventTarget = events => ({
    addEventListener(type, callback) { if (!events.has(type)) events.set(type, new Set()); events.get(type).add(callback); },
    removeEventListener(type, callback) { events.get(type)?.delete(callback); },
  });
  class Node {
    constructor(classes = '', nodeType = 1) {
      this.nodeType = nodeType; this.classes = new Set(classes.split(' ').filter(Boolean));
      this.classList = { contains: name => this.classes.has(name) };
      this.dataset = {}; this.style = {}; this.attributes = new Map(); this.children = []; this.connected = true;
      this.ownerDocument = document;
    }
    get isConnected() { return this.connected && (this.host ? this.host.isConnected : this.parentNode?.isConnected ?? true); }
    get parentElement() { return this.parentNode?.nodeType === 1 ? this.parentNode : null; }
    get hidden() { return this.attributes.has('hidden'); }
    set hidden(value) { if (value) this.attributes.set('hidden', ''); else this.attributes.delete('hidden'); }
    setAttribute(name, value) { this.attributes.set(name, value); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    appendChild(node) { node.parentNode = this; node.connected = true; this.children.push(node); return node; }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(node => node !== this); this.parentNode = null; this.connected = false; }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    matches(selector) {
      if (selector === '[data-weather-loading-scene]') return this.dataset.weatherLoadingScene !== undefined;
      if (selector === '[data-weather-scene-owner]') return this.dataset.weatherSceneOwner !== undefined;
      if (selector === '.weather-orb-overlay.is-visible:not([hidden])') return this.classes.has('weather-orb-overlay') && this.classes.has('is-visible') && !this.hidden;
      return selector.split(',').some(part => part.trim().startsWith('.') && this.classes.has(part.trim().slice(1)));
    }
    closest(selector) { for (let node = this; node?.nodeType === 1; node = node.parentElement) if (node.matches(selector)) return node; return null; }
    querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    getBoundingClientRect() { return this.box || this.parentElement?.getBoundingClientRect() || { left: 0, top: 0, width: 400, height: 200, right: 400, bottom: 200 }; }
  }
  class MutationObserver {
    constructor(callback) { this.callback = callback; this.observations = []; mutations.push(this); }
    observe(target, options) { this.observations.push({ target, options }); }
    disconnect() { this.observations = []; }
  }
  class ResizeObserver {
    constructor(callback) { this.callback = callback; this.targets = new Set(); resizes.push(this); }
    observe(target) { this.targets.add(target); } unobserve(target) { this.targets.delete(target); } disconnect() { this.targets.clear(); }
  }
  class IntersectionObserver extends ResizeObserver {
    constructor(callback) { super(callback); intersections.push(this); }
  }
  const window = { innerWidth: 1200, innerHeight: 900, MutationObserver, ResizeObserver, IntersectionObserver, ...eventTarget(windowEvents) };
  const document = { hidden: false, defaultView: window, ...eventTarget(documentEvents), createElement: () => new Node() };
  document.documentElement = new Node(); document.body = document.documentElement.appendChild(new Node());
  if (loadingPage) document.documentElement.classes.add('site-loading');
  const host = document.body.appendChild(new Node()); host.dataset.weatherMounted = 'loading'; host.__weatherLifecycleGeneration = 1;
  const root = new Node('', 11); root.host = host; host.shadowRoot = root;
  const preview = root.appendChild(new Node('weather-header-preview'));
  const owner = preview.appendChild(new Node()); owner.dataset.weatherSceneOwner = 'loading';
  let state = { weather: null, loading: true, geoStatus: null, error: null }, listener, unsubscribes = 0;
  const api = { getState: () => state };
  if (subscribe) api.subscribe = callback => { listener = callback; callback(state); return () => { unsubscribes += 1; }; };
  host.__weatherWidgetInstance = api;
  const engines = [];
  const createMeteorScene = options => {
    const engine = { options, syncs: 0, stops: 0, disposed: false, active: false,
      get targets() { return options.getTargets(); },
      sync() { this.syncs += 1; this.active = true; }, stop() { this.stops += 1; this.active = false; },
      dispose() { this.disposed = true; this.active = false; } };
    engines.push(engine); return engine;
  };
  const notify = (target, type = 'attributes', attributeName = 'class', nodes = {}) => {
    const record = { target, type, attributeName, addedNodes: [], removedNodes: [], ...nodes };
    for (const observer of mutations) {
      if (observer.observations.some(({ target: watched, options }) => (watched === target || options.subtree && watched.contains(target)) &&
        (type === 'attributes' ? options.attributes && (!options.attributeFilter || options.attributeFilter.includes(attributeName)) :
          type === 'childList' ? options.childList : options.characterData))) observer.callback([record]);
    }
  };
  const controller = installWeatherLoadingScenes(host, { createMeteorScene });
  const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
  return { host, root, preview, owner, document, window, controller, engines, mutations, resizes, intersections, notify, flush, createMeteorScene,
    get engine() { return engines[0]; }, get state() { return state; }, get unsubscribes() { return unsubscribes; },
    node: classes => new Node(classes),
    update(patch) { state = { ...state, ...patch }; listener?.(state); },
    emit(type, documentEvent = false) { for (const callback of (documentEvent ? documentEvents : windowEvents).get(type) || []) callback(); },
    ready() {
      host.dataset.weatherMounted = 'true'; owner.dataset.weatherSceneOwner = 'primary';
      state = { weather: { current: { temp_c: 7 }, location: { lat: 51.34, lon: 12.37 } }, location: { latitude: 51.34, longitude: 12.37 }, loading: false, error: null, geoStatus: null };
      controller.sync();
    },
    panel() {
      host.dataset.weatherExpanded = 'true';
      const panel = root.appendChild(new Node('weather-header-dropdown'));
      panel.box = { left: 100, top: 140, width: 600, height: 650, right: 700, bottom: 790 };
      const scene = panel.appendChild(new Node()); scene.dataset.weatherSceneOwner = 'loading';
      return { panel, scene };
    },
  };
}

test('global entry never waits on weather and local stars stop at real data plus scene readiness', async () => {
  const h = fixture({ loadingPage: true });
  await h.flush(); assert.equal(h.engine.targets.length, 0);
  h.document.documentElement.classes.delete('site-loading'); h.notify(h.document.documentElement);
  await h.flush();
  assert.equal(h.engine.options.mode, 'loading');
  assert.equal(h.engine.targets.length, 1);
  assert.equal(h.engine.targets[0].stage.parentElement, h.preview);
  assert.equal(h.engine.targets[0].maxActive, 2);
  assert.equal(h.engine.targets[0].stage.style.pointerEvents, 'none');
  assert.equal(h.engine.targets[0].stage.style.inset, '0');
  h.ready();
  assert.equal(h.engine.targets.length, 0); assert.equal(h.engine.active, false);
  assert.equal(h.preview.querySelectorAll('[data-weather-loading-scene]').length, 0);
  h.update({ loading: true }); h.controller.sync();
  assert.equal(h.engine.targets.length, 0, 'ordinary refresh retains usable weather without another entrance');
  h.controller.dispose();
});

test('active celestial preparation waits for actual paint, terminal fallback and inactive orbs never loop', async () => {
  const h = fixture(); h.ready();
  const moon = h.preview.appendChild(h.node('weather-orb-overlay is-visible is-moon')); moon.dataset.moonScene = 'loading';
  h.notify(moon, 'attributes', 'data-moon-scene'); await h.flush();
  assert.equal(h.engine.targets.length, 1);
  moon.dataset.moonScene = 'paused'; h.notify(moon, 'attributes', 'data-moon-scene'); await h.flush();
  assert.equal(h.engine.targets.length, 1, 'prepared maps while paused are not a terrain paint');
  moon.dataset.moonScene = 'ready'; h.notify(moon, 'attributes', 'data-moon-scene'); await h.flush();
  assert.equal(h.engine.targets.length, 0);
  moon.dataset.moonScene = 'loading'; moon.hidden = true; h.controller.sync();
  assert.equal(h.engine.targets.length, 0);
  moon.hidden = false; moon.classes.delete('is-visible'); h.controller.sync();
  assert.equal(h.engine.targets.length, 0, 'inactive daytime Moon does not block the Sun');
  const sun = h.preview.appendChild(h.node('weather-orb-overlay is-visible is-sun')); sun.dataset.sunScene = 'paused';
  h.controller.sync(); assert.equal(h.engine.targets.length, 1, 'the solar first-frame contract uses the same pending controller');
  sun.dataset.sunScene = 'ready'; h.controller.sync(); assert.equal(h.engine.targets.length, 0);
  sun.remove();
  moon.classes.add('is-visible'); moon.dataset.moonScene = 'failed'; h.controller.sync();
  assert.equal(h.engine.targets.length, 0, 'terminal celestial fallback ends loading');
  moon.remove(); h.owner.dataset.weatherSceneOwner = 'fallback'; h.controller.sync();
  assert.equal(h.engine.targets.length, 0);
  h.controller.dispose();
});

test('a working scene fallback does not release a separate pending celestial surface', () => {
  const h = fixture(); h.ready(); h.owner.dataset.weatherSceneOwner = 'fallback';
  const moon = h.preview.appendChild(h.node('weather-orb-overlay is-visible is-moon')); moon.dataset.moonScene = 'loading';
  h.controller.sync(); assert.equal(h.engine.targets.length, 1, 'fallback satisfies its scene only, not the still-loading Moon');
  moon.dataset.moonScene = 'paused'; h.controller.sync(); assert.equal(h.engine.targets.length, 1);
  moon.dataset.moonScene = 'ready'; h.controller.sync(); assert.equal(h.engine.targets.length, 0);
  h.controller.dispose();
});

test('a terminal celestial fallback does not release a separate preparing primary scene', () => {
  const h = fixture(); h.ready(); h.owner.dataset.weatherSceneOwner = 'loading';
  const moon = h.preview.appendChild(h.node('weather-orb-overlay is-visible is-moon')); moon.dataset.moonScene = 'failed';
  h.controller.sync(); assert.equal(h.engine.targets.length, 1, 'the primary renderer still owns pending work');
  h.owner.dataset.weatherSceneOwner = 'primary'; h.controller.sync(); assert.equal(h.engine.targets.length, 0);
  h.owner.dataset.weatherSceneOwner = 'fallback'; h.controller.sync(); assert.equal(h.engine.targets.length, 0, 'fallback alone never creates an endless loader');
  h.controller.dispose();
});

test('the complete navigation weather panel has its own readiness, targets and immediate close teardown', async () => {
  const h = fixture(); h.ready(); const { panel, scene } = h.panel(); h.controller.sync();
  await h.flush();
  assert.equal(h.engine.targets.length, 1);
  assert.equal(h.engine.targets[0].stage.parentElement, panel, 'stage covers the whole panel rather than only its hero');
  assert.equal(h.engine.targets[0].bounds.height, 650); assert.equal(h.engine.targets[0].maxActive, 3);
  const stage = h.engine.targets[0].stage;
  const child = stage.appendChild(h.node('weather-meteor'));
  const before = h.engine.syncs;
  h.notify(stage, 'childList', null, { addedNodes: [child] }); await h.flush();
  assert.equal(h.engine.syncs, before, 'the engine cannot trigger its own readiness observer');
  h.host.dataset.weatherExpanded = 'false'; h.notify(h.host, 'attributes', 'data-weather-expanded'); await h.flush();
  assert.equal(h.engine.targets.length, 0); assert.equal(stage.isConnected, false);
  h.host.dataset.weatherExpanded = 'true'; h.controller.sync(); assert.equal(h.engine.targets.length, 1);
  scene.dataset.weatherSceneOwner = 'primary'; h.notify(scene, 'attributes', 'data-weather-scene-owner'); await h.flush();
  assert.equal(h.engine.targets.length, 0);
  h.controller.dispose();
});

test('one engine independently covers simultaneous preview and full panel loading', async () => {
  const h = fixture(); const { panel, scene } = h.panel(); h.controller.sync(); await h.flush();
  assert.equal(h.engines.length, 1);
  assert.deepEqual(h.engine.targets.map(target => target.maxActive), [2, 3]);
  assert.deepEqual(h.engine.targets.map(target => target.stage.parentElement), [h.preview, panel]);
  h.ready();
  assert.equal(h.engine.targets.length, 1, 'a ready preview cannot stop its still-preparing panel');
  scene.dataset.weatherSceneOwner = 'primary'; h.controller.sync();
  assert.equal(h.engine.targets.length, 0);
  h.controller.dispose();
});

test('errors, document visibility, hidden header, offscreen regions and disposal bound the loading engine', async () => {
  const h = fixture({ subscribe: true }); await h.flush();
  h.update({ error: new Error('Offline') }); await h.flush(); assert.equal(h.engine.targets.length, 0);
  h.update({ error: null, geoStatus: 'denied' }); await h.flush(); assert.equal(h.engine.targets.length, 0);
  h.update({ geoStatus: 'pending' }); await h.flush(); assert.equal(h.engine.targets.length, 1);
  h.document.hidden = true; h.emit('visibilitychange', true); assert.equal(h.engine.targets.length, 0);
  h.document.hidden = false; h.emit('visibilitychange', true); assert.equal(h.engine.targets.length, 1);
  h.document.body.classes.add('hide-header'); h.notify(h.document.body); await h.flush(); assert.equal(h.engine.targets.length, 0);
  h.document.body.classes.delete('hide-header'); h.notify(h.document.body); await h.flush(); assert.equal(h.engine.targets.length, 1);
  h.intersections[0].callback([{ target: h.preview, isIntersecting: false, intersectionRatio: 0 }]); await h.flush();
  assert.equal(h.engine.targets.length, 0);
  h.intersections[0].callback([{ target: h.preview, isIntersecting: true, intersectionRatio: 1 }]); await h.flush();
  assert.equal(h.engine.targets.length, 1);
  h.emit('pagehide'); assert.equal(h.engine.targets.length, 0);
  h.emit('pageshow'); assert.equal(h.engine.targets.length, 1);
  h.controller.dispose(); h.controller.sync(); h.update({ loading: true }); await h.flush();
  assert.equal(h.engine.disposed, true); assert.equal(h.engine.targets.length, 0); assert.equal(h.unsubscribes, 1);
  assert.ok(h.mutations.every(observer => !observer.observations.length));
});

test('new coordinates and React replacements cannot retain stale targets or old generations', async () => {
  const h = fixture(); h.ready();
  h.host.dataset.weatherLocation = '52.52,13.405'; h.notify(h.host, 'attributes', 'data-weather-location'); await h.flush();
  assert.equal(h.engine.targets.length, 1, 'old city data does not satisfy a new coordinate selection');
  const old = h.engine.targets[0].stage;
  h.preview.remove();
  const next = h.root.appendChild(h.node('weather-header-preview')); next.setAttribute('aria-busy', 'true');
  h.notify(h.root, 'childList', null, { addedNodes: [next], removedNodes: [h.preview] }); await h.flush();
  assert.equal(old.isConnected, false); assert.equal(h.engine.targets[0].stage.parentElement, next);
  h.host.__weatherLifecycleGeneration += 1; h.controller.sync();
  assert.equal(h.engine.disposed, true); assert.equal(h.engine.targets.length, 0);
  const replacement = installWeatherLoadingScenes(h.host, { createMeteorScene: h.createMeteorScene });
  assert.notEqual(replacement, h.controller); assert.equal(h.engines.length, 2);
  replacement.dispose();
});

test('installation is idempotent and a disconnected host releases all stages without late revival', async () => {
  const h = fixture(); assert.equal(installWeatherLoadingScenes(h.host, { createMeteorScene: () => { throw new Error('duplicate'); } }), h.controller);
  h.host.remove(); h.notify(h.document.body, 'childList', null, { removedNodes: [h.host] }); await h.flush();
  assert.equal(h.engine.disposed, true); assert.equal(h.engine.targets.length, 0);
  h.emit('pageshow'); assert.equal(h.engine.targets.length, 0);
  assert.equal(installWeatherLoadingScenes(null, {}), null);
});
