/**
 * Compact rotating Sun for the header weather widget.
 * The canvas stays transparent; the Moon continues to use its separate overlay.
 */
import { Z as THREE } from '../../3d-weather-codrops-main/dist-widget/weather-3d-CKX6ob-m.mjs?v=20260728-weather-geo-v8';
const { solarPosition } = await import(new URL(`./weather-solar-time.js${new URL(import.meta.url).search}`, import.meta.url).href);
const SUN_RECOVERY_MODULE_URL = new URL(`./header-weather-sun-recovery.js${new URL(import.meta.url).search}`, import.meta.url).href;
const solarLifetimes = new WeakMap();

function retireSolarScene(api) {
  const record = solarLifetimes.get(api);
  if (record) record.dispose();
  else api?.dispose();
}

function ownSolarLifetime(api, lifetime) {
  let record = solarLifetimes.get(api);
  if (!record) {
    record = { dispose: api.dispose.bind(api), lifetime };
    solarLifetimes.set(api, record);
    api.dispose = () => {
      const scope = record.lifetime;
      if (scope.cancelled) return;
      scope.cancelled = true;
      retireSolarScene(scope.active);
    };
  } else record.lifetime = lifetime;
  lifetime.active = api;
  return api;
}

const TAU = Math.PI * 2;
const SUN_RADIUS = 0.7;
const SUN_CAMERA_DISTANCE = 4.55;
const SUN_VIEWPORT_OVERSCAN = 2.25;
const SUN_AXIAL_TILT = THREE.MathUtils.degToRad(7.25);
const SUN_START_ANGLE = THREE.MathUtils.degToRad(-34);
const WARM_SUN_COLOR = 0xffffe6;
const SOLAR_DAY_MS = 86400000;
const SOLAR_MODEL_EPOCH_MS = Date.UTC(2026, 10, 4);
const SOLAR_SURFACE_TONE = Object.freeze({ floor: .40, spotFloor: .06, power: .85, spotPower: .1, exposure: 1.6 });
// Illustrative lens coating reflections, placed on the source/optical-centre axis.
// The same descriptors drive GPU geometry and the native recovery's live layer.
const SOLAR_GHOSTS = [
  { kind: 'diamond', offset: .83, radius: .043, strength: .60, color: [.42, .75, .57] },
  { kind: 'soft', offset: .70, radius: .026, strength: .40, color: [1, .61, .39] },
  { kind: 'hexagon', offset: -.385, radius: .023, strength: .22, color: [.65, .75, 1] },
  { kind: 'ring', offset: .88, radius: .053, width: .0085, strength: .22, color: [.69, .82, .60] },
  { kind: 'diamond', offset: .56, radius: .026, strength: .34, color: [.43, .60, .90] },
  { kind: 'diamond', offset: -.52, radius: .018, strength: .20, color: [.85, .56, .88] },
  { kind: 'soft', offset: -.70, radius: .018, strength: .14, color: [.94, .56, .30] },
];
// Sparse, illustrative source-light streaks, separate from the short corona
// and camera ghosts. Seven one-sided beams cannot create fourteen mirror arms.
const SOLAR_LONG_RAYS = [
  { angle: -2.83, reach: .40, width: .011, seed: 4.8, rate: 2, bow: .006 },
  { angle: -1.77, reach: .34, width: .014, seed: .7, rate: -3, bow: -.004 },
  { angle: -.86, reach: .38, width: .010, seed: 3.9, rate: 4, bow: .007 },
  { angle: .18, reach: .31, width: .013, seed: 2.3, rate: -2, bow: -.003 },
  { angle: 1.04, reach: .39, width: .0095, seed: 5.9, rate: 3, bow: .005 },
  { angle: 1.93, reach: .35, width: .012, seed: 1.5, rate: -4, bow: -.006 },
  { angle: 2.59, reach: .37, width: .0105, seed: 3.1, rate: 5, bow: .004 },
];
const EARTH_ORBIT_DEG_PER_DAY = 360 / 365.256;
const SOLAR_COLOR_STOPS = linearSolarColorStops([
  [-0.833, 1, 0.22, 0.06],
  [0, 1, 0.34, 0.09],
  [3, 1, 0.64, 0.24],
  [6, 1, 0.89, 0.59],
  [12, 1, 1, 1],
]);
// Display calibration: a luminous photosphere remains pale while its optical
// surroundings are already golden. These are not spectra measured from photos.
const SOLAR_SURFACE_COLOR_STOPS = linearSolarColorStops([
  [-0.833, 1, 0.28, 0.07],
  [0, 1, 0.62, 0.18],
  [1, 1, 0.87, 0.48],
  [3, 1, 0.975, 0.86],
  [6, 1, 0.980, 0.89],
  [12, 1, 0.985, 0.905],
  [45, 1, 0.990, 0.915],
]);

function linearSolarColorStops(stops) {
  return stops.map(([height, ...rgb]) => [height, ...rgb.map(channel =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  )]);
}

// NOAA fractional-year approximation: UTC, east-positive longitude, geometric
// elevation in degrees. No network, timezone guess or constant refraction offset.
export function solarElevationDegrees(timeMs, latitude, longitude) {
  return solarPosition(timeMs, latitude, longitude).elevationDeg;
}

// Atmospheric colour is an illustrative display calibration, not a measured
// spectrum. Interpolate linear RGB smoothly; the high Sun is neutral white.
export function solarColorForElevation(elevationDeg, target = { r: 1, g: 1, b: 1 }) {
  return interpolateSolarColor(elevationDeg, SOLAR_COLOR_STOPS, target);
}

export function solarSurfaceColorForElevation(elevationDeg, target = { r: 1, g: 1, b: 1 }) {
  return interpolateSolarColor(elevationDeg, Number.isFinite(elevationDeg) ? SOLAR_SURFACE_COLOR_STOPS : SOLAR_COLOR_STOPS, target);
}

function interpolateSolarColor(elevationDeg, stops, target) {
  const height = Number.isFinite(elevationDeg) ? elevationDeg : 90;
  let low = stops[0];
  let high = low;
  for (const stop of stops) {
    high = stop;
    if (height <= stop[0]) break;
    low = stop;
  }
  const raw = high[0] === low[0] ? 0 : Math.max(0, Math.min(1, (height - low[0]) / (high[0] - low[0])));
  const weight = raw * raw * (3 - 2 * raw);
  target.r = low[1] + (high[1] - low[1]) * weight;
  target.g = low[2] + (high[2] - low[2]) * weight;
  target.b = low[3] + (high[3] - low[3]) * weight;
  return target;
}

// Mean Earth-view rotation, NASA Sun Fact Sheet. The unchanged source image is
// an illustration, not a live observation of the Sun's current active regions.
function solarRotationRateDegPerDay(latitudeDeg) {
  const latitude = Math.max(-90, Math.min(90, Number(latitudeDeg) || 0));
  const sin2 = Math.sin(latitude * Math.PI / 180) ** 2;
  return 14.37 - 2.33 * sin2 - 1.56 * sin2 ** 2 - EARTH_ORBIT_DEG_PER_DAY;
}

function solarRotationAngle(timeMs) {
  const days = (timeMs - SOLAR_MODEL_EPOCH_MS) / SOLAR_DAY_MS;
  const phase = days * solarRotationRateDegPerDay(0) * Math.PI / 180;
  return SUN_START_ANGLE + ((phase % TAU) + TAU) % TAU;
}

export function solarTextureOffsetTurns(timeMs, latitudeDeg) {
  const days = (timeMs - SOLAR_MODEL_EPOCH_MS) / SOLAR_DAY_MS;
  // Positive sampling-U moves a texture feature opposite to positive mesh-Y.
  return (solarRotationRateDegPerDay(0) - solarRotationRateDegPerDay(latitudeDeg)) * days / 360;
}

function prominenceRandom(event, salt) {
  let value = (event ^ salt) >>> 0;
  value = Math.imul(value ^ value >>> 16, 0x7feb352d);
  value = Math.imul(value ^ value >>> 15, 0x846ca68b);
  return ((value ^ value >>> 16) >>> 0) / 4294967296;
}

// Illustrative events, not observations. Absolute UTC keeps remounts and both
// renderers on one schedule without restarting a lane at local or UTC midnight.
export function solarProminenceState(timeMs, lane, target = {}) {
  const index = Math.max(0, Math.min(2, Math.floor(Number(lane) || 0)));
  const shifted = (Number.isFinite(timeMs) ? timeMs : SOLAR_MODEL_EPOCH_MS) / 1000 + index * 240;
  const event = Math.floor(shifted / 720);
  const age = shifted - event * 720;
  const salt = Math.imul(index + 1, 0x9e3779b1);
  const lifetime = 360 + prominenceRandom(event, salt ^ 0x23ae5f19) * 240;
  const rise = Math.max(0, Math.min(1, age / 45));
  const fall = Math.max(0, Math.min(1, (lifetime - age) / 90));
  target.angle = prominenceRandom(event, salt) * TAU;
  target.width = 0.007 + prominenceRandom(event, salt ^ 0x68bc21eb) * 0.013;
  target.height = 0.004 + prominenceRandom(event, salt ^ 0x02e5be93) * 0.0106;
  target.opacity = rise * rise * (3 - 2 * rise) * fall * fall * (3 - 2 * fall);
  return target;
}

function setupSolarPresentation(overlay) {
  if (!overlay?.style || !window.CSS?.registerProperty) return;
  for (const name of ['--orb-crossfade-opacity', '--orb-sun-transmission']) {
    try {
      window.CSS.registerProperty({ name, syntax: '<number>', inherits: true, initialValue: '1' });
    } catch (error) {
      if (error?.name !== 'InvalidModificationError') return;
    }
  }
  overlay.style.setProperty('transition', '--orb-crossfade-opacity 1.35s ease-in-out, --orb-sun-transmission 30s linear, translate var(--orb-sky-duration, 1s) linear', 'important');
}

function resolveSolarPixelRatio(width, height, dpr = 1, zoom = 1, maxSide = 1024) {
  const nativeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const viewportZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const side = Math.max(8, Number(width) || 8, Number(height) || 8);
  const limit = Math.max(8, Math.min(Number(maxSide) || 1024, 1024));
  return Math.min(nativeDpr * viewportZoom, limit / side);
}

function createSolarLensFlareMaterial(solarColorUniform, prominenceUniform, rayLengthScaleUniform, opticalCenterUniform) {
  // One transparent light layer: illustrative limb details plus optical ghosts
  // adapted from the maintained scene's LensFlare aperture/axis model. The
  // camera reflections remain separate from the modelled solar plasma below.
  const rgb = ghost => `vec3(${ghost.color.map(value => value.toFixed(3)).join(', ')})`;
  const ghostNames = ['diamond', 'softGhost', 'paleGhost', 'opticalRing', 'blueDiamond', 'violetDiamond', 'amberGhost'];
  // Unroll the small descriptor list once when creating the material. GPU and
  // native recovery keep one geometry model without a per-fragment loop.
  const ghostShapes = SOLAR_GHOSTS.map((ghost, index) => {
    const p = `p - direction * (${ghost.offset} * lensSpread)`;
    const shape = ghost.kind === 'ring'
      ? `solarGaussian((length(${p}) - ${ghost.radius}) / ${ghost.width})`
      : ghost.kind === 'soft'
        ? `solarGaussian(length(${p}) / ${ghost.radius})`
        : `apertureGhost(${p}, ${ghost.kind === 'diamond' ? '4.0' : '6.0'}, ${ghost.radius})`;
    return `float ${ghostNames[index]} = ${shape};`;
  }).join('\n  ');
  const ghostLight = SOLAR_GHOSTS.map((ghost, index) => `${ghostNames[index]} * ${rgb(ghost)} * ${ghost.strength}`).join('\n      + ');
  const glsl = value => value.toFixed(4);
  const longVaryings = SOLAR_LONG_RAYS.map((_, index) => `varying vec4 vSolarLongRay${index};`).join('\n');
  const longVertex = SOLAR_LONG_RAYS.map((ray, index) =>
    `vSolarLongRay${index} = solarLongLightState(${[ray.angle, ray.reach, ray.seed, ray.rate].map(glsl).join(', ')});`).join('\n  ');
  const longLight = SOLAR_LONG_RAYS.map((ray, index) =>
    `solarLongRay(p, vSolarLongRay${index}, ${glsl(ray.width)}, ${glsl(ray.bow)})`).join('\n    + ');
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpticalCenter: opticalCenterUniform,
      uOpticsEnabled: { value: 1 },
      uTime: { value: 0 },
      uRayLengthScale: rayLengthScaleUniform,
      uSolarColor: solarColorUniform,
      uPlasma: prominenceUniform,
      uPlasmaEnabled: { value: 1 },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `
uniform float uTime;
varying vec2 vSolarFlareUv;
${longVaryings}

vec4 solarLongLightState(float angle, float reach, float seed, float rate) {
  float phase = mod(uTime, 24.0) * (6.28318530718 / 24.0);
  float activity = 0.5 + 0.28 * sin(phase * 2.0 + seed)
    + 0.22 * sin(phase * 3.0 - seed * 1.3);
  float direction = angle + 0.035 * sin(phase * rate + seed)
    + 0.017 * sin(phase * (2.0 * rate - 1.0) - seed * 1.7);
  float strength = (0.04 + 0.96 * smoothstep(0.26, 0.76, activity))
    * (0.88 + 0.12 * sin(phase * (rate + 1.0) + seed * 0.7));
  return vec4(cos(direction), sin(direction), reach * (0.84 + 0.16 * activity), strength);
}

void main() {
  vSolarFlareUv = uv;
  // Uniform-only states are identical at all four vertices. Seven vec4 values
  // plus the UV use eight varying slots; no per-pixel animation trigonometry.
  ${longVertex}
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`,
    fragmentShader: `
uniform vec2 uOpticalCenter;
uniform float uOpticsEnabled;
uniform float uTime;
uniform float uRayLengthScale;
uniform vec3 uSolarColor;
uniform vec4 uPlasma[3];
uniform float uPlasmaEnabled;
varying vec2 vSolarFlareUv;
${longVaryings}

float solarGaussian(float q) {
  return exp(-(q * q));
}

float solarLongRay(vec2 p, vec4 ray, float rootWidth, float bow) {
  float along = dot(p, ray.xy) - 0.247;
  float fraction = clamp(along / ray.z, 0.0, 1.0);
  float across = dot(p, vec2(-ray.y, ray.x)) - bow * fraction * fraction;
  float width = rootWidth * (1.0 - fraction) * (1.0 - 0.3 * fraction);
  float footprint = max(fwidth(across) * 0.55, 0.0001);
  float filtered = sqrt(width * width + footprint * footprint);
  return solarGaussian(across / filtered) * width / filtered
    * smoothstep(-0.003, 0.015, along)
    * (1.0 - smoothstep(ray.z * 0.78, ray.z, along))
    * exp(-max(along, 0.0) / (ray.z * 0.82)) * ray.w;
}

float apertureGhost(vec2 p, float sides, float radius) {
  float angle = (length(p) > 0.00001 ? atan(p.y, p.x) : 0.0) + 0.78539816339;
  float sector = 6.28318530718 / sides;
  float edge = cos(floor(0.5 + angle / sector) * sector - angle) * length(p) / radius;
  float feather = max(fwidth(edge) * 1.3, 0.12);
  float body = 1.0 - smoothstep(1.0 - feather, 1.0 + feather, edge);
  float rim = solarGaussian((edge - 0.86) / 0.16);
  return body * (0.3 + 0.7 * rim);
}

float limbPlasma(vec2 p, float angle, float width, float height) {
  // Tiny illustrative limb structures, not a live H-alpha observation. Keep
  // their roots behind the original photosphere and deform them independently.
  vec2 normal = vec2(cos(angle), sin(angle));
  vec2 tangent = vec2(-normal.y, normal.x);
  float x = dot(p, tangent) / width;
  float y = dot(p, normal) - 0.247;
  float arch = height * (1.0 - x * x);
  float feather = max(fwidth(y) * 0.7, 0.001);
  float strand = solarGaussian((y - arch) / feather);
  float base = exp(-abs(y) / 0.004) * 0.22;
  return (strand + base) * (1.0 - smoothstep(0.65, 1.0, abs(x)))
    * smoothstep(0.247, 0.25, length(p));
}

void main() {
  vec2 p = (vSolarFlareUv - vec2(0.5)) * ${SUN_VIEWPORT_OVERSCAN.toFixed(2)};
  float radial = length(p);
  vec2 lensAxis = uOpticalCenter - vec2(0.5);
  float axisLength = length(lensAxis);
  vec2 direction = lensAxis / max(axisLength, 0.0001);
  float offAxis = smoothstep(0.02, 0.18, axisLength);
  float lensSpread = 0.88 + 0.26 * smoothstep(0.05, 1.4, axisLength);
  float rayPhase = mod(uTime, 24.0) * (6.28318530718 / 24.0);
  float shimmer = 0.99 + 0.01 * sin(rayPhase);

  // Meet the sphere's antialiased edge with a subpixel overlap. The central
  // original map stays untouched; an outward-only ramp leaves a dark seam.
  float outsideDisc = smoothstep(0.2445, 0.2465, radial);
  float haloBounds = 1.0 - smoothstep(0.475, 0.5, radial);
  float opticalBounds = 1.0 - smoothstep(1.05, 1.125, radial);
  float rayBounds = 1.0 - smoothstep(0.70, 0.75, radial);
  float aboveLimb = max(radial - 0.247, 0.0);
  float rayDistance = aboveLimb * 0.5;
  float angle = radial > 0.00001 ? atan(p.y, p.x) : 0.0;
  // Unequal streamers: light travels along short tapered rays. Each angular
  // band changes independently; there is no rotating crown of regular spokes.
  // Periodic local advection lets roots travel both ways around the disc.
  // Its angular slope stays positive, avoiding folds or jumps between roots.
  // This artistic 24-second loop meets both its recording seam and UTC midnight.
  // The photosphere, daily colour and prominence events keep their own clocks.
  float rayRootAngle = angle + 0.080 * sin(angle * 7.0 + rayPhase * 4.0 + 0.6)
    + 0.010 * sin(angle * 11.0 - rayPhase * 3.0 + 2.1)
    + 0.005 * sin(angle * 17.0 + rayPhase * 4.0 - 1.3)
    + 0.003 * sin(angle * 23.0 - rayPhase * 5.0 + 1.7)
    + 0.001 * sin(angle * 31.0 + rayPhase * 7.0 - 0.9);
  // Compose a second monotone angular field along each strand. The anchored
  // root has zero bend and slope; separate travelling waves flex its middle
  // and tip independently of neighbouring strands. Compose three local waves
  // rather than one shared sway. Each map stays monotone (minimum slopes
  // .145, .4, .475, .655), retaining flexible strands without angular folds.
  float bendAlong = aboveLimb / max(uRayLengthScale * 0.6, 0.001);
  float bendEnvelope = 1.0 - exp(-bendAlong * bendAlong / 0.0064);
  float bendFirst = rayRootAngle + bendEnvelope * 0.060
    * sin(rayRootAngle * 10.0 + rayPhase * 3.0 - bendAlong * 13.0);
  float bendSecond = bendFirst + bendEnvelope * 0.035
    * sin(bendFirst * 15.0 - rayPhase * 5.0 + bendAlong * 29.0 + 0.8);
  float rayAngle = bendSecond + bendEnvelope * 0.015
    * sin(bendSecond * 23.0 + rayPhase * 7.0 - bendAlong * 47.0 - 1.2);
  float structure = 0.6 + 0.16 * sin(rayAngle * 3.0 + 0.7)
    + 0.1 * sin(rayAngle * 5.0 - 1.3) + 0.07 * cos(rayAngle * 9.0 + 2.1)
    + 0.07 * sin(rayPhase * 2.0 + rayAngle * 4.0);
  // Separate narrow streamers from the steady halo. A strong diffuse floor
  // merges them into cloudy lobes at mobile size instead of visible rays.
  float finePhase = rayAngle * 41.0 + sin(rayAngle * 7.0) * 1.0
    + 0.2 * sin(rayPhase * 3.0 + rayAngle * 11.0 + 0.7)
    + 0.1 * cos(rayPhase * 5.0 - rayAngle * 13.0 + 1.2);
  vec2 phaseCircle = vec2(sin(finePhase - 1.57079632679), cos(finePhase - 1.57079632679));
  float phaseOffset = atan(phaseCircle.x, phaseCircle.y);
  float rootWidth = 3.01;
  float rootStrands = solarGaussian(phaseOffset / rootWidth);
  float peakFilaments = pow(clamp(structure, 0.0, 1.0), 1.35);
  float rootFilaments = peakFilaments * (0.06 + 0.94 * rootStrands);
  float lengthVariation = 0.012 * sin(rayPhase * 2.0 + angle * 3.0)
    + 0.006 * sin(rayPhase * 3.0 - angle * 7.0);
  // Another 25% shorter than the previous .8 profile; retain its wider roots
  // and tapered tips without changing the photosphere or optical geometry.
  float rayLengthScale = uRayLengthScale * 0.6;
  float peakLength = (0.035 + 0.045 * peakFilaments + lengthVariation) * rayLengthScale;
  float rayLength = (0.035 + 0.045 * rootFilaments + lengthVariation) * rayLengthScale;
  float rayFraction = clamp(rayDistance / (peakLength * 1.8), 0.0, 1.0);
  // R/r compensates radial spreading: physical width tapers towards the tip.
  float widthPhase = rootWidth * (0.247 / max(radial, 0.247)) * (1.0 - rayFraction);
  float phaseFootprint = 0.35 * length(fwidth(phaseCircle));
  float filteredWidth = max(sqrt(widthPhase * widthPhase + phaseFootprint * phaseFootprint), 0.0001);
  float fineStrands = solarGaussian(phaseOffset / filteredWidth) * widthPhase / filteredWidth;
  float filaments = peakFilaments * fineStrands;
  float pulse = 0.82 + 0.18 * sin(rayPhase * 3.0 - rayDistance * 34.0 + angle * 3.0)
    + 0.1 * sin(rayPhase * 2.0 - rayDistance * 53.0 - angle * 5.0);
  // Faint short strands fill selected gaps without turning the corona into a
  // solid halo. Their separate phase and taper leave the long streamers legible.
  float wispPhase = rayAngle * 61.0 + 0.7 * sin(rayAngle * 11.0 - rayPhase * 3.0)
    + 0.3 * sin(rayAngle * 5.0 + rayPhase * 4.0);
  vec2 wispCircle = vec2(sin(wispPhase), cos(wispPhase));
  float wispOffset = atan(wispCircle.x, wispCircle.y);
  float wispLength = (0.025 + 0.012 * sin(angle * 4.0 - rayPhase * 2.0)) * rayLengthScale;
  float wispFraction = clamp(rayDistance / (wispLength * 1.8), 0.0, 1.0);
  float wispWidth = 1.148 * (0.247 / max(radial, 0.247)) * (1.0 - wispFraction);
  float wispFootprint = 0.35 * length(fwidth(wispCircle));
  float wispFiltered = max(sqrt(wispWidth * wispWidth + wispFootprint * wispFootprint), 0.0001);
  float wisps = solarGaussian(wispOffset / wispFiltered) * wispWidth / wispFiltered
    * (1.0 - smoothstep(0.12, 0.5, rootStrands)) * 0.16
    * exp(-rayDistance / wispLength)
    * (1.0 - smoothstep(wispLength * 0.9, wispLength * 1.8, rayDistance));
  float rays = filaments * pulse * exp(-rayDistance / rayLength)
    * (1.0 - smoothstep(rayLength * 0.9, rayLength * 1.8, rayDistance)) + wisps;
  float halo = exp(-aboveLimb / 0.03) * 0.16
    + exp(-pow(aboveLimb / 0.08, 2.0)) * 0.025;
  float plasma = uPlasmaEnabled * (limbPlasma(p, uPlasma[0].x, uPlasma[0].y, uPlasma[0].z) * uPlasma[0].w
    + limbPlasma(p, uPlasma[1].x, uPlasma[1].y, uPlasma[1].z) * uPlasma[1].w
    + limbPlasma(p, uPlasma[2].x, uPlasma[2].y, uPlasma[2].z) * uPlasma[2].w);
  vec2 glint = mat2(0.70710678, -0.70710678, 0.70710678, 0.70710678) * p;
  float diffraction = exp(-abs(glint.x) * 230.0 - abs(glint.y) * 12.0)
    + exp(-abs(glint.y) * 230.0 - abs(glint.x) * 12.0);
  ${ghostShapes}
  float longRays = ${longLight};
  vec3 light = vec3(halo + diffraction * 0.65 + plasma * 0.6) * haloBounds
    + uOpticsEnabled * offAxis * opticalBounds * (${ghostLight});
  light += vec3(rays * 1.84) * rayBounds;
  light += vec3(longRays * 0.82) * rayBounds;
  light *= uSolarColor * outsideDisc * shimmer;
  float alpha = clamp(max(light.r, max(light.g, light.b)), 0.0, 0.7);
  gl_FragColor = vec4(light / max(alpha, 0.0001), alpha);
  #include <colorspace_fragment>
}`,
  });
}

function loadTexture(url, textures, renderer, onPhase, sourceImage, isCurrent = () => true) {
  if (!url) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    let settled = false, pendingTexture;
    const finish = (error, texture) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        if (pendingTexture && isCurrent()) {
          const index = textures?.indexOf?.(pendingTexture) ?? -1;
          if (index >= 0) textures.splice(index, 1);
          pendingTexture.dispose();
        }
        reject(error);
      } else resolve(texture);
    };
    const matchesImage = decoded => {
      const declared = sourceImage?.getAttribute?.('src') || sourceImage?.src;
      if (!declared) return false;
      try {
        const base = sourceImage.baseURI || globalThis.location?.href;
        const target = new URL(url, base).href;
        return new URL(declared, base).href === target &&
          (!decoded || !sourceImage.currentSrc || new URL(sourceImage.currentSrc, base).href === target);
      } catch { return false; }
    };
    const reuseImage = typeof sourceImage?.decode === 'function' && matchesImage(false);
    const retain = texture => {
      if (!texture || texture === pendingTexture) return true;
      if (settled || !isCurrent()) {
        texture.dispose();
        finish(new Error('The solar surface texture initialization was cancelled.'));
        return false;
      }
      pendingTexture = texture;
      textures?.push?.(texture);
      return true;
    };
    const prepare = async texture => {
      if (!retain(texture)) return;
      if (settled) return;
      try {
        onPhase?.('texture-decode');
        await texture.image?.decode?.();
        if (settled) return;
        if (!isCurrent()) throw new Error('The solar surface texture initialization was cancelled.');
        if (reuseImage && !matchesImage(true)) throw new Error('The solar surface image changed during decoding.');
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = Math.min(renderer?.capabilities?.getMaxAnisotropy?.() || 1, 16);
        texture.needsUpdate = true;
        finish(null, texture);
      } catch (error) { finish(error); }
    };
    const timer = setTimeout(() => finish(new Error('The solar surface texture initialization timed out.')), 25000);
    try {
      if (reuseImage) {
        if (sourceImage.loading === 'lazy') sourceImage.loading = 'eager';
        void prepare(new THREE.Texture(sourceImage));
      } else {
        retain(new THREE.TextureLoader().load(url, prepare, undefined,
          () => finish(new Error('The solar surface texture could not load.'))));
      }
    } catch (error) { finish(error); }
  });
}

export class HeaderWeatherSunScene {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    Object.defineProperty(this, 'viewportOverscan', { value: SUN_VIEWPORT_OVERSCAN });
    setupSolarPresentation(canvas.parentElement);
    this.initializationOwner = Symbol();
    canvas.__sunInitializationOwner = this.initializationOwner;
    canvas.dataset.sunInitStage = 'constructor';
    delete canvas.__sunContextCreationError;
    this.options = options;
    this.geoState = {
      latitude: null,
      longitude: null,
      timeMs: Date.now(),
    };
    this.running = false;
    this.rafId = 0;
    this.resizeRafId = 0;
    this.solarDaysUniform = { value: 0 };
    this.solarSurfaceColorUniform = { value: new THREE.Color(0xffffff) };
    this.solarColorUniform = this.solarSurfaceColorUniform;
    this.surfaceModel = { radius: SUN_RADIUS, cameraDistance: SUN_CAMERA_DISTANCE, fov: 35,
      axialTilt: SUN_AXIAL_TILT, rotation: solarRotationAngle,
      days: timeMs => (timeMs - SOLAR_MODEL_EPOCH_MS) / SOLAR_DAY_MS, tone: SOLAR_SURFACE_TONE };
    this.solarAppearanceTarget = new THREE.Color(0xffffff);
    this.appearanceBlend = null;
    this.prominenceStates = [{}, {}, {}];
    this.prominenceUniform = { value: new Float32Array(12) };
    this.rayLengthScaleUniform = { value: 1 };
    this.opticalCenterUniform = { value: new THREE.Vector2(.22, .32) };
    this.opticalStates = SOLAR_GHOSTS.map(ghost => ({ kind: ghost.kind }));
    this.solarSpotStrengthUniform = { value: 0 };
    this.appearanceKey = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.renderScale = 1;
    this.pendingRemovalObserver = null;
    this.sunGroup = null;
    this.sunMesh = null;
    this.flareMesh = null;
    this.textures = [];
    this.disposed = false;
    this.contextLost = false;
    this.onResize = () => {
      if (this.disposed || this.contextLost || this.resizeRafId) return;
      this.resizeRafId = requestAnimationFrame(() => {
        this.resizeRafId = 0;
        if (this.disposed || this.contextLost) return;
        this.resize();
        if (this.running) this.renderFrame();
      });
    };
    this.onContextLost = event => {
      event.preventDefault();
      this.contextLost = true;
      this.resumeAfterRestore = this.running;
      this.lastError = new Error('The live solar graphics context was lost.');
      this.stop();
      this.setState('lost');
    };
    this.onContextRestored = () => {
      if (this.disposed) return;
      this.contextLost = false;
      this.resize();
      if (this.resumeAfterRestore) this.start();
    };
    this.onPageHide = () => {
      const resume = this.running || this.resumeAfterPage;
      this.stop(); this.resumeAfterPage = resume;
    };
    this.onPageShow = () => {
      if (!this.ownsInitialization() || this.canvas.ownerDocument?.hidden) return;
      const resume = this.running || this.resumeAfterPage;
      if (!resume) return;
      this.stop();
      if (!this.contextLost && this.renderer?.getContext?.()?.isContextLost?.()) this.onContextLost({ preventDefault() {} });
      if (!this.disposed) this.start();
    };
    this.onVisibility = () => this.canvas.ownerDocument?.hidden ? this.onPageHide() : this.onPageShow();
    this.setGeoState(options.geoState);
    this.updateSolarAppearance(this.getTimeMs());
  }

  setState(state) {
    if (this.state === state) return;
    this.state = state;
    this.options.onStateChange?.(state);
  }

  ownsInitialization() {
    return !this.disposed && this.canvas.isConnected !== false &&
      this.canvas.__sunInitializationOwner === this.initializationOwner && this.options.isCurrent?.() !== false;
  }

  setInitializationStage(stage) {
    if (this.ownsInitialization()) this.canvas.dataset.sunInitStage = stage;
  }

  setGeoState(next) {
    if (!next) {
      return;
    }
    for (const [name, limit] of [['latitude', 90], ['longitude', 180]]) {
      const value = next[name] == null || next[name] === '' ? NaN : Number(next[name]);
      if (Number.isFinite(value) && Math.abs(value) <= limit) this.geoState[name] = value;
    }
    if (Number.isFinite(next.timeMs)) this.geoState.timeMs = next.timeMs;
    this.geoState.appearanceTimeMs = Number.isFinite(next.appearanceTimeMs) ? next.appearanceTimeMs : null;
    this.updateSolarAppearance(this.getTimeMs());
  }

  getTimeMs() {
    const now = this.options.getTimeMs?.();
    return Number.isFinite(now) ? now : Date.now();
  }

  getProminenceStates(timeMs = this.getTimeMs()) {
    for (let lane = 0; lane < 3; lane++) solarProminenceState(timeMs, lane, this.prominenceStates[lane]);
    return this.prominenceStates;
  }

  updateSolarAppearance(timeMs) {
    // A daily forecast samples its daytime colour without changing the live
    // animation clock used by rotation, surface features and optical effects.
    const appearanceTimeMs = Number.isFinite(this.geoState.appearanceTimeMs) ? this.geoState.appearanceTimeMs : timeMs;
    const { elevationDeg, hourAngleDeg } = solarPosition(appearanceTimeMs, this.geoState.latitude, this.geoState.longitude);
    const target = solarSurfaceColorForElevation(elevationDeg, this.solarAppearanceTarget);
    const color = this.solarSurfaceColorUniform.value;
    const now = performance.now();
    let blend = this.appearanceBlend;
    if (!blend) {
      blend = this.appearanceBlend = { latitude: this.geoState.latitude, longitude: this.geoState.longitude,
        forecast: this.geoState.appearanceTimeMs, timeMs, sampledAt: now, startedAt: now, active: false };
      color.setRGB(target.r, target.g, target.b);
    } else {
      const clockShift = timeMs !== blend.timeMs && Math.abs(timeMs - blend.timeMs - Math.max(0, now - blend.sampledAt)) > 250;
      if (clockShift || blend.latitude !== this.geoState.latitude || blend.longitude !== this.geoState.longitude || blend.forecast !== this.geoState.appearanceTimeMs) {
        if (Math.max(Math.abs(target.r - color.r), Math.abs(target.g - color.g), Math.abs(target.b - color.b)) > 1e-12) {
          blend.fromR = color.r; blend.fromG = color.g; blend.fromB = color.b;
          blend.startedAt = now; blend.active = true;
        } else blend.active = false;
      }
      const progress = blend.active ? Math.max(0, Math.min(1, (now - blend.startedAt) / 1200)) : 1;
      const weight = progress * progress * (3 - 2 * progress);
      color.setRGB(blend.active ? blend.fromR + (target.r - blend.fromR) * weight : target.r,
        blend.active ? blend.fromG + (target.g - blend.fromG) * weight : target.g,
        blend.active ? blend.fromB + (target.b - blend.fromB) * weight : target.b);
      if (progress === 1 && blend.active) { blend.active = false; this.appearanceKey = null; }
      blend.latitude = this.geoState.latitude; blend.longitude = this.geoState.longitude;
      blend.forecast = this.geoState.appearanceTimeMs; blend.timeMs = timeMs; blend.sampledAt = now;
    }
    const low = SOLAR_COLOR_STOPS[0][0];
    const high = SOLAR_COLOR_STOPS[SOLAR_COLOR_STOPS.length - 1][0];
    const warmth = Number.isFinite(elevationDeg)
      ? Math.max(0, Math.min(1, (high - elevationDeg) / (high - low))) : 0;
    // A display contrast preference, not physical changes to magnetic regions.
    // Solar hour angle follows local apparent noon, never the device's wall clock.
    const setting = Math.max(0, Math.min(1, Math.sin(hourAngleDeg * Math.PI / 180) * 4)) || 0;
    this.solarSpotStrengthUniform.value = warmth * (0.35 + 0.65 * setting * setting * (3 - 2 * setting));
    const key = `${Math.round(warmth * 200)}:${Math.round(this.solarSurfaceColorUniform.value.b * 255)}`;
    if (key !== this.appearanceKey) {
      this.appearanceKey = key;
      const surfaceBlue = this.solarSurfaceColorUniform.value.b;
      const srgbBlue = surfaceBlue <= 0.0031308 ? surfaceBlue * 12.92 : 1.055 * surfaceBlue ** (1 / 2.4) - 0.055;
      const recoveryWarmth = Math.max(0, Math.min(1, (1 - srgbBlue) / 0.93));
      const glowRgb = [color.r, color.g, color.b].map(channel => Math.round(255 *
        (channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055)
      )).join(' ');
      // Native image recovery remains phase-aware when WebGL is unavailable.
      this.options.onAppearanceChange?.({
        elevationDeg,
        glowRgb,
        recoveryFilter: `grayscale(1) contrast(0.04) brightness(${(1.9 - recoveryWarmth * 1.45).toFixed(3)}) sepia(${recoveryWarmth.toFixed(3)}) saturate(${(1 + recoveryWarmth ** 2 * 19).toFixed(3)}) brightness(${(1 + recoveryWarmth * 0.2).toFixed(3)})`,
      });
    }
  }

  async init() {
    if (!this.ownsInitialization()) {
      this.dispose();
      return;
    }
    if (this.renderer) {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 20);
    this.setInitializationStage('renderer-create');
    const onCreationError = event => {
      const message = event.statusMessage;
      this.canvas.__sunContextCreationError = typeof message === 'string' ? message.slice(0, 300) : '';
    };
    this.canvas.addEventListener('webglcontextcreationerror', onCreationError);
    let renderer;
    try {
      const attributes = { alpha: true, depth: true, stencil: false, antialias: true,
        premultipliedAlpha: true, preserveDrawingBuffer: false,
        powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false };
      this.canvas.dataset.sunContextProfile = 'unavailable';
      let context = this.canvas.getContext('webgl2', attributes);
      let compatible = false;
      if (!context) {
        attributes.antialias = false;
        attributes.powerPreference = 'default';
        context = this.canvas.getContext('webgl2', attributes);
        compatible = true;
      }
      if (!context) throw new Error('Error creating WebGL context.');
      if (context.isContextLost()) throw new Error('Solar graphics context was lost during preparation.');
      const noMsaa = context.getContextAttributes()?.antialias === false;
      this.renderScale = noMsaa ? 2 : 1;
      this.canvas.dataset.sunContextProfile = compatible || noMsaa ? 'compatible' : 'preferred';
      delete this.canvas.__sunContextCreationError;
      renderer = new THREE.WebGLRenderer({
        ...attributes,
        canvas: this.canvas,
        context,
      });
    } finally {
      this.canvas.removeEventListener('webglcontextcreationerror', onCreationError);
    }
    // Retain immediately so every later initialization failure can dispose it.
    this.renderer = renderer;
    if (renderer.debug) {
      renderer.debug.checkShaderErrors = true;
      renderer.debug.onShaderError = () => {
        this.shaderError = new Error('A solar material shader could not compile or link.');
      };
    }
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = SOLAR_SURFACE_TONE.exposure;

    this.canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    window.addEventListener?.('resize', this.onResize, { passive: true });
    window.visualViewport?.addEventListener?.('resize', this.onResize, { passive: true });
    window.addEventListener?.('pagehide', this.onPageHide);
    window.addEventListener?.('pageshow', this.onPageShow);
    this.canvas.ownerDocument?.addEventListener?.('visibilitychange', this.onVisibility);
    const root = this.canvas.getRootNode?.();
    if (root && typeof MutationObserver === 'function') {
      this.pendingRemovalObserver = new MutationObserver(() => {
        if (this.canvas.isConnected === false) this.dispose();
      });
      this.pendingRemovalObserver.observe(root, { childList: true, subtree: true });
      const document = this.canvas.ownerDocument;
      if (document && document !== root) {
        this.pendingRemovalObserver.observe(document, { childList: true, subtree: true });
      }
    }

    this.setInitializationStage('texture-load');
    const sunTexture = await loadTexture(this.options.sunTextureUrl, this.textures, renderer,
      phase => { this.setInitializationStage(phase); }, this.canvas.parentElement?.querySelector?.('img'),
      () => this.ownsInitialization()).catch(error => {
      if (this.ownsInitialization()) throw error;
      return null;
    });
    this.pendingRemovalObserver?.disconnect();
    this.pendingRemovalObserver = null;
    if (!this.ownsInitialization()) {
      this.dispose();
      return;
    }
    if (this.contextLost) throw new Error('Solar graphics context was lost during preparation.');
    this.setInitializationStage('texture-upload');
    if (sunTexture) renderer.initTexture(sunTexture);

    this.setInitializationStage('scene-setup');
    const surfaceColor = new THREE.Color(sunTexture ? 0xffffff : WARM_SUN_COLOR);
    const sunMaterial = new THREE.MeshBasicMaterial({
      map: sunTexture || null,
      color: surfaceColor,
      toneMapped: true,
      transparent: false,
      depthWrite: true,
    });
    sunMaterial.onBeforeCompile = shader => {
      shader.uniforms.uSolarDays = this.solarDaysUniform;
      shader.uniforms.uSolarSurfaceColor = this.solarSurfaceColorUniform;
      shader.uniforms.uSolarSpotStrength = this.solarSpotStrengthUniform;
      const mapChunk = THREE.ShaderChunk.map_fragment.replace(/\bvMapUv\b/g, 'solarMapUv');
      shader.fragmentShader = 'uniform float uSolarDays;\nuniform vec3 uSolarSurfaceColor;\nuniform float uSolarSpotStrength;\n' + shader.fragmentShader.replace('#include <map_fragment>', `
#ifdef USE_MAP
  vec2 solarMapUv = vMapUv;
  float solarSinLatitude = sin((vMapUv.y - 0.5) * 3.141592653589793);
  float solarSin2 = solarSinLatitude * solarSinLatitude;
  solarMapUv.x += uSolarDays * (2.33 * solarSin2 + 1.56 * solarSin2 * solarSin2) / 360.0;
#endif
${mapChunk}
#ifdef USE_MAP
  float solarLuminance = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  // Retain faint original detail after ACES and the shared CSS display gain;
  // no extra spot layer, disc or dark limb is introduced.
  diffuseColor.rgb = vec3(mix(${SOLAR_SURFACE_TONE.floor} - ${SOLAR_SURFACE_TONE.spotFloor} * uSolarSpotStrength, 1.0, pow(clamp(solarLuminance, 0.0, 1.0), ${SOLAR_SURFACE_TONE.power} + ${SOLAR_SURFACE_TONE.spotPower} * uSolarSpotStrength)));
#endif`).replace('#include <tonemapping_fragment>', '#include <tonemapping_fragment>\ngl_FragColor.rgb *= uSolarSurfaceColor;');
    };
    sunMaterial.customProgramCacheKey = () => 'header-solar-atmosphere-v8';
    const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(SUN_RADIUS, 96, 72), sunMaterial);
    sunMesh.renderOrder = 1;

    const sunGroup = new THREE.Group();
    sunGroup.position.y = 0;
    sunGroup.rotation.z = SUN_AXIAL_TILT;
    sunGroup.add(sunMesh);
    scene.add(sunGroup);

    const flareMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), createSolarLensFlareMaterial(this.solarColorUniform, this.prominenceUniform, this.rayLengthScaleUniform, this.opticalCenterUniform));
    flareMesh.renderOrder = 2;
    flareMesh.frustumCulled = false;
    scene.add(flareMesh);

    camera.position.set(0, 0, SUN_CAMERA_DISTANCE);
    camera.lookAt(0, 0, 0);

    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.sunGroup = sunGroup;
    this.sunMesh = sunMesh;
    this.flareMesh = flareMesh;
    this.setInitializationStage('resize');
    this.resize();
    this.updateAnimation(this.getTimeMs());
    // One small material: prepare it synchronously so context loss cannot strand
    // a third-party compileAsync polling loop. The first frame stays hidden.
    this.setInitializationStage('shader-compile');
    renderer.compile(scene, camera);
    if (this.shaderError) throw this.shaderError;
    if (renderer.getContext().isContextLost()) throw new Error('Solar graphics context was lost before the first frame.');
    this.setInitializationStage('first-frame');
    this.renderFrame();
    this.setInitializationStage('running');
  }

  resize() {
    if (!this.renderer || !this.camera || !this.canvas || this.contextLost) {
      return;
    }
    const width = Math.max(8, Math.round(this.canvas.clientWidth));
    const height = Math.max(8, Math.round(this.canvas.clientHeight));
    const logicalWidth = width / SUN_VIEWPORT_OVERSCAN;
    const logicalHeight = height / SUN_VIEWPORT_OVERSCAN;
    this.rayLengthScaleUniform.value = 0.80 + 0.50 * Math.max(0, Math.min(1, (92 - logicalWidth) / 24));
    const pixelRatio = resolveSolarPixelRatio(width, height, (window.devicePixelRatio || 1) * this.renderScale,
      window.visualViewport?.scale || 1, this.renderer.capabilities?.maxTextureSize || 1024);
    this.renderer.setPixelRatio(pixelRatio);
    // WebGLRenderer applies its pixel ratio to these CSS dimensions itself.
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.setViewOffset(logicalWidth, logicalHeight, (logicalWidth - width) / 2, (logicalHeight - height) / 2, width, height);
    this.camera.updateProjectionMatrix();
    this.updateOpticalGeometry();
  }

  updateOpticalGeometry() {
    const opticalCenter = this.options.getOpticalCenter?.();
    if (Number.isFinite(opticalCenter?.x) && Number.isFinite(opticalCenter?.y)) {
      const scale = opticalCenter.space === 'logical' ? 1 : SUN_VIEWPORT_OVERSCAN;
      this.opticalCenterUniform.value.set(
        0.5 + (opticalCenter.x - 0.5) * scale,
        0.5 + (opticalCenter.y - 0.5) * scale);
    } else {
      // Recovery hides the canvas. Derive the same logical axis from its visible
      // overlay, rather than reading a zero-size canvas or rotating the Sun map.
      const overlay = this.canvas.parentElement;
      const bounds = overlay?.getBoundingClientRect?.();
      const region = overlay?.closest?.('.weather-header-preview, .weather-header-dropdown__hero')?.getBoundingClientRect?.();
      if (bounds?.width > 0 && bounds?.height > 0 && region?.width > 0 && region?.height > 0) {
        this.opticalCenterUniform.value.set(
          (region.left + region.width / 2 - bounds.left) / bounds.width,
          1 - (region.top + region.height / 2 - bounds.top) / bounds.height);
      }
    }
    return this.opticalCenterUniform.value;
  }

  getOpticalState(timeMs = this.getTimeMs()) {
    const center = this.updateOpticalGeometry();
    this.updateSolarAppearance(timeMs);
    const x = center.x - .5, y = center.y - .5, length = Math.hypot(x, y);
    const smooth = (low, high) => {
      const t = Math.max(0, Math.min(1, (length - low) / (high - low)));
      return t * t * (3 - 2 * t);
    };
    const spread = .88 + .26 * smooth(.05, 1.4);
    const opacity = smooth(.02, .18) * (.99 + .01 * Math.sin(timeMs / 1000 * TAU / 24));
    const color = this.solarColorUniform.value;
    const srgb = value => (value <= .0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - .055) * 255;
    for (let index = 0; index < SOLAR_GHOSTS.length; index++) {
      const ghost = SOLAR_GHOSTS[index], state = this.opticalStates[index];
      const distance = ghost.offset * spread / Math.max(length, .0001);
      const channels = [color.r, color.g, color.b].map((channel, axis) => channel * ghost.color[axis]);
      const peak = Math.max(...channels, .0001);
      state.x = 50 + x * distance * 100;
      state.y = 50 - y * distance * 100;
      state.size = ghost.radius * 200;
      state.opacity = Math.min(.7, opacity * ghost.strength * peak);
      state.color = channels.map(channel => srgb(Math.max(0, Math.min(1, channel / peak))).toFixed(3)).join(' ');
    }
    return this.opticalStates;
  }

  updateAnimation(timeMs = Date.now()) {
    if (!this.sunMesh) {
      return;
    }

    this.sunMesh.rotation.y = solarRotationAngle(timeMs);
    const prominences = this.getProminenceStates(timeMs);
    for (let lane = 0; lane < 3; lane++) {
      const state = prominences[lane], offset = lane * 4;
      this.prominenceUniform.value[offset] = state.angle;
      this.prominenceUniform.value[offset + 1] = state.width;
      this.prominenceUniform.value[offset + 2] = state.height;
      this.prominenceUniform.value[offset + 3] = state.opacity;
    }
    this.solarDaysUniform.value = (timeMs - SOLAR_MODEL_EPOCH_MS) / SOLAR_DAY_MS;
    this.updateSolarAppearance(timeMs);
    if (this.flareMesh) {
      this.updateOpticalGeometry();
      this.flareMesh.material.uniforms.uTime.value = ((timeMs % SOLAR_DAY_MS) + SOLAR_DAY_MS) % SOLAR_DAY_MS / 1000;
    }
  }

  renderFrame() {
    if (!this.renderer || !this.scene || !this.camera) {
      return;
    }
    this.updateAnimation(this.getTimeMs());
    this.renderer.render(this.scene, this.camera);
    if (this.shaderError) throw this.shaderError;
  }

  start() {
    if (this.disposed || this.running) {
      return;
    }
    if (this.contextLost) {
      this.resumeAfterRestore = true;
      return;
    }
    this.running = true;
    const tick = () => {
      if (this.canvas.isConnected === false) {
        this.dispose();
        return;
      }
      if (!this.running) {
        return;
      }
      try {
        this.renderFrame();
        this.setState('ready');
      } catch (error) {
        this.lastError = error;
        this.stop();
        this.setState('failed');
        return;
      }
      this.rafId = requestAnimationFrame(tick);
    };
    tick();
  }

  stop() {
    this.running = false;
    this.resumeAfterPage = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  dispose() {
    if (this.disposed) return;
    const releaseContext = this.canvas.isConnected === false &&
      this.canvas.__sunInitializationOwner === this.initializationOwner;
    this.disposed = true;
    this.stop();
    this.pendingRemovalObserver?.disconnect();
    this.pendingRemovalObserver = null;
    if (this.resizeRafId) cancelAnimationFrame(this.resizeRafId);
    this.resizeRafId = 0;
    window.removeEventListener?.('resize', this.onResize);
    window.visualViewport?.removeEventListener?.('resize', this.onResize);
    window.removeEventListener?.('pagehide', this.onPageHide);
    window.removeEventListener?.('pageshow', this.onPageShow);
    this.canvas.ownerDocument?.removeEventListener?.('visibilitychange', this.onVisibility);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    if (this.sunMesh) {
      this.sunMesh.geometry?.dispose();
      this.sunMesh.material?.dispose();
    }
    this.flareMesh?.geometry.dispose();
    this.flareMesh?.material.dispose();
    this.textures.forEach(texture => texture.dispose());
    this.textures = [];
    this.renderer?.dispose();
    if (releaseContext) this.renderer?.forceContextLoss?.();
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.sunGroup = null;
    this.sunMesh = null;
    this.flareMesh = null;
  }
}

export async function mountHeaderWeatherSunScene(canvas, options = {}) {
  let live = false, pendingRecovery;
  const scope = { active: null, cancelled: false };
  const lifetime = () => solarLifetimes.get(scene)?.lifetime || scope;
  const scene = new HeaderWeatherSunScene(canvas, { ...options, onStateChange: state => {
    options.onStateChange?.(state);
    const overlay = canvas.parentElement;
    if (live && !options.disableRecovery && !pendingRecovery && !lifetime().cancelled && scene.ownsInitialization() &&
      overlay?.__sunScene === scene && overlay.querySelector('video') && (state === 'lost' || state === 'failed')) {
      pendingRecovery = recover(scene.lastError || new Error('The live solar renderer became unavailable.'));
      void pendingRecovery.catch(error => {
        if (overlay.__sunScene === scene) overlay.__sunSceneError = error;
      });
    }
  } });
  const recover = async error => {
    const scope = lifetime();
    const failedContext = scene.renderer?.getContext?.();
    const overlay = canvas.parentElement;
    const replaceLive = overlay?.__sunScene === scene;
    retireSolarScene(scene);
    if (!options?.disableRecovery && overlay?.querySelector('video')) {
      const token = overlay.__sunSceneMountToken, owner = scene.initializationOwner;
      let restoring = false, recovery;
      const current = () => !scope.cancelled && canvas.isConnected !== false && overlay.__sunSceneMountToken === token &&
        options.isCurrent?.() !== false && (restoring || canvas.__sunInitializationOwner === owner);
      try {
        const module = await import(SUN_RECOVERY_MODULE_URL);
        if (!current()) throw error;
        overlay.__sunSceneError = error;
        recovery = await module.mountNativeSunRecovery({
          canvas, photometry: scene, options, isCurrent: current,
          releaseContext: () => {
            if (canvas.isConnected === false && canvas.__sunInitializationOwner === owner && !failedContext?.isContextLost()) {
              failedContext?.getExtension?.('WEBGL_lose_context')?.loseContext();
            }
          },
          restore: async () => {
            if (!current() || overlay.__sunScene !== recovery) return;
            restoring = true;
            let accepted = false;
            const restoreOptions = { ...options, disableRecovery: true,
              onStateChange: state => { if (accepted) options.onStateChange?.(state); },
              isCurrent: () => overlay.__sunSceneMountToken === token && (accepted || !recovery.disposed) };
            const pending = mountHeaderWeatherSunScene(canvas, restoreOptions);
            const nextOwner = canvas.__sunInitializationOwner;
            try {
              const restored = await pending;
              if (restored.state !== 'ready') { restored.dispose(); throw new Error('Solar GPU restoration did not produce a ready frame.'); }
              if (!current() || recovery.disposed || overlay.__sunScene !== recovery) { restored.dispose(); return; }
              accepted = true;
              // Suppress recovery only during the speculative initialization;
              // a later failure of the accepted live scene needs the same handoff.
              restoreOptions.disableRecovery = restored.options.disableRecovery = options.disableRecovery;
              retireSolarScene(recovery);
              ownSolarLifetime(restored, scope);
              canvas.hidden = false; overlay.__sunScene = restored;
              restored.setGeoState(overlay.__sunLatestAssetConfig?.geoState || scene.geoState);
              overlay.dataset.sunRenderMode = 'webgl'; delete overlay.__sunSceneError;
              options.onStateChange?.(restored.state);
            } catch {
              if (overlay.__sunSceneMountToken === token && canvas.__sunInitializationOwner === nextOwner) canvas.__sunInitializationOwner = owner;
            } finally { restoring = false; }
          },
        });
        if (!current()) { recovery.dispose(); throw error; }
        if (replaceLive) {
          if (overlay.__sunScene !== scene) { recovery.dispose(); throw error; }
          overlay.__sunScene = recovery;
          recovery.setGeoState(overlay.__sunLatestAssetConfig?.geoState || scene.geoState);
        }
        return ownSolarLifetime(recovery, scope);
      } catch { throw error; }
    }
    throw error;
  };
  try {
    await scene.init();
    if (scene.disposed) return scene;
    scene.start();
    if (scene.state !== 'ready') throw scene.lastError || new Error('The solar renderer did not produce a ready frame.');
    live = true;
    return ownSolarLifetime(scene, scope);
  } catch (error) {
    return recover(error);
  }
}

export function unmountHeaderWeatherSunScene(scene) {
  scene?.dispose();
}
