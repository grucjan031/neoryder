let lite = false;

/**
 * Rozdzielczość renderu w trybie lite (ułamek rozmiaru okna). Na SwiftShaderze koszt klatki
 * pokoju zależy niemal wyłącznie od liczby pikseli: 1280x720 ≈ 550 ms, 320x180 ≈ 33 ms.
 */
export const LITE_PIXEL_RATIO = 0.25;

/**
 * Limit kroków symulacji na klatkę w trybie lite. Na runnerze CI klatka pokoju trwa sekundy;
 * przy domyślnych 5 krokach symulacja (np. 1 s opóźnienia nagrody) trwała tam minuty.
 */
export const LITE_MAX_STEPS_PER_FRAME = 60;

export function isLiteFx(params: URLSearchParams): boolean {
  return params.get('debug') === '1' && params.get('fx') === 'lite';
}

export function configureFx(params: URLSearchParams): void {
  lite = isLiteFx(params);
}

export function getLiteFx(): boolean {
  return lite;
}

export function preserveLiteFx(
  from: URLSearchParams,
  to: URLSearchParams,
): void {
  if (isLiteFx(from)) to.set('fx', 'lite');
}
