import { FppViewModel } from '../render/fppViewModel';
import { Ray } from '@dimforge/rapier3d-compat';
import { StatusSystem } from '../combat/status/statusSystem';
import { BeamRenderer } from '../render/beamRenderer';
import { ExplosionRenderer } from '../render/explosionRenderer';
import { BoxGeometry, Color, Group, Mesh } from 'three';
import type { Object3D, Scene as ThreeScene } from 'three';
import type { Collider, World } from '@dimforge/rapier3d-compat';
import { z } from 'zod';
import sceneData from '../data/scenes/weaponsTest.json';
import type { GameContext } from '../core/context';
import { EntityRegistry } from '../core/entities';
import type { EntityId } from '../core/events';
import type { InputSnapshot } from '../core/input';
import { loadSettings } from '../core/save';
import { Stats } from '../core/stats';
import { DamageSystem, Health, Hurtboxes } from '../combat/damage';
import { Weapon } from '../combat/weapons/weapon';
import type { WeaponInput } from '../combat/weapons/weapon';
import {
  weaponDefinitions,
  weaponModelOf,
} from '../combat/weapons/weaponSchema';
import { ProjectileSystem } from '../combat/weapons/projectiles';
import { initPhysics, CollisionGroup, interactionGroups } from '../physics';
import { FppLegs } from '../render/fppLegs';
import { PlayerController } from '../player/playerController';
import type { PlayerState } from '../player/playerController';
import { getMaterial } from '../render/materials';
import { createStyleLights } from '../render/lights';
import { ProjectileRenderer } from '../render/projectileRenderer';
import type { Scene } from './index';

const vector = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
]);
const box = z.object({
  size: vector.refine((v) => v.every((n) => n > 0)),
  position: vector,
});
const data = z
  .object({
    slots: z.tuple([z.string(), z.string(), z.string()]),
    heatCapacity: z.number().positive(),
    coolingRate: z.number().nonnegative(),
    playerSpawn: z.object({ x: z.number().finite(), z: z.number().finite() }),
    floor: box,
    wall: box,
    dummy: z.object({ size: vector, maxHealth: z.number().positive() }),
    dummyPositions: z.array(vector).min(3),
    hudLabel: z.string(),
    controls: z.string(),
  })
  .parse(sceneData);

interface Dummy {
  id: EntityId;
  health: Health;
  model: Mesh;
  collider: Collider;
  respawnS?: number;
}

export class WeaponsTest implements Scene {
  readonly id = 'weapons-test';
  private ctx!: GameContext;
  private three!: ThreeScene;
  private world!: World;
  private entities!: EntityRegistry;
  private damage!: DamageSystem;
  private statuses!: StatusSystem;
  private beamRenderer!: BeamRenderer;
  private explosionRenderer!: ExplosionRenderer;
  private player!: PlayerController;
  private legs?: FppLegs;
  private previous!: PlayerState;
  private projectiles!: ProjectileSystem;
  private projectileRenderer!: ProjectileRenderer;
  private readonly hurtboxes = new Hurtboxes();
  private readonly root = new Group();
  private fppView!: FppViewModel;
  private playerId!: EntityId;
  private shownWeapon = '';
  private readonly weapons = new Map<string, Weapon>();
  private readonly slots = [...data.slots];
  private slot = 0;
  private readonly dummies: Dummy[] = [];
  private readonly off: (() => void)[] = [];
  private lights!: ReturnType<typeof createStyleLights>;
  private cameraParent: Object3D | null = null;
  private hud?: HTMLDivElement;
  private bar?: HTMLDivElement;

  private get weapon(): Weapon {
    return this.weapons.get(this.slots[this.slot]!)!;
  }

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
    this.statuses = new StatusSystem(ctx.bus, this.damage, {
      position: (id) =>
        this.dummies.find((d) => d.id === id)?.model.position ?? null,
      targets: () =>
        this.dummies.filter((d) => !d.health.dead).map((d) => d.id),
    });
    const playerId = this.entities.create('player', 'player');
    this.playerId = playerId;
    this.projectiles = new ProjectileSystem(
      this.world,
      this.entities,
      this.hurtboxes,
      this.damage,
      ctx.bus,
      ctx.tuning,
    );
    const stats = new Stats({
      heatCapacity: data.heatCapacity,
      coolingRate: data.coolingRate,
    });
    for (const definition of weaponDefinitions.values()) {
      this.weapons.set(
        definition.id,
        new Weapon(
          playerId,
          ctx,
          stats,
          {
            projectiles: this.projectiles,
            damage: this.damage,
            castBeam: (origin, dir, rangeM) => {
              const hit = this.world.castRayAndGetNormal(
                new Ray(origin, dir),
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
                    ? box.entity !== playerId
                    : ((collider.collisionGroups() >>> 16) &
                        CollisionGroup.World) !==
                        0;
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
            },
          },
          definition,
        ),
      );
    }
    for (const id of this.slots) {
      if (!this.weapons.has(id))
        throw new Error(`Nieznana broń w slocie: ${id}`);
    }
    this.projectileRenderer = new ProjectileRenderer(
      this.projectiles,
      ctx.tuning.weapons.maxProjectiles,
      false,
    );
    this.beamRenderer = new BeamRenderer();
    this.explosionRenderer = new ExplosionRenderer(ctx.bus);
    this.root.add(this.beamRenderer.root, this.explosionRenderer.root);
    three.background = new Color(ctx.tuning.render.world);
    three.add(this.root);
    this.lights = createStyleLights();
    this.root.add(this.lights, this.projectileRenderer.root);
    for (const geometry of [data.floor, data.wall]) {
      const mesh = new Mesh(
        new BoxGeometry(...geometry.size),
        getMaterial('world'),
      );
      mesh.position.set(...geometry.position);
      this.root.add(mesh);
      this.world.createCollider(
        rapier.ColliderDesc.cuboid(
          geometry.size[0] / 2,
          geometry.size[1] / 2,
          geometry.size[2] / 2,
        )
          .setTranslation(...geometry.position)
          .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
      );
    }
    this.player = new PlayerController(
      playerId,
      this.world,
      ctx,
      {
        ...data.playerSpawn,
        y:
          ctx.tuning.player.capsuleHeight / 2 +
          ctx.tuning.player.controllerOffset,
      },
      loadSettings(),
    );
    this.previous = this.player.getState();
    if (ctx.camera) this.legs = new FppLegs(three, ctx.tuning);
    for (const position of data.dummyPositions) {
      const id = this.entities.create('dummy', 'enemy');
      const stats = new Stats({ maxHealth: data.dummy.maxHealth });
      const health = new Health(() => stats.get('maxHealth'));
      this.damage.register(id, health, { stats });
      const model = new Mesh(
        new BoxGeometry(...data.dummy.size),
        getMaterial('enemy'),
      );
      model.position.set(...position);
      this.root.add(model);
      const collider = this.world.createCollider(
        rapier.ColliderDesc.cuboid(
          data.dummy.size[0] / 2,
          data.dummy.size[1] / 2,
          data.dummy.size[2] / 2,
        )
          .setTranslation(...position)
          .setCollisionGroups(
            interactionGroups(
              CollisionGroup.Enemy,
              CollisionGroup.Player | CollisionGroup.PlayerProjectile,
            ),
          ),
      );
      this.entities.bindCollider(id, collider.handle);
      this.hurtboxes.add(id, collider);
      this.dummies.push({ id, health, model, collider });
    }
    this.fppView = new FppViewModel(ctx.bus, playerId, {
      modelOf: weaponModelOf,
      tuning: ctx.tuning,
    });
    void this.fppView.load(typeof document !== 'undefined');
    this.root.add(this.fppView.root);
    if (ctx.camera) {
      this.cameraParent = ctx.camera.parent;
      this.root.add(ctx.camera);
    }
    this.off.push(
      ctx.bus.on('enemy_killed', ({ id }) => {
        const dummy = this.dummies.find((dummy) => dummy.id === id);
        if (!dummy) return;
        dummy.model.visible = false;
        dummy.collider.setEnabled(false);
        dummy.respawnS = ctx.tuning.damage.respawnS;
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
      'weapon',
      'weapon <id> — wstaw broń do bieżącego slotu',
      (args) => {
        if (args.length !== 1 || !this.weapons.has(args[0]!))
          return `Dostępne bronie: ${[...this.weapons.keys()].join(', ')}`;
        this.slots[this.slot] = args[0]!;
        return `Broń: ${this.weapon.definition.name}`;
      },
    );
    register(
      'heat',
      'heat — poziom ciepła bieżącej broni',
      () => `Ciepło: ${this.weapon.heat.current} / ${this.weapon.heat.max}`,
    );
    register('overheat', 'overheat — przegrzej bieżącą broń', () => {
      this.weapon.overheat();
      return 'Broń przegrzana.';
    });
    if (typeof document !== 'undefined') {
      this.hud = document.createElement('div');
      this.hud.setAttribute('aria-label', data.hudLabel);
      this.hud.style.cssText =
        'position:absolute;left:20px;bottom:24px;width:520px;color:#080808;pointer-events:none';
      const track = document.createElement('div');
      track.style.cssText = 'height:12px;background:#080808';
      this.bar = document.createElement('div');
      this.bar.style.height = '100%';
      track.append(this.bar);
      const help = document.createElement('div');
      help.textContent = data.controls;
      this.hud.append(document.createElement('span'), track, help);
      document.body.append(this.hud);
    }
    this.world.step();
    this.syncWeaponView();
    this.render(1);
  }

  private aim(): WeaponInput {
    const state = this.player.getState();
    return {
      triggerHeld: false,
      origin: {
        x: state.position.x,
        y:
          state.position.y -
          this.ctx.tuning.player.capsuleHeight / 2 +
          this.ctx.tuning.player.eyeHeight,
        z: state.position.z,
      },
      dir: {
        x: -Math.sin(state.yaw) * Math.cos(state.pitch),
        y: Math.sin(state.pitch),
        z: -Math.cos(state.yaw) * Math.cos(state.pitch),
      },
    };
  }

  step(dt: number, input: InputSnapshot): void {
    this.previous = this.player.getState();
    this.player.step(dt, input);
    if (!(dt > 0)) return;
    for (const [index, action] of (
      ['weapon1', 'weapon2', 'weapon3'] as const
    ).entries()) {
      if (input.pressed.has(action)) this.slot = index;
    }
    this.damage.step(dt);
    this.statuses.step(dt);
    for (const dummy of this.dummies) {
      if (dummy.respawnS === undefined) continue;
      dummy.respawnS -= dt;
      if (dummy.respawnS > Number.EPSILON * 16) continue;
      dummy.respawnS = undefined;
      dummy.health.reset();
      dummy.model.visible = true;
      dummy.collider.setEnabled(true);
      this.ctx.bus.emit('health_changed', {
        id: dummy.id,
        current: dummy.health.current,
        max: dummy.health.max,
      });
    }
    this.world.gravity.y = this.ctx.tuning.physics.gravity;
    this.world.timestep = dt;
    this.world.step();
    this.projectileRenderer.capturePrevious();
    const aim = this.aim();
    for (const weapon of this.weapons.values()) {
      weapon.step(dt, {
        ...aim,
        triggerHeld: weapon === this.weapon && input.held.has('attack'),
        coolingPressed:
          weapon === this.weapon && input.pressed.has('coolWeapon'),
      });
    }
    this.projectiles.step(dt);
    this.syncWeaponView();
  }

  /** Widok FPP dostaje bieżącą broń i jej ciepło przez zdarzenia (jak w arenie). */
  private syncWeaponView(): void {
    const id = this.weapon.definition.id;
    if (id === this.shownWeapon) return;
    this.shownWeapon = id;
    this.ctx.bus.emit('weapon_switched', {
      owner: this.playerId,
      weapon: id,
      slot: this.slot,
    });
    this.ctx.bus.emit('heat_changed', {
      id: this.playerId,
      current: this.weapon.heat.current,
      max: this.weapon.heat.max,
      overheated: this.weapon.overheated,
    });
  }

  render(alpha: number, frameDt = 0): void {
    const current = this.player.getState();
    const p = this.previous;
    const camera = this.ctx.camera;
    if (camera) {
      this.legs?.update(p, current, alpha, frameDt);
      camera.position.set(
        p.position.x + (current.position.x - p.position.x) * alpha,
        p.position.y +
          (current.position.y - p.position.y) * alpha -
          this.ctx.tuning.player.capsuleHeight / 2 +
          this.ctx.tuning.player.eyeHeight,
        p.position.z + (current.position.z - p.position.z) * alpha,
      );
      camera.rotation.set(
        p.pitch + (current.pitch - p.pitch) * alpha,
        p.yaw + (current.yaw - p.yaw) * alpha,
        0,
        'YXZ',
      );
    }
    this.lights.sync();
    this.projectileRenderer.render(alpha);
    if (camera) {
      camera.updateMatrixWorld();
      this.fppView.place(camera.matrixWorld, frameDt, {
        held: 'gun',
        horizontalSpeed: Math.hypot(current.velocity.x, current.velocity.z),
      });
    }
    this.beamRenderer.advance(frameDt);
    this.beamRenderer.render(
      this.weapon.beam,
      camera ? this.fppView.beamOriginFor(camera) : this.fppView.beamOrigin,
    );
    this.explosionRenderer.render(frameDt);
    if (this.bar) {
      this.bar.style.width = `${this.weapon.heat.fraction * 100}%`;
      this.bar.style.background = `#${new Color(this.ctx.tuning.render.player).lerp(new Color(this.ctx.tuning.render.enemy), this.weapon.heat.fraction).getHexString()}`;
    }
    const label = this.hud?.firstElementChild;
    if (label)
      label.textContent = `${this.slot + 1}: ${this.weapon.definition.name} | Ciepło: ${Math.round(this.weapon.heat.current)} / ${this.weapon.heat.max}${this.weapon.overheated ? ' — PRZEGRZANIE' : ''} | HP: ${this.dummies.map((d) => d.health.current).join(' / ')} | ${this.dummies
        .map((d) =>
          this.statuses
            .list(d.id)
            .map((s) => `${s.id} ×${s.stacks}`)
            .join(', '),
        )
        .filter(Boolean)
        .join(' / ')}`;
  }

  query(name: string): unknown {
    if (name === 'weapon') return this.weapon.definition.id;
    if (name === 'slot') return this.slot;
    if (name === 'slots') return [...this.slots];
    if (name === 'heat') return this.weapon.heat.current;
    if (name === 'overheated') return this.weapon.overheated;
    if (name === 'weaponHeat')
      return Object.fromEntries(
        [...this.weapons].map(([id, weapon]) => [id, weapon.heat.current]),
      );
    if (name === 'activeProjectiles') return this.projectiles.activeCount;
    if (name === 'dummyHp')
      return this.dummies.map((dummy) => dummy.health.current);
    if (name === 'dummyStatuses')
      return this.dummies.map((d) => this.statuses.list(d.id));
    if (name === 'beam') return this.weapon.beam;
    if (name === 'shots') return this.weapon.shots;
    return undefined;
  }

  dispose(): void {
    for (const off of this.off.splice(0)) off();
    this.hud?.remove();
    this.beamRenderer.dispose();
    this.explosionRenderer.dispose();
    this.statuses.dispose();
    this.projectileRenderer.dispose();
    this.projectiles.dispose();
    this.legs?.dispose();
    this.player.dispose();
    this.hurtboxes.clear();
    for (const id of this.entities.ids()) {
      this.damage.unregister(id);
      this.entities.destroy(id);
    }
    this.world.free();
    this.fppView.dispose();
    if (this.ctx.camera) {
      this.ctx.camera.removeFromParent();
      this.cameraParent?.add(this.ctx.camera);
    }
    this.root.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose();
    });
    this.three.remove(this.root);
    this.root.clear();
    this.weapons.clear();
    this.three.background = null;
  }
}
