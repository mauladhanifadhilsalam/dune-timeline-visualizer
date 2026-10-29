import * as THREE from 'three';

let geo: { robe: THREE.BufferGeometry; head: THREE.BufferGeometry; hood: THREE.BufferGeometry } | null = null;

/**
 * A robed figure in a stillsuit and cloak, about 1 unit tall before scaling, feet at y = 0, facing
 * +Z. People are specks beside a sandworm, so callers scale this up well past life size: it is
 * a marker for "someone is here", not a portrait.
 */
export function buildFigure(cloak = '#3a2c22'): THREE.Group {
  geo ??= {
    // A long cloak, wider at the hem.
    robe: new THREE.CylinderGeometry(0.11, 0.22, 0.78, 10).translate(0, 0.39, 0),
    head: new THREE.SphereGeometry(0.085, 10, 8).translate(0, 0.86, 0),
    // Hood: a cone tipped back over the head.
    hood: new THREE.ConeGeometry(0.12, 0.2, 10).rotateX(-0.35).translate(0, 0.92, -0.02),
  };
  const cloth = new THREE.MeshStandardMaterial({ color: cloak, roughness: 0.95 });
  const skin = new THREE.MeshStandardMaterial({ color: '#8a6a52', roughness: 0.8 });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo.robe, cloth), new THREE.Mesh(geo.head, skin), new THREE.Mesh(geo.hood, cloth));
  return g;
}
