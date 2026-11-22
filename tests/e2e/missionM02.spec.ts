import { expect, test, type Page } from '@playwright/test';
import { LOAD_TIMEOUT, SIM_TIMEOUT, waitSimSteps } from './helpers';

const ID = 'm02-punkt-kontrolny';
const query = (page: Page, key: string) =>
  page
    .evaluate((name) => window.__neoryder?.query(name), key)
    .catch(() => undefined);
const command = (page: Page, line: string) =>
  page.evaluate((text) => window.__neoryder?.command(text), line);
const mission = async (page: Page) =>
  (await query(page, 'mission')) as {
    checkpointId: string;
    objectives: Record<string, string>;
    activeEncounters: string[];
    completedEncounters: string[];
    openGates: string[];
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

test('M02: tablica po M01, trzy cele, Nadia, Egzekutor, zachodnia brama i trwałe ukończenie', async ({
  page,
}) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=hub&debug=1&fx=lite');
  await openMissions(page);
  const choice = page.locator(`[data-mission="${ID}"]`);
  await expect(choice).toBeDisabled();
  await expect(choice).toContainText('Zablokowana');
  await expect(choice).not.toContainText('Wkrótce');
  await page.goto('/?scene=run&debug=1&fx=lite');
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const game = window.__neoryder;
          if (game?.query('screen') !== 'map') return false;
          game.command('campaign complete m01-maszty');
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
  await expect(
    page.locator('[data-mission="m03-list-przewozowy"]'),
  ).toBeDisabled();
  await choice.click();
  await expect(page.locator('[data-mission-briefing]')).toContainText(
    'Punkt kontrolny',
  );
  await page
    .getByRole('button', { name: 'Rozpocznij misję', exact: true })
    .click();
  await expect
    .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
    .toBe('playing');
  await expect(page).toHaveURL(/scene=mission.*mission=m02-punkt-kontrolny/);
  expect(await query(page, 'runState')).toBeUndefined();
  expect(await query(page, 'allies')).toEqual([]);
  expect(await command(page, 'objective done exit')).toBe('Cel niedostępny.');
  await command(page, 'god');

  for (const [id, x, gate] of [
    ['patrol-kordon', 190, 'gate-kordon'],
    ['rampa', 150, 'gate-plac'],
    ['straz-cel', 120, null],
  ] as const) {
    await command(page, `tp ${x} 0 90`);
    await expect
      .poll(async () => (await mission(page)).activeEncounters, {
        timeout: SIM_TIMEOUT,
      })
      .toContain(id);
    await command(page, 'encounter clear');
    if (gate) expect((await mission(page)).openGates).toContain(gate);
  }
  for (const [id, x, z, pursuit] of [
    ['cell-1', 116, -7, 'poscig-1'],
    ['cell-2', 94, 7, 'poscig-2'],
  ] as const) {
    await command(page, `tp ${x} ${z} 90`);
    await expect
      .poll(async () => (await mission(page)).objectives[id], {
        timeout: SIM_TIMEOUT,
      })
      .toBe('done');
    await expect
      .poll(async () => (await mission(page)).activeEncounters, {
        timeout: SIM_TIMEOUT,
      })
      .toContain(pursuit);
    if (id === 'cell-1') expect(await query(page, 'allies')).toEqual([]);
    await command(page, 'encounter clear');
  }
  await expect
    .poll(async () => ((await query(page, 'allies')) as unknown[])?.length, {
      timeout: SIM_TIMEOUT,
    })
    .toBe(1);
  expect((await mission(page)).openGates).toContain('gate-sluza');
  await command(page, 'tp 76 0 90');
  await expect
    .poll(async () => (await mission(page)).checkpointId, {
      timeout: SIM_TIMEOUT,
    })
    .toBe('zbiorka');
  await command(page, 'tp 66 0 90');
  await expect
    .poll(async () => (await mission(page)).activeEncounters, {
      timeout: SIM_TIMEOUT,
    })
    .toContain('oslona-suwnicy');
  await command(page, 'encounter clear');
  await command(page, 'tp 61 -7 90');
  await expect
    .poll(async () => (await mission(page)).objectives['cell-3'], {
      timeout: SIM_TIMEOUT,
    })
    .toBe('done');
  await expect
    .poll(async () => (await mission(page)).activeEncounters, {
      timeout: SIM_TIMEOUT,
    })
    .toContain('egzekutor');
  expect((await mission(page)).openGates).not.toContain('gate-zachod');
  expect(await command(page, 'objective done exit')).toBe('Cel niedostępny.');
  // Zabijanie encji weryfikuje normalne ukończenie bossFor dla elity executor.
  for (
    let i = 0;
    i < 10 && (await mission(page)).objectives.executor !== 'done';
    i++
  ) {
    await waitSimSteps(page, 120);
    await command(page, 'kill all');
  }
  await expect
    .poll(async () => (await mission(page)).objectives.executor, {
      timeout: SIM_TIMEOUT,
    })
    .toBe('done');
  expect((await mission(page)).completedEncounters).toContain('egzekutor');
  expect((await mission(page)).openGates).toContain('gate-zachod');
  await command(page, 'tp 26 0 90');
  await expect
    .poll(async () => (await mission(page)).checkpointId, {
      timeout: SIM_TIMEOUT,
    })
    .toBe('ewakuacja');
  expect(((await query(page, 'allies')) as unknown[]).length).toBe(1);
  await command(page, 'tp 8 0 90');
  await expect(page.locator('[data-mission-summary]')).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await page
    .getByRole('button', { name: 'Wróć do kryjówki', exact: true })
    .click();
  await expect(page.locator(`[data-mission-debrief="${ID}"]`)).toContainText(
    'Opatrunek na ramieniu',
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
      campaign: { completed: ['m01-maszty', ID], pendingDebrief: null },
    });
  await openMissions(page);
  await expect(choice).toContainText('Ukończona');
  await expect(
    page.locator('[data-mission="m03-list-przewozowy"]'),
  ).toBeEnabled();
  expect(errors).toEqual([]);
});
