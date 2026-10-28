import type { WormOptions } from './sandworm';

/** A circle of ground a piece occupies, in its local frame (x along the path, -z away from it). */
export interface Circle {
  x: number;
  z: number;
  r: number;
}

export type PieceKind =
  | 'heighliner'
  | 'arrakeen'
  | 'imperial-camp'
  | 'harvester'
  | 'wreckage'
  | 'crysknife'
  | 'spice-blow'
  | 'worm'
  | 'jihad-fleet'
  | 'keep'
  | 'sareer-citadel';

export interface SetPiece {
  kind: PieceKind;
  /** Event the piece belongs to; it stands beside that event's light. */
  event: string;
  /**
   * Eras (by id) during which the piece is there. The path snakes, so another era's pieces would
   * otherwise stand on the horizon; outside these eras it sinks into the sand (or, in the sky,
   * climbs away) as the camera moves on.
   */
  eras: string[];
  /** Preferred distance into the background; placement may push it further or slide it along. */
  lateral: number;
  /** For things in the sky: height above the path. */
  lift?: number;
  footprint: Circle[];
  /** A flattened, tinted disc of ground under it (city, spice field). */
  pad?: { tint: string; amount: number };
  /** Radius of that pad, when it differs from the first footprint circle. */
  padRadius?: number;
  /** Survives true scale, where everything grounded would pile into one spot. */
  keepInTrueScale?: boolean;
  worm?: WormOptions;
  /** A name shown on the piece in the scene, `height` units above its base. */
  label?: { title: string; sub?: string; height: number };
  /** Why it is here, in the books' terms. */
  note: string;
}

const ARRAKIS = ['imperium', 'muaddib', 'atreides-empire'];

/**
 * Every set piece in the world, in the order placement solves them (big ones first). Each is
 * pinned to an event and shown only in the eras the books put it in.
 */
export const SET_PIECES: SetPiece[] = [
  {
    kind: 'heighliner',
    event: 'guild-monopoly',
    eras: ['schools', 'imperium'],
    lateral: 320,
    lift: 34,
    footprint: [-220, -110, 0, 110, 220].map((x) => ({ x, z: 0, r: 60 })),
    keepInTrueScale: true,
    label: { title: 'Guild heighliner', height: 40 },
    note: 'The Spacing Guild monopoly, year zero of the calendar: no ship moves without a heighliner.',
  },
  {
    kind: 'arrakeen',
    event: 'atreides-arrive',
    eras: ['muaddib', 'atreides-empire'],
    lateral: 210,
    footprint: [
      { x: 0, z: 0, r: 155 },
      { x: -180, z: -235, r: 80 },
      { x: 0, z: -235, r: 80 },
      { x: 180, z: -235, r: 80 },
    ],
    pad: { tint: '#8d7a66', amount: 0.55 },
    label: { title: 'Arrakeen', sub: 'and the Shield Wall', height: 70 },
    note: "Arrakeen and the Shield Wall: the Atreides seat, later Muad'Dib's capital.",
  },
  {
    kind: 'sareer-citadel',
    event: 'arrakis-green',
    eras: ['god-emperor'],
    lateral: 320,
    // The walled Sareer plus a margin for the wall towers.
    footprint: [{ x: 0, z: 0, r: 200 }],
    pad: { tint: '#b98a5a', amount: 0.15 },
    padRadius: 66,
    label: { title: "Leto II's Citadel", sub: 'the Sareer · his journals later dug up at Dar-es-Balat', height: 95 },
    note: "Leto II's Citadel in the Sareer, the walled desert he kept on a green Arrakis. The journals the novel is built around are excavated at Dar-es-Balat on Rakis some 1,500 years later.",
  },
  {
    kind: 'jihad-fleet',
    event: 'muaddib-jihad',
    eras: ['atreides-empire'],
    lateral: 190,
    footprint: [
      { x: -70, z: -10, r: 85 },
      { x: 70, z: -10, r: 85 },
    ],
    pad: { tint: '#4b443d', amount: 0.6 },
    padRadius: 150,
    label: { title: 'The Jihad sets out', sub: 'under the green and black', height: 60 },
    note: "Atreides ships lifting off under the green and black banner Paul sees at the head of his jihad's legions in Dune.",
  },
  {
    kind: 'keep',
    event: 'alia-regency',
    eras: ['atreides-empire'],
    lateral: 380,
    footprint: [{ x: 0, z: 0, r: 85 }],
    pad: { tint: '#7d6a55', amount: 0.4 },
    padRadius: 82,
    // Names on tall buildings sit partway up, where the camera can see them, not on the spire.
    label: { title: 'The Keep', sub: "seat of Alia's regency", height: 70 },
    note: "The Keep in Arrakeen, Muad'Dib's fortress, from which Alia rules as regent for the twins.",
  },
  {
    kind: 'imperial-camp',
    event: 'battle-of-arrakeen',
    eras: ['muaddib'],
    lateral: 130,
    footprint: [{ x: 0, z: 0, r: 85 }],
    label: { title: "The Emperor's camp", height: 26 },
    note: "The Emperor's frigates and metal hut on the plain, where the Fremen strike under the storm.",
  },
  {
    kind: 'harvester',
    event: 'harkonnens-take-arrakis',
    eras: ['imperium', 'muaddib'],
    lateral: 140,
    footprint: [{ x: 0, z: 0, r: 105 }],
    pad: { tint: '#b3431a', amount: 0.75 },
    label: { title: 'Spice harvester', sub: 'and carryall', height: 76 },
    note: 'A spice harvester and its carryall on a spice field: eighty years of Harkonnen mining.',
  },
  {
    kind: 'wreckage',
    event: 'butlerian-jihad',
    eras: ['before-jihad', 'jihad', 'schools'],
    lateral: 100,
    footprint: [
      { x: -100, z: -40, r: 60 },
      { x: 0, z: -40, r: 60 },
      { x: 100, z: -40, r: 60 },
    ],
    note: 'Thinking-machine wreckage: what the Great Revolt left in the sand.',
  },
  {
    kind: 'crysknife',
    event: 'jamis-duel',
    eras: ['muaddib', 'atreides-empire'],
    lateral: 85,
    footprint: [{ x: 0, z: 0, r: 16 }],
    note: "A crysknife, the Fremen blade made from a sandworm's tooth, as in Paul's duel with Jamis.",
  },
  {
    kind: 'spice-blow',
    event: 'kynes-dies',
    eras: ['muaddib'],
    lateral: 90,
    footprint: [{ x: 0, z: 0, r: 24 }],
    note: 'A spice blow, the eruption that swallows the dying Liet-Kynes.',
  },
  {
    kind: 'worm',
    event: 'harkonnens-take-arrakis',
    eras: ARRAKIS,
    lateral: 260,
    footprint: [{ x: 0, z: 0, r: 118 }],
    worm: { scale: 0.8, loopAlong: 110, loopAcross: 60, speed: 18, phase: 0 },
    note: 'Worm sign near the harvester.',
  },
  {
    kind: 'worm',
    event: 'first-worm-ride',
    eras: ARRAKIS,
    lateral: 120,
    footprint: [{ x: 0, z: 0, r: 139 }],
    worm: { scale: 1.1, loopAlong: 130, loopAcross: 70, speed: 24, phase: 120 },
    note: 'A great maker, like the one Paul calls and rides.',
  },
  {
    kind: 'worm',
    event: 'battle-of-arrakeen',
    eras: ARRAKIS,
    lateral: 150,
    footprint: [{ x: 0, z: 0, r: 128 }],
    worm: { scale: 0.95, loopAlong: 120, loopAcross: 55, speed: 26, phase: 40 },
    note: 'Fremen worm-riders charging the Imperial camp.',
  },
  {
    kind: 'worm',
    event: 'sheeana',
    // None in Leto II's reign: he is the last worm. They return on Rakis.
    eras: ['scattering', 'return'],
    lateral: 110,
    footprint: [{ x: 0, z: 0, r: 118 }],
    worm: { scale: 0.9, loopAlong: 110, loopAcross: 60, speed: 20, phase: 200 },
    note: "The worms of Rakis, each carrying a pearl of Leto II's awareness, which Sheeana can walk among.",
  },
  {
    kind: 'worm',
    event: 'chapterhouse-desert',
    eras: ['return'],
    lateral: 60,
    footprint: [{ x: 0, z: 0, r: 48 }],
    worm: { scale: 0.32, loopAlong: 45, loopAcross: 28, speed: 9, phase: 0 },
    note: "The first young worms of Chapterhouse's new desert.",
  },
];
