import type { Vec3 } from '../core/math';
import { tuning } from '../core/tuning';
import type { Tuning } from '../core/tuning';

export interface DebrisQuaternion extends Vec3 {
  w: number;
}
export interface DebrisBurst {
  origin: Vec3;
  dir: Vec3 | null;
  strength: number;
  count: number;
  size: number;
  spread?: number;
  bounds?: { halfX: number; halfY: number; halfZ: number };
  /** Barwa żaru krawędzi: 0 = czerwień wroga, 1 = magenta Rezonansu (zabicie mocą). */
  tint?: number;
}
/** Kosmetyczny błysk walki: trafienie (błysk sylwetki) albo zabicie (rozbłysk rozpadu). */
export interface CombatFlash {
  kind: 'hit' | 'kill';
  /** Środek bryły wroga. */
  origin: Vec3;
  /** Punkt trafienia (iskra) albo null. */
  point: Vec3 | null;
  dir: Vec3 | null;
  /** Promień i wysokość bryły (m); dron ma height = 2 * radius. */
  radius: number;
  height: number;
  tint: number;
  /** Ustawienie „Błyski ekranu” wyłączone: bez rdzenia i gwiazdy, przygaszony obrys. */
  muted: boolean;
  age: number;
  previousAge: number;
  life: number;
  /** Bufory slotu (bez alokacji przy każdym trafieniu). */
  pointBuf: Vec3;
  dirBuf: Vec3;
}
const FLASH_SLOTS = 24;
export interface DebrisOptions {
  maxDebris: number;
  floorY?: number;
  /** Odległość trafienia promienia; kierunek jednostkowy, tylko geometria świata. */
  walls?: (pos: Vec3, dir: Vec3, dist: number) => number | null;
  seed?: number;
  tuning?: Tuning['vfx'];
}
interface Fragment {
  pos: Vec3;
  previous: Vec3;
  velocity: Vec3;
  quat: DebrisQuaternion;
  previousQuat: DebrisQuaternion;
  spin: Vec3;
  scale: Vec3;
  renderPos: Vec3;
  renderQuat: DebrisQuaternion;
  renderScale: Vec3;
  age: number;
  previousAge: number;
  lifetime: number;
  serial: number;
  sleeping: boolean;
  tint: number;
}
const vector = (): Vec3 => ({ x: 0, y: 0, z: 0 });
const quaternion = (): DebrisQuaternion => ({ x: 0, y: 0, z: 0, w: 1 });

/** Kosmetyczna kinematyka; stała pula, bez Rapier i bez stanu RNG runu. */
export class DebrisSystem {
  readonly maxDebris: number;
  private readonly pool: Fragment[];
  private readonly settings: Tuning['vfx'];
  private readonly floorY: number;
  private readonly rayDir = vector();
  private rngState: number;
  private serial = 0;
  private count = 0;

  constructor(private readonly opts: DebrisOptions) {
    if (!Number.isSafeInteger(opts.maxDebris) || opts.maxDebris < 1)
      throw new RangeError('maxDebris must be a positive integer');
    this.maxDebris = opts.maxDebris;
    this.settings = opts.tuning ?? tuning.vfx;
    this.floorY = opts.floorY ?? 0;
    this.rngState = opts.seed ?? 0xdecaf;
    this.pool = Array.from({ length: this.maxDebris }, () => ({
      pos: vector(),
      previous: vector(),
      velocity: vector(),
      quat: quaternion(),
      previousQuat: quaternion(),
      spin: vector(),
      scale: vector(),
      renderPos: vector(),
      renderQuat: quaternion(),
      renderScale: vector(),
      age: 0,
      previousAge: 0,
      lifetime: 0,
      serial: 0,
      sleeping: false,
      tint: 0,
    }));
    this.flashes = Array.from({ length: FLASH_SLOTS }, () => ({
      kind: 'hit' as const,
      origin: vector(),
      point: null,
      dir: null,
      radius: 0,
      height: 0,
      tint: 0,
      muted: false,
      age: 0,
      previousAge: 0,
      life: 0,
      pointBuf: vector(),
      dirBuf: vector(),
    }));
  }

  private readonly flashes: CombatFlash[];
  private flashCursor = 0;

  /** Rejestruje błysk walki (czysto kosmetyczny, nie zużywa puli odłamków). */
  flash(spec: {
    kind: 'hit' | 'kill';
    origin: Vec3;
    point?: Vec3 | null;
    dir?: Vec3 | null;
    radius: number;
    height: number;
    tint?: number;
    muted?: boolean;
    life: number;
  }): void {
    if (!(spec.life > 0)) return;
    let slot: CombatFlash | undefined;
    for (const f of this.flashes)
      if (f.life === 0) {
        slot = f;
        break;
      }
    if (!slot) {
      slot = this.flashes[this.flashCursor]!;
      this.flashCursor = (this.flashCursor + 1) % FLASH_SLOTS;
    }
    slot.kind = spec.kind;
    Object.assign(slot.origin, spec.origin);
    slot.point = spec.point ? Object.assign(slot.pointBuf, spec.point) : null;
    slot.dir = spec.dir ? Object.assign(slot.dirBuf, spec.dir) : null;
    slot.muted = spec.muted ?? false;
    slot.radius = spec.radius;
    slot.height = spec.height;
    slot.tint = spec.tint ?? 0;
    slot.age = slot.previousAge = 0;
    slot.life = spec.life;
  }

  /** Aktywne błyski z interpolowanym wiekiem (s); obiekt pożyczony na czas callbacku. */
  forEachFlash(
    cb: (flash: Readonly<CombatFlash>, age: number) => void,
    interpolation = 1,
  ): void {
    const t = Math.max(0, Math.min(1, interpolation));
    for (const f of this.flashes) {
      if (f.life === 0) continue;
      cb(f, f.previousAge + (f.age - f.previousAge) * t);
    }
  }

  get activeFlashes(): number {
    let n = 0;
    for (const f of this.flashes) if (f.life > 0) n++;
    return n;
  }

  get activeCount(): number {
    return this.count;
  }

  private random(): number {
    let t = (this.rngState = (this.rngState + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  burst(spec: DebrisBurst): void {
    const count = Math.max(0, Math.floor(spec.count));
    if (!Number.isFinite(count)) return;
    const dir = spec.dir;
    const length = dir ? Math.hypot(dir.x, dir.y, dir.z) : 0;
    const spread = spec.spread ?? spec.strength * 0.65;
    const bounds = spec.bounds;
    for (let i = 0; i < count; i++) {
      let fragment = this.pool[0]!;
      for (const candidate of this.pool) {
        if (candidate.lifetime === 0) {
          fragment = candidate;
          break;
        }
        if (candidate.serial < fragment.serial) fragment = candidate;
      }
      if (fragment.lifetime === 0) this.count++;
      fragment.serial = ++this.serial;
      fragment.age = fragment.previousAge = 0;
      fragment.lifetime =
        this.settings.debrisLifetimeS * (0.8 + this.random() * 0.4);
      fragment.sleeping = false;
      fragment.tint = spec.tint ?? 0;
      fragment.pos.x =
        spec.origin.x + (this.random() * 2 - 1) * (bounds?.halfX ?? 0);
      fragment.pos.y = Math.max(
        this.floorY,
        spec.origin.y + (this.random() * 2 - 1) * (bounds?.halfY ?? 0),
      );
      fragment.pos.z =
        spec.origin.z + (this.random() * 2 - 1) * (bounds?.halfZ ?? 0);
      Object.assign(fragment.previous, fragment.pos);
      for (const axis of ['x', 'y', 'z'] as const) {
        fragment.velocity[axis] =
          (dir && length > 0 ? (dir[axis] / length) * spec.strength : 0) +
          (this.random() * 2 - 1) * spread;
        fragment.spin[axis] = (this.random() * 2 - 1) * 12;
        fragment.scale[axis] =
          spec.size * (0.7 + this.random() * 0.6) * (axis === 'y' ? 0.25 : 1);
      }
      // Jednostkowy kwaternion: losowa oś i kąt początkowy.
      const axisLength =
        Math.hypot(fragment.spin.x, fragment.spin.y, fragment.spin.z) || 1;
      const angle = this.random() * Math.PI;
      const sin = Math.sin(angle) / axisLength;
      fragment.quat.x = fragment.spin.x * sin;
      fragment.quat.y = fragment.spin.y * sin;
      fragment.quat.z = fragment.spin.z * sin;
      fragment.quat.w = Math.cos(angle);
      Object.assign(fragment.previousQuat, fragment.quat);
    }
  }

  step(dt: number): void {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    for (const f of this.flashes) {
      if (f.life === 0) continue;
      f.previousAge = f.age;
      f.age += dt;
      if (f.age >= f.life) f.life = 0;
    }
    for (const f of this.pool) {
      if (f.lifetime === 0) continue;
      Object.assign(f.previous, f.pos);
      Object.assign(f.previousQuat, f.quat);
      f.previousAge = f.age;
      f.age += dt;
      if (f.age >= f.lifetime) {
        f.lifetime = 0;
        this.count--;
        continue;
      }
      if (f.sleeping) continue;
      f.velocity.y += this.settings.debrisGravity * dt;
      const speed = Math.hypot(f.velocity.x, f.velocity.y, f.velocity.z);
      let travel = speed * dt;
      if (this.opts.walls && speed > 0) {
        this.rayDir.x = f.velocity.x / speed;
        this.rayDir.y = f.velocity.y / speed;
        this.rayDir.z = f.velocity.z / speed;
        const hit = this.opts.walls(f.pos, this.rayDir, travel);
        if (hit !== null && hit >= 0 && hit <= travel) {
          travel = Math.max(0, hit - 0.001);
          f.pos.x += this.rayDir.x * travel;
          f.pos.y += this.rayDir.y * travel;
          f.pos.z += this.rayDir.z * travel;
          // Kontrakt promienia nie zwraca normalnej: odbijamy wzdłuż promienia.
          f.velocity.x *= -0.3;
          f.velocity.y *= -0.3;
          f.velocity.z *= -0.3;
          travel = 0;
        }
      }
      if (travel > 0 && speed > 0) {
        f.pos.x += f.velocity.x * dt;
        f.pos.y += f.velocity.y * dt;
        f.pos.z += f.velocity.z * dt;
      }
      if (f.pos.y <= this.floorY) {
        f.pos.y = this.floorY;
        if (f.velocity.y < 0) f.velocity.y *= -0.3;
        f.velocity.x *= 0.65;
        f.velocity.z *= 0.65;
        if (Math.hypot(f.velocity.x, f.velocity.y, f.velocity.z) < 0.5) {
          f.sleeping = true;
          f.velocity.x = f.velocity.y = f.velocity.z = 0;
        }
      }
      if (!f.sleeping) {
        const q = f.quat;
        const x = q.x,
          y = q.y,
          z = q.z,
          w = q.w;
        const sx = (f.spin.x * dt) / 2,
          sy = (f.spin.y * dt) / 2,
          sz = (f.spin.z * dt) / 2;
        q.x += sx * w + sy * z - sz * y;
        q.y += sy * w + sz * x - sx * z;
        q.z += sz * w + sx * y - sy * x;
        q.w += -sx * x - sy * y - sz * z;
        const norm = Math.hypot(q.x, q.y, q.z, q.w);
        q.x /= norm;
        q.y /= norm;
        q.z /= norm;
        q.w /= norm;
      }
    }
  }

  /**
   * Referencje tylko do odczytu na czas callbacku. interpolation=1: stan bieżący.
   * `age` to interpolowany wiek fragmentu (s), `tint` barwa żaru krawędzi (0 wróg, 1 Rezonans).
   */
  forEachActive(
    cb: (
      pos: Vec3,
      quat: DebrisQuaternion,
      scale: Vec3,
      alpha: number,
      age: number,
      tint: number,
    ) => void,
    interpolation = 1,
  ): void {
    const t = Math.max(0, Math.min(1, interpolation));
    for (const f of this.pool) {
      if (f.lifetime === 0) continue;
      const age = f.previousAge + (f.age - f.previousAge) * t;
      const shrink = Math.min(1, Math.max(0, (f.lifetime - age) / 0.4));
      const sign =
        f.previousQuat.x * f.quat.x +
          f.previousQuat.y * f.quat.y +
          f.previousQuat.z * f.quat.z +
          f.previousQuat.w * f.quat.w <
        0
          ? -1
          : 1;
      for (const axis of ['x', 'y', 'z'] as const) {
        f.renderPos[axis] =
          f.previous[axis] + (f.pos[axis] - f.previous[axis]) * t;
        f.renderQuat[axis] =
          f.previousQuat[axis] * (1 - t) + f.quat[axis] * sign * t;
        f.renderScale[axis] = f.scale[axis] * shrink;
      }
      f.renderQuat.w = f.previousQuat.w * (1 - t) + f.quat.w * sign * t;
      const norm = Math.hypot(
        f.renderQuat.x,
        f.renderQuat.y,
        f.renderQuat.z,
        f.renderQuat.w,
      );
      f.renderQuat.x /= norm;
      f.renderQuat.y /= norm;
      f.renderQuat.z /= norm;
      f.renderQuat.w /= norm;
      cb(f.renderPos, f.renderQuat, f.renderScale, 1, age, f.tint);
    }
  }

  clear(): void {
    for (const f of this.pool) f.lifetime = 0;
    for (const f of this.flashes) f.life = 0;
    this.count = 0;
  }
}
