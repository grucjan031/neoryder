import { playUiSound } from '../../audio/uiSounds';
import { uiLayers } from '../layers';
import { uiButton } from './button';
import { el, uniqueId } from './dom';

const focusable =
  'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/** Pułapka fokusu: Tab i Shift+Tab krążą po elementach okna. */
export function trapFocus(root: HTMLElement): void {
  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const items = [...root.querySelectorAll<HTMLElement>(focusable)].filter(
      (node) => !node.hidden && !node.closest('[inert]'),
    );
    const first = items[0];
    const last = items.at(-1);
    if (!first || !last) return;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !root.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !root.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  });
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Akcja nieodwracalna: domyślny fokus na anulowaniu, przycisk w ciepłej bieli (bez czerwieni). */
  destructive?: boolean;
}

/**
 * Okno potwierdzenia (`ui-modal`): `aria-modal`, pułapka fokusu, Esc/B anuluje,
 * fokus wraca na element, który je otworzył. Zwraca `true` po potwierdzeniu.
 */
export function uiConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = el('dialog', 'ui-modal ui-scope');
    const titleId = uniqueId('ui-modal-title');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', titleId);
    const panel = el('div', 'ui-panel');
    const inner = el('div', 'ui-modal__inner');
    const title = el('h2', 'ui-modal__title', options.title);
    title.id = titleId;
    const message = el('p', 'ui-modal__message', options.message);
    const actions = el('div', 'ui-modal__actions');
    let done = false;
    const finish = (result: boolean): void => {
      if (done) return;
      done = true;
      removeLayer();
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      dialog.remove();
      resolve(result);
    };
    const cancel = uiButton({
      label: options.cancelLabel,
      sound: 'back',
      onClick: () => finish(false),
    });
    const confirm = uiButton({
      label: options.confirmLabel,
      variant: options.destructive ? 'destructive' : 'primary',
      onClick: () => finish(true),
    });
    actions.append(cancel, confirm);
    inner.append(title, message, actions);
    panel.append(inner);
    dialog.append(panel);
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      playUiSound('back');
      finish(false);
    });
    dialog.addEventListener('keydown', (event) => event.stopPropagation());
    trapFocus(dialog);
    document.body.append(dialog);
    const removeLayer = uiLayers.push(dialog, () => finish(false));
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    (options.destructive ? cancel : confirm).focus();
  });
}
