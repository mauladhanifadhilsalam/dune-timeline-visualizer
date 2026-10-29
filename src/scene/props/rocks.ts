import * as THREE from 'three';
import { fbm } from '../noise';

export type OutcropKind = 'mesa' | 'butte' | 'spine';

/** A rock formation standing on the sand, in world space. */
export interface Outcrop {
  x: number;
  z: number;
  /** Radius of its foot (for a spine, half its width; it runs 2.4 times as long). */
  r: number;
  height: number;
  kind: OutcropKind;
  /** Turn about the vertical, radians. */
  angle: number;
  seed: number;
}

const LOW = new THREE.Color('#7a4a32');
const BAND = new THREE.Color('#a06a45');
const CAP = new THREE.Color('#b9845a');

/** How much of the foot's radius is left at the top, by kind: flat mesas, narrower buttes, spines. */
const TOP: Record<OutcropKind, number> = { mesa: 0.62, butte: 0.42, spine: 0.25 };

/**
 * Distance from an outcrop's axis to its face, in its own unturned frame: at bearing `theta` and
 * height fraction `y` (0 at the foot, 1 at the top). Steep walls over a flaring talus slope,
 * broken into ledges, eroded unevenly round about.
 */
export function outcropRadius(o: Outcrop, theta: number, y: number): number {
  // A cliff over a talus apron: the wall holds to the top fraction, then flares out at the foot.
  const profile = TOP[o.kind] + (1 - TOP[o.kind]) * Math.pow(1 - y, 4);
  const ledge = 1 - 0.06 * (Math.floor(y * 5) % 2);
  // Broad bays and headlands, with ragged edges on top of them.
  const erode =
    1 + 0.4 * (fbm(theta * 2 + o.seed, y * 2 + o.seed * 0.7, 3) - 0.5) + 0.12 * (fbm(theta * 9 + o.seed, y * 6, 2) - 0.5);
  return o.r * profile * ledge * erode;
}

/** How far below the local sand an outcrop's foot is sunk, and how much taller that makes it. */
export const FOOT = 6;

/**
 * Rock formations of the open desert: mesas, buttes and long spines of stone, eroded and banded.
 * Rock outlasts every era of the saga, so these stand everywhere, always. All are built into one
 * mesh, one draw call for the whole landscape. `groundAt` is the sand height; each sinks its foot
 * a little below the lowest sand under it.
 */
export function buildOutcrops(outcrops: readonly Outcrop[], groundAt: (x: number, z: number) => number): THREE.Mesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  for (const o of outcrops) {
    const RADIAL = 28;
    const RINGS = 9;
    const geo = new THREE.CylinderGeometry(1, 1, 1, RADIAL, RINGS, false);
    const p = geo.attributes.position as THREE.BufferAttribute;
    let base = Infinity;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      base = Math.min(base, groundAt(o.x + Math.cos(a) * o.r, o.z + Math.sin(a) * o.r));
    }
    base = Math.min(base, groundAt(o.x, o.z)) - FOOT;
    const stretch = o.kind === 'spine' ? 2.4 : 1;
    const cos = Math.cos(o.angle);
    const sin = Math.sin(o.angle);
    const start = positions.length / 3;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) + 0.5; // 0 at the foot, 1 at the top
      const theta = Math.atan2(p.getZ(i), p.getX(i));
      const onAxis = Math.hypot(p.getX(i), p.getZ(i)) < 1e-6; // centre of a cap
      const rr = onAxis ? 0 : outcropRadius(o, theta, y);
      let lx = Math.cos(theta) * rr * stretch;
      const lz = Math.sin(theta) * rr;
      // Tops are all but flat, and the whole lean a little.
      const lift = y >= 1 ? (fbm(lx * 0.05 + o.seed, lz * 0.05, 2) - 0.5) * o.height * 0.03 : 0;
      lx += y * o.height * 0.04;
      // The crest rises and falls round about, so no outcrop has a level, sawn-off top. The centre
      // of the cap takes the average, so the top is a gentle dish, not a fan of sloping facets.
      const crest = onAxis ? 1 : 1 + 0.24 * (fbm(theta * 1.3 + o.seed * 1.7, o.seed, 2) - 0.5);
      v.set(lx * cos - lz * sin + o.x, base + y * (o.height * crest + FOOT) + lift, lx * sin + lz * cos + o.z);
      positions.push(v.x, v.y, v.z);
      // Strata: alternating bands up the walls, paler on top.
      const band = 0.5 + 0.5 * Math.sin(y * 19 + o.seed);
      c.copy(LOW).lerp(BAND, band * 0.8);
      if (y >= 1) c.copy(CAP);
      c.offsetHSL(0, 0, (fbm(theta * 3 + o.seed, y * 6, 2) - 0.5) * 0.06);
      colors.push(c.r, c.g, c.b);
    }
    const idx = geo.index!;
    for (let i = 0; i < idx.count; i++) indices.push(start + idx.getX(i));
    geo.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  mesh.name = 'outcrops';
  return mesh;
}
