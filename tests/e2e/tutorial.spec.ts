import { expect, test } from '@playwright/test';

test('samouczek: pierwszy krok, ukończenie i przejście do kryjówki', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?scene=tutorial&debug=1');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()))
    .toBe('tutorial');
  await expect(page.locator('.tutorial-panel')).toBeVisible();
  await expect(page.locator('.tutorial-panel__number')).toContainText('1 / 11');
  await expect(page.locator('.tutorial-panel kbd').first()).toHaveText('W');
  await page.evaluate(() => window.__neoryder?.command('tutorial step 11'));
  await expect(
    page.getByRole('heading', { name: 'Samouczek ukończony' }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem('neoryder.tutorialDone')),
  ).toBe('1');
  await page.getByRole('button', { name: 'Do kryjówki', exact: true }).click();
  await expect(page).toHaveURL(/scene=hub/);
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()))
    .toBe('hub');
  expect(errors).toEqual([]);
});
