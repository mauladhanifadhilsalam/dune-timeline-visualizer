import * as THREE from 'three';
import type { Particles } from './particles';

const metal = new THREE.MeshStandardMaterial({ color: '#625548', metalness: 0.5, roughness: 0.62 });
const dark = new THREE.MeshStandardMaterial({ color: '#2e2824', metalness: 0.3, roughness: 0.8 });
const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc46e').multiplyScalar(2.2) });

/**
 * A spice harvester (crawler) working a spice field, with the carryall that will lift it clear
 * when a worm comes. Local frame: the crawler circles the origin; the field is the flattened pad.
 */
export class Harvester {
  readonly group = new THREE.Group();
  private readonly crawler = new THREE.Group();
  private readonly carryall = new THREE.Group();
  private readonly stack = new THREE.Object3D();
  private readonly scoop = new THREE.Object3D();
  private readonly tmp = new THREE.Vector3();
  private dustDebt = 0;
  /** Radius of the crawler's circuit; the catalog's pad is sized to hold it. */
  static readonly ORBIT = 40;

  constructor() {
    const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      return mesh;
    };
    // Nose along +X. Low and wide, like a dredge on treads: four track units, a long hull with a
    // raised spine of machinery, a forward cab, an intake scoop at the bow and a stack astern.
    for (const x of [-15, 15]) {
      for (const z of [-12, 12]) this.crawler.add(box(17, 6, 7, dark, x, 3, z));
    }
    this.crawler.add(
      box(52, 7, 22, metal, 0, 9, 0),
      box(30, 5, 12, metal, -6, 15, 0),
      box(9, 6, 14, metal, 18, 15, 0),
      box(7, 3, 24, dark, 28, 4, 0),
    );
    const stackMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 12, 10), dark);
    stackMesh.position.set(-20, 21, 5);
    this.crawler.add(stackMesh);
    this.stack.position.set(-20, 27, 5);
    this.scoop.position.set(31, 1, 0);
    this.crawler.add(this.stack, this.scoop);
    for (const z of [-5, 0, 5]) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), lamp);
      l.position.set(22.6, 16.5, z);
      this.crawler.add(l);
    }
    this.group.add(this.crawler);

    // Carryall: a broad lifting wing with four engine pods, holding station overhead.
    this.carryall.add(box(34, 3, 26, metal), box(10, 4, 8, dark, 0, -3, 0));
    const pod = new THREE.CylinderGeometry(3, 3.4, 5, 12);
    const jet = new THREE.MeshBasicMaterial({ color: new THREE.Color('#9fd0ff').multiplyScalar(1.8) });
    for (const [x, z] of [
      [13, 12],
      [13, -12],
      [-13, 12],
      [-13, -12],
    ]) {
      const p = new THREE.Mesh(pod, dark);
      p.position.set(x, 0, z);
      const j = new THREE.Mesh(new THREE.CircleGeometry(2.6, 12).rotateX(Math.PI / 2), jet);
      j.position.set(x, -2.6, z);
      this.carryall.add(p, j);
    }
    this.group.add(this.carryall);
  }

  update(time: number, dt: number, dust: Particles, spice: Particles): void {
    const R = Harvester.ORBIT;
    const a = time * 0.06;
    this.crawler.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
    // Heading along the circle (velocity direction), nose = +X.
    this.crawler.rotation.y = -a - Math.PI / 2;
    this.carryall.position.set(this.crawler.position.x * 0.6, 62 + Math.sin(time * 0.6) * 2, this.crawler.position.z * 0.6);
    this.carryall.rotation.y = this.crawler.rotation.y * 0.5;
    if (!this.group.visible) return;

    this.dustDebt += dt * 24;
    let n = 0;
    while (this.dustDebt >= 1) {
      this.dustDebt -= 1;
      n++;
      // Exhaust plume from the stack, and a low cloud of sand where the scoop bites.
      this.stack.getWorldPosition(this.tmp);
      dust.emit(this.tmp.x, this.tmp.y, this.tmp.z, (Math.random() - 0.5) * 3, 6 + Math.random() * 4, (Math.random() - 0.5) * 3, 4, 12 + Math.random() * 8);
      this.scoop.getWorldPosition(this.tmp);
      dust.emit(
        this.tmp.x + (Math.random() - 0.5) * 16,
        this.tmp.y + 1,
        this.tmp.z + (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 5,
        1.5 + Math.random() * 3,
        (Math.random() - 0.5) * 5,
        3,
        16 + Math.random() * 10,
      );
      // Now and then a glint of melange in the churned sand.
      if (n % 3 === 0) {
        spice.emit(
          this.tmp.x + (Math.random() - 0.5) * 14,
          this.tmp.y + 1,
          this.tmp.z + (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 3,
          2 + Math.random() * 3,
          (Math.random() - 0.5) * 3,
          2.2,
          2 + Math.random() * 2,
        );
      }
    }
  }
}
