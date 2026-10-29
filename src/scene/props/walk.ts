import * as THREE from 'three';
import { duneHeight } from '../desert';
import { buildFigure } from './figure';

const PRINTS = 96;
/** Seconds for one walk out; then the figure is gone and the walk begins again. */
const WALK = 48;
/** From near the path out toward the horizon (local frame, as the piece's footprint). */
const FROM = new THREE.Vector2(12, 35);
const TO = new THREE.Vector2(-8, -35);
/** Drawn larger than life, like everything else here, or he is lost in the dunes. */
const SCALE = 8;
/** Seconds a footprint takes to fill with sand. */
const FILL = 22;

const FRESH = new THREE.Color('#4a2c19');
const SAND = new THREE.Color('#a8683a');

/**
 * Paul, blind, walking alone into the deep desert as Fremen custom asks of the blind. A lone
 * robed figure heads out from the path toward the horizon, leaving footprints the wind fills in
 * behind him. Ground-following, so it needs the piece's placement (`fit`).
 */
export class DesertWalk {
  readonly group = new THREE.Group();
  private readonly figure: THREE.Group;
  private readonly prints: THREE.InstancedMesh;
  private readonly printBorn = new Float32Array(PRINTS).fill(-1e9);
  private readonly printPos: THREE.Vector3[] = Array.from({ length: PRINTS }, () => new THREE.Vector3());
  private readonly printYaw = new Float32Array(PRINTS);
  private center = new THREE.Vector3();
  private quat = new THREE.Quaternion();
  private nextPrint = 0;
  private lastStep = -1;
  private readonly tmp = new THREE.Vector3();
  private readonly m = new THREE.Matrix4();
  private readonly c = new THREE.Color();

  constructor() {
    this.figure = buildFigure('#2a211b');
    this.figure.scale.setScalar(SCALE);
    this.prints = new THREE.InstancedMesh(
      new THREE.CircleGeometry(0.55, 10).scale(0.7 * SCALE * 0.2, 1.4 * SCALE * 0.2, 1).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ roughness: 1 }),
      PRINTS,
    );
    this.prints.frustumCulled = false;
    for (let i = 0; i < PRINTS; i++) {
      this.prints.setMatrixAt(i, this.m.makeScale(0, 0, 0));
      this.prints.setColorAt(i, SAND);
    }
    this.group.add(this.figure, this.prints);
  }

  fit(center: THREE.Vector3, quat: THREE.Quaternion): void {
    this.center = center.clone();
    this.quat = quat.clone();
  }

  /** Height of the sand at a local point, in local units. */
  private groundAt(x: number, z: number): number {
    this.tmp.set(x, 0, z).applyQuaternion(this.quat).add(this.center);
    return duneHeight(this.tmp.x, this.tmp.z) - this.center.y;
  }

  update(time: number): void {
    if (!this.group.visible) return;
    const u = (time % WALK) / WALK;
    const walk = Math.floor(time / WALK);
    // Along the line, drifting slightly to either side of it as a blind man would.
    const dx = TO.x - FROM.x;
    const dz = TO.y - FROM.y;
    const len = Math.hypot(dx, dz);
    const drift = Math.sin(u * 5 + walk) * 6;
    const x = FROM.x + dx * u - (dz / len) * drift;
    const z = FROM.y + dz * u + (dx / len) * drift;
    const stride = time * 2.4;
    this.figure.position.set(x, this.groundAt(x, z) + Math.abs(Math.sin(stride)) * 0.05 * SCALE, z);
    this.figure.rotation.set(0, Math.atan2(dx, dz) + Math.cos(u * 5 + walk) * 0.15, Math.sin(stride) * 0.04);
    // Fades into the heat haze at the end of the walk, and back in at the start.
    const k = THREE.MathUtils.smoothstep(u, 0, 0.04) * (1 - THREE.MathUtils.smoothstep(u, 0.86, 1));
    this.figure.scale.setScalar(SCALE * Math.max(k, 0.001));

    // A print every half-stride, alternately left and right of the line of travel.
    const step = Math.floor(stride / Math.PI);
    if (step !== this.lastStep && k > 0.5) {
      this.lastStep = step;
      const i = this.nextPrint;
      this.nextPrint = (i + 1) % PRINTS;
      const side = (step % 2 === 0 ? -0.14 : 0.14) * SCALE;
      const px = x - (dz / len) * side;
      const pz = z + (dx / len) * side;
      this.printPos[i].set(px, this.groundAt(px, pz) + 0.12, pz);
      this.printYaw[i] = Math.atan2(dx, dz);
      this.printBorn[i] = time;
    }
    for (let i = 0; i < PRINTS; i++) {
      const age = time - this.printBorn[i];
      if (age > FILL) {
        this.prints.setMatrixAt(i, this.m.makeScale(0, 0, 0));
        continue;
      }
      const p = this.printPos[i];
      this.prints.setMatrixAt(i, this.m.makeRotationY(this.printYaw[i]).setPosition(p));
      this.prints.setColorAt(i, this.c.copy(FRESH).lerp(SAND, age / FILL));
    }
    this.prints.instanceMatrix.needsUpdate = true;
    if (this.prints.instanceColor) this.prints.instanceColor.needsUpdate = true;
  }
}
