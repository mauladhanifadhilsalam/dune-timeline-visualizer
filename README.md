# The Golden Path: a 3D Dune timeline

An interactive 3D timeline of **Frank Herbert's six Dune novels**, from the Zensunni schism (1381 BG) to the
no-ship's escape at the end of *Chapterhouse: Dune*. Every date says where it comes from and how far it can be
trusted.

Built with Three.js, TypeScript and Vite. No framework.

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # data integrity + time-scale tests
npm run build     # static site in dist/, served from any path
```

## What you're looking at

- **The path.** One glowing curve over a desert at dusk, with nine eras marked by gates. Each light is a
  dated event, coloured and tagged by the novel it comes from.
  - **Solid orbs** happen on the page.
  - **Wire cages** are *recalled history*: things reported by the glossary, Irulan's epigraphs, Leto II's
    journals and so on. Herbert's narrators have agendas, and the cage is there so you don't forget it.
- **Under the path.** Coloured strips show where each novel's narrative sits.
- **Lifespans** (optional). A staff of threads hangs under the path, one per person. Duncan Idaho's thread
  breaks and resumes across all six books.
- **Red arcs** join statements of Herbert's that cannot both be true.
- **Scrubber.** A flat minimap of the whole timeline. Drag it to walk the path.
- **The world.** Set pieces stand beside the events they belong to:
  - a Guild heighliner at the Guild's founding
  - Arrakeen and the Shield Wall, with ornithopters overhead
  - a Harkonnen spice harvester and its carryall, on a spice field
  - the Emperor's landed frigates at the Battle of Arrakeen
  - sandworms
  - a crysknife
  - the spice blow that takes Liet-Kynes
  - thinking-machine wreckage from the Jihad

  Each one only appears in the eras the books put it in. It rises from the sand as you arrive and sinks as you
  leave, so a snaking path never shows one era's props on another's horizon. The ground changes with the story:
  - it greens under Leto II, starting faintly in *Children of Dune*
  - it has no worms during his reign, when he is the last of them
  - it is scorched glass after the Honored Matres burn Rakis
- **Camera.** It travels along the golden path itself, riding beside the thread through every bend at the
  angle you've orbited to.
  - A step to a neighbouring event takes about two seconds.
  - A jump across eras takes up to six seconds and pulls back a little at cruising speed.
  - It eases in and out with no jolt at either end.

### Two switches that exist to make a point

**Story scale / true scale.** A linear time axis spends about 60% of its length on the ten nearly-empty
millennia of the Corrino Imperium and squeezes the narratives of all six novels into about 0.1%. Story scale
blends event rank with era so dense periods open up while order is kept and long gaps still look long. Flip
to true scale to see how little of Herbert's history his novels actually show.

**Reign from 10193 / 10196.** On the page, Shaddam IV is deposed at the Battle of Arrakeen (10193).
Appendix IV says his reign ended with a regency in Irulan's name in 10196. Every later date in the novels is
a stated interval counted from that point, so the switch slides Messiah, Children, Leto II's death and
Heretics by three years. Dates the text actually prints, like Shaddam's death in 10202, stay put.

## Dating policy

Scope is deliberately narrow: **the six novels and Dune's own appendices and glossary**. The prequels and
sequels by Brian Herbert and Kevin J. Anderson, and the *Dune Encyclopedia*, are excluded. They contradict
Herbert and each other, and mixing them is how most online Dune timelines go wrong.

Each event carries a certainty:

| Label | Meaning |
| --- | --- |
| **Year stated** | Printed in the text. Only the four B.G. glossary dates and the Appendix IV life dates qualify. |
| **Year derived** | Computed from what the text does print: "twelve years", "nine years", ages, life dates. |
| **Year reckoned** | The text gives only loose relative time ("some 3,500 years", "about 1,500 years"). Good to a few years at best. |

After 10193, every year here is Herbert's own stated intervals added up:

- twelve years to *Messiah*
- nine more to *Children*
- about 3,500 to the God Emperor's death
- about 1,500 to *Heretics*

Fan chronologies print 10219, 13725 or 13728, and 15229 for those points. They reach them by assumptions
Herbert doesn't state, and they don't agree with each other. Herbert also never writes "A.G.", so later
years are left bare, as in Appendix IV.

Two contradictions are drawn on the path:

- **Shaddam IV's birth.** Irulan's "72 in the year Leto died" gives about 10119. The Almanak gives 10134.
  Irulan's figure is the consistent one: her "Paul was born in the 57th year of Shaddam IV" gives 10175,
  which is right for a boy who is fifteen in 10191.
- **The accession.** The battle in 10193 against the regency in 10196.

The About panel lists what the novels mention but never date, such as the discovery of spice, the Great
Convention and Pardot Kynes's arrival. They can't honestly be put on an axis.

## Project layout

```
src/
  data/          events, eras, novels, lifespans, contradictions (hand-curated, tested)
  timeline/      reckoning resolution, story/true time scales, placement morphing, formatting
  scene/         Three.js: desert (terrain ecology shader, forest, spice motes), sky and moons,
                 the path, markers and labels, camera
  scene/props/   set pieces: catalog (what stands where and when), placement solver, heighliner,
                 Arrakeen, harvester, sandworm, crysknife, wreckage, particles
  ui/            panel, scrubber, search, about/index dialogs
```

To add a set piece, add an entry to `src/scene/props/catalog.ts` with its event, eras and footprint. Placement
slides it along and away from its event until it clears the path and the other pieces. `catalog.test.ts`
checks that its event and eras exist and that it shows in its own event's era.

The data tests (`src/data/data.test.ts`) check that:

- events are in story order under both reckonings
- stated dates never move
- the stated intervals add up
- every event falls in an era
- every lifespan anchor agrees with its event

To add an event, append it to `src/data/events.ts` at its place in the story, then run `npm test`.

## Controls

| Input | Action |
| --- | --- |
| `←` `→` | Earlier / later event |
| `Space` | Start or stop the guided tour |
| `/` | Search |
| `O` | Overview |
| `T` | Story / true scale |
| `R` | Reckoning |
| `Esc` | Close |
| Drag / right-drag / scroll | Orbit / pan / zoom (touch: one finger, two fingers, pinch) |

Deep links work: `/#battle-of-arrakeen`.

---

Unofficial fan project. Not affiliated with or endorsed by the Herbert estate, or by any publisher or studio.
Summaries are paraphrased; quotations are a few words long.
