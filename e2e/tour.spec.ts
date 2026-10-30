import { expect, test } from '@playwright/test';
import { step, useSceneClock, type GoldenPathWindow } from './harness';

test.use({ viewport: { width: 960, height: 600 } });

test('the guided tour stays at a landing until it has played out, and says why', async ({ page }) => {
  await useSceneClock(page);
  await page.goto('./?e2e#gom-jabbar');
  await step(page, 4);
  const held = await page.evaluate(() => {
    const { props } = (window as unknown as GoldenPathWindow).__goldenPath;
    return ['atreides-arrive', 'fall-of-arrakeen'].map((id) => props.tourHold(id)?.seconds ?? 0);
  });
  // Three frigates a few seconds apart, ten seconds each to come down: far longer than a usual stop.
  for (const s of held) expect(s).toBeGreaterThan(15);

  // From the gom jabbar the tour's next stop is the Atreides arriving on Arrakis.
  await page.keyboard.press(' ');
  const title = page.locator('.panel-title');
  const landing = 'House Atreides takes Arrakis';
  await expect(title).toHaveText(landing);
  await step(page, 3);
  const hint = page.locator('#hint');
  await expect(hint).toHaveClass(/\bon\b/);
  await expect(hint).toContainText('until the Atreides frigates are down');

  // The ring round the Tour button fills as the stay runs out.
  const progress = () => page.evaluate(() => Number(document.querySelector<HTMLElement>('#btn-tour')!.style.getPropertyValue('--tour-progress')));
  const early = await progress();
  await step(page, 6);
  const later = await progress();
  expect(later).toBeGreaterThan(early);
  expect(later).toBeLessThan(1);

  // Still there well past an ordinary stop's six and a half seconds…
  await expect(title).toHaveText(landing);
  // …and on once the landing is done, to the other landing, the Harkonnens' at the fall of
  // Arrakeen, which holds the tour too.
  await step(page, held[0]);
  await expect(title).toContainText('fall of House Atreides');
  await expect(hint).toContainText('until the Harkonnen frigates are down');
  // Stopping the tour takes the hint away.
  await page.keyboard.press(' ');
  await step(page, 1);
  await expect(hint).not.toHaveClass(/\bon\b/);
});
