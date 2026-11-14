import type { EntityId, EventBus } from '../core/events';
import type { Tuning } from '../core/tuning';
import { makeInstance, ParticlePool } from './fxPool';
import type { FxInstance } from './fxPool';
import type { EnemyBody } from './enemyBody';

export type StatusFxKind = 'flame' | 'spark' | 'star';

export interface StatusVfxOptions {
  /** Interpolowana bryła wroga; null dla gracza i nieznanych encji. */
  bodyOf(id: EntityId, alpha: number): EnemyBody | null;
  tuning: Pick<Tuning, 'vfx'>;
}

interface Effect {
  stacks: number;
  /** Ułamkowa reszta liczby cząsteczek do wyemitowania. */
  carry: number;
}

const MAGENTA = 0xff2bd6;
const WHITE = 0xffffff;
const rand = (): number => Math.random();

/**
 * Kosmetyczne efekty statusów na wrogach: podpalenie (żarzące odłamki), przeciążenie
 * (magentowe łuki) i ogłuszenie (pierścień trójkątów). Start i koniec steruje
 * `status_applied`/`status_expired`, śmierć i despawn wroga, nic nie wpływa na symulację.
 */
export class StatusVfx {
  private readonly effects = new Map<EntityId, Map<string, Effect>>();
  private readonly flames: ParticlePool;
  private readonly sparks: ParticlePool;
  private readonly stars: FxInstance[];
  private starCount = 0;
  private time = 0;
  private readonly off: (() => void)[];

  constructor(
    bus: EventBus,
    private readonly opts: StatusVfxOptions,
  ) {
    const t = opts.tuning.vfx;
    this.flames = new ParticlePool(t.maxStatusFlames);
    this.sparks = new ParticlePool(t.maxStatusSparks);
    this.stars = Array.from({ length: t.maxStatusStars }, makeInstance);
    const stop = (id: EntityId): void => {
      this.effects.delete(id);
    };
    this.off = [
      bus.on('status_applied', ({ target, status, stacks }) => {
        let map = this.effects.get(target);
        if (!map) this.effects.set(target, (map = new Map()));
        const effect = map.get(status);
        if (effect) effect.stacks = stacks;
        else map.set(status, { stacks, carry: 0 });
      }),
      bus.on('status_expired', ({ target, status }) => {
        const map = this.effects.get(target);
        map?.delete(status);
        if (map?.size === 0) this.effects.delete(target);
      }),
      bus.on('enemy_killed', ({ id }) => stop(id)),
      bus.on('entity_despawned', ({ id }) => stop(id)),
    ];
  }

  /** Liczba aktywnych instancji danego rodzaju. */
  count(kind: StatusFxKind): number {
    return kind === 'flame'
      ? this.flames.count
      : kind === 'spark'
        ? this.sparks.count
        : this.starCount;
  }

  /** Czy wróg ma aktywny efekt statusu. */
  active(id: EntityId, status: string): boolean {
    return this.effects.get(id)?.has(status) ?? false;
  }

  get trackedTargets(): number {
    return this.effects.size;
  }

  /** Czas klatki w sekundach (zegar ścienny, nie symulacji). */
  update(dt: number, alpha: number): void {
    const t = this.opts.tuning.vfx;
    if (dt > 0) {
      this.time += dt;
      this.flames.step(dt);
      this.sparks.step(dt);
    }
    this.starCount = 0;
    for (const [id, map] of this.effects) {
      const body = this.opts.bodyOf(id, alpha);
      if (!body) continue;
      for (const [status, effect] of map) {
        if (status === 'burning') this.emitFlames(body, effect, dt, t);
        else if (status === 'overload') this.emitSparks(body, effect, dt, t);
        else if (status === 'stunned') this.placeStars(body, t);
      }
    }
  }

  forEach(kind: StatusFxKind, cb: (instance: FxInstance) => void): void {
    const t = this.opts.tuning.vfx;
    if (kind === 'star') {
      for (let i = 0; i < this.starCount; i++) cb(this.stars[i]!);
      return;
    }
    const pool = kind === 'flame' ? this.flames : this.sparks;
    const instance = scratch;
    for (const p of pool.particles) {
      if (p.life === 0) continue;
      const k = p.age / p.life;
      if (kind === 'flame') {
        const s = t.statusFlameSizeM * p.size * (1 - k);
        instance.sx = instance.sz = s * 0.7;
        instance.sy = s * 1.7;
        instance.dx = p.vx;
        instance.dy = p.vy;
        instance.dz = p.vz;
        instance.color = WHITE;
      } else {
        instance.sx = instance.sz = t.statusSparkWidthM;
        instance.sy = t.statusSparkLengthM * p.size * (1 - k * 0.5);
        instance.dx = p.vx;
        instance.dy = p.vy;
        instance.dz = p.vz;
        instance.color = MAGENTA;
      }
      instance.x = p.x;
      instance.y = p.y;
      instance.z = p.z;
      instance.roll = p.age * 9;
      cb(instance);
    }
  }

  clear(): void {
    this.effects.clear();
    this.flames.clear();
    this.sparks.clear();
    this.starCount = 0;
  }

  dispose(): void {
    for (const off of this.off) off();
    this.clear();
  }

  private emitFlames(
    body: EnemyBody,
    effect: Effect,
    dt: number,
    t: Tuning['vfx'],
  ): void {
    if (!(dt > 0)) return;
    effect.carry += t.statusFlameRate * dt;
    while (effect.carry >= 1) {
      effect.carry -= 1;
      const angle = rand() * Math.PI * 2;
      const r = body.radius * 0.9 * Math.sqrt(rand());
      const p = this.flames.spawn(t.statusFlameLifeS * (0.7 + rand() * 0.6));
      p.x = body.x + Math.cos(angle) * r;
      p.z = body.z + Math.sin(angle) * r;
      p.y = body.y + rand() * body.height * 0.9;
      p.vx = (rand() - 0.5) * 0.5;
      p.vz = (rand() - 0.5) * 0.5;
      p.vy = t.statusFlameRiseMS * (0.7 + rand() * 0.6);
      p.size = 0.7 + rand() * 0.6;
    }
  }

  private emitSparks(
    body: EnemyBody,
    effect: Effect,
    dt: number,
    t: Tuning['vfx'],
  ): void {
    if (!(dt > 0)) return;
    effect.carry += t.statusSparkRate * Math.max(1, effect.stacks) * dt;
    while (effect.carry >= 1) {
      effect.carry -= 1;
      const angle = rand() * Math.PI * 2;
      const r = body.radius * (0.9 + rand() * 0.5);
      const p = this.sparks.spawn(t.statusSparkLifeS * (0.6 + rand() * 0.8));
      p.x = body.x + Math.cos(angle) * r;
      p.z = body.z + Math.sin(angle) * r;
      p.y = body.y + rand() * body.height;
      // Łuk leży stycznie do korpusu z losowym przechyłem.
      p.vx = -Math.sin(angle) + (rand() - 0.5) * 1.2;
      p.vz = Math.cos(angle) + (rand() - 0.5) * 1.2;
      p.vy = (rand() - 0.5) * 1.6;
      const n = Math.hypot(p.vx, p.vy, p.vz) || 1;
      p.vx /= n;
      p.vy /= n;
      p.vz /= n;
      p.size = 0.5 + rand() * 0.7;
      // Jednostkowa prędkość to oś łuku i lekki dryf w ciągu krótkiego życia.
    }
  }

  private placeStars(body: EnemyBody, t: Tuning['vfx']): void {
    for (let i = 0; i < t.statusStarCount; i++) {
      if (this.starCount >= this.stars.length) return;
      const s = this.stars[this.starCount++]!;
      const angle =
        this.time * t.statusStarSpinRadS +
        (i / t.statusStarCount) * Math.PI * 2;
      s.x = body.x + Math.cos(angle) * t.statusStarRadiusM;
      s.z = body.z + Math.sin(angle) * t.statusStarRadiusM;
      s.y =
        body.y + body.height + 0.22 + Math.sin(this.time * 5 + i * 1.7) * 0.04;
      s.sx = s.sy = s.sz = t.statusStarSizeM;
      s.dx = Math.cos(angle);
      s.dy = 0;
      s.dz = Math.sin(angle);
      s.roll = this.time * 3 + i;
      s.color = WHITE;
    }
  }
}

const scratch = makeInstance();
