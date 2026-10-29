import * as THREE from 'three';
import { haloTexture } from '../halo';
import { Procession } from './procession';
import { FOOT, buildOutcrops, outcropRadius, type Outcrop } from './rocks';

const ROCK: Outcrop = { x: 0, z: 0, r: 72, height: 40, kind: 'mesa', angle: 0, seed: 7.3 };
/** The piece's origin sits on the sand; the rock's foot goes below it. */
const SAND = -2;

/**
 * The cleft stands on the talus where it meets the sand, so it lies on the rock rather than
 * floating off it: this is where, in the sietch's frame.
 */
export const SIETCH_MOUTH = (() => {
  const yFrac = FOOT / (ROCK.height + FOOT);
  return { x: outcropRadius(ROCK, 0, yFrac) + yFrac * ROCK.height * 0.04 + 0.5, y: SAND, z: 0 };
})();

/**
 * A sietch: a Fremen cave-warren in a rock outcrop. Its mouth is a dark cleft at the foot with the
 * glow of glowglobes deep inside, and a band of Fremen comes in off the sand in file, in the
 * sandwalk. Local frame as other pieces; the mouth faces +X, where the band comes from.
 */
export class Sietch {
  readonly group = new THREE.Group();
  readonly band: Procession;

  constructor() {
    this.group.add(buildOutcrops([ROCK], () => SAND));
    // The cleft leans back with the slope.
    const face = SIETCH_MOUTH.x - 0.5;
    const mouth = new THREE.Mesh(
      new THREE.CircleGeometry(9, 20, 0, Math.PI).scale(1, 1.5, 1).rotateX(-0.49).rotateY(Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#0b0806', side: THREE.DoubleSide }),
    );
    mouth.position.set(face + 0.5, SAND, 0);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: haloTexture(),
        color: new THREE.Color('#ffb36a').multiplyScalar(1.4),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    glow.position.set(face + 1.2, SAND + 5, 0);
    glow.scale.setScalar(16);
    this.group.add(mouth, glow);

    this.band = new Procession({
      count: 8,
      spacing: 9,
      scale: 5,
      cloak: '#3b2d22',
      route: [
        [face + 210, 95],
        [face + 140, 50],
        [face + 70, 14],
        [face + 3, 0],
      ],
      duration: 55,
      sandwalk: true,
    });
    this.group.add(this.band.group);
  }

  fit(center: THREE.Vector3, quat: THREE.Quaternion): void {
    this.band.fit(center, quat);
  }

  update(time: number): void {
    if (!this.group.visible) return;
    this.band.update(time);
  }
}
