import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'espree';

const source = await readFile(new URL('../assets/js/header-weather-sun-scene.js', import.meta.url), 'utf8');
const declaration = parse(source, { ecmaVersion: 'latest', sourceType: 'module', range: true }).body
  .find(node => node.type === 'FunctionDeclaration' && node.id.name === 'loadTexture');
assert.ok(declaration, 'The production texture loader must exist');
const implementation = source.slice(...declaration.range);
const url = 'https://preview.example/assets/sun.jpg?v=current';
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function harness({ image, legacyImage, throwRequest = false } = {}) {
  const timers = new Map(), textures = [], events = [], stats = { requests: 0, decodeCalls: 0, created: [], disposed: [] };
  let nextTimer = 0, success, failure;
  class Texture {
    constructor(value) { this.image = value; stats.created.push(this); }
    dispose() { stats.disposed.push(this); }
  }
  const THREE = {
    Texture,
    TextureLoader: class {
      load(requested, onSuccess, progress, onFailure) {
        stats.requests++; stats.requestedUrl = requested;
        if (throwRequest) throw new Error('request threw');
        const texture = new Texture(legacyImage);
        success = () => onSuccess(texture); failure = onFailure;
        return texture;
      }
    },
    SRGBColorSpace: 'srgb', RepeatWrapping: 'repeat', ClampToEdgeWrapping: 'clamp', LinearMipmapLinearFilter: 'mip-linear', LinearFilter: 'linear',
  };
  const load = new Function('THREE', 'setTimeout', 'clearTimeout', `${implementation}; return loadTexture;`)(
    THREE,
    (callback, milliseconds) => { const id = ++nextTimer; timers.set(id, { callback, milliseconds }); return id; },
    id => timers.delete(id)
  );
  const renderer = { capabilities: { getMaxAnisotropy: () => 32 } };
  return { image, load, textures, events, stats, timers, renderer, success: () => success(), failure: () => failure(), timeout: () => { const entry = [...timers.values()][0]; assert.equal(entry.milliseconds, 25000); entry.callback(); } };
}

function matchingImage(wait = Promise.resolve()) {
  const image = { src: url, currentSrc: url, baseURI: 'https://preview.example/ru/', loading: 'eager', hidden: false,
    getAttribute(name) { return name === 'src' ? this.src : null; }, decode() { image.calls++; return wait; }, calls: 0 };
  return image;
}

function assertConfigured(texture, image) {
  assert.equal(texture.image, image);
  assert.equal(texture.colorSpace, 'srgb'); assert.equal(texture.wrapS, 'repeat'); assert.equal(texture.wrapT, 'clamp');
  assert.equal(texture.minFilter, 'mip-linear'); assert.equal(texture.magFilter, 'linear');
  assert.equal(texture.anisotropy, 16); assert.equal(texture.needsUpdate, true);
}

test('matching decoded header IMG supplies the original bytes without another loader request', async () => {
  const image = matchingImage(), h = harness({ image });
  const texture = await h.load(url, h.textures, h.renderer, phase => h.events.push(phase), image);
  assert.equal(h.stats.requests, 0); assert.equal(image.calls, 1); assert.equal(h.stats.created.length, 1);
  assert.equal(h.textures[0], texture); assertConfigured(texture, image);
  assert.deepEqual(h.events, ['texture-decode']); assert.equal(h.timers.size, 0);
  assert.equal(image.src, url); assert.equal(image.hidden, false);
});

test('pending header request is retained before decode and its existing promise determines readiness', async () => {
  const wait = deferred(), image = matchingImage(wait.promise), h = harness({ image });
  image.loading = 'lazy'; image.currentSrc = 'blob:https://preview.example/old-placeholder';
  let finished = false;
  const pending = h.load(url, h.textures, h.renderer, null, image).then(value => { finished = true; return value; });
  await Promise.resolve(); assert.equal(finished, false); assert.equal(h.stats.requests, 0);
  assert.equal(h.textures.length, 1); assert.equal(h.textures[0].needsUpdate, undefined);
  assert.equal(image.loading, 'eager'); assert.equal(image.hidden, false);
  image.currentSrc = url; wait.resolve(); const texture = await pending;
  assertConfigured(texture, image); assert.equal(h.timers.size, 0);
});

test('relative declared URL with matching absolute currentSrc reuses one source image', async () => {
  const image = matchingImage(); image.src = '../assets/sun.jpg?v=current';
  const h = harness({ image }), texture = await h.load(url, h.textures, h.renderer, null, image);
  assert.equal(h.stats.requests, 0); assertConfigured(texture, image);
});

test('decode rejection releases the retained texture and leaves the fallback IMG visible', async () => {
  const wait = deferred(), image = matchingImage(wait.promise), h = harness({ image });
  const pending = h.load(url, h.textures, h.renderer, null, image), rejected = assert.rejects(pending, /decode failed/);
  wait.reject(new Error('decode failed')); await rejected;
  assert.equal(h.stats.requests, 0); assert.equal(h.textures.length, 0); assert.equal(h.stats.disposed.length, 1);
  assert.equal(h.timers.size, 0); assert.equal(image.src, url); assert.equal(image.hidden, false);
});

test('changing the attached image during decode cannot upload the native poster as the Sun map', async () => {
  const wait = deferred(), image = matchingImage(wait.promise), h = harness({ image });
  const pending = h.load(url, h.textures, h.renderer, null, image), rejected = assert.rejects(pending, /image changed/);
  image.src = '/assets/sun-recovery-poster.png'; image.currentSrc = 'https://preview.example/assets/sun-recovery-poster.png'; wait.resolve(); await rejected;
  assert.equal(h.stats.created[0].needsUpdate, undefined); assert.equal(h.stats.disposed.length, 1); assert.equal(h.textures.length, 0); assert.equal(h.timers.size, 0);
});

test('decoded currentSrc must also match even when the declared source still names the Sun', async () => {
  const image = matchingImage(); image.currentSrc = 'https://preview.example/assets/other.jpg';
  const h = harness({ image }); await assert.rejects(h.load(url, h.textures, h.renderer, null, image), /image changed/);
  assert.equal(h.stats.requests, 0); assert.equal(h.stats.disposed.length, 1); assert.equal(h.timers.size, 0);
});

test('different attached source keeps the original TextureLoader route and configuration', async () => {
  const image = matchingImage(), legacyImage = { decode: async () => {} };
  image.src = '/assets/sun-recovery-poster.png';
  const h = harness({ image, legacyImage }), pending = h.load(url, h.textures, h.renderer, null, image);
  assert.equal(h.stats.requests, 1); assert.equal(h.textures.length, 1); assert.equal(image.calls, 0);
  h.success(); const texture = await pending; assertConfigured(texture, legacyImage); assert.equal(h.timers.size, 0);
});

test('deadline settles a stalled shared decode and late completion cannot publish or leak a texture', async () => {
  const wait = deferred(), image = matchingImage(wait.promise), h = harness({ image });
  const pending = h.load(url, h.textures, h.renderer, null, image), rejected = assert.rejects(pending, /timed out/);
  h.timeout(); await rejected; assert.equal(h.stats.disposed.length, 1); assert.equal(h.textures.length, 0); assert.equal(h.timers.size, 0);
  wait.resolve(); await Promise.resolve(); assert.equal(h.stats.created[0].needsUpdate, undefined); assert.equal(h.stats.disposed.length, 1);
});

test('legacy timeout retains then releases its returned texture, including a late onLoad callback', async () => {
  const h = harness({ legacyImage: { decode: async () => {} } });
  const pending = h.load(url, h.textures, h.renderer), rejected = assert.rejects(pending, /timed out/);
  assert.equal(h.textures.length, 1); h.timeout(); await rejected; h.success(); await Promise.resolve();
  assert.equal(h.stats.disposed.length, 1); assert.equal(h.textures.length, 0); assert.equal(h.stats.created[0].needsUpdate, undefined); assert.equal(h.timers.size, 0);
});

test('legacy error and synchronous request failure both clear the deadline and release owned resources', async () => {
  const h = harness(), pending = h.load(url, h.textures, h.renderer), rejected = assert.rejects(pending, /could not load/);
  h.failure(); await rejected; assert.equal(h.stats.disposed.length, 1); assert.equal(h.textures.length, 0); assert.equal(h.timers.size, 0);
  const throwing = harness({ throwRequest: true }); await assert.rejects(throwing.load(url, throwing.textures, throwing.renderer), /request threw/);
  assert.equal(throwing.timers.size, 0);
});

test('a cancelled owner never uploads the decoded image and the existing scene cleanup owns retained textures', async () => {
  const wait = deferred(), image = matchingImage(wait.promise), h = harness({ image }); let current = true;
  const pending = h.load(url, h.textures, h.renderer, null, image, () => current), rejected = assert.rejects(pending, /cancelled/);
  current = false; h.textures.forEach(texture => texture.dispose()); wait.resolve(); await rejected;
  assert.equal(h.stats.disposed.length, 1); assert.equal(h.stats.created[0].needsUpdate, undefined); assert.equal(h.timers.size, 0);
});

test('missing texture URL does not create images, textures or a deadline', async () => {
  const h = harness(); assert.equal(await h.load(null, h.textures, h.renderer, null, matchingImage()), null);
  assert.equal(h.stats.created.length, 0); assert.equal(h.stats.requests, 0); assert.equal(h.timers.size, 0);
});
