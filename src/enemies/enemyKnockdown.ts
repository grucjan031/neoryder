import type { Tuning } from '../core/tuning';
import type { EnemyDefinition } from './enemySchema';
import type { EnemySnapshot } from './types';

/** Wrogowie humanoidalni chodzący: tylko oni przewracają się przy mocnym odrzucie (bez dronów, wieżyczek i bossa). */
const HUMANOID_KINDS = new Set([
  'assaulter',
  'gunner',
  'sniper',
  'shielder',
  'executor',
]);

export function canKnockDown(definition: EnemyDefinition): boolean {
  return (
    HUMANOID_KINDS.has(definition.kind) &&
    !definition.boss &&
    definition.body !== undefined
  );
}

export type KnockdownTuning = Tuning['vfx']['enemyKnockdown'];

export interface KnockdownTiming {
  fallS: number;
  lieS: number;
  kipS: number;
  /** Chwila lądowania z kip-upu (od początku ogłuszenia). */
  landAtS: number;
  totalS: number;
}

/**
 * Upadek, leżenie i kip-up mieszczą się w czasie ogłuszenia `stunS` (balans bez zmian):
 * leżenie wypełnia resztę, a przy krótszym ogłuszeniu upadek i wyskok skalują się proporcjonalnie.
 */
export function knockdownTiming(
  stunS: number,
  t: KnockdownTuning,
): KnockdownTiming {
  const total = Math.max(0, stunS);
  const moves = t.fallS + t.kipS;
  const scale = moves > total && moves > 0 ? total / moves : 1;
  const fallS = t.fallS * scale;
  const kipS = t.kipS * scale;
  const lieS = Math.max(0, total - fallS - kipS);
  return {
    fallS,
    lieS,
    kipS,
    landAtS: fallS + lieS + kipS * t.landAt,
    totalS: fallS + lieS + kipS,
  };
}

export interface KnockdownPose {
  phase: 'fall' | 'lie' | 'kip';
  /** Pochylenie w stopniach w kierunku przewrócenia (90 = na plecach). */
  tiltDeg: number;
  /** Podniesienie (m): odbicie po uderzeniu o ziemię i podskok kip-upu. */
  liftM: number;
  /** Ugięcie w pionie (1 = bez zmian) przy podciągnięciu nóg i lądowaniu. */
  squash: number;
  /** Czas od lądowania z kip-upu (s); null przed lądowaniem. */
  landedAgoS: number | null;
}

const smooth = (v: number): number => {
  const t = Math.min(1, Math.max(0, v));
  return t * t * (3 - 2 * t);
};
const easeOut = (v: number): number =>
  1 - (1 - Math.min(1, Math.max(0, v))) ** 3;

/** Poza w chwili `timeS` od początku ogłuszenia (czysta funkcja; widok nakłada ją na korzeń modelu). */
export function knockdownPose(
  timeS: number,
  stunS: number,
  t: KnockdownTuning,
): KnockdownPose {
  const timing = knockdownTiming(stunS, t);
  const time = Math.min(Math.max(0, timeS), timing.totalS);
  const lie = t.lieTiltDeg;
  if (time < timing.fallS) {
    // Upadek przyspiesza jak przy przewróceniu (u²).
    const u = time / Math.max(timing.fallS, 1e-6);
    return {
      phase: 'fall',
      tiltDeg: lie * u * u,
      liftM: 0,
      squash: 1,
      landedAgoS: null,
    };
  }
  const afterImpact = time - timing.fallS;
  const bounce =
    afterImpact < t.bounceS
      ? t.bounceM *
        Math.sin((Math.PI * afterImpact) / Math.max(t.bounceS, 1e-6))
      : 0;
  const kipStart = timing.fallS + timing.lieS;
  if (time < kipStart)
    return {
      phase: 'lie',
      tiltDeg: lie,
      liftM: bounce,
      squash: 1,
      landedAgoS: null,
    };
  const v = (time - kipStart) / Math.max(timing.kipS, 1e-6);
  const tuckEnd = t.tuckAt;
  const land = t.landAt;
  const landedAgoS = time >= timing.landAtS ? time - timing.landAtS : null;
  if (v < tuckEnd) {
    // Podciągnięcie nóg: przetoczenie na łopatki i ugięcie.
    const w = smooth(v / tuckEnd);
    return {
      phase: 'kip',
      tiltDeg: lie + t.tuckDeg * w,
      liftM: bounce,
      squash: 1 - t.tuckSquash * w,
      landedAgoS,
    };
  }
  if (v < land) {
    // Wyskok z pleców na nogi: szybki obrót przez pion z lekkim przechyłem do przodu i podskok.
    const w = (v - tuckEnd) / (land - tuckEnd);
    const from = lie + t.tuckDeg;
    return {
      phase: 'kip',
      tiltDeg: from + (-t.overshootDeg - from) * easeOut(w),
      liftM: t.jumpM * Math.sin(Math.PI * w),
      squash: 1 - t.tuckSquash * (1 - smooth(w * 2)),
      landedAgoS,
    };
  }
  // Lądowanie w pozycji bojowej: wyprost z przechyłu i krótkie ugięcie.
  const w = (v - land) / Math.max(1 - land, 1e-6);
  return {
    phase: 'kip',
    tiltDeg: -t.overshootDeg * (1 - smooth(w)),
    liftM: 0,
    squash: 1 - t.landSquash * Math.sin(Math.PI * Math.min(1, w)),
    landedAgoS,
  };
}

/** Poza przewrócenia dla snapshotu albo null (brak przewrócenia, śmierć, inny stan, nie-humanoid). */
export function knockdownFrame(
  definition: EnemyDefinition,
  snapshot: Pick<EnemySnapshot, 'state' | 'stateTimeS' | 'knockdown'>,
  t: KnockdownTuning,
): KnockdownPose | null {
  if (
    snapshot.state !== 'stunned' ||
    !snapshot.knockdown ||
    !canKnockDown(definition)
  )
    return null;
  return knockdownPose(snapshot.stateTimeS, definition.stunOnHeavyS, t);
}

/** Przesunięcie korzenia po obrocie wokół bioder, wspólne dla widoku i hurtboxów. */
export function knockdownOffset(
  pose: KnockdownPose,
  hip: number,
  rest: number,
) {
  const tilt = (pose.tiltDeg * Math.PI) / 180;
  const sin = Math.sin(tilt);
  const cos = Math.cos(tilt);
  return {
    tilt,
    sin,
    cos,
    forward: -hip * sin,
    up: hip - (hip - rest) * Math.max(0, sin) + pose.liftM - hip * cos,
  };
}
