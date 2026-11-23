import { expect, test } from '@playwright/test';
import { LOAD_TIMEOUT, SIM_TIMEOUT, waitSimSteps } from './helpers';

test('run: kontynuacja po zapisie odtwarza stan mapy', async ({ page }) => {
  test.setTimeout(4 * LOAD_TIMEOUT + 4 * SIM_TIMEOUT);
  await page.goto('/?scene=run&seed=resume-check&debug=1&fx=lite');
  const query = (name: string) =>
    page.evaluate((key) => window.__neoryder?.query(key), name);
  await expect
    .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
    .toBe('map');
  await page.locator('.run-screen [data-node-id]').first().click();
  await expect
    .poll(() => query('loading'), { timeout: LOAD_TIMEOUT })
    .toBe(false);
  await page.evaluate(() => window.__neoryder?.command('run clear'));
  await expect
    .poll(() => query('screen'), { timeout: SIM_TIMEOUT })
    .toBe('reward');
  await page.keyboard.press('Digit1');
  await expect
    .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
    .toBe('map');
  // Zapis do IndexedDB jest asynchroniczny — przeładowanie dopiero po jego końcu.
  await expect
    .poll(() => query('savePending'), { timeout: SIM_TIMEOUT })
    .toBe(false);
  const saved = await query('runState');
  await page.goto('/?scene=run&continue=1&debug=1&fx=lite');
  await expect
    .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
    .toBe('map');
  // Czas runu płynie dalej na mapie po wczytaniu — porównujemy resztę stanu.
  const { elapsedS: savedS, ...savedRest } = saved as { elapsedS: number };
  const { elapsedS, ...rest } = (await query('runState')) as {
    elapsedS: number;
  };
  expect(rest).toEqual(savedRest);
  expect(elapsedS).toBeGreaterThanOrEqual(savedS);
});

test('run: wybór węzła, wejście do pokoju, run clear, wybór implantu i powrót na mapę', async ({
  page,
}) => {
  test.setTimeout(480_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=run&seed=test1&loadout=classic&debug=1&fx=lite');
  const query = (name: string) =>
    page.evaluate((key) => window.__neoryder?.query(key), name);
  await expect
    .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
    .toBe('map');
  const first = page.locator('.run-screen [data-node-id]').first();
  const id = await first.getAttribute('data-node-id');
  await first.click();
  await expect
    .poll(() => query('room'), { timeout: LOAD_TIMEOUT })
    .toBeTruthy();
  await expect
    .poll(() => query('loading'), { timeout: LOAD_TIMEOUT })
    .toBe(false);
  expect(await query('runState')).toMatchObject({
    currentNodeId: id,
    loadoutId: 'classic',
  });
  expect(await query('doors')).toMatchObject({ exit: { open: false } });
  await page.evaluate(() => window.__neoryder?.command('run clear'));
  await expect
    .poll(() => query('screen'), { timeout: SIM_TIMEOUT })
    .toBe('reward');
  // F3-11: ekran nagrody pokazuje 3 prawdziwe implanty; klawisz 1 wybiera pierwszy.
  await expect(page.locator('.run-screen button')).toHaveCount(3);
  await page.keyboard.press('Digit1');
  await expect
    .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
    .toBe('map');
  expect(
    ((await query('runState')) as { implants: string[] }).implants,
  ).toHaveLength(1);
  expect(await query('room')).toBeNull();
  await page.keyboard.press('Digit1');
  await expect
    .poll(() => query('loading'), { timeout: LOAD_TIMEOUT })
    .toBe(false);
  await expect
    .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
    .toBe('room');
  await page.evaluate(() => window.__neoryder?.command('run clear'));
  await expect
    .poll(() => query('screen'), { timeout: SIM_TIMEOUT })
    .toBe('reward');
  await page.locator('.run-screen button').first().click();
  await expect
    .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
    .toBe('map');
  expect(
    ((await query('runState')) as { implants: string[] }).implants,
  ).toHaveLength(2);
  expect(await query('runError')).toBeNull();
  expect(errors).toEqual([]);
});

test('run: dojście do bossa, kill all po progach faz i ekran zwycięstwa', async ({
  page,
}) => {
  // Lokalnie ok. 2 min; na runnerze CI zakładamy do 3x wolniej.
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?scene=run&seed=test1&loadout=classic&debug=1&fx=lite');
  const query = (name: string) =>
    page.evaluate((key) => window.__neoryder?.query(key), name);
  const command = (text: string) =>
    page.evaluate((cmd) => window.__neoryder?.command(cmd), text);
  // Na wolnym runnerze CI gracz potrafił zginąć w pokoju, zanim `run clear` zadziałał
  // (ekran `summary` zamiast `reward`); test sprawdza przejście mapy i bossa, nie walkę.
  await expect
    .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
    .toBe('map');
  await command('god');
  // Przejście mapy: pierwszy dostępny węzeł każdej warstwy aż do bossa.
  for (let layer = 0; layer < 8; layer++) {
    await expect
      .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
      .toBe('map');
    await page.keyboard.press('Digit1');
    await expect
      .poll(() => query('loading'), { timeout: LOAD_TIMEOUT })
      .toBe(false);
    await expect
      .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
      .toMatch(/^(room|shop|rest)$/);
    if ((await query('room')) === 'bossRoom') break;
    if ((await query('screen')) === 'room') {
      await command('run clear');
      await expect
        .poll(() => query('screen'), { timeout: SIM_TIMEOUT })
        .toBe('reward');
    }
    await page.keyboard.press('Enter');
  }
  expect(await query('room')).toBe('bossRoom');
  expect(await query('phase')).toBe('stopped');
  expect(await query('boss')).toMatchObject({ phase: 1, hp: 900 });
  // Każde „kill all” przechodzi najwyżej jeden próg fazy (nietykalność przejścia).
  for (let i = 0; i < 3; i++) {
    await waitSimSteps(page, 75);
    await command('kill all');
  }
  await expect.poll(() => query('screen')).toBe('summary');
  await expect(page.getByText('Zwycięstwo', { exact: true })).toBeVisible();
  expect(await query('runError')).toBeNull();
  expect(errors).toEqual([]);
});

test('run: zakup implantu w sklepie za Kredyty', async ({ page }) => {
  test.setTimeout(480_000);
  await page.goto('/?scene=run&seed=test1&loadout=classic&debug=1&fx=lite');
  const query = (name: string) =>
    page.evaluate((key) => window.__neoryder?.query(key), name);
  const command = (value: string) =>
    page.evaluate((cmd) => window.__neoryder?.command(cmd), value);
  await expect
    .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
    .toBe('map');
  const map = (await query('map')) as {
    layers: { id: string; type: string; next: string[] }[][];
  };
  const byId = new Map(map.layers.flat().map((node) => [node.id, node]));
  const route = (id: string): string[] | null => {
    const node = byId.get(id)!;
    if (node.type === 'shop') return [id];
    for (const next of node.next) {
      const path = route(next);
      if (path) return [id, ...path];
    }
    return null;
  };
  const path = map.layers[0]!.map((node) => route(node.id)).find(
    (candidate) => candidate !== null,
  );
  expect(path).toBeTruthy();
  for (const id of path!) {
    await page.locator(`[data-node-id="${id}"]`).click();
    await expect
      .poll(() => query('loading'), { timeout: LOAD_TIMEOUT })
      .toBe(false);
    const screen = await query('screen');
    if (screen === 'shop') break;
    if (screen === 'room') {
      await command('run clear');
      await expect
        .poll(() => query('screen'), { timeout: SIM_TIMEOUT })
        .toBe('reward');
    }
    await page.keyboard.press('Enter');
    await expect
      .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
      .toBe('map');
  }
  await expect
    .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
    .toBe('shop');
  await command('credits 500');
  const before = (await query('runState')) as {
    credits: number;
    implants: string[];
  };
  await page.locator('.run-screen button[data-rarity]').first().click();
  // Zakup w sklepie zawsze przez okno potwierdzenia.
  await page.locator('dialog.ui-modal .ui-button--primary').click();
  await expect
    .poll(
      async () => {
        const state = (await query('runState')) as {
          credits: number;
          implants: string[];
        };
        return (
          state.credits < before.credits &&
          state.implants.length === before.implants.length + 1
        );
      },
      { timeout: SIM_TIMEOUT },
    )
    .toBe(true);
  const after = (await query('runState')) as {
    credits: number;
    implants: string[];
  };
  expect(after.credits).toBeLessThan(before.credits);
  expect(after.implants).toHaveLength(before.implants.length + 1);
});

test('run: śmierć w pokoju prowadzi do podsumowania i menu', async ({
  page,
}, testInfo) => {
  test.setTimeout(2 * LOAD_TIMEOUT + SIM_TIMEOUT);
  await page.goto('/?scene=run&seed=test1&loadout=classic&debug=1&fx=lite');
  const query = (name: string) =>
    page.evaluate((key) => window.__neoryder?.query(key), name);
  await expect
    .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
    .toBe('map');
  await page.locator('.run-screen [data-node-id]').first().click();
  await expect
    .poll(() => query('loading'), { timeout: LOAD_TIMEOUT })
    .toBe(false);
  await testInfo.attach('fx-lite-room', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
  await page.evaluate(() => window.__neoryder?.command('hurt 9999'));
  await expect.poll(() => query('screen')).toBe('summary');
  await expect(page.getByText('Porażka', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('button', { name: 'Kontynuuj' })).toBeDisabled();
});
