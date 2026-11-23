import { z } from 'zod';
import type { EntityId, EventBus } from '../../core/events';
import type { InputSnapshot } from '../../core/input';
import type { Vec3 } from '../../core/math';
import type { Tuning } from '../../core/tuning';
import pushData from '../../data/powers/push.json';
import { ConePower } from './cone';
import type { PowerDeps, PowerInput } from './power';
import { conePowerSchema } from './powerSchema';

/** Walidator zgodności F1; pełny okrąg jest wariantem cone w rejestrze. */
export const pushSchema = conePowerSchema.extend({
  coneAngleDeg: z.number().finite().positive().max(180),
});
export type PushDefinition = z.infer<typeof pushSchema>;

export function loadPush(data: unknown): PushDefinition {
  const result = pushSchema.safeParse(data);
  if (!result.success)
    throw new Error(`Nieprawidłowe dane mocy: ${result.error.message}`);
  return result.data;
}

export const pushDefinition = loadPush(pushData);

export interface PushTarget {
  id: EntityId;
  physical?: boolean;
  /** Środek celu (zwykle tułów). */
  position: Vec3;
}

export type PushDeps = Omit<PowerDeps, 'bus' | 'tuning'>;

function isPowerInput(input: InputSnapshot | PowerInput): input is PowerInput {
  return typeof input.pressed === 'boolean';
}

/** Adapter API F1 do wspólnego mechanizmu stożka. */
export class ResonancePush extends ConePower {
  constructor(
    def: PushDefinition,
    deps: PushDeps,
    bus: EventBus,
    tuning: Tuning,
  ) {
    super(def, { ...deps, bus, tuning });
  }

  override step(dt: number, input: InputSnapshot | PowerInput): void {
    super.step(
      dt,
      isPowerInput(input)
        ? input
        : {
            pressed: input.pressed.has('power'),
            held: input.held.has('power'),
            released: input.released.has('power'),
          },
    );
  }
}
