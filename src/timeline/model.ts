import type {
  Contradiction,
  Era,
  Lifeline,
  Novel,
  Reckoning,
  TimelineEvent,
  Year,
} from '../data/types';
import { linearScale, narrativeScale, type Scale } from './scale';

/** Year Paul's reign is counted from, under each reading of Herbert's text. */
export const ACCESSION: Record<Reckoning, Year> = { battle: 10193, almanak: 10196 };
const BASE = ACCESSION.battle;

/** Data files write accession-relative years for the 'battle' reading; this moves them. */
export function shiftFor(reckoning: Reckoning): number {
  return ACCESSION[reckoning] - BASE;
}

/** Fraction of a year an inclusive span end reaches, so "to 10214" covers events dated 10214. */
const INCLUSIVE = 0.999;

export interface TimelineInput {
  eras: Era[];
  events: TimelineEvent[];
  novels: Novel[];
  lifelines: Lifeline[];
  contradictions: Contradiction[];
}

export interface ResolvedEvent extends TimelineEvent {
  /** Year under the active reckoning (what the UI prints). */
  y: Year;
  yEnd?: Year;
  /** Position in fractional "story time": same-year events are spread across the year in order. */
  s: number;
  sEnd: number;
  eraIndex: number;
}

export interface ResolvedSpan {
  y0: Year;
  y1: Year;
  s0: number;
  s1: number;
}

export interface ResolvedEra extends Era, ResolvedSpan {}
export interface ResolvedNovel extends Novel, ResolvedSpan {}
export interface ResolvedLifeline extends Lifeline {
  spans: (ResolvedSpan & { label?: string; approx?: boolean; openStart?: boolean })[];
}

export interface Resolved {
  reckoning: Reckoning;
  events: ResolvedEvent[];
  byId: Map<string, ResolvedEvent>;
  eras: ResolvedEra[];
  novels: ResolvedNovel[];
  lifelines: ResolvedLifeline[];
  contradictions: Contradiction[];
  /** Story-time extent of the whole axis. */
  min: number;
  max: number;
  narrative: Scale;
  linear: Scale;
}

/**
 * Extra room on the story scale, by era: each step between events there is this many times an
 * ordinary one. Dune, and Messiah with Children of Dune, pack sixteen events each into two or three
 * years and carry most of the scenery, so they are given the most path; Leto II's reign has few
 * events but the two largest pieces, the Sareer and the Idaho River.
 */
const ROOM: Record<string, number> = { muaddib: 2, 'atreides-empire': 1.5, 'god-emperor': 1.5 };

export function resolve(input: TimelineInput, reckoning: Reckoning): Resolved {
  const d = shiftFor(reckoning);

  // 1. Years under this reckoning.
  const evs = input.events.map((e) => {
    const y = e.shift ? e.year + d : e.year;
    const yEnd = e.endYear === undefined ? undefined : e.shift || e.shiftEnd ? e.endYear + d : e.endYear;
    return { e, y, yEnd };
  });

  // 2. Story time: spread events that share a year across it, in array (= story) order.
  const counts = new Map<number, number>();
  for (const { y } of evs) counts.set(y, (counts.get(y) ?? 0) + 1);
  const seen = new Map<number, number>();
  const byId = new Map<string, ResolvedEvent>();
  const events: ResolvedEvent[] = evs.map(({ e, y, yEnd }) => {
    const n = counts.get(y)!;
    const k = seen.get(y) ?? 0;
    seen.set(y, k + 1);
    const s = y + (k + 0.5) / (n + 0.5);
    const sEnd = yEnd === undefined ? s : Math.max(s, yEnd + INCLUSIVE);
    const r: ResolvedEvent = { ...e, y, yEnd, s, sEnd, eraIndex: -1 };
    byId.set(e.id, r);
    return r;
  });

  // 3. Era boundaries. A mid-year boundary sits halfway between its first event and the one before.
  const eraStart = (era: Era): number => {
    const y = era.shiftStart ? era.start + d : era.start;
    if (!era.firstEvent) return y;
    const idx = events.findIndex((e) => e.id === era.firstEvent);
    if (idx < 0) throw new Error(`Era ${era.id}: unknown firstEvent ${era.firstEvent}`);
    const first = events[idx];
    const prev = events[idx - 1];
    if (!prev || Math.floor(prev.s) < Math.floor(first.s)) return Math.min(y, first.s);
    return (prev.s + first.s) / 2;
  };
  const starts = input.eras.map(eraStart);
  const last = input.eras[input.eras.length - 1];
  const finalEnd = (last.shiftEnd ? last.end + d : last.end) + INCLUSIVE;
  const eras: ResolvedEra[] = input.eras.map((era, i) => ({
    ...era,
    y0: era.shiftStart ? era.start + d : era.start,
    y1: era.shiftEnd ? era.end + d : era.end,
    s0: starts[i],
    s1: i + 1 < starts.length ? starts[i + 1] : finalEnd,
  }));
  for (const e of events) {
    e.eraIndex = eras.findIndex((era) => e.s >= era.s0 && e.s < era.s1);
  }

  // 4. Spans for novels and lifelines.
  const novels: ResolvedNovel[] = input.novels.map((n) => {
    const y0 = n.shift ? n.start + d : n.start;
    const y1 = n.shift ? n.end + d : n.end;
    return { ...n, y0, y1, s0: y0, s1: y1 + INCLUSIVE };
  });
  const lifelines: ResolvedLifeline[] = input.lifelines.map((l) => ({
    ...l,
    spans: l.segments.map((seg) => {
      const y0 = seg.shiftStart ? seg.start + d : seg.start;
      const y1 = seg.shiftEnd ? seg.end + d : seg.end;
      const a = seg.startAt ? byId.get(seg.startAt) : undefined;
      const b = seg.endAt ? byId.get(seg.endAt) : undefined;
      return {
        y0,
        y1,
        s0: a ? a.s : y0,
        s1: b ? b.s : y1 + INCLUSIVE,
        label: seg.label,
        approx: seg.approx,
        openStart: seg.openStart,
      };
    }),
  }));

  const min = eras[0].s0;
  const max = eras[eras.length - 1].s1;
  const eraAt = (year: number) => {
    let i = eras.length - 1;
    while (i > 0 && eras[i].s0 > year) i--;
    return eras[i].id;
  };
  const narrative = narrativeScale(
    events.flatMap((e) => (e.sEnd > e.s ? [e.s, e.sEnd] : [e.s])),
    eras.map((e) => e.s0).concat(max),
    { stepWeight: (year) => ROOM[eraAt(year)] ?? 1 },
  );
  const linear = linearScale(min, max);

  return {
    reckoning,
    events,
    byId,
    eras,
    novels,
    lifelines,
    contradictions: input.contradictions,
    min,
    max,
    narrative,
    linear,
  };
}
