/**
 * Compact header sun (NASA Eyes–style): warm disc, transparent WebGL, CSS stars in shell.
 * No extra 3D moon here — night moon uses separate overlay.
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

const TAU = Math.PI * 2;
const EARTH_ORBIT_AU = 6.8;
const SUN_RADIUS = 0.72;
const EARTH_AXIAL_TILT = THREE.MathUtils.degToRad(23.44);
const SUN_SPIN_DAYS = 25.38;
const WARM_SUN_COLOR = 0xffc266;

function dayOfYearUtc(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000;
}

function buildCoronaSprite() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.5);
  gradient.addColorStop(0, 'rgba(255, 220, 150, 0.5)');
  gradient.addColorStop(0.4, 'rgba(255, 170, 70, 0.18)');
  gradient.addColorStop(1, 'rgba(255, 120, 40, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.4, 2.4, 1);
  return sprite;
}

export class HeaderWeatherSunScene {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.sunTextureUrl = options.sunTextureUrl || '';
    this.sunTextureFallbackUrl = options.sunTextureFallbackUrl || '';
    this.geoState = {
      latitude: 51.32,
      longitude: 12.42,
      timeMs: Date.now(),
    };
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.running = false;
    this.rafId = 0;
    this.clock = new THREE.Clock();
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.sunMesh = null;
    this.corona = null;
    this.textures = [];
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
    const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 80);
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    const loader = new THREE.TextureLoader();
    let sunTexture = null;
    for (const url of [this.sunTextureUrl, this.sunTextureFallbackUrl]) {
      if (!url) {
        continue;
      }
      sunTexture = await loader.loadAsync(url).catch(() => null);
      if (sunTexture) {
        break;
      }
    }
    if (sunTexture) {
      sunTexture.colorSpace = THREE.SRGBColorSpace;
      this.textures.push(sunTexture);
    }

    const sunMaterial = new THREE.MeshBasicMaterial({
      map: sunTexture,
      color: sunTexture ? WARM_SUN_COLOR : 0xffc45a,
      toneMapped: false,
    });
    const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(SUN_RADIUS, 48, 48), sunMaterial);
    scene.add(sunMesh);

    const corona = buildCoronaSprite();
    scene.add(corona);

    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.sunMesh = sunMesh;
    this.corona = corona;
    this.resize();
    this.updateOrbit(0);
  }

  resize() {
    if (!this.renderer || !this.camera || !this.canvas) {
      return;
    }
    const width = Math.max(8, this.canvas.clientWidth);
    const height = Math.max(8, this.canvas.clientHeight);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(Math.round(width * pixelRatio), Math.round(height * pixelRatio), false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  updateOrbit(elapsedSeconds) {
    const date = new Date(this.geoState.timeMs);
    const lat = THREE.MathUtils.degToRad(this.geoState.latitude);
    const lon = THREE.MathUtils.degToRad(this.geoState.longitude);
    const doy = dayOfYearUtc(date);
    const yearPhase = (doy / 365.2422) * TAU - Math.PI * 0.5;
    const utcHours =
      date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600 + date.getUTCMilliseconds() / 3600000;
    const solarHour = ((utcHours + this.geoState.longitude / 15) % 24 + 24) % 24;
    const dayPhase = (solarHour / 24) * TAU;

    const earthX = Math.cos(yearPhase) * EARTH_ORBIT_AU;
    const earthZ = Math.sin(yearPhase) * EARTH_ORBIT_AU;
    const observerLift = Math.sin(lat) * 0.38;
    const observerHoriz = Math.cos(lat) * 0.38;
    const camX = earthX + observerHoriz * Math.sin(dayPhase + lon * 0.12);
    const camY = observerLift + Math.sin(EARTH_AXIAL_TILT) * Math.sin(yearPhase) * 0.28;
    const camZ = earthZ + observerHoriz * Math.cos(dayPhase + lon * 0.12);

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(0, 0, 0);

    const sunSpin = this.reducedMotion ? yearPhase * 0.02 : (elapsedSeconds / SUN_SPIN_DAYS) * TAU;
    this.sunMesh.rotation.y = sunSpin;
  }

  renderFrame() {
    if (!this.renderer || !this.scene || !this.camera) {
      return;
    }
    this.updateOrbit(this.clock.getElapsedTime());
    this.renderer.render(this.scene, this.camera);
  }

  start() {
    if (this.running) {
      return;
    }
    this.running = true;
    const tick = () => {
      if (!this.running) {
        return;
      }
      this.renderFrame();
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
    this.stop();
    if (this.sunMesh) {
      this.sunMesh.geometry?.dispose();
      this.sunMesh.material?.map?.dispose();
      this.sunMesh.material?.dispose();
    }
    if (this.corona) {
      this.corona.material?.map?.dispose();
      this.corona.material?.dispose();
    }
    this.textures.forEach(texture => texture.dispose());
    this.textures = [];
    this.renderer?.dispose();
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.sunMesh = null;
    this.corona = null;
  }
}

export async function mountHeaderWeatherSunScene(canvas, options) {
  const scene = new HeaderWeatherSunScene(canvas, options);
  await scene.init();
  scene.start();
  return scene;
}

export function unmountHeaderWeatherSunScene(scene) {
  scene?.dispose();
}
