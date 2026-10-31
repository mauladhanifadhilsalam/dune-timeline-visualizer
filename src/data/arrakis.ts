/**
 * Arrakis's north polar regions, after the map and the Cartographic Notes in *Dune*. The names,
 * where they lie relative to one another and every stated altitude come from the book; the relief
 * that joins them (how wide a ridge is, how a basin slopes, everything the map does not say) is
 * this project's own reading, drawn for a model rather than traced from the map.
 *
 * Positions are on the book's polar projection: the north pole at the origin, `u` to the right and
 * `v` up the page, in units of the radius of its 60° line. Up the page is away from the pole, so
 * south: Arrakeen and the Shield Wall lie up and to the right, the Great Flat to the left.
 */

export type PlaceKind =
  | 'city'
  | 'village'
  | 'sietch'
  | 'cave'
  | 'shrine'
  | 'peak'
  | 'ridge'
  | 'rock'
  | 'pass'
  | 'basin'
  | 'depression'
  | 'region'
  | 'pole'
  | 'pointer';

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  at: [number, number];
  /** Metres above the Great Bled, as the map or the Cartographic Notes give it. */
  alt?: number;
  /** Shown with the altitude when the book gives a bound rather than a height. */
  altNote?: string;
  /** What the book says of it, in brief. */
  note?: string;
}

export const PLACES: Place[] = [
  // ── The Arrakeen side of the Shield Wall ──────────────────────────────────────────────
  {
    id: 'arrakeen',
    name: 'Arrakeen',
    kind: 'city',
    at: [0.42, 0.87],
    note: "The Atreides seat on Arrakis, under the Shield Wall; later Muad'Dib's capital.",
  },
  { id: 'carthag', name: 'Carthag', kind: 'city', at: [0.2, 0.76], note: 'About 200 km north-east of Arrakeen.' },
  { id: 'arsunt', name: 'Arsunt', kind: 'village', at: [0.08, 0.75] },
  { id: 'tsimpo', name: 'Tsimpo', kind: 'village', at: [0.07, 0.8] },
  { id: 'imperial-basin', name: 'Imperial Basin', kind: 'region', at: [0.34, 0.6] },
  { id: 'hagga-basin', name: 'Hagga Basin', kind: 'basin', at: [0.02, 0.62], alt: 200 },
  // The map's label is partly illegible in the photograph this was taken from: 8110 or 8510.
  {
    id: 'observatory-mt',
    name: 'Observatory Mt.',
    kind: 'peak',
    at: [0.08, 0.98],
    alt: 8110,
    note: 'The meridian through it is the zero of longitude.',
  },
  { id: 'broken-land', name: 'Broken Land', kind: 'region', at: [0.05, 0.88], alt: 4600 },
  {
    id: 'old-gap',
    name: 'Old Gap',
    kind: 'pass',
    at: [0.38, 0.93],
    alt: 2240,
    altNote: 'down to',
    note: "A crevasse in the Arrakeen Shield Wall, blasted out by Paul Muad'Dib.",
  },
  {
    id: 'rimwall-west',
    name: 'Rimwall West',
    kind: 'ridge',
    at: [0.51, 0.845],
    // The Cartographic Notes' figure; the map's own label reads 6240 m in the photograph.
    alt: 4600,
    note: 'A high scarp rising out of the Arrakeen Shield Wall.',
  },
  { id: 'shield-wall', name: 'Shield Wall', kind: 'ridge', at: [0.63, 0.5], alt: 4500, altNote: 'up to' },
  { id: 'hole-in-the-rock', name: 'Hole-in-the-Rock', kind: 'rock', at: [0.35, 0.3] },
  { id: 'sihaya-ridge', name: 'Sihaya Ridge', kind: 'ridge', at: [1.07, 0.71], alt: 224 },
  { id: 'gara-kulon', name: 'Gara Kulon', kind: 'village', at: [1.28, 0.33] },
  { id: 'red-chasm', name: 'Red Chasm', kind: 'depression', at: [1.11, 0.22], alt: -1582 },

  // ── Round the pole ─────────────────────────────────────────────────────────────────────
  { id: 'polar-sink', name: 'Polar Sink', kind: 'depression', at: [0.05, 0.08], alt: -500 },
  { id: 'north-pole', name: 'N. Pole', kind: 'pole', at: [0, 0] },
  { id: 'wind-pass', name: 'Wind Pass', kind: 'pass', at: [-0.31, 0.11], note: 'Cliff-walled; it opens into the sink villages.' },
  { id: 'minor-erg', name: 'The Minor Erg', kind: 'region', at: [0.6, 0.06] },
  { id: 'pasty-mesa', name: 'Pasty Mesa', kind: 'rock', at: [0.97, 0.04] },
  { id: 'false-wall-e', name: 'False Wall-E', kind: 'ridge', at: [0.47, -0.08] },
  { id: 'harg-pass', name: 'Harg Pass', kind: 'pass', at: [0.43, -0.26], note: "The shrine of Duke Leto's skull overlooks it." },
  { id: 'shrine', name: "Shrine of Leto's skull", kind: 'shrine', at: [0.32, -0.31] },
  { id: 'chin-rock', name: 'Chin Rock', kind: 'rock', at: [0.5, -0.38] },
  { id: 'smugglers', name: 'Smuggler Communities', kind: 'village', at: [0.9, -0.23] },
  { id: 'tueks-sietch', name: "Tuek's Sietch", kind: 'sietch', at: [0.86, -0.33] },
  { id: 'false-wall-s', name: 'False Wall-S', kind: 'ridge', at: [0.62, -0.53] },
  { id: 'cielago', name: 'Cielago Depression', kind: 'depression', at: [0.14, -0.66], alt: -200 },

  // ── West of the pole: Sietch Tabr and the open desert ──────────────────────────────────
  {
    id: 'sietch-tabr',
    name: 'Sietch Tabr',
    kind: 'sietch',
    at: [-0.64, 0.89],
    note: "Stilgar's sietch, where Paul and Jessica are taken in among the Fremen.",
  },
  { id: 'cave-of-riches', name: 'Cave of Riches', kind: 'cave', at: [-0.56, 1.01] },
  { id: 'tuono-basin', name: 'Tuono Basin', kind: 'basin', at: [-0.51, 0.95] },
  { id: 'shield-wall-west', name: 'Shield Wall', kind: 'ridge', at: [-0.42, 0.82], alt: 4500, altNote: 'up to' },
  { id: 'bight', name: 'Bight of the Cliff', kind: 'rock', at: [-0.77, 0.72] },
  { id: 'mt-idaho', name: 'Mt. Idaho', kind: 'peak', at: [-0.47, 0.7], alt: 7400 },
  { id: 'plastic-basin', name: 'Plastic Basin', kind: 'basin', at: [-0.19, 1.18] },
  { id: 'splintered-rock', name: 'Splintered Rock', kind: 'rock', at: [-0.21, 0.66] },
  { id: 'rock-outcroppings', name: 'Rock Outcroppings', kind: 'rock', at: [-0.69, 1.16] },
  { id: 'funeral-plain', name: 'The Funeral Plain', kind: 'region', at: [-1.2, 1.06], note: 'Open erg.' },
  {
    id: 'great-flat',
    name: 'The Great Flat',
    kind: 'region',
    at: [-1.3, 0.3],
    alt: 100,
    note: 'Open rock blending into erg, about 100 m above the Bled, with outcroppings to 200 m. Somewhere in it is the salt pan Pardot Kynes discovered.',
  },
  { id: 'habbanya-erg', name: 'Habbanya Erg', kind: 'region', at: [-1.0, -0.3] },
  { id: 'habbanya-ridge', name: 'Habbanya Ridge', kind: 'ridge', at: [-1.17, -0.6] },
  { id: 'cave-of-birds', name: 'Cave of Birds', kind: 'cave', at: [-1.1, -0.68], note: 'In Habbanya Ridge.' },
  { id: 'false-wall-w', name: 'False Wall-W', kind: 'ridge', at: [-0.55, -0.3], alt: 1200, altNote: 'up to' },
  {
    id: 'palmaries',
    name: 'Palmaries of the South',
    kind: 'pointer',
    at: [-1.62, -0.12],
    note: 'Off this map, at about 40° south. The map marks the way there as twenty thumpers.',
  },
];

type Pt = [number, number];

/**
 * The relief, as shapes laid over the open desert (the Great Bled, altitude 0). Heights are in
 * metres; `rough` is how far a ridge's crest dips below its stated height (0: it holds it).
 */
export type Relief =
  | { kind: 'peak'; at: Pt; alt: number; radius: number }
  | { kind: 'ridge'; path: Pt[]; alt: number; width: number; rough: number }
  | { kind: 'plateau'; at: Pt; radius: number; alt: number; rough: number }
  | { kind: 'basin'; at: Pt; radius: Pt; alt: number }
  | { kind: 'notch'; at: Pt; radius: number; alt: number }
  | { kind: 'sink'; at: Pt; radius: Pt; alt: number; ragged: number }
  | { kind: 'chasm'; path: Pt[]; width: number; alt: number }
  | { kind: 'flat'; at: Pt; radius: Pt; alt: number; outcrops: number }
  | { kind: 'erg'; at: Pt; radius: Pt };

export const RELIEF: Relief[] = [
  // The open desert regions first, then what stands on them, then what is cut into them.
  { kind: 'flat', at: [-1.25, 0.28], radius: [0.55, 0.45], alt: 100, outcrops: 100 },
  { kind: 'erg', at: [-1.15, 1.05], radius: [0.55, 0.36] },
  { kind: 'erg', at: [-1.0, -0.32], radius: [0.48, 0.26] },
  { kind: 'erg', at: [0.62, 0.07], radius: [0.3, 0.15] },

  // The Shield Wall: a horseshoe of mountains round the Imperial Basin, Arrakeen at its south rim,
  // and a western massif where Sietch Tabr is.
  {
    kind: 'ridge',
    path: [[-0.22, 1.12], [-0.05, 1.04], [0.1, 0.99], [0.27, 0.96], [0.38, 0.935], [0.47, 0.905], [0.57, 0.86]],
    alt: 4500,
    width: 0.12,
    rough: 0.35,
  },
  {
    kind: 'ridge',
    path: [[0.57, 0.86], [0.67, 0.74], [0.69, 0.58], [0.61, 0.44], [0.48, 0.34], [0.4, 0.31]],
    alt: 4500,
    width: 0.12,
    rough: 0.35,
  },
  {
    kind: 'ridge',
    path: [[-0.22, 1.12], [-0.19, 0.95], [-0.23, 0.78], [-0.27, 0.6], [-0.3, 0.42], [-0.29, 0.22], [-0.27, 0.06]],
    alt: 4500,
    width: 0.11,
    rough: 0.4,
  },
  {
    kind: 'ridge',
    path: [[-0.25, 0.8], [-0.4, 0.84], [-0.53, 0.88], [-0.63, 0.86], [-0.7, 0.8], [-0.76, 0.7]],
    alt: 3200,
    width: 0.12,
    rough: 0.4,
  },
  { kind: 'peak', at: [-0.47, 0.7], alt: 7400, radius: 0.07 },
  { kind: 'peak', at: [0.08, 0.98], alt: 8110, radius: 0.065 },
  { kind: 'plateau', at: [0.05, 0.88], radius: 0.075, alt: 4600, rough: 0.12 },
  { kind: 'ridge', path: [[0.46, 0.865], [0.51, 0.845], [0.56, 0.83]], alt: 4600, width: 0.035, rough: 0 },
  { kind: 'peak', at: [-0.21, 0.66], alt: 1500, radius: 0.03 },
  // Rock outcroppings in a line north-west from Sietch Tabr.
  { kind: 'peak', at: [-0.71, 1.29], alt: 300, radius: 0.018 },
  { kind: 'peak', at: [-0.69, 1.21], alt: 300, radius: 0.018 },
  { kind: 'peak', at: [-0.66, 1.12], alt: 300, radius: 0.018 },
  { kind: 'peak', at: [-0.63, 1.03], alt: 300, radius: 0.018 },

  // The false walls, Habbanya Ridge, Sihaya Ridge and the rocks of the south.
  {
    kind: 'ridge',
    path: [[-0.46, 0.05], [-0.5, -0.15], [-0.55, -0.33], [-0.61, -0.44], [-0.58, -0.6], [-0.52, -0.69]],
    alt: 900,
    width: 0.055,
    rough: 0.3,
  },
  { kind: 'peak', at: [-0.625, -0.446], alt: 1200, radius: 0.03 },
  {
    kind: 'ridge',
    path: [[0.54, -0.02], [0.46, -0.1], [0.41, -0.2], [0.42, -0.3], [0.37, -0.4]],
    alt: 900,
    width: 0.055,
    rough: 0.3,
  },
  {
    kind: 'ridge',
    path: [[0.33, -0.57], [0.45, -0.6], [0.6, -0.56], [0.72, -0.56], [0.83, -0.54]],
    alt: 900,
    width: 0.055,
    rough: 0.3,
  },
  { kind: 'ridge', path: [[-1.19, -0.54], [-1.16, -0.62], [-1.11, -0.67]], alt: 700, width: 0.022, rough: 0.2 },
  { kind: 'ridge', path: [[1.13, 0.88], [1.1, 0.76], [1.04, 0.66], [0.99, 0.6]], alt: 224, width: 0.02, rough: 0 },
  { kind: 'plateau', at: [0.97, 0.04], radius: 0.06, alt: 500, rough: 0.05 },
  { kind: 'peak', at: [0.5, -0.38], alt: 700, radius: 0.022 },
  { kind: 'peak', at: [0.32, -0.31], alt: 600, radius: 0.025 },
  { kind: 'peak', at: [1.28, 0.33], alt: 400, radius: 0.02 },
  { kind: 'peak', at: [0.35, 0.3], alt: 1100, radius: 0.025 },

  // Basins inside the walls.
  { kind: 'basin', at: [0.36, 0.6], radius: [0.2, 0.18], alt: 150 },
  { kind: 'basin', at: [0.42, 0.865], radius: [0.04, 0.03], alt: 250 },
  { kind: 'basin', at: [0.2, 0.76], radius: [0.05, 0.04], alt: 250 },
  { kind: 'basin', at: [0.02, 0.62], radius: [0.08, 0.1], alt: 200 },
  { kind: 'basin', at: [-0.51, 0.95], radius: [0.05, 0.04], alt: 900 },
  { kind: 'basin', at: [-0.19, 1.18], radius: [0.06, 0.05], alt: 800 },

  // Passes, then what lies below the Bled.
  { kind: 'notch', at: [0.38, 0.93], radius: 0.03, alt: 2240 },
  { kind: 'notch', at: [-0.31, 0.11], radius: 0.035, alt: 200 },
  { kind: 'notch', at: [0.43, -0.26], radius: 0.03, alt: 300 },
  { kind: 'sink', at: [0.03, 0.03], radius: [0.2, 0.17], alt: -500, ragged: 0.12 },
  { kind: 'sink', at: [0.14, -0.66], radius: [0.12, 0.07], alt: -200, ragged: 0.12 },
  { kind: 'chasm', path: [[1.05, 0.2], [1.1, 0.22], [1.19, 0.245]], width: 0.022, alt: -1582 },
];

/**
 * The model's extent: a disc round where the book's places are, which is mostly south and west of
 * the pole (the map's pages are blank below the false walls).
 */
export const MAP_CENTER: [number, number] = [-0.15, 0.25];
export const MAP_RADIUS = 1.6;
