import { expect, test } from '@playwright/test';
import { LOAD_TIMEOUT, waitSimSteps } from './helpers';

test('run: Tab otwiera menu ulepszeń z implantami, pauzuje symulację, Tab zamyka', async ({
  page,
}) => {
  test.setTimeout(4 * LOAD_TIMEOUT);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=run&seed=inventory&loadout=classic&debug=1&fx=lite');
  const query = (name: string) =>
    page.evaluate((key) => window.__neoryder?.query(key), name);
  await expect
    .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
    .toBe('map');
  await page.evaluate(() => window.__neoryder?.command('implant overclock'));
  await page.locator('.run-screen [data-node-id]').first().click();
  await expect
    .poll(() => query('loading'), { timeout: LOAD_TIMEOUT })
    .toBe(false);
  await expect
    .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
    .toBe('room');
  await waitSimSteps(page, 30);
  const panel = page.locator('.run-inventory');
  await expect(panel).toBeHidden();

  await page.keyboard.press('Tab');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Implanty (1)');
  await expect(panel.locator('.run-inventory__item[data-rarity]')).toHaveCount(
    1,
  );
  // Pauza: licznik kroków stoi, dopóki panel jest otwarty.
  const frozen = await page.evaluate(() => window.__neoryder?.tick() ?? 0);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__neoryder?.tick() ?? 0)).toBe(
    frozen,
  );

  await page.keyboard.press('Tab');
  await expect(panel).toBeHidden();
  await waitSimSteps(page, 30);

  // Esc też zamyka, a menu pauzy się nie otwiera.
  await page.keyboard.press('Tab');
  await expect(panel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(page.locator('dialog.pause-menu[open]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
