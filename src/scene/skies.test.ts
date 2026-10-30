import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CONTRADICTIONS, ERAS, EVENTS, LIFELINES, NOVELS } from '../data';
import { resolve } from '../timeline/model';
import { placementFrom } from '../timeline/placement';
import { SKIES, SKY_CHANGES, SkyLight, mixSky, skyAt, skyStops, type SkyName } from './skies';

const input = { eras: ERAS, events: EVENTS, novels: NOVELS, lifelines: LIFELINES, contradictions: CONTRADICTIONS };

describe('skies', () => {
  it('change at real eras and events', () => {
    const eraIds = new Set(ERAS.map((e) => e.id));
    const eventIds = new Set(EVENTS.map((e) => e.id));
    for (const { from } of SKY_CHANGES) {
      if ('era' in from) expect(eraIds.has(from.era), from.era).toBe(true);
      else expect(eventIds.has(from.event), from.event).toBe(true);
    }
  });

  it('follow the books: dust at dusk, Leto II’s green haze, burning Rakis, cold Chapterhouse', () => {
    const expected: Record<string, SkyName> = {
      'butlerian-jihad': 'dusk',
      'battle-of-arrakeen': 'dusk',
      'paul-walks-desert': 'dusk',
      'god-emperor-reign': 'green',
      'arrakis-green': 'green',
      'leto-death': 'green',
      'famine-times': 'dusk',
      sheeana: 'dusk',
      'teg-awakens': 'dusk',
      'rakis-destroyed': 'burning',
      'chapterhouse-desert': 'cold',
      'no-ship-escape': 'cold',
    };
    for (const reckoning of ['battle', 'almanak'] as const) {
      const res = resolve(input, reckoning);
      for (const scale of [res.narrative, res.linear]) {
        const p = placementFrom(res, scale);
        const stops = skyStops(p, res);
        for (const [id, sky] of Object.entries(expected)) {
          expect(skyAt(stops, p.events.get(id)!.t), `${id} (${reckoning})`).toBe(sky);
        }
      }
    }
  });

  it('blend from one to the other', () => {
    const out = mixSky(paletteCopy(), SKIES.dusk, SKIES.green, 0);
    expect(out.fog.equals(SKIES.dusk.fog)).toBe(true);
    mixSky(out, SKIES.dusk, SKIES.green, 1);
    expect(out.fog.equals(SKIES.green.fog)).toBe(true);
    expect(out.sunIntensity).toBe(SKIES.green.sunIntensity);
    mixSky(out, SKIES.dusk, SKIES.green, 0.5);
    expect(out.hemi).toBeCloseTo((SKIES.dusk.hemi + SKIES.green.hemi) / 2);
    // The palettes themselves are left alone.
    expect(SKIES.dusk.fog.getHexString()).toBe('6a3f45');
  });

  it('turn the light over a few seconds, not at a cut, and then rest', () => {
    const res = resolve(input, 'battle');
    const p = placementFrom(res, res.narrative);
    const light = new SkyLight();
    light.layout(p, res);
    const green = p.events.get('leto-death')!.t;
    expect(light.update(0.1, green)).toBe(true);
    expect(light.current.fog.equals(SKIES.green.fog)).toBe(false);
    let frames = 0;
    while (light.update(0.1, green) && frames < 200) frames++;
    expect(frames).toBeGreaterThan(10);
    expect(frames).toBeLessThan(200);
    expect(light.current.fog.equals(SKIES.green.fog)).toBe(true);
  });

  it('glow round the sun no brighter than at dusk, so the bloom never washes out the title', () => {
    const luminance = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    for (const [name, sky] of Object.entries(SKIES)) {
      expect(luminance(sky.sunGlow), name).toBeLessThanOrEqual(luminance(SKIES.dusk.sunGlow) * 1.08);
    }
  });

  it('light every stretch nearly as strongly as dusk does, so none goes murky', () => {
    const glow = (s: (typeof SKIES)[SkyName]) => s.sunIntensity + s.hemi + s.fillIntensity;
    for (const sky of Object.values(SKIES)) expect(glow(sky) / glow(SKIES.dusk)).toBeGreaterThan(0.85);
  });
});

function paletteCopy() {
  return Object.fromEntries(
    Object.entries(SKIES.dusk).map(([k, v]) => [k, v instanceof THREE.Color ? v.clone() : v]),
  ) as unknown as (typeof SKIES)['dusk'];
}
