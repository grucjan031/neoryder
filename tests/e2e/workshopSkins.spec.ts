import { expect, test } from '@playwright/test';
import { LOAD_TIMEOUT, waitSimSteps } from './helpers';

test('Nocny karbon można przymierzyć, kupić i zachować po przeładowaniu', async ({
  page,
}) => {
  test.setTimeout(6 * LOAD_TIMEOUT);
  const command = (line: string) =>
    page.evaluate((text) => window.__neoryder?.command(text), line);
  const open = async (fund = false) => {
    await expect
      .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
        timeout: LOAD_TIMEOUT,
      })
      .toBe('hub');
    await waitSimSteps(page, 5);
    await page.addStyleTag({ content: '.lil-gui {display:none!important}' });
    if (fund) await command('meta data 120');
    await command('hub open workshop');
    await page.locator('[data-key="row:weapon:blaster"]').click();
  };
  await page.goto('/?scene=hub&debug=1&fx=lite');
  await open(true);
  const tile = page.locator('.workshop__skin[data-skin="nocny-karbon"]');
  await tile.getByRole('button', { name: 'Przymierz: Nocny karbon' }).click();
  await expect(page.getByTestId('weapon-preview')).toHaveAttribute(
    'data-skin',
    'nocny-karbon',
  );
  await tile.getByRole('button', { name: 'Kup — 120 Danych' }).click();
  await page.locator('dialog.ui-modal .ui-button--primary').click();
  await tile.getByRole('button', { name: 'Załóż', exact: true }).click();
  await expect(
    tile.getByRole('button', { name: 'Założony', exact: true }),
  ).toBeDisabled();
  await page.reload();
  await open();
  await expect(
    tile.getByRole('button', { name: 'Założony', exact: true }),
  ).toBeDisabled();
  await expect(page.getByTestId('weapon-preview')).toHaveAttribute(
    'data-skin',
    'nocny-karbon',
  );
});
