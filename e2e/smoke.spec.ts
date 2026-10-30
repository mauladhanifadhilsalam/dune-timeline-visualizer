import { expect, test } from '@playwright/test';
import { watchErrors } from './harness';

test.use({ viewport: { width: 1440, height: 900 } });

test('the intro, stepping, the tour, search, reckoning and filters work without an error', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./');
  await page.click('#btn-enter');
  await expect(page.locator('#intro-primer')).toBeVisible();
  await page.click('#btn-explore');

  // Exploring starts at Paul's birth, with its card open.
  const title = page.locator('.panel-title');
  await expect(title).toContainText('Paul');
  const first = await title.textContent();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(title).not.toHaveText(first!);

  // Space starts and stops the tour.
  const tour = page.locator('#btn-tour');
  await page.keyboard.press(' ');
  await expect(tour).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press(' ');
  await expect(tour).toHaveAttribute('aria-pressed', 'false');

  // Search jumps to an event and puts it in the address.
  const before = await title.textContent();
  await page.fill('#search', 'nayla');
  await page.keyboard.press('Enter');
  await expect(title).not.toHaveText(before!);
  expect(new URL(page.url()).hash.length).toBeGreaterThan(1);

  // R counts Paul's reign from the other year, which moves a God Emperor-era date.
  const year = page.locator('.panel-year');
  const reckoned = await year.textContent();
  await page.keyboard.press('r');
  await expect(year).not.toHaveText(reckoned!);

  // Filtering out a novel greys its ticks on the timeline; showing everything brings them back.
  await page.click('#btn-view');
  await page.click('.popover >> text=Messiah');
  await expect.poll(() => page.locator('.scrub-tick.is-off').count()).toBeGreaterThan(0);
  await page.click('.popover >> text=Show everything');
  await expect(page.locator('.scrub-tick.is-off')).toHaveCount(0);

  // Escape closes the popover, then the card.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.locator('#panel')).toBeHidden();

  expect(errors).toEqual([]);
});
