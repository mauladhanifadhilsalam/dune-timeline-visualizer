import * as THREE from 'three';

let geo: { body: THREE.BufferGeometry; wing: THREE.BufferGeometry; boom: THREE.BufferGeometry } | null = null;
const mat = new THREE.MeshStandardMaterial({ color: '#4e4840', metalness: 0.45, roughness: 0.55 });
const wingMat = new THREE.MeshStandardMaterial({
  color: '#8d7f6b',
  metalness: 0.2,
  roughness: 0.6,
  transparent: true,
  opacity: 0.85,
  side: THREE.DoubleSide,
});
const beacon = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff5a4a').multiplyScalar(2) });

/**
 * An ornithopter, as the books have it: a craft that flies by beating its wings. Nose along +X.
 */
export class Thopter {
  readonly group = new THREE.Group();
  private readonly wings: THREE.Group[] = [];
  private readonly phase = Math.random() * 10;

  constructor() {
    if (!geo) {
      geo = {
        body: new THREE.SphereGeometry(1, 16, 10).scale(3.4, 1.05, 1.15),
        wing: new THREE.BoxGeometry(1.5, 0.12, 7.2).translate(0, 0, 3.6),
        boom: new THREE.CylinderGeometry(0.28, 0.12, 4.2, 6).rotateZ(Math.PI / 2).translate(-4.6, 0.2, 0),
      };
    }
    // Yaw first, then roll about the craft's own nose axis when banking.
    this.group.rotation.order = 'YXZ';
    const body = new THREE.Mesh(geo.body, mat);
    const boom = new THREE.Mesh(geo.boom, mat);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 4), beacon);
    light.position.set(-6.6, 0.4, 0);
    this.group.add(body, boom, light);
    // Two pairs of wings, hinged on the spine, one pair either side.
    for (const x of [1.1, -1.0]) {
      for (const s of [1, -1]) {
        const pivot = new THREE.Group();
        pivot.position.set(x, 0.9, 0);
        const w = new THREE.Mesh(geo.wing, wingMat);
        w.scale.z = s;
        pivot.add(w);
        pivot.userData.side = s;
        this.wings.push(pivot);
        this.group.add(pivot);
      }
    }
  }

  update(time: number): void {
    for (const w of this.wings) {
      const s = w.userData.side as number;
      w.rotation.x = s * (0.15 + 0.5 * Math.sin(time * 9 + this.phase));
    }
  }
}
