import {
  actionSchema,
  assignBinding,
  isBindingCode,
  resolveBindings,
} from '../core/input';
import type { Action } from '../core/input';
import { loadSettings, saveSettings, SETTINGS_RANGES } from '../core/save';
import type { Settings } from '../core/save';
import { applyQuality } from '../render/quality';
import text from '../data/ui/settings.pl.json';
import defaults from '../data/inputBindings.json';
import './settingsScreen.css';

export function keyLabel(code: string): string {
  return (
    (text.keys as Record<string, string>)[code] ??
    code.replace(/^(Key|Digit)/, '')
  );
}

export class SettingsScreen {
  private readonly root = document.createElement('dialog');
  private readonly content = document.createElement('div');
  private readonly status = document.createElement('p');
  private readonly tabs: HTMLButtonElement[] = [];
  private capture: Action | null = null;
  private tab: 'controls' | 'video' | 'audio' = 'controls';
  private previousFocus: HTMLElement | null = null;
  private readonly bindingButtons = new Map<Action, HTMLButtonElement>();

  constructor(
    private readonly settings: Settings = loadSettings(),
    private readonly changed: () => void = () => {},
    private readonly closed: () => void = () => {},
  ) {
    this.root.className = 'settings-screen';
    this.root.setAttribute('aria-label', text.title);
    const heading = document.createElement('h1');
    heading.textContent = text.title;
    const nav = document.createElement('div');
    nav.className = 'settings-screen__tabs';
    nav.setAttribute('role', 'tablist');
    for (const tab of ['controls', 'video', 'audio'] as const) {
      const button = this.button(text[tab], () => this.selectTab(tab));
      button.setAttribute('role', 'tab');
      button.id = `settings-tab-${tab}`;
      button.setAttribute('aria-controls', 'settings-panel');
      nav.append(button);
      this.tabs.push(button);
    }
    nav.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
        return;
      event.preventDefault();
      const index = this.tabs.indexOf(
        document.activeElement as HTMLButtonElement,
      );
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? 2
            : (index + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
      this.tabs[next]?.click();
      this.tabs[next]?.focus();
    });
    this.content.id = 'settings-panel';
    this.content.className = 'settings-screen__content';
    this.content.setAttribute('role', 'tabpanel');
    this.status.setAttribute('role', 'status');
    this.root.append(
      heading,
      nav,
      this.content,
      this.status,
      this.button(text.back, () => this.hide()),
    );
    this.root.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.hide();
    });
    this.root.addEventListener('keydown', (event) => event.stopPropagation());
    window.addEventListener('keydown', this.keydown, true);
    document.body.append(this.root);
  }

  get visible(): boolean {
    return this.root.open;
  }

  show(): void {
    this.previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    this.selectTab('controls');
    this.root.showModal();
    this.tabs[0]?.focus();
  }

  hide(): void {
    this.capture = null;
    this.root.close();
    this.closed();
    this.previousFocus?.focus();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.keydown, true);
    this.root.remove();
  }

  private readonly keydown = (event: KeyboardEvent): void => {
    if (!this.visible || !this.capture) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    if (event.code === 'Escape') {
      this.capture = null;
      this.refreshBindings();
      return;
    }
    if (!isBindingCode(event.code) || !event.code) {
      this.status.textContent = text.reserved;
      return;
    }
    this.settings.bindings = assignBinding(
      this.settings.bindings,
      this.capture,
      event.code,
    );
    this.capture = null;
    this.persist();
    this.refreshBindings();
  };

  private persist(): void {
    saveSettings(this.settings);
    this.changed();
  }

  private button(label: string, action: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', action);
    return button;
  }

  private selectTab(tab: typeof this.tab): void {
    this.tab = tab;
    this.capture = null;
    this.status.textContent = '';
    this.content.replaceChildren();
    this.bindingButtons.clear();
    this.content.setAttribute('aria-labelledby', `settings-tab-${tab}`);
    for (const button of this.tabs) {
      const selected = button.id === `settings-tab-${tab}`;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    if (tab === 'controls') {
      this.range(
        'mouseSensitivity',
        SETTINGS_RANGES.mouseSensitivity.min,
        SETTINGS_RANGES.mouseSensitivity.max,
        0.1,
      );
      this.checkbox('invertY');
      this.note(text.bindingHint);
      for (const action of actionSchema.options) {
        const row = document.createElement('div');
        row.className = 'settings-screen__row';
        const label = document.createElement('span');
        label.textContent = text.actions[action];
        const button = this.button('', () => {
          this.capture = action;
          this.refreshBindings();
        });
        button.dataset.action = action;
        this.bindingButtons.set(action, button);
        row.append(label, button);
        this.content.append(row);
      }
      this.refreshBindings();
      this.content.append(
        this.button(text.reset, () => {
          this.settings.mouseSensitivity = 1;
          this.settings.invertY = false;
          this.settings.bindings = {};
          this.persist();
          this.selectTab('controls');
          this.tabs[0]?.focus();
        }),
      );
    } else if (tab === 'video') {
      this.range('fov', SETTINGS_RANGES.fov.min, SETTINGS_RANGES.fov.max, 1);
      this.range('screenShake', 0, 1, 0.01, true);
      this.checkbox('flashes');
      const label = document.createElement('label');
      label.className = 'settings-screen__row';
      label.append(text.quality);
      const select = document.createElement('select');
      for (const value of ['low', 'medium', 'high'] as const) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text.qualities[value];
        select.append(option);
      }
      select.value = this.settings.quality;
      select.addEventListener('change', () => {
        this.settings.quality = select.value as Settings['quality'];
        applyQuality(this.settings.quality);
        this.persist();
      });
      label.append(select);
      this.content.append(label);
      this.note(text.qualityHint);
    } else {
      this.range('masterVolume', 0, 1, 0.01, true);
      this.range('sfxVolume', 0, 1, 0.01, true);
      this.range('musicVolume', 0, 1, 0.01, true);
      this.note(text.musicHint);
    }
  }

  private refreshBindings(): void {
    const resolved = resolveBindings(this.settings.bindings);
    this.status.textContent = this.capture ? text.capture : '';
    for (const [action, button] of this.bindingButtons) {
      const keys = Object.entries(resolved)
        .filter(([, owner]) => owner === action)
        .map(([code]) => keyLabel(code));
      const mouse = Object.entries(defaults.mouse)
        .filter(([, owner]) => owner === action)
        .map(([code]) => keyLabel(`mouse${code}`));
      const value = [...(keys.length ? keys : [text.unbound]), ...mouse].join(
        ' / ',
      );
      button.textContent = this.capture === action ? text.capture : value;
      button.setAttribute(
        'aria-label',
        `${text.actions[action]}: ${button.textContent}`,
      );
    }
  }

  private range(
    key:
      | 'mouseSensitivity'
      | 'fov'
      | 'screenShake'
      | 'masterVolume'
      | 'sfxVolume'
      | 'musicVolume',
    min: number,
    max: number,
    step: number,
    percent = false,
  ): void {
    const label = document.createElement('label');
    label.className = 'settings-screen__row';
    label.append(text[key]);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(this.settings[key]);
    input.setAttribute('aria-label', text[key]);
    const output = document.createElement('output');
    const update = (): void => {
      output.textContent = percent
        ? `${Math.round(this.settings[key] * 100)}%`
        : String(this.settings[key]);
    };
    input.addEventListener('input', () => {
      this.settings[key] = Number(input.value);
      update();
      this.persist();
    });
    update();
    label.append(input, output);
    this.content.append(label);
  }

  private checkbox(key: 'invertY' | 'flashes'): void {
    const label = document.createElement('label');
    label.className = 'settings-screen__row';
    label.append(text[key]);
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = this.settings[key];
    input.addEventListener('change', () => {
      this.settings[key] = input.checked;
      this.persist();
    });
    label.append(input);
    this.content.append(label);
  }

  private note(value: string): void {
    const node = document.createElement('p');
    node.textContent = value;
    this.content.append(node);
  }
}
