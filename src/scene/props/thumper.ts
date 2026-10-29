import * as THREE from 'three';
import type { Particles } from './particles';

/** Seconds between strokes: a slow, regular drumming a worm can feel from far off. */
const BEAT = 1.1;
const RINGS = 6;

/**
 * A thumper: the Fremen stake with a spring-driven clapper that drums on the sand to call a
 * maker. Drawn several times life size. Each stroke sends a ring across the sand and kicks up a
 * puff. It sits on its own small pad so the rings lie flat.
 */
export class Thumper {
  readonly group = new THREE.Group();
  private readonly piston: THREE.Mesh;
  private readonly rings: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; born: number }[] = [];
  private readonly tmp = new THREE.Vector3();
  private lastBeat = -1;

  constructor() {
    const metal = new THREE.MeshStandardMaterial({ color: '#4d4740', metalness: 0.6, roughness: 0.45 });
    // A third of the stake is driven into the sand.
    const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 12, 10).translate(0, 2, 0), metal);
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 3, 12).translate(0, 8.5, 0), metal);
    this.piston = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.4, 12), new THREE.MeshStandardMaterial({ color: '#7a6b5a', metalness: 0.7, roughness: 0.35 }));
    this.piston.position.y = 11;
    this.group.add(stake, housing, this.piston);

    const ringGeo = new THREE.RingGeometry(0.93, 1, 64).rotateX(-Math.PI / 2);
    for (let i = 0; i < RINGS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: '#e8b57a',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.position.y = 0.4;
      mesh.visible = false;
      this.rings.push({ mesh, mat, born: -1e9 });
      this.group.add(mesh);
    }
  }

  update(time: number, dust: Particles): void {
    if (!this.group.visible) return;
    const u = (time % BEAT) / BEAT;
    // Clapper lifts slowly, drops hard.
    this.piston.position.y = 11 + (u < 0.85 ? (u / 0.85) * 2.2 : 2.2 * (1 - (u - 0.85) / 0.15));
    const beat = Math.floor(time / BEAT);
    if (beat !== this.lastBeat) {
      this.lastBeat = beat;
      const ring = this.rings[beat % RINGS];
      ring.born = time;
      this.group.localToWorld(this.tmp.set(0, 1, 0));
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        dust.emit(this.tmp.x + Math.cos(a) * 2, this.tmp.y, this.tmp.z + Math.sin(a) * 2, Math.cos(a) * 9, 3 + Math.random() * 4, Math.sin(a) * 9, 1.6, 7 + Math.random() * 6);
      }
    }
    for (const r of this.rings) {
      const age = time - r.born;
      const life = 3.2;
      r.mesh.visible = age < life;
      if (!r.mesh.visible) continue;
      const k = age / life;
      r.mesh.scale.setScalar(3 + 42 * k);
      r.mat.opacity = 0.55 * (1 - k);
    }
  }
}
