import { expect, test, type Page } from '@playwright/test';
import type { MetaState } from '../../src/core/metaTypes';
import m01Level from '../../src/data/levels/m01-maszty.json' with { type: 'json' };
import achievements from '../../src/data/meta/achievements.json' with { type: 'json' };
import progression from '../../src/data/meta/progression.json' with { type: 'json' };
import m01 from '../../src/data/missions/m01-maszty.json' with { type: 'json' };
import m02 from '../../src/data/missions/m02-punkt-kontrolny.json' with { type: 'json' };
import m03 from '../../src/data/missions/m03-list-przewozowy.json' with { type: 'json' };
import m04 from '../../src/data/missions/m04-ladunek-klasy-k.json' with { type: 'json' };
import m05 from '../../src/data/missions/m05-adiutant.json' with { type: 'json' };
import m06 from '../../src/data/missions/m06-odlewnia.json' with { type: 'json' };
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

// Dozwolone console.error / pageerror. Każdy wpis wymaga nazwy i uzasadnienia;
// lista jest pusta, bo ścieżka dema nie zgłasza żadnego błędu.
const ALLOWED_ERRORS: { name: string; pattern: RegExp }[] = [];

type MissionState = {
  checkpointId: string;
  objectives: Record<string, string>;
  activeEncounters: string[];
  completedEncounters: string[];
  openGates: string[];
};
type FirstClear = { data: number; cores?: number };

// Start misji i powrót do kryjówki przeładowują stronę; odpytanie w trakcie
// nawigacji zwraca undefined zamiast wyjątku.
const query = (page: Page, key: string) =>
  page
    .evaluate((name) => window.__neoryder?.query(name), key)
    .catch(() => undefined);
const command = async (page: Page, line: string) => {
  const result = await page.evaluate(
    (text) => window.__neoryder?.command(text),
    line,
  );
  expect(result, `Komenda: ${line}`).toBeDefined();
  expect(result, `Komenda: ${line}`).not.toMatch(
    /Nieznana komenda|Błąd komendy|Użycie:/,
  );
  return result;
};
const poll = (page: Page, key: string, stage: string, timeout = SIM_TIMEOUT) =>
  expect.poll(() => query(page, key), {
    timeout,
    message: `utknięto na: ${stage}`,
  });
const mission = async (page: Page) =>
  ((await query(page, 'mission')) ?? {
    objectives: {},
    activeEncounters: [],
    completedEncounters: [],
    openGates: [],
  }) as MissionState;
const pollMission = (page: Page, stage: string, timeout = SIM_TIMEOUT) =>
  expect.poll(() => mission(page), {
    timeout,
    message: `utknięto na: ${stage}`,
  });

async function hub(page: Page) {
  await expect
    .poll(
      () => page.evaluate(() => window.__neoryder?.sceneId()).catch(() => null),
      { timeout: LOAD_TIMEOUT, message: 'utknięto na: kryjówka / ładowanie' },
    )
    .toBe('hub');
  await poll(page, 'meta', 'kryjówka / zapis', LOAD_TIMEOUT).toBeTruthy();
}

/** Tablica misji: status każdej misji dema musi wynikać z postępu kampanii. */
async function board(page: Page, statuses: Record<string, string>) {
  await command(page, 'hub open missions');
  await expect(page.locator('[data-mission-list]')).toBeVisible();
  for (const [id, status] of Object.entries(statuses)) {
    const choice = page.locator(`[data-mission="${id}"]`);
    if (status === 'Zablokowana') {
      await expect(choice).toBeDisabled();
      await expect(choice).toContainText(status);
    } else {
      await expect(choice).toBeEnabled();
      await expect(choice).not.toContainText(/Zablokowana|Wkrótce/);
      if (status) await expect(choice).toContainText(status);
    }
  }
}

/** Droga gracza: tablica → odprawa → „Rozpocznij misję” → scena `mission`. */
async function startMission(
  page: Page,
  id: string,
  statuses: Record<string, string>,
) {
  await board(page, statuses);
  await page.locator(`[data-mission="${id}"]`).click();
  await expect(page.locator('[data-mission-briefing]')).toBeVisible();
  await page.locator('.missions-panel__seed input').fill('demo-rc');
  await page
    .getByRole('button', { name: 'Rozpocznij misję', exact: true })
    .click();
  await poll(page, 'screen', `${id} / start`, LOAD_TIMEOUT).toBe('playing');
  await expect(page).toHaveURL(new RegExp(`scene=mission.*mission=${id}`));
  await command(page, 'god');
}

/** Wejście w strefę spotkania, usunięcie wrogów komendą debug, otwarcie bramy. */
async function clearEncounter(
  page: Page,
  id: string,
  x: number,
  gate: string | null,
) {
  if (gate) expect((await mission(page)).openGates).not.toContain(gate);
  await command(page, `tp ${x} 0 -90`);
  await expect
    .poll(async () => (await mission(page)).activeEncounters, {
      timeout: SIM_TIMEOUT,
      message: `utknięto na: spotkanie ${id} / start`,
    })
    .toContain(id);
  await command(page, 'encounter clear');
  await expect
    .poll(async () => (await mission(page)).completedEncounters, {
      timeout: SIM_TIMEOUT,
      message: `utknięto na: spotkanie ${id} / koniec`,
    })
    .toContain(id);
  if (gate) expect((await mission(page)).openGates).toContain(gate);
}

async function playM05(page: Page) {
  for (const [id, x, target, goal] of [
    ['tylna-straz', 50, 92, 'estakada'],
    ['tarcze-suwnic', 134, 180, 'suwnice'],
  ] as const) {
    await clearEncounter(page, id, x, null);
    await command(page, `tp ${target} 0 -90`);
    await pollMission(page, `M05 / ${goal}`).toMatchObject({
      objectives: { [goal]: 'done' },
    });
  }
  await command(page, 'tp 206 0 -90');
  await pollMission(page, 'M05 / lądowisko').toMatchObject({
    objectives: { ladowisko: 'done' },
  });
  await clearEncounter(page, 'snajperzy', 206, null);
  await clearEncounter(page, 'oslona-ladowiska', 218, null);
  await command(page, 'tp 240 0');
  await pollMission(page, 'M05 / karta').toMatchObject({
    objectives: { karta: 'done' },
  });
  await command(page, 'tp 248 -7');
}

async function playM01(page: Page) {
  for (const id of m01Level.objectiveOrder) {
    const position =
      m01Level.objectivePositions[
        id as keyof typeof m01Level.objectivePositions
      ];
    await command(page, `tp ${position.x} ${position.z} 0 0 ${position.y}`);
    await pollMission(page, `M01 / cel ${id}`).toMatchObject({
      objectives: { [id]: 'done' },
    });
  }
}

async function playM02(page: Page) {
  expect(await command(page, 'objective done exit')).toBe('Cel niedostępny.');
  for (const [id, x, gate] of [
    ['patrol-kordon', 190, 'gate-kordon'],
    ['rampa', 150, 'gate-plac'],
    ['straz-cel', 120, null],
  ] as const) {
    await command(page, `tp ${x} 0 90`);
    await expect
      .poll(async () => (await mission(page)).activeEncounters, {
        timeout: SIM_TIMEOUT,
        message: `utknięto na: M02 / spotkanie ${id}`,
      })
      .toContain(id);
    await command(page, 'encounter clear');
    if (gate) expect((await mission(page)).openGates).toContain(gate);
  }
  for (const [id, x, z, pursuit] of [
    ['cell-1', 116, -7, 'poscig-1'],
    ['cell-2', 94, 7, 'poscig-2'],
  ] as const) {
    await command(page, `tp ${x} ${z} 90`);
    await pollMission(page, `M02 / cel ${id}`).toMatchObject({
      objectives: { [id]: 'done' },
    });
    await expect
      .poll(async () => (await mission(page)).activeEncounters, {
        timeout: SIM_TIMEOUT,
        message: `utknięto na: M02 / pościg ${pursuit}`,
      })
      .toContain(pursuit);
    await command(page, 'encounter clear');
  }
  await expect
    .poll(async () => ((await query(page, 'allies')) as unknown[])?.length, {
      timeout: SIM_TIMEOUT,
      message: 'utknięto na: M02 / Nadia w drużynie',
    })
    .toBe(1);
  expect((await mission(page)).openGates).toContain('gate-sluza');
  await command(page, 'tp 76 0 90');
  await pollMission(page, 'M02 / punkt kontrolny zbiórka').toMatchObject({
    checkpointId: 'zbiorka',
  });
  await command(page, 'tp 66 0 90');
  await expect
    .poll(async () => (await mission(page)).activeEncounters, {
      timeout: SIM_TIMEOUT,
      message: 'utknięto na: M02 / osłona suwnicy',
    })
    .toContain('oslona-suwnicy');
  await command(page, 'encounter clear');
  await command(page, 'tp 61 -7 90');
  await pollMission(page, 'M02 / cel cell-3').toMatchObject({
    objectives: { 'cell-3': 'done' },
  });
  await expect
    .poll(async () => (await mission(page)).activeEncounters, {
      timeout: SIM_TIMEOUT,
      message: 'utknięto na: M02 / start Egzekutora',
    })
    .toContain('egzekutor');
  for (
    let i = 0;
    i < 10 && (await mission(page)).objectives.executor !== 'done';
    i++
  ) {
    await waitSimSteps(page, 120);
    await command(page, 'kill all');
  }
  await pollMission(page, 'M02 / Egzekutor').toMatchObject({
    objectives: { executor: 'done' },
  });
  expect((await mission(page)).openGates).toContain('gate-zachod');
  await command(page, 'tp 26 0 90');
  await pollMission(page, 'M02 / punkt kontrolny ewakuacja').toMatchObject({
    checkpointId: 'ewakuacja',
  });
  await command(page, 'tp 8 0 90');
}

async function playM03(page: Page) {
  for (const [id, x, gate] of [
    ['patrol-nabrzeze', 40, 'gate-patrol-nabrzeze'],
    ['oslona-celna', 92, 'gate-oslona-celna'],
    ['posterunek-magazynu', 141, 'gate-magazyn'],
    ['pierwsza-zmiana', 201, null],
  ] as const)
    await clearEncounter(page, id, x, gate);

  // Obrona terminala: gracz stoi w strefie przez pełny transfer (2 s + 90 s
  // symulacji, przyspieszone skalą czasu), a progi 25/55/85% wzywają posiłki.
  expect(await command(page, 'objective done exit')).toBe('Cel niedostępny.');
  await command(page, 'timescale 4');
  await expect
    .poll(
      async () => {
        const state = await mission(page);
        if (state.activeEncounters.length > 0)
          await command(page, 'encounter clear');
        return state.objectives.terminal;
      },
      { timeout: 4 * SIM_TIMEOUT, message: 'utknięto na: M03 / transfer' },
    )
    .toBe('done');
  await command(page, 'timescale 1');
  // Ostatnie posiłki i pościg mogą jeszcze trwać w chwili ukończenia transferu.
  await command(page, 'encounter clear');
  const afterTransfer = await mission(page);
  expect(afterTransfer.completedEncounters).toEqual(
    expect.arrayContaining(['transfer-1', 'transfer-2', 'transfer-3']),
  );
  expect(afterTransfer.openGates).toContain('gate-dok');

  await command(page, 'tp 230 0 -90');
  await pollMission(page, 'M03 / punkt kontrolny dok').toMatchObject({
    checkpointId: 'dok',
  });
  await command(page, 'tp 244 -12.6 0');
}

async function playM04(page: Page) {
  for (const id of ['barricade', 'laser', 'switch-1', 'carts', 'switch-2'])
    expect(await command(page, `objective done ${id}`)).toBe('Cel ukończony.');
  await command(page, 'tp 180 4 -90');
  await expect
    .poll(async () => (await mission(page)).activeEncounters, {
      timeout: SIM_TIMEOUT,
    })
    .toContain('executor');
  for (
    let i = 0;
    i < 8 && (await mission(page)).objectives.executor !== 'done';
    i++
  ) {
    await waitSimSteps(page, 60);
    await command(page, 'kill all');
  }
  await pollMission(page, 'M04 / Egzekutor').toMatchObject({
    objectives: { executor: 'done' },
  });
  for (let i = 0; i < 7; i++) await command(page, 'payload skip');
  await pollMission(page, 'M04 / wagon').toMatchObject({
    objectives: { payload: 'done' },
  });
  expect(await command(page, 'objective done exit')).toBe('Cel ukończony.');
}

async function playM06(page: Page) {
  for (const [id, x, gate] of [
    ['patrol-sluza', 14, 'gate-sluza'],
    ['piece', 44, 'gate-piece'],
    ['formowanie-front', 92, null],
    ['formowanie-tyl', 113, 'gate-formowanie'],
    ['straz', 143, 'gate-sztab'],
  ] as const)
    await clearEncounter(page, id, x, gate);
  await command(page, 'tp 167 0 -90');
  await pollMission(page, 'M06 / punkt kontrolny przed areną').toMatchObject({
    checkpointId: 'przed-arena',
  });

  // Arena: wrota zamykają się za graczem, Brandt ginie przez system obrażeń
  // (trzy fazy), dopiero potem otwiera się gabinet z serwerem.
  await command(page, 'tp 185 0 -90');
  await pollMission(page, 'M06 / start areny').toMatchObject({
    activeEncounters: ['brandt'],
  });
  expect((await mission(page)).openGates).not.toContain('gate-sztab');
  await poll(page, 'enemies', 'M06 / wejście Brandta').toBe(1);
  await expect(page.locator('.run-hud__boss')).toBeVisible();
  await expect
    .poll(
      async () => {
        const state = await mission(page);
        if (state.objectives.brandt !== 'done') {
          await command(page, 'kill all');
          await waitSimSteps(page, 75);
        }
        return state.objectives.brandt;
      },
      { timeout: SIM_TIMEOUT, message: 'utknięto na: M06 / walka z Brandtem' },
    )
    .toBe('done');
  await pollMission(page, 'M06 / po Brandcie').toMatchObject({
    objectives: { server: 'pending' },
    activeEncounters: [],
    checkpointId: 'po-brandcie',
  });
  await expect(page.locator('.run-hud__boss')).toBeHidden();
  expect((await mission(page)).openGates).not.toContain('gate-winda');

  // Serwer w gabinecie odblokowuje windę towarową.
  await command(page, 'tp 224 -6 0');
  await pollMission(page, 'M06 / serwer').toMatchObject({
    objectives: { server: 'done' },
  });
  expect((await mission(page)).openGates).toContain('gate-winda');
  await command(page, 'tp 216 -11.5 0');
}

/**
 * Podsumowanie → kryjówka → debrief → reload. Zwraca stan meta, który musi
 * przetrwać odświeżenie w całości (kampania, waluty, rozliczenia, naszywki).
 */
async function settleAndReload(
  page: Page,
  missionId: string,
  completed: string[],
) {
  await expect(page.locator('[data-mission-summary]')).toBeVisible({
    timeout: LOAD_TIMEOUT,
  });
  expect(await query(page, 'saveError')).toBeNull();
  await page
    .getByRole('button', { name: 'Wróć do kryjówki', exact: true })
    .click();
  await hub(page);
  await expect(
    page.locator(`[data-mission-debrief="${missionId}"]`),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Zakończ rozmowę', exact: true })
    .click();
  // Okno znika dopiero po zapisie meta; przeładowanie wcześniej gubi wyczyszczony debrief.
  await expect(page.locator('[data-mission-debrief]')).toBeHidden({
    timeout: LOAD_TIMEOUT,
  });
  await poll(page, 'meta', `${missionId} / rozliczenie`).toMatchObject({
    campaign: { completed, pendingDebrief: null },
  });
  const settled = (await query(page, 'meta')) as MetaState;
  await page.reload();
  await hub(page);
  await poll(page, 'meta', `${missionId} / reload`, LOAD_TIMEOUT).toEqual(
    settled,
  );
  await expect(page.locator('[data-mission-debrief]')).toHaveCount(0);
  return settled;
}

/**
 * Reguła z docs/systems/missions.md: pierwsze ukończenie = zwykłe nagrody runu
 * + firstClear, powtórka = same zwykłe nagrody. Naszywki rozliczane są osobno.
 */
function expectRewards(
  before: MetaState,
  after: MetaState,
  firstClear: FirstClear | null,
) {
  const rules = progression.rewards;
  const run = after.lastRuns[0]!.rewards;
  expect(run).toEqual({
    xp: rules.xpVictory,
    data: rules.dataVictory + (firstClear?.data ?? 0),
    cores: rules.coresVictory + (firstClear?.cores ?? 0),
  });
  const badges = achievements.filter(
    (badge) =>
      after.achievements.unlocked.includes(badge.id) &&
      !before.achievements.unlocked.includes(badge.id),
  );
  const badgeSum = (key: 'data' | 'cores') =>
    badges.reduce((sum, badge) => sum + (badge.reward[key] ?? 0), 0);
  expect(after.xp - before.xp).toBe(run.xp);
  expect(after.data - before.data).toBe(run.data + badgeSum('data'));
  expect(after.cores - before.cores).toBe(run.cores + badgeSum('cores'));
  expect(after.appliedRunIds).toHaveLength(before.appliedRunIds.length + 1);
  expect(new Set(after.appliedRunIds).size).toBe(after.appliedRunIds.length);
  return { run, badges: badges.map((badge) => badge.id) };
}

async function tutorial(page: Page) {
  const step = (number: number) =>
    poll(page, 'tutorialStep', `samouczek / krok ${number}`).toBe(number);
  await step(1);
  await command(page, 'tp 0 8 0 0 0');
  await step(2);
  // Krótkie naciśnięcie może wypaść między klatkami wolnego GPU; ćwiczenie
  // jest wtedy powtarzane od pozycji startowej.
  await expect
    .poll(
      async () => {
        if ((await query(page, 'tutorialStep')) !== 2) return true;
        await command(page, 'tp 0 6 0 0 0');
        await waitSimSteps(page, 10);
        await page.keyboard.press('Space');
        await waitSimSteps(page, 3);
        await page.keyboard.press('Space');
        await command(page, 'tp 0 3 0 0 2.4');
        await waitSimSteps(page, 30);
        return false;
      },
      {
        timeout: SIM_TIMEOUT,
        intervals: [1],
        message: 'utknięto na: samouczek / podwójny skok',
      },
    )
    .toBe(true);
  await step(3);
  await command(page, 'timescale 0.1');
  await command(page, 'tp 0 1 0 0 0');
  await waitSimSteps(page, 10);
  await page.keyboard.press('KeyQ');
  await waitSimSteps(page, 300);
  await command(page, 'tp 0 1 0 0 0');
  await waitSimSteps(page, 30);
  await page.keyboard.down('KeyW');
  await page.keyboard.down('ShiftLeft');
  await expect
    .poll(async () => ((await query(page, 'playerPos')) as { z: number }).z, {
      timeout: SIM_TIMEOUT,
      intervals: [50],
      message: 'utknięto na: samouczek / rozbieg do ślizgu',
    })
    .toBeLessThan(0);
  await page.keyboard.down('ControlLeft');
  await step(4);
  await page.keyboard.up('ControlLeft');
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('KeyW');
  await command(page, 'tp -6 -6 0 0 0');
  await command(page, 'timescale 0.1');
  // Krótkie kliknięcia; kolejne próby są ograniczone limitem celu.
  await expect
    .poll(
      async () => {
        if ((await query(page, 'tutorialStep')) !== 4) return true;
        await page.evaluate(() => {
          const canvas = document.querySelector(
            '[aria-label="Scena NEORYDER"]',
          )!;
          canvas.dispatchEvent(
            new MouseEvent('mousedown', { button: 0, bubbles: true }),
          );
          canvas.dispatchEvent(
            new MouseEvent('mouseup', { button: 0, bubbles: true }),
          );
        });
        await waitSimSteps(page, 12);
        return false;
      },
      {
        timeout: SIM_TIMEOUT,
        intervals: [1],
        message: 'utknięto na: samouczek / combo',
      },
    )
    .toBe(true);
  await step(5);
  await command(page, 'timescale 1');
  await command(page, 'tp -6 -6 0 0 0');
  await page
    .getByLabel('Scena NEORYDER', { exact: true })
    .dispatchEvent('mousedown', { button: 0 });
  await waitSimSteps(page, 75);
  await page
    .getByLabel('Scena NEORYDER', { exact: true })
    .dispatchEvent('mouseup', { button: 0 });
  await step(6);
  await command(page, 'timescale 0.1');
  await command(page, 'tp 0 -7 0 0 0');
  await expect
    .poll(
      async () => {
        if ((await query(page, 'tutorialStep')) !== 6) return true;
        await page
          .getByLabel('Scena NEORYDER', { exact: true })
          .dispatchEvent('mousedown', { button: 2 });
        await waitSimSteps(page, 3);
        await page
          .getByLabel('Scena NEORYDER', { exact: true })
          .dispatchEvent('mouseup', { button: 2 });
        await waitSimSteps(page, 2);
        return false;
      },
      {
        // Przy timescale 0.1 pociski lecą co 16 s czasu ściennego.
        // Zapas pozwala ponowić rzeczywisty blok po nietrafionym oknie.
        timeout: 3 * SIM_TIMEOUT,
        intervals: [1],
        message: 'utknięto na: samouczek / parowanie',
      },
    )
    .toBe(true);
  await step(7);
  await command(page, 'timescale 1');
  await page.keyboard.press('KeyR');
  await waitSimSteps(page, 30);
  await page
    .getByLabel('Scena NEORYDER', { exact: true })
    .dispatchEvent('mousedown', { button: 0 });
  await poll(page, 'heat', 'samouczek / przegrzanie').toBeGreaterThanOrEqual(
    100,
  );
  await page
    .getByLabel('Scena NEORYDER', { exact: true })
    .dispatchEvent('mouseup', { button: 0 });
  await step(8);
  await command(page, 'tp 6 -8 0 0 0');
  await page.keyboard.press('KeyF');
  await step(9);
  await command(page, 'tp 6 -8 0 0 0');
  await page
    .getByLabel('Scena NEORYDER', { exact: true })
    .dispatchEvent('mousedown', { button: 0 });
  await waitSimSteps(page, 1);
  await page
    .getByLabel('Scena NEORYDER', { exact: true })
    .dispatchEvent('mouseup', { button: 0 });
  await step(10);
  await command(page, 'god');
  await expect
    .poll(
      async () => {
        await command(page, 'kill all');
        return query(page, 'tutorialComplete');
      },
      { timeout: SIM_TIMEOUT, message: 'utknięto na: samouczek / walka' },
    )
    .toBe(true);
  await expect(
    page.getByRole('heading', { name: 'Samouczek ukończony' }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem('neoryder.tutorialDone')),
  ).toBe('1');
  await page.getByRole('button', { name: 'Do kryjówki', exact: true }).click();
  await hub(page);
}

test('S10-02: całe demo na jednym zapisie', async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(1_200_000);
  const errors: string[] = [];
  const timings: Record<string, number> = {};
  const settlements: Record<string, unknown> = {};
  // Menu gubi seed w nawigacji. Normalizacja wyłącznie parametru URL
  // zachowuje deterministyczny RNG również w samouczku i kryjówce.
  await context.addInitScript(() => {
    if (location.protocol !== 'http:') return;
    const url = new URL(location.href);
    if (!url.searchParams.has('seed')) {
      url.searchParams.set('seed', 'demo-rc');
      history.replaceState(null, '', url);
    }
  });
  const report = (text: string) => {
    if (!ALLOWED_ERRORS.some((allowed) => allowed.pattern.test(text)))
      errors.push(text);
  };
  page.on('console', (message) => {
    if (message.type() === 'error') report(`console.error: ${message.text()}`);
  });
  page.on('pageerror', (error) => report(`pageerror: ${error.message}`));
  const stage = (name: string, action: () => Promise<void>) =>
    test.step(name, async () => {
      const started = Date.now();
      try {
        await action();
      } finally {
        timings[name] = (Date.now() - started) / 1000;
      }
    });

  const missions = [
    { definition: m01, play: playM01 },
    { definition: m02, play: playM02 },
    { definition: m03, play: playM03 },
    { definition: m04, play: playM04 },
    { definition: m05, play: playM05 },
    { definition: m06, play: playM06 },
  ];
  const completed: string[] = [];
  const boardStatuses = () =>
    Object.fromEntries(
      missions.map(({ definition }) => [
        definition.id,
        completed.includes(definition.id)
          ? 'Ukończona'
          : definition.requires.every((id) => completed.includes(id))
            ? ''
            : 'Zablokowana',
      ]),
    );

  try {
    await stage('czysty zapis / menu', async () => {
      expect((await context.storageState({ indexedDB: true })).origins).toEqual(
        [],
      );
      await page.goto('/?seed=demo-rc&debug=1&fx=lite');
      await page
        .getByRole('button', { name: 'Samouczek', exact: true })
        .click();
    });
    await stage('samouczek', () => tutorial(page));
    let meta = (await query(page, 'meta')) as MetaState;
    expect(meta.campaign.completed).toEqual([]);

    for (const pass of ['pierwsze ukończenie', 'powtórka'] as const)
      for (const { definition, play } of missions)
        await stage(`${definition.id} / ${pass} i reload`, async () => {
          const first = pass === 'pierwsze ukończenie';
          await startMission(page, definition.id, boardStatuses());
          await play(page);
          if (first) completed.push(definition.id);
          const after = await settleAndReload(page, definition.id, completed);
          settlements[`${definition.id} / ${pass}`] = {
            ...expectRewards(
              meta,
              after,
              first ? definition.rewards.firstClear : null,
            ),
            stan: { xp: after.xp, data: after.data, cores: after.cores },
          };
          meta = after;
        });

    await stage('koniec kampanii / tablica', async () => {
      expect(meta.campaign).toMatchObject({
        completed: [m01.id, m02.id, m03.id, m04.id, m05.id, m06.id],
        pendingDebrief: null,
      });
      await board(page, boardStatuses());
    });
  } finally {
    for (const [name, body] of Object.entries({
      'demo-rc-etapy': timings,
      'demo-rc-nagrody': settlements,
      'demo-rc-bledy': errors,
    }))
      await testInfo.attach(name, {
        body: JSON.stringify(body, null, 2),
        contentType: 'application/json',
      });
    console.log(`demo-rc / etapy [s]: ${JSON.stringify(timings)}`);
    console.log(`demo-rc / nagrody: ${JSON.stringify(settlements)}`);
    expect(errors, 'console.error / pageerror z całej ścieżki').toEqual([]);
  }
});
