import { padAimTargets } from './padAimTargets';
import { BoxGeometry, Color, Group, Mesh, Quaternion } from 'three';
import type { Scene as ThreeScene } from 'three';
import { QueryFilterFlags, Ray } from '@dimforge/rapier3d-compat';
import type { RigidBody, World } from '@dimforge/rapier3d-compat';
import { z } from 'zod';
import { DamageSystem, Health, Hurtboxes } from '../combat/damage';
import { PlayerEnergy } from '../combat/powers/energy';
import type { GrabPower } from '../combat/powers/grab';
import { createPower } from '../combat/powers/registry';
import { PowerSlots } from '../combat/powers/slots';
import { StatusSystem } from '../combat/status';
import { ProjectileSystem } from '../combat/weapons/projectiles';
import type { GameContext } from '../core/context';
import { EntityRegistry } from '../core/entities';
import type { InputSnapshot } from '../core/input';
import type { Vec3 } from '../core/math';
import { loadSettings } from '../core/save';
import { Stats } from '../core/stats';
import raw from '../data/scenes/grabTest.json';
import { directorConfigSchema } from '../enemies/director';
import { EnemyManager } from '../enemies/manager';
import { createEnemyView } from '../enemies/views';
import type { EnemyViewLike } from '../enemies/views';
import { CollisionGroup, initPhysics, interactionGroups } from '../physics';
import { GrabPhysics } from '../physics/grabPhysics';
import { FpsCamera } from '../player/fpsCamera';
import { PlayerController } from '../player/playerController';
import type { PlayerState } from '../player/playerController';
import { GrabRenderer } from '../render/grabRenderer';
import { createStyleLights } from '../render/lights';
import { getMaterial } from '../render/materials';
import { ProjectileRenderer } from '../render/projectileRenderer';
import { Hud } from '../ui/hud';
import type { Scene } from './index';

const vec3 = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
});
const size = z.object({
  x: z.number().positive(),
  y: z.number().positive(),
  z: z.number().positive(),
});
export const grabTestSchema = z.object({
  playerHealth: z.number().positive(),
  maxEnergy: z.number().positive(),
  energyRegen: z.number().nonnegative(),
  playerSpawn: vec3,
  hint: z.string(),
  enemies: z.array(z.object({ id: z.string(), position: vec3 })),
  crates: z.array(
    z.object({ massKg: z.number().positive(), size, position: vec3 }),
  ),
  arena: z.array(z.object({ size, position: vec3 })),
  director: directorConfigSchema,
});
const data = grabTestSchema.parse(raw);
const loadout = { weapons: [], powers: ['grab'] };
interface Crate {
  id: number;
  body: RigidBody;
  mesh: Mesh;
  previous: Vec3;
  current: Vec3;
  previousRotation: { x: number; y: number; z: number; w: number };
  rotation: { x: number; y: number; z: number; w: number };
  unregister(): void;
}

export class GrabTest implements Scene {
  readonly id = 'grab-test';
  private ctx!: GameContext;
  private three!: ThreeScene;
  private world!: World;
  private rapier!: Awaited<ReturnType<typeof initPhysics>>;
  private entities!: EntityRegistry;
  private damage!: DamageSystem;
  private statuses!: StatusSystem;
  private manager!: EnemyManager;
  private projectiles!: ProjectileSystem;
  private projectileRenderer!: ProjectileRenderer;
  private grabPhysics!: GrabPhysics;
  private grab!: GrabPower;
  private grabRenderer!: GrabRenderer;
  private slots!: PowerSlots;
  private energy!: PlayerEnergy;
  private player!: PlayerController;
  private previous!: PlayerState;
  private camera!: FpsCamera;
  private health!: Health;
  private stats!: Stats;
  private hud?: Hud;
  private hint?: HTMLParagraphElement;
  private readonly hurtboxes = new Hurtboxes();
  private readonly root = new Group();
  private readonly lights = createStyleLights();
  private readonly views = new Map<number, EnemyViewLike>();
  private readonly geometries: BoxGeometry[] = [];
  private readonly crates: Crate[] = [];
  private readonly off: (() => void)[] = [];
  private god = false;
  private readonly rotation = new Quaternion();

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
    this.stats = new Stats({
      maxHealth: data.playerHealth,
      maxEnergy: data.maxEnergy,
      energyRegen: data.energyRegen,
    });
    const id = this.entities.create('player', 'player');
    this.health = new Health(() => this.stats.get('maxHealth'));
    this.damage.register(id, this.health, { stats: this.stats });
    this.player = new PlayerController(
      id,
      this.world,
      ctx,
      data.playerSpawn,
      loadSettings(),
    );
    this.entities.bindCollider(id, this.player.colliderHandle);
    this.hurtboxes.add(id, this.player.colliderHandle);
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
      false,
    );
    this.statuses = new StatusSystem(ctx.bus, this.damage, {
      targets: () => this.manager.grabTargets().map((target) => target.id),
      position: (target) =>
        this.manager
          .grabTargets()
          .find((enemy) => enemy.id === target)
          ?.body.translation() ?? null,
    });
    this.manager = new EnemyManager(
      ctx,
      {
        world: this.world,
        entities: this.entities,
        damage: this.damage,
        hurtboxes: this.hurtboxes,
        projectiles: this.projectiles,
        statuses: this.statuses,
        getTarget: () =>
          this.health.dead
            ? null
            : { id, position: this.player.getState().position },
      },
      { director: data.director },
    );
    this.player.setAimTargets(() => padAimTargets(this.manager));
    this.grabPhysics = new GrabPhysics(this.world, this.entities, () =>
      this.manager.grabTargets(),
    );
    this.energy = new PlayerEnergy(id, this.stats, ctx.bus, ctx.tuning);
    this.grab = createPower('grab', {
      owner: id,
      bus: ctx.bus,
      tuning: ctx.tuning,
      damage: this.damage,
      energy: this.energy,
      aim: () => this.aim(),
      targets: () => [],
      castWall: (origin, dir, distance) =>
        this.world.castRay(
          new Ray(origin, dir),
          distance,
          true,
          QueryFilterFlags.EXCLUDE_SENSORS,
          interactionGroups(0xffff, CollisionGroup.World),
        )?.timeOfImpact ?? null,
      grab: this.grabPhysics,
    }) as GrabPower;
    this.slots = new PowerSlots([this.grab]);
    this.grabRenderer = new GrabRenderer(ctx.tuning);
    this.root.add(
      this.lights,
      this.projectileRenderer.root,
      this.grabRenderer.root,
    );
    three.add(this.root);
    three.background = new Color(ctx.tuning.render.world);
    for (const part of data.arena) {
      this.world.createCollider(
        this.rapier.ColliderDesc.cuboid(
          part.size.x / 2,
          part.size.y / 2,
          part.size.z / 2,
        )
          .setTranslation(part.position.x, part.position.y, part.position.z)
          .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
      );
      this.box(part.size, part.position, 'world');
    }
    if (typeof document !== 'undefined') {
      this.hud = new Hud(ctx.bus, {
        playerId: id,
        loadout,
        onRetry: () => this.reset(),
      });
      this.hint = document.createElement('p');
      this.hint.textContent = data.hint;
      this.hint.style.cssText =
        'position:absolute;top:48px;left:20px;color:#00b8cc;pointer-events:none;max-width:650px';
      document.body.append(this.hint);
    }
    const register = (
      name: string,
      help: string,
      run: (args: string[]) => string,
    ) => {
      const off = ctx.commands?.register(name, help, run);
      if (off) this.off.push(off);
    };
    register('energy', 'energy [n] — energia Rezonansu', (args) => {
      if (!args.length) return `${this.energy.current}`;
      const n = Number(args[0]);
      if (args.length !== 1 || !Number.isFinite(n) || n < 0)
        return 'Podaj nieujemną energię.';
      this.energy.set(n);
      return `Energia: ${this.energy.current}`;
    });
    register('kill held', 'kill held — śmierć trzymanego wroga', () => {
      if (this.grab.heldTarget !== null)
        this.damage.deal(this.grab.heldTarget, {
          source: id,
          amount: Number.MAX_VALUE,
          tags: ['#debug'],
        });
      return 'Zwolniono trzymanego wroga.';
    });
    register('god', 'god — nieśmiertelność', () => {
      this.god = !this.god;
      this.stats.removeBySource('debug:god');
      if (this.god)
        this.stats.add({
          stat: 'damageTaken',
          type: 'mult',
          source: 'debug:god',
          value: 0,
        });
      return `Nieśmiertelność: ${this.god ? 'włączona' : 'wyłączona'}`;
    });
    this.spawn();
    this.world.step();
    this.render(1);
  }

  private box(
    size: Vec3,
    position: Vec3,
    material: 'world' | 'interactive',
  ): Mesh {
    const geometry = new BoxGeometry(size.x, size.y, size.z);
    this.geometries.push(geometry);
    const mesh = new Mesh(geometry, getMaterial(material));
    mesh.position.copy(position);
    this.root.add(mesh);
    return mesh;
  }

  private spawn(): void {
    for (const enemy of data.enemies)
      this.manager.spawn(enemy.id, enemy.position);
    for (const crate of data.crates) {
      if (this.crates.length >= this.ctx.tuning.physics.maxDynamicBodies) break;
      const body = this.world.createRigidBody(
        this.rapier.RigidBodyDesc.dynamic().setTranslation(
          crate.position.x,
          crate.position.y,
          crate.position.z,
        ),
      );
      const collider = this.world.createCollider(
        this.rapier.ColliderDesc.cuboid(
          crate.size.x / 2,
          crate.size.y / 2,
          crate.size.z / 2,
        )
          .setMass(crate.massKg)
          .setCollisionGroups(interactionGroups(CollisionGroup.Debris, 0xffff)),
        body,
      );
      const id = this.entities.create('crate', 'neutral');
      this.entities.bindCollider(id, collider.handle);
      this.crates.push({
        id,
        body,
        mesh: this.box(crate.size, crate.position, 'interactive'),
        previous: { ...crate.position },
        current: { ...crate.position },
        previousRotation: { ...body.rotation() },
        rotation: { ...body.rotation() },
        unregister: this.grabPhysics.registerObject(id, body, crate.massKg),
      });
    }
    this.energy.set(this.energy.max);
    this.ctx.bus.emit('health_changed', {
      id: this.player.id,
      current: this.health.current,
      max: this.health.max,
    });
  }

  private aim(): { origin: Vec3; dir: Vec3 } {
    const s = this.player.getState();
    const t = this.ctx.tuning.player;
    return {
      origin: {
        x: s.position.x,
        y: s.position.y + s.height / 2 - (t.capsuleHeight - t.eyeHeight),
        z: s.position.z,
      },
      dir: {
        x: -Math.sin(s.yaw) * Math.cos(s.pitch),
        y: Math.sin(s.pitch),
        z: -Math.cos(s.yaw) * Math.cos(s.pitch),
      },
    };
  }

  step(dt: number, input: InputSnapshot): void {
    const playerDt = this.ctx.feel?.playerDt(dt) ?? dt;
    this.previous = this.player.getState();
    if (!this.health.dead) this.player.step(playerDt, input);
    this.slots.step(playerDt, input, dt);
    this.hud?.step(playerDt);
    if (!(dt > 0)) {
      this.manager.step(0);
      for (const crate of this.crates) {
        crate.previous = crate.current;
        crate.previousRotation = crate.rotation;
      }
      return;
    }
    this.energy.step(playerDt);
    this.damage.step(dt);
    this.statuses.step(dt);
    this.projectileRenderer.capturePrevious();
    for (const crate of this.crates) {
      crate.previous = crate.current;
      crate.previousRotation = crate.rotation;
    }
    this.manager.step(dt);
    this.world.gravity.y = this.ctx.tuning.physics.gravity;
    this.world.timestep = dt;
    this.world.step();
    this.manager.captureControlled();
    for (const crate of this.crates) {
      crate.current = { ...crate.body.translation() };
      crate.rotation = { ...crate.body.rotation() };
    }
    this.projectiles.step(dt);
  }

  render(alpha: number, frameDt = 1 / 60): void {
    const alive = new Set<number>();
    this.manager.forEach((enemy) => {
      alive.add(enemy.id);
      let view = this.views.get(enemy.id);
      if (!view) {
        view = createEnemyView(enemy, false, this.ctx.bus);
        this.views.set(enemy.id, view);
        this.root.add(view.root);
      }
      view.render(alpha, frameDt);
    });
    for (const [id, view] of this.views)
      if (!alive.has(id)) {
        view.dispose();
        this.views.delete(id);
      }
    for (const crate of this.crates) {
      crate.mesh.position.set(
        crate.previous.x + (crate.current.x - crate.previous.x) * alpha,
        crate.previous.y + (crate.current.y - crate.previous.y) * alpha,
        crate.previous.z + (crate.current.z - crate.previous.z) * alpha,
      );
      crate.mesh.quaternion.copy(crate.previousRotation);
      this.rotation.copy(crate.rotation);
      crate.mesh.quaternion.slerp(this.rotation, alpha);
    }
    const camera = this.ctx.camera;
    if (camera) {
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
    this.grabRenderer.advance(frameDt);
    this.grabRenderer.render(this.grab.beam, alpha, camera);
    this.projectileRenderer.render(alpha);
    this.lights.sync();
  }

  private clearTargets(): void {
    this.slots.reset();
    for (const view of this.views.values()) view.dispose();
    this.views.clear();
    this.manager.despawnAll();
    for (const crate of this.crates.splice(0)) {
      crate.unregister();
      this.entities.destroy(crate.id);
      this.world.removeRigidBody(crate.body);
      crate.mesh.removeFromParent();
      crate.mesh.geometry.dispose();
      const index = this.geometries.indexOf(crate.mesh.geometry as BoxGeometry);
      if (index >= 0) this.geometries.splice(index, 1);
    }
  }

  reset(): void {
    this.clearTargets();
    this.statuses.reset();
    this.projectiles.dispose();
    this.health.reset();
    this.player.teleport(data.playerSpawn);
    this.previous = this.player.getState();
    this.hud?.setLoadout(loadout);
    this.spawn();
  }

  query(name: string): unknown {
    if (name === 'heldTarget') return this.grab.heldTarget;
    if (name === 'energy') return this.energy.current;
    if (name === 'cooldown') return this.grab.cooldownRemaining;
    if (name === 'director') return this.manager.director?.snapshot();
    if (name === 'bodies') return this.world.bodies.len();
    if (name === 'enemyStates') {
      const enemies: unknown[] = [];
      this.manager.forEach((enemy) =>
        enemies.push({
          id: enemy.id,
          kind: enemy.definition.kind,
          controlled: enemy.current.controlled ?? false,
          state: enemy.current.state,
          hp: this.damage.health(enemy.id)?.current,
        }),
      );
      return enemies;
    }
    return undefined;
  }

  dispose(): void {
    this.clearTargets();
    for (const off of this.off.splice(0)) off();
    this.energy.dispose();
    this.statuses.dispose();
    this.projectileRenderer.dispose();
    this.projectiles.dispose();
    this.grabRenderer.dispose();
    this.camera.dispose();
    this.hud?.dispose();
    this.hint?.remove();
    this.damage.unregister(this.player.id);
    this.entities.destroy(this.player.id);
    this.hurtboxes.clear();
    this.player.dispose();
    this.world.free();
    for (const geometry of this.geometries) geometry.dispose();
    this.geometries.length = 0;
    this.root.removeFromParent();
    this.root.clear();
    this.three.background = null;
  }
}
