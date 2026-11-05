// The assistant's neon ribbon, adapted to the perimeter of a capsule button.
// This module owns decoration only: it never changes a control's action or ARIA.
export const MENU_CONTOUR_COLORS = Object.freeze([
  'rgb(255, 64, 95)', 'rgb(255, 102, 55)', 'rgb(255, 160, 48)',
  'rgb(255, 211, 67)', 'rgb(228, 255, 94)', 'rgb(128, 245, 116)',
  'rgb(56, 234, 163)', 'rgb(45, 232, 213)', 'rgb(62, 212, 255)',
  'rgb(80, 166, 255)', 'rgb(111, 122, 255)', 'rgb(164, 99, 255)',
  'rgb(213, 91, 248)', 'rgb(255, 87, 210)', 'rgb(255, 105, 161)',
]);
export const MENU_CONTOUR_TIMING = Object.freeze({ cycleMs: 6400, hueMs: 12800 });
const TAIL = 78 / 180;
const PAD = 16;
const WEATHER_HOST = '.header-weather-widget[data-weather-widget]';
const instances = new WeakMap();
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const period = (time, duration) => ((time % duration) + duration) % duration / duration;
const positive = (value, fallback) => Number.isFinite(value) && value > 0 ? value : fallback;

function geometry(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const radius = Math.min(width, height) / 2;
  const edge = width / 2 - radius;
  const vertical = height - 2 * radius;
  const arc = Math.PI * radius / 2;
  return { width, height, radius, edge, vertical, arc, length: 2 * edge + 2 * arc + vertical };
}

function pointOnCapsule(shape, fraction, side) {
  const { width, height, radius, edge, vertical, arc, length } = shape;
  let distance = clamp(fraction) * length;
  let x, y, nx, ny;
  if (distance <= edge) [x, y, nx, ny] = [width / 2 - distance, height, 0, 1];
  else if ((distance -= edge) <= arc) {
    const angle = Math.PI / 2 + distance / radius;
    [nx, ny] = [Math.cos(angle), Math.sin(angle)];
    [x, y] = [radius + nx * radius, height - radius + ny * radius];
  } else if ((distance -= arc) <= vertical) [x, y, nx, ny] = [0, height - radius - distance, -1, 0];
  else if ((distance -= vertical) <= arc) {
    const angle = Math.PI + distance / radius;
    [nx, ny] = [Math.cos(angle), Math.sin(angle)];
    [x, y] = [radius + nx * radius, radius + ny * radius];
  } else [x, y, nx, ny] = [radius + distance - arc, 0, 0, -1];
  return side > 0 ? { x: width - x, y, nx: -nx, ny } : { x, y, nx, ny };
}

export function capsulePoint(width, height, fraction, side = -1) {
  const shape = geometry(width, height);
  return shape && Number.isFinite(fraction) ? pointOnCapsule(shape, fraction, side) : null;
}

export function contourHalfWidth(progress) {
  return progress <= 0 || progress >= 1 ? 0 : 0.325 * Math.sin(progress * Math.PI) ** 1.5;
}

function ease(value) {
  const x = clamp(value);
  let t = x;
  for (let index = 0; index < 6; index += 1) {
    const inverse = 1 - t;
    const position = 1.26 * inverse * inverse * t + 1.74 * inverse * t * t + t ** 3;
    const derivative = 1.26 * inverse * inverse + 0.96 * inverse * t + 1.26 * t * t;
    t = clamp(t - (position - x) / Math.max(derivative, 0.001));
  }
  return 3 * (1 - t) * t * t + t ** 3;
}

function flash(phase, stops) {
  let index = 1;
  while (index < stops.length - 1 && phase > stops[index][0]) index += 1;
  const [start, alpha, scale] = stops[index - 1];
  const [end, nextAlpha, nextScale] = stops[index];
  const progress = ease((phase - start) / (end - start));
  return { opacity: alpha + (nextAlpha - alpha) * progress, scale: scale + (nextScale - scale) * progress };
}

function ribbon(shape, head, side) {
  const first = Math.max(0, (TAIL - head) / TAIL);
  const last = Math.min(1, (1 + TAIL - head) / TAIL);
  if (first >= last) return [];
  const outer = [], inner = [];
  for (let index = 0; index <= 32; index += 1) {
    const progress = first + (last - first) * index / 32;
    const point = pointOnCapsule(shape, head - TAIL + TAIL * progress, side);
    const width = contourHalfWidth(progress);
    outer.push([point.x + point.nx * width, point.y + point.ny * width]);
    inner.push([point.x - point.nx * width, point.y - point.ny * width]);
  }
  return outer.concat(inner.reverse());
}

export function buildContourFrame(width, height, timeMs, timing = MENU_CONTOUR_TIMING) {
  const shape = geometry(width, height);
  if (!shape) return null;
  const time = Number.isFinite(timeMs) ? timeMs : 0;
  const phase = period(time, positive(timing.cycleMs, 6400));
  const head = phase <= 0.84 ? ease(phase / 0.84) : 1 + TAIL * ease((phase - 0.84) / 0.16);
  const trailOpacity = phase < 0.12 ? phase / 0.12 * 0.36 : phase <= 0.82 ? 0.36 : (1 - phase) / 0.18 * 0.36;
  return {
    phase, head, hue: period(time, positive(timing.hueMs, 12800)) * 360, trailOpacity,
    halo: 1 + Math.sin(phase * Math.PI) ** 2 * 0.25,
    origin: flash(phase, [[0, 0, 0.15], [0.02, 1, 0.75], [0.08, 0.32, 0.95], [0.18, 0, 1.1], [1, 0, 1.1]]),
    meeting: flash(phase, [[0, 0, 0.2], [0.84, 0, 0.2], [0.87, 1, 1], [0.92, 0.42, 1.25], [1, 0, 1.6]]),
    branches: [-1, 1].map(side => ({ side, polygon: ribbon(shape, head, side), trail: ribbon(shape, head - 0.1, side) })),
  };
}

function milliseconds(value, fallback) {
  const text = String(value || '').trim();
  return positive(Number.parseFloat(text) * (text.endsWith('ms') ? 1 : 1000), fallback);
}

export function readContourReference(document, window) {
  const stops = [...(document.querySelectorAll('#hundesalon-ai-chat .hn-ai-launcher-rim linearGradient stop') || [])];
  const colors = stops.map(stop => stop.getAttribute('stop-color'));
  const trace = document.querySelector('#hundesalon-ai-chat .hn-ai-launcher-rim-trace');
  const durations = trace && String(window.getComputedStyle(trace).animationDuration || '').split(',');
  return {
    colors: colors.length === 15 && colors.every(Boolean) ? colors : MENU_CONTOUR_COLORS,
    cycleMs: milliseconds(durations?.[0], 6400), hueMs: milliseconds(durations?.[1], 12800),
  };
}

function hueColor(color, degrees) {
  const rgb = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (rgb?.length !== 3 || rgb.some(value => !Number.isFinite(value))) return color;
  const [r, g, b] = rgb.map(value => value / 255);
  const maximum = Math.max(r, g, b), minimum = Math.min(r, g, b), delta = maximum - minimum;
  let hue = delta === 0 ? 0 : maximum === r ? ((g - b) / delta) % 6 : maximum === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  hue = (hue * 60 + degrees + 360) % 360;
  const lightness = (maximum + minimum) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return `hsl(${hue} ${saturation * 100}% ${lightness * 100}%)`;
}

function polygon(context, points) {
  if (!points.length) return false;
  context.beginPath();
  context.moveTo(...points[0]);
  for (const point of points.slice(1)) context.lineTo(...point);
  context.closePath();
  return true;
}

function drawFlash(context, x, y, pulse, size, ratio) {
  if (pulse.opacity <= 0) return;
  context.save();
  context.translate(x, y);
  context.scale(pulse.scale, pulse.scale);
  context.globalAlpha = pulse.opacity;
  const glow = context.createRadialGradient(0, 0, 0, 0, 0, size * 1.8);
  [['0', '#f8fff6'], ['0.12', '#dbffef'], ['0.36', '#53ffb5'], ['0.68', '#00ce8733'], ['1', '#00875900']]
    .forEach(([offset, color]) => glow.addColorStop(Number(offset), color));
  context.fillStyle = glow;
  context.shadowColor = 'rgba(0,230,147,.55)';
  context.shadowBlur = 4 * ratio;
  polygon(context, [[0, -size], [size * 0.1, -size * 0.1], [size, 0], [size * 0.1, size * 0.1], [0, size], [-size * 0.1, size * 0.1], [-size, 0], [-size * 0.1, -size * 0.1]]);
  context.fill();
  context.beginPath();
  context.arc(0, 0, 0.65, 0, Math.PI * 2);
  context.fillStyle = '#f6fff9';
  context.fill();
  context.restore();
}

function draw(record, elapsed, reference) {
  const { context, width, height, ratio } = record;
  const frame = buildContourFrame(width - 1, height - 1, elapsed, record.timing);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width + PAD * 2, height + PAD * 2);
  context.save();
  context.translate(PAD + 0.5, PAD + 0.5);
  const outline = [];
  for (let index = 0; index <= 48; index += 1) { const point = capsulePoint(width - 1, height - 1, index / 48); outline.push([point.x, point.y]); }
  for (let index = 48; index >= 0; index -= 1) { const point = capsulePoint(width - 1, height - 1, index / 48, 1); outline.push([point.x, point.y]); }
  polygon(context, outline);
  context.lineWidth = 0.35;
  context.strokeStyle = 'rgba(0,220,150,.06)';
  context.shadowColor = `rgba(0,220,150,${0.22 * frame.halo})`;
  context.shadowBlur = 5 * ratio;
  context.stroke();
  context.globalCompositeOperation = 'lighter';
  const gradient = context.createLinearGradient(0, height, width, 0);
  reference.colors.forEach((color, index) => gradient.addColorStop(index / 14, hueColor(color, frame.hue)));
  for (const branch of frame.branches) {
    if (polygon(context, branch.trail)) {
      context.globalAlpha = frame.trailOpacity;
      context.fillStyle = '#00e897';
      context.shadowColor = '#00c982';
      context.shadowBlur = 4 * ratio;
      context.fill();
    }
    if (polygon(context, branch.polygon)) {
      context.globalAlpha = 1;
      context.fillStyle = gradient;
      context.shadowColor = 'rgba(0,201,130,.85)';
      context.shadowBlur = 2.4 * ratio;
      context.fill();
      context.shadowColor = 'rgba(213,255,235,.92)';
      context.shadowBlur = 0.7 * ratio;
      context.fill();
    }
  }
  context.globalAlpha = 1;
  const size = clamp(height * 0.12, 3, 5);
  drawFlash(context, (width - 1) / 2, height - 1, frame.origin, size, ratio);
  drawFlash(context, (width - 1) / 2, 0, frame.meeting, size, ratio);
  context.restore();
  return frame;
}

export const MENU_CONTOUR_STYLES = `
[data-menu-contour] { position:relative; overflow:visible!important; isolation:isolate; border-radius:999px!important; }
[data-menu-contour] > canvas.site-menu-contour,
.weather-header-preview [data-menu-contour] > canvas.site-menu-contour {
  position:absolute!important; inset:auto!important; display:block!important;
  min-width:0!important; min-height:0!important; max-width:none!important; max-height:none!important;
  border:0!important; border-radius:0!important; background:transparent!important;
  clip-path:none!important; -webkit-mask:none!important; mask:none!important;
  transform:none!important; filter:none!important; opacity:1!important; pointer-events:none!important; z-index:2;
}
[data-menu-contour='ready']::before { display:none!important; }
`;

export function initMenuContours(environment = globalThis) {
  const window = environment.window || environment;
  const document = environment.document || window.document;
  if (!document || typeof window.requestAnimationFrame !== 'function') return null;
  if (instances.has(document)) return instances.get(document);
  const Mutation = environment.MutationObserver || window.MutationObserver;
  const Intersection = environment.IntersectionObserver || window.IntersectionObserver;
  const Resize = environment.ResizeObserver || window.ResizeObserver;
  const bindings = new WeakMap(), failed = new WeakSet(), records = new Set(), roots = new Map();
  const reference = readContourReference(document, window);
  let disposed = false, suspended = false, frameId = 0, scanPending = false, origin = null;
  const addStyle = root => {
    const container = root === document ? document.head : root;
    if (!container || root.querySelector('style[data-menu-contour-styles]')) return;
    const style = document.createElement('style');
    style.setAttribute('data-menu-contour-styles', '');
    style.textContent = MENU_CONTOUR_STYLES;
    container.appendChild(style);
  };
  const remove = record => {
    intersection?.unobserve(record.target);
    resize?.unobserve(record.target);
    record.canvas.remove();
    record.target.removeAttribute('data-menu-contour');
    bindings.delete(record.target);
    records.delete(record);
  };
  const measure = record => {
    const width = record.target.offsetWidth, height = record.target.offsetHeight;
    if (!(width > 1 && height > 1)) return false;
    const style = window.getComputedStyle(record.target);
    const ratio = Math.min(3, positive(window.devicePixelRatio, 1) * positive(window.visualViewport?.scale, 1));
    record.width = width; record.height = height; record.ratio = ratio;
    record.timing = { cycleMs: milliseconds(style.getPropertyValue('--menu-contour-cycle'), reference.cycleMs), hueMs: reference.hueMs };
    record.canvas.width = Math.ceil((width + PAD * 2) * ratio);
    record.canvas.height = Math.ceil((height + PAD * 2) * ratio);
    for (const [name, value] of Object.entries({
      left: -PAD - (Number.parseFloat(style.borderLeftWidth) || 0), top: -PAD - (Number.parseFloat(style.borderTopWidth) || 0),
      width: width + PAD * 2, height: height + PAD * 2,
    })) record.canvas.style.setProperty(name, `${value}px`, 'important');
    record.dirty = false;
    return true;
  };
  const hasVisible = () => [...records].some(record => record.visible && record.target.isConnected);
  const inView = target => {
    const bounds = target.getBoundingClientRect();
    return bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.top < window.innerHeight;
  };
  const run = () => {
    if (disposed || suspended || document.hidden || !hasVisible()) {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
    } else if (!frameId) frameId = window.requestAnimationFrame(tick);
  };
  const tick = timestamp => {
    frameId = 0;
    if (disposed || suspended || document.hidden) return;
    if (origin === null) origin = timestamp;
    for (const record of [...records]) {
      if (!record.target.isConnected) { remove(record); continue; }
      if (!record.visible) continue;
      try {
        const ratio = Math.min(3, positive(window.devicePixelRatio, 1) * positive(window.visualViewport?.scale, 1));
        if ((record.dirty || ratio !== record.ratio) && !measure(record)) { record.visible = false; continue; }
        record.frame = draw(record, timestamp - origin, reference);
        if (record.target.getAttribute('data-menu-contour') !== 'ready') record.target.setAttribute('data-menu-contour', 'ready');
      } catch { failed.add(record.target); remove(record); }
    }
    run();
  };
  const intersection = Intersection && new Intersection(entries => {
    for (const entry of entries) { const record = bindings.get(entry.target); if (record) record.visible = entry.isIntersecting; }
    run();
  });
  const resize = Resize && new Resize(entries => {
    for (const entry of entries) {
      const record = bindings.get(entry.target);
      if (record) { record.dirty = true; if (!intersection) record.visible = inView(record.target); }
    }
    run();
  });
  const bind = target => {
    if (bindings.has(target) || failed.has(target) || !target.isConnected) return;
    const canvas = document.createElement('canvas');
    let context;
    try { context = canvas.getContext?.('2d'); } catch { failed.add(target); return; }
    if (!context) { failed.add(target); return; }
    canvas.className = 'site-menu-contour';
    canvas.setAttribute('aria-hidden', 'true');
    const record = { target, canvas, context, visible: inView(target),
      dirty: true, ratio: 0, width: 0, height: 0 };
    bindings.set(target, record); records.add(record);
    addStyle(target.getRootNode());
    target.setAttribute('data-menu-contour', 'pending');
    target.appendChild(canvas);
    intersection?.observe(target); resize?.observe(target);
  };
  const scheduleScan = () => {
    if (scanPending || disposed) return;
    scanPending = true;
    Promise.resolve().then(() => { scanPending = false; if (!disposed) scan(); });
  };
  const scan = () => {
    if (disposed) return;
    for (const record of [...records]) if (!record.target.isConnected || record.canvas.parentNode !== record.target) remove(record);
    for (const record of records) {
      if (!intersection) record.visible = inView(record.target);
      if (!resize) record.dirty = true;
    }
    for (const [root, entry] of roots) if (!entry.host.isConnected || entry.host.shadowRoot !== root) { entry.observer?.disconnect(); roots.delete(root); }
    document.querySelectorAll('[data-price-breeds-toggle]').forEach(bind);
    document.querySelectorAll(WEATHER_HOST).forEach(host => {
      const root = host.shadowRoot;
      if (!root) return;
      if (!roots.has(root)) {
        const observer = Mutation && new Mutation(scheduleScan);
        observer?.observe(root, { childList: true, subtree: true });
        roots.set(root, { host, observer });
      }
      root.querySelectorAll('.weather-header-card__toggle').forEach(bind);
    });
    run();
  };
  const observer = Mutation && new Mutation(scheduleScan);
  const pause = () => { if (frameId) window.cancelAnimationFrame(frameId); frameId = 0; };
  const visibility = () => { if (document.hidden) pause(); else { scan(); run(); } };
  const pageHide = event => { suspended = true; pause(); if (!event.persisted) api.dispose(); };
  const pageShow = () => { suspended = false; scan(); run(); };
  const viewport = () => { for (const record of records) record.dirty = true; if (!intersection) scan(); else run(); };
  const api = {
    refresh: scan,
    getDiagnostics: () => ({ bound: records.size, visible: [...records].filter(record => record.visible).length, running: Boolean(frameId),
      cycleMs: reference.cycleMs, colorCount: reference.colors.length }),
    dispose() {
      if (disposed) return;
      disposed = true; pause(); observer?.disconnect(); intersection?.disconnect(); resize?.disconnect();
      for (const entry of roots.values()) entry.observer?.disconnect();
      roots.clear();
      for (const record of [...records]) remove(record);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('site-shell:weather-ready', scheduleScan);
      window.removeEventListener('pagehide', pageHide); window.removeEventListener('pageshow', pageShow);
      window.removeEventListener('resize', viewport); window.visualViewport?.removeEventListener('resize', viewport);
      instances.delete(document);
    },
  };
  instances.set(document, api);
  observer?.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-weather-mounted'] });
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('site-shell:weather-ready', scheduleScan);
  window.addEventListener('pagehide', pageHide); window.addEventListener('pageshow', pageShow);
  window.addEventListener('resize', viewport, { passive: true }); window.visualViewport?.addEventListener('resize', viewport, { passive: true });
  scan();
  return api;
}
