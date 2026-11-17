import { expect, test } from '@playwright/test';
import { LOAD_TIMEOUT } from './helpers';

for (const outcome of ['victory', 'death'] as const) {
  test(`Przejęcie: kryjówka → arena → ${outcome} → kryjówka`, async ({
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
        name: 'Kradzież rdzenia — Wkrótce',
        exact: true,
      }),
    ).toBeDisabled();
    await page.locator('[data-mode="conquest"]').click();
    await page
      .getByRole('button', { name: 'Rozpocznij Przejęcie', exact: true })
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
              !game.query('conquest')
            )
              return false;
            if (outcome === 'victory') {
              game.command('god');
              for (const id of ['A', 'B', 'C'])
                game.command(`conquest capture ${id}`);
              game.command('conquest tickets 0');
              game.command('kill all');
            } else game.command('hurt 99999');
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
    const meta = (await page.evaluate(() =>
      window.__neoryder?.query('meta'),
    )) as {
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
