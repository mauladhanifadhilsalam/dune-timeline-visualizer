import * as THREE from 'three';
import { createBanner, createBannerPole } from './banner';
import type { Particles } from './particles';

const hullMat = new THREE.MeshStandardMaterial({ color: '#5a554f', metalness: 0.6, roughness: 0.45, flatShading: true });
const darkMat = new THREE.MeshStandardMaterial({ color: '#2b2826', metalness: 0.5, roughness: 0.6 });
const trimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#3fbf5a').multiplyScalar(1.7) });
const padLight = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd28a').multiplyScalar(2) });

/** One launch cycle, in seconds: spool up on the pad, lift, climb out of sight. */
const CYCLE = 18;
const SPOOL = 3;
const CLIMB_END = 16;

interface Ship {
  group: THREE.Group;
  slot: THREE.Vector3;
  heading: number;
  phase: number;
  engines: THREE.Object3D[];
  engineMat: THREE.MeshBasicMaterial;
}

function buildShip(): Omit<Ship, 'slot' | 'heading' | 'phase'> {
  const g = new THREE.Group();
  // Nose along +X: a tapered octagonal hull, a nose cone, a raised bridge and a dorsal fin.
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 6.8, 34, 8).rotateZ(Math.PI / 2), hullMat);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(5.2, 11, 8).rotateZ(-Math.PI / 2).translate(22.5, 0, 0), hullMat);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(9, 3.2, 6).translate(9, 6, 0), darkMat);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(10, 7, 1.2).translate(-12, 8, 0), hullMat);
  const trimL = new THREE.Mesh(new THREE.BoxGeometry(28, 0.5, 0.4).translate(1, 0.5, 6.3), trimMat);
  const trimR = trimL.clone();
  trimR.position.z = -12.6;
  g.add(hull, nose, bridge, fin, trimL, trimR);

  // Four lift engines underneath, glowing as they spool up.
  const engineMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#a9d4ff') });
  const engines: THREE.Object3D[] = [];
  for (const [x, z] of [
    [10, 4],
    [10, -4],
    [-10, 4],
    [-10, -4],
  ]) {
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.3, 3, 10).translate(x, -6.2, z), darkMat);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(1.8, 12).rotateX(Math.PI / 2).translate(x, -7.8, z), engineMat);
    const nozzle = new THREE.Object3D();
    nozzle.position.set(x, -8.5, z);
    engines.push(nozzle);
    g.add(pod, glow, nozzle);
  }

  // A mast aft of the bridge, the banner streaming back along the hull.
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 13, 6).translate(-4, 12, 0), darkMat);
  const flag = createBanner('flag', 14, 8.5);
  flag.position.set(-4, 18, 0);
  flag.rotation.y = Math.PI; // stream aft (-X)
  g.add(mast, flag);
  return { group: g, engines, engineMat };
}

/**
 * Muad'Dib's Jihad leaving Arrakis: a launch apron flying the green and black, and Atreides
 * ships lifting off one after another and climbing out of sight. Local frame as other pieces:
 * X along the path, -Z into the background; the apron is the piece's flattened pad.
 */
export class JihadFleet {
  readonly group = new THREE.Group();
  private readonly ships: Ship[] = [];
  private readonly tmp = new THREE.Vector3();
  private exhaustDebt = 0;

  constructor() {
    // Banner poles around the apron and two service gantries.
    for (const [x, z] of [
      [-120, 40],
      [-40, 52],
      [40, 52],
      [120, 40],
      [-120, -70],
      [120, -70],
    ]) {
      const pole = createBannerPole(42, 20, 12);
      pole.position.set(x, 0, z);
      // Fly downwind, roughly along the path.
      pole.rotation.y = 0.35;
      this.group.add(pole);
    }
    for (const x of [-60, 60]) {
      const gantry = new THREE.Mesh(new THREE.BoxGeometry(6, 64, 6).translate(x, 32, -40), darkMat);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), padLight);
      lamp.position.set(x, 65, -40);
      this.group.add(gantry, lamp);
    }

    const slots: [number, number][] = [
      [-90, -10],
      [-30, 10],
      [30, -10],
      [90, 10],
      [0, -55],
    ];
    const ringGeo = new THREE.BoxGeometry(1.2, 0.4, 1.2);
    slots.forEach(([x, z], i) => {
      const s = buildShip();
      const slot = new THREE.Vector3(x, 8.6, z);
      // A ring of landing lights on each pad.
      const ring = new THREE.InstancedMesh(ringGeo, padLight, 12);
      const m = new THREE.Matrix4();
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        ring.setMatrixAt(k, m.makeTranslation(x + Math.cos(a) * 24, 0.3, z + Math.sin(a) * 24));
      }
      this.group.add(ring, s.group);
      this.ships.push({ ...s, slot, heading: 0.25 - i * 0.12, phase: (i * CYCLE) / slots.length });
    });
  }

  update(time: number, dt: number, dust: Particles, exhaust: Particles): void {
    if (!this.group.visible) return;
    this.exhaustDebt += dt * 40;
    const emitNow = Math.floor(this.exhaustDebt);
    this.exhaustDebt -= emitNow;
    for (const ship of this.ships) {
      const u = (time + ship.phase) % CYCLE;
      const g = ship.group;
      let thrust: number;
      let scale = 1;
      if (u < SPOOL) {
        g.position.copy(ship.slot);
        g.rotation.set(0, ship.heading, 0);
        thrust = u / SPOOL;
      } else {
        // Constant acceleration up, a gentle drift away from the path, nose lifting as it climbs.
        const s = u - SPOOL;
        g.position.set(ship.slot.x + 0.35 * s * s, ship.slot.y + 3.2 * s * s, ship.slot.z - 0.55 * s * s);
        g.rotation.set(0, ship.heading, Math.min(s / 7, 1) * 0.32);
        thrust = 1;
        // Shrink away into the dusk at the top rather than popping out.
        if (u > CLIMB_END) scale = Math.max(1 - (u - CLIMB_END) / (CYCLE - CLIMB_END), 0.001);
      }
      g.scale.setScalar(scale);
      ship.engineMat.color.setRGB(0.66, 0.83, 1).multiplyScalar(0.4 + 2.2 * thrust);

      if (u < 1 || u > CLIMB_END - 2 || emitNow === 0) continue;
      const height = g.position.y - ship.slot.y;
      for (let e = 0; e < emitNow; e++) {
        const nozzle = ship.engines[(e + Math.floor(time * 13)) % ship.engines.length];
        nozzle.getWorldPosition(this.tmp);
        exhaust.emit(
          this.tmp.x + (Math.random() - 0.5) * 1.5,
          this.tmp.y,
          this.tmp.z + (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 6,
          -28 - Math.random() * 18,
          (Math.random() - 0.5) * 6,
          0.45 + Math.random() * 0.35,
          (2.5 + Math.random() * 3) * thrust * scale,
        );
        // Sand blasted off the apron while the ship is still low.
        if (height < 40 && e % 2 === 0) {
          this.group.localToWorld(this.tmp.set(ship.slot.x, 1, ship.slot.z));
          const a = Math.random() * Math.PI * 2;
          dust.emit(
            this.tmp.x + Math.cos(a) * 14,
            this.tmp.y,
            this.tmp.z + Math.sin(a) * 14,
            Math.cos(a) * 22,
            3 + Math.random() * 5,
            Math.sin(a) * 22,
            2.2,
            14 + Math.random() * 10,
          );
        }
      }
    }
  }
}
