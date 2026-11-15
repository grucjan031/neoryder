import { ColliderDesc } from '@dimforge/rapier3d-compat';
import type { Collider, World } from '@dimforge/rapier3d-compat';
import type { EntityRegistry } from '../core/entities';
import type { EntityId, EventBus } from '../core/events';
import type { Vec3 } from '../core/math';
import type { Tuning } from '../core/tuning';
import { DamageSystem, Health, Hurtboxes } from '../combat/damage';
import { CollisionGroup, interactionGroups } from '../physics';
import type { Hazard } from './roomSchema';

export interface HazardState {
  id: string;
  kind: Hazard['kind'];
  phase: 'off' | 'warn' | 'on';
  alive: boolean;
  phaseT: number;
}

export interface HazardTarget {
  id: EntityId;
  /** Środek kapsuły; halfHeight to połowa długości jej osi, bez półkul. */
  position: Vec3;
  radius: number;
  halfHeight: number;
}

interface HazardOptions {
  bus: EventBus;
  damage: DamageSystem;
  entities: EntityRegistry;
  hurtboxes: Hurtboxes;
  world: World;
  playerId: EntityId;
  hazards: readonly Hazard[];
  tuning: Tuning['hazards'];
  targets(): readonly HazardTarget[];
}

interface Entry {
  definition: Hazard;
  state: HazardState;
  target?: HazardTarget;
  alive: boolean;
  tickS: number;
  laserUntil: Map<EntityId, number>;
  entity?: EntityId;
  collider?: Collider;
  pending?: { at: number; source: EntityId | null };
}

/** Odległość od odcinka do pionowej osi kapsuły, także dla drona (oś długości 0). */
function capsuleDistance(from: Vec3, to: Vec3, target: HazardTarget): number {
  const p = target.position;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const low = p.y - target.halfHeight;
  const high = p.y + target.halfHeight;
  const lowT = dy === 0 ? 0 : Math.max(0, Math.min(1, (low - from.y) / dy));
  const highT = dy === 0 ? 1 : Math.max(0, Math.min(1, (high - from.y) / dy));
  const first = Math.min(lowT, highT);
  const second = Math.max(lowT, highT);
  let best = Infinity;
  for (let i = 0; i < 3; i++) {
    const a = i === 0 ? 0 : i === 1 ? first : second;
    const b = i === 0 ? first : i === 1 ? second : 1;
    const middleY = from.y + (dy * (a + b)) / 2;
    const endY = Math.max(low, Math.min(high, middleY));
    const vertical = middleY < low || middleY > high;
    const denominator = dx * dx + dz * dz + (vertical ? dy * dy : 0);
    const numerator =
      (from.x - p.x) * dx +
      (from.z - p.z) * dz +
      (vertical ? (from.y - endY) * dy : 0);
    const t =
      denominator === 0
        ? a
        : Math.max(a, Math.min(b, -numerator / denominator));
    const y = from.y + dy * t;
    best = Math.min(
      best,
      Math.hypot(
        from.x + dx * t - p.x,
        y - Math.max(low, Math.min(high, y)),
        from.z + dz * t - p.z,
      ),
    );
  }
  return best;
}

export class HazardSystem {
  private readonly entries: Entry[];
  private readonly off: () => void;
  private timeS = 0;
  private disposed = false;
  private stepping = false;
  private readonly stepTargets: HazardTarget[] = [];
  private readonly activeIds = new Set<EntityId>();

  constructor(private readonly options: HazardOptions) {
    this.entries = options.hazards.map((definition) => {
      const entry: Entry = {
        definition,
        alive: true,
        tickS: 0,
        laserUntil: new Map(),
        state: {
          id: definition.id,
          kind: definition.kind,
          alive: true,
          phase: 'off',
          phaseT: 0,
        },
      };
      if (definition.kind === 'explosive_barrel') {
        const id = options.entities.create('explosive_barrel', 'neutral');
        entry.entity = id;
        const p = definition.position;
        entry.target = {
          id,
          position: { x: p.x, y: p.y + 0.55, z: p.z },
          radius: 0.4,
          halfHeight: 0.15,
        };
        entry.collider = options.world.createCollider(
          ColliderDesc.cylinder(0.55, 0.4)
            .setTranslation(p.x, p.y + 0.55, p.z)
            // World blokuje ruch; Enemy udostępnia hurtbox istniejącym zapytaniom ostrza.
            .setCollisionGroups(
              interactionGroups(
                CollisionGroup.World | CollisionGroup.Enemy,
                0xffff,
              ),
            ),
        );
        options.entities.bindCollider(id, entry.collider.handle);
        options.hurtboxes.add(id, entry.collider);
        options.damage.register(
          id,
          new Health(() => options.tuning.barrelHealth),
        );
      }
      return entry;
    });
    this.off = options.bus.on('damage_dealt', (event) => {
      if (!event.killed) return;
      const entry = this.entries.find((e) => e.entity === event.target);
      if (entry?.alive) this.explode(entry, event.source);
    });
  }

  private phase(entry: Entry): HazardState {
    const d = entry.definition;
    const state = entry.state;
    state.alive = entry.alive;
    const cycle = d.kind === 'explosive_barrel' ? undefined : d.cycle;
    if (!cycle) {
      state.phase = entry.alive ? 'on' : 'off';
      state.phaseT = 0;
      return state;
    }
    const time = (this.timeS + (cycle.offsetS ?? 0)) % (cycle.offS + cycle.onS);
    const warn = Math.min(Math.max(0, this.options.tuning.warnS), cycle.offS);
    if (time >= cycle.offS) {
      state.phase = 'on';
      state.phaseT = (time - cycle.offS) / cycle.onS;
    } else if (warn > 0 && time >= cycle.offS - warn) {
      state.phase = 'warn';
      state.phaseT = (time - cycle.offS + warn) / warn;
    } else {
      state.phase = 'off';
      state.phaseT = time / (cycle.offS - warn);
    }
    return state;
  }

  state(): HazardState[] {
    return this.entries.map((e) => ({ ...this.phase(e) }));
  }

  targetIds(): EntityId[] {
    return this.entries.flatMap((e) =>
      e.alive && e.entity !== undefined ? [e.entity] : [],
    );
  }

  private targets(result: HazardTarget[]): HazardTarget[] {
    result.length = 0;
    for (const target of this.options.targets()) result.push(target);
    for (const e of this.entries)
      if (e.alive && e.target) result.push(e.target);
    return result;
  }

  step(dt: number): void {
    if (this.disposed || !(dt > 0)) return;
    this.timeS += dt;
    for (const e of this.entries) {
      if (e.alive && e.pending && this.timeS + 1e-9 >= e.pending.at)
        this.kill(e, e.pending.source);
    }
    const targets = this.targets(this.stepTargets);
    this.activeIds.clear();
    for (const target of targets) this.activeIds.add(target.id);
    const t = this.options.tuning;
    this.stepping = true;
    try {
      for (const e of this.entries) {
        const d = e.definition;
        if (d.kind === 'explosive_barrel') continue;
        if (this.phase(e).phase !== 'on') {
          e.tickS = 0;
          continue;
        }
        if (d.kind === 'electric_field') {
          e.tickS += dt;
          if (!(t.electricTickS > 0)) continue;
          while (e.tickS + 1e-9 >= t.electricTickS) {
            e.tickS -= t.electricTickS;
            for (const target of targets) {
              const p = target.position;
              if (
                Math.abs(p.x - d.position.x) > d.size.x / 2 ||
                Math.abs(p.y - d.position.y) > d.size.y / 2 ||
                Math.abs(p.z - d.position.z) > d.size.z / 2
              )
                continue;
              this.options.damage.deal(target.id, {
                source: null,
                amount: t.electricDamage,
                point: { ...p },
                tags: ['#hazard', '#elektrycznosc'],
                statuses: [{ id: 'overload', durationS: t.electricOverloadS }],
              });
            }
          }
        } else {
          for (const id of e.laserUntil.keys())
            if (!this.activeIds.has(id)) e.laserUntil.delete(id);
          for (const target of targets) {
            if (
              this.timeS + 1e-9 < (e.laserUntil.get(target.id) ?? 0) ||
              capsuleDistance(d.from, d.to, target) >=
                t.laserRadiusM + target.radius
            )
              continue;
            e.laserUntil.set(target.id, this.timeS + t.laserInvulnS);
            this.options.damage.deal(target.id, {
              source: null,
              amount: t.laserDamage,
              point: { ...target.position },
              tags: ['#hazard', '#laser'],
            });
          }
        }
      }
    } finally {
      this.stepping = false;
    }
  }

  detonate(id: string): boolean {
    if (this.disposed) return false;
    const e = this.entries.find((entry) => entry.definition.id === id);
    if (!e?.alive || e.entity === undefined) return false;
    this.kill(e, this.options.playerId);
    return true;
  }

  private kill(entry: Entry, source: EntityId | null): void {
    this.options.damage.deal(entry.entity!, {
      source,
      amount: this.options.damage.health(entry.entity!)?.current ?? 0,
      tags: ['#hazard', '#explosion', '#friendly_fire'],
    });
  }

  private removeCollider(entry: Entry): void {
    if (!entry.collider) return;
    this.options.entities.unbindCollider(entry.collider.handle);
    this.options.hurtboxes.removeEntity(entry.entity!);
    this.options.world.removeCollider(entry.collider, true);
    delete entry.collider;
  }

  private explode(entry: Entry, source: EntityId | null): void {
    if (!entry.alive || entry.definition.kind !== 'explosive_barrel') return;
    entry.alive = false;
    delete entry.pending;
    this.removeCollider(entry);
    const point = {
      ...entry.definition.position,
      y: entry.definition.position.y + 0.55,
    };
    const { bus, damage, tuning: t, playerId } = this.options;
    const tags = ['#hazard', '#explosion', '#friendly_fire'];
    bus.emit('explosion', {
      point,
      radiusM: t.barrelRadiusM,
      owner: source ?? playerId,
      tags,
    });
    // W kroku używamy tej samej migawki, by nie nadpisać obiektów puli callbacku.
    for (const target of this.stepping ? this.stepTargets : this.targets([])) {
      const dx = target.position.x - point.x;
      const dy = target.position.y - point.y;
      const dz = target.position.z - point.z;
      const distance = Math.hypot(dx, dy, dz);
      if (distance > t.barrelRadiusM) continue;
      const barrel = this.entries.find((e) => e.entity === target.id);
      if (barrel) {
        if (barrel.alive)
          barrel.pending ??= { at: this.timeS + t.barrelChainDelayS, source };
        continue;
      }
      const frac =
        1 - ((1 - t.barrelMinDamageFrac) * distance) / t.barrelRadiusM;
      damage.deal(target.id, {
        source,
        amount: t.barrelDamage * frac,
        tags,
        point: { ...target.position },
        knockback: t.barrelKnockback,
        dir:
          distance > 0
            ? { x: dx / distance, y: dy / distance, z: dz / distance }
            : { x: 0, y: 1, z: 0 },
      });
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.off();
    this.stepTargets.length = 0;
    this.activeIds.clear();
    for (const entry of this.entries) {
      this.removeCollider(entry);
      if (entry.entity !== undefined) {
        this.options.damage.unregister(entry.entity);
        this.options.entities.destroy(entry.entity);
      }
      entry.alive = false;
      entry.laserUntil.clear();
      delete entry.pending;
    }
  }
}
