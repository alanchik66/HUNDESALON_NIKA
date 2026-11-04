/**
 * Compact rotating Sun for the header weather widget.
 * The canvas stays transparent; the Moon continues to use its separate overlay.
 */
import { Z as THREE } from '../../3d-weather-codrops-main/dist-widget/weather-3d-CKX6ob-m.mjs?v=20260728-weather-geo-v8';

const TAU = Math.PI * 2;
const SUN_RADIUS = 0.7;
const SUN_CAMERA_DISTANCE = 4.55;
const SUN_AXIAL_TILT = THREE.MathUtils.degToRad(7.25);
const SUN_START_ANGLE = THREE.MathUtils.degToRad(-34);
const WARM_SUN_COLOR = 0xffffe6;
const SOLAR_DAY_MS = 86400000;
const SOLAR_MODEL_EPOCH_MS = Date.UTC(2026, 10, 4);
const EARTH_ORBIT_DEG_PER_DAY = 360 / 365.256;

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

function createSolarLensFlareMaterial() {
  // Compact optical ghosts, adapted from the maintained scene's LensFlare
  // aperture/axis model. These are camera reflections, not solar plasma.
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpticalCenter: { value: new THREE.Vector2(0.22, 0.32) },
      uTime: { value: 0 },
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
varying vec2 vSolarFlareUv;

float apertureGhost(vec2 p, float sides, float radius) {
  float angle = atan(p.y, p.x) + 0.78539816339;
  float sector = 6.28318530718 / sides;
  float edge = cos(floor(0.5 + angle / sector) * sector - angle) * length(p) / radius;
  float feather = max(fwidth(edge) * 1.3, 0.12);
  float body = 1.0 - smoothstep(1.0 - feather, 1.0 + feather, edge);
  float rim = exp(-pow((edge - 0.86) / 0.16, 2.0));
  return body * (0.3 + 0.7 * rim);
}

void main() {
  vec2 p = vSolarFlareUv - vec2(0.5);
  float radial = length(p);
  vec2 lensAxis = uOpticalCenter - vec2(0.5);
  float axisLength = length(lensAxis);
  vec2 direction = lensAxis / max(axisLength, 0.0001);
  float offAxis = smoothstep(0.02, 0.18, axisLength);
  float shimmer = 0.94 + 0.06 * sin(uTime * 0.24);

  // The sphere occupies radius ~0.247 of this canvas. Keep all added light
  // outside its photosphere so the original texture cannot be washed out.
  float outsideDisc = smoothstep(0.248, 0.258, radial);
  float halo = exp(-pow((radial - 0.254) / 0.026, 2.0)) * 0.12;
  vec2 glint = mat2(0.70710678, -0.70710678, 0.70710678, 0.70710678) * p;
  float diffraction = exp(-abs(glint.x) * 230.0 - abs(glint.y) * 12.0)
    + exp(-abs(glint.y) * 230.0 - abs(glint.x) * 12.0);
  float diamond = apertureGhost(p - direction * 0.345, 4.0, 0.034);
  float softGhost = exp(-pow(length(p - direction * 0.438) / 0.021, 2.0));
  float paleGhost = apertureGhost(p + direction * 0.322, 6.0, 0.018);
  vec3 light = vec3(1.0, 0.87, 0.63) * (halo + diffraction * 0.38)
    + offAxis * (diamond * vec3(0.42, 0.75, 0.57) * 0.27
      + softGhost * vec3(1.0, 0.61, 0.39) * 0.22
      + paleGhost * vec3(0.65, 0.75, 1.0) * 0.09);
  light *= outsideDisc * shimmer * (1.0 - smoothstep(0.475, 0.5, radial));
  float alpha = clamp(max(light.r, max(light.g, light.b)), 0.0, 0.32);
  gl_FragColor = vec4(light / max(alpha, 0.0001), alpha);
  #include <colorspace_fragment>
}`,
  });
}

function loadTexture(url, textures, renderer) {
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
    this.options = options;
    this.geoState = {
      latitude: 51.32,
      longitude: 12.42,
      timeMs: Date.now(),
    };
    this.running = false;
    this.rafId = 0;
    this.resizeRafId = 0;
    this.solarDaysUniform = { value: 0 };
    this.scene = null;
    this.camera = null;
    this.renderer = null;
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
  }

  setState(state) {
    if (this.state === state) return;
    this.state = state;
    this.options.onStateChange?.(state);
  }

  setGeoState(next) {
    if (!next) {
      return;
    }
    this.geoState = {
      latitude: Number(next.latitude) || this.geoState.latitude,
      longitude: Number(next.longitude) || this.geoState.longitude,
      timeMs: Number(next.timeMs) || Date.now(),
    };
  }

  async init() {
    if (this.renderer) {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 20);
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.6;

    // Retain the renderer immediately so a failed async initialization can dispose it.
    this.renderer = renderer;
    this.canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    window.addEventListener?.('resize', this.onResize, { passive: true });
    window.visualViewport?.addEventListener?.('resize', this.onResize, { passive: true });

    const sunTexture = await loadTexture(this.options.sunTextureUrl, this.textures, renderer);
    if (this.disposed) return;
    if (this.contextLost) throw new Error('Solar graphics context was lost during preparation.');
    if (sunTexture) renderer.initTexture(sunTexture);

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
      const mapChunk = THREE.ShaderChunk.map_fragment.replace(/\bvMapUv\b/g, 'solarMapUv');
      shader.fragmentShader = 'uniform float uSolarDays;\n' + shader.fragmentShader.replace('#include <map_fragment>', `
#ifdef USE_MAP
  vec2 solarMapUv = vMapUv;
  float solarSinLatitude = sin((vMapUv.y - 0.5) * 3.141592653589793);
  float solarSin2 = solarSinLatitude * solarSinLatitude;
  solarMapUv.x += uSolarDays * (2.33 * solarSin2 + 1.56 * solarSin2 * solarSin2) / 360.0;
#endif
${mapChunk}`);
    };
    sunMaterial.customProgramCacheKey = () => 'header-solar-differential-v1';
    const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(SUN_RADIUS, 96, 72), sunMaterial);
    sunMesh.renderOrder = 1;

    const sunGroup = new THREE.Group();
    sunGroup.position.y = 0;
    sunGroup.rotation.z = SUN_AXIAL_TILT;
    sunGroup.add(sunMesh);
    scene.add(sunGroup);

    const flareMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), createSolarLensFlareMaterial());
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
    this.resize();
    this.updateAnimation(Date.now());
    // One small material: prepare it synchronously so context loss cannot strand
    // a third-party compileAsync polling loop. The first frame stays hidden.
    renderer.compile(scene, camera);
    if (renderer.getContext().isContextLost()) throw new Error('Solar graphics context was lost before the first frame.');
    this.renderFrame();
  }

  resize() {
    if (!this.renderer || !this.camera || !this.canvas || this.contextLost) {
      return;
    }
    const width = Math.max(8, Math.round(this.canvas.clientWidth));
    const height = Math.max(8, Math.round(this.canvas.clientHeight));
    const pixelRatio = resolveSolarPixelRatio(width, height, window.devicePixelRatio || 1,
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
    if (this.flareMesh) {
      this.flareMesh.material.uniforms.uTime.value = ((timeMs % SOLAR_DAY_MS) + SOLAR_DAY_MS) % SOLAR_DAY_MS / 1000;
    }
  }

  renderFrame() {
    if (!this.renderer || !this.scene || !this.camera) {
      return;
    }
    this.updateAnimation(Date.now());
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
    this.disposed = true;
    this.stop();
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
