import { expect, test, type Page } from '@playwright/test';
import { LOAD_TIMEOUT, SIM_TIMEOUT } from './helpers';

const ID = 'm08-kwarantanna';
const predecessors = [
  'm01-maszty',
  'm02-punkt-kontrolny',
  'm03-list-przewozowy',
  'm04-ladunek-klasy-k',
  'm05-adiutant',
  'm06-odlewnia',
  'm07-nocny-dyzur',
];
const query = (page: Page, key: string) =>
  page
    .evaluate((key) => window.__neoryder?.query(key), key)
    .catch(() => undefined);
const command = (page: Page, line: string) =>
  page.evaluate((line) => window.__neoryder?.command(line), line);
const mission = async (page: Page) =>
  (await query(page, 'mission')) as {
    objectives: Record<string, string>;
    completedEncounters: string[];
    activeEncounters: string[];
    openGates: string[];
  };
async function openBoard(page: Page) {
  await page.goto('/?scene=hub&debug=1&fx=lite');
  await expect
    .poll(() => query(page, 'meta'), { timeout: LOAD_TIMEOUT })
    .toBeTruthy();
  await command(page, 'hub open missions');
}

test('M08: blokada po M06, odblokowanie po M07, trzy grupy, obrona windy, debrief i zapis', async ({
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
  await openBoard(page);
  const choice = page.locator(`[data-mission="${ID}"]`);
  await expect(choice).toBeDisabled();
  await expect(choice).toContainText('Zablokowana');
  await expect(choice).not.toContainText('Wkrótce');
  await page.goto('/?scene=run&debug=1&fx=lite');
  await expect
    .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
    .toBe('map');
  for (const id of predecessors.slice(0, -1))
    await command(page, `campaign complete ${id}`);
  await expect.poll(() => query(page, 'savePending')).toBe(false);
  await openBoard(page);
  await expect(choice).toBeDisabled();
  await page.goto('/?scene=run&debug=1&fx=lite');
  await expect
    .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
    .toBe('map');
  await command(page, 'campaign complete m07-nocny-dyzur');
  await expect.poll(() => query(page, 'savePending')).toBe(false);
  expect(await query(page, 'saveError')).toBeNull();
  await openBoard(page);
  await expect(choice).toBeEnabled();
  await choice.click();
  await expect(page.locator('[data-mission-briefing]')).toContainText(
    'Kwarantanna',
  );
  await page
    .getByRole('button', { name: 'Rozpocznij misję', exact: true })
    .click();
  await expect
    .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
    .toBe('playing');
  await expect(page).toHaveURL(/scene=mission.*mission=m08-kwarantanna/);
  expect(await query(page, 'runState')).toBeUndefined();
  expect(await command(page, 'objective done exit')).toBe('Cel niedostępny.');
  expect(await command(page, 'objective done sluza-a')).toBe(
    'Cel niedostępny.',
  );
  expect(await query(page, 'allies')).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: 'szron' })]),
  );
  await command(page, 'god');
  await command(page, 'tp 16 0 -90');
  await expect
    .poll(async () => (await mission(page)).activeEncounters, {
      timeout: SIM_TIMEOUT,
    })
    .toContain('kordon');
  await command(page, 'encounter clear');
  await expect
    .poll(async () => (await mission(page)).openGates)
    .toContain('gate-kordon');

  for (const [key, fight, lock, safe] of [
    ['a', 48, 62, 82],
    ['b', 108, 122, 142],
    ['c', 168, 182, 202],
  ] as const) {
    await command(page, `tp ${fight} 0 -90`);
    await expect
      .poll(async () => (await mission(page)).activeEncounters, {
        timeout: SIM_TIMEOUT,
      })
      .toContain(`oslona-${key}`);
    await command(page, 'encounter clear');
    await command(page, `tp ${lock} 0 -90`);
    await expect
      .poll(async () => (await mission(page)).objectives[`sluza-${key}`], {
        timeout: SIM_TIMEOUT,
      })
      .toBe('done');
    expect((await mission(page)).objectives[`grupa-${key}`]).not.toBe('done');
    expect((await mission(page)).openGates).toContain(`gate-sluza-${key}`);
    await command(page, `tp ${safe} 0 -90`);
    await expect
      .poll(async () => (await mission(page)).objectives[`grupa-${key}`], {
        timeout: SIM_TIMEOUT,
      })
      .toBe('done');
    expect((await mission(page)).openGates).toContain(`gate-grupa-${key}`);
  }
  expect(await command(page, 'objective done exit')).toBe('Cel niedostępny.');
  await command(page, 'tp 222 0 -90');
  // Rzeczywiste 25 sekund symulacji; usuwamy tylko wrogów, nie kończymy celu komendą.
  const defenses = new Set<string>();
  await expect
    .poll(
      async () => {
        const current = await mission(page);
        for (const fight of current.activeEncounters) defenses.add(fight);
        if (current.activeEncounters.length)
          await command(page, 'encounter clear');
        return current.objectives.ewakuacja;
      },
      { timeout: 240_000 },
    )
    .toBe('done');
  expect([...defenses]).toEqual(
    expect.arrayContaining(['ewakuacja-1', 'ewakuacja-2']),
  );
  expect((await mission(page)).openGates).toContain('gate-winda');
  await command(page, 'tp 244 0 -90');
  await expect(page.locator('[data-mission-summary]')).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await page
    .getByRole('button', { name: 'Wróć do kryjówki', exact: true })
    .click();
  await expect(page.locator(`[data-mission-debrief="${ID}"]`)).toContainText(
    'Zostawiłem im stare koce',
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
      campaign: { completed: [...predecessors, ID], pendingDebrief: null },
    });
  await command(page, 'hub open missions');
  await expect(choice).toContainText('Ukończona');
  expect(errors).toEqual([]);
});
