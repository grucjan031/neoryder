import { test, expect } from '@playwright/test';
import { LOAD_TIMEOUT, SIM_TIMEOUT, waitSimSteps } from './helpers';

// Prawdziwy pokój: Szturmowiec atakuje, gracz co chwilę wciska blok (PPM).
// Część ciosów trafia w okno meleeParryWindowMs — parowanie nie może wywrócić kroku gry.
test('parowanie wręcz: blok tuż przed ciosem Szturmowca paruje bez błędów', async ({
  page,
}) => {
  test.setTimeout(SIM_TIMEOUT + LOAD_TIMEOUT + 30_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(
    '/?scene=room-test&room=combatYard&loadout=blade&seed=parry-e2e&debug=1&fx=lite',
  );
  const query = (name: string) =>
    page.evaluate((n) => window.__neoryder?.query(n), name);
  const command = (text: string) =>
    page.evaluate((c) => window.__neoryder?.command(c), text);
  await expect
    .poll(() => query('enemies'), { timeout: LOAD_TIMEOUT })
    .toBeGreaterThan(0);
  await command('god');
  await command('kill all');
  await expect.poll(() => query('enemies')).toBe(0);
  expect(await command('spawn assaulter 1')).toBe('Utworzono: 1');
  await page.mouse.click(640, 360);

  const deadline = Date.now() + SIM_TIMEOUT;
  while (
    Date.now() < deadline &&
    ((await query('meleeParries')) as number) < 1
  ) {
    await page.mouse.down({ button: 'right' });
    await page.waitForTimeout(120);
    await page.mouse.up({ button: 'right' });
    await page.waitForTimeout(40);
  }
  expect(await query('meleeParries')).toBeGreaterThan(0);
  // Po parowaniu gra dalej się toczy (wcześniej sparowany cios wywracał krok symulacji).
  await waitSimSteps(page, 30);
  expect(await query('playerHp')).toBe(await query('playerMaxHp'));
  expect(errors).toEqual([]);
});
