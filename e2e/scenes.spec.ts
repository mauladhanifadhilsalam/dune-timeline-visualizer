import { expect, test, type Page } from '@playwright/test';
import { step, useSceneClock, type GoldenPathWindow } from './harness';

/** How much of a scene's ground must be in clear view for it to count as seen. */
const SEEN = 0.5;
/**
 * How tall, in pixels, a scene's nearer people must stand to read as people: the upper quartile of
 * those on screen, so a file or a crowd is judged by the people nearest the viewer, not by the ones
 * receding into the distance behind them. For one person it is that person.
 */
const PERSON_PX = 28;
/**
 * Scenes whose people are seen at another scale, where this does not apply: the Fremen riding into
 * the Battle of Arrakeen stand on worms across a battlefield, and grow with the worms or not at all.
 */
const PEOPLE_AT_ANOTHER_SCALE = new Set(['battle-of-arrakeen']);

/** How tall the people of an event's scenes stand on screen: the upper quartile of those in view, in pixels. */
function peopleHeight(page: Page, id: string): Promise<{ n: number; near: number } | null> {
  return page.evaluate((id) => {
    const { world, props } = (window as unknown as GoldenPathWindow).__goldenPath;
    const cam = world.camera;
    const focal = world.renderer.domElement.clientHeight / 2 / Math.tan((cam.fov * Math.PI) / 360);
    const px = props
      .scenePeople(id)
      .filter(({ at }) => {
        const v = at.clone().project(cam);
        return v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1;
      })
      .map(({ at, height }) => (height * focal) / at.distanceTo(cam.position))
      .sort((a, b) => a - b);
    return px.length ? { n: px.length, near: px[Math.floor(px.length * 0.75)] } : null;
  }, id);
}

interface Seen {
  kind: string;
  n: number;
  seen: number;
  /** Under the event card, the top bar or the timeline bar. */
  covered: number;
  /** Under a label's box. */
  labelled: number;
  /** Out of frame. */
  off: number;
}

/**
 * Where an event's scenes land in the frame its camera opens on, as the share of points over
 * their ground that are on screen, clear of the card and the bars, and clear of every label box.
 */
function measure(page: Page, id: string): Promise<Seen[]> {
  return page.evaluate((id) => {
    const { world, props } = (window as unknown as GoldenPathWindow).__goldenPath;
    const cv = world.renderer.domElement.getBoundingClientRect();
    const box = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
    const free = { l: cv.left, t: box('.topbar').bottom, r: cv.right, b: cv.bottom };
    const panel = document.querySelector<HTMLElement>('#panel')!;
    if (!panel.hidden) {
      const p = panel.getBoundingClientRect();
      if (p.left > cv.left + 40) free.r = p.left;
      else free.b = p.top;
    }
    const scrubber = document.querySelector<HTMLElement>('#scrubber')!;
    if (getComputedStyle(scrubber).visibility !== 'hidden') free.b = Math.min(free.b, scrubber.getBoundingClientRect().top);
    // Labels drawn on a box; era, lifeline and landmark names are bare text the scene shows through.
    const labels = [...document.querySelectorAll<HTMLElement>('.lbl-event.on, .lbl-novel.on, .lbl-conflict.on')]
      .filter((e) => getComputedStyle(e).display !== 'none')
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);
    return props.sceneSamples(id).map(({ kind, points }) => {
      const out = { kind, n: points.length, seen: 0, covered: 0, labelled: 0, off: 0 };
      for (const p of points) {
        const v = p.clone().project(world.camera);
        const x = cv.left + ((v.x + 1) / 2) * cv.width;
        const y = cv.top + ((1 - v.y) / 2) * cv.height;
        if (v.z > 1 || x < cv.left || x > cv.right || y < cv.top || y > cv.bottom) out.off++;
        else if (x < free.l || x > free.r || y < free.t || y > free.b) out.covered++;
        else if (labels.some((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) out.labelled++;
        else out.seen++;
      }
      return out;
    });
  }, id);
}

test.use({ viewport: { width: 1280, height: 760 }, reducedMotion: 'reduce' });

test('every scene stands where its event opens, clear of the card and the labels', async ({ page }) => {
  // Some thirty events, each rendered for a second in software: minutes on a slow CI machine.
  test.setTimeout(600_000);
  await useSceneClock(page);
  await page.goto('./?e2e#paul-born');
  await step(page, 2);
  const withScenes = await page.evaluate(() => {
    const { props, res } = (window as unknown as GoldenPathWindow).__goldenPath;
    return res.events.map((e) => e.id).filter((id) => props.sceneSamples(id).length > 0);
  });
  expect(withScenes.length).toBeGreaterThan(20);

  const report: string[] = [];
  const failures: string[] = [];
  for (const id of withScenes) {
    // From the overview each time, so every event opens on its own default framing rather than
    // on the angle carried over from the one before.
    await page.keyboard.press('o');
    await step(page, 0.3);
    await page.evaluate((id) => (location.hash = id), id);
    await step(page, 0.8);
    for (const s of await measure(page, id)) {
      const line = `${id} / ${s.kind}: seen ${s.seen}/${s.n}, covered ${s.covered}, labelled ${s.labelled}, off ${s.off}`;
      report.push(line);
      if (s.seen / s.n < SEEN) failures.push(line);
    }
    const people = await peopleHeight(page, id);
    if (people) {
      const line = `${id} / people: ${people.n} in view, the nearer ${people.near.toFixed(0)} px tall`;
      report.push(line);
      if (people.near < PERSON_PX && !PEOPLE_AT_ANOTHER_SCALE.has(id)) failures.push(line);
    }
  }
  console.log(report.join('\n'));
  expect(failures, 'scenes hidden behind the card, a label or the edge of the frame, or people too small to read').toEqual([]);
});
