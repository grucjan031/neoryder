import { tuning } from '../core/tuning';
import type { EnemyDefinition } from './enemySchema';
import { canKnockDown, knockdownTiming } from './enemyKnockdown';
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
  /**
   * Odcinek klipu (ułamki 0..1) rozciągnięty na `spanS` sekund; wymach i regeneracja
   * kontynuują akcję zapowiedzi (`continues`) bez resetu.
   */
  segment?: { from: number; to: number; spanS: number };
  continues?: boolean;
}

export function gaitWeights(
  speed: number,
  runSpeed: number,
  walkFraction: number,
): [number, number, number] {
  const fraction = Math.max(0, Math.min(1, speed / runSpeed));
  if (walkFraction >= 1) return [1 - fraction, fraction, 0];
  const walk = Math.max(0.001, Math.min(0.999, walkFraction));
  const idle = Math.max(0, 1 - fraction / walk);
  const jog = Math.max(0, (fraction - walk) / (1 - walk));
  return [idle, 1 - idle - jog, jog];
}

export function rifleman(
  definition: Pick<EnemyDefinition, 'kind' | 'model'>,
): boolean {
  return (
    definition.kind === 'gunner' ||
    definition.kind === 'sniper' ||
    definition.model === 'enemy_sniper'
  );
}

/** Wybór pozy jest wyłącznie prezentacją istniejącego snapshotu AI. */
export function selectEnemyAnimation(
  definition: EnemyDefinition,
  snapshot: EnemySnapshot,
): EnemyAnimation {
  const ranged = rifleman(definition);
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
  if (snapshot.state === 'stunned') {
    // Kip-up: od początku wyskoku poza bojowa, w której wróg ląduje.
    if (snapshot.knockdown && canKnockDown(definition)) {
      const timing = knockdownTiming(
        definition.stunOnHeavyS,
        tuning.vfx.enemyKnockdown,
      );
      if (
        snapshot.stateTimeS >=
        timing.fallS +
          timing.lieS +
          timing.kipS * tuning.vfx.enemyKnockdown.tuckAt
      )
        return result(ranged ? 'Pistol_Idle_Loop' : 'Sword_Idle');
    }
    return result('Hit_Chest', true, definition.stunOnHeavyS);
  }
  if (snapshot.controlled) return result('Hit_Head', true);
  const attack = bossAttack(definition, snapshot);
  if (attack) return attack;
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
        snapshot.speed <=
        definition.moveSpeed * (definition.animation?.jogFromSpeedFrac ?? 0.5)
          ? 'Walk_Loop'
          : 'Jog_Fwd_Loop',
      once: false,
      moving: true,
    };
  }
  return result(ranged ? 'Pistol_Idle_Loop' : 'Idle_Loop');
}

/** Boss: zapowiedź do chwili skutku, potem wymach i regeneracja tą samą akcją (bez resetu). */
function bossAttack(
  definition: EnemyDefinition,
  snapshot: EnemySnapshot,
): EnemyAnimation | null {
  const attack = snapshot.attack;
  const spec = attack
    ? definition.boss?.attackAnimations?.[
        attack.kind as keyof NonNullable<
          NonNullable<EnemyDefinition['boss']>['attackAnimations']
        >
      ]
    : undefined;
  if (!attack || !spec) return null;
  const common = { clip: spec.clip, once: true, moving: false };
  if (snapshot.state === 'telegraph')
    return {
      ...common,
      segment: { from: 0, to: spec.impact, spanS: attack.telegraphS },
    };
  if (snapshot.state === 'swing' || snapshot.state === 'recovery')
    return {
      ...common,
      continues: true,
      segment: {
        from: spec.impact,
        to: spec.end,
        spanS: definition.swingActiveS + attack.recoveryS,
      },
    };
  return null;
}
