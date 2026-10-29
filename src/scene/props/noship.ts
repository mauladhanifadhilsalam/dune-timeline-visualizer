import * as THREE from 'three';

const hullMat = new THREE.MeshStandardMaterial({ color: '#1f2228', metalness: 0.65, roughness: 0.35 });
const strutMat = new THREE.MeshStandardMaterial({ color: '#2b2d31', metalness: 0.5, roughness: 0.5 });
const portMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe2b0').multiplyScalar(1.6) });

/**
 * The no-ship on Chapterhouse's landing field: a vessel no prescience can see, though eyes can.
 * Duncan Idaho and Sheeana are kept aboard it, and in it they escape at the end of Chapterhouse:
 * Dune. A long dark hull on landing struts, a lowered ramp, a few lit ports, and the faint
 * shimmer of the field that hides it from the mind's eye. Local frame as other pieces.
 */
export class NoShip {
  readonly group = new THREE.Group();
  private readonly field: THREE.MeshBasicMaterial;

  constructor() {
    // A long hull, blunt astern and drawn to a point at the bow (+X), a little flattened.
    const profile = [
      [0, -88],
      [16, -86],
      [27, -70],
      [31, -40],
      [31, 0],
      [28, 36],
      [21, 64],
      [11, 84],
      [0, 96],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const hullGeo = new THREE.LatheGeometry(profile, 32).rotateZ(-Math.PI / 2).scale(1, 0.78, 1);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = 30;
    const spine = new THREE.Mesh(new THREE.BoxGeometry(120, 5, 8), hullMat);
    spine.position.set(-6, 53, 0);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(26, 18, 2.5), hullMat);
    fin.position.set(-70, 60, 0);
    this.group.add(hull, spine, fin);
    for (const [x, z] of [
      [-52, -18],
      [-52, 18],
      [0, -24],
      [0, 24],
      [52, -18],
      [52, 18],
    ]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 16, 8), strutMat);
      strut.position.set(x, 4, z);
      this.group.add(strut);
    }
    // A ramp let down from its flank, lit at the door.
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(12, 1.2, 34), strutMat);
    ramp.position.set(20, 9, 40);
    ramp.rotation.x = 0.42;
    const door = new THREE.Mesh(new THREE.PlaneGeometry(10, 7), portMat);
    door.position.set(20, 19, 30.5);
    door.rotation.x = -0.25;
    this.group.add(ramp, door);
    // Ports along the flanks.
    const ports = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 1, 0.6), portMat, 36);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 36; i++) {
      const side = i < 18 ? 1 : -1;
      const x = ((i % 18) / 17) * 110 - 60;
      // On the flank, just above the widest line of the hull at this point along it.
      const r = 31 * Math.sqrt(Math.max(1 - (Math.max(x, 0) / 96) ** 2, 0.05));
      ports.setMatrixAt(i, m.makeTranslation(x, 33, side * r * 0.99));
    }
    this.group.add(ports);
    // The no-field: a faint shell that wavers.
    this.field = new THREE.MeshBasicMaterial({
      color: '#9cc4ff',
      transparent: true,
      opacity: 0.05,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const shell = new THREE.Mesh(hullGeo.clone().scale(1.04, 1.06, 1.06), this.field);
    shell.position.y = 30;
    this.group.add(shell);
  }

  update(time: number): void {
    if (!this.group.visible) return;
    this.field.opacity = 0.02 + 0.025 * (0.5 + 0.5 * Math.sin(time * 1.7) * Math.sin(time * 0.53));
  }
}
