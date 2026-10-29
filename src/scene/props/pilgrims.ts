import * as THREE from 'three';
import { Procession } from './procession';
import { Thopter } from './thopter';

/**
 * Pilgrims on Rakis in Heretics of Dune, crossing the sand to Keen to worship Leto II as the
 * Divided God, in the pale robes of the faithful, with one of the Priesthood's ornithopters
 * circling over them. Local frame as other pieces.
 */
export class Pilgrims {
  readonly group = new THREE.Group();
  private readonly file = new Procession({
    count: 14,
    spacing: 8,
    scale: 4.5,
    cloak: '#b39b74',
    route: [
      [-170, 50],
      [-90, 15],
      [0, 28],
      [90, -8],
      [175, 12],
    ],
    duration: 80,
  });
  private readonly thopter = new Thopter();

  constructor() {
    this.thopter.group.scale.setScalar(2.4);
    this.group.add(this.file.group, this.thopter.group);
  }

  fit(center: THREE.Vector3, quat: THREE.Quaternion): void {
    this.file.fit(center, quat);
  }

  update(time: number): void {
    if (!this.group.visible) return;
    this.file.update(time);
    // A slow, banked circle over the file, nose along the direction of flight.
    const a = time * 0.26;
    this.thopter.group.position.set(Math.cos(a) * 95, 58 + Math.sin(time * 0.7) * 3, Math.sin(a) * 60);
    this.thopter.group.rotation.set(0, -a - Math.PI / 2, -0.28);
    this.thopter.update(time);
  }
}
