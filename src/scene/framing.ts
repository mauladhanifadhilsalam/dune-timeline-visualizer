import * as THREE from 'three';

/** The camera's vertical field of view, in degrees. */
export const FOV = 50;

const UP = new THREE.Vector3(0, 1, 0);

/**
 * How far back the camera stands from an event: far enough to see the neighbours on either side,
 * not just the one light. Portrait screens have a narrow horizontal view, so it steps back further.
 */
export function eventDistance(importance: number, aspect: number): number {
  return (58 + importance * 8) * (aspect < 1 ? Math.min(1 / aspect, 2) : 1);
}

/**
 * Where the camera first stands for an event: back across the path on its own side, near eye level
 * so the horizon and the sky (heighliner, Shield Wall) stay in frame, and a little behind, so it
 * looks slightly ahead along the path. `toCamera` points from the path to the camera's side.
 */
export function defaultEye(
  target: THREE.Vector3,
  toCamera: THREE.Vector3,
  tangent: THREE.Vector3,
  d: number,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  return out
    .copy(target)
    .addScaledVector(toCamera, d * 0.86)
    .addScaledVector(UP, d * 0.2)
    .addScaledVector(tangent, -d * 0.2);
}
