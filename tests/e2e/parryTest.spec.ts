import { test, expect } from '@playwright/test';
import { SIM_TIMEOUT } from './helpers';

test('parry-test: wieżyczka strzela wolnymi pociskami, trafienie rani gracza', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?scene=parry-test&debug=1&seed=parry-e2e');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()))
    .toBe('parry-test');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('projectiles')), {
      timeout: SIM_TIMEOUT,
    })
    .toBeGreaterThan(0);
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('playerHp')), {
      timeout: SIM_TIMEOUT,
    })
    .toBeLessThan(100);
  expect(errors).toEqual([]);
});
