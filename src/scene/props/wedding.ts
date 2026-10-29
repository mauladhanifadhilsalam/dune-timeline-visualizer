import * as THREE from 'three';
import { Procession } from './procession';
import { wormBodyAssets } from './sandworm';

const cartMat = new THREE.MeshStandardMaterial({ color: '#8a7448', metalness: 0.55, roughness: 0.4 });
const trimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd28a').multiplyScalar(1.6) });

/**
 * Leto II's Royal Cart: an Ixian cart borne on suspensors a little above the road, carrying the God
 * Emperor's pre-worm body, a long ringed mass with the human face at its front.
 */
function buildRoyalCart(): THREE.Group {
  const outer = new THREE.Group();
  // Larger than life, like everything here, so it reads at the head of the file.
  const g = new THREE.Group();
  g.scale.setScalar(1.5);
  outer.add(g);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(9, 1.6, 24), cartMat);
  bed.position.y = 2.6;
  const rail = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.4, 24.4), trimMat);
  rail.position.y = 3.5;
  g.add(bed, rail);
  // His body: ring segments lying along the bed, thickest in the middle, raised at the front.
  const { segment, material } = wormBodyAssets();
  const body = new THREE.InstancedMesh(segment, material, 7);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const c = new THREE.Color();
  for (let i = 0; i < 7; i++) {
    const r = 3.3 * Math.sin(((i + 0.8) / 7.6) * Math.PI);
    const z = 8 - i * 3.1;
    m.compose(new THREE.Vector3(0, 4.2 + r * 0.8 + (i === 0 ? 1.5 : 0), z), q, new THREE.Vector3(r, r * 0.85, 3.4));
    body.setMatrixAt(i, m);
    body.setColorAt(i, c.set('#9c8a74').offsetHSL(0, 0, i % 2 ? -0.04 : 0.02));
  }
  g.add(body);
  return outer;
}

/**
 * The road, in the piece's frame: across the view from the right and away to the left, where the
 * river's upper reach lies far back, so the file has open ground to walk.
 */
export const WEDDING_ROAD: [number, number][] = [
  [110, -5],
  [35, -30],
  [-40, -65],
  [-110, -105],
];

/**
 * The wedding procession of Leto II and Hwi Noree, in God Emperor of Dune: the Royal Cart at its
 * head and a file of Fish Speakers, his women soldiers, behind, setting out from the Citadel for
 * Tuono village, the road taking it over the Idaho River's bridge, where it will be ambushed.
 * Ground-following, so it needs the piece's placement (`fit`).
 */
export class WeddingProcession {
  readonly group = new THREE.Group();
  private readonly file = new Procession({
    count: 18,
    spacing: 8,
    scale: 5.5,
    cloak: '#3f3a48',
    route: WEDDING_ROAD,
    duration: 45,
    leader: { object: buildRoyalCart(), ahead: 26 },
  });

  constructor() {
    this.group.add(this.file.group);
  }

  fit(center: THREE.Vector3, quat: THREE.Quaternion): void {
    this.file.fit(center, quat);
  }

  update(time: number): void {
    if (!this.group.visible) return;
    this.file.update(time);
  }
}
