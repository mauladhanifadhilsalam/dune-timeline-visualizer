import * as THREE from 'three';
import { buildFigure } from './figure';
import type { Particles } from './particles';

export interface WormOptions {
  /** 1 = a great maker. Everything (length, girth, breach height) scales with it. */
  scale: number;
  /** Semi-axes of the loop the worm swims, along the path and across it. */
  loopAlong: number;
  loopAcross: number;
  /** Units per second along the loop. */
  speed: number;
  phase: number;
  /** Swim the loop clockwise instead. */
  reverse?: boolean;
  /**
   * A Fremen rides it. Maker hooks hold a ring of its body open, so a ridden worm cannot dive:
   * it stays at the surface, with the rider standing behind the head.
   */
  ridden?: boolean;
}

const SEGMENTS = 34;

/** Ring-ridged body segment, axis along +Z so Object3D.lookAt aims it along the body. */
function segmentGeometry(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(1, 1, 1, 22, 6, true);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    // Bulge at both ends of every segment, so the body reads as rings.
    const k = 1 + 0.11 * Math.pow(Math.abs(y) * 2, 5) - 0.03 * Math.cos(y * Math.PI * 2);
    p.setX(i, p.getX(i) * k);
    p.setZ(i, p.getZ(i) * k);
  }
  g.rotateX(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

let shared: {
  segment: THREE.BufferGeometry;
  body: THREE.MeshStandardMaterial;
  lip: THREE.CylinderGeometry;
  maw: THREE.CircleGeometry;
  tooth: THREE.ConeGeometry;
  toothMat: THREE.MeshStandardMaterial;
  mawMat: THREE.MeshBasicMaterial;
} | null = null;

function assets() {
  if (shared) return shared;
  // Tip along +Z so a lookAt aims it.
  const tooth = new THREE.ConeGeometry(0.07, 0.42, 5);
  tooth.translate(0, 0.21, 0).rotateX(Math.PI / 2);
  shared = {
    segment: segmentGeometry(),
    body: new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#3b2a1d',
      roughness: 0.82,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
    lip: new THREE.CylinderGeometry(1.08, 1.0, 0.5, 26, 1, true).rotateX(Math.PI / 2) as THREE.CylinderGeometry,
    maw: new THREE.CircleGeometry(0.98, 26),
    tooth,
    // Crysknives are made from these: milky, faintly luminous.
    toothMat: new THREE.MeshStandardMaterial({ color: '#f1ebdd', emissive: '#ffe8c2', emissiveIntensity: 0.25, roughness: 0.3 }),
    // Fremen say there is fire in the maker's throat.
    mawMat: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a2a').multiplyScalar(1.4), side: THREE.DoubleSide }),
  };
  return shared;
}

/** The worm body's ring segment and skin, for other pieces that need a worm's body. */
export function wormBodyAssets(): { segment: THREE.BufferGeometry; material: THREE.MeshStandardMaterial } {
  const a = assets();
  return { segment: a.segment, material: a.body };
}

/**
 * Shai-Hulud. The body follows the head along one closed curve (a sine wave through the sand
 * surface, swept around an ellipse), so it surfaces in arcs and dives again like a sea creature.
 * Anything below the dunes is hidden by the terrain's own depth, so no clipping logic is needed.
 */
export class Sandworm {
  readonly group = new THREE.Group();
  private readonly body: THREE.InstancedMesh;
  private readonly head = new THREE.Group();
  private readonly center = new THREE.Vector3();
  private readonly along = new THREE.Vector3(1, 0, 0);
  private readonly across = new THREE.Vector3(0, 0, 1);
  private s = 0;
  private presence = 1;
  private emitDebt = 0;
  private readonly dummy = new THREE.Object3D();
  private readonly pts: THREE.Vector3[] = Array.from({ length: SEGMENTS + 2 }, () => new THREE.Vector3());
  private readonly ground: number[] = new Array(SEGMENTS + 2).fill(0);
  private readonly rider: THREE.Group | null = null;

  constructor(private readonly o: WormOptions) {
    const a = assets();
    this.body = new THREE.InstancedMesh(a.segment, a.body, SEGMENTS);
    this.body.frustumCulled = false;
    const c = new THREE.Color();
    for (let i = 0; i < SEGMENTS; i++) {
      c.set('#b39a7c').offsetHSL(0, 0, (i % 2 ? -0.04 : 0.02) - (i / SEGMENTS) * 0.1);
      this.body.setColorAt(i, c);
    }
    const lip = new THREE.Mesh(a.lip, a.body);
    const maw = new THREE.Mesh(a.maw, a.mawMat);
    maw.position.z = -0.15;
    // Two rings of crystal teeth, all leaning in toward the throat.
    const teeth = new THREE.InstancedMesh(a.tooth, a.toothMat, 36);
    const throat = new THREE.Vector3(0, 0, -0.9);
    for (let i = 0; i < 36; i++) {
      const ring = i < 22 ? 0 : 1;
      const n = ring ? 14 : 22;
      const ang = ((ring ? i - 22 : i) / n) * Math.PI * 2 + ring * 0.2;
      const r = ring ? 0.62 : 0.92;
      this.dummy.position.set(Math.cos(ang) * r, Math.sin(ang) * r, 0.12 - ring * 0.28);
      this.dummy.lookAt(throat);
      this.dummy.updateMatrix();
      teeth.setMatrixAt(i, this.dummy.matrix);
    }
    this.head.add(lip, maw, teeth);
    this.group.add(this.body, this.head);
    this.s = o.phase;

    if (o.ridden) {
      // The rider, drawn several times life size so it reads at all against a great maker, with
      // two maker hooks: long staves angled forward into the ring segments.
      const rider = new THREE.Group();
      const figure = buildFigure('#2e241c');
      figure.scale.setScalar(4.2);
      const hookMat = new THREE.MeshStandardMaterial({ color: '#4a3a2c', roughness: 0.8 });
      const hookGeo = new THREE.CylinderGeometry(0.09, 0.09, 6.5, 6).translate(0, 3.25, 0);
      for (const side of [-1, 1]) {
        const hook = new THREE.Mesh(hookGeo, hookMat);
        hook.position.set(side * 0.7, 2.4, 0.3);
        hook.rotation.set(1.05, 0, side * 0.35);
        rider.add(hook);
      }
      rider.add(figure);
      this.rider = rider;
      this.group.add(rider);
    }
  }

  /** Centre of the loop and the path's local axes there. */
  place(center: THREE.Vector3, tangent: THREE.Vector3, side: THREE.Vector3): void {
    this.center.copy(center);
    this.along.set(tangent.x, 0, tangent.z).normalize();
    this.across.copy(side);
  }

  /** 1 = fully out; 0 = sounded deep under the sand and hidden. */
  setPresence(k: number): void {
    this.presence = k;
    this.group.visible = k > 0.01;
  }

  private point(s: number, out: THREE.Vector3): THREE.Vector3 {
    const o = this.o;
    const R = (o.loopAlong + o.loopAcross) / 2;
    const th = (o.reverse ? -1 : 1) * (s / R);
    return out
      .copy(this.center)
      .addScaledVector(this.along, Math.cos(th) * o.loopAlong)
      .addScaledVector(this.across, Math.sin(th) * o.loopAcross);
  }

  /**
   * Height above the sand at arc-length s. The wavelength is a little longer than the body, so
   * the worm humps out of the dunes in one arc at a time and sounds again, never gliding along
   * the surface like a snake.
   */
  private lift(s: number): number {
    const sc = this.o.scale;
    if (this.o.ridden) {
      // Held at the surface: about half the body above the sand, rolling gently.
      return 6.2 * sc * 0.45 + Math.sin(s / (60 * sc)) * 1.6 * sc - (1 - this.presence) * 70 * sc;
    }
    const wave = Math.sin((s / (270 * sc)) * Math.PI * 2);
    const H = 26 * sc;
    const D = 11 * sc + (1 - this.presence) * 70 * sc;
    return H * wave - D;
  }

  update(dt: number, groundAt: (x: number, z: number) => number, dust: Particles): void {
    if (!this.group.visible) return;
    const sc = this.o.scale;
    this.s += dt * this.o.speed;
    const spacing = 4.6 * sc;
    for (let i = 0; i <= SEGMENTS + 1; i++) {
      const s = this.s - i * spacing;
      const p = this.point(s, this.pts[i]);
      const g = groundAt(p.x, p.z);
      this.ground[i] = g;
      p.y = g + this.lift(s);
    }
    const r0 = 6.2 * sc;
    for (let i = 0; i < SEGMENTS; i++) {
      const a = this.pts[i];
      const b = this.pts[i + 1];
      const t = i / SEGMENTS;
      const r = r0 * (0.98 - 0.5 * Math.pow(t, 1.4));
      this.dummy.position.copy(a).add(b).multiplyScalar(0.5);
      this.dummy.lookAt(a);
      this.dummy.scale.set(r, r, a.distanceTo(b) * 1.12);
      this.dummy.updateMatrix();
      this.body.setMatrixAt(i, this.dummy.matrix);
    }
    this.body.instanceMatrix.needsUpdate = true;

    // Head: at the front of the first segment, mouth along the direction of travel.
    const h0 = this.pts[0];
    const h1 = this.pts[1];
    this.head.position.copy(h0).addScaledVector(h0.clone().sub(h1).normalize(), 0.3 * sc);
    this.head.lookAt(this.head.position.clone().add(h0.clone().sub(h1)));
    this.head.scale.setScalar(r0 * 1.02);

    if (this.rider) {
      // Standing on the back a few rings behind the head, facing the way it travels.
      const a = this.pts[4];
      const b = this.pts[5];
      const r = r0 * (0.98 - 0.5 * Math.pow(4 / SEGMENTS, 1.4));
      this.rider.position.copy(a).add(b).multiplyScalar(0.5);
      this.rider.position.y += r * 0.92;
      this.rider.lookAt(this.rider.position.x + (a.x - b.x), this.rider.position.y, this.rider.position.z + (a.z - b.z));
    }

    // Sand sprays wherever the body breaks the surface.
    this.emitDebt += dt * 70 * sc;
    for (let i = 0; i < SEGMENTS && this.emitDebt >= 1; i += 2) {
      const p = this.pts[i];
      const depth = p.y - this.ground[i];
      if (Math.abs(depth) > r0 * 0.9) continue;
      const tilt = this.pts[i].y - this.pts[i + 1].y;
      const ang = Math.random() * Math.PI * 2;
      const out = r0 * (1.1 + Math.random() * 0.4);
      dust.emit(
        p.x + Math.cos(ang) * out,
        this.ground[i] + 0.5,
        p.z + Math.sin(ang) * out,
        Math.cos(ang) * (4 + Math.random() * 6) * sc,
        (6 + Math.random() * 10 + Math.max(tilt, 0) * 2) * sc,
        Math.sin(ang) * (4 + Math.random() * 6) * sc,
        2.2 + Math.random() * 1.6,
        (9 + Math.random() * 10) * sc,
      );
      this.emitDebt -= 1;
    }
    this.emitDebt = Math.min(this.emitDebt, 8);
  }
}
