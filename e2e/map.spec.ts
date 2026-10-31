import { expect, test } from '@playwright/test';
import { watchErrors } from './harness';

test.use({ viewport: { width: 1280, height: 760 }, reducedMotion: 'reduce' });

test('the map of Arrakis names its places and leads to and from the timeline', async ({ page }) => {
  // Building the relief and drawing it in software takes a while.
  test.setTimeout(300_000);
  const errors = watchErrors(page);
  await page.goto('./#atreides-arrive');
  const title = page.locator('.panel-title');
  const app = page.locator('#app');
  await expect(title).toHaveText('House Atreides takes Arrakis');

  // The event's card says where it happens, which opens the map there.
  await page.click('.place-link >> text=Arrakeen');
  await expect(app).toHaveClass(/is-map/);
  await expect(title).toHaveText('Arrakeen');
  expect(new URL(page.url()).hash).toBe('#map/arrakeen');
  await expect(page.locator('.map-lbl.on', { hasText: 'Old Gap' })).toBeVisible();

  // The whole map: its places named, never one name over another.
  await page.click('.nav-btn >> text=The whole map');
  await expect(page.locator('#panel')).toBeHidden();
  for (const name of ['Arrakeen', 'Sietch Tabr', 'Polar Sink', 'The Great Flat']) {
    await expect(page.locator('.map-lbl.on', { hasText: name })).toBeVisible();
  }
  const overlaps = await page.$$eval('.map-lbl.on', (els) => {
    const r = els.map((e) => e.getBoundingClientRect());
    let n = 0;
    for (let i = 0; i < r.length; i++)
      for (let j = i + 1; j < r.length; j++)
        if (r[i].left < r[j].right - 1 && r[j].left < r[i].right - 1 && r[i].top < r[j].bottom - 1 && r[j].top < r[i].bottom - 1) n++;
    return n;
  });
  expect(overlaps).toBe(0);

  // A place's card lists what happens there, and choosing that goes back to the path.
  await page.click('.map-lbl.on >> text=Sietch Tabr');
  await expect(title).toHaveText('Sietch Tabr');
  await page.click('.place-events button');
  await expect(app).not.toHaveClass(/is-map/);
  await expect(title).toContainText('Sietch Tabr');
  const raid = await title.textContent();

  // M opens the map, Esc goes back to where you were.
  await page.keyboard.press('m');
  await expect(app).toHaveClass(/is-map/);
  await page.keyboard.press('Escape');
  await expect(app).not.toHaveClass(/is-map/);
  await expect(title).toHaveText(raid!);

  expect(errors).toEqual([]);
});

test('a link to a place on the map opens it straight away', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('./#map/old-gap');
  await expect(page.locator('#app')).toHaveClass(/is-map/);
  await expect(page.locator('.panel-title')).toHaveText('Old Gap');
  await expect(page.locator('.panel-year')).toHaveText('down to 2,240 m');
  await expect(page.locator('.place-events')).toContainText('Battle of Arrakeen');
});
