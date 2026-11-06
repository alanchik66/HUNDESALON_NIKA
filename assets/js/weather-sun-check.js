const STYLE_FIELDS = ['display', 'visibility', 'opacity', 'overflowX', 'overflowY', 'clipPath', 'maskImage', 'webkitMaskImage', 'filter', 'backdropFilter', 'contain', 'transform', 'mixBlendMode'];
const features = source => ({ rays: /float\s+rays\b/u.test(source || ''), ghost: /apertureGhost/u.test(source || ''), gaussian: /solarGaussian/u.test(source || ''),
  legacySignedSquares: /pow\s*\(\s*\((?:edge\b|y\s*-\s*arch\b|length\(p\s*-\s*direction\b)/u.test(source || '') });
function appearance(node) {
  if (!node) return null;
  const style = getComputedStyle(node), bounds = node.getBoundingClientRect();
  return { tag: node.tagName, classes: typeof node.className === 'string' ? node.className : '',
    rect: [bounds.left, bounds.top, bounds.width, bounds.height].map(value => Math.round(value * 100) / 100),
    ...Object.fromEntries(STYLE_FIELDS.map(key => [key, style[key] || ''])) };
}
function exterior(bytes, width, height) {
  let samples = 0, nonzero = 0, above8 = 0, maxAlpha = 0, sum = 0;
  const angularMax = Array(24).fill(0);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const dx = (x + .5) / width - .5, dy = (y + .5) / height - .5, radius = Math.hypot(dx, dy);
    if (radius <= .27 || radius >= .475) continue;
    const alpha = bytes[(y * width + x) * 4 + 3];
    samples++; sum += alpha; maxAlpha = Math.max(maxAlpha, alpha);
    if (alpha) {
      nonzero++; if (alpha > 8) above8++;
      const bin = Math.min(23, Math.floor((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI) * 24));
      angularMax[bin] = Math.max(angularMax[bin], alpha);
    }
  }
  return { radialRange: [.27, .475], samples, nonzero, above8, maxAlpha, meanAlpha: samples ? sum / samples : 0, angularMax };
}
function inspectSun(overlay) {
  const canvas = overlay.querySelector('canvas'), image = overlay.querySelector('img'), scene = overlay.__sunScene;
  const renderer = scene?.renderer, gl = renderer?.getContext?.(), lost = gl?.isContextLost?.() ?? null;
  const report = { role: overlay.classList.contains('weather-orb-overlay--dropdown') ? 'dropdown' : 'preview',
    sunScene: overlay.dataset.sunScene || null, sunSurface: overlay.dataset.sunSurface || null,
    scene: scene ? { state: scene.state, running: !!scene.running, disposed: !!scene.disposed, contextLost: !!scene.contextLost } : null,
    canvas: canvas ? { hidden: canvas.hidden, css: [canvas.clientWidth, canvas.clientHeight], backing: [canvas.width, canvas.height], appearance: appearance(canvas) } : null,
    image: image ? { hidden: image.hidden, natural: [image.naturalWidth, image.naturalHeight], appearance: appearance(image) } : null,
    glLost: lost, programs: [], materialFeatures: features(scene?.flareMesh?.material?.fragmentShader), ancestors: [] };
  for (let node = overlay, i = 0; node && i < 16; i++, node = node.parentElement || node.getRootNode?.().host) report.ancestors.push(appearance(node));
  if (!gl || !canvas || lost || scene?.disposed) { report.readback = { valid: false, skipped: lost ? 'context-lost' : 'existing-renderer-unavailable' }; return report; }
  try {
    report.contextAttributes = gl.getContextAttributes();
    report.programs = (renderer.info?.programs || []).map(program => ({
      linked: gl.getProgramParameter(program.program, gl.LINK_STATUS),
      vertexCompiled: gl.getShaderParameter(program.vertexShader, gl.COMPILE_STATUS),
      fragmentCompiled: gl.getShaderParameter(program.fragmentShader, gl.COMPILE_STATUS),
      programLog: (gl.getProgramInfoLog(program.program) || '').slice(0, 1600),
      vertexLog: (gl.getShaderInfoLog(program.vertexShader) || '').slice(0, 1600),
      fragmentLog: (gl.getShaderInfoLog(program.fragmentShader) || '').slice(0, 1600),
      fragmentFeatures: features(gl.getShaderSource(program.fragmentShader)) }));
    const errors = () => { const values = []; for (let i = 0; i < 8; i++) { const value = gl.getError(); if (value === gl.NO_ERROR) break; values.push(value); } return values; };
    report.glErrorsBefore = errors();
    scene.renderFrame();
    const width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
    if (!width || !height || width * height > 1048576) report.readback = { valid: false, skipped: 'buffer-size-out-of-bounds' };
    else {
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      report.glErrors = errors();
      report.readback = report.glErrors.length
        ? { valid: false, method: 'atomic-render-readPixels', error: 'webgl-error' }
        : { valid: true, method: 'atomic-render-readPixels', backing: [width, height], exterior: exterior(pixels, width, height) };
    }
  } catch (error) { report.readback = { valid: false, error: error?.name || 'readback-failed' }; }
  return report;
}

export function mountWeatherSunCheck() {
  if (new URLSearchParams(window.location.search).get('solar-check') !== '1') return () => {};
  const existing = document.querySelector('[data-solar-check]');
  if (existing) return existing.__dispose;
  const panel = document.createElement('section');
  panel.id = 'weather-sun-check'; panel.setAttribute('data-solar-check', ''); panel.setAttribute('aria-label', 'Проверка Солнца');
  panel.style.cssText = 'position:fixed;z-index:2147483647;left:8px;right:8px;bottom:max(8px,env(safe-area-inset-bottom));max-height:40vh;overflow:auto;background:#071610;color:#e8f2e9;border:1px solid #658678;border-radius:10px;padding:10px;font:12px/1.4 system-ui;text-align:left';
  const status = document.createElement('p'), pre = document.createElement('pre');
  status.setAttribute('data-solar-check-status', ''); pre.setAttribute('data-solar-check-report', '');
  pre.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;font:11px/1.35 monospace;user-select:text';
  const button = (name, label) => { const node = document.createElement('button'); node.type = 'button'; node.textContent = label; node.setAttribute(`data-solar-check-${name}`, ''); node.style.cssText = 'margin:3px;padding:7px;font:inherit'; panel.append(node); return node; };
  panel.append(status);
  const copy = button('copy', 'Копировать JSON'), retry = button('retry', 'Повторить'), close = button('close', 'Закрыть');
  panel.append(pre); document.body.append(panel);
  let closed = false, generation = 0, timer = 0, wake = null, snapshot = '';
  const cancel = () => { clearTimeout(timer); timer = 0; wake?.(); wake = null; };
  const dispose = () => { closed = true; generation++; cancel(); panel.remove(); };
  panel.__dispose = dispose;
  const run = async () => {
    const current = ++generation; cancel(); copy.disabled = true; status.textContent = 'Ожидание Солнца — до 30 секунд…';
    const deadline = performance.now() + 30000;
    let overlays = [];
    while (!closed && current === generation) {
      overlays = [...(document.querySelector('.header-weather-widget')?.shadowRoot?.querySelectorAll('.is-header-sun') || [])];
      const preview = overlays.find(overlay => overlay.classList.contains('weather-orb-overlay--preview'));
      if (['ready', 'failed', 'lost'].includes(preview?.dataset.sunScene) || performance.now() >= deadline) break;
      await new Promise(resolve => { wake = resolve; timer = setTimeout(resolve, 250); });
    }
    if (closed || current !== generation) return;
    let script;
    try { script = new URL(document.querySelector('script[src*="/assets/js/site-shell.js"]')?.src, window.location.origin); } catch { /* Missing shell source remains unknown. */ }
    if (script?.origin !== window.location.origin || !script.pathname.endsWith('/assets/js/site-shell.js')) script = null;
    const version = script?.searchParams.get('v') || '';
    const report = { buildStamp: /^[\w.-]{1,96}$/u.test(version) ? version : null,
      viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio, scale: window.visualViewport?.scale || 1 },
      sun: overlays.map(inspectSun) };
    snapshot = JSON.stringify(report, null, 2); pre.textContent = snapshot; copy.disabled = false;
    const first = report.sun[0];
    status.textContent = first ? `Sun: ${first.sunScene}; WebGL: ${first.programs.filter(program => program.linked).length}/${first.programs.length}; внешний свет: ${first.readback?.exterior?.nonzero ?? 'нет данных'} px` : 'Слой Солнца не найден за 30 секунд.';
  };
  copy.addEventListener('click', async () => {
    if (!snapshot) return;
    try { await navigator.clipboard.writeText(snapshot); if (!closed) status.textContent = 'Технический JSON скопирован.'; }
    catch { if (!closed) status.textContent = 'Копирование недоступно. JSON можно выделить ниже.'; }
  });
  retry.addEventListener('click', () => { void run(); }); close.addEventListener('click', dispose);
  void run();
  return dispose;
}
