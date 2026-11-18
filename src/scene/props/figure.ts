import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type FigureParts = { robe: THREE.BufferGeometry; head: THREE.BufferGeometry; hood: THREE.BufferGeometry };
let geo: FigureParts | null = null;

/**
 * The figure's parts, for drawing many of them as instances: robe and hood in cloth, head in skin.
 * Shaped for a silhouette that reads as a person even a few dozen pixels tall: a cloak flaring to
 * the hem, square shoulders, arms hanging at the sides, and a face showing under a cowl that falls
 * behind the head rather than a hood that hides it.
 */
export function figureGeometry(): FigureParts {
  if (geo) return geo;
  // The cloak, turned on a lathe from its outline: hem, waist, chest, shoulders, neck.
  const outline = [
    [0, 0],
    [0.21, 0],
    [0.17, 0.22],
    [0.13, 0.46],
    [0.14, 0.6],
    [0.17, 0.69],
    [0.15, 0.74],
    [0.07, 0.775],
    [0, 0.78],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.LatheGeometry(outline, 12);
  // Arms, hanging from the shoulders and a little out from the body, sleeves wider at the cuff.
  const arm = (side: number) =>
    new THREE.CylinderGeometry(0.034, 0.046, 0.36, 6)
      .translate(0, -0.18, 0)
      .rotateZ(side * 0.16)
      .translate(side * 0.165, 0.71, 0.01);
  const robe = mergeGeometries([body, arm(1), arm(-1)].map((g) => g.toNonIndexed()));
  robe.computeVertexNormals();
  geo = {
    robe,
    // The head, a little forward of the neck, so the face shows from in front and the side.
    head: new THREE.SphereGeometry(0.078, 12, 9).scale(0.92, 1.05, 0.95).translate(0, 0.87, 0.012),
    // The cowl: a shell over the crown and the back of the head, open at the face, falling to the
    // shoulders behind.
    hood: mergeGeometries(
      [
        new THREE.SphereGeometry(0.098, 12, 8, Math.PI * 0.18, Math.PI * 1.64, 0, Math.PI * 0.62).translate(0, 0.875, -0.004),
        new THREE.CylinderGeometry(0.075, 0.12, 0.12, 10, 1, true, Math.PI * 0.3, Math.PI * 1.4).translate(0, 0.79, -0.012),
      ].map((g) => g.toNonIndexed()),
    ),
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
