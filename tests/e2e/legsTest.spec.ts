import { test, expect } from '@playwright/test';
import { LOAD_TIMEOUT, SIM_TIMEOUT } from './helpers';

test('legsTest ładuje nogi gracza bez błędów', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?scene=legsTest&debug=1&fx=lite&seed=legs-e2e');
  await expect(page.getByLabel('Scena NEORYDER')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('legsTest');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('grounded')), {
      timeout: SIM_TIMEOUT,
    })
    .toBe(true);
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});
