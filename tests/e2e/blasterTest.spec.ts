import { test, expect } from '@playwright/test';
import { LOAD_TIMEOUT, waitSimSteps } from './helpers';

test('blaster-test fires at dummies and exposes overheat without console errors', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?scene=blaster-test&debug=1&fx=lite&seed=blaster-e2e');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('blaster-test');
  await expect(page.getByLabel('Scena NEORYDER')).toBeVisible();
  await expect(page.getByLabel('Ciepło blastera')).toBeVisible();
  const before = await page.evaluate(
    () => window.__neoryder?.query('dummyHp') as number[],
  );
  await page.evaluate(() => window.__neoryder?.command('fire 3'));
  await waitSimSteps(page, 40);
  const after = await page.evaluate(
    () => window.__neoryder?.query('dummyHp') as number[],
  );
  expect(after.reduce((sum, hp) => sum + hp, 0)).toBeLessThan(
    before.reduce((sum, hp) => sum + hp, 0),
  );
  expect(await page.evaluate(() => window.__neoryder?.query('shots'))).toBe(3);
  expect(
    await page.evaluate(() => {
      window.__neoryder?.command('overheat');
      return window.__neoryder?.query('overheated');
    }),
  ).toBe(true);
  await testInfo.attach('blaster-test', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  expect(errors).toEqual([]);
});
