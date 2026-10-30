import * as THREE from 'three';
import { FOV, defaultEye, eventDistance } from '../framing';
import { eventLabelRange } from '../timeline';

/**
 * The screen placement plans for: a modest desktop with the event's card open, the tightest frame
 * an event is usually seen in. In step with `.topbar`, `.panel` and `.scrubber` in styles.css: the
 * card takes the right 400 pixels, the bars the top 76 and the bottom 108.
 */
const SCREEN = { width: 1280, height: 760, right: 880, top: 76, bottom: 652 };
/** An event label's rough size: width per character of its title, padding, and height. */
const LABEL = { perChar: 6, pad: 30, minWidth: 160, height: 46 };

/**
 * What the camera sees when an event is chosen: its default framing, centred in the part of the
 * screen the card leaves free, with the labels of the events around it. Placement asks it how
 * much of a scene would be in clear view from a candidate spot.
 */
export class EventView {
  private readonly camera = new THREE.PerspectiveCamera(FOV, SCREEN.width / SCREEN.height, 1, 9000);
  private readonly labels: number[] = [];
  private readonly v = new THREE.Vector3();

  /** `target` is just under the event's light; `toCamera` points from the path to the camera's side. */
  constructor(target: THREE.Vector3, toCamera: THREE.Vector3, tangent: THREE.Vector3, importance: number) {
    defaultEye(target, toCamera, tangent, eventDistance(importance, SCREEN.width / SCREEN.height), this.camera.position);
    this.camera.lookAt(target);
    // As the app does: the event centred in the free part, left of the card.
    this.camera.setViewOffset(SCREEN.width, SCREEN.height, (SCREEN.width - SCREEN.right) / 2, 0, SCREEN.width, SCREEN.height);
    this.camera.updateMatrixWorld();
  }

  /** An event's label, hanging from `anchor`, if it would show: near enough and in the free part. */
  addLabel(anchor: THREE.Vector3, title: string, importance: number): void {
    if (anchor.distanceTo(this.camera.position) > eventLabelRange(importance)) return;
    const s = this.toScreen(anchor);
    if (!s || !this.free(s.x, s.y)) return;
    const w = Math.max(LABEL.minWidth, title.length * LABEL.perChar + LABEL.pad);
    this.labels.push(s.x - w / 2, s.y - LABEL.height, s.x + w / 2, s.y);
  }

  /** The share of these points in the free part of the screen and clear of every label. */
  share(points: THREE.Vector3[]): number {
    let seen = 0;
    for (const p of points) {
      const s = this.toScreen(p);
      if (s && this.free(s.x, s.y) && !this.labelled(s.x, s.y)) seen++;
    }
    return points.length ? seen / points.length : 1;
  }

  private toScreen(p: THREE.Vector3): { x: number; y: number } | null {
    const v = this.v.copy(p).project(this.camera);
    if (v.z > 1) return null;
    return { x: ((v.x + 1) / 2) * SCREEN.width, y: ((1 - v.y) / 2) * SCREEN.height };
  }

  private free(x: number, y: number): boolean {
    return x >= 0 && x <= SCREEN.right && y >= SCREEN.top && y <= SCREEN.bottom;
  }

  private labelled(x: number, y: number): boolean {
    const L = this.labels;
    for (let i = 0; i < L.length; i += 4) if (x >= L[i] && x <= L[i + 2] && y >= L[i + 1] && y <= L[i + 3]) return true;
    return false;
  }
}
