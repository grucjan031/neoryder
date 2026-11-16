import { expect, test } from '@playwright/test';
import { LOAD_TIMEOUT, SIM_TIMEOUT, waitSimSteps } from './helpers';

test('ai-test loads cleanly, spawns assaulters and kills them through DamageSystem', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?scene=ai-test&debug=1&fx=lite&seed=ai-e2e');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('ai-test');
  await expect(page.getByLabel('Zdrowie gracza')).toContainText('100 / 100 HP');
  const counts = await page.evaluate(() => {
    const before = window.__neoryder?.query('enemies');
    window.__neoryder?.command('god');
    window.__neoryder?.command('spawn assaulter 2');
    return { before, after: window.__neoryder?.query('enemies') };
  });
  expect(counts).toEqual({ before: 3, after: 5 });
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

test('spawn gunner adds a ranged enemy whose projectiles damage the player with god disabled', async ({
  page,
}) => {
  await page.goto('/?scene=ai-test&debug=1&fx=lite&seed=gunner-e2e');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('ai-test');
  const result = await page.evaluate(() => {
    window.__neoryder?.command('god');
    window.__neoryder?.command('kill all');
    const before = window.__neoryder?.query('enemies');
    window.__neoryder?.command('spawn gunner 1');
    const after = window.__neoryder?.query('enemies');
    // God starts disabled; the second toggle restores damage after setup.
    const god = window.__neoryder?.command('god');
    return { before, after, god, hp: window.__neoryder?.query('playerHp') };
  });
  expect(result).toMatchObject({ before: 0, after: 1, hp: 100 });
  expect(result.god).toContain('wyłączona');
  await waitSimSteps(page, 240);
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('playerHp')), {
      timeout: SIM_TIMEOUT,
    })
    .toBeLessThan(100);
  expect(await page.evaluate(() => window.__neoryder?.query('enemies'))).toBe(
    1,
  );
});

test('spawn sniper and drone (F2-13) renders both new archetypes without console errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?scene=ai-test&debug=1&fx=lite&seed=f2-13-e2e');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('ai-test');
  const after = await page.evaluate(() => {
    window.__neoryder?.command('god');
    window.__neoryder?.command('kill all');
    window.__neoryder?.command('spawn sniper 1');
    window.__neoryder?.command('spawn drone 2');
    return window.__neoryder?.query('enemies');
  });
  expect(after).toBe(3);
  await waitSimSteps(page, 180);
  const states = (await page.evaluate(() =>
    window.__neoryder?.query('enemyStates'),
  )) as { state: string }[];
  expect(states).toHaveLength(3);
  expect(errors).toEqual([]);
});
