import { describe, expect, it } from 'vitest';
import { CONTRADICTIONS, ERAS, EVENTS, LIFELINES, NOVELS } from '../data';
import { resolve } from '../timeline/model';
import { searchEvents } from './search';

const res = resolve({ eras: ERAS, events: EVENTS, novels: NOVELS, lifelines: LIFELINES, contradictions: CONTRADICTIONS }, 'battle');

describe('searchEvents', () => {
  it('ranks a title prefix first', () => {
    expect(searchEvents(res.events, 'battle')[0].title).toMatch(/^Battle/);
  });
  it('finds events by the people in them', () => {
    const hits = searchEvents(res.events, 'nayla').map((e) => e.id);
    expect(hits).toContain('leto-death');
  });
  it('returns nothing for an empty query', () => {
    expect(searchEvents(res.events, '   ')).toEqual([]);
  });
});
