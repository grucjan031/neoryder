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
import {
  defaultSettings,
  loadSettings,
  saveSettings,
  SETTINGS_RANGES,
} from '../core/save';
import type { Settings } from '../core/save';
import { applyQuality } from '../render/quality';
import text from '../data/ui/settings.pl.json';
import uiText from '../data/ui/ui.pl.json';
import defaults from '../data/inputBindings.json';
import { tuning } from '../core/tuning';
import { playUiSound } from '../audio/uiSounds';
import {
  getInputDevice,
  inputGlyphLabel,
  keyLabel,
  refreshInputGlyphs,
} from './inputGlyphs';
import { PAD_MENU_INPUT } from './padNavigation';
import { createActionBar } from './components/actionBar';
import { bindUiFeedback } from './components/feedback';
import { createScreen } from './components/screen';
import { createTabs } from './components/tabs';
import {
  createSelect,
  createSlider,
  createStepper,
  createToggle,
  uiRow,
} from './components/controls';
import { el, uniqueId } from './components/dom';
import { uiConfirm } from './components/modal';
import { uiLayers } from './layers';
import { applyUiSettings } from './theme/applySettings';
import './settingsScreen.css';

type TabId = 'gameplay' | 'graphics' | 'audio' | 'keyboard' | 'pad' | 'access';
const tabIds: readonly TabId[] = [
  'gameplay',
  'graphics',
  'audio',
  'keyboard',
  'pad',
  'access',
];
const scaleSteps = [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4] as const;
const percent = (value: number): string => `${Math.round(value * 100)}%`;

type SliderKey =
  | 'mouseSensitivity'
  | 'fov'
  | 'screenShake'
  | 'masterVolume'
  | 'sfxVolume'
  | 'musicVolume'
  | 'uiVolume';

export class SettingsScreen {
  private readonly actionBar = createActionBar([]);
  private readonly screen = createScreen({
    element: 'dialog',
    className: 'settings-screen',
    title: text.title,
    path: text.path,
    actionBar: this.actionBar,
  });
  private readonly root = this.screen.root;
  private readonly content = el('div', 'settings-screen__content ui-scroll');
  private readonly status = el('p', 'settings-screen__status');
  private readonly tabs = createTabs({
    prefix: 'settings',
    label: text.tabsLabel,
    tabs: tabIds.map((id) => ({ id, label: text.tabs[id] })),
    onSelect: (id) => this.renderTab(id as TabId),
  });
  private capture: Action | null = null;
  private tab: TabId = 'gameplay';
  private padLayout: InputDevice['layout'] = 'generic';
  private removeLayer: (() => void) | null = null;
  private readonly bindingButtons = new Map<Action, HTMLButtonElement>();

  constructor(
    private readonly settings: Settings = loadSettings(),
    private readonly changed: () => void = () => {},
    private readonly closed: () => void = () => {},
  ) {
    this.screen.header.append(this.tabs.root, this.status);
    this.content.id = 'settings-panel';
    this.content.setAttribute('role', 'tabpanel');
    this.status.setAttribute('role', 'status');
    this.screen.body.append(this.content);
    this.refreshActionBar();

    this.root.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.hide();
    });
    this.root.addEventListener('keydown', (event) => {
      event.stopPropagation();
      this.hotkeys(event);
    });
    this.root.addEventListener(PAD_MENU_INPUT, (event) => {
      const frame = (event as CustomEvent<PadFrame>).detail;
      if (this.padLayout !== frame.layout) {
        this.padLayout = frame.layout;
        if (this.tab === 'pad') this.refreshBindings();
      }
      if (this.capture && this.tab === 'pad') {
        event.preventDefault();
        const index = [...frame.pressed].find(isGamepadButton);
        if (index === undefined) return;
        this.settings.gamepad.bindings = assignGamepadBinding(
          this.settings.gamepad.bindings,
          this.capture,
          index,
        );
        this.capture = null;
        playUiSound('confirm');
        this.persist();
        this.refreshBindings();
        return;
      }
      if (this.capture) return;
      if (frame.pressed.has(4)) this.tabs.cycle(-1);
      else if (frame.pressed.has(5)) this.tabs.cycle(1);
      else if (frame.pressed.has(3)) void this.reset();
    });
    window.addEventListener('keydown', this.keydown, true);
    document.body.append(this.root);
  }

  get visible(): boolean {
    return this.root.open;
  }

  show(): void {
    this.padLayout = getInputDevice().layout;
    this.tabs.select('gameplay');
    this.removeLayer?.();
    this.removeLayer = uiLayers.push(this.root, () => this.hide());
    this.root.showModal();
    this.tabs.buttons.get('gameplay')?.focus();
  }

  hide(): void {
    if (!this.root.open && !this.removeLayer) return;
    this.capture = null;
    this.root.close();
    // Fokus wraca do elementu, który otworzył ekran (menedżer warstw).
    const remove = this.removeLayer;
    this.removeLayer = null;
    remove?.();
    this.closed();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.keydown, true);
    this.removeLayer?.();
    this.removeLayer = null;
    this.root.remove();
  }

  private refreshActionBar(): void {
    this.actionBar.setItems([
      { keys: '{navigate}', label: uiText.navigate, decorative: true },
      { keys: '{confirm}', label: uiText.select, decorative: true },
      { keys: '{tabs}', label: uiText.tabs, decorative: true },
      {
        keys: '{reset}',
        label: uiText.reset,
        onClick: () => void this.reset(),
      },
      {
        keys: '{back}',
        label: uiText.back,
        onClick: () => this.hide(),
        end: true,
      },
    ]);
  }

  private hotkeys(event: KeyboardEvent): void {
    if (this.capture || event.ctrlKey || event.altKey || event.metaKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('[role="listbox"]'))
      return;
    if (event.code === 'KeyQ') this.tabs.cycle(-1);
    else if (event.code === 'KeyE') this.tabs.cycle(1);
    else if (event.code === 'KeyR') void this.reset();
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (target instanceof HTMLInputElement && target.type === 'range') return;
      const items = [
        ...this.content.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, [tabindex="0"]',
        ),
      ];
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next = items[index + (event.key === 'ArrowDown' ? 1 : -1)];
      if (index < 0 || !next) return;
      next.focus();
    } else return;
    event.preventDefault();
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
      playUiSound('error');
      this.status.textContent = text.reserved;
      return;
    }
    this.settings.bindings = assignBinding(
      this.settings.bindings,
      this.capture,
      event.code,
    );
    this.capture = null;
    playUiSound('confirm');
    this.persist();
    this.refreshBindings();
  };

  private persist(): void {
    saveSettings(this.settings);
    refreshInputGlyphs();
    applyUiSettings(this.settings);
    this.changed();
  }

  private async reset(): Promise<void> {
    if (this.capture) return;
    const confirmed = await uiConfirm({
      title: text.resetTitle,
      message: text.resetMessage,
      confirmLabel: text.resetConfirm,
      cancelLabel: uiText.cancel,
      destructive: true,
    });
    if (!confirmed) return;
    const base = defaultSettings();
    const settings = this.settings;
    switch (this.tab) {
      case 'gameplay':
        settings.fov = base.fov;
        break;
      case 'graphics':
        settings.quality = base.quality;
        applyQuality(settings.quality);
        break;
      case 'audio':
        settings.masterVolume = base.masterVolume;
        settings.sfxVolume = base.sfxVolume;
        settings.musicVolume = base.musicVolume;
        settings.uiVolume = base.uiVolume;
        break;
      case 'keyboard':
        settings.mouseSensitivity = base.mouseSensitivity;
        settings.invertY = base.invertY;
        settings.bindings = {};
        break;
      case 'pad':
        settings.gamepad = defaultGamepadSettings();
        break;
      case 'access':
        settings.uiScale = base.uiScale;
        settings.reduceMotion = base.reduceMotion;
        settings.flashes = base.flashes;
        settings.cameraTilt = base.cameraTilt;
        settings.screenShake = base.screenShake;
        break;
    }
    this.persist();
    this.renderTab(this.tab);
    this.status.textContent = text.resetDone;
    this.tabs.buttons.get(this.tab)?.focus();
  }

  private renderTab(tab: TabId): void {
    this.tab = tab;
    this.capture = null;
    this.status.textContent = text.autoSave;
    this.content.replaceChildren();
    this.content.scrollTop = 0;
    this.bindingButtons.clear();
    this.content.setAttribute('aria-labelledby', `settings-tab-${tab}`);
    this.root.dataset.tab = tab;
    const s = this.settings;
    if (tab === 'gameplay') {
      this.difficultyRow();
      this.sliderRow(
        'fov',
        text.fov,
        text.fovHint,
        SETTINGS_RANGES.fov.min,
        SETTINGS_RANGES.fov.max,
        1,
      );
    } else if (tab === 'graphics') {
      this.selectRow({
        title: text.quality,
        description: text.qualityHint,
        options: (['low', 'medium', 'high'] as const).map((value) => ({
          value,
          label: text.qualities[value],
        })),
        value: s.quality,
        onChange: (value) => {
          s.quality = value;
          applyQuality(s.quality);
          this.persist();
        },
      });
    } else if (tab === 'audio') {
      this.sliderRow(
        'masterVolume',
        text.masterVolume,
        undefined,
        0,
        1,
        0.01,
        true,
      );
      this.sliderRow('sfxVolume', text.sfxVolume, undefined, 0, 1, 0.01, true);
      this.sliderRow(
        'musicVolume',
        text.musicVolume,
        text.musicHint,
        0,
        1,
        0.01,
        true,
      );
      this.sliderRow(
        'uiVolume',
        text.uiVolume,
        text.uiVolumeHint,
        0,
        1,
        0.01,
        true,
      );
    } else if (tab === 'keyboard') {
      this.sliderRow(
        'mouseSensitivity',
        text.mouseSensitivity,
        text.mouseSensitivityHint,
        SETTINGS_RANGES.mouseSensitivity.min,
        SETTINGS_RANGES.mouseSensitivity.max,
        0.1,
      );
      this.toggleRow(text.invertY, text.invertYHint, s.invertY, (value) => {
        s.invertY = value;
      });
      this.note(text.bindingHint);
      this.bindingRows(
        actionSchema.options.filter((action) => action !== 'pause'),
      );
    } else if (tab === 'pad') {
      const pad = s.gamepad;
      const sensitivity = SETTINGS_RANGES.padSensitivity;
      const deadzone = SETTINGS_RANGES.padDeadzone;
      this.slider(
        text.padSensitivityX,
        undefined,
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
        undefined,
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
        undefined,
        pad.deadzone ?? tuning.gamepad.innerDeadzone,
        deadzone.min,
        deadzone.max,
        0.01,
        true,
        (value) => {
          pad.deadzone = value;
        },
      );
      this.toggleRow(text.invertY, undefined, pad.invertY, (value) => {
        pad.invertY = value;
      });
      this.toggleRow(text.padAimAssist, undefined, pad.aimAssist, (value) => {
        pad.aimAssist = value;
      });
      this.toggleRow(text.padVibration, undefined, pad.vibration, (value) => {
        pad.vibration = value;
      });
      this.slider(
        text.padVibrationStrength,
        undefined,
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
    } else {
      this.stepperRow();
      this.toggleRow(
        text.reduceMotion,
        text.reduceMotionHint,
        s.reduceMotion,
        (value) => {
          s.reduceMotion = value;
        },
      );
      this.toggleRow(text.flashes, text.flashesHint, s.flashes, (value) => {
        s.flashes = value;
      });
      this.toggleRow(
        text.cameraTilt,
        text.cameraTiltHint,
        s.cameraTilt,
        (value) => {
          s.cameraTilt = value;
        },
      );
      this.sliderRow(
        'screenShake',
        text.screenShake,
        text.screenShakeHint,
        0,
        1,
        0.01,
        true,
      );
    }
  }

  private note(value: string): void {
    this.content.append(el('p', 'settings-screen__note', value));
  }

  private sliderRow(
    key: SliderKey,
    title: string,
    description: string | undefined,
    min: number,
    max: number,
    step: number,
    asPercent = false,
  ): void {
    this.slider(
      title,
      description,
      this.settings[key],
      min,
      max,
      step,
      asPercent,
      (value) => {
        this.settings[key] = value;
      },
    );
  }

  private slider(
    title: string,
    description: string | undefined,
    initial: number,
    min: number,
    max: number,
    step: number,
    asPercent: boolean,
    changed: (value: number) => void,
  ): void {
    const slider = createSlider({
      label: title,
      value: initial,
      min,
      max,
      step,
      format: asPercent
        ? percent
        : (value) => String(Math.round(value * 100) / 100),
      onInput: (value) => {
        changed(value);
        this.persist();
      },
    });
    this.content.append(uiRow({ title, description, control: slider.root }));
  }

  private toggleRow(
    title: string,
    description: string | undefined,
    initial: boolean,
    changed: (value: boolean) => void,
  ): void {
    const toggle = createToggle({
      label: title,
      value: initial,
      onChange: (value) => {
        changed(value);
        this.persist();
      },
    });
    this.content.append(uiRow({ title, description, control: toggle.node }));
  }

  private selectRow<T extends string>(options: {
    title: string;
    description?: string;
    options: { value: T; label: string }[];
    value: T;
    onChange: (value: T) => void;
    dataSetting?: string;
  }): void {
    const titleId = uniqueId('settings-row');
    const select = createSelect({
      label: options.title,
      options: options.options,
      value: options.value,
      onChange: options.onChange,
      labelledBy: titleId,
    });
    if (options.dataSetting)
      select.trigger.dataset.setting = options.dataSetting;
    this.content.append(
      uiRow({
        title: options.title,
        description: options.description,
        control: select.root,
        titleId,
      }),
    );
  }

  private difficultyRow(): void {
    this.selectRow({
      title: text.difficulty,
      description: text.difficultyHint,
      dataSetting: 'difficulty',
      options: (['easy', 'normal', 'hard', 'nightmare'] as const).map(
        (value) => ({ value, label: text.difficulties[value] }),
      ),
      value: this.settings.difficulty ?? 'normal',
      onChange: (value) => {
        this.settings.difficulty = value;
        this.persist();
      },
    });
  }

  private stepperRow(): void {
    const found = scaleSteps.findIndex(
      (step) => Math.abs(step - this.settings.uiScale) < 0.05,
    );
    const stepper = createStepper({
      label: text.uiScale,
      values: scaleSteps,
      index: Math.max(0, found),
      format: percent,
      onChange: (value) => {
        this.settings.uiScale = value;
        this.persist();
      },
    });
    this.content.append(
      uiRow({
        title: text.uiScale,
        description: text.uiScaleHint,
        control: stepper.node,
      }),
    );
  }

  private bindingRows(actions: readonly Action[]): void {
    for (const action of actions) {
      const button = el('button', 'settings-screen__binding ui-interactive');
      button.type = 'button';
      button.dataset.action = action;
      button.addEventListener('click', () => {
        this.capture = action;
        this.refreshBindings();
      });
      bindUiFeedback(button, 'confirm');
      this.bindingButtons.set(action, button);
      this.content.append(
        uiRow({ title: text.actions[action], control: button }),
      );
    }
    this.refreshBindings();
  }

  private refreshBindings(): void {
    const resolved = resolveBindings(this.settings.bindings);
    const pad = this.tab === 'pad';
    const capture = pad ? text.padCapture : text.capture;
    this.status.textContent = this.capture ? capture : text.autoSave;
    for (const [action, button] of this.bindingButtons) {
      const keys = Object.entries(resolved)
        .filter(([, owner]) => owner === action)
        .map(([code]) => keyLabel(code));
      const mouse = Object.entries(defaults.mouse)
        .filter(([, owner]) => owner === action)
        .map(([code]) => keyLabel(`mouse${code}`));
      const capturing = this.capture === action;
      button.textContent = capturing
        ? capture
        : pad
          ? (inputGlyphLabel(
              action,
              { device: 'gamepad', layout: this.padLayout },
              this.settings,
            ) ?? text.padUnbound)
          : [...keys, ...mouse].join(' / ') || text.unbound;
      button.classList.toggle('is-capturing', capturing);
      button.setAttribute(
        'aria-label',
        `${text.actions[action]}: ${button.textContent}`,
      );
    }
  }
}
