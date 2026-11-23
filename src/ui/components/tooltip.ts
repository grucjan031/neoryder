import { el, uniqueId } from './dom';

/**
 * Podpowiedź (`ui-tooltip`) pokazywana po najechaniu i fokusie. Zwraca funkcję
 * usuwającą podpowiedź; tekst jest też w `aria-describedby`.
 */
export function attachTooltip(target: HTMLElement, text: string): () => void {
  const tip = el('div', 'ui-tooltip', text);
  tip.id = uniqueId('ui-tooltip');
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  target.setAttribute('aria-describedby', tip.id);
  const show = (): void => {
    if (!tip.isConnected) document.body.append(tip);
    tip.hidden = false;
    const rect = target.getBoundingClientRect();
    const room = window.innerWidth - 16;
    tip.style.left = `${Math.max(8, Math.min(rect.left, room - tip.offsetWidth))}px`;
    const above = rect.top - tip.offsetHeight - 6;
    tip.style.top = `${above > 8 ? above : rect.bottom + 6}px`;
  };
  const hide = (): void => {
    tip.hidden = true;
  };
  target.addEventListener('pointerenter', show);
  target.addEventListener('focus', show);
  target.addEventListener('pointerleave', hide);
  target.addEventListener('blur', hide);
  return () => {
    target.removeEventListener('pointerenter', show);
    target.removeEventListener('focus', show);
    target.removeEventListener('pointerleave', hide);
    target.removeEventListener('blur', hide);
    target.removeAttribute('aria-describedby');
    tip.remove();
  };
}
