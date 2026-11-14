import { test, expect } from '@playwright/test';
import { SIM_TIMEOUT } from './helpers';

test('player-test ładuje modele bez błędów i wraca na podłogę po tp', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?scene=player-test&debug=1&seed=movement-e2e');
  await expect(page.getByLabel('Scena NEORYDER')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()))
    .toBe('player-test');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('grounded')), {
      timeout: SIM_TIMEOUT,
    })
    .toBe(true);
  const result = await page.evaluate(() => {
    const message = window.__neoryder?.command('tp 0 5 0');
    return {
      message,
      position: window.__neoryder?.query('playerPos'),
      grounded: window.__neoryder?.query('grounded'),
    };
  });
  expect(result.message).toBe('Gracz teleportowany.');
  expect(result.position).toEqual({ x: 0, y: 5, z: 0 });
  expect(result.grounded).toBe(false);
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('grounded')), {
      timeout: SIM_TIMEOUT,
    })
    .toBe(true);
  const settled = await page.evaluate(
    () => window.__neoryder?.query('playerPos') as { y: number },
  );
  expect(settled.y).toBeCloseTo(0.92, 1);
  await page
    .getByLabel('Scena NEORYDER')
    .click({ position: { x: 600, y: 400 } });
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement?.tagName))
    .toBe('CANVAS');
  await page.keyboard.down('KeyW');
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window.__neoryder?.query('playerPos') as { z: number }).z,
        ),
      { timeout: SIM_TIMEOUT },
    )
    .toBeLessThan(-1);
  await page.keyboard.up('KeyW');
  const shake = await page.evaluate(() =>
    window.__neoryder?.command('shake 0.8 0.5'),
  );
  expect(shake).toContain('Wstrząs');
  expect(
    await page.evaluate(() => window.__neoryder?.query('trauma')),
  ).toBeGreaterThan(0);
  await testInfo.attach('player-test', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  expect(errors).toEqual([]);
});
