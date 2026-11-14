import { test, expect } from '@playwright/test';
import { SIM_TIMEOUT } from './helpers';

test('arena: fale startują, zabicie fali przechodzi dalej, śmierć i powtórka', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?scene=arena&debug=1&seed=arena-e2e&loadout=classic');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()))
    .toBe('arena');
  const q = (name: string) =>
    page.evaluate((n) => window.__neoryder?.query(n), name);
  await expect.poll(() => q('wave'), { timeout: SIM_TIMEOUT }).toBe(1);
  await expect
    .poll(() => q('enemies'), { timeout: SIM_TIMEOUT })
    .toBeGreaterThan(0);
  // Czekamy, aż cała fala 1 się pojawi, i zabijamy ją.
  await expect
    .poll(() => q('phase'), { timeout: SIM_TIMEOUT })
    .toBe('fighting');
  const firstSpawns = await q('spawnLog');
  await page.evaluate(() => window.__neoryder?.command('kill all'));
  // Zabici wrogowie rozpadają się na odłamki (#12).
  await expect
    .poll(() => q('debris'), { timeout: SIM_TIMEOUT })
    .toBeGreaterThan(0);
  // …i grają dźwięk rozbicia (#14).
  expect(await q('recentSounds')).toContain('kill');
  await expect.poll(() => q('phase'), { timeout: SIM_TIMEOUT }).toBe('break');
  await expect.poll(() => q('wave'), { timeout: SIM_TIMEOUT }).toBe(2);
  // Śmierć gracza: skok do najtrudniejszej fali, gracz stoi bez obrony.
  await page.evaluate(() => window.__neoryder?.command('wave 12'));
  await expect.poll(() => q('dead'), { timeout: 120_000 }).toBe(true);
  const retry = page.getByRole('button', { name: /Jeszcze raz/ });
  await expect(retry).toBeVisible({ timeout: SIM_TIMEOUT });
  await retry.click();
  await expect.poll(() => q('dead')).toBe(false);
  expect(await q('playerHp')).toBe(100);
  // „Jeszcze raz” wznawia grę (bez dodatkowego kliknięcia canvasu)…
  await expect.poll(() => q('paused')).toBe(false);
  // …a ten sam seed daje ten sam przebieg fali 1.
  await expect
    .poll(() => q('spawnLog').then((log) => (log as unknown[]).length), {
      timeout: SIM_TIMEOUT,
    })
    .toBeGreaterThanOrEqual(2);
  expect(await q('spawnLog')).toEqual(firstSpawns);
  expect(errors).toEqual([]);
});
