import * as THREE from 'three';
import { duneHeight } from '../desert';
import { RIDE, WormCharge } from './charge';
import { buildFigure } from './figure';
import { Harvester } from './harvester';
import type { Particles } from './particles';
import { Thopter } from './thopter';

/** Seconds after the camera arrives that the worm sets off, deep in the sand behind. */
const WORM_OFF = 2;
/** When it reaches the harvester. */
const STRIKE = WORM_OFF + RIDE;
/** The ornithopters come down one after another beside the stranded harvester… */
const LAND_AT = [0.3, 1.1, 1.9];
const DESCENT = 4;
/** …its crew run to them… */
const RUN_AT = 5.5;
const RUN = 3.5;
/** …and they lift off with them before the worm arrives. */
const LIFT_AT = 10.5;
const LIFT = 5;
/** Seconds from the camera's arrival until it has played out: the worm has the harvester and has gone. */
export const RESCUE_SEEN = STRIKE + 5;
/** While the camera stays, it plays again from the top after a pause. */
const CYCLE = RESCUE_SEEN + 5;

/** Where the ornithopters set down, on the side away from the worm, in the piece's frame. */
const PADS: [number, number][] = [
  [-50, 36],
  [0, 54],
  [50, 36],
];
const CREW = 6;
/** The spice field's flattened ground, which the catalog's pad matches. */
const FIELD = 100;

/**
 * The Duke's inspection flight in Dune: a worm comes for a spice harvester whose carryall never
 * arrives, and Duke Leto brings his ornithopters down to take off the crew, letting the machine and
 * its spice go. Plays from the camera's arrival. Local frame as other pieces: X along the path, -Z
 * away from it; the worm comes out of the deep desert behind.
 */
export class HarvesterRescue {
  readonly group = new THREE.Group();
  private readonly harvester = new Harvester({ carryall: false });
  private readonly thopters = PADS.map(() => new Thopter());
  private readonly crew: { figure: THREE.Group; from: THREE.Vector2; to: THREE.Vector2 }[] = [];
  private readonly worm: WormCharge;
  private center = new THREE.Vector3();
  private quat = new THREE.Quaternion();
  private clock = 0;
  private lastU = 0;
  private started = false;
  private struck = false;
  private readonly tmp = new THREE.Vector3();

  constructor() {
    this.group.add(this.harvester.group);
    for (const t of this.thopters) {
      t.group.scale.setScalar(2.8);
      this.group.add(t.group);
    }
    for (let i = 0; i < CREW; i++) {
      const figure = buildFigure(i % 2 ? '#6b5a44' : '#4a3c30');
      figure.scale.setScalar(5);
      const [px, pz] = PADS[i % PADS.length];
      this.crew.push({
        figure,
        from: new THREE.Vector2(-14 + (i % 3) * 14, 16 + Math.floor(i / 3) * 5),
        to: new THREE.Vector2(px + (i < 3 ? -3 : 3), pz - 6),
      });
      this.group.add(figure);
    }
    this.worm = new WormCharge(1, (x, z) => this.groundAt(x, z), { riders: 0 });
    this.worm.setRoutes([
      {
        points: [
          [-70, -340],
          [-55, -250],
          [-28, -150],
          [-6, -55],
          [0, 0],
          [5, 16],
        ].map(([x, z]) => new THREE.Vector3(x, 0, z)),
        strikeAt: 4,
        start: 0,
      },
    ]);
    this.group.add(this.worm.group);
    this.reset();
  }

  fit(center: THREE.Vector3, quat: THREE.Quaternion): void {
    this.center.copy(center);
    this.quat.copy(quat);
  }

  /** Sand height at a local point: the field's flattened floor, blending out into the dunes. */
  private groundAt(x: number, z: number): number {
    this.tmp.set(x, 0, z).applyQuaternion(this.quat).add(this.center);
    const dunes = duneHeight(this.tmp.x, this.tmp.z) - this.center.y;
    return dunes * THREE.MathUtils.smoothstep(Math.hypot(x, z), FIELD * 0.6, FIELD);
  }

  private reset(): void {
    this.struck = false;
    this.harvester.group.position.set(0, 0, 0);
    this.harvester.group.rotation.set(0, 0, 0);
    this.harvester.group.visible = true;
    this.worm.reset();
  }

  /** `arrived`: the camera has settled on the event, so the rescue can begin in front of it. */
  update(time: number, dt: number, dust: Particles, arrived: boolean): void {
    if (!this.group.visible) {
      this.started = false;
      return;
    }
    if (!this.started) {
      this.clock = 0;
      this.lastU = 0;
      this.reset();
      this.started = arrived;
    } else {
      this.clock += dt;
    }
    const u = this.started ? this.clock % CYCLE : -1;
    if (u >= 0 && u < this.lastU) this.reset();
    this.lastU = Math.max(u, 0);
    const ss = THREE.MathUtils.smoothstep;

    // The ornithopters: in from high up, down on the sand, then away with the crew.
    this.thopters.forEach((t, i) => {
      const [px, pz] = PADS[i];
      const down = ss(u, LAND_AT[i], LAND_AT[i] + DESCENT);
      const up = ss(u, LIFT_AT + i * 0.5, LIFT_AT + i * 0.5 + LIFT);
      t.group.visible = down > 0 && up < 1;
      if (!t.group.visible) return;
      const rest = 1 - down;
      t.group.position.set(px + 70 * rest * rest + 90 * up * up, 2.5 + 95 * rest * rest + 110 * up * up, pz);
      t.group.rotation.set(0, Math.PI, 0.25 * rest - 0.2 * up);
      t.update(time);
      // Sand thrown up by the wings as each comes down.
      if (down > 0.6 && down < 1 && Math.random() < dt * 30) {
        const p = this.group.localToWorld(this.tmp.set(px + (Math.random() - 0.5) * 16, 1, pz + (Math.random() - 0.5) * 16));
        dust.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 18, 3 + Math.random() * 4, (Math.random() - 0.5) * 18, 2.5, 6);
      }
    });

    // The crew, waiting at the harvester, run for the nearest ornithopter and climb aboard.
    this.crew.forEach((c, i) => {
      const k = ss(u, RUN_AT + i * 0.25, RUN_AT + i * 0.25 + RUN);
      c.figure.visible = u < 0 || k < 1;
      const x = THREE.MathUtils.lerp(c.from.x, c.to.x, k);
      const z = THREE.MathUtils.lerp(c.from.y, c.to.y, k);
      const running = k > 0 && k < 1;
      c.figure.position.set(x, 1.5 + (running ? Math.abs(Math.sin(time * 14 + i)) * 0.6 : 0), z);
      c.figure.rotation.y = running ? Math.atan2(c.to.x - c.from.x, c.to.y - c.from.y) : Math.PI;
    });

    // The worm: out of the deep desert, onto the harvester, and down again with it.
    const sink = ss(u, STRIKE + 1.2, STRIKE + 4.5);
    this.worm.group.visible = u >= 0;
    if (u >= 0) this.worm.update(u - WORM_OFF, dt, sink, dust);
    const gone = ss(u, STRIKE, STRIKE + 2.6);
    if (u >= STRIKE && !this.struck) {
      this.struck = true;
      for (let n = 0; n < 70; n++) {
        const a = Math.random() * Math.PI * 2;
        const p = this.group.localToWorld(this.tmp.set(Math.cos(a) * 20, 6, Math.sin(a) * 14));
        dust.emit(p.x, p.y, p.z, Math.cos(a) * (14 + Math.random() * 24), 10 + Math.random() * 22, Math.sin(a) * (14 + Math.random() * 24), 3, 14);
      }
    }
    this.harvester.group.position.y = -46 * gone;
    this.harvester.group.rotation.z = 0.35 * gone;
    this.harvester.group.visible = gone < 1;
  }
}
