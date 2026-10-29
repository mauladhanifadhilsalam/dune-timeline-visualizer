import * as THREE from 'three';
import { RIVER_POINTS, duneHeight, riverGround, type RiverCourse } from '../desert';
import { wormBodyAssets } from './sandworm';

/**
 * The course in the piece's local frame (x along the path, -z away from it): a U opening away from
 * the path. It comes down out of the background on the right toward the viewer, bends nearest the
 * path, and runs back out on the left. Seen from the low camera a river across the view is a thin
 * stripe; one coming at it reads as a river. It never runs alongside the path, which elsewhere
 * bends back toward it.
 */
const COURSE: [number, number][] = [
  [230, -200],
  [170, -110],
  [100, -10],
  [40, 65],
  [0, 95],
  [-60, 90],
  [-140, 55],
  [-220, 10],
];
/**
 * Where the bridge crosses: on the left arm, well to the side of the event's light and label, which
 * stand in the middle of the view; and on the left, because the event's card covers the right.
 */
const BRIDGE: [number, number] = [-110, 68];
const HALF_WIDTH = 21;
const BANK = 34;
/** The bridge: deck height above the water, and how far out its abutments stand from its middle. */
const DECK_Y = 14;
const ABUTMENT = 47;
/** The Royal Road: half its width, its run either side of the bridge, and its ramps up to the deck. */
const ROAD_HALF = 6;
const ROAD_BACK = 260;
const ROAD_FRONT = 150;
const RAMP = 70;
const ROAD_STEPS = 44;

/**
 * The bridge and the Royal Road through it, in the piece's frame: fixed by the course, so placement
 * can know the road's ground before anything is built. The road runs straight along the deck, from
 * deep inside the U, across the river and on toward the path, so whoever walks it comes toward the
 * viewer. The river flows down the left arm, round the bend and away up the right, so what falls
 * from the bridge drifts toward the bend, in open water in front of everything.
 */
export const RIVER_ROAD = (() => {
  const curve = new THREE.CatmullRomCurve3(COURSE.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  let best = 0;
  let bestD = Infinity;
  const p = new THREE.Vector3();
  for (let i = 0; i <= 400; i++) {
    curve.getPointAt(i / 400, p);
    const d = Math.hypot(p.x - BRIDGE[0], p.z - BRIDGE[1]);
    if (d < bestD) {
      bestD = d;
      best = i / 400;
    }
  }
  const at = curve.getPointAt(best);
  // Against course order: the course runs right to left.
  const flow = curve.getTangentAt(best).setY(0).normalize().negate();
  // The deck runs across the flow; the road's "back" end is the one away from the path.
  const deck = new THREE.Vector3(flow.z, 0, -flow.x);
  if (deck.z > 0) deck.negate();
  const point = (t: number): [number, number] => [at.x + deck.x * t, at.z + deck.z * t];
  return { curve, at, flow, deck, point, from: point(ROAD_BACK), to: point(-ROAD_FRONT) };
})();
const TROUT = 72;
/** Seconds for the sandtrout to spread from the body and fade. */
const SPREAD = 16;

/** Circles covering the course (river plus banks) and the road's ends, for placement. */
export const RIVER_FOOTPRINT = [
  ...COURSE.map(([x, z]) => ({ x, z, r: HALF_WIDTH + BANK })),
  ...[RIVER_ROAD.from, RIVER_ROAD.to].map(([x, z]) => ({ x, z, r: 22 })),
];

/**
 * The Idaho River in God Emperor of Dune: Leto II's wedding procession crosses it on the Royal
 * Road, the bridge is cut with a lasgun, and the God Emperor falls into the water, which is death to
 * the sandtrout skin. His body breaks apart, the sandtrout spreading away into the current. The
 * terrain shader levels the plain and cuts the channel; this draws the water, the road, the bridge
 * (whole, then cut), his body and the trout.
 */
export class IdahoRiver {
  readonly group = new THREE.Group();
  private readonly curve: THREE.CatmullRomCurve3;
  private readonly water: THREE.Mesh;
  private readonly waterTime = { value: 0 };
  private readonly bridge = new THREE.Group();
  /** The bridge as it stands until the ambush, and as the lasgun leaves it. */
  private readonly whole = new THREE.Group();
  private readonly cut = new THREE.Group();
  private broken = true;
  private readonly body: THREE.InstancedMesh;
  private readonly trout: THREE.InstancedMesh;
  private readonly troutSeed: { angle: number; reach: number; offset: number; size: number }[] = [];
  private readonly flow = RIVER_ROAD.flow;
  private readonly bridgeAt = RIVER_ROAD.at;
  private readonly road: THREE.Mesh;
  private levelLocal = 0;
  private center = new THREE.Vector3(NaN, 0, 0);
  private quat = new THREE.Quaternion();
  /** World-space course for the terrain, set by fit(). */
  course: Omit<RiverCourse, 'amount'> | null = null;
  /** The Royal Road's two ends in the world, for the forest to be cleared along it; set by fit(). */
  roadEnds: [THREE.Vector2, THREE.Vector2] | null = null;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();

  constructor() {
    this.curve = RIVER_ROAD.curve;

    // Water: a ribbon along the curve, fading out at both ends so the river has no hard edges.
    const N = 160;
    const pos = new Float32Array((N + 1) * 2 * 3);
    const col = new Float32Array((N + 1) * 2 * 4);
    const idx: number[] = [];
    const p = new THREE.Vector3();
    const t = new THREE.Vector3();
    const water = new THREE.Color('#4f8f98');
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      this.curve.getPointAt(u, p);
      this.curve.getTangentAt(u, t);
      const sx = -t.z;
      const sz = t.x;
      const w = HALF_WIDTH + 1.5;
      pos.set([p.x + sx * w, 0, p.z + sz * w, p.x - sx * w, 0, p.z - sz * w], i * 6);
      const a = THREE.MathUtils.smoothstep(u, 0, 0.1) * (1 - THREE.MathUtils.smoothstep(u, 0.9, 1));
      col.set([water.r, water.g, water.b, a * 0.94, water.r, water.g, water.b, a * 0.94], i * 8);
      if (i < N) {
        const k = i * 2;
        idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      transparent: true,
      // No environment map to reflect, so a metallic surface would render black: keep it a lit,
      // glossy dielectric and let the ripples catch the sun.
      roughness: 0.22,
      metalness: 0,
      depthWrite: false,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.waterTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vRipple;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRipple = (modelMatrix * vec4(position, 1.0)).xz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vRipple;\nuniform float uTime;')
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          // Small moving ripples, so the low sun glints across the current.
          normal = normalize(normal + vec3(
            sin(vRipple.x * 0.35 + uTime * 1.4) * 0.07 + sin(vRipple.y * 0.9 - uTime * 2.1) * 0.03,
            0.0,
            cos(vRipple.y * 0.31 - uTime * 1.1) * 0.07));`,
        );
    };
    this.water = new THREE.Mesh(geo, mat);
    this.water.renderOrder = 1;
    this.group.add(this.water);

    // The bridge across: whole until the ambush; then its middle span cut away, one slab lying in
    // the river.
    const stone = new THREE.MeshStandardMaterial({ color: '#9a8770', roughness: 0.85, flatShading: true });
    const box = (to: THREE.Group, w: number, h: number, d: number, x: number, y: number, z: number, rz = 0) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stone);
      b.position.set(x, y, z);
      b.rotation.z = rz;
      to.add(b);
    };
    const deckY = DECK_Y;
    for (const s of [-1, 1]) {
      box(this.bridge, 6, deckY + 8, 9, s * 19, deckY / 2 - 4, 0); // pier in the water
      box(this.bridge, 9, deckY + 10, 12, s * ABUTMENT, deckY / 2 - 5, 0); // abutment on the bank
      box(this.cut, 38, 3, 10, s * 28, deckY, 0); // deck
      box(this.cut, 38, 2.2, 0.8, s * 28, deckY + 2.6, 4.6); // parapets
      box(this.cut, 38, 2.2, 0.8, s * 28, deckY + 2.6, -4.6);
      box(this.cut, 4, 3.4, 9, s * 10, deckY - 0.4, 0, s * 0.35); // broken, sagging end
      box(this.whole, 94, 2.2, 0.8, 0, deckY + 2.6, s * 4.6); // parapets
    }
    box(this.whole, 94, 3, 10, 0, deckY, 0); // deck
    box(this.cut, 17, 2.6, 10, 2, 0.2, 6, 0.42); // the cut span, fallen
    this.bridge.add(this.whole, this.cut);
    this.group.add(this.bridge);

    // Leto II's body in the water below the bridge: a worm's rings, half under, thinning to the tail.
    const { segment, material } = wormBodyAssets();
    this.body = new THREE.InstancedMesh(segment, material, 12);
    const c = new THREE.Color();
    // Pale against the dark water, so it reads from the path.
    for (let i = 0; i < 12; i++) this.body.setColorAt(i, c.set('#c2ae92').offsetHSL(0, 0, i % 2 ? -0.05 : 0.02));
    this.group.add(this.body);

    // Sandtrout leaving the body.
    this.trout = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 8, 6).scale(1.3, 0.35, 0.8),
      new THREE.MeshStandardMaterial({ color: '#3a2d24', roughness: 0.7 }),
      TROUT,
    );
    for (let i = 0; i < TROUT; i++) {
      this.troutSeed.push({
        angle: Math.random() * Math.PI * 2,
        reach: 10 + Math.random() * 30,
        offset: Math.random() * SPREAD,
        size: 0.7 + Math.random() * 0.8,
      });
    }
    this.trout.frustumCulled = false;
    this.group.add(this.trout);

    // The Royal Road: a paved causeway either side of the bridge, its sides walled down to the
    // ground, rising on ramps to the deck. Heights are filled in by fit(), once the ground is known.
    const strips = 2;
    const perStep = 4; // top-left, top-right, foot-left, foot-right
    const rpos = new Float32Array(strips * (ROAD_STEPS + 1) * perStep * 3);
    const rcol = new Float32Array(rpos.length);
    const ridx: number[] = [];
    const paving = new THREE.Color('#b3a07f');
    const wall = new THREE.Color('#7d6b55');
    for (let k = 0; k < strips; k++) {
      for (let i = 0; i <= ROAD_STEPS; i++) {
        const v = (k * (ROAD_STEPS + 1) + i) * perStep;
        paving.toArray(rcol, v * 3);
        paving.toArray(rcol, (v + 1) * 3);
        wall.toArray(rcol, (v + 2) * 3);
        wall.toArray(rcol, (v + 3) * 3);
        if (i === ROAD_STEPS) continue;
        const n = v + perStep;
        ridx.push(v, n, v + 1, v + 1, n, n + 1); // paving
        ridx.push(v + 2, n + 2, v, v, n + 2, n); // left wall
        ridx.push(v + 1, n + 1, v + 3, v + 3, n + 1, n + 3); // right wall
      }
    }
    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.BufferAttribute(rpos, 3));
    roadGeo.setAttribute('color', new THREE.BufferAttribute(rcol, 3));
    roadGeo.setIndex(ridx);
    this.road = new THREE.Mesh(
      roadGeo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true, side: THREE.DoubleSide }),
    );
    this.road.frustumCulled = false;
    this.group.add(this.road);
  }

  /** Ground height at a local point, with the plain and the channel cut, in local units. */
  private groundLocal(x: number, z: number): number {
    const w = this.v.set(x, 0, z).applyQuaternion(this.quat).add(this.center);
    return (this.course ? riverGround(w.x, w.z, this.course) : duneHeight(w.x, w.z)) - this.center.y;
  }

  /**
   * Height of the Royal Road's surface at a local point on it: the deck over the river, ramps up to
   * it from either bank, and the ground (never below it) beyond. Valid after fit().
   */
  roadY(x: number, z: number): number {
    const t = Math.abs((x - this.bridgeAt.x) * RIVER_ROAD.deck.x + (z - this.bridgeAt.z) * RIVER_ROAD.deck.z);
    const top = this.levelLocal + DECK_Y + 1.5;
    if (t <= ABUTMENT) return top;
    const ground = this.groundLocal(x, z) + 0.3;
    const ramp = top + (ground - top) * THREE.MathUtils.smoothstep(t, ABUTMENT, ABUTMENT + RAMP);
    return Math.max(ground, ramp);
  }

  /** The road's route through the bridge, from its back end to its front, for those who walk it. */
  roadRoute(): [number, number][] {
    return [RIVER_ROAD.point(ROAD_BACK), RIVER_ROAD.point(0), RIVER_ROAD.point(-ROAD_FRONT)];
  }

  private fitRoad(): void {
    const pos = this.road.geometry.attributes.position as THREE.BufferAttribute;
    const { deck, flow, at } = RIVER_ROAD;
    // Either side of the bridge: from its far end in to the abutment.
    const runs: [number, number][] = [
      [ROAD_BACK, ABUTMENT - 2],
      [-ROAD_FRONT, -(ABUTMENT - 2)],
    ];
    runs.forEach(([t0, t1], k) => {
      for (let i = 0; i <= ROAD_STEPS; i++) {
        const t = t0 + ((t1 - t0) * i) / ROAD_STEPS;
        const cx = at.x + deck.x * t;
        const cz = at.z + deck.z * t;
        const v = (k * (ROAD_STEPS + 1) + i) * 4;
        for (const [j, side] of [
          [0, -1],
          [1, 1],
        ] as const) {
          const x = cx + flow.x * side * ROAD_HALF;
          const z = cz + flow.z * side * ROAD_HALF;
          const y = this.roadY(cx, cz);
          pos.setXYZ(v + j, x, y, z);
          pos.setXYZ(v + 2 + j, x, Math.min(this.groundLocal(x, z), y) - 1.5, z);
        }
      }
    });
    pos.needsUpdate = true;
    this.road.geometry.computeVertexNormals();
    this.road.geometry.computeBoundingSphere();
  }

  /** Set the water level and the world course once the piece's place is known. */
  fit(center: THREE.Vector3, quat: THREE.Quaternion): void {
    // Layout runs every frame of a scale morph; only a real move needs the ground re-read.
    if (center.distanceTo(this.center) < 0.5 && quat.angleTo(this.quat) < 1e-4) return;
    this.center = center.clone();
    this.quat = quat.clone();
    // The water sits just under the lowest ground along the course, so it never floats.
    const p = new THREE.Vector3();
    let low = Infinity;
    for (let i = 0; i <= 120; i++) {
      this.curve.getPointAt(i / 120, p);
      p.applyQuaternion(quat).add(center);
      low = Math.min(low, duneHeight(p.x, p.z));
    }
    const level = low - 1.5;
    this.levelLocal = level - center.y;
    this.water.position.y = this.levelLocal;

    const points: THREE.Vector2[] = [];
    for (let i = 0; i < RIVER_POINTS; i++) {
      this.curve.getPointAt(i / (RIVER_POINTS - 1), p);
      p.applyQuaternion(quat).add(center);
      points.push(new THREE.Vector2(p.x, p.z));
    }
    this.course = { points, halfWidth: HALF_WIDTH, bank: BANK, level };
    const end = ([x, z]: [number, number]) => {
      const w = new THREE.Vector3(x, 0, z).applyQuaternion(quat).add(center);
      return new THREE.Vector2(w.x, w.z);
    };
    this.roadEnds = [end(RIVER_ROAD.from), end(RIVER_ROAD.to)];
    this.fitRoad();

    // Bridge where the river runs toward the viewer, deck across it.
    this.bridge.position.set(this.bridgeAt.x, this.levelLocal, this.bridgeAt.z);
    // Deck (local X of the bridge) across the flow: rotation.y = θ sends +X to (cos θ, -sin θ),
    // which with θ = atan2(fx, fz) is (fz, -fx), perpendicular to the flow (fx, fz).
    this.bridge.rotation.y = Math.atan2(this.flow.x, this.flow.z);

    // His body from just below the bridge, downstream: drawn larger than life like everything here,
    // and riding high in the current, so it reads from the path.
    for (let i = 0; i < 12; i++) {
      const r = 7.5 - i * 0.32;
      const along = 10 + i * 6.4;
      const a = this.v.copy(this.bridgeAt).addScaledVector(this.flow, along);
      a.x += Math.sin(i * 0.5) * 3.5;
      a.y = this.levelLocal - r * 0.05 - i * 0.15;
      this.q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.flow);
      this.m.compose(a, this.q, new THREE.Vector3(r, r * 0.9, 7));
      this.body.setMatrixAt(i, this.m);
    }
    this.body.instanceMatrix.needsUpdate = true;
  }

  /** Before Leto II's death the bridge stands whole and the river is empty; after, it is cut. */
  setBroken(broken: boolean): void {
    this.broken = broken;
    this.whole.visible = !broken;
    this.cut.visible = broken;
    this.body.visible = broken;
    this.trout.visible = broken;
  }

  update(time: number): void {
    if (!this.group.visible) return;
    this.waterTime.value = time;
    if (!this.broken) return;
    const start = this.v.copy(this.bridgeAt).addScaledVector(this.flow, 20);
    for (let i = 0; i < TROUT; i++) {
      const s = this.troutSeed[i];
      const k = ((time + s.offset) % SPREAD) / SPREAD;
      // Out from the body and carried downstream, growing in then fading away.
      const reach = s.reach * k;
      const x = start.x + Math.cos(s.angle) * reach * 0.6 + this.flow.x * 40 * k;
      const z = start.z + Math.sin(s.angle) * reach * 0.6 + this.flow.z * 40 * k;
      const size = s.size * THREE.MathUtils.smoothstep(k, 0, 0.1) * (1 - THREE.MathUtils.smoothstep(k, 0.75, 1));
      this.m.compose(
        new THREE.Vector3(x, this.levelLocal + 0.25, z),
        this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.angle + time * 0.3),
        new THREE.Vector3(size, size, size),
      );
      this.trout.setMatrixAt(i, this.m);
    }
    this.trout.instanceMatrix.needsUpdate = true;
  }
}
