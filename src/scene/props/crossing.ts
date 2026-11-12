import * as THREE from 'three';
import { duneHeight } from '../desert';
import { RIDE, WormCharge } from './charge';
import { buildFigure } from './figure';
import type { Particles } from './particles';
import { buildOutcrops } from './rocks';
import { Thumper } from './thumper';

/** The rock Paul and Jessica make for, in the piece's frame; Stilgar's troop waits on it. */
export const CROSSING_ROCK = { x: 62, z: -18, r: 30, height: 44 };
/** Seconds for the two of them to reach the rock. */
const WALK = 15;
/** The worm sets off for the thumper… */
const WORM_OFF = 3;
/** …and takes it just after they are safe. */
const STRIKE = WORM_OFF + RIDE;
/** Seconds from the camera's arrival until it has played out. */
export const CROSSING_SEEN = STRIKE + 4;
const CYCLE = CROSSING_SEEN + 5;

// The whole scene within about 80 units of its centre, so it fits one frame. They walk the way
// the story goes, toward the rock ahead along the path where Stilgar's troop waits at the next
// event; the thumper drums behind them, and the worm comes in from far behind it.
const FROM = new THREE.Vector2(-62, 30);
// To the foot of the rock on its open side, clear of the event's own label in front of it.
const TO = new THREE.Vector2(CROSSING_ROCK.x - 4, CROSSING_ROCK.z + 32);
const THUMPER = new THREE.Vector2(-62, -42);
/** A patch of drum sand on their way, which booms under a footstep. */
const DRUM = { x: -14, z: 18, r: 13 };
/** People are drawn far larger than life, or they vanish in the dunes. */
const FIGURE = 9.5;

/** Shared by the scene and the troop that waits on its rock: sand height at a local point. */
class LocalGround {
  private center = new THREE.Vector3();
  private quat = new THREE.Quaternion();
  private readonly tmp = new THREE.Vector3();

  fit(center: THREE.Vector3, quat: THREE.Quaternion): void {
    this.center.copy(center);
    this.quat.copy(quat);
  }

  at(x: number, z: number): number {
    this.tmp.set(x, 0, z).applyQuaternion(this.quat).add(this.center);
    return duneHeight(this.tmp.x, this.tmp.z) - this.center.y;
  }
}

/**
 * Paul and Jessica crossing open sand to the rocks in Dune: a thumper from their Fremkit set out
 * behind them to draw the worms away, a patch of drum sand booming under them, and the worm that
 * comes, taking the thumper just after the two of them reach the rock. Plays from the camera's
 * arrival. Local frame as other pieces: X along the path, -Z away from it.
 */
export class OpenSandCrossing {
  readonly group = new THREE.Group();
  private readonly ground = new LocalGround();
  private readonly walkers = [buildFigure('#3a382f'), buildFigure('#4e4033')];
  private readonly thumper = new Thumper();
  private readonly worm: WormCharge;
  private readonly drum: THREE.Mesh;
  private readonly pulse: THREE.Mesh;
  private rock: THREE.Mesh | null = null;
  private clock = 0;
  private lastU = 0;
  private started = false;
  private boomDebt = 0;
  private readonly tmp = new THREE.Vector3();

  constructor() {
    for (const w of this.walkers) {
      w.scale.setScalar(FIGURE);
      this.group.add(w);
    }
    this.thumper.group.position.set(THUMPER.x, 0, THUMPER.y);
    this.group.add(this.thumper.group);
    // Drum sand: a smoother, darker patch, and a ring that runs out from it when it booms.
    this.drum = new THREE.Mesh(
      new THREE.CircleGeometry(DRUM.r, 40).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#7d5136', roughness: 0.6, transparent: true, opacity: 0.75, depthWrite: false }),
    );
    this.pulse = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#f1cf9a', transparent: true, opacity: 0, depthWrite: false }),
    );
    this.drum.position.set(DRUM.x, 0, DRUM.z);
    this.pulse.position.set(DRUM.x, 0, DRUM.z);
    this.group.add(this.drum, this.pulse);
    this.worm = new WormCharge(1, (x, z) => this.ground.at(x, z), { riders: 0 });
    this.worm.setRoutes([
      {
        points: [
          [-150, -330],
          [-120, -230],
          [-86, -130],
          [THUMPER.x, THUMPER.y],
          [-54, -24],
        ].map(([x, z]) => new THREE.Vector3(x, 0, z)),
        strikeAt: 3,
        start: 0,
      },
    ]);
    this.group.add(this.worm.group);
  }

  fit(center: THREE.Vector3, quat: THREE.Quaternion): void {
    this.ground.fit(center, quat);
    const g = (x: number, z: number) => this.ground.at(x, z);
    if (this.rock) this.group.remove(this.rock);
    this.rock = buildOutcrops([{ ...CROSSING_ROCK, kind: 'butte', angle: 0.6, seed: 3 }], g);
    this.group.add(this.rock);
    this.thumper.group.position.y = g(THUMPER.x, THUMPER.y);
    this.drum.position.y = g(DRUM.x, DRUM.z) + 0.4;
    this.pulse.position.y = this.drum.position.y + 0.2;
  }

  update(time: number, dt: number, dust: Particles, arrived: boolean): void {
    if (!this.group.visible) {
      this.started = false;
      return;
    }
    if (!this.started) {
      this.clock = 0;
      this.lastU = 0;
      this.worm.reset();
      this.started = arrived;
    } else {
      this.clock += dt;
    }
    const u = this.started ? this.clock % CYCLE : 0;
    if (u < this.lastU) this.worm.reset();
    this.lastU = u;
    const ss = THREE.MathUtils.smoothstep;

    // The two of them, in the sandwalk: no rhythm a worm could hear, so the pace never settles.
    const k = Math.min(u / WALK, 1);
    const dir = Math.atan2(TO.x - FROM.x, TO.y - FROM.y);
    this.walkers.forEach((w, i) => {
      const side = (i - 0.5) * 7;
      const kk = Math.max(k - i * 0.03, 0);
      const x = THREE.MathUtils.lerp(FROM.x, TO.x, kk) + Math.cos(dir) * side;
      const z = THREE.MathUtils.lerp(FROM.y, TO.y, kk) - Math.sin(dir) * side;
      const step = kk > 0 && kk < 1 ? Math.abs(Math.sin(time * 3 + i) * Math.sin(time * 1.3 + i * 2)) : 0;
      w.position.set(x, this.ground.at(x, z) + step * 0.5, z);
      w.rotation.y = dir;
    });

    // Drum sand booms while they are on it.
    const lead = this.walkers[0].position;
    const onDrum = Math.hypot(lead.x - DRUM.x, lead.z - DRUM.z) < DRUM.r;
    const pulse = (time * 1.6) % 1;
    const pm = this.pulse.material as THREE.MeshBasicMaterial;
    pm.opacity = onDrum ? 0.6 * (1 - pulse) : 0;
    this.pulse.scale.setScalar(DRUM.r * (1 + pulse * 1.6));
    if (onDrum) {
      this.boomDebt += dt * 14;
      for (; this.boomDebt >= 1; this.boomDebt--) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * DRUM.r;
        const p = this.group.localToWorld(this.tmp.set(DRUM.x + Math.cos(a) * r, this.drum.position.y, DRUM.z + Math.sin(a) * r));
        dust.emit(p.x, p.y, p.z, 0, 4 + Math.random() * 4, 0, 1.6, 3);
      }
    }

    // The thumper drums until the worm takes it, then the worm goes down again.
    const sink = ss(u, STRIKE + 1, STRIKE + 4);
    this.worm.group.visible = this.started;
    if (this.started) this.worm.update(u - WORM_OFF, dt, sink, dust);
    this.thumper.group.visible = !this.started || u < STRIKE;
    if (this.thumper.group.visible) this.thumper.update(time, dust);
  }
}

/**
 * Stilgar's troop, waiting on and below the rock when Paul and Jessica reach it: a few on the top
 * keeping watch, the rest come down to meet them, Stilgar in front. Stands in the crossing's frame,
 * at the rock.
 */
export class FremenBand {
  readonly group = new THREE.Group();
  private readonly ground = new LocalGround();
  private readonly people: { figure: THREE.Group; x: number; z: number; top: boolean; phase: number }[] = [];

  constructor() {
    const spots: [number, number, boolean][] = [
      [6, -4, true],
      [-6, 2, true],
      [0, -10, true],
      [-30, 12, false],
      [-36, 22, false],
      [-24, 26, false],
      [-42, 8, false],
      [-34, 30, false],
    ];
    spots.forEach(([x, z, top], i) => {
      const figure = buildFigure(['#3a2c22', '#4a3a2c', '#2e3a33', '#5c4a3a'][i % 4]);
      // Stilgar, at the front of those come down to meet them.
      figure.scale.setScalar(i === 3 ? FIGURE * 1.15 : FIGURE);
      this.people.push({ figure, x, z, top, phase: i * 1.7 });
      this.group.add(figure);
    });
  }

  fit(center: THREE.Vector3, quat: THREE.Quaternion): void {
    this.ground.fit(center, quat);
    // The rock rises from the lowest sand round its foot, as the outcrop builder raises it.
    let foot = this.ground.at(0, 0);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      foot = Math.min(foot, this.ground.at(Math.cos(a) * CROSSING_ROCK.r, Math.sin(a) * CROSSING_ROCK.r));
    }
    for (const p of this.people) {
      const floor = this.ground.at(p.x, p.z);
      p.figure.position.set(p.x, p.top ? foot + CROSSING_ROCK.height * 0.9 : floor, p.z);
      // All of them facing out to where the two come in off the sand.
      p.figure.rotation.y = Math.atan2(TO.x - CROSSING_ROCK.x - p.x, TO.y - CROSSING_ROCK.z - p.z);
    }
  }

  update(time: number): void {
    if (!this.group.visible) return;
    for (const p of this.people) p.figure.rotation.z = Math.sin(time * 0.9 + p.phase) * 0.04;
  }
}
