/**
 * The world of Dune in four short paragraphs, for someone who has never read it: what the spice
 * is, who holds power and the truce they keep, the feud the first novel turns on, and the desert.
 * Herbert's books only, and nothing here that the timeline itself does not source.
 */
export interface PrimerSection {
  title: string;
  text: string;
}

export const PRIMER = {
  kicker: 'Before you go in',
  title: 'The world of Dune',
  sections: [
    {
      title: 'The spice',
      text: "Melange is found on one planet only: Arrakis, the desert world called Dune. It lengthens life, and in large doses it gives glimpses of the future, which the Spacing Guild's Navigators use to steer ships through folded space. Without spice, no one travels between the stars.",
    },
    {
      title: 'The balance of power',
      text: 'The Padishah Emperor, of House Corrino, rules with his Sardaukar, the most feared soldiers of all. Against him stand the Great Houses of the Landsraad. Their truce is the Great Convention: its chief law forbids atomics against people, and each of its laws begins, "The forms must be obeyed."',
    },
    {
      title: 'An old feud',
      text: 'House Atreides and House Harkonnen have been at kanly, formal vendetta, for ten thousand years. Now the Emperor takes Arrakis from the Harkonnens and gives it to Duke Leto Atreides. It is a trap: he fears the Duke, and lends the Harkonnens his Sardaukar to destroy him.',
    },
    {
      title: 'The desert',
      text: 'Arrakis truly belongs to the Fremen, the desert people the Empire overlooks, and to the giant sandworms of the deep desert. The Bene Gesserit sisterhood has long since planted a legend of a messiah among them. The Duke has a son, Paul, who is fifteen.',
    },
  ] satisfies PrimerSection[],
  close: "Herbert's six novels follow what comes of it, over five thousand years.",
};
