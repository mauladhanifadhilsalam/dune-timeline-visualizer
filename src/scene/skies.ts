import * as THREE from 'three';
import type { Resolved } from '../timeline/model';
import type { Placement } from '../timeline/placement';

/** Everything that colours the light: the sky's gradient, the haze, and the lamps of the scene. */
export interface SkyPalette {
  zenith: THREE.Color;
  mid: THREE.Color;
  horizon: THREE.Color;
  /** The warm bloom round the sun and the horizon under it. */
  sunGlow: THREE.Color;
  /** The haze distant ground fades into, which is also the sky below the horizon. */
  fog: THREE.Color;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemi: number;
  sun: THREE.Color;
  sunIntensity: number;
  /** The cool fill from the moons' side. */
  fill: THREE.Color;
  fillIntensity: number;
}

export type SkyName = 'dusk' | 'green' | 'burning' | 'cold';

const palette = (p: {
  zenith: string;
  mid: string;
  horizon: string;
  sunGlow: string;
  fog: string;
  hemi: [string, string, number];
  sun: [string, number];
  fill: [string, number];
}): SkyPalette => ({
  zenith: new THREE.Color(p.zenith),
  mid: new THREE.Color(p.mid),
  horizon: new THREE.Color(p.horizon),
  sunGlow: new THREE.Color(p.sunGlow),
  fog: new THREE.Color(p.fog),
  hemiSky: new THREE.Color(p.hemi[0]),
  hemiGround: new THREE.Color(p.hemi[1]),
  hemi: p.hemi[2],
  sun: new THREE.Color(p.sun[0]),
  sunIntensity: p.sun[1],
  fill: new THREE.Color(p.fill[0]),
  fillIntensity: p.fill[1],
});

/**
 * The light of each stretch of the story. Always the same dusk, so the scenes read as one world,
 * but tinted by what the books say hangs in its air.
 */
export const SKIES: Record<SkyName, SkyPalette> = {
  /** Arrakis at dusk: the sun low and orange through the dust, violet overhead. */
  dusk: palette({
    zenith: '#07060f',
    mid: '#2a1d38',
    horizon: '#8a4d45',
    sunGlow: '#ff9a52',
    fog: '#6a3f45',
    hemi: ['#8c7bb3', '#4a2a1c', 1.1],
    sun: ['#ffad70', 2.6],
    fill: ['#7f8fd6', 0.45],
  }),
  /**
   * Leto II's green Arrakis: rain and open water, so the dust is gone from the air and a damp olive
   * haze hangs over the forest instead, under a softer, yellower sun.
   */
  green: palette({
    zenith: '#060a0e',
    mid: '#1d2b2e',
    horizon: '#717a52',
    sunGlow: '#e2aa5a',
    fog: '#4d5a45',
    hemi: ['#93a69c', '#2e3a22', 1.15],
    sun: ['#ffcb8c', 2.35],
    fill: ['#8ea3c6', 0.5],
  }),
  /**
   * Rakis burning under the Honored Matres' attack: smoke over the whole sky, the sun a red coal
   * through it, the ground lit from below by fire.
   */
  burning: palette({
    zenith: '#0b0405',
    mid: '#2d0f0c',
    horizon: '#9c3519',
    sunGlow: '#ff5a1e',
    fog: '#4c1e16',
    hemi: ['#8c4a38', '#4a170a', 1.0],
    sun: ['#ff7438', 2.3],
    fill: ['#6c5272', 0.3],
  }),
  /**
   * Chapterhouse: the Bene Gesserit's own world, far from Arrakis, its new desert only just
   * spreading. Cleaner air and a colder light, the sun pale.
   */
  cold: palette({
    zenith: '#05070f',
    mid: '#1a2239',
    horizon: '#5f6679',
    sunGlow: '#d4b09c',
    fog: '#4a5063',
    hemi: ['#8f9dc9', '#3a3431', 1.1],
    sun: ['#ffe2c4', 2.3],
    fill: ['#90a5e2', 0.6],
  }),
};

/**
 * Where the light changes, in story order: from the start of an era, or from the stretch of path
 * nearer an event than the one before it. Each holds until the next.
 */
export const SKY_CHANGES: { from: { era: string } | { event: string }; sky: SkyName }[] = [
  { from: { era: 'before-jihad' }, sky: 'dusk' },
  { from: { era: 'god-emperor' }, sky: 'green' },
  // The Famine Times: the rain stops and the desert comes back.
  { from: { era: 'scattering' }, sky: 'dusk' },
  { from: { event: 'rakis-destroyed' }, sky: 'burning' },
  { from: { event: 'chapterhouse-desert' }, sky: 'cold' },
];

/** The changes placed on the path, as t, in order. */
export function skyStops(p: Placement, res: Resolved): { t: number; sky: SkyName }[] {
  const ts = [...p.events.values()].map((e) => e.t).sort((a, b) => a - b);
  const stops = SKY_CHANGES.flatMap(({ from, sky }) => {
    if ('era' in from) {
      const i = res.eras.findIndex((e) => e.id === from.era);
      return i < 0 ? [] : [{ t: i === 0 ? -Infinity : p.eras[i], sky }];
    }
    const t = p.events.get(from.event)?.t;
    if (t === undefined) return [];
    // Halfway from the event before, as scenes do, so the light has turned by the time it arrives.
    const k = ts.indexOf(t);
    return [{ t: k > 0 ? (ts[k - 1] + t) / 2 : -Infinity, sky }];
  });
  return stops.sort((a, b) => a.t - b.t);
}

/** Which light a point on the path is under. */
export function skyAt(stops: { t: number; sky: SkyName }[], t: number): SkyName {
  let sky: SkyName = 'dusk';
  for (const s of stops) if (t >= s.t) sky = s.sky;
  return sky;
}

/** A palette `k` of the way from `from` to `to`, written into `out`. */
export function mixSky(out: SkyPalette, from: SkyPalette, to: SkyPalette, k: number): SkyPalette {
  for (const key of Object.keys(out) as (keyof SkyPalette)[]) {
    const a = from[key];
    const b = to[key];
    if (a instanceof THREE.Color) (out[key] as THREE.Color).copy(a).lerp(b as THREE.Color, k);
    else (out[key] as number) = (a as number) + ((b as number) - (a as number)) * k;
  }
  return out;
}

const clonePalette = (p: SkyPalette): SkyPalette =>
  Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v instanceof THREE.Color ? v.clone() : v])) as unknown as SkyPalette;

/**
 * The light as it is right now: eased toward the sky of wherever the camera is looking, so walking
 * into a new stretch of the story turns the light over a couple of seconds rather than at a cut.
 */
export class SkyLight {
  readonly current = clonePalette(SKIES.dusk);
  private stops: { t: number; sky: SkyName }[] = [];
  private settled = false;
  private target: SkyName = 'dusk';

  layout(p: Placement, res: Resolved): void {
    this.stops = skyStops(p, res);
  }

  /** Ease toward the light at path position `t`. Returns whether the light changed. */
  update(dt: number, t: number): boolean {
    const target = skyAt(this.stops, t);
    if (target !== this.target) {
      this.target = target;
      this.settled = false;
    }
    if (this.settled) return false;
    const goal = SKIES[target];
    mixSky(this.current, this.current, goal, Math.min(dt * 1.1, 1));
    if (closeTo(this.current, goal)) {
      mixSky(this.current, goal, goal, 0);
      this.settled = true;
    }
    return true;
  }
}

function closeTo(a: SkyPalette, b: SkyPalette): boolean {
  for (const key of Object.keys(a) as (keyof SkyPalette)[]) {
    const x = a[key];
    const y = b[key];
    if (x instanceof THREE.Color) {
      const c = y as THREE.Color;
      if (Math.abs(x.r - c.r) + Math.abs(x.g - c.g) + Math.abs(x.b - c.b) > 0.002) return false;
    } else if (Math.abs((x as number) - (y as number)) > 0.002) return false;
  }
  return true;
}
