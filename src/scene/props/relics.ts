import * as THREE from 'three';
import { rng } from '../noise';

/**
 * A crysknife rising from the dune like the worm's tooth it was made from: milky, curved, tip to
 * the sky, its bound grip half buried. About 60 units tall.
 */
export function buildCrysknife(): THREE.Group {
  const g = new THREE.Group();
  // Blade outline in XY: base (at the guard) on y = 0, curving to a tip at y = 64.
  const s = new THREE.Shape();
  s.moveTo(-3.8, 0);
  s.bezierCurveTo(-3.6, 24, 0.5, 46, 10, 64);
  s.bezierCurveTo(4.6, 44, 4.2, 22, 3.8, 0);
  s.lineTo(-3.8, 0);
  const blade = new THREE.ExtrudeGeometry(s, {
    depth: 0.4,
    bevelEnabled: true,
    bevelThickness: 1.2,
    bevelSize: 1.1,
    bevelSegments: 4,
    curveSegments: 32,
  });
  blade.translate(0, 0, -0.2);
  const bladeMat = new THREE.MeshStandardMaterial({
    color: '#efe8da',
    emissive: '#fff0d4',
    emissiveIntensity: 0.22,
    roughness: 0.25,
    metalness: 0.05,
  });
  const leather = new THREE.MeshStandardMaterial({ color: '#3a2a20', roughness: 0.7 });
  const guard = new THREE.Mesh(new THREE.CylinderGeometry(6.6, 6.6, 2, 24).rotateZ(Math.PI / 2).scale(1, 1, 0.45), leather);
  guard.position.y = -1;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.1, 14, 14), new THREE.MeshStandardMaterial({ color: '#4a3324', roughness: 0.9 }));
  grip.position.y = -9;
  const wrapMat = new THREE.MeshStandardMaterial({ color: '#8f6a43', roughness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.35, 6, 20).rotateX(Math.PI / 2), wrapMat);
    r.position.y = -4 - i * 3.5;
    g.add(r);
  }
  g.add(new THREE.Mesh(blade, bladeMat), guard, grip);
  // Guard just clear of the sand, grip half buried, a slight lean as if driven in. (The outer
  // group's own transform belongs to whoever places it.)
  g.position.y = 3.4;
  g.rotation.z = -0.1;
  g.scale.setScalar(0.85);
  const holder = new THREE.Group();
  holder.add(g);
  return holder;
}

/**
 * Thinking-machine wreckage from the Butlerian Jihad: dead mechanical heads half sunk in the
 * sand, eyes still faintly red, and toppled pylons.
 */
export function buildWreckage(): THREE.Group {
  const g = new THREE.Group();
  const rand = rng(201);
  const hull = new THREE.MeshStandardMaterial({ color: '#2f2c33', metalness: 0.75, roughness: 0.55, flatShading: true });
  const eye = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3a2a').multiplyScalar(2.2) });
  const head = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 6; i++) {
    const r = 14 + rand() * 12;
    const h = new THREE.Mesh(head, hull);
    h.scale.set(r, r * (0.8 + rand() * 0.3), r);
    h.position.set(-140 + i * 56 + (rand() - 0.5) * 30, -r * 0.35, -(rand() * 80));
    h.rotation.set(rand() * 0.6, rand() * Math.PI * 2, rand() * 0.6);
    // Two eyes on the face that happens to point at the viewer.
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), eye);
      e.position.set(s * 0.32, 0.18, 0.9);
      h.add(e);
    }
    g.add(h);
  }
  const pylon = new THREE.BoxGeometry(5, 60, 5);
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(pylon, hull);
    p.position.set(-110 + i * 75, 4, -30 - rand() * 60);
    p.rotation.set((rand() - 0.5) * 0.4, rand() * Math.PI, 0.9 + rand() * 0.5);
    g.add(p);
  }
  return g;
}
