import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { LOAD_TIMEOUT, waitSimSteps } from './helpers';

const query = (page: Page, name: string) =>
  page.evaluate((key) => window.__neoryder?.query(key), name);

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

interface Achievements {
  unlocked: string[];
  counters: Record<string, number>;
}

async function openTalentsTab(page: Page): Promise<void> {
  await page.evaluate(() => window.__neoryder?.command('hub open talents'));
  await expect(page.locator('.hub-screen .talents-panel')).toBeVisible();
  await page.getByRole('tab', { name: 'Naszywki Iskry' }).click();
}

test('naszywki: zwycięstwo daje Pierwsze zwycięstwo w podsumowaniu, panelu kryjówki i po odświeżeniu', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/?scene=run&loadout=meta&seed=ach-e2e&debug=1&fx=lite');
  await expect
    .poll(() => query(page, 'screen'), { timeout: LOAD_TIMEOUT })
    .toBe('map');
  expect((await query(page, 'achievements')) as Achievements).toEqual({
    unlocked: [],
    counters: {},
  });

  // Gotowość i komenda w jednym evaluate: bez okna na zmianę stanu między zapytaniami.
  const finished = await page.evaluate(() => {
    const game = window.__neoryder;
    if (!game || game.query('screen') !== 'map') return null;
    return game.command('run end win');
  });
  expect(finished).not.toBeNull();
  await expect.poll(() => query(page, 'screen')).toBe('summary');
  const box = page.getByTestId('run-achievements');
  await expect(box).toBeVisible();
  await expect(box).toContainText('Pierwsze zwycięstwo');
  await expect(box).toContainText('20 Danych');
  await expect.poll(() => query(page, 'savePending')).toBe(false);
  const state = (await query(page, 'achievements')) as Achievements;
  expect(state.unlocked).toContain('pierwsze-zwyciestwo');
  expect(state.counters).toMatchObject({ runs_ended: 1, victories: 1 });

  await page.getByRole('button', { name: 'Wróć do kryjówki' }).click();
  await expect(page).toHaveURL(/scene=hub/);
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('hub');
  await waitSimSteps(page, 5);
  await openTalentsTab(page);
  const earned = page.locator(
    '.achv-card[data-id="pierwsze-zwyciestwo"][data-state="earned"]',
  );
  await expect(earned).toBeVisible();
  await expect(earned).toContainText('Pierwsze zwycięstwo');
  await expect(page.locator('.achv-card[data-state="earned"]')).toHaveCount(1);
  const missing = page.locator('.achv-card[data-id="zwierciadlo"]');
  await expect(missing).toHaveAttribute('data-state', 'missing');
  await expect(missing.locator('[role="progressbar"]')).toHaveAttribute(
    'aria-valuenow',
    '0',
  );
  await expect(missing.locator('.achv-card__hint')).toBeVisible();

  // Odświeżenie zachowuje naszywkę (zapis w IndexedDB).
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('hub');
  await waitSimSteps(page, 5);
  expect(
    ((await query(page, 'achievements')) as Achievements).unlocked,
  ).toEqual(['pierwsze-zwyciestwo']);
  await openTalentsTab(page);
  await expect(earned).toBeVisible();
  expect(errors).toEqual([]);
});

test('naszywki: komenda debug achievement grant odblokowuje kłódkę w warsztacie', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/?scene=hub&debug=1&fx=lite&seed=ach-lock');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('hub');
  await waitSimSteps(page, 5);
  await page.evaluate(() => {
    const game = window.__neoryder;
    game?.command('meta xp 5000');
    game?.command('meta cores 50');
    game?.command('hub open workshop');
  });
  const row = page.locator('[data-unlock="blade:staffBlade"]');
  await expect(row).toHaveAttribute('data-status', 'achievement');
  await expect(row).toContainText('Wymaga naszywki: Taniec ostrza');
  await expect(row.locator('.achv-lock')).toBeVisible();
  await page.evaluate(() => {
    const game = window.__neoryder;
    game?.command('hub close');
    game?.command('achievement grant taniec-ostrza');
    game?.command('hub open workshop');
  });
  await expect(
    page.locator('[data-unlock="blade:staffBlade"]'),
  ).toHaveAttribute('data-status', 'buyable');
  expect(errors).toEqual([]);
});
