import hideout from '../../src/data/hub/hideout.json' with { type: 'json' };
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { LOAD_TIMEOUT, SIM_TIMEOUT, waitSimSteps } from './helpers';

// Panel debug lil-gui (dev) zasłania prawy dolny róg; ekrany stacji mają tam przyciski.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '.lil-gui { display: none !important; }';
      document.head.append(style);
    });
  });
});

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}
const query = (page: Page, name: string) =>
  page.evaluate((n) => window.__neoryder?.query(n), name);
const command = (page: Page, line: string) =>
  page.evaluate((l) => window.__neoryder?.command(l), line);
const openHub = async (page: Page, extra = '') => {
  await page.goto(`/?scene=hub&debug=1&fx=lite&seed=hub-e2e${extra}`);
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('hub');
  await waitSimSteps(page, 5);
};

test('hub: świeży zapis prowadzi do Tablicy misji i chowa przewodnik przy nakładkach', async ({
  page,
}) => {
  await openHub(page);
  const guide = page.locator('[data-hub-guide][data-target="missions"]');
  await expect(guide).toBeVisible();
  await expect(guide).toContainText('Tablica misji');
  await command(page, 'hub open missions');
  await expect(guide).toBeHidden();
  await page.keyboard.press('Escape'); // przycisk „Zamknij” bywa pod panelem debug lil-gui
  await expect(guide).toBeVisible();
  await command(page, 'hub map');
  await expect(guide).toBeHidden();
  await command(page, 'hub map');
  await expect(guide).toBeVisible();
  const station = hideout.stations.find(({ id }) => id === 'missions')!;
  await command(page, `hub tp ${station.position.x} ${station.position.z}`);
  await expect(guide).toBeHidden();
});

test('hub: odblokowane otoczenie i wymuszony przejazd nie zgłaszają błędów Web Audio', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await openHub(page);
  await page.keyboard.press('KeyG');
  await expect.poll(() => query(page, 'audioState')).toBe('running');
  await expect
    .poll(async () => ((await query(page, 'hubAmbience')) as unknown[]).length)
    .toBeGreaterThan(0);
  const sources = (await query(page, 'hubAmbience')) as {
    kind: string;
    gain: number;
  }[];
  expect(sources.length).toBeLessThanOrEqual(8);
  expect(sources.every((s) => typeof s.kind === 'string' && s.gain > 0)).toBe(
    true,
  );
  expect(await command(page, 'hub train')).toContain('Pociąg');
  await waitSimSteps(page, 250);
  expect(errors).toEqual([]);
});

test('menu → Kryjówka → scena hub startuje bez błędów konsoli', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Kryjówka' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Nowy run (presety)' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Kryjówka' }).click();
  await expect(page).toHaveURL(/scene=hub/);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('.hint')).toContainText('hub', {
    timeout: LOAD_TIMEOUT,
  });
  await expect(page.locator('.hub-screen')).toBeHidden();
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

test('hub: hub open missions pokazuje nakładkę, Zamknij ją chowa, a Rozpocznij run startuje run', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await openHub(page);
  expect(await query(page, 'hubStation')).toBeNull();
  await command(page, 'hub open missions');
  expect(await query(page, 'hubStation')).toBe('missions');
  await expect(page.locator('.hub-screen')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Tablica misji' }),
  ).toBeVisible();
  await page.keyboard.press('Escape'); // przycisk „Zamknij” bywa pod panelem debug lil-gui
  await expect(page.locator('.hub-screen')).toBeHidden();
  expect(await query(page, 'hubStation')).toBeNull();
  await command(page, 'hub open missions');
  // RunScene po zapisie na mapie podmienia URL na `continue=1`, więc adres startu sprawdzamy w chwili nawigacji.
  const started = page.waitForURL(
    (url) =>
      url.searchParams.get('scene') === 'run' &&
      url.searchParams.get('loadout') === 'meta' &&
      url.searchParams.get('debug') === '1',
    { waitUntil: 'commit' },
  );
  await page.getByRole('button', { name: 'Rozpocznij run' }).click();
  await started;
  await expect(page.getByRole('heading', { name: 'Mapa sektora' })).toBeVisible(
    { timeout: LOAD_TIMEOUT },
  );
  expect(errors).toEqual([]);
});

test('hub: pasek meta pokazuje poziom i odświeża się po komendzie meta', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await openHub(page);
  const bar = page.locator('.meta-bar');
  await expect(bar).toBeVisible();
  await expect(bar).toContainText('Poziom 1');
  await expect(bar).toContainText('Punkty talentów: 0');
  await command(page, 'meta xp 500');
  await expect(bar).not.toContainText('Punkty talentów: 0');
  const level = (await query(page, 'level')) as { level: number };
  expect(level.level).toBeGreaterThan(1);
  await expect(bar).toContainText(`Poziom ${level.level}`);
  expect(errors).toEqual([]);
});

test('hub: tablica misji → wybór Poziomu zagrożenia → Rozpocznij run startuje run z tym poziomem i ekwipunkiem meta', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await openHub(page);
  await command(page, 'meta threat 2');
  await command(page, 'hub open missions');
  await expect(page.getByText('Kurogane Arms')).toBeVisible();
  await expect(page.locator('[data-level="3"]')).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await page.locator('[data-level="2"]').click();
  await expect(page.locator('[data-level="2"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByLabel('Seed (opcjonalnie)').fill('missions-e2e');
  const started = page.waitForURL(
    (url) =>
      url.searchParams.get('loadout') === 'meta' &&
      url.searchParams.get('seed') === 'missions-e2e' &&
      url.searchParams.get('debug') === '1',
    { waitUntil: 'commit' },
  );
  await page.getByRole('button', { name: 'Rozpocznij run' }).click();
  await started;
  await expect(page.getByRole('heading', { name: 'Mapa sektora' })).toBeVisible(
    { timeout: LOAD_TIMEOUT },
  );
  const run = (await query(page, 'runState')) as {
    threatLevel: number;
    loadout: { id: string };
  };
  expect(run.threatLevel).toBe(2);
  expect(run.loadout.id).toBe('custom');
  expect(errors).toEqual([]);
});

test('hub: stacje talents i workshop montują panele w nakładce', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await openHub(page);
  await command(page, 'hub open workshop');
  await expect(page.locator('.hub-screen [data-panel=workshop]')).toBeVisible();
  await page.keyboard.press('Escape'); // przycisk „Zamknij” bywa pod panelem debug lil-gui
  await expect(page.locator('.hub-screen')).toBeHidden();
  await command(page, 'hub open talents');
  await expect(page.locator('.hub-screen .talents-panel')).toBeVisible();
  expect(errors).toEqual([]);
});

test('hub: spojrzenie w zasięgu pokazuje podpowiedź, E otwiera, Esc zamyka bez wychodzenia ze strefy', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await openHub(page);
  await command(page, 'hub tp 14.05 13.6 0');
  await waitSimSteps(page, 5);
  expect(await query(page, 'hubFocus')).toBeNull();
  expect(await query(page, 'hubStation')).toBeNull();
  await expect(page.locator('.hub-prompt')).toBeHidden();
  await page.keyboard.press('KeyE');
  await waitSimSteps(page, 5);
  expect(await query(page, 'hubStation')).toBeNull();
  await command(page, 'hub look talents');
  await expect
    .poll(() => query(page, 'hubFocus'), { timeout: SIM_TIMEOUT })
    .toBe('talents');
  const prompt = page.locator('.hub-prompt');
  await expect(prompt).toBeVisible();
  await expect(prompt.locator('kbd')).toHaveText('E');
  await expect(prompt).toContainText('TALENTY');
  expect(await query(page, 'hubStation')).toBeNull();
  await page.keyboard.press('KeyE');
  await expect(
    page.getByRole('heading', { name: 'Terminal drzewek' }),
  ).toBeVisible();
  expect(await query(page, 'hubStation')).toBe('talents');
  await expect(prompt).toBeHidden();
  await page.keyboard.press('KeyE');
  expect(await query(page, 'hubStation')).toBe('talents');
  await page.keyboard.press('Escape');
  await expect(page.locator('.hub-screen')).toBeHidden();
  expect(await query(page, 'hubStation')).toBeNull();
  // Utrata pointer lock po Esc może ponownie włączyć pauzę; gracz wznawia kliknięciem sceny.
  await page.mouse.click(640, 360);
  await waitSimSteps(page, 30);
  expect(await query(page, 'hubStation')).toBeNull();
  await expect(prompt).toBeVisible();
  await page.keyboard.press('KeyE');
  await expect
    .poll(() => query(page, 'hubStation'), { timeout: SIM_TIMEOUT })
    .toBe('talents');
  expect(errors).toEqual([]);
});

test('hub: stacja arena przechodzi na poligon', async ({ page }) => {
  const errors = collectErrors(page);
  await openHub(page);
  await command(page, 'hub open arena');
  await expect(page.getByRole('heading', { name: 'Poligon' })).toBeVisible();
  await page.getByRole('button', { name: 'Przejdź na poligon' }).click();
  await expect(page).toHaveURL(/scene=arena/);
  await expect(page).toHaveURL(/debug=1/);
  expect(errors).toEqual([]);
});

for (const station of hideout.stations) {
  test(`hub: ze strefy stacji ${station.id} podpowiedź i E działają`, async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await openHub(page);
    await command(page, `hub tp ${station.position.x} ${station.position.z}`);
    await command(page, `hub look ${station.id}`);
    await expect
      .poll(() => query(page, 'hubFocus'), { timeout: SIM_TIMEOUT })
      .toBe(station.id);
    await expect(page.locator('.hub-prompt')).toBeVisible();
    await expect(page.locator('.hub-prompt')).toContainText(station.label);
    await page.keyboard.press('KeyE');
    await expect
      .poll(() => query(page, 'hubStation'), { timeout: SIM_TIMEOUT })
      .toBe(station.id);
    await expect(page.locator('.hub-screen')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('hub: NPC (pięć kluczowych postaci i mieszkańcy), spojrzenie pokazuje „Porozmawiaj” z imieniem, E daje kolejne kwestie i dymek znika po odejściu', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await openHub(page);
  const npcs = (await query(page, 'npcs')) as {
    id: string;
    x: number;
    z: number;
  }[];
  const ids = npcs.map((npc) => npc.id);
  expect(ids).toHaveLength(23);
  expect(ids).toEqual(
    expect.arrayContaining(['bajt', 'mira', 'szron', 'tomasz', 'wolan']),
  );
  const mira = npcs.find((npc) => npc.id === 'mira')!;
  await command(page, `hub tp ${mira.x - 1.6} ${mira.z - 0.4}`);
  await command(page, 'hub look mira');
  await expect
    .poll(() => query(page, 'hubNpc'), { timeout: SIM_TIMEOUT })
    .toBe('mira');
  const prompt = page.locator('.hub-prompt');
  await expect(prompt).toBeVisible();
  await expect(prompt).toContainText('Porozmawiaj');
  await expect(prompt).toHaveAttribute('aria-label', 'Mira');
  const dialog = page.locator('.hub-dialog');
  await expect(dialog).toBeHidden();
  await page.keyboard.press('KeyE');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.hub-dialog__name')).toHaveText('Mira');
  const first = await dialog.locator('.hub-dialog__line').textContent();
  await waitSimSteps(page, 5);
  await page.keyboard.press('KeyE');
  await expect
    .poll(() => dialog.locator('.hub-dialog__line').textContent())
    .not.toBe(first);
  expect(await query(page, 'hubStation')).toBeNull();
  await command(page, 'hub tp 0 0.8');
  await expect(dialog).toBeHidden({ timeout: SIM_TIMEOUT });
  expect(await command(page, 'hub talk szron')).toContain('Kapitan Szron');
  await expect(dialog).toBeVisible();
  expect(errors).toEqual([]);
});

test('hub: hub map pokazuje i chowa plan stacji', async ({ page }) => {
  const errors = collectErrors(page);
  await openHub(page);
  const map = page.getByRole('dialog', { name: 'Plan stacji Kamienna' });
  await expect(map).toBeHidden();
  await command(page, 'hub map');
  await expect(map).toBeVisible();
  await expect(map.getByRole('heading')).toHaveText('Plan stacji Kamienna');
  expect(await query(page, 'hubMap')).toEqual({ open: true });
  await command(page, 'hub map');
  await expect(map).toBeHidden();
  expect(await query(page, 'hubMap')).toEqual({ open: false });
  expect(errors).toEqual([]);
});

test('hub: hub sit <id> siada, hub stand wstaje', async ({ page }) => {
  const errors = collectErrors(page);
  await openHub(page);
  expect(await query(page, 'hubSeat')).toBeNull();
  await command(page, 'hub tp -16.1 -11.4');
  await command(page, 'hub sit seat_canteen_bench');
  expect(await query(page, 'hubSeat')).toBe('seat_canteen_bench');
  await waitSimSteps(page, 30);
  await command(page, 'hub stand');
  expect(await query(page, 'hubSeat')).toBeNull();
  expect(errors).toEqual([]);
});

test('hub: ?campaign= zmienia pozycję Szrona i komenda arrive mission działa', async ({
  page,
}) => {
  const errors = collectErrors(page);
  type Npc = { id: string; x: number; z: number };
  const szron = async () =>
    ((await query(page, 'npcs')) as Npc[]).find((n) => n.id === 'szron')!;
  await openHub(page);
  const before = await szron();
  await page.goto(
    '/?scene=hub&debug=1&fx=lite&seed=hub-e2e&campaign=m01-maszty,m06-odlewnia',
  );
  await expect
    .poll(() => page.evaluate(() => window.__neoryder?.sceneId()), {
      timeout: LOAD_TIMEOUT,
    })
    .toBe('hub');
  await waitSimSteps(page, 5);
  const after = await szron();
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(
    0.5,
  );
  expect(await command(page, 'hub arrive mission m06-odlewnia')).toContain(
    'm06-odlewnia',
  );
  expect(await command(page, 'hub arrive mission nieznana')).toContain(
    'Użycie',
  );
  expect(errors).toEqual([]);
});
