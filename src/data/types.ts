/**
 * Years are signed integers on the Imperial calendar: negative = B.G. (Before Guild),
 * zero and positive = A.G. (After Guild). The epoch is the founding of the Spacing Guild monopoly.
 */
export type Year = number;

/** Frank Herbert's six novels, in publication order (which is also chronological order). */
export type NovelId = 'dune' | 'messiah' | 'children' | 'god-emperor' | 'heretics' | 'chapterhouse';

/**
 * How much weight the date can bear.
 * - stated: the year (or the exact interval) is printed in the novel or its appendices
 * - derived: computed from things the text does print ("twelve years", ages, life dates)
 * - reckoned: the text only gives loose relative time ("some 1,500 years"); the year is a
 *   reader's reconstruction and could be off by years or decades
 */
export type Certainty = 'stated' | 'derived' | 'reckoned';

/**
 * Herbert tells most of his history second-hand. "depicted" happens on the page;
 * "recalled" is reported by someone — a glossary entry, an epigraph, Leto II's journals,
 * a Bene Gesserit archive — and inherits that narrator's agenda.
 */
export type Mode = 'depicted' | 'recalled';

export type Category = 'conflict' | 'politics' | 'orders' | 'ecology' | 'machines' | 'people';

/**
 * Herbert's own text disagrees on when Paul's reign starts: the page has Shaddam deposed at the
 * battle of 10193, Appendix IV has a regency in Irulan's name from 10196. Every later date in the
 * novels is a stated interval counted from it, so the choice moves all of them.
 */
export type Reckoning = 'battle' | 'almanak';

export interface Era {
  id: string;
  numeral: string;
  name: string;
  start: Year;
  end: Year;
  /** True when the boundary years are themselves approximate. */
  approx: boolean;
  blurb: string;
  /** When the era starts mid-year, the first event that belongs to it (the gate goes just before). */
  firstEvent?: string;
  /** Start/end are counted from Paul's accession and move with the reckoning. */
  shiftStart?: boolean;
  shiftEnd?: boolean;
}

export interface TimelineEvent {
  id: string;
  title: string;
  year: Year;
  /** For events that are spans (wars, reigns). Inclusive. */
  endYear?: Year;
  approx?: boolean;
  certainty: Certainty;
  mode: Mode;
  /** The novel this comes from (for recalled history: the novel whose pages report it). */
  novel: NovelId;
  /** Who is telling us, when it is not the narrative itself. */
  via?: string;
  category: Category;
  /** 3 = saga-defining, 2 = major, 1 = context. Drives size and label priority. */
  importance: 1 | 2 | 3;
  summary: string;
  people?: string[];
  /** Year (and end) are counted from Paul's accession and move with the reckoning. */
  shift?: boolean;
  /** Only the end of the span moves with the reckoning. */
  shiftEnd?: boolean;
  /** Remark about the date itself, shown beside it. */
  dateNote?: string;
  /** Where it happens, by place on the map of Arrakis (data/arrakis.ts), when the book says. */
  places?: string[];
}

/** Two of Herbert's own statements that cannot both be true as written. */
export interface Contradiction {
  id: string;
  a: string;
  b: string;
  title: string;
  note: string;
}

export interface Novel {
  id: NovelId;
  title: string;
  short: string;
  published: number;
  /** In-story span the main narrative covers. */
  start: Year;
  end: Year;
  approx: boolean;
  blurb: string;
  shift?: boolean;
}

export interface LifeSegment {
  start: Year;
  end: Year;
  label?: string;
  approx?: boolean;
  /** Birth (or first existence) is not dated in the novels; drawn as a fading lead-in. */
  openStart?: boolean;
  /** Pin the segment's ends to a timeline event, so a death lands exactly on its marker. */
  startAt?: string;
  endAt?: string;
  shiftStart?: boolean;
  shiftEnd?: boolean;
}

/** Things the novels mention but never date. They cannot honestly be placed on an axis. */
export interface UndatedNote {
  title: string;
  novel: NovelId;
  note: string;
}

export interface Lifeline {
  id: string;
  name: string;
  segments: LifeSegment[];
  note: string;
}
