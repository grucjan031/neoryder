import { test, expect } from '@playwright/test';
import { SIM_TIMEOUT, waitSimSteps } from './helpers';

test('melee-test: cios ostrzem rani manekina, blok redukuje obrażenia', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?scene=melee-test&debug=1&seed=melee-e2e');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()))
    .toBe('melee-test');
  const canvas = page.getByLabel('Scena NEORYDER');
  await canvas.click({ position: { x: 640, y: 360 } });
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement?.tagName))
    .toBe('CANVAS');
  // Lekki cios: krótki klik LPM.
  await page.mouse.down({ button: 'left' });
  await waitSimSteps(page, 2);
  await page.mouse.up({ button: 'left' });
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window.__neoryder?.query('dummyHp') as number[])[1],
        ),
      { timeout: SIM_TIMEOUT },
    )
    .toBeLessThan(100);
  // Blok PPM: 40 obrażeń -> 12.
  await page.mouse.down({ button: 'right' });
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('blocking')), {
      timeout: SIM_TIMEOUT,
    })
    .toBe(true);
  const reply = await page.evaluate(() =>
    window.__neoryder?.command('enemyhit 40'),
  );
  expect(reply).toContain('12.0');
  await page.mouse.up({ button: 'right' });
  expect(errors).toEqual([]);
});
