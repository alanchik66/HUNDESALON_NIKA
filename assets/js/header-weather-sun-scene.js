/**
 * Compact rotating Sun for the header weather widget.
 * The canvas stays transparent; the Moon continues to use its separate overlay.
 */
import { Z as THREE } from '../../3d-weather-codrops-main/dist-widget/weather-3d-CKX6ob-m.mjs?v=20260728-weather-geo-v8';

const TAU = Math.PI * 2;
const SUN_RADIUS = 0.7;
const SUN_CAMERA_DISTANCE = 4.55;
const SUN_AXIAL_TILT = THREE.MathUtils.degToRad(7.25);
const SUN_ROTATION_SECONDS = 30 * 60;
const SUN_START_ANGLE = THREE.MathUtils.degToRad(-34);
const WARM_SUN_COLOR = 0xffffe6;

function mountSunProminences(corona) {
  if (!corona?.ownerDocument) return () => {};
  const doc = corona.ownerDocument;
  const svgNS = 'http://www.w3.org/2000/svg';
  const root = corona.getRootNode?.();
  const styleHost = root?.host ? root : doc.head || corona;
  if (!styleHost.querySelector?.('style[data-weather-sun-prominences]')) {
    const style = doc.createElement('style');
    style.setAttribute('data-weather-sun-prominences', '');
    style.textContent = `
.weather-orb-overlay.is-sun.is-header-sun .weather-sun-prominences {
  display: block !important; position: absolute !important; inset: 0 !important;
  width: 100% !important; height: 100% !important; overflow: visible !important;
  pointer-events: none !important;
}
.weather-sun-prominences .weather-sun-prominence {
  transform-box: view-box; transform-origin: 50px 17px;
  animation: weatherSunProminenceLift var(--prominence-period) ease-in-out var(--prominence-delay) infinite;
}
.weather-sun-prominences path {
  fill: none !important; stroke-linecap: round; vector-effect: non-scaling-stroke;
}
.weather-sun-prominences .weather-sun-prominence__glow {
  stroke: #ffad38; stroke-width: 2.2; opacity: .65;
  filter: blur(.35px) drop-shadow(0 0 1.5px #ff9b2ccc);
}
.weather-sun-prominences .weather-sun-prominence__filament {
  stroke: #fff2b4; stroke-width: .65; stroke-dasharray: 32 68;
  animation: weatherSunProminenceFlow 2.2s linear var(--prominence-delay) infinite;
}
@keyframes weatherSunProminenceLift {
  0%, 100% { transform: scaleY(.55); opacity: .15; }
  30% { transform: scaleY(1.16); opacity: .95; }
  65% { transform: scaleY(.86); opacity: .72; }
}
@keyframes weatherSunProminenceFlow {
  from { stroke-dashoffset: 100; }
  to { stroke-dashoffset: 0; }
}`;
    // The root owns this shared stylesheet; rerenders may replace either orb.
    styleHost.appendChild(style);
  }
  const svg = doc.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'weather-sun-prominences');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (const [index, angle] of [9, 67, 132, 194, 254, 317].entries()) {
    const orbit = doc.createElementNS(svgNS, 'g');
    orbit.setAttribute('transform', `rotate(${angle} 50 50)`);
    const loop = doc.createElementNS(svgNS, 'g');
    loop.setAttribute('class', 'weather-sun-prominence');
    loop.style.setProperty('--prominence-period', `${4.2 + index * .31}s`);
    loop.style.setProperty('--prominence-delay', `${-index * .87}s`);
    for (const layer of ['glow', 'filament']) {
      const path = doc.createElementNS(svgNS, 'path');
      path.setAttribute('class', `weather-sun-prominence__${layer}`);
      path.setAttribute('d', index % 2 ? 'M45 17C39 2 59 10 55 17' : 'M44 17C37 7 63 4 56 17');
      path.setAttribute('pathLength', '100');
      loop.appendChild(path);
    }
    orbit.appendChild(loop);
    svg.appendChild(orbit);
  }
  corona.appendChild(svg);
  return () => svg.remove();
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
          texture.anisotropy = Math.min(renderer?.capabilities?.getMaxAnisotropy?.() || 1, 8);
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
    this.clock = new THREE.Clock();
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.sunGroup = null;
    this.sunMesh = null;
    this.textures = [];
    this.disposeProminences = null;
    this.disposed = false;
    this.contextLost = false;
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;

    // Retain the renderer immediately so a failed async initialization can dispose it.
    this.renderer = renderer;
    this.canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored);

    const sunTexture = await loadTexture(this.options.sunTextureUrl, this.textures, renderer);
    if (this.disposed) return;
    if (this.contextLost) throw new Error('Solar graphics context was lost during preparation.');
    if (sunTexture) renderer.initTexture(sunTexture);

    const surfaceColor = new THREE.Color(WARM_SUN_COLOR);
    if (sunTexture) {
      // Warm-white gain approximates the visible 5778 K solar photosphere.
      surfaceColor.setRGB(1.26, 1.14, 1.02);
    }
    const sunMaterial = new THREE.MeshBasicMaterial({
      map: sunTexture || null,
      color: surfaceColor,
      toneMapped: false,
      transparent: false,
      depthWrite: true,
    });
    const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(SUN_RADIUS, 64, 48), sunMaterial);
    sunMesh.renderOrder = 1;

    const sunGroup = new THREE.Group();
    sunGroup.position.y = 0;
    sunGroup.rotation.z = SUN_AXIAL_TILT;
    sunGroup.add(sunMesh);
    scene.add(sunGroup);

    camera.position.set(0, 0, SUN_CAMERA_DISTANCE);
    camera.lookAt(0, 0, 0);

    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.sunGroup = sunGroup;
    this.sunMesh = sunMesh;
    this.disposeProminences = mountSunProminences(this.canvas.parentElement?.querySelector('.weather-orb-overlay__corona'));
    this.resize();
    this.updateAnimation(0);
    // One small material: prepare it synchronously so context loss cannot strand
    // a third-party compileAsync polling loop. The first frame stays hidden.
    renderer.compile(scene, camera);
    if (renderer.getContext().isContextLost()) throw new Error('Solar graphics context was lost before the first frame.');
    this.renderFrame();
  }

  resize() {
    if (!this.renderer || !this.camera || !this.canvas) {
      return;
    }
    const width = Math.max(8, this.canvas.clientWidth);
    const height = Math.max(8, this.canvas.clientHeight);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(pixelRatio);
    // WebGLRenderer applies its pixel ratio to these CSS dimensions itself.
    this.renderer.setSize(Math.round(width), Math.round(height), false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  updateAnimation(elapsedSeconds) {
    if (!this.sunMesh) {
      return;
    }

    const sunSpin = SUN_START_ANGLE + (elapsedSeconds / SUN_ROTATION_SECONDS) * TAU;
    this.sunMesh.rotation.y = sunSpin;
  }

  renderFrame() {
    if (!this.renderer || !this.scene || !this.camera) {
      return;
    }
    this.updateAnimation(this.clock.getElapsedTime());
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
    this.disposeProminences?.();
    this.disposeProminences = null;
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    if (this.sunMesh) {
      this.sunMesh.geometry?.dispose();
      this.sunMesh.material?.dispose();
    }
    this.textures.forEach(texture => texture.dispose());
    this.textures = [];
    this.renderer?.dispose();
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.sunGroup = null;
    this.sunMesh = null;
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
