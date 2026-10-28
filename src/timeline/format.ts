import type { Category, Certainty, Mode, NovelId, Year } from '../data/types';

/**
 * -201 → "201 BG", 10191 → "10,191". Herbert writes B.G. but never A.G.: later years are bare,
 * as in Appendix IV. Year 0 is the Guild's founding.
 */
export function formatYear(year: Year): string {
  const y = Math.round(year);
  if (y === 0) return 'Year 0';
  return y < 0 ? `${(-y).toLocaleString('en-US')} BG` : y.toLocaleString('en-US');
}

export function formatRange(start: Year, end: Year | undefined, approx = false): string {
  const c = approx ? 'c. ' : '';
  if (end === undefined || Math.round(end) === Math.round(start)) return c + formatYear(start);
  const s = Math.round(start);
  const e = Math.round(end);
  // Same side of the epoch: "201–108 BG" instead of "201 BG–108 BG".
  if (s < 0 && e < 0) return `${c}${(-s).toLocaleString('en-US')}–${(-e).toLocaleString('en-US')} BG`;
  if (s > 0 && e > 0) return `${c}${s.toLocaleString('en-US')}–${e.toLocaleString('en-US')}`;
  return `${c}${formatYear(s)} – ${formatYear(e)}`;
}

/**
 * One categorical slot per novel, in publication order. Steps come from the dataviz reference
 * palette's dark column, re-ordered so each novel sits next to its neighbours in time
 * (spice orange, Ibad blue, …). Validated adjacent-pair against the dusk surface #1c1424:
 * worst CVD ΔE 8.4, worst normal-vision ΔE 19.3, all ≥ 3:1. Labels always carry the novel's
 * short name too, so identity never rests on colour alone.
 */
export const NOVEL_COLOR: Record<NovelId, string> = {
  dune: '#d95926',
  messiah: '#3987e5',
  children: '#199e70',
  'god-emperor': '#c98500',
  heretics: '#d55181',
  chapterhouse: '#9085e9',
};

export const CERTAINTY_LABEL: Record<Certainty, string> = {
  stated: 'Year stated',
  derived: 'Year derived',
  reckoned: 'Year reckoned',
};

export const CERTAINTY_BLURB: Record<Certainty, string> = {
  stated: 'The novel or its appendices print this year.',
  derived: 'Computed from intervals, ages or life dates the text does print.',
  reckoned: 'The text gives only loose relative time; the year is a reconstruction. Treat as ± years or decades.',
};

export const MODE_LABEL: Record<Mode, string> = {
  depicted: 'On the page',
  recalled: 'Recalled history',
};

export const MODE_BLURB: Record<Mode, string> = {
  depicted: 'Happens in the narrative itself.',
  recalled: 'Reported by an in-universe source, with whatever bias that source carries.',
};

export const CATEGORY_LABEL: Record<Category, string> = {
  conflict: 'War & conflict',
  politics: 'Houses & politics',
  orders: 'Orders & faiths',
  ecology: 'Arrakis & ecology',
  machines: 'Machines & technology',
  people: 'Births & deaths',
};

export const CATEGORY_GLYPH: Record<Category, string> = {
  conflict: '⚔',
  politics: '♛',
  orders: '☉',
  ecology: '❂',
  machines: '⚙',
  people: '✦',
};
