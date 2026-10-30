import { expect, test, type Page } from '@playwright/test';
import { step, useSceneClock, type GoldenPathWindow } from './harness';

test.use({ viewport: { width: 960, height: 600 } });

/** The Battle of Arrakeen's state, read off the scene. */
function battle(page: Page): Promise<{ flying: boolean; started: boolean; blasted: boolean }> {
  return page.evaluate(() => {
    const { world, props } = (window as unknown as GoldenPathWindow).__goldenPath;
    const b = props.breach as { started: boolean; blasted: boolean };
    return { flying: world.isFlying(), started: b.started, blasted: b.blasted };
  });
}

test('the Battle of Arrakeen waits for the camera before the atomics go off', async ({ page }) => {
  await useSceneClock(page);
  await page.goto('./?e2e#water-of-life');
  await step(page, 6);
  // Round to the raid on Sietch Tabr, which turns the camera to the far side of the path…
  await page.evaluate(() => (location.hash = 'sietch-tabr-raid'));
  await step(page, 6);
  // …and back for the battle: nothing may start while the camera is still turning back.
  await page.evaluate(() => (location.hash = 'battle-of-arrakeen'));
  await step(page, 0.5);
  let s = await battle(page);
  expect(s.flying).toBe(true);
  expect(s.started).toBe(false);
  for (let i = 0; i < 40 && s.flying; i++) {
    await step(page, 0.2);
    s = await battle(page);
    expect(s.started && s.flying).toBe(false);
  }
  expect(s.flying).toBe(false);
  await step(page, 0.3);
  expect((await battle(page)).started).toBe(true);
  // The charge set to go off a few seconds after the camera comes to rest.
  await expect.poll(async () => (await step(page, 1), (await battle(page)).blasted), { timeout: 60_000 }).toBe(true);
  // A guided tour stays long enough for the worms to reach the camp.
  const hold = await page.evaluate(() => (window as unknown as GoldenPathWindow).__goldenPath.props.tourHold('battle-of-arrakeen'));
  expect(hold?.seconds).toBeGreaterThan(20);
});
