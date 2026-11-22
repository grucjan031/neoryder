import { z } from 'zod';
import type { EventBus } from '../core/events';
import type { Rng } from '../core/rng';
import type { Tuning } from '../core/tuning';
import type { HubPropDef } from './hubSchema';

const text = z.string().trim().min(1);
export const hubPropTextsSchema = z.object({
  labels: z.object({
    jukebox: text,
    noodles: text,
    radio: text,
    bag: text,
    petCat: text,
    seat: text,
    stand: text,
  }),
  jukebox: z.object({ speaker: text, tracks: z.tuple([text, text, text]) }),
  noodles: z.object({ lines: z.array(text).min(2) }),
});
export type HubPropTexts = z.infer<typeof hubPropTextsSchema>;

export interface HubBagState {
  id: string;
  angle: { x: number; z: number };
  previous: { x: number; z: number };
  velocity: { x: number; z: number };
}

/** Stan rekwizytów aktualizowany wyłącznie zegarem symulacji. */
export class HubProps {
  private readonly cooldowns = new Map<string, number>();
  private readonly tracks = new Map<string, number>();
  readonly bags: HubBagState[];
  warmthLeft = 0;

  constructor(
    readonly defs: readonly HubPropDef[],
    private readonly t: Tuning['hub'],
    private readonly bus: EventBus,
    private readonly rng: Rng,
    readonly texts: HubPropTexts,
  ) {
    this.bags = defs
      .filter((p) => p.kind === 'bag')
      .map(({ id }) => ({
        id,
        angle: { x: 0, z: 0 },
        previous: { x: 0, z: 0 },
        velocity: { x: 0, z: 0 },
      }));
    for (const p of defs) if (p.kind === 'jukebox') this.tracks.set(p.id, 0);
  }

  track(id: string): number {
    return this.tracks.get(id) ?? 0;
  }

  noodleLine(): string {
    return this.rng.pick(this.texts.noodles.lines);
  }

  use(id: string, yaw: number, interruptRadio = false): boolean {
    const prop = this.defs.find((p) => p.id === id);
    if (
      !prop ||
      prop.kind === 'seat' ||
      ((this.cooldowns.get(id) ?? 0) > 0 &&
        !(prop.kind === 'radio' && interruptRadio))
    )
      return false;
    this.cooldowns.set(
      id,
      prop.kind === 'noodles' ? this.t.noodlesCooldownS : this.t.propCooldownS,
    );
    if (prop.kind === 'jukebox')
      this.tracks.set(
        id,
        (this.track(id) + 1) % this.texts.jukebox.tracks.length,
      );
    if (prop.kind === 'noodles') this.warmthLeft = this.t.noodlesWarmthS;
    if (prop.kind === 'bag') {
      const bag = this.bags.find((b) => b.id === id)!;
      bag.velocity.x -= Math.sin(yaw) * this.t.bagImpulseRadS;
      bag.velocity.z -= Math.cos(yaw) * this.t.bagImpulseRadS;
    }
    this.bus.emit('hub_prop_used', { prop: id, kind: prop.kind });
    return true;
  }

  step(dt: number): void {
    if (!(dt > 0)) return;
    this.warmthLeft = Math.max(0, this.warmthLeft - dt);
    for (const [id, left] of this.cooldowns)
      this.cooldowns.set(id, Math.max(0, left - dt));
    for (const bag of this.bags) {
      for (const axis of ['x', 'z'] as const) {
        bag.previous[axis] = bag.angle[axis];
        bag.velocity[axis] -=
          this.t.bagGravityRadS2 * Math.sin(bag.angle[axis]) * dt;
        bag.velocity[axis] *= Math.exp(-this.t.bagDamping * dt);
        bag.angle[axis] = Math.max(
          -this.t.bagMaxAngleRad,
          Math.min(
            this.t.bagMaxAngleRad,
            bag.angle[axis] + bag.velocity[axis] * dt,
          ),
        );
        if (
          Math.abs(bag.angle[axis]) < this.t.bagRestEpsilon &&
          Math.abs(bag.velocity[axis]) < this.t.bagRestEpsilon
        ) {
          bag.angle[axis] = 0;
          bag.velocity[axis] = 0;
        }
      }
    }
  }

  get snapshot() {
    return this.defs.map(({ id, kind }) => ({
      id,
      kind,
      cooldownLeft: this.cooldowns.get(id) ?? 0,
      ...(kind === 'jukebox' ? { track: this.track(id) } : {}),
      ...(kind === 'bag'
        ? { angle: { ...this.bags.find((b) => b.id === id)!.angle } }
        : {}),
    }));
  }
}
