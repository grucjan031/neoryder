/** Największy krok zegara kosmetyki na klatkę (s): po przycięciu karty animacja nie skacze. */
export const MAX_FRAME_STEP_S = 0.1;

/** Krok zegara kosmetyki z czasu klatki: nieujemny, skończony, przycięty do `MAX_FRAME_STEP_S`. */
export function frameStep(frameDt: number): number {
  return Number.isFinite(frameDt) && frameDt > 0
    ? Math.min(frameDt, MAX_FRAME_STEP_S)
    : 0;
}
