import { expect, test } from '@playwright/test';
import { SIM_TIMEOUT } from './helpers';

test('style-test zachowuje paletę i obrys bez błędów konsoli', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?scene=style-test&debug=1&seed=style-regression');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()))
    .toBe('style-test');
  // Panel debug, licznik FPS i podpowiedź zmieniają się między uruchomieniami
  // i zależą od czcionek systemu — nie należą do regresji stylu.
  await page.addStyleTag({
    content:
      '.lil-gui, .hint, canvas:not([aria-label]) { visibility: hidden !important; } body > div:has(> canvas:not([aria-label])) { visibility: hidden !important; }',
  });
  await expect(page.getByLabel('Scena NEORYDER')).toHaveScreenshot(
    'style-test.png',
    {
      maxDiffPixelRatio: 0.02,
      // Na CI (SwiftShader + obrys) pojedynczy zrzut trwa długo; stabilizacja wymaga 2 zgodnych.
      timeout: SIM_TIMEOUT,
    },
  );
  expect(errors).toEqual([]);
});
