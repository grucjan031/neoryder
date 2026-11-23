import { setInputHint } from '../inputGlyphs';
import { bindUiFeedback } from './feedback';
import { el } from './dom';

export interface ActionBarItem {
  /** Szablon podpowiedzi klawiatury, np. `{confirm}`; glify zależą od urządzenia. */
  keys: string;
  /** Szablon dla pada (domyślnie jak `keys`, bo `{name}` sam wybiera glif urządzenia). */
  padKeys?: string;
  label: string;
  /** Z akcją element jest przyciskiem (klik na podpowiedź wykonuje akcję). */
  onClick?: () => void;
  /** Identyfikator akcji (`data-action`), np. do selektorów testów. */
  id?: string;
  /** Przyciski wskazują zawsze na prawo (np. „Wróć”). */
  end?: boolean;
  /** Element jest tylko podpowiedzią; pomijany przez czytniki (duplikuje inny przycisk). */
  decorative?: boolean;
}

export interface UiActionBar {
  readonly root: HTMLElement;
  setItems(items: readonly ActionBarItem[]): void;
}

/**
 * Dolny pasek akcji ekranu: glify z `inputGlyphs` zmieniają się z urządzeniem
 * (`input:deviceChanged`), a klik na podpowiedź z `onClick` wykonuje akcję.
 */
export function createActionBar(items: readonly ActionBarItem[]): UiActionBar {
  const root = el('div', 'ui-actionbar');
  root.dataset.testid = 'action-bar';
  const api: UiActionBar = {
    root,
    setItems(next) {
      root.replaceChildren(
        ...next.map((item) => {
          const node = item.onClick
            ? el('button', 'ui-actionbar__item')
            : el('span', 'ui-actionbar__item');
          if (item.end) node.classList.add('ui-actionbar__item--end');
          const keys = el('span', 'ui-actionbar__keys');
          setInputHint(keys, item.keys, item.padKeys ?? item.keys);
          node.append(keys, el('span', 'ui-actionbar__label', item.label));
          if (
            item.onClick instanceof Function &&
            node instanceof HTMLButtonElement
          ) {
            node.type = 'button';
            if (item.id) node.dataset.action = item.id;
            node.setAttribute('aria-label', item.label);
            node.addEventListener('click', item.onClick);
            bindUiFeedback(node, item.end ? 'back' : 'confirm');
          }
          if (item.decorative) node.setAttribute('aria-hidden', 'true');
          return node;
        }),
      );
    },
  };
  api.setItems(items);
  return api;
}
