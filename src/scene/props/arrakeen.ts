import * as THREE from 'three';
import { rng } from '../noise';
import { buildRidge } from './ridge';
import { Thopter } from './thopter';

/**
 * Arrakeen at dusk: thick-walled, sloped blocks built against heat and sand, the Residency with
 * its dome at the centre, lit windows, ornithopters overhead, and the Shield Wall behind.
 * Local frame: X along the path, -Z away from the viewer. The group sits on a flattened pad.
 */
export class Arrakeen {
  readonly group = new THREE.Group();
  private readonly thopters: Thopter[] = [];

  constructor() {
    const rand = rng(10191);
    // Square frustum: a building whose walls lean in, as desert architecture does.
    const block = new THREE.CylinderGeometry(Math.SQRT1_2 * 0.82, Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0);
    const stone = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, metalness: 0, flatShading: true });
    const N = 120;
    const buildings = new THREE.InstancedMesh(block, stone, N);
    const windows = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.9, 0.6, 0.9),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc978').multiplyScalar(2.1) }),
      900,
    );
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const c = new THREE.Color();
    let b = 0;
    let w = 0;
    const place = (x: number, z: number, wdt: number, dep: number, h: number) => {
      if (b >= N) return;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rand() - 0.5) * 0.18);
      // Sunk 12 units so dune noise around the pad edge never shows a floating base.
      m.compose(v.set(x, -12, z), q, sc.set(wdt, h + 12, dep));
      buildings.setMatrixAt(b, m);
      c.set('#a0805f').offsetHSL((rand() - 0.5) * 0.03, -0.05 + rand() * 0.08, (rand() - 0.5) * 0.12);
      buildings.setColorAt(b, c);
      b++;
      // Windows on the two faces the viewer can see, in rows.
      const rows = Math.max(1, Math.floor(h / 5));
      for (let r = 0; r < rows && w < 900; r++) {
        if (rand() < 0.35) continue;
        const y = 3 + r * 4.6;
        const inset = 1 - (0.18 * y) / h; // walls lean in as they rise
        const fx = x + (rand() - 0.5) * wdt * 0.6 * inset;
        m.makeTranslation(fx, y, z + (dep / 2) * inset + 0.2);
        windows.setMatrixAt(w++, m);
        if (rand() < 0.5 && w < 900) {
          m.makeTranslation(x + (wdt / 2) * inset + 0.2, y, z + (rand() - 0.5) * dep * 0.6 * inset);
          windows.setMatrixAt(w++, m);
        }
      }
    };
    // Old town: dense, low, irregular.
    for (let i = 0; i < 95; i++) {
      const ang = rand() * Math.PI * 2;
      const r = 22 + Math.pow(rand(), 0.7) * 108;
      const x = Math.cos(ang) * r * 1.15;
      const z = Math.sin(ang) * r * 0.7;
      const big = rand() < 0.12;
      place(x, z, 9 + rand() * (big ? 26 : 14), 9 + rand() * (big ? 22 : 12), 6 + rand() * (big ? 30 : 14));
    }
    // A few tall guard towers.
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + rand() * 0.3;
      place(Math.cos(ang) * 120, Math.sin(ang) * 78, 7, 7, 30 + rand() * 18);
    }
    buildings.count = b;
    windows.count = w;
    buildings.instanceMatrix.needsUpdate = true;
    this.group.add(buildings, windows);

    // The Residency: the largest block, crowned with a dome.
    const residency = new THREE.Mesh(block, new THREE.MeshStandardMaterial({ color: '#b39272', roughness: 0.85, flatShading: true }));
    residency.scale.set(44, 34, 36);
    residency.position.y = -8;
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(14, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#c9a77e', roughness: 0.5, metalness: 0.2 }),
    );
    dome.position.y = 26;
    const beaconTop = new THREE.Mesh(
      new THREE.SphereGeometry(1.2, 8, 6),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffdca8').multiplyScalar(2.5) }),
    );
    beaconTop.position.y = 41;
    this.group.add(residency, dome, beaconTop);

    // The Shield Wall behind the city.
    const wall = buildRidge({ length: 560, depth: 130 });
    wall.position.z = -235;
    this.group.add(wall);

    for (let i = 0; i < 4; i++) {
      const t = new Thopter();
      t.group.userData.orbit = { r: 70 + i * 26, h: 38 + i * 9, speed: 0.12 + i * 0.03, phase: i * 1.7 };
      this.thopters.push(t);
      this.group.add(t.group);
    }
  }

  update(time: number): void {
    for (const t of this.thopters) {
      const o = t.group.userData.orbit as { r: number; h: number; speed: number; phase: number };
      const a = time * o.speed + o.phase;
      t.group.position.set(Math.cos(a) * o.r, o.h + Math.sin(time * 0.7 + o.phase) * 3, Math.sin(a) * o.r * 0.6);
      // Nose along the direction of flight (+X local), banked a little into the turn.
      t.group.rotation.set(0.18, -a - Math.PI / 2, 0);
      t.update(time);
    }
  }
}
