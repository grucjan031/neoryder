import { playUiSound } from '../../audio/uiSounds';
import uiText from '../../data/ui/ui.pl.json';
import { el, uniqueId } from './dom';
import { bindUiFeedback } from './feedback';

/** Wiersz listy ustawień: tytuł, opis i kontrolka po prawej. Fokus wewnątrz podświetla cały wiersz. */
export function uiRow(options: {
  title: string;
  description?: string;
  control: HTMLElement;
  /** Id tytułu, do którego odwołuje się `aria-labelledby` kontrolki. */
  titleId?: string;
}): HTMLElement {
  const row = el('div', 'ui-list-item ui-list-item--no-icon ui-interactive');
  const text = el('div');
  const title = el('span', 'ui-list-item__title', options.title);
  if (options.titleId) title.id = options.titleId;
  text.append(title);
  if (options.description)
    text.append(el('span', 'ui-list-item__desc', options.description));
  row.append(text, options.control);
  row.style.cursor = 'default';
  return row;
}

export interface UiToggle {
  readonly node: HTMLButtonElement;
  setValue(value: boolean): void;
}

export function createToggle(options: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}): UiToggle {
  const node = el('button', 'ui-toggle ui-interactive');
  node.type = 'button';
  node.setAttribute('role', 'switch');
  node.setAttribute('aria-label', options.label);
  const track = el('span', 'ui-toggle__track');
  const state = el('span', 'ui-toggle__state');
  node.append(track, state);
  let value = options.value;
  const render = (): void => {
    node.setAttribute('aria-checked', String(value));
    state.textContent = value ? uiText.on : uiText.off;
  };
  node.addEventListener('click', () => {
    value = !value;
    render();
    options.onChange(value);
  });
  bindUiFeedback(node, 'tab');
  render();
  return {
    node,
    setValue(next) {
      value = next;
      render();
    },
  };
}

export interface UiSlider {
  readonly root: HTMLElement;
  readonly input: HTMLInputElement;
}

export function createSlider(options: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Zapis wartości (np. procent); domyślnie liczba. */
  format?: (value: number) => string;
  onInput: (value: number) => void;
}): UiSlider {
  const root = el('div', 'ui-slider');
  const input = el('input', 'ui-slider__input');
  input.type = 'range';
  input.min = String(options.min);
  input.max = String(options.max);
  input.step = String(options.step);
  input.value = String(options.value);
  input.setAttribute('aria-label', options.label);
  const output = el('output', 'ui-slider__value');
  const format = options.format ?? ((value: number) => String(value));
  const render = (): void => {
    const value = Number(input.value);
    const span = options.max - options.min || 1;
    input.style.setProperty(
      '--fill',
      `${(((value - options.min) / span) * 100).toFixed(2)}%`,
    );
    output.textContent = format(value);
    input.setAttribute('aria-valuetext', format(value));
  };
  // Tik przy zmianie o kilka kroków, nie przy każdym pikselu przeciągania.
  let lastTick = options.value;
  input.addEventListener('input', () => {
    render();
    options.onInput(Number(input.value));
    const step = Number(input.step) || 1;
    if (Math.abs(Number(input.value) - lastTick) >= step * 2) {
      lastTick = Number(input.value);
      playUiSound('tab');
    }
  });
  bindUiFeedback(input, false);
  render();
  root.append(input, output);
  return { root, input };
}

export interface UiStepper {
  readonly node: HTMLElement;
  setIndex(index: number): void;
}

/** Stepper ◀ wartość ▶: strzałki klawiatury, kliknięcie w ◀ ▶ i lewo/prawo z pada. */
export function createStepper<T>(options: {
  label: string;
  values: readonly T[];
  index: number;
  format: (value: T) => string;
  onChange: (value: T, index: number) => void;
}): UiStepper {
  const node = el('div', 'ui-stepper ui-interactive');
  node.tabIndex = 0;
  node.setAttribute('role', 'spinbutton');
  node.setAttribute('aria-label', options.label);
  node.setAttribute('aria-valuemin', '0');
  node.setAttribute('aria-valuemax', String(options.values.length - 1));
  node.dataset.padAdjust = '';
  const prev = el('span', 'ui-stepper__arrow', '◀');
  const value = el('span', 'ui-stepper__value');
  const next = el('span', 'ui-stepper__arrow', '▶');
  for (const arrow of [prev, next]) arrow.setAttribute('aria-hidden', 'true');
  node.append(prev, value, next);
  let index = options.index;
  const render = (): void => {
    const current = options.values[index];
    value.textContent = current === undefined ? '' : options.format(current);
    node.setAttribute('aria-valuenow', String(index));
    node.setAttribute('aria-valuetext', value.textContent);
    prev.dataset.disabled = String(index <= 0);
    next.dataset.disabled = String(index >= options.values.length - 1);
  };
  const step = (direction: 1 | -1): void => {
    const picked = options.values[index + direction];
    if (picked === undefined) {
      playUiSound('error');
      return;
    }
    index += direction;
    render();
    playUiSound('tab');
    options.onChange(picked, index);
  };
  prev.addEventListener('click', () => {
    node.focus();
    step(-1);
  });
  next.addEventListener('click', () => {
    node.focus();
    step(1);
  });
  node.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') step(-1);
    else if (event.key === 'ArrowRight') step(1);
    else return;
    event.preventDefault();
  });
  bindUiFeedback(node, false);
  render();
  return {
    node,
    setIndex(target) {
      index = target;
      render();
    },
  };
}

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface UiSelect<T extends string> {
  readonly root: HTMLElement;
  readonly trigger: HTMLButtonElement;
  readonly value: T;
  setValue(value: T): void;
  close(): void;
}

/**
 * Własna lista rozwijana (zamiast natywnego `select`). Lista jest dopinana do okna nadrzędnego,
 * reszta okna dostaje `inert` (fokus pada i Tab zostają w liście), Esc zamyka listę, nie okno.
 */
export function createSelect<T extends string>(options: {
  label: string;
  options: readonly SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Id elementu z tytułem wiersza (nazwa dostępna = tytuł + wartość). */
  labelledBy?: string;
}): UiSelect<T> {
  const root = el('div', 'ui-select');
  const trigger = el('button', 'ui-select__trigger ui-interactive');
  trigger.type = 'button';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.dataset.padAdjust = '';
  const current = el('span', 'ui-select__current');
  current.id = uniqueId('ui-select-value');
  trigger.append(current);
  if (options.labelledBy)
    trigger.setAttribute(
      'aria-labelledby',
      `${options.labelledBy} ${current.id}`,
    );
  else trigger.setAttribute('aria-label', options.label);
  const list = el('div', 'ui-select__list ui-scroll');
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', options.label);
  list.hidden = true;
  root.append(trigger);
  let value = options.value;
  let inerted: HTMLElement[] = [];
  const labelOf = (item: T): string =>
    options.options.find((option) => option.value === item)?.label ?? '';
  const renderValue = (): void => {
    current.textContent = labelOf(value);
  };
  const outside = (event: Event): void => {
    const target = event.target;
    if (
      target instanceof Node &&
      (list.contains(target) || trigger.contains(target))
    )
      return;
    close(false);
  };
  const onResize = (): void => close(false);
  function close(focus = true): void {
    if (list.hidden) return;
    list.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    for (const node of inerted) node.inert = false;
    inerted = [];
    document.removeEventListener('pointerdown', outside, true);
    window.removeEventListener('resize', onResize);
    list.remove();
    if (focus) trigger.focus();
  }
  const choose = (next: T): void => {
    const changed = next !== value;
    value = next;
    renderValue();
    close();
    if (changed) {
      playUiSound('tab');
      options.onChange(next);
    }
  };
  for (const option of options.options) {
    const node = el('button', 'ui-select__option ui-interactive', option.label);
    node.type = 'button';
    node.setAttribute('role', 'option');
    node.dataset.value = option.value;
    node.addEventListener('click', () => choose(option.value));
    bindUiFeedback(node, false);
    list.append(node);
  }
  list.addEventListener('keydown', (event) => {
    const items = [...list.querySelectorAll<HTMLElement>('[role="option"]')];
    const index = items.indexOf(document.activeElement as HTMLElement);
    let target: number;
    if (event.key === 'ArrowDown')
      target = Math.min(items.length - 1, index + 1);
    else if (event.key === 'ArrowUp') target = Math.max(0, index - 1);
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = items.length - 1;
    else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      playUiSound('back');
      close();
      return;
    } else {
      if (event.key === 'Tab') event.preventDefault();
      return;
    }
    event.preventDefault();
    items[target]?.focus();
  });
  function open(): void {
    if (!list.hidden) return;
    const host =
      trigger.closest<HTMLElement>('dialog, .ui-screen, .main-menu') ??
      document.body;
    for (const option of list.querySelectorAll<HTMLElement>('[role="option"]'))
      option.setAttribute(
        'aria-selected',
        String(option.dataset.value === value),
      );
    const rect = trigger.getBoundingClientRect();
    host.append(list);
    list.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    const room = window.innerHeight;
    const below = room - rect.bottom - 8;
    const up =
      below < Math.min(list.scrollHeight, room * 0.5) && rect.top > below;
    list.style.minWidth = `${rect.width}px`;
    list.style.left = `${rect.left}px`;
    list.style.maxHeight = `${Math.max(120, up ? rect.top - 8 : below)}px`;
    if (up) {
      list.style.top = 'auto';
      list.style.bottom = `${room - rect.top + 4}px`;
    } else {
      list.style.bottom = 'auto';
      list.style.top = `${rect.bottom + 4}px`;
    }
    inerted = [...host.children].filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child !== list && !child.inert,
    );
    for (const node of inerted) node.inert = true;
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('resize', onResize);
    list.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
  }
  trigger.addEventListener('click', () => {
    if (list.hidden) open();
    else close();
  });
  trigger.addEventListener('keydown', (event) => {
    const delta =
      event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const index = options.options.findIndex((item) => item.value === value);
    const target = options.options[index + delta];
    if (target) choose(target.value);
    else playUiSound('error');
  });
  bindUiFeedback(trigger, 'confirm');
  renderValue();
  return {
    root,
    trigger,
    get value() {
      return value;
    },
    setValue(next) {
      value = next;
      renderValue();
    },
    close,
  };
}

export function uiBadge(
  text: string,
  tone: 'accent' | 'success' | 'neutral' = 'accent',
): HTMLSpanElement {
  const node = el('span', 'ui-badge', text);
  if (tone !== 'accent') node.classList.add(`ui-badge--${tone}`);
  return node;
}

export interface UiProgress {
  readonly root: HTMLElement;
  /** 0..1; `null` = postęp nieokreślony. */
  set(value: number | null): void;
}

export function createProgress(label: string): UiProgress {
  const root = el('div', 'ui-progress');
  root.setAttribute('role', 'progressbar');
  root.setAttribute('aria-label', label);
  root.setAttribute('aria-valuemin', '0');
  root.setAttribute('aria-valuemax', '100');
  root.append(el('div', 'ui-progress__bar'));
  const api: UiProgress = {
    root,
    set(value) {
      root.classList.toggle('ui-progress--indeterminate', value === null);
      if (value === null) {
        root.removeAttribute('aria-valuenow');
        root.style.removeProperty('--progress');
        return;
      }
      const clamped = Math.min(1, Math.max(0, value));
      root.style.setProperty('--progress', String(clamped));
      root.setAttribute('aria-valuenow', String(Math.round(clamped * 100)));
    },
  };
  api.set(null);
  return api;
}
