import { expect, test, type Page } from '@playwright/test';
import { LOAD_TIMEOUT, SIM_TIMEOUT } from './helpers';

// Panel debug lil-gui (dev) zasłania prawy dolny róg; ekrany stacji mają tam przyciski.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '.lil-gui { display: none !important; }';
      document.head.append(style);
    });
  });
});

const M03 = 'm03-list-przewozowy';
// Start misji przeładowuje stronę; odpytanie w trakcie nawigacji zwraca undefined zamiast wyjątku.
const query = (page: Page, key: string) =>
  page
    .evaluate((name) => window.__neoryder?.query(name), key)
    .catch(() => undefined);
const command = (page: Page, line: string) =>
  page.evaluate((text) => window.__neoryder?.command(text), line);
const mission = async (page: Page) =>
  (await query(page, 'mission')) as {
    checkpointId: string;
    activeEncounters: string[];
    openGates: string[];
    objectives: Record<string, string>;
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

test('List przewozowy: wymaga M02, poziom liniowy z tablicy, bramy, debrief i kampania', async ({
  page,
}) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=hub&debug=1&fx=lite');
  await openMissions(page);
  const choice = page.locator(`[data-mission="${M03}"]`);
  await expect(choice).toBeDisabled();
  await expect(choice).toContainText('Zablokowana');

  // Komenda należy do hosta runu, zapis kończy się przed przejściem do kryjówki.
  await page.goto('/?scene=run&debug=1&fx=lite');
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const game = window.__neoryder;
          if (game?.query('screen') !== 'map') return false;
          game.command('campaign complete m01-maszty');
          game.command('campaign complete m02-punkt-kontrolny');
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
  await expect(choice).not.toContainText('Wkrótce');
  await choice.click();
  await expect(page.locator('[data-mission-briefing]')).toBeVisible();
  await page
    .getByRole('button', { name: 'Rozpocznij misję', exact: true })
    .click();
  await expect
    .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
    .toBe('playing');
  await expect(page).toHaveURL(/scene=mission/);
  await expect(page).toHaveURL(new RegExp(`mission=${M03}`));
  expect(await query(page, 'runState')).toBeUndefined();
  await expect(page.locator('[data-mission-direction]')).toContainText(
    'Pobierz list przewozowy',
  );

  // Kolejność celów i brama celna otwierana po patrolu nabrzeża.
  expect(await command(page, 'objective done exit')).toBe('Cel niedostępny.');
  await command(page, 'god');
  expect((await mission(page)).openGates).toEqual([]);
  await command(page, 'tp 40 0 -90');
  await expect
    .poll(async () => (await mission(page)).activeEncounters, {
      timeout: SIM_TIMEOUT,
    })
    .toContain('patrol-nabrzeze');
  await command(page, 'encounter clear');
  await expect
    .poll(async () => (await mission(page)).openGates, {
      timeout: SIM_TIMEOUT,
    })
    .toContain('gate-patrol-nabrzeze');

  // Terminal otwiera bramę dokową; zwycięstwo wymaga osobnego celu exit.
  expect(await command(page, 'objective done terminal')).toBe('Cel ukończony.');
  expect((await mission(page)).openGates).toContain('gate-dok');
  expect(await query(page, 'screen')).toBe('playing');
  await command(page, 'checkpoint dok');
  expect((await mission(page)).checkpointId).toBe('dok');
  await command(page, 'encounter clear');
  expect(await command(page, 'objective done exit')).toBe('Cel ukończony.');
  await expect(page.locator('[data-mission-summary]')).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await page
    .getByRole('button', { name: 'Wróć do kryjówki', exact: true })
    .click();
  await expect(
    page.locator(`[data-mission-debrief="${M03}"] .mission-dialogue__text`),
  ).toContainText('rejestr z trzech miesięcy jest czysty', {
    timeout: LOAD_TIMEOUT,
  });
  await page.getByRole('button', { name: 'Zakończ rozmowę' }).click();
  // Okno znika dopiero po zapisie meta; przeładowanie wcześniej gubi wyczyszczony debrief.
  await expect(page.locator('[data-mission-debrief]')).toBeHidden({
    timeout: LOAD_TIMEOUT,
  });
  await page.reload();
  await expect
    .poll(() => query(page, 'meta'), { timeout: LOAD_TIMEOUT })
    .toMatchObject({
      campaign: {
        completed: ['m01-maszty', 'm02-punkt-kontrolny', M03],
        pendingDebrief: null,
      },
    });
  await expect(page.locator('[data-mission-debrief]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
