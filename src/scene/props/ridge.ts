import * as THREE from 'three';
import { fbm } from '../noise';

export interface RidgeOptions {
  length: number;
  depth: number;
  /** A breach: crest height falls to rubble within `gap` of x = 0, and the rock there is scorched. */
  gap?: number;
}

export const ROCK = new THREE.Color('#5e4031');
export const SCORCHED = new THREE.Color('#1c1411');
/** How far the footings are sunk below the sand. */
const SINK = 24;

/** Height of a ridge's surface at local (x, z), and how scorched it is there (0..1). */
export function ridgeAt(x: number, z: number, { length, depth, gap = 0 }: RidgeOptions): { y: number; burn: number } {
  const across = Math.max(1 - Math.pow(z / (depth / 2), 2), 0);
  const crest = 60 + 50 * fbm(x * 0.008 + 3, 1.7, 4);
  const crag = fbm(x * 0.05, z * 0.05, 3) * 20;
  const fade = 1 - Math.pow(Math.min(Math.abs(x) / (length / 2), 1), 4);
  let h = across ** 0.75 * (crest + crag) * fade;
  let burn = 0;
  if (gap > 0) {
    // The blast cut a notch down to a rubble floor, with blackened rock on its flanks.
    const open = THREE.MathUtils.smoothstep(Math.abs(x), gap * 0.5, gap * 1.25);
    h = h * open + (1 - open) * across * (8 + crag * 0.4);
    burn = 1 - THREE.MathUtils.smoothstep(Math.abs(x), gap * 0.6, gap * 2);
  }
  return { y: h - SINK, burn };
}

/** Darkens rock toward scorched by a per-vertex `aBurn` times `uBurn`, so a blast can spread it. */
function scorchable(mat: THREE.MeshStandardMaterial, burn: { value: number }, strength: number): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uBurn = burn;
    shader.uniforms.uScorched = { value: SCORCHED };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aBurn;\nvarying float vBurn;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBurn = aBurn;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uBurn;\nuniform vec3 uScorched;\nvarying float vBurn;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uScorched, vBurn * ${strength.toFixed(2)} * uBurn);`,
      );
  };
}

/**
 * The Shield Wall: a broken rock range that keeps the worst storms off Arrakeen. Long axis on
 * local X, centred on the origin, footings sunk well below the sand. With `burn`, the scorching
 * round a breach follows that uniform instead of being there from the start.
 */
export function buildRidge(opts: RidgeOptions, burn?: { value: number }): THREE.Mesh {
  const { length, depth } = opts;
  const ridge = new THREE.PlaneGeometry(length, depth, Math.round(length / 4), 26).rotateX(-Math.PI / 2);
  const p = ridge.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(p.count * 3);
  const burns = new Float32Array(p.count);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const at = ridgeAt(p.getX(i), p.getZ(i), opts);
    p.setY(i, at.y);
    burns[i] = at.burn;
    c.copy(ROCK).lerp(SCORCHED, burn ? 0 : at.burn * 0.85).toArray(colors, i * 3);
  }
  ridge.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  ridge.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  if (burn) {
    ridge.setAttribute('aBurn', new THREE.BufferAttribute(burns, 1));
    scorchable(mat, burn, 0.85);
  }
  return new THREE.Mesh(ridge, mat);
}

/**
 * The rock a breach removes, standing in it until `collapse` brings it down: the intact ridge's
 * surface over the notch, which slumps vertex by vertex onto the notch's rubble floor, from the
 * middle outward and unevenly, the way a wall falls. `collapse` runs 0 (standing) to 1.5 (down).
 */
export function buildPlug(opts: RidgeOptions, collapse: { value: number }, burn: { value: number }): THREE.Mesh {
  const gap = opts.gap ?? 0;
  const width = gap * 2.5 + 16;
  const geo = new THREE.PlaneGeometry(width, opts.depth, Math.round(width / 4), 26).rotateX(-Math.PI / 2);
  const p = geo.attributes.position as THREE.BufferAttribute;
  const rest = new Float32Array(p.count);
  const delay = new Float32Array(p.count);
  const burns = new Float32Array(p.count);
  const intact = { ...opts, gap: 0 };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    // A hair above the ridge where the two coincide, at the edges of the notch, so they never fight.
    p.setY(i, ridgeAt(x, z, intact).y + 0.35);
    const floor = ridgeAt(x, z, opts);
    rest[i] = floor.y - 1;
    burns[i] = Math.max(floor.burn, 0.5);
    delay[i] = THREE.MathUtils.clamp((Math.abs(x) / (width / 2)) * 0.6 + fbm(x * 0.06 + 9, z * 0.06, 2) * 0.4, 0, 1);
  }
  geo.setAttribute('aRest', new THREE.BufferAttribute(rest, 1));
  geo.setAttribute('aDelay', new THREE.BufferAttribute(delay, 1));
  geo.setAttribute('aBurn', new THREE.BufferAttribute(burns, 1));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: ROCK, roughness: 1, flatShading: true });
  scorchable(mat, burn, 0.6);
  const scorch = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    scorch(shader, renderer);
    shader.uniforms.uCollapse = collapse;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aRest;\nattribute float aDelay;\nuniform float uCollapse;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        // Each patch of rock lets go in turn and falls faster as it goes.
        float fall = clamp((uCollapse - aDelay) / 0.45, 0.0, 1.0);
        transformed.y = mix(transformed.y, aRest, fall * fall);`,
      );
  };
  return new THREE.Mesh(geo, mat);
}
