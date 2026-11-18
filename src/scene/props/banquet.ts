import * as THREE from 'three';
import { haloTexture } from '../halo';
import { buildFigure } from './figure';

const stone = new THREE.MeshStandardMaterial({ color: '#b8a384', roughness: 0.9, flatShading: true });
const FLOOR = 2;
/** Height of the table top above the floor of the hall. */
const TABLE = 5;
/** The hall's width along the path and its depth, and the table's length. */
const W = 76;
const D = 46;
const TABLE_LEN = 52;
const GUEST_ROBES = ['#6a4a3a', '#3d4f5c', '#7a6a4a', '#4a3a4a', '#5c3a2a', '#8a7a5a'];

/**
 * The formal dinner at the Residency in Arrakeen, early in Dune: the great hall drawn as a cut-away,
 * roof off and the near side open, a long table under floating glowglobes, the guests along both
 * sides, the Duke standing at its head and Jessica at its foot, potted date palms in the corners
 * (each drinking water enough for a man, in a city that buys it by the litre). Local frame as other
 * pieces: X along the path, -Z away from it.
 */
export class Banquet {
  readonly group = new THREE.Group();
  private readonly globes: THREE.Sprite[] = [];
  private readonly guests: { figure: THREE.Group; yaw: number; phase: number }[] = [];
  private readonly duke: THREE.Group;

  constructor() {
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material = stone) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z);
      this.group.add(b);
      return b;
    };
    // The hall's floor on a dais, its back wall with tall windows on the night, columns and a beam
    // before it, and low stubs of the side walls, cut away so the room can be seen into.
    box(W, FLOOR, D, 0, FLOOR / 2, 0);
    box(W, 30, 2, 0, FLOOR + 15, -D / 2 + 1);
    const night = new THREE.MeshBasicMaterial({ color: '#141a2e' });
    for (const x of [-26, -13, 0, 13, 26]) box(7, 16, 0.4, x, FLOOR + 13, -D / 2 + 2.1, night);
    for (const x of [-34, -17, 0, 17, 34]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 27, 10), stone);
      c.position.set(x, FLOOR + 13.5, -D / 2 + 5.5);
      this.group.add(c);
    }
    box(W, 3, 6, 0, FLOOR + 28.5, -D / 2 + 5);
    box(2, 9, D, -W / 2 + 1, FLOOR + 4.5, 0);
    box(2, 9, D, W / 2 - 1, FLOOR + 4.5, 0);
    // The house's green underfoot, the table on it.
    box(W - 14, 0.3, 20, 0, FLOOR + 0.15, 0, new THREE.MeshStandardMaterial({ color: '#1f5d3b', roughness: 1 }));
    const linen = new THREE.MeshStandardMaterial({ color: '#e9dfc9', roughness: 0.8 });
    box(TABLE_LEN, TABLE - 0.5, 10, 0, FLOOR + (TABLE - 0.5) / 2, 0, linen);
    box(TABLE_LEN + 2, 0.8, 11, 0, FLOOR + TABLE, 0, linen);
    // Water in glass on the table: wealth, on Arrakis.
    const glass = new THREE.MeshStandardMaterial({ color: '#7fb4d9', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.8 });
    for (const x of [-20, -10, 0, 10, 20]) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 3.2, 10), glass);
      f.position.set(x, FLOOR + TABLE + 2, 0);
      this.group.add(f);
    }

    // Guests down both sides, seated (the table hides their knees), turned to the table.
    for (const side of [1, -1]) {
      [-20, -10, 0, 10, 20].forEach((x, i) => {
        const figure = buildFigure(GUEST_ROBES[(i + (side > 0 ? 0 : 3)) % GUEST_ROBES.length]);
        figure.scale.setScalar(3.6);
        figure.position.set(x, FLOOR - 0.6, side * 8.5);
        const yaw = side > 0 ? Math.PI : 0;
        figure.rotation.y = yaw;
        this.guests.push({ figure, yaw, phase: i * 1.3 + side });
        this.group.add(figure);
      });
    }
    // The Duke stands at the head; Jessica sits at the foot.
    this.duke = buildFigure('#1f3d2c');
    this.duke.scale.setScalar(4.4);
    this.duke.position.set(TABLE_LEN / 2 + 5, FLOOR, 0);
    this.duke.rotation.y = -Math.PI / 2;
    const jessica = buildFigure('#2b2a3a');
    jessica.scale.setScalar(3.8);
    jessica.position.set(-TABLE_LEN / 2 - 5, FLOOR - 0.4, 0);
    jessica.rotation.y = Math.PI / 2;
    // Attendants by the back wall.
    const attendants = [-16, 16].map((x) => {
      const a = buildFigure('#d8ccb2');
      a.scale.setScalar(3.5);
      a.position.set(x, FLOOR, -D / 2 + 9);
      return a;
    });
    this.group.add(this.duke, jessica, ...attendants);

    // Glowglobes floating over the table.
    const globeMat = new THREE.SpriteMaterial({
      map: haloTexture(),
      color: new THREE.Color('#ffd28a').multiplyScalar(1.5),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (const x of [-20, -7, 7, 20]) {
      const g = new THREE.Sprite(globeMat);
      g.position.set(x, FLOOR + 17, 0);
      g.scale.setScalar(4.5);
      this.globes.push(g);
      this.group.add(g);
    }

    // Date palms in tubs at the corners.
    const trunk = new THREE.MeshStandardMaterial({ color: '#6b4f33', roughness: 1 });
    const frond = new THREE.MeshStandardMaterial({ color: '#4d6b32', roughness: 0.9, side: THREE.DoubleSide, flatShading: true });
    for (const [x, z] of [
      [-W / 2 + 6, -D / 2 + 9],
      [W / 2 - 6, -D / 2 + 9],
      [-W / 2 + 6, D / 2 - 6],
      [W / 2 - 6, D / 2 - 6],
    ]) {
      const palm = new THREE.Group();
      const tub = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2, 3, 12), stone);
      tub.position.y = 1.5;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 15, 7), trunk);
      t.position.y = 10;
      palm.add(tub, t);
      for (let i = 0; i < 7; i++) {
        const f = new THREE.Mesh(new THREE.ConeGeometry(1.3, 9, 4).translate(0, 4.5, 0), frond);
        f.position.y = 17;
        f.rotation.set(1.05, (i / 7) * Math.PI * 2, 0, 'YXZ');
        f.scale.z = 0.3;
        palm.add(f);
      }
      palm.position.set(x, FLOOR, z);
      this.group.add(palm);
    }
  }

  update(time: number): void {
    if (!this.group.visible) return;
    this.globes.forEach((g, i) => (g.position.y = FLOOR + 17 + Math.sin(time * 0.8 + i * 1.7) * 0.8));
    // Heads turning to whoever speaks; the Duke turning down the table as he talks.
    for (const g of this.guests) g.figure.rotation.y = g.yaw + Math.sin(time * 0.5 + g.phase) * 0.35;
    this.duke.rotation.y = -Math.PI / 2 + Math.sin(time * 0.4) * 0.3;
  }
}
