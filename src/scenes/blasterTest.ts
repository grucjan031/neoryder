import { BoxGeometry, Color, Group, Mesh, MeshBasicMaterial } from 'three';
import type { Material, Object3D, Scene as ThreeScene } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Collider, World } from '@dimforge/rapier3d-compat';
import type { GameContext } from '../core/context';
import { EntityRegistry } from '../core/entities';
import type { EntityId } from '../core/events';
import type { InputSnapshot } from '../core/input';
import { loadSettings } from '../core/save';
import { Stats } from '../core/stats';
import { DamageSystem, Health, Hurtboxes } from '../combat/damage';
import { Blaster } from '../combat/weapons/blaster';
import type { BlasterInput } from '../combat/weapons/blaster';
import { ProjectileSystem } from '../combat/weapons/projectiles';
import { initPhysics, CollisionGroup, interactionGroups } from '../physics';
import { PlayerController } from '../player/playerController';
import type { PlayerState } from '../player/playerController';
import { applyStyle, getMaterial } from '../render/materials';
import { createStyleLights } from '../render/lights';
import { ProjectileRenderer } from '../render/projectileRenderer';
import type { Scene } from './index';
import hudText from '../data/ui/hud.pl.json';

interface Dummy {
  id: EntityId;
  health: Health;
  model: Group;
  colliders: Collider[];
  respawnS: number | undefined;
}

export class BlasterTest implements Scene {
  readonly id = 'blaster-test';
  private ctx!: GameContext;
  private three!: ThreeScene;
  private world!: World;
  private entities!: EntityRegistry;
  private damage!: DamageSystem;
  private player!: PlayerController;
  private playerId!: EntityId;
  private previous!: PlayerState;
  private blaster!: Blaster;
  private projectiles!: ProjectileSystem;
  private projectileRenderer!: ProjectileRenderer;
  private readonly hurtboxes = new Hurtboxes();
  private readonly root = new Group();
  private readonly weapon = new Group();
  private readonly dummies: Dummy[] = [];
  private readonly off: (() => void)[] = [];
  private readonly ownedMaterials = new Set<Material>();
  private readonly heatMaterials: MeshBasicMaterial[] = [];
  private lights!: ReturnType<typeof createStyleLights>;
  private cameraParent: Object3D | null = null;
  private queuedShots = 0;
  private hud?: HTMLDivElement;
  private bar?: HTMLDivElement;

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
    this.playerId = this.entities.create('player', 'player');
    this.projectiles = new ProjectileSystem(
      this.world,
      this.entities,
      this.hurtboxes,
      this.damage,
      ctx.bus,
      ctx.tuning,
    );
    this.blaster = new Blaster(
      this.playerId,
      ctx,
      new Stats({ heatCapacity: 100, coolingRate: 45 }),
      this.projectiles,
    );
    this.projectileRenderer = new ProjectileRenderer(
      this.projectiles,
      ctx.tuning.weapons.maxProjectiles,
    );
    three.background = new Color(ctx.tuning.render.world);
    three.add(this.root);
    this.lights = createStyleLights();
    this.root.add(this.lights, this.projectileRenderer.root);
    const floor = new Mesh(new BoxGeometry(30, 1, 30), getMaterial('world'));
    floor.position.y = -0.5;
    this.root.add(floor);
    this.world.createCollider(
      rapier.ColliderDesc.cuboid(15, 0.5, 15)
        .setTranslation(0, -0.5, 0)
        .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
    );
    const wall = new Mesh(new BoxGeometry(20, 4, 0.5), getMaterial('world'));
    wall.position.set(0, 2, -10);
    this.root.add(wall);
    this.world.createCollider(
      rapier.ColliderDesc.cuboid(10, 2, 0.25)
        .setTranslation(0, 2, -10)
        .setCollisionGroups(interactionGroups(CollisionGroup.World, 0xffff)),
    );
    this.player = new PlayerController(
      this.playerId,
      this.world,
      ctx,
      {
        x: 0,
        y:
          ctx.tuning.player.capsuleHeight / 2 +
          ctx.tuning.player.controllerOffset,
        z: 3,
      },
      loadSettings(),
    );
    this.previous = this.player.getState();
    for (const x of [-3, 0, 3]) {
      const id = this.entities.create('trooper', 'enemy');
      const stats = new Stats({ maxHealth: 100 });
      const health = new Health(() => stats.get('maxHealth'));
      this.damage.register(id, health, { stats });
      const model = new Group();
      model.position.set(x, 0, -5);
      this.root.add(model);
      await this.addModel(
        model,
        'enemy_trooper',
        new Mesh(new BoxGeometry(0.6, 1.8, 0.6), getMaterial('enemy')),
      );
      const colliders: Collider[] = [];
      for (const [desc, multiplier] of [
        [rapier.ColliderDesc.capsule(0.35, 0.3).setTranslation(x, 1.05, -5), 1],
        [rapier.ColliderDesc.ball(0.22).setTranslation(x, 1.65, -5), 1.5],
      ] as const) {
        const collider = this.world.createCollider(
          desc.setCollisionGroups(
            interactionGroups(
              CollisionGroup.Enemy,
              CollisionGroup.Player | CollisionGroup.PlayerProjectile,
            ),
          ),
        );
        this.entities.bindCollider(id, collider.handle);
        this.hurtboxes.add(id, collider, multiplier);
        colliders.push(collider);
      }
      this.dummies.push({ id, health, model, colliders, respawnS: undefined });
    }
    this.weapon.position.set(0.3, -0.28, -0.55);
    const fallback = new Mesh(
      new BoxGeometry(0.16, 0.18, 0.5),
      getMaterial('interactive'),
    );
    await this.addModel(this.weapon, 'blaster', fallback);
    for (const name of ['heat_vents', 'heat_cell']) {
      const node = this.weapon.getObjectByName(name);
      node?.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const material = new MeshBasicMaterial({
          color: ctx.tuning.render.player,
          toneMapped: false,
        });
        this.ownedMaterials.add(material);
        this.heatMaterials.push(material);
        object.material = material;
      });
    }
    if (ctx.camera) {
      this.cameraParent = ctx.camera.parent;
      this.root.add(ctx.camera);
      ctx.camera.add(this.weapon);
    }
    this.off.push(
      ctx.bus.on('enemy_killed', ({ id }) => {
        const dummy = this.dummies.find((dummy) => dummy.id === id);
        if (!dummy) return;
        dummy.model.visible = false;
        for (const collider of dummy.colliders) collider.setEnabled(false);
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
    register('fire', 'fire <n> — kolejkuj strzały przed siebie', (args) => {
      const count = Number(args[0]);
      if (args.length !== 1 || !Number.isSafeInteger(count) || count < 1)
        return 'Podaj dodatnią całkowitą liczbę strzałów.';
      this.queuedShots += count;
      return `Strzały w kolejce: ${this.queuedShots}`;
    });
    register(
      'heat',
      'heat — poziom ciepła',
      () => `Ciepło: ${this.blaster.heat.current} / ${this.blaster.heat.max}`,
    );
    register('overheat', 'overheat — przegrzej blaster', () => {
      this.blaster.overheat();
      return 'Blaster przegrzany.';
    });
    if (ctx.debug && typeof document !== 'undefined') {
      this.hud = document.createElement('div');
      this.hud.setAttribute('aria-label', 'Ciepło blastera');
      this.hud.style.cssText =
        'position:absolute;left:20px;bottom:24px;width:260px;color:white;pointer-events:none';
      const track = document.createElement('div');
      track.style.cssText = 'height:12px;background:#080808';
      this.bar = document.createElement('div');
      this.bar.style.height = '100%';
      track.append(this.bar);
      this.hud.append(document.createElement('span'), track);
      document.body.append(this.hud);
    }
    this.world.step();
    this.render(1);
  }

  private async addModel(
    root: Group,
    name: string,
    fallback: Mesh,
  ): Promise<void> {
    if (name === 'enemy_trooper') fallback.position.y = 0.9;
    root.add(fallback);
    if (!this.loadModels) return;
    try {
      const gltf = await new GLTFLoader().loadAsync(
        `/assets/models/${name}.glb`,
      );
      const sourceMaterials = new Set<Material>();
      gltf.scene.traverse((object) => {
        if (object instanceof Mesh)
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            sourceMaterials.add(material);
      });
      applyStyle(gltf.scene);
      for (const material of sourceMaterials) material.dispose();
      root.remove(fallback);
      fallback.geometry.dispose();
      root.add(gltf.scene);
    } catch {
      // Brak modelu nie zatrzymuje grywalnej sceny testowej.
    }
  }

  private aim(): BlasterInput {
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
    this.damage.step(dt);
    for (const dummy of this.dummies) {
      if (dummy.respawnS === undefined) continue;
      dummy.respawnS -= dt;
      if (dummy.respawnS > Number.EPSILON * 16) continue;
      dummy.respawnS = undefined;
      dummy.health.reset();
      dummy.model.visible = true;
      for (const collider of dummy.colliders) collider.setEnabled(true);
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
    const shots = this.blaster.shots;
    this.blaster.step(dt, {
      ...this.aim(),
      triggerHeld: input.held.has('attack') || this.queuedShots > 0,
      coolingPressed: input.pressed.has('coolWeapon'),
    });
    if (this.blaster.shots > shots && this.queuedShots > 0) this.queuedShots--;
    this.projectiles.step(dt);
  }

  render(alpha: number): void {
    const current = this.player.getState();
    const p = this.previous;
    const camera = this.ctx.camera;
    if (camera) {
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
    const color = new Color(this.ctx.tuning.render.player).lerp(
      new Color(this.ctx.tuning.render.enemy),
      this.blaster.heat.fraction,
    );
    for (const material of this.heatMaterials) material.color.copy(color);
    if (this.bar) {
      this.bar.style.width = `${this.blaster.heat.fraction * 100}%`;
      this.bar.style.background = `#${color.getHexString()}`;
    }
    const label = this.hud?.firstElementChild;
    if (label) {
      const phase = this.blaster.coolingPhase;
      label.textContent = `Ciepło: ${Math.round(this.blaster.heat.current)} / ${this.blaster.heat.max}${phase ? ' — ' + hudText.activeCooling[phase] : ''} | HP: ${this.dummies.map((d) => d.health.current).join(' / ')}`;
    }
  }

  query(name: string): unknown {
    if (name === 'heat') return this.blaster.heat.current;
    if (name === 'overheated') return this.blaster.overheated;
    if (name === 'coolingPhase') return this.blaster.coolingPhase;
    if (name === 'activeProjectiles') return this.projectiles.activeCount;
    if (name === 'dummyHp')
      return this.dummies.map((dummy) => dummy.health.current);
    if (name === 'shots') return this.blaster.shots;
    return undefined;
  }

  dispose(): void {
    for (const off of this.off.splice(0)) off();
    this.hud?.remove();
    this.projectileRenderer.dispose();
    this.projectiles.dispose();
    this.player.dispose();
    this.hurtboxes.clear();
    for (const id of this.entities.ids()) {
      this.damage.unregister(id);
      this.entities.destroy(id);
    }
    this.world.free();
    this.weapon.removeFromParent();
    this.weapon.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose();
    });
    if (this.ctx.camera) {
      this.ctx.camera.removeFromParent();
      this.cameraParent?.add(this.ctx.camera);
    }
    this.root.traverse((object) => {
      if (object instanceof Mesh) object.geometry.dispose();
    });
    for (const material of this.ownedMaterials) material.dispose();
    this.three.remove(this.root);
    this.root.clear();
    this.weapon.clear();
    this.three.background = null;
  }
}
