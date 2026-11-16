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
/** Jasny rdzeń łuku przeciążenia (blady róż — nadal czytany jako Rezonans). */
const MAGENTA_CORE = 0xffb8f2;
const WHITE = 0xffffff;
/** Segmenty jednego łuku przeciążenia (zygzak). */
const ARC_SEGMENTS = 3;
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
        // Język ognia: szybko rośnie, potem wydłuża się i zwęża (zamiast równych rombów).
        const grow = Math.min(1, k * 5);
        const s = t.statusFlameSizeM * p.size * grow * (1 - k) ** 0.7;
        instance.sx = instance.sz = s * (0.8 - k * 0.35);
        instance.sy = s * (1.9 + k * 1.2);
        // Oś płomienia pionowa z lekkim chybotaniem; dryf poziomy nie przechyla języka.
        instance.dx = p.vx * 0.35;
        instance.dy = 1;
        instance.dz = p.vz * 0.35;
        instance.color = WHITE;
      } else {
        // Odcinek łuku: cienki, pełna długość do końca krótkiego życia, potem gaśnie skracając się.
        const fade = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
        instance.sx = instance.sz = t.statusSparkWidthM * (0.3 + 0.25 * fade);
        instance.sy = t.statusSparkLengthM * p.size * fade;
        instance.dx = p.vx;
        instance.dy = p.vy;
        instance.dz = p.vz;
        instance.color = p.color || MAGENTA;
      }
      instance.x = p.x;
      instance.y = p.y;
      instance.z = p.z;
      instance.roll = kind === 'flame' ? p.size * 6 + p.age * 4 : p.age * 9;
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
      // Płomienie liżą powierzchnię bryły (nie unoszą się metr nad głową): krótsze życie u góry.
      const r = body.radius * (0.75 + rand() * 0.35);
      const h = rand() ** 0.8;
      const p = this.flames.spawn(
        t.statusFlameLifeS * (0.45 + rand() * 0.45) * (1 - h * 0.45),
      );
      p.x = body.x + Math.cos(angle) * r;
      p.z = body.z + Math.sin(angle) * r;
      p.y = body.y + h * body.height * 0.92;
      p.vx = Math.cos(angle) * 0.25 + (rand() - 0.5) * 0.35;
      p.vz = Math.sin(angle) * 0.25 + (rand() - 0.5) * 0.35;
      p.vy = t.statusFlameRiseMS * (0.45 + rand() * 0.4);
      p.size = 0.6 + rand() * 0.7;
    }
  }

  private emitSparks(
    body: EnemyBody,
    effect: Effect,
    dt: number,
    t: Tuning['vfx'],
  ): void {
    if (!(dt > 0)) return;
    // Łuk to ARC_SEGMENTS instancji: połowa częstości łuków daje ~1,5x dawnej liczby odcinków.
    effect.carry += (t.statusSparkRate * Math.max(1, effect.stacks) * dt) / 2;
    while (effect.carry >= 1) {
      effect.carry -= 1;
      // Jeden łuk = zygzak z ARC_SEGMENTS odcinków, przyklejony stycznie do korpusu.
      let angle = rand() * Math.PI * 2;
      const r = body.radius * (0.95 + rand() * 0.35);
      let x = body.x + Math.cos(angle) * r;
      let z = body.z + Math.sin(angle) * r;
      let y = body.y + (0.15 + rand() * 0.8) * body.height;
      const spin = rand() < 0.5 ? -1 : 1;
      const climb = (rand() - 0.5) * 1.4;
      const life = t.statusSparkLifeS * (0.6 + rand() * 0.8);
      const len = t.statusSparkLengthM * (0.35 + rand() * 0.25);
      for (let i = 0; i < ARC_SEGMENTS; i++) {
        const kink = i % 2 === 0 ? 0.9 : -0.9;
        let dx = -Math.sin(angle) * spin + Math.cos(angle) * kink * 0.25;
        let dz = Math.cos(angle) * spin + Math.sin(angle) * kink * 0.25;
        let dy = climb + kink * (0.6 + rand() * 0.6);
        const n = Math.hypot(dx, dy, dz) || 1;
        dx /= n;
        dy /= n;
        dz /= n;
        const p = this.sparks.spawn(life);
        p.size = len / Math.max(1e-3, t.statusSparkLengthM);
        p.x = x + (dx * len) / 2;
        p.y = y + (dy * len) / 2;
        p.z = z + (dz * len) / 2;
        // Mała prędkość: oś odcinka, prawie bez dryfu — zygzak się nie rozrywa.
        p.vx = dx * 0.12;
        p.vy = dy * 0.12;
        p.vz = dz * 0.12;
        p.color = i === 1 ? MAGENTA_CORE : MAGENTA;
        x += dx * len;
        y += dy * len;
        z += dz * len;
        angle = Math.atan2(z - body.z, x - body.x);
      }
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
