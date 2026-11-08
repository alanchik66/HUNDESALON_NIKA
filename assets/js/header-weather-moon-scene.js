/* Lunar surface from NASA LROC/LOLA maps. One native renderer also works without
 * WebGL. Illumination is astronomical; exposure and Earthshine display gain are
 * photographic calibrations for the small header, not measured radiance. */
const { lunarLighting } = await import(new URL(`./weather-lunar-time.js${new URL(import.meta.url).search}`, import.meta.url).href);
const { createLunarWorkClient } = await import(new URL(`./header-weather-moon-work.js${new URL(import.meta.url).search}`, import.meta.url).href);
const RADIUS_KM = 1737.4;
const PI = Math.PI;
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const linear = Array.from({ length: 256 }, (_, index) => {
  const x = index / 255;
  return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4;
});
const shadowSteps = [1, 2.5, 5, 8, 12, 18, 26, 38, 55, 80, 115, 165, 235, 330, 470, 670];
const loadingMaps = { width: 2, height: 1, albedo: new Uint8Array([150, 150, 150, 150, 150, 150]), heightData: new Uint16Array([20000, 20000]) };
let mapsPromise;

function encode(value) {
  const mapped = Math.max(0, value) / (1 + Math.max(0, value));
  return Math.round(255 * (mapped <= .0031308 ? mapped * 12.92 : 1.055 * mapped ** (1 / 2.4) - .055));
}

function coordinates(maps, longitude, latitude) {
  const x = (longitude / (2 * PI) + .5) * maps.width - .5;
  const y = clamp(.5 - latitude / PI) * maps.height - .5;
  const left = Math.floor(x), top = Math.floor(y);
  const wrap = value => (value % maps.width + maps.width) % maps.width;
  return { a: clamp(top, 0, maps.height - 1) * maps.width + wrap(left),
    b: clamp(top, 0, maps.height - 1) * maps.width + wrap(left + 1),
    c: clamp(top + 1, 0, maps.height - 1) * maps.width + wrap(left),
    d: clamp(top + 1, 0, maps.height - 1) * maps.width + wrap(left + 1), fx: x - left, fy: y - top };
}

function interpolate(a, b, c, d, fx, fy) {
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

function heightAt(maps, longitude, latitude) {
  const { a, b, c, d, fx, fy } = coordinates(maps, longitude, latitude), h = maps.heightData;
  // NASA unsigned LOLA DN: half metres above 1727.4km, not normalized colours.
  return (interpolate(h[a], h[b], h[c], h[d], fx, fy) - 20000) / 2000;
}

export function lunarSurfaceNormal(maps, longitude, latitude) {
  const sinLon = Math.sin(longitude), cosLon = Math.cos(longitude), sinLat = Math.sin(latitude), cosLat = Math.cos(latitude);
  const dl = 2 * PI / maps.width, dp = PI / maps.height, radius = RADIUS_KM + heightAt(maps, longitude, latitude);
  const eastSlope = (heightAt(maps, longitude + dl, latitude) - heightAt(maps, longitude - dl, latitude))
    / (2 * dl * radius * Math.max(.02, cosLat));
  const northSlope = (heightAt(maps, longitude, Math.min(PI / 2, latitude + dp)) - heightAt(maps, longitude, Math.max(-PI / 2, latitude - dp)))
    / (2 * dp * radius);
  const normal = { x: cosLat * cosLon + sinLon * eastSlope + sinLat * cosLon * northSlope,
    y: cosLat * sinLon - cosLon * eastSlope + sinLat * sinLon * northSlope,
    z: sinLat - cosLat * northSlope };
  const length = Math.hypot(normal.x, normal.y, normal.z);
  return { x: normal.x / length, y: normal.y / length, z: normal.z / length };
}

export function lunarTerrainVisibility(maps, position, sun, height) {
  let visibility = 1;
  const radius = RADIUS_KM + height;
  for (const distance of shadowSteps) {
    const x = position.x * radius + sun.x * distance, y = position.y * radius + sun.y * distance, z = position.z * radius + sun.z * distance;
    const length = Math.hypot(x, y, z);
    const terrain = RADIUS_KM + heightAt(maps, Math.atan2(y, x), Math.asin(clamp(z / length, -1, 1)));
    // A solar angular radius of about .27deg softens the terrain horizon.
    visibility = Math.min(visibility, clamp(.5 + (length - terrain + .001) / (2 * .00465 * distance)));
    if (visibility === 0) break;
  }
  return visibility;
}

export function canonicalLunarView(lighting) {
  const angle = Math.atan2(lighting.northDirection.x, lighting.northDirection.y), c = Math.cos(angle), s = Math.sin(angle);
  const rotate = v => ({ x: c * v.x - s * v.y, y: s * v.x + c * v.y, z: v.z });
  return { angle, x: rotate(lighting.bodyToView.x), y: rotate(lighting.bodyToView.y), z: rotate(lighting.bodyToView.z) };
}

function* lunarRasterRows(lighting, maps, { size = 384, discFraction = .51, earthshine = true, terrain = true } = {}) {
  const data = new Uint8ClampedArray(size * size * 4);
  const stats = { pixels: 0, sunlit: 0, terrainShadow: 0, earthshine: 0, renderSize: size };
  if (!lighting.valid) return { data, width: size, height: size, stats };
  const view = canonicalLunarView(lighting);
  const radius = size * discFraction / 2, center = size / 2;
  const sun = lighting.sunDirectionBody, observer = lighting.observerDirectionBody;
  const beta = Math.acos(clamp(1 - 2 * lighting.illuminatedFraction, -1, 1));
  const earthPhase = (Math.sin(beta) + (PI - beta) * Math.cos(beta)) / PI;
  // Tone-compressed Earthshine is intentionally visible at header size. This is
  // not a claim of live global terrestrial albedo or calibrated lunar photometry.
  const earth = earthshine ? .011 * earthPhase : 0;
  stats.earthshine = earth;
  const first = Math.max(0, Math.floor(center - radius - 1)), last = Math.min(size, Math.ceil(center + radius + 1));
  for (let row = first; row < last; row++) {
    for (let column = first; column < last; column++) {
    const x = (column + .5 - center) / radius, y = (center - row - .5) / radius;
    const r2 = x * x + y * y, coverage = clamp((1 - Math.sqrt(r2)) * radius + .5);
    if (!coverage) continue;
    const z = Math.sqrt(Math.max(0, 1 - Math.min(r2, 1)));
    const point = { x: view.x.x * x + view.x.y * y + view.x.z * z,
      y: view.y.x * x + view.y.y * y + view.y.z * z,
      z: view.z.x * x + view.z.y * y + view.z.z * z };
    const norm = Math.hypot(point.x, point.y, point.z);
    point.x /= norm; point.y /= norm; point.z /= norm;
    const longitude = Math.atan2(point.y, point.x), latitude = Math.asin(clamp(point.z, -1, 1));
    const normal = terrain ? lunarSurfaceNormal(maps, longitude, latitude) : point;
    const incidence = Math.max(0, dot(normal, sun)), emission = Math.max(.02, dot(normal, observer));
    const geometricIncidence = dot(point, sun);
    let visibility = 1;
    if (incidence > 0 && terrain && geometricIncidence < .5) {
      visibility = geometricIncidence < -.12 ? 0 : lunarTerrainVisibility(maps, point, sun, heightAt(maps, longitude, latitude));
      if (visibility < .9) stats.terrainShadow++;
    }
    const direct = incidence > 0 ? (.15 * incidence + 1.7 * incidence / (incidence + emission)) * visibility : 0;
    const { a, b, c, d, fx, fy } = coordinates(maps, longitude, latitude), offset = (row * size + column) * 4;
    for (let channel = 0; channel < 3; channel++) {
      const albedo = interpolate(linear[maps.albedo[a * 3 + channel]], linear[maps.albedo[b * 3 + channel]],
        linear[maps.albedo[c * 3 + channel]], linear[maps.albedo[d * 3 + channel]], fx, fy);
      data[offset + channel] = encode(albedo * 3.2 * (direct + earth * [.84, .96, 1.12][channel]));
    }
    data[offset + 3] = Math.round(255 * coverage);
      stats.pixels++; if (direct > .01) stats.sunlit++;
    }
    if ((row - first) % 4 === 3) yield;
  }
  return { data, width: size, height: size, stats };
}

export function renderLunarPixels(lighting, maps, options) {
  const rows = lunarRasterRows(lighting, maps, options);
  let result;
  do { result = rows.next(); } while (!result.done);
  return result.value;
}

// AbortController cancels a fetch, not an already-started native image decoder.
// Settle every asynchronous stage on abort and release any late bitmap result.
function mapStage(promise, signal, releaseLate) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const aborted = () => {
      if (settled) return;
      settled = true; signal.removeEventListener('abort', aborted);
      reject(signal.reason || new globalThis.DOMException('Lunar map load aborted.', 'AbortError'));
    };
    signal.addEventListener('abort', aborted, { once: true });
    Promise.resolve(promise).then(value => {
      if (settled) { try { releaseLate?.(value); } catch {} return; }
      settled = true; signal.removeEventListener('abort', aborted); resolve(value);
    }, error => {
      if (settled) return;
      settled = true; signal.removeEventListener('abort', aborted); reject(error);
    });
    if (signal.aborted) aborted();
  });
}

async function decodeMap(response, signal) {
  if (!response.ok) throw new Error(`Lunar map HTTP ${response.status}.`);
  const blob = await mapStage(response.blob(), signal);
  if (typeof globalThis.createImageBitmap === 'function') {
    try { return await mapStage(globalThis.createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }), signal, image => image.close?.()); }
    catch (error) {
      if (signal.aborted) throw error;
      // Older WebKit decodes the same local PNG/WebP through an image.
    }
  }
  const image = new Image(), url = URL.createObjectURL(blob);
  try { image.src = url; await mapStage(image.decode(), signal); return image; }
  finally { if (signal.aborted) image.removeAttribute('src'); URL.revokeObjectURL(url); }
}

async function loadMaps() {
  const controller = new globalThis.AbortController();
  const timer = setTimeout(() => controller.abort(new globalThis.DOMException('Lunar map loading timed out.', 'TimeoutError')), 45000);
  const images = [];
  try {
    const search = new URL(import.meta.url).search;
    const results = await Promise.allSettled(['moon-albedo.webp', 'moon-height.png'].map(async file => {
      try {
        const response = await mapStage(fetch(new URL(`../images/weather/${file}${search}`, import.meta.url), { signal: controller.signal }), controller.signal);
        return await decodeMap(response, controller.signal);
      } catch (error) {
        if (!controller.signal.aborted) controller.abort(error);
        throw error;
      }
    }));
    for (const result of results) if (result.status === 'fulfilled') images.push(result.value);
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
    const width = images[0].width, height = images[0].height;
    if (width !== images[1].width || height !== images[1].height || width !== 2 * height || width > 4096) throw new Error('Invalid lunar map geometry.');
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Lunar map decoding canvas unavailable.');
    context.drawImage(images[0], 0, 0);
    let rgba = context.getImageData(0, 0, width, height).data;
    const albedo = new Uint8Array(width * height * 3), heightData = new Uint16Array(width * height);
    for (let index = 0; index < width * height; index++) {
      for (let channel = 0; channel < 3; channel++) albedo[index * 3 + channel] = rgba[index * 4 + channel];
    }
    context.clearRect(0, 0, width, height); context.drawImage(images[1], 0, 0);
    rgba = context.getImageData(0, 0, width, height).data;
    for (let index = 0; index < width * height; index++) heightData[index] = rgba[index * 4] * 256 + rgba[index * 4 + 1];
    canvas.width = 0; canvas.height = 0;
    return { width, height, albedo, heightData };
  } finally {
    clearTimeout(timer); for (const image of images) image.close?.();
  }
}

function sharedMaps() {
  if (!mapsPromise) mapsPromise = loadMaps().catch(error => { mapsPromise = null; throw error; });
  return mapsPromise;
}

class HeaderWeatherMoonScene {
  constructor(canvas, maps, options) {
    this.canvas = canvas; this.maps = maps; this.options = options; this.geoState = { ...options.geoState };
    this.context = canvas.getContext('2d');
    if (!this.context) throw new Error('Lunar native canvas unavailable.');
    this.workClient = createLunarWorkClient(canvas.ownerDocument?.defaultView);
    this.owner = Symbol('lunar surface'); canvas.__moonSurfaceOwner = this.owner;
    this.disposed = false; this.lastRaster = null; this.angle = null; this.contextVersion = 0;
    canvas.width = options.size || 384; canvas.height = canvas.width;
    canvas.style.cssText = 'position:absolute;inset:0;display:block;width:100%;height:100%;max-width:none;max-height:none;pointer-events:none;transform-origin:50% 50%!important;filter:none!important;mix-blend-mode:normal!important;transition:rotate 1s linear!important';
    this.renderFrame(true);
  }

  setGeoState(geoState) {
    if (this.disposed) return;
    this.geoState = { ...geoState }; this.renderFrame();
  }

  readRequest() {
    this.geoState = { ...(this.options.getGeoState?.() || this.geoState) };
    const { latitude, longitude, appearanceTimeMs } = this.geoState;
    const time = Number.isFinite(appearanceTimeMs) ? appearanceTimeMs : this.options.getTimeMs?.() ?? this.geoState.timeMs;
    const now = performance.now(), previous = this.request;
    const delta = previous ? time - previous.time : 0;
    const changed = previous && (latitude !== previous.latitude || longitude !== previous.longitude || appearanceTimeMs !== previous.appearanceTimeMs
      || (delta !== 0 && Math.abs(delta - (now - previous.now)) > 5000));
    if (changed) this.contextVersion++;
    this.request = { latitude, longitude, appearanceTimeMs, time, now };
    return { ...this.request, changed };
  }

  renderFrame(force = false) {
    if (this.disposed || this.canvas.__moonSurfaceOwner !== this.owner || !this.canvas.isConnected
      || this.canvas.ownerDocument?.hidden || this.options.isCurrent?.() === false || this.options.signal?.aborted) return false;
    this.canvas.style.setProperty('transition', this.canvas.ownerDocument?.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'none' : 'rotate 1s linear', 'important');
    const { latitude, longitude, time, changed: contextChanged } = this.readRequest();
    const lighting = lunarLighting(time, latitude, longitude);
    if (!lighting.valid) return false;
    this.lighting = lighting;
    const view = canonicalLunarView(lighting);
    const angle = view.angle + (this.options.skyProjection === 'dome' ? lighting.skyDomeRollRad : 0);
    this.angle = this.angle === null ? angle : this.angle + Math.atan2(Math.sin(angle - this.angle), Math.cos(angle - this.angle));
    this.canvas.style.rotate = `${this.angle}rad`;
    // Live clock ticks coalesce behind finite work; a selected city/time or a
    // clock correction supersedes stale work immediately, including during mount.
    if (this.renderJob && !force && !contextChanged) { this.renderPending = true; return false; }
    const sample = [...Object.values(lighting.sunDirectionBody), ...Object.values(lighting.observerDirectionBody)], version = this.contextVersion;
    const changed = !this.lastRaster || this.lastRaster.maps !== this.maps || this.lastRaster.contextVersion !== version
      || sample.some((value, index) => Math.abs(value - this.lastRaster.sample[index]) > .0008);
    if (!force && !contextChanged && !changed && Math.abs(time - this.lastRaster.time) < 15000) return false;
    const maps = this.maps;
    const options = { size: this.canvas.width, discFraction: this.options.discFraction ?? .51, terrain: maps !== loadingMaps };
    const job = Symbol('lunar raster'); this.renderJob = job;
    this.renderPending = false; this.renderError = null;
    this.canvas.dataset.moonRenderState = 'rendering';
    const current = () => !this.disposed && this.canvas.isConnected && this.renderJob === job && this.contextVersion === version && this.canvas.__moonSurfaceOwner === this.owner
      && !this.canvas.ownerDocument?.hidden && !this.options.signal?.aborted && this.options.isCurrent?.() !== false;
    const paint = (frame, surfaceMaps = maps) => {
      if (!current()) return false;
      const image = this.context.createImageData(frame.width, frame.height); image.data.set(frame.data); this.context.putImageData(image, 0, 0);
      this.stats = frame.stats;
      this.lastRaster = { time, sample, maps: surfaceMaps, contextVersion: version };
      this.canvas.dataset.moonRenderer = 'native-terrain';
      this.canvas.dataset.moonIlluminated = lighting.illuminatedFraction.toFixed(6);
      this.canvas.dataset.moonRenderedAt = String(time);
      this.canvas.dataset.moonShadowPixels = String(frame.stats.terrainShadow);
      this.canvas.dataset.moonEarthshine = frame.stats.earthshine.toFixed(6);
      this.canvas.dataset.moonDetail = surfaceMaps === loadingMaps ? (this.mapError ? 'fallback' : 'loading') : 'terrain';
      this.canvas.dataset.moonRenderState = 'ready';
      this.canvas.dataset.moonRenderBackend = frame.backend || (surfaceMaps === loadingMaps ? 'phase' : 'main');
      if (surfaceMaps !== loadingMaps) this.options.onReady?.();
      return true;
    };
    if (this.maps === loadingMaps) {
      const painted = paint(renderLunarPixels(lighting, maps, options)); this.renderJob = null;
      this.whenRendered = Promise.resolve(painted);
    } else {
      // A scene first created in a hidden tab has no committed surface yet.
      // Show its current physical phase immediately when that tab resumes.
      if (!this.lastRaster) paint(renderLunarPixels(lighting, loadingMaps, { ...options, terrain: false }), loadingMaps);
      this.canvas.dataset.moonRenderState = 'rendering';
      const rows = lunarRasterRows(lighting, maps, options);
      this.whenRendered = (async () => {
        const frame = await this.workClient.render(lighting, maps, options, current);
        if (!current()) return false;
        if (this.readRequest().changed) { this.renderFrame(true); return false; }
        if (frame) return paint({ ...frame, backend: 'worker' });
        let channel;
        try {
          const Channel = this.canvas.ownerDocument?.defaultView?.MessageChannel;
          if (Channel) channel = new Channel();
        } catch { /* Restricted clients keep the finite timer fallback. */ }
        const closeChannel = () => { channel?.port1.close(); channel?.port2.close(); channel = null; };
        const yieldWork = () => new Promise(resolve => {
          if (channel) {
            try { channel.port1.onmessage = resolve; channel.port2.postMessage(0); return; }
            catch { closeChannel(); }
          }
          setTimeout(resolve, 0);
        });
        try {
          let result;
          // Give the phase surface/input one task before expensive terrain work.
          await yieldWork();
          let sliceStart = performance.now();
          do {
            if (!current()) return false;
            if (this.readRequest().changed) { this.renderFrame(true); return false; }
            result = rows.next();
            // Keep the same pixels/shadow samples. Batch four-row portions for at
            // most6ms. Private channel tasks avoid nested/background timer clamps.
            if (!result.done && performance.now() - sliceStart >= 6) {
              await yieldWork(); sliceStart = performance.now();
            }
          } while (!result.done);
          return paint(result.value);
        } finally { closeChannel(); }
      })().catch(error => { if (this.renderJob === job) this.renderError = error; return false; }).then(painted => {
        if (this.renderJob === job) {
          const active = current();
          this.renderJob = null;
          if (!painted) this.canvas.dataset.moonRenderState = this.renderError ? 'failed' : 'paused';
          const pending = this.renderPending; this.renderPending = false;
          if (pending && active) this.renderFrame();
        }
        return painted;
      });
    }
    return true;
  }

  getLightingState() { return this.lighting; }

  dispose() {
    this.disposed = true; this.renderJob = null; this.renderPending = false;
    this.workClient.dispose();
    if (this.canvas.__moonSurfaceOwner === this.owner) {
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.canvas.style.removeProperty('rotate'); delete this.canvas.__moonSurfaceOwner;
    }
    this.maps = null;
  }
}

export async function createHeaderWeatherMoonScene(canvas, options = {}) {
  const current = () => !options.signal?.aborted && options.isCurrent?.() !== false && canvas.isConnected;
  const obsolete = () => new globalThis.DOMException('Obsolete lunar surface.', 'AbortError');
  if (!current()) throw obsolete();
  // Keep the correct phase visible during the one-time terrain download. This
  // loading surface invents no craters; the detailed NASA surface replaces it.
  const scene = new HeaderWeatherMoonScene(canvas, loadingMaps, options);
  canvas.dataset.moonDetail = 'loading'; canvas.hidden = false;
  scene.whenReady = (async () => {
    try {
      const maps = await sharedMaps();
      if (!current() || canvas.__moonSurfaceOwner !== scene.owner) throw obsolete();
      scene.maps = maps; scene.renderFrame(true);
      let pending;
      do { pending = scene.whenRendered; await pending; }
      while ((scene.lastRaster?.maps !== maps || scene.lastRaster.contextVersion !== scene.contextVersion) && pending !== scene.whenRendered);
      if (!current() || canvas.__moonSurfaceOwner !== scene.owner) throw obsolete();
      if (scene.renderError) throw scene.renderError;
      if (scene.lastRaster?.maps !== maps || scene.lastRaster.contextVersion !== scene.contextVersion) {
        if (!canvas.ownerDocument?.hidden) throw new Error('Lunar terrain did not commit.');
        canvas.dataset.moonDetail = 'paused';
      }
      return scene;
    } catch (error) {
      if (!current() || canvas.__moonSurfaceOwner !== scene.owner) scene.dispose();
      else { scene.mapError = error; canvas.dataset.moonDetail = 'fallback'; }
      throw error;
    }
  })();
  // Main widget publishes the phase scene early so city/time changes also work
  // during slow downloads. Other consumers keep the original await-ready API.
  scene.whenReady.catch(() => {});
  return options.deferTerrain ? scene : scene.whenReady;
}
