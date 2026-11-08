const MAX_DPR = 2;
const FRAME_MS = 1000 / 30;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const number = (value, fallback) => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value)) ? Number(value) : fallback;
const wrap = (value, size) => ((value % size) + size) % size;

function appearance(options) {
  const input = options && typeof options === 'object' ? options : {};
  const precipitation = clamp(number(input.precipitationMm, .25), 0, 100);
  const wind = clamp(number(input.windKph, 0), 0, 180);
  const direction = wrap(number(input.windDegree, 0), 360) * Math.PI / 180;
  return {
    active: input.kind === 'rain', precipitation,
    intensity: clamp(.14 + Math.log1p(precipitation) * .18, .14, 1),
    // Screen-space art calibration; the widget is not a geographic camera.
    slant: -Math.sin(direction) * Math.min(.65, wind / 100),
    speed: 1 + Math.min(wind, 100) / 250,
  };
}

function droplets() {
  let seed = 0x4e494b41;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  return Array.from({ length: 170 }, () => ({ x: random(), phase: random(), depth: random() ** 1.5, drift: random(), length: .7 + random() * .6, sway: random() * Math.PI * 2 }));
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
  const drops = droplets();
  const request = callback => view.requestAnimationFrame(callback);
  const cancel = id => view.cancelAnimationFrame(id);
  const hidden = () => document.hidden || document.visibilityState === 'hidden';

  function stop() {
    if (raf) cancel(raf);
    raf = 0; lastTick = null; lastPaint = null;
  }

  function paint() {
    context.clearRect(0, 0, width, height);
    if (!state.active || !width || !height) return;
    const count = Math.round(clamp(width * height / 1600 * (.3 + .7 * state.intensity), 10, drops.length));
    const scale = clamp(height / 160, .72, 1.4);
    for (let index = 0; index < count; index++) {
      const drop = drops[index], depth = drop.depth;
      const length = (5 + depth * 15) * drop.length * scale;
      const speed = height * (.65 + depth * 1.6) * state.speed;
      const span = height + length * 2, travel = elapsed * speed + drop.phase * span;
      const cycle = Math.floor(travel / span), local = wrap(travel, span), y = local - length;
      const slant = state.slant + Math.sin(elapsed * .33 + drop.sway) * .018;
      const margin = length + Math.abs(slant) * height;
      const x = wrap(drop.x * width + cycle * drop.drift * width + slant * local, width + margin * 2) - margin;
      const alpha = (.024 + depth * .105) * (.65 + state.intensity * .35);
      const gradient = context.createLinearGradient(x - slant * length, y - length, x, y);
      gradient.addColorStop(0, 'rgba(203,225,239,0)');
      gradient.addColorStop(.65, `rgba(211,233,247,${alpha * .45})`);
      gradient.addColorStop(1, `rgba(238,249,255,${alpha})`);
      context.strokeStyle = gradient;
      context.lineWidth = .38 + depth * .82;
      context.lineCap = depth > .6 ? 'round' : 'butt';
      context.beginPath(); context.moveTo(x - slant * length, y - length); context.lineTo(x, y); context.stroke();
      // A few quiet impact glints belong only to a taller, wet scene.
      if (height >= 100 && state.precipitation >= .7 && index % 17 === 0) {
        const age = wrap(elapsed * (.7 + depth) + drop.phase, 1) / .16;
        if (age < 1) {
          const center = drop.x * width, spread = 1 + age * 3;
          context.strokeStyle = `rgba(213,237,248,${.045 * (1 - age) * state.intensity})`;
          context.lineWidth = .55;
          context.beginPath(); context.moveTo(center - spread, height - 1 - Math.sin(age * Math.PI) * 2); context.lineTo(center, height - 1); context.lineTo(center + spread, height - 1 - Math.sin(age * Math.PI) * 2); context.stroke();
        }
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
      elapsed += clamp((timestamp - lastTick) / 1000, 0, .1); lastTick = timestamp;
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
