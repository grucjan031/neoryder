import { expect, test, type Page } from '@playwright/test';
import { LOAD_TIMEOUT, SIM_TIMEOUT, waitSimSteps } from './helpers';

async function enterMission(page: Page) {
  await page.goto('/?scene=mission&mission=m01-maszty&debug=1&fx=lite');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('screen')), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('playing');
}

test('M01 uczy ruchu, skok zamyka instrukcję, ponowne podejście ją pomija', async ({
  page,
}) => {
  await enterMission(page);
  const movement = page.locator('[data-mission-hint="ruch"]');
  await expect(movement.locator('kbd').last()).toHaveText('Spacja', {
    timeout: SIM_TIMEOUT,
  });
  await expect(movement).toBeVisible();
  await page.keyboard.down('Space');
  await waitSimSteps(page, 3);
  await page.keyboard.up('Space');
  expect(await movement.count()).toBe(0);
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('screen')), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('playing');
  await waitSimSteps(page, 135);
  await expect(movement).toHaveCount(0);
  expect(
    await page.evaluate(() => window.__neoryder?.command('hints list')),
  ).toContain('ruch: pokazana');
});

test('przełącznik dostępności wyłącza instrukcje dla świeżego profilu', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ustawienia', exact: true }).click();
  await page.getByRole('tab', { name: 'Dostępność' }).click();
  await page.getByRole('switch', { name: 'Podpowiedzi w misjach' }).click();
  await enterMission(page);
  await waitSimSteps(page, 135);
  await expect(page.locator('[data-mission-hint]')).toHaveCount(0);
  await expect(page.locator('.mission-hint')).toBeHidden();
});
