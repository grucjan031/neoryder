import { expect, test } from '@playwright/test';
import { LOAD_TIMEOUT, waitSimSteps } from './helpers';

// TODO: tymczasowy test zakładki „Testy map” — usunąć razem z nią po audycie map.
test('menu → Testy map → mapa: gracz na ziemi, bez wrogów', async ({
  page,
}) => {
  await page.goto('/?debug=1&fx=lite');
  await page.getByRole('button', { name: 'Testy map' }).click();
  await expect(page.getByRole('heading', { name: 'Testy map' })).toBeVisible();
  await expect(page.locator('[data-map-id="m01-maszty"]')).toBeVisible();
  await expect(page.locator('[data-map-id="bossRoom"]')).toBeVisible();
  await page.locator('[data-map-id="bossRoom"]').click();
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('walkMap')), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('bossRoom');
  await waitSimSteps(page, 90);
  expect(await page.evaluate(() => window.__neoryder!.query('enemies'))).toBe(
    0,
  );
  const pos = (await page.evaluate(() =>
    window.__neoryder!.query('playerPos'),
  )) as { y: number };
  expect(pos.y).toBeLessThan(2);
  await page.screenshot({ path: 'test-results/map-walk-bossRoom.png' });
});

test('misja m01-maszty ładuje się bez wrogów', async ({ page }) => {
  await page.goto('/?scene=map-walk&map=m01-maszty&debug=1&fx=lite');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('walkMap')), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('m01-maszty');
  await waitSimSteps(page, 300);
  expect(await page.evaluate(() => window.__neoryder!.query('enemies'))).toBe(
    0,
  );
  const pos = (await page.evaluate(() =>
    window.__neoryder!.query('playerPos'),
  )) as { y: number };
  expect(pos.y).toBeLessThan(2);
  await page.screenshot({ path: 'test-results/map-walk-m01.png' });
});
