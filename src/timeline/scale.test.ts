import { describe, expect, it } from 'vitest';
import { blendScales, invertScale, linearScale, narrativeScale } from './scale';
import { assignLanes } from './lanes';
import { formatRange, formatYear } from './format';

describe('linearScale', () => {
  it('maps the ends to 0 and 1 and clamps outside', () => {
    const s = linearScale(-100, 100);
    expect(s(-100)).toBe(0);
    expect(s(0)).toBe(0.5);
    expect(s(100)).toBe(1);
    expect(s(-500)).toBe(0);
    expect(s(500)).toBe(1);
  });
  it('rejects an empty range', () => {
    expect(() => linearScale(5, 5)).toThrow();
  });
});

describe('narrativeScale', () => {
  const eras = [-1400, -201, -108, 0, 10175, 10193, 10214, 13714, 15214, 15226];
  const moments = [-1381, -201, -88, 0, 10111, 10156, 10175, 10191, 10191.5, 10193, 10205, 10214, 13714, 15214, 15225];
  const s = narrativeScale(moments, eras);

  it('spans [0, 1] over the era range', () => {
    expect(s(-1400)).toBe(0);
    expect(s(15226)).toBe(1);
  });

  it('is strictly increasing across distinct moments (order is never scrambled)', () => {
    const sorted = [...new Set([...moments, ...eras])].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) expect(s(sorted[i])).toBeGreaterThan(s(sorted[i - 1]));
  });

  it('opens up dense periods relative to true scale', () => {
    const lin = linearScale(-1400, 15226);
    const storyDune = s(10193) - s(10191);
    const trueDune = lin(10193) - lin(10191);
    expect(storyDune).toBeGreaterThan(trueDune * 50);
  });

  it('still shows a ten-thousand-year gap as bigger than a two-year one', () => {
    expect(s(10175) - s(0)).toBeGreaterThan(s(10193) - s(10191));
  });

  it('gives a weighted stretch that many times the room, keeping order', () => {
    // Pure rank, so step lengths are exactly the weights: the steps ending after year 2 count double.
    const w = narrativeScale([1, 2, 3, 4], [0, 5], { rankWeight: 1, stepWeight: (y) => (y > 2 && y < 5 ? 2 : 1) });
    const plain = w(2) - w(1);
    expect(w(3) - w(2)).toBeCloseTo(2 * plain, 10);
    expect(w(4) - w(3)).toBeCloseTo(2 * plain, 10);
    expect(w(0)).toBe(0);
    expect(w(5)).toBe(1);
  });
});

describe('blend and invert', () => {
  const a = linearScale(0, 100);
  const b = (y: number) => Math.sqrt(y / 100);
  it('blends endpoints exactly', () => {
    expect(blendScales(a, b, 0)(25)).toBe(a(25));
    expect(blendScales(a, b, 1)(25)).toBe(b(25));
    expect(blendScales(a, b, 0.5)(25)).toBeCloseTo((0.25 + 0.5) / 2);
  });
  it('inverts a monotone scale', () => {
    expect(invertScale(b, b(64), 0, 100)).toBeCloseTo(64, 3);
  });
});

describe('assignLanes', () => {
  it('uses as many lanes as the maximum overlap', () => {
    const lanes = assignLanes([
      { start: 0, end: 10 },
      { start: 5, end: 15 },
      { start: 11, end: 20 },
      { start: 12, end: 13 },
    ]);
    expect(Math.max(...lanes) + 1).toBe(3);
    expect(lanes[0]).not.toBe(lanes[1]);
  });
  it('reuses a lane once it frees up', () => {
    expect(assignLanes([{ start: 0, end: 1 }, { start: 2, end: 3 }])).toEqual([0, 0]);
  });
});

describe('formatYear', () => {
  it('writes B.G. years with BG and leaves later years bare, as Herbert does', () => {
    expect(formatYear(-201)).toBe('201 BG');
    expect(formatYear(10191)).toBe('10,191');
    expect(formatYear(0)).toBe('Year 0');
  });
  it('collapses same-side ranges', () => {
    expect(formatRange(-201, -108)).toBe('201–108 BG');
    expect(formatRange(10193, 10205)).toBe('10,193–10,205');
    expect(formatRange(-108, 0)).toBe('108 BG – Year 0');
    expect(formatRange(15214, 15214, true)).toBe('c. 15,214');
  });
});
