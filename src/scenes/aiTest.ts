import { BoxGeometry, Color, Euler, Group, Mesh, Quaternion } from 'three';
import type { Material, Scene as ThreeScene } from 'three';
import { Ray, QueryFilterFlags, type World } from '@dimforge/rapier3d-compat';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { z } from 'zod';
import { ProjectileSystem } from '../combat/weapons/projectiles';
import { PlasmaBlade } from '../combat/melee/plasmaBlade';
import { plasmaBladeDefinition } from '../combat/melee/bladeSchema';
import { queryBladeArc, queryBladeSpin } from '../combat/melee/bladeQueries';
import { FppBlade } from '../render/fppBlade';
import bossText from '../data/ui/bossTest.pl.json';
import hudText from '../data/ui/hud.pl.json';
import { ProjectileRenderer } from '../render/projectileRenderer';
import { DamageSystem, Health, Hurtboxes } from '../combat/damage';
import { statusDefinitions, StatusSystem } from '../combat/status';
import type { GameContext } from '../core/context';
import type { EntityId } from '../core/events';
import type { Vec3 } from '../core/math';
import { EntityRegistry } from '../core/entities';
import type { InputSnapshot } from '../core/input';
import { loadSettings } from '../core/save';
import { Stats } from '../core/stats';
import sceneData from '../data/scenes/aiTest.json';
import statusSceneData from '../data/scenes/statusTest.json';
import barrierSceneData from '../data/scenes/barrierTest.json';
import { BarrierPower } from '../combat/powers/barrier';
import { PlayerEnergy } from '../combat/powers/energy';
import { createPower } from '../combat/powers/registry';
import { PowerSlots } from '../combat/powers/slots';
import { BarrierRenderer } from '../render/barrierRenderer';
import { directorConfigSchema } from '../enemies/director';
import { EnemyManager } from '../enemies/manager';
import { Boss } from '../enemies/boss';
import { createEnemyView } from '../enemies/views';
import type { EnemyViewLike } from '../enemies/views';
import { availableEnemyIds, enemyRegistry } from '../enemies/registry';
import { CollisionGroup, initPhysics, interactionGroups } from '../physics';
import { FpsCamera } from '../player/fpsCamera';
import { PlayerController } from '../player/playerController';
import type { PlayerState } from '../player/playerController';
import { createStyleLights } from '../render/lights';
import { applyStyle, getMaterial } from '../render/materials';
import type { Scene } from './index';
import { enemyBody } from '../vfx/enemyBody';
import { HitSparks } from '../vfx/hitSparks';
import { HitSparksRenderer, StatusVfxRenderer } from '../vfx/fxRenderer';
import { StatusVfx } from '../vfx/statusVfx';
import { DebrisSystem } from '../vfx/debris';
import { DebrisRenderer } from '../vfx/debrisRenderer';
import { EnemyShatter } from '../vfx/enemyShatter';

const vec3 = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
});
export const aiTestSchema = z.object({
  playerHealth: z.number().positive(),
  respawnS: z.number().positive(),
  spawnDistance: z.number().positive(),
  spawnSpacing: z.number().positive(),
  initialEnemies: z.array(z.object({ id: z.string(), position: vec3 })),
  director: directorConfigSchema.optional(),
  spawnPoints: z.array(vec3).optional(),
  powers: z
    .object({
      slots: z.tuple([z.string(), z.string()]),
      maxEnergy: z.number().positive(),
      energyRegen: z.number().nonnegative(),
    })
    .optional(),
  arena: z.array(
    z.object({ size: vec3, position: vec3, model: z.string().optional() }),
  ),
});
export type AiTestData = z.infer<typeof aiTestSchema>;
const defaultData = aiTestSchema.parse(sceneData);
const statusData = aiTestSchema.parse(statusSceneData);

/** Domyślny czas statusu z komendy `status <id>` (debug). */
const STATUS_COMMAND_S = 3;

export class AiTest implements Scene {
  readonly id: string;
  private readonly data: AiTestData;
  private statuses!: StatusSystem;
  private ctx!: GameContext;
  private three!: ThreeScene;
  private world!: World;
  private entities!: EntityRegistry;
  private damage!: DamageSystem;
  protected manager!: EnemyManager;
  private projectiles!: ProjectileSystem;
  private projectileRenderer!: ProjectileRenderer;
  private player!: PlayerController;
  private previous!: PlayerState;
  private camera!: FpsCamera;
  private health!: Health;
  private readonly hurtboxes = new Hurtboxes();
  protected readonly root = new Group();
  protected readonly lights = createStyleLights();
  private readonly views = new Map<number, EnemyViewLike>();
  private readonly geometries = new Set<import('three').BufferGeometry>();
  private readonly off: (() => void)[] = [];
  private label?: HTMLParagraphElement;
  private respawnS: number | null = null;
  private god = false;
  private readonly stats: Stats;
  private energy?: PlayerEnergy;
  private disposed = false;
  private powers?: PowerSlots;
  private blade?: PlasmaBlade;
  private bladeView?: FppBlade;
  private barrierRenderer?: BarrierRenderer;
  private statusVfx!: StatusVfx;
  private statusView!: StatusVfxRenderer;
  protected hitSparks!: HitSparks;
  private hitSparksView!: HitSparksRenderer;
  private debris?: DebrisSystem;
  private debrisView?: DebrisRenderer;
  private shatter?: EnemyShatter;

  constructor(
    private readonly loadModels = true,
    variant: { id: string; data: AiTestData } = {
      id: 'ai-test',
      data: defaultData,
    },
  ) {
    this.id = variant.id;
    this.data = variant.data;
    this.stats = new Stats({ maxHealth: this.data.playerHealth });
  }

  async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    this.ctx = ctx;
    this.three = three;
    const rapier = await initPhysics();
    if (this.disposed) return;
    this.world = new rapier.World({
      x: 0,
      y: ctx.tuning.physics.gravity,
      z: 0,
    });
    this.entities = new EntityRegistry(ctx.bus);
    this.damage = new DamageSystem(ctx.bus, this.entities);
    this.statuses = new StatusSystem(ctx.bus, this.damage, {
      position: (target) => this.enemyPosition(target),
      targets: () => this.enemyIds(),
    });
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
    if (this.data.powers) {
      this.stats.setBase('maxEnergy', this.data.powers.maxEnergy);
      this.stats.setBase('energyRegen', this.data.powers.energyRegen);
      const energy = new PlayerEnergy(id, this.stats, ctx.bus, ctx.tuning);
      this.energy = energy;
      const aim = () => {
        const s = this.player.getState();
        const t = ctx.tuning.player;
        return {
          origin: {
            ...s.position,
            y: s.position.y + s.height / 2 - (t.capsuleHeight - t.eyeHeight),
          },
          dir: {
            x: -Math.sin(s.yaw) * Math.cos(s.pitch),
            y: Math.sin(s.pitch),
            z: -Math.cos(s.yaw) * Math.cos(s.pitch),
          },
        };
      };
      if (this.id === 'boss-test') {
        this.blade = new PlasmaBlade(
          plasmaBladeDefinition,
          {
            owner: id,
            team: 'player',
            stats: this.stats,
            damage: this.damage,
            projectiles: this.projectiles,
            energy: energy.pool,
            aim,
            positionOf: (target) => this.enemyPosition(target),
            queryArc: (reach, width, shape) => {
              const { origin, dir } = aim();
              if (shape === 'spin')
                return queryBladeSpin(
                  this.world,
                  this.hurtboxes,
                  origin,
                  reach,
                );
              const { pitch, yaw } = this.player.getState();
              return queryBladeArc(
                this.world,
                this.hurtboxes,
                {
                  x: origin.x + (dir.x * reach) / 2,
                  y: origin.y + (dir.y * reach) / 2,
                  z: origin.z + (dir.z * reach) / 2,
                },
                new Quaternion().setFromEuler(new Euler(pitch, yaw, 0, 'YXZ')),
                reach,
                width,
              );
            },
          },
          ctx.bus,
          ctx.tuning,
        );
        this.off.push(
          this.projectiles.addInterceptor(this.blade.interceptProjectile),
        );
        this.bladeView = new FppBlade();
        this.root.add(this.bladeView.root);
        void this.bladeView.load(this.loadModels);
      }
      this.powers = new PowerSlots(
        this.data.powers.slots.map((power) =>
          createPower(power, {
            owner: id,
            bus: ctx.bus,
            tuning: ctx.tuning,
            damage: this.damage,
            statuses: this.statuses,
            energy,
            projectiles: this.projectiles,
            aim,
            targets: () => {
              const targets: { id: EntityId; position: Vec3 }[] = [];
              this.manager.forEach((enemy) => {
                if (enemy.removed || enemy.current.state === 'dead') return;
                targets.push({
                  id: enemy.id,
                  position: {
                    ...enemy.current.position,
                    y:
                      enemy.current.position.y +
                      (enemy.definition.body?.centerY ?? 0),
                  },
                });
              });
              return targets;
            },
            castWall: () => null,
          }),
        ),
      );
      this.barrierRenderer = new BarrierRenderer(ctx.tuning);
      this.root.add(this.barrierRenderer.root);
    }
    this.projectileRenderer = new ProjectileRenderer(
      this.projectiles,
      ctx.tuning.weapons.maxProjectiles,
      this.loadModels,
    );
    this.root.add(this.projectileRenderer.root);
    this.statusVfx = new StatusVfx(ctx.bus, {
      bodyOf: (target, a) => {
        let body = null;
        this.manager.forEach((e) => {
          if (e.id === target && !e.removed) body = enemyBody(e, a);
        });
        return body;
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
      playerId: id,
      cameraPosition: () => ctx.camera?.position ?? null,
      tuning: ctx.tuning,
    });
    this.hitSparksView = new HitSparksRenderer(
      this.hitSparks,
      ctx.tuning.vfx.maxHitSparks,
    );
    this.root.add(this.hitSparksView.root);
    this.manager = new EnemyManager(
      ctx,
      {
        projectiles: this.projectiles,
        world: this.world,
        entities: this.entities,
        damage: this.damage,
        hurtboxes: this.hurtboxes,
        statuses: this.statuses,
        getTarget: () => {
          if (this.health.dead) return null;
          const { position, height } = this.player.getState();
          return { id, position, height };
        },
      },
      { director: this.data.director, spawnPoints: this.data.spawnPoints },
    );
    if (this.id === 'ai-test') {
      this.debris = new DebrisSystem({
        maxDebris: ctx.tuning.vfx.maxDebris,
        tuning: ctx.tuning.vfx,
        seed: ctx.rng.fork('ai-test-debris').getState(),
        walls: (pos, dir, dist) =>
          this.world.castRay(
            new Ray(pos, dir),
            dist,
            true,
            QueryFilterFlags.EXCLUDE_SENSORS,
            interactionGroups(CollisionGroup.Debris, CollisionGroup.World),
          )?.timeOfImpact ?? null,
      });
      this.debrisView = new DebrisRenderer(this.debris);
      this.root.add(this.debrisView.root);
      this.shatter = new EnemyShatter(ctx.bus, this.debris, {
        positionOf: (enemyId) => this.enemyPosition(enemyId),
        collapse: {
          tuning: ctx.tuning.enemies,
          ageOf: (enemyId) => {
            let age: number | undefined;
            this.manager.forEach((enemy) => {
              if (enemy.id === enemyId && enemy.current.state === 'dead')
                age = enemy.current.stateTimeS;
            });
            return age;
          },
        },
        cameraPosition: () => ctx.camera?.position ?? null,
        tuning: ctx.tuning,
      });
    }
    three.background = new Color(ctx.tuning.render.world);
    three.add(this.root);
    this.root.add(this.lights);
    await Promise.all(
      this.data.arena.map(async ({ size, position, model }) => {
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
    if (this.disposed) return;
    if (typeof document !== 'undefined') {
      this.label = document.createElement('p');
      this.label.setAttribute('aria-label', 'Zdrowie gracza');
      this.label.style.cssText =
        'position:absolute;top:48px;left:20px;color:#00e5ff;pointer-events:none;white-space:pre';
      document.body.append(this.label);
    }
    this.off.push(
      ctx.bus.on('health_changed', ({ id: target }) => {
        if (target === id) this.updateLabel();
      }),
      ctx.bus.on('status_applied', () => this.updateLabel()),
      ctx.bus.on('status_expired', () => this.updateLabel()),
      ctx.bus.on('player_died', ({ id: target }) => {
        if (target === id) this.respawnS = this.data.respawnS;
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
          const offset = (i - (n - 1) / 2) * this.data.spawnSpacing;
          this.manager.spawn(kind, {
            x:
              position.x -
              Math.sin(yaw) * this.data.spawnDistance +
              Math.cos(yaw) * offset,
            y: position.y - ctx.tuning.player.capsuleHeight / 2,
            z:
              position.z -
              Math.cos(yaw) * this.data.spawnDistance -
              Math.sin(yaw) * offset,
          });
        }
        return `Utworzono: ${n}`;
      },
    );
    const hit = (amount: number): string => {
      const { position } = this.player.getState();
      this.manager.forEach((enemy) =>
        this.damage.deal(enemy.id, {
          source: id,
          amount,
          tags: ['#debug'],
          dir: {
            x: enemy.current.position.x - position.x,
            y: 0,
            z: enemy.current.position.z - position.z,
          },
        }),
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
    if (this.id === 'ai-test')
      register('slam', 'slam [odrzut] — odrzuca Szturmowca w filar', (args) => {
        const knockback = args[0] === undefined ? 18 : Number(args[0]);
        if (args.length > 1 || !Number.isFinite(knockback) || knockback <= 0)
          return 'Podaj dodatni odrzut.';
        const pillar = this.data.arena.find(
          (block) => block.model === 'pillar',
        );
        if (!pillar) return 'Brak filaru na scenie.';
        const enemy = this.manager.spawn('assaulter', {
          x: pillar.position.x,
          y: 0,
          z: pillar.position.z + pillar.size.z / 2 + 1.5,
        });
        this.damage.deal(enemy.id, {
          source: id,
          amount: 1,
          tags: ['#debug'],
          dir: { x: 0, y: 0, z: -1 },
          knockback,
        });
        return 'Szturmowiec odrzucony w stronę filaru.';
      });
    register(
      'knock',
      'knock — mocny odrzut wszystkich wrogów od gracza (przewrócenie i kip-up)',
      () => {
        const from = this.player.getState().position;
        this.manager.forEach((enemy) => {
          const dx = enemy.current.position.x - from.x;
          const dz = enemy.current.position.z - from.z;
          const length = Math.hypot(dx, dz) || 1;
          this.damage.deal(enemy.id, {
            source: id,
            amount: 1,
            tags: ['#debug'],
            dir: { x: dx / length, y: 0, z: dz / length },
            knockback: ctx.tuning.enemies.stunKnockback + 2,
          });
        });
        return 'Odrzut zadany.';
      },
    );
    register('boss phase', 'boss phase <n> — faza bossa od 1', (args) => {
      const phase = Number(args[0]);
      let changed = false;
      if (args.length === 1)
        this.manager.forEach((enemy) => {
          if (enemy instanceof Boss && enemy.setPhase(phase)) changed = true;
        });
      return changed
        ? `Faza bossa: ${phase}`
        : 'Podaj istniejącą fazę żywego bossa.';
    });
    register('boss pattern', bossText.patternHelp, (args) => {
      const kind = args[0];
      let started = false;
      if (
        args.length === 1 &&
        (kind === 'summon' ||
          kind === 'shield' ||
          kind === 'fan' ||
          kind === 'laser' ||
          kind === 'gridHack')
      )
        this.manager.forEach((enemy) => {
          if (enemy instanceof Boss && enemy.forcePattern(kind)) started = true;
        });
      return started ? `Wzorzec bossa: ${kind}` : bossText.patternInvalid;
    });
    register(
      'status',
      `status <id> [s] — na wszystkich wrogów: ${[...statusDefinitions.keys()].join(', ')}`,
      (args) => {
        const status = args[0] ?? '';
        const seconds =
          args[1] === undefined ? STATUS_COMMAND_S : Number(args[1]);
        if (
          !statusDefinitions.has(status) ||
          args.length > 2 ||
          !Number.isFinite(seconds) ||
          seconds <= 0
        )
          return 'Podaj znany status i dodatni czas w sekundach.';
        const targets = this.enemyIds();
        for (const target of targets)
          this.statuses.apply(target, { id: status, durationS: seconds }, id);
        return `Nałożono ${status} (${seconds} s) na wrogów: ${targets.length}`;
      },
    );
    register('director', 'director — tokeny, kolejki i sloty dyrektora', () => {
      const d = this.manager.director?.snapshot();
      if (!d) return 'Scena bez dyrektora.';
      const list = (ids: readonly (number | null)[]) =>
        ids.map((id) => id ?? '·').join(' ') || '—';
      return [
        `Tokeny wręcz: ${list(d.tokens.melee)} | strzał: ${list(d.tokens.shot)}`,
        `Czekają wręcz: ${list(d.waiting.melee)} | strzał: ${list(d.waiting.shot)}`,
        `Sloty wręcz: ${list(d.slots.melee)} | strzał: ${list(d.slots.shot)}`,
      ].join('\n');
    });
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
    if (this.energy)
      register('energy', 'energy [n] — energia Rezonansu', (args) => {
        if (args.length === 1 && Number.isFinite(Number(args[0])))
          this.energy!.set(Number(args[0]));
        return `Energia: ${this.energy!.current}`;
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
    for (const { id, position } of this.data.initialEnemies)
      this.manager.spawn(id, position);
  }
  private enemyIds(): EntityId[] {
    const ids: EntityId[] = [];
    this.manager.forEach((enemy) => {
      if (!enemy.removed && enemy.current.state !== 'dead') ids.push(enemy.id);
    });
    return ids;
  }
  private enemyPosition(target: EntityId): Vec3 | null {
    let position: Vec3 | null = null;
    this.manager.forEach((enemy) => {
      if (enemy.id === target && !enemy.removed)
        position = enemy.current.position;
    });
    return position;
  }
  private updateLabel(): void {
    if (!this.label) return;
    const lines = [`Gracz: ${this.health.current} / ${this.health.max} HP`];
    if (this.statuses.has(this.player.id, 'jammed')) lines.push(hudText.jammed);
    if (this.energy && this.powers) {
      lines.push(
        `Energia: ${this.energy.current.toFixed(0)} / ${this.energy.max}`,
      );
      for (const [slot, key] of ['F', 'E'].entries()) {
        const power = this.powers.get(slot);
        if (power)
          lines.push(
            `${key} — ${power.def.name}: ${power.active ? 'aktywna' : `${power.cooldownRemaining.toFixed(1)} s`}`,
          );
      }
    }
    for (const target of this.enemyIds()) {
      const active = this.statuses.list(target);
      if (active.length)
        lines.push(
          `#${target}: ${active.map((a) => `${a.id}×${a.stacks}`).join(', ')}`,
        );
    }
    this.label.textContent = lines.join('\n');
  }

  reset(): void {
    this.blade?.reset();
    this.powers?.reset();
    this.energy?.set(this.energy.max);
    this.manager.despawnAll();
    this.statuses.reset();
    this.statusVfx.clear();
    this.hitSparks.clear();
    this.debris?.clear();
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
    const playerDt = this.ctx.feel?.playerDt(dt) ?? dt;
    this.player.step(playerDt, input);
    this.blade?.step(playerDt, input);
    this.energy?.step(playerDt);
    this.powers?.step(playerDt, input);
    if (this.powers) this.updateLabel();
    if (!(dt > 0)) {
      this.manager.step(dt);
      return;
    }
    this.damage.step(dt);
    this.statuses.step(dt);
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
    this.debris?.step(dt);
    this.shatter?.step(dt);
  }

  render(alpha: number, frameDt = 1 / 60): void {
    const ids = new Set<number>();
    this.manager.forEach((enemy) => {
      ids.add(enemy.id);
      let view = this.views.get(enemy.id);
      if (!view) {
        view = createEnemyView(enemy, this.loadModels, this.ctx.bus);
        this.views.set(enemy.id, view);
        this.root.add(view.root);
      }
      view.render(alpha, frameDt);
    });
    for (const [id, view] of this.views)
      if (!ids.has(id)) {
        view.dispose();
        this.views.delete(id);
      }
    this.projectileRenderer.render(alpha);
    this.statusView.render(alpha, frameDt);
    this.hitSparksView.render(frameDt);
    this.debrisView?.render(alpha);
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
    if (this.blade && this.bladeView) {
      camera.updateMatrixWorld();
      this.bladeView.place(camera.matrixWorld, this.blade.view(), frameDt);
    }
    const barriers = [this.powers?.get(0), this.powers?.get(1)].filter(
      (power): power is BarrierPower => power instanceof BarrierPower,
    );
    const barrier = barriers.find((power) => power.active) ?? barriers[0];
    this.barrierRenderer?.advance(frameDt);
    if (barrier) this.barrierRenderer?.render(barrier, pose);
  }

  query(name: string): unknown {
    const enemies: { id: number; state: string }[] = [];
    this.manager.forEach((enemy) => {
      if (enemy.current.state !== 'dead')
        enemies.push({ id: enemy.id, state: enemy.current.state });
    });
    if (name === 'enemies') return enemies.length;
    if (name === 'bosses') {
      const bosses: { id: number; phase: number; hp: number }[] = [];
      this.manager.forEach((enemy) => {
        if (enemy instanceof Boss && !enemy.removed)
          bosses.push({
            id: enemy.id,
            phase: enemy.phase,
            hp: this.damage.health(enemy.id)?.current ?? 0,
          });
      });
      return bosses;
    }
    if (name === 'enemyStates') return enemies;
    if (name === 'playerHp') return this.health.current;
    if (name === 'director') return this.manager.director?.snapshot() ?? null;
    if (name === 'playerPos') return this.player.getState().position;
    if (name === 'energy') return this.energy?.current;
    if (name === 'powerSlots')
      return [this.powers?.get(0)?.def.id, this.powers?.get(1)?.def.id];
    if (name === 'powerActive')
      return [this.powers?.get(0)?.active, this.powers?.get(1)?.active];
    return undefined;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.blade?.dispose();
    this.bladeView?.dispose();
    this.powers?.reset();
    this.energy?.dispose();
    this.barrierRenderer?.dispose();
    for (const off of this.off.splice(0)) off();
    for (const view of this.views.values()) view.dispose();
    this.views.clear();
    this.manager?.dispose();
    this.statuses?.dispose();
    this.statusVfx?.dispose();
    this.statusView?.dispose();
    this.hitSparks?.dispose();
    this.hitSparksView?.dispose();
    this.shatter?.dispose();
    this.debrisView?.dispose();
    this.projectileRenderer?.dispose();
    this.projectiles?.dispose();
    this.camera?.dispose();
    if (this.player) {
      this.damage.unregister(this.player.id);
      this.entities.destroy(this.player.id);
    }
    this.hurtboxes?.clear();
    this.player?.dispose();
    this.world?.free();
    this.label?.remove();
    for (const geometry of this.geometries) geometry.dispose();
    this.geometries.clear();
    this.root.removeFromParent();
    this.root.clear();
    if (this.three) this.three.background = null;
  }
}

/** `?scene=status-test` (F2-02): ai-test z danymi statusTest.json i komendą `status`. */
export function createStatusTest(loadModels = true): AiTest {
  return new AiTest(loadModels, { id: 'status-test', data: statusData });
}

export function createBarrierTest(loadModels = true): AiTest {
  return new AiTest(loadModels, {
    id: 'barrier-test',
    data: aiTestSchema.parse(barrierSceneData),
  });
}
