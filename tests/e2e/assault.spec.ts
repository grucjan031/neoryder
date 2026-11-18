import { expect, test, type Page } from '@playwright/test';
import { LOAD_TIMEOUT } from './helpers';

const query = (page: Page, key: string) =>
  page.evaluate((name) => window.__neoryder?.query(name), key);

for (const outcome of ['victory', 'death'] as const) {
  test(`Szturm: kryjówka → trzy sektory lub utrata żyć → ${outcome} → kryjówka`, async ({
    page,
  }) => {
    test.setTimeout(6 * LOAD_TIMEOUT);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/?scene=hub&debug=1&fx=lite');
    await expect
      .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
        timeout: LOAD_TIMEOUT,
      })
      .toBe('hub');
    await page.evaluate(() => window.__neoryder?.command('hub open missions'));
    await expect(
      page.getByRole('button', {
        name: 'Kradzież rdzenia',
        exact: true,
      }),
    ).toBeEnabled();
    await page.locator('[data-mode="assault"]').click();
    await page
      .getByRole('button', { name: 'Rozpocznij Szturm', exact: true })
      .click();
    for (let index = 1; index <= 3; index++) {
      await expect
        .poll(
          () =>
            page.evaluate(
              ({ outcome, index }) => {
                const game = window.__neoryder;
                if (
                  !game ||
                  game.query('loading') !== false ||
                  game.query('screen') !== 'room'
                )
                  return false;
                const state = game.query('assault') as {
                  sector: number;
                  lives: number;
                  respawnRemainingS: number;
                } | null;
                if (!state) return false;
                if (outcome === 'victory') {
                  if (state.sector !== index) return false;
                  if (index === 1) game.command('god');
                  game.command('assault destroy A');
                  game.command('assault destroy B');
                } else {
                  if (state.lives !== 4 - index || state.respawnRemainingS > 0)
                    return false;
                  game.command('hurt 99999');
                  const after = game.query('assault') as { lives: number };
                  const overlay =
                    document.querySelector<HTMLElement>('.hud__death');
                  if (overlay && !overlay.hidden)
                    throw new Error(
                      'Ekran powtórki zasłania odrodzenie Szturmu.',
                    );
                  return after.lives === 3 - index;
                }
                return true;
              },
              { outcome, index },
            ),
          { timeout: LOAD_TIMEOUT },
        )
        .toBe(true);
    }
    await expect
      .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
      .toBe('summary');
    await expect(
      page.getByText(outcome === 'victory' ? 'Zwycięstwo' : 'Porażka', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator('.run-screen')).toContainText(
      `Pokoje: ${outcome === 'victory' ? 6 : 0}`,
    );
    await expect.poll(() => query(page, 'savePending')).toBe(false);
    expect(await query(page, 'rewardError')).toBeNull();
    if (outcome === 'death')
      expect(await query(page, 'runState')).toMatchObject({
        hp: 0,
        modeId: 'assault',
      });
    const meta = (await query(page, 'meta')) as {
      campaign: { completed: string[] };
      lastRuns: { rewards: { data: number } }[];
    };
    expect(meta.campaign.completed).toEqual([]);
    expect(meta.lastRuns.length).toBeGreaterThan(0);
    if (outcome === 'victory')
      expect(meta.lastRuns[0]!.rewards.data).toBeGreaterThan(0);
    await page
      .getByRole('button', { name: 'Wróć do kryjówki', exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
        timeout: LOAD_TIMEOUT,
      })
      .toBe('hub');
    expect(errors).toEqual([]);
  });
}

test('Szturm: mobilny HUD nie nakłada się na kredyty, implanty ani moce', async ({
  page,
}) => {
  test.setTimeout(3 * LOAD_TIMEOUT);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?scene=run&mode=assault&debug=1&fx=lite');
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const game = window.__neoryder;
          if (
            !game ||
            game.query('loading') !== false ||
            !game.query('assault')
          )
            return false;
          game.command('god');
          return true;
        }),
      { timeout: LOAD_TIMEOUT },
    )
    .toBe(true);
  await expect(page.locator('.assault-hud')).toContainText('Sektor 1/3');
  const layout = await page.evaluate(() => {
    const goal = document
      .querySelector('.assault-hud')!
      .getBoundingClientRect();
    const overlaps = [
      ...document.querySelectorAll(
        '.run-hud__credits, .run-hud__implants, .hud__power-list',
      ),
    ]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
      .some(
        (r) =>
          goal.left < r.right &&
          goal.right > r.left &&
          goal.top < r.bottom &&
          goal.bottom > r.top,
      );
    return { overlaps, left: goal.left, right: goal.right };
  });
  expect(layout.overlaps).toBe(false);
  expect(layout.left).toBeGreaterThanOrEqual(0);
  expect(layout.right).toBeLessThanOrEqual(390);
});
