import type { Scene as ThreeScene } from 'three';
import type { GameContext } from '../core/context';
import type { InputSnapshot } from '../core/input';
import { Sandbox } from './sandbox';

export interface Scene {
  readonly id: string;
  init(ctx: GameContext, three: ThreeScene): Promise<void> | void;
  step(dt: number, input: InputSnapshot): void;
  render(alpha: number): void;
  dispose(): void;
}
export type SceneFactory = () => Scene;
export const scenes: Record<string, SceneFactory> = {
  sandbox: () => new Sandbox(),
};
