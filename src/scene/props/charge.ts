import * as THREE from 'three';
import { SKIN, figureGeometry } from './figure';
import type { Particles } from './particles';
import { buildWormHead, wormBodyAssets } from './sandworm';

const SEGMENTS = 22;
/** Riders on each worm, standing in a file along its back. */
const RIDERS = 5;
const RIDER_SEGMENTS = [3, 6, 9, 12, 15];
const SCALE = 0.85;
const R0 = 6.2 * SCALE;
const SPACING = 4.6 * SCALE;
/** Seconds from a worm setting off to reaching the camp, whatever the distance. */
const RIDE = 13;
/** How far into its route a worm takes to rise out of the sand. */
const EMERGE = 45;

interface Run {
  curve: THREE.CatmullRomCurve3;
  length: number;
  /** Arc length at which it breaks into the camp's ring. */
  strike: number;
  start: number;
  struck: boolean;
}

/**
 * Fremen on maker-back charging the Emperor's camp at the Battle of Arrakeen: several worms, a file
 * of riders standing on each, coming up out of the sand behind the Shield Wall, through the breach
 * and across the plain, pulling up hard against the camp. Driven by the battle's clock rather than
 * its own, so it can be replayed. Coordinates are the owner's local frame.
 */
export class WormCharge {
  readonly group = new THREE.Group();
  private readonly body: THREE.InstancedMesh;
  private readonly heads: THREE.Group[] = [];
  private readonly riders: THREE.InstancedMesh[];
  private runs: Run[] = [];
  private readonly pts = Array.from({ length: SEGMENTS + 1 }, () => new THREE.Vector3());
  private readonly dummy = new THREE.Object3D();
  private readonly tmp = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();

  constructor(
    worms: number,
    /** Sand height at a local point. */
    private readonly groundAt: (x: number, z: number) => number,
  ) {
    const { segment, material } = wormBodyAssets();
    this.body = new THREE.InstancedMesh(segment, material, worms * SEGMENTS);
    this.body.frustumCulled = false;
    const c = new THREE.Color();
    for (let w = 0; w < worms; w++) {
      for (let i = 0; i < SEGMENTS; i++) {
        c.set('#b39a7c').offsetHSL(0, 0, (i % 2 ? -0.04 : 0.02) - (i / SEGMENTS) * 0.1 + w * 0.012);
        this.body.setColorAt(w * SEGMENTS + i, c);
      }
      const head = buildWormHead();
      this.heads.push(head);
      this.group.add(head);
    }
    const parts = figureGeometry();
    const cloth = new THREE.MeshStandardMaterial({ color: '#2e241c', roughness: 0.95 });
    const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.8 });
    this.riders = [
      new THREE.InstancedMesh(parts.robe, cloth, worms * RIDERS),
      new THREE.InstancedMesh(parts.head, skin, worms * RIDERS),
      new THREE.InstancedMesh(parts.hood, cloth, worms * RIDERS),
    ];
    for (const r of this.riders) r.frustumCulled = false;
    this.group.add(this.body, ...this.riders);
  }

  /**
   * Routes, one per worm: local points from where it surfaces to where it stops, the index of the
   * point where it breaks into the camp, and when it sets off (seconds after the first).
   */
  setRoutes(routes: { points: THREE.Vector3[]; strikeAt: number; start: number }[]): void {
    this.runs = routes.map((r) => {
      const curve = new THREE.CatmullRomCurve3(r.points, false, 'centripetal');
      const length = curve.getLength();
      // Arc length to the strike point, from the curve's own sampling.
      const lengths = curve.getLengths(200);
      const target = r.points[r.strikeAt];
      let best = 0;
      let bestD = Infinity;
      for (let k = 0; k <= 200; k++) {
        const d = curve.getPoint(k / 200, this.tmp).distanceTo(target);
        if (d < bestD) {
          bestD = d;
          best = lengths[k];
        }
      }
      return { curve, length, strike: best, start: r.start, struck: false };
    });
  }

  /** Back to before the charge: every worm under the sand at its start. */
  reset(): void {
    for (const r of this.runs) r.struck = false;
  }

  /**
   * `t` is seconds since the first worm set off (negative before); `sink` (0..1) takes them back
   * under the sand at the end. Returns how many have broken into the camp.
   */
  update(t: number, dt: number, sink: number, dust: Particles): number {
    let struck = 0;
    this.runs.forEach((run, w) => {
      // Full tilt across the plain, easing to a stop inside the camp.
      const v = run.length / RIDE;
      const lin = (t - run.start) * v;
      const b = 30;
      const s = lin <= run.length - b ? lin : run.length - b * Math.exp(-(lin - (run.length - b)) / b);
      for (let i = 0; i <= SEGMENTS; i++) {
        const si = s - i * SPACING;
        const p = run.curve.getPointAt(THREE.MathUtils.clamp(si / run.length, 0, 1), this.pts[i]);
        // Rises out of the sand over the first stretch and rides at the surface, half the body
        // above it (maker hooks keep a ridden worm from diving); sinks again at the end.
        const up = THREE.MathUtils.smoothstep(si, 0, EMERGE);
        const surface = R0 * 0.45 + Math.sin(si / 40) * 0.8;
        p.y = this.groundAt(p.x, p.z) + up * surface - (1 - up) * R0 * 3 - sink * R0 * 4;
      }
      for (let i = 0; i < SEGMENTS; i++) {
        const a = this.pts[i];
        const bp = this.pts[i + 1];
        const r = R0 * (0.98 - 0.5 * Math.pow(i / SEGMENTS, 1.4));
        this.dummy.position.copy(a).add(bp).multiplyScalar(0.5);
        if (a.distanceToSquared(bp) > 1e-6) this.dummy.lookAt(a);
        this.dummy.scale.set(r, r, Math.max(a.distanceTo(bp), 0.01) * 1.12);
        this.dummy.updateMatrix();
        this.body.setMatrixAt(w * SEGMENTS + i, this.dummy.matrix);
      }
      const h0 = this.pts[0];
      const h1 = this.pts[1];
      const head = this.heads[w];
      this.dir.copy(h0).sub(h1);
      if (this.dir.lengthSq() < 1e-6) this.dir.set(0, 0, 1);
      this.dir.normalize();
      head.position.copy(h0).addScaledVector(this.dir, 0.3 * SCALE);
      head.lookAt(this.tmp.copy(head.position).add(this.dir));
      head.scale.setScalar(R0 * 1.02);

      // The riders, standing tall on its back, facing the way it goes.
      for (let k = 0; k < RIDERS; k++) {
        const i = RIDER_SEGMENTS[k];
        const a = this.pts[i];
        const bp = this.pts[i + 1];
        const r = R0 * (0.98 - 0.5 * Math.pow(i / SEGMENTS, 1.4));
        this.dummy.position.copy(a).add(bp).multiplyScalar(0.5);
        this.dummy.position.y += r * 0.9;
        this.dummy.rotation.set(0, Math.atan2(a.x - bp.x, a.z - bp.z), 0);
        this.dummy.scale.setScalar(3.8);
        this.dummy.updateMatrix();
        for (const m of this.riders) m.setMatrixAt(w * RIDERS + k, this.dummy.matrix);
      }

      if (s >= run.strike) {
        struck++;
        if (!run.struck && sink === 0) {
          // Bursting in between the frigates.
          run.struck = true;
          this.burst(h0, 50, dust);
        }
      }
      // Sand thrown off the head while it is up and moving.
      if (s > EMERGE && s < run.length - 8 && sink === 0) {
        for (let n = Math.floor(dt * 18 + Math.random()); n > 0; n--) {
          const ang = Math.random() * Math.PI * 2;
          const p = this.group.localToWorld(this.tmp.set(h0.x + Math.cos(ang) * R0 * 1.2, h0.y - R0 * 0.4, h0.z + Math.sin(ang) * R0 * 1.2));
          dust.emit(p.x, p.y, p.z, Math.cos(ang) * 6, 5 + Math.random() * 8, Math.sin(ang) * 6, 1.8 + Math.random() * 1.4, 7 + Math.random() * 7);
        }
      }
    });
    this.body.instanceMatrix.needsUpdate = true;
    for (const m of this.riders) m.instanceMatrix.needsUpdate = true;
    return struck;
  }

  private burst(at: THREE.Vector3, n: number, dust: Particles): void {
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 10 + Math.random() * 25;
      const p = this.group.localToWorld(this.tmp.set(at.x, at.y, at.z));
      this.dir.set(Math.cos(ang) * sp, 8 + Math.random() * 20, Math.sin(ang) * sp);
      dust.emit(p.x, p.y, p.z, this.dir.x, this.dir.y, this.dir.z, 2.5 + Math.random() * 2, 12 + Math.random() * 12);
    }
  }
}
