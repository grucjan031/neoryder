import { expect, test } from '@playwright/test';

test('run: wybór węzła, wejście do pokoju, run clear, nagroda i powrót na mapę', async ({
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
  await expect(page.getByText('brak nagród', { exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect.poll(() => query('screen')).toBe('map');
  expect(await query('room')).toBeNull();
  await page.keyboard.press('Digit1');
  await expect.poll(() => query('loading')).toBe(false);
  await expect.poll(() => query('screen')).toBe('room');
  await page.evaluate(() => window.__neoryder?.command('run clear'));
  await expect.poll(() => query('screen')).toBe('reward');
  await page.getByRole('button', { name: 'Dalej', exact: true }).click();
  await expect.poll(() => query('screen')).toBe('map');
  expect(await query('runError')).toBeNull();
  expect(errors).toEqual([]);
});
