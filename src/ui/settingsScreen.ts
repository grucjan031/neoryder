import {
  actionSchema,
  assignBinding,
  assignGamepadBinding,
  defaultGamepadSettings,
  isBindingCode,
  isGamepadButton,
  resolveBindings,
} from '../core/input';
import type { Action } from '../core/input';
import type { InputDevice } from '../core/events';
import type { PadFrame } from '../core/input/gamepad';
import { loadSettings, saveSettings, SETTINGS_RANGES } from '../core/save';
import type { Settings } from '../core/save';
import { applyQuality } from '../render/quality';
import text from '../data/ui/settings.pl.json';
import defaults from '../data/inputBindings.json';
import { tuning } from '../core/tuning';
import {
  getInputDevice,
  inputGlyphLabel,
  keyLabel,
  refreshInputGlyphs,
} from './inputGlyphs';
import { PAD_MENU_INPUT } from './padNavigation';
import './settingsScreen.css';

export class SettingsScreen {
  private readonly root = document.createElement('dialog');
  private readonly content = document.createElement('div');
  private readonly status = document.createElement('p');
  private readonly tabs: HTMLButtonElement[] = [];
  private capture: Action | null = null;
  private tab: 'controls' | 'video' | 'audio' | 'pad' = 'controls';
  private padLayout: InputDevice['layout'] = 'generic';
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
    for (const tab of ['controls', 'video', 'audio', 'pad'] as const) {
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
            ? this.tabs.length - 1
            : (index +
                (event.key === 'ArrowRight' ? 1 : this.tabs.length - 1)) %
              this.tabs.length;
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
    this.root.addEventListener(PAD_MENU_INPUT, (event) => {
      if (this.tab !== 'pad') return;
      const frame = (event as CustomEvent<PadFrame>).detail;
      if (this.padLayout !== frame.layout) {
        this.padLayout = frame.layout;
        this.refreshBindings();
      }
      if (!this.capture) return;
      event.preventDefault();
      const index = [...frame.pressed].find(isGamepadButton);
      if (index === undefined) return;
      this.settings.gamepad.bindings = assignGamepadBinding(
        this.settings.gamepad.bindings,
        this.capture,
        index,
      );
      this.capture = null;
      this.persist();
      this.refreshBindings();
    });
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
    this.padLayout = getInputDevice().layout;
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
    if (this.tab === 'pad') return;
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
    refreshInputGlyphs();
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
      this.difficultySelect();
      this.range(
        'mouseSensitivity',
        SETTINGS_RANGES.mouseSensitivity.min,
        SETTINGS_RANGES.mouseSensitivity.max,
        0.1,
      );
      this.checkbox('invertY');
      this.note(text.bindingHint);
      this.bindingRows(
        actionSchema.options.filter((action) => action !== 'pause'),
      );
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
    } else if (tab === 'audio') {
      this.range('masterVolume', 0, 1, 0.01, true);
      this.range('sfxVolume', 0, 1, 0.01, true);
      this.range('musicVolume', 0, 1, 0.01, true);
      this.note(text.musicHint);
    } else {
      const pad = this.settings.gamepad;
      const sensitivity = SETTINGS_RANGES.padSensitivity;
      const deadzone = SETTINGS_RANGES.padDeadzone;
      this.slider(
        text.padSensitivityX,
        pad.sensitivityX,
        sensitivity.min,
        sensitivity.max,
        0.1,
        false,
        (value) => {
          pad.sensitivityX = value;
        },
      );
      this.slider(
        text.padSensitivityY,
        pad.sensitivityY,
        sensitivity.min,
        sensitivity.max,
        0.1,
        false,
        (value) => {
          pad.sensitivityY = value;
        },
      );
      this.slider(
        text.padDeadzone,
        pad.deadzone ?? tuning.gamepad.innerDeadzone,
        deadzone.min,
        deadzone.max,
        0.01,
        true,
        (value) => {
          pad.deadzone = value;
        },
      );
      this.toggle(text.invertY, pad.invertY, (value) => {
        pad.invertY = value;
      });
      this.toggle(text.padAimAssist, pad.aimAssist, (value) => {
        pad.aimAssist = value;
      });
      this.toggle(text.padVibration, pad.vibration, (value) => {
        pad.vibration = value;
      });
      this.slider(
        text.padVibrationStrength,
        pad.vibrationStrength,
        0,
        1,
        0.01,
        true,
        (value) => {
          pad.vibrationStrength = value;
        },
      );
      this.note(text.padBindingHint);
      this.bindingRows(actionSchema.options);
      this.content.append(
        this.button(text.reset, () => {
          this.settings.gamepad = defaultGamepadSettings();
          this.persist();
          this.selectTab('pad');
          this.tabs.at(-1)?.focus();
        }),
      );
    }
  }

  private bindingRows(actions: readonly Action[]): void {
    for (const action of actions) {
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
  }

  private refreshBindings(): void {
    const resolved = resolveBindings(this.settings.bindings);
    const pad = this.tab === 'pad';
    const capture = pad ? text.padCapture : text.capture;
    this.status.textContent = this.capture ? capture : '';
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
      button.textContent =
        this.capture === action
          ? capture
          : pad
            ? (inputGlyphLabel(
                action,
                { device: 'gamepad', layout: this.padLayout },
                this.settings,
              ) ?? text.padUnbound)
            : value;
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
    this.slider(
      text[key],
      this.settings[key],
      min,
      max,
      step,
      percent,
      (value) => {
        this.settings[key] = value;
      },
    );
  }

  private slider(
    labelText: string,
    initial: number,
    min: number,
    max: number,
    step: number,
    percent: boolean,
    changed: (value: number) => void,
  ): void {
    const label = document.createElement('label');
    label.className = 'settings-screen__row';
    label.append(labelText);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(initial);
    input.setAttribute('aria-label', labelText);
    const output = document.createElement('output');
    const update = (): void => {
      output.textContent = percent
        ? `${Math.round(Number(input.value) * 100)}%`
        : input.value;
    };
    input.addEventListener('input', () => {
      changed(Number(input.value));
      update();
      this.persist();
    });
    update();
    label.append(input, output);
    this.content.append(label);
  }

  private difficultySelect(): void {
    const label = document.createElement('label');
    label.className = 'settings-screen__row';
    label.append(text.difficulty);
    const select = document.createElement('select');
    select.dataset.setting = 'difficulty';
    for (const value of ['easy', 'normal', 'hard', 'nightmare'] as const) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text.difficulties[value];
      select.append(option);
    }
    select.value = this.settings.difficulty ?? 'normal';
    select.addEventListener('change', () => {
      this.settings.difficulty = select.value as NonNullable<
        Settings['difficulty']
      >;
      this.persist();
    });
    label.append(select);
    this.content.append(label);
    this.note(text.difficultyHint);
  }

  private checkbox(key: 'invertY' | 'flashes'): void {
    this.toggle(text[key], this.settings[key], (value) => {
      this.settings[key] = value;
    });
  }

  private toggle(
    labelText: string,
    initial: boolean,
    changed: (value: boolean) => void,
  ): void {
    const label = document.createElement('label');
    label.className = 'settings-screen__row';
    label.append(labelText);
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = initial;
    input.addEventListener('change', () => {
      changed(input.checked);
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
