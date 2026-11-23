import type { EventBus } from '../events';
import type { Vec3 } from '../math';
import type { GamepadSettings, GamepadTuning, SampledPad } from './gamepad';
import { PIERCE_BLOCK_TAG } from '../../combat/damage/types';

type Effect = Required<
  Pick<
    GamepadEffectParameters,
    'duration' | 'strongMagnitude' | 'weakMagnitude'
  >
>;

export class Rumble {
  private readonly off: (() => void)[];
  private actuator: GamepadHapticActuator | undefined;

  constructor(
    bus: EventBus,
    getPad: () => SampledPad | undefined,
    getSettings: () => GamepadSettings,
    t: GamepadTuning['rumble'],
    listener: () => Vec3,
  ) {
    const players = new Set<number>();
    const play = (effect: Effect, attenuation = 1): void => {
      const { vibration, vibrationStrength } = getSettings();
      const actuator = getPad()?.vibrationActuator;
      if (!vibration || vibrationStrength <= 0 || !actuator?.playEffect) return;
      this.actuator = actuator;
      const strength = (magnitude: number) =>
        Math.min(1, Math.max(0, magnitude * vibrationStrength * attenuation));
      try {
        void Promise.resolve(
          actuator.playEffect('dual-rumble', {
            duration: Math.max(0, effect.duration),
            strongMagnitude: strength(effect.strongMagnitude),
            weakMagnitude: strength(effect.weakMagnitude),
          }),
        ).catch(() => undefined);
      } catch {
        // Kontroler może zostać odłączony między odczytem a uruchomieniem efektu.
      }
    };
    this.off = [
      bus.on('entity_spawned', ({ id, kind }) => {
        if (kind === 'player') players.add(id);
      }),
      bus.on('entity_despawned', ({ id }) => {
        players.delete(id);
      }),
      bus.on('damage_dealt', ({ target, source, amount, killed, tags }) => {
        if (players.has(target) && amount > 0 && !killed) play(t.damage);
        else if (
          source !== null &&
          players.has(source) &&
          !players.has(target) &&
          amount > 0 &&
          (amount >= t.heavyDamage || tags.includes(PIERCE_BLOCK_TAG))
        )
          play(t.heavy);
      }),
      bus.on('parry_success', ({ defender }) => {
        if (players.has(defender)) play(t.parry);
      }),
      bus.on('explosion', ({ point }) => {
        const ear = listener();
        const distance = Math.hypot(
          point.x - ear.x,
          point.y - ear.y,
          point.z - ear.z,
        );
        if (distance < t.explosionRangeM)
          play(t.explosion, 1 - distance / t.explosionRangeM);
      }),
      bus.on('player_died', ({ id }) => {
        if (players.has(id)) play(t.death);
      }),
      bus.on('input:deviceChanged', ({ device }) => {
        if (device === 'keyboardMouse') this.stop();
      }),
    ];
  }

  stop(): void {
    try {
      void this.actuator?.reset?.().catch(() => undefined);
    } catch {
      // Kontroler jest już niedostępny.
    }
    this.actuator = undefined;
  }

  dispose(): void {
    for (const off of this.off) off();
    this.stop();
  }
}
