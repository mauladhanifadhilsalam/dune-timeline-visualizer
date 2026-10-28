import type { Resolved } from './model';
import type { Scale } from './scale';

/** Where everything sits on the path, as t in [0, 1]. */
export interface Placement {
  events: Map<string, { t: number; tEnd: number }>;
  eras: number[];
  novels: [number, number][];
  /** [lifeline][segment] */
  lives: [number, number][][];
}

export function placementFrom(res: Resolved, scale: Scale): Placement {
  const events = new Map<string, { t: number; tEnd: number }>();
  for (const e of res.events) events.set(e.id, { t: scale(e.s), tEnd: scale(e.sEnd) });
  return {
    events,
    eras: res.eras.map((e) => scale(e.s0)),
    novels: res.novels.map((n) => [scale(n.s0), scale(n.s1)]),
    lives: res.lifelines.map((l) => l.spans.map((s) => [scale(s.s0), scale(s.s1)] as [number, number])),
  };
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Per-item interpolation, so a change of scale and of reckoning can animate the same way. */
export function blendPlacement(a: Placement, b: Placement, k: number): Placement {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const events = new Map<string, { t: number; tEnd: number }>();
  for (const [id, pa] of a.events) {
    const pb = b.events.get(id) ?? pa;
    events.set(id, { t: lerp(pa.t, pb.t, k), tEnd: lerp(pa.tEnd, pb.tEnd, k) });
  }
  return {
    events,
    eras: a.eras.map((t, i) => lerp(t, b.eras[i], k)),
    novels: a.novels.map(([x, y], i) => [lerp(x, b.novels[i][0], k), lerp(y, b.novels[i][1], k)]),
    lives: a.lives.map((segs, i) =>
      segs.map(([x, y], j) => [lerp(x, b.lives[i][j][0], k), lerp(y, b.lives[i][j][1], k)] as [number, number]),
    ),
  };
}
