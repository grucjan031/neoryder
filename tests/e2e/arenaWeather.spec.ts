import { expect, test } from '@playwright/test';
import { LOAD_TIMEOUT } from './helpers';

for (const [arena, weather, points] of [
  ['arenaOverpass', 'smog', ['A', 'B', 'C']],
  ['arenaRooftops', 'drizzleWind', ['A', 'B', 'C', 'D', 'E']],
] as const) {
  test(`Przejęcie: ${arena}, profil ${weather}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(`/?scene=conquest&arena=${arena}&debug=1`);
    await expect
      .poll(() => page.evaluate(() => window.__neoryder?.query('room')), {
        timeout: LOAD_TIMEOUT,
      })
      .toBe(arena);
    await expect
      .poll(() => page.evaluate(() => window.__neoryder?.query('loading')), {
        timeout: LOAD_TIMEOUT,
      })
      .toBe(false);
    await expect
      .poll(() => page.evaluate(() => window.__neoryder?.query('weather')))
      .toBe(weather);
    await page.evaluate(() => window.__neoryder?.command('god'));
    const conquest = await page.evaluate(() =>
      window.__neoryder?.query('conquest'),
    );
    expect(conquest).toMatchObject({
      points: points.map((id) => ({ id })),
    });
    await expect
      .poll(() => page.evaluate(() => window.__neoryder?.query('enemies')), {
        timeout: LOAD_TIMEOUT,
      })
      .toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}

test('Przejęcie startuje w porcie; siedem profili przełącza się bez błędów', async ({
  page,
}) => {
  test.setTimeout(6 * LOAD_TIMEOUT);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?scene=conquest&arena=arenaContainerPort&debug=1');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('screen')), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('room');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('room')), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('arenaContainerPort');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('weather')), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('storm');
  await page.evaluate(() => window.__neoryder?.command('god'));
  expect(
    await page.evaluate(() => window.__neoryder?.query('conquest')),
  ).toBeTruthy();
  await page.goto('/?scene=weatherTest&debug=1');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('loading')), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe(false);
  for (const id of [
    'rain',
    'storm',
    'smog',
    'drizzleWind',
    'clearNight',
    'snow',
    'ashfall',
  ]) {
    await page.locator(`[data-weather="${id}"]`).click();
    await expect
      .poll(() => page.evaluate(() => window.__neoryder?.query('weather')))
      .toBe(id);
    await page.waitForTimeout(100);
  }
  expect(errors).toEqual([]);
});
