/* A small CPU-rendered textured sphere for the non-WebGL recovery path.
 * The source map is an illustration, not a live solar observation. No graphics
 * context other than Canvas 2D is requested and this module owns no frame loop. */
const textures = new Map(), controllers = new WeakMap(), pending = new WeakMap();
const TAU = Math.PI * 2;
const defaults = {
  radius: .7, cameraDistance: 4.55, fov: 35, axialTilt: 7.25 * Math.PI / 180,
  days: time => (time - Date.UTC(2026, 10, 4)) / 86400000,
  rotation: time => -34 * Math.PI / 180 + (((time - Date.UTC(2026, 10, 4)) / 86400000 * (14.37 - 360 / 365.256) / 360 % 1) + 1) % 1 * TAU,
  tone: { floor: .40, spotFloor: .06, power: .85, spotPower: .1, exposure: 1.6 },
};
const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
const linearLookup = Float32Array.from({ length: 256 }, (_, index) => {
  const value = index / 255;
  return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
});
const srgb = value => 255 * (value <= .0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - .055);

function modelOf(photometry) {
  const value = photometry.surfaceModel || {};
  return { ...defaults, ...value, tone: { ...defaults.tone, ...value.tone } };
}

/* Ray/sphere intersections use the same perspective camera as the GPU body.
 * Four edge samples provide coverage; UVs and latitude drift are cached once. */
export function createSoftwareSunProjection(width, height, model = defaults) {
  const { radius, cameraDistance: distance, fov, axialTilt } = { ...defaults, ...model };
  if (![width, height, radius, distance, fov, axialTilt].every(Number.isFinite)
    || width < 1 || height < 1 || width > 512 || height > 512 || distance <= radius || radius <= 0 || fov <= 0 || fov >= 180) {
    throw new RangeError('Invalid software Sun projection.');
  }
  width = Math.floor(width); height = Math.floor(height);
  const tangent = Math.tan(fov * Math.PI / 360), aspect = width / height;
  const cosine = Math.cos(axialTilt), sine = Math.sin(axialTilt);
  const diameterFraction = radius / Math.sqrt(distance * distance - radius * radius) / tangent;
  const radiusPixels = height * diameterFraction / 2, radius2 = radiusPixels * radiusPixels;
  const pixels = [], us = [], vs = [], drifts = [], alphas = [];
  const hit = (px, py) => {
    const x = (2 * px / width - 1) * aspect * tangent, y = (1 - 2 * py / height) * tangent;
    const a = 1 + x * x + y * y, discriminant = distance * distance - a * (distance * distance - radius * radius);
    if (discriminant < 0) return null;
    const t = (distance - Math.sqrt(discriminant)) / a;
    return [x * t, y * t, distance - t];
  };
  const minX = Math.max(0, Math.floor(width / 2 - radiusPixels - 1)), maxX = Math.min(width, Math.ceil(width / 2 + radiusPixels + 1));
  const minY = Math.max(0, Math.floor(height / 2 - radiusPixels - 1)), maxY = Math.min(height, Math.ceil(height / 2 + radiusPixels + 1));
  for (let y = minY; y < maxY; y++) for (let x = minX; x < maxX; x++) {
    const dx = Math.abs(x + .5 - width / 2), dy = Math.abs(y + .5 - height / 2);
    if (Math.max(0, dx - .25) ** 2 + Math.max(0, dy - .25) ** 2 > radius2) continue;
    let count = 4, point;
    if ((dx + .25) ** 2 + (dy + .25) ** 2 <= radius2) point = hit(x + .5, y + .5);
    else {
      const samples = [[.25, .25], [.75, .25], [.25, .75], [.75, .75]].map(([sx, sy]) => hit(x + sx, y + sy)).filter(Boolean);
      count = samples.length;
      if (!count) continue;
      point = count === 4 ? hit(x + .5, y + .5)
        : samples.reduce((sum, value) => sum.map((part, index) => part + value[index] / count), [0, 0, 0]);
    }
    const px = cosine * point[0] + sine * point[1], py = -sine * point[0] + cosine * point[1];
    const sinLatitude = Math.max(-1, Math.min(1, py / radius)), sin2 = sinLatitude * sinLatitude;
    pixels.push((y * width + x) * 4);
    us.push(Math.atan2(point[2], -px) / TAU);
    vs.push(.5 + Math.asin(sinLatitude) / Math.PI);
    drifts.push((2.33 * sin2 + 1.56 * sin2 * sin2) / 360);
    alphas.push(Math.round(count / 4 * 255));
  }
  return { width, height, pixels: Uint32Array.from(pixels), u: Float32Array.from(us), v: Float32Array.from(vs),
    drift: Float32Array.from(drifts), alpha: Uint8Array.from(alphas),
    diameterFraction };
}

function releaseTexture(record) {
  if (--record.users > 0) return;
  if (textures.get(record.url) === record) textures.delete(record.url);
  record.cancel?.(); record.texture = null;
}

function acquireTexture(url, document, window) {
  let record = textures.get(url);
  if (record) { record.users++; return record; }
  record = { url, users: 1, texture: null, cancel: null, promise: null };
  textures.set(url, record);
  record.promise = new Promise((resolve, reject) => {
    const image = new window.Image();
    let finished = false;
    const finish = error => {
      if (finished) return;
      finished = true; window.clearTimeout(timer); image.onload = image.onerror = null; record.cancel = null;
      if (error) { image.src = ''; reject(error); return; }
      try {
        if (!(image.naturalWidth > 1 && image.naturalHeight > 1)) throw new Error('The software Sun texture is empty.');
        // A shared display LOD keeps at least several source texels per visible
        // body pixel. The original 4K image and its URL are never modified.
        const width = Math.min(1024, image.naturalWidth), height = Math.max(2, Math.round(width * image.naturalHeight / image.naturalWidth));
        if (height > 1024) throw new Error('Unexpected software Sun texture aspect ratio.');
        const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('The software Sun texture canvas is unavailable.');
        context.drawImage(image, 0, 0, width, height);
        const rgba = context.getImageData(0, 0, width, height).data, luminance = new Float32Array(width * height);
        for (let index = 0, offset = 0; index < luminance.length; index++, offset += 4) {
          luminance[index] = .2126 * linearLookup[rgba[offset]] + .7152 * linearLookup[rgba[offset + 1]] + .0722 * linearLookup[rgba[offset + 2]];
        }
        canvas.width = canvas.height = 1;
        record.texture = { width, height, luminance }; resolve(record.texture);
      } catch (error) { reject(error); }
    };
    const timer = window.setTimeout(() => finish(new Error('The software Sun texture timed out.')), 15000);
    record.cancel = () => finish(new Error('The software Sun texture was cancelled.'));
    image.crossOrigin = 'anonymous'; image.decoding = 'async';
    image.onload = () => finish(); image.onerror = () => finish(new Error('The software Sun texture could not load.'));
    image.src = url;
    if (image.complete && image.naturalWidth > 0) void Promise.resolve().then(() => finish());
  });
  return record;
}

function sampleTexture(texture, u, v) {
  const { width, height, luminance } = texture;
  const x = ((u % 1 + 1) % 1) * width - .5, y = Math.max(0, Math.min(height - 1, (1 - v) * height - .5));
  const left = Math.floor(x), top = Math.floor(y), fx = x - left, fy = y - top;
  const x0 = (left + width) % width, x1 = (x0 + 1) % width, y1 = Math.min(height - 1, top + 1);
  const a = luminance[top * width + x0] * (1 - fx) + luminance[top * width + x1] * fx;
  const b = luminance[y1 * width + x0] * (1 - fx) + luminance[y1 * width + x1] * fx;
  return a * (1 - fy) + b * fy;
}

function toneLookup(tone, strength) {
  const floor = tone.floor - tone.spotFloor * strength, power = tone.power + tone.spotPower * strength;
  const result = new Float32Array(4096);
  for (let index = 0; index < result.length; index++) {
    // Scalar ACES RRT/ODT approximation for the neutral luminance entering the
    // same current linear RGB tint. This is not pixel-identical GPU emulation.
    const value = (floor + (1 - floor) * (index / 4095) ** power) * tone.exposure / .6;
    result[index] = clamp((value * (value + .0245786) - .000090537) / (value * (.983729 * value + .4329510) + .238081));
  }
  return result;
}

export async function mountSoftwareSunBody({ overlay, photometry, sourceUrl, isCurrent = () => true }) {
  const document = overlay?.ownerDocument, window = document?.defaultView;
  if (!document || !window?.Image || !sourceUrl || !photometry) throw new TypeError('A software Sun source and attached overlay are required.');
  const source = new URL(sourceUrl, document.baseURI).href, token = {};
  pending.set(overlay, token);
  const canvas = document.createElement('canvas'), context = canvas.getContext('2d', { alpha: true });
  if (!context?.createImageData || !context.putImageData) {
    if (pending.get(overlay) === token) pending.delete(overlay);
    throw new Error('The software Sun Canvas 2D context is unavailable.');
  }
  canvas.className = 'weather-orb-overlay__software-canvas'; canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.sunBodyRenderer = 'canvas2d';
  canvas.style.cssText = 'position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;min-height:0!important;display:block!important;visibility:visible!important;pointer-events:none!important;z-index:2!important;opacity:1!important;transform:none!important;filter:brightness(1.06)!important;mix-blend-mode:normal!important;background:transparent!important;';
  let live = true, active = true, committed = false, projection, frame, texture, lookup, lookupKey, lastKey, lastTime = -Infinity, lastPaint = -Infinity;
  const record = acquireTexture(source, document, window), model = modelOf(photometry);
  const stats = { backend: 'canvas2d-perspective-sphere', frames: 0, width: 0, height: 0, textureWidth: 0, textureHeight: 0, lastCostMs: 0, meanCostMs: 0 };
  const owns = () => live && isCurrent() && overlay.isConnected !== false
    && (committed ? controllers.get(overlay) === api : pending.get(overlay) === token);
  const dispose = () => {
    if (!live) return;
    live = active = false; canvas.remove(); canvas.width = canvas.height = 1; releaseTexture(record);
    if (pending.get(overlay) === token) pending.delete(overlay);
    if (controllers.get(overlay) === api) { controllers.delete(overlay); delete overlay.dataset.sunBodyRenderer; }
    projection = frame = lookup = texture = null;
  };
  const render = (timeMs = photometry.getTimeMs(), { force = false } = {}) => {
    if (!active || !owns() || !texture) return false;
    if (!Number.isFinite(timeMs)) throw new RangeError('The software Sun clock must be finite.');
    const now = window.performance?.now?.() ?? Date.now(), rect = overlay.getBoundingClientRect();
    const cssWidth = Math.max(8, overlay.clientWidth || rect.width || 68), cssHeight = Math.max(8, overlay.clientHeight || rect.height || cssWidth);
    const ratio = Math.min(Math.max(1, Number(window.devicePixelRatio) || 1) * (Number(window.visualViewport?.scale) || 1), 512 / Math.max(cssWidth, cssHeight));
    const width = Math.max(8, Math.round(cssWidth * ratio)), height = Math.max(8, Math.round(cssHeight * ratio));
    const resize = !projection || width !== stats.width || height !== stats.height;
    const color = photometry.solarSurfaceColorUniform.value, strength = clamp(photometry.solarSpotStrengthUniform?.value);
    const rgb = [clamp(color.r), clamp(color.g), clamp(color.b)];
    const key = [...rgb.map(value => Math.round(value * 4096)), Math.round(strength * 2048)].join(':');
    // Colour transitions can repaint at up to 10Hz; the physical texture phase
    // normally repaints once per second. No scheduling is owned here.
    if (!force && !resize && now - lastPaint < 100) return false;
    if (!force && !resize && key === lastKey && Math.abs(timeMs - lastTime) < 1000) return false;
    const start = window.performance?.now?.() ?? now;
    if (resize) {
      canvas.width = width; canvas.height = height;
      projection = createSoftwareSunProjection(width, height, model); frame = context.createImageData(width, height);
      stats.width = width; stats.height = height;
    }
    const nextLookupKey = Math.round(strength * 2048);
    if (!lookup || lookupKey !== nextLookupKey) { lookup = toneLookup(model.tone, strength); lookupKey = nextLookupKey; }
    const days = model.days(timeMs), rotation = model.rotation(timeMs) / TAU;
    if (!Number.isFinite(days) || !Number.isFinite(rotation)) throw new RangeError('The software Sun phase must be finite.');
    const rgba = frame.data;
    for (let index = 0; index < projection.pixels.length; index++) {
      const value = sampleTexture(texture, projection.u[index] - rotation + days * projection.drift[index], projection.v[index]);
      const gray = lookup[Math.max(0, Math.min(4095, Math.round(value * 4095)))], offset = projection.pixels[index];
      rgba[offset] = srgb(gray * rgb[0]); rgba[offset + 1] = srgb(gray * rgb[1]); rgba[offset + 2] = srgb(gray * rgb[2]);
      rgba[offset + 3] = projection.alpha[index];
    }
    context.putImageData(frame, 0, 0); lastTime = timeMs; lastPaint = now; lastKey = key;
    stats.frames++; stats.lastCostMs = Math.max(0, (window.performance?.now?.() ?? now) - start);
    stats.meanCostMs += (stats.lastCostMs - stats.meanCostMs) / stats.frames;
    return true;
  };
  const api = { canvas, stats, render, start() { if (!live || active) return; active = true; render(photometry.getTimeMs(), { force: true }); }, stop() { active = false; }, dispose };
  try {
    texture = await record.promise;
    if (!owns()) throw new Error('The software Sun mount is no longer current.');
    stats.textureWidth = texture.width; stats.textureHeight = texture.height;
    render(photometry.getTimeMs(), { force: true });
    controllers.get(overlay)?.dispose(); controllers.set(overlay, api); committed = true;
    pending.delete(overlay); overlay.appendChild(canvas); overlay.dataset.sunBodyRenderer = 'canvas2d';
    return api;
  } catch (error) { dispose(); throw error; }
}
