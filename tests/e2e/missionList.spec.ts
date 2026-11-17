import { expect, test, type Page } from '@playwright/test';
import { LOAD_TIMEOUT } from './helpers';

const query = (page: Page, key: string) =>
  page.evaluate((name) => window.__neoryder?.query(name), key);

test('List przewozowy: blokada po M01, siedem warstw, brama, debrief i kampania', async ({
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
  await expect(
    page.locator('[data-mission="m03-list-przewozowy"]'),
  ).toBeDisabled();

  // Komenda należy do hosta runu, zapis kończy się przed przejściem do kryjówki.
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
  await page.locator('[data-mission="m03-list-przewozowy"]').click();
  await expect(page.locator('[data-mission-interlude] h3')).toHaveText(
    'Tymczasem w Iskrze',
  );
  await expect(
    page.locator('[data-mission-briefing] .mission-dialogue p').first(),
  ).toHaveText(
    'Szron: Po masztach Kurogane zrobiło obławę na kurierów z implantami. Trzymali zatrzymanych w kontenerach na bocznicy.',
  );
  await expect(page.locator('[data-mission-briefing]')).toContainText(
    'Zmiana na nabrzeżu przechodzi o północy',
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
            game.command('run clear');
            if (final) {
              const blocked = game.command('objective done exit');
              game.command('objective done terminal');
              return { blocked, screen: game.query('screen') };
            }
            return true;
          }, layer === 7),
        { timeout: LOAD_TIMEOUT },
      )
      .toEqual(
        layer === 7 ? { blocked: 'Cel niedostępny.', screen: 'room' } : true,
      );
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
  await expect(page.locator('.mission-goals')).toContainText('Transfer: 100%');
  await page.evaluate(() => window.__neoryder?.command('objective done exit'));
  await expect
    .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
    .toBe('summary');
  await expect(page.getByText('Zwycięstwo', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'Wróć do kryjówki', exact: true })
    .click();
  await expect(
    page.locator('[data-mission-debrief="m03-list-przewozowy"]'),
  ).toContainText('ładunek biologiczny klasy K', { timeout: LOAD_TIMEOUT });
  await page.getByRole('button', { name: 'Zakończ rozmowę' }).click();
  await page.evaluate(() => window.__neoryder?.command('hub open missions'));
  await expect(
    page.locator('[data-mission="m03-list-przewozowy"]'),
  ).toContainText('Ukończona');
  await page.reload();
  await expect
    .poll(() => query(page, 'meta'), { timeout: LOAD_TIMEOUT })
    .toMatchObject({
      campaign: {
        completed: ['m01-maszty', 'm03-list-przewozowy'],
        pendingDebrief: null,
      },
    });
  await expect(page.locator('[data-mission-debrief]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
