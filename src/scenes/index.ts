import type { Scene as ThreeScene } from 'three';
import type { GameContext } from '../core/context';
import type { InputSnapshot } from '../core/input';

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
/** Pobiera chunk sceny i zwraca jej fabrykę; `main.ts` buduje scenę dopiero po rendererze i kamerze. */
export type SceneLoader = () => Promise<SceneFactory>;
// Każda scena to osobny import(): menu i ekran ładowania nie pobierają kodu scen, Rapiera ani danych pokoi.
export const scenes: Record<string, SceneLoader> = {
  tutorial: () => import('./tutorial').then((m) => () => new m.Tutorial()),
  'city-fx-test': () =>
    import('./cityFxTest').then((m) => () => new m.CityFxTest()),
  'city-props-test': () =>
    import('./cityPropsTest').then((m) => () => new m.CityPropsTest()),
  'boss-test': () => import('./bossTest').then((m) => () => new m.BossTest()),
  hub: () => import('./hub').then((m) => () => new m.HubScene()),
  run: () => import('./run').then((m) => () => new m.RunScene()),
  challenge: () =>
    import('./run').then((m) => () => new m.RunScene({ dailyChallenge: true })),
  conquest: () => import('./run').then((m) => () => new m.RunScene()),
  horizonTest: () =>
    import('./horizonTest').then((m) => () => new m.HorizonTest()),
  weatherTest: () =>
    import('./weatherTest').then((m) => () => new m.WeatherTest()),
  mission: () => import('./mission').then((m) => () => new m.MissionScene()),
  'map-test': () => import('./mapTest').then((m) => () => new m.MapTest()),
  sandbox: () => import('./sandbox').then((m) => () => new m.Sandbox()),
  'player-test': () =>
    import('./playerTest').then((m) => () => new m.PlayerTest()),
  'damage-test': () =>
    import('./damageTest').then((m) => () => new m.DamageTest()),
  'style-test': () =>
    import('./styleTest').then((m) => () => new m.StyleTest()),
  'neon-test': () => import('./neonTest').then((m) => () => new m.NeonTest()),
  arena: () => import('./arena').then((m) => () => new m.Arena(true, true)),
  endless: () =>
    import('./arena').then((m) => () => new m.Arena(true, true, 'endless')),
  'arena-mutators': () =>
    import('./arena').then(
      (m) => () => new m.Arena(true, true, m.ARENA_MUTATORS_SCENE),
    ),
  'sfx-test': () => import('./sfxTest').then((m) => () => new m.SfxTest()),
  'melee-test': () =>
    import('./meleeTest').then((m) => () => new m.MeleeTest()),
  'push-test': () => import('./meleeTest').then((m) => () => new m.PushTest()),
  'parry-test': () =>
    import('./meleeTest').then((m) => () => new m.ParryTest()),
  'blaster-test': () =>
    import('./blasterTest').then((m) => () => new m.BlasterTest()),
  'weapons-test': () =>
    import('./weaponsTest').then((m) => () => new m.WeaponsTest()),
  'ai-test': () => import('./aiTest').then((m) => () => new m.AiTest()),
  'status-test': () =>
    import('./aiTest').then((m) => () => m.createStatusTest()),
  'barrier-test': () =>
    import('./aiTest').then((m) => () => m.createBarrierTest()),
  'debris-test': () =>
    import('./debrisTest').then((m) => () => new m.DebrisTest()),
  'grab-test': () => import('./grabTest').then((m) => () => new m.GrabTest()),
  'room-test': () => import('./roomTest').then((m) => () => m.createRoomTest()),
  'escort-test': () =>
    import('./escortTest').then((m) => () => m.createEscortTest()),
  'payload-test': () =>
    import('./payloadTest').then((m) => () => m.createPayloadTest()),
};
