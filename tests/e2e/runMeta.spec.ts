import { expect, test } from '@playwright/test';

test('run z kryjówki: ekwipunek z meta, zwycięstwo zapisuje nagrody i pokazuje je w podsumowaniu', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const query = (name: string) =>
    page.evaluate((key) => window.__neoryder?.query(key), name);
  const command = (value: string) =>
    page.evaluate((line) => window.__neoryder?.command(line), value);

  await page.goto('/?scene=run&loadout=meta&seed=meta-e2e&debug=1');
  await expect.poll(() => query('screen')).toBe('map');
  expect(await query('runState')).toMatchObject({
    loadoutId: 'custom',
    talents: [],
    threatLevel: 0,
  });
  expect(await query('level')).toMatchObject({ level: 1 });

  await command('meta xp 40');
  await command('run end win');
  await expect.poll(() => query('screen')).toBe('summary');
  const rewards = page.getByTestId('run-meta-rewards');
  await expect(rewards).toContainText('Doświadczenie: +50');
  await expect(rewards).toContainText('Dane: +30');
  await expect(rewards).toContainText('Rdzenie: +3');
  await expect(rewards).toContainText('Poziom 1 → 2');
  await expect(
    page.getByRole('button', { name: 'Wróć do kryjówki' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Menu', exact: true }),
  ).toBeVisible();

  // Nagrody są zapisane (zapis przed clearRun) i nie wracają po ponownym wejściu.
  await expect.poll(() => query('savePending')).toBe(false);
  await page.goto('/?scene=run&loadout=meta&seed=meta-e2e-2&debug=1');
  await expect.poll(() => query('screen')).toBe('map');
  expect(await query('meta')).toMatchObject({
    xp: 90,
    data: 30,
    cores: 3,
    stats: { runs: 1, victories: 1 },
  });

  await command('run end lose');
  await expect.poll(() => query('screen')).toBe('summary');
  await page.getByRole('button', { name: 'Wróć do kryjówki' }).click();
  await expect(page).toHaveURL(/scene=hub/);
  expect(errors).toEqual([]);
});
