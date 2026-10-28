import * as THREE from 'three';
import { GoldenPath, makeFrame } from './path';

const UP = new THREE.Vector3(0, 1, 0);

/**
 * A flat strip that follows the path between two t values at a fixed lateral/vertical offset.
 * Geometry is allocated once; `update` rewrites positions in place so it can morph every frame.
 */
export class Ribbon {
  readonly mesh: THREE.Mesh;
  private readonly samples: number;
  private readonly positions: Float32Array;
  private readonly frame = makeFrame();
  private readonly tmp = new THREE.Vector3();

  constructor(
    material: THREE.Material,
    private readonly width: number,
    samples = 40,
    /** 'flat' lies in the ground plane; 'upright' stands like a fence, readable from the side. */
    private readonly orientation: 'flat' | 'upright' = 'flat',
  ) {
    this.samples = samples;
    this.positions = new Float32Array((samples + 1) * 2 * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    const idx: number[] = [];
    for (let i = 0; i < samples; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.frustumCulled = false;
  }

  /** Lay the strip from t0 to t1, `lateral` units to the path's left and `lift` units up. */
  update(path: GoldenPath, t0: number, t1: number, lateral: number, lift: number): void {
    const f = this.frame;
    const half = this.width / 2;
    for (let i = 0; i <= this.samples; i++) {
      const t = t0 + ((t1 - t0) * i) / this.samples;
      path.frameAt(t, f);
      this.tmp.copy(f.pos).addScaledVector(f.side, lateral).addScaledVector(UP, lift);
      const o = i * 6;
      if (this.orientation === 'flat') {
        this.positions[o] = this.tmp.x + f.side.x * half;
        this.positions[o + 1] = this.tmp.y;
        this.positions[o + 2] = this.tmp.z + f.side.z * half;
        this.positions[o + 3] = this.tmp.x - f.side.x * half;
        this.positions[o + 4] = this.tmp.y;
        this.positions[o + 5] = this.tmp.z - f.side.z * half;
      } else {
        this.positions[o] = this.tmp.x;
        this.positions[o + 1] = this.tmp.y + half;
        this.positions[o + 2] = this.tmp.z;
        this.positions[o + 3] = this.tmp.x;
        this.positions[o + 4] = this.tmp.y - half;
        this.positions[o + 5] = this.tmp.z;
      }
    }
    const attr = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
    attr.needsUpdate = true;
  }

  /** Point on the strip's centreline at fraction `a` of its length (for labels). */
  pointAt(path: GoldenPath, t0: number, t1: number, a: number, lateral: number, lift: number, out: THREE.Vector3) {
    path.frameAt(t0 + (t1 - t0) * a, this.frame);
    return out.copy(this.frame.pos).addScaledVector(this.frame.side, lateral).addScaledVector(UP, lift);
  }
}
