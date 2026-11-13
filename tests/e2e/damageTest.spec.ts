import { test, expect } from '@playwright/test';

test('damage-test loads without console errors and applies hit 30', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?scene=damage-test&debug=1&seed=damage-e2e');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()))
    .toBe('damage-test');
  await expect(page.getByLabel('Scena NEORYDER')).toBeVisible();
  await expect(page.getByLabel('Zdrowie manekina')).toContainText(
    '100 / 100 HP',
  );
  const hp = await page.evaluate(() => {
    window.__neoryder?.command('hit 30');
    return window.__neoryder?.query('dummyHp');
  });
  expect(hp).toBe(70);
  await expect(page.getByLabel('Zdrowie manekina')).toContainText(
    '70 / 100 HP',
  );
  await testInfo.attach('damage-test', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  expect(errors).toEqual([]);
});
