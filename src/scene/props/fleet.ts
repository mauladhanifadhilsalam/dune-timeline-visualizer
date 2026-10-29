import * as THREE from 'three';
import { createBanner, createBannerPole } from './banner';
import type { Particles } from './particles';

const hullMat = new THREE.MeshStandardMaterial({ color: '#5a554f', metalness: 0.6, roughness: 0.45, flatShading: true });
const darkMat = new THREE.MeshStandardMaterial({ color: '#2b2826', metalness: 0.5, roughness: 0.6 });
const trimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#d6ac68').multiplyScalar(1.5) });
const padLight = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd28a').multiplyScalar(2) });

/** One launch cycle, in seconds: spool up on the pad, lift, climb out of sight. */
const CYCLE = 18;
const SPOOL = 3;
const CLIMB_END = 16;
/** Landing: seconds from first sight to touchdown, and between one ship and the next. */
const DESCENT = 10;
const STAGGER = 2.6;
/** The banners go up the poles once the first ship is down. */
const HOIST = DESCENT + 0.5;

interface Ship {
  group: THREE.Group;
  slot: THREE.Vector3;
  heading: number;
  /** Launching, its offset into the cycle; landing, seconds after arrival that it appears. */
  phase: number;
  engines: THREE.Object3D[];
  engineMat: THREE.MeshBasicMaterial;
}

/** Running lights for ships that fly no house's colours. */
const plainTrim = new THREE.MeshBasicMaterial({ color: new THREE.Color('#cfe3ff').multiplyScalar(1.3) });

export function buildShip(banner: boolean): Omit<Ship, 'slot' | 'heading' | 'phase'> {
  const g = new THREE.Group();
  // Nose along +X: a tapered octagonal hull, a nose cone, a raised bridge and a dorsal fin.
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 6.8, 34, 8).rotateZ(Math.PI / 2), hullMat);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(5.2, 11, 8).rotateZ(-Math.PI / 2).translate(22.5, 0, 0), hullMat);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(9, 3.2, 6).translate(9, 6, 0), darkMat);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(10, 7, 1.2).translate(-12, 8, 0), hullMat);
  const trimL = new THREE.Mesh(new THREE.BoxGeometry(28, 0.5, 0.4).translate(1, 0.5, 6.3), banner ? trimMat : plainTrim);
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
  if (!banner) return { group: g, engines, engineMat };
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 13, 6).translate(-4, 12, 0), darkMat);
  const flag = createBanner('flag', 15, 7.8);
  flag.position.set(-4, 18, 0);
  flag.rotation.y = Math.PI; // stream aft (-X)
  g.add(mast, flag);
  return { group: g, engines, engineMat };
}

export interface FleetOptions {
  /** The Atreides colours on poles round the apron and on every ship. */
  banners: boolean;
  /** Where the ships stand on the apron, and the banner poles round it, if not the default. */
  slots?: [number, number][];
  poles?: [number, number][];
  /** The two service gantries behind the apron. */
  gantries?: boolean;
  /**
   * Ships coming down onto the apron one after another and staying there, played from the
   * camera's arrival, instead of lifting off on a loop. The banners are run up the poles once the
   * first is down.
   */
  landing?: boolean;
}

/**
 * Ships lifting off a launch apron one after another and climbing out of sight. With `banners`,
 * Muad'Dib's Jihad leaving Arrakis: the apron and the ships fly the Atreides green and black.
 * Without, any departure, such as the Scattering. With `landing`, the reverse: the Atreides
 * coming down to Arrakeen. Local frame as other pieces: X along the path, -Z into the
 * background; the apron is the piece's flattened pad.
 */
export class Fleet {
  readonly group = new THREE.Group();
  private readonly ships: Ship[] = [];
  private readonly landing: boolean;
  /** Banners on the poles, with how high each flies when fully up. */
  private readonly flags: { flag: THREE.Object3D; top: number }[] = [];
  private readonly tmp = new THREE.Vector3();
  private exhaustDebt = 0;
  /** Seconds since the camera arrived, for a landing. */
  private clock = 0;
  private seen = false;

  constructor({ banners, landing = false, slots, poles, gantries = true }: FleetOptions) {
    this.landing = landing;
    // Banner poles around the apron and two service gantries.
    poles ??= [
      [-120, 40],
      [-40, 52],
      [40, 52],
      [120, 40],
      [-120, -70],
      [120, -70],
    ];
    for (const [x, z] of banners ? poles : []) {
      const pole = createBannerPole(42, 22, 11.5);
      pole.position.set(x, 0, z);
      // Fly downwind, roughly along the path.
      pole.rotation.y = 0.35;
      this.group.add(pole);
      const flag = pole.getObjectByName('flag');
      if (flag) this.flags.push({ flag, top: flag.position.y });
    }
    for (const x of gantries ? [-60, 60] : []) {
      const gantry = new THREE.Mesh(new THREE.BoxGeometry(6, 64, 6).translate(x, 32, -40), darkMat);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), padLight);
      lamp.position.set(x, 65, -40);
      this.group.add(gantry, lamp);
    }

    slots ??= [
      [-90, -10],
      [-30, 10],
      [30, -10],
      [90, 10],
      [0, -55],
    ];
    const ringGeo = new THREE.BoxGeometry(1.2, 0.4, 1.2);
    slots.forEach(([x, z], i) => {
      const s = buildShip(banners);
      const slot = new THREE.Vector3(x, 8.6, z);
      // A ring of landing lights on each pad.
      const ring = new THREE.InstancedMesh(ringGeo, padLight, 12);
      const m = new THREE.Matrix4();
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        ring.setMatrixAt(k, m.makeTranslation(x + Math.cos(a) * 24, 0.3, z + Math.sin(a) * 24));
      }
      this.group.add(ring, s.group);
      const phase = landing ? i * STAGGER : (i * CYCLE) / slots.length;
      this.ships.push({ ...s, slot, heading: 0.25 - i * 0.12, phase });
    });
  }

  /** Pose a launching ship at `time`; returns its thrust and whether its engines are firing. */
  private launch(ship: Ship, time: number): { thrust: number; firing: boolean } {
    const u = (time + ship.phase) % CYCLE;
    const g = ship.group;
    let scale = 1;
    let thrust = 1;
    if (u < SPOOL) {
      g.position.copy(ship.slot);
      g.rotation.set(0, ship.heading, 0);
      thrust = u / SPOOL;
    } else {
      // Constant acceleration up, a gentle drift away from the path, nose lifting as it climbs.
      const s = u - SPOOL;
      g.position.set(ship.slot.x + 0.35 * s * s, ship.slot.y + 3.2 * s * s, ship.slot.z - 0.55 * s * s);
      g.rotation.set(0, ship.heading, Math.min(s / 7, 1) * 0.32);
      // Shrink away into the dusk at the top rather than popping out.
      if (u > CLIMB_END) scale = Math.max(1 - (u - CLIMB_END) / (CYCLE - CLIMB_END), 0.001);
    }
    g.scale.setScalar(scale);
    return { thrust: thrust * scale, firing: u >= 1 && u <= CLIMB_END - 2 };
  }

  /**
   * Pose a landing ship: the climb run backwards, so it comes in high from the far side and
   * brakes all the way down, flaring level as it settles, then spools its engines down.
   */
  private land(ship: Ship): { thrust: number; firing: boolean } {
    const s = this.clock - ship.phase;
    const g = ship.group;
    g.visible = s > 0;
    if (s <= 0) return { thrust: 0, firing: false };
    const k = Math.min(s / DESCENT, 1);
    const rest = (1 - k) ** 2; // of the height still to fall
    g.position.set(ship.slot.x + 60 * rest, ship.slot.y + 240 * rest, ship.slot.z - 110 * rest);
    g.rotation.set(0, ship.heading, 0.22 * rest);
    // Grows out of the haze high up rather than popping in.
    g.scale.setScalar(Math.max(THREE.MathUtils.smoothstep(s, 0, 1.5), 0.001));
    const thrust = s < DESCENT ? 0.7 + 0.3 * k : Math.max(1 - (s - DESCENT) / 3, 0);
    return { thrust, firing: s < DESCENT + 0.5 };
  }

  /** Back to the start, for a fleet inside another piece that hides it without hiding this group. */
  rewind(): void {
    this.seen = false;
  }

  update(time: number, dt: number, dust: Particles, exhaust: Particles): void {
    if (!this.group.visible) {
      this.seen = false;
      return;
    }
    if (!this.seen) {
      // A landing plays from the top each time the camera arrives.
      this.seen = true;
      this.clock = 0;
    }
    this.clock += dt;
    if (this.landing) {
      const up = THREE.MathUtils.smoothstep(this.clock, HOIST, HOIST + 6);
      for (const { flag, top } of this.flags) {
        flag.visible = this.clock > HOIST;
        flag.position.y = 13 + (top - 13) * up;
      }
    }
    this.exhaustDebt += dt * 40;
    const emitNow = Math.floor(this.exhaustDebt);
    this.exhaustDebt -= emitNow;
    for (const ship of this.ships) {
      const g = ship.group;
      const { thrust, firing } = this.landing ? this.land(ship) : this.launch(ship, time);
      ship.engineMat.color.setRGB(0.66, 0.83, 1).multiplyScalar(0.4 + 2.2 * thrust);

      if (!firing || emitNow === 0) continue;
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
          (2.5 + Math.random() * 3) * thrust,
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
