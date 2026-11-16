import { test, expect } from '@playwright/test';
import { LOAD_TIMEOUT, SIM_TIMEOUT } from './helpers';

for (const room of ['combatYard', 'combatPillars'])
  test(`room-test: ${room}, start pierwszej fali i run clear`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(
      `/?scene=room-test&room=${room}&loadout=gunner&seed=room-e2e&debug=1&fx=lite`,
    );
    const query = (name: string) =>
      page.evaluate((n) => window.__neoryder?.query(n), name);
    await expect
      .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
        timeout: LOAD_TIMEOUT,
      })
      .toBe('room-test');
    expect(await query('loadout')).toBe('gunner');
    expect(await query('heldItem')).toMatchObject({ held: 'gun' });
    expect(await query('doors')).toMatchObject({ exit: { open: false } });
    await expect.poll(() => query('wave'), { timeout: SIM_TIMEOUT }).toBe(1);
    await expect
      .poll(() => query('enemies'), { timeout: SIM_TIMEOUT })
      .toBeGreaterThan(0);
    await page.evaluate(() => window.__neoryder?.command('hold blade'));
    expect(await query('heldItem')).toMatchObject({ held: 'blade' });
    await page.evaluate(() => window.__neoryder?.command('run clear'));
    expect(await query('roomCleared')).toBe(true);
    expect(await query('enemies')).toBe(0);
    expect(await query('doors')).toMatchObject({
      entry: { open: false },
      exit: { open: true },
    });
    expect(errors).toEqual([]);
  });
