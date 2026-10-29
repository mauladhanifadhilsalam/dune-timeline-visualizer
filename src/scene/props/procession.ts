import * as THREE from 'three';
import { duneHeight } from '../desert';
import { SKIN, figureGeometry } from './figure';

export interface ProcessionOptions {
  /** Walkers in the file. */
  count: number;
  /** Distance between one walker and the next. */
  spacing: number;
  /** Figure scale; people are drawn far larger than life, or they vanish in the dunes. */
  scale: number;
  cloak: string;
  /** Local points the file follows, from where it appears to where it goes out of sight. */
  route: [number, number][];
  /** Seconds for a walker to cover the route. */
  duration: number;
  /**
   * The Fremen sandwalk: steps without rhythm, so no worm hears a man walking. Otherwise an even
   * pilgrim's pace.
   */
  sandwalk?: boolean;
  /** Something that goes at the head of the file, this far ahead of the first walker. */
  leader?: { object: THREE.Object3D; ahead: number };
  /** Height of what they walk on at a local point (a road, a bridge), if not the bare sand. */
  heightAt?: (x: number, z: number) => number;
}

/**
 * People walking in file across the sand, on a loop: each comes into view at the start of the
 * route, walks it, and is gone at the end, and the file keeps coming. Ground-following, so it
 * needs the piece's placement (`fit`). Drawn as instances, three draw calls for the whole file.
 */
export class Procession {
  readonly group = new THREE.Group();
  private readonly parts: THREE.InstancedMesh[];
  private curve: THREE.CatmullRomCurve3;
  private length: number;
  private center = new THREE.Vector3();
  private quat = new THREE.Quaternion();
  private readonly tmp = new THREE.Vector3();
  private readonly at = new THREE.Vector3();
  private readonly ahead = new THREE.Vector3();
  private readonly dummy = new THREE.Object3D();

  constructor(private readonly o: ProcessionOptions) {
    const geo = figureGeometry();
    const cloth = new THREE.MeshStandardMaterial({ color: o.cloak, roughness: 0.95 });
    const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.8 });
    this.parts = [
      new THREE.InstancedMesh(geo.robe, cloth, o.count),
      new THREE.InstancedMesh(geo.head, skin, o.count),
      new THREE.InstancedMesh(geo.hood, cloth, o.count),
    ];
    for (const m of this.parts) m.frustumCulled = false;
    this.group.add(...this.parts);
    if (o.leader) this.group.add(o.leader.object);
    this.curve = new THREE.CatmullRomCurve3(o.route.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    this.length = this.curve.getLength();
  }

  /** Lay the route anew, for a file whose road is only known once its piece is placed. */
  setRoute(route: [number, number][]): void {
    this.curve = new THREE.CatmullRomCurve3(route.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    this.length = this.curve.getLength();
  }


  fit(center: THREE.Vector3, quat: THREE.Quaternion): void {
    this.center = center.clone();
    this.quat = quat.clone();
  }

  /** Height underfoot at a local point, in local units. */
  private groundAt(x: number, z: number): number {
    if (this.o.heightAt) return this.o.heightAt(x, z);
    this.tmp.set(x, 0, z).applyQuaternion(this.quat).add(this.center);
    return duneHeight(this.tmp.x, this.tmp.z) - this.center.y;
  }

  update(time: number): void {
    if (!this.group.visible) return;
    const { count, spacing, scale, duration, sandwalk } = this.o;
    const L = this.length;
    // The file is as long as the route plus itself, so there is always someone walking.
    const loop = L + count * spacing;
    const head = ((time / duration) * L) % loop;
    const leader = this.o.leader;
    for (let i = leader ? -1 : 0; i < count; i++) {
      const s = i < 0 ? head + leader!.ahead : head - i * spacing;
      const k = s / L;
      // Grows out of the heat haze at the start, fades into it at the end.
      const show = k <= 0 || k >= 1 ? 0 : THREE.MathUtils.smoothstep(k, 0, 0.06) * (1 - THREE.MathUtils.smoothstep(k, 0.92, 1));
      const p = this.curve.getPointAt(THREE.MathUtils.clamp(k, 0, 1), this.at);
      this.curve.getPointAt(THREE.MathUtils.clamp(k + 0.01, 0, 1), this.ahead);
      const t = time * 3 + i * 1.7;
      const step = sandwalk ? Math.abs(Math.sin(t) * Math.sin(t * 0.37 + i)) : Math.abs(Math.sin(t));
      const yaw = Math.atan2(this.ahead.x - p.x, this.ahead.z - p.z);
      if (i < 0) {
        const o = leader!.object;
        o.position.set(p.x, this.groundAt(p.x, p.z), p.z);
        o.rotation.set(0, yaw, 0);
        o.scale.setScalar(Math.max(show, 0.001));
        continue;
      }
      this.dummy.position.set(p.x, this.groundAt(p.x, p.z) + step * 0.06 * scale, p.z);
      this.dummy.rotation.set(0, yaw, 0);
      this.dummy.scale.setScalar(Math.max(show, 0) * scale);
      this.dummy.updateMatrix();
      for (const m of this.parts) m.setMatrixAt(i, this.dummy.matrix);
    }
    for (const m of this.parts) m.instanceMatrix.needsUpdate = true;
  }
}
