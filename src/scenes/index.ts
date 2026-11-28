import type { PerspectiveCamera, Scene as ThreeScene } from 'three';
import type { GameContext } from '../core/context';
import type { InputSnapshot } from '../core/input';

export type CameraPose = Pick<PerspectiveCamera, 'position' | 'rotation'>;
export interface Scene {
  readonly id: string;
  init(ctx: GameContext, three: ThreeScene): Promise<void> | void;
  step(dt: number, input: InputSnapshot): void;
  /** frameDt: czas rzeczywisty klatki w s (efekty kamery działające także w hitstopie). */
  render(alpha: number, frameDt?: number, cameraOverride?: CameraPose): void;
  dispose(): void;
  query?(name: string): unknown;
  reset?(): void;
}
export type SceneFactory = () => Scene;
/** Pobiera chunk sceny i zwraca jej fabrykę; `main.ts` buduje scenę dopiero po rendererze i kamerze. */
export type SceneLoader = () => Promise<SceneFactory>;
// Każda scena to osobny import(): menu i ekran ładowania nie pobierają kodu scen, Rapiera ani danych pokoi.
export const scenes: Record<string, SceneLoader> = {
  'reactor-test': () =>
    import('./reactorTest').then((m) => () => new m.ReactorTest()),
  'scientist-test': () =>
    import('./scientistTest').then((m) => () => m.createScientistTest()),
  'map-audit': () =>
    import('./mapAuditScene').then((m) => () => new m.MapAuditScene()),
  'map-walk': () => import('./mapWalk').then((m) => () => new m.MapWalkScene()),
  tutorial: () => import('./tutorial').then((m) => () => new m.Tutorial()),
  'pad-test': () => import('./padTest').then((m) => () => new m.PadTest()),
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
  legsTest: () =>
    import('./playerTest').then(
      (m) => () => new m.PlayerTest(true, 'legsTest'),
    ),
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
  'chimera-test': () =>
    import('./aiTest').then((m) => () => m.createChimeraTest()),
  'helix-test': () => import('./aiTest').then((m) => () => m.createHelixTest()),
  'ai-test': () => import('./aiTest').then((m) => () => new m.AiTest()),
  'status-test': () =>
    import('./aiTest').then((m) => () => m.createStatusTest()),
  'barrier-test': () =>
    import('./aiTest').then((m) => () => m.createBarrierTest()),
  'debris-test': () =>
    import('./debrisTest').then((m) => () => new m.DebrisTest()),
  'grab-test': () => import('./grabTest').then((m) => () => new m.GrabTest()),
  'elevator-test': () =>
    import('./elevatorTest').then((m) => () => new m.ElevatorTest()),
  'room-test': () => import('./roomTest').then((m) => () => m.createRoomTest()),
  'stealth-test': () =>
    import('./stealthTest').then((m) => () => new m.StealthTest()),
  'puzzle-test': () =>
    import('./roomTest').then((m) => () => m.createPuzzleTest()),
  'escort-test': () =>
    import('./escortTest').then((m) => () => m.createEscortTest()),
  'payload-test': () =>
    import('./payloadTest').then((m) => () => m.createPayloadTest()),
  'ally-test': () => import('./allyTest').then((m) => () => m.createAllyTest()),
};
