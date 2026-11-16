import { LOAD_TIMEOUT } from './helpers';
import { expect, test } from '@playwright/test';
import type { HazardState } from '../../src/world/hazards';

test('combatWarehouse: debug detonuje beczkę bez błędów konsoli', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(
    '/?scene=room-test&room=combatWarehouse&loadout=gunner&seed=hazard-e2e&debug=1&fx=lite',
  );
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('room-test');
  const hazards = () =>
    page.evaluate(() => window.__neoryder?.query('hazards') as HazardState[]);
  const before = await hazards();
  expect(before).toHaveLength(4);
  const barrel = before.find((h) => h.kind === 'explosive_barrel' && h.alive)!;
  expect(barrel).toBeDefined();
  expect(
    await page.evaluate(
      (id) => window.__neoryder?.command(`hazard detonate ${id}`),
      barrel.id,
    ),
  ).toBe('Beczka zdetonowana.');
  await expect
    .poll(async () => (await hazards()).find((h) => h.id === barrel.id)?.alive)
    .toBe(false);
  expect(await page.evaluate(() => window.__neoryder?.query('kills'))).toBe(0);
  expect(errors).toEqual([]);
});
