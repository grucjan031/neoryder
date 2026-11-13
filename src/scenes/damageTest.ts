import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import type { Scene as ThreeScene } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Collider, World } from '@dimforge/rapier3d-compat';
import type { GameContext } from '../core/context';
import type { GameEvents } from '../core/events';
import type { InputSnapshot } from '../core/input';
import type { Vec3 } from '../core/math';
import { EntityRegistry } from '../core/entities';
import { Stats } from '../core/stats';
import {
  DamageSystem,
  Health,
  Hitbox,
  Hurtboxes,
  queryHurtboxes,
} from '../combat/damage';
import { initPhysics, CollisionGroup, interactionGroups } from '../physics';
import { palette } from '../render/palette';
import type { Scene } from './index';

const torso = { x: 0, y: 1.2, z: 0 };
const cameraPosition = { x: 0, y: 1.2, z: 3 };
const direction = { x: 0, y: 0, z: -1 };

export class DamageTest implements Scene {
  readonly id = 'damage-test';
  private ctx!: GameContext;
  private three!: ThreeScene;
  private world!: World;
  private rapier!: Awaited<ReturnType<typeof initPhysics>>;
  private entities!: EntityRegistry;
  private damage!: DamageSystem;
  private dummy!: number;
  private player!: number;
  private readonly stats = new Stats({ maxHealth: 100 });
  private readonly health = new Health(() => this.stats.get('maxHealth'));
  private readonly hurtboxes = new Hurtboxes();
  private readonly colliders: Collider[] = [];
  private readonly root = new Group();
  private readonly model = new Group();
  private readonly off: (() => void)[] = [];
  private slashes: Hitbox[] = [];
  private respawnRemaining: number | undefined;
  private lastDamage: GameEvents['damage_dealt'] | undefined;
  private label?: HTMLParagraphElement;

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
    this.player = this.entities.create('player', 'player');
    this.dummy = this.entities.create('trooper', 'enemy');
    this.damage.register(this.dummy, this.health, { stats: this.stats });
    for (const [desc, multiplier] of [
      [
        this.rapier.ColliderDesc.capsule(0.35, 0.3).setTranslation(0, 1.05, 0),
        1,
      ],
      [this.rapier.ColliderDesc.ball(0.22).setTranslation(0, 1.65, 0), 1.5],
    ] as const) {
      const collider = this.world.createCollider(
        desc.setCollisionGroups(
          interactionGroups(CollisionGroup.Enemy, CollisionGroup.Player),
        ),
      );
      this.colliders.push(collider);
      this.entities.bindCollider(this.dummy, collider.handle);
      this.hurtboxes.add(this.dummy, collider, multiplier);
    }
    this.world.step();
    three.background = new Color(palette.background);
    three.add(this.root);
    this.root.add(new AmbientLight(0xffffff, 2));
    const light = new DirectionalLight(0xffffff, 3);
    light.position.set(5, 10, 5);
    this.root.add(light);
    const floor = new Mesh(
      new BoxGeometry(20, 1, 20),
      new MeshStandardMaterial({ color: palette.environment, roughness: 1 }),
    );
    floor.position.y = -0.5;
    this.root.add(floor, this.model);
    const fallback = new Mesh(
      new BoxGeometry(0.6, 1.8, 0.6),
      new MeshStandardMaterial({ color: palette.enemy, flatShading: true }),
    );
    fallback.position.y = 0.9;
    this.model.add(fallback);
    if (this.loadModels) {
      try {
        const gltf = await new GLTFLoader().loadAsync(
          '/assets/models/enemy_trooper.glb',
        );
        this.model.remove(fallback);
        fallback.geometry.dispose();
        fallback.material.dispose();
        this.model.add(gltf.scene);
      } catch {
        // Prosta bryła zastępuje niedostępny model.
      }
    }
    if (ctx.camera) {
      ctx.camera.position.copy(cameraPosition);
      ctx.camera.lookAt(torso.x, torso.y, torso.z);
    }
    if (typeof document !== 'undefined') {
      this.label = document.createElement('p');
      this.label.setAttribute('aria-label', 'Zdrowie manekina');
      this.label.style.cssText =
        'position:absolute;top:48px;left:20px;color:#e0262b;pointer-events:none';
      document.body.append(this.label);
    }
    this.off.push(
      ctx.bus.on('damage_dealt', (payload) => {
        if (payload.target === this.dummy) this.lastDamage = payload;
      }),
      ctx.bus.on('health_changed', ({ id, current, max }) => {
        if (id === this.dummy && this.label)
          this.label.textContent = `Manekin: ${current} / ${max} HP`;
      }),
      ctx.bus.on('enemy_killed', ({ id }) => {
        if (id !== this.dummy) return;
        this.model.visible = false;
        for (const collider of this.colliders) collider.setEnabled(false);
        this.respawnRemaining = ctx.tuning.damage.respawnS;
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
    register('hit', 'hit <dmg>', (args) => {
      const amount = Number(args[0]);
      if (args.length !== 1 || !Number.isFinite(amount) || amount < 0)
        return 'Podaj skończoną liczbę nieujemną.';
      const dealt = this.damage.deal(this.dummy, {
        amount,
        source: this.player,
        tags: ['#debug'],
        point: { ...torso },
        dir: this.attackDirection(),
      });
      return `Obrażenia: ${dealt}`;
    });
    register('heal', 'heal', () => {
      this.restore();
      return 'Zdrowie przywrócone.';
    });
    register('block', 'block on|off', (args) => {
      if (args.length !== 1 || (args[0] !== 'on' && args[0] !== 'off'))
        return 'Użyj block on|off.';
      this.stats.removeBySource('block');
      if (args[0] === 'on')
        this.stats.add({
          stat: 'damageTaken',
          type: 'mult',
          value: 0.3,
          source: 'block',
        });
      return `Blok: ${args[0]}`;
    });
    register('slash', 'slash', () => {
      const hitbox = new Hitbox({
        owner: this.player,
        team: 'player',
        damage: 25,
        tags: ['#debug'],
        lifetimeS: 0.1,
      });
      this.slashes.push(hitbox);
      this.strike(hitbox);
      return 'Cięcie.';
    });
    this.emitHealth();
  }

  private attackDirection(): Vec3 {
    const camera = this.ctx.camera?.position ?? cameraPosition;
    const x = torso.x - camera.x;
    const y = torso.y - camera.y;
    const z = torso.z - camera.z;
    const length = Math.hypot(x, y, z);
    return length > 0
      ? { x: x / length, y: y / length, z: z / length }
      : { ...direction };
  }

  private strike(hitbox: Hitbox): void {
    for (const hurtbox of queryHurtboxes(
      this.world,
      this.hurtboxes,
      new this.rapier.Cuboid(0.7, 0.7, 1),
      torso,
      { x: 0, y: 0, z: 0, w: 1 },
      interactionGroups(CollisionGroup.Player, CollisionGroup.Enemy),
    )) {
      hitbox.strike(hurtbox.entity, this.damage, {
        multiplier: hurtbox.multiplier,
        point: { ...torso },
        dir: this.attackDirection(),
      });
    }
  }

  private emitHealth(): void {
    this.ctx.bus.emit('health_changed', {
      id: this.dummy,
      current: this.health.current,
      max: this.health.max,
    });
  }

  private restore(): void {
    this.health.reset();
    this.respawnRemaining = undefined;
    this.model.visible = true;
    for (const collider of this.colliders) collider.setEnabled(true);
    this.world.step();
    this.emitHealth();
  }

  step(dt: number, _input: InputSnapshot): void {
    void _input;
    if (dt <= 0) return;
    this.damage.step(dt);
    if (this.respawnRemaining !== undefined) {
      this.respawnRemaining -= dt;
      if (
        this.respawnRemaining <=
        Number.EPSILON * Math.max(1, this.ctx.tuning.damage.respawnS)
      )
        this.restore();
    }
    for (const hitbox of this.slashes) {
      hitbox.step(dt);
      this.strike(hitbox);
    }
    this.slashes = this.slashes.filter((hitbox) => !hitbox.expired);
  }

  render(_alpha: number): void {
    void _alpha;
  }

  query(name: string): unknown {
    if (name === 'dummyHp') return this.health.current;
    if (name === 'dummyAlive') return !this.health.dead;
    if (name === 'lastDamage') return this.lastDamage;
    return undefined;
  }

  dispose(): void {
    for (const off of this.off.splice(0)) off();
    this.label?.remove();
    this.damage.unregister(this.dummy);
    this.entities.destroy(this.dummy);
    this.entities.destroy(this.player);
    this.hurtboxes.clear();
    this.world.free();
    this.slashes = [];
    this.root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) material.dispose();
    });
    this.three.remove(this.root);
    this.root.clear();
    this.three.background = null;
  }
}
