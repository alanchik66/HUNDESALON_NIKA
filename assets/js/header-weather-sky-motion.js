/* Actual celestial directions projected across the weather scene, below text. */
const astronomy = await import(new URL(`./weather-solar-time.js${new URL(import.meta.url).search}`, import.meta.url).href);
const { applySkyFog } = await import(new URL(`./header-weather-fog-layer.js${new URL(import.meta.url).search}`, import.meta.url).href);
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
  const moonOpacity = moon.valid ? moon.horizonOpacity * (1 - .82 * daylight * daylight * (3 - 2 * daylight)) + (1 - moon.horizonOpacity) * .72 : 0;
  const part = (kind, sky, opacity) => ({ ...presentation?.[kind], sky, opacity, active: opacity > .02 });
  return { ...presentation, sun: part('sun', sun, sunOpacity),
    moon: { ...part('moon', moon, moonOpacity), belowHorizon: moon.belowHorizon === true, isBoundaryIndicator: moon.belowHorizon === true },
    dominantKind: sunOpacity >= moonOpacity ? 'sun' : 'moon' };
}

export function skyLane(region, left, right, radius) {
  const low = Math.max(region.left + radius + 5, (left?.right ?? region.left) + radius + 5);
  const high = Math.min(region.right - radius - 5, (right?.left ?? region.right) - radius - 5);
  const middle = clamp((low + high) / 2, region.left + radius, region.right - radius);
  return { left: low <= high ? low : middle, right: low <= high ? high : middle,
    top: region.top + radius + 4, bottom: Math.max(region.top + radius + 4, region.bottom - radius - 4) };
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

function measureSkyFrame(overlay) {
  const region = overlay?.closest('.weather-header-preview,.weather-header-dropdown__hero');
  const window = overlay?.ownerDocument?.defaultView;
  const bounds = region?.getBoundingClientRect(), orb = overlay?.getBoundingClientRect();
  if (!window || !bounds?.width || !bounds?.height || !orb?.width || !orb?.height) return null;
  // Match the projection's actual disc margins and its full cloud-height sky.
  const radius = orb.width * (overlay.dataset.orbRole === 'sun' ? .247 : .255);
  const computed = window.getComputedStyle(overlay);
  const rise = region.classList.contains('weather-header-preview') ? parseFloat(computed.getPropertyValue?.('--header-weather-cloud-rise')) : 0;
  const skyBounds = { left: bounds.left, right: bounds.right, top: bounds.top - (Number.isFinite(rise) ? Math.max(0, rise) : 0), bottom: bounds.bottom };
  return { region, window, bounds, orb, computed, lane: skyLane(skyBounds, null, null, radius) };
}

export function skyOpticalCenter(overlay) {
  const position = opticalTargets.get(overlay);
  if (!position) return null;
  const frame = measureSkyFrame(overlay);
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
  const { window, orb, computed, lane } = frame;
  const radius = orb.width * (isSun ? .247 : .255);
  if (part?.isBoundaryIndicator) {
    overlay.style.setProperty('--orb-moon-sun-contrast', '1');
  }
  const translate = computed.translate.split(/\s+/).map(parseFloat);
  const baseX = orb.left + orb.width / 2 - (translate[0] || 0);
  const baseY = orb.top + orb.height / 2 - (translate[1] || 0);
  const target = { x: lane.left + (lane.right - lane.left) * clamp(sky.x, 0, 1),
    y: lane.top + (lane.bottom - lane.top) * clamp(sky.y, 0, 1) };
  const x = target.x - baseX, y = target.y - baseY;
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
    const targetX = moonBox.left + moonBox.width / 2 - (actual[0] || 0) + (parseFloat(moon.style.getPropertyValue('--orb-sky-x')) || 0);
    const targetY = moonBox.top + moonBox.height / 2 - (actual[1] || 0) + (parseFloat(moon.style.getPropertyValue('--orb-sky-y')) || 0);
    // Compressing a whole sky into a tiny weather lane can superpose discs that
    // are far apart in the real sky. Fade the faint daytime Moon under glare;
    // retain its true projected coordinates rather than inventing an eclipse.
    const contrast = moon.dataset?.orbBelowHorizon === 'true' ? 1
      : solarMoonContrast(Math.hypot(baseX + x - targetX, baseY + y - targetY), radius, moonBox.width * .255, part.opacity);
    moon.style.setProperty('--orb-moon-sun-contrast', contrast.toFixed(4));
  }
  updates.set(overlay, { key, time: now });
}

export const skyClock = { ...astronomy, withSkyPresentation, applySkyPosition, applySkyFog };
