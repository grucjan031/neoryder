import { expect, test } from '@playwright/test';
import { LOAD_TIMEOUT, SIM_TIMEOUT } from './helpers';

test('mgła spowalnia gracza do chwili opuszczenia strefy', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?scene=helix-test&debug=1&fx=lite&seed=r5c');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('helix-test');
  await page
    .getByLabel('Scena NEORYDER')
    .click({ position: { x: 600, y: 400 } });
  await page.evaluate(() => window.__neoryder?.command('helix freeze'));
  const stats = () =>
    page.evaluate(
      () =>
        JSON.parse(window.__neoryder!.command('helix stats')) as {
          slowed: boolean;
          speed: number;
          base: number;
          zones: number;
        },
    );
  expect(
    await page.evaluate(() => window.__neoryder?.command('helix fog')),
  ).toBe('Rzut');
  await expect
    .poll(async () => (await stats()).slowed, { timeout: SIM_TIMEOUT })
    .toBe(true);
  const inside = await stats();
  expect(inside.speed).toBeCloseTo(inside.base * 0.65);
  await page.keyboard.down('KeyD');
  try {
    await expect
      .poll(
        () =>
          page.evaluate(
            () => (window.__neoryder?.query('playerPos') as { x: number }).x,
          ),
        { timeout: SIM_TIMEOUT },
      )
      .toBeGreaterThan(3);
    await expect.poll(async () => (await stats()).slowed).toBe(false);
    const outside = await stats();
    expect(outside.zones).toBeGreaterThan(0);
    expect(outside.speed).toBeCloseTo(outside.base);
  } finally {
    await page.keyboard.up('KeyD');
  }
  expect(errors).toEqual([]);
});
