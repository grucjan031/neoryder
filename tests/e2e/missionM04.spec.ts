import { expect, test, type Page } from '@playwright/test';
import { LOAD_TIMEOUT, SIM_TIMEOUT, waitSimSteps } from './helpers';

const ID = 'm04-ladunek-klasy-k';
async function assertPayloadLayout(page: Page) {
  const layout = await page.evaluate(() => ({
    goals: document
      .querySelector('.mission-goals')!
      .getBoundingClientRect()
      .toJSON(),
    payload: document
      .querySelector('.proto-hud')!
      .getBoundingClientRect()
      .toJSON(),
    squad:
      document.querySelector('.squad-hud')?.getBoundingClientRect().toJSON() ??
      null,
  }));
  const overlaps = (
    a: { left: number; right: number; top: number; bottom: number },
    b: { left: number; right: number; top: number; bottom: number },
  ) =>
    a.left < b.right &&
    b.left < a.right &&
    a.top < b.bottom &&
    b.top < a.bottom;
  expect(layout.goals.height).toBeGreaterThan(0);
  expect(layout.payload.height).toBeGreaterThan(0);
  expect(overlaps(layout.goals, layout.payload)).toBe(false);
  expect(layout.payload.top).toBeGreaterThan(layout.goals.bottom);
  expect(layout.payload.left).toBe(layout.goals.left);
  expect(layout.payload.width).toBe(layout.goals.width);
  if (layout.squad && layout.squad.height > 0) {
    expect(overlaps(layout.squad, layout.goals)).toBe(false);
    expect(overlaps(layout.squad, layout.payload)).toBe(false);
  }
}
async function capture(page: Page, name: string) {
  await assertPayloadLayout(page);
  if (process.env.M04_SCREENSHOT_DIR)
    await page.screenshot({
      path: `${process.env.M04_SCREENSHOT_DIR}/${name}.png`,
    });
}
const query = (page: Page, key: string) =>
  page
    .evaluate((name) => window.__neoryder?.query(name), key)
    .catch(() => undefined);
const command = (page: Page, line: string) =>
  page.evaluate((text) => window.__neoryder?.command(text), line);
const mission = async (page: Page) =>
  (await query(page, 'mission')) as {
    objectives: Record<string, string>;
    activeEncounters: string[];
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

test('Ładunek klasy K: tablica, Szron, blokady, Egzekutor, wagon, debrief i odblokowanie M06', async ({
  page,
}) => {
  test.setTimeout(600_000);
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '.lil-gui { display: none !important; }';
      document.head.append(style);
    });
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=hub&debug=1&fx=lite');
  await openMissions(page);
  const choice = page.locator(`[data-mission="${ID}"]`);
  await expect(choice).toBeDisabled();
  await expect(choice).toContainText('Zablokowana');
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
  await openMissions(page);
  await expect(choice).toBeEnabled();
  await expect(page.locator('[data-mission="m06-odlewnia"]')).toBeDisabled();
  await choice.click();
  await expect(page.locator('[data-mission-briefing]')).toContainText(
    'Ładunek klasy K',
  );
  await page
    .getByRole('button', { name: 'Rozpocznij misję', exact: true })
    .click();
  await expect
    .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
    .toBe('playing');
  await expect(page).toHaveURL(/scene=mission.*mission=m04-ladunek-klasy-k/);
  expect(await query(page, 'allies')).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: 'szron' })]),
  );
  await expect(page.locator('.proto-hud')).toContainText('Wytrzymałość wagonu');
  await command(page, 'god');
  await page.evaluate(() => document.fonts.ready);
  await capture(page, 'start');
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await assertPayloadLayout(page);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  expect(await command(page, 'objective done exit')).toBe('Cel niedostępny.');

  // Pierwsza blokada: sam brak wrogów nie zwalnia postoju wagonu.
  await command(page, 'payload skip');
  await expect
    .poll(() => query(page, 'payload'))
    .toMatchObject({ status: 'holding', distanceM: 28 });
  await command(page, 'tp 40 4 -90');
  await waitSimSteps(page, 10);
  expect(await query(page, 'payload')).toMatchObject({
    status: 'holding',
    distanceM: 28,
  });
  for (const [id, x, z] of [
    ['barricade', 43, 4],
    ['laser', 68, 4],
    ['switch-1', 85, -4],
    ['carts', 123, 4],
    ['switch-2', 143, -4],
  ] as const) {
    await command(page, `tp ${x} ${z} -90`);
    if (id === 'laser') {
      await waitSimSteps(page, 10);
      await capture(page, 'rogatka');
    }
    // Walka w E2E skrócona komendą; interakcja nadal trwa rzeczywiste 2 s symulacji.
    await command(page, 'encounter clear');
    await expect
      .poll(async () => (await mission(page)).objectives[id], {
        timeout: SIM_TIMEOUT,
      })
      .toBe('done');
    expect((await mission(page)).openGates).toContain(`gate-${id}`);
  }
  await command(page, 'tp 180 4 -90');
  await waitSimSteps(page, 10);
  await capture(page, 'koncowy-rozjazd');
  await expect
    .poll(async () => (await mission(page)).activeEncounters, {
      timeout: SIM_TIMEOUT,
    })
    .toContain('executor');
  for (
    let i = 0;
    i < 8 && (await mission(page)).objectives.executor !== 'done';
    i++
  ) {
    await waitSimSteps(page, 60);
    await command(page, 'kill all');
  }
  await expect
    .poll(async () => (await mission(page)).objectives.executor, {
      timeout: SIM_TIMEOUT,
    })
    .toBe('done');
  expect((await mission(page)).objectives.payload).not.toBe('done');
  expect(await command(page, 'objective done exit')).toBe('Cel niedostępny.');
  // Przeskoki skracają trasę w teście przeglądarkowym; unit przechodzi ją bez skip/tp.
  for (let i = 0; i < 7; i++) await command(page, 'payload skip');
  await expect
    .poll(async () => (await mission(page)).objectives.payload, {
      timeout: SIM_TIMEOUT,
    })
    .toBe('done');
  await command(page, 'tp 249 4 -90');
  await expect(page.locator('[data-mission-summary]')).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await page
    .getByRole('button', { name: 'Wróć do kryjówki', exact: true })
    .click();
  await expect(page.locator(`[data-mission-debrief="${ID}"]`)).toContainText(
    'Odłączyliśmy najcięższą ramę',
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
        completed: ['m01-maszty', 'm03-list-przewozowy', ID],
        pendingDebrief: null,
      },
    });
  await openMissions(page);
  await expect(choice).toContainText('Ukończona');
  await expect(page.locator('[data-mission="m06-odlewnia"]')).toBeEnabled();
  expect(errors).toEqual([]);
});
