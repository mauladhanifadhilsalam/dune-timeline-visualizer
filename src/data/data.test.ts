import { describe, expect, it } from 'vitest';
import { CONTRADICTIONS, ERAS, EVENTS, LIFELINES, NOVELS, UNDATED } from './index';
import { ACCESSION, resolve } from '../timeline/model';
import type { Reckoning } from './types';

const INPUT = { eras: ERAS, events: EVENTS, novels: NOVELS, lifelines: LIFELINES, contradictions: CONTRADICTIONS };
const RECKONINGS: Reckoning[] = ['battle', 'almanak'];
const ids = new Set(EVENTS.map((e) => e.id));
const novelIds = new Set(NOVELS.map((n) => n.id));

describe('events', () => {
  it('have unique, URL-safe ids', () => {
    expect(ids.size).toBe(EVENTS.length);
    for (const e of EVENTS) expect(e.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('cite one of the six novels', () => {
    expect(NOVELS).toHaveLength(6);
    for (const e of EVENTS) expect(novelIds.has(e.novel), e.id).toBe(true);
  });

  it('are listed in story order under both reckonings', () => {
    for (const r of RECKONINGS) {
      const res = resolve(INPUT, r);
      for (let i = 1; i < res.events.length; i++) {
        expect(res.events[i].y, `${res.events[i].id} after ${res.events[i - 1].id} (${r})`).toBeGreaterThanOrEqual(
          res.events[i - 1].y,
        );
      }
    }
  });

  it('have spans that end after they start', () => {
    for (const e of EVENTS) if (e.endYear !== undefined) expect(e.endYear, e.id).toBeGreaterThan(e.year);
  });

  it('say who is talking when the history is recalled', () => {
    // A recalled event without a narrator is either depicted or unsourced.
    const unsourced = EVENTS.filter((e) => e.mode === 'recalled' && !e.via && e.certainty === 'stated');
    expect(unsourced.map((e) => e.id)).toEqual([]);
  });

  it('only move with the reckoning when they come after the accession', () => {
    for (const e of EVENTS) {
      if (e.shift) expect(e.year, e.id).toBeGreaterThanOrEqual(ACCESSION.battle);
      if (e.shift || e.shiftEnd) expect(e.certainty, `${e.id}: a stated year cannot move`).not.toBe('stated');
    }
  });

  it('keep dates stated in the text fixed', () => {
    const a = resolve(INPUT, 'battle');
    const b = resolve(INPUT, 'almanak');
    for (const e of a.events.filter((x) => x.certainty === 'stated')) {
      expect(b.byId.get(e.id)!.y, e.id).toBe(e.y);
    }
    expect(b.byId.get('twins-born')!.y - a.byId.get('twins-born')!.y).toBe(3);
  });

  it('carry the anchor dates Herbert actually prints', () => {
    const at = (id: string) => EVENTS.find((e) => e.id === id)!;
    expect(at('butlerian-jihad').year).toBe(-201);
    expect(at('butlerian-jihad').endYear).toBe(-108);
    expect(at('battle-of-corrin').year).toBe(-88);
    expect(at('zensunni-schism').year).toBe(-1381);
    expect(at('shaddam-accession').year).toBe(10156);
    expect(at('irulan-regency').year).toBe(10196);
    expect(at('shaddam-dies').year).toBe(10202);
  });

  it('add up Herbert’s stated intervals from the accession', () => {
    const res = resolve(INPUT, 'battle');
    const y = (id: string) => res.byId.get(id)!.y;
    expect(y('messiah-conspiracy') - ACCESSION.battle).toBe(12); // "twelve years"
    expect(y('preacher-arrives') - y('paul-walks-desert')).toBe(9); // twins are nine
    expect(y('leto-death') - y('leto-ascends')).toBe(3500); // "3,500 years"
    expect(y('sheeana') - y('leto-death')).toBe(1500); // "some 1,500 years"
  });
});

describe('eras', () => {
  it('are contiguous and ordered', () => {
    for (let i = 1; i < ERAS.length; i++) expect(ERAS[i].start, ERAS[i].id).toBe(ERAS[i - 1].end);
  });

  it('contain every event, in both reckonings', () => {
    for (const r of RECKONINGS) {
      const res = resolve(INPUT, r);
      for (const e of res.events) expect(e.eraIndex, `${e.id} (${r})`).toBeGreaterThanOrEqual(0);
    }
  });

  it('put each firstEvent in its own era', () => {
    const res = resolve(INPUT, 'battle');
    res.eras.forEach((era, i) => {
      if (era.firstEvent) expect(res.byId.get(era.firstEvent)!.eraIndex, era.id).toBe(i);
    });
    expect(res.byId.get('paul-emperor')!.eraIndex).toBe(res.eras.findIndex((e) => e.id === 'muaddib'));
  });
});

describe('references', () => {
  it('contradictions join two real, different events', () => {
    for (const c of CONTRADICTIONS) {
      expect(ids.has(c.a), c.id).toBe(true);
      expect(ids.has(c.b), c.id).toBe(true);
      expect(c.a).not.toBe(c.b);
    }
  });

  it('lifeline anchors exist and agree with their years', () => {
    for (const r of RECKONINGS) {
      const res = resolve(INPUT, r);
      for (const l of res.lifelines) {
        l.segments.forEach((seg, i) => {
          const span = l.spans[i];
          if (seg.startAt) expect(res.byId.get(seg.startAt)?.y, `${l.id} start (${r})`).toBe(span.y0);
          if (seg.endAt) expect(res.byId.get(seg.endAt)?.y, `${l.id} end (${r})`).toBe(span.y1);
          expect(span.s1, l.id).toBeGreaterThanOrEqual(span.s0);
        });
      }
    }
  });

  it('undated notes point at a novel', () => {
    for (const u of UNDATED) expect(novelIds.has(u.novel), u.title).toBe(true);
  });
});

describe('story time', () => {
  it('spreads same-year events in listed order without leaving the year', () => {
    const res = resolve(INPUT, 'battle');
    const dune = res.events.filter((e) => e.y === 10191);
    expect(dune.length).toBeGreaterThan(5);
    for (let i = 1; i < dune.length; i++) expect(dune[i].s).toBeGreaterThan(dune[i - 1].s);
    for (const e of dune) expect(Math.floor(e.s)).toBe(10191);
  });
});
