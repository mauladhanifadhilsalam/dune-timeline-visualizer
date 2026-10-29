import * as THREE from 'three';
import { haloTexture } from '../halo';
import type { Particles } from './particles';

/** A fire in a piece's frame: where it burns, how big, and how high its smoke climbs. */
export interface FireSpot {
  x: number;
  y: number;
  z: number;
  size: number;
}

let tex: THREE.CanvasTexture | null = null;

/**
 * Fires burning at fixed spots: a flickering glow at each, a column of dark smoke rising from it
 * and leaning downwind, and embers thrown up. Cheap: a sprite per fire, and particles from the
 * scene's shared systems.
 */
export class Fires {
  readonly group = new THREE.Group();
  private readonly glows: THREE.Sprite[] = [];
  private readonly tmp = new THREE.Vector3();
  private debt = 0;

  constructor(
    private readonly spots: FireSpot[],
    /** Smoke puffs per second, over all the fires. */
    private readonly rate = 24,
  ) {
    tex ??= haloTexture();
    const mat = new THREE.SpriteMaterial({
      map: tex,
      color: new THREE.Color('#ff7a26').multiplyScalar(1.7),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (const s of spots) {
      const g = new THREE.Sprite(mat);
      g.position.set(s.x, s.y, s.z);
      this.glows.push(g);
      this.group.add(g);
    }
  }

  update(time: number, dt: number, smoke: Particles, embers: Particles): void {
    if (!this.group.visible) return;
    this.spots.forEach((s, i) => this.glows[i].scale.setScalar(s.size * (1.6 + 0.25 * Math.sin(time * 7 + i * 1.9) + 0.15 * Math.sin(time * 19 + i))));
    this.debt += dt * this.rate;
    while (this.debt >= 1) {
      this.debt -= 1;
      const s = this.spots[Math.floor(Math.random() * this.spots.length)];
      const p = this.group.localToWorld(this.tmp.set(s.x + (Math.random() - 0.5) * s.size, s.y + s.size * 0.3, s.z + (Math.random() - 0.5) * s.size));
      // Smoke climbs and drifts with the wind (local +X, along the path, as the banners fly).
      smoke.emit(p.x, p.y, p.z, 2 + Math.random() * 3, 7 + Math.random() * 6, (Math.random() - 0.5) * 2, 7 + Math.random() * 5, s.size * (3.2 + Math.random() * 2.4));
      if (Math.random() < 0.5) embers.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 6, 8 + Math.random() * 10, (Math.random() - 0.5) * 6, 1.2 + Math.random(), 1.4 + Math.random() * 1.2);
    }
  }
}
