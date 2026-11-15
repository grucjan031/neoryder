import { expect, test } from '@playwright/test';

test('ustawienia zachowują czułość i przypisanie dash po przeładowaniu', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ustawienia', exact: true }).click();
  const screen = page.getByRole('dialog', { name: 'Ustawienia', exact: true });
  await expect(screen).toBeVisible();
  const sensitivity = screen.getByRole('slider', { name: 'Czułość myszy' });
  await sensitivity.focus();
  await page.keyboard.press('Home');
  for (let step = 0; step < 24; step++) await page.keyboard.press('ArrowRight');
  await screen.locator('[data-action="dash"]').click();
  await expect(screen.locator('[data-action="dash"]')).toHaveText(
    'Naciśnij klawisz…',
  );
  await page.keyboard.press('KeyV');
  await expect(screen.locator('[data-action="dash"]')).toHaveText('V');
  await page.reload();
  await page.getByRole('button', { name: 'Ustawienia', exact: true }).click();
  await expect(sensitivity).toHaveValue('2.5');
  await expect(screen.locator('[data-action="dash"]')).toHaveText('V');
  expect(errors).toEqual([]);
});

test('Esc w room-test zatrzymuje tick, ustawienia pozostają w pauzie, Wznów uruchamia symulację', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/?scene=room-test&debug=1');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.tick() ?? 0))
    .toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  const pause = page.getByRole('dialog', { name: 'Pauza', exact: true });
  await expect(pause).toBeVisible();
  const tick = await page.evaluate(() => window.__neoryder!.tick());
  // Kilka klatek renderu musi upłynąć, by wykryć niezamierzone kroki symulacji.
  await page.evaluate(async () => {
    for (let frame = 0; frame < 12; frame++)
      await new Promise(requestAnimationFrame);
  });
  expect(await page.evaluate(() => window.__neoryder!.tick())).toBe(tick);
  await pause.getByRole('button', { name: 'Ustawienia', exact: true }).click();
  const settings = page.getByRole('dialog', {
    name: 'Ustawienia',
    exact: true,
  });
  await expect(settings).toBeVisible();
  await settings.getByRole('tab', { name: 'Obraz' }).click();
  await settings
    .getByRole('slider', { name: 'Pole widzenia (FOV)', exact: true })
    .focus();
  await page.keyboard.press('End');
  for (let step = 0; step < 10; step++) await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate(() => window.__neoryder!.tick())).toBe(tick);
  await settings.getByRole('button', { name: 'Wróć', exact: true }).click();
  await pause.getByRole('button', { name: 'Wznów', exact: true }).click();
  await expect(pause).not.toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.__neoryder!.tick()))
    .toBeGreaterThan(tick);
  expect(errors).toEqual([]);
});
