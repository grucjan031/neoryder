import { expect, test } from '@playwright/test';
import { SIM_TIMEOUT, waitSimSteps } from './helpers';

const URL = '/?scene=run&seed=bot-1&loadout=classic&debug=1';

test('bot: cała mapa z cheatami do zwycięstwa nad bossem', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(URL);
  const query = (name: string) =>
    page.evaluate((key) => window.__neoryder?.query(key), name);
  const command = (text: string) =>
    page.evaluate((cmd) => window.__neoryder?.command(cmd), text);

  await expect.poll(() => query('screen')).toBe('map');
  const layers = ((await query('map')) as { layers: unknown[][] }).layers
    .length;
  const started = Date.now();
  for (let layer = 0; layer < layers; layer++) {
    await expect.poll(() => query('screen')).toBe('map');
    await page.keyboard.press('Digit1');
    await expect.poll(() => query('loading'), { timeout: 30_000 }).toBe(false);
    await expect.poll(() => query('screen')).toMatch(/^(room|shop|rest)$/);
    if ((await query('room')) === 'bossRoom') break;
    if ((await query('screen')) === 'room') {
      await command('run clear');
      await expect
        .poll(() => query('screen'), { timeout: SIM_TIMEOUT })
        .toBe('reward');
      await page.keyboard.press('Digit1');
    } else {
      await page.keyboard.press('Enter');
    }
  }
  expect(await query('room')).toBe('bossRoom');
  await command('god');
  for (let i = 0; i < 3; i++) {
    await waitSimSteps(page, 75);
    await command('kill all');
  }
  await expect.poll(() => query('screen')).toBe('summary');
  await expect(page.getByText('Zwycięstwo', { exact: true })).toBeVisible();
  const state = (await query('runState')) as { visited: string[] };
  expect(state.visited).toHaveLength(layers);
  await expect(page.locator('.run-screen')).toContainText(
    new RegExp(`Pokoje: ${layers} `),
  );
  expect(await query('runError')).toBeNull();
  expect(errors).toEqual([]);
  console.log(
    `bot: przejście w ${((Date.now() - started) / 1000).toFixed(1)} s`,
  );
});

test('bot: śmierć -> podsumowanie porażki -> Menu', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(URL);
  const query = (name: string) =>
    page.evaluate((key) => window.__neoryder?.query(key), name);
  await expect.poll(() => query('screen')).toBe('map');
  await page.keyboard.press('Digit1');
  await expect.poll(() => query('loading'), { timeout: 30_000 }).toBe(false);
  await page.evaluate(() => window.__neoryder?.command('hurt 9999'));
  await expect.poll(() => query('screen')).toBe('summary');
  await expect(page.getByText('Porażka', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('button', { name: 'Kryjówka' })).toBeVisible();
  expect(errors).toEqual([]);
});
