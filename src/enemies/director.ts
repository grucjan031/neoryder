import { z } from 'zod';
import type { EntityId, EventBus } from '../core/events';
import type { Vec3 } from '../core/math';

const positive = z.number().finite().positive();
const slotPool = z.object({
  /** Liczba slotów (kątów) wokół gracza. */
  count: z.number().int().positive().max(32),
  /** Kąt pierwszego slotu od osi +Z, w stopniach. */
  offsetDeg: z.number().finite(),
});
/** Konfiguracja dyrektora z danych sceny (`director` w src/data/scenes/*.json). */
export const directorConfigSchema = z.object({
  /** Ilu wrogów naraz może atakować wręcz. */
  attackTokens: z.number().int().positive(),
  /** Ilu wrogów naraz może strzelać (ostrzał zaporowy = 1–2 na zmianę). */
  shotTokens: z.number().int().positive(),
  /** Bezpiecznik: token wraca do puli po tym czasie, nawet bez releaseToken. */
  maxHoldS: positive,
  /** Co ile sekund przydział slotów jest liczony od nowa (najbliższy wolny). */
  reassignS: positive,
  /** Wysokość promienia gracz→slot nad pozycją celu (osłony niższe od niej nie blokują). */
  probeHeightM: z.number().finite().nonnegative(),
  slots: z.object({ melee: slotPool, shot: slotPool }),
});
export type DirectorConfig = z.infer<typeof directorConfigSchema>;
export type TokenKind = 'melee' | 'shot';

export interface EnemyDirectorApi {
  /** true = może atakować teraz. Wołane co krok, gdy wróg chce zacząć atak; kolejka FIFO. */
  requestToken(id: EntityId, kind: TokenKind): boolean;
  /** Koniec ataku, ogłuszenie, śmierć. Bez tokenu nic nie robi. */
  releaseToken(id: EntityId): void;
  /** Punkt flankowania na okręgu `radiusM` wokół celu; null, gdy brak celu lub wolnego slotu. Wołane co krok. */
  slot(id: EntityId, kind: TokenKind, radiusM: number): Vec3 | null;
}

export interface DirectorDeps {
  target(): { id: EntityId; position: Vec3 } | null;
  position(id: EntityId): Vec3 | null;
  /** false, gdy odcinek gracz→slot przecina świat. Bez tej funkcji każdy slot jest dostępny. */
  clear?(from: Vec3, to: Vec3): boolean;
}

export interface DirectorSnapshot {
  tokens: Record<TokenKind, EntityId[]>;
  waiting: Record<TokenKind, EntityId[]>;
  slots: Record<TokenKind, (EntityId | null)[]>;
}

const KINDS: readonly TokenKind[] = ['melee', 'shot'];
const epsilon = 1e-6;

interface Assignment {
  index: number;
  radiusM: number;
  seen: boolean;
}
interface Pool {
  readonly angles: readonly number[];
  readonly owners: (EntityId | null)[];
  readonly byId: Map<EntityId, Assignment>;
}

/**
 * Koordynacja grupy wrogów (F2-12): ograniczona liczba jednoczesnych ataków wręcz i strzałów
 * (tokeny w kolejce FIFO — zwolniony token trafia do najdłużej czekającego, więc strzelcy
 * strzelają na zmianę) oraz sloty flankowania: kąty wokół gracza, każdy wróg na własnym promieniu.
 * Zgłoszenia (requestToken, slot), których wróg nie ponowił w kroku, wygasają w `step`.
 * Właściciel (EnemyManager) woła `step` raz na krok symulacji, po krokach wrogów.
 */
export class EnemyDirector implements EnemyDirectorApi {
  private readonly holders = new Map<
    EntityId,
    { kind: TokenKind; heldS: number }
  >();
  private readonly waiting: Record<TokenKind, EntityId[]> = {
    melee: [],
    shot: [],
  };
  private readonly seen: Record<TokenKind, Set<EntityId>> = {
    melee: new Set(),
    shot: new Set(),
  };
  private readonly pools: Record<TokenKind, Pool>;
  private sinceReassignS = 0;
  private readonly off: (() => void)[];

  constructor(
    bus: EventBus,
    private readonly config: DirectorConfig,
    private readonly deps: DirectorDeps,
  ) {
    const pool = ({ count, offsetDeg }: DirectorConfig['slots']['melee']) => ({
      angles: Array.from(
        { length: count },
        (_, i) => ((offsetDeg + (360 * i) / count) * Math.PI) / 180,
      ),
      owners: Array.from({ length: count }, (): EntityId | null => null),
      byId: new Map<EntityId, Assignment>(),
    });
    this.pools = {
      melee: pool(config.slots.melee),
      shot: pool(config.slots.shot),
    };
    this.off = [
      bus.on('enemy_killed', ({ id }) => this.forget(id)),
      bus.on('entity_despawned', ({ id }) => this.forget(id)),
      bus.on('enemy_stunned', ({ id }) => this.releaseToken(id)),
      bus.on('status_applied', ({ target, status }) => {
        if (status === 'stunned') this.releaseToken(target);
      }),
    ];
  }

  private capacity(kind: TokenKind): number {
    return kind === 'melee' ? this.config.attackTokens : this.config.shotTokens;
  }

  private held(kind: TokenKind): number {
    let n = 0;
    for (const holder of this.holders.values()) if (holder.kind === kind) n++;
    return n;
  }

  requestToken(id: EntityId, kind: TokenKind): boolean {
    const holder = this.holders.get(id);
    if (holder) return holder.kind === kind;
    const queue = this.waiting[kind];
    let index = queue.indexOf(id);
    if (index < 0) index = queue.push(id) - 1;
    this.seen[kind].add(id);
    if (index >= this.capacity(kind) - this.held(kind)) return false;
    queue.splice(index, 1);
    this.seen[kind].delete(id);
    this.holders.set(id, { kind, heldS: 0 });
    return true;
  }

  releaseToken(id: EntityId): void {
    this.holders.delete(id);
    for (const kind of KINDS) {
      const queue = this.waiting[kind];
      const index = queue.indexOf(id);
      if (index >= 0) queue.splice(index, 1);
      this.seen[kind].delete(id);
    }
  }

  slot(id: EntityId, kind: TokenKind, radiusM: number): Vec3 | null {
    const target = this.deps.target();
    if (!target) return null;
    const pool = this.pools[kind];
    let assignment = pool.byId.get(id);
    if (assignment && assignment.radiusM !== radiusM) {
      this.unassign(pool, id);
      assignment = undefined;
    }
    if (!assignment) {
      const from = this.deps.position(id);
      if (!from) return null;
      const index = this.nearestFree(pool, target.position, from, radiusM);
      if (index < 0) return null;
      assignment = { index, radiusM, seen: true };
      pool.owners[index] = id;
      pool.byId.set(id, assignment);
    }
    assignment.seen = true;
    return this.point(pool, assignment.index, target.position, radiusM);
  }

  step(dt: number): void {
    if (!(dt > 0)) return;
    for (const [id, holder] of this.holders) {
      holder.heldS += dt;
      if (holder.heldS > this.config.maxHoldS + epsilon)
        this.holders.delete(id);
    }
    for (const kind of KINDS) {
      const seen = this.seen[kind];
      this.waiting[kind] = this.waiting[kind].filter((id) => seen.has(id));
      seen.clear();
      const pool = this.pools[kind];
      for (const [id, assignment] of pool.byId) {
        if (assignment.seen) assignment.seen = false;
        else this.unassign(pool, id);
      }
    }
    this.sinceReassignS += dt;
    if (this.sinceReassignS + epsilon >= this.config.reassignS) {
      this.sinceReassignS = 0;
      this.reassign();
    }
  }

  /** Zwalnia token, miejsce w kolejkach i sloty (śmierć, despawn). */
  forget(id: EntityId): void {
    this.releaseToken(id);
    for (const kind of KINDS) this.unassign(this.pools[kind], id);
  }

  snapshot(): DirectorSnapshot {
    const tokens: Record<TokenKind, EntityId[]> = { melee: [], shot: [] };
    for (const [id, holder] of this.holders) tokens[holder.kind].push(id);
    return {
      tokens,
      waiting: { melee: [...this.waiting.melee], shot: [...this.waiting.shot] },
      slots: {
        melee: [...this.pools.melee.owners],
        shot: [...this.pools.shot.owners],
      },
    };
  }

  reset(): void {
    this.holders.clear();
    for (const kind of KINDS) {
      this.waiting[kind] = [];
      this.seen[kind].clear();
      const pool = this.pools[kind];
      pool.owners.fill(null);
      pool.byId.clear();
    }
    this.sinceReassignS = 0;
  }

  dispose(): void {
    for (const off of this.off.splice(0)) off();
    this.reset();
  }

  private unassign(pool: Pool, id: EntityId): void {
    const assignment = pool.byId.get(id);
    if (!assignment) return;
    pool.owners[assignment.index] = null;
    pool.byId.delete(id);
  }

  private point(
    pool: Pool,
    index: number,
    center: Vec3,
    radiusM: number,
  ): Vec3 {
    const angle = pool.angles[index] ?? 0;
    return {
      x: center.x + Math.sin(angle) * radiusM,
      y: center.y,
      z: center.z + Math.cos(angle) * radiusM,
    };
  }

  private open(
    pool: Pool,
    index: number,
    center: Vec3,
    radiusM: number,
  ): boolean {
    if (!this.deps.clear) return true;
    const lift = this.config.probeHeightM;
    const to = this.point(pool, index, center, radiusM);
    return this.deps.clear(
      { x: center.x, y: center.y + lift, z: center.z },
      { x: to.x, y: to.y + lift, z: to.z },
    );
  }

  private cost(
    pool: Pool,
    index: number,
    center: Vec3,
    from: Vec3,
    radiusM: number,
  ): number {
    const p = this.point(pool, index, center, radiusM);
    // Zaokrąglenie: remis (np. sin(π) ≠ 0) rozstrzyga niższy indeks, nie błąd float.
    return Math.round(((p.x - from.x) ** 2 + (p.z - from.z) ** 2) * 1e6) / 1e6;
  }

  private nearestFree(
    pool: Pool,
    center: Vec3,
    from: Vec3,
    radiusM: number,
  ): number {
    let best = -1;
    let bestCost = Infinity;
    for (let i = 0; i < pool.angles.length; i++) {
      if (pool.owners[i] !== null) continue;
      const cost = this.cost(pool, i, center, from, radiusM);
      if (cost < bestCost && this.open(pool, i, center, radiusM)) {
        best = i;
        bestCost = cost;
      }
    }
    return best;
  }

  /** Globalny przydział zachłanny: pary (wróg, slot) od najbliższej; zajęte i zasłonięte odpadają. */
  private reassign(): void {
    const target = this.deps.target();
    if (!target) return;
    const center = target.position;
    for (const kind of KINDS) {
      const pool = this.pools[kind];
      if (pool.byId.size === 0) continue;
      const pairs: { id: EntityId; index: number; cost: number }[] = [];
      const radius = new Map<EntityId, number>();
      const openCache = new Map<string, boolean>();
      for (const [id, assignment] of pool.byId) {
        const from = this.deps.position(id);
        if (!from) continue;
        radius.set(id, assignment.radiusM);
        for (let i = 0; i < pool.angles.length; i++) {
          const key = `${i}:${assignment.radiusM}`;
          let open = openCache.get(key);
          if (open === undefined) {
            open = this.open(pool, i, center, assignment.radiusM);
            openCache.set(key, open);
          }
          if (open)
            pairs.push({
              id,
              index: i,
              cost: this.cost(pool, i, center, from, assignment.radiusM),
            });
        }
      }
      pairs.sort((a, b) => a.cost - b.cost || a.id - b.id || a.index - b.index);
      pool.owners.fill(null);
      pool.byId.clear();
      for (const { id, index } of pairs) {
        if (pool.byId.has(id) || pool.owners[index] !== null) continue;
        pool.owners[index] = id;
        pool.byId.set(id, { index, radiusM: radius.get(id) ?? 0, seen: false });
      }
    }
  }
}
