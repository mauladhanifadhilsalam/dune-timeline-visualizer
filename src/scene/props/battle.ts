import * as THREE from 'three';
import { duneHeight } from '../desert';
import { haloTexture } from '../halo';
import { RIDE, WormCharge } from './charge';
import { CAMP_RING } from './heighliner';
import type { Particles } from './particles';
import { ROCK, SCORCHED, buildPlug, buildRidge, ridgeAt, type RidgeOptions } from './ridge';

/** The battle replays on this cycle (seconds), from the top each time the camera arrives. */
const CYCLE = 30;
/** The family atomics go off. */
const BLAST = 2.5;
/** The first worm sets off from behind the wall. */
const CHARGE = 5;
/** Rubble and worms sink and the wall rises again, ready for the next run. */
const RESET = 26.5;
const WORMS = 5;
/** Lanes through the breach, one per worm, across the gap. */
const LANES = [-24, -12, 0, 12, 24];
/** When a lane's worm sets off, after the first: the middle leads, the flanks follow. */
const setsOff = (lane: number) => (Math.abs(lane) / 12) * 0.9 + (lane < 0 ? 0.45 : 0);
/**
 * Seconds from the camera's arrival until the last worm has broken into the camp, and a few
 * seconds of fighting after: how long a guided tour must stay to see the battle through.
 */
export const BATTLE_SEEN = CHARGE + Math.max(...LANES.map(setsOff)) + RIDE + 3;
const DEBRIS = 80;
const GRAVITY = 32;

interface Chunk {
  home: THREE.Vector3;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  size: THREE.Vector3;
  axis: THREE.Vector3;
  spin: number;
  angle: number;
  /** Seconds after the blast it is thrown. */
  delay: number;
  state: 'hidden' | 'flying' | 'down';
}

/**
 * The Battle of Arrakeen, played through as a short scene. The Shield Wall stands whole; the
 * Atreides family atomics open it with a flash and a shockwave, and the wall there slumps into
 * rubble, boulders tumbling out; the great storm pours through the gap, and the Fremen come
 * through behind it on maker-back, a file of riders on each worm, across the plain and into the
 * Emperor's camp, where lasgun fire flickers. Then it all sinks back into the sand and the wall
 * rises again for the next run. Local frame: ridge along X, -Z the far side (the open desert).
 */
export class ShieldWallBreach {
  readonly group = new THREE.Group();
  static readonly GAP = 70;
  private readonly ridge: RidgeOptions = { length: 520, depth: 130, gap: ShieldWallBreach.GAP };
  private readonly collapse = { value: 0 };
  private readonly burn = { value: 0 };
  private readonly flash: THREE.Sprite;
  private readonly flashMat: THREE.SpriteMaterial;
  private readonly ring: THREE.Mesh;
  private readonly ringMat: THREE.MeshBasicMaterial;
  private readonly embers: THREE.InstancedMesh;
  private readonly emberMat: THREE.MeshBasicMaterial;
  private readonly debris: THREE.InstancedMesh;
  private readonly chunks: Chunk[] = [];
  private readonly charge: WormCharge;
  private center = new THREE.Vector3();
  private quat = new THREE.Quaternion();
  /** The Emperor's camp, in this piece's frame, once placed. */
  private camp: THREE.Vector2 | null = null;
  private clock = 0;
  private lastU = 0;
  /** The battle has begun: the camera settled on its event while it was in view. */
  private started = false;
  private blasted = false;
  private stormDebt = 0;
  private sparkDebt = 0;
  private readonly tmp = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();

  constructor() {
    this.group.add(buildRidge(this.ridge, this.burn), buildPlug(this.ridge, this.collapse, this.burn));

    // Glowing rubble on the floor of the breach, once it is open. Placed on the ground in fit().
    this.emberMat = new THREE.MeshBasicMaterial({ color: '#000000' });
    this.embers = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 1.2, 2.2), this.emberMat, 40);
    this.group.add(this.embers);

    // Boulders thrown out as the wall comes down: shapes and starting places inside the rock.
    this.debris = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }),
      DEBRIS,
    );
    this.debris.frustumCulled = false;
    const c = new THREE.Color();
    const intact = { ...this.ridge, gap: 0 };
    for (let i = 0; i < DEBRIS; i++) {
      const x = (Math.random() - 0.5) * 110;
      const z = (Math.random() - 0.5) * 70;
      const lo = ridgeAt(x, z, this.ridge).y;
      const hi = ridgeAt(x, z, intact).y;
      const s = 2 + Math.random() * 4.5;
      this.chunks.push({
        home: new THREE.Vector3(x, lo + (hi - lo) * (0.2 + Math.random() * 0.75), z),
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        size: new THREE.Vector3(s * (0.8 + Math.random() * 0.6), s * (0.6 + Math.random() * 0.5), s * (0.8 + Math.random() * 0.6)),
        axis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
        spin: 2 + Math.random() * 5,
        angle: 0,
        delay: (Math.abs(x) / 55) * 0.6 + Math.random() * 0.4,
        state: 'hidden',
      });
      this.debris.setColorAt(i, c.copy(ROCK).lerp(SCORCHED, Math.random() * 0.7));
      this.debris.setMatrixAt(i, this.m.makeScale(0, 0, 0));
    }
    this.group.add(this.debris);

    // A soft glow rather than a fireball: drawn over everything, since it lights the whole plain.
    this.flashMat = new THREE.SpriteMaterial({
      map: haloTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
    this.flash = new THREE.Sprite(this.flashMat);
    this.flash.position.set(0, 30, 30);
    this.ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffd7a0'),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.018, 6, 96).rotateX(Math.PI / 2), this.ringMat);
    this.ring.position.y = 6;
    this.group.add(this.flash, this.ring);

    this.charge = new WormCharge(WORMS, (x, z) => this.groundAt(x, z));
    this.group.add(this.charge.group);
  }

  /** Sand or rock, whichever is higher, at a local point, in local units. */
  private groundAt(x: number, z: number): number {
    this.tmp.set(x, 0, z).applyQuaternion(this.quat).add(this.center);
    return Math.max(duneHeight(this.tmp.x, this.tmp.z) - this.center.y, ridgeAt(x, z, this.ridge).y);
  }

  fit(center: THREE.Vector3, quat: THREE.Quaternion): void {
    // Layout runs every frame of a scale morph; only a real move needs the ground re-read.
    if (center.distanceTo(this.center) < 0.5 && quat.angleTo(this.quat) < 1e-4) return;
    this.center = center.clone();
    this.quat = quat.clone();
    const m = new THREE.Matrix4();
    for (let i = 0; i < 40; i++) {
      const x = (Math.random() - 0.5) * ShieldWallBreach.GAP * 1.1;
      const z = (Math.random() - 0.5) * 90;
      m.makeRotationY(Math.random() * Math.PI).setPosition(x, this.groundAt(x, z) + 0.3, z);
      this.embers.setMatrixAt(i, m);
    }
    this.embers.instanceMatrix.needsUpdate = true;
  }

  /**
   * Where the Emperor's camp stands (world), so the worms know where to ride. Each takes a lane
   * through the breach and makes for its own stretch of the side of the camp facing the wall,
   * pulling up just outside the ring of frigates: coming at it from outside, never through it.
   */
  aim(campWorld: THREE.Vector3): void {
    const local = this.tmp.copy(campWorld).sub(this.center).applyQuaternion(this.q.copy(this.quat).invert());
    if (this.camp && Math.hypot(this.camp.x - local.x, this.camp.y - local.z) < 0.5) return;
    this.camp = new THREE.Vector2(local.x, local.z);
    const C = this.camp;
    const exit = new THREE.Vector2(0, 70);
    // Points on the frigates' ring, spread across the side facing the breach (about ±60°),
    // ordered left to right as seen from the breach so the lanes never cross.
    const facing = Math.atan2(exit.y - C.y, exit.x - C.x);
    const targets = Array.from({ length: WORMS }, (_, i) => {
      const a = facing + (i - (WORMS - 1) / 2) * 0.52;
      return new THREE.Vector2(C.x + Math.cos(a) * CAMP_RING.x, C.y + Math.sin(a) * CAMP_RING.z);
    }).sort((a, b) => Math.atan2(a.x - exit.x, a.y - exit.y) - Math.atan2(b.x - exit.x, b.y - exit.y));
    const v3 = (p: THREE.Vector2) => new THREE.Vector3(p.x, 0, p.y);
    this.charge.setRoutes(
      targets.map((R, i) => {
        const lane = LANES[i];
        // The frigates' hulls reach about 1.3 rings out; the heads pull up clear of them.
        return {
          points: [
            new THREE.Vector3(lane * 1.6, 0, -125),
            new THREE.Vector3(lane * 1.2, 0, -62),
            new THREE.Vector3(lane, 0, 0),
            new THREE.Vector3(lane, 0, 60),
            v3(C.clone().lerp(R, 2.4)),
            v3(C.clone().lerp(R, 1.6)),
            v3(C.clone().lerp(R, 1.45)),
          ],
          strikeAt: 5,
          // The middle lane leads; the others follow out to the flanks.
          start: setsOff(lane),
        };
      }),
    );
  }

  /** Back to the top: wall whole, rubble and worms gone. */
  private restart(): void {
    this.blasted = false;
    for (const ch of this.chunks) ch.state = 'hidden';
    this.charge.reset();
  }

  /**
   * `arrived`: the camera has settled on the battle's own event. Until then the Shield Wall stands
   * whole with the storm blowing over its crest, however long the scene has been in view (from the
   * raid on Sietch Tabr, say, with the camera turned the other way), so the atomics go off in front
   * of the viewer.
   */
  update(dt: number, dust: Particles, sparks: Particles, arrived: boolean): void {
    if (!this.group.visible) {
      this.started = false;
      return;
    }
    if (!this.started) {
      this.clock = 0;
      this.lastU = 0;
      this.restart();
      this.started = arrived;
    } else {
      this.clock += dt;
    }
    const u = this.clock % CYCLE;
    if (u < this.lastU) this.restart();
    this.lastU = u;
    const bt = u - BLAST;
    const ss = THREE.MathUtils.smoothstep;
    const reset = ss(u, RESET, RESET + 2.5);

    // Flash: a fast swell, then a slower fade. The shockwave ring runs on a little longer.
    const swell = ss(bt, 0, 0.25);
    const f = swell * (1 - ss(bt, 0.25, 1.6));
    this.flash.visible = f > 0.01;
    this.flash.scale.setScalar(30 + 190 * swell + 60 * ss(bt, 0.25, 1.6));
    this.flashMat.color.setRGB(1, 0.92, 0.78).multiplyScalar(3 * f);
    this.ring.visible = bt > 0 && bt < 3;
    const r = Math.max(ss(bt, 0, 3) * 240, 1);
    this.ring.scale.set(r, 1, r);
    this.ringMat.color.setRGB(1, 0.84, 0.62).multiplyScalar(1.2 * (1 - bt / 3) ** 2);

    // The scorch spreads with the blast; the breach falls, the rubble glows. All undone at reset.
    this.burn.value = ss(bt, 0, 0.6) * (1 - reset);
    this.collapse.value = THREE.MathUtils.clamp((bt - 0.15) / 3, 0, 1) * 1.5 * (1 - reset);
    const glow = ss(bt, 0.2, 1.5) * (1 - ss(u, RESET - 2, RESET));
    this.embers.visible = glow > 0.01;
    this.emberMat.color.setRGB(1, 0.42, 0.11).multiplyScalar(glow * (1.1 + 0.5 * Math.sin(this.clock * 7) * Math.sin(this.clock * 3.1) + 1.5 * f));

    if (bt >= 0 && !this.blasted) {
      this.blasted = true;
      this.blastDust(dust);
    }
    this.updateDebris(bt, dt, reset, dust);

    // Before the blast, the storm the Fremen are waiting for blows over the crest; after the wall
    // falls, it pours through the gap.
    const over = 6 * (1 - ss(bt, 0, 1));
    const through = 26 * ss(bt, 2.5, 4.5) * (1 - ss(u, RESET - 2, RESET));
    this.stormDebt += dt * (over + through);
    while (this.stormDebt >= 1) {
      this.stormDebt -= 1;
      const inGap = Math.random() * (over + through) < through;
      const p = this.group.localToWorld(
        inGap
          ? this.tmp.set((Math.random() - 0.5) * ShieldWallBreach.GAP, 4 + Math.random() * 40, -75)
          : this.tmp.set((Math.random() - 0.5) * 240, 70 + Math.random() * 30, -70),
      );
      const v = this.dir
        .set((Math.random() - 0.5) * 10, Math.random() * 3, inGap ? 30 + Math.random() * 18 : 10 + Math.random() * 6)
        .applyQuaternion(this.group.quaternion);
      dust.emit(p.x, p.y, p.z, v.x, v.y, v.z, 5, 22 + Math.random() * 18);
    }

    const struck = this.charge.update(u - CHARGE, dt, reset, dust);

    // Lasgun fire in the camp once the riders are in among the frigates.
    if (this.camp && struck > 0 && u < RESET) {
      this.sparkDebt += dt * 9 * struck;
      while (this.sparkDebt >= 1) {
        this.sparkDebt -= 1;
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * 0.85;
        const x = this.camp.x + Math.cos(a) * CAMP_RING.x * d;
        const z = this.camp.y + Math.sin(a) * CAMP_RING.z * d;
        const p = this.group.localToWorld(this.tmp.set(x, this.groundAt(x, z) + 3 + Math.random() * 8, z));
        const b = Math.random() * Math.PI * 2;
        const sp = 50 + Math.random() * 40;
        sparks.emit(p.x, p.y, p.z, Math.cos(b) * sp, (Math.random() - 0.3) * 12, Math.sin(b) * sp, 0.25 + Math.random() * 0.2, 4 + Math.random() * 3);
      }
    }
  }

  private blastDust(dust: Particles): void {
    for (let i = 0; i < 160; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = i < 70;
      const p = this.group.localToWorld(this.tmp.set(Math.cos(a) * 8, 10, Math.sin(a) * 8));
      const v = this.dir
        .set(Math.cos(a) * (up ? 6 : 30 + Math.random() * 40), up ? 30 + Math.random() * 40 : 3 + Math.random() * 10, Math.sin(a) * (up ? 6 : 30 + Math.random() * 40))
        .applyQuaternion(this.group.quaternion);
      dust.emit(p.x, p.y, p.z, v.x, v.y, v.z, 4 + Math.random() * 3, 26 + Math.random() * 26);
    }
  }

  /** Boulders: thrown out as their patch of wall goes, tumbling, bouncing, then lying where they fall. */
  private updateDebris(bt: number, dt: number, reset: number, dust: Particles): void {
    for (let i = 0; i < DEBRIS; i++) {
      const ch = this.chunks[i];
      if (ch.state === 'hidden') {
        if (bt < ch.delay || reset > 0) {
          this.debris.setMatrixAt(i, this.m.makeScale(0, 0, 0));
          continue;
        }
        ch.state = 'flying';
        ch.pos.copy(ch.home);
        const side = Math.sign(ch.home.x) || 1;
        ch.vel.set(side * (10 + Math.random() * 25) + ch.home.x * 0.3, 12 + Math.random() * 28, ch.home.z * 0.5 + (Math.random() - 0.5) * 30);
      } else if (ch.state === 'flying') {
        ch.vel.y -= GRAVITY * dt;
        ch.pos.addScaledVector(ch.vel, dt);
        ch.angle += ch.spin * dt;
        const floor = this.groundAt(ch.pos.x, ch.pos.z) + ch.size.y * 0.45;
        if (ch.pos.y < floor) {
          ch.pos.y = floor;
          if (Math.abs(ch.vel.y) < 7) {
            ch.state = 'down';
          } else {
            // Bounce, losing most of it, and kick up a little dust.
            ch.vel.set(ch.vel.x * 0.45, -ch.vel.y * 0.3, ch.vel.z * 0.45);
            ch.spin *= 0.5;
            const p = this.group.localToWorld(this.tmp.copy(ch.pos));
            dust.emit(p.x, p.y, p.z, 0, 4, 0, 1.6, 8 + ch.size.x * 2);
          }
        }
      }
      // Rubble sinks into the sand with everything else at the reset.
      this.m.compose(
        this.tmp.copy(ch.pos).setY(ch.pos.y - reset * 12),
        this.q.setFromAxisAngle(ch.axis, ch.angle),
        this.dir.copy(ch.size).multiplyScalar(1 - reset),
      );
      this.debris.setMatrixAt(i, this.m);
    }
    this.debris.instanceMatrix.needsUpdate = true;
  }
}
