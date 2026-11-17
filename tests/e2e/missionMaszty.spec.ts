import { expect, test, type Page } from '@playwright/test';
import { LOAD_TIMEOUT } from './helpers';

const query = (page: Page, key: string) =>
  page.evaluate((name) => window.__neoryder?.query(name), key);
async function start(page: Page): Promise<void> {
  await page.goto('/?scene=hub&debug=1&fx=lite');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('hub');
  await page.evaluate(() => window.__neoryder?.command('hub open missions'));
  await page.locator('[data-mission="m01-maszty"]').click();
  await expect(page.locator('[data-mission-briefing]')).toContainText(
    'Trzy maszty w Niecce.',
  );
  await page
    .getByRole('button', { name: 'Rozpocznij misję', exact: true })
    .click();
  await expect
    .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
    .toBe('map');
}

test('Maszty: odprawa, siedem warstw, zwycięstwo, debrief i trwała kampania', async ({
  page,
}) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await start(page);
  for (let layer = 1; layer <= 7; layer++) {
    await expect
      .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
      .toBe('map');
    await page.keyboard.press('Digit1');
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const game = window.__neoryder;
            if (!game || game.query('loading') !== false) return false;
            const screen = game.query('screen');
            if (screen === 'shop' || screen === 'rest') return true;
            if (screen !== 'room') return false;
            game.command('god');
            const state = game.query('runState') as {
              currentNodeId: string;
              map: {
                layers: { id: string; fixed?: { objectives: string[] } }[][];
              };
            };
            const ids =
              state.map.layers
                .flat()
                .find((node) => node.id === state.currentNodeId)?.fixed
                ?.objectives ?? [];
            if (ids.length)
              for (const id of ids) game.command(`objective done ${id}`);
            else game.command('run clear');
            return true;
          }),
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
  await expect
    .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
    .toBe('summary');
  await expect(page.getByText('Zwycięstwo', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'Wróć do kryjówki', exact: true })
    .click();
  await expect(page.locator('[data-mission-debrief]')).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await page.getByRole('button', { name: 'Zakończ rozmowę' }).click();
  await page.evaluate(() => window.__neoryder?.command('hub open missions'));
  await expect(page.locator('[data-mission="m01-maszty"]')).toContainText(
    'Ukończona',
  );
  await page.reload();
  await expect
    .poll(() => query(page, 'meta'), { timeout: LOAD_TIMEOUT })
    .toMatchObject({
      campaign: { completed: ['m01-maszty'], pendingDebrief: null },
    });
  await expect(page.locator('[data-mission-debrief]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Maszty: śmierć i nowa próba z pustym postępem celów', async ({
  page,
}) => {
  test.setTimeout(3 * LOAD_TIMEOUT);
  await start(page);
  await page.evaluate(() => window.__neoryder?.command('run end lose'));
  await expect.poll(() => query(page, 'screen')).toBe('summary');
  await expect(page.getByText('Porażka', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'Wróć do kryjówki', exact: true })
    .click();
  await start(page);
  const state = (await query(page, 'runState')) as {
    objectives: Record<string, string>;
    objectiveProgress: object;
  };
  expect(Object.values(state.objectives)).toEqual([
    'pending',
    'pending',
    'pending',
    'pending',
    'pending',
  ]);
  expect(state.objectiveProgress).toEqual({});
});
