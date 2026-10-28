import * as THREE from 'three';
import type { Resolved } from '../../timeline/model';
import type { Placement } from '../../timeline/placement';
import { MAX_PADS, duneHeight, type Band, type Desert, type Pad } from '../desert';
import { GoldenPath, makeFrame } from '../path';
import { Arrakeen } from './arrakeen';
import { bannerClock } from './banner';
import { SareerCitadel, buildKeep } from './citadels';
import { JihadFleet } from './jihad-fleet';
import { Harvester } from './harvester';
import { Heighliner, buildImperialCamp } from './heighliner';
import { Particles } from './particles';
import { buildCrysknife, buildWreckage } from './relics';
import { SET_PIECES, type Circle, type SetPiece } from './catalog';
import { Sandworm } from './sandworm';

/** A catalog entry brought to life: its object, and where placement and gating left it. */
interface Piece extends SetPiece {
  object?: THREE.Object3D;
  creature?: Sandworm;
  grounded: boolean;
  /** 0..1, eased toward whether the camera is in one of the piece's eras. */
  vis?: number;
  /** Solved offset from the anchor: along the path and into the background. */
  spot?: { along: number; lateral: number };
  /** Resting transform from the last layout, before presence and visibility are applied. */
  base?: { center: THREE.Vector3; quat: THREE.Quaternion };
  /** Fits parts of the piece to the dunes once its place is known. */
  fit?: (center: THREE.Vector3, quat: THREE.Quaternion) => void;
  /** Its name over it in the scene. */
  labelObj?: THREE.Object3D;
}

/** Makes a scene label that the timeline's label culling manages; the caller positions it. */
export type Labeler = (title: string, sub: string | undefined, isOn: () => boolean) => THREE.Object3D;

/** How thick the spice hangs in each era (by era id). Leto's green Arrakis has almost none. */
const SPICE_BY_ERA: Record<string, number> = {
  'before-jihad': 0.08,
  jihad: 0.05,
  schools: 0.12,
  imperium: 0.55,
  muaddib: 1,
  'atreides-empire': 0.8,
  'god-emperor': 0,
  scattering: 0.2,
  return: 0.75,
};

const UP = new THREE.Vector3(0, 1, 0);
/** Ground left free around the path, so no piece stands on another era's stretch of it. */
const PATH_CLEARANCE = 26;

/**
 * Everything in the world that belongs to a moment: heighliners, Arrakeen, the Emperor's camp,
 * a harvester, worms, a crysknife, Jihad wreckage, a spice blow, and the ground's own ecology.
 * Each piece is pinned to an event, so it moves with the story/true scale and the reckoning like
 * the lights do. That also keeps the world honest to the books: no worms in Leto II's green
 * Arrakis, and they come back with Rakis.
 *
 * The path snakes, so "behind the event" can be on top of another era's stretch of it. Each piece
 * therefore declares a footprint, and a small search slides it along and away from its event
 * until it clears the whole path and every piece placed before it.
 */
export class WorldProps {
  readonly group = new THREE.Group();
  private readonly pieces: Piece[] = [];
  private readonly heighliners: Heighliner[] = [];
  private readonly city = new Arrakeen();
  private readonly harvester = new Harvester();
  private readonly fleet = new JihadFleet();
  private readonly citadel = new SareerCitadel();
  private citadelPiece: Piece | null = null;
  /** Lift-engine exhaust: hot, blue-white, short-lived. */
  private readonly exhaust = new Particles({
    capacity: 1600,
    color: '#a9cfff',
    intensity: 1.5,
    additive: true,
    gravity: -4,
    drag: 2.2,
  });
  private readonly dust = new Particles({ capacity: 2600, color: '#c8925c', gravity: 2.2, drag: 0.55 });
  private readonly spice = new Particles({
    capacity: 2200,
    color: '#ff7426',
    intensity: 1.25,
    additive: true,
    gravity: 2.8,
    drag: 0.35,
  });
  private readonly blow: Piece;
  private readonly blowAt = new THREE.Vector3();
  private blowClock = 3;
  private readonly frame = makeFrame();
  private readonly pathXZ: Float32Array;
  private presence = 1;
  private placement: Placement | null = null;
  private res: Resolved | null = null;
  private solved = false;

  constructor(
    private readonly path: GoldenPath,
    private readonly desert: Desert,
    /** +1 or -1: which side of the path (in its local frame) is the background. */
    private readonly background: number,
    labeler?: Labeler,
  ) {
    let blow: Piece | null = null;
    for (const spec of SET_PIECES) {
      const piece: Piece = { ...spec, grounded: spec.kind !== 'heighliner' };
      switch (spec.kind) {
        case 'heighliner': {
          const h = new Heighliner();
          this.heighliners.push(h);
          piece.object = h.group;
          break;
        }
        case 'arrakeen':
          piece.object = this.city.group;
          break;
        case 'imperial-camp':
          piece.object = buildImperialCamp();
          break;
        case 'harvester':
          piece.object = this.harvester.group;
          break;
        case 'wreckage':
          piece.object = buildWreckage();
          break;
        case 'crysknife':
          piece.object = buildCrysknife();
          break;
        case 'spice-blow':
          blow = piece;
          break;
        case 'worm':
          piece.creature = new Sandworm(spec.worm!);
          this.group.add(piece.creature.group);
          break;
        case 'jihad-fleet':
          piece.object = this.fleet.group;
          break;
        case 'keep':
          piece.object = buildKeep();
          break;
        case 'sareer-citadel':
          piece.object = this.citadel.group;
          piece.fit = (c, q) => this.citadel.fit(c, q);
          this.citadelPiece = piece;
          break;
      }
      if (spec.label && labeler) {
        piece.labelObj = labeler(spec.label.title, spec.label.sub, () => this.amount(piece) > 0.6);
      }
      this.pieces.push(piece);
      if (piece.object) this.group.add(piece.object);
    }
    if (!blow) throw new Error('SET_PIECES needs a spice-blow');
    this.blow = blow;

    this.group.add(this.dust.points, this.spice.points, this.exhaust.points);

    // Path outline for clearance tests.
    const N = 500;
    this.pathXZ = new Float32Array((N + 1) * 2);
    for (let i = 0; i <= N; i++) {
      const f = this.path.frameAt(i / N, this.frame);
      this.pathXZ[i * 2] = f.pos.x;
      this.pathXZ[i * 2 + 1] = f.pos.z;
    }
  }

  /** Anchor frame: horizontal along-path axis and the background direction at the event. */
  private axes(t: number): { pos: THREE.Vector3; along: THREE.Vector3; away: THREE.Vector3 } {
    const f = this.path.frameAt(t, this.frame);
    return {
      pos: f.pos.clone(),
      along: new THREE.Vector3(f.tangent.x, 0, f.tangent.z).normalize(),
      away: f.side.clone().multiplyScalar(this.background),
    };
  }

  private worldCircles(center: THREE.Vector3, along: THREE.Vector3, away: THREE.Vector3, fp: Circle[]): Circle[] {
    // Local -z is "away", so a circle at local (x, z) sits at center + along*x - away*z.
    return fp.map((c) => ({
      x: center.x + along.x * c.x - away.x * c.z,
      z: center.z + along.z * c.x - away.z * c.z,
      r: c.r,
    }));
  }

  /** How badly a set of circles intrudes on the path or on pieces already placed (0 = clear). */
  private intrusion(circles: Circle[], placed: Circle[]): number {
    let worst = 0;
    const P = this.pathXZ;
    for (const c of circles) {
      const need = c.r + PATH_CLEARANCE;
      for (let i = 0; i < P.length; i += 2) {
        const d = Math.hypot(P[i] - c.x, P[i + 1] - c.z);
        if (d < need) worst = Math.max(worst, need - d);
      }
      for (const o of placed) {
        const d = Math.hypot(o.x - c.x, o.z - c.z);
        const need2 = c.r + o.r + 16;
        if (d < need2) worst = Math.max(worst, need2 - d);
      }
    }
    return worst;
  }

  /**
   * Slide each grounded piece along the path and further into the background until its footprint
   * is clear. Candidates are tried nearest-first, so a piece stays as close to its event as fits.
   */
  private solve(p: Placement): void {
    const placed: Circle[] = [];
    const alongs = [0, 40, -40, 80, -80, 130, -130, 180, -180, 240, -240];
    const extras = [0, 40, 80, 130, 190, 260, 340];
    for (const piece of this.pieces) {
      const t = p.events.get(piece.event)?.t;
      if (t === undefined) continue;
      const { pos, along, away } = this.axes(t);
      let best = { along: 0, lateral: piece.lateral, bad: Infinity };
      search: for (const extra of extras) {
        for (const a of alongs) {
          const lateral = piece.lateral + extra;
          const center = pos.clone().addScaledVector(along, a).addScaledVector(away, lateral);
          const bad = this.intrusion(this.worldCircles(center, along, away, piece.footprint), placed);
          if (bad < best.bad) best = { along: a, lateral, bad };
          if (bad === 0) break search;
        }
      }
      piece.spot = { along: best.along, lateral: best.lateral };
      const center = pos.clone().addScaledVector(along, best.along).addScaledVector(away, best.lateral);
      placed.push(...this.worldCircles(center, along, away, piece.footprint));
    }
  }

  layout(p: Placement, res: Resolved): void {
    this.placement = p;
    this.res = res;
    // Spots are solved once, on the story-scale layout the app starts with. Story-scale positions
    // of every anchor here are the same under both reckonings, and on true scale the pieces are
    // sunk out of sight, so there is nothing to re-solve and nothing hops around mid-morph.
    if (!this.solved && this.presence > 0.999) {
      this.solve(p);
      this.solved = true;
    }
    const basis = new THREE.Matrix4();
    for (const piece of this.pieces) {
      const t = p.events.get(piece.event)?.t;
      if (t === undefined || !piece.spot) continue;
      const { pos, along, away } = this.axes(t);
      const center = pos.addScaledVector(along, piece.spot.along).addScaledVector(away, piece.spot.lateral);
      // Local -Z points into the background, +X along the path, +Y up; right-handed.
      const z = away.clone().negate();
      const x = new THREE.Vector3().crossVectors(UP, z).normalize();
      const quat = new THREE.Quaternion().setFromRotationMatrix(basis.makeBasis(x, UP, z));
      if (piece.creature) piece.creature.place(center, along, away);
      if (piece.grounded) {
        // Rest on the mean height of the sand under the footprint; a pad flattens it to match.
        const r = piece.footprint[0]?.r ?? 20;
        let sum = 0;
        for (let i = -2; i <= 2; i++)
          for (let j = -2; j <= 2; j++) sum += duneHeight(center.x + (i * r) / 4, center.z + (j * r) / 4);
        center.y = sum / 25;
      } else {
        center.y += piece.lift ?? 0;
      }
      piece.base = { center, quat };
      piece.fit?.(center, quat);
      if (piece === this.blow) this.blowAt.copy(center);
    }
    this.apply();
    this.desert.setEcology(this.greenBand(p, res), this.scorchBand(p));
  }

  /** How present a piece is right now: the scale's presence times its era visibility. */
  private amount(piece: Piece): number {
    return (piece.keepInTrueScale ? 1 : this.presence) * (piece.vis ?? 0);
  }

  /** Put every piece where its base, presence and era visibility say; cheap enough per frame. */
  private apply(): void {
    const pads: Pad[] = [];
    for (const piece of this.pieces) {
      if (!piece.base) continue;
      const k = this.amount(piece);
      if (piece.creature) {
        piece.creature.setPresence(k);
        continue;
      }
      if (piece.pad && pads.length < MAX_PADS && k > 0.001) {
        pads.push({
          x: piece.base.center.x,
          z: piece.base.center.z,
          radius: (piece.padRadius ?? piece.footprint[0]?.r ?? 20) * k,
          y: piece.base.center.y,
          tint: new THREE.Color(piece.pad.tint),
          amount: piece.pad.amount * k,
        });
      }
      const o = piece.object;
      if (!o) continue;
      o.position.copy(piece.base.center);
      o.quaternion.copy(piece.base.quat);
      if (piece.grounded) {
        // Rises out of the sand as its era arrives, sinks back as it goes.
        o.position.y -= (1 - k) * 90;
        o.scale.setScalar(Math.max(k, 0.001));
      } else {
        // Climbs away into orbit and dwindles.
        o.position.y += (1 - k) * 420;
        o.scale.setScalar(0.25 + 0.75 * k);
      }
      o.visible = k > 0.01;
      if (piece.labelObj && piece.label) {
        piece.labelObj.position.copy(o.position).y += piece.label.height * o.scale.y;
      }
    }
    this.desert.setPads(pads);
    const cp = this.citadelPiece;
    const ck = cp?.base ? this.amount(cp) : 0;
    this.desert.setDesertPatch(
      cp?.base && ck > 0.001
        ? { x: cp.base.center.x, z: cp.base.center.z, radius: (SareerCitadel.RADIUS + 10) * ck, amount: ck }
        : null,
    );
  }

  /**
   * How visible Leto II's green is from where the camera is in time: none during Dune (so the
   * horizon behind the Battle of Arrakeen stays desert), rising through Children of Dune, when the
   * transformation is already under way, full in his reign, gone again after Rakis.
   */
  private greenVisibility(focusT: number): number {
    if (!this.placement || !this.res) return 0;
    const idx = (id: string) => this.res!.eras.findIndex((e) => e.id === id);
    const eras = this.placement.eras;
    const vi = eras[idx('atreides-empire')];
    const vii = eras[idx('god-emperor')];
    const ix = eras[idx('return')];
    if (vi === undefined || vii === undefined || ix === undefined) return 0;
    const ramp = (a: number, b: number, x: number) => THREE.MathUtils.clamp((x - a) / Math.max(b - a, 1e-6), 0, 1);
    return ramp(vi, vii, focusT) * (1 - ramp(ix, ix + (ix - vii) * 0.3, focusT));
  }

  /** Green from the start of Leto II's reign, full by the novel's time, fading in the Famine Times. */
  private greenBand(p: Placement, res: Resolved): Band | null {
    const ge = res.eras.findIndex((e) => e.id === 'god-emperor');
    const green = p.events.get('arrakis-green')?.t;
    const death = p.events.get('leto-death')?.t;
    if (ge < 0 || green === undefined || death === undefined) return null;
    const start = p.eras[ge];
    const next = p.eras[ge + 2] ?? 1;
    return [start, Math.max(green, start + 1e-4), death, death + Math.max((next - death) * 0.35, 1e-4)];
  }

  /** Scorched glass where the Honored Matres burned Rakis, up to Chapterhouse's new desert. */
  private scorchBand(p: Placement): Band | null {
    const r = p.events.get('rakis-destroyed')?.t;
    const ch = p.events.get('chapterhouse-desert')?.t;
    if (r === undefined || ch === undefined) return null;
    const gap = Math.max(ch - r, 1e-4);
    return [r, r + gap * 0.15, r + gap * 0.6, ch];
  }

  /** 1 on story scale, 0 on true scale; grounded pieces sink away in between. */
  setStoryWeight(w: number): void {
    this.presence = THREE.MathUtils.smoothstep(w, 0.25, 0.95);
  }

  /** Id of the era the camera is looking at. */
  private focusEra(focusT: number): string | null {
    if (!this.placement || !this.res) return null;
    const eras = this.placement.eras;
    let i = eras.length - 1;
    while (i > 0 && eras[i] > focusT) i--;
    return this.res.eras[i]?.id ?? null;
  }

  update(time: number, dt: number, focusT: number, viewportHeight: number, pixelRatio: number): void {
    const era = this.focusEra(focusT);
    const ease = Math.min(dt * 1.4, 1);
    for (const piece of this.pieces) {
      const target = era !== null && piece.eras.includes(era) ? 1 : 0;
      piece.vis = (piece.vis ?? 0) + (target - (piece.vis ?? 0)) * ease;
      if (Math.abs(target - piece.vis) < 1e-3) piece.vis = target;
    }
    this.apply();

    bannerClock.value = time;
    for (const h of this.heighliners) h.update(time);
    if (this.city.group.visible) this.city.update(time);
    this.harvester.update(time, dt, this.dust, this.spice);
    this.fleet.update(time, dt, this.dust, this.exhaust);
    for (const piece of this.pieces) piece.creature?.update(dt, duneHeight, this.dust);

    // A spice blow where Liet-Kynes died: a pre-spice mass erupting from deep sand, every so often.
    if (this.amount(this.blow) > 0.5) {
      this.blowClock += dt;
      if (this.blowClock > 11) this.blowClock = 0;
      if (this.blowClock < 1.8) this.spiceBlow(dt);
    }

    for (const ps of [this.dust, this.spice, this.exhaust]) {
      ps.setViewportHeight(viewportHeight, pixelRatio);
      ps.update(dt);
    }

    // Rakis is only scorched once the camera has reached its burning.
    const burnt = this.placement?.events.get('rakis-destroyed')?.t;
    const before = this.placement?.events.get('teg-awakens')?.t;
    const scorchVis =
      burnt === undefined || before === undefined ? 0 : THREE.MathUtils.clamp((focusT - before) / Math.max(burnt - before, 1e-6), 0, 1);
    this.desert.setEcologyVisibility(this.greenVisibility(focusT), scorchVis);

    // Spice in the air follows the era the camera is looking at.
    if (era !== null) {
      let level = SPICE_BY_ERA[era] ?? 0.2;
      const scorched = this.placement?.events.get('rakis-destroyed')?.t;
      if (scorched !== undefined && era === 'return' && focusT > scorched) level = 0.25;
      this.desert.setSpice(level * (0.35 + 0.65 * this.presence));
    }
  }

  private spiceBlow(dt: number): void {
    const b = this.blowAt;
    const n = Math.round(dt * 90);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 6;
      this.spice.emit(
        b.x + Math.cos(a) * r,
        b.y + 1,
        b.z + Math.sin(a) * r,
        Math.cos(a) * (2 + Math.random() * 6),
        22 + Math.random() * 30,
        Math.sin(a) * (2 + Math.random() * 6),
        3.5 + Math.random() * 2,
        3 + Math.random() * 4,
      );
      if (i % 4 === 0) {
        this.dust.emit(b.x + Math.cos(a) * r * 2, b.y + 1, b.z + Math.sin(a) * r * 2, Math.cos(a) * 8, 7 + Math.random() * 10, Math.sin(a) * 8, 4, 12 + Math.random() * 8);
      }
    }
  }
}
