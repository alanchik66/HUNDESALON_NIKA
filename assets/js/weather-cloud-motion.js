/* A visual wind field, not a measurement of wind at cloud altitude. */
const FIELD = Symbol.for('nika.weather-cloud-flow.v1');
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : fallback;
const wrap = value => ((value % 1) + 1) % 1;
const smooth = value => { const t = clamp(value, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };

function random(seed, cell = 0) {
  let value = (seed ^ Math.imul(cell | 0, 0x9e3779b9)) >>> 0;
  value = Math.imul(value ^ value >>> 16, 0x21f0aaad);
  value = Math.imul(value ^ value >>> 15, 0x735a2d97);
  return ((value ^ value >>> 15) >>> 0) / 4294967296;
}

export function cloudNoise(time, seed) {
  const cell = Math.floor(time), fraction = time - cell;
  const a = random(seed, cell), b = random(seed, cell + 1);
  return (a + (b - a) * smooth(fraction)) * 2 - 1;
}

export function cloudSeed(position = []) {
  let seed = 0x4e494b41;
  for (const value of position) seed = Math.imul(seed ^ Math.round(finite(value) * 1000), 16777619);
  return seed >>> 0;
}

export function cloudMotionNow(environment = globalThis) {
  const clock = environment.performance;
  return clock?.now ? (finite(clock.timeOrigin) + clock.now()) / 1000 : Date.now() / 1000;
}

export function cloudWind(weather) {
  return {
    speed: clamp(finite(weather?.current?.wind_kph ?? weather?.weatherMeta?.windSpeedKph), 0, 180),
    degree: finite(weather?.current?.wind_degree ?? weather?.weatherMeta?.windDirection),
  };
}

/** Coverage is weather data; these bounded shape/alpha coefficients are visual choices. */
export function resolveCloudAppearance(weather) {
  const percent = value => !(typeof value === 'number' || typeof value === 'string' && value.trim()) || !Number.isFinite(Number(value))
    ? null : clamp(Number(value), 0, 100);
  const current = weather?.current || {}, meta = weather?.weatherMeta || {};
  const code = Number(current.condition?.code), text = String(current.condition?.text || '').toLowerCase();
  const storm = [1087, 1273, 1276, 1279, 1282].includes(code) || /thunder|storm/.test(text);
  const precipitation = storm || /rain|drizzle|shower|snow|sleet|blizzard|ice pellet/.test(text) ||
    [1063, 1066, 1069, 1072, 1114, 1117, 1150, 1153, 1168, 1171, 1180, 1183, 1186, 1189, 1192, 1195, 1198, 1201, 1204, 1207, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1240, 1243, 1246, 1249, 1252, 1255, 1258, 1261, 1264].includes(code);
  const fog = [1030, 1135, 1147].includes(code) || /fog|mist/.test(text);
  const measured = percent(current.cloud) ?? percent(meta.cloudCover);
  const inferred = code === 1000 || /sunny|clear/.test(text) ? 0 : code === 1003 || /partly|scattered|few clouds/.test(text) ? 40 : 75;
  const coverage = measured ?? inferred;
  const layers = Number.isFinite(meta.appearanceTimeMs) ? null : meta.cloudLayers;
  const low = percent(layers?.low), mid = percent(layers?.mid), high = percent(layers?.high);
  const layerEvidence = layers?.source === 'met-norway-locationforecast' && Number.isFinite(Date.parse(layers.validTime)) &&
    low !== null && mid !== null && high !== null && low + mid + high > 0;
  const weight = layerEvidence ? low + mid + high : 1;
  // A high/mid layer is flatter and lighter than the old cumulus sprite field, not a measured optical depth.
  const strength = layerEvidence ? (low + mid * .45 + high * .2) / weight : .62;
  const flattenY = layerEvidence ? (low + mid * .42 + high * .2) / weight : .7;
  const amount = coverage === 0 ? 0 : .12 + .88 * Math.sqrt(coverage / 100);
  const opacity = precipitation || fog ? Math.max(storm ? .85 : .65, amount * strength) : amount * strength;
  return { coverage, measured: measured !== null, layerEvidence, profile: precipitation ? 'precipitation' : fog ? 'fog' : layerEvidence ? 'layered' : 'neutral',
    opacity, flattenY: precipitation || fog ? 1 : flattenY, spreadX: precipitation || fog ? 1 : 1 + (1 - flattenY) * .2 };
}

export function smoothCloudAppearance(state, target, now, immediate = false) {
  const time = finite(now, state.time), gap = time - finite(state.time, time);
  const blend = immediate || !Number.isFinite(state.opacity) ? 1 : 1 - Math.exp(-clamp(gap, 0, .05) / 1.6);
  state.time = time;
  for (const key of ['opacity', 'flattenY', 'spreadX']) state[key] = blend === 1 ? target[key] : state[key] + (target[key] - state[key]) * blend;
  state.coverage = target.coverage; state.profile = target.profile; state.layerEvidence = target.layerEvidence;
  return state;
}

export function createCloudFlow(now = 0) {
  const time = finite(now);
  return { time, elapsed: time, travel: time * .003, velocity: 0 };
}

export function sharedCloudFlow(scope, now = 0) {
  if (!scope || (typeof scope !== 'object' && typeof scope !== 'function')) return createCloudFlow(now);
  // A DOM-owned data record survives a renderer retry or a module query retry.
  if (!scope[FIELD]) Object.defineProperty(scope, FIELD, { value: createCloudFlow(now), configurable: true });
  return scope[FIELD];
}

export function advanceCloudFlow(flow, now, speed = 0, degree = 0) {
  const time = finite(now, flow.time), gap = time - flow.time;
  flow.time = time;
  if (gap <= 0 || gap > 1) return flow;
  const dt = Math.min(gap, .2), wind = clamp(finite(speed), 0, 180);
  // A small visual drift remains for wind along the camera axis or at the surface calm.
  const target = .0012 - Math.sin(finite(degree) * Math.PI / 180) * (wind ? .0015 + .0006 * Math.sqrt(wind) : 0);
  const decay = Math.exp(-dt / 6), previous = flow.velocity;
  // Exact integration of the smoothed velocity avoids an FPS-dependent speed.
  flow.travel += target * dt + (previous - target) * 6 * (1 - decay);
  flow.velocity = target + (previous - target) * decay;
  flow.elapsed += dt;
  return flow;
}

export function sampleCloudLayer(flow, seed, _margin = .35, output = {}) {
  const time = flow.elapsed, depth = .55 + random(seed, 8) * .45;
  // Closed paths replace edge relocation. Each layer has its own slow visual cycle;
  // surface wind gently changes its phase speed, not a measured cloud-altitude orbit.
  const phase = wrap(time / (100 + random(seed, 9) * 80) + flow.travel * depth + random(seed, 3));
  const angle = phase * Math.PI * 2;
  output.phase = phase;
  output.x = Math.sin(angle) * (.09 + depth * .055);
  output.y = Math.cos(angle) * (.012 + depth * .008);
  output.z = cloudNoise(time / 83, seed + 3) * .1;
  output.scaleX = 1 + cloudNoise(time / 53, seed + 4) * .055;
  output.scaleY = 1 + cloudNoise(time / 71, seed + 5) * .04;
  output.opacity = .96 + cloudNoise(time / 97, seed + 6) * .04;
  return output;
}

export function smoothCloudViewport(state, width, height, now) {
  const time = finite(now, state.time), gap = time - finite(state.time, time);
  state.time = time;
  if (!(state.width > 0 && state.height > 0)) { state.width = width; state.height = height; return state; }
  // Initial size is immediate; resize targets approach smoothly, including after a pause.
  const blend = 1 - Math.exp(-clamp(gap, 0, .05) / .45);
  state.width += (width - state.width) * blend;
  state.height += (height - state.height) * blend;
  return state;
}

export function sampleCloudPuff(flow, seed, index, output = {}) {
  const time = flow.elapsed, key = (seed + Math.imul(index + 1, 0x9e3779b9)) >>> 0;
  output.x = cloudNoise(time / 37, key) * .075;
  output.y = cloudNoise(time / 43, key + 1) * .075;
  output.z = cloudNoise(time / 59, key + 2) * .06;
  output.volume = 1 + cloudNoise(time / 67, key + 3) * .065;
  output.rotation = cloudNoise(time / 79, key + 4) * .055;
  return output;
}

/** Native counterpart for the existing three fallback cloud spans. */
export function createFallbackCloudMotion(container, weather) {
  const document = container.ownerDocument, view = document.defaultView || globalThis;
  const nodes = [...container.children], scope = container.closest('.weather-header-preview,.weather-header-dropdown__hero,.weather-app') || container;
  const flow = sharedCloudFlow(scope, cloudMotionNow(view)), wind = cloudWind(weather), poses = nodes.map(() => ({}));
  const target = resolveCloudAppearance(weather);
  const motion = view.matchMedia?.('(prefers-reduced-motion: reduce)');
  let disposed = false, raf = 0, last = null, width = 0, height = 0, visible = true;
  let resizeObserver, intersectionObserver;
  const hidden = () => document.hidden || container.isConnected === false;
  const stop = () => { if (raf) view.cancelAnimationFrame(raf); raf = 0; last = null; };
  function paint() {
    if (disposed || !width || !height || hidden()) return;
    const now = cloudMotionNow(view);
    if (!motion?.matches && visible) advanceCloudFlow(flow, now, wind.speed, wind.degree);
    const appearance = smoothCloudAppearance(flow.appearance ||= {}, target, now, motion?.matches);
    nodes.forEach((node, index) => {
      const pose = sampleCloudLayer(flow, cloudSeed([index * 3.7, 0, -index]), .38, poses[index]);
      node.style.setProperty('left', '0', 'important');
      node.style.setProperty('top', '0', 'important');
      node.style.setProperty('transform', `translate3d(${(([-.16, .24, .62][index] + pose.x) * width).toFixed(2)}px,${((pose.y + [0, .08, -.08][index]) * height).toFixed(2)}px,0) scale(${(pose.scaleX * appearance.spreadX).toFixed(4)},${(pose.scaleY * appearance.flattenY).toFixed(4)})`, 'important');
      node.style.setProperty('opacity', (pose.opacity * [.5, .45, .4][index] * appearance.opacity).toFixed(4), 'important');
    });
  }
  function frame(time) {
    raf = 0;
    if (disposed || hidden() || !visible || motion?.matches || !width || !height) { stop(); return; }
    if (last === null || time - last >= 1000 / 30 - .01) { last = time; paint(); }
    raf = view.requestAnimationFrame(frame);
  }
  function sync() {
    if (disposed) return;
    const rect = container.getBoundingClientRect(); width = rect.width; height = rect.height;
    paint();
    if (hidden() || !visible || motion?.matches || !width || !height) stop();
    else if (!raf) raf = view.requestAnimationFrame(frame);
  }
  function dispose() {
    if (disposed) return;
    disposed = true; stop(); resizeObserver?.disconnect(); intersectionObserver?.disconnect();
    document.removeEventListener('visibilitychange', sync); view.removeEventListener('resize', sync);
    if (motion?.removeEventListener) motion.removeEventListener('change', sync); else motion?.removeListener?.(sync);
  }
  try {
    if (view.ResizeObserver) { resizeObserver = new view.ResizeObserver(sync); resizeObserver.observe(container); }
    if (view.IntersectionObserver) {
      intersectionObserver = new view.IntersectionObserver(entries => { const entry = entries.find(item => item.target === container); if (entry) { visible = entry.isIntersecting; sync(); } });
      intersectionObserver.observe(container);
    }
    document.addEventListener('visibilitychange', sync);
    view.addEventListener('resize', sync, { passive: true });
    if (motion?.addEventListener) motion.addEventListener('change', sync); else motion?.addListener?.(sync);
    sync();
    return { dispose };
  } catch (error) { dispose(); throw error; }
}
