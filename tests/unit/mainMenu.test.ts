// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { MainMenu } from '../../src/ui/mainMenu';
import { createMemorySaveStore, SAVE_VERSION } from '../../src/core/save';
import { EventBus } from '../../src/core/events';
import { RunManager } from '../../src/world/run';
import { generateSectorMap } from '../../src/world/sectorMap';
import { kuroganeSector } from '../../src/world/sectors';

const active: MainMenu[] = [];
afterEach(() => {
  active.splice(0).forEach((menu) => menu.dispose());
  document.body.replaceChildren();
});
const button = (text: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent === text)!;

it('Kontynuuj jest nieaktywne podczas odczytu i bez zapisu; arena prowadzi do poligonu', async () => {
  const navigate = vi.fn();
  const menu = new MainMenu({
    root: document.body,
    save: createMemorySaveStore(),
    navigate,
  });
  active.push(menu);
  expect(button('Kontynuuj').disabled).toBe(true);
  await menu.ready;
  button('Kontynuuj').click();
  expect(navigate).not.toHaveBeenCalled();
  button('Arena / poligon').click();
  expect(navigate).toHaveBeenCalledExactlyOnceWith('?scene=arena');
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
  expect(button('Kontynuuj').disabled).toBe(false);
  expect(document.querySelector('[role=status]')?.textContent).toBe(
    'Warstwa: 1 · Zdrowie: 37',
  );
  button('Kontynuuj').click();
  expect(navigate).toHaveBeenCalledExactlyOnceWith('?scene=run&continue=1');
});

it('Nowy run używa BuildSelect, zachowuje seed i koduje URL; Wróć przywraca menu', async () => {
  const navigate = vi.fn();
  const menu = new MainMenu({
    root: document.body,
    save: createMemorySaveStore(),
    navigate,
  });
  active.push(menu);
  await menu.ready;
  document.querySelector('input')!.value = 'm?j seed&test';
  button('Nowy run').click();
  expect(document.querySelector<HTMLElement>('.build-select')!.hidden).toBe(
    false,
  );
  button('Wróć').click();
  expect(document.querySelector<HTMLElement>('.build-select')!.hidden).toBe(
    true,
  );
  button('Nowy run').click();
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
  const menu = new MainMenu({ root: document.body, save, navigate });
  active.push(menu);
  await menu.ready;
  expect(button('Kontynuuj').disabled).toBe(true);
  expect(document.querySelector('[role=status]')?.textContent).toBe(
    'Nie można odczytać zapisu.',
  );
  button('Nowy run').click();
  document.querySelector<HTMLButtonElement>('[data-loadout=blade]')!.click();
  expect(
    new URL(
      navigate.mock.calls[0]![0] as string,
      'http://localhost',
    ).searchParams.get('seed'),
  ).toBeTruthy();
});
