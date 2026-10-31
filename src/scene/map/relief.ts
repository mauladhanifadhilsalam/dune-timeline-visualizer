import { RELIEF, type Relief } from '../../data/arrakis';
import { fbm } from '../noise';

type Pt = [number, number];

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Distance from (u, v) to a polyline, and how far along it (0..1) the nearest point is. */
function toPath(u: number, v: number, path: Pt[]): { d: number; k: number } {
  let best = Infinity;
  let bestK = 0;
  let run = 0;
  let total = 0;
  for (let i = 1; i < path.length; i++) total += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1];
    const [bx, by] = path[i];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.min(Math.max(((u - ax) * dx + (v - ay) * dy) / len2, 0), 1) : 0;
    const d = Math.hypot(u - (ax + dx * t), v - (ay + dy * t));
    const seg = Math.sqrt(len2);
    if (d < best) {
      best = d;
      bestK = (run + seg * t) / total;
    }
    run += seg;
  }
  return { d: best, k: bestK };
}

/** 0 at the centre of an ellipse, 1 on its edge. */
const ellipse = (u: number, v: number, at: Pt, r: Pt) => Math.hypot((u - at[0]) / r[0], (v - at[1]) / r[1]);

/**
 * How high the ground stands, in metres above the Great Bled, at a point of the polar map. Stated
 * heights are met exactly where the book puts them: a peak's summit, a basin's floor, a pass's
 * lowest point, a chasm's bed.
 */
export function altitudeAt(u: number, v: number, relief: Relief[] = RELIEF): number {
  // The open desert: sand and rock, rolling a few tens of metres.
  let h = 45 * fbm(u * 7 + 11, v * 7 - 3, 3);
  for (const f of relief) {
    switch (f.kind) {
      case 'flat': {
        const m = 1 - smoothstep(0.6, 1, ellipse(u, v, f.at, f.radius));
        const outcrop = Math.max(fbm(u * 26, v * 26, 3) - 0.55, 0) / 0.45;
        h += (f.alt + f.outcrops * outcrop - h) * m;
        break;
      }
      case 'erg': {
        const m = 1 - smoothstep(0.55, 1, ellipse(u, v, f.at, f.radius));
        h += 70 * fbm(u * 18 - 5, v * 18 + 2, 2) * m;
        break;
      }
      case 'ridge': {
        const { d: d0, k } = toPath(u, v, f.path);
        if (d0 > f.width / 0.72) break;
        // Spurs and re-entrants along its flanks, so its edge wanders like a range's.
        const d = d0 * (0.72 + 0.56 * fbm(u * 15 + 5, v * 15 - 5, 3));
        if (d > f.width) break;
        // Tapering off at either end, broken along the crest by `rough`.
        const ends = smoothstep(0, 0.06, k) * smoothstep(1, 0.94, k);
        const crest = 1 - f.rough * fbm(u * 30 + 7, v * 30 - 7, 3);
        // Broad shoulders falling to foothills, so a range reads as a massif, not a wall of rock.
        const across = 1 - smoothstep(0, f.width, d);
        h = Math.max(h, f.alt * crest * across * (0.35 + 0.65 * ends));
        break;
      }
      case 'peak': {
        const d = Math.hypot(u - f.at[0], v - f.at[1]) / f.radius;
        if (d < 1.6) h = Math.max(h, f.alt * Math.exp(-d * d * 2.4));
        break;
      }
      case 'plateau': {
        // A ragged edge, so it reads as broken high country rather than a drum.
        const d = (Math.hypot(u - f.at[0], v - f.at[1]) / f.radius) * (0.8 + 0.4 * fbm(u * 24 + 3, v * 24 - 9, 3));
        if (d < 1) h = Math.max(h, f.alt * (1 - f.rough * fbm(u * 40, v * 40, 2)) * (1 - smoothstep(0.45, 1, d)));
        break;
      }
      case 'basin': {
        const m = 1 - smoothstep(0.55, 1, ellipse(u, v, f.at, f.radius));
        h += (f.alt - h) * m;
        break;
      }
      case 'notch': {
        const d = Math.hypot(u - f.at[0], v - f.at[1]) / f.radius;
        if (d < 1 && h > f.alt) h = f.alt + (h - f.alt) * smoothstep(0.15, 1, d);
        break;
      }
      case 'sink': {
        const e = ellipse(u, v, f.at, f.radius) * (1 - f.ragged + 2 * f.ragged * fbm(u * 6, v * 6, 2));
        if (e < 1) h = Math.min(h, f.alt + (h - f.alt) * smoothstep(0.45, 1, e));
        break;
      }
      case 'chasm': {
        const { d } = toPath(u, v, f.path);
        if (d < f.width) h = Math.min(h, f.alt + (h - f.alt) * smoothstep(0.1, 1, d / f.width));
        break;
      }
    }
  }
  return h;
}

/** 0..1: how much a point lies in a sea of dunes, which the model draws as ripples. */
export function ergAt(u: number, v: number, relief: Relief[] = RELIEF): number {
  let m = 0;
  for (const f of relief) if (f.kind === 'erg') m = Math.max(m, 1 - smoothstep(0.5, 1, ellipse(u, v, f.at, f.radius)));
  return m;
}
