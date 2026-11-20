const SOURCE = 'eumetsat-msg';
const SATELLITE_BOUNDS = Object.freeze([5, 47, 16, 55.8]);
const MAX_RASTER_SIDE = 384;
const MAX_FRAME_AGE = 60 * 60 * 1000;
const REFRESH_DELAY = 5 * 60 * 1000;
const RAD = Math.PI / 180;
const EARTH_RADIUS_KM = 6371.0088;
const UNKNOWN = 255;
const PROJECTION_WIDTH = 72;
const PROJECTION_HEIGHT = 28;
const OBSERVED_CLASS = 'weather-satellite-clouds';
// RGB columns read at evenly spaced heights from the official MSG CTH WMS legend (0.32–16 km).
const TOP_COLORS = [
  [0, 0, 0], [79, 35, 0], [124, 35, 50], [174, 9, 154], [117, 0, 216],
  [15, 0, 251], [0, 52, 255], [0, 121, 255], [0, 194, 255], [0, 247, 234],
  [0, 222, 123], [10, 194, 0], [83, 212, 0], [155, 230, 0], [212, 244, 0],
  [254, 226, 0], [254, 152, 0], [254, 85, 0], [254, 28, 0], [219, 57, 57],
  [166, 150, 150], [190, 190, 190], [218, 218, 218], [255, 255, 255],
];
const RAY_HEIGHTS = [0.9, 1.7, 2.7, 4.1, 6, 8.4, 11.2, 14.2];
const scenes = new WeakMap();
let latest = null;
let request;
let lastAttempt = -Infinity;

export function isRecentCloudSnapshot(snapshot, now = Date.now()) {
  const observed = Date.parse(snapshot?.observedAt);
  return Number.isFinite(observed) && observed <= now + 60000 && now - observed <= MAX_FRAME_AGE;
}

export function validateCloudSnapshot(data, now = Date.now()) {
  if (data?.source !== SOURCE || !isRecentCloudSnapshot(data, now)) return false;
  const { bbox, width, height, maskPng, cloudTopPng } = data;
  const base64Png = value => typeof value === 'string' && value.length <= 512000 &&
    value.startsWith('iVBORw0KGgo') && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
  if (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(Number.isFinite) ||
    !Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2 ||
    width > MAX_RASTER_SIDE || height > MAX_RASTER_SIDE || !base64Png(maskPng) ||
    (cloudTopPng != null && !base64Png(cloudTopPng))) return false;
  const [west, south, east, north] = bbox;
  const [areaWest, areaSouth, areaEast, areaNorth] = SATELLITE_BOUNDS;
  return west >= areaWest && east <= areaEast && south >= areaSouth && north <= areaNorth &&
    east > west && north > south;
}

export function isInSatelliteCoverage(observer) {
  const { latitude, longitude } = observer || {};
  const [west, south, east, north] = SATELLITE_BOUNDS;
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= south && latitude <= north && longitude >= west && longitude <= east;
}

export function cloudPixel(red, green, blue, alpha) {
  if (alpha < 224) return UNKNOWN;
  if (Math.min(red, green, blue) >= 240) return 1;
  if ((green >= 130 && red <= 35 && blue <= 45) || (blue >= 130 && red <= 35 && green <= 45)) return 0;
  return UNKNOWN;
}

export function cloudTopFromColor(red, green, blue, alpha) {
  if (alpha < 224) return null;
  let nearest = 0;
  let error = Infinity;
  // Search adjacent palette segments instead of interpreting RGB brightness as altitude.
  TOP_COLORS.slice(1).forEach(([r, g, b], index) => {
    const [pr, pg, pb] = TOP_COLORS[index];
    const dr = r - pr, dg = g - pg, db = b - pb;
    const length = dr * dr + dg * dg + db * db;
    const t = Math.max(0, Math.min(1, ((red - pr) * dr + (green - pg) * dg + (blue - pb) * db) / length));
    const distance = (red - pr - t * dr) ** 2 + (green - pg - t * dg) ** 2 + (blue - pb - t * db) ** 2;
    if (distance < error) { error = distance; nearest = index + t; }
  });
  return error <= 75 ** 2 ? .32 + nearest * (16 - .32) / (TOP_COLORS.length - 1) : null;
}

export function decodeCloudGrid(snapshot, maskPixels, topPixels) {
  const { width, height } = snapshot;
  const count = width * height;
  if (maskPixels.length !== 4 * count) return null;
  const mask = new Uint8Array(count), tops = new Float32Array(count), colors = new Map();
  if (topPixels?.length !== 4 * count) topPixels = null;
  let known = 0;
  for (let i = 0; i < count; i += 1) {
    const pixel = 4 * i;
    mask[i] = cloudPixel(maskPixels[pixel], maskPixels[pixel + 1], maskPixels[pixel + 2], maskPixels[pixel + 3]);
    if (mask[i] !== UNKNOWN) known += 1;
    if (mask[i] !== 1 || !topPixels || topPixels[pixel + 3] < 224) continue;
    const color = topPixels[pixel] * 65536 + topPixels[pixel + 1] * 256 + topPixels[pixel + 2];
    if (!colors.has(color)) {
      colors.set(color, cloudTopFromColor(topPixels[pixel], topPixels[pixel + 1], topPixels[pixel + 2], topPixels[pixel + 3]));
    }
    tops[i] = colors.get(color) ?? 0;
  }
  return known >= count * .25 ? { source: snapshot.source, observedAt: snapshot.observedAt, bbox: snapshot.bbox, width, height, mask, tops } : null;
}

export function raySurfacePosition(lat, lon, azimuth, elevation, heightKm) {
  if (![lat, lon, azimuth, elevation, heightKm].every(Number.isFinite) ||
    Math.abs(lat) > 90 || Math.abs(lon) > 180 || elevation < 10 || elevation > 90 || heightKm < 0) return null;
  const theta = azimuth * RAD;
  const latitude = lat * RAD, longitude = lon * RAD;
  const angle = heightKm / Math.tan(elevation * RAD) / EARTH_RADIUS_KM;
  const destination = Math.asin(Math.sin(latitude) * Math.cos(angle) + Math.cos(latitude) * Math.sin(angle) * Math.cos(theta));
  const east = Math.sin(theta) * Math.sin(angle) * Math.cos(latitude);
  const north = Math.cos(angle) - Math.sin(latitude) * Math.sin(destination);
  return { latitude: destination / RAD, longitude: ((longitude + Math.atan2(east, north)) / RAD + 540) % 360 - 180 };
}

function spatialCell(grid, position) {
  const [west, south, east, north] = grid.bbox;
  const lon = position.longitude, lat = position.latitude;
  if (lon < west || lon > east || lat < south || lat > north) return null;
  // WMS CRS:84 has longitude-first bounds and the north edge at the image top.
  const x = Math.max(0, Math.min(grid.width - 1, (lon - west) / (east - west) * grid.width - .5));
  const y = Math.max(0, Math.min(grid.height - 1, (north - lat) / (north - south) * grid.height - .5));
  return { x, y };
}

export function sampleCloudGrid(grid, position) {
  const cell = spatialCell(grid, position);
  if (!cell) return null;
  const x = Math.floor(cell.x), y = Math.floor(cell.y), u = cell.x - x, v = cell.y - y;
  let valid = 0, cloud = 0, weightedTop = 0, topWeight = 0;
  for (let row = 0; row <= 1; row += 1) {
    for (let column = 0; column <= 1; column += 1) {
      const i = Math.min(y + row, grid.height - 1) * grid.width + Math.min(x + column, grid.width - 1);
      const weight = (row ? v : 1 - v) * (column ? u : 1 - u);
      if (grid.mask[i] === UNKNOWN) continue;
      valid += weight;
      cloud += weight * grid.mask[i];
      if (grid.mask[i] === 1 && grid.tops[i] > 0) { weightedTop += weight * grid.tops[i]; topWeight += weight; }
    }
  }
  return valid >= .5 ? { fraction: cloud / valid, topKm: topWeight ? weightedTop / topWeight : null } : null;
}

export function sampleLunarCloudRay(grid, observer, elevation, azimuth) {
  if (!spatialCell(grid, observer) || elevation < 12) return null;
  let opacity = 0, known = 0;
  for (const height of RAY_HEIGHTS) {
    const point = raySurfacePosition(observer.latitude, observer.longitude, azimuth, elevation, height);
    const sample = point && sampleCloudGrid(grid, point);
    if (!sample) continue;
    known += 1;
    // CTH is a top altitude. The cloud body depth and optical density remain modelled.
    // Missing tops have a broad lower-troposphere estimate.
    const top = sample.topKm ?? 3;
    const distance = (height - top * .82) / Math.max(.85, top * .24);
    if (height <= top + .5) opacity = Math.max(opacity, sample.fraction * Math.exp(-distance * distance));
  }
  return known >= 2 ? opacity : null;
}

async function rgbaFromPng(base64, width, height, document) {
  const bytes = Uint8Array.from(globalThis.atob(base64), char => char.charCodeAt(0));
  const objectUrl = URL.createObjectURL(new globalThis.Blob([bytes], { type: 'image/png' }));
  try {
    const image = document.createElement('img');
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = objectUrl; });
    if (image.naturalWidth !== width || image.naturalHeight !== height) throw new Error('Invalid satellite raster dimensions.');
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas2D unavailable.');
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, width, height).data;
  } finally { URL.revokeObjectURL(objectUrl); }
}

function loadCloudGrid(document) {
  const now = Date.now();
  if (request) return request;
  if (now - lastAttempt < REFRESH_DELAY) return Promise.resolve(isRecentCloudSnapshot(latest, now) ? latest : null);
  lastAttempt = now;
  request = (async () => {
    const response = await fetch('/api/satellite-clouds', { signal: globalThis.AbortSignal.timeout(8000), headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const snapshot = await response.json();
    if (!validateCloudSnapshot(snapshot)) return null;
    const { width, height } = snapshot;
    const [mask, top] = await Promise.all([
      rgbaFromPng(snapshot.maskPng, width, height, document),
      snapshot.cloudTopPng ? rgbaFromPng(snapshot.cloudTopPng, width, height, document).catch(() => null) : null,
    ]);
    return decodeCloudGrid(snapshot, mask, top);
  })().then(grid => { if (grid) latest = grid; }, () => {}).finally(() => { request = null; })
    .then(() => isRecentCloudSnapshot(latest) ? latest : null);
  return request;
}

function clearScene(state) {
  state.canvas?.remove();
  if (state.canvas) state.canvas = null;
  state.key = '';
  return null;
}

// Inverse of the header's stereographic dome: north up and east left.
export function skyDirectionFromCloudProjection(x, y) {
  return {
    elevation: 90 - 2 * Math.atan(Math.hypot(x, y)) / RAD,
    azimuth: (Math.atan2(-x, -y) / RAD + 360) % 360,
  };
}

function projectFrame(grid, observer, position, box, lunar) {
  const { azimuthDeg, elevationDeg } = position;
  const radius = Math.tan((90 - elevationDeg) * RAD * .5);
  const moonX = -radius * Math.sin(azimuthDeg * RAD), moonY = -radius * Math.cos(azimuthDeg * RAD);
  const x0 = (lunar.left + lunar.width * .5 - box.left) / box.width;
  const y0 = (lunar.top + lunar.height * .5 - box.top) / box.height;
  const horizontalSpan = Math.min(.9, box.width * .002);
  const verticalSpan = horizontalSpan * box.height / box.width;
  const pixels = new Float32Array(PROJECTION_WIDTH * PROJECTION_HEIGHT);
  let known = 0;
  let mean = 0;
  for (let y = 0; y < PROJECTION_HEIGHT; y += 1) {
    for (let x = 0; x < PROJECTION_WIDTH; x += 1) {
      const sx = (x + .5) / PROJECTION_WIDTH;
      const sy = (y + .5) / PROJECTION_HEIGHT;
      const ray = skyDirectionFromCloudProjection(moonX + (sx - x0) * horizontalSpan, moonY + (sy - y0) * verticalSpan);
      const cloud = sampleLunarCloudRay(grid, observer, ray.elevation, ray.azimuth);
      if (cloud === null) continue;
      known += 1;
      mean += cloud;
      pixels[y * PROJECTION_WIDTH + x] = cloud;
    }
  }
  return known >= pixels.length * .25 ? { pixels, mean: mean / known } : null;
}

function createOverlay(document) {
  const canvas = document.createElement('canvas');
  canvas.className = OBSERVED_CLASS;
  canvas.width = PROJECTION_WIDTH; canvas.height = PROJECTION_HEIGHT;
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '12', borderRadius: 'inherit', filter: 'blur(1.6px)',
  });
  return canvas;
}

export async function syncHeaderWeatherSatelliteClouds(overlay, observer, position, active) {
  if (!overlay) return null;
  let state = scenes.get(overlay);
  if (!state && !active) return null;
  if (!state) { state = { revision: 0, key: '' }; scenes.set(overlay, state); }
  const revision = ++state.revision;
  const document = overlay.ownerDocument;
  if (!active || document.hidden || !overlay.isConnected || Number.isFinite(observer?.appearanceTimeMs) ||
    !isInSatelliteCoverage(observer) || !Number.isFinite(position?.azimuthDeg) ||
    !Number.isFinite(position?.elevationDeg) || position.elevationDeg < 12) return clearScene(state);

  let grid = latest;
  if (!isRecentCloudSnapshot(grid) || Date.now() - lastAttempt >= REFRESH_DELAY) grid = await loadCloudGrid(document);
  if (revision !== state.revision) return null;
  if (!grid || !overlay.isConnected || document.hidden || !spatialCell(grid, observer)) return clearScene(state);
  const region = overlay.closest('.weather-header-preview,.weather-header-dropdown__hero');
  if (!region) return clearScene(state);
  const box = region.getBoundingClientRect(), lunar = overlay.getBoundingClientRect();
  if (!box.width || !box.height || !lunar.width || !lunar.height) return clearScene(state);
  const key = [
    grid.observedAt, observer.latitude.toFixed(4), observer.longitude.toFixed(4),
    position.azimuthDeg.toFixed(1), position.elevationDeg.toFixed(1), Math.round(box.width),
    Math.round(box.height), Math.round(lunar.left - box.left), Math.round(lunar.top - box.top),
  ].join(':');
  if (key === state.key) return grid.observedAt;

  const frame = projectFrame(grid, observer, position, box, lunar);
  if (!frame) return clearScene(state);
  const canvas = state.canvas ||= createOverlay(document), context = canvas.getContext('2d');
  if (!context) return clearScene(state);
  const image = context.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = y * canvas.width + x, i = index * 4;
      const edge = Math.min(x, y, canvas.width - 1 - x, canvas.height - 1 - y);
      const opacity = frame.pixels[index] * Math.min(1, edge / 4);
      image.data[i] = 40;
      image.data[i + 1] = 49;
      image.data[i + 2] = 58;
      image.data[i + 3] = Math.round(164 * opacity);
    }
  }
  context.putImageData(image, 0, 0);
  canvas.dataset.weatherCloudObservedAt = grid.observedAt;
  canvas.dataset.weatherCloudObservedClear = String(frame.mean === 0);
  if (!canvas.isConnected) region.appendChild(canvas);
  state.key = key;
  return grid.observedAt;
}
