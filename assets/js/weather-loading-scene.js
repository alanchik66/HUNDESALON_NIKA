/* Local loading visuals follow real weather readiness, independently of page entry. */
const installations = new WeakMap();
const SURFACES = '.weather-header-preview, .weather-header-dropdown';
const PENDING = new Set(['loading', 'paused']);
const GEO_ERRORS = new Set(['denied', 'timeout', 'unavailable']);

function coordinates(value) {
  if (typeof value === 'string') {
    const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    return match ? { latitude: Number(match[1]), longitude: Number(match[2]) } : null;
  }
  const latitude = value?.latitude ?? value?.lat, longitude = value?.longitude ?? value?.lon;
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

export function installWeatherLoadingScenes(host, { createMeteorScene } = {}) {
  if (installations.has(host)) return installations.get(host);
  const document = host?.ownerDocument, window = document?.defaultView, root = host?.shadowRoot;
  if (!root || typeof createMeteorScene !== 'function' || typeof window?.MutationObserver !== 'function') return null;

  const generation = host.__weatherLifecycleGeneration;
  const stages = new Map();
  let targets = [], disposed = false, queued = false, pageHidden = false;
  let subscribedApi = null, unsubscribe = null;
  const engine = createMeteorScene({ mode: 'loading', getTargets: () => targets });
  const schedule = () => {
    if (disposed || queued) return;
    queued = true;
    Promise.resolve().then(() => { queued = false; if (!disposed) sync(); });
  };
  const resizeObserver = typeof window.ResizeObserver === 'function' ? new window.ResizeObserver(schedule) : null;
  const visibility = new Map();
  const intersectionObserver = typeof window.IntersectionObserver === 'function' ? new window.IntersectionObserver(entries => {
    entries.forEach(entry => { if (stages.has(entry.target)) visibility.set(entry.target, entry.isIntersecting && entry.intersectionRatio > 0); });
    schedule();
  }, { threshold: [0, .01] }) : null;

  const removeStage = surface => {
    stages.get(surface)?.remove();
    stages.delete(surface);
    visibility.delete(surface);
    resizeObserver?.unobserve(surface);
    intersectionObserver?.unobserve(surface);
  };
  const clear = () => {
    targets = [];
    engine.stop();
    [...stages.keys()].forEach(removeStage);
  };
  const isOwn = node => Boolean((node?.nodeType === 1 ? node : node?.parentElement)?.closest?.('[data-weather-loading-scene]'));
  const shadowObserver = new window.MutationObserver(records => {
    if (records.some(record => !isOwn(record.target) && !(record.type === 'childList' &&
      [...record.addedNodes, ...record.removedNodes].length && [...record.addedNodes, ...record.removedNodes].every(isOwn)))) schedule();
  });
  shadowObserver.observe(root, { childList: true, subtree: true, characterData: true, attributes: true,
    attributeFilter: ['class', 'hidden', 'aria-busy', 'aria-expanded', 'data-weather-scene-owner', 'data-moon-scene', 'data-sun-scene'] });
  const hostObserver = new window.MutationObserver(schedule);
  hostObserver.observe(host, { attributes: true, attributeFilter: [
    'data-weather-mounted', 'data-weather-expanded', 'data-weather-geo-pending', 'data-weather-geo-error',
    'data-weather-location', 'data-weather-data-updated-at',
  ] });
  const pageObserver = new window.MutationObserver(schedule);
  for (const node of [document.body, document.documentElement]) {
    if (node) pageObserver.observe(node, { attributes: true, attributeFilter: ['class'] });
  }
  const removalObserver = new window.MutationObserver(() => { if (host.isConnected === false) dispose(); });
  if (document.documentElement) removalObserver.observe(document.documentElement, { childList: true, subtree: true });

  function surfacePending(surface, state) {
    if (state?.error || GEO_ERRORS.has(state?.geoStatus) || GEO_ERRORS.has(host.dataset.weatherGeoError) ||
      surface.querySelector('.weather-header-state__inner--error')) return false;
    const owners = [...surface.querySelectorAll('[data-weather-scene-owner]')];
    const orbs = [...surface.querySelectorAll('.weather-orb-overlay.is-visible:not([hidden])')];
    const orbState = orb => orb.classList.contains('is-moon') ? orb.dataset.moonScene : orb.classList.contains('is-sun') ? orb.dataset.sunScene : null;
    const selected = coordinates(host.dataset.weatherLocation);
    const applied = coordinates(state?.location) || coordinates(state?.weather?.location);
    const changedLocation = Boolean(state?.weather && selected && (!applied ||
      Math.abs(selected.latitude - applied.latitude) > .00001 || Math.abs(selected.longitude - applied.longitude) > .00001));
    const hasWeather = Boolean(state?.weather?.current) && !changedLocation;
    const cold = !hasWeather && (changedLocation || state?.loading || state?.geoStatus === 'pending' ||
      host.dataset.weatherGeoPending === 'true' || host.dataset.weatherMounted === 'loading' ||
      surface.getAttribute('aria-busy') === 'true' || surface.querySelector('.weather-header-state__spinner'));
    return Boolean(cold || owners.some(owner => owner.dataset.weatherSceneOwner === 'loading') || orbs.some(orb => PENDING.has(orbState(orb))));
  }

  function sync() {
    if (disposed) return;
    if (host.isConnected === false || host.__weatherLifecycleGeneration !== generation) { dispose(); return; }
    const api = host.__weatherWidgetInstance || null;
    if (api !== subscribedApi) {
      unsubscribe?.(); subscribedApi = api; unsubscribe = null;
      if (typeof api?.subscribe === 'function') unsubscribe = api.subscribe(schedule);
    }
    if (pageHidden || document.hidden || document.documentElement?.classList.contains('site-loading') ||
      document.body?.classList.contains('hide-header') || host.dataset.weatherMounted === 'false') { clear(); return; }
    const state = api?.getState?.();
    const surfaces = [...root.querySelectorAll(SURFACES)];
    const active = new Set();
    const next = [];
    for (const surface of surfaces) {
      const panel = surface.classList.contains('weather-header-dropdown');
      if (surface.isConnected === false || surface.hidden || surface.getAttribute('aria-hidden') === 'true' ||
        panel && host.dataset.weatherExpanded === 'false' || !surfacePending(surface, state)) continue;
      active.add(surface);
      let stage = stages.get(surface);
      if (!stage) {
        stage = document.createElement('div');
        stage.dataset.weatherLoadingScene = panel ? 'panel' : 'preview';
        stage.setAttribute('aria-hidden', 'true');
        Object.assign(stage.style, { position: 'absolute', inset: '0', overflow: 'hidden', pointerEvents: 'none', zIndex: '100', borderRadius: 'inherit' });
        surface.appendChild(stage);
        stages.set(surface, stage);
        resizeObserver?.observe(surface);
        intersectionObserver?.observe(surface);
      }
      if (visibility.get(surface) === false) continue;
      const bounds = surface.getBoundingClientRect();
      if (!(bounds.width > 0 && bounds.height > 0 && bounds.right > 0 && bounds.bottom > 0 &&
        bounds.left < window.innerWidth && bounds.top < window.innerHeight)) continue;
      next.push({ stage, bounds, rect: stage.getBoundingClientRect(), maxActive: panel ? 3 : 2 });
    }
    const changed = targets.length !== next.length || targets.some((target, index) => target.stage !== next[index].stage);
    targets = next;
    if (changed || !targets.length) engine.stop();
    for (const surface of stages.keys()) if (!active.has(surface)) removeStage(surface);
    if (targets.length) engine.sync();
  }

  const onVisibility = () => sync();
  const onPageHide = () => { pageHidden = true; clear(); };
  const onPageShow = () => { pageHidden = false; sync(); };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  window.addEventListener('resize', schedule, { passive: true });
  Promise.resolve(window.NikaSiteLoader?.ready).then(schedule, schedule);

  function dispose() {
    if (disposed) return;
    disposed = true;
    clear();
    engine.dispose();
    unsubscribe?.();
    for (const observer of [shadowObserver, hostObserver, pageObserver, removalObserver, resizeObserver, intersectionObserver]) observer?.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('resize', schedule);
    installations.delete(host);
  }
  const controller = { sync, dispose };
  installations.set(host, controller);
  sync();
  return controller;
}
