// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { loadSettings, saveSettings } from '../../src/core/save';
import { UiSounds } from '../../src/audio/uiSounds';
import type { UiAudioContext } from '../../src/audio/uiSounds';
import { LayerManager } from '../../src/ui/layers';
import { createActionBar } from '../../src/ui/components/actionBar';
import {
  createSelect,
  createStepper,
  createToggle,
} from '../../src/ui/components/controls';
import { createTabs } from '../../src/ui/components/tabs';
import { uiConfirm } from '../../src/ui/components/modal';
import { applyUiSettings } from '../../src/ui/theme/applySettings';
import { inputGlyphLabel } from '../../src/ui/inputGlyphs';

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.removeAttribute('style');
  localStorage.clear();
});

it('stary zapis bez kluczy UI wczytuje się z domyślnymi, a skala jest obcinana do 80–140%', () => {
  localStorage.setItem(
    'neoryder.settings',
    JSON.stringify({ masterVolume: 0.5, fov: 80 }),
  );
  expect(loadSettings(localStorage)).toMatchObject({
    masterVolume: 0.5,
    uiScale: 1,
    uiVolume: 0.7,
    reduceMotion: false,
  });
  const settings = { ...loadSettings(localStorage), uiScale: 3 };
  saveSettings(settings, localStorage);
  expect(loadSettings(localStorage).uiScale).toBe(1.4);
  localStorage.setItem('neoryder.settings', JSON.stringify({ uiScale: 0.1 }));
  expect(loadSettings(localStorage).uiScale).toBe(0.8);
});

it('applyUiSettings ustawia skalę i tryb ograniczonych animacji na <html>', () => {
  applyUiSettings({ uiScale: 1.2, reduceMotion: true });
  expect(document.documentElement.style.getPropertyValue('--ui-scale')).toBe(
    '1.2',
  );
  expect(document.documentElement.dataset.reduceMotion).toBe('true');
});

it('dźwięki UI: cisza przy głośności 0, odtwarzanie przy włączonym kontekście', () => {
  const oscillators: number[] = [];
  const param = () => ({
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });
  const ctx = {
    currentTime: 1,
    state: 'running',
    destination: {},
    createGain: () => ({ gain: param(), connect: vi.fn() }),
    createOscillator: () => {
      oscillators.push(1);
      return {
        frequency: param(),
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
    },
    resume: () => Promise.resolve(),
  } as unknown as UiAudioContext;
  let volume = 0;
  const sounds = new UiSounds({
    createContext: () => ctx,
    volume: () => volume,
  });
  sounds.play('confirm');
  expect(oscillators).toHaveLength(0);
  volume = 1;
  sounds.play('confirm');
  expect(oscillators.length).toBeGreaterThan(0);
});

it('menedżer warstw: Esc zamyka górną warstwę i przywraca fokus otwierającemu', () => {
  const layers = new LayerManager();
  const opener = document.createElement('button');
  const panel = document.createElement('div');
  document.body.append(opener, panel);
  opener.focus();
  let remove = (): void => {};
  const close = vi.fn(() => remove());
  remove = layers.push(panel, close, opener);
  expect(layers.depth).toBe(1);
  document.body.focus();
  window.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }),
  );
  expect(close).toHaveBeenCalledOnce();
  expect(layers.depth).toBe(0);
  expect(document.activeElement).toBe(opener);
});

it('zakładki: strzałki, Home/End i cycle przełączają wybór', () => {
  const onSelect = vi.fn();
  const tabs = createTabs({
    prefix: 't',
    label: 'x',
    tabs: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ],
    onSelect,
  });
  document.body.append(tabs.root);
  tabs.select('a');
  tabs.cycle(1);
  expect(tabs.selected).toBe('b');
  tabs.cycle(-1);
  tabs.cycle(-1);
  expect(tabs.selected).toBe('c');
  tabs.buttons
    .get('c')!
    .dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true }),
    );
  expect(tabs.selected).toBe('a');
});

it('stepper i przełącznik zmieniają wartość klawiaturą i klikiem', () => {
  const changed = vi.fn();
  const stepper = createStepper({
    label: 'Skala',
    values: [0.9, 1, 1.1],
    index: 1,
    format: String,
    onChange: changed,
  });
  stepper.node.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true }),
  );
  expect(changed).toHaveBeenLastCalledWith(1.1, 2);
  stepper.node.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true }),
  );
  expect(changed).toHaveBeenCalledOnce();
  const onToggle = vi.fn();
  const toggle = createToggle({ label: 'T', value: false, onChange: onToggle });
  toggle.node.click();
  expect(onToggle).toHaveBeenCalledWith(true);
  expect(toggle.node.getAttribute('aria-checked')).toBe('true');
});

it('lista rozwijana: wybór opcji, Esc zamyka listę i zwraca fokus', () => {
  const changed = vi.fn();
  const host = document.createElement('div');
  host.className = 'ui-screen';
  const select = createSelect({
    label: 'Jakość',
    options: [
      { value: 'low', label: 'Niska' },
      { value: 'high', label: 'Wysoka' },
    ],
    value: 'low',
    onChange: changed,
  });
  host.append(select.root);
  document.body.append(host);
  select.trigger.click();
  expect(select.trigger.getAttribute('aria-expanded')).toBe('true');
  const list = document.querySelector<HTMLElement>('[role="listbox"]')!;
  list.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    }),
  );
  expect(select.trigger.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(select.trigger);
  select.trigger.click();
  document
    .querySelector<HTMLElement>('[role="option"][data-value="high"]')!
    .click();
  expect(changed).toHaveBeenCalledWith('high');
  expect(select.trigger.textContent).toBe('Wysoka');
});

it('modal potwierdzenia ma aria-modal, zwraca wynik i oddaje fokus', async () => {
  const opener = document.createElement('button');
  document.body.append(opener);
  opener.focus();
  const result = uiConfirm({
    title: 'T',
    message: 'M',
    confirmLabel: 'Tak',
    cancelLabel: 'Nie',
    destructive: true,
  });
  const dialog = document.querySelector('dialog')!;
  expect(dialog.getAttribute('aria-modal')).toBe('true');
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Nie');
  [...dialog.querySelectorAll('button')]
    .find((b) => b.getAttribute('aria-label') === 'Tak')!
    .click();
  expect(await result).toBe(true);
  expect(document.querySelector('dialog')).toBeNull();
  expect(document.activeElement).toBe(opener);
});

it('pasek akcji: glify zależą od urządzenia, a klik w podpowiedź wykonuje akcję', () => {
  const action = vi.fn();
  const bar = createActionBar([
    { keys: '{tabs}', label: 'Zakładki', decorative: true },
    { keys: '{back}', label: 'Wróć', onClick: action, end: true },
  ]);
  document.body.append(bar.root);
  expect(bar.root.textContent).toContain('Q / E');
  expect(bar.root.textContent).toContain('Esc');
  expect(inputGlyphLabel('tabs', { device: 'gamepad', layout: 'xbox' })).toBe(
    'LB / RB',
  );
  bar.root.querySelector<HTMLButtonElement>('button')!.click();
  expect(action).toHaveBeenCalledOnce();
  expect(bar.root.querySelector('[aria-hidden="true"]')).not.toBeNull();
});

it('pad: LB/RB przełączają zakładki ustawień, lewo/prawo zmienia stepper, B zamyka okno', async () => {
  const { PadNavigation } = await import('../../src/ui/padNavigation');
  const { SettingsScreen } = await import('../../src/ui/settingsScreen');
  const point = { x: 0, y: 0 };
  const frame = (pressed: number[], buttons = pressed) =>
    ({
      pad: {},
      layout: 'xbox',
      buttons: new Set(buttons),
      pressed: new Set(pressed),
      move: point,
      look: point,
      active: true,
    }) as never;
  const screen = new SettingsScreen(loadSettings(localStorage));
  const dialog = document.querySelector<HTMLDialogElement>('dialog')!;
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
  };
  const nav = new PadNavigation();
  try {
    screen.show();
    nav.update(frame([5]), 0, dialog);
    expect(dialog.dataset.tab).toBe('graphics');
    nav.update(frame([4]), 0, dialog);
    expect(dialog.dataset.tab).toBe('gameplay');
    document.querySelector<HTMLButtonElement>('#settings-tab-access')!.click();
    const stepper = dialog.querySelector<HTMLElement>('.ui-stepper')!;
    stepper.focus();
    nav.update(frame([15]), 0, dialog);
    expect(loadSettings(localStorage).uiScale).toBe(1.1);
    nav.update(frame([1]), 0, dialog);
    expect(screen.visible).toBe(false);
  } finally {
    screen.dispose();
  }
});
