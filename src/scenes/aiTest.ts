import { BoxGeometry, Color, Group, Mesh } from 'three';
import type { Material, Scene as ThreeScene } from 'three';
import type { World } from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { z } from 'zod';
import { ProjectileSystem } from '../combat/weapons/projectiles';
import { ProjectileRenderer } from '../render/projectileRenderer';
import { DamageSystem, Health, Hurtboxes } from '../combat/damage';
import type { GameContext } from '../core/context';
import { EntityRegistry } from '../core/entities';
import type { InputSnapshot } from '../core/input';
import { loadSettings } from '../core/save';
import { Stats } from '../core/stats';
import sceneData from '../data/scenes/aiTest.json';
import { EnemyManager } from '../enemies/manager';
import { EnemyView } from '../enemies/enemyView';
import { availableEnemyIds, enemyRegistry } from '../enemies/registry';
import { CollisionGroup, initPhysics, interactionGroups } from '../physics';
import { FpsCamera } from '../player/fpsCamera';
import { PlayerController } from '../player/playerController';
import type { PlayerState } from '../player/playerController';
import { createStyleLights } from '../render/lights';
import { applyStyle, getMaterial } from '../render/materials';
import type { Scene } from './index';

const vec3 = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
});
const data = z
  .object({
    playerHealth: z.number().positive(),
    respawnS: z.number().positive(),
    spawnDistance: z.number().positive(),
    spawnSpacing: z.number().positive(),
    initialEnemies: z.array(z.object({ id: z.string(), position: vec3 })),
    arena: z.array(
      z.object({ size: vec3, position: vec3, model: z.string().optional() }),
    ),
  })
  .parse(sceneData);

export class AiTest implements Scene {
  readonly id = 'ai-test';
  private ctx!: GameContext;
  private three!: ThreeScene;
  private world!: World;
  private entities!: EntityRegistry;
  private damage!: DamageSystem;
  private manager!: EnemyManager;
  private projectiles!: ProjectileSystem;
  private projectileRenderer!: ProjectileRenderer;
  private player!: PlayerController;
  private previous!: PlayerState;
  private camera!: FpsCamera;
  private health!: Health;
  private readonly hurtboxes = new Hurtboxes();
  private readonly root = new Group();
  private readonly lights = createStyleLights();
  private readonly views = new Map<number, EnemyView>();
  private readonly geometries = new Set<import('three').BufferGeometry>();
  private readonly off: (() => void)[] = [];
  private label?: HTMLParagraphElement;
  private respawnS: number | null = null;
  private god = false;
  private readonly stats = new Stats({ maxHealth: data.playerHealth });

  constructor(private readonly loadModels = true) {}

  async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    this.ctx = ctx;
    this.three = three;
    const rapier = await initPhysics();
    this.world = new rapier.World({
      x: 0,
      y: ctx.tuning.physics.gravity,
      z: 0,
    });
    this.entities = new EntityRegistry(ctx.bus);
    this.damage = new DamageSystem(ctx.bus, this.entities);
    const id = this.entities.create('player', 'player');
    this.player = new PlayerController(
      id,
      this.world,
      ctx,
      this.spawnPosition(),
      loadSettings(),
    );
    this.health = new Health(() => this.stats.get('maxHealth'));
    this.registerPlayer();
    this.hurtboxes.add(id, this.player.colliderHandle);
    this.entities.bindCollider(id, this.player.colliderHandle);
    this.previous = this.player.getState();
    this.camera = new FpsCamera(ctx.tuning, id, ctx.bus);
    this.projectiles = new ProjectileSystem(
      this.world,
      this.entities,
      this.hurtboxes,
      this.damage,
      ctx.bus,
      ctx.tuning,
    );
    this.projectileRenderer = new ProjectileRenderer(
      this.projectiles,
      ctx.tuning.weapons.maxProjectiles,
      this.loadModels,
    );
    this.root.add(this.projectileRenderer.root);
    this.manager = new EnemyManager(ctx, {
      projectiles: this.projectiles,
      world: this.world,
      entities: this.entities,
      damage: this.damage,
      hurtboxes: this.hurtboxes,
      getTarget: () =>
        this.health.dead
          ? null
          : { id, position: this.player.getState().position },
    });
    three.background = new Color(ctx.tuning.render.world);
    three.add(this.root);
    this.root.add(this.lights);
    await Promise.all(
      data.arena.map(async ({ size, position, model }) => {
        this.world.createCollider(
          rapier.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
            .setTranslation(position.x, position.y, position.z)
            .setCollisionGroups(
              interactionGroups(CollisionGroup.World, 0xffff),
            ),
        );
        const geometry = new BoxGeometry(size.x, size.y, size.z);
        this.geometries.add(geometry);
        const fallback = new Mesh(geometry, getMaterial('world'));
        fallback.position.copy(position);
        this.root.add(fallback);
        if (!model || !this.loadModels) return;
        try {
          const { scene } = await new GLTFLoader().loadAsync(
            `/assets/models/${model}.glb`,
          );
          const materials = new Set<Material>();
          scene.traverse((node) => {
            if (!(node instanceof Mesh)) return;
            this.geometries.add(node.geometry);
            for (const material of Array.isArray(node.material)
              ? node.material
              : [node.material])
              materials.add(material);
          });
          applyStyle(scene);
          for (const material of materials) material.dispose();
          scene.position.set(position.x, position.y - size.y / 2, position.z);
          this.root.remove(fallback);
          this.root.add(scene);
        } catch {
          /* Osłona zachowuje geometrię zastępczą i collider. */
        }
      }),
    );
    if (typeof document !== 'undefined') {
      this.label = document.createElement('p');
      this.label.setAttribute('aria-label', 'Zdrowie gracza');
      this.label.style.cssText =
        'position:absolute;top:48px;left:20px;color:#00e5ff;pointer-events:none';
      document.body.append(this.label);
    }
    this.off.push(
      ctx.bus.on('health_changed', ({ id: target }) => {
        if (target === id) this.updateLabel();
      }),
      ctx.bus.on('player_died', ({ id: target }) => {
        if (target === id) this.respawnS = data.respawnS;
      }),
    );
    const register = (
      name: string,
      help: string,
      run: (args: string[]) => string,
    ): void => {
      const off = ctx.commands?.register(name, help, run);
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
          args.length > 2 ||
          !Number.isSafeInteger(n) ||
          n < 1 ||
          n > ctx.tuning.physics.maxDynamicBodies
        )
          return 'Podaj znany archetyp i poprawną liczbę wrogów.';
        const { position, yaw } = this.player.getState();
        for (let i = 0; i < n; i++) {
          const offset = (i - (n - 1) / 2) * data.spawnSpacing;
          this.manager.spawn(kind, {
            x:
              position.x -
              Math.sin(yaw) * data.spawnDistance +
              Math.cos(yaw) * offset,
            y: position.y - ctx.tuning.player.capsuleHeight / 2,
            z:
              position.z -
              Math.cos(yaw) * data.spawnDistance -
              Math.sin(yaw) * offset,
          });
        }
        return `Utworzono: ${n}`;
      },
    );
    const hit = (amount: number): string => {
      this.manager.forEach((enemy) =>
        this.damage.deal(enemy.id, { source: id, amount, tags: ['#debug'] }),
      );
      return 'Obrażenia zadane.';
    };
    register('hit', 'hit <dmg>', (args) => {
      const amount = Number(args[0]);
      return args.length === 1 && Number.isFinite(amount) && amount >= 0
        ? hit(amount)
        : 'Podaj skończone, nieujemne obrażenia.';
    });
    register('kill all', 'kill all', () => hit(Number.MAX_VALUE));
    register('god', 'god — nieśmiertelność gracza', () => {
      this.god = !this.god;
      this.stats.removeBySource('debug:god');
      if (this.god)
        this.stats.add({
          stat: 'damageTaken',
          type: 'mult',
          value: 0,
          source: 'debug:god',
        });
      return `Nieśmiertelność: ${this.god ? 'włączona' : 'wyłączona'}`;
    });
    this.spawnInitial();
    this.world.step();
    this.updateLabel();
    this.render(1);
  }

  private spawnPosition() {
    return {
      x: 0,
      y:
        this.ctx.tuning.player.capsuleHeight / 2 +
        this.ctx.tuning.player.controllerOffset,
      z: 0,
    };
  }
  private registerPlayer(): void {
    this.damage.register(this.player.id, this.health, {
      stats: this.stats,
      invulnMs: () => this.ctx.tuning.damage.playerInvulnMs,
    });
  }
  private spawnInitial(): void {
    for (const { id, position } of data.initialEnemies)
      this.manager.spawn(id, position);
  }
  private updateLabel(): void {
    if (this.label)
      this.label.textContent = `Gracz: ${this.health.current} / ${this.health.max} HP`;
  }

  reset(): void {
    this.manager.despawnAll();
    this.projectiles.dispose();
    this.projectileRenderer.capturePrevious();
    this.health.reset();
    this.registerPlayer();
    this.player.teleport(this.spawnPosition());
    this.previous = this.player.getState();
    this.respawnS = null;
    this.spawnInitial();
    this.updateLabel();
  }

  step(dt: number, input: InputSnapshot): void {
    this.previous = this.player.getState();
    this.player.step(dt, input);
    if (!(dt > 0)) {
      this.manager.step(dt);
      return;
    }
    this.damage.step(dt);
    if (this.respawnS !== null) {
      this.respawnS -= dt;
      if (this.respawnS <= 1e-9) this.reset();
    }
    this.projectileRenderer.capturePrevious();
    this.manager.step(dt);
    this.world.gravity.y = this.ctx.tuning.physics.gravity;
    this.world.timestep = dt;
    this.world.step();
    this.projectiles.step(dt);
  }

  render(alpha: number, frameDt = 1 / 60): void {
    const ids = new Set<number>();
    this.manager.forEach((enemy) => {
      ids.add(enemy.id);
      let view = this.views.get(enemy.id);
      if (!view) {
        view = new EnemyView(enemy, this.loadModels);
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
    this.projectileRenderer.render(alpha);
    this.lights.sync();
    const camera = this.ctx.camera;
    if (!camera) return;
    const pose = this.camera.update(
      frameDt,
      this.previous,
      this.player.getState(),
      alpha,
    );
    camera.position.copy(pose.position);
    camera.rotation.set(pose.pitch, pose.yaw, pose.roll, 'YXZ');
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
  }

  query(name: string): unknown {
    const enemies: { id: number; state: string }[] = [];
    this.manager.forEach((enemy) => {
      if (enemy.current.state !== 'dead')
        enemies.push({ id: enemy.id, state: enemy.current.state });
    });
    if (name === 'enemies') return enemies.length;
    if (name === 'enemyStates') return enemies;
    if (name === 'playerHp') return this.health.current;
    return undefined;
  }

  dispose(): void {
    for (const off of this.off.splice(0)) off();
    for (const view of this.views.values()) view.dispose();
    this.views.clear();
    this.manager.dispose();
    this.projectileRenderer.dispose();
    this.projectiles.dispose();
    this.camera.dispose();
    this.damage.unregister(this.player.id);
    this.entities.destroy(this.player.id);
    this.hurtboxes.clear();
    this.player.dispose();
    this.world.free();
    this.label?.remove();
    for (const geometry of this.geometries) geometry.dispose();
    this.geometries.clear();
    this.root.removeFromParent();
    this.root.clear();
    this.three.background = null;
  }
}
