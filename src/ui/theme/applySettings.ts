import type { Settings } from '../../core/save';
import { getLiteFx } from '../../render/fxMode';

/**
 * Przenosi ustawienia interfejsu na `<html>`: skala (`--ui-scale` mnoży rozmiar bazowy rem
 * z `tokens.css`), „Ogranicz animacje” i tryb lite (bez rozmycia tła paneli).
 */
export function applyUiSettings(
  settings: Pick<Settings, 'uiScale' | 'reduceMotion'>,
  root: HTMLElement = document.documentElement,
): void {
  root.style.setProperty('--ui-scale', String(settings.uiScale));
  root.dataset.reduceMotion = String(settings.reduceMotion);
  if (getLiteFx()) root.dataset.fx = 'lite';
  else delete root.dataset.fx;
}

/** Czy animacje ozdobne mają być pominięte (ustawienie gracza albo preferencja systemu). */
export function motionReduced(doc: Document = document): boolean {
  return (
    doc.documentElement.dataset.reduceMotion === 'true' ||
    (typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches)
  );
}
