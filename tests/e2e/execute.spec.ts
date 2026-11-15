import { test, expect } from '@playwright/test';
import { SIM_TIMEOUT } from './helpers';

test('osłabieni wrogowie są gotowi do wykończenia', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(
    '/?scene=room-test&room=combatYard&loadout=blade&seed=exec-e2e&debug=1',
  );
  const query = (name: string) =>
    page.evaluate((n) => window.__neoryder?.query(n), name);
  await expect
    .poll(() => query('enemies'), { timeout: SIM_TIMEOUT })
    .toBeGreaterThan(0);
  await page.evaluate(() => window.__neoryder?.command('weaken 10'));
  await expect
    .poll(async () => ((await query('executable')) as number[]).length, {
      timeout: SIM_TIMEOUT,
    })
    .toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
