import { setInputHint } from './inputGlyphs';
import { tuning } from '../core/tuning';
import { getTips, pickTip } from './loadingTips';
import './loadingTips.css';

/** Wspólna dekoracyjna porada; właściciel usuwa timer wraz ze splashem. */
export function createLoadingTip(key: string): {
  root: HTMLElement;
  dispose(): void;
} {
  const root = document.createElement('div');
  root.className = 'loading-tip';
  root.setAttribute('aria-hidden', 'true');
  const label = document.createElement('strong');
  const text = document.createElement('p');
  root.append(label, text);
  const list = getTips();
  const first = pickTip(key, list);
  let index = first ? list.indexOf(first) : -1;
  const update = (): void => {
    const tip = list[index];
    root.hidden = !tip;
    label.textContent = tip?.label ?? '';
    setInputHint(text, tip?.text ?? '');
  };
  update();
  const timer =
    list.length > 1
      ? window.setInterval(() => {
          index = (index + 1) % list.length;
          update();
          if (
            typeof matchMedia === 'function' &&
            matchMedia('(prefers-reduced-motion: reduce)').matches
          )
            return;
          root.animate?.([{ opacity: 0 }, { opacity: 1 }], {
            duration: 400,
            easing: 'ease-out',
          });
        }, tuning.ui.loadingTipS * 1000)
      : undefined;
  return {
    root,
    dispose() {
      window.clearInterval(timer);
      root.remove();
    },
  };
}
