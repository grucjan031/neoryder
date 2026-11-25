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
  const district = page.getByRole('combobox', { name: 'Dzielnica' });
  await expect(district).toHaveValue('kurogane');
  await expect(district.locator('option[value=bulwar]')).toBeDisabled();
  await expect(
    page.getByText('Bulwar · Ukończ misję Nocny dyżur'),
  ).toBeVisible();
  await page.goto('/?scene=run&debug=1&fx=lite');
  await expect
    .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
    .toBe('map');
  await command('campaign complete m07-nocny-dyzur');
  await expect.poll(() => query('savePending')).toBe(false);
  await board();
  await district.selectOption('bulwar');
  await board();
  await expect(district).toHaveValue('bulwar');
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
  await page.locator('[data-node-id=L1N1]').click();
  await expect
    .poll(() => query('room'), { timeout: LOAD_TIMEOUT })
    .toBe('combatClinic');
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
