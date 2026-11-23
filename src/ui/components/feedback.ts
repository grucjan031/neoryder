import { playUiSound } from '../../audio/uiSounds';
import type { UiSoundName } from '../../audio/uiSounds';

function keyboardFocus(node: HTMLElement): boolean {
  if (node.ownerDocument.documentElement.dataset.inputDevice === 'gamepad')
    return true;
  try {
    return node.matches(':focus-visible');
  } catch {
    return true;
  }
}

/**
 * Dźwięki interfejsu: tick przy najechaniu i fokusie z klawiatury lub pada
 * (fokus po kliknięciu myszą nie dubluje ticka) oraz dźwięk akcji po kliknięciu.
 */
export function bindUiFeedback(
  node: HTMLElement,
  click: UiSoundName | false = 'confirm',
): void {
  node.addEventListener('pointerenter', (event) => {
    if (event.pointerType !== 'touch' && !isDisabled(node))
      playUiSound('hover');
  });
  node.addEventListener('focus', () => {
    if (!isDisabled(node) && keyboardFocus(node)) playUiSound('hover');
  });
  if (click)
    node.addEventListener('click', () => {
      playUiSound(isDisabled(node) ? 'error' : click);
    });
}

function isDisabled(node: HTMLElement): boolean {
  return (
    node.hasAttribute('disabled') ||
    node.getAttribute('aria-disabled') === 'true'
  );
}
