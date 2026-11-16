import { getLiteFx } from '../render/fxMode';
import { pickSplash, splashUrl } from './splash';

export interface BootSplash {
  /** Zdejmuje nakładkę startową (krótkie wygaszenie); wielokrotne wołanie jest bezpieczne. */
  dismiss(): void;
}

const FADE_MS = 320;

/**
 * Nakładka startowa z `index.html` (`#boot-splash`) pokazuje się, zanim ruszy JS. Tu dokładamy
 * splashart wybrany deterministycznie z parametrów sceny; w `fx=lite` zostaje samo tło.
 * Nakładka ma `pointer-events: none`, więc nigdy nie blokuje kliknięć.
 */
export function showBootSplash(
  params: URLSearchParams,
  sceneId: string | null,
): BootSplash {
  const root = document.getElementById('boot-splash');
  if (!root) return { dismiss() {} };
  const lite = getLiteFx();
  if (!lite) {
    try {
      const entry = pickSplash(
        `${sceneId ?? 'menu'}:${params.get('seed') ?? ''}`,
        {
          theme: sceneId === 'hub' ? 'hideout' : undefined,
        },
      );
      const image = document.createElement('img');
      image.className = 'boot-splash__img';
      image.alt = '';
      image.decoding = 'async';
      image.setAttribute('aria-hidden', 'true');
      image.addEventListener('load', () => image.classList.add('is-loaded'));
      image.addEventListener('error', () => {
        image.remove();
        caption.remove();
        root.classList.remove('boot-splash--art');
      });
      image.src = splashUrl(entry);
      const caption = document.createElement('span');
      caption.className = 'boot-splash__caption';
      caption.textContent = entry.title;
      root.classList.add('boot-splash--art');
      root.prepend(image);
      root.append(caption);
    } catch (error) {
      console.warn('Nie można wybrać splashartu.', error);
    }
  }
  let done = false;
  return {
    dismiss() {
      if (done) return;
      done = true;
      const instant =
        lite ||
        (typeof matchMedia === 'function' &&
          matchMedia('(prefers-reduced-motion: reduce)').matches);
      if (instant) {
        root.remove();
        return;
      }
      root.classList.add('boot-splash--out');
      window.setTimeout(() => root.remove(), FADE_MS + 60);
    },
  };
}
