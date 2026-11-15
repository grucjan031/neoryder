// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createDebugConsole } from '../../src/ui/debugConsole';
import { PauseMenu } from '../../src/ui/pauseMenu';
import { SettingsScreen } from '../../src/ui/settingsScreen';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

it('konsola otwiera modal nad pauzą/ustawieniami i obsługuje komendy oraz historię', () => {
  // jsdom nie implementuje top layer; sprawdzamy użycie natywnego API dialogu.
  const opened: HTMLDialogElement[] = [];
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
    opened.push(this);
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  const resume = vi.fn();
  const menu = new PauseMenu({ resume, settings() {}, hub() {}, menu() {} });
  const settings = new SettingsScreen();
  const command = vi.fn(() => 'OK');
  const dispose = createDebugConsole(command);
  try {
    menu.show(true);
    settings.show();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote' }));
    const panel = document.querySelector<HTMLDialogElement>('.debug-console')!;
    const input = panel.querySelector('input')!;
    expect(opened.at(-1)).toBe(panel);
    expect(panel.open).toBe(true);
    expect(document.activeElement).toBe(input);
    input.value = 'tp 3 4 90 0';
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    expect(command).toHaveBeenCalledWith('tp 3 4 90 0');
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
    );
    expect(input.value).toBe('tp 3 4 90 0');
    const pause = document.querySelector('.pause-menu')!;
    pause.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(resume).not.toHaveBeenCalled();
    expect(menu.visible).toBe(true);
    expect(settings.visible).toBe(true);
    panel.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(panel.open).toBe(false);
    expect(panel.hidden).toBe(true);
  } finally {
    dispose();
    menu.dispose();
    settings.dispose();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
  }
});
