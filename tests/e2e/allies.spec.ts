import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { LOAD_TIMEOUT, SIM_TIMEOUT, waitSimSteps } from './helpers';

/** Sojusznicy (`?scene=ally-test`): marsz za graczem, walka, powalenie i podniesienie klawiszem E. */
interface AllyState {
  id: string;
  state: string;
  order: string;
  hp: number;
  maxHp: number;
  shots: number;
  position: { x: number; y: number; z: number };
}

const query = <T>(page: Page, name: string) =>
  page.evaluate((n) => window.__neoryder?.query(n), name) as Promise<T>;
const command = (page: Page, line: string) =>
  page.evaluate((l) => window.__neoryder?.command(l), line);
const ally = async (page: Page, id: string) =>
  (await query<AllyState[]>(page, 'allies')).find((a) => a.id === id)!;

async function open(page: Page, errors: string[]) {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?scene=ally-test&debug=1&fx=lite');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('ally-test');
}

test('ally-test: drużyna idzie za graczem i zabija wrogów', async ({
  page,
}) => {
  test.setTimeout(6 * SIM_TIMEOUT);
  const errors: string[] = [];
  await open(page, errors);
  const squad = await query<AllyState[]>(page, 'allies');
  expect(squad.map((a) => a.id)).toEqual(['nadia', 'szron']);
  await expect(page.locator('.squad-hud__member')).toHaveCount(2);
  await expect(page.locator('.squad-hud')).toContainText('Nadia');
  await expect(page.locator('.squad-hud')).toContainText('Szron');
  await command(page, 'god');

  // Gracz przenosi się na drugi koniec placu: sojusznicy dochodzą do niego sami.
  await command(page, 'tp -8 -2');
  await expect
    .poll(
      async () => {
        const player = await query<{ x: number; z: number }>(page, 'playerPos');
        const allies = await query<AllyState[]>(page, 'allies');
        return Math.max(
          ...allies.map((a) =>
            Math.hypot(a.position.x - player.x, a.position.z - player.z),
          ),
        );
      },
      { timeout: SIM_TIMEOUT },
    )
    .toBeLessThan(7);

  // Fale ruszają same; licznik zabójstw drużyny rośnie bez udziału gracza.
  await expect
    .poll(() => query<number>(page, 'allyKills'), { timeout: 4 * SIM_TIMEOUT })
    .toBeGreaterThan(0);
  expect(await query<number>(page, 'kills')).toBe(0);
  expect(errors).toEqual([]);
});

test('ally-test: powalenie, podniesienie przez E i rozkaz klawiszem T', async ({
  page,
}) => {
  test.setTimeout(6 * SIM_TIMEOUT);
  const errors: string[] = [];
  await open(page, errors);
  await command(page, 'god');
  // Bez wrogów: test dotyczy podnoszenia, nie walki.
  await command(page, 'ally waves off');
  await command(page, 'kill all');

  await command(page, 'ally down nadia');
  await expect
    .poll(async () => (await ally(page, 'nadia')).state)
    .toBe('downed');
  await expect(
    page.locator('.squad-hud__member[data-ally="nadia"]'),
  ).toHaveAttribute('data-state', 'downed');
  // Z daleka podpowiedzi nie ma; przy powalonym pojawia się z klawiszem interakcji.
  await command(page, 'tp 9.5 9.5');
  await waitSimSteps(page, 10);
  await expect(page.locator('.squad-hud__revive')).toBeHidden();
  const at = (await ally(page, 'nadia')).position;
  await command(page, `tp ${at.x + 0.9} ${at.z + 0.9}`);
  await expect(page.locator('.squad-hud__revive')).toContainText('Nadia');
  await expect(page.locator('.squad-hud__revive')).toContainText('[E]');

  await page
    .getByLabel('Scena NEORYDER')
    .click({ position: { x: 600, y: 400 } });
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement?.tagName))
    .toBe('CANVAS');
  await page.keyboard.down('KeyE');
  await expect
    .poll(async () => (await ally(page, 'nadia')).state, {
      timeout: SIM_TIMEOUT,
    })
    .not.toMatch(/downed|reviving/);
  await page.keyboard.up('KeyE');
  const revived = await ally(page, 'nadia');
  expect(revived.hp).toBeGreaterThan(0);
  expect(revived.hp).toBeLessThan(revived.maxHp);
  await expect(page.locator('.squad-hud__revive')).toBeHidden();

  expect(await query<string>(page, 'squadOrder')).toBe('follow');
  await page.keyboard.press('KeyT');
  await expect.poll(() => query<string>(page, 'squadOrder')).toBe('hold');
  await command(page, 'ally follow');
  await expect.poll(() => query<string>(page, 'squadOrder')).toBe('follow');
  expect(errors).toEqual([]);
});
