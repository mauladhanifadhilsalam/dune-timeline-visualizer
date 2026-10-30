import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('on a phone the card is a short sheet that folds down to a bar', async ({ page }) => {
  await page.goto('./#jamis-duel');
  const panel = page.locator('#panel');
  await expect(panel).toBeVisible();
  await expect(page.locator('.panel-title')).toContainText('Jamis');

  // A sheet over the bottom of the screen, about a quarter of it, so the scene stays in view.
  const open = (await panel.boundingBox())!;
  expect(open.height).toBeLessThanOrEqual(844 * 0.32);
  expect(open.y + open.height).toBeGreaterThan(844 - 40);
  // The timeline bar steps aside while a card is open.
  await expect(page.locator('#scrubber')).toHaveCSS('visibility', 'hidden');

  // The handle folds it down to a bar with the event's name, and back up.
  await page.tap('.sheet-handle');
  await expect(panel).toHaveClass(/is-collapsed/);
  await expect.poll(async () => (await panel.boundingBox())!.height).toBeLessThan(100);
  await expect(page.locator('.sheet-peek')).toContainText('Jamis');
  await page.tap('.sheet-handle');
  await expect(panel).not.toHaveClass(/is-collapsed/);
  await expect.poll(async () => (await panel.boundingBox())!.height).toBeGreaterThan(150);
});
