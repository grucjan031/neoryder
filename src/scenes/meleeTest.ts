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
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from 'three';
import type { Object3D, Scene as ThreeScene } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Collider, World } from '@dimforge/rapier3d-compat';
import { z } from 'zod';
import pushTestData from '../data/scenes/pushTest.json';
import meleeTestData from '../data/scenes/meleeTest.json';
import type { GameContext } from '../core/context';
import type { EntityId } from '../core/events';
import { EntityRegistry } from '../core/entities';
import type { InputSnapshot } from '../core/input';
import type { Vec3 } from '../core/math';
import { loadSettings } from '../core/save';
import { Stats } from '../core/stats';
import { DamageSystem, Health, Hurtboxes } from '../combat/damage';
import { StatusSystem } from '../combat/status';
import {
  bladeDefinitions,
  DEFAULT_BLADE_ID,
  resolveBlade,
} from '../combat/melee/bladeSchema';
import type { HitShape } from '../combat/melee/bladeSchema';
import { PlayerEnergy } from '../combat/powers/energy';
import { pushDefinition, ResonancePush } from '../combat/powers/push';
import type { PowerDeps } from '../combat/powers/power';
import { createPower, powerDefinitions } from '../combat/powers/registry';
import { PowerSlots } from '../combat/powers/slots';
import { ProjectileSystem } from '../combat/weapons/projectiles';
import { LightningRenderer } from '../render/lightningRenderer';
import { ProjectileRenderer } from '../render/projectileRenderer';
import { PlasmaBlade } from '../combat/melee/plasmaBlade';
import { initPhysics, CollisionGroup, interactionGroups } from '../physics';
import { FpsCamera } from '../player/fpsCamera';
import { PlayerController } from '../player/playerController';
import type { PlayerState } from '../player/playerController';
import { FppBlade } from '../render/fppBlade';
import { createStyleLights } from '../render/lights';
import { applyStyle, getMaterial } from '../render/materials';
import { palette } from '../render/palette';
import type { Scene } from './index';

interface Dummy {
  id: EntityId;
  health: Health;
  colliders: Collider[];
  model: Object3D;
  /** Pozycja startowa (respawn). */
  position: Vec3;
  /** Bieżąca pozycja stóp i prędkość odrzutu (m/s). */
  pos: Vec3;
  vel: Vec3;
  respawnS: number | null;
}

const DUMMY_POSITIONS: Vec3[] = [
  { x: -2.5, y: 0, z: -4 },
  { x: 0, y: 0, z: -5 },
  { x: 2.5, y: 0, z: -4 },
];

const meleeTestDefinition = z
  .object({
    lanePositions: z
      .array(
        z.object({
          x: z.number().finite(),
          y: z.number().finite(),
          z: z.number().finite(),
        }),
      )
      .min(1),
    controls: z.string().min(1),
  })
  .parse(meleeTestData);

const pushTestDefinition = z
  .object({
    slots: z.tuple([z.string().min(1), z.string().min(1)]),
    dummyPositions: z
      .array(
        z.object({
          x: z.number().finite(),
          y: z.number().finite(),
          z: z.number().finite(),
        }),
      )
      .min(1),
    controls: z.string().min(1),
  })
  .parse(pushTestData);

/** Parametry wieżyczki sceny testowej (nie rozgrywki — tylko do ćwiczenia parowania). */
const TURRET_INTERVAL_S = 1.6;
const TURRET_SPEED = 9;
const TURRET_DAMAGE = 12;

/** Scena ostrza plazmowego (#07): combo, ciężki atak, blok, manekiny z odradzaniem. */
export class MeleeTest implements Scene {
  readonly id: string = 'melee-test';
  /** Ściana za manekinami (wariant push-test). */
  protected withWall = false;
  /** Środkowy manekin strzela do gracza wolnymi pociskami (wariant parry-test). */
  protected withTurret = false;
  private projectiles!: ProjectileSystem;
  private projectileView!: ProjectileRenderer;
  private turretS = 1;
  private ctx!: GameContext;
  private three!: ThreeScene;
  private rapier!: Awaited<ReturnType<typeof initPhysics>>;
  private world!: World;
  private entities!: EntityRegistry;
  private damage!: DamageSystem;
  protected statuses!: StatusSystem;
  protected lightningView!: LightningRenderer;
  private readonly hurtboxes = new Hurtboxes();
  private player!: PlayerController;
  private previous!: PlayerState;
  private playerSpawn!: Vec3;
  private fpsCamera!: FpsCamera;
  private blade!: PlasmaBlade;
  private readonly flyingBlade = new FlyingBlade();
  private energy!: PlayerEnergy;
  private push!: ResonancePush;
  private readonly playerStats = new Stats({
    maxHealth: 100,
    maxEnergy: 100,
    energyRegen: 25,
  });
  private readonly playerHealth = new Health(() =>
    this.playerStats.get('maxHealth'),
  );
  private readonly dummies: Dummy[] = [];
  private readonly root = new Group();
  private readonly bladeModel = new FppBlade();
  private readonly arcDebug = new Mesh(
    new BoxGeometry(1, 1, 1),
    new MeshBasicMaterial({ color: palette.cyan, wireframe: true }),
  );
  protected readonly off: (() => void)[] = [];
  protected label?: HTMLParagraphElement;
  private dummyTemplate: Object3D | null = null;
  private readonly tmp = {
    m: new Matrix4(),
    q: new Quaternion(),
    e: new Euler(0, 0, 0, 'YXZ'),
    v: new Vector3(),
    s: new Vector3(1, 1, 1),
  };

  constructor(private readonly loadModels = true) {}

  async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    this.ctx = ctx;
    this.three = three;
    this.lightningView = new LightningRenderer(ctx.tuning);
    this.rapier = await initPhysics();
    this.world = new this.rapier.World({
      x: 0,
      y: ctx.tuning.physics.gravity,
      z: 0,
    });
    this.entities = new EntityRegistry(ctx.bus);
    this.damage = new DamageSystem(ctx.bus, this.entities);
    this.statuses = new StatusSystem(ctx.bus, this.damage, {
      position: (id) => {
        const d = this.dummies.find(
          (dummy) => dummy.id === id && dummy.respawnS === null,
        );
        return d ? { x: d.pos.x, y: 1.4, z: d.pos.z } : null;
      },
      targets: () =>
        this.dummies.filter((d) => d.respawnS === null).map((d) => d.id),
    });

    three.background = new Color(palette.background);
    three.add(this.root);
    this.lights = createStyleLights();
    this.root.add(this.lights);
    const floor = new Mesh(new BoxGeometry(30, 1, 30), getMaterial('world'));
    floor.position.y = -0.5;
    this.root.add(floor);
    this.world.createCollider(
      this.rapier.ColliderDesc.cuboid(15, 0.5, 15)
        .setTranslation(0, -0.5, 0)
        .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
    );

    if (this.withWall || this.id === 'melee-test') {
      const wall = new Mesh(new BoxGeometry(12, 3, 0.6), getMaterial('world'));
      wall.position.set(0, 1.5, -7.3);
      this.root.add(wall);
      this.world.createCollider(
        this.rapier.ColliderDesc.cuboid(6, 1.5, 0.3)
          .setTranslation(0, 1.5, -7.3)
          .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
      );
    }
    await this.loadAssets();
    for (const position of this.dummyPositions()) this.spawnDummy(position);

    const playerId = this.entities.create('player', 'player');
    this.damage.register(playerId, this.playerHealth, {
      stats: this.playerStats,
    });
    this.player = new PlayerController(
      playerId,
      this.world,
      ctx,
      {
        x: 0,
        y:
          ctx.tuning.player.capsuleHeight / 2 +
          ctx.tuning.player.controllerOffset,
        z: -3,
      },
      loadSettings(),
    );
    this.entities.bindCollider(playerId, this.player.colliderHandle);
    this.previous = this.player.getState();
    this.playerSpawn = { ...this.previous.position };
    this.fpsCamera = new FpsCamera(ctx.tuning, playerId, ctx.bus);
    this.hurtboxes.add(playerId, this.player.colliderHandle);
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
    this.energy = new PlayerEnergy(
      playerId,
      this.playerStats,
      ctx.bus,
      ctx.tuning,
    );
    this.root.add(this.flyingBlade.root);
    const bladeDefinition = this.initialBlade();
    this.blade = new PlasmaBlade(
      bladeDefinition,
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
        positionOf: (id) => this.dummies.find((d) => d.id === id)?.pos ?? null,
      },
      ctx.bus,
      ctx.tuning,
    );
    this.off.push(
      this.projectiles.addInterceptor(this.blade.interceptProjectile),
    );
    this.initPowers({
      projectiles: this.projectiles,
      bus: ctx.bus,
      tuning: ctx.tuning,
      owner: playerId,
      damage: this.damage,
      energy: this.energy,
      aim: () => this.aim(),
      targets: () =>
        this.dummies
          .filter((d) => d.respawnS === null)
          .map((d) => ({
            id: d.id,
            position: { x: d.pos.x, y: 1.4, z: d.pos.z },
          })),
      castWall: (origin, dir, max) => this.castWall(origin, dir, max),
    });

    this.arcDebug.visible = false;
    this.root.add(this.bladeModel.root, this.arcDebug, this.lightningView.root);
    this.world.step();
    this.registerCommands();
    this.off.push(
      // Odrzut manekinów: impuls z damage_dealt.knockback (masa 1) w kierunku ciosu.
      ctx.bus.on('damage_dealt', ({ target, dir, knockback }) => {
        const dummy = this.dummies.find((d) => d.id === target);
        if (!dummy || !dir || knockback <= 0) return;
        const flat = Math.hypot(dir.x, dir.z) || 1;
        dummy.vel = {
          x: (dir.x / flat) * knockback,
          y: 0,
          z: (dir.z / flat) * knockback,
        };
      }),
      ctx.bus.on('enemy_killed', ({ id }) => {
        const dummy = this.dummies.find((d) => d.id === id);
        if (dummy) {
          dummy.model.visible = false;
          dummy.respawnS = ctx.tuning.damage.respawnS;
        }
      }),
    );
    if (typeof document !== 'undefined') {
      this.label = document.createElement('p');
      this.label.className = 'hint';
      this.label.style.top = '12px';
      this.label.style.bottom = 'auto';
      document.body.append(this.label);
    }
    this.render(1);
  }

  protected dummyPositions(): readonly Vec3[] {
    return this.id === 'melee-test'
      ? meleeTestDefinition.lanePositions
      : DUMMY_POSITIONS;
  }

  protected initPowers(deps: PowerDeps): void {
    this.push = new ResonancePush(pushDefinition, deps, deps.bus, deps.tuning);
  }

  protected stepPowers(dt: number, input: InputSnapshot): void {
    this.push.step(dt, input);
  }

  /** Wariant ostrza sceny: `?blade=<id>` albo ostrze plazmowe. */
  private initialBlade() {
    const requested =
      typeof location === 'undefined'
        ? null
        : new URLSearchParams(location.search).get('blade');
    return resolveBlade(DEFAULT_BLADE_ID, requested);
  }

  private async loadAssets(): Promise<void> {
    await this.bladeModel.load(this.loadModels, this.initialBlade());
    if (!this.loadModels) return;
    try {
      const trooper = await new GLTFLoader().loadAsync(
        '/assets/models/enemy_trooper.glb',
      );
      applyStyle(trooper.scene);
      this.dummyTemplate = trooper.scene;
    } catch {
      // Bryły zastępcze zostają — scena jest grywalna bez modeli.
    }
  }

  private spawnDummy(position: Vec3): void {
    const id = this.entities.create('dummy', 'enemy');
    const stats = new Stats({ maxHealth: 100 });
    const health = new Health(() => stats.get('maxHealth'));
    this.damage.register(id, health, { stats });
    const colliders: Collider[] = [];
    for (const [desc, multiplier] of [
      [
        this.rapier.ColliderDesc.capsule(0.35, 0.3).setTranslation(0, 1.05, 0),
        1,
      ],
      [this.rapier.ColliderDesc.ball(0.22).setTranslation(0, 1.65, 0), 1.5],
    ] as const) {
      const collider = this.world.createCollider(
        desc
          .setTranslation(position.x, desc.translation.y, position.z)
          .setCollisionGroups(interactionGroups(CollisionGroup.Enemy, 0xffff)),
      );
      colliders.push(collider);
      this.entities.bindCollider(id, collider.handle);
      this.hurtboxes.add(id, collider, multiplier);
    }
    const model = this.dummyTemplate
      ? this.dummyTemplate.clone(true)
      : new Mesh(new BoxGeometry(0.6, 1.8, 0.4), getMaterial('enemy'));
    if (!this.dummyTemplate) model.position.y = 0.9;
    const holder = new Group();
    holder.position.set(position.x, 0, position.z);
    holder.add(model);
    // Manekin patrzy na gracza (+Z).
    this.root.add(holder);
    this.dummies.push({
      id,
      health,
      colliders,
      model: holder,
      position,
      pos: { ...position },
      vel: { x: 0, y: 0, z: 0 },
      respawnS: null,
    });
  }

  private aim(): { origin: Vec3; dir: Vec3 } {
    const s = this.player.getState();
    const t = this.ctx.tuning.player;
    const cosP = Math.cos(s.pitch);
    return {
      origin: {
        x: s.position.x,
        y:
          s.position.y -
          s.height / 2 +
          s.height -
          (t.capsuleHeight - t.eyeHeight),
        z: s.position.z,
      },
      dir: {
        x: -Math.sin(s.yaw) * cosP,
        y: Math.sin(s.pitch),
        z: -Math.cos(s.yaw) * cosP,
      },
    };
  }

  /** Łuk cięcia jako prostopadłościan przed oczami, obrócony zgodnie z patrzeniem. */
  private queryArc(reach: number, width: number, shape: HitShape = 'arc') {
    const { origin, dir } = this.aim();
    if (shape === 'spin') {
      if (this.ctx.debug) {
        this.arcDebug.position.set(origin.x, origin.y, origin.z);
        this.arcDebug.quaternion.identity();
        this.arcDebug.scale.set(reach * 2, 1.2, reach * 2);
        this.arcDebug.visible = true;
        this.arcHideS = 0.12;
      }
      return queryBladeSpin(this.world, this.hurtboxes, origin, reach);
    }
    const s = this.player.getState();
    const center = {
      x: origin.x + dir.x * reach * 0.5,
      y: origin.y + dir.y * reach * 0.5,
      z: origin.z + dir.z * reach * 0.5,
    };
    this.tmp.e.set(s.pitch, s.yaw, 0, 'YXZ');
    this.tmp.q.setFromEuler(this.tmp.e);
    const rotation = {
      x: this.tmp.q.x,
      y: this.tmp.q.y,
      z: this.tmp.q.z,
      w: this.tmp.q.w,
    };
    if (this.ctx.debug) {
      this.arcDebug.position.set(center.x, center.y, center.z);
      this.arcDebug.quaternion.copy(this.tmp.q);
      this.arcDebug.scale.set(width, 1.2, reach);
      this.arcDebug.visible = true;
      this.arcHideS = 0.12;
    }
    return queryBladeArc(
      this.world,
      this.hurtboxes,
      center,
      rotation,
      reach,
      width,
    );
  }

  private arcHideS = 0;

  /** Wieżyczka w środkowym manekinie: wolny pocisk w oczy gracza co TURRET_INTERVAL_S. */
  private stepTurret(dt: number): void {
    const shooter = this.dummies[1];
    if (!this.withTurret || !shooter || shooter.respawnS !== null) return;
    this.turretS -= dt;
    if (this.turretS > 0) return;
    this.turretS = TURRET_INTERVAL_S;
    const origin = { x: shooter.pos.x, y: 1.45, z: shooter.pos.z + 0.45 };
    const eye = this.aim().origin;
    const d = {
      x: eye.x - origin.x,
      y: eye.y - 0.3 - origin.y,
      z: eye.z - origin.z,
    };
    const len = Math.hypot(d.x, d.y, d.z) || 1;
    this.projectiles.spawn({
      owner: shooter.id,
      team: 'enemy',
      origin,
      dir: { x: d.x / len, y: d.y / len, z: d.z / len },
      speed: TURRET_SPEED,
      damage: TURRET_DAMAGE,
      tags: ['#gun'],
      lifetimeS: 4,
    });
  }

  /** Odległość do geometrii świata wzdłuż promienia (ściany), albo null. */
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

  /** Ślizg po odrzucie z tarciem; ściana zatrzymuje manekina. */
  private stepKnockback(d: Dummy, dt: number): void {
    const speed = Math.hypot(d.vel.x, d.vel.z);
    if (speed < 0.05) return;
    const dir = { x: d.vel.x / speed, y: 0, z: d.vel.z / speed };
    const travel = speed * dt;
    const wall = this.castWall(
      { x: d.pos.x, y: 1.1, z: d.pos.z },
      dir,
      travel + 0.35,
    );
    const step = wall === null ? travel : Math.max(0, wall - 0.35);
    this.moveDummy(d, {
      x: d.pos.x + dir.x * step,
      y: 0,
      z: d.pos.z + dir.z * step,
    });
    if (wall !== null) d.vel = { x: 0, y: 0, z: 0 };
    else {
      const damping = Math.exp(-6 * dt);
      d.vel = { x: d.vel.x * damping, y: 0, z: d.vel.z * damping };
    }
  }

  private moveDummy(d: Dummy, pos: Vec3): void {
    d.pos = pos;
    const [torso, head] = d.colliders;
    torso?.setTranslation({ x: pos.x, y: 1.05, z: pos.z });
    head?.setTranslation({ x: pos.x, y: 1.65, z: pos.z });
    d.model.position.set(pos.x, 0, pos.z);
  }
  private lights?: ReturnType<typeof createStyleLights>;

  private registerCommands(): void {
    const commands = this.ctx.commands;
    if (!commands) return;
    this.off.push(
      commands.register(
        'blade',
        `blade <id> — wariant ostrza (${[...bladeDefinitions.keys()].join(', ')})`,
        (args) => {
          const next = bladeDefinitions.get(args[0] ?? '');
          if (args.length !== 1 || !next)
            return `Dostępne ostrza: ${[...bladeDefinitions.keys()].join(', ')}`;
          this.blade.setDefinition(next);
          void this.bladeModel.setDefinition(next, this.loadModels);
          return `Ostrze: ${next.id}`;
        },
      ),
      commands.register(
        'enemyhit',
        'enemyhit <dmg> — manekin uderza gracza',
        (args) => {
          const amount = Number(args[0]);
          if (!Number.isFinite(amount) || amount <= 0)
            return 'Podaj obrażenia > 0.';
          const source = this.dummies[0]?.id ?? null;
          const dealt = this.damage.deal(this.player.id, {
            amount,
            source,
            tags: args[1] === 'heavy' ? ['#heavy'] : [],
          });
          return `Gracz otrzymał ${dealt.toFixed(1)} (HP ${this.playerHealth.current.toFixed(0)}).`;
        },
      ),
      commands.register(
        'energy',
        'energy [n] — pokaż / ustaw energię',
        (args) => {
          if (args[0] !== undefined) this.energy.set(Number(args[0]));
          return `Energia: ${this.energy.current.toFixed(0)}`;
        },
      ),
    );
  }

  reset(): void {
    for (const d of this.dummies) {
      d.health.reset();
      d.model.visible = true;
      d.respawnS = null;
      this.moveDummy(d, { ...d.position });
      d.vel = { x: 0, y: 0, z: 0 };
    }
    this.blade.reset();
    this.player.teleport(this.playerSpawn);
    this.previous = this.player.getState();
    this.world.step();
    this.playerHealth.reset();
    this.energy.set(this.energy.max);
    this.statuses.reset();
    this.lightningView.render(null);
  }

  step(dt: number, input: InputSnapshot): void {
    this.previous = this.player.getState();
    const pdt = this.ctx.feel?.playerDt(dt) ?? dt;
    this.player.step(pdt, input);
    this.blade.step(pdt, input);
    this.stepPowers(pdt, input);
    if (dt <= 0) return;
    this.projectileView.capturePrevious();
    this.stepTurret(dt);
    this.projectiles.step(dt);
    this.energy.step(pdt);
    this.damage.step(dt);
    this.statuses.step(dt);
    for (const d of this.dummies) {
      this.stepKnockback(d, dt);
      if (d.respawnS === null) continue;
      d.respawnS -= dt;
      if (d.respawnS <= 0) {
        d.health.reset();
        d.model.visible = true;
        d.respawnS = null;
        this.moveDummy(d, { ...d.position });
        d.vel = { x: 0, y: 0, z: 0 };
      }
    }
    this.world.gravity.y = this.ctx.tuning.physics.gravity;
    this.world.timestep = dt;
    this.world.step();
  }

  render(alpha: number, frameDt = 1 / 60): void {
    const camera = this.ctx.camera;
    this.projectileView.render(alpha);
    if (this.label) {
      const hp = this.dummies
        .map((d) => d.health.current.toFixed(0))
        .join(' / ');
      const v = this.blade.view();
      this.label.textContent = `Manekiny: ${hp} · energia ${this.energy.current.toFixed(0)} · HP ${this.playerHealth.current.toFixed(0)} · ${v.state}${v.stage ? ` ${v.stage}` : ''}`;
      if (this.id === 'melee-test')
        this.label.textContent += ` · ${meleeTestDefinition.controls}`;
    }
    this.lights?.sync();
    this.arcHideS -= frameDt;
    if (this.arcHideS <= 0) this.arcDebug.visible = false;
    this.flyingBlade.render(this.blade.view(), alpha, this.ctx.tuning);
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
    this.bladeModel.place(camera.matrixWorld, this.blade.view());
  }

  query(name: string): unknown {
    if (name === 'dummyHp') return this.dummies.map((d) => d.health.current);
    if (name === 'bladeState') return this.blade.view().state;
    if (name === 'bladeId') return this.blade.definition.id;
    if (name === 'blocking') return this.blade.blocking;
    if (name === 'energy') return this.energy.current;
    if (name === 'projectiles') return this.projectiles.activeCount;
    if (name === 'dummyPos') return this.dummies.map((d) => ({ ...d.pos }));
    if (name === 'playerHp') return this.playerHealth.current;
    return undefined;
  }

  dispose(): void {
    for (const off of this.off.splice(0)) off();
    this.blade.dispose();
    this.bladeModel.dispose();
    this.flyingBlade.dispose();
    this.statuses.dispose();
    this.lightningView.dispose();
    this.projectiles.dispose();
    this.projectileView.dispose();
    this.energy.dispose();
    this.fpsCamera.dispose();
    this.player.dispose();
    this.world.free();
    this.label?.remove();
    this.arcDebug.geometry.dispose();
    this.arcDebug.material.dispose();
    this.three.remove(this.root);
    this.root.clear();
    this.three.background = null;
  }
}

/** Wariant ze ścianą za manekinami do testu Pchnięcia i uderzeń w ścianę (#11). */
export class PushTest extends MeleeTest {
  override readonly id = 'push-test';
  protected override withWall = true;
  private slots!: PowerSlots;
  private powerDeps!: PowerDeps;
  private gameCtx!: GameContext;

  protected override dummyPositions(): readonly Vec3[] {
    return pushTestDefinition.dummyPositions;
  }

  protected override initPowers(deps: PowerDeps): void {
    this.powerDeps = deps;
    this.slots = new PowerSlots(
      pushTestDefinition.slots.map((id) => createPower(id, deps)),
    );
  }

  override async init(ctx: GameContext, three: ThreeScene): Promise<void> {
    this.gameCtx = ctx;
    await super.init(ctx, three);
    if (!ctx.commands) return;
    this.off.push(
      ctx.commands.register(
        'power',
        'power <slot 1|2> <id> — wstaw moc do slotu',
        (args) => {
          const slot = args[0] === '1' ? 0 : args[0] === '2' ? 1 : null;
          const id = args[1];
          if (
            slot === null ||
            !id ||
            args.length !== 2 ||
            !powerDefinitions.has(id)
          )
            return `Użycie: power <1|2> <id>. Dostępne moce: ${[...powerDefinitions.keys()].join(', ')}`;
          let power;
          try {
            power = createPower(id, this.powerDeps);
          } catch (error) {
            return `Scena nie obsługuje mocy ${id}: ${error instanceof Error ? error.message : String(error)}`;
          }
          this.slots.get(slot)?.reset();
          this.slots = new PowerSlots(
            [0, 1].map((i) => (i === slot ? power : this.slots.get(i))),
          );
          return `Slot ${slot + 1}: ${power.def.name}`;
        },
      ),
    );
  }

  protected override stepPowers(dt: number, input: InputSnapshot): void {
    this.slots.step(dt, input);
  }

  override reset(): void {
    super.reset();
    this.slots.reset();
  }

  override render(alpha: number, frameDt = 1 / 60): void {
    super.render(alpha, frameDt);
    this.lightningView.render(
      [this.slots.get(0), this.slots.get(1)],
      this.gameCtx.camera ?? null,
    );
    if (this.label)
      this.label.textContent += ` · ${pushTestDefinition.controls}`;
  }

  override query(name: string): unknown {
    if (name === 'powerSlots')
      return [0, 1].map((i) => this.slots.get(i)?.def.id ?? null);
    if (name === 'powerCooldowns')
      return [0, 1].map((i) => this.slots.get(i)?.cooldownRemaining ?? 0);
    return super.query(name);
  }
}

/** Wariant z wieżyczką do ćwiczenia parowania pocisków (#10). */
export class ParryTest extends MeleeTest {
  override readonly id = 'parry-test';
  protected override withTurret = true;
}
