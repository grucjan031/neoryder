import { expect, test, type Page } from '@playwright/test';
import { LOAD_TIMEOUT } from './helpers';

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
    // Karty trybów w tablicy misji mają selektor data-mode (nazwa karty zawiera stan i typ).
    await expect(page.locator('[data-mode="heist"]')).toBeEnabled();
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

test('Szturm na dużej arenie: Zajezdnia Maglev, trzy sektory od startu do zwycięstwa', async ({
  page,
}) => {
  test.setTimeout(4 * LOAD_TIMEOUT);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(
    '/?scene=run&mode=assault&arena=arenaRailYard&debug=1&fx=lite',
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const game = window.__neoryder;
          return (
            !!game &&
            game.query('loading') === false &&
            game.query('screen') === 'room' &&
            !!game.query('assault')
          );
        }),
      { timeout: LOAD_TIMEOUT },
    )
    .toBe(true);
  // Start w pierwszym sektorze areny (układ `arena.assault`), nie w małym pokoju.
  const start = (await query(page, 'playerPos')) as { x: number; z: number };
  expect(start.x).toBeCloseTo(-162, 0);
  expect(start.z).toBeCloseTo(46, 0);
  await page.evaluate(() => window.__neoryder?.command('god'));
  for (let sector = 1; sector <= 3; sector++) {
    await expect
      .poll(
        () =>
          page.evaluate((index) => {
            const game = window.__neoryder!;
            const state = game.query('assault') as { sector: number };
            if (state.sector !== index) return false;
            game.command('assault destroy A');
            game.command('assault destroy B');
            return true;
          }, sector),
        { timeout: LOAD_TIMEOUT },
      )
      .toBe(true);
  }
  await expect
    .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
    .toBe('summary');
  await expect(page.getByText('Zwycięstwo', { exact: true })).toBeVisible();
  expect(await query(page, 'runState')).toMatchObject({ modeId: 'assault' });
  expect(errors).toEqual([]);
});

test('Szturm: dawny mały pokój nadal dostępny przez arena=combatCorridor', async ({
  page,
}) => {
  test.setTimeout(3 * LOAD_TIMEOUT);
  await page.goto(
    '/?scene=run&mode=assault&arena=combatCorridor&debug=1&fx=lite',
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const game = window.__neoryder;
          return (
            !!game && game.query('loading') === false && !!game.query('assault')
          );
        }),
      { timeout: LOAD_TIMEOUT },
    )
    .toBe(true);
  const start = (await query(page, 'playerPos')) as { x: number; z: number };
  expect(start.x).toBeCloseTo(0, 0);
  expect(start.z).toBeCloseTo(12, 0);
});
