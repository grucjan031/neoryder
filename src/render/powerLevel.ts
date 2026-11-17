/**
 * Globalny mnożnik zasilania (0-1) dla źródeł światła i materiałów świecących z sieci
 * (neony, ekrany, napisy, lampy). Ustawia go scena (kryjówka: spadek napięcia), a
 * konsumenci mnożą nim jasność razem z migotaniem. Płomienie i światła kluczowe go ignorują.
 */
let level = 1;

export function setPowerLevel(value: number): void {
  level = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
}

export function getPowerLevel(): number {
  return level;
}
