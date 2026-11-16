let lite = false;

/**
 * Rozdzielczość renderu w trybie lite (ułamek rozmiaru okna). Na SwiftShaderze koszt klatki
 * pokoju zależy niemal wyłącznie od liczby pikseli: 1280x720 ≈ 550 ms, 320x180 ≈ 33 ms.
 */
export const LITE_PIXEL_RATIO = 0.25;

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
