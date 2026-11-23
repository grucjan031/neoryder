import { expect, test, type Page } from '@playwright/test';
import { LOAD_TIMEOUT, SIM_TIMEOUT } from './helpers';
import definition from '../../src/data/missions/m10-archiwum.json' with { type: 'json' };

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

const M10 = 'm10-archiwum';
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

test('Archiwum: tablica, cichy pas i alarm, śluza, fale transferu, rdzeń, szyb i zapis kampanii', async ({
  page,
}) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=hub&debug=1&fx=lite');
  await openMissions(page);
  const choice = page.locator(`[data-mission="${M10}"]`);
  await expect(choice).toBeDisabled();
  await expect(choice).toContainText('Zablokowana');
  await page.goto('/?scene=run&debug=1&fx=lite');
  await expect
    .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
    .toBe('map');
  // Czyta wymaganie z definicji: po integracji M09 ten sam test sprawdzi właściwy łańcuch.
  for (const id of definition.requires)
    await command(page, `campaign complete ${id}`);
  await expect.poll(() => query(page, 'savePending')).toBe(false);
  expect(await query(page, 'saveError')).toBeNull();
  await page.goto('/?scene=hub&debug=1&fx=lite');
  await openMissions(page);
  await expect(choice).toBeEnabled();
  await choice.click();
  await expect(page.locator('[data-mission-briefing]')).toBeVisible();
  await page
    .getByRole('button', { name: 'Rozpocznij misję', exact: true })
    .click();
  await expect
    .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
    .toBe('playing');
  await expect(page).toHaveURL(/scene=mission.*mission=m10-archiwum/);
  expect(await query(page, 'runState')).toBeUndefined();
  expect(await query(page, 'allies')).toEqual([]);
  await command(page, 'god');
  expect(await command(page, 'objective done rdzen')).toBe('Cel niedostępny.');
  expect(await command(page, 'objective done exit')).toBe('Cel niedostępny.');
  await command(page, 'tp 60 -8 -90');
  await expect
    .poll(async () => (await mission(page)).checkpointId, {
      timeout: SIM_TIMEOUT,
    })
    .toBe('start');
  expect((await mission(page)).activeEncounters).not.toContain('alarm-pasaz');
  await command(page, 'tp 60 0 -90');
  await expect
    .poll(async () => (await mission(page)).activeEncounters, {
      timeout: SIM_TIMEOUT,
    })
    .toContain('alarm-pasaz');
  await command(page, 'encounter clear');
  await command(page, 'checkpoint wieza');
  await command(page, 'tp 130 0 -90 0 4');
  await expect
    .poll(async () => (await mission(page)).activeEncounters, {
      timeout: SIM_TIMEOUT,
    })
    .toContain('straz-archiwum');
  await command(page, 'encounter clear');
  await command(page, 'tp 150 0 -90 0 4');
  await expect
    .poll(async () => (await mission(page)).objectives.sluza, {
      timeout: SIM_TIMEOUT,
    })
    .toBe('done');
  expect((await mission(page)).openGates).toContain('gate-archiwum');
  await command(page, 'checkpoint archiwum');
  await command(page, 'tp 178 1 -90 0 4');
  for (const id of ['transfer-1', 'transfer-2']) {
    await expect
      .poll(async () => (await mission(page)).activeEncounters, {
        timeout: 180_000,
      })
      .toContain(id);
    await command(page, 'encounter clear');
  }
  await expect
    .poll(async () => (await mission(page)).objectives.transfer, {
      timeout: 180_000,
    })
    .toBe('done');
  expect((await mission(page)).openGates).not.toContain('gate-szyb');
  await command(page, 'tp 188 1 -90 0 4');
  await expect
    .poll(async () => (await mission(page)).objectives.rdzen, {
      timeout: SIM_TIMEOUT,
    })
    .toBe('done');
  expect((await mission(page)).openGates).toContain('gate-szyb');
  await command(page, 'encounter clear');
  await command(page, 'checkpoint szyb');
  await command(page, 'tp 228 0 -90');
  await expect
    .poll(async () => (await mission(page)).activeEncounters, {
      timeout: SIM_TIMEOUT,
    })
    .toContain('blokada-szybu');
  await command(page, 'encounter clear');
  await command(page, 'tp 244 0 -90');
  await expect(page.locator('[data-mission-summary]')).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await page
    .getByRole('button', { name: 'Wróć do kryjówki', exact: true })
    .click();
  await expect(page.locator(`[data-mission-debrief="${M10}"]`)).toContainText(
    'Tak. Piętnaście lat temu.',
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
        completed: expect.arrayContaining([...definition.requires, M10]),
        pendingDebrief: null,
      },
    });
  await openMissions(page);
  await expect(choice).toContainText('Ukończona');
  expect(errors).toEqual([]);
});
