# The Golden Path: a 3D Dune timeline

An interactive 3D timeline of **Frank Herbert's six Dune novels**, from the Zensunni schism (1381 BG) to the
no-ship's escape at the end of *Chapterhouse: Dune*. Every date says where it comes from and how far it can be
trusted.

Built with Three.js, TypeScript and Vite. No framework.

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # data integrity + time-scale tests
npm run build     # static site in dist/, served from any path (see Cloud Run below)
```

## What you're looking at

- **The way in.** After the title, a short primer for newcomers: the spice, the balance of power and the
  Great Convention, the Atreides–Harkonnen feud, and the desert (it is also at the top of the ⓘ dialog).
  Then a choice: the guided tour from the very beginning, or exploring on your own from the birth of Paul
  Atreides. A link to an event (`#jamis-duel`) skips all of it and goes straight there.
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
  - Arrakeen and the Shield Wall, with ornithopters overhead and a landing field on the city's near edge.
    When House Atreides takes Arrakis, its frigates come down onto that field one after another, and the
    Atreides banners go up the poles once the first is down. When the house falls, fires burn through the city
    under smoke, and the Harkonnen and Sardaukar frigates come down on the same field
  - a Harkonnen spice harvester and its carryall, on a spice field
  - a Coriolis storm on the horizon when Paul wakes in the stilltent, an ornithopter flying into it
  - a thumper drumming for Paul's first maker, with the worm it called circling, a rider on its back
  - the Battle of Arrakeen, played through from your arrival: the family atomics flash against the Shield
    Wall, that stretch of it slumps into rubble and boulders, the storm pours through the gap, and Fremen
    ride in behind it on five worms, a file of riders on each, to fall on the Emperor's landed frigates,
    where lasgun fire flickers. Then it sinks back into the sand and replays
  - sandworms, with wormsign: a mound of sand riding over the head while it runs just under the surface
  - a crysknife
  - the spice blow that takes Liet-Kynes
  - thinking-machine wreckage from the Jihad
  - Atreides ships lifting off under the green and black banner as Muad'Dib's Jihad sets out
  - the Keep, seat of Alia's regency
  - blind Paul walking alone into the desert, his footprints filling in behind him
  - the Preacher, blind Paul come back, preaching from the steps of Alia's temple to a throng in the plaza,
    in silhouette against its lit door
  - Leto II in the sandtrout skin, running across the sand faster than any animal, throwing up a long plume
  - Leto II's Citadel inside the walled Sareer, the one desert he kept on a green Arrakis. The terrain is
    masked back to sand inside its wall, and the label notes that his journals are later excavated at
    Dar-es-Balat
  - the Idaho River, winding across a green flood plain (levelled, so no dune hides it from the path), with
    the Royal Road crossing it on a stone bridge. At Hwi Noree's event the wedding procession walks the road,
    his Royal Cart at its head and the Fish Speakers behind, up the ramp and over the bridge. From his death
    the bridge is cut, his pale body lies in the current below it and the sandtrout spread from it
  - ships of the Scattering lifting off after his death
  - on Rakis in *Heretics*, pilgrims walking to Keen under a Priesthood ornithopter, and then Keen in ruins and
    burning as the Honored Matres destroy the planet, their attack ships passing over; on Chapterhouse, the
    no-ship on its landing field

  The other half of the map, on the camera's side of the path, has its own life, out beyond where the camera
  rides: smugglers working a spice field (under the Harkonnens and in *Dune*), Sietch Tabr in its rock with a
  band of Fremen coming in off the sand in the sandwalk (and, at the Sardaukar raid, smoke pouring from its mouth
  instead: the camera swings round over the path to look back at it, and turns back at the next event), a wild
  worm in *Children of Dune*, and the pilgrims.
  Each stands on ground nearest a stretch of path in its own eras, so it shows whenever you look its way.
  Mesas, buttes and spines of rock are scattered over all the empty ground on both sides: rock outlasts every
  era, so it is always there. It keeps to the horizon behind the dioramas, never in front of them.

  The major landmarks carry a name in the scene, culled like every other label so they never pile up.
  The Atreides banner follows the 2021 film's design: charcoal and deep green panels, gold stripes, and the gold
  hawk. That is the film's reading, not Herbert's: the books give only "the green and black Atreides banner",
  and put the hawk on the ducal crest.

  Each one only appears in the eras the books put it in. It rises from the sand as you arrive and sinks as you
  leave, so a snaking path never shows one era's props on another's horizon. Scenes (the storm, the thumper,
  the breach, the landing, Paul's walk, the Preacher) are tighter still: they only show near their own event, which lets the crowded
  stretch of *Dune* fit them all. The ground changes with the story:
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
blends event rank with era so dense periods open up while order is kept and long gaps still look long. The
crowded eras get more still: each step between events counts double in *Dune* and one and a half times in
*Messiah*/*Children of Dune* and Leto II's reign, where the scenery is thickest. Flip to true scale to see
how little of Herbert's history his novels actually show.

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
                 Arrakeen, harvester, sandworm, crysknife, wreckage, storm, Shield Wall and the
                 Battle of Arrakeen (collapse, worm charge), thumper, the walk, the Idaho River,
                 fleets (launching and landing), sietch, processions, the Preacher, the no-ship,
                 rock outcrops, particles
  ui/            panel, scrubber, search, about/index dialogs
```

To add a set piece, add an entry to `src/scene/props/catalog.ts` with its event, eras and footprint (and
`moment` for a scene that should only show near its event, `side: 'near'` for one on the camera's side). Placement slides it along and away from its event
until it clears the path and the other pieces it can be on screen with, trying first only spots inside the
frame that event opens on. `catalog.test.ts`
checks that its event and eras exist and that it shows in its own event's era.

The data tests (`src/data/data.test.ts`) check that:

- events are in story order under both reckonings
- stated dates never move
- the stated intervals add up
- every event falls in an era
- every lifespan anchor agrees with its event

To add an event, append it to `src/data/events.ts` at its place in the story, then run `npm test`.

## Deploy to Google Cloud Run

The app is a static site. The `Dockerfile` runs the tests, builds the site, and serves it from unprivileged
nginx on the port Cloud Run provides (`$PORT`, 8080 by default). The image serves:

- **Caching:** `assets/*` is fingerprinted and cached for a year; the page itself revalidates on every load, so a
  new deploy shows up at once.
- **Security headers:** a strict Content-Security-Policy that allows only same-origin scripts and Google Fonts,
  plus HSTS, `nosniff`, a referrer policy and a permissions policy.
- **Compression and health:** gzip, and a `/healthz` endpoint for uptime checks.
- **Sizing:** the image is about 90 MB, and nginx idles at about 5 MiB of memory, so 256 MiB is ample. It scales
  to zero when idle, so it costs nothing while nobody is visiting.

### One command

From the repository root, with the [gcloud CLI](https://cloud.google.com/sdk/docs/install) signed in to your project:

```bash
gcloud run deploy golden-path --source . --region us-central1 --allow-unauthenticated
```

Cloud Build builds the `Dockerfile` remotely, so you don't need Docker locally. The first run asks to enable
the needed APIs and to create an Artifact Registry repository. It prints the service URL when done.

### Repeatable pipeline (`cloudbuild.yaml`)

For CI, or to pin region and limits, use the Cloud Build config. Set it up once per project:

```bash
PROJECT_ID=$(gcloud config get-value project)
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
gcloud artifacts repositories create golden-path --repository-format=docker --location=us-central1
```

Then grant the service account Cloud Build runs as permission to deploy:

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')-compute@developer.gserviceaccount.com" \
  --role=roles/run.admin
```

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')-compute@developer.gserviceaccount.com" \
  --role=roles/iam.serviceAccountUser
```

That is the Compute Engine default account, which new projects use for Cloud Build. Older projects may use
`PROJECT_NUMBER@cloudbuild.gserviceaccount.com` instead; the Cloud Build settings page shows which one yours runs as.

Each deploy after that:

```bash
gcloud builds submit --config cloudbuild.yaml
```

Override the defaults with `--substitutions=_REGION=europe-west1,_SERVICE=dune`. The pipeline tags each image
with its build ID and deploys:

| Setting | Value |
| --- | --- |
| CPU | 1 |
| Memory | 256 MiB |
| Instances | 0 to 3 |
| Access | public (`--allow-unauthenticated`) |

To build on every push, connect the GitHub repository as a
[Cloud Build trigger](https://cloud.google.com/build/docs/automating-builds/create-manage-triggers) that uses this
file.

### Notes

- **Org policies.** If your organisation restricts public services (Domain Restricted Sharing),
  `--allow-unauthenticated` will be refused. Drop it, or put the service behind IAP or a load balancer.
- **Base images.** These come from `mirror.gcr.io`, Google's mirror of Docker Hub, so builds don't hit Docker
  Hub's anonymous pull limits.
- **Local run.** `docker build -t golden-path . && docker run --rm -p 8080:8080 golden-path`, then open
  http://localhost:8080. Set `-e PORT=9090 -p 9090:9090` to check the port handling Cloud Run relies on.
- **Custom domain.** Use Cloud Run domain mappings or a load balancer. The Content-Security-Policy is host-agnostic
  (`'self'`), so it needs no change.

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
