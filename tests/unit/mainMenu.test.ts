// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { MainMenu } from '../../src/ui/mainMenu';
import { createMemorySaveStore, SAVE_VERSION } from '../../src/core/save';
import { EventBus } from '../../src/core/events';
import { RunManager } from '../../src/world/run';
import { generateSectorMap } from '../../src/world/sectorMap';
import { kuroganeSector } from '../../src/world/sectors';
import { createStarterMetaState } from '../../src/progression/progressionSchema';

const active: MainMenu[] = [];
afterEach(() => {
  active.splice(0).forEach((menu) => menu.dispose());
  document.body.replaceChildren();
});
const label = (b: Element) => b.getAttribute('aria-label') ?? b.textContent;
const button = (text: string) =>
  [...document.querySelectorAll('button')].find((b) => label(b) === text)!;
/** Tryby (Poligon, Arena wyzwań, Wyzwanie dnia, Nieskończona strefa) są w podmenu. */
const mode = (text: string) => {
  if (document.querySelector<HTMLElement>('.main-menu__modes')!.hidden)
    button('Tryby').click();
  return button(text);
};

it('Kryjówka prowadzi do sceny hub, Kontynuuj run jest nieaktywne podczas odczytu i bez zapisu, Poligon do areny', async () => {
  const navigate = vi.fn();
  const menu = new MainMenu({
    root: document.body,
    save: createMemorySaveStore(),
    navigate,
  });
  active.push(menu);
  expect(button('Kontynuuj run').disabled).toBe(true);
  await menu.ready;
  button('Kontynuuj run').click();
  expect(navigate).not.toHaveBeenCalled();
  button('Kryjówka').click();
  expect(navigate).toHaveBeenLastCalledWith('?scene=hub');
  mode('Poligon').click();
  expect(navigate).toHaveBeenLastCalledWith('?scene=arena');
  expect(navigate).toHaveBeenCalledTimes(2);
});

it('bez debug menu nie pokazuje Nowy run (presety), seeda ani wyboru buildu', async () => {
  const menu = new MainMenu({
    root: document.body,
    save: createMemorySaveStore(),
  });
  active.push(menu);
  await menu.ready;
  const visible = () =>
    [...document.querySelectorAll('button')]
      .filter((b) => !b.closest('[hidden]'))
      .map(label);
  // Nowa hierarchia: główna akcja, Tryby jako podmenu, Ustawienia, mniejszy Samouczek.
  expect(visible()).toEqual([
    'Kryjówka',
    'Kontynuuj run',
    'Tryby',
    'Ustawienia',
    'Samouczek',
  ]);
  button('Tryby').click();
  expect(visible()).toEqual([
    'Poligon',
    'Arena wyzwań',
    'Wyzwanie dnia',
    'Nieskończona strefa',
    'Wróć',
  ]);
  expect(document.querySelector('input')).toBeNull();
  expect(document.querySelector('.build-select')).toBeNull();
});

it('w debug Kryjówka i Poligon zachowują debug w URL', async () => {
  const navigate = vi.fn();
  const menu = new MainMenu({
    root: document.body,
    save: createMemorySaveStore(),
    navigate,
    params: new URLSearchParams('debug=1'),
  });
  active.push(menu);
  await menu.ready;
  button('Kryjówka').click();
  expect(navigate).toHaveBeenLastCalledWith('?scene=hub&debug=1');
  mode('Poligon').click();
  expect(navigate).toHaveBeenLastCalledWith('?scene=arena&debug=1');
  mode('Wyzwanie dnia').click();
  expect(navigate).toHaveBeenLastCalledWith('?debug=1&daily=1');
  mode('Nieskończona strefa').click();
  expect(navigate).toHaveBeenLastCalledWith('?scene=endless&debug=1');
});

it('w debug pojawia się przycisk Sceny debug prowadzący do ?scenes=1 (z debug=1 z URL)', async () => {
  const navigate = vi.fn();
  const menu = new MainMenu({
    root: document.body,
    save: createMemorySaveStore(),
    navigate,
    params: new URLSearchParams('debug=1'),
  });
  active.push(menu);
  await menu.ready;
  button('Sceny debug').click();
  expect(navigate).toHaveBeenLastCalledWith('?scenes=1&debug=1');
});

it('bez debug nie ma przycisku Sceny debug, a opcja debug (tryb dev) go włącza bez debug w URL', async () => {
  const plain = new MainMenu({
    root: document.body,
    save: createMemorySaveStore(),
  });
  active.push(plain);
  await plain.ready;
  expect(
    [...document.querySelectorAll('button')].some(
      (b) => b.textContent === 'Sceny debug',
    ),
  ).toBe(false);
  plain.dispose();
  const navigate = vi.fn();
  const dev = new MainMenu({
    root: document.body,
    save: createMemorySaveStore(),
    navigate,
    debug: true,
  });
  active.push(dev);
  await dev.ready;
  button('Sceny debug').click();
  expect(navigate).toHaveBeenLastCalledWith('?scenes=1');
  button('Kryjówka').click();
  expect(navigate).toHaveBeenLastCalledWith('?scene=hub');
});

it('Esc zamyka podmenu Tryby i przywraca fokus na przycisku Tryby', async () => {
  const menu = new MainMenu({
    root: document.body,
    save: createMemorySaveStore(),
  });
  active.push(menu);
  await menu.ready;
  const tryby = button('Tryby');
  tryby.focus();
  tryby.click();
  expect(document.querySelector<HTMLElement>('.main-menu__modes')!.hidden).toBe(
    false,
  );
  expect(document.activeElement).toBe(button('Poligon'));
  document.activeElement!.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    }),
  );
  expect(document.querySelector<HTMLElement>('.main-menu__modes')!.hidden).toBe(
    true,
  );
  expect(document.activeElement).toBe(tryby);
});

it('z zapisem Kontynuuj run jest główną akcją (pierwszy i duży), a Kryjówka drugą', async () => {
  const save = createMemorySaveStore();
  const manager = new RunManager(new EventBus(), {
    generateMap: (seed) => generateSectorMap(kuroganeSector, seed),
  });
  const run = manager.newRun('menu-primary', 'blade');
  run.currentNodeId = run.map.layers[0]![0]!.id;
  run.visited = [run.currentNodeId];
  await save.saveRun({
    saveVersion: SAVE_VERSION,
    seed: run.seed,
    startedAt: run.startedAtMs,
    run,
  });
  manager.dispose();
  const menu = new MainMenu({ root: document.body, save });
  active.push(menu);
  expect(button('Kryjówka').classList).toContain('ui-button--primary');
  await menu.ready;
  expect(button('Kontynuuj run').classList).toContain('ui-button--primary');
  expect(button('Kryjówka').classList).not.toContain('ui-button--primary');
  expect(document.querySelector('.main-menu__primary')!.firstElementChild).toBe(
    button('Kontynuuj run'),
  );
  expect(document.activeElement).toBe(button('Kontynuuj run'));
});

it('Kontynuuj pokazuje warstwę i HP i wznawia zapis bez seeda z menu', async () => {
  const save = createMemorySaveStore();
  const manager = new RunManager(new EventBus(), {
    generateMap: (seed) => generateSectorMap(kuroganeSector, seed),
  });
  const run = manager.newRun('menu-test', 'blade');
  run.currentNodeId = run.map.layers[0]![0]!.id;
  run.visited = [run.currentNodeId];
  run.hp = 37;
  await save.saveRun({
    saveVersion: SAVE_VERSION,
    seed: run.seed,
    startedAt: run.startedAtMs,
    run,
  });
  manager.dispose();
  const navigate = vi.fn();
  const menu = new MainMenu({
    root: document.body,
    save,
    navigate,
    params: new URLSearchParams('seed=ignored'),
  });
  active.push(menu);
  await menu.ready;
  expect(button('Kontynuuj run').disabled).toBe(false);
  expect(document.querySelector('[role=status]')?.textContent).toBe(
    'Warstwa: 1 · Zdrowie: 37',
  );
  button('Kontynuuj run').click();
  expect(navigate).toHaveBeenCalledExactlyOnceWith('?scene=run&continue=1');
});

it('w debug Nowy run (presety) używa BuildSelect, zachowuje seed i koduje URL; Wróć przywraca menu', async () => {
  const navigate = vi.fn();
  const menu = new MainMenu({
    root: document.body,
    save: createMemorySaveStore(),
    navigate,
    params: new URLSearchParams('debug=1'),
  });
  active.push(menu);
  await menu.ready;
  document.querySelector('input')!.value = 'm?j seed&test';
  button('Nowy run (presety)').click();
  expect(document.querySelector<HTMLElement>('.build-select')!.hidden).toBe(
    false,
  );
  button('Wróć').click();
  expect(document.querySelector<HTMLElement>('.build-select')!.hidden).toBe(
    true,
  );
  button('Nowy run (presety)').click();
  document.querySelector<HTMLButtonElement>('[data-loadout=gunner]')!.click();
  const url = new URL(navigate.mock.calls[0]![0] as string, 'http://localhost');
  expect(url.searchParams.get('scene')).toBe('run');
  expect(url.searchParams.get('loadout')).toBe('gunner');
  expect(url.searchParams.get('seed')).toBe('m?j seed&test');
});

it('pusty seed generuje seed w URL, a błąd odczytu pozostawia Kontynuuj wyłączone', async () => {
  const navigate = vi.fn();
  const save = createMemorySaveStore();
  save.loadRun = async () => {
    throw new Error('offline');
  };
  const menu = new MainMenu({
    root: document.body,
    save,
    navigate,
    params: new URLSearchParams('debug=1'),
  });
  active.push(menu);
  await menu.ready;
  expect(button('Kontynuuj run').disabled).toBe(true);
  expect(document.querySelector('[role=status]')?.textContent).toBe(
    'Nie można odczytać zapisu.',
  );
  button('Nowy run (presety)').click();
  document.querySelector<HTMLButtonElement>('[data-loadout=blade]')!.click();
  expect(
    new URL(
      navigate.mock.calls[0]![0] as string,
      'http://localhost',
    ).searchParams.get('seed'),
  ).toBeTruthy();
});

it('zakończony, nierozliczony run: status „Nierozliczony run”, Kontynuuj prowadzi do rozliczenia', async () => {
  const save = createMemorySaveStore();
  const manager = new RunManager(new EventBus(), {
    generateMap: (seed) => generateSectorMap(kuroganeSector, seed),
  });
  const run = manager.newRun('menu-ended', 'blade');
  const summary = manager.finish('death');
  manager.dispose();
  await save.saveRun({
    saveVersion: SAVE_VERSION,
    seed: run.seed,
    startedAt: run.startedAtMs,
    run,
    ended: { runId: `${run.seed}:${run.startedAtMs}`, summary },
  });
  const navigate = vi.fn();
  const menu = new MainMenu({ root: document.body, save, navigate });
  active.push(menu);
  await menu.ready;
  expect(document.querySelector('[role=status]')?.textContent).toContain(
    'Nierozliczony run',
  );
  button('Kontynuuj run').click();
  expect(navigate).toHaveBeenCalledExactlyOnceWith('?scene=run&continue=1');
});

async function endedSave(threatLevel: number) {
  const save = createMemorySaveStore();
  const manager = new RunManager(new EventBus(), {
    generateMap: (seed) => generateSectorMap(kuroganeSector, seed),
  });
  const run = manager.newRun(`menu-${threatLevel}`, 'blade');
  const summary = { ...manager.finish('death'), threatLevel };
  manager.dispose();
  const runId = `${run.seed}:${run.startedAtMs}`;
  await save.saveRun({
    saveVersion: SAVE_VERSION,
    seed: run.seed,
    startedAt: run.startedAtMs,
    run,
    ended: { runId, summary },
  });
  return { save, runId };
}

it('menu: nienaliczalny run (błąd applyRun) nie obiecuje zapisu nagrody', async () => {
  const { save } = await endedSave(99);
  const menu = new MainMenu({ root: document.body, save, navigate: vi.fn() });
  active.push(menu);
  await menu.ready;
  const status = document.querySelector('[role=status]')!.textContent!;
  expect(status).toContain('nie da się naliczyć');
  expect(status).not.toContain('zapisze nagrodę');
  expect(button('Kontynuuj run').disabled).toBe(false);
});

it('menu: run już rozliczony na dysku (zostawiony ślad) nie mówi „Kontynuuj zapisze nagrodę”', async () => {
  const { save, runId } = await endedSave(0);
  const meta = createStarterMetaState();
  meta.appliedRunIds = [runId];
  await save.saveMeta({
    saveVersion: SAVE_VERSION,
    createdAt: 0,
    updatedAt: 0,
    meta,
  });
  const menu = new MainMenu({ root: document.body, save, navigate: vi.fn() });
  active.push(menu);
  await menu.ready;
  const status = document.querySelector('[role=status]')!.textContent!;
  expect(status).toContain('już rozliczony');
  expect(status).not.toContain('zapisze nagrodę');
});

it('Kontynuuj pokazuje HP bez ułamków zmiennoprzecinkowych', async () => {
  const save = createMemorySaveStore();
  const manager = new RunManager(new EventBus(), {
    generateMap: (seed) => generateSectorMap(kuroganeSector, seed),
  });
  const run = manager.newRun('menu-test', 'blade');
  run.currentNodeId = run.map.layers[0]![0]!.id;
  run.visited = [run.currentNodeId];
  run.hp = 36.60000000000001;
  await save.saveRun({
    saveVersion: SAVE_VERSION,
    seed: run.seed,
    startedAt: run.startedAtMs,
    run,
  });
  manager.dispose();
  const navigate = vi.fn();
  const menu = new MainMenu({
    root: document.body,
    save,
    navigate,
    params: new URLSearchParams('seed=ignored'),
  });
  active.push(menu);
  await menu.ready;
  expect(button('Kontynuuj run').disabled).toBe(false);
  expect(document.querySelector('[role=status]')?.textContent).toBe(
    'Warstwa: 1 · Zdrowie: 37',
  );
});
