import { expect, test } from '@playwright/test';
import { SIM_TIMEOUT, waitSimSteps } from './helpers';

test('debris-test shatters, fills its pool and expires without console errors', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?scene=debris-test&debug=1&seed=debris-e2e');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: SIM_TIMEOUT,
    })
    .toBe('debris-test');
  expect(
    await page.evaluate(() => {
      window.__neoryder?.command('shatter 3');
      return window.__neoryder?.query('debris');
    }),
  ).toBeGreaterThan(0);
  await waitSimSteps(page, 190);
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('debris')), {
      timeout: SIM_TIMEOUT,
    })
    .toBe(0);
  expect(
    await page.evaluate(() => {
      window.__neoryder?.command('perf');
      return window.__neoryder?.query('debris');
    }),
  ).toBe(600);
  await waitSimSteps(page, 10);
  await testInfo.attach('debris-test', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await waitSimSteps(page, 180);
  expect(await page.evaluate(() => window.__neoryder?.query('debris'))).toBe(0);
  expect(errors).toEqual([]);
});
