/**
 * Compact rotating Sun for the header weather widget.
 * The canvas stays transparent; the Moon continues to use its separate overlay.
 */
import { Z as THREE } from '../../3d-weather-codrops-main/dist-widget/weather-3d-CKX6ob-m.mjs?v=20260728-weather-geo-v8';

const TAU = Math.PI * 2;
const SUN_RADIUS = 0.7;
const SUN_GLOW_RADIUS = 0.784;
const SUN_CAMERA_DISTANCE = 4.55;
const SUN_AXIAL_TILT = THREE.MathUtils.degToRad(7.25);
const SUN_ROTATION_SECONDS = 60 * 60;
const SUN_START_ANGLE = THREE.MathUtils.degToRad(-34);
const WARM_SUN_COLOR = 0xffffe6;

function loadTexture(url, textures, renderer) {
  if (!url) {
    return Promise.resolve(null);
  }

  return new Promise(resolve => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      texture => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = Math.min(renderer?.capabilities?.getMaxAnisotropy?.() || 1, 8);
        texture.needsUpdate = true;
        textures?.push?.(texture);
        resolve(texture);
      },
      undefined,
      () => resolve(null)
    );
  });
}

function createGlowMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(0xffb347) },
      glowOpacity: { value: 0.32 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDirection;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vNormal = normalize(mat3(modelMatrix) * normal);
        vViewDirection = normalize(cameraPosition - worldPosition.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      uniform float glowOpacity;
      varying vec3 vNormal;
      varying vec3 vViewDirection;

      void main() {
        float fresnel = pow(1.0 - max(dot(vNormal, vViewDirection), 0.0), 2.2);
        float alpha = smoothstep(0.08, 0.92, fresnel) * glowOpacity;
        gl_FragColor = vec4(glowColor, alpha);
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
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
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.running = false;
    this.rafId = 0;
    this.clock = new THREE.Clock();
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.sunGroup = null;
    this.sunMesh = null;
    this.glowMesh = null;
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
    const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 20);
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;

    const sunTexture = await loadTexture(this.options.sunTextureUrl, this.textures, renderer);

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

    const glowMesh = new THREE.Mesh(
      new THREE.SphereGeometry(SUN_GLOW_RADIUS, 64, 48),
      createGlowMaterial()
    );
    glowMesh.renderOrder = 0;

    const sunGroup = new THREE.Group();
    sunGroup.position.y = -0.07;
    sunGroup.rotation.z = SUN_AXIAL_TILT;
    sunGroup.add(glowMesh, sunMesh);
    scene.add(sunGroup);

    camera.position.set(0, 0, SUN_CAMERA_DISTANCE);
    camera.lookAt(0, 0, 0);

    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.sunGroup = sunGroup;
    this.sunMesh = sunMesh;
    this.glowMesh = glowMesh;
    this.resize();
    this.updateAnimation(0);
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

  updateAnimation(elapsedSeconds) {
    if (!this.sunMesh) {
      return;
    }

    const sunSpin = this.reducedMotion
      ? SUN_START_ANGLE
      : SUN_START_ANGLE + (elapsedSeconds / SUN_ROTATION_SECONDS) * TAU;
    this.sunMesh.rotation.y = sunSpin;

    const glowMaterial = this.glowMesh?.material;
    if (glowMaterial?.uniforms?.glowOpacity) {
      const pulse = this.reducedMotion ? 0 : Math.sin(elapsedSeconds * 0.72) * 0.026;
      glowMaterial.uniforms.glowOpacity.value = 0.32 + pulse;
    }
  }

  renderFrame() {
    if (!this.renderer || !this.scene || !this.camera) {
      return;
    }
    this.updateAnimation(this.clock.getElapsedTime());
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
      this.sunMesh.material?.dispose();
    }
    if (this.glowMesh) {
      this.glowMesh.geometry?.dispose();
      this.glowMesh.material?.dispose();
    }
    this.textures.forEach(texture => texture.dispose());
    this.textures = [];
    this.renderer?.dispose();
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.sunGroup = null;
    this.sunMesh = null;
    this.glowMesh = null;
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
