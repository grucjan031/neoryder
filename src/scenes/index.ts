import { DamageTest } from './damageTest';
import { StyleTest } from './styleTest';
import { MeleeTest, PushTest } from './meleeTest';
import type { Scene as ThreeScene } from 'three';
import type { GameContext } from '../core/context';
import type { InputSnapshot } from '../core/input';
import { Sandbox } from './sandbox';
import { PlayerTest } from './playerTest';
import { BlasterTest } from './blasterTest';

export interface Scene {
  readonly id: string;
  init(ctx: GameContext, three: ThreeScene): Promise<void> | void;
  step(dt: number, input: InputSnapshot): void;
  /** frameDt: czas rzeczywisty klatki w s (efekty kamery działające także w hitstopie). */
  render(alpha: number, frameDt?: number): void;
  dispose(): void;
  query?(name: string): unknown;
  reset?(): void;
}
export type SceneFactory = () => Scene;
export const scenes: Record<string, SceneFactory> = {
  sandbox: () => new Sandbox(),
  'player-test': () => new PlayerTest(),
  'damage-test': () => new DamageTest(),
  'style-test': () => new StyleTest(),
  'melee-test': () => new MeleeTest(),
  'push-test': () => new PushTest(),
  'blaster-test': () => new BlasterTest(),
};
