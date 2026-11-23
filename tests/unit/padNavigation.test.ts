// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { EventBus } from '../../src/core/events';
import type { PadFrame } from '../../src/core/input/gamepad';
import { loadSettings } from '../../src/core/save';
import { tuning } from '../../src/core/tuning';
import {
  bindInputGlyphs,
  inputGlyphLabel,
  setInputHint,
} from '../../src/ui/inputGlyphs';
import { PadNavigation } from '../../src/ui/padNavigation';
import { SettingsScreen } from '../../src/ui/settingsScreen';

const point = { x: 0, y: 0 };
function frame(
  buttons: number[] = [],
  pressed = buttons,
  move = point,
): PadFrame {
  return {
    pad: {
      id: 'DualSense',
      axes: [],
      buttons: [],
      index: 0,
      mapping: 'standard',
      connected: true,
      timestamp: 0,
    },
    layout: 'playstation',
    buttons: new Set(buttons),
    pressed: new Set(pressed),
    move,
    look: point,
    active: true,
  };
}

function button(root: HTMLElement, x: number, y: number): HTMLButtonElement {
  const element = document.createElement('button');
  element.getBoundingClientRect = () => new DOMRect(x, y, 20, 20);
  root.append(element);
  return element;
}

afterEach(() => {
  bindInputGlyphs(new EventBus())();
  document.body.replaceChildren();
  localStorage.clear();
});

it('rysuje aktualne glify Xbox i PlayStation oraz wraca do ustawionych klawiszy', () => {
  const bus = new EventBus();
  const off = bindInputGlyphs(bus);
  const hint = document.createElement('p');
  document.body.append(hint);
  setInputHint(hint, '[{attack}] Wykończ · {map}');
  expect(hint.textContent).toBe('[LPM] Wykończ · M');
  bus.emit('input:deviceChanged', { device: 'gamepad', layout: 'generic' });
  expect(hint.textContent).toBe('[RT] Wykończ · View (przytrzymaj)');
  expect(hint.querySelectorAll('kbd.input-glyph')).toHaveLength(2);
  bus.emit('input:deviceChanged', { device: 'gamepad', layout: 'playstation' });
  expect(hint.textContent).toBe('[R2] Wykończ · Create (przytrzymaj)');
  const settings = loadSettings(localStorage);
  settings.gamepad.bindings = { attack: 3 };
  expect(
    inputGlyphLabel(
      'attack',
      { device: 'gamepad', layout: 'playstation' },
      settings,
    ),
  ).toBe('△');
  expect(
    inputGlyphLabel(
      'aim',
      { device: 'gamepad', layout: 'playstation' },
      settings,
    ),
  ).toBe('L2');
  bus.emit('input:deviceChanged', {
    device: 'keyboardMouse',
    layout: 'generic',
  });
  expect(hint.textContent).toBe('[LPM] Wykończ · M');
  expect(hint.querySelector('.input-glyph')).toBeNull();
  off();
});

it('wybiera przestrzennie widoczne cele, powtarza kierunek i klika aktywny element', () => {
  const nav = new PadNavigation();
  const root = document.createElement('main');
  root.className = 'main-menu';
  document.body.append(root);
  const first = button(root, 0, 0);
  const hidden = button(root, 25, 0);
  hidden.hidden = true;
  const disabled = button(root, 30, 0);
  disabled.disabled = true;
  const second = button(root, 60, 0);
  const third = button(root, 100, 0);
  const down = button(root, 60, 60);
  const click = vi.fn();
  third.addEventListener('click', click);
  first.focus();
  nav.update(frame([15]), 0);
  expect(document.activeElement).toBe(second);
  nav.update(frame([15], []), tuning.gamepad.navigationDelayS / 2);
  expect(document.activeElement).toBe(second);
  nav.update(frame([15], []), tuning.gamepad.navigationDelayS / 2);
  expect(document.activeElement).toBe(third);
  nav.update(frame([0]), 0);
  expect(click).toHaveBeenCalledOnce();
  second.focus();
  nav.update(frame([], [], { x: 0.1, y: 0.9 }), 0);
  expect(document.activeElement).toBe(down);
});

it('trzyma fokus w otwartym oknie i kieruje B do obsługi Escape', () => {
  const nav = new PadNavigation();
  const base = document.createElement('main');
  base.className = 'main-menu';
  const modal = document.createElement('dialog');
  modal.open = true;
  modal.close = () => {
    modal.open = false;
  };
  document.body.append(base, modal);
  const background = button(base, 0, 0);
  const menu = button(modal, 0, 0);
  const clicked = vi.fn();
  const cancel = vi.fn((event: Event) => {
    event.preventDefault();
    modal.close();
  });
  modal.addEventListener('cancel', cancel);
  menu.addEventListener('click', clicked);
  background.focus();
  nav.update(frame(), 0);
  expect(document.activeElement).toBe(menu);
  nav.update(frame([0]), 0);
  expect(clicked).toHaveBeenCalledOnce();
  nav.update(frame([1]), 0);
  expect(cancel).toHaveBeenCalledOnce();
  expect(modal.open).toBe(false);
});

it('w ustawieniach A otwiera przechwytywanie a B może być nowym przypisaniem', () => {
  const nav = new PadNavigation();
  const settings = loadSettings(localStorage);
  const screen = new SettingsScreen(settings);
  const dialog = document.querySelector<HTMLDialogElement>('dialog')!;
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
  };
  try {
    screen.show();
    dialog.querySelector<HTMLButtonElement>('#settings-tab-pad')?.click();
    dialog.querySelector<HTMLInputElement>('input[type="range"]')?.focus();
    nav.update(frame([15]), 0);
    expect(settings.gamepad.sensitivityX).toBe(1.1);
    const dash = dialog.querySelector<HTMLButtonElement>(
      '[data-action="dash"]',
    )!;
    dash.focus();
    nav.update(frame([0]), 0);
    expect(dash.textContent).toBe('Naciśnij przycisk pada…');
    nav.update(frame([1]), 0);
    expect(screen.visible).toBe(true);
    expect(dash.textContent).toBe('○');
    expect(loadSettings(localStorage).gamepad.bindings.dash).toBe(1);
  } finally {
    screen.dispose();
  }
});
