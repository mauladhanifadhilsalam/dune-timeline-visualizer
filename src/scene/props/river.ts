import * as THREE from 'three';
import { RIVER_POINTS, duneHeight, type RiverCourse } from '../desert';
import { wormBodyAssets } from './sandworm';

/**
 * The course in the piece's local frame (x along the path, -z away from it). It comes down out of
 * the background toward the viewer, then turns to run off alongside the path: seen from the low
 * camera, a river across the view is a thin stripe, one coming at it reads as a river.
 */
const COURSE: [number, number][] = [
  [-130, -330],
  [-75, -250],
  [-30, -170],
  [-8, -95],
  [12, -30],
  [60, 8],
  [150, 26],
  [270, 30],
  [390, 18],
];
/** Where the bridge crosses: on the stretch running toward the viewer, so it is seen side on. */
const BRIDGE: [number, number] = [0, -60];
const HALF_WIDTH = 21;
const BANK = 34;
const TROUT = 72;
/** Seconds for the sandtrout to spread from the body and fade. */
const SPREAD = 16;

/** Circles covering the course, for placement (river plus banks). */
export const RIVER_FOOTPRINT = COURSE.map(([x, z]) => ({ x, z, r: HALF_WIDTH + BANK }));

/**
 * The Idaho River in God Emperor of Dune: Leto II's wedding procession crosses it, the bridge is cut
 * with a lasgun, and the God Emperor falls into the water, which is death to the sandtrout skin.
 * His body breaks apart, the sandtrout spreading away into the current. The terrain shader cuts
 * the channel; this draws the water, the broken bridge, his body and the trout.
 */
export class IdahoRiver {
  readonly group = new THREE.Group();
  private readonly curve: THREE.CatmullRomCurve3;
  private readonly water: THREE.Mesh;
  private readonly waterTime = { value: 0 };
  private readonly bridge = new THREE.Group();
  private readonly body: THREE.InstancedMesh;
  private readonly trout: THREE.InstancedMesh;
  private readonly troutSeed: { angle: number; reach: number; offset: number; size: number }[] = [];
  private readonly flow = new THREE.Vector3();
  private readonly bridgeAt = new THREE.Vector3();
  private levelLocal = 0;
  /** World-space course for the terrain, set by fit(). */
  course: Omit<RiverCourse, 'amount'> | null = null;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly v = new THREE.Vector3();

  constructor() {
    this.curve = new THREE.CatmullRomCurve3(COURSE.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');

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

    // The bridge across, its middle span cut away, one slab lying in the river.
    const stone = new THREE.MeshStandardMaterial({ color: '#9a8770', roughness: 0.85, flatShading: true });
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, rz = 0) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), stone);
      b.position.set(x, y, z);
      b.rotation.z = rz;
      this.bridge.add(b);
    };
    const deckY = 14;
    for (const s of [-1, 1]) {
      box(38, 3, 10, s * 28, deckY, 0); // deck
      box(38, 2.2, 0.8, s * 28, deckY + 2.6, 4.6); // parapets
      box(38, 2.2, 0.8, s * 28, deckY + 2.6, -4.6);
      box(6, deckY + 8, 9, s * 19, deckY / 2 - 4, 0); // pier in the water
      box(9, deckY + 10, 12, s * 47, deckY / 2 - 5, 0); // abutment on the bank
      box(4, 3.4, 9, s * 10, deckY - 0.4, 0, s * 0.35); // broken, sagging end
    }
    box(17, 2.6, 10, 2, 0.2, 6, 0.42); // the cut span, fallen
    this.group.add(this.bridge);

    // Leto II's body in the water below the bridge: a worm's rings, half under, thinning to the tail.
    const { segment, material } = wormBodyAssets();
    this.body = new THREE.InstancedMesh(segment, material, 12);
    const c = new THREE.Color();
    for (let i = 0; i < 12; i++) this.body.setColorAt(i, c.set('#8a7a68').offsetHSL(0, 0, i % 2 ? -0.04 : 0.02));
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
  }

  /** Set the water level and the world course once the piece's place is known. */
  fit(center: THREE.Vector3, quat: THREE.Quaternion): void {
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

    // Bridge where the river runs toward the viewer, deck across it.
    const u = this.nearestU(...BRIDGE);
    this.curve.getPointAt(u, this.bridgeAt);
    this.curve.getTangentAt(u, this.flow);
    this.flow.y = 0;
    this.flow.normalize();
    if (this.flow.z < 0) this.flow.negate(); // downstream = toward the path side
    this.bridge.position.set(this.bridgeAt.x, this.levelLocal, this.bridgeAt.z);
    // Deck (local X of the bridge) across the flow: rotation.y = θ sends +X to (cos θ, -sin θ),
    // which with θ = atan2(fx, fz) is (fz, -fx), perpendicular to the flow (fx, fz).
    this.bridge.rotation.y = Math.atan2(this.flow.x, this.flow.z);

    // His body from just below the bridge, downstream.
    for (let i = 0; i < 12; i++) {
      const r = 4.6 - i * 0.18;
      const along = 9 + i * 4.2;
      const a = this.v.copy(this.bridgeAt).addScaledVector(this.flow, along);
      a.x += Math.sin(i * 0.5) * 2.5;
      a.y = this.levelLocal - r * 0.25 - i * 0.12;
      this.q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.flow);
      this.m.compose(a, this.q, new THREE.Vector3(r, r * 0.9, 4.6));
      this.body.setMatrixAt(i, this.m);
    }
    this.body.instanceMatrix.needsUpdate = true;
  }

  private nearestU(x: number, z: number): number {
    let best = 0;
    let bestD = Infinity;
    const p = new THREE.Vector3();
    for (let i = 0; i <= 200; i++) {
      this.curve.getPointAt(i / 200, p);
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bestD) {
        bestD = d;
        best = i / 200;
      }
    }
    return best;
  }

  update(time: number): void {
    if (!this.group.visible) return;
    this.waterTime.value = time;
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
