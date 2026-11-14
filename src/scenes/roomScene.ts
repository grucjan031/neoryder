import { FppViewModel } from '../render/fppViewModel';
import {
  queryBladeArc,
  queryBladeSegment,
  queryBladeSpin,
} from '../combat/melee/bladeQueries';
import { FlyingBlade } from '../render/flyingBlade';
import {
  BoxGeometry,
  Color,
  Euler,
  Group,
  Mesh,
  Quaternion,
} from 'three';
import type { BufferGeometry, Scene as ThreeScene } from 'three';
import type { Collider, World } from '@dimforge/rapier3d-compat';
import { z } from 'zod';
import type { GameContext } from '../core/context';
import { EntityRegistry } from '../core/entities';
import type { EntityId } from '../core/events';
import type { InputSnapshot } from '../core/input';
import type { Vec3 } from '../core/math';
import { loadSettings } from '../core/save';
import { Stats } from '../core/stats';
import { DamageSystem, Health, Hurtboxes } from '../combat/damage';
import { resolveBlade } from '../combat/melee/bladeSchema';
import type { HitShape } from '../combat/melee/bladeSchema';
import { PlasmaBlade } from '../combat/melee/plasmaBlade';
import { HeldItem } from '../combat/heldItem';
import type { HeldItemView } from '../combat/heldItem';
import { PlayerEnergy } from '../combat/powers/energy';
import { createPower } from '../combat/powers/registry';
import { PowerSlots } from '../combat/powers/slots';
import { Weapon } from '../combat/weapons/weapon';
import {
  weaponDefinitions,
  weaponModelOf,
} from '../combat/weapons/weaponSchema';
import { ProjectileSystem } from '../combat/weapons/projectiles';
import playerData from '../data/scenes/roomPlayer.json';
import type { RunState, MapNode } from '../core/runTypes';
import type { RoomDefinition } from '../world/roomSchema';
import type { WavesDefinition } from '../world/waves';
import {
  implantDefinitions,
  ImplantSystem,
  type ImplantDefinition,
} from '../progression/implants';
import { cloneRoomModel } from './roomModels';
import { statusDefinitions, StatusSystem } from '../combat/status';
import { EnemyManager } from '../enemies/manager';
import { createEnemyView } from '../enemies/views';
import type { EnemyViewLike } from '../enemies/views';
import { availableEnemyIds, enemyRegistry } from '../enemies/registry';
import type { Enemy } from '../enemies/types';
import { CollisionGroup, initPhysics, interactionGroups } from '../physics';
import { FpsCamera } from '../player/fpsCamera';
import { PlayerController } from '../player/playerController';
import type { PlayerState } from '../player/playerController';
import { BeamRenderer } from '../render/beamRenderer';
import { BarrierRenderer } from '../render/barrierRenderer';
import { LightningRenderer } from '../render/lightningRenderer';
import { BarrierPower } from '../combat/powers/barrier';
import { ExplosionRenderer } from '../render/explosionRenderer';
import { loadoutDefinitions } from '../progression/loadout';
import type { Loadout } from '../progression/loadout';
import { SynergySystem } from '../progression/synergies';
import { createStyleLights } from '../render/lights';
import { getMaterial } from '../render/materials';
import { ProjectileRenderer } from '../render/projectileRenderer';
import { Hud } from '../ui/hud';
import { DebrisSystem } from '../vfx/debris';
import { DebrisRenderer } from '../vfx/debrisRenderer';
import { EnemyShatter } from '../vfx/enemyShatter';
import { enemyBody } from '../vfx/enemyBody';
import { HitSparks } from '../vfx/hitSparks';
import { HitSparksRenderer, StatusVfxRenderer } from '../vfx/fxRenderer';
import { StatusVfx } from '../vfx/statusVfx';
import { WaveDirector } from '../world/waves';
import type { Scene } from './index';

const playerDefaults = z
  .object({
    maxHealth: z.number().positive(),
    maxEnergy: z.number().positive(),
    energyRegen: z.number().nonnegative(),
    heatCapacity: z.number().positive(),
    coolingRate: z.number().nonnegative(),
  })
  .parse(playerData);

export interface RoomSceneOptions {
  loadModels?: boolean;
  implantDefinitions?: ReadonlyMap<string, ImplantDefinition>;
}

/** Modele dla bloków układu; 'wall' to rozciągnięta bryła świata (bez modelu). */
const MODEL_FILES: Record<string, string> = {
  pillar: 'pillar',
  cover_low: 'cover_low',
  crate: 'crate',
  crate_small: 'crate_small',
};

/** Jeden pokój runu: osobny świat i skład walki zgodny z Areną. */
export class RoomScene implements Scene {
  readonly id: string = 'room';
  private ctx!: GameContext;
  private three!: ThreeScene;
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
  private heldItem!: HeldItem;
  private readonly flyingBlade = new FlyingBlade();
  private powers!: PowerSlots;
  private readonly loadout: Loadout;
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
  private readonly root = new Group();
  private readonly lights = createStyleLights();
  private readonly geometries = new Set<BufferGeometry>();
  private readonly off: (() => void)[] = [];
  private readonly tmpEuler = new Euler(0, 0, 0, 'YXZ');
  private readonly tmpQuat = new Quaternion();
  private state: 'playing' | 'dead' = 'playing';
  private elapsedS = 0;
  private cleared = false;
  private disposed = false;
  private readonly node: MapNode;
  private readonly implantDefs: ReadonlyMap<string, ImplantDefinition>;
  private readonly initialImplantIds: string[];
  private implantSystem!: ImplantSystem;
  private readonly loadModels: boolean;
  private readonly doors = new Map<
    string,
    { role: 'entry' | 'exit'; mesh: Mesh; collider: Collider }
  >();
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

  constructor(
    private readonly layout: RoomDefinition,
    private readonly run: RunState,
    private readonly waves: WavesDefinition,
    options: RoomSceneOptions = {},
  ) {
    const node = run.map.layers
      .flat()
      .find((node) => node.id === run.currentNodeId);
    if (!node)
      throw new Error('RoomScene wymaga bieżącego węzła w mapie runu.');
    this.node = { ...node, next: [...node.next] };
    const loadout = loadoutDefinitions.get(run.loadoutId);
    if (!loadout) throw new Error(`Nieznany ekwipunek: ${run.loadoutId}`);
    this.loadout = loadout;
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
    this.three = three;
    this.rapier = await initPhysics();
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
    three.background = new Color(ctx.tuning.render.world);
    three.add(this.root);
    this.root.add(this.lights);
    await this.buildLayout();

    const playerId = this.entities.create('player', 'player');
    this.player = new PlayerController(
      playerId,
      this.world,
      ctx,
      this.spawnPosition(),
      loadSettings(),
    );
    this.applyImplants();
    this.health.set(this.run.hp);
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
    this.explosionView = new ExplosionRenderer(ctx.bus);
    this.root.add(this.beamView.root, this.explosionView.root);
    this.barrierView = new BarrierRenderer(ctx.tuning);
    this.root.add(this.barrierView.root);
    this.lightningView = new LightningRenderer(ctx.tuning);
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
          this.health.dead
            ? null
            : { id: playerId, position: this.player.getState().position },
      },
      this.layout.director ? { director: this.layout.director } : {},
    );

    if (typeof document !== 'undefined')
      this.hud = new Hud(ctx.bus, {
        playerId,
        loadout: this.loadout,
        totalWaves: this.waves.waves.length,
        run: { credits: this.run.credits, implants: this.run.implants },
      });
    this.energy = new PlayerEnergy(
      playerId,
      this.playerStats,
      ctx.bus,
      ctx.tuning,
    );
    this.energy.set(this.run.energy);
    this.root.add(this.flyingBlade.root);
    this.blade = new PlasmaBlade(
      resolveBlade(this.loadout.blade),
      {
        owner: playerId,
        team: 'player',
        damage: this.damage,
        stats: this.playerStats,
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
    this.root.add(this.fppView.root);

    // F2-17: hybrydy z tagów ekwipunku. Statystyki dashu i ruchu żyją w PlayerController.stats.
    this.synergies = new SynergySystem(ctx.bus, {
      user: playerId,
      addEnergy: (n) => this.energy.add(n),
      coolWeapon: (amount) => this.weapon.vent(amount),
      stats: this.player.stats,
      damage: this.damage,
      statuses: this.statuses,
      targets: () => this.enemyIds(),
      position: (id) => this.enemyPosition(id),
    });
    this.synergies.setTags([
      ...this.loadout.tags,
      ...this.implantSystem.tags(),
    ]);

    this.director = new WaveDirector(
      this.waves,
      {
        spawn: (enemy, position) => this.spawnEnemy(enemy, position),
        playerPosition: () => this.player.getState().position,
      },
      ctx.bus,
      ctx.rng.fork('waves'),
    );
    this.off.push(
      ctx.bus.on('wave_cleared', ({ wave }) => {
        if (wave === this.director.totalWaves) this.completeRoom();
      }),
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
    ctx.bus.emit('room_entered', {
      nodeId: this.node.id,
      roomId: this.layout.id,
      type: this.node.type,
      layer: this.node.layer,
    });
    this.director.start();
    if (this.health.dead) this.onPlayerDied();
    this.render(1);
  }

  // ----------------------------------------------------------------- budowa

  private async buildLayout(): Promise<void> {
    await Promise.all(
      this.layout.blocks.map(async ({ size, position, model }) => {
        this.world.createCollider(
          this.rapier.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
            .setTranslation(position.x, position.y, position.z)
            .setCollisionGroups(
              interactionGroups(CollisionGroup.World, 0xffff),
            ),
        );
        const geometry = new BoxGeometry(size.x, size.y, size.z);
        this.geometries.add(geometry);
        const material = model?.startsWith('crate') ? 'interactive' : 'world';
        const fallback = new Mesh(geometry, getMaterial(material));
        fallback.position.set(position.x, position.y, position.z);
        this.root.add(fallback);
        const file = model ? MODEL_FILES[model] : undefined;
        if (!file || !this.loadModels) return;
        try {
          const scene = await cloneRoomModel(file);
          if (!scene) return;
          scene.position.set(position.x, position.y - size.y / 2, position.z);
          this.root.remove(fallback);
          this.root.add(scene);
        } catch {
          // Bryła zastępcza zostaje (ten sam collider).
        }
      }),
    );
    for (const door of this.layout.doors) {
      const { size, position } = door;
      const geometry = new BoxGeometry(size.x, size.y, size.z);
      this.geometries.add(geometry);
      const mesh = new Mesh(geometry, getMaterial('interactive'));
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

  private applyImplants(): void {
    this.implantSystem = new ImplantSystem(
      [this.playerStats, this.player.stats],
      {
        health: this.health,
        bus: this.ctx.bus,
        definitions: this.implantDefs,
        onChange: () => {
          if (!this.synergies) return;
          this.synergies.setTags([
            ...this.loadout.tags,
            ...this.implantSystem.tags(),
          ]);
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

  private spawnPosition(): Vec3 {
    const t = this.ctx.tuning.player;
    return {
      x: this.layout.playerSpawn.x,
      y: this.layout.playerSpawn.y + t.capsuleHeight / 2 + t.controllerOffset,
      z: this.layout.playerSpawn.z,
    };
  }

  private registerPlayer(): void {
    this.damage.register(this.player.id, this.health, {
      stats: this.playerStats,
      invulnMs: () => this.ctx.tuning.damage.playerInvulnMs,
      invulnerable: () => this.player.isInvulnerable(),
    });
  }

  private spawnEnemy(kind: string, position: Vec3): EntityId | null {
    if (
      this.aliveEnemies() >=
      Math.min(this.waves.maxAlive, this.layout.maxAlive ?? this.waves.maxAlive)
    )
      return null;
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
      this.loadout.powers.map((id) =>
        createPower(id, {
          owner: this.player.id,
          bus: this.ctx.bus,
          tuning: this.ctx.tuning,
          damage: this.damage,
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
    this.weapons = this.loadout.weapons.map(
      (id) =>
        new Weapon(
          this.player.id,
          this.ctx,
          this.playerStats,
          {
            projectiles: this.projectiles,
            damage: this.damage,
            castBeam: (origin, dir, rangeM) =>
              this.castBeam(origin, dir, rangeM),
          },
          weaponDefinitions.get(id)!,
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
    this.previous = this.player.getState();
    if (this.state === 'dead') {
      this.manager.step(dt);
      return;
    }
    if (dt > 0 && !this.cleared) this.elapsedS += dt;
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
    this.player.step(pdt, input);
    const bladeState = this.blade.view().state;
    const { bladeInput, triggerHeld } = this.heldItem.step(pdt, input, {
      bladeBusy: bladeState !== 'idle' && bladeState !== 'throwing',
    });
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
    this.projectileView.capturePrevious();
    this.debris.step(dt);
    for (const weapon of this.weapons) {
      if (weapon === this.weapon && this.heldItem.held === 'gun')
        weapon.step(pdt, {
          ...this.aim(),
          triggerHeld,
        });
      else weapon.cool(pdt);
    }
    this.director.step(dt);
    this.manager.step(dt);
    this.world.gravity.y = this.ctx.tuning.physics.gravity;
    this.world.timestep = dt;
    this.world.step();
    this.projectiles.step(dt);
  }

  render(alpha: number, frameDt = 1 / 60): void {
    const ids = new Set<EntityId>();
    this.manager.forEach((enemy) => {
      ids.add(enemy.id);
      let view = this.views.get(enemy.id);
      if (!view) {
        view = createEnemyView(enemy, this.loadModels);
        this.views.set(enemy.id, view);
        this.root.add(view.root);
      }
      view.render(alpha);
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
    this.lights.sync();
    this.flyingBlade.render(this.blade.view(), alpha, this.ctx.tuning);
    this.flyingBlade.root.visible &&= this.state === 'playing';
    const camera = this.ctx.camera;
    const powers = [this.powers.get(0), this.powers.get(1)];
    if (!camera) {
      this.beamView.render(this.weapon.beam);
      this.lightningView.render(powers);
      return;
    }
    const pose = this.fpsCamera.update(
      frameDt,
      this.previous,
      this.player.getState(),
      alpha,
    );
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    const barriers = powers.filter(
      (power): power is BarrierPower => power instanceof BarrierPower,
    );
    const barrier = barriers.find((power) => power.active) ?? barriers[0];
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
    const velocity = this.player.getState().velocity;
    this.fppView.place(camera.matrixWorld, frameDt, {
      blade: this.blade.view(),
      held: this.heldView(),
      horizontalSpeed: Math.hypot(velocity.x, velocity.z),
      visible: this.state === 'playing',
    });
    this.beamView.render(this.weapon.beam, this.fppView.beamOrigin);
    this.lightningView.render(powers, camera);
  }

  // ----------------------------------------------------------------- śmierć i reset

  private onPlayerDied(): void {
    this.state = 'dead';
    // Aktywne moce (Skupienie, Bariera) kończą się ze śmiercią, nie dopiero przy „Jeszcze raz”.
    this.powers.reset();
    this.weapon.cool(0);
    this.director.stop();
    if (typeof document !== 'undefined') document.exitPointerLock?.();
  }

  exportState(): Pick<RunState, 'hp' | 'energy'> {
    return { hp: this.health.current, energy: this.energy.current };
  }

  /** API hosta runu i komendy room-test; bez restartowania ani leczenia gracza. */
  clear(): void {
    if (this.cleared || this.state === 'dead' || this.disposed) return;
    this.director.stop();
    this.manager.despawnAll();
    this.statuses.reset();
    this.projectiles.dispose();
    this.completeRoom();
  }

  private completeRoom(): void {
    if (this.cleared || this.state === 'dead' || this.disposed) return;
    this.cleared = true;
    for (const door of this.doors.values())
      if (door.role === 'exit') {
        door.collider.setEnabled(false);
        door.mesh.visible = false;
      }
    this.ctx.bus.emit('room_cleared', {
      nodeId: this.node.id,
      type: this.node.type,
      timeS: this.elapsedS,
    });
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
    switch (name) {
      case 'wave':
        return this.director.wave;
      case 'phase':
        return this.director.currentPhase;
      case 'enemies':
        return this.aliveEnemies();
      case 'enemyDirector':
        return this.manager.director?.snapshot() ?? null;
      case 'playerPos':
        return { ...this.player.getState().position };
      case 'playerHp':
        return this.health.current;
      case 'playerMaxHp':
        return this.health.max;
      case 'implants':
        return this.implantSystem.ids();
      case 'energy':
        return this.energy.current;
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
    this.synergies.dispose();
    this.powers.reset();
    this.beamView.dispose();
    this.lightningView.dispose();
    this.explosionView.dispose();
    this.shatter.dispose();
    this.debrisView.dispose();
    this.statusVfx.dispose();
    this.statusView.dispose();
    this.hitSparks.dispose();
    this.hitSparksView.dispose();
    for (const view of this.views.values()) view.dispose();
    this.views.clear();
    this.director.dispose();
    this.manager.dispose();
    this.statuses.dispose();
    this.blade.dispose();
    this.heldItem.dispose();
    this.energy.dispose();
    this.fppView.dispose();
    this.flyingBlade.dispose();
    this.barrierView.dispose();
    this.projectileView.dispose();
    this.projectiles.dispose();
    this.fpsCamera.dispose();
    this.player.dispose();
    this.world.free();
    this.doors.clear();
    for (const g of this.geometries) g.dispose();
    this.geometries.clear();
    this.root.removeFromParent();
    this.root.clear();
    this.three.background = null;
  }
}
