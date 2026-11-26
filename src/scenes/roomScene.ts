import { padAimTargets } from './padAimTargets';
import { Conquest } from '../world/conquest';
import { conquestMode, assaultMode, heistMode } from '../world/modes';
import { Heist, type HeistEnemy } from '../world/heist';
import { Assault } from '../world/assault';
import { AssaultView } from '../ui/assaultUi';
import { HeistView } from '../ui/heistUi';
import {
  assaultForArena,
  heistForArena,
  modeForArena,
} from '../world/modeSchema';
import { ArenaNavigation } from '../world/arenaNavigation';
import { AllySquad } from '../allies/squad';
import type { Ally, AllyNavigation, AllySnapshot } from '../allies/ally';
import { levelAllySchema, type LevelAlly } from '../world/levelSchema';
import {
  buildFloorNavigation,
  SquadPresenter,
  withoutAction,
} from '../allies/squadPresenter';
import {
  squadHealthModifiers,
  squadOf,
  type SquadMemberState,
} from '../allies/roster';
import { allyDefinitions } from '../allies/allySchema';
import { ConquestView } from '../ui/conquestUi';
import { MissionObjectives } from '../world/missionObjectives';
import { missionDefinitions } from '../world/missions';
import { MissionView } from '../render/missionView';
import { MissionHud } from '../ui/missionUi';
import { loadWaves } from '../world/waves';
import type {
  MissionDefinition,
  MissionObjective,
} from '../world/missionSchema';
import { selectWaveSpawn, spawnOcclusion } from '../world/arenaSpawns';
import { worldEnvelope } from '../render/horizon';
import { weatherDefinitions } from '../render/weatherSchema';
import { SceneAtmosphere } from '../render/sceneAtmosphere';
import { HazardSystem } from '../world/hazards';
import { PropPhysicsSystem } from '../world/propPhysics';
import type { PropKind } from '../world/propPhysics';
import { PropRenderer, propTemplatesFromModel } from '../render/propRenderer';
import type { DecorDef } from '../world/dressingSchema';
import { ScatterProps, isScatterModel } from '../world/scatterProps';
import { ScatterRenderer } from '../render/scatterRenderer';
import { getLiteFx } from '../render/fxMode';
import type { HazardTarget } from '../world/hazards';
import { HazardView } from '../render/hazardView';
import { GrabPuzzle } from '../world/grabPuzzle';
import { GrabPhysics } from '../physics/grabPhysics';
import { GrabPower } from '../combat/powers/grab';
import { GrabRenderer } from '../render/grabRenderer';
import { GrabPuzzleView } from '../render/grabPuzzleView';
import { PuzzleHud } from '../ui/puzzleHud';
import { puzzleText } from '../ui/puzzleText';
import { CityDressing } from '../render/city/dressing';
import {
  cloneCityModel,
  isCityModelFile,
  loadDecor,
} from '../render/cityModels';
import {
  batchInstancedTemplate,
  batchStaticGeometry,
  partitionByTriangles,
} from '../render/staticBatch';
import { FppViewModel } from '../render/fppViewModel';
import {
  queryBladeArc,
  queryBladeSegment,
  queryBladeSpin,
} from '../combat/melee/bladeQueries';
import { FlyingBlade } from '../render/flyingBlade';
import {
  Box3,
  BoxGeometry,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
} from 'three';
import type { BufferGeometry, Object3D, Scene as ThreeScene } from 'three';
import type { Collider, World } from '@dimforge/rapier3d-compat';
import { z } from 'zod';
import type { GameContext } from '../core/context';
import { EntityRegistry } from '../core/entities';
import type { EntityId } from '../core/events';
import type { InputSnapshot } from '../core/input';
import type { Vec3 } from '../core/math';
import { loadSettings } from '../core/save';
import { Stats, type StatModifier } from '../core/stats';
import { DamageSystem, Health, Hurtboxes } from '../combat/damage';
import type { HitShape } from '../combat/melee/bladeSchema';
import { PlasmaBlade } from '../combat/melee/plasmaBlade';
import { ExecuteSystem, type ExecuteEnemy } from '../combat/melee/execute';
import { HeldItem } from '../combat/heldItem';
import type { HeldItemView } from '../combat/heldItem';
import { PlayerEnergy } from '../combat/powers/energy';
import { createPowerFromDefinition } from '../combat/powers/registry';
import { PowerSlots } from '../combat/powers/slots';
import { Weapon } from '../combat/weapons/weapon';
import { weaponModelOf } from '../combat/weapons/weaponSchema';
import { ProjectileSystem } from '../combat/weapons/projectiles';
import playerData from '../data/scenes/roomPlayer.json';
import type { RunState, MapNode } from '../core/runTypes';
import type { GrabPuzzleDefinition, RoomDefinition } from '../world/roomSchema';
import type { WavesDefinition, WaveDirectorDeps } from '../world/waves';
import {
  implantDefinitions,
  ImplantSystem,
  type ImplantDefinition,
} from '../progression/implants';
import { cloneRoomModel } from './roomModels';
import { statusDefinitions, StatusSystem } from '../combat/status';
import { Boss } from '../enemies/boss';
import { EnemyManager } from '../enemies/manager';
import type { StealthSpawn } from '../enemies/perception';
import { createEnemyView } from '../enemies/views';
import type { EnemyViewLike } from '../enemies/views';
import { availableEnemyIds, enemyRegistry } from '../enemies/registry';
import type { Enemy, EnemyDependencies } from '../enemies/types';
import { CollisionGroup, initPhysics, interactionGroups } from '../physics';
import { FpsCamera } from '../player/fpsCamera';
import { FppLegs } from '../render/fppLegs';
import { PlayerController } from '../player/playerController';
import { staminaStatsSchema } from '../player/stamina';
import type { PlayerState } from '../player/playerController';
import { BeamRenderer } from '../render/beamRenderer';
import { BossArenaFx } from '../render/bossArenaFx';
import { BarrierRenderer } from '../render/barrierRenderer';
import { LightningRenderer } from '../render/lightningRenderer';
import { BarrierPower } from '../combat/powers/barrier';
import { ExplosionRenderer } from '../render/explosionRenderer';
import type { Loadout } from '../progression/loadout';
import { resolveLoadout } from '../progression/patches';
import { modulePatches } from '../progression/moduleSchema';
import type { ResolvedLoadout } from '../progression/patches';
import type { DefinitionPatch } from '../core/metaTypes';
import { SynergySystem } from '../progression/synergies';
import { talentTrees } from '../progression/talentSchema';
import { resolveTalents, TalentSystem } from '../progression/talents';
import { createStyleLights } from '../render/lights';
import { getMaterial } from '../render/materials';
import { ProjectileRenderer } from '../render/projectileRenderer';
import { Hud } from '../ui/hud';
import { DebrisSystem } from '../vfx/debris';
import { DebrisRenderer } from '../vfx/debrisRenderer';
import { EnemyShatter } from '../vfx/enemyShatter';
import { WorldDebris } from '../vfx/worldDebris';
import { enemyBody } from '../vfx/enemyBody';
import { HitSparks } from '../vfx/hitSparks';
import { HitSparksRenderer, StatusVfxRenderer } from '../vfx/fxRenderer';
import { StatusVfx } from '../vfx/statusVfx';
import { WaveDirector } from '../world/waves';
import { threatModifiers } from '../world/threat';
import type { Scene } from './index';

const playerDefaults = z
  .object({
    ...staminaStatsSchema.shape,
    damage: z.number().default(1),
    attackSpeed: z.number().default(1),
    maxHealth: z.number().positive(),
    maxEnergy: z.number().positive(),
    energyRegen: z.number().nonnegative(),
    heatCapacity: z.number().positive(),
    coolingRate: z.number().nonnegative(),
  })
  .parse(playerData);

export type RoomCombatState = Pick<
  RunState,
  | 'hp'
  | 'energy'
  | 'loadout'
  | 'talents'
  | 'threatLevel'
  | 'credits'
  | 'implants'
  | 'modeId'
  | 'missionId'
  | 'objectives'
  | 'objectiveProgress'
>;

export interface RoomSceneOptions {
  node?: MapNode;
  staticCellSize?: number;
  linearMission?: {
    definition: MissionDefinition;
    order: readonly string[];
    bonusState?: (id: string) => string | undefined;
    objectives: Record<string, 'pending' | 'active' | 'done'>;
  };
  reinforce?: (wave: string, key: string) => void;
  missionSignal?: (trigger: string) => void;
  /** Host sam rozpoczyna kolejne ćwiczenia; standardowy pokój nadal startuje fale. */
  manualEncounter?: boolean;
  loadModels?: boolean;
  /** Ekran śmierci ma przycisk „Jeszcze raz” (sceny testowe zagadki; w runie śmierć kończy bieg). */
  retry?: boolean;
  implantDefinitions?: ReadonlyMap<string, ImplantDefinition>;
  /** Łatki definicji ekwipunku (ADR 0007 pkt 5), np. z talentów; domyślnie brak. */
  patches?: readonly DefinitionPatch[];
  /**
   * Sojusznicy sceny (docs/systems/allies.md). Bez tego pola RoomScene bierze `allies`
   * z układu (poziom liniowy przekazany jako layout).
   */
  allies?: readonly LevelAlly[];
}

/** Modele dla bloków układu; 'wall' to rozciągnięta bryła świata (bez modelu). */
const MODEL_FILES: Record<string, string> = {
  wall_segment: 'wall_segment',
  pillar: 'pillar',
  cover_low: 'cover_low',
  crate: 'crate',
  crate_small: 'crate_small',
};

/**
 * Proste bryły rozciągane do kolizji bloku (docs/assets.md, „Montaż bloków”).
 * Rekwizyty `city_*` i skrzynie zachowują proporcje i skalę 1.
 */
const STRETCH_MODELS = new Set(['pillar', 'cover_low', 'wall_segment']);
/** Tag obrażeń, którymi cisza po zwycięstwie rozpada pozostałych wrogów pokoju. */
const VICTORY_HOLD_TAG = '#victory_hold';

/**
 * Ustawia model bloku: początek układu modelu (spód, środek podstawy) w środku
 * spodu bloku. Model rozciągliwy dostaje skalę niejednorodną tak, by jego
 * bounding box był równy `size`, a spód i środek bboxu pokryły się z blokiem.
 * Gdy dłuższy bok podstawy bloku leży w innej osi niż dłuższy bok modelu,
 * model obraca się o 90° wokół Y, żeby profil (np. korona osłony) nie był
 * ściskany wzdłuż długości.
 */
export function placeBlockModel(
  scene: Object3D,
  model: string,
  size: Vec3,
  position: Vec3,
): void {
  const base = new Vector3(position.x, position.y - size.y / 2, position.z);
  scene.position.copy(base);
  if (!STRETCH_MODELS.has(model)) return;
  scene.position.set(0, 0, 0);
  scene.rotation.set(0, 0, 0);
  scene.scale.set(1, 1, 1);
  scene.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(scene);
  if (bounds.isEmpty()) {
    scene.position.copy(base);
    return;
  }
  const extent = bounds.getSize(new Vector3());
  const turn =
    extent.x !== extent.z &&
    size.x !== size.z &&
    extent.x > extent.z !== size.x > size.z;
  if (turn) scene.rotation.y = Math.PI / 2;
  // Skala działa w osiach modelu, przed obrotem.
  scene.scale.set(
    (turn ? size.z : size.x) / extent.x,
    size.y / extent.y,
    (turn ? size.x : size.z) / extent.z,
  );
  const centre = bounds.getCenter(new Vector3());
  const anchor = new Vector3(centre.x, bounds.min.y, centre.z)
    .multiply(scene.scale)
    .applyEuler(scene.rotation);
  scene.position.copy(base).sub(anchor);
}

/** Jeden pokój runu: osobny świat i skład walki zgodny z Areną. */
export class RoomScene implements Scene {
  readonly id: string = 'room';
  protected ctx!: GameContext;
  protected rapier!: Awaited<ReturnType<typeof initPhysics>>;
  protected world!: World;
  protected entities!: EntityRegistry;
  protected damage!: DamageSystem;
  private statuses!: StatusSystem;
  protected readonly hurtboxes = new Hurtboxes();
  private projectiles!: ProjectileSystem;
  private projectileView!: ProjectileRenderer;
  protected manager!: EnemyManager;
  private director!: WaveDirector;
  /** Tryb bossa (layout.bossEnemy): bez fal, pokój kończy śmierć bossa. */
  private boss: Boss | null = null;
  /** Oprawa walki z bossem (kosmetyka); tylko w pokoju bossa. */
  private bossFx?: BossArenaFx;
  protected player!: PlayerController;
  private legs?: FppLegs;
  private previous!: PlayerState;
  private fpsCamera!: FpsCamera;
  private energy!: PlayerEnergy;
  private blade!: PlasmaBlade;
  private execute!: ExecuteSystem;
  private executeTarget: EntityId | null = null;
  private heldItem!: HeldItem;
  private readonly flyingBlade = new FlyingBlade();
  private powers!: PowerSlots;
  private readonly loadout: Loadout;
  private readonly resolved: ResolvedLoadout;
  private readonly initialTalentIds: string[];
  private talentSystem!: TalentSystem;
  private weapons: Weapon[] = [];
  private weaponSlot = 0;
  private beamView!: BeamRenderer;
  private barrierView!: BarrierRenderer;
  private lightningView!: LightningRenderer;
  private explosionView!: ExplosionRenderer;
  private readonly playerStats = new Stats(playerDefaults);
  private readonly health = new Health(() => this.playerStats.get('maxHealth'));
  private fppView!: FppViewModel;
  private readonly views = new Map<EntityId, EnemyViewLike>();
  private readonly seenEnemyIds = new Set<EntityId>();
  private readonly powerPair: ReturnType<PowerSlots['get']>[] = [];
  protected readonly root = new Group();
  private readonly lights = createStyleLights();
  private atmosphere?: SceneAtmosphere;
  private dressing?: CityDressing;
  private readonly geometries = new Set<BufferGeometry>();
  private readonly off: (() => void)[] = [];
  private readonly tmpEuler = new Euler(0, 0, 0, 'YXZ');
  private readonly tmpQuat = new Quaternion();
  private state: 'playing' | 'dead' = 'playing';
  private elapsedS = 0;
  private cleared = false;
  protected disposed = false;
  private initDone = false;
  private readonly node: MapNode;
  private readonly implantDefs: ReadonlyMap<string, ImplantDefinition>;
  private readonly initialImplantIds: string[];
  private implantSystem!: ImplantSystem;
  private readonly loadModels: boolean;
  private readonly levelGates = new Map<
    string,
    { mesh: Mesh; collider: Collider }
  >();
  private readonly doors = new Map<
    string,
    { role: 'entry' | 'exit'; mesh: Mesh; collider: Collider }
  >();
  private god = false;
  /** Cisza po zwycięstwie nad bossem (RunScene): gracz nietykalny, bez pocisków i statusów. */
  private victoryHold = false;
  private passiveEncounter = false;
  private readonly manualEncounter: boolean;
  private kills = 0;
  /** Sparowane ciosy wręcz gracza (zapytanie debug `meleeParries`, e2e). */
  private meleeParries = 0;
  private hud?: Hud;
  private debris!: DebrisSystem;
  private debrisView!: DebrisRenderer;
  private shatter!: EnemyShatter;
  private worldDebris!: WorldDebris;
  private statusVfx!: StatusVfx;
  private statusView!: StatusVfxRenderer;
  private hitSparks!: HitSparks;
  private hitSparksView!: HitSparksRenderer;
  private synergies!: SynergySystem;
  private readonly missionSignal: ((trigger: string) => void) | undefined;
  private mission?: MissionObjectives;
  private conquest?: Conquest;
  private assault?: Assault;
  private heist?: Heist;
  private heistView?: HeistView;
  private assaultView?: AssaultView;
  protected navigation?: ArenaNavigation;
  private staticWorld?: Group;
  private readonly staticInstances: InstancedMesh[] = [];
  private conquestView?: ConquestView;
  private missionView?: MissionView;
  private missionHud?: MissionHud;
  private readonly reinforcements: WaveDirector[] = [];
  private hazards!: HazardSystem;
  private props?: PropPhysicsSystem;
  private propView?: PropRenderer;
  private scatter?: ScatterProps;
  private pendingScatter: DecorDef[] = [];
  private scatterView?: ScatterRenderer;
  private hazardView!: HazardView;
  private puzzle?: GrabPuzzle;
  private puzzleGrab?: GrabPhysics;
  private puzzleView?: GrabPuzzleView;
  private puzzleBeam?: GrabRenderer;
  private puzzleHud?: PuzzleHud;
  protected squad!: AllySquad;
  private presenter?: SquadPresenter;
  /** Siatka dla sojuszników w pokojach bez nawigacji trybu; null, gdy nie da się jej zbudować. */
  private allyNav: AllyNavigation | null | undefined;
  /** Sojusznicy czekający na `joinAfter`. */
  private pendingAllies: LevelAlly[] = [];

  constructor(
    private readonly layout: RoomDefinition,
    private readonly run: RoomCombatState | RunState,
    private readonly waves: WavesDefinition,
    private readonly options: RoomSceneOptions = {},
  ) {
    this.missionSignal = options.missionSignal;
    this.manualEncounter = options.manualEncounter ?? false;
    const node =
      options.node ??
      ('map' in run
        ? run.map.layers.flat().find((node) => node.id === run.currentNodeId)
        : undefined);
    if (!node)
      throw new Error('RoomScene wymaga bieżącego węzła w mapie runu.');
    this.node = { ...node, next: [...node.next] };
    // Łatki: talenty (po id węzła), moduły (po slotach), opcje sceny.
    this.initialTalentIds = [...new Set(run.talents)];
    this.resolved = resolveLoadout(run.loadout, [
      ...resolveTalents(this.initialTalentIds).patches,
      ...modulePatches(run.loadout),
      ...(options.patches ?? []),
    ]);
    this.loadout = run.loadout;
    this.loadModels = options.loadModels ?? true;
    this.implantDefs = options.implantDefinitions ?? implantDefinitions;
    this.initialImplantIds = [...new Set(run.implants)];
    for (const id of this.initialImplantIds) {
      if (!this.implantDefs.has(id))
        throw new Error(`Nieznany implant pokoju: ${id}`);
    }
  }

  async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    this.ctx = ctx;
    this.rapier = await initPhysics();
    if (this.disposed) return;
    this.world = new this.rapier.World({
      x: 0,
      y: ctx.tuning.physics.gravity,
      z: 0,
    });
    this.entities = new EntityRegistry(ctx.bus);
    this.damage = new DamageSystem(ctx.bus, this.entities);
    this.statuses = new StatusSystem(ctx.bus, this.damage, {
      position: (id) => this.enemyPosition(id),
      targets: () => this.enemyIds(),
    });
    const envelope = worldEnvelope(this.layout.blocks, this.layout.playerSpawn);
    this.atmosphere = new SceneAtmosphere(
      three,
      this.layout.theme,
      this.layout.id,
      this.layout.playerSpawn.y,
      envelope.bounds,
      envelope,
      ctx.camera,
      this.layout.arena?.water,
      weatherDefinitions.get(this.layout.weather ?? '')?.lighting
        ?.panoramaEnabled === false,
      this.layout.panoramaDropM,
    );
    three.add(this.root);
    this.root.add(this.lights);
    if (this.layout.arena?.exclusive || this.layout.arena?.spawnRing) {
      this.staticWorld = new Group();
      this.staticWorld.name = 'static-world';
      this.root.add(this.staticWorld);
    }
    this.props = new PropPhysicsSystem({
      world: this.world,
      bus: ctx.bus,
      damage: this.damage,
      entities: this.entities,
      hurtboxes: this.hurtboxes,
      tuning: ctx.tuning,
      doors: this.layout.doors.map((door) => door.position),
      deferActivation: true,
    });
    await this.buildLayout();
    if (this.disposed) return;
    const decor = new Group();
    decor.name = 'static-decor';
    (this.staticWorld ?? this.root).add(decor);
    const scatterDecor = this.pickScatterDecor();
    await loadDecor(
      decor,
      (this.layout.decor ?? []).filter((def) => !scatterDecor.includes(def)),
      this.loadModels,
    );
    this.pendingScatter = scatterDecor;
    if (this.disposed) return;
    if (this.staticWorld)
      batchStaticGeometry(this.staticWorld, this.geometries, {
        cellSize: this.layout.arena!.batchCellM,
        triangleBudget: ctx.tuning.arena.batchTriangleBudget,
      });
    else
      batchStaticGeometry(decor, this.geometries, {
        cellSize: this.options.staticCellSize,
      });
    this.dressing = new CityDressing(
      this.root,
      this.layout,
      this.atmosphere.theme,
      this.layout.playerSpawn.y,
      this.layout.weather
        ? `${'seed' in this.run ? this.run.seed : 'level'}:${this.layout.id}`
        : this.layout.id,
      ctx.audio,
    );

    this.atmosphere.sync(0);
    const playerId = this.entities.create('player', 'player');
    this.player = new PlayerController(
      playerId,
      this.world,
      ctx,
      this.spawnPosition(),
      loadSettings(),
      playerDefaults,
    );
    this.applyImplants();
    this.applyTalents();
    this.health.set(this.run.hp);
    this.registerPlayer();
    this.props?.activate();
    await this.buildScatter(this.pendingScatter);
    if (this.disposed) return;
    this.hurtboxes.add(playerId, this.player.colliderHandle);
    this.entities.bindCollider(playerId, this.player.colliderHandle);
    this.previous = this.player.getState();
    this.fpsCamera = new FpsCamera(ctx.tuning, playerId, ctx.bus);
    if (ctx.camera && this.loadModels)
      this.legs = new FppLegs(three, ctx.tuning);

    this.projectiles = new ProjectileSystem(
      this.world,
      this.entities,
      this.hurtboxes,
      this.damage,
      ctx.bus,
      ctx.tuning,
    );
    this.projectileView = new ProjectileRenderer(
      this.projectiles,
      ctx.tuning.weapons.maxProjectiles,
    );
    this.root.add(this.projectileView.root);
    this.beamView = new BeamRenderer();
    this.explosionView = new ExplosionRenderer(ctx.bus, {
      floorY: this.layout.playerSpawn.y,
      playerPosition: () => this.player.getState().position,
      burstSparks: (point, count, color) =>
        this.hitSparks.burst(point, null, color, count),
    });
    this.root.add(this.beamView.root, this.explosionView.root);
    this.barrierView = new BarrierRenderer(ctx.tuning);
    this.root.add(this.barrierView.root);
    this.lightningView = new LightningRenderer(ctx.tuning, ctx.bus, playerId);
    this.root.add(this.lightningView.root);

    this.manager = new EnemyManager(
      ctx,
      {
        projectiles: this.projectiles,
        world: this.world,
        entities: this.entities,
        damage: this.damage,
        hurtboxes: this.hurtboxes,
        statuses: this.statuses,
        stepClimbing: !!(
          this.layout.arena &&
          (this.layout.arena.exclusive ||
            this.layout.arena.spawnRing ||
            this.layout.blocks.some((b) => b.walkable))
        ),
        los: (from, to) => {
          const x = to.x - from.x,
            y = to.y - from.y,
            z = to.z - from.z;
          const length = Math.hypot(x, y, z);
          return (
            !length ||
            this.castWall(
              from,
              { x: x / length, y: y / length, z: z / length },
              length,
            ) === null
          );
        },
        getTarget: () =>
          this.passiveEncounter
            ? null
            : this.health.dead
              ? null
              : { id: playerId, ...this.player.getState() },
        // Każdy wróg wybiera cel z drużyny gracza; bez sojuszników to nadal gracz.
        getTargetFor: (enemy) => {
          if (this.passiveEncounter) return null;
          const player = this.health.dead
            ? null
            : { id: playerId, ...this.player.getState() };
          return this.enemyTarget(enemy, player);
        },
      },
      {
        ...(this.layout.director ? { director: this.layout.director } : {}),
        run: this.run,
        spawnPoints: this.layout.spawnPoints.map((p) => ({
          x: p.x,
          y: p.y ?? 0,
          z: p.z,
        })),
      },
    );
    this.player.setAimTargets(() => padAimTargets(this.manager));
    this.manager.setSpawnModifiers(this.baseSpawnModifiers());
    this.squad = new AllySquad({
      ctx,
      rapier: this.rapier,
      world: this.world,
      entities: this.entities,
      damage: this.damage,
      hurtboxes: this.hurtboxes,
      projectiles: this.projectiles,
      navigation: () => this.allyNavigation(),
      leader: () => {
        const state = this.player.getState();
        return {
          id: playerId,
          position: {
            x: state.position.x,
            y: state.position.y - state.height / 2,
            z: state.position.z,
          },
          yaw: state.yaw,
          alive: !this.health.dead,
        };
      },
      hostiles: () => {
        const list: { id: EntityId; position: Vec3; centerM: number }[] = [];
        if (this.passiveEncounter || this.victoryHold) return list;
        this.manager.forEach((enemy) => {
          if (
            !enemy.removed &&
            enemy.current.state !== 'dead' &&
            (!enemy.perception || enemy.perception.state === 'alerted')
          )
            list.push({
              id: enemy.id,
              position: enemy.current.position,
              centerM: enemy.definition.body?.centerY ?? 0,
            });
        });
        return list;
      },
    });
    this.presenter = new SquadPresenter(
      this.squad,
      this.root,
      ctx.tuning,
      ctx.bus,
      this.loadModels,
    );

    const hazardTargets: HazardTarget[] = [];
    const hazardTargetPool: HazardTarget[] = [];
    const addHazardTarget = (
      id: EntityId,
      position: Vec3,
      radius: number,
      halfHeight: number,
      centerY = 0,
    ): void => {
      const index = hazardTargets.length;
      const target = (hazardTargetPool[index] ??= {
        id,
        position: { x: 0, y: 0, z: 0 },
        radius,
        halfHeight,
      });
      target.id = id;
      target.position.x = position.x;
      target.position.y = position.y + centerY;
      target.position.z = position.z;
      target.radius = radius;
      target.halfHeight = halfHeight;
      hazardTargets.push(target);
    };
    const collectHazardEnemy = (enemy: Enemy): void => {
      if (enemy.removed || enemy.current.state === 'dead') return;
      const body = enemy.definition.body;
      addHazardTarget(
        enemy.id,
        enemy.current.position,
        body?.radius ??
          enemy.definition.drone?.radiusM ??
          ctx.tuning.player.capsuleRadius,
        body ? Math.max(0, body.height / 2 - body.radius) : 0,
        body?.centerY ?? 0,
      );
    };
    if (this.layout.puzzle) this.initPuzzle(this.layout.puzzle);
    this.hazards = new HazardSystem({
      bus: ctx.bus,
      damage: this.damage,
      entities: this.entities,
      hurtboxes: this.hurtboxes,
      world: this.world,
      playerId,
      hazards: this.layout.hazards ?? [],
      tuning: ctx.tuning.hazards,
      laserBlocked: (id) => this.puzzle?.blocksLaser(id) ?? false,
      targets: () => {
        const state = this.player.getState();
        const radius = ctx.tuning.player.capsuleRadius;
        hazardTargets.length = 0;
        // Cisza po zwycięstwie: hazardy nie mają kogo ranić (ani gracza, ani wrogów).
        if (this.victoryHold) return hazardTargets;
        if (!this.health.dead)
          addHazardTarget(
            playerId,
            state.position,
            radius,
            Math.max(0, state.height / 2 - radius),
          );
        this.manager.forEach(collectHazardEnemy);
        for (const target of this.props?.targets() ?? [])
          hazardTargets.push(target);
        return hazardTargets;
      },
    });
    this.hazardView = new HazardView(this.layout.hazards ?? []);
    this.root.add(this.hazardView.root);

    if (typeof document !== 'undefined')
      this.hud = new Hud(ctx.bus, {
        playerId,
        threats: () => {
          const sources: Enemy[] = [];
          this.manager.forEach((enemy) => sources.push(enemy));
          return sources;
        },
        threatOrigin: () => this.player.getState().position,
        loadout: this.loadout,
        totalWaves: this.waves.waves.length,
        ...(this.options.linearMission
          ? { deathScreen: false, showWaves: false }
          : {
              ...(this.puzzle ? { showWaves: false } : {}),
              ...(this.puzzle && this.options.retry
                ? { onRetry: () => this.retryPuzzle() }
                : {}),
              run: { credits: this.run.credits, implants: this.run.implants },
            }),
      });
    this.player.stamina.set(this.player.stamina.max);
    this.energy = new PlayerEnergy(
      playerId,
      this.playerStats,
      ctx.bus,
      ctx.tuning,
    );
    this.energy.set(this.run.energy);
    this.root.add(this.flyingBlade.root);
    this.createExecute();
    this.blade = new PlasmaBlade(
      this.resolved.blade,
      {
        owner: playerId,
        team: 'player',
        damage: this.damage,
        stats: this.playerStats,
        attackSpeed: () => this.playerStats.get('attackSpeed'),
        tryExecute: () => this.execute.tryExecute(),
        energy: this.energy.pool,
        queryArc: (reach, width, shape) => this.queryArc(reach, width, shape),
        querySegment: (from, to, radius, dash, dir) =>
          queryBladeSegment(
            this.world,
            this.hurtboxes,
            from,
            to,
            radius,
            dash,
            ctx.tuning.melee.dashCutHeightM,
            dir,
          ),
        hurtboxPosition: (box) =>
          this.world.getCollider(box.colliderHandle)?.translation() ?? null,
        castWall: (origin, dir, max, ignore) =>
          this.castWall(origin, dir, max, ignore),
        dashActive: () => this.player.getState().dashS > 0,
        aim: () => this.aim(),
        projectiles: this.projectiles,
        positionOf: (id) => this.enemy(id)?.current.position ?? null,
      },
      ctx.bus,
      ctx.tuning,
    );
    this.off.push(
      this.projectiles.addInterceptor(this.blade.interceptProjectile),
    );
    this.heldItem = new HeldItem(
      ctx.bus,
      playerId,
      ctx.tuning,
      this.loadout.startHeld,
    );
    this.createEquipment();
    this.debris = new DebrisSystem({
      maxDebris: ctx.tuning.vfx.maxDebris,
      walls: (pos, dir, dist) => this.castDebrisWall(pos, dir, dist),
      tuning: ctx.tuning.vfx,
    });
    this.debrisView = new DebrisRenderer(this.debris);
    this.root.add(this.debrisView.root);
    this.worldDebris = new WorldDebris(ctx.bus, this.debris, {
      tuning: ctx.tuning,
    });
    this.shatter = new EnemyShatter(ctx.bus, this.debris, {
      collapse: {
        tuning: ctx.tuning.enemies,
        ageOf: (id) => this.enemy(id)?.current.stateTimeS,
      },
      positionOf: (id) => this.enemy(id)?.current.position ?? null,
      bodyOf: (id) => {
        const e = this.enemy(id);
        return e ? enemyBody(e, 1) : null;
      },
      cameraPosition: () => ctx.camera?.position ?? null,
      tuning: ctx.tuning,
    });

    this.statusVfx = new StatusVfx(ctx.bus, {
      bodyOf: (id, a) => {
        const e = this.enemy(id);
        return e ? enemyBody(e, a) : null;
      },
      tuning: ctx.tuning,
    });
    this.statusView = new StatusVfxRenderer(this.statusVfx, {
      flames: ctx.tuning.vfx.maxStatusFlames,
      sparks: ctx.tuning.vfx.maxStatusSparks,
      stars: ctx.tuning.vfx.maxStatusStars,
    });
    this.root.add(this.statusView.root);
    this.hitSparks = new HitSparks(ctx.bus, {
      playerId,
      cameraPosition: () => ctx.camera?.position ?? null,
      tuning: ctx.tuning,
    });
    this.hitSparksView = new HitSparksRenderer(
      this.hitSparks,
      ctx.tuning.vfx.maxHitSparks,
    );
    this.root.add(this.hitSparksView.root);

    this.fppView = new FppViewModel(ctx.bus, playerId, {
      skinOf: (id) => this.run.loadout.skins?.[id],
      modulesOf: (id) => this.run.loadout.modules?.[id] ?? [],
      bladeDefinition: this.blade.definition,
      modelOf: (id) =>
        this.resolved.weapons.find((weapon) => weapon.id === id)?.model ??
        weaponModelOf(id),
      tuning: ctx.tuning,
    });
    await this.fppView.load(this.loadModels);
    if (this.disposed) {
      this.fppView.dispose();
      return;
    }
    this.root.add(this.fppView.root);

    // F2-17: hybrydy z tagów ekwipunku. Statystyki dashu i ruchu żyją w PlayerController.stats.
    this.synergies = new SynergySystem(ctx.bus, {
      user: playerId,
      heal: (amount) => {
        this.health.heal(amount);
        this.emitHealth();
      },
      userPosition: () => this.player.getState().position,
      applyStatus: (target, app) => this.statuses.apply(target, app, playerId),
      addEnergy: (n) => this.energy.add(n),
      coolWeapon: (amount) => this.weapon.vent(amount),
      stats: [this.playerStats, this.player.stats],
      damage: this.damage,
      statuses: this.statuses,
      targets: () => this.enemyIds(),
      position: (id) => this.enemyPosition(id),
    });
    this.refreshSynergyInputs();

    if (this.layout.arena) this.navigation = new ArenaNavigation(this.layout);
    this.director = new WaveDirector(
      this.waves,
      {
        spawn: (enemy, position) => this.spawnEnemy(enemy, position),
        playerPosition: () => this.player.getState().position,
        selectSpawn: this.navigation ? this.selectWavePoint : undefined,
      },
      ctx.bus,
      ctx.rng.fork('waves'),
    );
    this.off.push(
      ctx.bus.on('wave_cleared', ({ wave }) => {
        // Po fali wracają sojusznicy, którzy nie doczekali podniesienia.
        this.squad.restore();
        if (wave === this.director.totalWaves) this.completeRoom();
      }),
      ctx.bus.on('player_died', ({ id }) => {
        if (id === playerId) this.onPlayerDied();
      }),
      ctx.bus.on('melee_parried', ({ defender }) => {
        if (defender === playerId) this.meleeParries++;
      }),
      ctx.bus.on('enemy_killed', ({ id, killer }) => {
        if (killer === playerId) this.kills++;
        if (this.enemy(id)) this.conquest?.killed();
        const carrier = this.enemy(id);
        if (carrier) this.heist?.killed(id, carrier.current.position);
        if (this.boss && id === this.boss.id) {
          if (this.mission) {
            this.missionSignal?.('boss:defeated');
            for (const objective of this.mission.mission.objectives)
              if (objective.kind === 'killBoss')
                this.mission.done(objective.id);
            this.dissolveRemainingEnemies();
          }
          this.completeRoom();
        }
      }),
      ctx.bus.on('boss_phase', ({ id, phase }) => {
        if (this.boss?.id === id && (phase === 2 || phase === 3))
          this.missionSignal?.(`boss:phase:${phase}`);
      }),
    );
    if (this.run.modeId === 'conquest') {
      this.conquest = new Conquest(
        modeForArena(conquestMode, this.layout),
        ctx.bus,
      );
      if (typeof document !== 'undefined') {
        this.conquestView = new ConquestView(this.conquest, ctx.bus);
        this.root.add(this.conquestView.root);
      }
    }
    if (this.run.modeId === 'assault') {
      this.assault = new Assault(assaultForArena(assaultMode, this.layout), {
        signal: () => {},
        explode: (objective) => this.explodeMission(objective, playerId),
      });
      if (typeof document !== 'undefined') {
        this.assaultView = new AssaultView(this.assault);
        this.root.add(this.assaultView.root);
      }
    }
    if (this.run.modeId === 'heist') {
      this.heist = new Heist(heistForArena(heistMode, this.layout));
      if (typeof document !== 'undefined') {
        this.heistView = new HeistView(this.heist);
        this.root.add(this.heistView.root);
      }
    }
    const mission =
      this.options.linearMission?.definition ??
      missionDefinitions.get(this.run.missionId ?? '');
    if (mission) {
      this.mission = new MissionObjectives(
        mission,
        this.options.linearMission?.order ?? this.node.fixed?.objectives ?? [],
        this.options.linearMission
          ? { objectives: this.options.linearMission.objectives }
          : this.run,
        {
          signal: (trigger) => {
            this.missionSignal?.(trigger);
            const done = /^objective:(.+):done$/.exec(trigger);
            if (done) {
              this.squad.bark('objective');
              this.allyDependencyDone('objective', done[1]!);
            }
          },
          explode: (objective) => this.explodeMission(objective, playerId),
          reinforce: (wave, key) => this.reinforceMission(wave, key),
        },
        ctx.tuning.mission.zoneRadiusM,
        ctx.tuning.mission.pickupRadiusM,
        this.options.linearMission?.order,
      );
      this.missionView = new MissionView(
        this.mission,
        ctx.tuning.mission.zoneRadiusM,
      );
      this.root.add(this.missionView.root);
      if (typeof document !== 'undefined')
        this.missionHud = new MissionHud(
          this.mission,
          Boolean(this.options.linearMission),
          this.options.linearMission?.definition.bonuses,
          this.options.linearMission?.bonusState,
        );
      this.missionSignal?.(`enterNode:${this.node.layer}`);
      const guards = this.options.linearMission
        ? []
        : (mission.fixedNodes.find((node) => node.layer === this.node.layer)
            ?.guards ?? []);
      for (const guard of guards) {
        const objective = mission.objectives.find(
          (o) => o.id === guard.nearObjective,
        );
        const origin =
          guard.position ??
          (objective ? this.mission.position(objective) : null);
        if (!origin) continue;
        for (let i = 0; i < guard.count; i++) {
          const angle = Math.PI / 2 + (i * Math.PI * 2) / guard.count;
          this.spawnEnemy(guard.enemy, {
            x: origin.x + Math.cos(angle) * guard.radiusM,
            y: origin.y,
            z: origin.z + Math.sin(angle) * guard.radiusM,
          });
        }
      }
    }
    this.registerCommands(playerId);
    const allies =
      this.options.allies ??
      z
        .array(levelAllySchema)
        .optional()
        .parse((this.layout as { allies?: unknown }).allies) ??
      [];
    for (const ally of allies) {
      const after = ally.joinAfter;
      if (
        !after ||
        (after.kind === 'objective' &&
          this.options.linearMission?.objectives[after.id] === 'done')
      )
        this.addAlly(ally.id, ally.spawn);
      else this.pendingAllies.push(ally);
    }
    this.emitHealth();
    this.heldItem.reset(this.loadout.startHeld);
    this.world.step();
    // Drużyna z kryjówki wchodzi z graczem do każdego pokoju, ze zdrowiem z zapisu runu.
    for (const member of squadOf(this.run))
      if (allyDefinitions.has(member.id)) this.squad.join(member.id, member.hp);
    ctx.bus.emit('room_entered', {
      nodeId: this.node.id,
      roomId: this.layout.id,
      type: this.node.type,
      layer: this.node.layer,
    });
    if (this.layout.bossEnemy) {
      this.bossFx = new BossArenaFx(ctx.bus, {
        enemy: (id) => this.enemy(id),
        floorY: this.layout.playerSpawn.y,
        tuning: ctx.tuning,
        burstSparks: (point, count, color) =>
          this.hitSparks.burst(point, null, color, count),
      });
      this.root.add(this.bossFx.root);
      this.spawnBoss(this.layout.bossEnemy);
    } else if (!this.conquest && !this.assault && !this.heist && !this.puzzle)
      this.director.start();
    if (this.manualEncounter) this.director.stop();
    if (this.health.dead) this.onPlayerDied();
    this.render(1);
    this.initDone = true;
  }

  // ----------------------------------------------------------------- budowa

  private initPuzzle(definition: GrabPuzzleDefinition): void {
    this.puzzleGrab = new GrabPhysics(this.world, this.entities, () => []);
    this.puzzle = new GrabPuzzle(definition, {
      world: this.world,
      entities: this.entities,
      grab: this.puzzleGrab,
      hazards: this.layout.hazards ?? [],
      tuning: this.ctx.tuning.puzzle,
    });
    this.player.enableDynamicPush(this.ctx.tuning.puzzle.pushMassKg);
    this.puzzleView = new GrabPuzzleView(definition);
    this.root.add(this.puzzleView.root);
    const withGrab = this.resolved.powers.some(
      (power) => power.kind === 'grab',
    );
    if (withGrab) {
      this.puzzleBeam = new GrabRenderer(this.ctx.tuning);
      this.root.add(this.puzzleBeam.root);
    }
    if (typeof document !== 'undefined')
      this.puzzleHud = new PuzzleHud(
        definition.kind,
        withGrab,
        this.puzzleSkippable(),
      );
  }

  /** Pominięcie zagadki jest wyłączone w węzłach z celami misji (nie zablokuje pokoju). */
  private puzzleSkippable(): boolean {
    return !this.node.fixed?.objectives.length && !this.run.modeId;
  }

  /** Ponowna próba zagadki (śmierć, komenda reset). */
  private retryPuzzle(): void {
    if (!this.puzzle) return;
    this.prepareEncounter({
      invulnerable: this.god,
      passive: false,
      position: this.spawnPosition(),
    });
  }

  reset(): void {
    this.retryPuzzle();
  }

  private async buildLayout(): Promise<void> {
    const blocks = new Group();
    blocks.name = 'static-blocks';
    const models = new Group();
    models.name = 'static-models';
    (this.staticWorld ?? this.root).add(blocks, models);
    const ceilings = new Group();
    ceilings.name = 'room-ceilings';
    if (this.layout.blocks.some((b) => b.ceiling)) this.root.add(ceilings);
    const propCapacity: Partial<Record<PropKind, number>> = {};
    const instances = new Map<
      string,
      {
        size: Vec3;
        material: Parameters<typeof getMaterial>[0];
        model?: string;
        matrices: Matrix4[];
      }
    >();
    await Promise.all(
      this.layout.blocks.map(
        async ({
          size,
          position,
          model,
          material: blockMaterial,
          rotation,
          instance,
          visible,
          destructible,
          walkable,
          ceiling,
        }) => {
          if (
            this.props?.claim({
              size,
              position,
              ...(rotation ? { rotation } : {}),
              ...(model ? { model } : {}),
              ...(destructible !== undefined ? { destructible } : {}),
              ...(walkable !== undefined ? { walkable } : {}),
              ...(instance !== undefined ? { instance } : {}),
              ...(visible !== undefined ? { visible } : {}),
            })
          ) {
            const kind = model as PropKind;
            propCapacity[kind] = (propCapacity[kind] ?? 0) + 1;
            return;
          }
          const quaternion = new Quaternion().setFromEuler(
            new Euler(rotation?.x ?? 0, rotation?.y ?? 0, rotation?.z ?? 0),
          );
          this.world.createCollider(
            this.rapier.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
              .setTranslation(position.x, position.y, position.z)
              .setRotation(quaternion)
              .setCollisionGroups(
                interactionGroups(CollisionGroup.World, 0xffff),
              ),
          );
          if (visible === false) return;
          if (
            instance &&
            this.staticWorld &&
            !ceiling &&
            model !== 'wall_segment'
          ) {
            const cell = this.layout.arena!.batchCellM;
            const material = blockMaterial ?? 'world';
            const budget = this.ctx.tuning.arena.batchTriangleBudget;
            const cellKey = budget
              ? ''
              : `${Math.floor(position.x / cell)},${Math.floor(position.z / cell)}:`;
            const key = `${cellKey}${model ?? ''}:${material}:${size.x},${size.y},${size.z}`;
            const group = instances.get(key) ?? {
              size,
              material,
              model,
              matrices: [],
            };
            group.matrices.push(
              new Matrix4().compose(
                new Vector3(position.x, position.y, position.z),
                quaternion,
                new Vector3(1, 1, 1),
              ),
            );
            instances.set(key, group);
            return;
          }
          const geometry = new BoxGeometry(size.x, size.y, size.z);
          this.geometries.add(geometry);
          const material =
            blockMaterial ??
            (model?.startsWith('crate') ? 'interactive' : 'world');
          const fallback = new Mesh(geometry, getMaterial(material));
          fallback.position.set(position.x, position.y, position.z);
          fallback.quaternion.copy(quaternion);
          (ceiling ? ceilings : blocks).add(fallback);
          const file = isCityModelFile(model)
            ? model
            : model
              ? MODEL_FILES[model]
              : undefined;
          if (!file || !this.loadModels) return;
          try {
            const scene = isCityModelFile(file)
              ? await cloneCityModel(file)
              : await cloneRoomModel(file);
            if (!scene || this.disposed) return;
            if (blockMaterial && !isCityModelFile(file))
              scene.traverse((node) => {
                if (node instanceof Mesh)
                  node.material = getMaterial(blockMaterial);
              });
            placeBlockModel(scene, file, size, position);
            // Obrót modelu wokół środka tej samej bryły co collider.
            scene.position
              .sub(new Vector3(position.x, position.y, position.z))
              .applyQuaternion(quaternion)
              .add(new Vector3(position.x, position.y, position.z));
            scene.quaternion.premultiply(quaternion);
            fallback.removeFromParent();
            (ceiling ? ceilings : models).add(scene);
          } catch {
            // Bryła zastępcza zostaje (ten sam collider).
          }
        },
      ),
    );
    if (this.props && this.props.aliveCount > 0) {
      const templates: Partial<
        Record<PropKind, ReturnType<typeof propTemplatesFromModel>>
      > = {};
      if (this.loadModels)
        for (const kind of Object.keys(propCapacity) as PropKind[]) {
          try {
            const model = await cloneRoomModel(MODEL_FILES[kind]!);
            if (model) templates[kind] = propTemplatesFromModel(model);
          } catch {
            // Zostaje bryła zastępcza (ten sam collider).
          }
        }
      if (this.disposed) return;
      this.propView = new PropRenderer(this.props, propCapacity, templates);
      this.root.add(this.propView.root);
    }
    const modelInstances = new Map<
      string,
      { source: Mesh; matrices: Matrix4[]; name: string }
    >();
    const budget = this.staticWorld
      ? this.ctx.tuning.arena.batchTriangleBudget
      : 0;
    const cellM = this.layout.arena?.batchCellM ?? 0;
    // Dla budżetu trójkątów klucze nie zawierają komórki: dzieli dopiero partitionInstances.
    const partitionInstances = (
      matrices: Matrix4[],
      triangles: number,
    ): Matrix4[][] =>
      budget && cellM
        ? partitionByTriangles(
            matrices.map((matrix) => ({
              matrix,
              x: matrix.elements[12]!,
              z: matrix.elements[14]!,
              triangles,
            })),
            budget,
            cellM,
          ).map((leaf) => leaf.map((item) => item.matrix))
        : [matrices];
    const triangleCount = (geometry: BufferGeometry): number =>
      (geometry.index?.count ?? geometry.attributes.position!.count) / 3;
    const instancingTemplates = new Map<
      string,
      Awaited<ReturnType<typeof cloneCityModel>>
    >();
    for (const { size, material, model, matrices } of instances.values()) {
      const templateKey = JSON.stringify([model, size]);
      if (!instancingTemplates.has(templateKey)) {
        const prepared =
          model && this.loadModels ? await cloneCityModel(model) : null;
        if (this.disposed) return;
        if (prepared && this.layout.arena?.spawnRing)
          batchInstancedTemplate(prepared, this.geometries);
        instancingTemplates.set(templateKey, prepared);
      }
      const template = instancingTemplates.get(templateKey);
      if (this.disposed) return;
      if (template) {
        placeBlockModel(template, model!, size, { x: 0, y: 0, z: 0 });
        template.updateMatrixWorld(true);
        template.traverse((node) => {
          if (!(node instanceof Mesh)) return;
          // Warianty farby mają identyczną geometrię okuć i nadruków kontenera.
          const shape = model!.replace(
            /^(port_container_(?:20|40))_(?:navy|olive|ochre|graphite)$/,
            '$1',
          );
          const materials = Array.isArray(node.material)
            ? node.material
            : [node.material];
          const cellKey = budget
            ? ''
            : `${Math.floor(matrices[0]!.elements[12]! / cellM)},${Math.floor(matrices[0]!.elements[14]! / cellM)}:`;
          const key = `${cellKey}${shape}:${node.name}:${materials.map((m) => m.uuid).join(',')}`;
          const group: { source: Mesh; matrices: Matrix4[]; name: string } =
            modelInstances.get(key) ?? {
              source: node,
              matrices: [],
              name: `instances:${shape}:${node.name}`,
            };
          for (const matrix of matrices)
            group.matrices.push(
              new Matrix4().multiplyMatrices(matrix, node.matrixWorld),
            );
          modelInstances.set(key, group);
        });
        continue;
      }
      const geometry = new BoxGeometry(size.x, size.y, size.z);
      this.geometries.add(geometry);
      for (const part of partitionInstances(matrices, 12)) {
        const mesh = new InstancedMesh(
          geometry,
          getMaterial(material),
          part.length,
        );
        this.staticInstances.push(mesh);
        part.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        blocks.add(mesh);
      }
    }
    // Rzadkie, tanie modele: osobne siatki scalają się ze statyką (jedno wywołanie na materiał zamiast
    // na model × materiał); instancje zostają tam, gdzie kopii jest dużo (kontenery).
    const mergeLimit = budget
      ? this.ctx.tuning.arena.instanceMergeTriangles
      : 0;
    for (const { source, matrices: all, name } of modelInstances.values()) {
      const triangles = triangleCount(source.geometry);
      const parts =
        all.length * triangles <= mergeLimit
          ? all.map((matrix) => [matrix])
          : partitionInstances(all, triangles);
      for (const matrices of parts) {
        // Pojedyncza sztuka nie zyskuje na instancingu; może scalić się z inną statyką.
        if (matrices.length === 1) {
          const mesh = new Mesh(source.geometry, source.material);
          mesh.name = name;
          mesh.userData = { ...source.userData };
          mesh.matrixAutoUpdate = false;
          mesh.matrix.copy(matrices[0]!);
          models.add(mesh);
          continue;
        }
        const mesh = new InstancedMesh(
          source.geometry,
          source.material,
          matrices.length,
        );
        mesh.name = name;
        mesh.userData = { ...source.userData };
        this.staticInstances.push(mesh);
        matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        models.add(mesh);
      }
    }
    if (ceilings.children.length)
      batchStaticGeometry(ceilings, this.geometries, {
        cellSize: this.layout.arena?.batchCellM ?? this.options.staticCellSize,
      });
    if (!this.staticWorld) {
      batchStaticGeometry(blocks, this.geometries, {
        cellSize: this.options.staticCellSize,
      });
      batchStaticGeometry(models, this.geometries, {
        cellSize: this.options.staticCellSize,
      });
    }
    if (this.disposed) return;
    for (const door of this.layout.doors) {
      const { size, position } = door;
      const geometry = new BoxGeometry(size.x, size.y, size.z);
      this.geometries.add(geometry);
      const mesh = new Mesh(geometry, getMaterial('paint'));
      mesh.name = `door:${door.id}`;
      mesh.position.copy(position);
      this.root.add(mesh);
      const collider = this.world.createCollider(
        this.rapier.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
          .setTranslation(position.x, position.y, position.z)
          .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
      );
      this.doors.set(door.id, { role: door.role, mesh, collider });
    }
  }

  /** Wywracalne dekoracje (pachołki, worki): najbliższe startu gracza, bez trybu low i fx=lite. */
  private pickScatterDecor(): DecorDef[] {
    if (!this.loadModels || getLiteFx() || loadSettings().quality === 'low')
      return [];
    const spawn = this.layout.playerSpawn;
    return (this.layout.decor ?? [])
      .filter((def) => isScatterModel(def.model))
      .sort(
        (a, b) =>
          Math.hypot(a.position.x - spawn.x, a.position.z - spawn.z) -
          Math.hypot(b.position.x - spawn.x, b.position.z - spawn.z),
      )
      .slice(0, this.ctx.tuning.props.scatterMaxItems);
  }

  private async buildScatter(defs: readonly DecorDef[]): Promise<void> {
    if (defs.length === 0) return;
    const system = new ScatterProps({
      world: this.world,
      bus: this.ctx.bus,
      tuning: this.ctx.tuning,
      playerId: this.player.id,
    });
    this.scatter = system;
    const objects: Object3D[] = [];
    for (const def of defs) {
      const model = await cloneCityModel(def.model);
      if (this.disposed) return;
      if (!model || !isScatterModel(def.model)) continue;
      model.position.copy(def.position);
      model.rotation.y = def.yaw ?? 0;
      model.scale.setScalar(def.scale ?? 1);
      system.add({
        model: def.model,
        position: def.position,
        yaw: def.yaw ?? 0,
      });
      objects.push(model);
    }
    this.scatterView = new ScatterRenderer(system, objects);
    this.root.add(this.scatterView.root);
  }

  private applyImplants(): void {
    this.implantSystem = new ImplantSystem(
      [this.playerStats, this.player.stats],
      {
        health: this.health,
        bus: this.ctx.bus,
        definitions: this.implantDefs,
        onChange: () => {
          if (!this.synergies) return;
          this.refreshSynergyInputs();
          this.ctx.bus.emit('health_changed', {
            id: this.player.id,
            current: this.health.current,
            max: this.health.max,
          });
        },
      },
    );
    this.implantSystem.set(this.initialImplantIds, { adjustHealth: false });
  }

  /** Talenty (ADR 0007 pkt 4): modyfikatory na obu instancjach `Stats`, tagi i wyzwalacze w synergiach. */
  private applyTalents(): void {
    this.talentSystem = new TalentSystem({
      stats: [this.playerStats, this.player.stats],
      health: this.health,
      onChange: () => {
        if (!this.synergies) return;
        this.refreshSynergyInputs();
        this.ctx.bus.emit('health_changed', {
          id: this.player.id,
          current: this.health.current,
          max: this.health.max,
        });
      },
    });
    this.talentSystem.set(this.initialTalentIds, { adjustHealth: false });
  }

  /** Tagi ekwipunku, implantów i talentów oraz wyzwalacze implantów i talentów do `SynergySystem`. */
  private refreshSynergyInputs(): void {
    this.synergies.setTags([
      ...this.loadout.tags,
      ...this.implantSystem.tags(),
      ...this.talentSystem.tags(),
    ]);
    this.synergies.setImplantTriggers([
      ...this.implantSystem.triggers(),
      ...this.talentSystem.triggers().map(({ talentId, trigger }) => ({
        implantId: `talent:${talentId}`,
        trigger,
      })),
    ]);
  }

  private spawnPosition(): Vec3 {
    const t = this.ctx.tuning.player;
    // Tryby na dużej arenie mają własny start (układ w `arena.assault` / `arena.heist`).
    const start =
      (this.run.modeId === 'assault'
        ? assaultForArena(assaultMode, this.layout).sectors[0]?.playerSpawn
        : this.run.modeId === 'heist'
          ? this.layout.arena?.heist?.playerSpawn
          : undefined) ?? this.layout.playerSpawn;
    return {
      x: start.x,
      y: start.y + t.capsuleHeight / 2 + t.controllerOffset,
      z: start.z,
    };
  }

  private registerPlayer(): void {
    this.damage.register(this.player.id, this.health, {
      outgoing: () => this.playerStats.get('damage'),
      stats: this.playerStats,
      invulnMs: () => this.ctx.tuning.damage.playerInvulnMs,
      invulnerable: () =>
        this.player.isInvulnerable() || (this.execute?.invulnerable() ?? false),
    });
  }

  private createExecute(): void {
    this.execute?.dispose();
    this.executeTarget = null;
    const pool: ExecuteEnemy[] = [];
    const enemies: ExecuteEnemy[] = [];
    const collectEnemy = (enemy: Enemy): void => {
      if (enemy.removed) return;
      const index = enemies.length;
      const entry = (pool[index] ??= {
        id: enemy.id,
        kind: enemy.definition.kind,
        position: { x: 0, y: 0, z: 0 },
      });
      entry.id = enemy.id;
      entry.kind = enemy.definition.kind;
      const position = enemy.current.position;
      entry.position.x = position.x;
      entry.position.y = position.y + (enemy.definition.body?.centerY ?? 0);
      entry.position.z = position.z;
      enemies.push(entry);
    };
    this.execute = new ExecuteSystem({
      bus: this.ctx.bus,
      damage: this.damage,
      tuning: this.ctx.tuning,
      owner: this.player.id,
      statuses: this.statuses,
      enemies: () => {
        enemies.length = 0;
        this.manager.forEach(collectEnemy);
        return enemies;
      },
      aim: () => this.aim(),
      castWall: (origin, dir, max) => this.castWall(origin, dir, max),
      addEnergy: (amount) => this.energy.add(amount),
      heal: (amount) => {
        this.health.heal(amount);
        this.emitHealth();
      },
    });
  }

  private readonly selectWavePoint: NonNullable<
    WaveDirectorDeps['selectSpawn']
  > = (points, minM, rng) => {
    const player = this.player.getState();
    const feet = {
      ...player.position,
      y: player.position.y - player.height / 2,
    };
    const { origin, dir } = this.aim();
    const camera = this.ctx.camera;
    const vertical = Math.tan(
      ((camera?.fov ?? this.ctx.tuning.camera.fov) * Math.PI) / 360,
    );
    const horizontal = vertical * (camera?.aspect ?? 1);
    const sightHeight = this.ctx.tuning.arena.waveSpawnSightHeightM;
    const occluded = spawnOcclusion(origin, sightHeight, (o, d, length) =>
      this.castWall(o, d, length),
    );
    const sinYaw = Math.sin(player.yaw),
      cosYaw = Math.cos(player.yaw);
    return selectWaveSpawn(
      points.map((p) => ({ ...p, y: p.y ?? this.layout.playerSpawn.y })),
      feet,
      minM,
      this.ctx.tuning.arena.waveSpawnMaxDistanceM,
      this.navigation!,
      (p) => {
        const dx = p.x - origin.x,
          dy = p.y + sightHeight - origin.y,
          dz = p.z - origin.z;
        const depth = dx * dir.x + dy * dir.y + dz * dir.z;
        const right = dx * cosYaw - dz * sinYaw;
        const up =
          dy * Math.cos(player.pitch) +
          (dx * sinYaw + dz * cosYaw) * Math.sin(player.pitch);
        return (
          depth <= 0 ||
          Math.abs(right) > depth * horizontal ||
          Math.abs(up) > depth * vertical ||
          occluded(p)
        );
      },
      rng,
    );
  };

  protected enemyTarget(
    enemy: { id: EntityId | null; position: Vec3 },
    player: ReturnType<EnemyDependencies['getTarget']>,
  ): ReturnType<EnemyDependencies['getTarget']> {
    return this.squad?.size ? this.squad.targetFor(enemy, player) : player;
  }

  protected spawnEnemy(
    kind: string,
    position: Vec3,
    stealth?: StealthSpawn,
  ): EntityId | null {
    if (
      this.aliveEnemies() >=
      Math.min(this.waves.maxAlive, this.layout.maxAlive ?? this.waves.maxAlive)
    )
      return null;
    if (this.world.bodies.len() >= this.ctx.tuning.physics.maxDynamicBodies)
      return null;
    return this.manager.spawn(kind, position, stealth).id;
  }

  private spawnBoss(enemyId: string): void {
    const marker = this.layout.props?.find((p) => p.kind === 'bossSpawn');
    const enemy = this.manager.spawn(enemyId, {
      x: marker?.position.x ?? 0,
      y: marker?.position.y ?? 0,
      z: marker?.position.z ?? 0,
    });
    if (!(enemy instanceof Boss))
      throw new Error(`Wróg ${enemyId} nie jest bossem.`);
    this.boss = enemy;
  }

  private enemy(id: EntityId): Enemy | undefined {
    let found: Enemy | undefined;
    this.manager.forEach((e) => {
      if (e.id === id) found = e;
    });
    return found;
  }

  private enemyIds(): EntityId[] {
    const ids: EntityId[] = [];
    this.manager.forEach((e) => {
      if (!e.removed && e.current.state !== 'dead') ids.push(e.id);
    });
    return ids;
  }

  private enemyPosition(id: EntityId): Vec3 | null {
    let position: Vec3 | null = null;
    this.manager.forEach((e) => {
      if (e.id === id && !e.removed) position = e.current.position;
    });
    return position;
  }

  protected aliveEnemies(): number {
    let n = 0;
    this.manager.forEach((e) => {
      if (e.current.state !== 'dead') n++;
    });
    return n;
  }

  // ----------------------------------------------------------------- walka

  private get weapon(): Weapon {
    return this.weapons[this.weaponSlot]!;
  }

  private createEquipment(): void {
    this.powers?.reset();
    this.powers = new PowerSlots(
      this.resolved.powers.map((definition) =>
        createPowerFromDefinition(definition, {
          owner: this.player.id,
          bus: this.ctx.bus,
          tuning: this.ctx.tuning,
          damage: this.damage,
          statuses: this.statuses,
          energy: this.energy,
          projectiles: this.projectiles,
          aim: () => this.aim(),
          targets: () => {
            const list: { id: EntityId; position: Vec3; physical: true }[] = [];
            this.manager.forEach((e) => {
              if (e.current.state !== 'dead')
                list.push({
                  id: e.id,
                  physical: true,
                  position: {
                    ...e.current.position,
                    // Środek ciała z danych wroga (Dron bez `body` to już środek kuli).
                    y: e.current.position.y + (e.definition.body?.centerY ?? 0),
                  },
                });
            });
            return list;
          },
          castWall: (origin, dir, max) => this.castWall(origin, dir, max),
          grab: this.puzzleGrab,
        }),
      ),
    );
    this.weaponSlot = 0;
    this.weapons = this.resolved.weapons.map(
      (definition) =>
        new Weapon(
          this.player.id,
          this.ctx,
          this.playerStats,
          {
            projectiles: this.projectiles,
            attackSpeed: () => this.playerStats.get('attackSpeed'),
            damage: this.damage,
            castBeam: (origin, dir, rangeM) =>
              this.castBeam(origin, dir, rangeM),
          },
          definition,
        ),
    );
  }

  private selectWeapon(slot: number): void {
    if (!this.weapons[slot] || slot === this.weaponSlot) return;
    this.weapon.cool(0);
    this.weaponSlot = slot;
    this.emitWeapon();
  }

  private emitWeapon(): void {
    this.ctx.bus.emit('weapon_switched', {
      owner: this.player.id,
      weapon: this.weapon.definition.id,
      slot: this.weaponSlot,
    });
    this.ctx.bus.emit('heat_changed', {
      id: this.player.id,
      current: this.weapon.heat.current,
      max: this.weapon.heat.max,
      overheated: this.weapon.overheated,
    });
  }

  private castBeam(origin: Vec3, dir: Vec3, rangeM: number) {
    const hit = this.world.castRayAndGetNormal(
      new this.rapier.Ray(origin, dir),
      rangeM,
      true,
      undefined,
      interactionGroups(
        CollisionGroup.PlayerProjectile,
        CollisionGroup.Enemy | CollisionGroup.World,
      ),
      undefined,
      undefined,
      (collider) => {
        const box = this.hurtboxes.get(collider.handle);
        return box
          ? box.entity !== this.player.id
          : ((collider.collisionGroups() >>> 16) & CollisionGroup.World) !== 0;
      },
    );
    const distance = hit?.timeOfImpact ?? rangeM;
    const box = hit ? this.hurtboxes.get(hit.collider.handle) : undefined;
    return {
      target: box?.entity ?? null,
      ...(box?.headshot ? { headshot: true } : {}),
      distance,
      point: {
        x: origin.x + dir.x * distance,
        y: origin.y + dir.y * distance,
        z: origin.z + dir.z * distance,
      },
    };
  }

  private aim(): { origin: Vec3; dir: Vec3 } {
    const s = this.player.getState();
    const t = this.ctx.tuning.player;
    const cosP = Math.cos(s.pitch);
    return {
      origin: {
        x: s.position.x,
        y: s.position.y + s.height / 2 - (t.capsuleHeight - t.eyeHeight),
        z: s.position.z,
      },
      dir: {
        x: -Math.sin(s.yaw) * cosP,
        y: Math.sin(s.pitch),
        z: -Math.cos(s.yaw) * cosP,
      },
    };
  }

  private queryArc(reach: number, width: number, shape: HitShape = 'arc') {
    const { origin, dir } = this.aim();
    if (shape === 'spin')
      return queryBladeSpin(this.world, this.hurtboxes, origin, reach);
    const s = this.player.getState();
    this.tmpEuler.set(s.pitch, s.yaw, 0, 'YXZ');
    this.tmpQuat.setFromEuler(this.tmpEuler);
    return queryBladeArc(
      this.world,
      this.hurtboxes,
      {
        x: origin.x + dir.x * reach * 0.5,
        y: origin.y + dir.y * reach * 0.5,
        z: origin.z + dir.z * reach * 0.5,
      },
      {
        x: this.tmpQuat.x,
        y: this.tmpQuat.y,
        z: this.tmpQuat.z,
        w: this.tmpQuat.w,
      },
      reach,
      width,
    );
  }

  private castDebrisWall(
    origin: Vec3,
    dir: Vec3,
    max: number,
  ): { distance: number; normal: Vec3 } | null {
    const hit = this.world.castRayAndGetNormal(
      new this.rapier.Ray(origin, dir),
      max,
      false,
      undefined,
      interactionGroups(CollisionGroup.Enemy, CollisionGroup.World),
    );
    return hit
      ? {
          distance: hit.timeOfImpact,
          normal: { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z },
        }
      : null;
  }

  private castWall(
    origin: Vec3,
    dir: Vec3,
    max: number,
    ignoreCollider?: number,
  ): number | null {
    const hit = this.world.castRay(
      new this.rapier.Ray(origin, dir),
      max,
      true,
      undefined,
      interactionGroups(CollisionGroup.Enemy, CollisionGroup.World),
      undefined,
      undefined,
      ignoreCollider === undefined
        ? undefined
        : (collider) => collider.handle !== ignoreCollider,
    );
    return hit ? hit.timeOfImpact : null;
  }

  // ----------------------------------------------------------------- pętla

  step(dt: number, input: InputSnapshot): void {
    this.dressing?.step(dt);
    this.previous = this.player.getState();
    if (this.state === 'dead') {
      const arena = this.assault ?? this.heist;
      if (arena) {
        if (arena.stepRespawn(dt)) this.respawnAssault();
        return;
      }
      this.manager.step(dt);
      return;
    }
    if (this.puzzle || (this.props?.bodyCount ?? 0) > 0)
      this.player.enableDynamicPush(this.ctx.tuning.puzzle.pushMassKg);
    if (
      input.pressed.has('map') &&
      this.puzzleSkippable() &&
      this.puzzle?.finish('skipped')
    ) {
      this.cleared = true;
      this.openExit();
      this.ctx.bus.emit('puzzle_skipped', { nodeId: this.node.id });
      return;
    }
    if (dt > 0 && !this.cleared) this.elapsedS += dt;
    // F2-06: gracz, ostrze, moce, broń i energia w czasie gracza (Skupienie), reszta w czasie świata.
    const pdt = this.ctx.feel?.playerDt(dt) ?? dt;
    this.hud?.step(pdt);
    if (input.pressed.has('inspect')) this.fppView.inspect();
    for (const [slot, action] of (
      ['weapon1', 'weapon2', 'weapon3'] as const
    ).entries())
      if (input.pressed.has(action) && this.weapons[slot]) {
        this.selectWeapon(slot);
        this.heldItem.requestGun();
      }
    // Przedmiot w ręce przed graczem: PPM z bronią to celowanie, które zmienia ruch i czułość.
    const bladeState = this.blade.view().state;
    const { bladeInput, triggerHeld } = this.heldItem.step(pdt, input, {
      aimInScale: this.weapon.definition.aimInScale,
      bladeBusy: bladeState !== 'idle' && bladeState !== 'throwing',
      canAim:
        this.state === 'playing' &&
        !this.weapon.overheated &&
        this.player.getState().dashS <= 0,
    });
    this.player.setAim(
      this.heldItem.aim,
      this.weapon.definition.aimSensitivityScale,
    );
    this.syncHeistCarry();
    this.player.step(pdt, input);
    this.blade.step(pdt, bladeInput);
    // Powalony sojusznik w zasięgu: klawisz interakcji (Moc 2) podnosi go zamiast rzucać moc.
    const reviving = this.squad.reviveCandidate() !== null;
    this.powers.step(
      pdt,
      reviving ? withoutAction(input, 'power2') : input,
      this.puzzle ? dt : undefined,
    );
    if (input.pressed.has('squadCommand') && this.squad.size > 0)
      this.squad.toggleOrder();
    if (!(dt > 0)) {
      this.manager.step(dt);
      return;
    }
    this.energy.step(pdt);
    this.synergies.step(pdt);
    this.damage.step(dt);
    this.hazards.step(dt);
    if (!this.health.dead && !this.cleared) {
      const arena = this.conquest ?? this.assault ?? this.heist;
      if (arena) {
        const player = this.player.getState().position;
        const positions: Vec3[] = [];
        const heistEnemies: HeistEnemy[] = [];
        this.manager.forEach((enemy) => {
          if (!enemy.removed && enemy.current.state !== 'dead') {
            positions.push(enemy.current.position);
            heistEnemies.push({
              id: enemy.id,
              position: enemy.current.position,
            });
            if (!this.heist) {
              enemy.moveGoal = (this.conquest ?? this.assault)!.moveGoal(
                enemy.current.position,
                player,
              );
              enemy.moveGoalFinal = true;
            }
          }
        });
        this.conquest?.step(dt, player, positions);
        this.assault?.step(dt, player);
        this.heist?.step(dt, player, heistEnemies);
        if (this.heist) {
          this.manager.forEach((enemy) => {
            enemy.moveGoal = this.heist!.moveGoal(enemy.id, player);
            enemy.moveGoalFinal = true;
            enemy.setCarry?.(
              this.heist!.carrierId === enemy.id
                ? {
                    speedMultiplier: this.heist!.definition.enemyCarrySpeed,
                    defendRangeM: this.heist!.definition.enemyDefendRangeM,
                  }
                : null,
            );
          });
          this.syncHeistCarry();
        }
        const spawn = arena.spawnPosition(
          this.layout,
          player,
          positions,
          this.ctx.rng,
          this.layout.arena?.spawnRing
            ? spawnOcclusion(
                this.aim().origin,
                this.ctx.tuning.modes[
                  this.conquest
                    ? 'conquest'
                    : this.assault
                      ? 'assault'
                      : 'heist'
                ].spawnSightHeightM,
                (origin, direction, length) =>
                  this.castWall(origin, direction, length),
              )
            : undefined,
        );
        if (
          spawn &&
          this.spawnEnemy(
            this.ctx.rng.pick(arena.definition.enemies),
            spawn,
          ) !== null
        )
          arena.spawned();
        if (arena.outcome === 'victory') this.completeRoom();
      } else if (
        this.navigation &&
        !this.manualEncounter &&
        !this.passiveEncounter
      ) {
        const player = this.player.getState();
        const feet = {
          ...player.position,
          y: player.position.y - player.height / 2,
        };
        this.manager.forEach((enemy) => {
          const target =
            this.squad.size &&
            this.squad.targetFor(
              { id: enemy.id, position: enemy.current.position },
              { id: this.playerId, position: player.position, yaw: player.yaw },
            );
          enemy.routeToPlayer = true;
          enemy.moveGoal =
            target && target.id !== this.playerId ? target.position : feet;
          enemy.moveGoalFinal = true;
        });
      }
      this.mission?.step(dt, this.player.getState().position);
      this.openMissionDock();

      if (this.node.fixed?.objectives.length && this.mission?.complete)
        this.completeRoom();
    }
    if (!this.health.dead && !this.victoryHold)
      for (const director of this.reinforcements) director.step(dt);
    this.missionHud?.step();
    this.statuses.step(dt);
    this.execute.step(dt);
    this.projectileView.capturePrevious();
    this.debris.step(dt);
    this.shatter.step(dt);
    for (const weapon of this.weapons) {
      if (weapon === this.weapon && this.heldItem.held === 'gun')
        weapon.step(pdt, {
          ...this.aim(),
          triggerHeld: triggerHeld && !this.health.dead,
          coolingPressed:
            input.pressed.has('coolWeapon') &&
            !this.health.dead &&
            !this.heldItem.view().swapping,
          aim: this.heldItem.aim,
        });
      else weapon.cool(pdt);
    }
    this.director.step(dt);
    this.squad.step(dt, reviving && input.held.has('power2'));
    const modeHasRoutes = this.conquest
      ? this.layout.arena?.exclusive || this.layout.arena?.spawnRing
      : this.assault
        ? this.layout.arena?.assault
        : this.heist
          ? this.layout.arena?.heist
          : true;
    this.manager.step(
      dt,
      !this.health.dead && !this.cleared && modeHasRoutes
        ? this.navigation
        : undefined,
    );
    this.world.gravity.y = this.ctx.tuning.physics.gravity;
    this.world.timestep = dt;
    this.world.step();
    this.props?.step(dt);
    if (this.scatter) {
      const p = this.player.getState();
      this.scatter.step(dt, {
        position: p.position,
        velocity: p.velocity,
        sliding: p.sliding,
        sprinting: p.sprinting,
        dashS: p.dashS,
      });
    }
    if (this.puzzle?.step(dt)) this.completeRoom();
    this.projectiles.step(dt);
    this.executeTarget = this.execute.targetId();
  }

  render(
    alpha: number,
    frameDt = 1 / 60,
    cameraOverride?: { position: Vector3; rotation: Euler },
  ): void {
    const executable = this.execute.readyIds();
    this.hud?.setCoolingHint(
      this.state === 'playing' &&
        this.heldItem.held === 'gun' &&
        !this.heldItem.view().swapping
        ? this.weapon.coolingPhase
        : undefined,
    );
    this.hud?.setExecuteHint(
      this.state === 'playing' &&
        this.heldItem.held === 'blade' &&
        this.blade.view().state !== 'throwing' &&
        this.executeTarget !== null,
    );
    this.hazardView.advance(frameDt);
    this.hazardView.update(this.hazards.state(), alpha);
    this.propView?.render(alpha);
    this.scatterView?.render(alpha);
    if (this.puzzle) {
      const state = this.puzzle.view();
      this.puzzleView?.render(state, alpha);
      this.puzzleHud?.update(state.outcome);
    }
    this.missionView?.update();
    this.conquestView?.update();
    this.assaultView?.update();
    this.heistView?.update(
      this.player.getState().position,
      this.player.getState().yaw,
    );
    const ids = this.seenEnemyIds;
    ids.clear();
    this.manager.forEach((enemy) => {
      ids.add(enemy.id);
      let view = this.views.get(enemy.id);
      if (!view) {
        view = createEnemyView(enemy, this.loadModels, this.ctx.bus);
        this.views.set(enemy.id, view);
        this.root.add(view.root);
      }
      view.render(alpha, frameDt);
      view.setExecutable?.(
        executable.includes(enemy.id),
        frameDt,
        this.ctx.tuning.melee.executeMarkerPulseHz,
      );
    });
    for (const [id, view] of this.views)
      if (!ids.has(id)) {
        view.dispose();
        this.views.delete(id);
      }
    this.renderAllies(alpha, frameDt);
    this.projectileView.render(alpha);
    this.debrisView.render(alpha);
    this.explosionView.render(frameDt);
    this.statusView.render(alpha, frameDt);
    this.hitSparksView.render(frameDt);
    this.bossFx?.render(alpha, frameDt);
    this.lights.sync();
    this.bossFx?.applyLights(this.lights);
    this.atmosphere?.sync(frameDt);
    this.flyingBlade.render(this.blade.view(), alpha, this.ctx.tuning);
    this.flyingBlade.root.visible &&= this.state === 'playing';
    this.barrierView.advance(frameDt);
    this.lightningView.advance(frameDt);
    const camera = this.ctx.camera;
    const powers = this.powerPair;
    powers[0] = this.powers.get(0);
    powers[1] = this.powers.get(1);
    const grab = this.puzzleBeam
      ? powers.find((power) => power instanceof GrabPower)
      : undefined;
    this.puzzleBeam?.advance(frameDt);
    if (!camera) {
      this.dressing?.render(frameDt, undefined);
      this.beamView.advance(frameDt);
      this.beamView.render(this.weapon.beam);
      this.lightningView.render(powers);
      this.puzzleBeam?.render(grab?.beam ?? null, alpha);
      return;
    }
    const playerState = this.player.getState();
    this.legs?.update(
      this.previous,
      playerState,
      alpha,
      frameDt,
      !cameraOverride && this.state === 'playing',
    );
    const pose = this.fpsCamera.update(
      frameDt,
      this.previous,
      playerState,
      alpha,
      this.heldItem.aim,
      this.weapon.definition.aimFovScale,
    );
    this.hud?.setAim(this.heldItem.aim);
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    let barrier: BarrierPower | undefined;
    for (const power of powers) {
      if (!(power instanceof BarrierPower)) continue;
      if (power.active) {
        barrier = power;
        break;
      }
      barrier ??= power;
    }
    if (barrier && this.state === 'playing')
      this.barrierView.render(barrier, pose);
    else this.barrierView.root.visible = false;
    camera.rotation.set(pose.pitch, pose.yaw, pose.roll, 'YXZ');
    if (cameraOverride) {
      camera.position.copy(cameraOverride.position);
      camera.rotation.copy(cameraOverride.rotation);
    }
    this.hud?.setViewYaw(pose.yaw);
    if (Math.abs(camera.fov - pose.fov) > 1e-3) {
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    this.dressing?.render(frameDt, camera);
    const velocity = playerState.velocity;
    this.fppView.place(camera.matrixWorld, frameDt, {
      blade: this.blade.view(),
      held: this.heldView(),
      horizontalSpeed: Math.hypot(velocity.x, velocity.z),
      visible: !cameraOverride && this.state === 'playing',
      aim: this.heldItem.aim,
    });
    this.beamView.advance(frameDt);
    this.beamView.render(this.weapon.beam, this.fppView.beamOriginFor(camera));
    this.lightningView.render(powers, camera);
    this.puzzleBeam?.render(grab?.beam ?? null, alpha, camera);
  }

  // ----------------------------------------------------------------- śmierć i reset

  enterVictoryHold(): void {
    if (this.victoryHold || this.disposed) return;
    this.victoryHold = true;
    this.director.stop();
    for (const director of this.reinforcements) director.stop();
    this.projectiles.dispose();
    this.statuses.reset();
    // Gracz jest nietykalny, zanim cokolwiek zacznie się rozpadać.
    this.playerStats.add({
      stat: 'damageTaken',
      type: 'mult',
      value: 0,
      source: 'victory-hold',
    });
    this.dissolveRemainingEnemies();
  }

  private dissolveRemainingEnemies(): void {
    // Świat (source null) uruchamia normalny rozpad bez zabójstw i kredytów gracza.
    // W misji ten sam efekt działa przed ewakuacją, bez kończenia runu.
    const remaining: EntityId[] = [];
    this.manager.forEach((enemy) => {
      if (!enemy.removed && enemy.current.state !== 'dead')
        remaining.push(enemy.id);
    });
    for (const id of remaining)
      this.damage.deal(id, {
        source: null,
        amount: Number.MAX_VALUE,
        tags: [VICTORY_HOLD_TAG],
      });
  }

  private onPlayerDied(): void {
    if (this.state === 'dead') return;
    this.assault?.died();
    this.heist?.died(this.player.getState().position);
    this.syncHeistCarry();
    this.state = 'dead';
    this.heldItem.cancelAim();
    this.player.setAim(0);
    // Aktywne moce (Skupienie, Bariera) kończą się ze śmiercią, nie dopiero przy „Jeszcze raz”.
    this.powers.reset();
    this.weapon.cool(0);
    this.director.stop();
    if (this.assault || this.heist) this.hud?.setLoadout(this.loadout);
    if (
      !this.assault &&
      !this.heist &&
      !this.options.linearMission &&
      typeof document !== 'undefined'
    )
      document.exitPointerLock?.();
  }

  private respawnAssault(): void {
    const arena = this.assault ?? this.heist;
    if (!arena || arena.outcome) return;
    this.statuses.reset();
    this.projectiles.dispose();
    this.powers.reset();
    this.blade.reset();
    for (const weapon of this.weapons) weapon.reset();
    this.selectWeapon(0);
    this.health.reset();
    this.registerPlayer();
    this.hud?.setLoadout(this.loadout);
    this.energy.set(this.energy.max);
    this.player.stamina.set(this.player.stamina.max);
    const spawn = this.heist
      ? (this.heist.definition.playerSpawn ?? this.heist.definition.extraction)
      : this.assault!.sector.playerSpawn;
    this.player.teleport({
      ...spawn,
      y:
        spawn.y +
        this.ctx.tuning.player.capsuleHeight / 2 +
        this.ctx.tuning.player.controllerOffset,
    });
    this.lookAtDegrees(0, 0);
    this.previous = this.player.getState();
    this.heldItem.reset(this.loadout.startHeld);
    this.state = 'playing';
    this.emitHealth();
  }

  missionState(): Pick<RunState, 'objectives' | 'objectiveProgress'> {
    return this.mission
      ? {
          objectives: { ...this.mission.objectives },
          objectiveProgress: { ...this.mission.progress },
        }
      : {};
  }

  /** Transfer otwiera dok; zwycięstwo nadal wymaga osobnego celu exit. */
  private openMissionDock(): void {
    const model = this.mission;
    if (!model) return;
    const dockReady = model.mission.objectives.some(
      (objective) =>
        objective.kind === 'exit' &&
        model.ids.includes(objective.id) &&
        model.unlocked(objective) &&
        objective.unlockAfter.some((id) =>
          model.mission.objectives.some(
            (dependency) =>
              dependency.id === id && dependency.kind === 'defend',
          ),
        ),
    );
    if (!dockReady) return;
    for (const door of this.doors.values()) {
      if (door.role !== 'exit') continue;
      door.collider.setEnabled(false);
      door.mesh.visible = false;
    }
  }

  private explodeMission(
    objective: Extract<MissionObjective, { kind: 'sabotage' }>,
    playerId: EntityId,
  ): void {
    const point = { ...objective.position, y: objective.position.y + 0.5 };
    const tags = ['#hazard', '#explosion', '#friendly_fire'];
    const targets = [
      { id: playerId, position: this.player.getState().position },
    ];
    this.manager.forEach((enemy) => {
      if (!enemy.removed && enemy.current.state !== 'dead')
        targets.push({ id: enemy.id, position: { ...enemy.current.position } });
    });
    this.ctx.bus.emit('explosion', {
      point,
      radiusM: objective.blastRadiusM,
      owner: playerId,
      tags,
    });
    for (const target of targets) {
      if (
        Math.hypot(
          target.position.x - point.x,
          target.position.y - point.y,
          target.position.z - point.z,
        ) <= objective.blastRadiusM
      )
        this.damage.deal(target.id, {
          source: null,
          amount: objective.blastDamage,
          point: target.position,
          tags,
        });
    }
    if (objective.reinforcements) {
      this.reinforceMission(objective.reinforcements, objective.id);
    }
  }

  private reinforceMission(wave: string, key: string): void {
    if (this.options.reinforce) {
      this.options.reinforce(wave, key);
      return;
    }
    const modules = import.meta.glob('../data/waves/*.json', {
      eager: true,
      import: 'default',
    });
    const data = modules[`../data/waves/${wave}.json`];
    if (!data) throw new Error(`Nieznana fala: ${wave}`);
    const definition = loadWaves(data);
    definition.spawnPoints = this.layout.spawnPoints;
    const director = new WaveDirector(
      definition,
      {
        spawn: (enemy, position) => this.spawnEnemy(enemy, position),
        playerPosition: () => this.player.getState().position,
      },
      this.ctx.bus,
      this.ctx.rng.fork(`reinforcement:${key}`),
    );
    this.reinforcements.push(director);
    director.start();
  }

  objectiveModel(): MissionObjectives | undefined {
    return this.mission;
  }

  setLevelGate(
    id: string,
    block: RoomDefinition['blocks'][number],
    open: boolean,
  ): void {
    let gate = this.levelGates.get(id);
    if (!gate) {
      const { size, position } = block;
      const geometry = new BoxGeometry(size.x, size.y, size.z);
      this.geometries.add(geometry);
      const mesh = new Mesh(geometry, getMaterial(block.material ?? 'metal'));
      mesh.position.copy(position);
      mesh.name = `gate:${id}`;
      this.root.add(mesh);
      const collider = this.world.createCollider(
        this.rapier.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
          .setTranslation(position.x, position.y, position.z)
          .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
      );
      gate = { mesh, collider };
      this.levelGates.set(id, gate);
    }
    gate.mesh.visible = !open;
    gate.collider.setEnabled(!open);
  }

  teleportPlayer(position: Vec3, yawDeg: number): void {
    this.player.teleport({
      ...position,
      y:
        position.y +
        this.ctx.tuning.player.capsuleHeight / 2 +
        this.ctx.tuning.player.controllerOffset,
    });
    this.lookAtDegrees(yawDeg, 0);
    this.previous = this.player.getState();
  }

  resetLevelCombat(position: Vec3, yawDeg: number): void {
    const god = this.god;
    this.prepareEncounter({ invulnerable: god, passive: false });
    this.teleportPlayer(position, yawDeg);
    this.squad.restore(position);
    if (this.mission) {
      for (const id of this.mission.ids) {
        if (this.mission.objectives[id] !== 'done')
          this.mission.progress[id] = 0;
        delete this.mission.fuses[id];
      }
    }
  }

  forceEncounterAlarm(group: string): void {
    this.manager.forceAlarm(group);
  }

  encounterObservers() {
    const guards: {
      id: EntityId;
      state: string;
      group: string;
      position: Vec3;
    }[] = [];
    this.manager.forEach((e) => {
      if (e.perception && !e.removed && e.current.state !== 'dead')
        guards.push({
          id: e.id,
          state: e.perception.state,
          group: e.perception.spawn.groupId,
          position: { ...e.current.position },
        });
    });
    return guards;
  }

  removeEncounterEnemies(ids: readonly EntityId[]): void {
    // Usunięcie debug przechodzi przez wspólne obrażenia bez kredytu gracza.
    for (const id of ids) {
      const health = this.damage.health(id);
      if (health && !health.dead)
        this.damage.deal(id, {
          source: null,
          amount: health.current,
          tags: ['#hazard'],
        });
    }
  }

  // ----------------------------------------------------------------- sojusznicy

  /** Dodaje sojusznika z `src/data/allies` (stopy w `spawn`); null, gdy już jest albo brak miejsca. */
  addAlly(id: string, spawn: Vec3): Ally | null {
    return this.squad.add(id, spawn);
  }

  /** Host (misja) zgłasza ukończony cel albo spotkanie: dołączają sojusznicy z `joinAfter`. */
  allyDependencyDone(kind: 'objective' | 'encounter', id: string): void {
    this.pendingAllies = this.pendingAllies.filter((ally) => {
      if (ally.joinAfter?.kind !== kind || ally.joinAfter.id !== id)
        return true;
      this.addAlly(ally.id, ally.spawn);
      return false;
    });
  }

  /**
   * Checkpoint: bez `position` wracają (przy graczu) sojusznicy, którzy nie doczekali podniesienia;
   * z `position` cała drużyna staje przy tym punkcie z pełnym zdrowiem.
   */
  restoreAllies(position?: Vec3): void {
    this.squad.restore(position);
  }

  allySnapshots(): AllySnapshot[] {
    return this.squad.snapshots();
  }

  /** Nawigacja sojuszników: siatka trybu albo zbudowana z bloków pokoju na poziomie startu. */
  private allyNavigation(): AllyNavigation | null {
    if (this.navigation) return this.navigation;
    if (this.allyNav !== undefined) return this.allyNav;
    try {
      this.allyNav = this.layout.arena
        ? new ArenaNavigation(this.layout)
        : buildFloorNavigation(this.layout, this.ctx.tuning);
    } catch {
      this.allyNav = null;
    }
    return this.allyNav;
  }

  private renderAllies(alpha: number, frameDt: number): void {
    this.presenter?.render(
      alpha,
      frameDt,
      this.ctx.camera?.position,
      this.state === 'playing',
    );
  }

  exportState(): Pick<RunState, 'hp' | 'energy'> & {
    squad?: SquadMemberState[];
  } {
    return {
      hp: this.health.current,
      energy: this.energy.current,
      ...(this.squad.size > 0 ? { squad: this.squad.exportState() } : {}),
    };
  }

  /** Wrogowie trybów bez fal dostają więcej zdrowia za każdego sojusznika; fale rosną w planie. */
  private baseSpawnModifiers(): StatModifier[] {
    return [
      ...threatModifiers(this.run.threatLevel),
      ...(this.run.modeId
        ? squadHealthModifiers(
            squadOf(this.run).length,
            this.ctx.tuning.allies.enemyHealthPerAlly,
          )
        : []),
    ];
  }

  get playerId(): EntityId {
    return this.player.id;
  }

  playerSnapshot(): PlayerState {
    return structuredClone(this.player.getState());
  }

  /** Punkt rozszerzenia hosta ćwiczeń; wywoływać poza obsługą zdarzeń symulacji. */
  prepareEncounter(options: {
    invulnerable: boolean;
    passive: boolean;
    position?: Vec3;
    held?: 'blade' | 'gun';
  }): void {
    this.director.stop();
    this.manager.despawnAll();
    this.statuses.reset();
    this.projectiles.dispose();
    this.powers.reset();
    this.blade.reset();
    for (const weapon of this.weapons) weapon.reset();
    this.cleared = false;
    this.puzzle?.reset();
    this.puzzleHud?.update(null);
    for (const door of this.doors.values()) {
      door.collider.setEnabled(true);
      door.mesh.visible = true;
    }
    this.state = 'playing';
    this.passiveEncounter = options.passive;
    this.god = options.invulnerable;
    this.playerStats.removeBySource('debug:god');
    if (this.god)
      this.playerStats.add({
        stat: 'damageTaken',
        type: 'mult',
        value: 0,
        source: 'debug:god',
      });
    this.health.reset();
    this.hud?.setLoadout(this.loadout);
    this.energy.set(this.energy.max);
    this.player.stamina.set(this.player.stamina.max);
    if (options.position) {
      this.player.teleport(options.position);
      this.lookAtDegrees(0, 0);
    }
    this.previous = this.player.getState();
    this.heldItem.reset(options.held ?? this.heldItem.held);
    this.emitHealth();
  }

  spawnEncounterEnemy(
    kind: string,
    position: Vec3,
    modifiers: readonly import('../core/stats').StatModifier[] = [],
    healthFraction = 1,
    stealth?: StealthSpawn,
  ): EntityId | null {
    this.manager.setSpawnModifiers([
      ...this.baseSpawnModifiers(),
      ...modifiers,
    ]);
    try {
      const id = this.spawnEnemy(kind, position, stealth);
      if (id !== null) {
        const health = this.damage.health(id)!;
        health.set(health.max * healthFraction);
        this.ctx.bus.emit('health_changed', {
          id,
          current: health.current,
          max: health.max,
        });
      }
      return id;
    } finally {
      this.manager.setSpawnModifiers(this.baseSpawnModifiers());
    }
  }

  fireEncounterProjectile(
    projectile: Parameters<ProjectileSystem['spawn']>[0],
  ): void {
    this.projectiles.spawn(projectile);
  }

  startEncounterWave(): void {
    this.director.start();
  }

  /** API hosta runu i komendy room-test; bez restartowania ani leczenia gracza. */
  clear(): void {
    if (this.cleared || this.state === 'dead' || this.disposed) return;
    // Nie usuwamy żywego bossa bez zdarzenia śmierci potrzebnego celom misji.
    if (
      this.mission?.mission.objectives.some(
        (objective) =>
          objective.kind === 'killBoss' &&
          this.mission!.ids.includes(objective.id) &&
          this.mission!.objectives[objective.id] !== 'done',
      )
    )
      return;
    this.director.stop();
    this.manager.despawnAll();
    this.statuses.reset();
    this.projectiles.dispose();
    this.puzzle?.finish('solved');
    this.completeRoom();
  }

  private completeRoom(): void {
    if (this.options.linearMission) return;
    if (this.conquest && this.conquest.outcome !== 'victory') return;
    if (this.assault && this.assault.outcome !== 'victory') return;
    if (this.heist && this.heist.outcome !== 'victory') return;
    if (this.node.fixed?.objectives.length && !this.mission?.complete) return;
    if (this.puzzle && this.puzzle.view().outcome !== 'solved') return;
    if (this.cleared || this.state === 'dead' || this.disposed) return;
    this.cleared = true;
    this.openExit();
    this.ctx.bus.emit('room_cleared', {
      nodeId: this.node.id,
      type: this.node.type,
      timeS: this.elapsedS,
    });
  }

  private openExit(): void {
    for (const door of this.doors.values())
      if (door.role === 'exit') {
        door.collider.setEnabled(false);
        door.mesh.visible = false;
      }
  }

  private lookAtDegrees(yaw: number, pitch: number): boolean {
    const state = this.player.getState();
    const settings = loadSettings();
    const scale =
      this.ctx.tuning.player.lookSensitivity * settings.mouseSensitivity;
    const yawRad =
      (((((yaw + 180) % 360) + 360) % 360) - 180) * (Math.PI / 180);
    const pitchLimit = this.ctx.tuning.player.maxPitchDeg;
    const pitchRad =
      (Math.max(-pitchLimit, Math.min(pitchLimit, pitch)) * Math.PI) / 180;
    const lookDelta = {
      x: (state.yaw - yawRad) / scale,
      y: (state.pitch - pitchRad) / (scale * (settings.invertY ? -1 : 1)),
    };
    if (
      ![yawRad, pitchRad, scale, lookDelta.x, lookDelta.y].every(
        Number.isFinite,
      )
    )
      return false;
    this.player.step(0, {
      held: new Set(),
      pressed: new Set(),
      released: new Set(),
      lookDelta,
    });
    this.previous = this.player.getState();
    return true;
  }

  private syncHeistCarry(): void {
    if (this.heist)
      this.player.setCarry(
        this.heist.state === 'player' ? this.heist.definition.carrySpeed : null,
      );
  }

  private registerCommands(playerId: EntityId): void {
    const register = (
      name: string,
      help: string,
      run: (args: string[]) => string,
    ): void => {
      const off = this.ctx.commands?.register(name, help, run);
      if (off) this.off.push(off);
    };
    if (this.puzzle)
      register('puzzle status', puzzleText.debugStatus, () =>
        JSON.stringify(this.query('puzzle')),
      );
    this.squad.registerCommands(register);
    register('heist grab', 'heist grab', (args) => {
      const ok = args.length === 0 && this.heist?.grab();
      this.syncHeistCarry();
      return ok ? 'Rdzeń podniesiony.' : 'Rdzeń niedostępny.';
    });
    register('heist drop', 'heist drop', (args) => {
      const ok =
        args.length === 0 && this.heist?.drop(this.player.getState().position);
      this.syncHeistCarry();
      return ok ? 'Rdzeń upuszczony.' : 'Nie niesiesz rdzenia.';
    });
    register('heist extract', 'heist extract', (args) => {
      if (args.length || !this.heist?.extract()) return 'Nie niesiesz rdzenia.';
      this.completeRoom();
      return 'Rdzeń ewakuowany.';
    });
    register('heist lives', 'heist lives <n>', (args) =>
      args.length === 1 && this.heist?.setLives(Number(args[0]))
        ? 'Pula ustawiona.'
        : 'Nieprawidłowa pula.',
    );
    register(
      'weather',
      'weather <rain|storm|smog|drizzleWind|clearNight>',
      (args) =>
        args.length === 1 && this.dressing?.setWeather(args[0]!)
          ? `Pogoda: ${args[0]}`
          : 'Nieznany profil pogody.',
    );
    register('conquest capture', 'conquest capture <A|B|C|D|E>', (args) =>
      args.length === 1 && this.conquest?.capture(args[0]!)
        ? 'Punkt przejęty.'
        : 'Nieprawidłowy punkt.',
    );
    register('assault destroy', 'assault destroy <A|B>', (args) =>
      args.length === 1 && this.assault?.destroy(args[0]!)
        ? 'Stacja zniszczona.'
        : 'Stacja niedostępna.',
    );
    register('assault lives', 'assault lives <n>', (args) =>
      args.length === 1 && this.assault?.setLives(Number(args[0]))
        ? 'Pula ustawiona.'
        : 'Nieprawidłowa pula.',
    );
    register('conquest tickets', 'conquest tickets <n>', (args) =>
      args.length === 1 && this.conquest?.setTickets(Number(args[0]))
        ? 'Pula ustawiona.'
        : 'Nieprawidłowa pula.',
    );
    if (!this.options.linearMission)
      register('objective done', 'objective done <id> — ukończ cel', (args) => {
        if (!this.mission || args.length !== 1 || !this.mission.done(args[0]!))
          return 'Cel niedostępny.';
        if (this.mission.complete) this.completeRoom();
        return 'Cel ukończony.';
      });
    register('tp', 'tp <x> <z> [yawDeg] [pitchDeg] [floorY]', (args) => {
      const [x, z, yaw = 0, pitch = 0, floorY] = args.map(Number);
      if (
        args.length < 2 ||
        args.length > 5 ||
        ![x, z, yaw, pitch, floorY ?? 0].every(Number.isFinite) ||
        Math.abs(x!) > 1e4 ||
        Math.abs(z!) > 1e4 ||
        Math.abs(floorY ?? 0) > 1e4 ||
        Math.abs(yaw) > 1e6 ||
        Math.abs(pitch) > 1e6 ||
        !this.lookAtDegrees(yaw, pitch)
      )
        return 'Uzycie: tp <x> <z> [yawDeg] [pitchDeg] [floorY]';
      // Opcjonalna podłoga docelowa: piętra i wykopy dużych aren.
      const body = this.ctx.tuning.player;
      this.player.teleport({
        ...this.player.getState().position,
        x: x!,
        z: z!,
        ...(floorY === undefined
          ? {}
          : { y: floorY + body.capsuleHeight / 2 + body.controllerOffset }),
      });
      this.previous = this.player.getState();
      return `Gracz: ${x}, ${z}`;
    });
    register('look', 'look <yawDeg> [pitchDeg]', (args) => {
      const [yaw, pitch = 0] = args.map(Number);
      if (
        args.length < 1 ||
        args.length > 2 ||
        ![yaw, pitch].every(Number.isFinite) ||
        Math.abs(yaw!) > 1e6 ||
        Math.abs(pitch) > 1e6 ||
        !this.lookAtDegrees(yaw!, pitch)
      )
        return 'Uzycie: look <yawDeg> [pitchDeg]';
      return `Kamera: ${yaw}, ${pitch}`;
    });
    register('execute', 'execute ready — gotowi do wykończenia', (args) =>
      args.length === 1 && args[0] === 'ready'
        ? JSON.stringify(this.execute.readyIds())
        : 'Użycie: execute ready',
    );
    register('weaken', 'weaken <procent> — HP żywych wrogów', (args) => {
      const percent = Number(args[0]);
      if (
        args.length !== 1 ||
        !Number.isFinite(percent) ||
        percent <= 0 ||
        percent > 100
      )
        return 'Użycie: weaken <procent>, 0 < procent <= 100';
      this.manager.forEach((enemy) => {
        const health = this.damage.health(enemy.id);
        if (!health || health.dead) return;
        health.set((health.max * percent) / 100);
        this.ctx.bus.emit('health_changed', {
          id: enemy.id,
          current: health.current,
          max: health.max,
        });
      });
      return `HP wrogów: ${percent}%`;
    });
    register(
      'hold',
      'hold blade|gun — przedmiot w ręku natychmiast',
      (args) => {
        const kind = args[0];
        if (args.length !== 1 || (kind !== 'blade' && kind !== 'gun'))
          return 'Użycie: hold blade|gun';
        this.heldItem.reset(kind);
        return `W ręku: ${kind}`;
      },
    );
    register('hazard list', 'hazard list — stan zagrożeń pokoju', () =>
      JSON.stringify(this.hazards.state()),
    );
    register(
      'hazard detonate',
      'hazard detonate <id> — wysadź beczkę',
      (args) =>
        args.length === 1 && this.hazards.detonate(args[0]!)
          ? 'Beczka zdetonowana.'
          : 'Podaj id żywej beczki: hazard list.',
    );
    register(
      'status',
      `status <id> [s] — na wszystkich wrogów: ${[...statusDefinitions.keys()].join(', ')}`,
      (args) => {
        const status = args[0] ?? '';
        const seconds = args[1] === undefined ? 3 : Number(args[1]);
        if (!statusDefinitions.has(status) || !(seconds > 0))
          return 'Podaj znany status i dodatni czas w sekundach.';
        const ids = this.enemyIds();
        for (const target of ids)
          this.statuses.apply(
            target,
            { id: status, durationS: seconds },
            playerId,
          );
        return `Nałożono ${status} (${seconds} s) na wrogów: ${ids.length}`;
      },
    );
    register(
      'spawn',
      `spawn <id> [n] — ${availableEnemyIds().join(', ')}`,
      (args) => {
        const kind = args[0] ?? '';
        const n = args[1] === undefined ? 1 : Number(args[1]);
        if (
          !enemyRegistry.has(kind) ||
          !Number.isSafeInteger(n) ||
          n < 1 ||
          n > 50
        )
          return 'Podaj znany archetyp i liczbę 1–50.';
        const { position, yaw } = this.player.getState();
        let made = 0;
        for (let i = 0; i < n; i++) {
          const offset = (i - (n - 1) / 2) * 1.5;
          const id = this.spawnEnemy(kind, {
            x: position.x - Math.sin(yaw) * 8 + Math.cos(yaw) * offset,
            y: 0,
            z: position.z - Math.cos(yaw) * 8 - Math.sin(yaw) * offset,
          });
          if (id !== null) made++;
        }
        return `Utworzono: ${made}`;
      },
    );
    const hitAll = (amount: number): string => {
      this.manager.forEach((e) =>
        this.damage.deal(e.id, { source: playerId, amount, tags: ['#debug'] }),
      );
      return 'Obrażenia zadane.';
    };
    register('hurt', 'hurt <n> — obrażenia gracza', (args) => {
      const amount = Number(args[0]);
      if (args.length !== 1 || !Number.isFinite(amount) || amount < 0)
        return 'Podaj obrażenia.';
      this.damage.deal(playerId, { source: null, amount, tags: ['#debug'] });
      return 'Obrażenia zadane.';
    });
    register('hit', 'hit <dmg> — wszystkim wrogom', (args) => {
      const amount = Number(args[0]);
      return Number.isFinite(amount) && amount >= 0
        ? hitAll(amount)
        : 'Podaj obrażenia.';
    });
    register('kill all', 'kill all', () => hitAll(Number.MAX_VALUE));
    register('boss phase', 'boss phase <n> — faza bossa od 1', (args) => {
      const phase = Number(args[0]);
      return args.length === 1 && this.boss?.setPhase(phase)
        ? `Faza bossa: ${phase}`
        : 'Podaj istniejącą fazę żywego bossa.';
    });
    register(
      'boss pattern',
      'boss pattern summon|shield — wymuś wzorzec bossa',
      (args) => {
        const kind = args[0];
        return args.length === 1 &&
          (kind === 'summon' || kind === 'shield') &&
          this.boss?.forcePattern(kind)
          ? `Wzorzec bossa: ${kind}`
          : 'Podaj summon lub shield i żywego bossa gotowego do wzorca.';
      },
    );
    register('wave', 'wave <n> — skok do fali', (args) => {
      const n = Number(args[0]);
      if (!Number.isSafeInteger(n) || n < 1 || n > this.director.totalWaves)
        return `Podaj falę 1–${this.director.totalWaves}.`;
      this.director.goto(n);
      return `Fala ${n}.`;
    });
    register('god', 'god — nieśmiertelność gracza', () => {
      this.god = !this.god;
      this.playerStats.removeBySource('debug:god');
      if (this.god)
        this.playerStats.add({
          stat: 'damageTaken',
          type: 'mult',
          value: 0,
          source: 'debug:god',
        });
      return `Nieśmiertelność: ${this.god ? 'włączona' : 'wyłączona'}`;
    });
    register(
      'implant',
      `implant <id> — nałóż implant: ${[...this.implantDefs.keys()].join(', ')}`,
      (args) => {
        const id = args[0] ?? '';
        const definition = this.implantDefs.get(id);
        if (args.length !== 1 || !definition)
          return `Podaj znany implant: ${[...this.implantDefs.keys()].join(', ')}`;
        if (!this.implantSystem.add(id, 'reward'))
          return `Implant już posiadany: ${id}`;
        return `Dodano implant: ${definition.name} (${definition.id})`;
      },
    );
    const talentNodes = [...talentTrees.values()].flatMap((tree) => tree.nodes);
    register(
      'talent',
      `talent <id>|reset — talent na żywo (modyfikatory, tagi, wyzwalacze; łatki ekwipunku od następnego pokoju): ${talentNodes.map((node) => node.id).join(', ')}`,
      (args) => {
        if (args.length === 1 && args[0] === 'reset') {
          this.talentSystem.clear();
          return 'Talenty pokoju wyczyszczone.';
        }
        const id = args[0] ?? '';
        const node = talentNodes.find((candidate) => candidate.id === id);
        if (args.length !== 1 || !node)
          return 'Podaj znany talent: talent <id> | talent reset.';
        if (!this.talentSystem.add(id)) return `Talent już aktywny: ${id}`;
        return `Dodano talent: ${node.name} (${node.id})`;
      },
    );
  }

  /** Stan początkowy dla HUD (zdrowie i ciepło emitują zdarzenia dopiero przy zmianie). */
  private emitHealth(): void {
    this.ctx.bus.emit('health_changed', {
      id: this.player.id,
      current: this.health.current,
      max: this.health.max,
    });
    this.emitWeapon();
  }

  heldView(): HeldItemView {
    return this.heldItem.view();
  }

  query(name: string): unknown {
    if (name === 'horizon') return this.atmosphere?.horizon();
    if (name === 'weather') return this.dressing?.weatherId ?? null;
    if (name === 'executable') return this.execute.readyIds();
    switch (name) {
      case 'conquest':
        return this.conquest?.snapshot() ?? null;
      case 'assault':
        return this.assault?.snapshot() ?? null;
      case 'heist':
        return this.heist
          ? {
              ...this.heist.snapshot(),
              moveSpeed: this.player.stats.get('moveSpeed'),
              dashS: this.player.getState().dashS,
              sprinting: this.player.getState().sprinting,
            }
          : null;
      case 'missionObjectives':
        return this.mission
          ? {
              objectives: this.mission.objectives,
              progress: this.mission.progress,
              fuses: this.mission.fuses,
              paused: this.mission.paused,
              reinforcements: this.reinforcements.map(
                (director) => director.spawnLog,
              ),
            }
          : null;
      case 'hazards':
        return this.hazards.state();
      case 'props':
        return {
          alive: this.props?.aliveCount ?? 0,
          bodies: this.props?.bodyCount ?? 0,
          awake: this.props?.awakeCount ?? 0,
        };
      case 'puzzle':
        return this.puzzle?.view();
      case 'wave':
        return this.director.wave;
      case 'phase':
        return this.director.currentPhase;
      case 'enemies':
        return this.aliveEnemies();
      case 'boss': {
        if (!this.boss || this.boss.removed) return null;
        const snapshot = this.enemy(this.boss.id)?.current;
        return {
          id: this.boss.id,
          phase: this.boss.phase,
          hp: this.damage.health(this.boss.id)?.current ?? 0,
          shield: this.boss.shield,
          minions: this.boss.minionCount,
          // Stan i pozycja tylko do podglądu (zrzuty telegrafów); bez wpływu na symulację.
          state: snapshot?.state,
          attack: snapshot?.attack?.kind,
          stateTimeS: snapshot?.stateTimeS,
          x: snapshot?.position.x,
          z: snapshot?.position.z,
        };
      }
      case 'enemyDirector':
        return this.manager.director?.snapshot() ?? null;
      case 'playerLook': {
        const { yaw, pitch } = this.player.getState();
        return {
          yawDeg: (yaw * 180) / Math.PI,
          pitchDeg: (pitch * 180) / Math.PI,
        };
      }
      case 'playerPos':
        return { ...this.player.getState().position };
      case 'playerHp':
        return this.health.current;
      case 'playerMaxHp':
        return this.health.max;
      case 'implants':
        return this.implantSystem.ids();
      case 'talents':
        return this.talentSystem.ids();
      case 'energy':
        return this.energy.current;
      case 'stamina':
        return this.player.stamina.current;
      case 'extraJumps':
        return this.player.stats.get('extraJumps');
      case 'heat':
        return this.weapon.heat.current;
      case 'loadout':
        return this.loadout.id;
      case 'resolvedLoadout':
        return structuredClone(this.resolved);
      case 'blade':
        return this.blade.definition.id;
      case 'heldItem':
        return this.heldView();
      case 'weapon':
        return this.weapon.definition.id;
      case 'weaponHeat':
        return Object.fromEntries(
          this.weapons.map((weapon) => [
            weapon.definition.id,
            weapon.heat.current,
          ]),
        );
      case 'powerSlots':
        return this.loadout.powers.slice();
      case 'powerCooldowns':
        return this.loadout.powers.map(
          (_, slot) => this.powers.get(slot)!.cooldownRemaining,
        );
      case 'beam':
        return this.weapon.beam;
      case 'dead':
        return this.state === 'dead';
      case 'state':
        return this.state;
      case 'synergies':
        return this.synergies.active();
      case 'roomCleared':
        return this.cleared;
      case 'doors':
        return Object.fromEntries(
          [...this.doors].map(([id, door]) => [
            id,
            { role: door.role, open: !door.collider.isEnabled() },
          ]),
        );
      case 'kills':
        return this.kills;
      case 'allies':
        return this.squad.snapshots();
      case 'allyKills':
        return this.squad.kills;
      case 'squadOrder':
        return this.squad.order;
      case 'meleeParries':
        return this.meleeParries;
      case 'spawnLog':
        return this.director.spawnLog.map((e) => ({ ...e }));
      case 'paused':
        return this.ctx.loop.paused;
      case 'debris':
        return this.debris.activeCount;
      case 'bodies':
        return this.world.bodies.len();
      default:
        return undefined;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try {
      this.disposeParts();
    } catch (error) {
      if (this.initDone) throw error;
    } finally {
      this.dressing?.dispose();
      for (const mesh of this.staticInstances.splice(0)) mesh.dispose();
      this.root.removeFromParent();
      this.root.clear();
      this.atmosphere?.dispose();
    }
  }

  /** Sprząta również zasoby utworzone przed przerwaniem asynchronicznego init(). */
  private disposeParts(): void {
    this.navigation?.dispose();
    this.hazardView?.dispose();
    this.conquestView?.dispose();
    this.assaultView?.dispose();
    this.heistView?.dispose();
    this.missionView?.dispose();
    this.missionHud?.dispose();
    for (const director of this.reinforcements) director.dispose();
    this.hazards?.dispose();
    this.propView?.dispose();
    this.scatterView?.dispose();
    this.scatter?.dispose();
    this.props?.dispose();
    for (const off of this.off.splice(0)) off();
    this.hud?.dispose();
    this.synergies?.dispose();
    this.powers?.reset();
    this.puzzle?.dispose();
    this.puzzleView?.dispose();
    this.puzzleBeam?.dispose();
    this.puzzleHud?.dispose();
    this.beamView?.dispose();
    this.lightningView?.dispose();
    this.explosionView?.dispose();
    this.bossFx?.dispose();
    this.shatter?.dispose();
    this.worldDebris?.dispose();
    this.debrisView?.dispose();
    this.statusVfx?.dispose();
    this.statusView?.dispose();
    this.hitSparks?.dispose();
    this.hitSparksView?.dispose();
    for (const view of this.views.values()) view.dispose();
    this.views.clear();
    this.presenter?.dispose();
    this.squad?.dispose();
    this.director?.dispose();
    this.manager?.dispose();
    this.statuses?.dispose();
    this.blade?.dispose();
    this.execute?.dispose();
    this.heldItem?.dispose();
    this.energy?.dispose();
    this.fppView?.dispose();
    this.flyingBlade?.dispose();
    this.barrierView?.dispose();
    this.projectileView?.dispose();
    this.projectiles?.dispose();
    this.legs?.dispose();
    this.fpsCamera?.dispose();
    this.player?.dispose();
    this.world?.free();
    this.doors.clear();
    for (const g of this.geometries) g.dispose();
    this.geometries.clear();
  }
}
