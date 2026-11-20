/* Actual celestial directions projected across the weather scene, below text. */
const astronomy = await import(new URL(`./weather-solar-time.js${new URL(import.meta.url).search}`, import.meta.url).href);
const { applySkyFog } = await import(new URL(`./header-weather-fog-layer.js${new URL(import.meta.url).search}`, import.meta.url).href);
const { skyLane, measureSkyLane } = await import(new URL(`./weather-sky-frame.js${new URL(import.meta.url).search}`, import.meta.url).href);
export { skyLane };
const styledRoots = new WeakMap();
const updates = new WeakMap();
const opticalTargets = new WeakMap();
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function withSkyPresentation(presentation, geoState, clock) {
  const timeMs = Number.isFinite(geoState?.appearanceTimeMs) ? geoState.appearanceTimeMs : geoState?.timeMs;
  const { latitude, longitude } = geoState || {};
  const solar = clock.solarPosition(timeMs, latitude, longitude);
  const sun = clock.projectSkyPosition(solar);
  const moon = clock.projectSkyPosition(clock.moonPosition(timeMs, latitude, longitude));
  const sunOpacity = (presentation?.sun?.opacity || 0) * sun.horizonOpacity;
  // Preserve the physical horizon and lunar portrait at the chart rim.
  // Blend continuously into the boundary indicator through moonset.
  const daylight = Number.isFinite(solar?.elevationDeg) ? clamp((solar.elevationDeg + 6) / 18, 0, 1) : 1;
  // Daylight lowers contrast across the whole portrait, including the chart rim.
  // The .06 display floor is an exposure choice, not measured lunar radiance.
  const moonContrast = 1 - .94 * daylight * daylight * (3 - 2 * daylight);
  const moonOpacity = moon.valid ? (moon.horizonOpacity + (1 - moon.horizonOpacity) * .72) * moonContrast : 0;
  const part = (kind, sky, opacity) => ({ ...presentation?.[kind], sky, opacity, active: opacity > .02 });
  return { ...presentation, sun: part('sun', sun, sunOpacity),
    moon: { ...part('moon', moon, moonOpacity), belowHorizon: moon.belowHorizon === true, isBoundaryIndicator: moon.belowHorizon === true },
    dominantKind: sunOpacity >= moonOpacity ? 'sun' : 'moon' };
}

export function solarMoonContrast(distance, sunRadius, moonRadius, sunOpacity) {
  const radius = sunRadius + moonRadius;
  const t = clamp((distance - radius * .85) / Math.max(radius * .5, 1), 0, 1);
  return 1 - clamp(sunOpacity, 0, 1) * (1 - t * t * (3 - 2 * t));
}

export function avoidSkyControl(x, y, radius, control, minimumY = -Infinity) {
  if (!control?.width || !control?.height) return { x, y };
  const gap = Math.max(control.left - x, x - control.right, 0);
  const t = clamp((gap - radius - 2) / 14, 0, 1);
  const weight = 1 - t * t * (3 - 2 * t);
  const ceiling = Math.max(minimumY, control.top - radius - 3);
  return { x, y: y + (Math.min(y, ceiling) - y) * weight };
}

function measureSkyFrame(overlay, localLane) {
  const region = overlay?.closest('.weather-header-preview,.weather-header-dropdown__hero');
  const window = overlay?.ownerDocument?.defaultView;
  const bounds = region?.getBoundingClientRect(), orb = overlay?.getBoundingClientRect();
  if (!window || !bounds?.width || !bounds?.height || !orb?.width || !orb?.height) return null;
  // Frame the discs inside their widget; the taller cloud field is not a viewport.
  const radius = orb.width * (overlay.dataset.orbRole === 'sun' ? .247 : .255);
  const computed = window.getComputedStyle(overlay);
  const scale = region.clientWidth > 0 ? bounds.width / region.clientWidth : 1;
  const lane = localLane ? { left: bounds.left + localLane.left * scale, right: bounds.left + localLane.right * scale,
    top: bounds.top + localLane.top * scale, bottom: bounds.top + localLane.bottom * scale } : measureSkyLane(region, radius, scale);
  return { region, window, bounds, orb, computed, scale, lane };
}

export function skyOpticalCenter(overlay) {
  const position = opticalTargets.get(overlay);
  if (!position) return null;
  // Text ranges are refreshed by the existing position clock. Optical animation
  // reuses that lane and reads only moving bounds, including scroll and scale.
  const frame = measureSkyFrame(overlay, position.localLane);
  let { x, y } = position;
  // Normalize the rendered source, including its CSS transition, into the same
  // overhead chart. Local panel aspect, header rise and page scroll are not cameras.
  if (frame) {
    const { orb, lane } = frame;
    if (lane.right > lane.left) x = clamp((orb.left + orb.width / 2 - lane.left) / (lane.right - lane.left), 0, 1);
    if (lane.bottom > lane.top) y = clamp((orb.top + orb.height / 2 - lane.top) / (lane.bottom - lane.top), 0, 1);
  }
  // The canonical dome is square, centred at (.5,.5); UV Y points up.
  // Positive ghosts point toward that centre in both panel variants.
  return { x: 1 - x, y, space: 'logical' };
}

const horizonCopy = {
  ru: ['Луна', 'Под горизонтом'], uk: ['Місяць', 'Під горизонтом'],
  de: ['Mond', 'Unter dem Horizont'], en: ['Moon', 'Below horizon'],
};

function syncHorizonAccessibility(overlay, part, lang) {
  if (overlay.dataset.orbRole !== 'moon') return;
  const below = part?.isBoundaryIndicator === true;
  overlay.dataset.orbBelowHorizon = String(below);
  const [name, caption] = horizonCopy[lang] || horizonCopy.en;
  overlay.setAttribute('role', 'img');
  overlay.setAttribute('aria-label', below ? `${name} — ${caption}` : name);
  // Remove a caption left by an older mounted module; the lunar portrait and
  // its accessible description remain independent of visible weather text.
  const region = overlay.closest('.weather-header-preview,.weather-header-dropdown__hero');
  region?.querySelectorAll('.weather-orb-horizon-label').forEach(label => label.remove());
}

function installStyle(overlay) {
  const root = overlay.getRootNode();
  const parent = root.nodeType === 9 ? root.head : root;
  if (styledRoots.get(root)?.parentNode === parent) return;
  const style = overlay.ownerDocument.createElement('style');
  style.textContent = `.weather-orb-overlay[data-orb-sky]{translate:var(--orb-sky-x,0px) var(--orb-sky-y,0px)!important;transition:translate var(--orb-sky-duration,1s) linear,opacity 1.35s ease-in-out!important}.weather-orb-overlay.is-moon.is-visible[data-orb-sky],:host([data-weather-variant='header']) .weather-header-preview .weather-orb-stack--preview-back .weather-orb-overlay.is-moon.is-visible[data-orb-sky],:host([data-weather-variant='header']) .weather-header-dropdown__hero .weather-orb-overlay.is-moon.is-visible[data-orb-sky]{opacity:calc(var(--orb-crossfade-opacity,1)*var(--orb-moon-transmission,1)*var(--orb-moon-sun-contrast,1))!important}
@media(prefers-reduced-motion:reduce){.weather-orb-overlay[data-orb-sky]{--orb-sky-duration:0s!important}}`;
  parent.append(style); styledRoots.set(root, style);
}

export function applySkyPosition(overlay, part, fixedLayout, lang = 'en') {
  if (overlay) syncHorizonAccessibility(overlay, part, lang);
  if (overlay && fixedLayout) {
    const kind = overlay.dataset.orbKind || overlay.dataset.orbRole;
    const variant = overlay.classList.contains('weather-orb-overlay--dropdown') ? 'dropdown' : 'preview';
    const layout = fixedLayout(kind, variant), scale = Number(layout?.scale) || 1;
    if (layout && overlay.dataset.orbLayoutKey !== String(scale)) {
      overlay.dataset.orbLayoutKey = String(scale); overlay.dataset.orbPositionLocked = variant;
      for (const name of ['--orb-left', '--orb-top', '--orb-offset-x', '--orb-offset-y']) overlay.style.removeProperty(name);
      overlay.style.setProperty('--orb-scale-visible', scale.toFixed(3));
      overlay.style.setProperty('--orb-scale-hidden', Math.max(.88, scale - .08).toFixed(3));
    }
  }
  const sky = part?.sky;
  if (!overlay || !Number.isFinite(sky?.x) || !Number.isFinite(sky?.y)) {
    if (overlay) opticalTargets.delete(overlay);
    return;
  }
  opticalTargets.set(overlay, { x: clamp(sky.x, 0, 1), y: clamp(sky.y, 0, 1) });
  overlay.__getWeatherSkyOpticalCenter ||= () => skyOpticalCenter(overlay);
  const region = overlay?.closest('.weather-header-preview,.weather-header-dropdown__hero');
  if (!region) return;
  const isSun = overlay.dataset.orbRole === 'sun';
  const moon = isSun ? region.querySelector('[data-orb-role="moon"]') : null;
  if (moon && !part.active) moon.style.setProperty('--orb-moon-sun-contrast', '1');
  const frame = measureSkyFrame(overlay);
  if (!frame) return;
  installStyle(overlay);
  const { window, orb, computed, scale, lane } = frame;
  opticalTargets.get(overlay).localLane = { left: (lane.left - frame.bounds.left) / scale, right: (lane.right - frame.bounds.left) / scale,
    top: (lane.top - frame.bounds.top) / scale, bottom: (lane.bottom - frame.bounds.top) / scale };
  const radius = orb.width * (isSun ? .247 : .255);
  const translate = computed.translate.split(/\s+/).map(parseFloat);
  const baseX = orb.left + orb.width / 2 - (translate[0] || 0) * scale;
  const baseY = orb.top + orb.height / 2 - (translate[1] || 0) * scale;
  const target = { x: lane.left + (lane.right - lane.left) * clamp(sky.x, 0, 1),
    y: lane.top + (lane.bottom - lane.top) * clamp(sky.y, 0, 1) };
  // DOM bounds include an ancestor's scale; CSS translate remains in local pixels.
  const x = (target.x - baseX) / scale, y = (target.y - baseY) / scale;
  const now = window.performance.now(), previous = updates.get(overlay);
  const key = `${x.toFixed(3)}px|${y.toFixed(3)}px`;
  overlay.dataset.orbSky = 'true';
  overlay.style.setProperty('--orb-sky-duration', previous && now - previous.time < 2500 ? '1s' : '0s');
  if (key !== previous?.key) {
    overlay.style.setProperty('--orb-sky-x', `${x.toFixed(3)}px`);
    overlay.style.setProperty('--orb-sky-y', `${y.toFixed(3)}px`);
  }
  if (moon && part.active) {
    const moonBox = moon.getBoundingClientRect();
    const actual = window.getComputedStyle(moon).translate.split(/\s+/).map(parseFloat);
    const targetX = moonBox.left + moonBox.width / 2 - (actual[0] || 0) * scale + (parseFloat(moon.style.getPropertyValue('--orb-sky-x')) || 0) * scale;
    const targetY = moonBox.top + moonBox.height / 2 - (actual[1] || 0) * scale + (parseFloat(moon.style.getPropertyValue('--orb-sky-y')) || 0) * scale;
    // Compressing a whole sky into a tiny weather lane can superpose discs that
    // are far apart in the real sky. Fade the faint daytime Moon under glare;
    // retain its true projected coordinates rather than inventing an eclipse.
    const contrast = solarMoonContrast(Math.hypot(target.x - targetX, target.y - targetY), radius, moonBox.width * .255, part.opacity);
    moon.style.setProperty('--orb-moon-sun-contrast', contrast.toFixed(4));
  }
  updates.set(overlay, { key, time: now });
}

export function syncHeaderWeatherShootingStars(host, randomBetween) {
  if (!host?.shadowRoot) return;
  if (host.dataset.weatherMounted !== 'true') {
    host.__weatherShootingStars?.dispose();
    host.__weatherShootingStars = null;
    return;
  }
  if (!host.__weatherShootingStars) {
    let timer = null;
    let active = null;
    let disposed = false;
    let firstPass = true;
    let generation = 0;
    const eligibleLayers = () => {
      if (disposed || !host.isConnected || host.dataset.weatherMounted !== 'true' ||
        document.hidden) return [];
      return [
        host.shadowRoot.querySelector('.weather-header-preview__stars-back'),
        host.dataset.weatherExpanded === 'true'
          ? host.shadowRoot.querySelector('.weather-header-dropdown__stars-back') : null,
      ].filter(layer => layer?.isConnected && layer.classList.contains('is-night-sky') && layer.style.display !== 'none');
    };
    const stop = () => {
      generation += 1;
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      const previous = active;
      active = null;
      previous?.animation.cancel();
      previous?.element.remove();
    };
    const schedule = () => {
      if (timer !== null || active || !eligibleLayers().length) return;
      timer = window.setTimeout(spawn, randomBetween(firstPass ? 4500 : 28000, firstPass ? 9500 : 68000));
    };
    const spawn = () => {
      timer = null;
      const layers = eligibleLayers();
      if (!layers.length) return;
      firstPass = false;
      const nightLayer = layers[Math.min(layers.length - 1, Math.floor(randomBetween(0, layers.length)))];
      const dropdown = nightLayer.closest('.weather-header-dropdown');
      const stage = nightLayer.closest('.weather-header-preview') || dropdown?.querySelector('.weather-header-dropdown__hero');
      if (!stage?.isConnected) {
        schedule();
        return;
      }
      const rect = stage.getBoundingClientRect();
      const container = dropdown || document.querySelector('.header');
      const bounds = container?.getBoundingClientRect();
      if (!bounds) return;
      const viewport = window.visualViewport;
      const left = Math.max(rect.left, bounds.left, viewport?.offsetLeft || 0);
      const top = Math.max(rect.top, bounds.top, viewport?.offsetTop || 0);
      const right = Math.min(rect.right, bounds.right, (viewport?.offsetLeft || 0) + (viewport?.width || window.innerWidth));
      const bottom = Math.min(rect.bottom, bounds.bottom, (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight));
      const angle = randomBetween(0, 360);
      const radians = angle * Math.PI / 180;
      const cosine = Math.cos(radians);
      const sine = Math.sin(radians);
      // The projection varies independently of brightness. Steep tracks have less space in the narrow header.
      const trailLimit = Math.min(84, (right - left) * 0.25,
        (bottom - top) * 0.28 / Math.max(Math.abs(sine), 0.001));
      const length = trailLimit * (0.54 + 0.46 * randomBetween(0, 1) ** 1.4);
      const corners = [Math.min(-0.9 * length, -11), Math.max(0.1 * length, 11)].flatMap(x =>
        [-11, 11].map(y => ({ x: x * cosine - y * sine, y: x * sine + y * cosine }))
      );
      const minX = left - Math.min(...corners.map(point => point.x)) + 6;
      const maxX = right - Math.max(...corners.map(point => point.x)) - 6;
      const minY = top - Math.min(...corners.map(point => point.y)) + 6;
      const maxY = bottom - Math.max(...corners.map(point => point.y)) - 6;
      const distance = Math.min(
        (maxX - minX) / Math.max(Math.abs(cosine), 0.001),
        (maxY - minY) / Math.max(Math.abs(sine), 0.001)
      ) * randomBetween(0.45, 0.9);
      if (length <= 0 || maxX <= minX || maxY <= minY || distance < 12) {
        schedule();
        return;
      }
      const dx = cosine * distance;
      const dy = sine * distance;
      const x = randomBetween(minX - Math.min(dx, 0), maxX - Math.max(dx, 0));
      const y = randomBetween(minY - Math.min(dy, 0), maxY - Math.max(dy, 0));
      const element = document.createElement('span');
      element.className = 'weather-header-shooting-star weather-header-shooting-star--foreground';
      element.setAttribute('aria-hidden', 'true');
      element.setAttribute('data-weather-meteor-depth', 'front');
      // Apparent speed is scaled to the available scene width, not a physical distance.
      const screenSpeed = (right - left) * randomBetween(0.55, 1.55);
      const duration = Math.max(260, Math.min(780, 1000 * distance / screenSpeed));
      // The visible glow is an apparent size in the scene. Ordinary faint tracks outnumber strong bursts.
      const brightnessRank = randomBetween(0, 1);
      const luminance = brightnessRank ** 2.6;
      const strength = 0.43 + 0.57 * luminance;
      const flash = brightnessRank >= 0.985 ? 0.83 : 0.05 + 0.34 * luminance;
      const color = randomBetween(0, 1) < 0.18 ? '255, 232, 194' : '232, 241, 255';
      element.style.setProperty('--shooting-star-color', color);
      element.style.setProperty('--shooting-star-head-long', `${(1.05 + 2.1 * luminance).toFixed(2)}px`);
      element.style.setProperty('--shooting-star-head-short', `${(0.55 + 1.25 * luminance).toFixed(2)}px`);
      element.style.setProperty('--shooting-star-trail-width', `${(0.75 + 2.25 * luminance).toFixed(2)}px`);
      element.style.setProperty('--shooting-star-flare-size', `${(4.6 + 10.6 * luminance).toFixed(2)}px`);
      element.style.setProperty('--shooting-star-flash', flash.toFixed(3));
      element.style.setProperty('--shooting-star-length', `${length.toFixed(2)}px`);
      element.style.setProperty('--shooting-star-duration', `${duration.toFixed(2)}ms`);
      element.style.left = `${(x - rect.left - length * 0.9).toFixed(2)}px`;
      element.style.top = `${(y - rect.top - 11).toFixed(2)}px`;
      stage.appendChild(element);
      const transform = progress => `translate3d(${(dx * progress).toFixed(2)}px, ${(dy * progress).toFixed(2)}px, 0) rotate(${angle.toFixed(2)}deg) scale(1)`;
      let animation;
      try {
        animation = element.animate([
          // Opacity eases independently; transform endpoints preserve constant travel speed.
          { transform: transform(0), offset: 0, easing: 'linear' },
          { opacity: 0, offset: 0, easing: 'ease-in-out' },
          { opacity: 0.34 * strength, offset: 0.12, easing: 'ease-in-out' },
          { opacity: strength, offset: 0.38, easing: 'ease-in-out' },
          { opacity: 0.42 * strength, offset: 0.58, easing: 'ease-in-out' },
          { opacity: 0.1 * strength, offset: 0.84, easing: 'ease-in-out' },
          { transform: transform(1), opacity: 0, offset: 1 },
        ], { duration, easing: 'linear', fill: 'forwards' });
      } catch {
        element.remove();
        return;
      }
      const token = ++generation;
      active = { layer: nightLayer, element, animation };
      const finish = () => {
        element.remove();
        if (token !== generation || disposed) return;
        active = null;
        schedule();
      };
      animation.finished.then(finish, finish);
    };
    const sync = (restart = false) => {
      const layers = eligibleLayers();
      if (restart || !layers.length || (active && (!layers.includes(active.layer) || active.element.isConnected === false))) stop();
      if (layers.length) schedule();
    };
    host.__weatherShootingStars = {
      sync,
      dispose() {
        disposed = true;
        stop();
      },
    };
  }
  host.__weatherShootingStars.sync();
}

export const skyClock = { ...astronomy, withSkyPresentation, applySkyPosition, applySkyFog, syncHeaderWeatherShootingStars };
