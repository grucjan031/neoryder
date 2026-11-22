import type { MetaState } from '../core/metaTypes';

export type HubGuideTarget = 'missions' | 'talents';

export function hubGuideTarget(
  meta: Pick<MetaState, 'stats'>,
  freePoints: number,
): HubGuideTarget | null {
  if (meta.stats.runs === 0) return 'missions';
  return freePoints > 0 ? 'talents' : null;
}
