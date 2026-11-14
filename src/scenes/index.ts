import { DamageTest } from './damageTest';
import { StyleTest } from './styleTest';
import { MeleeTest, ParryTest, PushTest } from './meleeTest';
import { Arena } from './arena';
import { SfxTest } from './sfxTest';
import type { Scene as ThreeScene } from 'three';
import type { GameContext } from '../core/context';
import type { InputSnapshot } from '../core/input';
import { Sandbox } from './sandbox';
import { PlayerTest } from './playerTest';
import { BlasterTest } from './blasterTest';
import { WeaponsTest } from './weaponsTest';
import { AiTest, createStatusTest, createBarrierTest } from './aiTest';
import { DebrisTest } from './debrisTest';
import { GrabTest } from './grabTest';
import { MapTest } from './mapTest';
import { createRoomTest } from './roomTest';
import { BossTest } from './bossTest';

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
  'boss-test': () => new BossTest(),
  'map-test': () => new MapTest(),
  sandbox: () => new Sandbox(),
  'player-test': () => new PlayerTest(),
  'damage-test': () => new DamageTest(),
  'style-test': () => new StyleTest(),
  arena: () => new Arena(true, true),
  'sfx-test': () => new SfxTest(),
  'melee-test': () => new MeleeTest(),
  'push-test': () => new PushTest(),
  'parry-test': () => new ParryTest(),
  'blaster-test': () => new BlasterTest(),
  'weapons-test': () => new WeaponsTest(),
  'ai-test': () => new AiTest(),
  'status-test': () => createStatusTest(),
  'barrier-test': () => createBarrierTest(),
  'debris-test': () => new DebrisTest(),
  'grab-test': () => new GrabTest(),
  'room-test': () => createRoomTest(),
};
