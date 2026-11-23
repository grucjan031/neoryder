import type { PadFrame } from '../core/input/gamepad';
import { tuning } from '../core/tuning';

export const PAD_MENU_INPUT = 'pad-menu-input';
export const isNavigationButton = (button: number): boolean =>
  button === 0 || button === 1 || (button >= 12 && button <= 15);

const focusable =
  'button, a[href], input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"]), [role="tab"]';
const overlays =
  '.run-screen, .hub-screen, .hub-map, .build-select, .hud__death, .mission-dialogue-player';

function visible(node: HTMLElement): boolean {
  for (
    let element: HTMLElement | null = node;
    element;
    element = element.parentElement
  ) {
    if (
      element.hidden ||
      element.hasAttribute('inert') ||
      element.getAttribute('aria-hidden') === 'true'
    )
      return false;
    const style = element.ownerDocument.defaultView?.getComputedStyle(element);
    if (
      style?.display === 'none' ||
      style?.visibility === 'hidden' ||
      style?.visibility === 'collapse'
    )
      return false;
  }
  return true;
}

export function padScope(doc: Document = document): HTMLElement | undefined {
  const dialogs = [
    ...doc.querySelectorAll<HTMLDialogElement>('dialog[open]'),
  ].filter(visible);
  const modal = dialogs.find(
    (dialog) => dialog.matches(':modal') && dialog.contains(doc.activeElement),
  );
  return (
    modal ??
    dialogs.filter((dialog) => dialog.matches(':modal')).at(-1) ??
    dialogs.at(-1) ??
    [...doc.querySelectorAll<HTMLElement>(overlays)].filter(visible).at(-1) ??
    [...doc.querySelectorAll<HTMLElement>('.main-menu, .scene-menu')].find(
      visible,
    )
  );
}

function direction(frame: PadFrame): { x: number; y: number } {
  const buttons = frame.buttons;
  const x = Number(buttons.has(15)) - Number(buttons.has(14));
  const y = Number(buttons.has(13)) - Number(buttons.has(12));
  if (x || y) return x ? { x, y: 0 } : { x: 0, y };
  const { move } = frame;
  if (
    Math.max(Math.abs(move.x), Math.abs(move.y)) <
    tuning.gamepad.navigationThreshold
  )
    return { x: 0, y: 0 };
  return Math.abs(move.x) > Math.abs(move.y)
    ? { x: Math.sign(move.x), y: 0 }
    : { x: 0, y: Math.sign(move.y) };
}

export class PadNavigation {
  private root?: HTMLElement;
  private previousDirection = { x: 0, y: 0 };
  private remaining = 0;

  update(frame: PadFrame | null, dt: number, scope?: HTMLElement | null): void {
    const root = frame
      ? scope === undefined
        ? padScope()
        : (scope ?? undefined)
      : undefined;
    if (root !== this.root || !frame) {
      this.root = root;
      this.previousDirection = { x: 0, y: 0 };
      this.remaining = 0;
    }
    if (!frame || !root) return;
    const win = root.ownerDocument.defaultView;
    if (
      !win ||
      !root.dispatchEvent(
        new win.CustomEvent<PadFrame>(PAD_MENU_INPUT, {
          detail: frame,
          cancelable: true,
        }),
      )
    )
      return;

    const { x, y } = direction(frame);
    const changed =
      x !== this.previousDirection.x || y !== this.previousDirection.y;
    this.previousDirection = { x, y };
    if (changed) this.remaining = tuning.gamepad.navigationDelayS;
    else this.remaining -= dt;
    const navigate = (x || y) && (changed || this.remaining <= 0);
    const focused = root.ownerDocument.activeElement;
    if (
      !navigate &&
      !frame.pressed.has(0) &&
      !frame.pressed.has(1) &&
      focused instanceof win.HTMLElement &&
      root.contains(focused) &&
      focused.matches(focusable) &&
      !focused.matches(':disabled, [aria-disabled="true"]') &&
      visible(focused)
    )
      return;

    const candidates = [
      ...root.querySelectorAll<HTMLElement>(focusable),
    ].filter(
      (node) =>
        !node.matches(':disabled, [aria-disabled="true"]') && visible(node),
    );
    const active = candidates.find(
      (node) => node === root.ownerDocument.activeElement,
    );
    if (frame.pressed.has(1)) {
      const target = active ?? root;
      const escaped = target.dispatchEvent(
        new win.KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          bubbles: true,
          cancelable: true,
        }),
      );
      if (escaped && visible(root)) {
        if (root.matches('dialog[open]')) {
          const dialog = root as HTMLDialogElement;
          if (
            dialog.dispatchEvent(new win.Event('cancel', { cancelable: true }))
          )
            dialog.close();
        } else root.querySelector<HTMLElement>('[data-pad-back]')?.click();
      }
      return;
    }
    if (frame.pressed.has(0)) {
      const selected = active ?? candidates[0];
      selected?.focus();
      selected?.click();
      return;
    }

    if (!active) {
      candidates[0]?.focus();
      return;
    }
    if (!navigate) return;
    if (!changed) this.remaining = tuning.gamepad.navigationRepeatS;
    if (
      x &&
      active instanceof win.HTMLInputElement &&
      active.type === 'range'
    ) {
      if (x > 0) active.stepUp();
      else active.stepDown();
      active.dispatchEvent(new win.Event('input', { bubbles: true }));
      return;
    }
    if (x && active.hasAttribute('data-pad-adjust')) {
      // Kontrolki własne (stepper, lista rozwijana) same zmieniają wartość na strzałki.
      active.dispatchEvent(
        new win.KeyboardEvent('keydown', {
          key: x > 0 ? 'ArrowRight' : 'ArrowLeft',
          code: x > 0 ? 'ArrowRight' : 'ArrowLeft',
          bubbles: true,
          cancelable: true,
        }),
      );
      return;
    }
    if (x && active instanceof win.HTMLSelectElement) {
      let index = active.selectedIndex + x;
      while (active.options[index]?.disabled) index += x;
      if (active.options[index]) {
        active.selectedIndex = index;
        active.dispatchEvent(new win.Event('change', { bubbles: true }));
      }
      return;
    }

    const rect = active.getBoundingClientRect();
    let best: HTMLElement | undefined;
    let bestScore = Infinity;
    for (const node of candidates) {
      if (node === active) continue;
      const next = node.getBoundingClientRect();
      const dx = next.x + next.width / 2 - rect.x - rect.width / 2;
      const dy = next.y + next.height / 2 - rect.y - rect.height / 2;
      const forward = dx * x + dy * y;
      if (forward <= 0) continue;
      const lateral = Math.abs(dx * y - dy * x);
      const score = Math.hypot(forward, lateral) + lateral;
      if (score < bestScore) {
        best = node;
        bestScore = score;
      }
    }
    best?.focus();
  }
}
