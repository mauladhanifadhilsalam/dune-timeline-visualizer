import * as THREE from 'three';
import { rng } from '../noise';
import { Fires, type FireSpot } from './fire';
import { buildShip } from './fleet';
import type { Particles } from './particles';

const RUINS = 60;

/**
 * Rakis destroyed, in Heretics of Dune: the Honored Matres burn the planet to fused glass. The
 * city of Keen in ruins, broken blocks glowing in a fire that spreads through them, smoke over all,
 * and their attack ships passing low over it in formation. Local frame as other pieces.
 */
export class RakisBurning {
  readonly group = new THREE.Group();
  private readonly fires: Fires;
  private readonly ships: { group: THREE.Group; engines: THREE.Object3D[]; offset: THREE.Vector3 }[] = [];
  private readonly tmp = new THREE.Vector3();
  private readonly heading = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly at = new THREE.Vector3();
  private debt = 0;

  constructor() {
    const rand = rng(15214);
    // Broken blocks: what is left of the old town, low and jagged, charred.
    const ruins = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(Math.SQRT1_2 * 0.82, Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true }),
      RUINS,
    );
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    const spots: FireSpot[] = [];
    for (let i = 0; i < RUINS; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.pow(rand(), 0.7) * 95;
      const x = Math.cos(a) * r * 1.2;
      const z = Math.sin(a) * r * 0.7;
      const h = 3 + rand() * 16;
      // Leaning, as walls do when the floors behind them are gone.
      q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.35, rand() * Math.PI, (rand() - 0.5) * 0.35));
      m.compose(new THREE.Vector3(x, -6, z), q, new THREE.Vector3(6 + rand() * 12, h + 6, 6 + rand() * 12));
      ruins.setMatrixAt(i, m);
      ruins.setColorAt(i, c.set('#3a2a22').offsetHSL(0, 0, (rand() - 0.5) * 0.08));
      if (i % 6 === 0) spots.push({ x, y: h * 0.7, z, size: 6 + rand() * 6 });
    }
    this.fires = new Fires(spots, 34);
    this.group.add(ruins, this.fires.group);

    // Three attack ships in a vee.
    for (const offset of [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-26, 4, 20), new THREE.Vector3(-26, 4, -20)]) {
      const s = buildShip(false);
      s.engineMat.color.set('#ffb08a').multiplyScalar(2.2);
      this.ships.push({ group: s.group, engines: s.engines, offset });
      this.group.add(s.group);
    }
  }

  update(time: number, dt: number, smoke: Particles, embers: Particles, exhaust: Particles): void {
    if (!this.group.visible) return;
    this.fires.update(time, dt, smoke, embers);
    // A long loop over the ruins and away, low and fast.
    const a = time * 0.32;
    const lead = this.tmp.set(Math.cos(a) * 190, 70 + Math.sin(a * 2) * 10, Math.sin(a) * 90);
    this.heading.set(-Math.sin(a) * 190, 0, Math.cos(a) * 90).normalize();
    const yaw = Math.atan2(-this.heading.z, this.heading.x);
    this.debt += dt * 30;
    const emit = Math.floor(this.debt);
    this.debt -= emit;
    for (const s of this.ships) {
      // Formation offsets are in the leader's frame: x along its heading, z to its side.
      this.side.set(-this.heading.z, 0, this.heading.x);
      s.group.position.copy(lead).addScaledVector(this.heading, s.offset.x).addScaledVector(this.side, s.offset.z);
      s.group.position.y += s.offset.y;
      s.group.rotation.set(0, yaw, -0.3);
      for (let e = 0; e < emit; e++) {
        const p = s.engines[e % s.engines.length].getWorldPosition(this.at);
        exhaust.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 4, -6, (Math.random() - 0.5) * 4, 0.4, 3 + Math.random() * 2);
      }
    }
  }
}
