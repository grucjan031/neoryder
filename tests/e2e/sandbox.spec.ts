import { test, expect } from '@playwright/test';
import { waitSimSteps } from './helpers';
import { tuning } from '../../src/core/tuning';

test('sandbox ładuje canvas bez błędów i wykonuje kroki', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?scene=sandbox&debug=1&seed=e2e');
  await expect(page.locator('canvas').first()).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()))
    .toBe('sandbox');
  const initial = await page.evaluate(() => window.__neoryder?.tick() ?? 0);
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.tick() ?? 0))
    .toBeGreaterThan(initial);
  await testInfo.attach('sandbox', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  expect(errors).toEqual([]);
});

test('kostka spada i stabilizuje się nad podłogą', async ({ page }) => {
  await page.goto('/?scene=sandbox&debug=1');
  await expect
    .poll(() => page.evaluate(() => typeof window.__neoryder?.query('cubeY')))
    .toBe('number');
  const initial = await page.evaluate(() => {
    window.__neoryder?.command('reset');
    return window.__neoryder?.query('cubeY') as number;
  });
  expect(initial).toBe(tuning.sandbox.cubeSpawnHeight);
  await expect
    .poll(() =>
      page.evaluate(() => window.__neoryder?.query('cubeY') as number),
    )
    .toBeLessThan(initial);
  await waitSimSteps(page, 180); // 3 s czasu symulacji
  const settled = await page.evaluate(
    () => window.__neoryder?.query('cubeY') as number,
  );
  expect(settled).toBeGreaterThan(0);
  expect(settled).toBeLessThan(initial);
  expect(settled).toBeCloseTo(0.5, 1);
  await waitSimSteps(page, 18);
  const later = await page.evaluate(
    () => window.__neoryder?.query('cubeY') as number,
  );
  expect(Math.abs(later - settled)).toBeLessThan(0.02);
});

test('spawn cube zwiększa liczbę ciał, reset ją przywraca i konsola ma historię', async ({
  page,
}) => {
  await page.goto('/?scene=sandbox&debug=1&seed=console-test');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('bodies')))
    .toBe(2);
  await page.evaluate(() => window.__neoryder?.command('spawn cube'));
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('bodies')))
    .toBe(3);
  await page.keyboard.press('Backquote');
  const input = page.getByRole('textbox', { name: 'Komenda debug' });
  await expect(input).toBeVisible();
  await input.fill('seed');
  await input.press('Enter');
  await expect(
    page.getByRole('dialog', { name: 'Konsola debug' }),
  ).toContainText('console-test');
  await input.press('ArrowUp');
  await expect(input).toHaveValue('seed');
  await input.fill('reset');
  await input.press('Enter');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('bodies')))
    .toBe(2);
});

test('nieznana scena pokazuje komunikat i listę dostępnych scen', async ({
  page,
}, testInfo) => {
  await page.goto('/?scene=missing');
  const message = page.locator('.scene-error');
  await expect(message).toBeVisible();
  await expect(message).toContainText('Nieznana scena: missing.');
  for (const id of [
    'arena',
    'sandbox',
    'player-test',
    'damage-test',
    'style-test',
  ])
    await expect(message).toContainText(id);
  await expect(page.locator('canvas')).toHaveCount(0);
  await testInfo.attach('nieznana-scena', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});

test('utrata fokusu zatrzymuje tick, menu pauzy wznawia i prosi o pointer lock', async ({
  page,
}) => {
  await page.goto('/?scene=sandbox&debug=1');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.tick() ?? 0))
    .toBeGreaterThan(0);
  const paused = await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'));
    return window.__neoryder?.tick();
  });
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.__neoryder?.tick())).toBe(paused);
  const pauseMenu = page.getByRole('dialog', { name: 'Pauza', exact: true });
  await expect(pauseMenu).toBeVisible();
  await pauseMenu.getByRole('button', { name: 'Wznów' }).click();
  await expect(pauseMenu).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.tick() ?? 0))
    .toBeGreaterThan(paused ?? 0);
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement?.tagName))
    .toBe('CANVAS');
});

test('tryb produkcyjny bez debug nie wystawia uchwytu ani konsoli', async ({
  page,
}) => {
  await page.goto('/?scene=sandbox');
  await expect(page.getByLabel('Scena NEORYDER')).toBeVisible();
  expect(await page.evaluate(() => window.__neoryder)).toBeUndefined();
  await page.keyboard.press('Backquote');
  await expect(
    page.getByRole('textbox', { name: 'Komenda debug' }),
  ).toHaveCount(0);
});

test('bez ?scene= w debug pokazuje menu gry z Kryjówką i przyciskiem Sceny debug', async ({
  page,
}) => {
  await page.goto('/?debug=1');
  await expect(page.getByRole('heading', { name: 'NEORYDER' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kryjówka' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Walka z wrogami/ })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Sceny debug' }).click();
  await expect(page).toHaveURL(/scenes=1/);
  await expect(page).toHaveURL(/debug=1/);
  await expect(
    page.getByRole('link', { name: /Walka z wrogami/ }),
  ).toBeVisible();
});

test('?scenes=1&debug=1 pokazuje menu scen z linkami', async ({ page }) => {
  await page.goto('/?scenes=1&debug=1');
  await expect(page.getByRole('heading', { name: 'NEORYDER' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  const link = page.getByRole('link', { name: /Walka z wrogami/ });
  await expect(link).toHaveAttribute('href', /scene=ai-test/);
  await page.getByRole('link', { name: /Sandbox fizyki/ }).click();
  await expect(page.getByLabel('Scena NEORYDER')).toBeVisible();
});
