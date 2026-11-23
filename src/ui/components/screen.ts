import { el, uniqueId } from './dom';
import type { UiActionBar } from './actionBar';

export interface UiScreen<T extends HTMLElement> {
  readonly root: T;
  readonly header: HTMLElement;
  readonly body: HTMLElement;
  readonly footer: HTMLElement;
  setTitle(title: string, path?: string): void;
}

/**
 * Pełny ekran (`ui-screen`): nagłówek z ścieżką i tytułem, treść, dolny pasek akcji.
 * Z `dialog` ekran jest oknem modalnym (Esc = `cancel`, reszta strony nieaktywna).
 */
export function createScreen<K extends 'dialog' | 'div'>(options: {
  element: K;
  className?: string;
  title: string;
  /** Ścieżka nad tytułem, np. „Menu główne”. */
  path?: string;
  actionBar: UiActionBar;
}): UiScreen<HTMLElementTagNameMap[K]> {
  const root = el(
    options.element,
    `ui-screen ui-scope ${options.className ?? ''}`.trim(),
  );
  const header = el('header', 'ui-screen__header');
  const kicker = el('p', 'ui-kicker');
  const title = el('h1', 'ui-title');
  const titleId = uniqueId('ui-screen-title');
  title.id = titleId;
  header.append(kicker, title);
  const body = el('div', 'ui-screen__body');
  const footer = el('footer', 'ui-screen__footer');
  footer.append(options.actionBar.root);
  root.append(header, body, footer);
  root.setAttribute('aria-labelledby', titleId);
  const api: UiScreen<HTMLElementTagNameMap[K]> = {
    root,
    header,
    body,
    footer,
    setTitle(text, path) {
      title.textContent = text;
      kicker.textContent = path ?? '';
      kicker.hidden = !path;
      root.setAttribute('aria-label', text);
    },
  };
  api.setTitle(options.title, options.path);
  return api;
}
