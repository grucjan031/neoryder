import { expect, test } from '@playwright/test';
import { LOAD_TIMEOUT, SIM_TIMEOUT } from './helpers';

test('tablica blokuje Bulwar do M07, a wznowienie zachowuje dzielnicę i jej fale', async ({
  page,
}) => {
  test.setTimeout(480_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const query = (key: string) =>
    page.evaluate((k) => window.__neoryder?.query(k), key);
  const command = (line: string) =>
    page.evaluate((s) => window.__neoryder?.command(s), line);
  const board = async () => {
    await page.goto('/?scene=hub&debug=1&fx=lite');
    await expect
      .poll(() => query('meta'), { timeout: LOAD_TIMEOUT })
      .toBeTruthy();
    await command('hub open missions');
    await page.addStyleTag({
      content: '.lil-gui { display: none !important }',
    });
  };
  await board();
  const district = page.getByRole('group', { name: 'Dzielnica' });
  const bulwar = district.getByRole('button', { name: /Bulwar/i });
  const kurogane = district.getByRole('button', { name: /Kurogane/i });
  await expect(kurogane).toHaveAttribute('aria-pressed', 'true');
  await expect(bulwar).toBeDisabled();
  await expect(bulwar.getByText('Ukończ misję Nocny dyżur')).toBeVisible();
  await page.goto('/?scene=run&debug=1&fx=lite');
  await expect
    .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
    .toBe('map');
  await command('campaign complete m07-nocny-dyzur');
  await expect.poll(() => query('savePending')).toBe(false);
  await board();
  await kurogane.focus();
  await page.keyboard.press('Tab');
  await expect(bulwar).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', { name: /Bulwar · Helixa Dynamics/i }),
  ).toBeVisible();
  await expect(page.getByText(/więcej Kredytów/)).toBeVisible();
  await board();
  await expect(bulwar).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.missions-panel input[type=text]').fill('bulwar-38');
  await page.getByRole('button', { name: 'Rozpocznij run' }).click();
  await expect
    .poll(() => query('map'), { timeout: LOAD_TIMEOUT })
    .toMatchObject({ sectorId: 'bulwar' });
  await expect.poll(() => query('savePending')).toBe(false);
  await page.evaluate(() => {
    const settings = JSON.parse(localStorage.getItem('neoryder.settings')!);
    settings.lastDistrict = 'kurogane';
    localStorage.setItem('neoryder.settings', JSON.stringify(settings));
  });
  await page.goto('/?scene=run&continue=1&debug=1&fx=lite');
  await expect
    .poll(() => query('runState'), { timeout: LOAD_TIMEOUT })
    .toMatchObject({ sectorId: 'bulwar', map: { sectorId: 'bulwar' } });
  await expect(
    page.locator('.ui-kicker').filter({ hasText: 'Sektor Bulwar · mapa' }),
  ).toBeVisible();
  await expect(page.locator('.sector-map__info')).toHaveText(
    'Bulwar · Seed: bulwar-38',
  );
  await page.locator('[data-node-id=L1N1]').click();
  await expect
    .poll(() => query('room'), { timeout: LOAD_TIMEOUT })
    .toBe('run5');
  await expect(page.getByText('SEKTOR BULWAR // FALA')).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  await expect
    .poll(() => query('spawnLog'), { timeout: SIM_TIMEOUT })
    .toEqual(
      expect.arrayContaining([
        expect.objectContaining({ enemy: 'helixGuard' }),
      ]),
    );
  expect(await query('runError')).toBeNull();
  expect(errors).toEqual([]);
});
