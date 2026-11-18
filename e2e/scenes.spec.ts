import { expect, test, type Page } from '@playwright/test';
import { step, useSceneClock, type GoldenPathWindow } from './harness';

/** How much of a scene's ground must be in clear view for it to count as seen. */
const SEEN = 0.5;

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
  }
  console.log(report.join('\n'));
  expect(failures, 'scenes hidden behind the card, a label or the edge of the frame').toEqual([]);
});
