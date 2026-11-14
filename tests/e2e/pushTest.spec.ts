import { test, expect } from '@playwright/test';
import { SIM_TIMEOUT, waitSimSteps } from './helpers';

test('push-test: F odrzuca manekina na ścianę i zużywa energię', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?scene=push-test&debug=1&seed=push-e2e');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()))
    .toBe('push-test');
  await page
    .getByLabel('Scena NEORYDER')
    .click({ position: { x: 640, y: 360 } });
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement?.tagName))
    .toBe('CANVAS');
  // Kliknięcie przechwytujące mysz to też LPM (cios ostrzem) — mierzymy od stanu po nim.
  await waitSimSteps(page, 40);
  const hpBefore = await page.evaluate(
    () => (window.__neoryder?.query('dummyHp') as number[])[1] ?? 0,
  );
  const startZ = await page.evaluate(
    () => (window.__neoryder?.query('dummyPos') as { z: number }[])[1]?.z,
  );
  await page.keyboard.press('KeyF');
  // Pchnięcie (10) + uderzenie w ścianę (30).
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window.__neoryder?.query('dummyHp') as number[])[1],
        ),
      { timeout: SIM_TIMEOUT },
    )
    .toBe(hpBefore - 40);
  const endZ = await page.evaluate(
    () => (window.__neoryder?.query('dummyPos') as { z: number }[])[1]?.z,
  );
  expect(endZ).toBeLessThan((startZ ?? 0) - 1);
  expect(
    await page.evaluate(() => window.__neoryder?.query('energy')),
  ).toBeLessThan(100);
  expect(errors).toEqual([]);
});
