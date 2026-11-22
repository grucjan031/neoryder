import { blockMaterialSchema, dressingFields } from '../world/dressingSchema';
import { worldEnvelope } from '../render/horizon';
import { SceneAtmosphere } from '../render/sceneAtmosphere';
import { batchStaticGeometry } from '../render/staticBatch';
import { CityDressing } from '../render/city/dressing';
import {
  cloneCityModel,
  isCityModelFile,
  loadDecor,
} from '../render/cityModels';
import { cloneRoomModel } from './roomModels';
import { placeBlockModel } from './roomScene';
import { FppViewModel } from '../render/fppViewModel';
import {
  queryBladeArc,
  queryBladeSegment,
  queryBladeSpin,
} from '../combat/melee/bladeQueries';
import { FlyingBlade } from '../render/flyingBlade';
import { BoxGeometry, Euler, Group, Mesh, Quaternion } from 'three';
import type { BufferGeometry, Scene as ThreeScene } from 'three';
import type { World } from '@dimforge/rapier3d-compat';
import { z } from 'zod';
import type { GameContext } from '../core/context';
import { EntityRegistry } from '../core/entities';
import type { EntityId } from '../core/events';
import type { InputSnapshot } from '../core/input';
import type { Vec3 } from '../core/math';
import { loadSettings } from '../core/save';
import { Stats } from '../core/stats';
import { DamageSystem, Health, Hurtboxes } from '../combat/damage';
import { withBladeOverride } from '../combat/melee/bladeSchema';
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
import sceneData from '../data/scenes/arena.json';
import wavesData from '../data/waves/arena.json';
import { statusDefinitions, StatusSystem } from '../combat/status';
import { directorConfigSchema } from '../enemies/director';
import { EnemyManager } from '../enemies/manager';
import { createEnemyView } from '../enemies/views';
import type { EnemyViewLike } from '../enemies/views';
import { availableEnemyIds, enemyRegistry } from '../enemies/registry';
import type { Enemy } from '../enemies/types';
import { CollisionGroup, initPhysics, interactionGroups } from '../physics';
import { FpsCamera } from '../player/fpsCamera';
import { PlayerController } from '../player/playerController';
import { staminaStatsSchema } from '../player/stamina';
import type { PlayerState } from '../player/playerController';
import { BeamRenderer } from '../render/beamRenderer';
import { BarrierRenderer } from '../render/barrierRenderer';
import { LightningRenderer } from '../render/lightningRenderer';
import { BarrierPower } from '../combat/powers/barrier';
import { ExplosionRenderer } from '../render/explosionRenderer';
import { loadoutDefinitions } from '../progression/loadout';
import type { Loadout } from '../progression/loadout';
import { resolveLoadout } from '../progression/patches';
import type { ResolvedLoadout } from '../progression/patches';
import { SynergySystem } from '../progression/synergies';
import { createStyleLights } from '../render/lights';
import { getMaterial } from '../render/materials';
import { ProjectileRenderer } from '../render/projectileRenderer';
import { BuildSelect } from '../ui/buildSelect';
import { Hud } from '../ui/hud';
import { RunInventoryMenu, buildRunInventoryView } from '../ui/runInventory';
import { DebrisSystem } from '../vfx/debris';
import { DebrisRenderer } from '../vfx/debrisRenderer';
import { EnemyShatter } from '../vfx/enemyShatter';
import { enemyBody } from '../vfx/enemyBody';
import { HitSparks } from '../vfx/hitSparks';
import { HitSparksRenderer, StatusVfxRenderer } from '../vfx/fxRenderer';
import { StatusVfx } from '../vfx/statusVfx';
import { loadWaves, WaveDirector } from '../world/waves';
import {
  arenaMutators,
  rollArenaMutator,
  type ArenaMutator,
} from '../world/arenaMutators';
import type { Scene } from './index';

const vec3 = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
});
export const arenaLayoutSchema = z.object({
  ...staminaStatsSchema.shape,
  ...dressingFields,
  playerHealth: z.number().positive(),
  playerSpawn: vec3,
  blocks: z.array(
    z.object({
      size: vec3,
      position: vec3,
      model: z.string().optional(),
      material: blockMaterialSchema.optional(),
    }),
  ),
  director: directorConfigSchema.optional(),
});
const layout = arenaLayoutSchema.parse(sceneData);
const waves = loadWaves(wavesData);
const MUTATOR_SOURCE = 'arena:mutator';

export const ARENA_MUTATORS_SCENE = 'arena-mutators';

/** Modele dla bloków układu; 'wall' to rozciągnięta bryła świata (bez modelu). */
const MODEL_FILES: Record<string, string> = {
  pillar: 'pillar',
  cover_low: 'cover_low',
  crate: 'crate',
  crate_small: 'crate_small',
};

/** 'select' — ekran wyboru buildu przed falą 1 (F2-17): fale stoją, gracz czeka. */
type ArenaState = 'select' | 'playing' | 'dead';

/**
 * Arena z falami (F1 #16) — pierwsza pełna pętla walki: gracz z ostrzem (combo, ciężki, blok,
 * parowanie), Pchnięciem Rezonansu i blasterem przeciw falom Szturmowców i Strzelców
 * z danych (src/data/waves/arena.json). Ten sam ?seed= daje ten sam przebieg fal.
 */
export class Arena implements Scene {
  private ctx!: GameContext;
  private inventory?: RunInventoryMenu;
  private rapier!: Awaited<ReturnType<typeof initPhysics>>;
  private world!: World;
  private entities!: EntityRegistry;
  private damage!: DamageSystem;
  private statuses!: StatusSystem;
  private readonly hurtboxes = new Hurtboxes();
  private projectiles!: ProjectileSystem;
  private projectileView!: ProjectileRenderer;
  private manager!: EnemyManager;
  private director!: WaveDirector;
  private player!: PlayerController;
  private previous!: PlayerState;
  private fpsCamera!: FpsCamera;
  private energy!: PlayerEnergy;
  private blade!: PlasmaBlade;
  private execute!: ExecuteSystem;
  private executeTarget: EntityId | null = null;
  private heldItem!: HeldItem;
  private readonly flyingBlade = new FlyingBlade();
  private powers!: PowerSlots;
  private loadout: Loadout = loadoutDefinitions.get('classic')!;
  /** Definicje ekwipunku presetu (arena nie używa łatek talentów). */
  private resolved: ResolvedLoadout = resolveLoadout(this.loadout, []);
  /** Wariant ostrza wybrany na ekranie buildu albo z `?blade=`; nadpisuje ostrze ekwipunku. */
  private bladeOverride: string | null = null;
  private weapons: Weapon[] = [];
  private weaponSlot = 0;
  private beamView!: BeamRenderer;
  private barrierView!: BarrierRenderer;
  private lightningView!: LightningRenderer;
  private explosionView!: ExplosionRenderer;
  private readonly playerStats = new Stats({
    damage: 1,
    attackSpeed: 1,
    maxStamina: layout.maxStamina,
    staminaRegen: layout.staminaRegen,
    extraJumps: layout.extraJumps,
    maxHealth: layout.playerHealth,
    maxEnergy: 100,
    energyRegen: 25,
    heatCapacity: 100,
    coolingRate: 45,
    arenaLightScale: 1,
  });
  private mutator: ArenaMutator | null = null;
  private ammoRemaining: number | null = null;
  private readonly ammo = {
    available: () => this.ammoRemaining === null || this.ammoRemaining > 0,
    consume: () => {
      if (this.ammoRemaining === null) return;
      this.ammoRemaining--;
      this.updateMutatorHud();
    },
  };
  private readonly health = new Health(() => this.playerStats.get('maxHealth'));
  private fppView!: FppViewModel;
  private readonly views = new Map<EntityId, EnemyViewLike>();
  private readonly seenEnemyIds = new Set<EntityId>();
  private readonly powerPair: ReturnType<PowerSlots['get']>[] = [];
  private disposed = false;
  private readonly root = new Group();
  private readonly lights = createStyleLights();
  private atmosphere?: SceneAtmosphere;
  private dressing?: CityDressing;
  private readonly geometries = new Set<BufferGeometry>();
  private readonly off: (() => void)[] = [];
  private readonly tmpEuler = new Euler(0, 0, 0, 'YXZ');
  private readonly tmpQuat = new Quaternion();
  private state: ArenaState = 'playing';
  private deadS = 0;
  private god = false;
  private kills = 0;
  private hud?: Hud;
  private debris!: DebrisSystem;
  private debrisView!: DebrisRenderer;
  private shatter!: EnemyShatter;
  private statusVfx!: StatusVfx;
  private statusView!: StatusVfxRenderer;
  private hitSparks!: HitSparks;
  private hitSparksView!: HitSparksRenderer;
  private synergies!: SynergySystem;
  private buildSelect?: BuildSelect;

  /**
   * @param selectBuild F2-17: bez `?loadout=` arena zaczyna od ekranu wyboru buildu
   *   (rejestr scen). Domyślnie wyłączone, żeby testy i sceny F1 startowały od razu z `classic`.
   */
  constructor(
    private readonly loadModels = true,
    private readonly selectBuild = false,
    readonly id: 'arena' | typeof ARENA_MUTATORS_SCENE = 'arena',
  ) {}

  async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    this.ctx = ctx;
    if (this.id === ARENA_MUTATORS_SCENE)
      this.mutator = rollArenaMutator(ctx.rng);
    const requested =
      typeof location === 'undefined'
        ? null
        : new URLSearchParams(location.search).get('loadout');
    this.setLoadout(
      loadoutDefinitions.get(requested ?? 'classic') ??
        loadoutDefinitions.get('classic')!,
    );
    if (requested !== null && !loadoutDefinitions.has(requested) && ctx.debug)
      console.warn(`Nieznany ekwipunek: ${requested}. Wybrano classic.`);
    this.bladeOverride =
      typeof location === 'undefined'
        ? null
        : new URLSearchParams(location.search).get('blade');
    const choosing = this.selectBuild && requested === null;
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
    this.atmosphere = new SceneAtmosphere(
      three,
      layout.theme,
      'arena',
      layout.playerSpawn.y,
      undefined,
      worldEnvelope(layout.blocks, layout.playerSpawn),
      ctx.camera,
    );
    three.add(this.root);
    this.root.add(this.lights);
    await this.buildLayout();
    if (this.disposed) return;
    await loadDecor(this.root, layout.decor, this.loadModels);
    if (this.disposed) return;
    this.dressing = new CityDressing(
      this.root,
      layout,
      this.atmosphere.theme,
      layout.playerSpawn.y,
      'arena',
    );

    const playerId = this.entities.create('player', 'player');
    this.player = new PlayerController(
      playerId,
      this.world,
      ctx,
      this.spawnPosition(),
      loadSettings(),
      { ...staminaStatsSchema.parse(layout), damage: 1, attackSpeed: 1 },
    );
    this.registerPlayer();
    this.hurtboxes.add(playerId, this.player.colliderHandle);
    this.entities.bindCollider(playerId, this.player.colliderHandle);
    this.previous = this.player.getState();
    this.fpsCamera = new FpsCamera(ctx.tuning, playerId, ctx.bus);

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
      floorY: layout.playerSpawn.y,
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
        getTarget: () =>
          this.health.dead ? null : { id: playerId, ...this.player.getState() },
      },
      layout.director ? { director: layout.director } : {},
    );

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
        totalWaves: waves.waves.length,
        onRetry: () => this.retry(),
        ...(this.selectBuild
          ? { onChangeBuild: () => this.openBuildSelect() }
          : {}),
      });
    if (typeof document !== 'undefined')
      this.inventory = new RunInventoryMenu(ctx, () =>
        buildRunInventoryView({ loadout: this.loadout }),
      );
    this.player.stamina.set(this.player.stamina.max);
    this.energy = new PlayerEnergy(
      playerId,
      this.playerStats,
      ctx.bus,
      ctx.tuning,
    );
    this.root.add(this.flyingBlade.root);
    this.createExecute();
    this.blade = new PlasmaBlade(
      withBladeOverride(this.resolved.blade, this.bladeOverride),
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
        castWall: (origin, dir, max) => this.castWall(origin, dir, max),
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
      walls: (pos, dir, dist) => this.castWall(pos, dir, dist),
      tuning: ctx.tuning.vfx,
    });
    this.debrisView = new DebrisRenderer(this.debris);
    this.root.add(this.debrisView.root);
    this.shatter = new EnemyShatter(ctx.bus, this.debris, {
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
      bladeDefinition: this.blade.definition,
      modelOf: weaponModelOf,
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
    this.synergies.setTags(this.loadout.tags);
    if (this.selectBuild && typeof document !== 'undefined')
      this.buildSelect = new BuildSelect({
        onSelect: (id, bladeId) => this.chooseLoadout(id, bladeId),
      });
    this.applyMutator();

    this.director = new WaveDirector(
      waves,
      {
        spawn: (enemy, position) => this.spawnEnemy(enemy, position),
        playerPosition: () => this.player.getState().position,
      },
      ctx.bus,
      ctx.rng.fork('waves'),
    );
    this.off.push(
      ctx.bus.on('player_died', ({ id }) => {
        if (id === playerId) this.onPlayerDied();
      }),
      ctx.bus.on('enemy_killed', ({ killer }) => {
        if (killer === playerId) this.kills++;
      }),
    );
    this.registerCommands(playerId);
    this.emitHealth();
    this.heldItem.reset(this.loadout.startHeld);
    this.world.step();
    if (choosing) this.enterBuildSelect();
    else this.director.start();
    this.render(1);
  }

  // ----------------------------------------------------------------- budowa

  private async buildLayout(): Promise<void> {
    const blocks = new Group();
    blocks.name = 'static-blocks';
    const models = new Group();
    models.name = 'static-models';
    this.root.add(blocks, models);
    await Promise.all(
      layout.blocks.map(
        async ({ size, position, model, material: blockMaterial }) => {
          this.world.createCollider(
            this.rapier.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
              .setTranslation(position.x, position.y, position.z)
              .setCollisionGroups(
                interactionGroups(CollisionGroup.World, 0xffff),
              ),
          );
          const geometry = new BoxGeometry(size.x, size.y, size.z);
          this.geometries.add(geometry);
          const material =
            blockMaterial ??
            (model?.startsWith('crate') ? 'interactive' : 'world');
          const fallback = new Mesh(geometry, getMaterial(material));
          fallback.position.set(position.x, position.y, position.z);
          blocks.add(fallback);
          const file = isCityModelFile(model)
            ? model
            : model
              ? MODEL_FILES[model]
              : undefined;
          if (!file || !this.loadModels) return;
          try {
            // Ten sam montaż co w pokojach (cache szablonów + placeBlockModel).
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
            blocks.remove(fallback);
            models.add(scene);
          } catch {
            // Bryła zastępcza zostaje (ten sam collider).
          }
        },
      ),
    );
    if (this.disposed) return;
    // Statyczne bryły i modele bloków: jedna siatka na materiał (jak w pokojach).
    batchStaticGeometry(blocks, this.geometries);
    batchStaticGeometry(models, this.geometries);
  }

  private spawnPosition(): Vec3 {
    const t = this.ctx.tuning.player;
    return {
      x: layout.playerSpawn.x,
      y: layout.playerSpawn.y + t.capsuleHeight / 2 + t.controllerOffset,
      z: layout.playerSpawn.z,
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

  private spawnEnemy(kind: string, position: Vec3): EntityId | null {
    if (this.aliveEnemies() >= this.ctx.tuning.arena.maxEnemies) return null;
    if (this.world.bodies.len() >= this.ctx.tuning.physics.maxDynamicBodies)
      return null;
    return this.manager.spawn(kind, position).id;
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

  private aliveEnemies(): number {
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
            const list: { id: EntityId; position: Vec3 }[] = [];
            this.manager.forEach((e) => {
              if (e.current.state !== 'dead')
                list.push({
                  id: e.id,
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
            ...(this.id === ARENA_MUTATORS_SCENE ? { ammo: this.ammo } : {}),
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
    return {
      target: hit
        ? (this.hurtboxes.get(hit.collider.handle)?.entity ?? null)
        : null,
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

  private castWall(origin: Vec3, dir: Vec3, max: number): number | null {
    const hit = this.world.castRay(
      new this.rapier.Ray(origin, dir),
      max,
      true,
      undefined,
      interactionGroups(CollisionGroup.Enemy, CollisionGroup.World),
    );
    return hit ? hit.timeOfImpact : null;
  }

  // ----------------------------------------------------------------- pętla

  step(dt: number, input: InputSnapshot): void {
    this.dressing?.step(dt);
    if (this.state === 'playing') this.inventory?.step(input);
    this.previous = this.player.getState();
    if (this.state === 'select') return;
    if (this.state === 'dead') {
      if (dt > 0) this.deadS += dt;
      this.manager.step(dt);
      return;
    }
    // F2-06: gracz, ostrze, moce, broń i energia w czasie gracza (Skupienie), reszta w czasie świata.
    const pdt = this.ctx.feel?.playerDt(dt) ?? dt;
    this.hud?.step(pdt);
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
      bladeBusy: bladeState !== 'idle' && bladeState !== 'throwing',
      canAim:
        this.state === 'playing' &&
        !this.weapon.overheated &&
        this.player.getState().dashS <= 0,
    });
    this.player.setAim(this.heldItem.aim);
    this.player.step(pdt, input);
    this.blade.step(pdt, bladeInput);
    this.powers.step(pdt, input);
    if (!(dt > 0)) {
      this.manager.step(dt);
      return;
    }
    this.energy.step(pdt);
    this.synergies.step(pdt);
    this.damage.step(dt);
    this.statuses.step(dt);
    this.execute.step(dt);
    this.projectileView.capturePrevious();
    this.debris.step(dt);
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
    this.manager.step(dt);
    this.world.gravity.y = this.player.gravity;
    this.world.timestep = dt;
    this.world.step();
    this.projectiles.step(dt);
    this.executeTarget = this.execute.targetId();
  }

  render(alpha: number, frameDt = 1 / 60): void {
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
    const ids = this.seenEnemyIds;
    ids.clear();
    this.manager.forEach((enemy) => {
      ids.add(enemy.id);
      let view = this.views.get(enemy.id);
      if (!view) {
        view = createEnemyView(enemy, this.loadModels);
        this.views.set(enemy.id, view);
        this.root.add(view.root);
      }
      view.render(alpha);
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
    this.projectileView.render(alpha);
    this.debrisView.render(alpha);
    this.explosionView.render(frameDt);
    this.statusView.render(alpha, frameDt);
    this.hitSparksView.render(frameDt);
    this.lights.sync(this.playerStats.get('arenaLightScale'));
    this.atmosphere?.sync(frameDt);
    this.flyingBlade.render(this.blade.view(), alpha, this.ctx.tuning);
    this.flyingBlade.root.visible &&= this.state === 'playing';
    this.barrierView.advance(frameDt);
    this.lightningView.advance(frameDt);
    const camera = this.ctx.camera;
    const powers = this.powerPair;
    powers[0] = this.powers.get(0);
    powers[1] = this.powers.get(1);
    if (!camera) {
      this.dressing?.render(frameDt, undefined);
      this.beamView.advance(frameDt);
      this.beamView.render(this.weapon.beam);
      this.lightningView.render(powers);
      return;
    }
    const pose = this.fpsCamera.update(
      frameDt,
      this.previous,
      this.player.getState(),
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
    this.hud?.setViewYaw(pose.yaw);
    if (Math.abs(camera.fov - pose.fov) > 1e-3) {
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    this.dressing?.render(frameDt, camera);
    const velocity = this.player.getState().velocity;
    this.fppView.place(camera.matrixWorld, frameDt, {
      blade: this.blade.view(),
      held: this.heldView(),
      horizontalSpeed: Math.hypot(velocity.x, velocity.z),
      visible: this.state === 'playing',
      aim: this.heldItem.aim,
    });
    this.beamView.advance(frameDt);
    this.beamView.render(this.weapon.beam, this.fppView.beamOrigin);
    this.lightningView.render(powers, camera);
  }

  // ----------------------------------------------------------------- śmierć i reset

  private onPlayerDied(): void {
    this.state = 'dead';
    this.heldItem.cancelAim();
    this.player.setAim(0);
    // Aktywne moce (Skupienie, Bariera) kończą się ze śmiercią, nie dopiero przy „Jeszcze raz”.
    this.powers.reset();
    this.weapon.cool(0);
    this.deadS = 0;
    this.director.stop();
    if (typeof document !== 'undefined') document.exitPointerLock?.();
  }

  /** Pełny reset areny: wrogowie, pociski, gracz, energia, fale od 1. */
  /**
   * Nowy run od zera: wrogowie, pociski, odłamki, stan broni, ostrza i mocy, zdrowie i energia,
   * pozycja gracza. Fale i AI dostają świeże strumienie Rng — ten sam seed = ten sam przebieg.
   */
  reset(): void {
    this.manager.despawnAll();
    this.applyMutator();
    this.createExecute();
    this.statuses.reset();
    this.projectiles.dispose();
    this.projectileView.capturePrevious();
    this.debris.clear();
    this.statusVfx.clear();
    this.hitSparks.clear();
    this.applyBlade();
    this.createEquipment();
    this.synergies.reset();
    this.synergies.setTags(this.loadout.tags);
    this.buildSelect?.hide();
    this.hud?.setLoadout(this.loadout);
    this.explosionView.render(this.ctx.tuning.vfx.explosionDurationS);
    this.health.reset();
    this.registerPlayer();
    this.energy.set(this.energy.max);
    this.player.stamina.set(this.player.stamina.max);
    this.player.teleport(this.spawnPosition());
    this.previous = this.player.getState();
    this.state = 'playing';
    this.kills = 0;
    this.director.start(1, this.ctx.rng.fork('waves'));
    this.emitHealth();
    this.heldItem.reset(this.loadout.startHeld);
  }

  private applyMutator(): void {
    const mutator = this.mutator;
    if (!mutator) return;
    const { stat, value } = mutator.effect;
    const modifier = {
      stat,
      value,
      type: stat === 'ammoCapacity' ? 'flat' : 'mult',
      source: MUTATOR_SOURCE,
    } as const;
    this.player.stats.removeBySource(MUTATOR_SOURCE);
    this.playerStats.removeBySource(MUTATOR_SOURCE);
    this.manager.setSpawnModifiers(stat === 'moveSpeed' ? [modifier] : []);
    if (stat === 'gravityScale') this.player.stats.add(modifier);
    if (stat === 'ammoCapacity' || stat === 'arenaLightScale')
      this.playerStats.add(modifier);
    this.world.gravity.y = this.player.gravity;
    this.ammoRemaining =
      stat === 'ammoCapacity' ? this.playerStats.get('ammoCapacity') : null;
    this.buildSelect?.setBriefing(`${mutator.name}. ${mutator.description}`);
    this.updateMutatorHud();
  }

  private updateMutatorHud(): void {
    if (this.mutator)
      this.hud?.setArenaMutator(this.mutator.name, this.ammoRemaining);
  }

  /** „Jeszcze raz” z HUD (gest użytkownika): reset i wznowienie pętli z przechwyceniem myszy. */
  private retry(): void {
    this.reset();
    this.ctx.resume?.();
  }

  /**
   * Wybór z ekranu buildu (gest użytkownika, F2-17): nowy run od fali 1 z tym ekwipunkiem
   * i przechwycenie myszy. Zwraca false dla nieznanego id (stan bez zmian).
   */
  chooseLoadout(id: string, bladeId?: string): boolean {
    const selected = loadoutDefinitions.get(id);
    if (!selected) return false;
    if (bladeId !== undefined) this.bladeOverride = bladeId;
    this.setLoadout(selected);
    this.reset();
    this.ctx.resume?.();
    return true;
  }

  private setLoadout(loadout: Loadout): void {
    this.loadout = loadout;
    this.resolved = resolveLoadout(loadout, []);
  }

  /** Ostrze runu: nadpisanie (ekran buildu, `?blade=`) albo ostrze ekwipunku; reset stanu ostrza. */
  private applyBlade(): void {
    const next = withBladeOverride(this.resolved.blade, this.bladeOverride);
    if (next !== this.blade.definition) {
      this.blade.setDefinition(next);
      void this.fppView.setBladeDefinition(next);
    } else this.blade.reset();
  }

  /** Powrót do ekranu wyboru (HUD po śmierci, komenda `build`): czysta arena, fale stoją. */
  private openBuildSelect(): void {
    this.reset();
    this.enterBuildSelect();
  }

  private enterBuildSelect(): void {
    this.director.stop();
    this.state = 'select';
    if (typeof document !== 'undefined') document.exitPointerLock?.();
    this.buildSelect?.show();
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

  private registerCommands(playerId: EntityId): void {
    const register = (
      name: string,
      help: string,
      run: (args: string[]) => string,
    ): void => {
      const off = this.ctx.commands?.register(name, help, run);
      if (off) this.off.push(off);
    };
    if (this.id === ARENA_MUTATORS_SCENE)
      register(
        'mutator',
        'mutator [id|seed] — sprawdź lub zmień mutator',
        (args) => {
          const [id] = args;
          if (id === undefined) return this.mutator!.name;
          const next =
            id === 'seed'
              ? rollArenaMutator(this.ctx.rng)
              : arenaMutators.get(id);
          if (!next || args.length !== 1)
            return `Użycie: mutator [${[...arenaMutators.keys(), 'seed'].join('|')}]`;
          this.mutator = next;
          if (this.state === 'select') this.openBuildSelect();
          else this.reset();
          return next.name;
        },
      );
    register('tp', 'tp <x> <z> [yawDeg] [pitchDeg]', (args) => {
      const [x, z, yaw = 0, pitch = 0] = args.map(Number);
      if (
        args.length < 2 ||
        args.length > 4 ||
        ![x, z, yaw, pitch].every(Number.isFinite) ||
        Math.abs(x!) > 1e4 ||
        Math.abs(z!) > 1e4 ||
        Math.abs(yaw) > 1e6 ||
        Math.abs(pitch) > 1e6 ||
        !this.lookAtDegrees(yaw, pitch)
      )
        return 'Uzycie: tp <x> <z> [yawDeg] [pitchDeg]';
      this.player.teleport({
        ...this.player.getState().position,
        x: x!,
        z: z!,
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
    register('loadout', 'loadout <id> — reset areny z ekwipunkiem', (args) => {
      const selected = loadoutDefinitions.get(args[0] ?? '');
      if (args.length !== 1 || !selected)
        return `Dostępne ekwipunki: ${[...loadoutDefinitions.keys()].join(', ')}`;
      this.setLoadout(selected);
      this.reset();
      return `Ekwipunek: ${selected.name}`;
    });
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
    if (this.selectBuild)
      register('build', 'build — ekran wyboru buildu (reset areny)', () => {
        this.openBuildSelect();
        return 'Wybierz build.';
      });
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
    register('hit', 'hit <dmg> — wszystkim wrogom', (args) => {
      const amount = Number(args[0]);
      return Number.isFinite(amount) && amount >= 0
        ? hitAll(amount)
        : 'Podaj obrażenia.';
    });
    register('kill all', 'kill all', () => hitAll(Number.MAX_VALUE));
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
    if (name === 'executable') return this.execute.readyIds();
    switch (name) {
      case 'mutator':
        return (
          this.mutator && {
            ...this.mutator,
            gravity: this.world.gravity.y,
            lightScale: this.playerStats.get('arenaLightScale'),
            ammo: this.ammoRemaining,
          }
        );
      case 'wave':
        return this.director.wave;
      case 'phase':
        return this.director.currentPhase;
      case 'enemies':
        return this.aliveEnemies();
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
      case 'buildSelect':
        return this.buildSelect?.visible ?? false;
      case 'kills':
        return this.kills;
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
    for (const off of this.off.splice(0)) off();
    this.hud?.dispose();
    this.inventory?.dispose();
    this.buildSelect?.dispose();
    this.synergies?.dispose();
    this.powers?.reset();
    this.beamView?.dispose();
    this.lightningView?.dispose();
    this.explosionView?.dispose();
    this.shatter?.dispose();
    this.debrisView?.dispose();
    this.statusVfx?.dispose();
    this.statusView?.dispose();
    this.hitSparks?.dispose();
    this.hitSparksView?.dispose();
    for (const view of this.views.values()) view.dispose();
    this.views.clear();
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
    this.fpsCamera?.dispose();
    this.player?.dispose();
    this.world?.free();
    for (const g of this.geometries) g.dispose();
    this.geometries.clear();
    this.dressing?.dispose();
    this.root.removeFromParent();
    this.root.clear();
    this.atmosphere?.dispose();
  }
}
