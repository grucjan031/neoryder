import { test, expect } from '@playwright/test';
import { LOAD_TIMEOUT, waitSimSteps } from './helpers';

test('strzał w hali budzi podejrzenie, reset odtwarza cztery patrole', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/?scene=stealth-test&seed=patrol&debug=1&fx=lite');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('stealth-test');
  const command = (line: string) =>
    page.evaluate((text) => window.__neoryder?.command(text), line);
  await page
    .getByLabel('Scena NEORYDER')
    .click({ position: { x: 640, y: 360 } });
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement?.tagName))
    .toBe('CANVAS');
  await command('stealth reset');
  await page.mouse.down();
  try {
    await waitSimSteps(page, 3);
  } finally {
    await page.mouse.up();
  }
  await expect
    .poll(() => command('stealth state'))
    .toMatch(/suspicious|alerted/);
  await command('stealth reset');
  const state = await command('stealth state');
  expect(state?.match(/unaware 0\.00/g)).toHaveLength(4);
  expect(errors).toEqual([]);
});
