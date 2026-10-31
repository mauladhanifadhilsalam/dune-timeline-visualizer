import { describe, expect, it } from 'vitest';
import { EVENTS } from '../../data';
import { MAP_CENTER, MAP_RADIUS, PLACES, RELIEF } from '../../data/arrakis';
import { altitudeAt } from './relief';

const place = (id: string) => PLACES.find((p) => p.id === id)!;
const at = (id: string) => altitudeAt(...place(id).at);

describe('the map of Arrakis', () => {
  it('names each place once, all of them on the model', () => {
    const ids = PLACES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PLACES) expect(Math.hypot(p.at[0] - MAP_CENTER[0], p.at[1] - MAP_CENTER[1]), p.id).toBeLessThan(MAP_RADIUS);
  });

  it('places events only where the places exist', () => {
    const ids = new Set(PLACES.map((p) => p.id));
    for (const e of EVENTS) for (const id of e.places ?? []) expect(ids.has(id), `${e.id} → ${id}`).toBe(true);
  });

  it('stands at the heights the book gives', () => {
    // Peaks and floors exactly; Broken Land is broken, so within a tenth.
    expect(at('mt-idaho')).toBeCloseTo(7400, -1);
    expect(at('observatory-mt')).toBeCloseTo(8110, -1);
    expect(at('rimwall-west')).toBeGreaterThan(4600 * 0.97);
    expect(at('rimwall-west')).toBeLessThanOrEqual(4600);
    expect(Math.abs(at('broken-land') - 4600)).toBeLessThan(460);
    expect(at('hagga-basin')).toBeCloseTo(200, -1);
    expect(at('sihaya-ridge')).toBeGreaterThan(180);
    expect(at('sihaya-ridge')).toBeLessThanOrEqual(224);
    expect(altitudeAt(-0.625, -0.446)).toBeCloseTo(1200, -1);
    expect(at('polar-sink')).toBeCloseTo(-500, -1);
    expect(at('cielago')).toBeCloseTo(-200, -1);
    expect(at('red-chasm')).toBeLessThan(-1500);
    // The Great Flat: about 100 m above the Bled, outcroppings to 200.
    const flat = place('great-flat').at;
    for (let i = 0; i < 40; i++) {
      const h = altitudeAt(flat[0] + Math.cos(i) * 0.2, flat[1] + Math.sin(i * 1.7) * 0.15);
      expect(h).toBeGreaterThan(80);
      expect(h).toBeLessThanOrEqual(205);
    }
  });

  it('cuts the Old Gap down to 2240 m through a higher wall', () => {
    const [u, v] = place('old-gap').at;
    expect(altitudeAt(u, v)).toBeLessThanOrEqual(2240);
    expect(altitudeAt(u, v)).toBeGreaterThan(2000);
    // Either side along the wall stands higher than the gap's floor.
    expect(Math.max(altitudeAt(u - 0.06, v + 0.02), altitudeAt(u + 0.06, v - 0.02))).toBeGreaterThan(2500);
  });

  it('keeps the Shield Wall up to 4500 m, away from its named peaks', () => {
    const walls = RELIEF.filter((f) => f.kind === 'ridge' && f.alt === 4500);
    const peaks = PLACES.filter((p) => p.kind === 'peak' || p.id === 'broken-land' || p.id === 'rimwall-west');
    let highest = 0;
    for (const w of walls) {
      if (w.kind !== 'ridge') continue;
      for (let i = 1; i < w.path.length; i++) {
        for (let k = 0; k <= 10; k++) {
          const u = w.path[i - 1][0] + (w.path[i][0] - w.path[i - 1][0]) * (k / 10);
          const v = w.path[i - 1][1] + (w.path[i][1] - w.path[i - 1][1]) * (k / 10);
          if (peaks.some((p) => Math.hypot(p.at[0] - u, p.at[1] - v) < 0.14)) continue;
          highest = Math.max(highest, altitudeAt(u, v));
        }
      }
    }
    expect(highest).toBeLessThanOrEqual(4500);
    expect(highest).toBeGreaterThan(3500);
  });
});
