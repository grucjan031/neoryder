// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { HtmlHubScreens } from '../../src/ui/hubScreens';

const active: HtmlHubScreens[] = [];
afterEach(() => {
  active.splice(0).forEach((screens) => screens.dispose());
  document.body.replaceChildren();
});
const create = (): HtmlHubScreens => {
  const screens = new HtmlHubScreens(document.body);
  active.push(screens);
  return screens;
};
const labels = (): string[] =>
  [...document.querySelectorAll('button')].map((b) => b.textContent ?? '');

it('nakładka jest ukryta do pokazania, pokazuje tytuł stacji i zaślepkę', () => {
  const screens = create();
  const root = document.querySelector<HTMLElement>('.hub-screen')!;
  expect(root.hidden).toBe(true);
  screens.show('workshop', { close: vi.fn() });
  expect(root.hidden).toBe(false);
  expect(root.dataset.station).toBe('workshop');
  expect(root.querySelector('h1')?.textContent).toBe('Warsztat');
  expect(labels()).toEqual(['Zamknij']);
});

it('Zamknij i Esc wywołują close, Esc po ukryciu nic nie robi', () => {
  const screens = create();
  const close = vi.fn();
  screens.show('talents', { close });
  document.querySelector<HTMLButtonElement>('[data-action=close]')!.click();
  expect(close).toHaveBeenCalledTimes(1);
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
  expect(close).toHaveBeenCalledTimes(2);
  screens.hide();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
  expect(close).toHaveBeenCalledTimes(2);
  expect(document.querySelector<HTMLElement>('.hub-screen')!.hidden).toBe(true);
});

it('missions ma Rozpocznij run, arena ma Przejdź na poligon, pozostałe tylko Zamknij', () => {
  const screens = create();
  const startRun = vi.fn();
  const openArena = vi.fn();
  screens.show('missions', { close: vi.fn(), startRun });
  expect(labels()).toEqual(['Rozpocznij run', 'Zamknij']);
  document.querySelector<HTMLButtonElement>('[data-action=start]')!.click();
  expect(startRun).toHaveBeenCalledOnce();
  screens.show('arena', { close: vi.fn(), openArena });
  expect(labels()).toEqual(['Przejdź na poligon', 'Zamknij']);
  document.querySelector<HTMLButtonElement>('[data-action=arena]')!.click();
  expect(openArena).toHaveBeenCalledOnce();
  screens.show('talents', { close: vi.fn(), startRun, openArena });
  expect(labels()).toEqual(['Zamknij']);
});

it('pokazanie nakładki zwalnia kursor, a dispose usuwa DOM i nasłuch klawiatury', () => {
  const exit = vi.fn();
  Object.defineProperty(document, 'pointerLockElement', {
    configurable: true,
    get: () => document.body,
  });
  document.exitPointerLock = exit;
  const screens = create();
  const close = vi.fn();
  screens.show('arena', { close });
  expect(exit).toHaveBeenCalledOnce();
  screens.dispose();
  active.pop();
  expect(document.querySelector('.hub-screen')).toBeNull();
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
  expect(close).not.toHaveBeenCalled();
  Reflect.deleteProperty(document, 'pointerLockElement');
});
