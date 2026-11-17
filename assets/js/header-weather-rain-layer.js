const MAX_DPR = 2;
const FRAME_MS = 1000 / 30;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const number = (value, fallback) => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value)) ? Number(value) : fallback;
const wrap = (value, size) => ((value % size) + size) % size;

function appearance(options) {
  const input = options && typeof options === 'object' ? options : {};
  const kind = ['rain', 'drizzle', 'hail'].includes(input.kind) ? input.kind : 'none';
  const categoryRate = { light: .5, moderate: 4, heavy: 12, violent: 35 }[input.intensity];
  const precipitation = clamp(number(input.precipitationMm, categoryRate ?? (kind === 'drizzle' ? .2 : .5)), 0, 100);
  const wind = clamp(number(input.windKph, 0), 0, 180);
  const direction = wrap(number(input.windDegree, 0), 360) * Math.PI / 180;
  return {
    kind, active: kind !== 'none',
    intensity: clamp(.08 + Math.log1p(precipitation) * .25, .08, 1),
    // Screen-space art calibration; the widget is not a geographic camera.
    slant: -Math.sin(direction) * Math.min(.72, wind / 95),
  };
}

function droplets() {
  let seed = 0x4e494b41;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  return Array.from({ length: 220 }, () => ({ x: random() * 1.2 - .1, y: random() * 1.12 - .06, depth: random() ** 1.4, drift: random(), size: .8 + random() * .4, sway: random() * Math.PI * 2, opacity: 0 }));
}

/** A transparent foreground. Weather classification stays with the caller. */
export function createHeaderWeatherRainLayer(container, options = {}) {
  const document = container?.ownerDocument;
  if (!document?.createElement || typeof container.appendChild !== 'function') throw new TypeError('Rain layer requires a DOM container.');
  const view = document.defaultView || globalThis;
  const canvas = document.createElement('canvas');
  canvas.className = 'header-weather-rain-layer';
  canvas.dataset.weatherLayer = 'rain';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;pointer-events:none!important;z-index:200!important;transform:none!important;filter:none!important;mix-blend-mode:normal!important;background:transparent!important;';
  let context, resizeObserver, intersectionObserver, media;
  let disposed = false, raf = 0, width = 0, height = 0, dpr = 1;
  let elapsed = 0, lastTick = null, lastPaint = null, intersecting = true;
  let state = appearance(options), visibilityAttached = false, viewportAttached = false, mediaAttached = false;
  const visual = { intensity: state.intensity, slant: state.slant };
  const drops = droplets();
  let initialized = false;
  const request = callback => view.requestAnimationFrame(callback);
  const cancel = id => view.cancelAnimationFrame(id);
  const hidden = () => document.hidden || document.visibilityState === 'hidden';

  function stop() {
    if (raf) cancel(raf);
    raf = 0; lastTick = null; lastPaint = null;
  }

  function count() {
    const density = state.kind === 'drizzle' ? .72 : state.kind === 'hail' ? .65 : 1;
    return clamp(width * height / 1200 * (.12 + visual.intensity * 1.25) * density, 3, drops.length);
  }

  function speed(drop) {
    const scale = clamp(height / 160, .72, 1.4);
    return (state.kind === 'drizzle' ? 65 + drop.depth * 110 : state.kind === 'hail' ? 180 + drop.depth * 330 : 125 + drop.depth * 310) * scale * drop.size;
  }

  function advance(dt) {
    const blend = 1 - Math.exp(-dt * 3);
    visual.intensity += (state.intensity - visual.intensity) * blend;
    visual.slant += (state.slant - visual.slant) * blend;
    const targetCount = count();
    for (let index = 0; index < drops.length; index++) {
      const drop = drops[index], vy = speed(drop);
      drop.opacity += ((index < targetCount ? 1 : 0) - drop.opacity) * blend;
      drop.y += vy / height * dt;
      drop.x += vy * (visual.slant + Math.sin(elapsed * .8 + drop.sway) * .014) / width * dt;
      // Recycling happens outside the visible sky, never in its interior.
      if (drop.y > 1.12) { drop.y -= 1.24; drop.x = wrap(drop.x + .37 + drop.drift * .43, 1.2) - .1; }
      if (drop.x < -.12) drop.x += 1.24;
      else if (drop.x > 1.12) drop.x -= 1.24;
    }
  }

  function paint() {
    context.clearRect(0, 0, width, height);
    if (!state.active || !width || !height) return;
    if (!initialized) { const initialCount = count(); drops.forEach((drop, index) => { drop.opacity = index < initialCount ? 1 : 0; }); initialized = true; }
    const hail = state.kind === 'hail', drizzle = state.kind === 'drizzle';
    for (const drop of drops) {
      if (drop.opacity < .005) continue;
      const depth = drop.depth, x = drop.x * width, y = drop.y * height;
      const slant = visual.slant + Math.sin(elapsed * .8 + drop.sway) * .014;
      // A short optical exposure, not a large pointed water-drop silhouette.
      const length = speed(drop) * (hail ? .006 : drizzle ? .014 : .018);
      const alpha = (.035 + depth * .095) * drop.opacity;
      const gradient = context.createLinearGradient(x - slant * length, y - length, x, y);
      gradient.addColorStop(0, 'rgba(199,216,228,0)');
      gradient.addColorStop(.6, `rgba(205,224,237,${alpha * .3})`);
      gradient.addColorStop(1, `rgba(220,235,244,${alpha})`);
      context.strokeStyle = gradient;
      context.lineWidth = hail ? .5 + depth * .7 : .3 + depth * .65;
      context.lineCap = 'round';
      context.beginPath(); context.moveTo(x - slant * length, y - length); context.lineTo(x, y); context.stroke();
      const radius = (hail ? .65 + depth * 1.35 : .2 + depth * .45) * drop.size;
      context.fillStyle = hail ? `rgba(185,204,217,${(.2 + depth * .32) * drop.opacity})` : `rgba(222,237,246,${alpha * 1.2})`;
      context.beginPath(); context.ellipse(x, y, radius, radius * (hail ? .85 : 1.15), -Math.atan(slant), 0, Math.PI * 2); context.fill();
      if (hail) {
        context.fillStyle = `rgba(245,249,251,${(.28 + depth * .28) * drop.opacity})`;
        context.beginPath(); context.ellipse(x - radius * .25, y - radius * .3, radius * .42, radius * .33, 0, 0, Math.PI * 2); context.fill();
      }
    }
  }

  function shouldAnimate() {
    return !disposed && container.isConnected !== false && state.active && width > 0 && height > 0 && intersecting && !hidden() && !media?.matches;
  }

  function frame(timestamp) {
    raf = 0;
    if (!shouldAnimate()) { stop(); return; }
    if (lastTick === null) { lastTick = timestamp; lastPaint = timestamp; }
    else {
      const dt = clamp((timestamp - lastTick) / 1000, 0, .1);
      elapsed += dt; advance(dt); lastTick = timestamp;
      if (timestamp - lastPaint >= FRAME_MS - .01) { paint(); lastPaint = timestamp; }
    }
    raf = request(frame);
  }

  function sync(redraw = false) {
    if (disposed) return;
    const visible = container.isConnected !== false && state.active && width > 0 && height > 0;
    canvas.hidden = !visible;
    canvas.style.setProperty('display', visible ? 'block' : 'none', 'important');
    canvas.style.setProperty('visibility', visible ? 'visible' : 'hidden', 'important');
    if (!visible) { stop(); context.clearRect(0, 0, width, height); return; }
    if (redraw && media?.matches) { visual.intensity = state.intensity; visual.slant = state.slant; initialized = false; }
    if (redraw && intersecting && !hidden()) paint();
    if (!shouldAnimate()) { stop(); return; }
    if (!raf) raf = request(frame);
  }

  function resize(redraw = false) {
    if (disposed) return;
    const rect = container.getBoundingClientRect();
    const nextWidth = Math.max(0, number(rect.width, 0)), nextHeight = Math.max(0, number(rect.height, 0));
    const nextDpr = clamp(number(view.devicePixelRatio, 1), 1, MAX_DPR);
    const changed = nextWidth !== width || nextHeight !== height || nextDpr !== dpr;
    if (changed) {
      width = nextWidth; height = nextHeight; dpr = nextDpr;
      canvas.width = Math.max(1, Math.round(width * dpr)); canvas.height = Math.max(1, Math.round(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    sync(changed || redraw === true);
  }

  const onVisibility = () => sync(true);
  const onMotion = () => sync(true);
  const onViewport = () => {
    const rect = container.getBoundingClientRect();
    intersecting = rect.bottom > 0 && rect.right > 0 && rect.top < view.innerHeight && rect.left < view.innerWidth;
    resize(true);
  };

  function dispose() {
    if (disposed) return;
    disposed = true; stop();
    resizeObserver?.disconnect(); intersectionObserver?.disconnect();
    if (visibilityAttached) document.removeEventListener('visibilitychange', onVisibility);
    if (viewportAttached) { view.removeEventListener('resize', onViewport); view.removeEventListener('scroll', onViewport, true); }
    if (mediaAttached) { if (media.removeEventListener) media.removeEventListener('change', onMotion); else media.removeListener?.(onMotion); }
    canvas.remove(); context = null;
  }

  try {
    context = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!context) throw new Error('Native rain canvas unavailable.');
    container.appendChild(canvas);
    media = view.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (media?.addEventListener) { media.addEventListener('change', onMotion); mediaAttached = true; }
    else if (media?.addListener) { media.addListener(onMotion); mediaAttached = true; }
    document.addEventListener('visibilitychange', onVisibility); visibilityAttached = true;
    if (view.ResizeObserver) { resizeObserver = new view.ResizeObserver(resize); resizeObserver.observe(container); }
    if (view.IntersectionObserver) {
      intersectionObserver = new view.IntersectionObserver(entries => { const entry = entries.find(item => item.target === container); if (entry) { intersecting = entry.isIntersecting; sync(true); } });
      intersectionObserver.observe(container);
    }
    if (!view.ResizeObserver || !view.IntersectionObserver) { view.addEventListener('resize', onViewport, { passive: true }); view.addEventListener('scroll', onViewport, { passive: true, capture: true }); viewportAttached = true; }
    onViewport();
  } catch (error) { dispose(); throw error; }

  return {
    update(next = {}) { if (!disposed) { const incoming = appearance(next), changed = Object.keys(incoming).some(key => incoming[key] !== state[key]); state = incoming; resize(changed); } },
    dispose,
  };
}
