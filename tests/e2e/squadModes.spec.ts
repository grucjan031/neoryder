import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { AllySnapshot } from '../../src/allies/ally';
import type { SquadMemberState } from '../../src/allies/roster';
import { LOAD_TIMEOUT, SIM_TIMEOUT } from './helpers';

/** Drużyna gracza poza misjami liniowymi: arena (sojusznicy walczą) i run (przez pokoje i odświeżenie). */
const query = <T>(page: Page, name: string) =>
  page.evaluate((n) => window.__neoryder?.query(n), name) as Promise<T>;
const command = (page: Page, line: string) =>
  page.evaluate((l) => window.__neoryder?.command(l), line);

test('arena z drużyną: sojusznicy walczą z wrogami', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(
    '/?scene=arena&debug=1&fx=lite&seed=squad-e2e&loadout=classic&squad=nadia,szron',
  );
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('arena');
  await command(page, 'god');
  const allies = await query<AllySnapshot[]>(page, 'allies');
  expect(allies.map((a) => a.id).sort()).toEqual(['nadia', 'szron']);
  await expect(page.locator('.squad-hud__member')).toHaveCount(2);
  // Sami sojusznicy zabijają wrogów fali; gracz stoi w miejscu.
  await expect
    .poll(() => query<number>(page, 'allyKills'), { timeout: 4 * SIM_TIMEOUT })
    .toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('run z drużyną: dwa pokoje, stan w zapisie i po odświeżeniu', async ({
  page,
}) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(
    '/?scene=run&seed=squad-run&loadout=classic&debug=1&fx=lite&squad=szron,nadia',
  );
  await expect
    .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
    .toBe('map');
  const start = await query<{ squad?: SquadMemberState[] }>(page, 'runState');
  expect(start.squad?.map((m) => m.id)).toEqual(['szron', 'nadia']);
  await command(page, 'god');

  const first = page.locator('.run-screen [data-node-id]').first();
  await first.click();
  await expect
    .poll(() => query(page, 'loading'), { timeout: LOAD_TIMEOUT })
    .toBe(false);
  await expect
    .poll(async () => (await query<AllySnapshot[]>(page, 'allies')).length)
    .toBe(2);
  await expect(page.locator('.squad-hud__member')).toHaveCount(2);
  // Szron pada, zanim pokój się skończy: do następnego pokoju przechodzi powalony.
  expect(await command(page, 'ally down szron')).toBe('Sojusznik powalony.');
  await command(page, 'run clear');
  await expect
    .poll(() => query(page, 'screen'), { timeout: SIM_TIMEOUT })
    .toBe('reward');
  const afterFirst = await query<{ squad?: SquadMemberState[] }>(
    page,
    'runState',
  );
  expect(afterFirst.squad?.find((m) => m.id === 'szron')?.hp).toBe(0);
  expect(afterFirst.squad?.find((m) => m.id === 'nadia')?.hp).toBeGreaterThan(
    0,
  );
  await page.locator('.run-screen button').first().click();
  await expect
    .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
    .toBe('map');
  await expect
    .poll(() => query(page, 'savePending'), { timeout: SIM_TIMEOUT })
    .toBe(false);

  // Drugi pokój: drużyna wchodzi z graczem, Szron nadal leży.
  await page.keyboard.press('Digit1');
  await expect
    .poll(() => query(page, 'loading'), { timeout: LOAD_TIMEOUT })
    .toBe(false);
  await expect
    .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
    .toBe('room');
  const inSecond = await query<AllySnapshot[]>(page, 'allies');
  expect(inSecond.map((a) => a.id).sort()).toEqual(['nadia', 'szron']);
  expect(inSecond.find((a) => a.id === 'szron')?.state).toBe('downed');
  await command(page, 'run clear');
  await expect
    .poll(() => query(page, 'screen'), { timeout: SIM_TIMEOUT })
    .toBe('reward');
  await page.locator('.run-screen button').first().click();
  await expect
    .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
    .toBe('map');
  await expect
    .poll(() => query(page, 'savePending'), { timeout: SIM_TIMEOUT })
    .toBe(false);
  const saved = await query<{ squad?: SquadMemberState[] }>(page, 'runState');
  expect(saved.squad).toHaveLength(2);

  // Odświeżenie („Kontynuuj run”) przywraca drużynę.
  await page.goto('/?scene=run&continue=1&debug=1&fx=lite');
  await expect
    .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
    .toBe('map');
  const restored = await query<{ squad?: SquadMemberState[] }>(
    page,
    'runState',
  );
  expect(restored.squad).toEqual(saved.squad);
  expect(errors).toEqual([]);
});
