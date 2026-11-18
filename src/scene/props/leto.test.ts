import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LETO_LENGTH, LETO_WIDTH } from './leto';
import { DECK_WIDTH, IdahoRiver } from './river';
import { ROYAL_CART_WIDTH, WeddingProcession } from './wedding';

/** The size of a body drawn as an instanced mesh of rings: its length end to end, and its girth. */
function bodySize(mesh: THREE.InstancedMesh): { length: number; width: number } {
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const centres: THREE.Vector3[] = [];
  let width = 0;
  let first = 0;
  let last = 0;
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, m);
    m.decompose(p, q, s);
    centres.push(p.clone());
    width = Math.max(width, 2 * s.x);
    if (i === 0) first = s.z;
    last = s.z;
  }
  let length = first / 2 + last / 2;
  for (let i = 1; i < centres.length; i++) length += centres[i].distanceTo(centres[i - 1]);
  return { length, width };
}

/** The ringed body inside an object: the instanced mesh drawn with a worm's body segments. */
function findBody(root: THREE.Object3D): THREE.InstancedMesh {
  let found: THREE.InstancedMesh | null = null;
  root.traverse((o) => {
    if (o instanceof THREE.InstancedMesh && o.geometry.type === 'CylinderGeometry' && o.count >= 6) found ??= o;
  });
  if (!found) throw new Error('no body found');
  return found;
}

describe("Leto II's body", () => {
  it('is the same size on the Royal Cart as in the river below the bridge', () => {
    const river = new IdahoRiver();
    river.fit(new THREE.Vector3(0, 0, 0), new THREE.Quaternion());
    const wedding = new WeddingProcession({ route: () => river.roadRoute(), heightAt: () => 0 });
    const onCart = bodySize(findBody(wedding.group));
    const inRiver = bodySize(findBody(river.group));
    expect(onCart.length).toBeCloseTo(LETO_LENGTH, 0);
    expect(inRiver.length).toBeGreaterThan(LETO_LENGTH * 0.97);
    expect(inRiver.length).toBeLessThan(LETO_LENGTH * 1.05);
    expect(onCart.width).toBeCloseTo(LETO_WIDTH, 1);
    expect(inRiver.width).toBeCloseTo(onCart.width, 1);
  });

  it('rides a cart that fits on the bridge it crosses', () => {
    expect(ROYAL_CART_WIDTH).toBeLessThan(DECK_WIDTH);
    expect(LETO_WIDTH).toBeLessThan(ROYAL_CART_WIDTH);
  });
});
