import { tuning, type Tuning } from '../core/tuning';
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
 * Upadek, leżenie i kip-up mieszczą się w czasie ogłuszenia `stunS`:
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
  hipFlexDeg: number;
  kneeFlexDeg: number;
  spineArchDeg: number;
  shoulderDeg: number;
  elbowDeg: number;
  armSpreadDeg: number;
  /** Udział neutralnej podstawy kończyn nad klipem walki. */
  neutralWeight: number;
  /** Obniżenie bioder nad stopami w przysiadzie. */
  crouchM: number;
  /** Podniesienie (m): odbicie po uderzeniu o ziemię i podskok kip-upu. */
  liftM: number;
  /** Ugięcie w pionie (1 = bez zmian) przy podciągnięciu nóg i lądowaniu. */
  squash: number;
  /** Czas od lądowania z kip-upu (s); null przed lądowaniem. */
  landedAgoS: number | null;
}

type Angles = Pick<
  KnockdownPose,
  | 'tiltDeg'
  | 'hipFlexDeg'
  | 'kneeFlexDeg'
  | 'spineArchDeg'
  | 'shoulderDeg'
  | 'elbowDeg'
  | 'armSpreadDeg'
>;
const neutral: Angles = {
  tiltDeg: 0,
  hipFlexDeg: 0,
  kneeFlexDeg: 0,
  spineArchDeg: 0,
  shoulderDeg: 0,
  elbowDeg: 0,
  armSpreadDeg: 0,
};
const mix = (a: number, b: number, w: number) => a + (b - a) * w;
const smooth = (u: number) => u * u * (3 - 2 * u);
function blend(a: Angles, b: Angles, w: number): Angles {
  return {
    tiltDeg: mix(a.tiltDeg, b.tiltDeg, w),
    hipFlexDeg: mix(a.hipFlexDeg, b.hipFlexDeg, w),
    kneeFlexDeg: mix(a.kneeFlexDeg, b.kneeFlexDeg, w),
    spineArchDeg: mix(a.spineArchDeg, b.spineArchDeg, w),
    shoulderDeg: mix(a.shoulderDeg, b.shoulderDeg, w),
    elbowDeg: mix(a.elbowDeg, b.elbowDeg, w),
    armSpreadDeg: mix(a.armSpreadDeg, b.armSpreadDeg, w),
  };
}

/** Odpowiedź tłumionej sprężyny. Pierwsze ekstremum wypada na −overshoot. */
function springReturn(u: number, overshoot: number): number {
  if (u >= 1) return 0;
  if (overshoot <= 0) return 1 - smooth(u);
  const damping = -Math.log(overshoot) / Math.PI;
  const end = 2 * Math.PI - Math.atan2(1, damping);
  const angle = u * end;
  const position =
    Math.exp(-damping * angle) * (Math.cos(angle) + damping * Math.sin(angle));
  // Wygaszenie po pierwszym przeregulowaniu daje zerową prędkość przy oddaniu klipu.
  const settle = Math.max(0, (angle - Math.PI) / (end - Math.PI));
  return position * (1 - smooth(settle));
}

export function stunDuration(
  definition: EnemyDefinition,
  snapshot: Pick<EnemySnapshot, 'knockdown'>,
  knockdownS = tuning.enemies.knockdownStunS,
): number {
  return snapshot.knockdown && canKnockDown(definition)
    ? knockdownS
    : definition.stunOnHeavyS;
}

export function knockdownPose(
  timeS: number,
  stunS: number,
  t: KnockdownTuning,
): KnockdownPose {
  const timing = knockdownTiming(stunS, t);
  const time = Math.min(Math.max(0, timeS), timing.totalS);
  const kipStart = timing.fallS + timing.lieS;
  const fallen = {
    ...neutral,
    tiltDeg: t.lieTiltDeg,
    hipFlexDeg: t.fallHipDeg,
    kneeFlexDeg: t.fallKneeDeg,
    armSpreadDeg: t.fallArmSpreadDeg,
  };
  const base = {
    liftM: 0,
    squash: 1,
    neutralWeight: 1,
    crouchM: 0,
    landedAgoS: null,
  };
  if (time < timing.fallS) {
    const u = time / timing.fallS;
    return {
      ...base,
      ...blend(neutral, fallen, smooth(u)),
      tiltDeg: fallen.tiltDeg * u * u,
      neutralWeight: smooth(u),
      phase: 'fall',
    };
  }
  const afterImpact = time - timing.fallS;
  const bounce =
    afterImpact < t.bounceS
      ? t.bounceM * Math.sin((Math.PI * afterImpact) / t.bounceS)
      : 0;
  if (time < kipStart)
    return { ...base, ...fallen, liftM: bounce, phase: 'lie' };

  const v = timing.kipS > 0 ? Math.min(1, (time - kipStart) / timing.kipS) : 1;
  const kip = { ...base, phase: 'kip' as const };
  const tuck = {
    ...neutral,
    tiltDeg: t.tuckTiltDeg,
    hipFlexDeg: t.tuckHipDeg,
    kneeFlexDeg: t.tuckKneeDeg,
    shoulderDeg: t.tuckShoulderDeg,
    elbowDeg: t.tuckElbowDeg,
  };
  if (v < t.tuckAt) {
    const u = Math.min(1, v / Math.max(t.holdAt, Number.EPSILON));
    const w = 1 - (1 - u) ** 3;
    return {
      ...kip,
      ...blend(fallen, tuck, w),
      liftM: mix(bounce, t.tuckLiftM, w),
    };
  }
  const kick = {
    ...neutral,
    tiltDeg: t.kickTiltDeg,
    hipFlexDeg: t.kickHipDeg,
    spineArchDeg: t.kickArchDeg,
    shoulderDeg: t.kickShoulderDeg,
  };
  const land = {
    ...neutral,
    tiltDeg: t.landTiltDeg,
    hipFlexDeg: t.landHipDeg,
    kneeFlexDeg: t.landKneeDeg,
    shoulderDeg: t.landShoulderDeg,
    elbowDeg: t.landElbowDeg,
  };
  if (time < timing.landAtS) {
    // Jedna parabola przez wybicie i kontakt, z wierzchołkiem dokładnie na jumpM.
    const u = (v - t.tuckAt) / (t.landAt - t.tuckAt);
    const height = Math.sqrt(Math.max(0, t.jumpM - t.tuckLiftM));
    const liftM = t.jumpM - (height - (height + Math.sqrt(t.jumpM)) * u) ** 2;
    if (v < t.kickAt) {
      const w = (v - t.tuckAt) / (t.kickAt - t.tuckAt);
      return {
        ...kip,
        ...blend(tuck, kick, smooth(w)),
        tiltDeg: mix(tuck.tiltDeg, kick.tiltDeg, 1 - (1 - w) ** 4),
        liftM,
      };
    }
    const w = smooth((v - t.kickAt) / (t.landAt - t.kickAt));
    return {
      ...kip,
      ...blend(kick, land, w),
      liftM,
      crouchM: t.landDropM * w,
      squash: 1 - t.landSquash * w,
    };
  }
  const u = (v - t.landAt) / (1 - t.landAt);
  const rest = springReturn(u, t.standOvershoot);
  return {
    ...kip,
    ...blend(neutral, land, rest),
    squash: 1 - t.landSquash * rest,
    neutralWeight: 1 - smooth(u),
    crouchM: t.landDropM * rest,
    landedAgoS: time - timing.landAtS,
  };
}

/** Poza przewrócenia dla snapshotu albo null (brak przewrócenia, śmierć, inny stan, nie-humanoid). */
export function knockdownFrame(
  definition: EnemyDefinition,
  snapshot: Pick<EnemySnapshot, 'state' | 'stateTimeS' | 'knockdown'>,
  t: KnockdownTuning,
  knockdownS = tuning.enemies.knockdownStunS,
): KnockdownPose | null {
  if (
    snapshot.state !== 'stunned' ||
    !snapshot.knockdown ||
    !canKnockDown(definition)
  )
    return null;
  return knockdownPose(
    snapshot.stateTimeS,
    stunDuration(definition, snapshot, knockdownS),
    t,
  );
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
    up:
      hip -
      (hip - rest) * Math.max(0, sin) +
      pose.liftM -
      hip * cos -
      pose.crouchM,
  };
}
