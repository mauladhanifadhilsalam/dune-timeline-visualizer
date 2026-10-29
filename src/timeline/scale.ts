import type { Year } from '../data/types';

/** Maps a year onto the path parameter t in [0, 1]. Always monotone non-decreasing. */
export type Scale = (year: Year) => number;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** True proportional time: 16,000 years laid end to end. */
export function linearScale(min: Year, max: Year): Scale {
  const span = max - min;
  if (!(span > 0)) throw new Error(`linearScale needs max > min (got ${min}..${max})`);
  return (year) => clamp01((year - min) / span);
}

/**
 * Piecewise-linear interpolation through sorted knots (x strictly increasing, y non-decreasing).
 * Clamps outside the knot range.
 */
function piecewise(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length;
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] <= x) lo = mid;
      else hi = mid;
    }
    const f = (x - xs[lo]) / (xs[hi] - xs[lo]);
    return ys[lo] + f * (ys[hi] - ys[lo]);
  };
}

export interface NarrativeOptions {
  /**
   * Share of the path given by event rank (equal spacing between consecutive dated moments)
   * versus by era (each era gets an equal slice, linear inside it). 1 = pure rank, 0 = pure era.
   */
  rankWeight?: number;
  /**
   * Relative length of the rank step that ends at a given moment (default 1 for all). A step
   * weighted 2 is twice as long as an ordinary one, so a crowded stretch of the story can be given
   * more path at the expense of the rest; order and monotonicity are unaffected.
   */
  stepWeight?: (year: Year) => number;
}

/**
 * "Narrative" time: space is allocated where the story is, not where the years are.
 *
 * A linear axis spends 60% of its length on the ten quiet millennia of the Corrino Imperium and
 * squeezes all of Dune into 0.3%. This blends two monotone maps so dense periods open up while
 * order is preserved and big gaps still read as big:
 *   - rank: every distinct dated moment is one equal step
 *   - era:  every era gets an equal share, linear within
 */
export function narrativeScale(
  momentYears: Year[],
  eraBoundaries: Year[],
  { rankWeight = 0.6, stepWeight = () => 1 }: NarrativeOptions = {},
): Scale {
  const bounds = [...new Set(eraBoundaries)].sort((a, b) => a - b);
  if (bounds.length < 2) throw new Error('narrativeScale needs at least two era boundaries');
  const min = bounds[0];
  const max = bounds[bounds.length - 1];

  // Era boundaries count as moments too, so even an empty era is given room.
  const moments = [...new Set([...momentYears, ...bounds])]
    .filter((y) => y >= min && y <= max)
    .sort((a, b) => a - b);
  // Cumulative step lengths, normalised to end at 1.
  const cum = [0];
  for (let i = 1; i < moments.length; i++) cum.push(cum[i - 1] + Math.max(stepWeight(moments[i]), 1e-6));
  const total = cum[cum.length - 1];
  const rank = piecewise(
    moments,
    cum.map((c) => c / total),
  );
  const era = piecewise(
    bounds,
    bounds.map((_, i) => i / (bounds.length - 1)),
  );
  const w = clamp01(rankWeight);
  return (year) => clamp01(w * rank(year) + (1 - w) * era(year));
}

/** Blend two scales; b = 0 gives `a`, b = 1 gives `c`. Stays monotone for b in [0, 1]. */
export function blendScales(a: Scale, c: Scale, b: number): Scale {
  if (b <= 0) return a;
  if (b >= 1) return c;
  return (year) => a(year) * (1 - b) + c(year) * b;
}

/** Inverse of a monotone scale by bisection. Returns the earliest year mapping at or past t. */
export function invertScale(scale: Scale, t: number, min: Year, max: Year, iterations = 40): Year {
  let lo = min;
  let hi = max;
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2;
    if (scale(mid) < t) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
