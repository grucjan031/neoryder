import { tuning } from '../core/tuning';

/**
 * Rozgrzewka renderu: kompilacja shaderów i wysłanie tekstur na GPU, zanim zniknie ekran ładowania.
 * `cancelled()` zwraca true, gdy minął limit czasu: rozgrzewka ma wtedy zrezygnować z dalszej pracy.
 */
export type RenderWarmUp = (cancelled: () => boolean) => Promise<void>;

let current: RenderWarmUp | undefined;

/** `main.ts` rejestruje rozgrzewkę swojego pipeline'u; `undefined` ją wyłącza (testy, sprzątanie). */
export function setRenderWarmUp(value: RenderWarmUp | undefined): void {
  current = value;
}

/**
 * Sceny wołają ją, gdy cała zawartość jest zbudowana, a ekran ładowania jeszcze zasłania obraz
 * (`main.ts` po `init()`, `RunScene` po `room.init()`). Bez zarejestrowanego renderera (Vitest,
 * `?scenes=1`) jest pusta. Trwa najwyżej `tuning.ui.renderWarmUpTimeoutMs`: wiszące kompilowanie
 * shaderów nie może zablokować wejścia do gry.
 */
export async function warmUpRender(
  timeoutMs: number = tuning.ui.renderWarmUpTimeoutMs,
): Promise<void> {
  const warm = current;
  if (!warm) return;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      cancelled = true;
      console.warn(`Rozgrzewka renderu przekroczyła ${timeoutMs} ms.`);
      resolve();
    }, timeoutMs);
  });
  try {
    await Promise.race([warm(() => cancelled), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
