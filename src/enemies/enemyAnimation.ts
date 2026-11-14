import type { EnemyDefinition } from './enemySchema';
import type { EnemySnapshot } from './types';

export type EnemyClip =
  | 'Idle_Loop'
  | 'Pistol_Idle_Loop'
  | 'Walk_Loop'
  | 'Jog_Fwd_Loop'
  | 'Sword_Idle'
  | 'Sword_Attack'
  | 'Punch_Enter'
  | 'Punch_Cross'
  | 'Pistol_Aim_Neutral'
  | 'Pistol_Shoot'
  | 'Hit_Chest'
  | 'Hit_Head';

export interface EnemyAnimation {
  clip: EnemyClip;
  once: boolean;
  /** Długość stanu dla klipów jednorazowych; nie zmienia okna obrażeń. */
  durationS?: number;
  moving: boolean;
}

/** Wybór pozy jest wyłącznie prezentacją istniejącego snapshotu AI. */
export function selectEnemyAnimation(
  definition: EnemyDefinition,
  snapshot: EnemySnapshot,
): EnemyAnimation {
  const ranged = definition.kind === 'gunner' || definition.kind === 'sniper';
  const shield = definition.kind === 'shielder';
  const result = (
    clip: EnemyClip,
    once = false,
    durationS?: number,
  ): EnemyAnimation => ({
    clip,
    once,
    moving: false,
    ...(durationS !== undefined ? { durationS } : {}),
  });
  if (snapshot.state === 'stunned')
    return result('Hit_Chest', true, definition.stunOnHeavyS);
  if (snapshot.controlled) return result('Hit_Head', true);
  switch (snapshot.state) {
    case 'telegraph':
      if (ranged) return result('Pistol_Aim_Neutral');
      return result(
        shield ? 'Punch_Enter' : 'Sword_Idle',
        shield,
        definition.telegraphS,
      );
    case 'swing':
      if (ranged) return result('Pistol_Shoot', true);
      return result(
        shield ? 'Punch_Cross' : 'Sword_Attack',
        true,
        definition.swingActiveS,
      );
    case 'aim':
      if (ranged) return result('Pistol_Aim_Neutral');
      break;
    case 'burst':
      if (ranged) return result('Pistol_Shoot', true);
      break;
    case 'cooldown':
      if (ranged) return result('Pistol_Aim_Neutral');
      break;
    case 'dead':
      return result(ranged ? 'Pistol_Idle_Loop' : 'Idle_Loop');
  }
  if (
    snapshot.speed > 0 &&
    (snapshot.state === 'chase' || snapshot.state === 'reposition')
  ) {
    return {
      clip:
        snapshot.speed <= definition.moveSpeed / 2
          ? 'Walk_Loop'
          : 'Jog_Fwd_Loop',
      once: false,
      moving: true,
    };
  }
  return result(ranged ? 'Pistol_Idle_Loop' : 'Idle_Loop');
}
