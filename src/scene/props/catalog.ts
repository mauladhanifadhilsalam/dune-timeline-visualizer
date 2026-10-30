import { ARRAKEEN_FIELD } from './arrakeen';
import { RIVER_FOOTPRINT } from './river';
import { SIETCH_MOUTH } from './sietch';
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
  | 'sareer-citadel'
  | 'storm'
  | 'shield-breach'
  | 'thumper'
  | 'desert-walk'
  | 'idaho-river'
  | 'smuggler-crawler'
  | 'sietch'
  | 'pilgrims'
  | 'no-ship'
  | 'scattering-fleet'
  | 'atreides-landing'
  | 'preacher'
  | 'arrakeen-falls'
  | 'sietch-raid'
  | 'sandtrout-run'
  | 'wedding'
  | 'rakis-burning';

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
  /**
   * A scene rather than a landmark: shown only while the camera is within this many events of its
   * own (inside its eras), so the many scenes of a crowded novel need not all fit at once.
   */
  moment?: number;
  /**
   * Stands inside another piece rather than on ground of its own: in the frame of the first piece
   * of this kind, at this offset, and is not placed. Its footprint is the ground it uses there.
   */
  site?: { in: PieceKind; x: number; z: number };
  /**
   * The camera turns to face it when its event is chosen, for a scene the event's usual view
   * would have behind it (one on the camera's side of the path). The next event turns back.
   */
  turn?: boolean;
  /**
   * A scene that plays out from the viewer's arrival, which a guided tour stays at its event to see
   * through rather than leave halfway: what it waits for, completing "The tour stays here …". The
   * scene itself says how long that takes.
   */
  hold?: string;
  /** Preferred distance into the background; placement may push it further or slide it along. */
  lateral: number;
  /**
   * 'near': on the camera's side of the path instead, out beyond where the camera rides, so it
   * fills the other half of the map: seen from the overview or when looking round, not in the
   * frame an event opens on. `lateral` is then the distance out on that side.
   */
  side?: 'near';
  /**
   * Preferred slide along the path from the event; positive is ahead, which is the right of the
   * frame the event opens on. Placement searches around it.
   */
  along?: number;
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


/**
 * Every set piece in the world, in the order placement solves them: pieces that belong close to
 * their own event first, far-off and flexible ones (the storm, the worms) last. Each is pinned to
 * an event and shown only in the eras the books put it in.
 */
export const SET_PIECES: SetPiece[] = [
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
    kind: 'idaho-river',
    event: 'leto-death',
    eras: ['god-emperor'],
    // Its bend about 150 behind the event, across a plain the camera can see over; slid along so
    // the bridge stands left of the event's light, in the part of the view its card leaves free.
    along: 70,
    lateral: 245,
    footprint: RIVER_FOOTPRINT,
    label: { title: 'The Idaho River', sub: 'where the God Emperor fell', height: 34 },
    note: "The Idaho River, where Leto II's wedding procession is ambushed: the bridge is cut, he falls into the water, and his body breaks apart into sandtrout.",
  },
  {
    kind: 'sareer-citadel',
    event: 'arrakis-green',
    eras: ['god-emperor'],
    // Deep behind the path, leaving the ground in front to the river: a walled desert with a
    // tower in it reads from far off.
    lateral: 480,
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
    // The Jihad setting out, over its first years, rather than through Leto II's childhood too.
    moment: 3,
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
    kind: 'preacher',
    event: 'preacher-arrives',
    eras: ['atreides-empire'],
    moment: 1,
    lateral: 150,
    footprint: [
      { x: 0, z: -40, r: 60 },
      { x: 0, z: 20, r: 80 },
    ],
    pad: { tint: '#b09a78', amount: 0.8 },
    padRadius: 92,
    label: { title: 'The Preacher', sub: "in the plaza before Alia's temple", height: 52 },
    note: "The Preacher: blind Paul come back out of the desert, led by a boy, preaching against the priesthood raised in his own name to a throng in the plaza before Alia's temple in Arrakeen, on whose steps he is killed.",
  },
  {
    kind: 'desert-walk',
    event: 'paul-walks-desert',
    eras: ['atreides-empire'],
    // Only around its own event, so it never shares the screen, or the ground, with the Preacher.
    moment: 0,
    // On the open right of the frame, away from the Jihad's fleet on the left, and clear of
    // where the path turns back on itself just beyond.
    along: 90,
    lateral: 75,
    // His line of footprints, from near the path out toward the horizon.
    footprint: [0, 0.25, 0.5, 0.75, 1].map((k) => ({ x: 12 - 20 * k, z: 35 - 70 * k, r: 14 })),
    note: 'Paul, blind, walking alone into the deep desert as Fremen custom asks of the blind, his footprints filling with sand behind him.',
  },
  {
    kind: 'thumper',
    event: 'first-worm-ride',
    eras: ['muaddib'],
    moment: 1,
    lateral: 150,
    // The maker's loop (130 along by 70 across, plus its body); the thumper stands at its near edge.
    footprint: [-85, 0, 85].map((x) => ({ x, z: 0, r: 95 })),
    worm: { scale: 1.1, loopAlong: 130, loopAcross: 70, speed: 24, phase: 120, ridden: true },
    note: "A thumper drumming to call a maker for Paul's sandrider test, and the maker it called: a rider stands on its back behind maker hooks, which hold it at the surface.",
  },
  {
    kind: 'shield-breach',
    event: 'battle-of-arrakeen',
    eras: ['muaddib'],
    moment: 1,
    // The tour stays until the Fremen have broken into the Emperor's camp.
    hold: "until the Fremen reach the Emperor's camp",
    lateral: 360,
    footprint: [-200, -100, 0, 100, 200].map((x) => ({ x, z: 0, r: 70 })),
    label: { title: 'The Shield Wall', sub: 'breached by family atomics', height: 70 },
    note: "The Shield Wall, opened with the Atreides family atomics for the Battle of Arrakeen: the wall comes down, the great storm pours through, and the Fremen ride in behind it on maker-back to fall on the Emperor's camp.",
  },
  {
    kind: 'imperial-camp',
    event: 'battle-of-arrakeen',
    eras: ['muaddib'],
    moment: 1,
    lateral: 130,
    footprint: [{ x: 0, z: 0, r: 85 }],
    label: { title: "The Emperor's camp", height: 26 },
    note: "The Emperor's frigates and metal hut on the plain, where the Fremen strike under the storm.",
  },
  {
    kind: 'harvester',
    event: 'harkonnens-take-arrakis',
    // The Harkonnen years only: in Dune's own stretch its ground is Arrakeen's.
    eras: ['imperium'],
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
    eras: ['muaddib'],
    // The knife of the duel, so it shows around the duel, not through all of Dune.
    moment: 1,
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
    kind: 'storm',
    event: 'stilltent-awakening',
    eras: ['muaddib'],
    moment: 1,
    // Far out on the horizon: it is hundreds of kilometres across in the book.
    lateral: 900,
    footprint: [{ x: 0, z: 0, r: 340 }],
    label: { title: 'Coriolis storm', height: 90 },
    note: 'A Coriolis storm, one of the great sandstorms of Arrakis. Escaping the Harkonnens, Paul flies their ornithopter into one to shake off pursuit.',
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

  // Life on the other half of the map, and in the empty ground of the late eras. Placed last, so
  // they take what room is left.
  {
    kind: 'rakis-burning',
    event: 'rakis-destroyed',
    eras: ['return'],
    moment: 1,
    // Behind Chapterhouse's young worms: its smoke reads from far off.
    lateral: 280,
    footprint: [{ x: 0, z: 0, r: 120 }],
    label: { title: 'Rakis burning', sub: 'the Honored Matres destroy it', height: 40 },
    note: 'Rakis destroyed by the Honored Matres: the city of Keen in ruins and burning, their attack ships passing low over it, and the planet left fused glass.',
  },
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
    kind: 'worm',
    event: 'harkonnens-take-arrakis',
    eras: ['imperium'],
    lateral: 260,
    footprint: [{ x: 0, z: 0, r: 118 }],
    worm: { scale: 0.8, loopAlong: 110, loopAcross: 60, speed: 18, phase: 0 },
    note: 'Worm sign near the harvester.',
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
    kind: 'smuggler-crawler',
    event: 'water-of-life',
    // Smugglers worked Arrakis for generations under the Harkonnens before Gurney joined them.
    eras: ['imperium', 'muaddib'],
    side: 'near',
    lateral: 300,
    footprint: [{ x: 0, z: 0, r: 60 }],
    pad: { tint: '#a8471f', amount: 0.6 },
    padRadius: 52,
    note: "Smugglers working a spice field on the quiet, with no carryall to spare: the free traders who have run spice under the Harkonnens' noses for generations, whom Gurney Halleck falls in with after the fall of House Atreides, and whose crawler Paul's Fremen fall on before he drinks the Water of Life, finding Gurney again.",
  },
  {
    kind: 'sietch',
    event: 'jamis-duel',
    eras: ['muaddib', 'atreides-empire'],
    side: 'near',
    lateral: 300,
    footprint: [
      { x: 0, z: 0, r: 84 },
      { x: 165, z: 30, r: 40 },
      { x: 270, z: 90, r: 34 },
    ],
    label: { title: 'Sietch Tabr', sub: "Stilgar's cave-warren", height: 50 },
    note: "Sietch Tabr, Stilgar's cave-warren in the rock, where Paul and Jessica are taken in after the duel with Jamis. A band of Fremen comes in off the sand in the sandwalk, stepping without rhythm so no worm hears them.",
  },
  {
    kind: 'worm',
    event: 'preacher-arrives',
    eras: ['atreides-empire'],
    side: 'near',
    lateral: 320,
    footprint: [{ x: 0, z: 0, r: 118 }],
    worm: { scale: 0.9, loopAlong: 110, loopAcross: 60, speed: 20, phase: 80, reverse: true },
    note: 'A wild maker in the deep desert of Children of Dune, where the blind Preacher wanders.',
  },
  {
    kind: 'scattering-fleet',
    event: 'scattering',
    eras: ['scattering'],
    along: 60,
    lateral: 200,
    footprint: [
      { x: -70, z: -10, r: 85 },
      { x: 70, z: -10, r: 85 },
    ],
    pad: { tint: '#4b443d', amount: 0.6 },
    padRadius: 150,
    note: "Ships of the Scattering lifting off: after Leto II's death, humanity flees outward into the unknown universe, beyond the reach of any one prescience.",
  },
  {
    kind: 'pilgrims',
    event: 'sheeana',
    eras: ['return'],
    side: 'near',
    lateral: 280,
    footprint: [-120, 0, 120].map((x) => ({ x, z: 0, r: 70 })),
    note: "Pilgrims crossing the sand to Keen to worship Leto II as the Divided God, with one of the Rakian Priesthood's ornithopters overhead: Rakis in Heretics of Dune.",
  },
  {
    kind: 'no-ship',
    event: 'no-ship-escape',
    eras: ['return'],
    along: 80,
    lateral: 230,
    footprint: [
      { x: -50, z: 0, r: 60 },
      { x: 50, z: 0, r: 60 },
    ],
    pad: { tint: '#6d6258', amount: 0.5 },
    padRadius: 110,
    label: { title: 'The no-ship', sub: 'invisible to prescience, not to eyes', height: 62 },
    note: "The no-ship on Chapterhouse's landing field, where Duncan Idaho and Sheeana are kept, and in which they escape at the end of Chapterhouse: Dune.",
  },
  {
    kind: 'atreides-landing',
    event: 'atreides-arrive',
    eras: ['muaddib'],
    moment: 1,
    hold: 'until the Atreides frigates are down and their banners up',
    // On Arrakeen's own landing field.
    site: { in: 'arrakeen', x: ARRAKEEN_FIELD.x, z: ARRAKEEN_FIELD.z },
    lateral: 0,
    footprint: [{ x: 0, z: 0, r: ARRAKEEN_FIELD.r }],
    note: "House Atreides comes down to Arrakeen to take the fief from the Harkonnens: its frigates landing one after another on the city's field, and the Atreides banners run up the poles once the first is down.",
  },
  {
    kind: 'arrakeen-falls',
    event: 'fall-of-arrakeen',
    eras: ['muaddib'],
    moment: 1,
    hold: "until the Harkonnen frigates are down on the city's field",
    // In the city itself.
    site: { in: 'arrakeen', x: 0, z: 0 },
    lateral: 0,
    footprint: [{ x: 0, z: 0, r: 150 }],
    note: "The fall of House Atreides: Harkonnen troops and the Emperor's Sardaukar take Arrakeen in the night, fires burning through the city as their frigates come down on its field.",
  },
  {
    kind: 'sietch-raid',
    event: 'sietch-tabr-raid',
    eras: ['muaddib'],
    moment: 1,
    // At the mouth of Sietch Tabr, on the camera's side of the path: the camera turns round to it.
    site: { in: 'sietch', x: SIETCH_MOUTH.x, z: SIETCH_MOUTH.z },
    turn: true,
    lateral: 0,
    footprint: [{ x: 0, z: 0, r: 30 }],
    note: "The Sardaukar raid on Sietch Tabr while its fighters are away: smoke pouring from the cave-mouth, and Paul's first son among the dead.",
  },
  {
    kind: 'sandtrout-run',
    event: 'sandtrout-skin',
    eras: ['atreides-empire'],
    moment: 1,
    lateral: 125,
    // His run, across the view.
    footprint: [-150, -75, 0, 75, 150].map((x) => ({ x, z: -40, r: 26 })),
    note: 'Leto II in the sandtrout skin: the living membrane gives him strength and speed no man has, and he runs across the open sand faster than any animal.',
  },
  {
    kind: 'wedding',
    event: 'hwi-noree',
    eras: ['god-emperor'],
    // Only around its own event: by Leto II's death the bridge is cut.
    moment: 0,
    // On the Royal Road through the river's bridge.
    site: { in: 'idaho-river', x: 0, z: 0 },
    lateral: 0,
    footprint: [{ x: 0, z: 0, r: 30 }],
    note: "The wedding procession of Leto II and Hwi Noree: the Royal Cart at its head and his Fish Speakers behind, on the road to the bridge over the Idaho River, where it will be ambushed.",
  },
];
