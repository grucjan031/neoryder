import { expect, test } from '@playwright/test';
import { waitSimSteps } from './helpers';

test('run: wybór węzła, wejście do pokoju, run clear, wybór implantu i powrót na mapę', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=run&seed=test1&loadout=classic&debug=1');
  const query = (name: string) =>
    page.evaluate((key) => window.__neoryder?.query(key), name);
  await expect.poll(() => query('screen')).toBe('map');
  const first = page.locator('.run-screen [data-node-id]').first();
  const id = await first.getAttribute('data-node-id');
  await first.click();
  await expect.poll(() => query('room')).toBeTruthy();
  await expect.poll(() => query('loading')).toBe(false);
  expect(await query('runState')).toMatchObject({
    currentNodeId: id,
    loadoutId: 'classic',
  });
  expect(await query('doors')).toMatchObject({ exit: { open: false } });
  await page.evaluate(() => window.__neoryder?.command('run clear'));
  await expect.poll(() => query('screen')).toBe('reward');
  // F3-11: ekran nagrody pokazuje 3 prawdziwe implanty; klawisz 1 wybiera pierwszy.
  await expect(page.locator('.run-screen button')).toHaveCount(3);
  await page.keyboard.press('Digit1');
  await expect.poll(() => query('screen')).toBe('map');
  expect(
    ((await query('runState')) as { implants: string[] }).implants,
  ).toHaveLength(1);
  expect(await query('room')).toBeNull();
  await page.keyboard.press('Digit1');
  await expect.poll(() => query('loading')).toBe(false);
  await expect.poll(() => query('screen')).toBe('room');
  await page.evaluate(() => window.__neoryder?.command('run clear'));
  await expect.poll(() => query('screen')).toBe('reward');
  await page.locator('.run-screen button').first().click();
  await expect.poll(() => query('screen')).toBe('map');
  expect(
    ((await query('runState')) as { implants: string[] }).implants,
  ).toHaveLength(2);
  expect(await query('runError')).toBeNull();
  expect(errors).toEqual([]);
});

test('run: dojście do bossa, kill all po progach faz i ekran zwycięstwa', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=run&seed=test1&loadout=classic&debug=1');
  const query = (name: string) =>
    page.evaluate((key) => window.__neoryder?.query(key), name);
  const command = (text: string) =>
    page.evaluate((cmd) => window.__neoryder?.command(cmd), text);
  // Przejście mapy: pierwszy dostępny węzeł każdej warstwy aż do bossa.
  for (let layer = 0; layer < 8; layer++) {
    await expect.poll(() => query('screen')).toBe('map');
    await page.keyboard.press('Digit1');
    await expect.poll(() => query('loading'), { timeout: 30_000 }).toBe(false);
    await expect.poll(() => query('screen')).toMatch(/^(room|shop|rest)$/);
    if ((await query('room')) === 'bossRoom') break;
    if ((await query('screen')) === 'room') {
      await command('run clear');
      await expect.poll(() => query('screen')).toBe('reward');
    }
    await page.keyboard.press('Enter');
  }
  expect(await query('room')).toBe('bossRoom');
  expect(await query('phase')).toBe('stopped');
  expect(await query('boss')).toMatchObject({ phase: 1, hp: 900 });
  await command('god');
  // Każde „kill all” przechodzi najwyżej jeden próg fazy (nietykalność przejścia).
  for (let i = 0; i < 3; i++) {
    await waitSimSteps(page, 75);
    await command('kill all');
  }
  await expect.poll(() => query('screen')).toBe('summary');
  await expect(page.getByText('Zwycięstwo', { exact: true })).toBeVisible();
  expect(await query('runError')).toBeNull();
  expect(errors).toEqual([]);
});
