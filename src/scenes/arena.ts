import { BoxGeometry, Color, Euler, Group, Mesh, Quaternion } from 'three';
import type { BufferGeometry, Material, Scene as ThreeScene } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { World } from '@dimforge/rapier3d-compat';
import { z } from 'zod';
import type { GameContext } from '../core/context';
import { EntityRegistry } from '../core/entities';
import type { EntityId } from '../core/events';
import type { InputSnapshot } from '../core/input';
import type { Vec3 } from '../core/math';
import { loadSettings } from '../core/save';
import { Stats } from '../core/stats';
import {
  DamageSystem,
  Health,
  Hurtboxes,
  queryHurtboxes,
} from '../combat/damage';
import { plasmaBladeDefinition } from '../combat/melee/bladeSchema';
import { PlasmaBlade } from '../combat/melee/plasmaBlade';
import { PlayerEnergy } from '../combat/powers/energy';
import { pushDefinition, ResonancePush } from '../combat/powers/push';
import { Blaster } from '../combat/weapons/blaster';
import { ProjectileSystem } from '../combat/weapons/projectiles';
import sceneData from '../data/scenes/arena.json';
import wavesData from '../data/waves/arena.json';
import { StatusSystem } from '../combat/status';
import { directorConfigSchema } from '../enemies/director';
import { EnemyManager } from '../enemies/manager';
import { createEnemyView } from '../enemies/views';
import type { EnemyViewLike } from '../enemies/views';
import { availableEnemyIds, enemyRegistry } from '../enemies/registry';
import type { Enemy } from '../enemies/types';
import { CollisionGroup, initPhysics, interactionGroups } from '../physics';
import { FpsCamera } from '../player/fpsCamera';
import { PlayerController } from '../player/playerController';
import type { PlayerState } from '../player/playerController';
import { FppBlade } from '../render/fppBlade';
import { FppBlaster } from '../render/fppBlaster';
import { createStyleLights } from '../render/lights';
import { applyStyle, getMaterial } from '../render/materials';
import { ProjectileRenderer } from '../render/projectileRenderer';
import { Hud } from '../ui/hud';
import { DebrisSystem } from '../vfx/debris';
import { DebrisRenderer } from '../vfx/debrisRenderer';
import { EnemyShatter } from '../vfx/enemyShatter';
import { loadWaves, WaveDirector } from '../world/waves';
import type { Scene } from './index';

const vec3 = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
});
const layout = z
  .object({
    playerHealth: z.number().positive(),
    playerSpawn: vec3,
    blocks: z.array(
      z.object({ size: vec3, position: vec3, model: z.string().optional() }),
    ),
    director: directorConfigSchema.optional(),
  })
  .parse(sceneData);
const waves = loadWaves(wavesData);

/** Modele dla bloków układu; 'wall' to rozciągnięta bryła świata (bez modelu). */
const MODEL_FILES: Record<string, string> = {
  pillar: 'pillar',
  cover_low: 'cover_low',
  crate: 'crate',
  crate_small: 'crate_small',
};

type ArenaState = 'playing' | 'dead';

/**
 * Arena z falami (F1 #16) — pierwsza pełna pętla walki: gracz z ostrzem (combo, ciężki, blok,
 * parowanie), Pchnięciem Rezonansu i blasterem przeciw falom Szturmowców i Strzelców
 * z danych (src/data/waves/arena.json). Ten sam ?seed= daje ten sam przebieg fal.
 */
export class Arena implements Scene {
  readonly id = 'arena';
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
  private push!: ResonancePush;
  private blaster!: Blaster;
  private readonly playerStats = new Stats({
    maxHealth: layout.playerHealth,
    maxEnergy: 100,
    energyRegen: 25,
    heatCapacity: 100,
    coolingRate: 45,
  });
  private readonly health = new Health(() => this.playerStats.get('maxHealth'));
  private readonly bladeView = new FppBlade();
  private blasterView!: FppBlaster;
  private readonly views = new Map<EntityId, EnemyViewLike>();
  private readonly root = new Group();
  private readonly lights = createStyleLights();
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

  constructor(private readonly loadModels = true) {}

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
      layout.director ? { director: layout.director } : {},
    );

    if (typeof document !== 'undefined')
      this.hud = new Hud(ctx.bus, { playerId, onRetry: () => this.retry() });
    this.energy = new PlayerEnergy(
      playerId,
      this.playerStats,
      ctx.bus,
      ctx.tuning,
    );
    this.blade = new PlasmaBlade(
      plasmaBladeDefinition,
      {
        owner: playerId,
        team: 'player',
        damage: this.damage,
        stats: this.playerStats,
        energy: this.energy.pool,
        queryArc: (reach, width) => this.queryArc(reach, width),
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
    this.push = new ResonancePush(
      pushDefinition,
      {
        owner: playerId,
        damage: this.damage,
        energy: this.energy,
        aim: () => this.aim(),
        targets: () => {
          const list: { id: EntityId; position: Vec3 }[] = [];
          this.manager.forEach((e) => {
            if (e.current.state !== 'dead')
              list.push({
                id: e.id,
                position: {
                  ...e.current.position,
                  y: e.current.position.y + 1.1,
                },
              });
          });
          return list;
        },
        castWall: (origin, dir, max) => this.castWall(origin, dir, max),
      },
      ctx.bus,
      ctx.tuning,
    );
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
    this.blaster = new Blaster(
      playerId,
      ctx,
      this.playerStats,
      this.projectiles,
    );

    await this.bladeView.load(this.loadModels);
    this.root.add(this.bladeView.root);
    this.blasterView = new FppBlaster(ctx.bus, playerId);
    await this.blasterView.load(this.loadModels);
    this.root.add(this.blasterView.root);

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
    this.world.step();
    this.director.start();
    this.render(1);
  }

  // ----------------------------------------------------------------- budowa

  private async buildLayout(): Promise<void> {
    const loader = new GLTFLoader();
    await Promise.all(
      layout.blocks.map(async ({ size, position, model }) => {
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
          const { scene } = await loader.loadAsync(
            `/assets/models/${file}.glb`,
          );
          const materials = new Set<Material>();
          scene.traverse((node) => {
            if (!(node instanceof Mesh)) return;
            this.geometries.add(node.geometry);
            for (const m of Array.isArray(node.material)
              ? node.material
              : [node.material])
              materials.add(m);
          });
          applyStyle(scene);
          for (const m of materials) m.dispose();
          scene.position.set(position.x, position.y - size.y / 2, position.z);
          this.root.remove(fallback);
          this.root.add(scene);
        } catch {
          // Bryła zastępcza zostaje (ten sam collider).
        }
      }),
    );
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
      stats: this.playerStats,
      invulnMs: () => this.ctx.tuning.damage.playerInvulnMs,
      invulnerable: () => this.player.isInvulnerable(),
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

  private queryArc(reach: number, width: number) {
    const { origin, dir } = this.aim();
    const s = this.player.getState();
    this.tmpEuler.set(s.pitch, s.yaw, 0, 'YXZ');
    this.tmpQuat.setFromEuler(this.tmpEuler);
    return queryHurtboxes(
      this.world,
      this.hurtboxes,
      new this.rapier.Cuboid(width / 2, 0.6, reach / 2),
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
      interactionGroups(CollisionGroup.Player, CollisionGroup.Enemy),
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
      if (dt > 0) this.deadS += dt;
      this.manager.step(dt);
      return;
    }
    // F2-06: gracz, ostrze, moce, broń i energia w czasie gracza (Skupienie), reszta w czasie świata.
    const pdt = this.ctx.feel?.playerDt(dt) ?? dt;
    this.player.step(pdt, input);
    this.blade.step(pdt, input);
    this.push.step(pdt, input);
    if (!(dt > 0)) {
      this.manager.step(dt);
      return;
    }
    this.energy.step(pdt);
    this.damage.step(dt);
    this.statuses.step(dt);
    this.projectileView.capturePrevious();
    this.debris.step(dt);
    this.blaster.step(pdt, {
      ...this.aim(),
      triggerHeld: input.held.has('shoot'),
    });
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
    this.lights.sync();
    const camera = this.ctx.camera;
    if (!camera) return;
    const pose = this.fpsCamera.update(
      frameDt,
      this.previous,
      this.player.getState(),
      alpha,
    );
    camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    camera.rotation.set(pose.pitch, pose.yaw, pose.roll, 'YXZ');
    if (Math.abs(camera.fov - pose.fov) > 1e-3) {
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    this.bladeView.root.visible = this.state === 'playing';
    this.bladeView.place(camera.matrixWorld, this.blade.view());
    this.blasterView.root.visible = this.state === 'playing';
    this.blasterView.place(camera.matrixWorld, frameDt);
  }

  // ----------------------------------------------------------------- śmierć i reset

  private onPlayerDied(): void {
    this.state = 'dead';
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
    this.statuses.reset();
    this.projectiles.dispose();
    this.projectileView.capturePrevious();
    this.debris.clear();
    this.blaster.reset();
    this.blade.reset();
    this.push.reset();
    this.health.reset();
    this.registerPlayer();
    this.energy.set(this.energy.max);
    this.player.teleport(this.spawnPosition());
    this.previous = this.player.getState();
    this.state = 'playing';
    this.kills = 0;
    this.director.start(1, this.ctx.rng.fork('waves'));
    this.emitHealth();
  }

  /** „Jeszcze raz” z HUD (gest użytkownika): reset i wznowienie pętli z przechwyceniem myszy. */
  private retry(): void {
    this.reset();
    this.ctx.resume?.();
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
    this.ctx.bus.emit('heat_changed', {
      id: this.player.id,
      current: this.blaster.heat.current,
      max: this.blaster.heat.max,
      overheated: this.blaster.overheated,
    });
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
      case 'energy':
        return this.energy.current;
      case 'heat':
        return this.blaster.heat.current;
      case 'dead':
        return this.state === 'dead';
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
    for (const off of this.off.splice(0)) off();
    this.hud?.dispose();
    this.shatter.dispose();
    this.debrisView.dispose();
    for (const view of this.views.values()) view.dispose();
    this.views.clear();
    this.director.dispose();
    this.manager.dispose();
    this.statuses.dispose();
    this.blade.dispose();
    this.energy.dispose();
    this.bladeView.dispose();
    this.blasterView.dispose();
    this.projectileView.dispose();
    this.projectiles.dispose();
    this.fpsCamera.dispose();
    this.player.dispose();
    this.world.free();
    for (const g of this.geometries) g.dispose();
    this.geometries.clear();
    this.root.removeFromParent();
    this.root.clear();
    this.three.background = null;
  }
}
