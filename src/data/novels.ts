import type { Novel } from './types';

/** Frank Herbert's six Dune novels. Publication order happens to be chronological order. */
export const NOVELS: Novel[] = [
  {
    id: 'dune',
    title: 'Dune',
    short: 'Dune',
    published: 1965,
    start: 10191,
    end: 10193,
    approx: false,
    blurb:
      'House Atreides takes Arrakis, falls to a Harkonnen–Sardaukar trap, and rises again through Paul and the Fremen. Its appendices and glossary are the source of almost every date before 10191.',
  },
  {
    id: 'messiah',
    title: 'Dune Messiah',
    short: 'Messiah',
    published: 1969,
    start: 10205,
    end: 10205,
    approx: true,
    shift: true,
    blurb:
      'Twelve years into his jihad, Emperor Paul is the target of a conspiracy he can foresee but not escape. Herbert wrote it to puncture the hero myth the first book built.',
  },
  {
    id: 'children',
    title: 'Children of Dune',
    short: 'Children',
    published: 1976,
    start: 10214,
    end: 10214,
    approx: true,
    shift: true,
    blurb:
      "Paul's twins, Leto II and Ghanima, grow up under Alia's failing regency. Leto accepts the sandtrout skin and the Golden Path his father refused.",
  },
  {
    id: 'god-emperor',
    title: 'God Emperor of Dune',
    short: 'God Emperor',
    published: 1981,
    start: 13714,
    end: 13714,
    approx: true,
    shift: true,
    blurb:
      "The last stretch of Leto II's 3,500-year reign, told around his own journals. He engineers his death so that humanity can scatter beyond any tyrant's prescience.",
  },
  {
    id: 'heretics',
    title: 'Heretics of Dune',
    short: 'Heretics',
    published: 1984,
    start: 15214,
    end: 15214,
    approx: true,
    shift: true,
    blurb:
      'Some fifteen centuries on, the Bene Gesserit, the Tleilaxu and the Honored Matres returning from the Scattering converge on Rakis and a girl who can command sandworms.',
  },
  {
    id: 'chapterhouse',
    title: 'Chapterhouse: Dune',
    short: 'Chapterhouse',
    published: 1985,
    start: 15215,
    end: 15225,
    approx: true,
    shift: true,
    blurb:
      'The hunted Sisterhood turns its hidden homeworld into desert to breed new sandworms, and gambles on merging with its enemy. Herbert died in 1986 with the story open.',
  },
];
