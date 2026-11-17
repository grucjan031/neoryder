import { createIndexedDbSaveStore } from '../core/save';
import type { SaveStore } from '../core/save';
import { tuning } from '../core/tuning';
import { loadMetaManager } from '../progression/metaSave';
import { getLiteFx } from '../render/fxMode';
import { pickSplash, splashUrl, unlockedSplashAct } from './splash';
import type { SplashAct } from './splash';
import { createLoadingTip } from './loadingTipView';

export interface BootSplash {
  /** Zdejmuje nakładkę startową (krótkie wygaszenie); wielokrotne wołanie jest bezpieczne. */
  dismiss(): void;
}

const FADE_MS = 320;

/**
 * Akt splasharów z meta-zapisu tym samym odczytem co menu i run (`loadMetaManager`). Zapis jest
 * w IndexedDB (tylko asynchronicznie), więc nakładka nie czeka na niego ze startem: brak, błąd
 * albo przekroczenie `tuning.ui.splashMetaTimeoutMs` daje 0 zwycięstw, czyli akt 1.
 */
export function readSplashAct(
  store?: SaveStore,
  timeoutMs: number = tuning.ui.splashMetaTimeoutMs,
): Promise<SplashAct> {
  const read = (async (): Promise<SplashAct> => {
    const meta = await loadMetaManager(store ?? createIndexedDbSaveStore());
    return unlockedSplashAct(
      meta.state.campaign.completed.length
        ? meta.state.campaign.completed
        : meta.state.stats.victories,
    );
  })().catch((): SplashAct => 1);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(1), timeoutMs);
    void read.then((act) => {
      clearTimeout(timer);
      resolve(act);
    });
  });
}

/**
 * Nakładka startowa z `index.html` (`#boot-splash`) pokazuje się, zanim ruszy JS. Tu dokładamy
 * splashart wybrany deterministycznie z parametrów sceny; w `fx=lite` zostaje samo tło.
 * Do `dismiss()` nakładka przechwytuje zdarzenia, a `#app` jest `inert`; po zdjęciu nic nie blokuje.
 */
export function showBootSplash(
  params: URLSearchParams,
  sceneId: string | null,
  maxAct: SplashAct | Promise<SplashAct> = 1,
): BootSplash {
  const root = document.getElementById('boot-splash');
  if (!root) return { dismiss() {} };
  // Nieprzezroczysta nakładka przechwytuje myszy, a ukryty interfejs nie łapie fokusu ani Tab.
  const app = document.getElementById('app');
  if (app) app.inert = true;
  const lite = getLiteFx();
  let tip: ReturnType<typeof createLoadingTip> | undefined;
  let done = false;
  const key = `${sceneId ?? 'menu'}:${params.get('seed') ?? ''}`;
  const hint = {
    scene: sceneId ?? 'menu',
    theme: sceneId === 'hub' ? 'hideout' : undefined,
  };
  const mountArt = (act: SplashAct): void => {
    if (done) return;
    try {
      const entry = pickSplash(key, hint, act);
      if (!entry) throw new Error('Brak splasharów.');
      const image = document.createElement('img');
      image.className = 'boot-splash__img';
      image.alt = '';
      image.decoding = 'async';
      image.setAttribute('aria-hidden', 'true');
      image.addEventListener('load', () => image.classList.add('is-loaded'));
      image.addEventListener('error', () => {
        image.remove();
        copy.remove();
        tip?.dispose();
        root.classList.remove('boot-splash--art');
      });
      image.src = splashUrl(entry);
      const caption = document.createElement('span');
      caption.className = 'boot-splash__caption';
      caption.setAttribute('aria-hidden', 'true');
      caption.textContent = entry.title;
      const copy = document.createElement('div');
      copy.className = 'loading-copy';
      copy.setAttribute('aria-hidden', 'true');
      tip = createLoadingTip(key);
      copy.append(caption, tip.root);
      root.classList.add('boot-splash--art');
      root.prepend(image);
      root.append(copy);
    } catch (error) {
      console.warn('Nie można wybrać splashartu.', error);
    }
  };
  if (!lite) {
    // Gdy akt nie zmienia wyboru (np. menu ma tylko obrazy aktu 1), obraz od razu, bez czekania.
    if (typeof maxAct === 'number') mountArt(maxAct);
    else if (pickSplash(key, hint, 1) === pickSplash(key, hint, 4)) mountArt(1);
    else void maxAct.then(mountArt, () => mountArt(1));
  }
  return {
    dismiss() {
      if (done) return;
      done = true;
      tip?.dispose();
      if (app) app.inert = false;
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
