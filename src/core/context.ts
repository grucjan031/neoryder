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
}
