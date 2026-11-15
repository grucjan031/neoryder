// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { MetaManager } from '../../src/progression/meta';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import type { HubPanel, HubPanelContext } from '../../src/ui/hub/hubPanel';
import { HtmlHubScreens } from '../../src/ui/hubScreens';
import type { HubPanelRegistry } from '../../src/ui/hubScreens';

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

it('arena ma Przejdź na poligon, stacje bez panelu tylko Zamknij', () => {
  const screens = create();
  const openArena = vi.fn();
  screens.show('arena', { close: vi.fn(), openArena });
  expect(labels()).toEqual(['Przejdź na poligon', 'Zamknij']);
  document.querySelector<HTMLButtonElement>('[data-action=arena]')!.click();
  expect(openArena).toHaveBeenCalledOnce();
  screens.show('talents', { close: vi.fn(), openArena });
  expect(labels()).toEqual(['Zamknij']);
});

function createHosted() {
  const manager = new MetaManager(createStarterMetaState());
  const save = vi.fn(async () => {});
  const navigate = vi.fn();
  const contexts: HubPanelContext[] = [];
  const panels: {
    refresh: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }[] = [];
  const registry: HubPanelRegistry = {
    missions: (ctx) => {
      contexts.push(ctx);
      const root = document.createElement('div');
      root.className = 'fake-panel';
      root.innerHTML = '<button type="button">Panel</button>';
      const panel = {
        root,
        refresh: vi.fn(),
        dispose: vi.fn(() => root.remove()),
      } satisfies HubPanel;
      panels.push(panel);
      return panel;
    },
  };
  const screens = new HtmlHubScreens(document.body, {
    panels: registry,
    host: { manager, save, navigate },
  });
  active.push(screens);
  return { screens, manager, save, navigate, contexts, panels };
}

it('stacja z fabryką montuje panel zamiast zaślepki i przekazuje kontekst', async () => {
  const { screens, manager, save, navigate, contexts } = createHosted();
  const close = vi.fn();
  screens.show('missions', { close });
  const root = document.querySelector<HTMLElement>('.hub-screen')!;
  expect(root.querySelector('h1')?.textContent).toBe('Tablica misji');
  expect(root.querySelector('.fake-panel')).not.toBeNull();
  expect(root.querySelector('.hub-screen__note')).toBeNull();
  expect(root.classList.contains('hub-screen--panel')).toBe(true);
  expect(labels()).toEqual(['Panel', 'Zamknij']);
  const ctx = contexts[0]!;
  expect(ctx.manager).toBe(manager);
  await ctx.save();
  expect(save).toHaveBeenCalledOnce();
  ctx.navigate('?scene=run');
  expect(navigate).toHaveBeenCalledWith('?scene=run');
  ctx.close();
  expect(close).toHaveBeenCalledOnce();
});

it('panel jest sprzątany przy hide, przy ponownym show i przy dispose; refresh trafia do panelu', () => {
  const { screens, panels } = createHosted();
  screens.show('missions', { close: vi.fn() });
  screens.refresh();
  expect(panels[0]!.refresh).toHaveBeenCalledOnce();
  screens.hide();
  expect(panels[0]!.dispose).toHaveBeenCalledOnce();
  screens.refresh();
  expect(panels[0]!.refresh).toHaveBeenCalledOnce();
  screens.show('missions', { close: vi.fn() });
  screens.show('missions', { close: vi.fn() });
  expect(panels).toHaveLength(3);
  expect(panels[1]!.dispose).toHaveBeenCalledOnce();
  screens.dispose();
  active.pop();
  expect(panels[2]!.dispose).toHaveBeenCalledOnce();
});

it('stacja bez fabryki w rejestrze zostaje zaślepką', () => {
  const { screens, panels } = createHosted();
  screens.show('arena', { close: vi.fn(), openArena: vi.fn() });
  expect(panels).toHaveLength(0);
  expect(labels()).toEqual(['Przejdź na poligon', 'Zamknij']);
  expect(
    document
      .querySelector('.hub-screen')!
      .classList.contains('hub-screen--panel'),
  ).toBe(false);
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
