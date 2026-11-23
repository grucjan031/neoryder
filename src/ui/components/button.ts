import type { UiSoundName } from '../../audio/uiSounds';
import { el } from './dom';
import { bindUiFeedback } from './feedback';

export type ButtonVariant =
  'primary' | 'secondary' | 'ghost' | 'quiet' | 'destructive';

export interface ButtonOptions {
  label: string;
  onClick?: () => void;
  variant?: ButtonVariant;
  /** Druga linia pod etykietą. */
  description?: string;
  /** Wartość/stan po prawej stronie. */
  side?: string;
  /** Dźwięk po kliknięciu (domyślnie potwierdzenie). */
  sound?: UiSoundName | false;
}

/**
 * Przycisk interfejsu. Nazwa dostępna to zawsze `label` (opis idzie do `aria-description`),
 * dzięki czemu selektory ról nie zależą od tekstu pomocniczego.
 */
export function uiButton(options: ButtonOptions): HTMLButtonElement {
  const node = el('button', 'ui-button ui-interactive');
  node.type = 'button';
  node.classList.add(`ui-button--${options.variant ?? 'secondary'}`);
  const body = el('span', 'ui-button__body');
  body.append(el('span', 'ui-button__label', options.label));
  if (options.description) {
    body.append(el('span', 'ui-button__desc', options.description));
    node.setAttribute('aria-description', options.description);
  }
  node.append(body);
  if (options.side !== undefined)
    node.append(el('span', 'ui-button__side', options.side));
  node.setAttribute('aria-label', options.label);
  if (options.onClick) node.addEventListener('click', options.onClick);
  bindUiFeedback(node, options.sound ?? 'confirm');
  return node;
}

export function setButtonDescription(
  node: HTMLButtonElement,
  description: string,
): void {
  let desc = node.querySelector('.ui-button__desc');
  if (!desc) {
    desc = el('span', 'ui-button__desc');
    node.querySelector('.ui-button__body')?.append(desc);
  }
  desc.textContent = description;
  node.setAttribute('aria-description', description);
}
