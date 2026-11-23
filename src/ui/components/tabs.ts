import { playUiSound } from '../../audio/uiSounds';
import { el } from './dom';
import { bindUiFeedback } from './feedback';

export interface TabDefinition {
  id: string;
  label: string;
}

export interface UiTabs {
  readonly root: HTMLElement;
  readonly buttons: ReadonlyMap<string, HTMLButtonElement>;
  readonly selected: string;
  select(id: string, focus?: boolean): void;
  /** LB/RB i Q/E: przesuwa wybór o `direction` (zapętlone). */
  cycle(direction: 1 | -1): void;
}

/**
 * Zakładki (WAI-ARIA tablist): strzałki, Home/End, `cycle` dla LB/RB i Q/E.
 * Identyfikator przycisku to `${prefix}-tab-${id}`; panel treści ma `${prefix}-panel`.
 */
export function createTabs(options: {
  prefix: string;
  tabs: readonly TabDefinition[];
  label: string;
  /** Pionowa lista (strzałki góra/dół zamiast lewo/prawo). */
  vertical?: boolean;
  onSelect: (id: string) => void;
}): UiTabs {
  const root = el('div', 'ui-tabs');
  const list = el('div', 'ui-tabs__list');
  list.setAttribute('role', 'tablist');
  list.setAttribute('aria-label', options.label);
  const [prevKey, nextKey] = options.vertical
    ? (['ArrowUp', 'ArrowDown'] as const)
    : (['ArrowLeft', 'ArrowRight'] as const);
  if (options.vertical) {
    list.setAttribute('aria-orientation', 'vertical');
    root.classList.add('ui-tabs--vertical');
  }
  const buttons = new Map<string, HTMLButtonElement>();
  let selected = options.tabs[0]?.id ?? '';
  const order = options.tabs.map((tab) => tab.id);

  const api: UiTabs = {
    root,
    buttons,
    get selected() {
      return selected;
    },
    select(id, focus = false) {
      if (!buttons.has(id)) return;
      selected = id;
      for (const [key, button] of buttons) {
        const on = key === id;
        button.setAttribute('aria-selected', String(on));
        button.tabIndex = on ? 0 : -1;
      }
      options.onSelect(id);
      if (focus) buttons.get(id)?.focus();
    },
    cycle(direction) {
      const index = order.indexOf(selected);
      const next = order[(index + direction + order.length) % order.length];
      if (next && next !== selected) {
        playUiSound('tab');
        api.select(next, true);
      }
    },
  };

  for (const tab of options.tabs) {
    const button = el('button', 'ui-tab ui-interactive', tab.label);
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.id = `${options.prefix}-tab-${tab.id}`;
    button.setAttribute('aria-controls', `${options.prefix}-panel`);
    button.addEventListener('click', () => {
      if (selected !== tab.id) playUiSound('tab');
      api.select(tab.id);
    });
    bindUiFeedback(button, false);
    buttons.set(tab.id, button);
    list.append(button);
  }
  list.addEventListener('keydown', (event) => {
    if (![prevKey, nextKey, 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = order.indexOf(selected);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? order.length - 1
          : (index + (event.key === nextKey ? 1 : -1) + order.length) %
            order.length;
    const id = order[next];
    if (id) {
      playUiSound('tab');
      api.select(id, true);
    }
  });
  root.append(list);
  return api;
}
