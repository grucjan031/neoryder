import { expect, test, type Page } from '@playwright/test';
import { LOAD_TIMEOUT, SIM_TIMEOUT } from './helpers';

const ID = 'm05-adiutant';
const query = (page: Page, name: string) =>
  page
    .evaluate((key) => window.__neoryder?.query(key), name)
    .catch(() => undefined);
const command = (page: Page, line: string) =>
  page.evaluate((text) => window.__neoryder?.command(text), line);
const state = async (page: Page) =>
  (await query(page, 'mission')) as {
    checkpointId: string;
    objectives: Record<string, string>;
    openGates: string[];
    activeEncounters: string[];
    completedEncounters: string[];
  };
const openMissions = (page: Page) =>
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

test('Adiutant: M04 → pościg solo, eskorta, karta, powrót → M06', async ({
  page,
}) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() =>
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '.lil-gui { display: none !important; }';
      document.head.append(style);
    }),
  );
  await page.goto('/?scene=hub&debug=1&fx=lite');
  await openMissions(page);
  const choice = page.locator(`[data-mission="${ID}"]`);
  const foundry = page.locator('[data-mission="m06-odlewnia"]');
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
  await openMissions(page);
  await expect(choice).toBeEnabled();
  await expect(foundry).toBeDisabled();
  await choice.click();
  await expect(page.locator('[data-mission-briefing]')).toContainText(
    'Odprawa · Adiutant',
  );
  await page
    .getByRole('button', { name: 'Rozpocznij misję', exact: true })
    .click();
  await expect
    .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
    .toBe('playing');
  await expect(page).toHaveURL(/scene=mission.*mission=m05-adiutant/);
  await command(page, 'god');
  expect(await query(page, 'allies')).toEqual([]);
  expect(await query(page, 'runState')).toBeUndefined();
  await expect(page.locator('[data-chase-clock]')).toContainText('s');
  expect(await command(page, 'objective done karta')).toBe('Cel niedostępny.');

  for (const [encounter, x, target, goal, gate] of [
    ['tylna-straz', 50, 92, 'estakada', 'gate-estakada'],
    ['tarcze-suwnic', 134, 180, 'suwnice', 'gate-suwnice'],
  ] as const) {
    expect((await state(page)).openGates).not.toContain(gate);
    await command(page, `tp ${x} 0 -90`);
    await expect
      .poll(async () => (await state(page)).activeEncounters, {
        timeout: SIM_TIMEOUT,
      })
      .toContain(encounter);
    await command(page, 'encounter clear');
    await command(page, `tp ${target} 0 -90`);
    await expect
      .poll(async () => (await state(page)).objectives[goal], {
        timeout: SIM_TIMEOUT,
      })
      .toBe('done');
    expect((await state(page)).openGates).toContain(gate);
  }
  await command(page, 'tp 206 0 -90');
  await expect
    .poll(async () => (await state(page)).objectives.ladowisko, {
      timeout: SIM_TIMEOUT,
    })
    .toBe('done');
  await expect
    .poll(async () => (await state(page)).activeEncounters, {
      timeout: SIM_TIMEOUT,
    })
    .toContain('snajperzy');
  await command(page, 'tp 240 0');
  await expect(page.locator('[data-mission-direction]')).toContainText(
    'Pokonaj osłonę i przejmij kartę Wirskiej',
  );
  expect(await command(page, 'objective done karta')).toBe('Cel niedostępny.');
  await command(page, 'encounter clear');
  await command(page, 'tp 218 0 -90');
  await expect
    .poll(async () => (await state(page)).activeEncounters, {
      timeout: SIM_TIMEOUT,
    })
    .toContain('oslona-ladowiska');
  await command(page, 'encounter clear');
  await command(page, 'tp 240 0');
  await expect
    .poll(async () => (await state(page)).objectives.karta, {
      timeout: SIM_TIMEOUT,
    })
    .toBe('done');
  expect((await state(page)).openGates).toContain('gate-ewakuacja');
  expect(await query(page, 'screen')).toBe('playing');
  await command(page, 'tp 248 -7');
  await expect(page.locator('[data-mission-summary]')).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await page
    .getByRole('button', { name: 'Wróć do kryjówki', exact: true })
    .click();
  await expect(page.locator(`[data-mission-debrief="${ID}"]`)).toContainText(
    'Karta jest czysta',
    { timeout: LOAD_TIMEOUT },
  );
  await page.getByRole('button', { name: 'Zakończ rozmowę' }).click();
  await expect(page.locator('[data-mission-debrief]')).toBeHidden({
    timeout: LOAD_TIMEOUT,
  });
  await page.reload();
  await expect
    .poll(() => query(page, 'meta'), { timeout: LOAD_TIMEOUT })
    .toMatchObject({
      campaign: {
        completed: [
          'm01-maszty',
          'm02-punkt-kontrolny',
          'm03-list-przewozowy',
          'm04-ladunek-klasy-k',
          ID,
        ],
        pendingDebrief: null,
      },
    });
  await openMissions(page);
  await expect(choice).toContainText('Ukończona');
  await expect(foundry).toBeEnabled();
  expect(errors).toEqual([]);
});
