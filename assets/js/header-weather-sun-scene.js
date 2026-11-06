/**
 * Compact rotating Sun for the header weather widget.
 * The canvas stays transparent; the Moon continues to use its separate overlay.
 */
import { Z as THREE } from '../../3d-weather-codrops-main/dist-widget/weather-3d-CKX6ob-m.mjs?v=20260728-weather-geo-v8';
const { solarPosition } = await import(new URL(`./weather-solar-time.js${new URL(import.meta.url).search}`, import.meta.url).href);

const TAU = Math.PI * 2;
const SUN_RADIUS = 0.7;
const SUN_CAMERA_DISTANCE = 4.55;
const SUN_AXIAL_TILT = THREE.MathUtils.degToRad(7.25);
const SUN_START_ANGLE = THREE.MathUtils.degToRad(-34);
const WARM_SUN_COLOR = 0xffffe6;
const SOLAR_DAY_MS = 86400000;
const SOLAR_MODEL_EPOCH_MS = Date.UTC(2026, 10, 4);
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
  [6, 1, 0.988, 0.92],
  [12, 1, 0.992, 0.94],
  [45, 1, 0.997, 0.97],
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

function resolveSolarPixelRatio(width, height, dpr = 1, zoom = 1, maxSide = 1024) {
  const nativeDpr = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const viewportZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const side = Math.max(8, Number(width) || 8, Number(height) || 8);
  const limit = Math.max(8, Math.min(Number(maxSide) || 1024, 1024));
  return Math.min(nativeDpr * viewportZoom, limit / side);
}

function createSolarLensFlareMaterial(solarColorUniform) {
  // One transparent light layer: illustrative limb details plus optical ghosts
  // adapted from the maintained scene's LensFlare aperture/axis model. The
  // camera reflections remain separate from the modelled solar plasma below.
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpticalCenter: { value: new THREE.Vector2(0.22, 0.32) },
      uTime: { value: 0 },
      uSolarColor: solarColorUniform,
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `
varying vec2 vSolarFlareUv;
void main() {
  vSolarFlareUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`,
    fragmentShader: `
uniform vec2 uOpticalCenter;
uniform float uTime;
uniform vec3 uSolarColor;
varying vec2 vSolarFlareUv;

float solarGaussian(float q) {
  return exp(-(q * q));
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

float limbPlasma(vec2 p, float angle, float width, float height, float phase) {
  // Tiny illustrative limb structures, not a live H-alpha observation. Keep
  // their roots behind the original photosphere and deform them independently.
  vec2 normal = vec2(cos(angle), sin(angle));
  vec2 tangent = vec2(-normal.y, normal.x);
  float x = dot(p, tangent) / width;
  float y = dot(p, normal) - 0.247;
  float arch = height * (1.0 - x * x) * (0.92 + 0.08 * sin(uTime * 0.17 + phase));
  arch += height * 0.07 * sin(x * 5.0 + uTime * 0.23 + phase);
  float feather = max(fwidth(y) * 0.7, 0.001);
  float strand = solarGaussian((y - arch) / feather);
  float base = exp(-abs(y) / 0.004) * 0.22;
  return (strand + base) * (1.0 - smoothstep(0.65, 1.0, abs(x)))
    * smoothstep(0.247, 0.25, length(p)) * (0.82 + 0.18 * sin(uTime * 0.31 + phase));
}

void main() {
  vec2 p = vSolarFlareUv - vec2(0.5);
  float radial = length(p);
  vec2 lensAxis = uOpticalCenter - vec2(0.5);
  float axisLength = length(lensAxis);
  vec2 direction = lensAxis / max(axisLength, 0.0001);
  float offAxis = smoothstep(0.02, 0.18, axisLength);
  float shimmer = 0.99 + 0.01 * sin(uTime * 0.24);

  // Meet the sphere's antialiased edge with a subpixel overlap. The central
  // original map stays untouched; an outward-only ramp leaves a dark seam.
  float outsideDisc = smoothstep(0.2445, 0.2465, radial);
  float aboveLimb = max(radial - 0.247, 0.0);
  float angle = radial > 0.00001 ? atan(p.y, p.x) : 0.0;
  // Unequal streamers: light travels along short tapered rays. Each angular
  // band changes independently; there is no rotating crown of regular spokes.
  float structure = 0.5 + 0.2 * sin(angle * 3.0 + 0.7)
    + 0.12 * sin(angle * 5.0 - 1.3) + 0.1 * cos(angle * 9.0 + 2.1);
  // Separate narrow streamers from the steady halo. A strong diffuse floor
  // merges them into cloudy lobes at mobile size instead of visible rays.
  float fineStrands = 0.5 + 0.5 * sin(angle * 17.0 + sin(angle * 7.0) * 1.1 + 0.3 * sin(uTime * 0.17 + angle * 2.0));
  float filaments = pow(clamp(structure, 0.0, 1.0), 1.25) * (0.06 + 0.94 * pow(fineStrands, 6.0));
  float pulse = 0.82 + 0.18 * sin(uTime * 0.43 - aboveLimb * 34.0 + angle * 3.0)
    + 0.1 * sin(uTime * 0.27 - aboveLimb * 53.0 - angle * 5.0);
  float rayLength = 0.035 + 0.045 * filaments + 0.01 * sin(uTime * 0.31 + angle * 3.0)
    + 0.005 * sin(uTime * 0.19 - angle * 7.0);
  float rays = filaments * pulse * exp(-aboveLimb / rayLength)
    * (1.0 - smoothstep(rayLength * 0.9, rayLength * 1.8, aboveLimb));
  float halo = exp(-aboveLimb / 0.03) * 0.16
    + exp(-pow(aboveLimb / 0.08, 2.0)) * 0.025;
  float plasma = limbPlasma(p, 0.61, 0.017, 0.012, 0.4)
    + limbPlasma(p, 2.43, 0.021, 0.0135, 2.7)
    + limbPlasma(p, -1.24, 0.014, 0.010, 4.3);
  vec2 glint = mat2(0.70710678, -0.70710678, 0.70710678, 0.70710678) * p;
  float diffraction = exp(-abs(glint.x) * 230.0 - abs(glint.y) * 12.0)
    + exp(-abs(glint.y) * 230.0 - abs(glint.x) * 12.0);
  float diamond = apertureGhost(p - direction * 0.345, 4.0, 0.034);
  float softGhost = exp(-pow(length(p - direction * 0.438) / 0.021, 2.0));
  float paleGhost = apertureGhost(p + direction * 0.322, 6.0, 0.018);
  float opticalRing = solarGaussian((length(p - direction * 0.365) - 0.043) / 0.007);
  vec3 light = vec3(1.0, 0.97, 0.87) * (halo + rays * 1.6 + diffraction * 0.65)
    + vec3(1.0, 0.5, 0.24) * plasma * 0.6
    + offAxis * (diamond * vec3(0.42, 0.75, 0.57) * 0.43
      + softGhost * vec3(1.0, 0.61, 0.39) * 0.34
      + paleGhost * vec3(0.65, 0.75, 1.0) * 0.16
      + opticalRing * vec3(0.69, 0.82, 0.6) * 0.13);
  light *= uSolarColor * outsideDisc * shimmer * (1.0 - smoothstep(0.475, 0.5, radial));
  float alpha = clamp(max(light.r, max(light.g, light.b)), 0.0, 0.7);
  gl_FragColor = vec4(light / max(alpha, 0.0001), alpha);
  #include <colorspace_fragment>
}`,
  });
}

function loadTexture(url, textures, renderer, onPhase) {
  if (!url) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      async texture => {
        textures?.push?.(texture);
        try {
          onPhase?.('texture-decode');
          await texture.image?.decode?.();
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.anisotropy = Math.min(renderer?.capabilities?.getMaxAnisotropy?.() || 1, 16);
          texture.needsUpdate = true;
          resolve(texture);
        } catch (error) {
          reject(error);
        }
      },
      undefined,
      () => reject(new Error('The solar surface texture could not load.'))
    );
  });
}

export class HeaderWeatherSunScene {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
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
    this.solarColorUniform = { value: new THREE.Color(0xffffff) };
    this.solarSurfaceColorUniform = { value: new THREE.Color(0xffffff) };
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
      this.stop();
      this.setState('lost');
    };
    this.onContextRestored = () => {
      if (this.disposed) return;
      this.contextLost = false;
      this.resize();
      if (this.resumeAfterRestore) this.start();
    };
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
      this.canvas.__sunInitializationOwner === this.initializationOwner;
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

  updateSolarAppearance(timeMs) {
    // A daily forecast samples its daytime colour without changing the live
    // animation clock used by rotation, surface features and optical effects.
    const appearanceTimeMs = Number.isFinite(this.geoState.appearanceTimeMs) ? this.geoState.appearanceTimeMs : timeMs;
    const { elevationDeg, hourAngleDeg } = solarPosition(appearanceTimeMs, this.geoState.latitude, this.geoState.longitude);
    solarColorForElevation(elevationDeg, this.solarColorUniform.value);
    solarSurfaceColorForElevation(elevationDeg, this.solarSurfaceColorUniform.value);
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
      const color = this.solarColorUniform.value;
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
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.6;

    this.canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    window.addEventListener?.('resize', this.onResize, { passive: true });
    window.visualViewport?.addEventListener?.('resize', this.onResize, { passive: true });
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
      phase => { this.setInitializationStage(phase); });
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
  diffuseColor.rgb = vec3(mix(0.45 - 0.08 * uSolarSpotStrength, 1.0, pow(clamp(solarLuminance, 0.0, 1.0), 0.75 + 0.1 * uSolarSpotStrength)));
#endif`).replace('#include <tonemapping_fragment>', '#include <tonemapping_fragment>\ngl_FragColor.rgb *= uSolarSurfaceColor;');
    };
    sunMaterial.customProgramCacheKey = () => 'header-solar-atmosphere-v7';
    const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(SUN_RADIUS, 96, 72), sunMaterial);
    sunMesh.renderOrder = 1;

    const sunGroup = new THREE.Group();
    sunGroup.position.y = 0;
    sunGroup.rotation.z = SUN_AXIAL_TILT;
    sunGroup.add(sunMesh);
    scene.add(sunGroup);

    const flareMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), createSolarLensFlareMaterial(this.solarColorUniform));
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
    const pixelRatio = resolveSolarPixelRatio(width, height, (window.devicePixelRatio || 1) * this.renderScale,
      window.visualViewport?.scale || 1, this.renderer.capabilities?.maxTextureSize || 1024);
    this.renderer.setPixelRatio(pixelRatio);
    // WebGLRenderer applies its pixel ratio to these CSS dimensions itself.
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    const opticalCenter = this.options.getOpticalCenter?.();
    if (Number.isFinite(opticalCenter?.x) && Number.isFinite(opticalCenter?.y)) {
      this.flareMesh?.material.uniforms.uOpticalCenter.value.set(opticalCenter.x, opticalCenter.y);
    }
  }

  updateAnimation(timeMs = Date.now()) {
    if (!this.sunMesh) {
      return;
    }

    this.sunMesh.rotation.y = solarRotationAngle(timeMs);
    this.solarDaysUniform.value = (timeMs - SOLAR_MODEL_EPOCH_MS) / SOLAR_DAY_MS;
    this.updateSolarAppearance(timeMs);
    if (this.flareMesh) {
      this.flareMesh.material.uniforms.uTime.value = ((timeMs % SOLAR_DAY_MS) + SOLAR_DAY_MS) % SOLAR_DAY_MS / 1000;
    }
  }

  renderFrame() {
    if (!this.renderer || !this.scene || !this.camera) {
      return;
    }
    this.updateAnimation(this.getTimeMs());
    this.renderer.render(this.scene, this.camera);
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
      } catch {
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

export async function mountHeaderWeatherSunScene(canvas, options) {
  const scene = new HeaderWeatherSunScene(canvas, options);
  try {
    await scene.init();
    scene.start();
    return scene;
  } catch (error) {
    scene.dispose();
    throw error;
  }
}

export function unmountHeaderWeatherSunScene(scene) {
  scene?.dispose();
}
