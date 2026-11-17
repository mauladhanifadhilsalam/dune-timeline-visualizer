import * as THREE from 'three';
import { wormBodyAssets } from './sandworm';

/** Rings in his body, and the length of each along it. */
const RINGS = 8;
const RING = 7;
/** How far apart the rings' centres are: a little less than a ring, so they overlap. */
const SPACING = 6.4;
/** His girth at its fullest, as a ring's radius. */
const GIRTH = 7.3;

/**
 * Leto II's pre-worm body in God Emperor of Dune, as rings from the face (the first) to the tail:
 * where each lies along the body and how thick it is. One definition for every scene that shows
 * him, so he is the same size riding the Royal Cart over the bridge as falling from it into the
 * river. In world units, drawn at the scale of the people around him: about four of the Fish
 * Speakers who walk behind the cart, end to end.
 */
export const LETO_BODY: readonly { along: number; r: number; len: number }[] = Array.from({ length: RINGS }, (_, i) => {
  const k = i / (RINGS - 1);
  // Fullest a quarter of the way back, a little narrower at the face, tapering to the tail.
  const r = k < 0.25 ? GIRTH * (0.82 + 0.18 * (k / 0.25)) : GIRTH * (1 - 0.55 * ((k - 0.25) / 0.75) ** 1.3);
  return { along: i * SPACING, r, len: RING };
});

/** His length from the front of the face to the tip of the tail. */
export const LETO_LENGTH = (RINGS - 1) * SPACING + RING;
/** His widest, side to side, at his fullest ring. */
export const LETO_WIDTH = 2 * Math.max(...LETO_BODY.map((b) => b.r));
/** Each ring is a little flatter than it is wide, as a body lying down. */
export const LETO_FLATTEN = 0.85;

/** His body's rings, one instance per ring, for the scene to lay where he is. */
export function buildLetoBody(): THREE.InstancedMesh {
  const { segment, material } = wormBodyAssets();
  const body = new THREE.InstancedMesh(segment, material, RINGS);
  const c = new THREE.Color();
  for (let i = 0; i < RINGS; i++) body.setColorAt(i, c.set('#a8957b').offsetHSL(0, 0, i % 2 ? -0.04 : 0.02));
  body.frustumCulled = false;
  return body;
}
