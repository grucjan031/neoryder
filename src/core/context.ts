import type { AudioSystem } from '../audio/audioSystem';
import type { CommandRegistry } from '../ui/debugCommands';
import type { EventBus } from './events';
import type { Rng } from './rng';
import type { GameLoop } from './loop';
import type { Tuning } from './tuning';

export interface GameContext {
  bus: EventBus;
  rng: Rng;
  loop: GameLoop;
  tuning: Tuning;
  debug: boolean;
  commands?: CommandRegistry;
  camera?: import('three').PerspectiveCamera;
  /** Dźwięki (#14) — jeden system na aplikację. */
  audio?: AudioSystem;
  /** Wznowienie gry z gestu użytkownika (zdejmuje pauzę, przechwytuje mysz). */
  resume?: () => void;
}
