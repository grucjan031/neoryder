import { test, expect } from '@playwright/test';

test('sfx-test: po kliknięciu kontekst audio działa i dźwięki się odtwarzają', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?scene=sfx-test&debug=1');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()))
    .toBe('sfx-test');
  await page.getByRole('button', { name: 'kill' }).click();
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('audioState')))
    .toBe('running');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.query('lastSound')))
    .toBe('kill');
  const reply = await page.evaluate(() =>
    window.__neoryder?.command('sfx parry'),
  );
  expect(reply).toBe('Odtworzono: parry');
  expect(errors).toEqual([]);
});
