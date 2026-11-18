import * as THREE from 'three';
import { Procession } from './procession';
import { LETO_BODY, LETO_FLATTEN, LETO_LENGTH, LETO_WIDTH, buildLetoBody } from './leto';

const cartMat = new THREE.MeshStandardMaterial({ color: '#8a7448', metalness: 0.55, roughness: 0.4 });
/** The Royal Cart's width: his body and a margin either side, narrower than the bridge it crosses. */
export const ROYAL_CART_WIDTH = LETO_WIDTH + 3;
const trimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd28a').multiplyScalar(1.6) });

/**
 * Leto II's Royal Cart: an Ixian cart borne on suspensors a little above the road, carrying the God
 * Emperor's pre-worm body, a long ringed mass with the human face at its front (+Z, the way it
 * goes). Built round his body, at its size, so the cart fits whatever size he is drawn.
 */
function buildRoyalCart(): THREE.Group {
  const g = new THREE.Group();
  const length = LETO_LENGTH + 4;
  const bedTop = 4;
  const bed = new THREE.Mesh(new THREE.BoxGeometry(ROYAL_CART_WIDTH, 2, length), cartMat);
  bed.position.y = bedTop - 1;
  const rail = new THREE.Mesh(new THREE.BoxGeometry(ROYAL_CART_WIDTH + 0.4, 0.5, length + 0.4), trimMat);
  rail.position.y = bedTop;
  g.add(bed, rail);
  // His body lying along the bed, the face raised a little at the front.
  const body = buildLetoBody();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  LETO_BODY.forEach(({ along, r, len }, i) => {
    const z = LETO_LENGTH / 2 - len / 2 - along;
    m.compose(new THREE.Vector3(0, bedTop + r * LETO_FLATTEN * 0.8 + (i === 0 ? 0.8 : 0), z), q, new THREE.Vector3(r, r * LETO_FLATTEN, len));
    body.setMatrixAt(i, m);
  });
  g.add(body);
  return g;
}

/**
 * The wedding procession of Leto II and Hwi Noree, in God Emperor of Dune: the Royal Cart at its
 * head and a file of Fish Speakers, his women soldiers, behind, on the Royal Road from his Citadel,
 * over the Idaho River's bridge, where it will be ambushed. Stands in the river's frame and walks its
 * road: up the ramp, across the deck and down the other side.
 */
export class WeddingProcession {
  readonly group = new THREE.Group();
  private readonly file: Procession;

  constructor(
    /** The road: its route, and the height of its surface at a point on it (river frame). */
    private readonly road: { route: () => [number, number][]; heightAt: (x: number, z: number) => number },
  ) {
    this.file = new Procession({
      count: 18,
      spacing: 8,
      scale: 5.5,
      cloak: '#3f3a48',
      route: [
        [0, 0],
        [1, 0],
      ],
      duration: 50,
      leader: { object: buildRoyalCart(), ahead: LETO_LENGTH / 2 + 8 },
      heightAt: road.heightAt,
    });
    this.group.add(this.file.group);
  }

  /** Once the river is placed: its road is the procession's route. */
  fit(center: THREE.Vector3, quat: THREE.Quaternion): void {
    this.file.setRoute(this.road.route());
    this.file.fit(center, quat);
  }

  update(time: number): void {
    if (!this.group.visible) return;
    this.file.update(time);
  }
}
