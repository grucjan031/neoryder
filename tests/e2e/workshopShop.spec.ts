import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { LOAD_TIMEOUT, waitSimSteps } from './helpers';

const command = (page: Page, line: string) =>
  page.evaluate((text) => window.__neoryder?.command(text), line);
const query = (page: Page, name: string) =>
  page.evaluate((key) => window.__neoryder?.query(key), name);

const SHOTS = process.env.WORKSHOP_SHOTS;

test('warsztat: kup broń i holo, załóż, podgląd i broń z modułem w runie', async ({
  page: initialPage,
}) => {
  let page = initialPage;
  test.setTimeout(10 * LOAD_TIMEOUT);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?scene=hub&debug=1&fx=lite');
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('hub');
  await waitSimSteps(page, 5);
  // Panel debug lil-gui zasłania prawą część ekranu.
  await page.addStyleTag({ content: '.lil-gui { display: none !important; }' });
  await command(page, 'meta xp 5000');
  await command(page, 'meta data 2000');
  await command(page, 'meta cores 20');
  await command(page, 'hub open workshop');
  const panel = page.locator('.hub-screen .workshop');
  await expect(panel).toBeVisible();

  // Broń: wybór wiersza pokazuje kartę z ceną, Kup kupuje, potem dodaje do zestawu.
  await page.locator('[data-action="tab"][data-tab="weapon"]').click();
  await page.locator('[data-key="row:weapon:rifle"]').click();
  const card = page.locator('[data-card="weapon:rifle"]');
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-status', 'buyable');
  const action = card.locator('[data-action="card"]');
  await expect(action).toHaveAttribute('data-card-action', 'buy');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/sklep-bron.png` });
  await action.click();
  // Zakup wymaga potwierdzenia w oknie modalnym.
  await page.locator('dialog.ui-modal .ui-button--primary').click();
  await expect(card).toHaveAttribute('data-status', 'owned');
  await expect(action).toHaveAttribute('data-card-action', 'equip');
  // Jedno miejsce na broń: karta pokazuje powód, dopóki nie kupimy drugiego slotu.
  await expect(action).toBeDisabled();
  await expect(card.locator('[data-blocked="full"]')).toBeVisible();
  await page.locator('[data-action="tab"][data-tab="unlocks"]').click();
  await page.locator('[data-key="buy:slot:weapon2"]').click();
  await page.locator('dialog.ui-modal .ui-button--primary').click();
  await page.locator('[data-action="tab"][data-tab="weapon"]').click();
  await expect(action).toBeEnabled();
  await action.click();
  await expect(card).toHaveAttribute('data-equipped', 'true');

  // Dodatek: holo na karabinie.
  await page.locator('[data-action="tab"][data-tab="module"]').click();
  await page.locator('[data-key="row:module:holo"]').click();
  const holo = page.locator('[data-card="module:holo"]');
  await expect(holo).toBeVisible();
  await expect(holo.locator('tr[data-stat]').first()).toBeVisible();
  const buy = holo.locator('[data-action="card"]');
  await expect(buy).toHaveAttribute('data-card-action', 'buy');
  await buy.click();
  await page.locator('dialog.ui-modal .ui-button--primary').click();
  await expect(holo).toHaveAttribute('data-status', 'owned');
  await expect(buy).toHaveAttribute('data-card-action', 'equip');
  await buy.click();
  await expect(holo).toHaveAttribute('data-equipped', 'true');
  await expect(buy).toHaveAttribute('data-card-action', 'unequip');

  const preview = page.getByTestId('weapon-preview');
  await expect(preview).toHaveAttribute('data-modules', /holo/);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/sklep-holo.png` });

  // Zapis i broń z modułem w runie.
  await expect.poll(() => query(page, 'savePending')).not.toBe(true);
  await page.waitForTimeout(500);
  // Świeża karta: stary kontekst WebGL kryjówki nie spowalnia ładowania runu.
  const context = page.context();
  await page.close();
  page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?scene=run&loadout=meta&seed=shop-e2e&debug=1&fx=lite');
  // Odpytywanie w trakcie ładowania sceny na SwiftShader wstrzymuje ładowanie.
  await page.waitForTimeout(15_000);
  await page.waitForFunction(
    () => window.__neoryder?.sceneId() === 'run',
    null,
    { timeout: 4 * LOAD_TIMEOUT },
  );
  await expect
    .poll(() => query(page, 'screen'), { timeout: 3 * LOAD_TIMEOUT })
    .toBe('map');
  await page.locator('.run-screen [data-node-id]').first().click();
  await expect
    .poll(() => query(page, 'screen'), { timeout: 3 * LOAD_TIMEOUT })
    .toBe('room');
  const modules = (await query(page, 'runState')) as {
    loadout: { weapons: string[]; modules: Record<string, string[]> };
  };
  expect(modules.loadout.weapons).toContain('rifle');
  expect(modules.loadout.modules['blaster']).toContain('holo');
  expect(errors).toEqual([]);
});
