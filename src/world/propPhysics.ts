import {
  ColliderDesc,
  RigidBodyDesc,
  RigidBodyType,
} from '@dimforge/rapier3d-compat';
import type { Collider, RigidBody, World } from '@dimforge/rapier3d-compat';
import type { EntityRegistry } from '../core/entities';
import type { EntityId, EventBus } from '../core/events';
import type { Vec3 } from '../core/math';
import type { Tuning } from '../core/tuning';
import { DamageSystem, Health, Hurtboxes } from '../combat/damage';
import { CollisionGroup, interactionGroups } from '../physics';
import type { HazardTarget } from './hazards';

export type PropKind = 'crate' | 'crate_small';

/** Pola bloku pokoju, od których zależy zniszczalność. */
export interface PropBlock {
  size: Vec3;
  position: Vec3;
  rotation?: Vec3;
  model?: string;
  destructible?: boolean;
  walkable?: boolean;
  instance?: boolean;
  visible?: boolean;
}

/** Skrzynia zniszczalna: model crate / crate_small, nie platforma, nie instancja, nie wyłączona w danych. */
export function propKindOf(block: PropBlock): PropKind | null {
  if (block.destructible === false) return null;
  if (block.walkable || block.instance || block.visible === false) return null;
  return block.model === 'crate' || block.model === 'crate_small'
    ? block.model
    : null;
}

export interface PropQuat {
  x: number;
  y: number;
  z: number;
  w: number;
}

/** Stan rekwizytu do rysowania (referencje żywe, tylko do odczytu). */
export interface PropView {
  readonly id: EntityId;
  readonly kind: PropKind;
  readonly size: Vec3;
  readonly position: Vec3;
  readonly previousPosition: Vec3;
  readonly quat: PropQuat;
  readonly previousQuat: PropQuat;
  readonly alive: boolean;
  /** true, gdy ciało porusza się (nieuśpione). */
  readonly awake: boolean;
}

interface Prop {
  id: EntityId;
  kind: PropKind;
  size: Vec3;
  home: Vec3;
  alive: boolean;
  collider: Collider;
  body: RigidBody | null;
  slowS: number;
  /** Zamrożone (za daleko od startu): ciało zostaje, ale nie liczy się do limitu. */
  frozen: boolean;
  position: Vec3;
  previousPosition: Vec3;
  quat: PropQuat;
  previousQuat: PropQuat;
  awake: boolean;
  target: HazardTarget;
}

export interface PropPhysicsOptions {
  world: World;
  bus: EventBus;
  damage: DamageSystem;
  entities: EntityRegistry;
  hurtboxes: Hurtboxes;
  tuning: Pick<Tuning, 'props' | 'physics'>;
  /** Środki drzwi pokoju: dynamiczne skrzynie startują daleko od nich. */
  doors?: readonly Vec3[];
  /**
   * true: encje, zdrowie i hurtboxy powstają dopiero w `activate()`. Scena woła je po utworzeniu gracza,
   * żeby identyfikatory encji (gracz = 1) nie zależały od liczby skrzyń.
   */
  deferActivation?: boolean;
}

/** Kwaternion z kątów Eulera (kolejność XYZ jak w three.js). */
export function quatFromEuler(rotation?: Vec3): PropQuat {
  if (!rotation) return { x: 0, y: 0, z: 0, w: 1 };
  const c1 = Math.cos(rotation.x / 2);
  const c2 = Math.cos(rotation.y / 2);
  const c3 = Math.cos(rotation.z / 2);
  const s1 = Math.sin(rotation.x / 2);
  const s2 = Math.sin(rotation.y / 2);
  const s3 = Math.sin(rotation.z / 2);
  return {
    x: s1 * c2 * c3 + c1 * s2 * s3,
    y: c1 * s2 * c3 - s1 * c2 * s3,
    z: c1 * c2 * s3 + s1 * s2 * c3,
    w: c1 * c2 * c3 - s1 * s2 * s3,
  };
}

/**
 * Zniszczalne skrzynie: `crate` (nieruchoma, zniszczalna osłona) i `crate_small` (dynamiczne ciało
 * Rapiera, popychane graczem i trafieniami). Skrzynia ma `Health` w `DamageSystem` i hurtbox jak
 * beczka, więc przyjmują ją pociski, ostrze, moce i wybuchy. Zero losowości: odłamki robi
 * `WorldDebris` ze zdarzenia `prop_destroyed`.
 *
 * Gwarancje: limit ciał `physics.maxPropBodies` (nadmiar zostaje nieruchomy), usypianie powolnych ciał,
 * dynamiczne tylko skrzynie startujące dalej niż `doorClearM + maxDriftM` od drzwi, a ciało, które
 * odpłynie dalej niż `maxDriftM`, jest zamrażane. Rozbicie tylko usuwa collider, więc dostępność
 * pokoju nigdy się nie pogarsza.
 */
export class PropPhysicsSystem {
  private readonly props: Prop[] = [];
  private readonly byEntity = new Map<EntityId, Prop>();
  private readonly off: () => void;
  private readonly targetBuffer: HazardTarget[] = [];
  private bodies = 0;
  /** Encje rozbitych skrzyń: usuwane w następnym kroku (nie w trakcie obsługi `damage_dealt`). */
  private readonly despawn: EntityId[] = [];
  private revisionValue = 0;
  private disposed = false;

  constructor(private readonly options: PropPhysicsOptions) {
    this.off = options.bus.on('damage_dealt', (event) => {
      const prop = this.byEntity.get(event.target);
      if (!prop?.alive) return;
      if (event.killed) this.destroy(prop, event.dir);
      else this.nudge(prop, event.dir, event.knockback);
    });
  }

  /** Rejestruje blok jako rekwizyt. false: nie jest zniszczalną skrzynią (scena buduje go jak dotąd). */
  claim(block: PropBlock): boolean {
    if (this.disposed) return false;
    const kind = propKindOf(block);
    if (!kind) return false;
    const { world, tuning } = this.options;
    const t = tuning.props;
    const { size, position } = block;
    const quat = quatFromEuler(block.rotation);
    const dynamic =
      kind === 'crate_small' &&
      this.bodies < tuning.physics.maxPropBodies &&
      this.farFromDoors(position);
    // World: blokuje ruch i wzrok; Enemy: hurtbox widoczny dla ostrza i pocisków.
    const groups = interactionGroups(
      CollisionGroup.World | CollisionGroup.Enemy,
      0xffff,
    );
    const desc = ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
      .setCollisionGroups(groups)
      .setFriction(t.propFriction)
      .setRestitution(t.propRestitution);
    let body: RigidBody | null = null;
    let collider: Collider;
    if (dynamic) {
      body = world.createRigidBody(
        RigidBodyDesc.dynamic()
          .setTranslation(position.x, position.y, position.z)
          .setRotation(quat)
          .setLinearDamping(t.propDamping)
          .setAngularDamping(t.propDamping)
          .setCanSleep(true)
          .setSleeping(true),
      );
      collider = world.createCollider(desc.setMass(t.smallCrateMassKg), body);
      this.bodies++;
    } else {
      collider = world.createCollider(
        desc
          .setTranslation(position.x, position.y, position.z)
          .setRotation(quat),
      );
    }
    const radius = Math.max(size.x, size.z) / 2;
    const prop: Prop = {
      id: -1,
      kind,
      size: { ...size },
      home: { ...position },
      alive: true,
      collider,
      body,
      slowS: 0,
      frozen: false,
      position: { ...position },
      previousPosition: { ...position },
      quat: { ...quat },
      previousQuat: { ...quat },
      awake: false,
      target: {
        id: -1,
        position: { ...position },
        radius,
        halfHeight: Math.max(0, size.y / 2 - radius),
      },
    };
    this.props.push(prop);
    this.revisionValue++;
    if (!this.options.deferActivation) this.activate();
    return true;
  }

  /** Tworzy encje, zdrowie i hurtboxy rekwizytów zarejestrowanych przez `claim`. */
  activate(): void {
    const { entities, hurtboxes, damage, tuning } = this.options;
    for (const prop of this.props) {
      if (prop.id >= 0) continue;
      const id = entities.create(
        prop.kind === 'crate' ? 'prop_crate' : 'prop_crate_small',
        'neutral',
      );
      prop.id = prop.target.id = id;
      entities.bindCollider(id, prop.collider.handle);
      hurtboxes.add(id, prop.collider);
      const hp =
        prop.kind === 'crate'
          ? tuning.props.crateHealth
          : tuning.props.smallCrateHealth;
      damage.register(id, new Health(() => hp));
      this.byEntity.set(id, prop);
    }
  }

  private farFromDoors(position: Vec3): boolean {
    const { doorClearM, maxDriftM } = this.options.tuning.props;
    const limit = doorClearM + maxDriftM;
    return !(this.options.doors ?? []).some(
      (door) => Math.hypot(door.x - position.x, door.z - position.z) < limit,
    );
  }

  private nudge(prop: Prop, dir: Vec3 | null, knockback: number): void {
    const body = prop.body;
    if (!body || !dir) return;
    const t = this.options.tuning.props;
    const length = Math.hypot(dir.x, dir.y, dir.z);
    if (length < 1e-6) return;
    const impulse =
      (Math.max(0, knockback) + t.hitMinKnockback) * t.hitImpulseScale;
    body.applyImpulse(
      {
        x: (dir.x / length) * impulse,
        y: (dir.y / length) * impulse + t.hitLift * impulse,
        z: (dir.z / length) * impulse,
      },
      true,
    );
  }

  private destroy(prop: Prop, dir: Vec3 | null): void {
    prop.alive = false;
    const { world, entities, hurtboxes, damage, bus } = this.options;
    const center = prop.body ? prop.body.translation() : prop.home;
    entities.unbindCollider(prop.collider.handle);
    hurtboxes.removeEntity(prop.id);
    damage.unregister(prop.id);
    if (prop.body) {
      world.removeRigidBody(prop.body);
      if (!prop.frozen) this.bodies--;
    } else world.removeCollider(prop.collider, true);
    prop.body = null;
    this.despawn.push(prop.id);
    this.revisionValue++;
    bus.emit('prop_destroyed', {
      id: prop.id,
      kind: prop.kind,
      point: { x: center.x, y: center.y, z: center.z },
      size: { ...prop.size },
      dir: dir ? { ...dir } : null,
    });
  }

  /** Wywoływać w każdym kroku symulacji (po `world.step`). */
  step(dt: number): void {
    if (this.disposed) return;
    this.flushDespawn();
    if (!(dt > 0)) return;
    const t = this.options.tuning;
    for (const prop of this.props) {
      const body = prop.body;
      if (!prop.alive || !body || prop.frozen) continue;
      Object.assign(prop.previousPosition, prop.position);
      Object.assign(prop.previousQuat, prop.quat);
      const wasAwake = prop.awake;
      prop.awake = !body.isSleeping();
      // Pozycja odczytywana także w kroku przejścia w sen (ostatni krok solvera).
      if (!prop.awake && !wasAwake) continue;
      const p = body.translation();
      const q = body.rotation();
      prop.position.x = p.x;
      prop.position.y = p.y;
      prop.position.z = p.z;
      prop.quat.x = q.x;
      prop.quat.y = q.y;
      prop.quat.z = q.z;
      prop.quat.w = q.w;
      prop.target.position.x = p.x;
      prop.target.position.y = p.y;
      prop.target.position.z = p.z;
      if (!prop.awake) {
        // Uśpiona: widok ma stanąć dokładnie w pozycji końcowej.
        Object.assign(prop.previousPosition, prop.position);
        Object.assign(prop.previousQuat, prop.quat);
        prop.slowS = 0;
        continue;
      }
      const v = body.linvel();
      const drifted =
        Math.hypot(p.x - prop.home.x, p.z - prop.home.z) > t.props.maxDriftM;
      const fell = p.y < prop.home.y - t.props.fallLimitM;
      if (drifted && !fell) body.setLinvel({ x: 0, y: v.y, z: 0 }, true);
      if (fell || (drifted && Math.abs(v.y) < t.physics.propSleepLinvel)) {
        // Za daleko od startu (albo spadła): zamrażamy dopiero po opadnięciu, żeby nie zawisła w powietrzu.
        body.setLinvel({ x: 0, y: 0, z: 0 }, false);
        body.setAngvel({ x: 0, y: 0, z: 0 }, false);
        body.setBodyType(RigidBodyType.Fixed, false);
        this.bodies--;
        prop.awake = false;
        prop.frozen = true;
        Object.assign(prop.previousPosition, prop.position);
        Object.assign(prop.previousQuat, prop.quat);
        continue;
      }
      const w = body.angvel();
      const slow =
        Math.hypot(v.x, v.y, v.z) < t.physics.propSleepLinvel &&
        Math.hypot(w.x, w.y, w.z) < t.physics.propSleepLinvel;
      prop.slowS = slow ? prop.slowS + dt : 0;
      if (prop.slowS >= t.physics.propSleepDelayS) {
        body.sleep();
        prop.slowS = 0;
      }
    }
  }

  private flushDespawn(): void {
    for (const id of this.despawn.splice(0)) {
      this.byEntity.delete(id);
      this.options.entities.destroy(id);
    }
  }

  /** Żywe rekwizyty do rysowania. */
  forEach(cb: (view: PropView) => void): void {
    for (const prop of this.props) if (prop.alive) cb(prop);
  }

  /** Zmienia się przy dodaniu i zniszczeniu rekwizytu (odświeżenie instancji). */
  get revision(): number {
    return this.revisionValue;
  }

  /** Cele dla wybuchów (HazardSystem): żywe skrzynie jako kapsuły. */
  targets(): readonly HazardTarget[] {
    this.targetBuffer.length = 0;
    for (const prop of this.props)
      if (prop.alive && prop.id >= 0) this.targetBuffer.push(prop.target);
    return this.targetBuffer;
  }

  get aliveCount(): number {
    let n = 0;
    for (const p of this.props) if (p.alive) n++;
    return n;
  }

  /** Liczba ciał dynamicznych (limit `physics.maxPropBodies`). */
  get bodyCount(): number {
    return this.bodies;
  }

  get awakeCount(): number {
    let n = 0;
    for (const p of this.props) if (p.alive && p.awake) n++;
    return n;
  }

  /** Encje żywych skrzyń (test, komendy debug). */
  entityIds(): EntityId[] {
    return this.props.filter((p) => p.alive && p.id >= 0).map((p) => p.id);
  }

  dispose(): void {
    if (this.disposed) return;
    this.flushDespawn();
    const { world, entities, hurtboxes, damage } = this.options;
    for (const prop of this.props) {
      if (!prop.alive) continue;
      prop.alive = false;
      entities.unbindCollider(prop.collider.handle);
      hurtboxes.removeEntity(prop.id);
      damage.unregister(prop.id);
      if (prop.id >= 0) entities.destroy(prop.id);
      try {
        if (prop.body) world.removeRigidBody(prop.body);
        else world.removeCollider(prop.collider, true);
      } catch {
        // Świat bywa już zwolniony przy sprzątaniu sceny.
      }
    }
    this.bodies = 0;
    this.disposed = true;
    this.off();
    this.props.length = 0;
    this.byEntity.clear();
  }
}
