import type { Contradiction, Lifeline, UndatedNote } from './types';

/**
 * Lifespans. Where Dune's Appendix IV (the Almanak en-Ashraf) prints dates they are used as
 * given, even where they clash with the narrative; the clashes are listed in CONTRADICTIONS.
 */
export const LIFELINES: Lifeline[] = [
  {
    id: 'baron',
    name: 'Baron Vladimir Harkonnen',
    segments: [{ start: 10110, end: 10193, endAt: 'battle-of-arrakeen' }],
    note: 'Almanak en-Ashraf: 10,110–10,193. Killed by Alia at Arrakeen. He comes back as a voice inside her.',
  },
  {
    id: 'fenring',
    name: 'Count Hasimir Fenring',
    segments: [{ start: 10133, end: 10225 }],
    note: "Almanak en-Ashraf: 10,133–10,225. The Emperor's friend and a failed Kwisatz Haderach candidate, and the one man in Dune whom Paul cannot see.",
  },
  {
    id: 'shaddam',
    name: 'Shaddam IV',
    segments: [{ start: 10134, end: 10202, endAt: 'shaddam-dies' }],
    note: "Almanak en-Ashraf: 10,134–10,202. Irulan's epigraph implies he was born about fifteen years earlier.",
  },
  {
    id: 'leto-i',
    name: 'Duke Leto Atreides',
    segments: [{ start: 10140, end: 10191, endAt: 'fall-of-arrakeen' }],
    note: 'Almanak en-Ashraf: 10,140–10,191.',
  },
  {
    id: 'jessica',
    name: 'Lady Jessica',
    segments: [{ start: 10154, end: 10256 }],
    note: 'Almanak en-Ashraf: 10,154–10,256. She outlives her son by about four decades.',
  },
  {
    id: 'paul',
    name: "Paul Atreides (Muad'Dib)",
    segments: [{ start: 10175, end: 10214, startAt: 'paul-born', endAt: 'preacher-killed', shiftEnd: true }],
    note: 'Fifteen when Dune opens; dies as the Preacher in Children of Dune, 21 years into his reign.',
  },
  {
    id: 'alia',
    name: 'Alia Atreides',
    segments: [{ start: 10191, end: 10214, startAt: 'alia-born', endAt: 'alia-dies', shiftEnd: true }],
    note: 'Born 10,191 per the Almanak; dies by her own hand in Children of Dune.',
  },
  {
    id: 'leto-ii',
    name: 'Leto II, the God Emperor',
    segments: [{ start: 10205, end: 13714, startAt: 'twins-born', endAt: 'leto-death', shiftStart: true, shiftEnd: true }],
    note: 'Some 3,500 years, most of them as a sandworm. Every other human lifeline here is a sliver beside his.',
  },
  {
    id: 'duncan',
    name: 'Duncan Idaho',
    segments: [
      { start: 10191, end: 10191, label: 'the original', openStart: true, endAt: 'duncan-dies' },
      { start: 10205, end: 10214, label: 'Hayt, then restored', approx: true, startAt: 'messiah-conspiracy', shiftStart: true, shiftEnd: true },
      { start: 10214, end: 13714, label: 'the God Emperor’s gholas', approx: true, endAt: 'leto-death', shiftStart: true, shiftEnd: true },
      { start: 15214, end: 15225, label: 'the Sisterhood’s ghola', approx: true, startAt: 'heretics-ghola', endAt: 'no-ship-escape', shiftStart: true, shiftEnd: true },
    ],
    note: "The only character in all six novels. The original's birth is never dated. Leto II keeps a long succession of Tleilaxu gholas of him across the reign; how many is not given.",
  },
];

export const CONTRADICTIONS: Contradiction[] = [
  {
    id: 'shaddam-age',
    a: 'shaddam-born-irulan',
    b: 'shaddam-born-almanak',
    title: "Shaddam's birth: 10119 or 10134?",
    note: "Irulan has her father at 72 in the year of Duke Leto's death, so born c. 10119. The Almanak's 10,134 makes him 57. Irulan's figure is the one that fits: she also dates Paul's birth to \"the 57th year\" of Shaddam, and 10119 + 56 lands on 10175, right for a boy who is fifteen in 10191. It is the appendix that is out of step.",
  },
  {
    id: 'accession',
    a: 'paul-emperor',
    b: 'irulan-regency',
    title: "Shaddam's reign ends 10193 or 10196?",
    note: "On the page Shaddam is deposed at Arrakeen. The Almanak says his reign ended with a 10,196 regency in Irulan's name. Every later date is a stated interval counted from this point, so the choice moves Messiah, Children, Leto II's death and Heretics. Use the Reckoning switch to watch them slide while the stated dates hold still.",
  },
];

export const UNDATED: UndatedNote[] = [
  {
    title: 'House Atreides descends from the House of Atreus',
    novel: 'god-emperor',
    note: 'Leto II claims Agamemnon as an ancestor. It is the only bridge between our history and the Imperial calendar, and it has no date.',
  },
  {
    title: 'The Zensunni forced migrations',
    novel: 'dune',
    note: "The glossary names stopping-places such as Poritrin, Bela Tegeuse and Harmonthep between the 1381 BG schism and Arrakis, but gives no dates for any stop or for the Fremen's arrival.",
  },
  {
    title: 'The Orange Catholic Bible and the C.E.T.',
    novel: 'dune',
    note: 'Appendix II describes the Commission of Ecumenical Translators and the riots that followed. It is placed after the Jihad, but never pinned to a year.',
  },
  {
    title: 'The discovery of melange',
    novel: 'dune',
    note: 'Spice underpins the Guild monopoly at year zero, so its discovery must come earlier. The novels never say when.',
  },
  {
    title: 'The Great Convention, the Landsraad and CHOAM',
    novel: 'dune',
    note: "The political tripod Dune runs on (Emperor, Landsraad, Guild, with CHOAM as the purse) has no founding dates.",
  },
  {
    title: "Pardot Kynes's arrival on Arrakis",
    novel: 'dune',
    note: 'Appendix I tells how the first Imperial Planetologist turned the Fremen toward terraforming. It gives no year. The tie is through his son Liet, who dies in 10191.',
  },
  {
    title: 'The death of the Old Duke',
    novel: 'dune',
    note: "Paulus Atreides was killed by a Salusan bull in the ring, and its head hangs in the Arrakeen dining hall. It must fall before Paul's birth, but no year is given.",
  },
  {
    title: 'How long the Famine Times lasted',
    novel: 'heretics',
    note: 'Remembered as a catastrophe after the Tyrant, with no length given.',
  },
  {
    title: 'Who Daniel and Marty are',
    novel: 'chapterhouse',
    note: "Out of scope here by design: later books by other authors offer an answer. Herbert's own text stops at the question.",
  },
];
