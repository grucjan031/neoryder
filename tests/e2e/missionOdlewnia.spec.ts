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

test('Odlewnia: tablica po M04, starcia, arena Brandta, serwer, winda, debrief i kampania', async ({
  page,
}) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const foundry = page.locator('[data-mission="m06-odlewnia"]');

  // Bez M04 misja czeka na wymagania, ale nie jest już „Wkrótce”.
  await page.goto('/?scene=hub&debug=1&fx=lite');
  await openMissions(page);
  await expect(foundry).toBeDisabled();
  await expect(foundry).toContainText('Zablokowana');
  await expect(foundry).not.toContainText('Wkrótce');

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
          return true;
        }),
      { timeout: LOAD_TIMEOUT },
    )
    .toBe(true);
  await expect.poll(() => query(page, 'savePending')).toBe(false);
  expect(await query(page, 'saveError')).toBeNull();

  // Start z tablicy: przerywnik i odprawa, potem scena misji liniowej.
  await page.goto('/?scene=hub&debug=1&fx=lite');
  await openMissions(page);
  await expect(foundry).toBeEnabled();
  await foundry.click();
  await expect(page.locator('[data-mission-briefing]')).toContainText(
    'Odprawa · Odlewnia',
  );
  await page
    .getByRole('button', { name: 'Rozpocznij misję', exact: true })
    .click();
  await expect
    .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
    .toBe('playing');
  await expect(page).toHaveURL(/scene=mission.*mission=m06-odlewnia/);
  expect(await query(page, 'runState')).toBeUndefined();
  await expect(page.locator('[data-mission-direction]')).toContainText(
    'Pokonaj Oskara Brandta',
  );
  expect(await command(page, 'objective done server')).toBe('Cel niedostępny.');
  await command(page, 'god');

  // Pięć starć przed areną: każde otwiera bramę następnego odcinka.
  for (const [id, x, gate] of [
    ['patrol-sluza', 14, 'gate-sluza'],
    ['piece', 44, 'gate-piece'],
    ['formowanie-front', 92, null],
    ['formowanie-tyl', 113, 'gate-formowanie'],
    ['straz', 143, 'gate-sztab'],
  ] as const) {
    if (gate) expect((await mission(page)).openGates).not.toContain(gate);
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
    if (gate) expect((await mission(page)).openGates).toContain(gate);
  }
  await command(page, 'tp 167 0 -90');
  await expect
    .poll(async () => (await mission(page)).checkpointId, {
      timeout: SIM_TIMEOUT,
    })
    .toBe('przed-arena');

  // Arena: wrota zamykają się za graczem, Brandt schodzi po zapowiedzi, pasek bossa ma trzy fazy.
  await command(page, 'tp 185 0 -90');
  await expect
    .poll(async () => (await mission(page)).activeEncounters, {
      timeout: SIM_TIMEOUT,
    })
    .toEqual(['brandt']);
  expect((await mission(page)).openGates).not.toContain('gate-sztab');
  await expect
    .poll(() => query(page, 'enemies'), { timeout: SIM_TIMEOUT })
    .toBe(1);
  const bossBar = page.locator('.run-hud__boss');
  await expect(bossBar).toBeVisible();
  await expect(bossBar).toContainText('Dyrektor Ochrony Kurogane Arms');
  expect(await command(page, 'objective done exit')).toBe('Cel niedostępny.');
  for (let phase = 1; phase <= 3; phase++) {
    await command(page, 'kill all');
    await waitSimSteps(page, 75);
  }
  await expect
    .poll(() => mission(page), { timeout: SIM_TIMEOUT })
    .toMatchObject({
      objectives: { brandt: 'done', server: 'pending' },
      activeEncounters: [],
      checkpointId: 'po-brandcie',
    });
  expect(await query(page, 'enemies')).toBe(0);
  await expect(bossBar).toBeHidden();
  const afterBoss = await mission(page);
  expect(afterBoss.openGates).toEqual(
    expect.arrayContaining(['gate-sztab', 'gate-gabinet']),
  );
  expect(afterBoss.openGates).not.toContain('gate-winda');
  await expect(page.locator('[data-mission-direction]')).toContainText(
    'Zgraj serwer ochrony',
  );

  // Serwer w gabinecie (3 s w strefie) odblokowuje windę towarową (2 s).
  await command(page, 'tp 224 -6 0');
  await expect
    .poll(async () => (await mission(page)).objectives.server, {
      timeout: SIM_TIMEOUT,
    })
    .toBe('done');
  expect((await mission(page)).openGates).toContain('gate-winda');
  await command(page, 'tp 216 -11.5 0');
  await expect(page.locator('[data-mission-summary]')).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await page
    .getByRole('button', { name: 'Wróć do kryjówki', exact: true })
    .click();
  await expect(
    page.locator('[data-mission-debrief="m06-odlewnia"]'),
  ).toContainText('Mam cały serwer Brandta.', { timeout: LOAD_TIMEOUT });
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
        ],
        pendingDebrief: null,
      },
    });
  await expect(page.locator('[data-mission-debrief]')).toHaveCount(0);
  await openMissions(page);
  await expect(foundry).toContainText('Ukończona');
  expect(errors).toEqual([]);
});
