import { expect, test } from '@playwright/test';
import { LOAD_TIMEOUT } from './helpers';

test('winda w biurowcu ładuje się i przyjmuje wezwanie', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?scene=elevator-test&debug=1&fx=lite&seed=winda');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('elevator-test');
  expect(
    await page.evaluate(() =>
      window.__neoryder?.command('elevator call biuro 2'),
    ),
  ).toBe('Wezwanie na piętro 2.');
  expect(
    await page.evaluate(() => window.__neoryder?.query('elevators')),
  ).toMatchObject([{ id: 'biuro' }]);
  expect(errors).toEqual([]);
});
