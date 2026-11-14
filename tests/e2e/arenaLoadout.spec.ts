import { test, expect } from '@playwright/test';
import { SIM_TIMEOUT } from './helpers';

test('arena: gunner switches the active weapon and HUD with Digit2', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=arena&debug=1&seed=loadout-e2e&loadout=gunner');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()))
    .toBe('arena');
  const weapon = page.locator('.hud__weapon-name');
  await expect(weapon).toHaveText('Karabin');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('loadout')))
    .toBe('gunner');
  await page.evaluate(() => window.__neoryder?.command('god'));
  await page
    .getByLabel('Scena NEORYDER')
    .click({ position: { x: 640, y: 360 } });
  await page.keyboard.press('Digit2');
  await expect(weapon).toHaveText('Rozpraszacz', { timeout: SIM_TIMEOUT });
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('weapon')), {
      timeout: SIM_TIMEOUT,
    })
    .toBe('scatter');
  await page.keyboard.press('Digit1');
  await expect(weapon).toHaveText('Karabin', { timeout: SIM_TIMEOUT });
  expect(errors).toEqual([]);
});
