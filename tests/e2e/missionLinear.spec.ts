import { expect, test, type Page } from '@playwright/test';
import { LOAD_TIMEOUT, SIM_TIMEOUT } from './helpers';

// `mission start` przeładowuje stronę; odpytanie w trakcie nawigacji zwraca undefined zamiast wyjątku.
const query = (page: Page, key: string) =>
  page
    .evaluate((name) => window.__neoryder?.query(name), key)
    .catch(() => undefined);
const command = (page: Page, line: string) =>
  page.evaluate((text) => window.__neoryder?.command(text), line);
const waitPlaying = (page: Page) =>
  expect
    .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
    .toBe('playing');

test('M01: debug start, checkpoint, śmierć, wznowienie i jednokrotna nagroda', async ({
  page,
}) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=hub&debug=1&fx=lite');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('hub');
  const before = (await query(page, 'meta')) as { data: number };
  await command(page, 'mission start m01-maszty');
  await waitPlaying(page);
  expect(await page.evaluate(() => window.__neoryder?.sceneId())).toBe(
    'mission',
  );
  expect(await query(page, 'runState')).toBeUndefined();
  await expect(page.locator('[data-mission-direction]')).toContainText(
    'Zniszcz maszt 1',
  );
  expect(await command(page, 'objective done mast-2')).toBe('Cel niedostępny.');
  await command(page, 'god');
  await command(page, 'objective done mast-1');
  await command(page, 'checkpoint po-maszcie-1');
  await command(page, 'tp 116 0 -90');
  await expect
    .poll(
      async () =>
        ((await query(page, 'mission')) as { activeEncounters: string[] })
          .activeEncounters,
      { timeout: SIM_TIMEOUT },
    )
    .toContain('patrol-tunel');
  await command(page, 'encounter clear');
  expect(
    await page.evaluate(() => {
      const game = window.__neoryder!;
      game.command('god');
      game.command('hurt 9999');
      return game.query('screen');
    }),
  ).toBe('respawning');
  await expect
    .poll(() => query(page, 'mission'), { timeout: SIM_TIMEOUT })
    .toMatchObject({
      state: 'playing',
      checkpointId: 'po-maszcie-1',
      objectives: { 'mast-1': 'done' },
    });
  await expect
    .poll(async () =>
      Math.abs(((await query(page, 'playerPos')) as { x: number }).x - 104),
    )
    .toBeLessThan(0.1);
  await expect.poll(() => query(page, 'savePending')).toBe(false);
  await expect(page.locator('.hud__death')).toBeHidden();

  await page.goto('/?scene=hub&debug=1&fx=lite');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('hub');
  await command(page, 'hub open missions');
  await page.locator('[data-action="continue-mission"]').click();
  await waitPlaying(page);
  expect(await query(page, 'mission')).toMatchObject({
    checkpointId: 'po-maszcie-1',
    objectives: { 'mast-1': 'done' },
  });
  await command(page, 'god');
  for (const id of ['mast-2', 'helix', 'mast-3'])
    expect(await command(page, `objective done ${id}`)).toBe('Cel ukończony.');
  await command(page, 'checkpoint ewakuacja');
  await command(page, 'objective done exit');
  await expect(page.locator('[data-mission-summary]')).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await page
    .getByRole('button', { name: 'Wróć do kryjówki', exact: true })
    .click();
  await expect(page.locator('[data-mission-debrief]')).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await page.getByRole('button', { name: 'Zakończ rozmowę' }).click();
  // firstClear daje 60 Danych; naszywki Iskry mogą przy pierwszym ukończeniu dodać własną nagrodę.
  await expect
    .poll(() => query(page, 'meta'))
    .toMatchObject({ campaign: { completed: ['m01-maszty'] } });
  const afterFirst = ((await query(page, 'meta')) as { data: number }).data;
  expect(afterFirst - before.data).toBeGreaterThanOrEqual(60);

  // Druga próba nie przyznaje firstClear ponownie.
  await command(page, 'mission start m01-maszty');
  await waitPlaying(page);
  await command(page, 'god');
  for (const id of ['mast-1', 'mast-2', 'helix', 'mast-3', 'exit'])
    await command(page, `objective done ${id}`);
  await expect(page.locator('[data-mission-summary]')).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await page
    .getByRole('button', { name: 'Wróć do kryjówki', exact: true })
    .click();
  await expect
    .poll(() => query(page, 'meta'), { timeout: LOAD_TIMEOUT })
    .toMatchObject({ data: afterFirst });
  expect(errors).toEqual([]);
});

test('tablica: odprawa M01 otwiera scenę mission, M03 i M06 pozostają wkrótce', async ({
  page,
}) => {
  test.setTimeout(3 * LOAD_TIMEOUT);
  await page.goto('/?scene=hub&debug=1&fx=lite');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('hub');
  await command(page, 'hub open missions');
  for (const id of ['m03-list-przewozowy', 'm06-odlewnia']) {
    const choice = page.locator(`[data-mission="${id}"]`);
    await expect(choice).toBeDisabled();
    await expect(choice).toContainText('Wkrótce');
  }
  await page.locator('[data-mission="m01-maszty"]').click();
  await expect(page.locator('[data-mission-briefing]')).toContainText(
    'Trzy maszty w Niecce.',
  );
  await page
    .getByRole('button', { name: 'Rozpocznij misję', exact: true })
    .click();
  await waitPlaying(page);
  await expect(page).toHaveURL(/scene=mission/);
});
