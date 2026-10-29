import * as THREE from 'three';
import { fbm } from '../noise';
import type { Particles } from './particles';

export interface RidgeOptions {
  length: number;
  depth: number;
  /** A breach: crest height falls to rubble within `gap` of x = 0, and the rock there is scorched. */
  gap?: number;
}

const ROCK = new THREE.Color('#5e4031');
const SCORCHED = new THREE.Color('#1c1411');

/**
 * The Shield Wall: a broken rock range that keeps the worst storms off Arrakeen. Long axis on
 * local X, centred on the origin, footings sunk well below the sand.
 */
export function buildRidge({ length, depth, gap = 0 }: RidgeOptions): THREE.Mesh {
  const ridge = new THREE.PlaneGeometry(length, depth, Math.round(length / 4), 26).rotateX(-Math.PI / 2);
  const p = ridge.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  const half = length / 2;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const across = 1 - Math.pow(z / (depth / 2), 2);
    const crest = 60 + 50 * fbm(x * 0.008 + 3, 1.7, 4);
    const crag = fbm(x * 0.05, z * 0.05, 3) * 20;
    const fade = 1 - Math.pow(Math.min(Math.abs(x) / half, 1), 4);
    let h = Math.max(across, 0) ** 0.75 * (crest + crag) * fade;
    let burn = 0;
    if (gap > 0) {
      // The blast cut a notch down to a rubble floor, with blackened rock on its flanks.
      const open = THREE.MathUtils.smoothstep(Math.abs(x), gap * 0.5, gap * 1.25);
      h = h * open + (1 - open) * Math.max(across, 0) * (8 + crag * 0.4);
      burn = 1 - THREE.MathUtils.smoothstep(Math.abs(x), gap * 0.6, gap * 2);
    }
    p.setY(i, h - 24);
    c.copy(ROCK).lerp(SCORCHED, burn * 0.85).toArray(colors, i * 3);
  }
  ridge.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  ridge.computeVertexNormals();
  return new THREE.Mesh(ridge, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
}

/** Seconds between blasts. The book has one; a diorama replays it. */
const CYCLE = 11;

/**
 * Family atomics opening the Shield Wall for the Battle of Arrakeen: the breach, scorched rock and
 * glowing rubble, a blast that flashes and throws a shockwave ring every so often, and the great
 * storm pouring through the gap behind it. Local frame: ridge along X, -Z is the far side (the
 * desert the storm and the Fremen come from).
 */
export class ShieldWallBreach {
  readonly group = new THREE.Group();
  static readonly GAP = 70;
  private readonly flash: THREE.Mesh;
  private readonly flashMat: THREE.MeshBasicMaterial;
  private readonly ring: THREE.Mesh;
  private readonly ringMat: THREE.MeshBasicMaterial;
  private readonly emberMat: THREE.MeshBasicMaterial;
  private readonly tmp = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private lastCycle = -1;
  private stormDebt = 0;

  constructor() {
    this.group.add(buildRidge({ length: 520, depth: 130, gap: ShieldWallBreach.GAP }));

    // Glowing rubble on the floor of the breach.
    this.emberMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff6a1c').multiplyScalar(1.6) });
    const embers = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 1.2, 2.2), this.emberMat, 40);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 40; i++) {
      const x = (Math.random() - 0.5) * ShieldWallBreach.GAP * 1.1;
      const z = (Math.random() - 0.5) * 90;
      m.makeRotationY(Math.random() * Math.PI).setPosition(x, -15 + 9 + Math.random() * 3, z);
      embers.setMatrixAt(i, m);
    }
    this.group.add(embers);

    this.flashMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#fff1d0'),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), this.flashMat);
    this.flash.position.y = 22;
    this.ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffd7a0'),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.018, 6, 96).rotateX(Math.PI / 2), this.ringMat);
    this.ring.position.y = 6;
    this.group.add(this.flash, this.ring);
  }

  update(time: number, dt: number, dust: Particles): void {
    if (!this.group.visible) return;
    const u = time % CYCLE;
    const cycle = Math.floor(time / CYCLE);

    // Flash: a fast swell, then a slower fade. The shockwave ring runs on a little longer.
    const swell = THREE.MathUtils.smoothstep(u, 0, 0.3);
    const fade = 1 - THREE.MathUtils.smoothstep(u, 0.3, 2.2);
    const f = swell * fade;
    this.flash.visible = f > 0.01;
    this.flash.scale.setScalar(8 + 70 * swell + 25 * (1 - fade));
    this.flashMat.color.setRGB(1, 0.92, 0.78).multiplyScalar(3.2 * f);
    const r = THREE.MathUtils.smoothstep(u, 0, 3) * 240;
    this.ring.visible = u < 3;
    this.ring.scale.set(Math.max(r, 1), 1, Math.max(r, 1));
    this.ringMat.color.setRGB(1, 0.84, 0.62).multiplyScalar(1.2 * (1 - u / 3) ** 2);
    this.emberMat.color.setRGB(1, 0.42, 0.11).multiplyScalar(1.1 + 0.5 * Math.sin(time * 7) * Math.sin(time * 3.1) + 1.5 * f);

    // The blast throws rock dust out and up once per cycle.
    if (cycle !== this.lastCycle && u < 0.5) {
      this.lastCycle = cycle;
      for (let i = 0; i < 160; i++) {
        const a = Math.random() * Math.PI * 2;
        const up = i < 70;
        const p = this.group.localToWorld(this.tmp.set(Math.cos(a) * 8, 10, Math.sin(a) * 8));
        const v = this.dir
          .set(Math.cos(a) * (up ? 6 : 30 + Math.random() * 40), up ? 30 + Math.random() * 40 : 3 + Math.random() * 10, Math.sin(a) * (up ? 6 : 30 + Math.random() * 40))
          .applyQuaternion(this.group.quaternion);
        dust.emit(p.x, p.y, p.z, v.x, v.y, v.z, 4 + Math.random() * 3, 26 + Math.random() * 26);
      }
    }

    // The storm the Fremen came in behind, pouring through the gap from the far side.
    this.stormDebt += dt * 26;
    while (this.stormDebt >= 1) {
      this.stormDebt -= 1;
      const p = this.group.localToWorld(
        this.tmp.set((Math.random() - 0.5) * ShieldWallBreach.GAP, 4 + Math.random() * 40, -75),
      );
      const v = this.dir
        .set((Math.random() - 0.5) * 10, Math.random() * 3, 30 + Math.random() * 18)
        .applyQuaternion(this.group.quaternion);
      dust.emit(p.x, p.y, p.z, v.x, v.y, v.z, 5, 22 + Math.random() * 18);
    }
  }
}
