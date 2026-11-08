/* Foreground fog is a bounded visual model, not measured vertical optical depth. */
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const smooth = (low, high, value) => { const t = clamp((value - low) / (high - low), 0, 1); return t * t * (3 - 2 * t); };
const number = value => (typeof value === 'number' || typeof value === 'string' && value.trim()) && Number.isFinite(Number(value)) ? Number(value) : null;
const owners = new WeakMap();
const OWNER = Symbol.for('nika.weather-fog-owner.v1');
const EXIT = Symbol.for('nika.weather-fog-exit.v1');

export function resolveFogLight(atmosphere, sky) {
  const active = atmosphere?.mode === 'fog';
  const visibility = number(atmosphere?.visibilityKm);
  // Horizontal visibility cannot determine the thickness of the fog above us.
  // These monotonic coefficients drive a bounded two-layer UI attenuation model;
  // they are neither measured vertical optical depth nor exact radiance/compositing.
  const strength = !active ? 0 : visibility !== null && visibility > 0
    ? .2 + .8 * (1 - smooth(Math.log(.05), Math.log(3), Math.log(visibility))) : .65;
  const elevation = number(sky?.elevationDeg);
  const daylight = elevation === null ? 0 : smooth(-18, 8, elevation);
  const warmth = elevation === null ? 0 : (1 - smooth(0, 18, elevation)) * smooth(-18, -3, elevation);
  // Dark-UI tone mapping preserves text contrast; this is not a measured sky radiance.
  const color = [12, 20, 27].map((night, index) => Math.round(night + ([90, 100, 104][index] - night) * daylight));
  const haloColor = [255, 249 - 29 * warmth, 232 - 44 * warmth].map(Math.round);
  return { active, strength, visibilityKm: visibility !== null && visibility > 0 ? visibility : null,
    daylight, baseOpacity: active ? .24 + .56 * strength : 0,
    directTransmission: active ? .012 + .65 * (1 - strength) ** 2 : 1,
    solarHalo: active ? daylight * (.07 + .10 * strength) : 0,
    color, haloColor };
}

const styles = `
/* The header's universal anti-clip rule protects overflowing celestial effects;
   this foreground veil alone must retain its soft mask and bounded coverage. */
:host([data-weather-variant='header']) .weather-header-preview [data-weather-layer="fog"],
[data-weather-layer="fog"] { position:absolute!important; inset:0!important; z-index:13!important; pointer-events:none!important; overflow:hidden!important; isolation:isolate; transition:opacity 1.2s linear!important;
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 9%,#000 91%,transparent),linear-gradient(180deg,transparent,#000 12%,#000 88%,transparent)!important;
  mask-image:linear-gradient(90deg,transparent,#000 9%,#000 91%,transparent),linear-gradient(180deg,transparent,#000 12%,#000 88%,transparent)!important;
  -webkit-mask-composite:source-in; mask-composite:intersect; -webkit-mask-repeat:no-repeat; mask-repeat:no-repeat; }
[data-weather-layer="fog"] > * { position:absolute!important; pointer-events:none!important; transition:opacity 1.2s linear,background-color 1.2s linear,color 1.2s linear,transform 1s linear!important; }
[data-weather-fog-base] { inset:0!important; }
[data-weather-fog-halo] { left:0;top:0; background:radial-gradient(ellipse,currentColor 0%,transparent 72%); transform-origin:center; }
@media(prefers-reduced-motion:reduce) { [data-weather-layer="fog"], [data-weather-layer="fog"] > * { transition:none!important; } }
`;

function layerIn(region) {
  const layer = region?.querySelector?.('[data-weather-layer="fog"]');
  return layer?.parentNode === region ? layer : null;
}

function removeOwned(region, overlay) {
  const layer = layerIn(region);
  if (layer?.[OWNER] === overlay) layer.remove();
}

/** Called by the existing sky clock for its Sun, in both header panel variants. */
export function applySkyFog(overlay, part, atmosphere) {
  if (!overlay || overlay.dataset?.orbRole === 'moon') return null;
  const previous = owners.get(overlay);
  const region = overlay.isConnected === false ? null : overlay.closest?.('.weather-header-preview,.weather-header-dropdown__hero');
  if (previous && previous !== region) removeOwned(previous, overlay);
  if (!region) { owners.delete(overlay); overlay.style?.setProperty('--orb-sun-transmission', '1'); return null; }
  const model = resolveFogLight(atmosphere, part?.sky);
  let layer = layerIn(region);
  const document = overlay.ownerDocument, view = document?.defaultView;
  owners.set(overlay, region);
  // Attenuate the complete source as well: rays/ghosts may extend beyond the sky's
  // rectangular bounds near the horizon. Never leave those overflow pixels bare.
  overlay.style.setProperty('--orb-sun-transmission', model.active ? model.directTransmission.toFixed(4) : '1');
  if (!model.active) {
    if (layer) {
      layer[OWNER] = overlay;
      const now = view?.performance?.now?.() ?? Date.now();
      if (view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
        Number.isFinite(layer[EXIT]) && now - layer[EXIT] >= 1300) {
        layer.remove(); owners.delete(overlay);
      } else {
        if (!Number.isFinite(layer[EXIT])) layer[EXIT] = now;
        layer.style.opacity = '0';
      }
    } else owners.delete(overlay);
    return model;
  }
  const root = region.getRootNode?.() || document;
  if (!root?.querySelector?.('style[data-weather-fog-styles]')) {
    const style = document.createElement('style');
    style.setAttribute('data-weather-fog-styles', ''); style.textContent = styles;
    (root?.head || root)?.appendChild(style);
  }
  if (!layer) {
    layer = document.createElement('div'); layer.setAttribute('data-weather-layer', 'fog'); layer.setAttribute('aria-hidden', 'true');
    for (const name of ['base', 'halo']) {
      const child = document.createElement('div'); child.setAttribute(`data-weather-fog-${name}`, ''); layer.appendChild(child);
    }
    region.appendChild(layer);
  }
  layer[OWNER] = overlay;
  delete layer[EXIT]; layer.style.opacity = '1';
  const bounds = region.getBoundingClientRect(), orb = overlay.getBoundingClientRect();
  const preview = region.classList.contains('weather-header-preview');
  const riseValue = preview ? parseFloat(view?.getComputedStyle(overlay).getPropertyValue('--header-weather-cloud-rise')) : 0;
  const rise = Number.isFinite(riseValue) ? Math.max(0, riseValue) : 0;
  const width = Math.max(1, region.clientWidth || bounds.width), height = Math.max(1, (region.clientHeight || bounds.height) + rise);
  const scale = bounds.width > 0 ? bounds.width / width : 1;
  const radius = Math.max(0, orb.width / scale * .247);
  const left = Math.min(width / 2, radius + 5), top = Math.min(height / 2, radius + 4);
  const x = left + Math.max(0, width - left * 2) * clamp(number(part?.sky?.x) ?? .5, 0, 1);
  const y = top + Math.max(0, height - top * 2) * clamp(number(part?.sky?.y) ?? 1, 0, 1);
  layer.style.setProperty('top', `${-rise}px`, 'important');
  layer.style.setProperty('height', `${height}px`, 'important');
  const [base, halo] = layer.children;
  base.style.backgroundColor = `rgb(${model.color.join(',')})`; base.style.opacity = String(model.baseOpacity);
  const haloWidth = Math.max(120, width * .9), haloHeight = Math.max(100, height * 1.8);
  halo.style.width = `${haloWidth}px`; halo.style.height = `${haloHeight}px`;
  halo.style.color = `rgb(${model.haloColor.join(',')})`; halo.style.opacity = String(model.solarHalo);
  halo.style.transform = `translate(${(x - haloWidth / 2).toFixed(3)}px,${(y - haloHeight / 2).toFixed(3)}px)`;
  return model;
}
