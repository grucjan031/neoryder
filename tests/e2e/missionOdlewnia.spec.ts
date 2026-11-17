import { expect, test, type Page } from '@playwright/test';
import { LOAD_TIMEOUT, waitSimSteps } from './helpers';

const query = (page: Page, key: string) =>
  page.evaluate((name) => window.__neoryder?.query(name), key);

test('Odlewnia: M03 odblokowuje misję, boss → serwer → winda → debrief i kampania', async ({
  page,
}) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=hub&debug=1&fx=lite');
  await expect
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
  await expect(page.locator('[data-mission="m06-odlewnia"]')).toBeDisabled();
  await page.goto('/?scene=run&debug=1&fx=lite');
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const game = window.__neoryder;
          if (game?.query('screen') !== 'map') return false;
          game.command('campaign complete m01-maszty');
          game.command('campaign complete m03-list-przewozowy');
          return true;
        }),
      { timeout: LOAD_TIMEOUT },
    )
    .toBe(true);
  await expect.poll(() => query(page, 'savePending')).toBe(false);
  expect(await query(page, 'saveError')).toBeNull();
  await page.goto('/?scene=hub&debug=1&fx=lite');
  await expect
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
  await page.locator('[data-mission="m06-odlewnia"]').click();
  await expect(
    page.locator('[data-mission-briefing] .mission-dialogue p').first(),
  ).toHaveText(
    'Szron: Karta Wirskiej już jest. Kontakt Nadii zdjął ją z konwoju, zanim Brandt zamknął Huty.',
  );
  await page
    .getByRole('button', { name: 'Rozpocznij misję', exact: true })
    .click();
  for (let layer = 1; layer <= 7; layer++) {
    await expect
      .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
      .toBe('map');
    await page.keyboard.press('Digit1');
    await expect
      .poll(
        () =>
          page.evaluate((final) => {
            const game = window.__neoryder;
            if (!game || game.query('loading') !== false) return false;
            const screen = game.query('screen');
            if (screen === 'shop' || screen === 'rest') return true;
            if (screen !== 'room') return false;
            game.command('god');
            if (final) return game.query('room') === 'bossRoom';
            game.command('run clear');
            return true;
          }, layer === 7),
        { timeout: LOAD_TIMEOUT },
      )
      .toBe(true);
    if (layer < 7) {
      await expect
        .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
        .toMatch(/^(reward|shop|rest)$/);
      const screen = await query(page, 'screen');
      if (screen === 'reward')
        await page.locator('.run-screen__card').first().click();
      else if (screen === 'rest')
        await page.locator('.run-screen__heal').click();
      else
        await page.getByRole('button', { name: 'Wyjdź', exact: true }).click();
    }
  }
  const command = (cmd: string) =>
    page.evaluate((text) => window.__neoryder?.command(text), cmd);
  expect(await command('objective done server')).toBe('Cel niedostępny.');
  expect(await command('objective done exit')).toBe('Cel niedostępny.');
  for (let phase = 1; phase <= 3; phase++) {
    await waitSimSteps(page, 75);
    await command('kill all');
  }
  await expect
    .poll(() => query(page, 'missionObjectives'))
    .toMatchObject({ objectives: { brandt: 'done' } });
  expect(await query(page, 'screen')).toBe('room');
  expect(await query(page, 'enemies')).toBe(0);
  expect(await command('objective done exit')).toBe('Cel niedostępny.');
  await command('objective done server');
  expect(await query(page, 'screen')).toBe('room');
  await command('objective done exit');
  await expect
    .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
    .toBe('summary');
  await expect(page.getByText('Zwycięstwo', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'Wróć do kryjówki', exact: true })
    .click();
  await expect(
    page.locator('[data-mission-debrief="m06-odlewnia"]'),
  ).toContainText('Mam cały serwer Brandta.', { timeout: LOAD_TIMEOUT });
  await expect(page.locator('[data-mission-debrief] h2')).toBeInViewport();
  await expect(
    page.locator('[data-mission-debrief] p').first(),
  ).toBeInViewport();
  await page.getByRole('button', { name: 'Zakończ rozmowę' }).click();
  await page.evaluate(() => window.__neoryder?.command('hub open missions'));
  await expect(page.locator('[data-mission="m06-odlewnia"]')).toContainText(
    'Ukończona',
  );
  await page.reload();
  await expect
    .poll(() => query(page, 'meta'), { timeout: LOAD_TIMEOUT })
    .toMatchObject({
      campaign: {
        completed: ['m01-maszty', 'm03-list-przewozowy', 'm06-odlewnia'],
        pendingDebrief: null,
      },
    });
  await expect(page.locator('[data-mission-debrief]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
