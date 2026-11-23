import { expect, test, type Page } from '@playwright/test';
import { LOAD_TIMEOUT, SIM_TIMEOUT, waitSimSteps } from './helpers';

const ID = 'm09-brat';
const query = (page: Page, key: string) =>
  page
    .evaluate((name) => window.__neoryder?.query(name), key)
    .catch(() => undefined);
const command = (page: Page, line: string) =>
  page.evaluate((text) => window.__neoryder?.command(text), line);
type State = {
  objectives: Record<string, string>;
  activeEncounters: string[];
  openGates: string[];
};
const mission = async (page: Page) => (await query(page, 'mission')) as State;
const openBoard = (page: Page) =>
  expect
    .poll(
      () =>
        page.evaluate(() => {
          const game = window.__neoryder;
          if (game?.sceneId() !== 'hub' || !game.query('meta')) return false;
          game.command('hub open missions');
          return true;
        }),
      { timeout: LOAD_TIMEOUT },
    )
    .toBe(true);

test('M09: tablica, Nadia, pojmanie żywego Tymona, opaska, obrona i powrót do kryjówki', async ({
  page,
}) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() =>
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '.lil-gui {display:none!important}';
      document.head.append(style);
    }),
  );
  const choice = page.locator(`[data-mission="${ID}"]`);
  await page.goto('/?scene=hub&debug=1&fx=lite');
  await openBoard(page);
  await expect(choice).toBeDisabled();
  await expect(choice).toContainText('Zablokowana');
  await page.goto('/?scene=run&debug=1&fx=lite');
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const game = window.__neoryder;
          if (game?.query('screen') !== 'map') return false;
          for (const id of [
            'm01-maszty',
            'm02-punkt-kontrolny',
            'm03-list-przewozowy',
            'm04-ladunek-klasy-k',
            'm05-adiutant',
            'm06-odlewnia',
            'm07-nocny-dyzur',
          ])
            game.command(`campaign complete ${id}`);
          return true;
        }),
      { timeout: LOAD_TIMEOUT },
    )
    .toBe(true);
  await expect.poll(() => query(page, 'savePending')).toBe(false);
  expect(await query(page, 'saveError')).toBeNull();
  await page.goto('/?scene=hub&debug=1&fx=lite');
  await openBoard(page);
  await expect(choice).toBeEnabled();
  await choice.click();
  await expect(page.locator('[data-mission-briefing]')).toContainText(
    'Odprawa · Brat',
  );
  await page
    .getByRole('button', { name: 'Rozpocznij misję', exact: true })
    .click();
  await expect
    .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
    .toBe('playing');
  await expect(page).toHaveURL(/scene=mission.*mission=m09-brat/);
  expect(await query(page, 'allies')).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: 'nadia' })]),
  );
  expect(await command(page, 'objective done tymon')).toBe('Cel niedostępny.');
  await command(page, 'god');
  for (const [id, x, gate] of [
    ['kordon', 16, 'gate-kladki'],
    ['kontrola', 58, 'gate-kontrola'],
    ['oslona', 104, 'gate-arena'],
  ] as const) {
    await command(page, `tp ${x} 0 -90`);
    await expect
      .poll(async () => (await mission(page)).activeEncounters, {
        timeout: SIM_TIMEOUT,
      })
      .toContain(id);
    await command(page, 'encounter clear');
    await expect
      .poll(async () => (await mission(page)).openGates)
      .toContain(gate);
  }
  await command(page, 'tp 136 0');
  await waitSimSteps(page, 2);
  await command(page, 'tp 148 0');
  await expect
    .poll(() => query(page, 'subdue'), { timeout: SIM_TIMEOUT })
    .toMatchObject({ subdued: false });
  await expect(page.locator('.run-hud__boss')).toContainText('Tymon');
  expect((await mission(page)).openGates).not.toContain('gate-arena');
  for (let i = 0; i < 3; i++) {
    await command(page, 'kill all');
    await waitSimSteps(page, 75);
  }
  await expect
    .poll(() => query(page, 'subdue'), { timeout: SIM_TIMEOUT })
    .toMatchObject({ subdued: true, captured: false });
  // Kolejny cios nie zabija; opaska przy rzeczywistej pozycji bossa.
  const target = (await query(page, 'subdue')) as {
    hp: number;
    maxHp: number;
    position: { x: number; z: number };
  };
  expect(target.hp).toBeCloseTo(target.maxHp * 0.15);
  await command(page, 'kill all');
  await command(page, `tp ${target.position.x - 1.5} ${target.position.z} -90`);
  await expect
    .poll(async () => (await mission(page)).objectives.opaska, {
      timeout: SIM_TIMEOUT,
    })
    .toBe('done');
  expect((await mission(page)).openGates).toContain('gate-rampa');
  await command(page, 'tp 202 0');
  await waitSimSteps(page, 2);
  await command(page, 'tp 216 0');
  // Czas symulacji obrony płynie normalnie; komenda usuwa wyłącznie aktywną osłonę.
  await expect
    .poll(
      async () => {
        await command(page, 'encounter clear');
        return (await mission(page)).objectives.brama;
      },
      { timeout: 480_000, intervals: [1000] },
    )
    .toBe('done');
  expect((await mission(page)).openGates).toContain('gate-transport');
  await command(page, 'tp 238 0');
  await expect(page.locator('[data-mission-summary]')).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await page
    .getByRole('button', { name: 'Wróć do kryjówki', exact: true })
    .click();
  await expect(page.locator(`[data-mission-debrief="${ID}"]`)).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await page.getByRole('button', { name: 'Zakończ rozmowę' }).click();
  await expect(page.locator('[data-mission-debrief]')).toBeHidden({
    timeout: LOAD_TIMEOUT,
  });
  await page.reload();
  await expect
    .poll(() => query(page, 'meta'), { timeout: LOAD_TIMEOUT })
    .toMatchObject({
      campaign: {
        completed: expect.arrayContaining([ID]),
        pendingDebrief: null,
      },
    });
  await openBoard(page);
  await expect(choice).toContainText('Ukończona');
  expect(errors).toEqual([]);
});
