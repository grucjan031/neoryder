import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { LOAD_TIMEOUT, SIM_TIMEOUT, waitSimSteps } from './helpers';

/** Zrzuty do oceny wizualnej: tylko gdy ustawiono NEORYDER_SHOTS (katalog); domyślnie nic nie jest zapisywane. */
const SHOTS_DIR = process.env.NEORYDER_SHOTS;

test('bot meta: menu → kryjówka → run → nagrody → warsztat i talenty → odświeżenie → kolejny run z meta', async ({
  page,
}) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  // Panel lil-gui (debug) zasłania nakładki UI; chowamy go, żeby klikać i fotografować jak gracz.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '.lil-gui { display: none !important; }';
      document.head.append(style);
    });
  });
  const query = (name: string) =>
    page.evaluate((key) => window.__neoryder?.query(key), name);
  const command = (line: string) =>
    page.evaluate((text) => window.__neoryder?.command(text), line);
  const shot = async (name: string) => {
    if (!SHOTS_DIR) return;
    mkdirSync(SHOTS_DIR, { recursive: true });
    await page.screenshot({ path: join(SHOTS_DIR, `${name}.png`) });
  };
  const waitHub = async () => {
    await expect
      .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
        timeout: LOAD_TIMEOUT,
      })
      .toBe('hub');
    await waitSimSteps(page, 5);
  };
  type Loadout = { weapons: string[]; powers: string[]; blade: string };
  type Meta = {
    xp: number;
    data: number;
    talents: string[];
    unlocks: string[];
    loadout: Loadout;
  };
  const meta = async () => (await query('meta')) as Meta;

  // Czysty stan: świeży kontekst Playwrighta ma pustą IndexedDB; menu gry.
  // Zrzuty do oceny wizualnej (NEORYDER_SHOTS) robimy w pełnym renderze, bez trybu lite.
  await page.goto(SHOTS_DIR ? '/?debug=1' : '/?debug=1&fx=lite');
  await expect(page.getByRole('heading', { name: 'NEORYDER' })).toBeVisible();
  await shot('01-menu');
  await page.getByRole('button', { name: 'Kryjówka' }).click();
  await expect(page).toHaveURL(/scene=hub/);
  await waitHub();
  const bar = page.locator('.meta-bar');
  await expect(bar).toContainText('Poziom 1');
  await shot('02-kryjowka');

  // Tablica misji: poziom zagrożenia 0 → run z ekwipunkiem meta.
  await command('hub open missions');
  await expect(
    page.getByRole('heading', { name: 'Tablica misji' }),
  ).toBeVisible();
  await page.locator('[data-level="0"]').click();
  await expect(page.locator('[data-level="0"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await shot('03-tablica-misji');
  await page.getByLabel('Seed (opcjonalnie)').fill('meta-bot-1');
  // RunScene po zapisie na mapie podmienia URL na `continue=1`, więc adres startu sprawdzamy w chwili nawigacji.
  const started = page.waitForURL(
    (url) => url.searchParams.get('loadout') === 'meta',
    { waitUntil: 'commit' },
  );
  await page.getByRole('button', { name: 'Rozpocznij run' }).click();
  await started;
  await expect
    .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
    .toBe('map');

  // Jeden węzeł normalnie (cheat clear), potem cheat końca runu.
  await page.keyboard.press('Digit1');
  await expect
    .poll(() => query('loading'), { timeout: LOAD_TIMEOUT })
    .toBe(false);
  await expect
    .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
    .toMatch(/^(room|shop|rest)$/);
  if ((await query('screen')) === 'room') {
    await command('run clear');
    await expect
      .poll(() => query('screen'), { timeout: SIM_TIMEOUT })
      .toBe('reward');
    await page.keyboard.press('Digit1');
    await expect
      .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
      .toBe('map');
  }
  await command('run end win');
  await expect.poll(() => query('screen')).toBe('summary');
  const rewards = page.getByTestId('run-meta-rewards');
  await expect(rewards).toContainText('Doświadczenie');
  await expect(rewards).toContainText('Dane');
  await expect(rewards).toContainText('Rdzenie');
  await shot('04-podsumowanie');
  await expect.poll(() => query('savePending')).toBe(false);

  await page.getByRole('button', { name: 'Wróć do kryjówki' }).click();
  await expect(page).toHaveURL(/scene=hub/);
  await waitHub();
  const levelNow = (await query('level')) as { level: number };
  expect(levelNow.level).toBeGreaterThan(1);
  await expect(bar).toContainText(`Poziom ${levelNow.level}`);
  const dataNow = (await meta()).data;
  expect(dataNow).toBeGreaterThan(0);
  await expect(bar).toContainText(String(dataNow));
  await shot('05-kryjowka-po-runie');

  // Warsztat: zakup najtańszej dostępnej pozycji.
  // CHEAT: nagroda za jeden run nie wystarcza na żadną pozycję, więc dodajemy Dane komendą debug.
  await command('meta data 500');
  await command('hub open workshop');
  const workshop = page.locator('.hub-screen [data-panel=workshop]');
  await expect(workshop).toBeVisible();
  // Odblokowania (moce, ostrza, sloty) mają własną kategorię; broń i dodatki kupuje się z kart sklepu.
  await workshop.locator('[data-action=tab][data-tab=unlocks]').click();
  const cheapest = await workshop.evaluate((node) => {
    const rows = [
      ...node.querySelectorAll<HTMLElement>(
        '[data-pane=unlocks] [data-unlock][data-status=buyable]',
      ),
    ].map((row) => ({
      id: row.dataset.unlock ?? '',
      cost: parseInt(
        row.querySelector('.workshop__cost')?.textContent ?? '0',
        10,
      ),
    }));
    rows.sort((a, b) => a.cost - b.cost);
    return rows[0]?.id ?? null;
  });
  expect(cheapest).not.toBeNull();
  await workshop
    .locator(`[data-unlock="${cheapest}"] [data-action=buy]`)
    .click();
  // Zakup wymaga potwierdzenia w oknie modalnym.
  await page.locator('dialog.ui-modal .ui-button--primary').click();
  await expect.poll(async () => (await meta()).unlocks).toContain(cheapest);
  await expect(workshop.locator(`[data-unlock="${cheapest}"]`)).toHaveAttribute(
    'data-status',
    'owned',
  );

  // Wybór w ekwipunku (broń lub moc), jeśli slot pozwala.
  const [kind, key] = (cheapest ?? ':').split(':');
  let equipped = false;
  if (kind === 'weapon' || kind === 'power') {
    const part = kind === 'weapon' ? 'weapons' : 'powers';
    await workshop.locator('[data-action=tab][data-tab=equipment]').click();
    const choice = workshop.locator(
      `[data-action=toggle][data-part=${part}][data-item="${key}"]`,
    );
    if (await choice.isEnabled()) {
      await choice.click();
      await expect(choice).toHaveAttribute('aria-pressed', 'true');
      equipped = true;
    }
  }
  await shot('07-warsztat');

  // Terminal drzewek: zakup korzenia (pierwszy dostępny węzeł).
  await page.keyboard.press('Escape'); // przycisk „Zamknij” bywa pod panelem debug lil-gui
  await command('hub open talents');
  const panel = page.locator('.hub-screen .talents-panel');
  await expect(panel).toBeVisible();
  const rootNode = panel.locator('.talents-node[data-state=available]').first();
  await expect(rootNode).toBeVisible();
  const rootId = await rootNode.getAttribute('data-node-id');
  await rootNode.click();
  await panel.locator('[data-action=buy-talent]').click();
  await expect.poll(async () => (await meta()).talents).toContain(rootId);
  await shot('06-talenty');
  await expect.poll(() => query('savePending')).not.toBe(true);

  // Odświeżenie: meta zachowane.
  const before = await meta();
  await page.reload();
  await waitHub();
  const after = await meta();
  expect(after.xp).toBe(before.xp);
  expect(after.data).toBe(before.data);
  expect(after.talents).toEqual(before.talents);
  expect(after.unlocks).toEqual(before.unlocks);
  expect(after.loadout).toEqual(before.loadout);
  expect(after.talents).toContain(rootId);
  expect(after.unlocks).toContain(cheapest);
  if (equipped && key)
    expect(
      kind === 'weapon' ? after.loadout.weapons : after.loadout.powers,
    ).toContain(key);
  const levelAfter = (await query('level')) as { level: number };
  expect(levelAfter.level).toBe(levelNow.level);

  // Kolejny run z tablicy misji niesie ekwipunek i talenty.
  await command('hub open missions');
  await page.getByLabel('Seed (opcjonalnie)').fill('meta-bot-2');
  await page.getByRole('button', { name: 'Rozpocznij run' }).click();
  await expect
    .poll(() => query('screen'), { timeout: LOAD_TIMEOUT })
    .toBe('map');
  const run = (await query('runState')) as {
    talents: string[];
    loadout: Loadout;
  };
  expect(run.talents).toContain(rootId);
  expect(run.loadout).toMatchObject(after.loadout);
  expect(errors).toEqual([]);
});
