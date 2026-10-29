import * as THREE from 'three';

const hullMat = () => new THREE.MeshStandardMaterial({ color: '#3b3641', metalness: 0.55, roughness: 0.48 });
// Lights ignore the haze, so a hull half lost in dusk still shows its outline of lamps.
const glow = (c: string, k: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), fog: false });

/**
 * A Guild heighliner: Herbert gives its scale (whole frigates ride in its hold) more than its
 * shape, so this is a plain banded hull, long axis on local X, with running lights and a Holtzman
 * drive glow astern.
 */
export class Heighliner {
  readonly group = new THREE.Group();
  private readonly ship = new THREE.Group();

  constructor() {
    const mat = hullMat();
    const L = 560;
    const R = 27;
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 56, 1, true).rotateZ(Math.PI / 2), mat);
    const capGeo = new THREE.SphereGeometry(R, 40, 20);
    const nose = new THREE.Mesh(capGeo, mat);
    nose.scale.set(0.42, 1, 1);
    nose.position.x = L / 2;
    const tail = new THREE.Mesh(capGeo, mat);
    tail.scale.set(0.18, 1, 1);
    tail.position.x = -L / 2;
    this.ship.add(hull, nose, tail);

    const band = new THREE.TorusGeometry(R + 1.4, 1.9, 8, 72).rotateY(Math.PI / 2);
    const bandMat = new THREE.MeshStandardMaterial({ color: '#4c4652', metalness: 0.6, roughness: 0.4 });
    for (let x = -L / 2 + 40; x <= L / 2 - 30; x += 56) {
      const b = new THREE.Mesh(band, bandMat);
      b.position.x = x;
      this.ship.add(b);
    }
    const spine = new THREE.Mesh(new THREE.BoxGeometry(L * 0.86, 7, 12), bandMat);
    spine.position.y = R + 1;
    this.ship.add(spine);

    // Running lights along both flanks: small and bright enough to catch the bloom.
    const lights = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), glow('#ffd59a', 2.4), 80);
    const m = new THREE.Matrix4();
    let i = 0;
    for (let x = -L / 2 + 16; x < L / 2 - 10 && i < 80; x += 14) {
      m.makeTranslation(x, -4, R + 0.6);
      lights.setMatrixAt(i++, m);
      m.makeTranslation(x, -4, -R - 0.6);
      lights.setMatrixAt(i++, m);
    }
    lights.count = i;
    this.ship.add(lights);

    const drive = new THREE.Mesh(new THREE.CircleGeometry(R * 0.72, 40).rotateY(-Math.PI / 2), glow('#9cc6ff', 1.9));
    drive.position.x = -L / 2 - R * 0.19;
    this.ship.add(drive);
    this.group.add(this.ship);
  }

  update(time: number): void {
    // A slow drift and roll: something this large barely seems to move.
    this.ship.position.x = Math.sin(time * 0.025) * 24;
    this.ship.rotation.x = Math.sin(time * 0.05) * 0.012;
  }
}

/**
 * The Emperor's camp on the plain before Arrakeen: frigates set down in a ring, lit, with his
 * metal hut at the centre. Herbert puts the Sardaukar fleet on the ground for the battle.
 */
/** The ring the Emperor's frigates stand on, about the camp's centre: semi-axes and count. */
export const CAMP_RING = { x: 62, z: 44, frigates: 7 };

export function buildImperialCamp(): THREE.Group {
  const g = new THREE.Group();
  const hullGeo = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  const fm = new THREE.MeshStandardMaterial({ color: '#4a434d', metalness: 0.55, roughness: 0.45 });
  const lamp = glow('#ffcf8a', 2.2);
  for (let k = 0; k < CAMP_RING.frigates; k++) {
    const a = (k / CAMP_RING.frigates) * Math.PI * 2;
    const f = new THREE.Group();
    const hullF = new THREE.Mesh(hullGeo, fm);
    hullF.scale.set(17, 11, 12);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 6, 40).rotateX(Math.PI / 2), lamp);
    ring.scale.set(17.2, 12.2, 12.2);
    ring.position.y = 0.6;
    f.add(hullF, ring);
    f.position.set(Math.cos(a) * CAMP_RING.x, -1, Math.sin(a) * CAMP_RING.z);
    f.rotation.y = -a;
    g.add(f);
  }
  const hut = new THREE.Mesh(new THREE.CylinderGeometry(9, 12, 10, 8), new THREE.MeshStandardMaterial({ color: '#6b6170', metalness: 0.6, roughness: 0.4 }));
  hut.position.y = 4;
  const crest = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), glow('#ffd36e', 2.6));
  crest.position.y = 10.5;
  g.add(hut, crest);
  return g;
}
