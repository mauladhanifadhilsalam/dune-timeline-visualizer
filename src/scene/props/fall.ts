import * as THREE from 'three';
import { rng } from '../noise';
import { ARRAKEEN_FIELD } from './arrakeen';
import { Fires } from './fire';
import { Fleet } from './fleet';
import type { Particles } from './particles';

/**
 * The fall of House Atreides: the Harkonnens and the Emperor's Sardaukar take Arrakeen in the
 * night. Fires through the city with smoke over it, and their frigates coming down onto the
 * landing field where the Atreides landed. Stands in Arrakeen's frame.
 */
export class ArrakeenFalls {
  readonly group = new THREE.Group();
  private readonly fires: Fires;
  private readonly fleet = new Fleet({
    banners: false,
    landing: true,
    gantries: false,
    slots: [
      [-24, 18],
      [24, 4],
      [0, -30],
    ],
  });

  constructor() {
    // Fires among the old town's roofs, seeded so they burn in the same places every time.
    const rand = rng(10191 + 2);
    const spots = [];
    for (let i = 0; i < 9; i++) {
      const a = rand() * Math.PI * 2;
      const r = 30 + rand() * 90;
      const x = Math.cos(a) * r * 1.15;
      const z = Math.sin(a) * r * 0.7;
      if (Math.hypot(x - ARRAKEEN_FIELD.x, z - ARRAKEEN_FIELD.z) < ARRAKEEN_FIELD.r + 10) continue;
      spots.push({ x, y: 10 + rand() * 14, z, size: 5 + rand() * 5 });
    }
    this.fires = new Fires(spots, 30);
    this.fleet.group.position.set(ARRAKEEN_FIELD.x, 0, ARRAKEEN_FIELD.z);
    this.group.add(this.fires.group, this.fleet.group);
  }

  update(time: number, dt: number, smoke: Particles, embers: Particles, dust: Particles, exhaust: Particles): void {
    if (!this.group.visible) {
      // So the landing plays again from the top on the next arrival.
      this.fleet.rewind();
      return;
    }
    this.fires.update(time, dt, smoke, embers);
    this.fleet.update(time, dt, dust, exhaust);
  }
}
