import { z } from 'zod';
import type { EventBus } from '../core/events';
import type { Vec3 } from '../core/math';
import type { Rng } from '../core/rng';
import type { Tuning } from '../core/tuning';

type DipTuning = Pick<
  Tuning['hub'],
  | 'powerDipDurationS'
  | 'powerDipMinLevel'
  | 'powerDipBlinkCount'
  | 'powerDipBlinkS'
  | 'powerDipBlinkGapS'
  | 'powerDipBlinkLevel'
  | 'powerDipFallS'
  | 'powerDipRiseS'
  | 'powerDipReturnGapS'
  | 'powerDipSoftFallS'
  | 'powerDipSoftRiseS'
>;

const smooth = (x: number): number => {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
};

/**
 * Poziom zasilania (0-1) w `ageS` s od początku spadku napięcia. `flashes = false`
 * daje łagodne przygaśnięcie bez skoków jasności (dostępność).
 */
export function powerLevel(
  ageS: number,
  t: DipTuning,
  flashes: boolean,
): number {
  const d = t.powerDipDurationS;
  if (!(ageS >= 0) || ageS >= d) return 1;
  const min = t.powerDipMinLevel;
  if (!flashes)
    return (
      1 -
      (1 - min) *
        Math.min(
          smooth(ageS / t.powerDipSoftFallS),
          smooth((d - ageS) / t.powerDipSoftRiseS),
        )
    );
  const blink = t.powerDipBlinkLevel;
  const period = t.powerDipBlinkS + t.powerDipBlinkGapS;
  let a = ageS;
  if (a < t.powerDipBlinkCount * period)
    return a % period < t.powerDipBlinkS ? blink : 1;
  a -= t.powerDipBlinkCount * period;
  if (a < t.powerDipFallS) return 1 + (min - 1) * (a / t.powerDipFallS);
  const tail =
    t.powerDipRiseS +
    t.powerDipReturnGapS +
    t.powerDipBlinkS +
    t.powerDipBlinkGapS;
  const left = d - ageS;
  if (left > tail) return min;
  const into = tail - left;
  if (into < t.powerDipRiseS) return min + (1 - min) * (into / t.powerDipRiseS);
  const blinkStart = t.powerDipRiseS + t.powerDipReturnGapS;
  return into >= blinkStart && into < blinkStart + t.powerDipBlinkS ? blink : 1;
}

/** Zegar symulacji spadków napięcia; render i audio jedynie odczytują poziom. */
export class HubPowerDip {
  private remainingS: number;
  private ageS: number | null = null;

  constructor(
    private readonly rng: Rng,
    private readonly t: Tuning['hub'],
    private readonly bus: EventBus,
  ) {
    this.remainingS = rng.float(t.powerDipFirstS.min, t.powerDipFirstS.max);
  }

  get active(): boolean {
    return this.ageS !== null;
  }

  get nextInS(): number {
    return Math.max(0, this.remainingS);
  }

  level(flashes: boolean): number {
    return this.ageS === null ? 1 : powerLevel(this.ageS, this.t, flashes);
  }

  /** Odstęp liczony od początku spadku, także po komendzie debug. */
  force(): void {
    this.ageS = 0;
    this.remainingS = this.rng.float(
      this.t.powerDipIntervalS.min,
      this.t.powerDipIntervalS.max,
    );
    this.bus.emit('hub_power_dip', { durationS: this.t.powerDipDurationS });
  }

  /** Zwraca true w kroku, w którym prąd wraca (koniec spadku). */
  step(dt: number): boolean {
    if (!(dt > 0) || !Number.isFinite(dt)) return false;
    this.remainingS -= dt;
    if (this.remainingS <= 0 && this.ageS === null) this.force();
    if (this.ageS === null) return false;
    this.ageS += dt;
    if (this.ageS < this.t.powerDipDurationS) return false;
    this.ageS = null;
    return true;
  }
}

export const hubEventsSchema = z.object({
  powerDip: z
    .array(z.object({ npc: z.string().min(1), text: z.string().min(1) }))
    .min(1),
});
export type HubEvents = z.infer<typeof hubEventsSchema>;
export type PowerDipComment = HubEvents['powerDip'][number];

/** Waliduje teksty zdarzeń; `npc` musi należeć do podanych identyfikatorów (npcs.pl.json). */
export function loadHubEvents(
  data: unknown,
  npcIds?: ReadonlySet<string>,
): HubEvents {
  const events = hubEventsSchema.parse(data);
  events.powerDip.forEach((entry, index) => {
    if (npcIds && !npcIds.has(entry.npc))
      throw new Error(`Nieznany NPC w powerDip[${index}]: ${entry.npc}.`);
  });
  return events;
}

/**
 * Komentarz po powrocie prądu: najbliższy graczowi NPC z wpisem w danych (w promieniu
 * `radiusM`, w płaszczyźnie XZ), jego kwestia losowana z `rng`. `blocked` = dymek,
 * rozmowa albo otwarta stacja/plan.
 */
export function pickDipComment(
  comments: readonly PowerDipComment[],
  npcs: readonly { id: string; position: Vec3 }[],
  player: Vec3,
  radiusM: number,
  rng: Rng,
  blocked: boolean,
): PowerDipComment | null {
  if (blocked) return null;
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const npc of npcs) {
    if (!comments.some((c) => c.npc === npc.id)) continue;
    const distance = Math.hypot(
      npc.position.x - player.x,
      npc.position.z - player.z,
    );
    if (distance <= radiusM && distance < bestDistance) {
      best = npc.id;
      bestDistance = distance;
    }
  }
  if (best === null) return null;
  return rng.pick(comments.filter((c) => c.npc === best));
}
