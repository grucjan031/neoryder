import { tuning } from '../core/tuning';

/**
 * Próbki kierunku „komiksowy Neon Noir” (inspiracja: Borderlands), wybierane parametrem
 * `?look=a|b|c`. Bez parametru wygląd bez zmian. Do porównania wariantów przed decyzją (ADR 0009).
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

export function applyLookPreset(search: string): LookId | null {
  const id = new URLSearchParams(search).get('look');
  if (!id || !(id in LOOK_PRESETS)) return null;
  active = id as LookId;
  reapplyLook();
  return active;
}

/** Motyw nadpisuje kontur przy wejściu do sceny; próbka nakładana jest ponownie po nim. */
export function reapplyLook(): void {
  if (active) Object.assign(tuning.render, LOOK_PRESETS[active]);
}
