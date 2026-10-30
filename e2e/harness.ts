import type { Page } from '@playwright/test';

/**
 * A fake clock the scene runs on: the app animates from `performance.now()`, so each step is one
 * frame of exactly that many seconds however slow the software renderer is, and every run sees
 * the same frames. Call before the page loads.
 */
export async function useSceneClock(page: Page): Promise<void> {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
}

/** Run the scene forward, a tenth of a second per frame. */
export async function step(page: Page, seconds: number): Promise<void> {
  for (let i = 0; i < Math.round(seconds * 10); i++) await page.clock.fastForward(100);
}

/** Collects uncaught errors and console errors or warnings, so a test can insist there were none. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`);
  });
  return errors;
}

/** What `?e2e` exposes, typed as loosely as the tests use it. */
export interface GoldenPathWindow {
  __goldenPath: {
    world: {
      isFlying(): boolean;
      camera: unknown;
      renderer: { domElement: HTMLCanvasElement };
    };
    props: {
      sceneSamples(id: string): { kind: string; points: { clone(): { project(c: unknown): { x: number; y: number; z: number } } }[] }[];
      tourDwell(id: string): number;
      [k: string]: unknown;
    };
    res: { events: { id: string; importance: number }[] };
  };
}
