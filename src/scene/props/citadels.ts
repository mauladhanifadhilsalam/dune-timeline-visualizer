import * as THREE from 'three';
import { duneHeight } from '../desert';
import { createBanner } from './banner';

/** Square frustum, base on y = 0: walls that lean in as they rise. */
function frustum(bottom: number, top: number, height: number): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(top * Math.SQRT1_2, bottom * Math.SQRT1_2, height, 4, 1)
    .rotateY(Math.PI / 4)
    .translate(0, height / 2, 0);
}

const glow = (hex: string, k: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) });

/**
 * The Keep in Arrakeen, from which Alia rules as regent: a stepped plinth, a tall tapering main
 * tower with four buttress towers, lit window slits, a domed crown with a beacon, and long green
 * and black banners hanging down the face that looks toward the path (local +Z).
 */
export function buildKeep(): THREE.Group {
  // Modelled at full size, shown at KEEP_SCALE: still three times anything in Arrakeen,
  // but it fits the frame from its own event. (The outer group's transform belongs to placement.)
  const outer = new THREE.Group();
  const g = new THREE.Group();
  g.scale.setScalar(KEEP_SCALE);
  outer.add(g);
  const stone = new THREE.MeshStandardMaterial({ color: '#9b7c5c', roughness: 0.9, flatShading: true });
  const darker = new THREE.MeshStandardMaterial({ color: '#7b6047', roughness: 0.9, flatShading: true });

  // Plinth: three steps, sunk a little so dune noise never shows a gap under it.
  const steps: [number, number, number][] = [
    [150, -6, 14],
    [118, 8, 10],
    [92, 18, 12],
  ];
  for (const [w, y, h] of steps) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w).translate(0, y + h / 2, 0), darker);
    g.add(m);
  }
  const BASE = 30;
  const TOWER_H = 190;
  const W0 = 64;
  const W1 = 44;
  const main = new THREE.Mesh(frustum(W0, W1, TOWER_H).translate(0, BASE, 0), stone);
  g.add(main);
  for (const [x, z] of [
    [-38, -38],
    [38, -38],
    [-38, 38],
    [38, 38],
  ]) {
    const b = new THREE.Mesh(frustum(20, 13, 150).translate(x, BASE, z), darker);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(9, 16, 4).rotateY(Math.PI / 4).translate(x, BASE + 158, z), stone);
    g.add(b, cap);
  }
  const crownY = BASE + TOWER_H;
  const crown = new THREE.Mesh(new THREE.BoxGeometry(40, 14, 40).translate(0, crownY + 7, 0), darker);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(17, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, crownY + 14, 0),
    new THREE.MeshStandardMaterial({ color: '#c9a77e', roughness: 0.45, metalness: 0.25 }),
  );
  const spire = new THREE.Mesh(new THREE.ConeGeometry(2.4, 30, 8).translate(0, crownY + 45, 0), darker);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), glow('#ffdca8', 2.6));
  beacon.position.y = crownY + 61;
  g.add(crown, dome, spire, beacon);

  // Window slits on the three faces the viewer can see, rows up the tower.
  const slit = new THREE.BoxGeometry(1.6, 5, 1.6);
  const windows = new THREE.InstancedMesh(slit, glow('#ffc978', 2.1), 220);
  const m4 = new THREE.Matrix4();
  let n = 0;
  const halfAt = (y: number) => (W0 / 2) * (1 - ((y - BASE) / TOWER_H) * (1 - W1 / W0));
  for (let y = BASE + 14; y < crownY - 8 && n < 214; y += 11) {
    const h = halfAt(y) + 0.4;
    for (const t of [-0.6, -0.3, 0.3, 0.6]) {
      if (((y * 7 + t * 13) | 0) % 5 === 0) continue; // a few dark rooms
      // Front face (+Z) leaves the middle clear for the banners.
      m4.makeTranslation(t * h, y, h);
      windows.setMatrixAt(n++, m4);
      m4.makeTranslation(h, y, t * h);
      windows.setMatrixAt(n++, m4);
      m4.makeTranslation(-h, y, t * h);
      windows.setMatrixAt(n++, m4);
    }
  }
  windows.count = n;
  g.add(windows);

  // Three long banners hung down the front face.
  for (const x of [-15, 0, 15]) {
    const top = crownY - 6;
    const b = createBanner('hanging', 9, 70, x * 0.2);
    b.position.set(x * (halfAt(top) / 22), top, halfAt(top - 35) + 1.2);
    g.add(b);
  }
  return outer;
}

/** Display scale of the Keep model (its full-size crown beacon sits at about 281 units). */
export const KEEP_SCALE = 0.48;

/**
 * Leto II's Citadel in the Sareer: the one stretch of open desert he kept on a green Arrakis, walled
 * in, with his windowless fortress at its heart. The wall follows the dunes, so it is fitted to
 * the ground once the piece has been placed (`fit`).
 */
export class SareerCitadel {
  readonly group = new THREE.Group();
  /** Radius of the walled Sareer; the terrain is kept as desert inside it. */
  static readonly RADIUS = 185;
  private readonly wall: THREE.InstancedMesh;
  private readonly towers: THREE.InstancedMesh;
  private readonly wallAngles: number[] = [];
  private readonly towerAngles: number[] = [];

  constructor() {
    const R = SareerCitadel.RADIUS;
    const stone = new THREE.MeshStandardMaterial({ color: '#8a6a4e', roughness: 0.95, flatShading: true });
    const dark = new THREE.MeshStandardMaterial({ color: '#4a3a2f', roughness: 0.9, flatShading: true });

    // The high wall around the Sareer: segments and towers, placed by fit().
    const SEG = 96;
    const segLen = ((2 * Math.PI * R) / SEG) * 1.08;
    // A wall, not a cliff: about 16 units above the sand, footings sunk 10 below it.
    this.wall = new THREE.InstancedMesh(new THREE.BoxGeometry(segLen, 26, 5).translate(0, 3, 0), stone, SEG);
    for (let i = 0; i < SEG; i++) this.wallAngles.push((i / SEG) * Math.PI * 2);
    this.towers = new THREE.InstancedMesh(new THREE.BoxGeometry(10, 36, 10).translate(0, 8, 0), stone, 12);
    for (let i = 0; i < 12; i++) this.towerAngles.push((i / 12) * Math.PI * 2 + Math.PI / 12);
    this.wall.frustumCulled = false;
    this.towers.frustumCulled = false;
    this.group.add(this.wall, this.towers);

    // The Citadel: a stepped mass, a tall windowless tower with a pyramid cap, four pylons.
    const citadel = new THREE.Group();
    const tiers: [number, number, number, number][] = [
      [112, 92, -8, 30],
      [84, 66, 22, 26],
      [60, 50, 48, 24],
    ];
    for (const [b, t, y, h] of tiers) citadel.add(new THREE.Mesh(frustum(b, t, h).translate(0, y, 0), dark));
    const towerBase = 72;
    const towerH = 210;
    citadel.add(
      new THREE.Mesh(frustum(30, 22, towerH).translate(0, towerBase, 0), stone),
      new THREE.Mesh(new THREE.ConeGeometry(17, 36, 4).rotateY(Math.PI / 4).translate(0, towerBase + towerH + 18, 0), dark),
    );
    for (const [x, z] of [
      [-48, -48],
      [48, -48],
      [-48, 48],
      [48, 48],
    ]) {
      citadel.add(new THREE.Mesh(frustum(9, 6, 78).translate(x, -6, z), stone));
    }
    // A handful of high apertures, the only light the fortress shows.
    const lights = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 6, 2), glow('#ffb35c', 2.3), 8);
    const m = new THREE.Matrix4();
    let n = 0;
    for (const y of [258, 270]) {
      // Half-width of the tapering tower at this height, plus a hair so the light sits proud.
      const h = (30 - ((y - towerBase) / towerH) * 8) / 2 + 0.4;
      for (const [x, z] of [
        [0, h],
        [h, 0],
        [-h, 0],
        [0, -h],
      ]) {
        lights.setMatrixAt(n++, m.makeTranslation(x, y, z));
      }
    }
    citadel.add(lights);
    // Shown at 70%: still far the tallest thing on Leto's Arrakis, but it fits the frame.
    citadel.scale.setScalar(0.7);
    this.group.add(citadel);
  }

  /** Set every wall segment and tower on the dunes beneath it, given where the piece now stands. */
  fit(center: THREE.Vector3, quat: THREE.Quaternion): void {
    const R = SareerCitadel.RADIUS;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const local = new THREE.Vector3();
    const world = new THREE.Vector3();
    const place = (mesh: THREE.InstancedMesh, angles: number[], r: number) => {
      angles.forEach((a, i) => {
        local.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        world.copy(local).applyQuaternion(quat).add(center);
        local.y = duneHeight(world.x, world.z) - center.y;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a + Math.PI / 2);
        mesh.setMatrixAt(i, m.compose(local, q, new THREE.Vector3(1, 1, 1)));
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    place(this.wall, this.wallAngles, R);
    place(this.towers, this.towerAngles, R);
  }
}
