import * as THREE from 'three';
import { duneHeight } from '../desert';
import { buildFigure } from './figure';
import type { Particles } from './particles';

/** Seconds for one run across, and the pause before the next. */
const RUN = 6;
const REST = 3.5;
/** Half the length of the run, in the piece's frame along X. */
const REACH = 170;
const SCALE = 6;

/**
 * Leto II in the sandtrout skin, in Children of Dune: the membrane over his body gives him a
 * strength and speed no man has, and he runs across the open sand faster than a horse can gallop,
 * throwing up a long plume. A lone figure, leaning into the run, crossing the view on a loop.
 * Ground-following, so it needs the piece's placement (`fit`).
 */
export class SandtroutRun {
  readonly group = new THREE.Group();
  private readonly runner = buildFigure('#2b2620');
  private center = new THREE.Vector3();
  private quat = new THREE.Quaternion();
  private readonly tmp = new THREE.Vector3();
  private debt = 0;

  constructor() {
    this.runner.scale.setScalar(SCALE);
    this.group.add(this.runner);
  }

  fit(center: THREE.Vector3, quat: THREE.Quaternion): void {
    this.center = center.clone();
    this.quat = quat.clone();
  }

  private groundAt(x: number, z: number): number {
    this.tmp.set(x, 0, z).applyQuaternion(this.quat).add(this.center);
    return duneHeight(this.tmp.x, this.tmp.z) - this.center.y;
  }

  update(time: number, dt: number, dust: Particles): void {
    if (!this.group.visible) return;
    const u = time % (RUN + REST);
    const k = Math.min(u / RUN, 1);
    const running = u < RUN;
    // Across the view and gently away, then gone into the haze until the next run.
    const x = -REACH + 2 * REACH * k;
    const z = -20 - 40 * k + Math.sin(k * 7) * 6;
    const show = running ? THREE.MathUtils.smoothstep(k, 0, 0.05) * (1 - THREE.MathUtils.smoothstep(k, 0.93, 1)) : 0;
    const stride = time * 14;
    this.runner.position.set(x, this.groundAt(x, z) + Math.abs(Math.sin(stride)) * 0.1 * SCALE, z);
    // Leaning hard into the run, facing the way he goes (+X, a little away).
    this.runner.rotation.set(0, Math.atan2(2 * REACH, -40), 0);
    this.runner.rotateX(0.42);
    this.runner.scale.setScalar(Math.max(show, 0.001) * SCALE);
    if (!running || show < 0.5) return;
    // The plume: sand kicked up at every stride and hanging in the air behind him.
    this.debt += dt * 60;
    while (this.debt >= 1) {
      this.debt -= 1;
      const p = this.group.localToWorld(this.tmp.set(x - 3 - Math.random() * 6, this.runner.position.y + 1, z + (Math.random() - 0.5) * 4));
      dust.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 8, 4 + Math.random() * 9, (Math.random() - 0.5) * 8, 2.5 + Math.random() * 2, 10 + Math.random() * 12);
    }
  }
}
