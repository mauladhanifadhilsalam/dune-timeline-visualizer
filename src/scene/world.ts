import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FOG_COLOR, duneHeight } from './desert';

const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);

interface Flight {
  fromEye: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toEye: THREE.Vector3;
  toTarget: THREE.Vector3;
  t: number;
  duration: number;
  arc: number;
  ease: (x: number) => number;
  done?: () => void;
}

/** Hops shorter than this are quick ease-out glides; longer ones accelerate, lift and settle. */
const LONG_HOP = 420;

/**
 * Renderer, camera, controls and post-processing. Knows nothing about Dune;
 * the timeline and desert are added to `scene` from outside.
 */
export class World {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly labelRenderer: CSS2DRenderer;
  readonly controls: OrbitControls;
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly fog: THREE.FogExp2;
  private flight: Flight | null = null;
  private readonly viewOffset = new THREE.Vector2();
  private readonly viewOffsetTarget = new THREE.Vector2();
  width = 1;
  height = 1;
  /** Fires when the user grabs the camera, so tours and flights can yield. */
  onUserInteract: () => void = () => {};

  constructor(private readonly container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'gl';
    container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'labels';
    container.appendChild(this.labelRenderer.domElement);

    this.camera = new THREE.PerspectiveCamera(50, 1, 1, 9000);
    this.camera.position.set(0, 900, 1150);

    this.fog = new THREE.FogExp2(FOG_COLOR.getHex(), 0.0016);
    this.scene.fog = this.fog;
    this.scene.background = FOG_COLOR.clone();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 2600;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.zoomSpeed = 0.9;
    this.controls.zoomToCursor = true;
    this.controls.target.set(0, 0, 0);
    this.controls.addEventListener('start', () => {
      this.flight = null;
      this.onUserInteract();
    });

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.45, 0.96);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  get pixelRatio(): number {
    return this.renderer.getPixelRatio();
  }

  resize(): void {
    const w = Math.max(this.container.clientWidth, 1);
    const h = Math.max(this.container.clientHeight, 1);
    this.width = w;
    this.height = h;
    // Bloom is fill-rate heavy; cap the ratio on small/high-density screens.
    const pr = Math.min(window.devicePixelRatio || 1, w < 800 ? 1.5 : 2);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
    this.labelRenderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.applyViewOffset();
  }

  /**
   * Shift the projection centre so the focused object sits in the middle of the area the
   * info panel leaves free, instead of hiding behind it.
   */
  setViewOffset(x: number, y: number): void {
    this.viewOffsetTarget.set(x, y);
  }

  private applyViewOffset(): void {
    const o = this.viewOffset;
    if (Math.abs(o.x) < 0.5 && Math.abs(o.y) < 0.5) this.camera.clearViewOffset();
    else this.camera.setViewOffset(this.width, this.height, o.x, o.y, this.width, this.height);
    this.camera.updateProjectionMatrix();
  }

  setBloom(on: boolean): void {
    this.bloom.enabled = on;
  }

  isFlying(): boolean {
    return this.flight !== null;
  }

  /**
   * Move eye and target together. Neighbouring events are a short glide that starts at speed and
   * settles; only a jump across eras lifts the camera a little so it doesn't plough through dunes.
   * Duration defaults to one that scales with distance; pass 0 to cut.
   */
  flyTo(toEye: THREE.Vector3, toTarget: THREE.Vector3, duration?: number, done?: () => void): void {
    const fromEye = this.camera.position.clone();
    const fromTarget = this.controls.target.clone();
    const dist = Math.max(fromTarget.distanceTo(toTarget), fromEye.distanceTo(toEye));
    const long = dist > LONG_HOP;
    this.flight = {
      fromEye,
      fromTarget,
      toEye: toEye.clone(),
      toTarget: toTarget.clone(),
      t: 0,
      duration: Math.max(duration ?? THREE.MathUtils.clamp(0.45 + dist / 900, 0.5, 1.5), 0.001),
      arc: long ? Math.min((dist - LONG_HOP) * 0.08, 120) : 0,
      ease: long ? easeInOutCubic : easeOutCubic,
      done,
    };
  }

  cancelFlight(): void {
    this.flight = null;
  }

  /** Move target and eye together by a delta (scrubbing along the path). */
  translate(delta: THREE.Vector3): void {
    this.flight = null;
    this.controls.target.add(delta);
    this.camera.position.add(delta);
  }

  update(dt: number): void {
    const f = this.flight;
    if (f) {
      f.t = Math.min(f.t + dt / f.duration, 1);
      const k = f.ease(f.t);
      this.controls.target.lerpVectors(f.fromTarget, f.toTarget, k);
      this.camera.position.lerpVectors(f.fromEye, f.toEye, k);
      this.camera.position.y += Math.sin(Math.PI * k) * f.arc;
      if (f.t >= 1) {
        this.flight = null;
        f.done?.();
      }
    }
    this.controls.update();

    // Never under the sand.
    const ground = duneHeight(this.camera.position.x, this.camera.position.z) + 3;
    if (this.camera.position.y < ground) this.camera.position.y = ground;

    // Thin the haze as the camera climbs, so the overview can see the whole path.
    const k = THREE.MathUtils.smoothstep(this.camera.position.y, 40, 900);
    this.fog.density = THREE.MathUtils.lerp(0.0021, 0.0003, k);

    if (this.viewOffset.distanceTo(this.viewOffsetTarget) > 0.5) {
      this.viewOffset.lerp(this.viewOffsetTarget, Math.min(dt * 6, 1));
      this.applyViewOffset();
    } else if (!this.viewOffset.equals(this.viewOffsetTarget)) {
      this.viewOffset.copy(this.viewOffsetTarget);
      this.applyViewOffset();
    }
  }

  render(): void {
    this.composer.render();
    this.labelRenderer.render(this.scene, this.camera);
  }
}
