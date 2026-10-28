export interface Interval {
  start: number;
  end: number;
}

/**
 * Greedy interval-graph colouring: put each interval in the lowest lane whose last occupant ended
 * at least `gap` before it starts. Returns one lane index per input, in input order.
 * Optimal for intervals (lane count = max overlap) when processed by start.
 */
export function assignLanes(intervals: Interval[], gap = 0): number[] {
  const order = intervals
    .map((iv, i) => ({ iv, i }))
    .sort((a, b) => a.iv.start - b.iv.start || a.iv.end - b.iv.end);
  const laneEnds: number[] = [];
  const result = new Array<number>(intervals.length);
  for (const { iv, i } of order) {
    let lane = laneEnds.findIndex((end) => end + gap <= iv.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(iv.end);
    } else {
      laneEnds[lane] = iv.end;
    }
    result[i] = lane;
  }
  return result;
}
