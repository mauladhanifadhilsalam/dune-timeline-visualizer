import * as THREE from 'three';
import { haloTexture } from '../halo';
import { SKIN, buildFigure, figureGeometry } from './figure';

const stone = new THREE.MeshStandardMaterial({ color: '#b8a384', roughness: 0.9, flatShading: true });
/** The temple's lamps, seen through its open door. */
const lit = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb36a').multiplyScalar(1.3) });

const CROWD = 150;
/** Fremen stillsuit browns, pilgrims' pale robes, a few darker townsfolk. */
const ROBES = ['#3a2c22', '#4a3a2c', '#6b5640', '#8f7a5c', '#b39b74', '#a28a62', '#2e3a33', '#5c4a3a'];
/** Where he stands, on the top step. */
const PULPIT = new THREE.Vector3(0, 7.5, -24);

/**
 * The Preacher in Children of Dune: blind Paul come back out of the desert, led by a boy, preaching
 * against the priesthood raised in his own name, from the steps of Alia's temple in Arrakeen to a
 * throng packed into the plaza below. He is killed on these steps. Local frame as other pieces:
 * the temple stands to the back (-Z); he faces out over the plaza toward the path (+Z). The plaza
 * is the piece's flattened pad.
 */
export class Preacher {
  readonly group = new THREE.Group();
  private readonly preacher = buildFigure('#2a221c');
  private readonly guide = buildFigure('#5a4632');
  private readonly crowd: THREE.InstancedMesh[];
  private readonly people: { x: number; z: number; yaw: number; size: number; phase: number }[] = [];
  private readonly flames: THREE.Sprite[] = [];
  private readonly dummy = new THREE.Object3D();

  constructor() {
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material = stone) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z);
      this.group.add(b);
    };
    // Three broad steps up to a colonnade, a heavy entablature, a dark doorway and a dome behind.
    for (let k = 0; k < 3; k++) box(118 - k * 10, 2.5, 30 - k * 6, 0, 1.25 + k * 2.5, -25 - k * 3);
    const column = new THREE.CylinderGeometry(1.9, 2.3, 26, 10);
    // A wider bay in the middle, so the columns frame the door instead of standing in it.
    for (const x of [-45, -33, -21, -11, 11, 21, 33, 45]) {
      const c = new THREE.Mesh(column, stone);
      c.position.set(x, PULPIT.y + 13, -34);
      this.group.add(c);
    }
    box(104, 6, 12, 0, PULPIT.y + 29, -34);
    box(96, 32, 3, 0, PULPIT.y + 16, -41);
    // The open door, lit within: he stands against it, so the eye finds him even with the sun behind.
    box(16, 20, 1, 0, PULPIT.y + 10, -39.2, lit);
    // A brazier either side of him on the top step.
    const flameMat = new THREE.SpriteMaterial({
      map: haloTexture(),
      color: new THREE.Color('#ff9a3c').multiplyScalar(1.6),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (const x of [-14, 14]) {
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 0.8, 4.5, 10), stone);
      bowl.position.set(x, PULPIT.y + 2.25, PULPIT.z + 1);
      const flame = new THREE.Sprite(flameMat);
      flame.position.set(x, PULPIT.y + 6, PULPIT.z + 1);
      flame.scale.setScalar(7);
      this.flames.push(flame);
      this.group.add(bowl, flame);
    }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(28, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), stone);
    dome.position.set(0, PULPIT.y + 32, -58);
    this.group.add(dome);

    // He is drawn a little larger than the crowd, so the eye finds him; the boy who leads him at his side.
    this.preacher.scale.setScalar(5.4);
    this.preacher.position.copy(PULPIT);
    this.guide.scale.setScalar(3.3);
    this.guide.position.set(PULPIT.x + 6, PULPIT.y, PULPIT.z - 1);
    this.guide.rotation.y = -1.1;
    this.group.add(this.preacher, this.guide);

    // The throng: arcs packed round the foot of the steps, thinning toward the back, all facing him.
    const geo = figureGeometry();
    const cloth = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 });
    const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.8 });
    this.crowd = [
      new THREE.InstancedMesh(geo.robe, cloth, CROWD),
      new THREE.InstancedMesh(geo.head, skin, CROWD),
      new THREE.InstancedMesh(geo.hood, cloth, CROWD),
    ];
    const c = new THREE.Color();
    let r = 22;
    while (this.people.length < CROWD) {
      const span = 1.3 - r * 0.004;
      const n = Math.floor((span * 2 * r) / 6.2);
      for (let i = 0; i < n && this.people.length < CROWD; i++) {
        const a = -span + ((i + 0.5) / n) * span * 2 + (Math.random() - 0.5) * 0.06;
        const rr = r + (Math.random() - 0.5) * 2.4;
        const x = PULPIT.x + Math.sin(a) * rr;
        const z = PULPIT.z + Math.cos(a) * rr;
        if (z < -6) continue; // not up on the steps
        this.people.push({
          x,
          z,
          yaw: Math.atan2(PULPIT.x - x, PULPIT.z - z),
          size: 3.6 + Math.random() * 0.8,
          phase: Math.random() * 10,
        });
        const robe = ROBES[Math.floor(Math.random() * ROBES.length)];
        this.crowd[0].setColorAt(this.people.length - 1, c.set(robe));
        this.crowd[2].setColorAt(this.people.length - 1, c.set(robe));
      }
      r += 6.4;
    }
    for (const m of this.crowd) m.frustumCulled = false;
    this.group.add(...this.crowd);
  }

  update(time: number): void {
    if (!this.group.visible) return;
    this.flames.forEach((f, i) => f.scale.setScalar(6.5 + Math.sin(time * 9 + i * 2) * 0.6 + Math.sin(time * 23 + i) * 0.4));
    // He turns from one side of the crowd to the other as he speaks.
    this.preacher.rotation.y = Math.sin(time * 0.35) * 0.6;
    this.preacher.position.y = PULPIT.y + Math.abs(Math.sin(time * 1.9)) * 0.15;
    // The crowd sways and shifts, each to its own rhythm, turning a little to follow him.
    const follow = this.preacher.rotation.y * 0.15;
    for (let i = 0; i < this.people.length; i++) {
      const p = this.people[i];
      const sway = Math.sin(time * 1.1 + p.phase);
      this.dummy.position.set(p.x, Math.abs(Math.sin(time * 0.8 + p.phase * 1.7)) * 0.12, p.z);
      this.dummy.rotation.set(0, p.yaw + sway * 0.12 + follow, sway * 0.035);
      this.dummy.scale.setScalar(p.size);
      this.dummy.updateMatrix();
      for (const m of this.crowd) m.setMatrixAt(i, this.dummy.matrix);
    }
    for (const m of this.crowd) m.instanceMatrix.needsUpdate = true;
  }
}
