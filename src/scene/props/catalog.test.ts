import { describe, expect, it } from 'vitest';
import { CONTRADICTIONS, ERAS, EVENTS, LIFELINES, NOVELS } from '../../data';
import { resolve } from '../../timeline/model';
import { SET_PIECES } from './catalog';

const eventIds = new Set(EVENTS.map((e) => e.id));
const eraIds = new Set(ERAS.map((e) => e.id));

describe('set pieces', () => {
  it('stand beside real events and appear in real eras', () => {
    for (const p of SET_PIECES) {
      expect(eventIds.has(p.event), `${p.kind} → ${p.event}`).toBe(true);
      expect(p.eras.length, p.kind).toBeGreaterThan(0);
      for (const e of p.eras) expect(eraIds.has(e), `${p.kind}: era ${e}`).toBe(true);
    }
  });

  it('are shown in the era of the event they belong to', () => {
    // Otherwise a piece would never be visible while its own light is in view.
    const input = { eras: ERAS, events: EVENTS, novels: NOVELS, lifelines: LIFELINES, contradictions: CONTRADICTIONS };
    for (const reckoning of ['battle', 'almanak'] as const) {
      const res = resolve(input, reckoning);
      for (const p of SET_PIECES) {
        const era = res.eras[res.byId.get(p.event)!.eraIndex].id;
        expect(p.eras, `${p.kind} at ${p.event} (${reckoning})`).toContain(era);
      }
    }
  });

  it('keep the books’ ecology: no sandworm in Leto II’s reign, when he is the last one', () => {
    for (const p of SET_PIECES.filter((x) => x.kind === 'worm')) expect(p.eras).not.toContain('god-emperor');
  });

  it('declare a footprint so placement can keep them off the path', () => {
    for (const p of SET_PIECES) {
      expect(p.footprint.length, p.kind).toBeGreaterThan(0);
      for (const c of p.footprint) expect(c.r).toBeGreaterThan(0);
    }
  });

  it('give every worm its swimming parameters', () => {
    for (const p of SET_PIECES.filter((x) => x.kind === 'worm')) expect(p.worm).toBeDefined();
  });
});
