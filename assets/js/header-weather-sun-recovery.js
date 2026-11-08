/* Software 3D body and native ray recovery when the primary WebGL scene fails. */
const styleOwners = new WeakMap();
const originalImages = new WeakMap();
const SOFTWARE_SCENE_URL = new URL(`./header-weather-sun-software-scene.js${new URL(import.meta.url).search}`, import.meta.url).href;
let softwareModule;
function loadSoftwareScene() {
  if (!softwareModule) softwareModule = import(SOFTWARE_SCENE_URL).catch(error => { softwareModule = null; throw error; });
  return softwareModule;
}
// The canonical .020 × .0146 UV arch has .004 UV transparent padding on each side.
const ARCH_WIDTH_SCALE = 1.2, ARCH_HEIGHT_SCALE = .0226 / .0146;
const ARCH_ROOT_PERCENT = (100 * .0186 / .0226).toFixed(5);

function leaseStyle(node, values) {
  let record = styleOwners.get(node);
  if (!record) {
    record = { count: 0, original: new Map() };
    styleOwners.set(node, record);
  }
  record.count++;
  for (const [name, value] of Object.entries(values)) {
    if (!record.original.has(name)) record.original.set(name, [node.style.getPropertyValue(name), node.style.getPropertyPriority(name)]);
    node.style.setProperty(name, value, 'important');
  }
  return () => {
    if (--record.count) return;
    for (const [name, [value, priority]] of record.original) {
      if (value) node.style.setProperty(name, value, priority);
      else node.style.removeProperty(name);
    }
    styleOwners.delete(node);
  };
}

export async function mountNativeSunRecovery({ canvas, photometry, options, isCurrent, restore, releaseContext }) {
  const overlay = canvas.parentElement;
  const video = overlay.querySelector('video'), image = overlay.querySelector('img');
  if (!image || !isCurrent()) throw new Error('Solar recovery is no longer attached.');
  const document = canvas.ownerDocument, window = document.defaultView;
  const animation = document.createElement('img');
  animation.alt = ''; animation.decoding = 'async'; animation.setAttribute('aria-hidden', 'true');
  animation.className = 'weather-orb-overlay__animation';
  const maskSupported = !!window.CSS?.supports?.('mask-mode', 'luminance');
  const surface = document.createElement('span');
  surface.className = 'weather-orb-overlay__mask'; surface.setAttribute('aria-hidden', 'true');
  const prominences = Array.from({ length: 3 }, () => {
    const node = document.createElement('span');
    node.className = 'weather-orb-overlay__prominence'; node.setAttribute('aria-hidden', 'true');
    return node;
  });
  const opticalGhosts = Array.from({ length: photometry.opticalStates?.length || 4 }, () => {
    const node = document.createElement('span');
    node.className = 'weather-orb-overlay__optical-ghost'; node.setAttribute('aria-hidden', 'true');
    return node;
  });
  const opticalKeys = new Array(opticalGhosts.length);
  const owner = Symbol('native-sun');
  overlay.__sunRecoveryOwner = image.__sunRecoveryOwner = owner;
  if (!originalImages.has(image)) originalImages.set(image, { src: image.getAttribute('src'), hidden: image.hidden });
  const oldSurface = overlay.dataset.sunSurface;
  const oldBodyRenderer = overlay.dataset.sunBodyRenderer;
  const version = new URL(import.meta.url).search;
  const mediaFor = wide => {
    const prefix = `sun-recovery${wide ? '-wide' : ''}`;
    return { key: wide ? 'wide' : 'mobile',
      poster: new URL(`../images/weather/${prefix}-poster.png${version}`, import.meta.url).href,
      source: new URL(`../images/weather/${prefix}-loop.webp${version}`, import.meta.url).href };
  };
  const profiles = { mobile: mediaFor(false), wide: mediaFor(true) };
  const mediaKey = fallback => {
    const width = overlay.clientWidth || canvas.clientWidth / (photometry.viewportOverscan || 1.5) || overlay.getBoundingClientRect?.().width;
    return width > 0 ? width > 80 ? 'wide' : 'mobile' : fallback;
  };
  let media = profiles[mediaKey('mobile')], requestedKey = media.key;
  const arch = new URL(`../images/weather/sun-prominence-arch.png${version}`, import.meta.url).href;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const removals = [], releases = [];
  let enabled = true, visible = true, pageActive = true, posterReady = false, hasPoster = true, archReady = false, failed = false;
  let retryableMedia = true, lastMediaRetry = -Infinity;
  let pending = false, generation = 0, mediaGeneration = 0, restoring = false, lastRestore = 0, sprite, mediaPreload;
  let opticalRaf = 0, lastOpticalFrame = -Infinity;
  let softwareBody, softwarePending, lastSoftwareAttempt = -Infinity, staticBodyKey;
  const own = () => !api.disposed && image.__sunRecoveryOwner === owner && isCurrent();
  const blobMedia = typeof window.fetch === 'function' && typeof window.URL?.createObjectURL === 'function' && typeof window.URL?.revokeObjectURL === 'function';
  const assets = new Map();
  const decoders = new Map();
  const cancelDecode = node => decoders.get(node)?.cancel();
  // Aborting fetch does not settle a native Image.decode() already in progress.
  // Every decoder belongs to this recovery owner and has its own finite stage.
  const decodeImage = (node, source) => {
    cancelDecode(node);
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = error => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        if (decoders.get(node) === record) decoders.delete(node);
        if (!error && !own()) error = new globalThis.DOMException('Solar decoder owner changed.', 'AbortError');
        if (error) {
          if (node.src === source) node.removeAttribute('src');
          reject(error);
        } else resolve();
      };
      const record = { cancel: () => finish(new globalThis.DOMException('Solar decoder cancelled.', 'AbortError')) };
      const timer = setTimeout(() => finish(new globalThis.DOMException('Solar media decoding timed out.', 'TimeoutError')), 15000);
      decoders.set(node, record);
      try {
        if (!own()) { record.cancel(); return; }
        node.src = source;
        Promise.resolve(node.decode()).then(() => finish(), finish);
      } catch (error) { finish(error); }
    });
  };
  let retainedBytes = 0;
  const assetUrl = source => blobMedia ? assets.get(source)?.url || null : source;
  const releaseAsset = (source, entry = assets.get(source)) => {
    if (!entry || assets.get(source) !== entry) return;
    assets.delete(source); entry.live = false; clearTimeout(entry.timer); entry.controller.abort();
    if (entry.url) { window.URL.revokeObjectURL(entry.url); retainedBytes -= entry.bytes; }
  };
  const releaseProfile = key => {
    for (const [source, entry] of assets) if (entry.profile === key) releaseAsset(source, entry);
  };
  const loadAsset = (source, profile = null) => {
    if (!blobMedia) return Promise.resolve(source);
    if (assets.has(source)) return assets.get(source).promise;
    const controller = new (window.AbortController || globalThis.AbortController)();
    const entry = { controller, profile, live: true, url: null, bytes: 0, timer: null };
    assets.set(source, entry);
    entry.timer = setTimeout(() => controller.abort(), 25000);
    const active = () => own() && entry.live && assets.get(source) === entry && !controller.signal.aborted;
    const canceled = () => Object.assign(new Error('Solar media is no longer attached.'), { name: 'AbortError' });
    entry.promise = (async () => {
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          let retryable = true;
          try {
            if (!active()) throw canceled();
            const response = await window.fetch(source, { signal: controller.signal, credentials: 'same-origin', redirect: 'error' });
            if (!response.ok) {
              retryable = response.status >= 500 && response.status < 600;
              try { await response.body?.cancel(); } catch { /* Release an optional error body. */ }
              throw Object.assign(new Error(`Solar media request failed: ${response.status}`), { status: response.status });
            }
            const blob = await response.blob(); retryable = false;
            if (!active()) throw canceled();
            // Keep only the accepted profile plus one pending poster (currently <4.3MB), not both decoded loops.
            if (!Number.isFinite(blob.size) || blob.size <= 0 || retainedBytes + blob.size > 7200000) throw new Error('Solar media exceeds its bounded cache.');
            const url = window.URL.createObjectURL(blob);
            if (!active()) { window.URL.revokeObjectURL(url); throw canceled(); }
            entry.url = url; entry.bytes = blob.size; retainedBytes += blob.size;
            return url;
          } catch (error) {
            if (attempt || !retryable || !active() || error.name === 'AbortError') throw error;
          }
        }
      } finally { clearTimeout(entry.timer); }
    })().catch(error => { releaseAsset(source, entry); throw error; });
    return entry.promise;
  };
  const listen = (target, name, callback, settings) => {
    target.addEventListener(name, callback, settings);
    removals.push(() => target.removeEventListener(name, callback, settings));
  };
  const mediaStyle = {
    position: 'absolute', inset: 'auto', left: '-25%', top: '-25%', margin: '0', width: '150%', height: '150%',
    'max-width': 'none', 'max-height': 'none',
    'object-fit': 'contain', 'object-position': '50% 50%', 'border-radius': '0', 'clip-path': 'none',
    background: 'transparent', opacity: '1', visibility: 'visible', display: 'none', transform: 'none', filter: 'none',
  };
  const setMask = (node, url) => {
    const value = url ? `url(${JSON.stringify(url)})` : 'none';
    node.style.setProperty('mask-image', value, 'important');
    node.style.setProperty('-webkit-mask-image', value, 'important');
  };
  const maskStyle = {
    ...mediaStyle, 'background-color': 'var(--sun-surface-rgb)', 'mask-mode': 'luminance',
    'mask-repeat': 'no-repeat', '-webkit-mask-repeat': 'no-repeat',
    'mask-size': '100% 100%', '-webkit-mask-size': '100% 100%',
    transition: 'background-color 1.2s linear', 'pointer-events': 'none',
  };
  const softwareActive = () => own() && !!softwareBody && enabled && visible && pageActive && !document.hidden;
  const updateSoftware = () => {
    if (!softwareBody) return;
    if (!softwareActive()) { softwareBody.stop(); return; }
    const color = photometry.solarSurfaceColorUniform.value;
    const key = [[color.r, color.g, color.b].map(channel => Math.round(channel * 1024)).join(':'),
      Math.round((photometry.solarSpotStrengthUniform?.value || 0) * 1024), overlay.clientWidth, overlay.clientHeight].join('|');
    if (motion.matches && key === staticBodyKey) { softwareBody.stop(); return; }
    try {
      softwareBody.start(); softwareBody.render(photometry.getTimeMs());
      staticBodyKey = key;
      if (motion.matches) softwareBody.stop();
    } catch {
      softwareBody.dispose(); softwareBody = null; lastSoftwareAttempt = Date.now();
      if (own()) overlay.dataset.sunBodyRenderer = 'native-media';
    }
  };
  const ensureSoftware = () => {
    if (!own() || !posterReady || !enabled || !visible || !pageActive || document.hidden ||
      typeof window.CanvasRenderingContext2D !== 'function' || softwareBody || softwarePending || Date.now() - lastSoftwareAttempt < 60000) return softwarePending;
    lastSoftwareAttempt = Date.now();
    softwarePending = (async () => {
      try {
        const module = await loadSoftwareScene();
        if (!own()) return;
        const body = await module.mountSoftwareSunBody({ overlay, photometry,
          sourceUrl: options.sunTextureUrl || originalImages.get(image)?.src, isCurrent: own });
        if (!own()) { body.dispose(); return; }
        softwareBody = body; overlay.dataset.sunBodyRenderer = 'software-3d';
        updateSoftware(); syncOptics();
      } catch { if (own()) overlay.dataset.sunBodyRenderer = 'native-media'; }
      finally { softwarePending = null; }
    })();
    return softwarePending;
  };
  const updateOptics = () => {
    if (!own() || !posterReady) return;
    const states = photometry.getOpticalState?.(photometry.getTimeMs()) || [];
    for (let index = 0; index < opticalGhosts.length; index++) {
      const node = opticalGhosts[index], state = states[index];
      const valid = state && [state.x, state.y, state.size, state.opacity].every(Number.isFinite) && state.size > 0;
      const key = valid ? [state.kind, state.x.toFixed(3), state.y.toFixed(3), state.size.toFixed(3),
        Math.max(0, Math.min(1, state.opacity)).toFixed(4), state.color].join('|') : '';
      if (key === opticalKeys[index]) continue;
      opticalKeys[index] = key;
      node.hidden = !valid || state.opacity <= 0;
      node.style.setProperty('display', node.hidden ? 'none' : 'block', 'important');
      if (!valid) continue;
      const color = state.color;
      const fill = state.kind === 'soft'
        ? `rgb(${color} / .96) 0%, rgb(${color} / .68) 27%, rgb(${color} / .22) 56%, rgb(${color} / .03) 85%, transparent 100%`
        : state.kind === 'ring'
          ? `transparent 65%, rgb(${color} / .18) 75%, rgb(${color} / .72) 86%, rgb(${color} / .2) 94%, transparent 100%`
          : `rgb(${color} / .3) 0% 65%, rgb(${color} / .85) 86%, rgb(${color} / .2) 98%, transparent 100%`;
      const shape = state.kind === 'diamond' ? 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'
        : state.kind === 'hexagon' ? 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' : 'none';
      for (const [name, value] of Object.entries({
        left: `${state.x.toFixed(3)}%`, top: `${state.y.toFixed(3)}%`, width: `${state.size.toFixed(3)}%`, height: `${state.size.toFixed(3)}%`,
        opacity: Math.max(0, Math.min(1, state.opacity)).toFixed(4), 'clip-path': shape,
        background: `radial-gradient(closest-side, ${fill})`,
      })) node.style.setProperty(name, value, 'important');
    }
  };
  const stopOptics = () => {
    if (opticalRaf) window.cancelAnimationFrame?.(opticalRaf);
    opticalRaf = 0; lastOpticalFrame = -Infinity;
  };
  const opticalFrame = timestamp => {
    opticalRaf = 0;
    if (!(canAnimate() && api.running) && !(softwareActive() && !motion.matches)) return;
    if (timestamp - lastOpticalFrame >= 1000 / 30) { lastOpticalFrame = timestamp; updateOptics(); updateSoftware(); }
    opticalRaf = window.requestAnimationFrame(opticalFrame);
  };
  const syncOptics = () => {
    if (!document.hidden && visible) updateOptics();
    if (!(canAnimate() && api.running) && !(softwareActive() && !motion.matches)) stopOptics();
    else if (!opticalRaf && typeof photometry.getOpticalState === 'function' && typeof window.requestAnimationFrame === 'function') opticalRaf = window.requestAnimationFrame(opticalFrame);
  };
  const show = mode => {
    if (!own()) return;
    api.renderMode = mode;
    overlay.dataset.sunRenderMode = mode;
    image.hidden = mode !== 'poster' || !posterReady || (maskSupported && hasPoster);
    image.style.setProperty('display', image.hidden ? 'none' : 'block', 'important');
    surface.hidden = !maskSupported || !posterReady || (mode === 'poster' && !hasPoster);
    surface.style.setProperty('display', surface.hidden ? 'none' : 'block', 'important');
    if (maskSupported) setMask(surface, assetUrl(mode === 'animation' ? media.source : media.poster));
    for (const node of prominences) {
      node.hidden = !maskSupported || !archReady || mode !== 'animation';
      node.style.setProperty('display', node.hidden ? 'none' : 'block', 'important');
    }
    syncOptics();
  };
  const appearance = () => {
    if (!own()) return;
    const timeMs = photometry.getTimeMs();
    photometry.updateSolarAppearance(timeMs);
    const color = photometry.solarSurfaceColorUniform.value;
    const srgb = channel => {
      const value = Math.max(0, Math.min(1, Number(channel) || 0));
      return (value <= .0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - .055) * 255;
    };
    overlay.style.setProperty('--sun-surface-rgb', `rgb(${[color.r, color.g, color.b].map(value => srgb(value).toFixed(3)).join(' ')})`, 'important');
    if (!maskSupported) {
      const warmth = Math.max(0, Math.min(1, (1 - srgb(color.b) / 255) / .93));
      image.style.setProperty('filter', `grayscale(1) sepia(${warmth.toFixed(4)}) saturate(${(1 + warmth * 4).toFixed(4)})`, 'important');
    }
    const states = photometry.getProminenceStates(timeMs);
    for (let lane = 0; lane < prominences.length; lane++) {
      const node = prominences[lane], state = states[lane];
      node.style.setProperty('left', `${(50 + .247 * Math.cos(state.angle) * 100).toFixed(5)}%`, 'important');
      node.style.setProperty('top', `${(50 - .247 * Math.sin(state.angle) * 100).toFixed(5)}%`, 'important');
      node.style.setProperty('width', `${(state.width * 200 * ARCH_WIDTH_SCALE).toFixed(5)}%`, 'important');
      node.style.setProperty('height', `${(state.height * 100 * ARCH_HEIGHT_SCALE).toFixed(5)}%`, 'important');
      node.style.setProperty('transform', `translate(-50%, -${ARCH_ROOT_PERCENT}%) rotate(${(90 - state.angle * 180 / Math.PI).toFixed(5)}deg)`, 'important');
      node.style.setProperty('opacity', Math.max(0, Math.min(1, state.opacity)).toFixed(5), 'important');
    }
    updateOptics();
    updateSoftware();
  };
  const canAnimate = () => own() && maskSupported && enabled && visible && pageActive && !document.hidden && !motion.matches && !failed;
  const clearAnimation = () => {
    generation++; pending = false; api.running = false;
    stopOptics();
    cancelDecode(animation);
    animation.removeAttribute('src');
    show('poster');
  };
  function sync() {
    if (!own() || !posterReady) return;
    if (!canAnimate()) { clearAnimation(); return; }
    if (pending || api.running) return;
    pending = true;
    const attempt = ++generation, target = media;
    void (async () => {
      try {
        const url = await loadAsset(target.source, target.key);
        if (attempt !== generation || !own() || media !== target) return;
        // The decoder and CSS mask share one owned blob, so a second network consumer cannot fail separately.
        await decodeImage(animation, url);
        if (attempt !== generation || !own() || media !== target) return;
        pending = false;
        if (canAnimate()) { api.running = true; show('animation'); }
        else clearAnimation();
      } catch (error) {
        if (attempt === generation && own()) {
          failed = true; retryableMedia = !(error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429);
          clearAnimation(); releaseAsset(target.source);
        }
      }
    })();
  }
  function resizeMedia() {
    if (!own()) return;
    const key = mediaKey(requestedKey);
    if (key === requestedKey) return;
    requestedKey = key;
    const attempt = ++mediaGeneration;
    cancelDecode(mediaPreload);
    mediaPreload?.removeAttribute('src'); mediaPreload = null;
    for (const profile of Object.values(profiles)) if (profile.key !== media.key && profile.key !== key) releaseProfile(profile.key);
    // Returning to the active profile must still cancel a pending opposite-profile decode.
    if (key === media.key) return;
    const next = profiles[key], preload = document.createElement('img');
    mediaPreload = preload;
    void (async () => {
      try {
        const url = await loadAsset(next.poster, next.key);
        if (!own() || attempt !== mediaGeneration || requestedKey !== key) return;
        await decodeImage(preload, url);
        if (!own() || attempt !== mediaGeneration || requestedKey !== key) return;
        const previous = media;
        mediaPreload = null; media = next; hasPoster = true; failed = false; image.src = url;
        clearAnimation(); releaseProfile(previous.key); sync();
      } catch {
        if (own() && attempt === mediaGeneration) { mediaPreload = null; releaseProfile(next.key); }
      }
    })();
  }
  const tryRestore = async event => {
    if (!own() || !enabled || !visible || document.hidden || motion.matches || restoring || typeof window.WebGL2RenderingContext !== 'function') return;
    const now = Date.now();
    if (event?.type !== 'webglcontextrestored' && now - lastRestore < 60000) return;
    lastRestore = now; restoring = true;
    try { await restore(); } catch { /* Native imagery remains available after another GPU refusal. */ }
    finally { restoring = false; }
  };
  const resume = event => {
    if (!own()) return;
    if (document.hidden || !pageActive) softwareBody?.stop();
    if (event.type === 'pageshow') {
      pageActive = true;
      if (event.persisted) clearAnimation();
    }
    if (!document.hidden && pageActive) {
      appearance();
      const now = Date.now();
      if (failed && retryableMedia && enabled && visible && !motion.matches && now - lastMediaRetry >= 60000) {
        lastMediaRetry = now; failed = false;
      }
    }
    sync(); void tryRestore(event);
    void ensureSoftware();
  };
  const api = {
    canvas, recovery: true, renderer: null, state: 'recovery', renderMode: 'poster', disposed: false, running: false,
    get software() { return softwareBody || null; },
    get media() { return { profile: media.key, poster: media.poster, source: media.source, posterUrl: assetUrl(media.poster), sourceUrl: assetUrl(media.source), retainedBytes, transport: blobMedia ? 'blob' : 'url' }; },
    getProminenceStates(timeMs = photometry.getTimeMs()) { return own() ? photometry.getProminenceStates(timeMs) : []; },
    setGeoState(next) { if (!own()) return; photometry.setGeoState(next); appearance(); sync(); },
    updateOpticalGeometry() { updateOptics(); },
    resize() { appearance(); resizeMedia(); },
    start() { if (!own()) return; enabled = true; appearance(); sync(); void ensureSoftware(); },
    stop() { if (!own()) return; enabled = false; softwareBody?.stop(); sync(); },
    dispose() {
      if (this.disposed) return;
      this.disposed = true; this.running = false; generation++; mediaGeneration++;
      for (const record of decoders.values()) record.cancel();
      stopOptics();
      softwareBody?.dispose(); softwareBody = null;
      removals.forEach(remove => remove());
      animation.removeAttribute('src'); animation.remove();
      sprite?.removeAttribute('src');
      mediaPreload?.removeAttribute('src');
      setMask(surface, null); surface.remove();
      prominences.forEach(node => { setMask(node, null); node.remove(); });
      opticalGhosts.forEach(node => node.remove());
      for (const source of assets.keys()) releaseAsset(source);
      if (image.__sunRecoveryOwner === owner) {
        const originalImage = originalImages.get(image);
        if (originalImage?.src) image.setAttribute('src', originalImage.src); else image.removeAttribute('src');
        originalImages.delete(image);
        image.hidden = posterReady ? true : originalImage?.hidden ?? true; delete image.__sunRecoveryOwner;
      }
      releases.reverse().forEach(release => release());
      releaseContext?.();
      if (overlay.__sunRecoveryOwner === owner) {
        delete overlay.__sunRecoveryOwner; delete overlay.dataset.sunRenderMode;
        if (oldBodyRenderer) overlay.dataset.sunBodyRenderer = oldBodyRenderer; else delete overlay.dataset.sunBodyRenderer;
        if (oldSurface) overlay.dataset.sunSurface = oldSurface;
      }
    },
  };
  listen(document, 'visibilitychange', resume);
  listen(window, 'online', resume);
  listen(window, 'pageshow', resume);
  listen(window, 'pagehide', () => { pageActive = false; softwareBody?.stop(); clearAnimation(); });
  listen(canvas, 'webglcontextrestored', tryRestore);
  listen(motion, 'change', () => { appearance(); sync(); });
  if (typeof window.IntersectionObserver === 'function') {
    const observer = new window.IntersectionObserver(entries => { visible = entries.at(-1)?.isIntersecting ?? false; if (visible) appearance(); else softwareBody?.stop(); sync(); if (visible) void ensureSoftware(); });
    observer.observe(overlay); removals.push(() => observer.disconnect());
  }
  if (typeof window.MutationObserver === 'function') {
    const observer = new window.MutationObserver(() => { if (!own()) api.dispose(); });
    observer.observe(overlay.getRootNode(), { subtree: true, childList: true });
    observer.observe(document, { subtree: true, childList: true });
    removals.push(() => observer.disconnect());
  }
  try {
    // Keep the existing recovery disc visible until the replacement poster is decoded.
    const preload = document.createElement('img');
    let animationPrepared = false;
    try {
      await decodeImage(preload, await loadAsset(media.poster, media.key));
    } catch (error) {
      releaseAsset(media.poster);
      if (!canAnimate()) throw error;
      // A missing poster must not discard an available native animation.
      await decodeImage(animation, await loadAsset(media.source, media.key));
      hasPoster = false; animationPrepared = true;
    }
    if (maskSupported) {
      sprite = document.createElement('img');
      void (async () => {
        try {
          const url = await loadAsset(arch);
          if (!own()) return;
          await decodeImage(sprite, url);
          if (!own()) return;
          archReady = true; prominences.forEach(node => setMask(node, url));
          if (posterReady) { appearance(); show(api.renderMode); }
        } catch { releaseAsset(arch); /* The base Sun remains usable without the optional sprite. */ }
      })();
    }
    if (!own()) { api.dispose(); throw new Error('Solar recovery is no longer attached.'); }
    releases.push(leaseStyle(canvas, { display: 'none' }), leaseStyle(overlay, { filter: 'none', animation: 'none', '--sun-surface-rgb': 'rgb(255 255 255)' }));
    if (video) releases.push(leaseStyle(video, { display: 'none' }));
    releases.push(leaseStyle(image, hasPoster ? mediaStyle : {
      ...mediaStyle, left: '25%', top: '25%', width: '50%', height: '50%',
      'clip-path': 'circle(50%)', 'object-fit': 'cover', filter: 'var(--orb-sun-recovery-filter)',
    }));
    for (const [name, value] of Object.entries(maskStyle)) surface.style.setProperty(name, value, 'important');
    for (const node of prominences) {
      for (const [name, value] of Object.entries(maskStyle)) node.style.setProperty(name, value, 'important');
      node.style.setProperty('inset', 'auto', 'important'); node.style.setProperty('transform-origin', `50% ${ARCH_ROOT_PERCENT}%`, 'important');
      node.style.setProperty('transition', 'background-color 1.2s linear, opacity 1.2s linear', 'important');
      setMask(node, assetUrl(arch));
    }
    for (const node of opticalGhosts) {
      for (const [name, value] of Object.entries({
        position: 'absolute', inset: 'auto', margin: '0', display: 'none', transform: 'translate(-50%, -50%)',
        'transform-origin': '50% 50%', 'pointer-events': 'none', 'z-index': '3', filter: 'none',
      })) node.style.setProperty(name, value, 'important');
    }
    if (hasPoster) image.src = assetUrl(media.poster);
    overlay.append(surface, ...prominences, ...opticalGhosts);
    posterReady = true; overlay.dataset.sunSurface = 'ready';
    overlay.dataset.sunBodyRenderer = 'native-media';
    options.onStateChange?.('recovery');
    api.running = animationPrepared && canAnimate();
    appearance(); show(api.running ? 'animation' : 'poster');
    sync();
    resizeMedia();
    void ensureSoftware();
    return api;
  } catch (error) { api.dispose(); throw error; }
}
