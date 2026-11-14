import { expect, test } from '@playwright/test';
import { SIM_TIMEOUT, waitSimSteps } from './helpers';

test('ai-test loads cleanly, spawns assaulters and kills them through DamageSystem', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?scene=ai-test&debug=1&seed=ai-e2e');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: SIM_TIMEOUT,
    })
    .toBe('ai-test');
  await expect(page.getByLabel('Zdrowie gracza')).toContainText('100 / 100 HP');
  const counts = await page.evaluate(() => {
    const before = window.__neoryder?.query('enemies');
    window.__neoryder?.command('god');
    window.__neoryder?.command('spawn assaulter 2');
    return { before, after: window.__neoryder?.query('enemies') };
  });
  expect(counts).toEqual({ before: 2, after: 4 });
  await waitSimSteps(page, 90);
  await testInfo.attach('ai-test', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await page.evaluate(() => window.__neoryder?.command('hit 1000'));
  await waitSimSteps(page, 35);
  expect(await page.evaluate(() => window.__neoryder?.query('enemies'))).toBe(
    0,
  );
  expect(errors).toEqual([]);
});
