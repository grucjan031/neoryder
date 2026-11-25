import { expect, test, type Page } from '@playwright/test';
import { LOAD_TIMEOUT, SIM_TIMEOUT, waitSimSteps } from './helpers';

// Panel debug lil-gui (dev) zasłania prawy górny róg; karty tablicy misji bywają pod nim.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '.lil-gui { display: none !important; }';
      document.head.append(style);
    });
  });
});

// Start misji przeładowuje stronę; odpytanie w trakcie nawigacji zwraca undefined zamiast wyjątku.
const query = (page: Page, key: string) =>
  page
    .evaluate((name) => window.__neoryder?.query(name), key)
    .catch(() => undefined);
const command = (page: Page, line: string) =>
  page.evaluate((text) => window.__neoryder?.command(text), line);
type MissionState = {
  checkpointId: string;
  objectives: Record<string, string>;
  activeEncounters: string[];
  completedEncounters: string[];
  openGates: string[];
};
const mission = async (page: Page) =>
  ((await query(page, 'mission')) ?? {
    activeEncounters: [],
    completedEncounters: [],
    openGates: [],
    objectives: {},
  }) as MissionState;
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

test('Nocny dyżur: tablica po M06, cicha trasa, alarm, kapsuła, serwer, ucieczka przez targ, debrief i kampania', async ({
  page,
}) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const night = page.locator('[data-mission="m07-nocny-dyzur"]');

  // Bez M06 misja czeka na wymagania.
  await page.goto('/?scene=hub&debug=1&fx=lite');
  await openMissions(page);
  await expect(night).toBeDisabled();
  await expect(night).toContainText('Zablokowana');

  await page.goto('/?scene=run&debug=1&fx=lite');
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const game = window.__neoryder;
          if (game?.query('screen') !== 'map') return false;
          game.command('campaign complete m01-maszty');
          game.command('campaign complete m02-punkt-kontrolny');
          game.command('campaign complete m03-list-przewozowy');
          game.command('campaign complete m04-ladunek-klasy-k');
          game.command('campaign complete m06-odlewnia');
          return true;
        }),
      { timeout: LOAD_TIMEOUT },
    )
    .toBe(true);
  await expect.poll(() => query(page, 'savePending')).toBe(false);
  expect(await query(page, 'saveError')).toBeNull();

  // Start z tablicy: odprawa i scena misji liniowej.
  await page.goto('/?scene=hub&debug=1&fx=lite');
  await openMissions(page);
  await expect(night).toBeEnabled();
  await night.click();
  await expect(page.locator('[data-mission-briefing]')).toContainText(
    'Nocny dyżur',
  );
  await page
    .getByRole('button', { name: 'Rozpocznij misję', exact: true })
    .click();
  await expect
    .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
    .toBe('playing');
  await expect(page).toHaveURL(/scene=mission.*mission=m07-nocny-dyzur/);
  expect(await query(page, 'runState')).toBeUndefined();
  await expect(page.locator('[data-mission-direction]')).toContainText(
    'Przetnij zamek kraty',
  );
  expect(await command(page, 'objective done kapsula')).toBe(
    'Cel niedostępny.',
  );
  await command(page, 'god');

  // Krata za budką z makaronem: 1,5 s w strefie otwiera przejście na pomost.
  expect((await mission(page)).openGates).not.toContain('gate-krata');
  await command(page, 'tp 63.5 0 -90');
  await expect
    .poll(async () => (await mission(page)).objectives.krata, {
      timeout: SIM_TIMEOUT,
    })
    .toBe('done');
  expect((await mission(page)).openGates).toContain('gate-krata');

  // Hala: pas boczny jest cichy, korytarz środkowy to alarm i rolety za plecami.
  await command(page, 'tp 146 -9.2 -90');
  await waitSimSteps(page, 30);
  expect((await mission(page)).activeEncounters).toEqual(['cisza-hala']);
  expect((await mission(page)).openGates).toContain('gate-rolety');
  await command(page, 'tp 165 0 -90');
  await expect
    .poll(async () => (await mission(page)).activeEncounters, {
      timeout: SIM_TIMEOUT,
    })
    .toContain('alarm-hala');
  expect((await mission(page)).openGates).not.toContain('gate-rolety');
  await command(page, 'encounter clear');
  await expect
    .poll(async () => (await mission(page)).openGates, {
      timeout: SIM_TIMEOUT,
    })
    .toContain('gate-rolety');

  // Magazyn: wieżyczka nad wejściem, potem kapsuła (pickup) otwiera serwerownię.
  await command(page, 'tp 180 0 -90');
  await expect
    .poll(async () => (await mission(page)).activeEncounters, {
      timeout: SIM_TIMEOUT,
    })
    .toContain('wieza-magazynu');
  await command(page, 'encounter clear');
  expect((await mission(page)).openGates).not.toContain('gate-serwerownia');
  await command(page, 'tp 198 -7.2 -90');
  await expect
    .poll(async () => (await mission(page)).objectives.kapsula, {
      timeout: SIM_TIMEOUT,
    })
    .toBe('done');
  expect((await mission(page)).openGates).toContain('gate-serwerownia');

  // Serwer: transfer ok. 8 s, fala wsparcia przy 60%, brama na targ po zakończeniu.
  expect((await mission(page)).openGates).not.toContain('gate-targ');
  await command(page, 'tp 238 0 -90');
  await expect
    .poll(
      async () => {
        const state = await mission(page);
        if (state.activeEncounters.length)
          await command(page, 'encounter clear');
        return state.objectives.serwer;
      },
      { timeout: SIM_TIMEOUT },
    )
    .toBe('done');
  expect((await mission(page)).openGates).toContain('gate-targ');
  await command(page, 'encounter clear');

  // Targ: trzy fale pościgu, dopiero po nich brama windy.
  for (const [id, x] of [
    ['poscig-targ-1', 266],
    ['poscig-targ-2', 288],
    ['blokada-windy', 309],
  ] as const) {
    expect((await mission(page)).openGates).not.toContain('gate-winda');
    await command(page, `tp ${x} 0 -90`);
    await expect
      .poll(async () => (await mission(page)).activeEncounters, {
        timeout: SIM_TIMEOUT,
      })
      .toContain(id);
    await command(page, 'encounter clear');
    await expect
      .poll(async () => (await mission(page)).completedEncounters, {
        timeout: SIM_TIMEOUT,
      })
      .toContain(id);
  }
  expect((await mission(page)).openGates).toContain('gate-winda');

  // Winda towarowa (3 s w strefie) kończy misję.
  await command(page, 'tp 326 0 -90');
  await expect(page.locator('[data-mission-summary]')).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await page
    .getByRole('button', { name: 'Wróć do kryjówki', exact: true })
    .click();
  await expect(
    page.locator('[data-mission-debrief="m07-nocny-dyzur"]'),
  ).toContainText('Kapsuła jest cała.', { timeout: LOAD_TIMEOUT });
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
        completed: [
          'm01-maszty',
          'm02-punkt-kontrolny',
          'm03-list-przewozowy',
          'm04-ladunek-klasy-k',
          'm06-odlewnia',
          'm07-nocny-dyzur',
        ],
        pendingDebrief: null,
      },
    });
  await expect(page.locator('[data-mission-debrief]')).toHaveCount(0);
  await openMissions(page);
  await expect(night).toContainText('Ukończona');
  expect(errors).toEqual([]);
});
