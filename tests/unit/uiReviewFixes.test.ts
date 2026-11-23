// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/events';
import { Hud } from '../../src/ui/hud';
import { RunInventoryMenu } from '../../src/ui/runInventory';
import { showDebrief } from '../../src/ui/missionUi';
import { missionDefinitions } from '../../src/world/missions';
import { MetaManager } from '../../src/progression/meta';
import { createStarterMetaState } from '../../src/progression/progressionSchema';
import { createWorkshopPanel } from '../../src/ui/hub/workshopPanel';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('Hud: ekran śmierci i reset loadoutu', () => {
  let bus: EventBus;
  let hud: Hud;
  let onRetry: ReturnType<typeof vi.fn<() => void>>;
  let onChangeBuild: ReturnType<typeof vi.fn<() => void>>;
  beforeEach(() => {
    bus = new EventBus();
    onRetry = vi.fn();
    onChangeBuild = vi.fn();
    hud = new Hud(bus, { playerId: 1, onRetry, onChangeBuild });
  });
  afterEach(() => hud.dispose());

  it('Enter na przycisku „Zmień build” nie jest przechwytywany jako „Jeszcze raz”', () => {
    bus.emit('player_died', { id: 1 });
    const change =
      document.querySelector<HTMLButtonElement>('.hud__change-build')!;
    change.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    change.dispatchEvent(event);
    expect(onRetry).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('R wpisane w polu nad ekranem śmierci (konsola debug) nie restartuje podejścia', () => {
    bus.emit('player_died', { id: 1 });
    const dialog = document.createElement('dialog');
    const input = document.createElement('input');
    dialog.append(input);
    document.body.append(dialog);
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'r', code: 'KeyR', bubbles: true }),
    );
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('setLoadout zeruje przegrzanie i podpowiedź dobicia', () => {
    hud.setLoadout({ weapons: ['rifle'], powers: [] });
    const heat = { id: 1, current: 100, max: 100, overheated: true };
    bus.emit('heat_changed', heat);
    hud.setExecuteHint(true);
    const overheat = document.querySelector<HTMLElement>('.hud__overheat')!;
    const hint = document.querySelector<HTMLElement>('.hud__execute-hint')!;
    expect(overheat.hidden).toBe(false);
    expect(hint.hidden).toBe(false);
    hud.setLoadout({ weapons: ['rifle'], powers: [] });
    expect(overheat.hidden).toBe(true);
    expect(hint.hidden).toBe(true);
    expect(document.querySelector('.hud__meter--overheated')).toBeNull();
    bus.emit('heat_changed', heat);
    expect(overheat.hidden).toBe(false);
  });
});

describe('RunInventoryMenu', () => {
  function make() {
    const ctx = { loop: { paused: false }, resume: vi.fn() };
    const menu = new RunInventoryMenu(
      ctx as never,
      () =>
        ({
          implants: [],
          synergies: [],
          powers: [],
          weapons: [],
        }) as never,
    );
    return { ctx, menu };
  }
  const key = (code: string, init: KeyboardEventInit = {}, target?: Element) =>
    (target ?? window).dispatchEvent(
      new KeyboardEvent('keydown', {
        code,
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    );
  const inventoryPress = { pressed: new Set(['inventory']) } as never;

  it('auto-repeat innego klawisza nie zmienia klawisza zamykającego', () => {
    const { menu } = make();
    key('KeyI');
    key('KeyW', { repeat: true });
    menu.step(inventoryPress);
    expect(menu.visible).toBe(true);
    key('KeyW');
    expect(menu.visible).toBe(true);
    key('KeyI');
    expect(menu.visible).toBe(false);
  });

  it('Esc w konsoli debug nad ekwipunkiem nie zamyka ekwipunku', () => {
    const { ctx, menu } = make();
    menu.step(inventoryPress);
    const panel = document.createElement('dialog');
    panel.className = 'debug-console';
    const input = document.createElement('input');
    panel.append(input);
    document.body.append(panel);
    key('Escape', {}, input);
    expect(menu.visible).toBe(true);
    expect(ctx.loop.paused).toBe(true);
    key('Escape');
    expect(menu.visible).toBe(false);
  });
});

it('showDebrief zwalnia pointer lock przed oknem modalnym', () => {
  const exit = vi.fn();
  Object.defineProperty(document, 'exitPointerLock', {
    value: exit,
    configurable: true,
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  let closeDebrief: (() => void) | undefined;
  try {
    const mission = [...missionDefinitions.values()][0]!;
    closeDebrief = showDebrief(mission, async () => {});
    expect(exit).toHaveBeenCalled();
  } finally {
    closeDebrief?.();
    Reflect.deleteProperty(document, 'exitPointerLock');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  }
});

it('warsztat: po zakupie fokus zostaje w panelu zamiast uciec na body', async () => {
  const manager = new MetaManager(createStarterMetaState());
  manager.debugAddData(100);
  manager.debugGrantAchievement('pierwszy-zakup');
  const panel = createWorkshopPanel({
    manager,
    save: () => Promise.resolve(),
    navigate: vi.fn(),
    close: vi.fn(),
  });
  document.body.append(panel.root);
  const buy = panel.root.querySelector<HTMLButtonElement>(
    '[data-unlock="weapon:rifle"] button',
  )!;
  buy.focus();
  buy.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(panel.root.contains(document.activeElement)).toBe(true);
  panel.dispose();
});
