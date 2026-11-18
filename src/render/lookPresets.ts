import { tuning } from '../core/tuning';

/**
 * Kierunek „komiksowy Neon Noir” (inspiracja: Borderlands) — decyzja właściciela 18.11.2026:
 * domyślnie wariant `b` (gruby tusz + płaskie pasy cienia, neony i poświata bez zmian).
 * `?look=a|b|c` wybiera wariant do porównań, `?look=off` przywraca dawny wygląd.
 */
export const LOOK_PRESETS = {
  a: {
    outlineThickness: 1,
    inkWidth: 2.2,
    inkNearScale: 1.35,
    outlineColor: '#050507',
    outlineNormalThreshold: 0.24,
    outlineDepthThreshold: 0.02,
    outlineFarNormal: 0.5,
  },
  b: {
    outlineThickness: 1,
    inkWidth: 2.2,
    inkNearScale: 1.35,
    outlineColor: '#050507',
    outlineNormalThreshold: 0.24,
    outlineDepthThreshold: 0.02,
    outlineFarNormal: 0.5,
    celBands: 3,
    celStrength: 1,
  },
  c: {
    outlineThickness: 1,
    inkWidth: 2.4,
    inkNearScale: 1.4,
    outlineColor: '#050507',
    outlineNormalThreshold: 0.22,
    outlineDepthThreshold: 0.018,
    outlineFarNormal: 0.6,
    celBands: 3,
    celStrength: 1,
    hatchStrength: 0.95,
    hatchThreshold: 0.45,
    hatchSpacing: 7,
    paintStrength: 0.3,
  },
} as const;

export type LookId = keyof typeof LOOK_PRESETS;

let active: LookId | null = null;

export const DEFAULT_LOOK: LookId = 'b';

export function applyLookPreset(search: string): LookId | null {
  const id = new URLSearchParams(search).get('look');
  if (id === 'off') {
    active = null;
    return null;
  }
  active = id && id in LOOK_PRESETS ? (id as LookId) : DEFAULT_LOOK;
  reapplyLook();
  return active;
}

/** Motyw nadpisuje kontur przy wejściu do sceny; próbka nakładana jest ponownie po nim. */
export function reapplyLook(): void {
  if (active) Object.assign(tuning.render, LOOK_PRESETS[active]);
}

/** Aktywny wariant stylu komiksowego; `null` przy `?look=off` i przed startem gry (testy). */
export function activeLook(): LookId | null {
  return active;
}
