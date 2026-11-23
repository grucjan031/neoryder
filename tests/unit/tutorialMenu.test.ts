// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createMemorySaveStore, SAVE_VERSION } from '../../src/core/save';
import { createStarterMetaState } from '../../src/progression/progressionSchema';

const button = (label: string) =>
  [...document.querySelectorAll('button')].find(
    (button) =>
      (button.getAttribute('aria-label') ?? button.textContent) === label,
  )!;
let menu: { dispose(): void } | undefined;
beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});
afterEach(() => {
  menu?.dispose();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});
it('wyróżnia pierwszy przycisk Samouczek przy braku meta i flagi; Kryjówka prowadzi prosto do hub', async () => {
  const { MainMenu } = await import('../../src/ui/mainMenu');
  const navigate = vi.fn();
  const current = new MainMenu({
    root: document.body,
    save: createMemorySaveStore(),
    navigate,
  });
  menu = current;
  expect(button('Kryjówka').disabled).toBe(false);
  button('Kryjówka').click();
  expect(navigate).toHaveBeenLastCalledWith('?scene=hub');
  await current.ready;
  // Samouczek jest mniejszą pozycją na końcu listy, ale z wyróżnieniem dla nowego gracza.
  expect(button('Samouczek').classList).toContain('ui-button--quiet');
  expect(button('Samouczek').classList).toContain(
    'main-menu__tutorial--recommended',
  );
  expect(button('Samouczek').querySelector('small')?.textContent).toBe(
    'Nowy gracz? Zacznij tutaj',
  );
  button('Kryjówka').click();
  expect(navigate).toHaveBeenLastCalledWith('?scene=hub');
  expect(document.querySelector('dialog')).toBeNull();
  expect(localStorage.getItem('neoryder.tutorialDone')).toBeNull();
});
it('Samouczek i Kryjówka zachowują debug w URL bez dialogu', async () => {
  const { MainMenu } = await import('../../src/ui/mainMenu');
  const navigate = vi.fn();
  const current = new MainMenu({
    root: document.body,
    save: createMemorySaveStore(),
    navigate,
    params: new URLSearchParams('debug=1'),
  });
  menu = current;
  await current.ready;
  button('Samouczek').click();
  expect(navigate).toHaveBeenLastCalledWith('?scene=tutorial&debug=1');
  button('Kryjówka').click();
  expect(navigate).toHaveBeenLastCalledWith('?scene=hub&debug=1');
  expect(document.querySelector('dialog')).toBeNull();
  expect(localStorage.getItem('neoryder.tutorialDone')).toBeNull();
});
it('flaga ukończenia usuwa wyróżnienie i dopisek, Samouczek pozostaje dostępny', async () => {
  localStorage.setItem('neoryder.tutorialDone', '1');
  const { MainMenu } = await import('../../src/ui/mainMenu');
  const navigate = vi.fn();
  const current = new MainMenu({
    root: document.body,
    save: createMemorySaveStore(),
    navigate,
  });
  menu = current;
  await current.ready;
  expect(button('Samouczek').classList).not.toContain(
    'main-menu__tutorial--recommended',
  );
  expect(button('Samouczek').querySelector('small')).toBeNull();
  button('Samouczek').click();
  expect(navigate).toHaveBeenLastCalledWith('?scene=tutorial');
  button('Kryjówka').click();
  expect(navigate).toHaveBeenCalledWith('?scene=hub');
  expect(document.querySelector('dialog')).toBeNull();
});
it('błąd meta nie jest traktowany jak nowy gracz', async () => {
  const save = createMemorySaveStore();
  vi.spyOn(save, 'loadMeta').mockRejectedValue(new Error('offline'));
  const { MainMenu } = await import('../../src/ui/mainMenu');
  const navigate = vi.fn();
  const current = new MainMenu({ root: document.body, save, navigate });
  menu = current;
  await current.ready;
  expect(button('Samouczek').classList).not.toContain(
    'main-menu__tutorial--recommended',
  );
  expect(button('Samouczek').querySelector('small')).toBeNull();
  button('Kryjówka').click();
  expect(navigate).toHaveBeenCalledWith('?scene=hub');
});

it('zapis meta bez flagi ukończenia usuwa wyróżnienie i dopisek', async () => {
  const save = createMemorySaveStore();
  await save.saveMeta({
    saveVersion: SAVE_VERSION,
    createdAt: 0,
    updatedAt: 0,
    meta: createStarterMetaState(),
  });
  const { MainMenu } = await import('../../src/ui/mainMenu');
  const navigate = vi.fn();
  const current = new MainMenu({ root: document.body, save, navigate });
  menu = current;
  await current.ready;
  expect(button('Samouczek').classList).not.toContain(
    'main-menu__tutorial--recommended',
  );
  expect(button('Samouczek').querySelector('small')).toBeNull();
  button('Kryjówka').click();
  expect(navigate).toHaveBeenCalledWith('?scene=hub');
});

it('Kryjówka działa podczas oczekiwania na meta; spóźniony odczyt nie zmienia usuniętego menu', async () => {
  const save = createMemorySaveStore();
  let resolveMeta!: (meta: null) => void;
  vi.spyOn(save, 'loadMeta').mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveMeta = resolve;
      }),
  );
  const { MainMenu } = await import('../../src/ui/mainMenu');
  const navigate = vi.fn();
  const current = new MainMenu({ root: document.body, save, navigate });
  menu = current;
  const tutorial = button('Samouczek');
  button('Kryjówka').click();
  expect(navigate).toHaveBeenCalledWith('?scene=hub');
  current.dispose();
  resolveMeta(null);
  await current.ready;
  expect(tutorial.classList).not.toContain('main-menu__tutorial--recommended');
  expect(tutorial.querySelector('small')).toBeNull();
});
