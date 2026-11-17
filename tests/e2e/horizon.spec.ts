import { expect, test } from '@playwright/test';
import { tuning } from '../../src/core/tuning';
import { LOAD_TIMEOUT } from './helpers';

test('horizonTest: panorama i odcięcie za obwiednią', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?scene=horizonTest&debug=1');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('horizon')), {
      timeout: LOAD_TIMEOUT,
    })
    .toBeTruthy();
  await page.locator('[data-weather="smog"]').click();
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('weather')))
    .toBe('smog');
  const horizon = (await page.evaluate(() =>
    window.__neoryder!.query('horizon'),
  )) as {
    far: number;
    radiusM: number;
    ringsM: number[];
    domeRadiusM: number;
    fogFar: number;
  };
  expect(horizon.far).toBeGreaterThan(
    horizon.radiusM + tuning.horizon.ringClearanceM,
  );
  expect(horizon.ringsM).toHaveLength(4);
  for (const radius of horizon.ringsM)
    expect(radius).toBeGreaterThan(horizon.radiusM);
  expect(horizon.domeRadiusM).toBeLessThan(horizon.far);
  expect(horizon.fogFar).toBeLessThan(horizon.far);
  expect(errors).toEqual([]);
});
