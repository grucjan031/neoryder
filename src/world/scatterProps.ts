import { ColliderDesc, RigidBodyDesc } from '@dimforge/rapier3d-compat';
import type { Collider, RigidBody, World } from '@dimforge/rapier3d-compat';
import type { EntityId, EventBus } from '../core/events';
import type { Vec3 } from '../core/math';
import type { Tuning } from '../core/tuning';
import { CollisionGroup, interactionGroups } from '../physics';
import type { PropQuat } from './propPhysics';

/** Modele dekoracji, które da się przewrócić (kształt i masa w `tuning.props.scatter`). */
export const SCATTER_MODELS = ['city_traffic_cone', 'city_trash_bags'] as const;
export type ScatterModel = (typeof SCATTER_MODELS)[number];

export function isScatterModel(model: string): model is ScatterModel {
  return (SCATTER_MODELS as readonly string[]).includes(model);
}

export interface ScatterSpec {
  model: ScatterModel;
  position: Vec3;
  yaw: number;
}

/** Stan wywracalnej dekoracji do rysowania: pozycja podstawy modelu i obrót. */
export interface ScatterView {
  readonly model: ScatterModel;
  /** Środek podstawy modelu (początek modelu GLB). */
  readonly position: Vec3;
  readonly previousPosition: Vec3;
  readonly quat: PropQuat;
  readonly previousQuat: PropQuat;
  readonly moving: boolean;
}

interface Item {
  model: ScatterModel;
  /** Środek bryły (nad podstawą o połowę wysokości). */
  center: Vec3;
  quat: PropQuat;
  previousCenter: Vec3;
  previousQuat: PropQuat;
  body: RigidBody | null;
  collider: Collider | null;
  slowS: number;
  /** Jedna klatka rysowania po zwolnieniu ciała (pozycja końcowa). */
  settle: boolean;
  base: Vec3;
  /** Zdarzenia sąsiedztwa liczą się raz na zbliżenie (do czasu oddalenia). */
  touched: boolean;
  view: {
    model: ScatterModel;
    position: Vec3;
    previousPosition: Vec3;
    quat: PropQuat;
    previousQuat: PropQuat;
    moving: boolean;
  };
}

export interface ScatterPlayer {
  position: Vec3;
  velocity: Vec3;
  sliding: boolean;
  sprinting: boolean;
  dashS: number;
}

export interface ScatterOptions {
  world: World;
  bus: EventBus;
  tuning: Pick<Tuning, 'props'>;
  playerId: EntityId;
}

function yawQuat(yaw: number): PropQuat {
  return { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
}

function rotate(q: PropQuat, v: Vec3): Vec3 {
  // v' = v + 2w(q × v) + 2 q × (q × v)
  const cx = q.y * v.z - q.z * v.y;
  const cy = q.z * v.x - q.x * v.z;
  const cz = q.x * v.y - q.y * v.x;
  return {
    x: v.x + 2 * (q.w * cx + q.y * cz - q.z * cy),
    y: v.y + 2 * (q.w * cy + q.z * cx - q.x * cz),
    z: v.z + 2 * (q.w * cz + q.x * cy - q.y * cx),
  };
}

/**
 * Lekkie dekoracje uliczne (pachołki, worki), które przewracają się pod wpływem dashu, ślizgu, sprintu
 * gracza i wybuchów. Ciało dynamiczne powstaje dopiero w chwili zakłócenia (limit
 * `props.scatterMaxBodies`), a po uspokojeniu jest usuwane: dekoracja zostaje w pozie końcowej. Grupa `Debris` z filtrem
 * `World`: nigdy nie blokuje gracza, wrogów, pocisków ani wzroku. Zero losowości: kierunek obrotu
 * wynika z pozycji dekoracji i kierunku impulsu.
 */
export class ScatterProps {
  private readonly items: Item[] = [];
  private bodies = 0;
  private readonly off: (() => void)[];
  private playerPosition: Vec3 | null = null;
  private disposed = false;

  constructor(private readonly options: ScatterOptions) {
    const { bus, tuning, playerId } = options;
    this.off = [
      bus.on('explosion', ({ point, radiusM }) => {
        const radius = radiusM + tuning.props.scatterRadiusM;
        for (const item of this.items)
          this.push(
            item,
            point,
            radius,
            tuning.props.scatterImpulse * tuning.props.scatterExplosionMult,
          );
      }),
      bus.on('dash_used', ({ user }) => {
        if (user !== playerId || !this.playerPosition) return;
        for (const item of this.items)
          this.push(
            item,
            this.playerPosition,
            tuning.props.scatterRadiusM,
            tuning.props.scatterImpulse,
          );
      }),
    ];
  }

  /** Rejestruje dekorację; zwraca indeks widoku. */
  add(spec: ScatterSpec): number {
    const shape = this.options.tuning.props.scatter[spec.model];
    const quat = yawQuat(spec.yaw);
    const center = {
      x: spec.position.x,
      y: spec.position.y + shape.heightM / 2,
      z: spec.position.z,
    };
    const base = { ...spec.position };
    this.items.push({
      model: spec.model,
      center,
      quat,
      previousCenter: { ...center },
      previousQuat: { ...quat },
      body: null,
      collider: null,
      slowS: 0,
      settle: false,
      base: { ...spec.position },
      touched: false,
      view: {
        model: spec.model,
        position: { ...base },
        previousPosition: { ...base },
        quat,
        previousQuat: { ...quat },
        moving: false,
      },
    });
    return this.items.length - 1;
  }

  get count(): number {
    return this.items.length;
  }

  get bodyCount(): number {
    return this.bodies;
  }

  /** Impuls od punktu `from` (poziomo, z lekkim wzniesieniem). */
  private push(item: Item, from: Vec3, radius: number, speed: number): void {
    const dx = item.center.x - from.x;
    const dz = item.center.z - from.z;
    const distance = Math.hypot(dx, dz);
    if (distance > radius) return;
    const body = this.wake(item);
    if (!body) return;
    const t = this.options.tuning.props;
    const length = distance > 1e-3 ? distance : 1;
    const dirX = distance > 1e-3 ? dx / length : 1;
    const dirZ = distance > 1e-3 ? dz / length : 0;
    const k = speed * (1 - 0.5 * (distance / radius));
    const mass = t.scatter[item.model].massKg;
    body.applyImpulse(
      { x: dirX * k * mass, y: t.scatterLift * k * mass, z: dirZ * k * mass },
      true,
    );
    // Obrót wokół osi poziomej prostopadłej do kierunku: koziołkowanie w stronę odrzutu.
    body.applyTorqueImpulse(
      {
        x: dirZ * k * mass * t.scatterTorque,
        y: 0,
        z: -dirX * k * mass * t.scatterTorque,
      },
      true,
    );
  }

  private wake(item: Item): RigidBody | null {
    if (item.body) return item.body;
    const t = this.options.tuning.props;
    if (this.bodies >= t.scatterMaxBodies || this.disposed) return null;
    const shape = t.scatter[item.model];
    const { world } = this.options;
    const body = world.createRigidBody(
      RigidBodyDesc.dynamic()
        .setTranslation(item.center.x, item.center.y, item.center.z)
        .setRotation(item.quat)
        .setLinearDamping(t.propDamping)
        .setAngularDamping(t.propDamping)
        .setCanSleep(true),
    );
    item.collider = world.createCollider(
      ColliderDesc.cuboid(shape.radiusM, shape.heightM / 2, shape.radiusM)
        .setMass(shape.massKg)
        .setFriction(t.propFriction)
        .setRestitution(t.scatterRestitution)
        // Czysto kosmetyczne: kolidują tylko ze światem (bez gracza, wrogów i pocisków).
        .setCollisionGroups(
          interactionGroups(CollisionGroup.Debris, CollisionGroup.World),
        ),
      body,
    );
    item.body = body;
    item.slowS = 0;
    this.bodies++;
    return body;
  }

  private release(item: Item): void {
    if (!item.body) return;
    this.options.world.removeRigidBody(item.body);
    item.body = null;
    item.collider = null;
    item.settle = true;
    Object.assign(item.previousCenter, item.center);
    Object.assign(item.previousQuat, item.quat);
    this.bodies--;
  }

  /** Po `world.step`: gracz w ślizgu, sprincie lub dashu zahacza o dekoracje w zasięgu. */
  step(dt: number, player: ScatterPlayer): void {
    if (this.disposed || !(dt > 0)) return;
    const t = this.options.tuning.props;
    this.playerPosition = player.position;
    const speed = Math.hypot(player.velocity.x, player.velocity.z);
    const fast =
      (player.sliding || player.sprinting || player.dashS > 0) &&
      speed >= t.scatterMinSpeed;
    for (const item of this.items) {
      Object.assign(item.previousCenter, item.center);
      Object.assign(item.previousQuat, item.quat);
      if (fast) {
        const near =
          Math.hypot(
            item.center.x - player.position.x,
            item.center.z - player.position.z,
          ) < t.scatterTouchM;
        if (near && !item.touched)
          this.push(
            item,
            player.position,
            t.scatterTouchM,
            speed * t.scatterTouchSpeedMult,
          );
        item.touched = near;
      } else item.touched = false;
      const body = item.body;
      if (!body) continue;
      const p = body.translation();
      const q = body.rotation();
      item.center.x = p.x;
      item.center.y = p.y;
      item.center.z = p.z;
      item.quat.x = q.x;
      item.quat.y = q.y;
      item.quat.z = q.z;
      item.quat.w = q.w;
      const v = body.linvel();
      const w = body.angvel();
      const slow =
        Math.hypot(v.x, v.y, v.z) <
          this.options.tuning.props.scatterSleepSpeed &&
        Math.hypot(w.x, w.y, w.z) < this.options.tuning.props.scatterSleepSpeed;
      item.slowS = slow ? item.slowS + dt : 0;
      if (
        item.slowS >= t.scatterSleepS ||
        item.center.y < item.base.y - t.fallLimitM
      )
        this.release(item);
    }
  }

  /** Widoki do rysowania (obiekt jest ponownie używany; odczyt tylko w callbacku). */
  forEach(cb: (index: number, view: ScatterView) => void): void {
    this.items.forEach((item, index) => {
      const moving = item.body !== null || item.settle;
      if (!item.body) item.settle = false;
      if (moving) {
        const half = this.options.tuning.props.scatter[item.model].heightM / 2;
        const offset = rotate(item.quat, { x: 0, y: -half, z: 0 });
        const previousOffset = rotate(item.previousQuat, {
          x: 0,
          y: -half,
          z: 0,
        });
        item.view.position.x = item.center.x + offset.x;
        item.view.position.y = item.center.y + offset.y;
        item.view.position.z = item.center.z + offset.z;
        item.view.previousPosition.x = item.previousCenter.x + previousOffset.x;
        item.view.previousPosition.y = item.previousCenter.y + previousOffset.y;
        item.view.previousPosition.z = item.previousCenter.z + previousOffset.z;
      }
      item.view.model = item.model;
      item.view.quat = item.quat;
      item.view.previousQuat = item.previousQuat;
      item.view.moving = moving;
      cb(index, item.view);
    });
  }

  dispose(): void {
    if (this.disposed) return;
    for (const item of this.items) this.release(item);
    this.disposed = true;
    for (const off of this.off) off();
    this.off.length = 0;
    this.items.length = 0;
  }
}
