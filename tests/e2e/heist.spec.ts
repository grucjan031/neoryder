import { expect, test } from '@playwright/test';
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

for (const outcome of ['victory', 'death'] as const) {
  test(`Kradzież rdzenia: kryjówka → ${outcome} → kryjówka`, async ({
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
    await page.locator('[data-mode="heist"]').click({ timeout: 30_000 });
    await page
      .getByRole('button', { name: 'Rozpocznij Kradzież rdzenia', exact: true })
      .click();
    await expect
      .poll(
        () =>
          page.evaluate((outcome) => {
            const game = window.__neoryder;
            if (
              !game ||
              game.query('loading') !== false ||
              game.query('screen') !== 'room' ||
              !game.query('heist')
            )
              return false;
            if (outcome === 'victory') {
              game.command('god');
              game.command('heist grab');
              game.command('heist extract');
            } else {
              game.command('heist lives 1');
              game.command('heist grab');
              game.command('hurt 99999');
            }
            return true;
          }, outcome),
        { timeout: LOAD_TIMEOUT },
      )
      .toBe(true);
    await expect
      .poll(() => page.evaluate(() => window.__neoryder?.query('screen')), {
        timeout: LOAD_TIMEOUT,
      })
      .toBe('summary');
    await expect(
      page.getByText(outcome === 'victory' ? 'Zwycięstwo' : 'Porażka', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator('.run-screen')).toContainText(
      `Pokoje: ${outcome === 'victory' ? 6 : 0}`,
    );
    await expect
      .poll(() => page.evaluate(() => window.__neoryder?.query('savePending')))
      .toBe(false);
    expect(
      await page.evaluate(() => window.__neoryder?.query('rewardError')),
    ).toBeNull();
    expect(
      await page.evaluate(() => window.__neoryder?.query('runState')),
    ).toMatchObject({ modeId: 'heist' });
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

test('Kradzież rdzenia: mobilny HUD i podniesienie w świecie', async ({
  page,
}) => {
  test.setTimeout(3 * LOAD_TIMEOUT);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?scene=run&mode=heist&arena=combatRing&debug=1&fx=lite');
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const game = window.__neoryder;
          if (!game || game.query('loading') !== false || !game.query('heist'))
            return false;
          game.command('god');
          game.command('tp 0 -11.5');
          return true;
        }),
      { timeout: LOAD_TIMEOUT },
    )
    .toBe(true);
  await expect(page.locator('.heist-hud')).toContainText('Niesiesz rdzeń');
  const layout = await page.evaluate(() => {
    const goal = document.querySelector('.heist-hud')!.getBoundingClientRect();
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

test('Kradzież rdzenia na dużej arenie: Elektrownia, rdzeń z bazy do ewakuacji', async ({
  page,
}) => {
  test.setTimeout(4 * LOAD_TIMEOUT);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(
    '/?scene=run&mode=heist&arena=arenaPowerPlant&debug=1&fx=lite',
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const game = window.__neoryder;
          if (!game || game.query('loading') !== false || !game.query('heist'))
            return false;
          game.command('god');
          return true;
        }),
      { timeout: LOAD_TIMEOUT },
    )
    .toBe(true);
  // Start przy punkcie ewakuacji (25, -25); baza (-120, 15) jest daleko.
  const start = (await page.evaluate(() =>
    window.__neoryder?.query('playerPos'),
  )) as { x: number; z: number };
  expect(start.x).toBeCloseTo(30, 0);
  expect(start.z).toBeCloseTo(-26.5, 0);
  await page.evaluate(() => window.__neoryder?.command('tp -120 15'));
  await expect
    .poll(() =>
      page.evaluate(
        () => (window.__neoryder?.query('heist') as { state: string }).state,
      ),
    )
    .toBe('player');
  await page.evaluate(() => window.__neoryder?.command('tp 25 -25'));
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('screen')), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('summary');
  await expect(page.getByText('Zwycięstwo', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => window.__neoryder?.query('runState')),
  ).toMatchObject({ modeId: 'heist' });
  expect(errors).toEqual([]);
});
