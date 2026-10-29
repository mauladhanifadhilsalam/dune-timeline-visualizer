import * as THREE from 'three';

type FigureParts = { robe: THREE.BufferGeometry; head: THREE.BufferGeometry; hood: THREE.BufferGeometry };
let geo: FigureParts | null = null;

/** The figure's parts, for drawing many of them as instances: robe and hood in cloth, head in skin. */
export function figureGeometry(): FigureParts {
  geo ??= {
    // A long cloak, wider at the hem.
    robe: new THREE.CylinderGeometry(0.11, 0.22, 0.78, 10).translate(0, 0.39, 0),
    head: new THREE.SphereGeometry(0.085, 10, 8).translate(0, 0.86, 0),
    // Hood: a cone tipped back over the head.
    hood: new THREE.ConeGeometry(0.12, 0.2, 10).rotateX(-0.35).translate(0, 0.92, -0.02),
  };
  return geo;
}

export const SKIN = '#8a6a52';

/**
 * A robed figure in a stillsuit and cloak, about 1 unit tall before scaling, feet at y = 0, facing
 * +Z. People are specks beside a sandworm, so callers scale this up well past life size: it is
 * a marker for "someone is here", not a portrait.
 */
export function buildFigure(cloak = '#3a2c22'): THREE.Group {
  const parts = figureGeometry();
  const cloth = new THREE.MeshStandardMaterial({ color: cloak, roughness: 0.95 });
  const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.8 });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(parts.robe, cloth), new THREE.Mesh(parts.head, skin), new THREE.Mesh(parts.hood, cloth));
  return g;
}
